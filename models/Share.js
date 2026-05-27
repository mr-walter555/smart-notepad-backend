const mongoose = require('mongoose')

const shareSchema = new mongoose.Schema({
  token:     { type: String, required: true, unique: true, index: true },
  noteId:    { type: String, required: true },
  title:     { type: String, default: 'Untitled' },
  content:   { type: String, default: '' },
  comments:  { type: Array, default: [] },
}, { timestamps: true })

module.exports = mongoose.models.Share || mongoose.model('Share', shareSchema)
