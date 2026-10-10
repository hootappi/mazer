# Deploy Mazer on lab

The repository is public. The VPS pulls and builds; application source is edited on the Mac. The app uses Node 24's built-in SQLite and needs no runtime npm installation. Caddy serves HTTPS and routes to `mazer:3000` over the existing `edge` network.

## First deployment: tailnet verification

Check current containers and choose an unused host port. The example uses 3003.

```sh
cd ~/stacks
git clone https://github.com/hootappi/mazer.git
cd mazer
mkdir -p ~/data/mazer
```

The data directory must be writable by uid 1000, the Node container user. Configure an ignored `.env` on the VPS, mode 600:

```dotenv
TAILNET_IP=YOUR_TAILNET_IP
MAZER_PORT=3003
MAZER_DATA_DIR=/home/hootappi/data/mazer
```

From `~/stacks/mazer`:

```sh
docker compose -f compose.yaml -f compose.private.yaml up -d --build --wait
docker compose ps
```

Verify the health endpoint, creation, play, score posting and leaderboard over the tailnet. The overlay binds only the configured tailnet IP. It disables trusted proxy handling for this direct access.

## Publish

Back up `~/stacks/caddy/Caddyfile`, then add only Mazer's route:

```caddyfile
mazer.lab.hootappi.com {
    reverse_proxy mazer:3000 {
        header_up X-Forwarded-For {remote_host}
    }
}
```

The header override prevents an incoming client from supplying a forged rate-limit address. In `~/stacks/caddy`, validate and then reload:

```sh
docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

In `~/stacks/mazer`, drop the temporary tailnet host binding and enable proxy trust by using only the base file:

```sh
docker compose up -d --wait
```

Verify `https://mazer.lab.hootappi.com/health` and the app. Add Mazer to the lab's static index and private Homepage services list, using container `mazer`, server `my-docker` and the public URL. Restart only Homepage when required to refresh its config.

## Updates

Run tests and browser checks locally, commit and push. On the VPS:

```sh
cd ~/stacks/mazer
git pull --ff-only
docker compose up -d --build --wait
docker compose ps
```

Do not edit tracked source on the VPS. Recipe version compatibility must be retained across updates.

## Persistent data and backup

Posted scores live in `~/data/mazer/mazer.sqlite`, with SQLite WAL/SHM sidecars while running. Browser collections are independent and stay on each device. In-progress run tokens are memory only and expire on restart.

For a consistent live backup, use SQLite's backup API inside the container rather than copying only the main database while it is open:

```sh
cd ~/stacks/mazer
docker compose exec -T mazer node --input-type=module -e 'import {DatabaseSync,backup} from "node:sqlite"; const db=new DatabaseSync("/app/data/mazer.sqlite"); await backup(db,"/app/data/mazer-backup.sqlite"); db.close();'
```

Copy the resulting backup off the VPS using the normal private administration channel. It contains guest names, scores and maze recipes. No IP addresses are stored in SQLite.

Restoring replaces live data, so get explicit authorization, stop only Mazer, preserve the current database and sidecars, install the backup as `mazer.sqlite` with uid 1000 ownership, then start Mazer. Verify the leaderboard. Never overwrite a running database.

## Rollback and return to private

Before updating, record the deployed Git commit. To roll back code, explicitly select that known commit on the VPS and rebuild only Mazer; preserve the data directory. Schema changes require a separate reviewed data migration and backup plan.

To remove public access, remove only Mazer's Caddy block and lab index link, validate and reload Caddy, then run with the private overlay. Update Homepage to the tailnet URL. No firewall changes or image rebuild are needed.
