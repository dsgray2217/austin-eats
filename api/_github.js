// Shared GitHub Contents API helpers for committing JSON cache files
// from Vercel serverless functions.

async function getExistingFile(repo, branch, token, filePath) {
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'austin-eats-refresh',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET contents failed: HTTP ${res.status}`);
  return res.json();
}

async function commitFile(repo, branch, token, filePath, content, existingSha, message) {
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'austin-eats-refresh',
    },
    body: JSON.stringify({
      message,
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

module.exports = { getExistingFile, commitFile };
