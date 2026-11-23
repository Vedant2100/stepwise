// Serverless proxy to the Anthropic API. The key stays on the server.
// Vercel runs the default export; vite.config.js mounts callLLM for `npm run dev`.

const MAX_CHARS = 60_000

export async function callLLM(body, accessCode, env = process.env) {
  if (env.STEPWISE_ACCESS_CODE && accessCode !== env.STEPWISE_ACCESS_CODE) {
    return { status: 401, data: { error: 'Wrong or missing access code.' } }
  }
  const { system, prompt } = body ?? {}
  if (typeof system !== 'string' || typeof prompt !== 'string' || !prompt.trim()) {
    return { status: 400, data: { error: 'system and prompt must be strings.' } }
  }
  if (system.length + prompt.length > MAX_CHARS) {
    return { status: 413, data: { error: `Request too long (max ${MAX_CHARS} characters).` } }
  }
  if (!env.ANTHROPIC_API_KEY) {
    return { status: 500, data: { error: 'ANTHROPIC_API_KEY is not set on the server.' } }
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.STEPWISE_MODEL || 'claude-haiku-5-5',
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  if (!res.ok) return { status: 502, data: { error: data.error?.message || 'Model request failed.' } }
  return { status: 200, data: { text: data.content.map((c) => c.text ?? '').join('') } }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' })
  const { status, data } = await callLLM(req.body, req.headers['x-access-code'])
  res.status(status).json(data)
}
