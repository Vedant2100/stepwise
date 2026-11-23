export const ACCESS_KEY = 'stepwise.access'

export function parseJSON(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('The model did not return JSON.')
  return JSON.parse(text.slice(start, end + 1))
}

export async function ask(system, prompt) {
  const res = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-access-code': localStorage.getItem(ACCESS_KEY) ?? '' },
    body: JSON.stringify({ system, prompt }),
  })
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data.error), { status: res.status })
  return parseJSON(data.text)
}
