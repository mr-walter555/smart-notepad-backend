const express = require('express')
const { randomUUID } = require('crypto')
const router = express.Router()
const store = require('../services/shareStore')
const { sendInviteEmail } = require('../services/emailService')

function getInviteModel() {
  try { return require('../models/Invite') } catch { return null }
}

// POST /api/invite — create invite, optionally send email
router.post('/', async (req, res) => {
  const { noteId, shareToken, email, permissions = 'view', noteTitle } = req.body
  if (!noteId || !shareToken) return res.status(400).json({ error: 'noteId and shareToken required' })

  const share = store.get(shareToken)
  if (!share) return res.status(404).json({ error: 'Note is not shared yet' })

  let FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
  if (!FRONTEND_URL.startsWith('http')) FRONTEND_URL = 'https://' + FRONTEND_URL

  const token = randomUUID()
  const inviteUrl = `${FRONTEND_URL}/share/${shareToken}`

  // Persist invite for tracking — MongoDB first, shareStore as fallback
  const Invite = getInviteModel()
  if (Invite) {
    await Invite.create({ token, noteId, shareToken, email, permissions })
  } else {
    store.set(`invite:${token}`, { token, noteId, shareToken, email, permissions, createdAt: new Date().toISOString() })
  }

  let emailResult = { skipped: true }
  if (email) {
    emailResult = await sendInviteEmail({ to: email, inviteUrl, noteTitle, permissions }).catch(err => {
      console.error('[invite] email error:', err.message)
      return { error: err.message }
    })
  }

  res.json({ token, inviteUrl, email: emailResult })
})

// GET /api/invite/:token — validate and redirect to frontend share page
router.get('/:token', async (req, res) => {
  const { token } = req.params
  let FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
  if (!FRONTEND_URL.startsWith('http')) FRONTEND_URL = 'https://' + FRONTEND_URL

  const Invite = getInviteModel()
  if (Invite) {
    const invite = await Invite.findOne({ token }).catch(() => null)
    if (!invite) return res.status(404).send('<p>Invite not found or expired.</p>')
    if (invite.status === 'expired' || invite.expiresAt < new Date()) {
      await Invite.updateOne({ token }, { status: 'expired' }).catch(() => {})
      return res.status(410).send('<p>This invite link has expired.</p>')
    }
    await Invite.updateOne({ token }, { status: 'accepted' }).catch(() => {})
    return res.redirect(`${FRONTEND_URL}/share/${invite.shareToken}`)
  }

  // Fallback: look up from shareStore
  const invite = store.get(`invite:${token}`)
  if (!invite) return res.status(404).send('<p>Invite not found or expired.</p>')
  return res.redirect(`${FRONTEND_URL}/share/${invite.shareToken}`)
})

module.exports = router
