# Branch B (texts/sign-in): live state

- Current task: audit closed with nothing red at d0c8353; running the webkit and tablet journeys and the visual check, then handing the owner's steps over.
- Last commit: afb27a4 (written 2026-11-20 01:33 UTC).
- Next step: hold. The pull request (#209) stays a draft until the owner has done X1 to X4 and Step 1a, the full CI run on a ready pull request is green, and the owner gives the lane 3 OK. Nothing is pushed while CI is queued.
- Open decisions: none for the build. The owner's Twilio upgrade is deferred to the slice end (owner, 2026-11-17).

## What the owner runs, in order, before this merges

Each is a command for iTerm2, or a website where no command exists. They come from the texts plan (X1 to X4, Step 1a, X8); the `twilio` ones were checked against the CLI's `--help` by the setup check, and none was run against Twilio.

1. **X1 (website, then two commands).** Upgrade the Twilio account from a trial and add billing (a trial cannot make Messaging Services). Then once: `brew tap twilio/brew && brew install twilio && twilio login`.
2. **The Verify service (the codes).** `twilio api:verify:v2:services:create --friendly-name Ruken --code-length 6 --custom-code-enabled --do-not-share-warning-enabled`. It prints an id starting `VA`: this is `TWILIO_VERIFY_SERVICE`. The name is what the code text calls Ruken. If it answers 60204 ("Service does not support this feature"), stop and tell the coordinator.
3. **Step 1a: a real code on your phone** (replace `VA…` and `+1…` with the service id and your own number):
   - `twilio api:verify:v2:services:verifications:create --service-sid VA… --to +1… --channel sms --custom-code 123456` Expect a text holding 123456.
   - `twilio api:verify:v2:services:verifications:update --service-sid VA… --sid +1… --status canceled`, then the create command again with `--custom-code 654321`. Expect a second text holding 654321.
   - `twilio api:verify:v2:services:verifications:update --service-sid VA… --sid +1… --status approved` Expect the status `approved`.
   - Send the coordinator the exact words of each text, each command's status and any error code. If the second text holds the first code, or the number is refused where the id goes, stop and report.
4. **X2: the two numbers and two Messaging Services** (the site will not start without their ids). `twilio api:core:available-phone-numbers:local:list --country-code US --sms-enabled --limit 5 --properties phoneNumber`; buy two: `twilio api:core:incoming-phone-numbers:local:create --phone-number +1XXXXXXXXXX` (twice; each prints `PN…`); `twilio api:messaging:v1:services:create --friendly-name "Ruken account"` and the same with `"Ruken news"` (each prints `MG…`); put one number in each: `twilio api:messaging:v1:services:phone-numbers:create --service-sid MG… --phone-number-sid PN…`. In Twilio's Console, turn on Canada in SMS Geo Permissions and SMS Pumping Protection (Communications, Messaging, Settings): no command exists for either.
5. **X4: the settings, one command each** (`npx -y wrangler@4.156.0 secret put NAME --name ruken`, and it asks for the value): `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY` and `TWILIO_API_SECRET` (both printed once by `twilio api:core:keys:create --friendly-name ruken`), `TWILIO_ACCOUNT_SERVICE` (the first `MG…`), `TWILIO_NEWS_SERVICE` (the second `MG…`), `TWILIO_VERIFY_SERVICE` (the `VA…`), and `TEXT_ALLOWLIST` (your own number and the testers', comma separated, so a test copy cannot text strangers). The test copy gets its own set.
6. **After this merges, on the test site (X8):** sign up again on the site with your phone, then make the account the first staff account. The old email command no longer works: it takes the number now. `read -s "s?JOBS_SECRET: "; curl -s -X POST https://ruken.ruken-beta.workers.dev/jobs/first-owner -H "Authorization: Bearer $s" -H "content-type: application/json" -d '{"phone":"+1YOURNUMBER"}'; unset s` Expect `{"granted":true}`. "There is already a staff account." also means it is done. Accounts made by email cannot sign in any more; no real person has one.

Delete this file in the last commit before the merge.
