# Austin Eats 🗺

A personal food map of Austin, TX. View restaurants on an interactive map, rate them, add notes, and get directions — all in a fast, mobile-friendly interface.

## Files

```
austin-eats/
├── index.html    ← the entire app (HTML + CSS + JS, no build step)
├── data.json     ← your restaurant list (commit updates here)
├── vercel.json   ← Vercel config
└── .gitignore
```

## How data works

- On first load, the site reads `data.json` from this repo
- Changes you make (ratings, notes, new restaurants) save to your **browser's localStorage**
- To publish changes so visitors see them: use the 💾 Export button (admin mode) → commit the downloaded `data.json` → Vercel auto-redeploys in ~30 seconds

## Admin mode

Click the 🔒 icon in the top-right corner. You'll be prompted to set a PIN on first use. With admin unlocked you can:
- Add new restaurants
- Edit existing entries
- Delete restaurants
- Export `data.json` for committing

The PIN is stored in your browser only — visitors see the map in read-only mode.

## Adding a restaurant's coordinates

1. Open [maps.google.com](https://maps.google.com)
2. Find the restaurant
3. Right-click the pin → click the coordinates at the top of the menu
4. Paste Latitude and Longitude into the Add form

## Deploying updates

Whenever you want visitors to see your latest restaurants:

1. Unlock admin mode on your live site
2. Click 💾 to download `data.json`
3. Replace the `data.json` in your GitHub repo with the downloaded file
4. Commit and push — Vercel redeploys automatically in ~30s
