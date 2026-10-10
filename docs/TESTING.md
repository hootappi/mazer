# Verification

Verified locally on 10 October 2026 with Node 24.19.0 and installed Google Chrome.

`npm run check`: eleven test groups pass. The generator checks 288 legacy combinations of shape, size, difficulty and seed for connected topology, valid routes and repeatability. Another 270 physical v2 combinations verify larger-paper growth, bounded cell counts, connected trees, solutions, physical fit, round cell lookup, ordered difficulty and exact share round trips. Additional checks cover relative difficulty, frozen v1 and v2 fingerprints, recipe rejection, scoring, invalid paths, one-use submissions, expiry, persistence across server restart, origin restrictions, rate limits and private-file exclusion. Production bundle creation succeeds.

`npm run test:browser`: 26 checks pass across phone (390 × 844), iPad (820 × 1180) and desktop (1440 × 1000) profiles. The desktop instance of the touch-only check is intentionally inapplicable; mouse and keyboard play are tested there.

Browser checks cover all four shapes, local saving and reloading, SVG/PNG/JSON downloads, print document content, shared-link restoration, color themes, a completed traced route, guest score posting, opening a leaderboard challenge, round-maze completion, hints switching to practice, keyboard movement, real Chrome touch events, swipe steps, offline shell restoration and practice fallback. Paper checks cover all ten A6–A2 orientation combinations, preview proportions, lower-left metadata, the external action row, saved/shared layout restoration and SVG paper metadata. The v2 workflow checks equal 10 mm SVG scale on A6 and A2 (including the actual print document transform), more than tenfold cell growth, repeatability when switching back, server-verified play and same-board leaderboard challenges. API tests persist and filter scores for both recipe versions. Export checks inspect PNG proportions and verify single-page A6 portrait and A2 landscape PDFs with physical dimensions within Chromium’s pixel rounding tolerance. A 375 px overflow check also passes.

Screenshots were visually inspected at phone and desktop sizes. Tests use Chrome's device emulation, not physical iOS/Safari devices. Physical device testing remains useful for future refinements.

Run `npm ci`, `npm run check` and `npm run test:browser` to reproduce. Browser fixtures use separate ignored local data and never write to the public leaderboard. GitHub Actions runs these checks on pushes and pull requests.

## Deployment verification

The production Docker image built successfully on lab and passed its health check. Chrome completed a ranked round maze through both tailnet and public HTTPS endpoints, received a server-verified result and loaded the leaderboard with zero browser errors. No synthetic scores were posted publicly. The lab index link and healthy Homepage dashboard were verified. Mazer has no host port binding after publication. SQLite integrity returned `ok`; a live backup was created and opened successfully. Backup restoration was not performed against live data.

The initial release also passed [GitHub Actions](https://github.com/hootappi/mazer/actions/runs/38029226059), including logic/API tests, build and the browser suite on Linux.
