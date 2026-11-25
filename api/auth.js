import { sharedStore } from '../server/store.js'
import { getSession, login, logout, register } from '../server/auth.js'
import { vercel } from '../server/http.js'

const store = sharedStore()

export async function handleAuth({ method, body, cookie }, db = store) {
  if (method === 'GET') {
    const s = await getSession(db, cookie)
    return { status: 200, data: { username: s?.username ?? null, storage: db.kind } }
  }
  if (method !== 'POST') return { status: 405, data: { error: 'GET or POST only.' } }
  if (body?.action === 'register') return register(db, body)
  if (body?.action === 'login') return login(db, body)
  if (body?.action === 'logout') return logout(db, cookie)
  return { status: 400, data: { error: 'Unknown action.' } }
}

export default vercel((r) => handleAuth(r))
