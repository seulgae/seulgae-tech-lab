# Original pixel assets

All graphics in `pixelAssets.ts` were authored for Seulgae Tech Lab with integer canvas rectangles. No external images, sprite packs, fonts, or third-party art are bundled. Authorship: seulgae, with Codex-assisted implementation. These assets follow the repository's licensing terms; this change does not introduce a separate third-party license or claim rights to external art.

## Scale and palette

- Tile source: 16×16 pixels; default world display: 32×32.
- Researcher: 16×24 per frame, 4 frames per row, 8 rows. Rows: walk down/up/left/right, then idle down/up/left/right. Rendered at 2× with nearest sampling.
- Feet collider: source 10×8 at offset (3,16), independent from the 16×24 appearance.
- Main colors: ink `#1b292f`, warm floor `#ddd5bf`, wood `#c49a70`, highlight `#e4c49a`, green `#65b3a5`.

## Textures

`lab-tiles` (floor, floor variation, rug), `wall`, `reception`, `computer`, `chair`, `rack`, `equipment`, `plant`, `door`, and `researcher` (sprite sheet).

Textures are generated once per Phaser texture manager during Scene preload. There are no remote asset requests. Layout and collider coordinates live in `maps/lobbyLayout.ts`; floor data is consumed by a Phaser Tilemap. Replace the texture generator and layout data to adopt an authored tileset or Tiled map, without changing the React panel or research API.

The lobby door is decorative and remains closed; room transitions are outside this stage.

The app favicon in public/favicon.svg is also original project artwork, drawn as a small pixel-aligned SVG mark.
