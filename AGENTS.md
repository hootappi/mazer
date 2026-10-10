# Mazer

Read README.md, PLAN.md and docs/DECISIONS.md before changing the product. Keep documentation aligned with implemented behavior.

This is a public project with persistent scores. Test deterministic generation, path validation, score submission and persistence. Run `npm run check` and relevant browser tests. Never describe deployment or features as verified without running them.

The maze recipe version is a compatibility contract. Never change v1 generation without retaining the existing implementation for v1 links and adding a new recipe version. Keep frozen fixtures.

Theme and render changes must not alter maze topology, recipe identity or scoring. Hints invalidate ranking for the current run. All public names are untrusted strings: use textContent, never innerHTML.

No runtime dependencies are needed currently. Explain a concrete need before adding one. Node 24+ is required for built-in SQLite.

Deployment follows the user's lab conventions: Docker Compose, Caddy on the edge network, temporary tailnet-only port for first verification, then a public subdomain. Bind persistent data under ~/data/mazer. Never mount the Docker socket, expose a database, or edit tracked application source on the VPS. Do not change other projects.

Public docs must not copy private personal context, credentials or host infrastructure inventory. Use ignored .env files for host settings. No destructive operations, force pushes or data migrations without explicit user authorization.
