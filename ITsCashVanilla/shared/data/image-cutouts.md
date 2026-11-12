# Transparent uniform images

The built-in image generation/editing tool created 19 transparent PNG display assets for the 20 catalog products. The two navy trousers entries share one source photo. Originals remain beside the `*-cutout.png` files in `assets/images/`.

`image-cutouts.js` lists every original filename and its replacement. `core.js` applies the mapping to existing saved product/order records, while `catalog.js` uses the new assets for fresh records. No stock, prices, accounts, or browser records were reset.

The edit prompt set used the `background-extraction` category: remove only the white/light-gray background and ground shadow; output genuine transparency; preserve the garment/accessory shape, color, visible logos, details, fabric textures, folds, and framing; retain white fabric as opaque; avoid redesign, additions, cropping, or new shadows. Each source product photo was supplied separately as the edit target. The first gray-polo prompt also explicitly retained both front and back shirts and their hangers.

The generated cutouts were visually reviewed, including the white garments. `tests/image-cutouts.test.js` verifies every replacement exists, contains a real alpha channel with transparent pixels, and retains opaque clothing pixels. CSS removes the old image-container fill and disables multiply blending so dark mode preserves garment colors.
