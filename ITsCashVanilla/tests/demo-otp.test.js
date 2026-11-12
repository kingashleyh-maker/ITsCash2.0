import test from "node:test";
import assert from "node:assert/strict";
import { createDemoOtp, verifyDemoOtp } from "../login/scripts/demo-otp.js";

test("demo OTP has six digits and resending replaces the previous code", () => {
  const first = createDemoOtp("", 0);
  assert.match(first.code, /^\d{6}$/);
  assert.equal(first.expiresAt, 300_000);
  assert.equal(first.resendAt, 30_000);
  const replacement = createDemoOtp(first.code, 30_000);
  assert.notEqual(first.code, replacement.code);
});
test("demo OTP accepts the correct code once, preserving leading zeros", () => {
  const challenge = { ...createDemoOtp("", 0), code: "001234" };
  verifyDemoOtp(challenge, "001234", 1);
  assert.throws(() => verifyDemoOtp(challenge, "001234", 2), /already been used/);
});
test("incorrect, expired, and exhausted demo codes cannot continue", () => {
  const challenge = createDemoOtp("", 0);
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.throws(() => verifyDemoOtp(challenge, "invalid", 1), /Incorrect code/);
  }
  assert.throws(() => verifyDemoOtp(challenge, challenge.code, 2), /Too many/);
  const expired = createDemoOtp("", 0);
  assert.throws(() => verifyDemoOtp(expired, expired.code, 300_000), /expired/);
});
