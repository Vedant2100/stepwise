import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleIngest } from './ingest.js'
import { createStore } from '../server/store.js'

const env = { ANTHROPIC_API_KEY: 'k', STEPWISE_ACCESS_CODE: 'c' }
const reply = (content) => vi.fn(async () => ({ ok: true, json: async () => ({ content }) }))
afterEach(() => vi.unstubAllGlobals())

describe('ingest', () => {
  it('needs the access code and a valid http(s) link', async () => {
    expect((await handleIngest({ url: 'https://a.com' }, 'x', env, createStore({}))).status).toBe(401)
    expect((await handleIngest({ url: 'file:///etc/passwd' }, 'c', env, createStore({}))).status).toBe(400)
    expect((await handleIngest({ url: 'not a url' }, 'c', env, createStore({}))).status).toBe(400)
  })

  it('returns the fetched page text and caches it per URL', async () => {
    const fetch = reply([{ type: 'web_fetch_tool_result', content: { type: 'web_fetch_result', url: 'https://a.com/x', content: { type: 'document', title: 'X', source: { type: 'text', media_type: 'text/plain', data: 'page text' } } } }])
    vi.stubGlobal('fetch', fetch)
    const store = createStore({})
    const a = await handleIngest({ url: 'https://a.com/x' }, 'c', env, store)
    const b = await handleIngest({ url: 'https://a.com/x' }, 'c', env, store)
    expect(a.data).toEqual({ title: 'X', text: 'page text' })
    expect(b.data).toEqual(a.data)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetch.mock.calls[0][1].body).tools[0].type).toBe('web_fetch_20250910')
  })

  it('explains fetch errors and rejects unsupported images', async () => {
    vi.stubGlobal('fetch', reply([{ type: 'web_fetch_tool_result', content: { type: 'web_fetch_tool_error', error_code: 'url_not_accessible' } }]))
    const r = await handleIngest({ url: 'https://private.example' }, 'c', env, createStore({}))
    expect(r.status).toBe(422)
    expect(r.data.error).toMatch(/couldn’t be opened/)
    expect((await handleIngest({ image: { mediaType: 'image/svg+xml', data: 'x' } }, 'c', env, createStore({}))).status).toBe(400)
  })

  it('turns an image into notes', async () => {
    vi.stubGlobal('fetch', reply([{ type: 'text', text: '# Notes' }]))
    const r = await handleIngest({ image: { mediaType: 'image/png', data: 'aGk=', name: 'board.png' } }, 'c', env, createStore({}))
    expect(r.data).toEqual({ title: 'board.png', text: '# Notes' })
  })
})
