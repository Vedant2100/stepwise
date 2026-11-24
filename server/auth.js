// Accounts and sessions. Passwords: scrypt with a random salt, compared in constant time.
// Sessions: a random token in an HttpOnly, Secure, SameSite=Lax cookie, looked up in the store (30 days).
// Sign-in failures are rate limited per username (5 per 15 minutes).
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb)
const SESSION_TTL = 60 * 60 * 24 * 30
const FAIL_LIMIT = 5
const FAIL_WINDOW = 60 * 15
export const COOKIE = 'sw_session'

const USERNAME = /^[a-z0-9_-]{3,32}$/

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  const [, salt, hex] = stored.split('$')
  const want = Buffer.from(hex, 'hex')
  const got = await scrypt(password, Buffer.from(salt, 'hex'), want.length)
  return timingSafeEqual(got, want)
}

const err = (status, error) => ({ status, data: { error } })

function checkCredentials(body) {
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!USERNAME.test(username)) return { error: err(400, 'Usernames are 3–32 characters: lowercase letters, numbers, - and _.') }
  if (password.length < 8 || password.length > 200) return { error: err(400, 'Passwords need at least 8 characters.') }
  return { username, password }
}

export function readCookie(header = '', name = COOKIE) {
  const part = header.split(/;\s*/).find((p) => p.startsWith(`${name}=`))
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null
}

export const sessionCookie = (token, secure = true) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? SESSION_TTL : 0}${secure ? '; Secure' : ''}`

async function startSession(store, user) {
  const token = randomBytes(32).toString('hex')
  await store.set(`session:${token}`, { userId: user.id, username: user.username }, { ttl: SESSION_TTL })
  return { status: 200, data: { username: user.username }, token }
}

export async function getSession(store, cookieHeader) {
  const token = readCookie(cookieHeader)
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null
  const s = await store.get(`session:${token}`)
  return s ? { ...s, token } : null
}

export async function register(store, body) {
  const c = checkCredentials(body)
  if (c.error) return c.error
  const user = { id: randomBytes(12).toString('hex'), username: c.username, hash: await hashPassword(c.password), createdAt: Date.now() }
  if (!(await store.set(`user:${c.username}`, user, { nx: true }))) return err(409, 'That username is taken.')
  return startSession(store, user)
}

export async function login(store, body) {
  const c = checkCredentials(body)
  if (c.error) return err(401, 'Wrong username or password.')
  const failKey = `fail:${c.username}`
  if (((await store.get(failKey)) ?? 0) >= FAIL_LIMIT) return err(429, 'Too many failed attempts. Try again in 15 minutes.')
  const user = await store.get(`user:${c.username}`)
  if (!user || !(await verifyPassword(c.password, user.hash))) {
    await store.incr(failKey, FAIL_WINDOW)
    return err(401, 'Wrong username or password.')
  }
  await store.del(failKey)
  return startSession(store, user)
}

export async function logout(store, cookieHeader) {
  const s = await getSession(store, cookieHeader)
  if (s) await store.del(`session:${s.token}`)
  return { status: 200, data: { ok: true }, token: '' }
}
