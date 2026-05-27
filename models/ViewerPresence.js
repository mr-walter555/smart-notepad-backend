const mongoose = require('mongoose')

const viewerPresenceSchema = new mongoose.Schema({
  shareToken:  { type: String, required: true },
  userId:      { type: String, required: true },
  displayName: { type: String, default: 'Viewer' },
  color:       { type: String, required: true },
  lastSeen:    { type: Date, default: Date.now },
})

viewerPresenceSchema.index({ shareToken: 1, userId: 1 }, { unique: true })
viewerPresenceSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 30 })

module.exports = mongoose.models.ViewerPresence || mongoose.model('ViewerPresence', viewerPresenceSchema)
