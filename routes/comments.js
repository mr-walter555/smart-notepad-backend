const express = require('express')
const router = express.Router()
const store = require('../services/shareStore')

function getCommentModel() {
  try { return require('../models/Comment') } catch { return null }
}

// GET /api/comments/:shareToken
router.get('/:shareToken', async (req, res) => {
  const { shareToken } = req.params
  if (!store.get(shareToken)) return res.status(404).json({ error: 'not found' })

  const Comment = getCommentModel()
  if (Comment) {
    const comments = await Comment.find({ shareToken }).sort({ createdAt: 1 }).lean().catch(() => [])
    return res.json(comments)
  }

  // Fallback: comments stored inside shareStore
  const share = store.get(shareToken)
  res.json(share?.comments || [])
})

// POST /api/comments/:shareToken
router.post('/:shareToken', async (req, res) => {
  const { shareToken } = req.params
  if (!store.get(shareToken)) return res.status(404).json({ error: 'not found' })

  const { userId, displayName, body, selectedText, range } = req.body
  if (!body?.trim()) return res.status(400).json({ error: 'body required' })

  const Comment = getCommentModel()
  if (Comment) {
    const comment = await Comment.create({ shareToken, userId, displayName, body, selectedText, range })
    return res.json(comment)
  }

  // Fallback: store in shareStore
  const share = store.get(shareToken)
  const comment = {
    _id: require('crypto').randomUUID(),
    shareToken, userId,
    displayName: displayName || 'Anonymous',
    body, selectedText, range,
    createdAt: new Date().toISOString(),
  }
  store.set(shareToken, { ...share, comments: [...(share.comments || []), comment] })
  res.json(comment)
})

// DELETE /api/comments/:shareToken/:commentId
router.delete('/:shareToken/:commentId', async (req, res) => {
  const { shareToken, commentId } = req.params

  const Comment = getCommentModel()
  if (Comment) {
    await Comment.deleteOne({ _id: commentId, shareToken }).catch(() => {})
    return res.json({ ok: true })
  }

  const share = store.get(shareToken)
  if (share) {
    store.set(shareToken, {
      ...share,
      comments: (share.comments || []).filter(c => c._id !== commentId),
    })
  }
  res.json({ ok: true })
})

module.exports = router
