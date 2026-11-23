export const ACCESS_KEY = 'stepwise.access'
const TIMEOUT_MS = 90_000
const inflight = new Set()

export function parseJSON(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('The model did not return JSON.')
  return JSON.parse(text.slice(start, end + 1))
}

// Cancels every model call in progress (the Stop button).
export const stopAll = () => inflight.forEach((c) => c.abort())

export async function ask(system, prompt) {
  const stop = new AbortController()
  inflight.add(stop)
  try {
    const res = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-access-code': localStorage.getItem(ACCESS_KEY) ?? '' },
      body: JSON.stringify({ system, prompt }),
      signal: AbortSignal.any([stop.signal, AbortSignal.timeout(TIMEOUT_MS)]),
    })
    const data = await res.json()
    if (!res.ok) throw Object.assign(new Error(data.error), { status: res.status })
    return parseJSON(data.text)
  } catch (e) {
    if (e.name === 'TimeoutError') throw new Error('The model took too long to answer. Try again.')
    if (e.name === 'AbortError') throw Object.assign(new Error('Stopped.'), { stopped: true })
    throw e
  } finally {
    inflight.delete(stop)
  }
}
