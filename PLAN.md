# Mazer build plan

Status: v1 implemented, verified and deployed. 10 October 2026.

## Product

Mazer creates reproducible mazes that people can play, share with friends, export and print. The first release is an installable, mobile and iPad first web app that also works on desktop. Native App Store distribution and manufacturing are future work.

## Reference and conventions

- Follow hootappi/AI-setup-tappi, especially AGENTS.md, me/coding.md, me/preferences.md and me/working-style.md. This is Keeper work because it will be public and store scores.
- Follow hootappi/lab-vps-setup/vps-setup-lab.md. Docker Compose, Caddy, edge network, persistent bind mounts under ~/data/mazer, first verify on the tailnet, then publish. No changes to shared firewall or SSH configuration.
- Visual references: the local WOBBLE Creator and wobble-game. Warm paper, dark green ink, restrained pastel accents, generous space, quiet typography, rounded touch controls and recognizable Wobble geometry.
- Repository: public hootappi/mazer. Public URL: https://mazer.lab.hootappi.com, linked from the lab index and private Homepage dashboard.
- Public project documentation must not copy private personal context or infrastructure details. Secrets stay outside Git.

## First release

1. Create: choose paper size A6–A2, orientation, maze shape, maze size and difficulty; generate again or enter a seed. Start with square, portrait rectangle, landscape rectangle and concentric round mazes. Each style must have a real, connected maze topology, rather than only changing its appearance.
2. Play: move from entrance to exit with touch tracing/swiping or keyboard. Show elapsed time and moves, support an unranked practice mode, and give a clear completion result.
3. Score: compare actual moves with the shortest valid route and reward speed within comparable maze settings. Document and version the scoring formula. Provide a global points leaderboard and a per-maze filter. Same-board challenges are the fairest comparison; do not rank unrelated puzzles by raw elapsed time.
4. Challenge: share a permanent URL containing the versioned maze recipe. A friend gets exactly the same maze and can compare their result with the challenger.
5. Leaderboard: real persistent scores, guest names entered after completion without signup. Server issues ranked run sessions and validates legal movement and completion. Bound input sizes, rate-limit submissions and render names safely. This is casual competition; movement validation cannot establish that a player did not use an automated solver.
6. Export: SVG, PNG, a reproducible JSON recipe and matching paper layouts for A6–A2 with an optional solution overlay. The geometry remains useful for future manufacturing, but is not advertised as fabrication-ready.
7. Keep: save favorite mazes and personal records in the browser. Explain that these are local to the device.
8. Themes: ship one Wobble-inspired theme, keep presentation separate from maze and rules, and provide two small alternative visual studies without building a large theme system.

## Architecture

- Browser-native JavaScript ES modules, using SVG for scalable maze rendering and export. Keep the UI lightweight.
- A shared deterministic maze core: versioned recipe, seeded generation, connectivity checks, shortest-route solver and move validation. Difficulty selects measured entrance-to-exit route length within a deterministic candidate family; branches and dead ends remain part of the generated topology.
- A small Node backend serving the production app and ranked-run API. SQLite for durable leaderboard and challenge/run data, stored in a bind mount. Node 24+ provides SQLite without a runtime package dependency.
- Maze identity is independent of theme and screen size. Frozen recipe fixtures protect old shared links when the generator changes.
- Installable PWA shell; creation and practice can work offline after assets are cached, while ranked runs require a connection. Cache public assets only, never score submissions or run-session responses.
- Add dependencies only for a concrete need and explain their purpose.

## Build sequence

1. Resolve the decisions below. Initialize Git, establish the personal commit identity, create the public repository and commit this plan plus project instructions. Verify GitHub write access first.
2. Build the maze core and test reproducibility, connectivity, solutions, meaningful difficulty and recipe validation for every supported topology.
3. Design and implement Create and Play at phone, iPad and desktop sizes. Inspect the actual browser renders and refine controls and layout.
4. Implement scoring, ranked-run sessions, persistent leaderboards and shared challenges. Test invalid paths, repeated submissions, limits and persistence after restart.
5. Implement saving, exports, printing and installability. Verify downloaded artifacts, print layout and shared-link round trips.
6. Run types, logic/API tests, production build and browser checks at phone, iPad and desktop sizes. Check touch and keyboard play, accessibility, overflow, offline behavior and failure states.
7. Package Docker and Compose with health checks and documented setup, update, backup and rollback procedures. Verify the built container.
8. Push the verified release. On the VPS, inspect the current stacks and unused tailnet port, pull/build Mazer and verify level 2. Back up and validate Caddy configuration, publish level 3, add index/dashboard entries and remove the temporary host port binding. Verify public HTTPS, gameplay and cross-browser leaderboard persistence.

## Confirmed decisions

- Pure web app now. A possible native iOS app belongs on the future roadmap.
- Trace/swipe and keyboard first; tilt-the-ball is a future alternative.
- Enter a name after completion, like Timing. Global leaderboard entries show maze and score and open the same board as a challenge.
- Shapes: square, portrait rectangle, landscape rectangle and round.
- See docs/ROADMAP.md for future development.

## Access observations

- Workspace was empty when inspected.
- Connected GitHub tools can read both setup repositories. GitHub CLI authentication works with the required host access; public hootappi/mazer has been created.
- Tailscale and key-authenticated SSH to lab were verified from this MacBook Air. Existing stacks were inspected before deployment.

## Delivery

Mazer v1 is live at https://mazer.lab.hootappi.com and published in the public hootappi/mazer repository. Local logic/API tests, 20 Chrome browser checks and GitHub Actions passed. The Docker image was built on lab, tested through the tailnet, then published through Caddy with index/dashboard entries. Public HTTPS gameplay and server route validation passed. SQLite integrity and a live backup were verified. Physical iOS/Safari testing and future roadmap items are not part of this verification.
