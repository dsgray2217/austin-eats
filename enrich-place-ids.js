// One-off script: looks up each restaurant's Google Places ID via the Places API (New)
// Text Search endpoint and writes it to data.json as `googlePlaceId`. Skips restaurants
// that already have one.
//
// Usage:
//   GOOGLE_PLACES_API_KEY=your_key_here node enrich-place-ids.js

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  console.error('Error: set GOOGLE_PLACES_API_KEY environment variable.');
  process.exit(1);
}

const DATA_PATH = path.join(__dirname, 'data.json');
const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

function normalize(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function namesRoughlyMatch(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  return na.includes(nb) || nb.includes(na);
}

async function searchPlace(restaurant) {
  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify({
      textQuery: `${restaurant.name} Austin TX`,
      locationBias: {
        circle: {
          center: { latitude: restaurant.lat, longitude: restaurant.lng },
          radius: 1000.0,
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const json = await res.json();
  const place = json.places && json.places[0];
  return place || null;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let needsReview = 0;

  for (const restaurant of data) {
    if (restaurant.googlePlaceId) {
      skipped++;
      continue;
    }

    try {
      const place = await searchPlace(restaurant);
      if (!place) {
        failed++;
        console.log(`  NONE  ${restaurant.name}  (no results)`);
      } else {
        restaurant.googlePlaceId = place.id;
        updated++;
        const displayName = place.displayName?.text || '';
        if (!namesRoughlyMatch(restaurant.name, displayName)) {
          needsReview++;
          console.log(`  REVIEW  ${restaurant.name} -> ${place.id}  (matched "${displayName}", ${place.formattedAddress || ''})`);
        } else {
          console.log(`  OK    ${restaurant.name} -> ${place.id}`);
        }
      }
    } catch (err) {
      failed++;
      console.log(`  ERR   ${restaurant.name}  ${err.message}`);
    }

    // Stay comfortably under Google's QPS limits.
    await new Promise(r => setTimeout(r, 200));
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`\nDone. Updated: ${updated}, skipped (already had ID): ${skipped}, failed: ${failed}, needs review: ${needsReview}`);
}

main();
