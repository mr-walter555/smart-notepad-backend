const router = require('express').Router()

router.get('/', (req, res) => res.json({ message: 'Workspaces stored locally via Electron Store' }))

module.exports = router
