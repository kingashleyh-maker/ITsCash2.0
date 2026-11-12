import { s, db, esc, button, field, form, submit, go, url, workspaceForRole } from "../../shared/scripts/core.js";
import { createDemoOtp, verifyDemoOtp } from "./demo-otp.js";
let pendingOtp = null;
export const hasPendingOtp = () => pendingOtp !== null;

let otpTimer;
function otp(target, notice = "") {
  clearInterval(otpTimer);
  const pending = pendingOtp;
  target.innerHTML = `<main class="auth-page"><a class="brand" href="${url()}"><span class="sti-logo">STI</span><b>ITsCash</b></a>
    <section class="card auth-card otp-card" aria-labelledby="otp-title">
      <span class="eyebrow">EMAIL VERIFICATION &middot; STEP 2 OF 2</span>
      <div class="otp-symbol" aria-hidden="true">&#9993;</div>
      <h1 id="otp-title">Verify your email</h1>
      <p>Enter the six-digit verification code for <strong class="otp-email">${esc(pending.email)}</strong>.</p>
      <aside class="otp-demo" aria-label="Prototype verification code">
        <output class="otp-demo-code">${pending.challenge.code}</output>
        <small class="otp-expiry" role="timer" aria-label="Code expiry"></small>
      </aside>
      <p class="otp-status" role="status" aria-live="polite">${esc(notice)}</p>
      ${form('<fieldset class="otp-digits"><legend>Verification code</legend><div class="otp-boxes">'
        + Array.from({ length: 6 }, (_, i) => `<input class="otp-digit" name="otp${i}" type="text" inputmode="numeric" autocomplete="${i === 0 ? 'one-time-code' : 'off'}" pattern="[0-9]" maxlength="1" required aria-label="Digit ${i + 1} of 6" aria-describedby="otp-help">`).join('')
        + '</div></fieldset><p id="otp-help" class="otp-help">Enter the 6-digit code. You can also paste it.</p>'
        + submit("Verify and continue"), (data) => {
          try {
            const code = Array.from({ length: 6 }, (_, i) => data['otp' + i] || '').join('');
            verifyDemoOtp(pending.challenge, code);
            clearInterval(otpTimer);
            sessionStorage.setItem("itscash_vanilla_actor", pending.actor);
            pendingOtp = null;
            go(pending.workspace, "overview");
          } catch (error) {
            const status = target.querySelector(".otp-status");
            status.textContent = error.message;
            status.classList.add("otp-error");
            target.querySelectorAll('.otp-digit').forEach(input => input.setAttribute('aria-invalid', 'true'));
            const first = target.querySelector('.otp-digit');
            first.focus();
            first.select();
          }
        }, "otp-form")}
      <div class="otp-actions">${button("Resend code", () => {
        if (Date.now() < pending.challenge.resendAt) return;
        pending.challenge = createDemoOtp(pending.challenge.code);
        otp(target, "A new code is ready. The previous code no longer works.");
      }, "otp-text-button otp-resend")}${button("Back to sign in", async () => {
        await s.signOut();
        clearInterval(otpTimer);
        pendingOtp = null;
        auth(target);
      }, "otp-text-button")}</div>
    </section><p class="auth-foot">Prototype verification &middot; Email delivery is not connected.</p></main>`;

  const boxes = [...target.querySelectorAll('.otp-digit')];
  const distribute = (value, start) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, boxes.length - start);
    if (!digits) return;
    [...digits].forEach((digit, offset) => { boxes[start + offset].value = digit; });
    const next = boxes[Math.min(start + digits.length, boxes.length - 1)];
    next.focus();
    next.select();
  };
  boxes.forEach((box, index) => {
    box.addEventListener('focus', () => box.select());
    box.addEventListener('input', () => {
      box.value = box.value.replace(/[^0-9]/g, '').slice(-1);
      boxes.forEach(input => input.removeAttribute('aria-invalid'));
      if (box.value && index < 5) boxes[index + 1].focus();
    });
    box.addEventListener('paste', event => {
      event.preventDefault();
      distribute(event.clipboardData.getData('text'), index);
    });
    box.addEventListener('beforeinput', event => {
      if (event.data && event.data.length > 1) {
        event.preventDefault();
        distribute(event.data, index);
      }
    });
    box.addEventListener('keydown', event => {
      if (event.key === 'Backspace' && !box.value && index > 0) {
        event.preventDefault();
        boxes[index - 1].value = '';
        boxes[index - 1].focus();
      } else if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault(); boxes[index - 1].focus();
      } else if (event.key === 'ArrowRight' && index < 5) {
        event.preventDefault(); boxes[index + 1].focus();
      }
    });
  });
  const card = target.querySelector('.otp-card');
  const resend = target.querySelector('.otp-resend');
  const expiry = target.querySelector('.otp-expiry');
  const verify = target.querySelector('.otp-form [type="submit"]');
  const tick = () => {
    if (!card.isConnected || pendingOtp !== pending) { clearInterval(otpTimer); return; }
    const remaining = Math.max(0, Math.ceil((pending.challenge.expiresAt - Date.now()) / 1000));
    const cooldown = Math.max(0, Math.ceil((pending.challenge.resendAt - Date.now()) / 1000));
    expiry.textContent = remaining ? 'Code expires in ' + Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0') : 'Code expired. Resend to get a new code.';
    resend.disabled = cooldown > 0;
    resend.textContent = cooldown ? 'Resend code in ' + cooldown + 's' : 'Resend code';
    verify.disabled = remaining === 0;
  };
  tick();
  otpTimer = setInterval(tick, 1000);
  boxes[0].focus();
}
// All entry pages share one form; the account record determines the destination.
function home(target) { auth(target); }
function auth(target) {
  if (pendingOtp) { otp(target); return; }
  const fields = field("School email", "email", "", "email", 'autocomplete="username" required')
    + field("Password", "password", "", "password", 'required minlength="8" autocomplete="current-password"');
  target.innerHTML = `<main class="login-shell">
    <section class="login-brand" aria-label="ITsCash school portal">
      <a class="brand" href="${url()}"><span class="sti-logo">STI</span><span>ITsCash<span class="brand-caption">CAMPUS PAYMENT &amp; UNIFORM PORTAL</span></span></a>
      <div class="brand-content"><span class="eyebrow">YOUR CAMPUS. CONNECTED.</span>
        <h1>One place for<br>your campus<br>essentials.</h1>
        <p>Manage student purchases, school payments, and uniform inventory with the account made for you.</p>
        <div class="brand-tags"><span>Uniform orders</span><span>Tuition payments</span><span>Inventory</span></div>
      </div><small>STI Campus Store &middot; ITsCash</small>
    </section>
    <section class="login-panel" aria-labelledby="login-title"><span class="welcome-label">WELCOME BACK</span><h2 id="login-title">Log in to ITsCash</h2>
      <p class="login-description">Sign in with the school email assigned to your account.</p>
      ${form(fields + submit("Sign in"), async (data) => {
        const actor = await s.signIn(data.email, data.password);
        const account = db().accounts.find(account => account.id === actor);
        const workspace = workspaceForRole(account?.role);
        if (!workspace) { await s.signOut(); throw Error("Your account needs an assigned role. Contact your school administrator."); }
        pendingOtp = { actor, workspace, email: data.email.trim().toLowerCase(), challenge: createDemoOtp() };
        otp(target);
      })}
      <p class="login-footer">Use the account assigned to you by your school.</p>
    </section></main>`;
}
export { auth, home };
