import { describe, expect, it } from 'vitest'
import { createStore } from './store.js'
import { handleAuth } from '../api/auth.js'
import { handleData } from '../api/data.js'

const track = (id, extra = {}) => ({ id, objective: 'o', title: id, source: '', log: [], concepts: [], updatedAt: 1, ...extra })
const cookieOf = (r) => `sw_session=${r.token}`

describe('accounts', () => {
  it('registers, signs in and out, and never stores the password', async () => {
    const db = createStore({})
    const reg = await handleAuth({ method: 'POST', body: { action: 'register', username: 'Vedant', password: 'correct horse' } }, db)
    expect(reg).toMatchObject({ status: 200, data: { username: 'vedant' } })
    expect(JSON.stringify(await db.get('user:vedant'))).not.toContain('correct horse')
    expect((await handleAuth({ method: 'GET', cookie: cookieOf(reg) }, db)).data.username).toBe('vedant')

    const out = await handleAuth({ method: 'POST', body: { action: 'logout' }, cookie: cookieOf(reg) }, db)
    expect(out.token).toBe('')
    expect((await handleAuth({ method: 'GET', cookie: cookieOf(reg) }, db)).data.username).toBeNull()

    const back = await handleAuth({ method: 'POST', body: { action: 'login', username: 'vedant', password: 'correct horse' } }, db)
    expect(back.status).toBe(200)
  })

  it('rejects taken usernames, weak input and wrong passwords, and rate-limits guessing', async () => {
    const db = createStore({})
    const body = { action: 'register', username: 'sam', password: 'longenough' }
    await handleAuth({ method: 'POST', body }, db)
    expect((await handleAuth({ method: 'POST', body }, db)).status).toBe(409)
    expect((await handleAuth({ method: 'POST', body: { ...body, username: 'x' } }, db)).status).toBe(400)
    expect((await handleAuth({ method: 'POST', body: { ...body, username: 'new', password: 'short' } }, db)).status).toBe(400)
    const wrong = { action: 'login', username: 'sam', password: 'wrongwrong' }
    for (let i = 0; i < 5; i++) expect((await handleAuth({ method: 'POST', body: wrong }, db)).status).toBe(401)
    expect((await handleAuth({ method: 'POST', body: { ...wrong, password: 'longenough' } }, db)).status).toBe(429)
  })

  it('ignores forged or malformed session cookies', async () => {
    const db = createStore({})
    for (const cookie of ['sw_session=abc', `sw_session=${'0'.repeat(64)}`, 'other=1'])
      expect((await handleAuth({ method: 'GET', cookie }, db)).data.username).toBeNull()
  })
})

describe('synced data', () => {
  async function signedIn(db, username) {
    const r = await handleAuth({ method: 'POST', body: { action: 'register', username, password: 'longenough' } }, db)
    return cookieOf(r)
  }

  it('requires a session and keeps each user’s data separate', async () => {
    const db = createStore({})
    expect((await handleData({ method: 'GET', cookie: '' }, db)).status).toBe(401)
    const a = await signedIn(db, 'alice')
    const b = await signedIn(db, 'bob')
    await handleData({ method: 'PUT', cookie: a, body: { version: 0, tracks: [track('t1')], deleted: [] } }, db)
    expect((await handleData({ method: 'GET', cookie: a }, db)).data.tracks).toHaveLength(1)
    expect((await handleData({ method: 'GET', cookie: b }, db)).data.tracks).toHaveLength(0)
  })

  it('answers 409 with the newer copy when another device saved first', async () => {
    const db = createStore({})
    const c = await signedIn(db, 'carol')
    expect((await handleData({ method: 'PUT', cookie: c, body: { version: 0, tracks: [track('t1')], deleted: [] } }, db)).data.version).toBe(1)
    const stale = await handleData({ method: 'PUT', cookie: c, body: { version: 0, tracks: [], deleted: [] } }, db)
    expect(stale.status).toBe(409)
    expect(stale.data).toMatchObject({ version: 1, tracks: [{ id: 't1' }] })
  })

  it('rejects malformed data', async () => {
    const db = createStore({})
    const c = await signedIn(db, 'dave')
    for (const body of [{ version: 0, tracks: [{ id: 1 }], deleted: [] }, { version: 'x', tracks: [], deleted: [] }, { version: 0, tracks: [], deleted: [{ id: 'x' }] }])
      expect((await handleData({ method: 'PUT', cookie: c, body }, db)).status).toBe(400)
  })
})

describe('shared climbs', async () => {
  const { handleShare, cleanShare } = await import('./share.js')
  const { createStore } = await import('./store.js')
  const concepts = [{ id: 'a', name: 'A', type: 'recall', summary: 's', prereqs: [], pL: 0.5, attempts: 3, misses: 1 }, { id: 'b', name: 'B', type: 'concept', prereqs: ['a'], pL: 0.1 }]
  const climb = { title: 'T', objective: 'o', concepts, startedAt: 1, source: 'private notes', log: [{ answer: 'secret' }] }

  it('publishes only whitelisted fields and serves them back', async () => {
    const db = createStore({})
    const { status, data } = await handleShare({ method: 'POST', body: climb, ip: '1.1.1.1' }, db)
    expect(status).toBe(200)
    expect(data.id).toMatch(/^[A-Za-z0-9]{10}$/)
    const got = await handleShare({ method: 'GET', query: { id: data.id } }, db)
    expect(JSON.stringify(got.data)).not.toMatch(/private notes|secret|attempts|misses/)
    expect(got.data.concepts.map((c) => c.name)).toEqual(['A', 'B'])
  })

  it('rejects bad shapes, bad ids, and too many links from one IP', async () => {
    const db = createStore({})
    expect(cleanShare({ ...climb, concepts: [{ ...concepts[1], prereqs: ['zzz'] }] })).toBeNull()
    expect(cleanShare({ ...climb, concepts: [{ ...concepts[0], type: 'virus' }] })).toBeNull()
    expect((await handleShare({ method: 'GET', query: { id: '../etc' } }, db)).status).toBe(400)
    expect((await handleShare({ method: 'GET', query: { id: 'AAAAAAAAAA' } }, db)).status).toBe(404)
    for (let i = 0; i < 20; i++) await handleShare({ method: 'POST', body: climb, ip: '2.2.2.2' }, db)
    expect((await handleShare({ method: 'POST', body: climb, ip: '2.2.2.2' }, db)).status).toBe(429)
    expect((await handleShare({ method: 'POST', body: climb, ip: '3.3.3.3' }, db)).status).toBe(200)
  })
})
