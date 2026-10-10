# Decisions

Confirmed on 10 October 2026:

- Pure web app now. Native iOS distribution belongs on the future roadmap.
- Trace/swipe first. Tilt control is a future alternative.
- Enter a name after finishing, without account creation. Leaderboard entries identify the maze and score, and open the same board as a challenge.
- Shapes: square, portrait rectangle, landscape rectangle and round.
- Public GitHub repository and deployment under the existing lab hosting setup.

Implementation choices:

- No framework or runtime package dependencies. ES modules, SVG, Node's HTTP server and built-in SQLite keep the app understandable and rebuildable. Playwright is a development dependency for browser verification.
- Round mazes are concentric polar cells. The number of sectors doubles at ring boundaries to keep outer cells reasonably sized. Rectangle variants use a square-cell grid.
- A seed creates 16 deterministic spanning trees per shape/size. Easy selects the shortest entrance-to-exit route, Steady a middle route, Hard the longest. This is relative difficulty within the candidate family, not a validated human difficulty rating.
- Every maze is a connected tree with one shortest route. No loops in v1. Branches and dead ends create detours; future maze families can use different topology under a new recipe version.
- Recipe v1 contains seed, shape, size and level. Generator and scoring fixtures protect repeatability. Theme is independent of the recipe.
- Score v1: `round(10000 × (optimalMoves / actualMoves) × (0.6 + 0.4 / (1 + elapsedMs / (optimalMoves × 1500))))`, with the pace term floored at 0.1. This normalizes pace by route length and rewards efficiency. Compare players on the same maze for the fairest challenge.
- Server elapsed time starts when a ranked run is issued, including network latency. The clock does not pause on tab switching. The server replays all moves, verifies the endpoint, computes the result and issues a one-use posting token.
- Guest leaderboard is casual competition. There is no identity verification or proof against solver automation. Sharing target names/scores is presentation only and never changes scoring.
- Run sessions and unposted results expire after one hour and live in memory. A server restart invalidates them. Posted scores persist in SQLite with WAL enabled.
- Names are normalized and limited to 24 characters. Rate limits apply per IP; the trusted public proxy must overwrite X-Forwarded-For. Shared networks share a limit. Tailnet preview disables proxy trust.
- Revealing the solution or losing API access makes a run unranked. Offline score submission is not queued.
- Print uses the browser's print/PDF engine, A4/A3, black ink on white paper. SVG/PNG exports can include a solution. JSON contains the canonical recipe. Manufacturing-ready geometry is not claimed.
- Warm paper is the main theme. After hours and Blue hour are small color alternatives, not separate game systems.
