// Merging two copies of the saved data (this browser and the account): per objective, the newer
// updatedAt wins; a deletion wins over any copy that wasn't changed after it.
export function merge(a, b) {
  const deleted = new Map()
  for (const d of [...(a.deleted ?? []), ...(b.deleted ?? [])]) deleted.set(d.id, Math.max(deleted.get(d.id) ?? 0, d.at))
  const tracks = new Map()
  for (const t of [...a.tracks, ...b.tracks]) {
    const have = tracks.get(t.id)
    if (!have || (t.updatedAt ?? 0) > (have.updatedAt ?? 0)) tracks.set(t.id, t)
  }
  const kept = [...tracks.values()].filter((t) => !(deleted.has(t.id) && deleted.get(t.id) >= (t.updatedAt ?? 0)))
  kept.sort((x, y) => (y.createdAt ?? 0) - (x.createdAt ?? 0))
  return { tracks: kept, deleted: [...deleted].map(([id, at]) => ({ id, at })).slice(-500) }
}

export async function call(path, method = 'GET', body) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}
