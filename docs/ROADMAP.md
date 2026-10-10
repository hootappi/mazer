# Future development

These are options, not delivery promises.

## Next: learn from real play

- Test touch control and difficulty with people on actual phones and iPads. Refine route selection, wall spacing and scoring from observed play.
- Improve accessibility with a dedicated step-by-step movement interface and screen-reader guidance.
- Add daily curated challenges, personal records history and optional solution pages printed separately.
- Add leaderboard name moderation and deletion tooling if public use warrants it. Accounts are not required for the current guest experience.

## Alternative gameplay: tilt the ball

- Prototype DeviceOrientation controls behind an explicit permission button where required by the browser, plus calibration, a dead zone and landscape/portrait handling.
- Add ball movement and wall collision as a separate input/gameplay mode using the same versioned maze definition.
- Keep a distinct scoring/leaderboard category for tilt so physics and trace times are not mixed.
- Retain trace/swipe when motion sensors are unavailable or uncomfortable to use.

## Optional native iOS/iPadOS app

- Keep the pure maze generator, recipe and scoring contracts independent of browser rendering so an iOS shell or native client can reuse them.
- Decide between a thin native wrapper and a native interface after real web usage identifies a need. The current web app remains available.
- Add native motion/haptics, lifecycle handling, offline storage, signing, App Store review and release automation only when that scope is approved.

## Physical and themed editions

- Explore manufacturable vector geometry, tool clearance, material thickness and fabrication validation before introducing DXF/CNC/laser exports or ordering.
- Add richer themes without changing maze identity or rules. Keep exports and gameplay consistent.
- Introduce new generator versions for loops, multiple exits or other maze families; retain old recipe readers so challenge links remain playable.
