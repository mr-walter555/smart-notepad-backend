const mongoose = require('mongoose')

const workspaceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  icon: { type: String, default: '📁' },
  color: { type: String, default: '#6366f1' },
}, { timestamps: true })

module.exports = mongoose.model('Workspace', workspaceSchema)
