import { sqlBackend } from "./runtime.js";

async function request(path, method = "GET", body) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "X-ITsCash-Request": "1" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(result.error || (response.status === 401 ? "Please sign in again." : "The server request failed."));
  return result;
}

export const authClient = {
  enabled: sqlBackend,
  session: () => request("/api/session"),
  signIn: (email, password, workspace) => request("/api/auth/login", "POST", { email, password, workspace }),
  signOut: () => request("/api/auth/logout", "POST"),
  register: (fields, password) => request("/api/accounts", "POST", { ...fields, password }),
  updateProfile: (fields) => request("/api/profile", "PUT", fields),
  updateAvatar: (avatar) => request("/api/profile/avatar", "PUT", { avatar })
};
