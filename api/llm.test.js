import { afterEach, describe, expect, it, vi } from 'vitest'
import { callLLM } from './llm.js'

const env = { ANTHROPIC_API_KEY: 'test' }
let n = 0
function stubModel() {
  const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ content: [{ text: `reply ${++n}` }] }) }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => vi.unstubAllGlobals())

describe('shared cache in /api/llm', () => {
  it('reuses a cacheable reply for the same prompt and variant', async () => {
    const fetch = stubModel()
    const body = { system: 's', prompt: `exercise ${Math.random()}`, cache: { variant: 0 } }
    const a = await callLLM(body, '', env)
    const b = await callLLM(body, '', env)
    expect(a.data).toMatchObject({ cached: false })
    expect(b.data).toEqual({ text: a.data.text, cached: true })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps variants apart, and fresh requests replace the entry', async () => {
    const fetch = stubModel()
    const prompt = `exercise ${Math.random()}`
    const v0 = await callLLM({ system: 's', prompt, cache: { variant: 0 } }, '', env)
    const v1 = await callLLM({ system: 's', prompt, cache: { variant: 1 } }, '', env)
    expect(v1.data.text).not.toBe(v0.data.text)
    const fresh = await callLLM({ system: 's', prompt, cache: { variant: 0, fresh: true } }, '', env)
    const again = await callLLM({ system: 's', prompt, cache: { variant: 0 } }, '', env)
    expect(again.data).toEqual({ text: fresh.data.text, cached: true })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('never caches requests that are not marked cacheable (gradings, chat)', async () => {
    const fetch = stubModel()
    const body = { system: 's', prompt: `grade ${Math.random()}` }
    await callLLM(body, '', env)
    const b = await callLLM(body, '', env)
    expect(b.data.cached).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('checks the access code before touching the cache or the model', async () => {
    const fetch = stubModel()
    const r = await callLLM({ system: 's', prompt: 'p', cache: { variant: 0 } }, 'wrong', { ...env, STEPWISE_ACCESS_CODE: 'right' })
    expect(r.status).toBe(401)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('access code and the shared cache', () => {
  const locked = { ANTHROPIC_API_KEY: 'test', STEPWISE_ACCESS_CODE: 'secret' }
  it('serves stored replies without the code, but needs it to reach the model', async () => {
    const fetch = stubModel()
    const body = { system: 's', prompt: `starter ${Math.random()}`, cache: { variant: 0 } }
    expect((await callLLM(body, '', locked)).status).toBe(401)
    await callLLM(body, 'secret', locked)
    expect((await callLLM(body, '', locked)).data.cached).toBe(true)
    expect((await callLLM({ ...body, cache: { variant: 0, fresh: true } }, '', locked)).status).toBe(401)
    expect((await callLLM({ system: 's', prompt: 'grade it' }, 'nope', locked)).status).toBe(401)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
