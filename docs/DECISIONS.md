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
- Print uses the browser's print/PDF engine at the selected A6–A2 size and orientation, with black ink on white paper. Preview, SVG, PNG and print use the same sheet renderer. SVG carries physical millimetre dimensions; PNG uses a 2,400 px long edge. JSON contains the canonical recipe and presentation layout. Manufacturing-ready geometry is not claimed.
- Warm paper is the main theme. After hours and Blue hour are small color alternatives, not separate game systems.

Paper workflow update, 10 October 2026:

- Controls are paper size (A6, A5, A4, A3, A2), orientation, shape, maze size and difficulty, in that order. The action label is PLAY.
- For legacy v1 mazes, paper size/orientation are presentation settings carried by share links and saved collections. Existing links, saved recipes and scores retain their original topology and identity. New mazes now use v2 as described below; no database migration is required.
- UI shape choices are Square, Rectangle and Round. A rectangle follows the chosen orientation through the existing portrait/landscape v1 generator variants. Square and round boards retain their geometry when the paper orientation changes.
- The sheet displays title, maze and small bottom-left details. Keep, PLAY, Export and Share live below the sheet.

Physical maze sizing update, 10 October 2026:

- New recipes use v2 and include paper size and orientation in the canonical identity. Choosing any generator setting or generating another seed upgrades a loaded v1 board to v2; simply opening, playing or sharing an old maze preserves it.
- Maze size controls density: Small uses 14 mm cell spacing, Medium 10 mm, Large 7 mm. A larger sheet gains cells rather than magnifying them. These are nominal wall-to-wall spacings; wall strokes occupy part of that width. Round mazes keep the same radial ring spacing, with sector widths varying under the polar topology.
- v2 uses fixed 8 mm side margins, a 20 mm header, a 22 mm footer and 0.15 cell padding around the maze. Rectangles fill the available area with whole cells; square and round mazes use the shorter available dimension. The renderer uses the same geometry and exact physical spacing in preview, SVG, PNG and print. Print at actual size/100% to retain millimetre spacing.
- At Medium density, an A6 portrait square is 8 × 8 cells and an A2 portrait square is 40 × 40 cells, both at 10 mm spacing. Orientation also changes the space available to the maze.
- v2 paper settings are part of ranked-run validation, persistent score identity and same-board challenges. Both versions remain supported. Supported paper/density combinations bound generated maze size below 8,000 cells; existing route and request limits remain sufficient.

Immersive gameplay update, 10 October 2026:

- Play opens a fixed viewport board with scroll/overscroll and board touch scrolling disabled. Native Fullscreen API is attempted on YES after closing readiness, so it cannot be promoted above the readiness popup; the viewport layout remains usable when the browser declines or does not support it. Stop restores the creator and its scroll position. Escaping native fullscreen stops the session.
- A readiness dialog precedes run creation and timing. Fullscreen denial cannot block starting; late fullscreen completion re-promotes any open game popup above the fullscreen layer. YES starts the ranked request; failed connectivity falls back to practice. The maze is rendered alone for play, maximizing its usable area; printable paper composition remains in Create/export.
- Timer, moves and mode float at the top-left; Draw/Swipe, Pause, solution, Restart and Stop stay at the bottom. Pause shows a modal and blocks pointer and keyboard movement; elapsed time keeps running for ranking fairness, just as it does when switching tabs. Restart returns to readiness with a new run; completion shows the result dialog over the game before leaving it.
- Touch devices prompt for the selected paper orientation before YES and block gameplay while the orientation differs. Rotation during an active run does not stop ranked time. No sensor permissions are requested.
- Draw is the default: touching a connected adjacent cell advances immediately. Starting on an existing trail cell legally retraces the visited path to that cell, counting backtracking moves, before tracing onward. Remote unvisited cells cannot teleport the player or cross closed walls. Swipe is a distinct directional step mode; a gesture outside the maze also supports a directional step. Existing server validation and generator fingerprints remain unchanged.
- Each game session has an internal generation counter so late run/finish responses cannot resume or overwrite a stopped/restarted session.

iOS swipe usability fix, 11 October 2026:

- Touch devices and iOS/iPadOS use the locked full-window game view without requesting native fullscreen. This avoids the native fullscreen downward-swipe exit gesture competing with gameplay. iPadOS identifying itself as MacIntel is also detected through touch capability, including with a fine pointer.
- Desktop devices retain native fullscreen where available. A 44 px X button at the top-right exits the game and restores the creator. Existing Stop and modal exit actions remain available.
- The board also cancels touchmove defaults while a game is open; browser scrolling remains disabled. This does not intercept touches on popup forms or controls. Physical iOS Safari verification is left to device testing; browser automation verifies actual touch events and simulated iPadOS desktop identity.
