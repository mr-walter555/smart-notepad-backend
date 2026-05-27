const mongoose = require('mongoose')

const inviteSchema = new mongoose.Schema({
  token:       { type: String, required: true, unique: true },
  noteId:      { type: String, required: true },
  shareToken:  { type: String, required: true },
  email:       { type: String, default: '' },
  permissions: { type: String, enum: ['view', 'edit'], default: 'view' },
  expiresAt:   { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  status:      { type: String, enum: ['pending', 'accepted', 'expired'], default: 'pending' },
}, { timestamps: true })

module.exports = mongoose.model('Invite', inviteSchema)
