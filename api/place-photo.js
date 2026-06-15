// Vercel serverless function: GET /api/place-photo?name=places/XXX/photos/YYY&w=480
//
// Proxies a Places API (New) photo through the server so the
// GOOGLE_PLACES_API_KEY is never exposed to the browser.

const NAME_RE = /^places\/[^/]+\/photos\/[^/]+$/;

module.exports = async (req, res) => {
  const { name, w } = req.query;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    res.status(500).json({ error: 'Missing GOOGLE_PLACES_API_KEY' });
    return;
  }
  if (typeof name !== 'string' || !NAME_RE.test(name)) {
    res.status(400).json({ error: 'Invalid name' });
    return;
  }

  const maxWidthPx = Math.min(Math.max(parseInt(w, 10) || 480, 100), 1600);
  const url = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${maxWidthPx}&key=${apiKey}`;

  const upstream = await fetch(url, { redirect: 'follow' });
  if (!upstream.ok) {
    res.status(upstream.status).json({ error: `Upstream HTTP ${upstream.status}` });
    return;
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.status(200).send(buf);
};
