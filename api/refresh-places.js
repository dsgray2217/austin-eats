// Vercel serverless function: POST /api/refresh-places
//
// For every restaurant in data.json that has a googlePlaceId, fetches
// regularOpeningHours, rating, userRatingCount and reviews from the
// Places API (New) Place Details endpoint, then commits the results to
// placesCache.json in this repo (keyed by place ID, with a top-level
// lastRefreshed timestamp). placesCache.json is the single source of
// truth the frontend's "Open Now" and reviews features read from.
//
// Required env vars:
//   GOOGLE_PLACES_API_KEY  - Places API (New) key
//   REFRESH_SECRET         - shared secret; caller must send it as
//                            the `x-refresh-secret` header
//   GH_TOKEN               - GitHub token with repo contents:write
//   GH_REPO                - "owner/repo"
//   GH_BRANCH              - branch to commit to (defaults to "main")

const fs = require('fs');
const path = require('path');

const FIELD_MASK = 'regularOpeningHours,rating,userRatingCount,reviews';
const PLACE_DETAILS_URL = id => `https://places.googleapis.com/v1/places/${id}`;

async function fetchPlaceDetails(placeId, apiKey) {
  const res = await fetch(PLACE_DETAILS_URL(placeId), {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function getExistingFile(repo, branch, token) {
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/placesCache.json?ref=${branch}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'austin-eats-refresh-places',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET contents failed: HTTP ${res.status}`);
  return res.json();
}

async function commitFile(repo, branch, token, content, existingSha) {
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/placesCache.json`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'austin-eats-refresh-places',
    },
    body: JSON.stringify({
      message: 'chore: refresh placesCache.json',
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub PUT contents failed: HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { GOOGLE_PLACES_API_KEY, REFRESH_SECRET, GH_TOKEN, GH_REPO, GH_BRANCH } = process.env;

  if (REFRESH_SECRET && req.headers['x-refresh-secret'] !== REFRESH_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!GOOGLE_PLACES_API_KEY || !GH_TOKEN || !GH_REPO) {
    res.status(500).json({ error: 'Missing required environment variables' });
    return;
  }

  const branch = GH_BRANCH || 'main';
  const dataPath = path.join(process.cwd(), 'data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  const places = {};
  let updated = 0;
  let failed = 0;
  const errors = [];

  for (const restaurant of data) {
    if (!restaurant.googlePlaceId) continue;

    try {
      const details = await fetchPlaceDetails(restaurant.googlePlaceId, GOOGLE_PLACES_API_KEY);
      places[restaurant.googlePlaceId] = {
        regularOpeningHours: details.regularOpeningHours || null,
        rating: details.rating ?? null,
        userRatingCount: details.userRatingCount ?? null,
        reviews: details.reviews || [],
      };
      updated++;
    } catch (err) {
      failed++;
      errors.push({ name: restaurant.name, placeId: restaurant.googlePlaceId, error: err.message });
    }

    // Stay comfortably under Google's QPS limits.
    await new Promise(r => setTimeout(r, 150));
  }

  const cache = {
    lastRefreshed: new Date().toISOString(),
    places,
  };
  const content = JSON.stringify(cache, null, 2) + '\n';

  try {
    const existing = await getExistingFile(GH_REPO, branch, GH_TOKEN);
    await commitFile(GH_REPO, branch, GH_TOKEN, content, existing?.sha);
  } catch (err) {
    res.status(502).json({ error: `Failed to commit placesCache.json: ${err.message}`, updated, failed, errors });
    return;
  }

  res.status(200).json({ updated, failed, errors, lastRefreshed: cache.lastRefreshed });
};
