import { sharedStore } from '../server/store.js'
import { getSession } from '../server/auth.js'
import { vercel } from '../server/http.js'
import { load, save } from '../server/sync.js'

const store = sharedStore()

export async function handleData({ method, body, cookie }, db = store) {
  const s = await getSession(db, cookie)
  if (!s) return { status: 401, data: { error: 'Sign in to sync your progress.' } }
  if (method === 'GET') return { status: 200, data: await load(db, s.userId) }
  if (method === 'PUT') return save(db, s.userId, body)
  return { status: 405, data: { error: 'GET or PUT only.' } }
}

export default vercel((r) => handleData(r))
