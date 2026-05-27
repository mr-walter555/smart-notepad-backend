const express = require('express')
const { randomUUID } = require('crypto')
const store = require('../services/shareStore')

const router = express.Router()

// Create or re-enable a share
router.post('/', (req, res) => {
  const { noteId, title, content, token: existingToken } = req.body
  if (!noteId) return res.status(400).json({ error: 'noteId required' })

  const token = existingToken || randomUUID()
  const now = new Date().toISOString()
  const existing = existingToken ? store.get(existingToken) : null

  store.set(token, {
    token,
    noteId,
    title: title || 'Untitled',
    content: content || '',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    comments: existing?.comments || [],
  })

  res.json({ token })
})

// Sync content (auto-save)
router.put('/:token', (req, res) => {
  const share = store.get(req.params.token)
  if (!share) return res.status(404).json({ error: 'not found' })

  store.set(req.params.token, {
    ...share,
    title: req.body.title ?? share.title,
    content: req.body.content ?? share.content,
    updatedAt: new Date().toISOString(),
  })
  res.json({ ok: true })
})

// Stop sharing
router.delete('/:token', (req, res) => {
  store.delete(req.params.token)
  res.json({ ok: true })
})

// Verify share exists (used by modal on open)
router.get('/:token/info', (req, res) => {
  const share = store.get(req.params.token)
  if (!share) return res.status(404).json({ error: 'not found' })
  res.json({ token: share.token, title: share.title, createdAt: share.createdAt })
})

// Full share data for frontend share page
router.get('/:token/content', (req, res) => {
  const share = store.get(req.params.token)
  if (!share) return res.status(404).json({ error: 'not found' })
  res.json({ token: share.token, title: share.title, content: share.content, updatedAt: share.updatedAt })
})

// List comments
router.get('/:token/comments', (req, res) => {
  const share = store.get(req.params.token)
  if (!share) return res.status(404).json({ error: 'not found' })
  res.json(share.comments || [])
})

// Add comment
router.post('/:token/comments', (req, res) => {
  const share = store.get(req.params.token)
  if (!share) return res.status(404).json({ error: 'not found' })

  const { author, text } = req.body
  if (!text?.trim()) return res.status(400).json({ error: 'text required' })

  const comment = {
    id: randomUUID(),
    author: author?.trim() || 'Anonymous',
    text: text.trim(),
    createdAt: new Date().toISOString(),
  }

  store.set(req.params.token, {
    ...share,
    comments: [...(share.comments || []), comment],
  })

  res.json(comment)
})

// Public HTML page
router.get('/page/:token', (req, res) => {
  const share = store.get(req.params.token)
  if (!share) {
    return res.status(404).send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;color:#374151">
      <h2>Note not found</h2><p>This link may have been deactivated.</p></body></html>`)
  }

  const escHtml = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;')

  const commentsHtml = (share.comments || []).map(c => `
    <div class="comment">
      <div class="comment-author">${escHtml(c.author)}</div>
      <div class="comment-text">${escHtml(c.text)}</div>
      <div class="comment-time">${new Date(c.createdAt).toLocaleString()}</div>
    </div>`).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(share.title)} — Smart Notepad</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; color: #111827; line-height: 1.6; }
    .topbar { background: #b05c18; padding: 0.75rem 1.5rem; display: flex; align-items: center; gap: 0.75rem; }
    .topbar-logo { width: 28px; height: 28px; background: rgba(255,255,255,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .topbar-logo svg { width: 16px; height: 16px; fill: white; }
    .topbar-name { color: white; font-weight: 600; font-size: 0.95rem; }
    .topbar-badge { margin-left: auto; background: rgba(255,255,255,0.2); color: white; font-size: 0.7rem; font-weight: 600; padding: 0.2rem 0.6rem; border-radius: 999px; letter-spacing: 0.05em; text-transform: uppercase; }
    .container { max-width: 760px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
    .note-title { font-size: 2rem; font-weight: 700; color: #111827; margin-bottom: 0.5rem; }
    .note-meta { font-size: 0.8rem; color: #9ca3af; margin-bottom: 2rem; }
    .note-content { font-size: 1rem; color: #1f2937; }
    .note-content h1 { font-size: 1.75rem; font-weight: 700; margin: 1.5rem 0 0.75rem; }
    .note-content h2 { font-size: 1.375rem; font-weight: 600; margin: 1.25rem 0 0.6rem; }
    .note-content h3 { font-size: 1.125rem; font-weight: 600; margin: 1rem 0 0.5rem; }
    .note-content p { margin-bottom: 0.875rem; }
    .note-content ul, .note-content ol { padding-left: 1.5rem; margin-bottom: 0.875rem; }
    .note-content li { margin-bottom: 0.25rem; }
    .note-content strong { font-weight: 600; }
    .note-content em { font-style: italic; }
    .note-content code { background: #f3f4f6; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.875em; font-family: 'Fira Code', monospace; color: #db2777; }
    .note-content pre { background: #fafafa; border: 1px solid #e5e7eb; border-radius: 10px; padding: 1rem; overflow-x: auto; margin-bottom: 1rem; }
    .note-content pre code { background: none; color: inherit; padding: 0; font-size: 0.875rem; }
    .note-content blockquote { border-left: 4px solid #de8c3e; padding-left: 1rem; margin: 1rem 0; color: #6b7280; font-style: italic; }
    .note-content hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0; }
    .note-content a { color: #b05c18; text-decoration: underline; }
    .note-content img { max-width: 100%; height: auto; border-radius: 8px; margin: 0.5rem 0; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 2.5rem 0; }
    .comments-section h3 { font-size: 1rem; font-weight: 600; color: #374151; margin-bottom: 1rem; }
    .comment { background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.875rem 1rem; margin-bottom: 0.75rem; }
    .comment-author { font-weight: 600; font-size: 0.875rem; color: #111827; margin-bottom: 0.25rem; }
    .comment-text { font-size: 0.9rem; color: #374151; margin-bottom: 0.375rem; }
    .comment-time { font-size: 0.75rem; color: #9ca3af; }
    .no-comments { color: #9ca3af; font-size: 0.875rem; font-style: italic; margin-bottom: 1rem; }
    .comment-form { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem; }
    .comment-form input, .comment-form textarea { width: 100%; border: 1px solid #d1d5db; border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.875rem; font-family: inherit; color: #111827; outline: none; transition: border-color 0.15s; margin-bottom: 0.625rem; }
    .comment-form input:focus, .comment-form textarea:focus { border-color: #de8c3e; box-shadow: 0 0 0 3px rgba(200,112,32,0.12); }
    .comment-form textarea { resize: vertical; min-height: 80px; }
    .comment-form button { background: #b05c18; color: white; border: none; border-radius: 8px; padding: 0.5rem 1.25rem; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: background 0.15s; }
    .comment-form button:hover { background: #8f4815; }
    .comment-form button:disabled { opacity: 0.5; cursor: not-allowed; }
    .success-msg { color: #16a34a; font-size: 0.8rem; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-logo">
      <svg viewBox="0 0 16 16"><path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1zm1 3v1h8V5H4zm0 3v1h8V8H4zm0 3v1h5v-1H4z"/></svg>
    </div>
    <span class="topbar-name">Smart Notepad</span>
    <span class="topbar-badge">Shared</span>
  </div>

  <div class="container">
    <div class="note-title">${escHtml(share.title)}</div>
    <div class="note-meta">Shared note · Last updated ${new Date(share.updatedAt).toLocaleDateString()}</div>
    <div class="note-content" id="note-content">${share.content}</div>

    <hr class="divider" />

    <div class="comments-section">
      <h3>Comments</h3>
      <div id="comments-list">
        ${commentsHtml || '<p class="no-comments">No comments yet. Be the first to comment.</p>'}
      </div>

      <div class="comment-form">
        <input type="text" id="comment-author" placeholder="Your name (optional)" maxlength="60" />
        <textarea id="comment-text" placeholder="Write a comment…" maxlength="2000"></textarea>
        <button id="submit-btn" onclick="submitComment()">Post comment</button>
        <div class="success-msg" id="success-msg" style="display:none">Comment posted!</div>
      </div>
    </div>
  </div>

  <script>
    const TOKEN = '${escHtml(req.params.token)}';
    const BASE = window.location.origin + '/api/share';

    async function submitComment() {
      const author = document.getElementById('comment-author').value.trim();
      const text = document.getElementById('comment-text').value.trim();
      if (!text) return;
      const btn = document.getElementById('submit-btn');
      btn.disabled = true;
      btn.textContent = 'Posting…';
      try {
        const res = await fetch(BASE + '/' + TOKEN + '/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author, text }),
        });
        if (res.ok) {
          document.getElementById('comment-text').value = '';
          document.getElementById('comment-author').value = '';
          document.getElementById('success-msg').style.display = 'block';
          setTimeout(() => document.getElementById('success-msg').style.display = 'none', 3000);
          loadComments();
        }
      } finally {
        btn.disabled = false;
        btn.textContent = 'Post comment';
      }
    }

    async function loadComments() {
      const res = await fetch(BASE + '/' + TOKEN + '/comments');
      if (!res.ok) return;
      const comments = await res.json();
      const el = document.getElementById('comments-list');
      if (!comments.length) {
        el.innerHTML = '<p class="no-comments">No comments yet. Be the first to comment.</p>';
        return;
      }
      el.innerHTML = comments.map(c => \`
        <div class="comment">
          <div class="comment-author">\${esc(c.author)}</div>
          <div class="comment-text">\${esc(c.text)}</div>
          <div class="comment-time">\${new Date(c.createdAt).toLocaleString()}</div>
        </div>\`).join('');
    }

    function esc(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    setInterval(loadComments, 15000);
  </script>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html')
  res.send(html)
})

module.exports = router
