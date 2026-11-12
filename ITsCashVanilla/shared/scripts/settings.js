import { modal, button, user, esc, image, s, actor, act, field, select, form, submit } from "./core.js";
import { defaults, loadPreferences, savePreferences } from "./preferences.js";
import { readProfileImage } from "./profile-image.js";
import { bellIcon } from "./icons.js";

export function openSettings() {
  if (document.querySelector(".settings-dialog[open]")) return;
  const preferences = loadPreferences();
  const account = user();
  const displayName = account?.role === "Student" && account.username ? account.username : account?.name || "Your account";
  const sectionIcons = {
    account: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3h-4v-5h-1v5H9v-5H8v5z"/></svg>',
    notifications: bellIcon,
    appearance: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20h1a3 3 0 0 0 2.5-4.7c-.5-.8.1-1.8 1-1.8H18a4 4 0 0 0 4-4C22 6.3 17.5 2 12 2zM7 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm4-3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm5 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM6 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>'
  };
  const canEditPhoto = ["Student", "Cashier", "Proware", "Inventory Staff", "Admin"].includes(account?.role);
  let selectedAvatar = account?.avatar || "";
  const avatarMarkup = (value, cls = "avatar") => value
    ? `<img class="${cls}" src="${esc(image(value))}" alt="Profile picture">`
    : `<span class="${cls}">${esc(displayName[0] || "U")}</span>`;
  const escape = esc;
  const info = (label, value) => `<div class="settings-account-row"><dt>${label}</dt><dd>${escape(value || "Not provided")}</dd></div>`;
  const dialog = modal("Settings", `
    <div class="settings-layout"><aside class="settings-sidebar">
      <div class="settings-identity"><span class="settings-identity-photo">${avatarMarkup(account?.avatar)}</span><div><strong>${escape(displayName)}</strong><small>${escape(account?.role || "School account")}</small></div></div>
      <nav class="settings-nav" aria-label="Settings sections">
        ${[["account", "Account"], ["notifications", "Notifications"], ["appearance", "Appearance"]].map(([key, label]) => `<button type="button" data-settings-section="${key}" aria-controls="settings-${key}" ${key === "account" ? 'aria-current="page"' : ""}><span aria-hidden="true">${sectionIcons[key]}</span>${label}</button>`).join("")}
      </nav><p class="settings-sidebar-note">Your campus. Your preferences.</p>
    </aside><div class="settings-main">
    <section id="settings-account" class="settings-panel" aria-labelledby="settings-account-heading">
      <h2 id="settings-account-heading" tabindex="-1">Account</h2><p class="settings-description">Your school-assigned account and access.</p>
      ${canEditPhoto ? `<div class="settings-photo-editor"><div class="settings-photo-preview">${avatarMarkup(selectedAvatar, "settings-photo")}</div><div>
        <h3>Profile picture</h3><p>Choose a JPG or PNG image up to 10 MB.</p>
        <label class="settings-photo-picker">Choose picture<input type="file" name="avatarFile" accept="image/jpeg,image/png"></label>
        <div class="settings-photo-actions">${button("Save picture", () => savePhoto(selectedAvatar), "primary settings-photo-save")}${button("Remove picture", () => savePhoto(""), "settings-photo-remove")}</div>
        <p class="settings-photo-status" role="status" aria-live="polite"></p>
      </div></div>` : ""}
      <h3>Account info</h3><dl class="settings-account-info">
        ${info("Full name", account?.name)}${info("School email", account?.email)}${info("Account role", account?.role)}
        ${account?.role === "Student" ? info("Student number", account.studentNumber) + info("Course / program", account.course) + info("Year level", account.year) : ""}
        ${account?.role === "Student" ? "" : info("Phone number", account?.phone)}
      </dl>
      ${account?.role === "Student" ? `<h3>Personal details</h3><p class="settings-description">You can update your username, phone number, gender, and birthdate. Your school email and other school records remain managed by your administrator.</p>
        ${form(`<div class="settings-profile-grid">${field("Username", "username", account.username || "", "text", 'maxlength="50" pattern="[A-Za-z0-9._-]{3,50}" autocomplete="nickname"')}
          ${field("Phone number", "phone", account.phone || "", "tel", 'maxlength="30" autocomplete="tel"')}
          ${select("Gender", "gender", ["Male", "Female", "Other", "Prefer not to say"], account.gender || "Prefer not to say")}
          ${field("Birthdate", "dateOfBirth", account.dateOfBirth || "", "date", `max="${new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)}" autocomplete="bday"`)}
        </div>${submit("Save personal details")}<p class="settings-profile-status" role="status" aria-live="polite"></p>`, async data => {
          const result = await act(() => s.updateProfile(actor(), data));
          const status = dialog.querySelector(".settings-profile-status");
          status.classList.toggle("settings-error", !result.ok);
          status.textContent = result.ok ? "Personal details saved." : "Could not save your details. Please try again.";
          if (result.ok) dialog.querySelector(".settings-identity strong").textContent = user()?.username || user()?.name || "Your account";
        }, "settings-student-profile")}` : '<p class="note">Your account details and access are managed by your school administrator.</p>'}
      <div class="settings-security"><h3>Password &amp; security</h3><p class="settings-description">Your password is protected and is never displayed here. Contact your school administrator for account or password assistance.</p></div>
    </section>
    <section id="settings-notifications" class="settings-panel" aria-labelledby="settings-notifications-heading" hidden>
      <h2 id="settings-notifications-heading" tabindex="-1">Notifications</h2><p class="settings-description">Choose how updates appear in this browser.</p>
      <label class="settings-motion"><span><strong>Update messages</strong><small>Show brief messages when actions complete or records refresh. Errors will always be shown.</small></span><input type="checkbox" name="showMessages" ${preferences.showMessages ? "checked" : ""}></label>
      <label class="settings-motion"><span><strong>Unread indicators</strong><small>Show unread counts on the notification bell.</small></span><input type="checkbox" name="showBadges" ${preferences.showBadges ? "checked" : ""}></label>
      <p class="note">These preferences control in-app notices. They do not send email or browser push notifications.</p>
    </section>
    <section id="settings-appearance" class="settings-panel" aria-labelledby="settings-appearance-heading" hidden>
    <h2 id="settings-appearance-heading" tabindex="-1">Appearance</h2>
    <p class="settings-description">Make ITsCash comfortable for you. Changes are saved automatically in this browser.</p>
    <fieldset class="settings-themes"><legend>Appearance</legend><div class="theme-options">
      ${[["light", "Light", "A bright, clean workspace"], ["dark", "Dark", "Softer colors for low light"], ["system", "System", "Follow your device"]].map(([value, label, hint]) => `
        <label class="theme-option"><input type="radio" name="theme" value="${value}" ${preferences.theme === value ? "checked" : ""}>
          <span class="theme-preview preview-${value}" aria-hidden="true"><span></span><i></i><i></i></span>
          <strong>${label}</strong><small>${hint}</small></label>`).join("")}
    </div></fieldset>
    <label class="field settings-text-size"><span>Text size</span><select name="textSize">
      <option value="standard" ${preferences.textSize === "standard" ? "selected" : ""}>Standard</option>
      <option value="large" ${preferences.textSize === "large" ? "selected" : ""}>Larger</option>
    </select></label>
    <label class="settings-motion"><span><strong>Reduce motion</strong><small>Keep page changes and dialogs still.</small></span>
      <input type="checkbox" name="reduceMotion" ${preferences.reduceMotion ? "checked" : ""}></label>
    </section>
    <p class="settings-status" role="status" aria-live="polite"></p>
    <div class="settings-actions">${button("Reset to defaults", () => {
      try {
        savePreferences(defaults);
        dialog.querySelector('[name="theme"][value="system"]').checked = true;
        dialog.querySelector('[name="textSize"]').value = "standard";
        dialog.querySelector('[name="reduceMotion"]').checked = false;
        dialog.querySelector('[name="showMessages"]').checked = true;
        dialog.querySelector('[name="showBadges"]').checked = true;
        report("Default settings restored.");
      } catch { report("Settings could not be saved. Check your browser storage permissions.", true); }
    })}${button("Done", () => dialog.close(), "primary")}</div>
    </div></div>`);
  dialog.classList.add("settings-dialog");
  const savePhotoButton = dialog.querySelector(".settings-photo-save");
  const removePhotoButton = dialog.querySelector(".settings-photo-remove");
  if (canEditPhoto) {
    savePhotoButton.disabled = true;
    removePhotoButton.disabled = !selectedAvatar;
    const fileInput = dialog.querySelector('[name="avatarFile"]');
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      const status = dialog.querySelector(".settings-photo-status");
      try {
        fileInput.disabled = true;
        savePhotoButton.disabled = true;
        removePhotoButton.disabled = true;
        const value = await readProfileImage(file);
        selectedAvatar = value;
        dialog.querySelector(".settings-photo-preview").innerHTML = avatarMarkup(selectedAvatar, "settings-photo");
        status.textContent = "Preview ready. Select Save picture to apply it.";
        status.classList.remove("settings-error");
      } catch (error) {
        status.textContent = error.message || "Choose a valid image.";
        status.classList.add("settings-error");
      } finally {
        fileInput.disabled = false;
        fileInput.value = "";
        savePhotoButton.disabled = selectedAvatar === (user()?.avatar || "");
        removePhotoButton.disabled = !(user()?.avatar || selectedAvatar);
      }
    });
  }
  async function savePhoto(value) {
    const input = dialog.querySelector('[name="avatarFile"]');
    input.disabled = true;
    savePhotoButton.disabled = true;
    removePhotoButton.disabled = true;
    try {
      const result = await act(() => s.updateAvatar(actor(), value));
      const status = dialog.querySelector(".settings-photo-status");
      status.classList.toggle("settings-error", !result.ok);
      if (result.ok) {
        selectedAvatar = value;
        dialog.querySelector(".settings-photo-preview").innerHTML = avatarMarkup(value, "settings-photo");
        dialog.querySelector(".settings-identity-photo").innerHTML = avatarMarkup(value);
        status.textContent = value ? "Profile picture saved." : "Profile picture removed.";
      } else status.textContent = "Picture could not be saved. Please try again.";
    } finally {
      input.disabled = false;
      savePhotoButton.disabled = selectedAvatar === (user()?.avatar || "");
      removePhotoButton.disabled = !(user()?.avatar || selectedAvatar);
    }
  }
  const sectionButtons = [...dialog.querySelectorAll("[data-settings-section]")];
  sectionButtons.forEach(control => control.addEventListener("click", () => {
    if (control.getAttribute("aria-current") === "page") return;
    const key = control.dataset.settingsSection;
    dialog.querySelectorAll(".settings-panel").forEach(panel => panel.hidden = panel.id !== `settings-${key}`);
    sectionButtons.forEach(item => item === control ? item.setAttribute("aria-current", "page") : item.removeAttribute("aria-current"));
    const main = dialog.querySelector(".settings-main");
    main.scrollTop = 0;
    dialog.querySelector(`#settings-${key}-heading`).focus({ preventScroll: true });
  }));
  function report(message, error = false) {
    const status = dialog.querySelector(".settings-status");
    status.textContent = message;
    status.classList.toggle("settings-error", error);
  }
  dialog.addEventListener("change", (event) => {
    if (!["theme", "textSize", "reduceMotion", "showMessages", "showBadges"].includes(event.target.name)) return;
    try {
      savePreferences({
        theme: dialog.querySelector('[name="theme"]:checked').value,
        textSize: dialog.querySelector('[name="textSize"]').value,
        reduceMotion: dialog.querySelector('[name="reduceMotion"]').checked,
        showMessages: dialog.querySelector('[name="showMessages"]').checked,
        showBadges: dialog.querySelector('[name="showBadges"]').checked
      });
      report("Settings saved.");
    } catch { report("Settings could not be saved. Check your browser storage permissions.", true); }
  });
}
