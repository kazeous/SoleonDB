# Eousbot

A TypeScript Discord community bot with isolated PostgreSQL state for multiple servers and an owner-only web dashboard. The replacement is built and tested locally; production deployment and live Discord acceptance are separate release gates.

## Runtime and setup

Use Node **24.22.2 or a newer patched Node 24**, PostgreSQL 17, and the committed npm lockfile. The container pins Node 24.22.2 by digest, verified against the [official release](https://nodejs.org/en/blog/release/v24.22.2). Copy `.env.example` into a local, ignored `.env` and set the bot/OAuth credentials, one `OWNER_DISCORD_ID`, a random session secret of at least 32 characters, an explicit `DATABASE_URL`, and the exact OAuth callback.

```sh
npm ci
npm run build
# Supply DATABASE_URL explicitly to the migration process; it reads no .env file.
npm run db:migrate
npm start
```

`npm start` connects the replacement bot to Discord. Command registration is an explicit operation, never a startup side effect:

```sh
npm run commands:deploy -- --guild YOUR_DISPOSABLE_GUILD_ID
# After review, deploy to the explicitly activated guilds:
npm run commands:deploy -- --activated-guilds
```

Sign in to the dashboard with the configured owner. The selector shows eligible servers where the bot is present and you own the server or have Manage Server; historical records remain readable. Activate each server explicitly, then configure its features. Saves are revision checked and apply only to that server. OAuth uses only identity scope; PostgreSQL stores hashed session IDs, absolute session expiry, OAuth state and CSRF protection. Production needs HTTPS and an exact matching callback URL. Set `TRUSTED_PROXY_CIDRS` to the real Coolify proxy network.

## Supported workflows

| Area | Behavior and setup |
| --- | --- |
| Social embeds | X/Twitter, Instagram posts/reels, TikTok and Reddit rewrites in selected channels. Custom replacement hostnames, optional author attribution/webhooks, and safe original deletion. Attachments, stickers and replies retain their originals; channel rules retain originals until threshold cleanup. |
| Moderator commands | `/warn`, `/timeout`, `/kick`, `/ban`, `/cases`, `/clean`. Current invoker permissions and Discord hierarchy apply. Mute means Timeout. Cleanup supports bot/human/link/invite/text/member filters. |
| Channel protection | Any message, mention categories, links or photos; configurable count and rolling window; one Timeout, Kick or Ban action. No cleanup below threshold. Combined rules choose the strongest action and union of matching messages. A 30-second cooldown suppresses punishment only. Rule revision, disablement and exemptions cancel remaining queued work; already sent requests cannot be recalled. |
| General AutoMod | Spam, excessive capitals, banned words, invites and links, violation thresholds and explicit exemptions. Enabled channel rules override it in those channels. Administrators and moderators are checked unless explicitly exempted. |
| Verification | Save the message channel, emoji and dedicated verified role, then use `/verifysetup`. Adding the designated reaction grants the role; removing it removes the bot-owned assignment. Replacement generations require explicit acknowledgment and re-verification. Disabling pauses changes while preserving roles. |
| Role pickers | Save assignable, non-privileged roles, then `/rolepicker create` posts a persistent panel with up to five choices. Verification roles cannot be used. |
| Voice rooms | Join a configured hub to create a room with recorded ownership and a persistent in-channel panel. Owner or current Manage Channels members can rename, set limit/status/current game/LFG/bitrate/region/text/NSFW/category inheritance, lock/unlock, allow/deny users or roles, create one-use invites, hide/unhide, and transfer ownership. Only recorded empty rooms are removed. |
| Suggestions | `/suggest` creates persistent up/down voting and optional discussion threads. Moderators use `/suggestion status` to record a status and reason. |
| Starboard | Distinct human ⭐ reactions excluding the author; updates/removal when stars, source or destination change. |
| Auto threads | One thread for new human messages in selected text channels, with configurable archive duration. Messages selected for deletion are skipped. |
| Greetings | Join/leave announcements and optional welcome DMs. Templates support `{user}`, `{username}`, `{server}`. Blocked DMs do not prevent channel delivery. |
| Feeds | Independent Reddit, YouTube, Twitch and RSS/Atom subscriptions, destinations and intervals. First poll sets a baseline. Stable item IDs, backoff and recovery prevent blind reposts. Reddit needs an approved OAuth application; Twitch needs app credentials. Configurable feeds reject private/credential URLs and validate DNS and redirects. |
| Summaries | `/summarize` and the Summarize Discussion message menu inspect recent visible human history. Default is an honest local activity digest. External OpenAI/Gemini calls need a deployment key, explicit supported model, provider selection, external enablement and an allowed channel. Keys alone never opt channels in; failures return a labeled local digest. No transcript is persisted. |
| Code helper | Selected channels receive bounded formatting prompts. Only the original author can format within 60 seconds. The source is fetched again; originals remain. Long or hostile-fence snippets become plain-text attachments. |
| Cat facts | `/catfact` uses the existing public provider with a deadline and useful failures, without a fabricated retrieved fact. |
| Dashboard | Overview, complete feature setup, channel rules and read-only case history. No punishment, punishment retry or case-edit API/UI. Case details separate cleanup from punishment and preserve blocked/unknown/cancelled outcomes. |

## Intents and permissions

Enable Guild Members, Guild Messages, Guild Message Reactions and Guild Voice States. Enable Message Content in both deployment configuration and Discord's developer portal for message inspection, social rewrites, summaries and code detection. Guild Presences is optional and needed for the voice current-game action. The application requests these explicitly; missing intent access or permissions must appear as setup/degraded state.

Grant only required permissions. Text destinations need View Channel, Read Message History, Send Messages and, for cards, Embed Links. Moderation needs Manage Messages and the selected Moderate Members/Kick Members/Ban Members permission. Role features need Manage Roles with the bot above assignable non-privileged roles. Voice controls need Manage Channels, Manage Roles for permission overwrites, Move Members, Connect, Send Messages, Read Message History, Create Instant Invite for invites, and voice-status permission where exposed. Threads need Create Public Threads and Send Messages in Threads. Long code copies need Attach Files. Discord hierarchy and target restrictions are rechecked for each action; blocked actions are recorded without escalation.

## Checks and operations

```powershell
docker compose -f compose.test.yml up -d --wait postgres
$endpoint = docker compose -f compose.test.yml port postgres 5432
$env:TEST_DATABASE_URL = 'postgresql://eousbot_test:local-disposable-test@' + $endpoint.Trim() + '/eousbot_test'
npx @e2e-dev/web install chromium
npm run check
docker build -t eousbot:review .
```

`check` runs typecheck, unit, disposable-schema integration, legacy regression, production build, deterministic browser checks and production dependency audit, stopping on the first failure. Browser tests use the real API/database with injected OAuth/Discord ports confined to test source; no model key or human Discord automation is needed. Missing database/browser access fails a check. CI runs the same command with Node 24.22.2 and PostgreSQL 17. The browser engine pins `playwright-core` to the exact required version.

`/health` is process liveness; `/ready` requires a fresh database/schema probe, Discord connection and the active worker lease. Coolify restart health uses `/health` with 30s interval, 5s timeout, 3 retries, 60s start period. External availability monitoring uses `/ready`. Optional provider outages degrade their feature while process health remains independent. No external monitor is created by this repository.

See [deployment and rollback](ops/deploy.md), [backup/restore](ops/deploy.md#backups-and-restore-drills), and [acceptance evidence](ops/acceptance.md). Logs omit credentials, code and summary transcripts. One worker owns the PostgreSQL lease; shutdown drains bounded jobs and releases it. Use stop-before-start releases, never concurrent legacy/replacement workers with the same token.

The original JavaScript remains under `src/`, with an explicit `npm run start:legacy` entry point. Existing JSON/runtime data is preserved and is not migrated into the replacement. Legacy startup connects Discord and registers commands; it is not a routine test. The replacement image contains compiled replacement artifacts only and needs no writable JSON volume. Local `docs/` and root `AGENTS.md` remain ignored and are excluded from images.
