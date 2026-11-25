const KEY = 'stepwise.v1'

export function load() {
  const fresh = { tracks: [], deleted: [], sync: { version: 0, username: null } }
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!raw) return fresh
    return {
      tracks: parseData(JSON.stringify(raw)).tracks,
      deleted: Array.isArray(raw.deleted) ? raw.deleted.filter((d) => typeof d?.id === 'string' && isNum(d.at)) : [],
      sync: { version: Number.isInteger(raw.sync?.version) ? raw.sync.version : 0, username: typeof raw.sync?.username === 'string' ? raw.sync.username : null },
    }
  } catch {
    return fresh
  }
}

export const save = (data) => localStorage.setItem(KEY, JSON.stringify(data))

const isNum = (x) => typeof x === 'number' && Number.isFinite(x)
const validConcept = (c) =>
  typeof c?.id === 'string' && typeof c.name === 'string' && typeof c.type === 'string' &&
  Array.isArray(c.prereqs) && isNum(c.pL) && c.pL >= 0 && c.pL <= 1 && isNum(c.attempts) &&
  (c.review === null || (isNum(c.review?.due) && isNum(c.review.interval) && isNum(c.review.ease) && isNum(c.review.reps)))

export const validTracks = (tracks) =>
  Array.isArray(tracks) && tracks.every((t) =>
    typeof t?.id === 'string' && typeof t.objective === 'string' && typeof t.title === 'string' &&
    typeof t.source === 'string' && Array.isArray(t.log) && Array.isArray(t.concepts) && t.concepts.every(validConcept) &&
    (t.updatedAt === undefined || isNum(t.updatedAt)))

export function parseData(text) {
  const data = JSON.parse(text)
  if (!validTracks(data?.tracks)) throw new Error('This file is not a Stepwise export.')
  return { tracks: data.tracks }
}

export function download(data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ tracks: data.tracks }, null, 2)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `stepwise-${new Date().toISOString().slice(0, 10)}.json` })
  a.click()
  URL.revokeObjectURL(url)
}
