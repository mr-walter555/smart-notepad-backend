const express = require('express')
const { google } = require('googleapis')
const router = express.Router()

function getOAuthClient() {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/calendar/callback'
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  )
}

function getTokenModel() {
  try { return require('../models/CalendarToken') } catch { return null }
}

// In-memory fallback for local dev without MongoDB
let memToken = null

async function saveToken(tokens) {
  const Token = getTokenModel()
  const data = {
    accessToken:  tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt:    tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  }
  if (Token) {
    await Token.findOneAndUpdate({ key: 'default' }, data, { upsert: true }).catch(() => {})
  } else {
    memToken = data
  }
}

async function loadToken() {
  const Token = getTokenModel()
  if (Token) return Token.findOne({ key: 'default' }).catch(() => null)
  return memToken
}

async function getAuthorizedClient() {
  const token = await loadToken()
  if (!token?.refreshToken) return null

  const client = getOAuthClient()
  client.setCredentials({
    access_token:  token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date:   token.expiresAt ? new Date(token.expiresAt).getTime() : undefined,
  })

  // Persist refreshed access tokens automatically
  client.on('tokens', async (newTokens) => {
    const existing = await loadToken()
    await saveToken({
      access_token:  newTokens.access_token,
      refresh_token: newTokens.refresh_token || existing?.refreshToken,
      expiry_date:   newTokens.expiry_date,
    })
  })

  return client
}

// GET /api/calendar/status
router.get('/status', async (req, res) => {
  const token = await loadToken()
  res.json({ connected: !!token?.refreshToken })
})

// GET /api/calendar/auth — returns Google OAuth URL
router.get('/auth', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: 'Google Calendar not configured' })
  }
  const client = getOAuthClient()
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent',
  })
  res.json({ url })
})

// GET /api/calendar/callback — OAuth redirect handler
router.get('/callback', async (req, res) => {
  let FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
  if (!FRONTEND_URL.startsWith('http')) FRONTEND_URL = 'https://' + FRONTEND_URL

  try {
    const client = getOAuthClient()
    const { tokens } = await client.getToken(req.query.code)
    await saveToken(tokens)
    res.redirect(`${FRONTEND_URL}?calendar=connected`)
  } catch (err) {
    console.error('[calendar] callback error:', err.message)
    res.redirect(`${FRONTEND_URL}?calendar=error`)
  }
})

// GET /api/calendar/events — upcoming events (next 2 weeks)
router.get('/events', async (req, res) => {
  const client = await getAuthorizedClient()
  if (!client) return res.status(401).json({ error: 'Not connected to Google Calendar' })

  try {
    const cal = google.calendar({ version: 'v3', auth: client })
    const now = new Date()
    const response = await cal.events.list({
      calendarId:   'primary',
      timeMin:      now.toISOString(),
      timeMax:      new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      maxResults:   30,
      singleEvents: true,
      orderBy:      'startTime',
    })
    res.json(response.data.items || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/calendar/events — create event from note
router.post('/events', async (req, res) => {
  const { title, description, startTime, endTime } = req.body
  const client = await getAuthorizedClient()
  if (!client) return res.status(401).json({ error: 'Not connected' })

  try {
    const cal = google.calendar({ version: 'v3', auth: client })
    const start = startTime ? new Date(startTime) : new Date()
    const end   = endTime   ? new Date(endTime)   : new Date(start.getTime() + 60 * 60 * 1000)

    const event = await cal.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary:     title || 'Note',
        description: description || '',
        start: { dateTime: start.toISOString() },
        end:   { dateTime: end.toISOString() },
      },
    })
    res.json(event.data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/calendar/events/:eventId — update event
router.patch('/events/:eventId', async (req, res) => {
  const client = await getAuthorizedClient()
  if (!client) return res.status(401).json({ error: 'Not connected' })

  try {
    const cal = google.calendar({ version: 'v3', auth: client })
    const patch = {}
    if (req.body.title)       patch.summary     = req.body.title
    if (req.body.description !== undefined) patch.description = req.body.description
    if (req.body.startTime)   patch.start = { dateTime: new Date(req.body.startTime).toISOString() }
    if (req.body.endTime)     patch.end   = { dateTime: new Date(req.body.endTime).toISOString() }

    const event = await cal.events.patch({
      calendarId: 'primary',
      eventId:    req.params.eventId,
      requestBody: patch,
    })
    res.json(event.data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/calendar/events/:eventId
router.delete('/events/:eventId', async (req, res) => {
  const client = await getAuthorizedClient()
  if (!client) return res.status(401).json({ error: 'Not connected' })

  try {
    const cal = google.calendar({ version: 'v3', auth: client })
    await cal.events.delete({ calendarId: 'primary', eventId: req.params.eventId })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/calendar/disconnect
router.post('/disconnect', async (req, res) => {
  const Token = getTokenModel()
  if (Token) await Token.deleteMany({ key: 'default' }).catch(() => {})
  memToken = null
  res.json({ ok: true })
})

module.exports = router
