const router = require('express').Router()
const { processText, detectTasks, generateInsights } = require('../services/aiService')

function friendlyError(err) {
  const status = err.status ?? err.response?.status
  if (status === 429) return { code: 429, message: 'OpenAI quota exceeded — add credits at platform.openai.com/billing' }
  if (status === 401 || err.message?.includes('API key')) return { code: 401, message: 'Invalid OpenAI API key' }
  return { code: 500, message: err.message || 'AI request failed' }
}

router.post('/process', async (req, res) => {
  try {
    const { action, text } = req.body
    if (!action || !text?.trim()) {
      return res.status(400).json({ error: 'action and text are required' })
    }
    const result = await processText(action, text)
    res.json({ result })
  } catch (err) {
    const { code, message } = friendlyError(err)
    res.status(code).json({ error: message })
  }
})

router.post('/detect-tasks', async (req, res) => {
  try {
    const { content } = req.body
    if (!content) return res.status(400).json({ error: 'content required' })
    const result = await detectTasks(content)
    res.json(result)
  } catch (err) {
    const { code, message } = friendlyError(err)
    res.status(code).json({ error: message })
  }
})

router.post('/insights', async (req, res) => {
  try {
    const { content } = req.body
    if (!content) return res.status(400).json({ error: 'content required' })
    const result = await generateInsights(content)
    res.json(result || {})
  } catch (err) {
    const { code, message } = friendlyError(err)
    res.status(code).json({ error: message })
  }
})

module.exports = router
