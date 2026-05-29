# Changelog

All notable changes to lil agents — Windows Edition are documented here.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.3] - 2026-05-29

### Fixed
- **Characters walking in place.** When a sibling character or a screen edge
  blocked the chosen walk direction, the destination collapsed onto the start
  position, so the agent played its full walk cycle without ever moving.
  `startWalk()` now falls back to the opposite direction when one is blocked,
  and stays paused instead of animating in place when neither direction has
  room.
- **Flicker just before a walk.** The sprite canvas toggled its CSS `transform`
  between `none` and `scaleX(-1)`, which tore down and rebuilt the compositing
  layer and produced a brief one-frame flash. The flip now always uses an
  explicit `scaleX(1)` / `scaleX(-1)` transform, and `.char` keeps a stable
  composited layer (`backface-visibility: hidden`), eliminating the flicker.

## [1.2.2] - earlier

- Added OpenClaw as an AI provider.

## [1.2.0] - earlier

- Initial Windows port (Electron) of lil agents.
