# Implementation review record

The fresh independent reviewer assessed db51402..350c8e2. Six findings were Important, none Critical or Minor. The additional voice diagnostic recommendation was regraded Important because missing prerequisites could show Ready. The implementer resolved all seven in one author fix pass; no re-review was dispatched. This is tested resolution, not a claim that a second reviewer approved the fixes.

| Finding | Regression evidence and resolution |
| --- | --- |
| F1 protected-channel precedence races | automod.integration: concurrent channel-rule enable and pending general incident dispatch; RED then GREEN. Recheck under guild configuration lock and at final send authorization. |
| F2 moderation SDK preparation gap | moderation-discord and moderation-preparation integration: final callbacks, revision disable and role-exemption acquisition; RED then GREEN. Durable authorization now runs after SDK preparation immediately before HTTP. |
| F3 ambiguous voice panel sends | voice-hubs integration: lost binding, negative bounded lookup, distinct repair operation and accepted-panel reconciliation; RED then GREEN. Persist delivery identity/state before send; unknown sends never blindly repeat. |
| F4 stale settings cache | community-settings browser: save/navigate/return, late background refresh, dirty edit/409 retention; RED then GREEN. Update successful query snapshot and synchronize only clean editors. |
| F5 dashboard directory outage | http-guilds integration and diagnostics browser: fresh outage load, cases/diagnostics readable, write503; RED then GREEN. Stored guilds are read-only until live eligibility returns. |
| F6 cached message reconciliation | message-reconciliation: real discord.js MessageManager populated cache and remote404, six regressions; RED then GREEN. Authoritative fetch forces REST in all applicable native adapters. |
| F7 voice false-ready prerequisites | status-discord: four missing-permission regressions; RED then GREEN. Diagnostics, creation preflight and dashboard guidance include Manage Roles and panel access. |

Final `npm run check` on e39c853: **297 unit + 168 database integration + 6 legacy + 16 browser = 487 passing**, typecheck/build, production audit zero. Disposable PostgreSQL17.11; patched Node24.22.2. No skips substitute for missing live validation. Development tool audit remains 2 low +8 moderate. The final container and backup evidence is in [acceptance](acceptance.md).

Deferred minors: **none**.

## Rulings in execution order

- Ruling: Skill task extractor requires task headings in one file; execution copy of ignored index appends exact six subplans — approved text and dependency order unchanged — no runtime cost; original planning checkout intact.

- Task 2: Ruling: Drizzle generated foreign keys qualified public while tables use search_path, breaking disposable schemas — normalize generated REFERENCES to the current table namespace for both production and tests — cost if wrong: schema resolution differs if deployment changes its explicitly configured search_path.

- Task 3: Ruling: Standalone assertGuildWrite needs injected authorization context — exported third service argument plus exact two-argument bound service method, no mutable singleton — cost if wrong: external callers must supply their service.

- Task 6: Ruling: Database seed fixtures belong outside production source — use apps/server/test/protection-fixtures.ts instead of src/features/protection/fixtures.ts — cost if wrong: test import path differs; no deployed fixture code.

- Task 9: Ruling: Disabling verification preserves tracked roles and pauses role changes until re-enabled — disabled optional behavior should not revoke access — cost if wrong: reaction removals while disabled are applied on re-enable reconciliation rather than immediately.

- Task 16: Ruling: Preserve the approved four social providers and leave the unlisted legacy GitHub card helper in the preserved old source — the approved design and root README define the rebuild inventory — cost if wrong: GitHub issue/PR cards will not expand in the replacement runtime.

- Task 17: Ruling: Extend the transport options with explicit POST/body/trustedOrigins for fixed provider OAuth/API requests — Task 18 requires authenticated fixed-origin requests while the plan signature listed only GET-era options — cost if wrong: internal callers must use this additive contract; bodies/auth headers are rejected without HTTPS and an adapter-owned exact-origin allowlist.

- Task 18: Ruling: Missing provider timestamps use numeric zero as an internal unknown sentinel and are omitted from Discord cards — the required FeedItem interface has a numeric publishedAt field, while RSS entries may omit dates — cost if wrong: undated items sort before dated items instead of receiving invented current dates.

- Task 18: Ruling: Honor explicit provider Retry-After deadlines even when longer than the ordinary thirty-minute exponential-backoff ceiling — the approved design requires respecting provider rate limits — cost if wrong: an explicit provider delay can postpone a subscription longer than thirty minutes.

- Task 18: Ruling: Use YouTube's live-verified /feeds/videos.xml polling URL rather than the /xml/feeds/videos.xml URL in the current push-notification guide — actual native transport reads on the same Google Developers channel returned fifteen entries versus an empty 463-byte Atom feed — cost if wrong: the polling endpoint needs revision if YouTube changes or retires it. Added expected-endpoint test RED then GREEN.

- Task 26: Ruling: Build production assets before browser checks in both local check and CI — the browser harness serves the built dashboard, so a clean checkout needs those assets first — cost if wrong: build failures surface before browser failures rather than after them.

- Task 26: Ruling: Include http/dashboard.ts in packaging scope and restrict SPA fallback to root/guild routes — otherwise absent test-login/non-app paths returned the SPA with HTTP 200, preventing a meaningful absence check — cost if wrong: future frontend route families must be added explicitly or return 404.

- Task 26: Ruling: Keep the official shadcn CLI only as a development dependency instead of audit's incompatible downgrade — runtime images omit the CLI and production dependency audit is zero; existing Base UI generation remains reproducible — cost if wrong: development-only transitive advisories remain until compatible upstream fixes.

- Task 27: Ruling: Dispatch the final whole-branch review at the Task 27 acceptance checkpoint before its completion record — Task 27 requires a resolved independent review while the generic executing-plans loop places review after the final task — cost if wrong: post-review fixes receive RED→GREEN/full-gate verification, not a second reviewer, as required by the native execution policy.

- Final: Ruling: Live Discord behavior and production cutover remain unjudged/pending — no designated credentials, guilds, human participants or deployment authorization are available; fixtures cannot establish live permissions/gateway/provider acceptance — cost if wrong: live-only differences remain undiscovered before those gates run.

- Final: Ruling: Legacy GitHub card expansion remains excluded — the approved four-provider/README scope and preserved old source govern — cost if wrong: an unlisted legacy GitHub-card expectation remains unmet in the replacement.

- Final: Ruling: Development-only advisory exploitability is not independently established — retain the recorded dev-tool risk separately from zero production audit and avoid an incompatible forced downgrade — cost if wrong: build/generation tooling may remain exploitable despite runtime exclusion.

- Final: Ruling: Unknown effects are retained instead of claiming exactly-once delivery — reconciliation failure is not proof that no effect occurred — cost if wrong: ambiguous operations can require manual resolution and are not blindly resent.
