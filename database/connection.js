const mongoose = require('mongoose')

let isConnected = false

async function connectDB() {
  if (isConnected) return

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set')

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
  isConnected = true
  console.log('MongoDB connected')
}

module.exports = { connectDB }
