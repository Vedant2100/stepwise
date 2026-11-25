import { Redis } from '@upstash/redis'

function memoryStore() {
  const m = new Map()
  const live = (k) => {
    const e = m.get(k)
    if (e && e.exp && e.exp < Date.now()) m.delete(k)
    return m.get(k)
  }
  return {
    kind: 'memory',
    async get(k) { return live(k)?.v ?? null },
    async set(k, v, { ttl, nx } = {}) {
      if (nx && live(k)) return false
      m.set(k, { v: structuredClone(v), exp: ttl ? Date.now() + ttl * 1000 : 0 })
      return true
    },
    async del(k) { m.delete(k) },
    async swapIfVersion(k, expected, next) {
      if ((live(k)?.v?.version ?? 0) !== expected) return false
      m.set(k, { v: structuredClone(next), exp: 0 })
      return true
    },
    async incr(k, ttl) {
      const n = (live(k)?.v ?? 0) + 1
      m.set(k, { v: n, exp: live(k)?.exp || (ttl ? Date.now() + ttl * 1000 : 0) })
      return n
    },
  }
}

const SWAP = `
local cur = redis.call('GET', KEYS[1])
local v = 0
if cur then v = cjson.decode(cur).version end
if v ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1`

function redisStore(redis) {
  return {
    kind: 'redis',
    get: (k) => redis.get(k),
    async set(k, v, { ttl, nx } = {}) {
      const r = await redis.set(k, v, { ...(ttl && { ex: ttl }), ...(nx && { nx: true }) })
      return r === 'OK'
    },
    del: (k) => redis.del(k),
    async swapIfVersion(k, expected, next) {
      const ok = await redis.eval(SWAP, [k], [String(expected), JSON.stringify(next)])
      return ok === 1
    },
    async incr(k, ttl) {
      const n = await redis.incr(k)
      if (n === 1 && ttl) await redis.expire(k, ttl)
      return n
    },
  }
}

export function createStore(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN
  return url && token ? redisStore(new Redis({ url, token })) : memoryStore()
}

let shared
export const sharedStore = () => (shared ??= createStore())
