const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '../data/shares.json')
const DIR  = path.dirname(FILE)

let cache = null

function load() {
  if (cache) return cache
  try {
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } catch {
    cache = {}
  }
  return cache
}

function save() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(cache, null, 2))
}

module.exports = {
  get(token) {
    return load()[token] || null
  },
  set(token, data) {
    load()
    cache[token] = data
    save()
  },
  delete(token) {
    load()
    delete cache[token]
    save()
  },
  all() {
    return load()
  },
}
