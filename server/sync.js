// Each account stores one document: { version, tracks, deleted }. A save must name the version it was based on;
// if another device saved first, the server answers 409 with its copy and the client merges and retries.
import { validTracks } from '../src/lib/storage.js'

const MAX_BYTES = 1_000_000
const empty = { version: 0, tracks: [], deleted: [] }

export async function load(store, userId) {
  return (await store.get(`data:${userId}`)) ?? empty
}

export async function save(store, userId, body) {
  const { version, tracks, deleted } = body ?? {}
  const okDeleted = Array.isArray(deleted) && deleted.every((d) => typeof d?.id === 'string' && Number.isFinite(d.at))
  if (!Number.isInteger(version) || !validTracks(tracks) || !okDeleted) return { status: 400, data: { error: 'That is not valid Stepwise data.' } }
  if (JSON.stringify(body).length > MAX_BYTES) return { status: 413, data: { error: 'Your saved data is over 1 MB. Delete some objectives or their source text.' } }
  const next = { version: version + 1, tracks, deleted: deleted.slice(-500) }
  if (!(await store.swapIfVersion(`data:${userId}`, version, next))) return { status: 409, data: await load(store, userId) }
  return { status: 200, data: { version: next.version } }
}
