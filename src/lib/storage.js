const KEY = 'stepwise.v1'

export function load() {
  try {
    return parseData(localStorage.getItem(KEY) ?? '{"tracks":[]}')
  } catch {
    return { tracks: [] }
  }
}

export const save = (data) => localStorage.setItem(KEY, JSON.stringify(data))

const isNum = (x) => typeof x === 'number' && Number.isFinite(x)
const validConcept = (c) =>
  typeof c?.id === 'string' && typeof c.name === 'string' && typeof c.type === 'string' &&
  Array.isArray(c.prereqs) && isNum(c.pL) && c.pL >= 0 && c.pL <= 1 && isNum(c.attempts) &&
  (c.review === null || (isNum(c.review?.due) && isNum(c.review.interval) && isNum(c.review.ease) && isNum(c.review.reps)))

// Used for localStorage and for imported files, so it checks the full shape.
export function parseData(text) {
  const data = JSON.parse(text)
  const ok = Array.isArray(data?.tracks) && data.tracks.every((t) =>
    typeof t.id === 'string' && typeof t.objective === 'string' && typeof t.title === 'string' &&
    typeof t.source === 'string' && Array.isArray(t.log) && Array.isArray(t.concepts) && t.concepts.every(validConcept))
  if (!ok) throw new Error('This file is not a Stepwise export.')
  return { tracks: data.tracks }
}

export function download(data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `stepwise-${new Date().toISOString().slice(0, 10)}.json` })
  a.click()
  URL.revokeObjectURL(url)
}
