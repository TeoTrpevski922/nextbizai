# NextBizAI

NextBizAI — AI-powered customer communication, booking and CRM platform for businesses.

## Replyo AI Instagram Autopilot MVP

Dashboard: `/instagram-autopilot.html`

### Features
- Generate a fresh Macedonian-language Instagram concept, caption, hashtags, and square image.
- Store generated posts and publicly accessible images for Instagram's media fetch.
- Publish a draft manually or generate and publish immediately.
- Schedule one post daily for 19:00 in `Europe/Skopje`, with duplicate checks.
- Admin-key-protected Autopilot API and cron endpoint.

### Setup

1. Run `supabase/instagram-autopilot.sql` in the Supabase SQL Editor for the existing ReplyoAI project.
2. In Vercel Project Settings → Environment Variables, configure:
   - `NEXT_PUBLIC_SUPABASE_URL` — existing Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — service-role key; server-side only
   - `OPENAI_API_KEY` — key with Responses API and image generation access
   - `AUTOPILOT_ADMIN_KEY` — long random secret used to protect the dashboard API
   - `CRON_SECRET` — long random secret used to protect scheduled execution
   - `REPLYOAI_BUSINESS_ID` — existing ReplyoAI business ID from the `businesses` table
   - Optional: `AUTOPILOT_TEXT_MODEL`, `AUTOPILOT_IMAGE_MODEL`, `AUTOPILOT_STORAGE_BUCKET`
3. Ensure the Instagram app is configured for Instagram Login, the OAuth redirect URI is `https://nextbizai.vercel.app/api/instagram-auth`, and the app has the `instagram_business_content_publish` permission approved for the account's access level.
4. Deploy the `main` branch. Reconnect Instagram through the Autopilot dashboard to grant the content-publishing permission; verify that the saved account is associated with the same ReplyoAI business ID.
5. Open `https://nextbizai.vercel.app/instagram-autopilot.html`, enter the admin key when prompted, save the correct business ID, review the instructions, and generate a draft to test.
6. Turn on daily publishing only after the generated image/caption, storage URL, and manual publishing have all been tested.

### Schedule note

Vercel Cron expressions use UTC. The configured 17:00 and 18:00 UTC runs cover 19:00 in Skopje during summer and winter respectively; the handler checks the actual local time and skips the other run. This is designed to accommodate daylight-saving changes. Confirm that the Vercel plan permits both daily cron entries.

### Security and operating notes
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`, or `AUTOPILOT_ADMIN_KEY` in browser code or commit them to Git.
- The dashboard stores the admin key only in page memory for the current tab.
- Instagram access tokens are read server-side from the existing `instagram_accounts` table.
- The image bucket is public because Instagram needs to fetch the media URL; do not upload private content to it.
- Instagram token expiration is checked before publishing. Reconnect the account when required.
- The MVP publishes feed images only; Stories, Reels, analytics, and multi-account scheduling are not included.
