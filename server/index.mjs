import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env", import.meta.url) });

import express from "express";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const srcDir = path.join(rootDir, "src");
const imagesDir = path.join(rootDir, "images");

const app = express();
const corsAllowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use("/api", (req, res, next) => {
  const origin = String(req.headers.origin || "");

  if (corsAllowedOrigins.length === 0) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && corsAllowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (origin) {
    return res.status(403).json({ error: "Origin not allowed." });
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/", (_req, res) => res.redirect("/home.html"));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/images", express.static(imagesDir));
app.use("/src", express.static(srcDir));
app.use(express.static(srcDir));

const GITHUB_USER_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const extractPinnedRepositoryNames = (html, username) => {
  if (!html || !username) return [];
  const pinnedSectionMatch =
    html.match(/<ol[^>]*id="pinned-items-reorder-container"[\s\S]*?<\/ol>/i) ||
    html.match(/<div[^>]*id="pinned-items-reorder-container"[\s\S]*?<\/div>/i) ||
    html.match(/<div[^>]*class="[^"]*js-pinned-items-reorder-container[^"]*"[\s\S]*?<\/div>/i);

  if (!pinnedSectionMatch) return [];

  const pinnedSection = pinnedSectionMatch[0];
  const repoRegex = new RegExp(`href="/${escapeRegex(username)}/([^"/?#]+)"`, "gi");
  const pinned = new Set();

  let match = repoRegex.exec(pinnedSection);
  while (match) {
    const repoName = decodeURIComponent(String(match[1] || "").trim());
    if (repoName) pinned.add(repoName);
    match = repoRegex.exec(pinnedSection);
  }

  return [...pinned];
};

app.get("/api/github/pinned", async (req, res) => {
  try {
    const username = String(req.query.user || "").trim() || "SpencerVJones";
    if (!GITHUB_USER_RE.test(username)) {
      return res.status(400).json({ error: "Invalid GitHub username." });
    }

    const response = await fetch(`https://github.com/${encodeURIComponent(username)}`, {
      headers: {
        Accept: "text/html",
        "User-Agent": "Mozilla/5.0 (compatible; Portfolio-Server/1.0)",
      },
    });
    if (!response.ok) {
      throw new Error(`GitHub profile status ${response.status}`);
    }

    const html = await response.text();
    const pinned = extractPinnedRepositoryNames(html, username);
    res.json({ user: username, pinned });
  } catch (error) {
    console.error("Pinned repos fetch error:", error?.message || error);
    res.status(500).json({ error: "Unable to fetch pinned repositories." });
  }
});

const requireEnv = (key) => {
    const value = (process.env[key] || "").trim();
    if (!value) {
        throw new Error(`Missing required env var: ${key}`);
    }
    return value;
};

const b64url = (buf) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const randomVerifier = () => b64url(crypto.randomBytes(32));
const challengeFromVerifier = (verifier) =>
  b64url(crypto.createHash("sha256").update(verifier).digest());

let cachedSpotifyAccessToken = "";
let cachedSpotifyAccessExp = 0;
let spotifyRefreshTokenInvalid = false;

const SPOTIFY_RECONNECT_MESSAGE =
  "Spotify refresh token is revoked. Reconnect at /api/spotify/login and update SPOTIFY_REFRESH_TOKEN in .env.";

const spotifyErrorLogTimes = new Map();
const logSpotifyErrorOnce = (key, ...args) => {
  const now = Date.now();
  const last = spotifyErrorLogTimes.get(key) || 0;
  if (now - last < 300000) return;
  spotifyErrorLogTimes.set(key, now);
  console.error(...args);
};

const getSpotifyAccessToken = async () => {
  const now = Math.floor(Date.now() / 1000);
  if (cachedSpotifyAccessToken && cachedSpotifyAccessExp - 30 > now) return cachedSpotifyAccessToken;
  if (spotifyRefreshTokenInvalid) {
    throw new Error(SPOTIFY_RECONNECT_MESSAGE);
  }

  try {
    const clientId = requireEnv("SPOTIFY_CLIENT_ID");
    const clientSecret = requireEnv("SPOTIFY_CLIENT_SECRET");
    const refreshToken = requireEnv("SPOTIFY_REFRESH_TOKEN");

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const tokenJson = await tokenRes.json();
    
    if (!tokenRes.ok) {
      if (tokenJson?.error === "invalid_grant") {
        spotifyRefreshTokenInvalid = true;
        logSpotifyErrorOnce("spotify-token-invalid-grant", "Spotify token error:", tokenJson);
        throw new Error(SPOTIFY_RECONNECT_MESSAGE);
      }
      logSpotifyErrorOnce(
        `spotify-token-${tokenRes.status}-${tokenJson?.error || "unknown"}`,
        "Spotify token error:",
        tokenJson
      );
      throw new Error(`Spotify token refresh failed: ${tokenRes.status} - ${tokenJson.error_description || tokenJson.error}`);
    }

    cachedSpotifyAccessToken = tokenJson.access_token;
    cachedSpotifyAccessExp = now + Number(tokenJson.expires_in || 3600);
    spotifyRefreshTokenInvalid = false;

    return cachedSpotifyAccessToken;
  } catch (e) {
    if (e?.message !== SPOTIFY_RECONNECT_MESSAGE) {
      logSpotifyErrorOnce(`spotify-token-catch-${e?.message || "unknown"}`, "getSpotifyAccessToken error:", e?.message);
    }
    throw e;
  }
};

// ---- One-time login to obtain refresh token (PKCE) ----
let pkceVerifier = "";

app.get("/api/spotify/login", (_req, res) => {
  const clientId = requireEnv("SPOTIFY_CLIENT_ID");
  const redirectUri = requireEnv("SPOTIFY_REDIRECT_URI");

  pkceVerifier = randomVerifier();
  spotifyRefreshTokenInvalid = false;
  cachedSpotifyAccessToken = "";
  cachedSpotifyAccessExp = 0;
  const challenge = challengeFromVerifier(pkceVerifier);

  const scope = ["user-read-recently-played"].join(" ");

  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("show_dialog", "true");

  res.redirect(url.toString());
});

app.get("/api/spotify/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "");
    if (!code) return res.status(400).send("Missing code");

    const clientId = requireEnv("SPOTIFY_CLIENT_ID");
    const clientSecret = requireEnv("SPOTIFY_CLIENT_SECRET");
    const redirectUri = requireEnv("SPOTIFY_REDIRECT_URI");

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: pkceVerifier,
    });

    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const json = await tokenRes.json();
    if (!tokenRes.ok) return res.status(tokenRes.status).json(json);

    // IMPORTANT: put this refresh_token into your .env as SPOTIFY_REFRESH_TOKEN
    // (Spotify may only return refresh_token on the first approval.)
    if (!json.refresh_token) {
      return res.status(200).send(
        "No refresh token was returned. Remove this app from your Spotify connected apps, then open /api/spotify/login again."
      );
    }
    spotifyRefreshTokenInvalid = false;
    cachedSpotifyAccessToken = "";
    cachedSpotifyAccessExp = 0;
    res.send(
      `Success. Copy this refresh token into .env as SPOTIFY_REFRESH_TOKEN:\n\n${json.refresh_token || "(no refresh token returned)"}`
    );
  } catch (e) {
    console.error(e);
    res.status(500).send("Spotify callback error");
  }
});

// ---- Your “recently played” API for the portfolio ----
app.get("/api/spotify/recent", async (_req, res) => {
  try {
    const accessToken = await getSpotifyAccessToken();

    const apiRes = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=1", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!apiRes.ok) {
      const errorData = await apiRes.json();
      logSpotifyErrorOnce(`spotify-api-${apiRes.status}`, "Spotify API error:", errorData);
      return res.status(apiRes.status).json({ error: "Spotify API error." });
    }

    const json = await apiRes.json();
    const item = json?.items?.[0];
    const track = item?.track;

    if (!track) {
      return res.json({
        title: "No recent tracks",
        artist: "Spotify",
        meta: "Play something to see it here.",
        artworkUrl: "",
        url: "https://open.spotify.com/",
      });
    }

    // format relative "played X ago" string from played_at
    const playedAt = item?.played_at ? String(item.played_at) : "";
    const formatRelative = (iso) => {
      if (!iso) return "Most recently played.";
      const diffMs = Date.now() - new Date(iso).getTime();
      const sec = Math.floor(diffMs / 1000);
      const min = Math.floor(sec / 60);
      const hr = Math.floor(min / 60);
      const day = Math.floor(hr / 24);

      if (day >= 1) return day === 1 ? "Played 1 day ago" : `Played ${day} days ago`;
      if (hr >= 1) return hr === 1 ? "Played 1 hour ago" : `Played ${hr} hours ago`;
      if (min >= 1) return min === 1 ? "Played 1 minute ago" : `Played ${min} minutes ago`;
      return "Played less than a minute ago";
    };

    const image = track?.album?.images?.[0]?.url || "";
    const url = track?.external_urls?.spotify || "https://open.spotify.com/";

    res.json({
      title: String(track?.name || "Unknown Track"),
      artist: String((track?.artists || []).map((a) => a?.name).filter(Boolean).join(", ") || "Unknown Artist"),
      meta: formatRelative(playedAt),
      artworkUrl: String(image),
      url: String(url),
      played_at: playedAt, // include raw timestamp if client wants it
    });
  } catch (e) {
    const message = e?.message || "Unknown Spotify error";
    if (message !== SPOTIFY_RECONNECT_MESSAGE) {
      logSpotifyErrorOnce(`spotify-recent-${message}`, "Spotify recent endpoint error:", message);
    }
    const status = message === SPOTIFY_RECONNECT_MESSAGE ? 401 : 500;
    res.status(status).json({ error: status === 401 ? SPOTIFY_RECONNECT_MESSAGE : "Server configuration error: " + message });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
