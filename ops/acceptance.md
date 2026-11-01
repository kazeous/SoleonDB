# Release acceptance

Implementation and automated results are distinct from live Discord evidence and production deployment. Record each gate with the commit/image ID, date, environment and actual outcome. Missing resources remain pending.

## Automated gates

- Clean `npm ci`, `npm run check` with patched Node 24 and disposable PostgreSQL 17.
- Build the production image; inspect UID, health timing, compiled dashboard and all migrations, and absence of local instructions, environment files, mockup keys and application test authentication.
- Explicit migration succeeds against a disposable database without gateway bootstrap. HTTP/static/auth smoke runs read-only; standby `not_ready` is recorded as such.
- Backup a disposable database with real settings/case/binding state; restore into an empty exact named test target and compare durable state. Reject production/incorrect targets; a failed backup retains the previous archive.
- Complete one fresh independent whole-branch review and a tested fix pass for material findings.

## Live Discord gates (designated disposable resources only)

Supply two disposable guilds, a bot application/token, owner identity, consenting moderator/member accounts and channel/role fixtures. Confirm the old worker is stopped. Never automate a human Discord account or perform destructive moderation outside the designated guilds.

Validate the README inventory as moderator and ordinary member: permission/hierarchy denials; warn/timeout/kick/ban/clean/cases; verification reaction add/remove, reconnect and panel replacement; role pickers; voice creation, all controls, transfer, occupied-room safety and restart; suggestions/votes/status/thread recovery; starboard add/remove/source deletion; auto threads; greetings and blocked DMs; social providers and safe originals; all four feeds; local summaries and explicitly opted-in AI channels; author-only code prompts/expiry/long snippets; cat-fact failure behavior.

For protection, demonstrate N-1 has no cleanup, N crosses threshold, every trigger category, moderator/admin coverage, explicit exemptions, cross-guild isolation, combined strongest action/cleanup union, 30-second punishment cooldown with further cleanup, rule edits/disable/exemption cancellation, Discord hierarchy blocks and unknown interrupted operations without blind replay.

Observe Discord disconnect/reconnect and process restart, fresh/stale DB readiness, provider outage isolation, and a second worker remaining standby. Compare actual Discord side effects with stored case cleanup/punishment outcomes. Validate the owner dashboard and deny another identity. Check missing/deleted channels/roles and real permission overrides.

Provider-backed acceptance needs approved Reddit/Twitch credentials and explicitly chosen supported AI models/keys plus permission to send designated conversation text. Fixture tests and public feed reads do not replace this evidence.

## Production cutover

Only after the live gates and operator authorization: verified backup, reviewed immutable image, stop old worker, explicit migration, start one replacement, configure health/readiness monitoring, deploy commands deliberately, observe recovery and retain rollback assets. No production deployment is performed by local checks.

## Local evidence — 2026-11-01

- Patched Node 24.22.2, PostgreSQL 17.11 disposable resources: `npm run check` passed **283 unit + 159 database integration + 6 legacy + 14 browser** tests, typecheck and production build. Missing prerequisites are not skipped. CI is configured with the same command; no remote CI run has been triggered.
- Production dependency audit: **0 vulnerabilities**. Full development-tool audit still reports 2 low and 8 moderate findings in build/generation tool chains; the official shadcn CLI is development-only and no development tools are in the runtime image. No forced incompatible dependency downgrade was applied.
- Image `eousbot:rebuild-check`, local ID `sha256:5ebba88e7e514d135ec5ff5a00e31e63a56222c9940024d7ffcc6b32b1d94cd4`: UID/GID 1000, patched Node, 17 migrations and 10 static assets. Application fixtures, test OAuth, old source/data, local instructions, environment files and development tools were absent from the inspected image.
- Real image migration succeeded against a disposable database. Read-only-root container HTTP smoke passed while an external test client held the worker lease: health healthy, readiness **not_ready (standby)**, two JS/CSS assets loaded, API 401 and test-login paths absent. SIGTERM drain exited 0. This did not log a bot into Discord and is not live bot readiness evidence.
- Custom-format backup and test restore matched a digest covering settings, configuration audit, cases/incidents/effects and verification/voice bindings. Successful archive replacement, failed-backup preservation, production/mismatched-target refusal and a failed nonempty restore with unchanged state were exercised.
- Independent review and live acceptance are still pending at this checkpoint. No production cutover occurred.
