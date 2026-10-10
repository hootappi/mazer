# Verification

Verified locally on 10 October 2026 with Node 24.19.0 and installed Google Chrome.

`npm run check`: six test groups pass. The generator checks 288 combinations of shape, size, difficulty and seed for connected topology, valid routes and repeatability. Additional checks cover relative difficulty, frozen v1 fingerprints, recipe rejection, scoring, invalid paths, one-use submissions, expiry, persistence across server restart, origin restrictions, rate limits and private-file exclusion. Production bundle creation succeeds.

`npm run test:browser`: 20 checks pass across phone (390 × 844), iPad (820 × 1180) and desktop (1440 × 1000) profiles. The desktop instance of the touch-only check is intentionally inapplicable; mouse and keyboard play are tested there.

Browser checks cover all four shapes, local saving and reloading, SVG/PNG/JSON downloads, print document content, shared-link restoration, color themes, a completed traced route, guest score posting, opening a leaderboard challenge, round-maze completion, hints switching to practice, keyboard movement, real Chrome touch events, swipe steps, offline shell restoration and practice fallback. Export checks inspect PNG dimensions for portrait proportions and generate a landscape PDF to verify one A4 page. A 375 px overflow check also passes.

Screenshots were visually inspected at phone and desktop sizes. Tests use Chrome's device emulation, not physical iOS/Safari devices. Physical device testing remains useful for future refinements.

Run `npm ci`, `npm run check` and `npm run test:browser` to reproduce. Browser fixtures use separate ignored local data and never write to the public leaderboard. GitHub Actions runs these checks on pushes and pull requests.
