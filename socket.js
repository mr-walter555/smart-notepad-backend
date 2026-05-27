const { Server } = require('socket.io')
const store = require('./services/shareStore')

// rooms: { [shareToken]: { [userId]: { userId, displayName, color, socketId } } }
const rooms = {}

const COLORS = ['#e67e22','#2ecc71','#3498db','#9b59b6','#e74c3c','#1abc9c','#f39c12','#e91e63']
let colorIdx = 0
function nextColor() { return COLORS[colorIdx++ % COLORS.length] }

// Debounced autosave per token
const saveTimers = {}
function scheduleSave(shareToken, content, title) {
  clearTimeout(saveTimers[shareToken])
  saveTimers[shareToken] = setTimeout(() => {
    const share = store.get(shareToken)
    if (share) {
      store.set(shareToken, { ...share, content, title, updatedAt: new Date().toISOString() })
    }
  }, 1500)
}

function init(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  })

  io.on('connection', (socket) => {

    // ── Join a document room ──────────────────────────────────────────
    socket.on('join', ({ shareToken, userId, displayName }) => {
      if (!shareToken || !userId) return

      socket.join(shareToken)

      if (!rooms[shareToken]) rooms[shareToken] = {}
      rooms[shareToken][userId] = {
        userId,
        displayName: displayName || 'Guest',
        color: nextColor(),
        socketId: socket.id,
      }

      // Send current document content to the joining user
      const share = store.get(shareToken)
      if (share) {
        socket.emit('init', { content: share.content, title: share.title })
      }

      // Broadcast updated user list to room
      io.to(shareToken).emit('users', Object.values(rooms[shareToken]))

      // Notify others someone joined
      socket.to(shareToken).emit('user:joined', rooms[shareToken][userId])

      // Tag socket so we can clean up on disconnect
      socket.data = { ...(socket.data || {}), shareToken, userId }
    })

    // ── Leave a room ──────────────────────────────────────────────────
    socket.on('leave', ({ shareToken, userId }) => {
      socket.leave(shareToken)
      if (rooms[shareToken]) {
        delete rooms[shareToken][userId]
        if (Object.keys(rooms[shareToken]).length === 0) delete rooms[shareToken]
        else io.to(shareToken).emit('users', Object.values(rooms[shareToken]))
      }
      socket.to(shareToken).emit('user:left', { userId })
    })

    // ── Document content change ───────────────────────────────────────
    socket.on('change', ({ shareToken, content, title, userId }) => {
      socket.to(shareToken).emit('change', { content, title, userId })
      scheduleSave(shareToken, content, title)
    })

    // ── Cursor / selection position ───────────────────────────────────
    socket.on('cursor', ({ shareToken, userId, from, to }) => {
      const user = rooms[shareToken]?.[userId]
      socket.to(shareToken).emit('cursor', { userId, from, to, displayName: user?.displayName, color: user?.color })
    })

    // ── New comment (broadcast to room) ──────────────────────────────
    socket.on('comment:add', ({ shareToken, comment }) => {
      io.to(shareToken).emit('comment:new', comment)
    })

    // ── Disconnect cleanup ────────────────────────────────────────────
    socket.on('disconnect', () => {
      const { shareToken, userId } = socket.data || {}
      if (!shareToken || !userId) return
      if (rooms[shareToken]) {
        delete rooms[shareToken][userId]
        if (Object.keys(rooms[shareToken]).length === 0) delete rooms[shareToken]
        else io.to(shareToken).emit('users', Object.values(rooms[shareToken]))
      }
      socket.to(shareToken).emit('user:left', { userId })
    })
  })

  return io
}

module.exports = { init }
