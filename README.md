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

## Install as an app and get a public URL

Sonora includes a web app manifest and a service worker. In a production build, it caches only the app shell and static assets; private analytics API responses are never cached. On Edge, use **Settings and more → Apps → Install this site as an app**. In Settings, **Copy app URL** copies the current site's root address. A localhost address works only on this computer.

To create a shareable public URL, this repository includes a Render Blueprint in `render.yaml`:

1. Push the repository to GitHub and create a MongoDB Atlas database. Add the deployed service's network access as required by your Atlas project.
2. In Render, create a new Blueprint from the GitHub repository and provide `MONGODB_URI`, `SPOTIFY_CLIENT_ID`, and `SPOTIFY_CLIENT_SECRET` when prompted. The Blueprint generates a `JWT_SECRET` and builds the React client with the API on the same origin.
3. After Render creates the service, copy its `https://…onrender.com` address and add `<service-url>/auth/callback` to the allowed redirect URIs in your Spotify Developer Dashboard. The app uses Render's service URL for OAuth unless `CLIENT_URL` is explicitly set.
4. Open the public URL, sign in again, then use **Settings → Copy app URL** to copy the shareable address. The browser's Apps menu can install the HTTPS deployment as a PWA.

Render's [Node deployment guide](https://render.com/docs/deploy-node-express-app) and [Blueprint reference](https://render.com/docs/blueprint-spec) describe the deployment and environment setup.

## Data notes

- Spotify API play duration is estimated from the track length because the recently played API does not report actual listened milliseconds.
- Imported Extended Streaming History uses `msPlayed` as exact duration and records source, timestamp, platform and skip state when present.
- Import JSON files individually or select multiple files. ZIP archives with JSON entries are supported in browsers that implement `DecompressionStream`.
- Repeated events are merged by Spotify track ID and play timestamp. Exports include the available records and their duration accuracy/source.
- All date buckets and pattern heatmaps use UTC.

The backend exposes the analytics under `/api/analytics`; `/health` reports API and MongoDB connectivity. Spotify OAuth secrets and database credentials are only read by the server.
