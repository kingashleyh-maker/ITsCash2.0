export const MAX_PROFILE_UPLOAD_BYTES = 10 * 1024 * 1024;
export function validateProfileFile(file) {
  if (!["image/jpeg", "image/png"].includes(file.type) || file.size > MAX_PROFILE_UPLOAD_BYTES)
    throw Error("Choose a JPG or PNG image up to 10 MB.");
}

// Keep uploads generous while storing an image sized for profile displays.
export async function readProfileImage(file) {
  validateProfileFile(file);
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(Error("This image could not be read."));
    reader.readAsDataURL(file);
  });
  const picture = new Image();
  picture.src = source;
  await picture.decode();
  const scale = Math.min(1, 512 / Math.max(picture.naturalWidth, picture.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw Error("Your browser could not prepare this image.");
  context.drawImage(picture, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(file.type, 0.9);
}
