// Interface prototype only. Real OTP generation and verification must move to the backend.
export function createDemoOtp(previousCode = "", now = Date.now()) {
  let code;
  do {
    code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  } while (code === previousCode);
  return { code, expiresAt: now + 5 * 60_000, resendAt: now + 30_000, attempts: 0, used: false };
}

export function verifyDemoOtp(challenge, input, now = Date.now()) {
  if (challenge.used) throw Error("This code has already been used.");
  if (now >= challenge.expiresAt) throw Error("This code has expired. Request a new code.");
  if (challenge.attempts >= 5) throw Error("Too many incorrect attempts. Request a new code.");
  challenge.attempts++;
  if (!/^\d{6}$/.test(input) || input !== challenge.code)
    throw Error("Incorrect code. Check the demo code and try again.");
  challenge.used = true;
}
