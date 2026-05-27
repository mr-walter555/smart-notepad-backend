const express = require('express')
const { randomUUID } = require('crypto')
const store = require('../services/shareStore')

const router = express.Router()

function getShareModel() {
  try { return require('../models/Share') } catch { return null }
}

// Create or re-enable a share
router.post('/', async (req, res) => {
  const { noteId, title, content, token: existingToken } = req.body
  if (!noteId) return res.status(400).json({ error: 'noteId required' })

  const token = existingToken || randomUUID()
  const data = {
    token,
    noteId,
    title: title || 'Untitled',
    content: content || '',
    comments: [],
  }

  const Share = getShareModel()
  if (Share) {
    await Share.findOneAndUpdate({ token }, data, { upsert: true, new: true }).catch(() => {})
  }
  store.set(token, { ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })

  res.json({ token })
})

// Sync content (auto-save)
router.put('/:token', async (req, res) => {
  const { token } = req.params
  const update = {
    title:   req.body.title,
    content: req.body.content,
    updatedAt: new Date().toISOString(),
  }

  const Share = getShareModel()
  if (Share) {
    await Share.findOneAndUpdate({ token }, { $set: update }).catch(() => {})
  }
  const existing = store.get(token)
  if (existing) store.set(token, { ...existing, ...update })

  res.json({ ok: true })
})

// Stop sharing
router.delete('/:token', async (req, res) => {
  const Share = getShareModel()
  if (Share) await Share.deleteOne({ token: req.params.token }).catch(() => {})
  store.delete(req.params.token)
  res.json({ ok: true })
})

// Verify share exists
router.get('/:token/info', async (req, res) => {
  const Share = getShareModel()
  if (Share) {
    const share = await Share.findOne({ token: req.params.token }).catch(() => null)
    if (share) return res.json({ token: share.token, title: share.title, createdAt: share.createdAt })
  }
  const share = store.get(req.params.token)
  if (!share) return res.status(404).json({ error: 'not found' })
  res.json({ token: share.token, title: share.title, createdAt: share.createdAt })
})

// Full content for frontend share page
router.get('/:token/content', async (req, res) => {
  const Share = getShareModel()
  if (Share) {
    const share = await Share.findOne({ token: req.params.token }).catch(() => null)
    if (share) return res.json({ token: share.token, title: share.title, content: share.content, updatedAt: share.updatedAt })
  }
  const share = store.get(req.params.token)
  if (!share) return res.status(404).json({ error: 'not found' })
  res.json({ token: share.token, title: share.title, content: share.content, updatedAt: share.updatedAt })
})

// List comments
router.get('/:token/comments', async (req, res) => {
  const Share = getShareModel()
  if (Share) {
    const share = await Share.findOne({ token: req.params.token }).catch(() => null)
    if (share) return res.json(share.comments || [])
  }
  const share = store.get(req.params.token)
  if (!share) return res.status(404).json({ error: 'not found' })
  res.json(share.comments || [])
})

// Add comment
router.post('/:token/comments', async (req, res) => {
  const { author, text } = req.body
  if (!text?.trim()) return res.status(400).json({ error: 'text required' })

  const comment = {
    id: randomUUID(),
    author: author?.trim() || 'Anonymous',
    text: text.trim(),
    createdAt: new Date().toISOString(),
  }

  const Share = getShareModel()
  if (Share) {
    await Share.findOneAndUpdate({ token: req.params.token }, { $push: { comments: comment } }).catch(() => {})
  }
  const existing = store.get(req.params.token)
  if (existing) store.set(req.params.token, { ...existing, comments: [...(existing.comments || []), comment] })

  res.json(comment)
})

// Viewer presence — lightweight ping-based presence for serverless
const viewers = {} // { [shareToken]: { [userId]: { userId, displayName, color, lastSeen } } }
const VIEWER_COLORS = ['#e67e22','#2ecc71','#3498db','#9b59b6','#e74c3c','#1abc9c','#f39c12','#e91e63']
let colorIdx = 0

router.post('/:token/viewers', (req, res) => {
  const { userId, displayName } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })
  if (!viewers[req.params.token]) viewers[req.params.token] = {}
  const existing = viewers[req.params.token][userId]
  viewers[req.params.token][userId] = {
    userId,
    displayName: displayName || 'Viewer',
    color: existing?.color || VIEWER_COLORS[colorIdx++ % VIEWER_COLORS.length],
    lastSeen: Date.now(),
  }
  // Evict viewers not seen in 15s
  const cutoff = Date.now() - 15000
  Object.keys(viewers[req.params.token]).forEach(id => {
    if (viewers[req.params.token][id].lastSeen < cutoff) delete viewers[req.params.token][id]
  })
  res.json({ ok: true })
})

router.get('/:token/viewers', (req, res) => {
  const room = viewers[req.params.token] || {}
  const cutoff = Date.now() - 15000
  const active = Object.values(room).filter(v => v.lastSeen >= cutoff)
  res.json(active)
})

// Public HTML page (legacy — kept for direct backend access)
router.get('/page/:token', async (req, res) => {
  const Share = getShareModel()
  let share = null
  if (Share) share = await Share.findOne({ token: req.params.token }).catch(() => null)
  if (!share) share = store.get(req.params.token)

  if (!share) {
    return res.status(404).send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem">
      <h2>Note not found</h2><p>This link may have been deactivated.</p></body></html>`)
  }

  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
  res.redirect(`${FRONTEND_URL}/share/${share.token}`)
})

module.exports = router
