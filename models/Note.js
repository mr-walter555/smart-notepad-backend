const mongoose = require('mongoose')

const noteSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, default: '' },
  content: { type: String, default: '' },
  tags: [{ type: String }],
  color: { type: String, default: 'default' },
  pinned: { type: Boolean, default: false },
  favorite: { type: Boolean, default: false },
  archived: { type: Boolean, default: false },
  trashed: { type: Boolean, default: false },
  workspaceId: { type: String, default: null },
}, { timestamps: true })

module.exports = mongoose.model('Note', noteSchema)
