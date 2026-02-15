# Deploy: GitHub Pages (Frontend) + Render (Backend)

This setup keeps all features working:
- static site on GitHub Pages
- API routes on Render (`/api/spotify/recent`, `/api/github/pinned`)

## 1) Deploy backend to Render

1. Push this repo to GitHub.
2. In Render, create a new **Web Service** from this repo.
3. Configure:
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Add env vars (from `.env.example`):
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SPOTIFY_REDIRECT_URI`
   - `SPOTIFY_REFRESH_TOKEN`
   - optional: `CORS_ALLOWED_ORIGINS`
5. Set `SPOTIFY_REDIRECT_URI` to:
   - `https://<your-render-domain>/api/spotify/callback`
6. Deploy. Confirm health check:
   - `https://<your-render-domain>/health`

## 2) Set frontend API base

In `src/home.html`, set `data-api-base` on the `<body>` tag:

```html
<body data-github-user="SpencerVJones" data-api-base="https://<your-render-domain>" class="modern-polish">
```

## 3) Deploy frontend to GitHub Pages

1. Commit and push.
2. In GitHub repo settings:
   - `Settings` -> `Pages`
   - Source: `Deploy from a branch`
   - Branch: `main` (or your default), folder: `/ (root)`
3. Open:
   - `https://<your-username>.github.io/<repo-name>/`

`index.html` at repo root redirects to `src/home.html`, so Pages works with current project structure.

## 4) Spotify first-time token note

If Spotify data fails with token errors:
1. Open `https://<your-render-domain>/api/spotify/login`
2. Complete auth
3. Copy the returned refresh token into `SPOTIFY_REFRESH_TOKEN` in Render env vars
4. Redeploy
