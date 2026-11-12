import test from "node:test";
import assert from "node:assert/strict";
import { validateProfileFile, MAX_PROFILE_UPLOAD_BYTES } from "../shared/scripts/profile-image.js";

test("profile upload accepts JPG/PNG up to exactly 10 MB and rejects larger or unsupported files", () => {
  for (const type of ["image/jpeg", "image/png"]) {
    assert.doesNotThrow(() => validateProfileFile({ type, size: MAX_PROFILE_UPLOAD_BYTES }));
    assert.throws(() => validateProfileFile({ type, size: MAX_PROFILE_UPLOAD_BYTES + 1 }), /10 MB/);
  }
  assert.throws(() => validateProfileFile({ type: "image/svg+xml", size: 100 }), /JPG or PNG/);
});
