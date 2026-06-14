// One-off script: looks up each restaurant's Google Places place_id by name + address
// and writes it to data.json as `googlePlaceId`. Skips restaurants that already have one.
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
const FIND_PLACE_URL = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';

async function findPlaceId(restaurant) {
  const input = `${restaurant.name}, ${restaurant.address}`;
  const url = new URL(FIND_PLACE_URL);
  url.searchParams.set('input', input);
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set('fields', 'place_id');
  url.searchParams.set('locationbias', `point:${restaurant.lat},${restaurant.lng}`);
  url.searchParams.set('key', API_KEY);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.status !== 'OK') {
    return { status: json.status, placeId: null };
  }
  const candidate = json.candidates && json.candidates[0];
  return { status: 'OK', placeId: candidate ? candidate.place_id : null };
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const restaurant of data) {
    if (restaurant.googlePlaceId) {
      skipped++;
      continue;
    }

    try {
      const { status, placeId } = await findPlaceId(restaurant);
      if (placeId) {
        restaurant.googlePlaceId = placeId;
        updated++;
        console.log(`  OK    ${restaurant.name} -> ${placeId}`);
      } else {
        failed++;
        console.log(`  MISS  ${restaurant.name} (${status})`);
      }
    } catch (err) {
      failed++;
      console.log(`  ERR   ${restaurant.name}  ${err.message}`);
    }

    // Stay comfortably under Google's QPS limits.
    await new Promise(r => setTimeout(r, 150));
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`\nDone. Updated: ${updated}, skipped (already had ID): ${skipped}, failed: ${failed}`);
}

main();
