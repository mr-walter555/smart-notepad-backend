const OpenAI = require('openai')

let client = null

function getClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured')
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

const SYSTEM_PROMPT = 'You are a helpful writing assistant integrated into a note-taking application. Be concise and precise. Return only the transformed text without explanation unless asked.'

const ACTION_PROMPTS = {
  summarize: 'Summarize the following text concisely, capturing the key points:\n\n',
  rewrite: 'Rewrite the following text in a clear, professional tone while preserving all information:\n\n',
  grammar: 'Fix all grammar, spelling, and punctuation errors in the following text. Return only the corrected text:\n\n',
  bullets: 'Convert the following text into a clean, well-organized bullet-point list:\n\n',
  actions: 'Extract all action items and tasks from the following text as a numbered list. If none exist, state "No action items found.":\n\n',
  expand: 'Expand the following text with more detail, examples, and elaboration:\n\n',
  simplify: 'Simplify the following text to be clearer and easier to understand:\n\n',
}

async function processText(action, text) {
  const openai = getClient()
  const prompt = ACTION_PROMPTS[action]
  if (!prompt) throw new Error(`Unknown AI action: ${action}`)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt + text },
    ],
    max_tokens: 1000,
    temperature: 0.7,
  })

  return response.choices[0]?.message?.content?.trim() || ''
}

async function detectTasks(content) {
  const openai = getClient()
  const stripped = content.replace(/<[^>]+>/g, ' ').trim()
  if (!stripped) return { tasks: [], reminders: [] }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Extract tasks and reminders from notes. Return JSON only.' },
      {
        role: 'user',
        content: `Analyze this note and extract: 1) action items/tasks, 2) dates/reminders mentioned. Return JSON: {"tasks": ["task1"], "reminders": [{"text": "...", "date": "..."}]}\n\nNote: ${stripped}`,
      },
    ],
    max_tokens: 500,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })

  try {
    return JSON.parse(response.choices[0]?.message?.content || '{}')
  } catch {
    return { tasks: [], reminders: [] }
  }
}

async function generateInsights(content) {
  const openai = getClient()
  const stripped = content.replace(/<[^>]+>/g, ' ').trim()
  if (stripped.length < 50) return null

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Analyze notes and provide brief insights. Return JSON only.' },
      {
        role: 'user',
        content: `Analyze this note. Return JSON: {"summary": "1-2 sentence summary", "sentiment": "positive|neutral|negative", "topics": ["topic1", "topic2"], "suggestions": ["suggestion"]}\n\nNote: ${stripped.slice(0, 2000)}`,
      },
    ],
    max_tokens: 300,
    temperature: 0.5,
    response_format: { type: 'json_object' },
  })

  try {
    return JSON.parse(response.choices[0]?.message?.content || 'null')
  } catch {
    return null
  }
}

module.exports = { processText, detectTasks, generateInsights }
