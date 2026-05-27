const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const express = require('express')
const cors = require('cors')

const app = express()

const allowedOrigins = [
  'http://localhost:5173',
  'file://',
  process.env.FRONTEND_URL,
].filter(Boolean)

app.use(express.json({ limit: '10mb' }))

// Ensure MongoDB is connected before every request (safe for serverless cold starts)
let dbReady = false
app.use(async (req, res, next) => {
  if (dbReady || !process.env.MONGODB_URI) return next()
  try {
    const { connectDB } = require('./database/connection')
    await connectDB()
    dbReady = true
  } catch (err) {
    console.warn('MongoDB not available:', err.message)
    dbReady = true // don't retry on every request
  }
  next()
})

app.use('/api/share',  cors(), require('./routes/share'))
app.use('/api/invite', cors(), require('./routes/invite'))

app.use(cors({ origin: allowedOrigins }))
app.use('/api/notes',      require('./routes/notes'))
app.use('/api/workspaces', require('./routes/workspaces'))
app.use('/api/ai',         require('./routes/ai'))

app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

if (require.main === module) {
  const PORT = process.env.PORT || 3001
  app.listen(PORT, () => console.log(`Smart Notepad backend running on port ${PORT}`))
}

module.exports = app
