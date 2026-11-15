# Pixel lobby (stage 15)

## Scope

Frontend-only visual update. The 800×600 world, Phaser 3.90.0, speed of 200 world pixels/second, WASD/arrows, E interaction and React research API contract are retained. There are no backend, DB, GitHub Actions, server or Tailscale policy changes.

## Files and responsibilities

- `frontend/src/game/assets/pixelAssets.ts`: original integer-pixel texture generation during Scene preload. Art sources, palette and sizing: adjacent `README.md`.
- `frontend/src/game/maps/lobbyLayout.ts`: floor tile indices, world constants, object positions and independent collider rectangles.
- `frontend/src/game/LobbyMap.ts`: Phaser Tilemap floor and furniture rendering, invisible static bodies and computer highlight. Decorative text and the closed door do not create new interactions.
- `frontend/src/game/Player.ts`: Arcade Sprite with a 10×8 source-size foot collider at (3,16), rendered at 2×. Input normalizes velocity; Arcade Physics applies time and collision. World bounds are a fallback in addition to walls.
- `frontend/src/game/PlayerAnimation.ts`: last-facing direction and 8 animations (walk/idle × 4 directions), registered once per game animation manager. Blocked movement uses the idle pose.
- `frontend/src/game/scenes/LabLobbyScene.ts`: assets, lobby, player collision and the existing research event bridge.
- React/CSS: responsive shell, control legend and research dialog. FIT scaling plus ResizeObserver keeps canvas geometry synchronized with its parent; pixelArt/roundPixels and CSS nearest sampling preserve hard edges.

An 800×600 world uses a 25×19 tile grid with 32px displayed tiles; the last 8px are clipped by the camera, beneath the bottom wall. The wall at the top has a 64px footprint so the taller character stays inside the visible room. Door transitions and mobile controls are deliberately absent.

## Verification

Run `npm test`, `npm run lint`, `npm run build` in `frontend/`. Tests cover interaction gating/listener cleanup, API URL/abort/error handling, layout bounds and spawn clearance, facing, all 32 animation frames and integer-pixel asset generation. Mocked graphics tests do not replace browser rendering or Arcade collision checks.

Browser checks include four directions, desk and computer collision, computer highlight/E prompt, dialog close/ESC and movement locking, and 1280×720 / 1440×900 / 390×844 layouts. Production research records were read through a temporary local verification proxy; the API returned a real empty list (HTTP 200). No records were inserted or DB schema changed. A populated production record/detail cannot be demonstrated while there are no records; API tests cover request routing independently.

The temporary proxy configuration is outside the repository; the checked-in Vite API proxy is unchanged. Backend/infra remain subject to existing CI and deployment procedures. Do not add a separate frontend deployment workflow for this change.
