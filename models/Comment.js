const mongoose = require('mongoose')

const commentSchema = new mongoose.Schema({
  shareToken:   { type: String, required: true, index: true },
  userId:       { type: String, required: true },
  displayName:  { type: String, default: 'Anonymous' },
  body:         { type: String, required: true },
  selectedText: { type: String, default: '' },
  range:        { from: Number, to: Number },
}, { timestamps: true })

module.exports = mongoose.model('Comment', commentSchema)
