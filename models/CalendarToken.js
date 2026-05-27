const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  key:          { type: String, default: 'default', unique: true },
  accessToken:  { type: String },
  refreshToken: { type: String },
  expiresAt:    { type: Date },
}, { timestamps: true })

module.exports = mongoose.models.CalendarToken || mongoose.model('CalendarToken', schema)
