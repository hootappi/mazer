# Mazer

A little lost. A lot of possibility.

Create a reproducible maze, find your way from A to B, enter your name on the leaderboard, and challenge a friend on the exact same board. Designed for phones and iPads, with desktop keyboard play too.

- Square, portrait, landscape and concentric round mazes.
- Three sizes and three levels of relative route difficulty.
- Drag to trace, swipe for a step, or use arrow keys/WASD.
- Server-validated routes, elapsed time and scores. Names are entered after finishing; no signup.
- Click any leaderboard entry to take on that player's maze and score.
- Keep mazes on this device, share recipe links, export SVG/PNG/JSON and print A4/A3 or save PDF.
- Installable web app. Warm paper, After hours and Blue hour colors. Cached creation/practice can work offline; rankings need a connection.

## Run

Requires Node.js 24+. No runtime dependencies.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:3000`. Posted scores are stored locally in ignored `data/mazer.sqlite`. `PORT`, `HOST` and `DATA_DIR` can be supplied as environment variables. Keep development bound to loopback unless intentionally testing on your private network.

## Verify and build

```sh
npm run check
npm run test:browser
npm run build
npm start
```

Browser tests use installed Google Chrome at phone, iPad and desktop sizes. To install Chrome for tests if needed, use `npx playwright install chrome`. Screenshots and exports are written to ignored `test-results/`. The build produces a standalone browser bundle in `dist/`; the Node server serves it alongside the API. Restart the server after rebuilding.

On a Mac where system Node is broken, an existing Codex bundled Node 24 runtime can be used by putting its `bin` directory first in this shell's PATH. No system repair is required.

## Playing and ranking

The timer starts when a ranked run is issued and continues while the tab is hidden. Drag from the peach dot through connected corridors, or swipe anywhere else on the board to move one step. Arrow keys/WASD move along an available passage in that direction, including polar passages on a round maze.

The server validates the complete route, calculates the result and allows one name submission for that result. Revealing the solution makes the run practice. Sessions last one hour and are lost on restart. Posted scores persist.

The score combines route efficiency and pace, normalized by shortest-route length, with a ceiling of 10,000. All mazes can appear together on the global board; challenges on the same maze are the fairest comparison. This is a casual guest leaderboard, with no verified identity or anti-solver guarantee. See [decisions](docs/DECISIONS.md) for the formula and limits.

## Hosting and continuity

Public repository: https://github.com/hootappi/mazer

Live app: https://mazer.lab.hootappi.com

See [deployment](docs/DEPLOYMENT.md) for Docker/Caddy, persistent storage, backups and updates; [plan](PLAN.md) for scope; [decisions](docs/DECISIONS.md) for current behavior; and [roadmap](docs/ROADMAP.md) for tilt gameplay, optional native iOS and manufacturing.

This app takes visual cues from the user's Wobble projects. The maze engine is independent and does not copy the private Wobble generator.
