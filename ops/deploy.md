# Coolify release procedure

The replacement uses one non-root application image and a separate PostgreSQL 17 resource on Coolify's private network. Persist PostgreSQL storage and keep its port private. The application is stateless apart from PostgreSQL and needs no old `/app/data` mount. Keep the original JavaScript, existing JSON data and prior image intact for an intentional rollback/cutover decision.

## Before release

1. Complete `ops/acceptance.md`, including the designated disposable-guild tests. Build and review the immutable application image. The Dockerfile pins patched Node 24.22.2 by digest; update the version/digest together after checking official security releases and rerunning checks.
2. Configure the bot token, application client ID/secret, one `OWNER_DISCORD_ID`, exact HTTPS OAuth callback, random `SESSION_SECRET`, private `DATABASE_URL`, `PORT` and trusted reverse-proxy CIDRs through Coolify. Never bake an `.env`, test identity, provider key or mockup session key into an image.
3. Supply optional provider credentials/models through deployment environment. Those values do not enable a guild feature or opt any channel into external AI processing. Select currently supported models explicitly; no obsolete default model is assumed.
4. Back up PostgreSQL and verify the archive. Inspect migrations for compatibility with the currently deployed image. No down migration runs automatically.

## Replacing the legacy Coolify environment

The old bot's Discord variables alone cannot start the replacement. `ADMIN_DISCORD_IDS` is not used for dashboard ownership; configure one `OWNER_DISCORD_ID`. The replacement requires a PostgreSQL resource and fresh configuration rather than the old JSON data mount.

In the application's **Environment Variables**, configure all seven values below with Runtime set to **Available in the container**. Set Build time to **Not available during build**; none of these values is needed to build the image. Use Normal view when preserving existing locked secrets. See [Coolify environment variables](https://coolify.io/docs/applications/configuration/environment-variables).

| Variable | Required runtime value |
| --- | --- |
| `DISCORD_TOKEN` | The bot token from the designated Discord application. |
| `DISCORD_CLIENT_ID` | That application's ID. |
| `DISCORD_CLIENT_SECRET` | That application's OAuth client secret. |
| `OWNER_DISCORD_ID` | The one human owner's Discord user ID, not an application/server ID or comma-separated list. |
| `DATABASE_URL` | The dedicated PostgreSQL 17 resource's private internal connection URL, accessible from the application network. |
| `DASHBOARD_REDIRECT_URI` | `https://YOUR_HOST/api/auth/discord/callback`, registered exactly in the Discord application's OAuth redirects. Production requires HTTPS. |
| `SESSION_SECRET` | A securely generated secret with at least 32 characters, retained across restarts. |

Keep `NODE_ENV=production`, `PORT=3000` and Coolify's exposed port at `3000`. Set `TRUSTED_PROXY_CIDRS` to the actual Coolify proxy network for HTTPS session handling. Save the variables, perform the explicit migration below, then start the replacement only after the legacy worker is stopped. Runtime changes need the container environment recreated; image rebuilds are needed only for source/build changes.

### Startup exits before health becomes available

`Application initialization failed: missing or invalid runtime configuration: ...` lists field names only. Correct those runtime fields; logs deliberately omit their values. The older generic `Application initialization failed; check required configuration.` message means the original build hid the specific reason. Verify every field in the table, including the production HTTPS callback requirement.

An image build completing does not establish application startup. A configuration exit happens before HTTP listens, so `/health` cannot pass. The Dockerfile health command uses Node's built-in `fetch` and does not require curl or wget. Keep the health check enabled and correct the startup configuration. PostgreSQL must then be reachable and migrated for `/ready` to pass; a disconnected or standby worker truthfully remains unready.

### Discord returns invalid or expired sign-in state

The browser must receive an `eousbot.sid` cookie when `/api/auth/discord` redirects to Discord. Production cookies stay Secure, HttpOnly and SameSite=Lax. Express must recognize HTTPS through the actual proxy before it can issue that cookie. The local `loopback` default does not trust a separate Docker proxy container. An older build could redirect without a cookie and then reject the callback because the session IDs differed; the application now rejects that start with a clear `TRUSTED_PROXY_CIDRS` configuration error.

For a standard Coolify proxy, run this in the **application container's Terminal** to discover its current proxy IPs and print a narrowly scoped setting, without reading any credentials:

```sh
node -e "require('node:dns').lookup('coolify-proxy',{all:true},(e,a)=>{if(e){console.error(e.code);process.exitCode=1;return;}console.log('TRUSTED_PROXY_CIDRS='+a.map(x=>x.address+'/'+(x.family===6?128:32)).join(','))})"
```

Save the printed value as a runtime environment variable in Coolify, then restart the application to recreate its environment. Start a new login from the configured HTTPS dashboard host. Existing expired or previously attempted callback URLs do not become valid again. Keep the callback host identical to the host where login starts, and retain the same `SESSION_SECRET` across application replicas/restarts. Check the proxy address again if the proxy container is recreated; an operator may instead configure its verified, appropriately isolated network CIDR. A custom proxy needs its own actual peer address and HTTPS forwarding configuration.

Do not disable Secure cookies or trust all addresses to resolve this. See [Express session HTTPS/proxy requirements](https://expressjs.com/en/resources/middleware/session/) and [Coolify proxy networking](https://coolify.io/docs/core/networking-in-coolify).

## Stop, migrate, start

1. Stop the old worker and confirm it is stopped before allowing the new worker to connect. Never run the original and replacement with the same token at once. Do not rely only on a rolling deployment's overlapping replicas.
2. Run the new image's explicit release command on the same private network, with **only** an explicit `DATABASE_URL`: `docker run --rm --network YOUR_PRIVATE_NETWORK --env DATABASE_URL YOUR_REVIEWED_IMAGE node apps/server/dist/ops/migrate.js`. The migration module imports no bot bootstrap, never deploys commands, and fails nonzero on error. Do not proceed on failure.
3. Start the application image with the reviewed environment. Use non-root UID 1000. Give SIGTERM at least 15 seconds for its bounded 10-second drain. Retain one active worker; standby replicas remain unready and do not connect a second gateway worker.
4. Configure Coolify health as `/health`: interval 30s, timeout 5s, retries 3, start period 60s. Use `/ready` for external availability checks; an HTTP-live process may still be disconnected, standby or dependency-unready. No monitor or alert account is created automatically.
5. Run `npm run smoke -- --base-url https://YOUR_HOST` from a built checkout, or invoke the image's compiled smoke script. It performs GETs only, verifies liveness/readiness shape, auth rejection, same-origin assets and absent test-login paths. A result of `not_ready` accurately reports a standby/disconnected process and is not release acceptance.
6. Sign in as the configured owner, activate designated guilds, configure features, then explicitly deploy commands with `commands:deploy -- --guild ID` for testing or `--activated-guilds` after review. Verification and role-picker panels are explicit Discord commands after saving settings.

## Rollback

Stop the replacement before restarting a prior image. Roll back the image only when its expected schema is compatible. Keep additive schema changes when compatible. If recovery requires restoring a database, stop writers, preserve the failed database/archive, and make a deliberate operator-reviewed recovery decision. The test restore helper refuses production targets and does not automate production recovery. Never run destructive down migrations or delete old JSON data as a rollback shortcut.

The original worker's environment and state format differ from the replacement. Restarting it requires the original configuration and can register commands on startup; do not assume the new dashboard settings are available there.

## Backups and restore drills

Use PowerShell 7 and PostgreSQL 17 client tools on an owner-controlled host. Both helpers also accept an explicit `-DockerContainer` with PostgreSQL tools; connection host/port then refer to that container's environment (for example loopback port 5432). URLs are parsed into child-process PostgreSQL environment variables, not printed or passed as command-line passwords. Only `sslmode` is accepted as a URL query option; other TLS client configuration can use PostgreSQL's standard environment variables.

```powershell
# The output directory must already exist; archive is validated before replacement.
./ops/backup.ps1 -DatabaseUrl $env:DATABASE_URL -OutputPath 'D:\Backups\eousbot\daily.dump'
# Restore ONLY into a newly created empty loopback disposable database.
./ops/restore.ps1 -TestDatabaseUrl $env:TEST_RESTORE_DATABASE_URL -BackupPath 'D:\Backups\eousbot\daily.dump' -ExpectedDatabaseName 'eousbot_restore_drill'
```

Backup uses `pg_dump` custom format, validates it with `pg_restore --list`, writes a temporary archive in the resolved output directory, then atomically replaces an existing archive. Failures return nonzero and retain the last valid archive. Restore requires an exact expected `eousbot_test_*` or `eousbot_restore_*` name and loopback destination, uses a single transaction and exit-on-error, and never uses `--clean`, drops or creates a database. A nonempty destination fails rather than being overwritten.

At deployment, schedule daily backups with **seven daily versions retained** on owner-controlled storage, plus a regular restore drill. Review and resolve that storage/retention directory before configuring any deletion. These scripts do not schedule jobs, configure remote storage or delete retained archives. Test the schedule's failure notification and restore process as an explicit deployment action.

## Evidence and incident response

Inspect owner-only diagnostics for current setup/permission blockers, individual feed status, unconfirmed operations and recent cases. A successful unrelated feature does not clear an unresolved durable operation. Preserve blocked/unknown results; do not blindly replay punitive actions or ambiguous sends. Loss of the worker lease stops dispatch. Check runtime readiness, current Discord hierarchy, provider status and database health before changing configuration.

The production image excludes repository documentation, instructions, old source/data, local environment files, test OAuth fixtures, browser harnesses and dev dependencies. Authentication test ports are injected only by the source test server outside the image. Never add a production test-login environment switch.
