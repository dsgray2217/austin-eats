// Vercel serverless function: POST /api/discover-places
//
// Searches a grid of points across Austin using the Places API (New)
// Nearby Search endpoint, keeps restaurants rated 4.7+ that aren't
// already in data.json (matched by googlePlaceId), and commits the
// result to discoverCache.json — the source for the "Discover" swiper.
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
const { getExistingFile, commitFile } = require('./_github');

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.primaryTypeDisplayName',
  'places.photos',
].join(',');

const MIN_RATING = 4.7;

// Grid of search centers covering greater Austin (~3km radius each).
const GRID = [
  { lat: 30.40, lng: -97.85 }, { lat: 30.40, lng: -97.74 }, { lat: 30.40, lng: -97.63 },
  { lat: 30.29, lng: -97.85 }, { lat: 30.29, lng: -97.74 }, { lat: 30.29, lng: -97.63 },
  { lat: 30.18, lng: -97.85 }, { lat: 30.18, lng: -97.74 }, { lat: 30.18, lng: -97.63 },
];

async function searchNearby(center, apiKey) {
  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: ['restaurant'],
      maxResultCount: 20,
      locationRestriction: {
        circle: { center: { latitude: center.lat, longitude: center.lng }, radius: 3000.0 },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.places || [];
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
  const known = new Set(data.map(r => r.googlePlaceId).filter(Boolean));

  const found = new Map();
  const errors = [];

  for (const center of GRID) {
    try {
      const places = await searchNearby(center, GOOGLE_PLACES_API_KEY);
      for (const place of places) {
        if (!place.id || known.has(place.id) || found.has(place.id)) continue;
        if (place.rating == null || place.rating < MIN_RATING) continue;
        found.set(place.id, {
          id: place.id,
          name: place.displayName?.text || 'Unknown',
          address: place.formattedAddress || '',
          lat: place.location?.latitude ?? null,
          lng: place.location?.longitude ?? null,
          rating: place.rating,
          userRatingCount: place.userRatingCount ?? null,
          priceLevel: place.priceLevel || null,
          cuisine: place.primaryTypeDisplayName?.text || '',
          photoName: place.photos?.[0]?.name || null,
        });
      }
    } catch (err) {
      errors.push({ center, error: err.message });
    }

    await new Promise(r => setTimeout(r, 200));
  }

  const cache = {
    lastRefreshed: new Date().toISOString(),
    places: [...found.values()],
  };
  const content = JSON.stringify(cache, null, 2) + '\n';

  try {
    const existing = await getExistingFile(GH_REPO, branch, GH_TOKEN, 'discoverCache.json');
    await commitFile(GH_REPO, branch, GH_TOKEN, 'discoverCache.json', content, existing?.sha, 'chore: refresh discoverCache.json');
  } catch (err) {
    res.status(502).json({ error: `Failed to commit discoverCache.json: ${err.message}`, found: cache.places.length, errors });
    return;
  }

  res.status(200).json({ found: cache.places.length, errors, lastRefreshed: cache.lastRefreshed });
};
