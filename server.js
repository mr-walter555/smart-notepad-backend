require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const http = require('http')
const express = require('express')
const cors = require('cors')
const { BACKEND_PORT } = require('../shared/constants')

const app = express()
const httpServer = http.createServer(app)
const PORT = process.env.PORT || BACKEND_PORT

// Socket.io (must init before routes so io is available)
const socketModule = require('./socket')
socketModule.init(httpServer)

app.use(express.json({ limit: '10mb' }))

// Share + comments routes use open CORS so browsers on the share page can call them
app.use('/api/share',    cors(), require('./routes/share'))
app.use('/api/invite',   cors(), require('./routes/invite'))
app.use('/api/comments', cors(), require('./routes/comments'))

app.use(cors({ origin: ['http://localhost:5173', 'file://'] }))
app.use('/api/notes',      require('./routes/notes'))
app.use('/api/workspaces', require('./routes/workspaces'))
app.use('/api/ai',         require('./routes/ai'))

app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

async function start() {
  try {
    if (process.env.MONGODB_URI) {
      const { connectDB } = require('./database/connection')
      await connectDB()
    }
  } catch (err) {
    console.warn('MongoDB not available, running without cloud sync:', err.message)
  }

  httpServer.listen(PORT, () => {
    console.log(`Smart Notepad backend running on port ${PORT}`)
  })
}

start()

module.exports = app
