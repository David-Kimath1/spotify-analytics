# Sonora — Spotify listening analytics

Sonora is a dark-first analytics dashboard built on the existing React, Express, MongoDB and Spotify OAuth stack. It uses account data only. Spotify recently played records are limited to recent history; older plays can be added from Spotify Extended Streaming History JSON or ZIP archives.

## Run locally

1. Install dependencies from the repository root:

   ```bash
   npm run install-all
   ```

2. Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env`. Set Spotify app credentials, MongoDB URI, and a long random `JWT_SECRET` in the server file.

3. In the Spotify developer dashboard, allow this redirect URI:

   ```text
   http://localhost:3000/auth/callback
   ```

   Keep `CLIENT_URL` and `REACT_APP_API_URL` on the same host name (`localhost` or `127.0.0.1`) so the OAuth state cookie is sent back to the API.

4. Start MongoDB, then run both applications from the repository root:

   ```bash
   npm run dev
   ```

   The client runs on port 3000 and the API on port 5000. You can also start each side separately with `npm run client` and `npm run server`.

## Deploy to Vercel and install as a PWA

The Vercel configuration builds the React client as static assets and runs the Express API as a serverless function. MongoDB Atlas stores listening records between requests and deployments. Sonora includes a web app manifest and a service worker; it caches only the app shell and static assets, never private analytics API responses.

1. Push the repository to GitHub and create a MongoDB Atlas database.
2. In Vercel, import the GitHub repository as a project. Keep the repository root as the project root so `vercel.json` is used.
3. Add these environment variables in Vercel for Production (and Preview too, if you plan to use preview deployments):
   - `MONGODB_URI`: the Atlas connection string, with a database user and database name.
   - `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`: credentials from your Spotify Developer app.
   - `JWT_SECRET`: a long, random secret generated for Sonora.
   - `CLIENT_URL`: optional; set this to the final production HTTPS URL if you have assigned a custom domain. Otherwise, Sonora uses Vercel's production project URL.
4. In MongoDB Atlas, allow network connections from Vercel. Vercel serverless outbound addresses can vary; use Atlas's recommended network-access configuration for your deployment rather than assuming localhost.
5. Deploy the project. Add `https://<your-production-domain>/auth/callback` to the Spotify Developer app's allowed Redirect URIs. Use the stable production domain, not a temporary preview URL.
6. Open the deployed HTTPS URL and sign in. On Edge, choose **Settings and more → Apps → Install this site as an app**; on mobile, use **Add to Home Screen**. **Settings → Copy app URL** copies the deployed address.

Vercel functions do not run the local ten-minute background sync job or persistent Socket.IO connections. Use **Sync data** in the dashboard to capture recent plays; imported history and analytics remain stored in MongoDB Atlas. The PWA requires an internet connection for sign-in, Spotify sync, and analytics.

The repository also retains a Render Blueprint (`render.yaml`) for deployments that use a continuously running Express server.

## Data notes

- Spotify API play duration is estimated from the track length because the recently played API does not report actual listened milliseconds.
- Imported Extended Streaming History uses `msPlayed` as exact duration and records source, timestamp, platform and skip state when present.
- Import JSON files individually or select multiple files. ZIP archives with JSON entries are supported in browsers that implement `DecompressionStream`.
- Repeated events are merged by Spotify track ID and play timestamp. Exports include the available records and their duration accuracy/source.
- All date buckets and pattern heatmaps use UTC.

The backend exposes the analytics under `/api/analytics`; `/health` reports API and MongoDB connectivity. Spotify OAuth secrets and database credentials are only read by the server.
