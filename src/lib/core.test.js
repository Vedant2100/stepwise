import { describe, expect, it } from 'vitest'
import { BKT, MASTERED, recordAttempt, schedule, updateMastery } from './learner.js'
import { TASK_TYPES, envFor, nextStep } from './planner.js'
import { validatePlan } from './plan.js'
import { parseJSON } from './llm.js'

const DAY = 86_400_000
const concept = (id, extra = {}) => ({ id, name: id, type: 'concept', prereqs: [], pL: BKT.init, attempts: 0, review: null, ...extra })

describe('learner model', () => {
  it('raises mastery on correct answers and lowers it on wrong ones, from any starting point', () => {
    for (const p of [0.1, 0.5, 0.9]) {
      expect(updateMastery(p, true)).toBeGreaterThan(p)
      expect(updateMastery(p, false)).toBeLessThan(p)
    }
  })

  it('reaches mastery after a few correct answers and then schedules a review', () => {
    let c = concept('a')
    for (let i = 0; i < 3; i++) c = recordAttempt(c, 90, 0)
    expect(c.pL).toBeGreaterThanOrEqual(MASTERED)
    expect(c.review.due).toBe(DAY)
    expect(c.attempts).toBe(3)
  })

  it('spaces reviews out on success and resets on failure', () => {
    let r = schedule(null, 100, 0)
    r = schedule(r, 100, 0)
    expect(r.interval).toBe(6)
    r = schedule(r, 100, 0)
    expect(r.interval).toBeGreaterThan(6)
    expect(schedule(r, 20, 0)).toMatchObject({ reps: 0, interval: 1 })
  })
})

describe('planner', () => {
  it('maps each task type to one environment', () => {
    expect(TASK_TYPES.map(envFor)).toEqual(['explain', 'steps', 'code', 'drill', 'sim', 'readcode', 'sort', 'notebook', 'trace', 'interview', 'absorb'])
  })

  it('only offers concepts whose prerequisites are mastered', () => {
    const cs = [concept('a', { pL: 0.5 }), concept('b', { prereqs: ['a'], pL: 0.05 })]
    expect(nextStep(cs, 0).concept.id).toBe('a')
    cs[0].pL = 0.99
    expect(nextStep(cs, 0).concept.id).toBe('b')
  })

  it('follows the climb in order and retries a missed concept instead of jumping to a fresh one', () => {
    let a = recordAttempt(concept('a'), 12, 0)
    const cs = [a, concept('b')]
    expect(a.pL).toBeLessThan(BKT.init)
    expect(nextStep(cs, 0).concept.id).toBe('a')
  })

  it('after a pass moves on to new concepts, then returns to passed-but-unmastered ones', () => {
    const a = recordAttempt(concept('a'), 85, 0)
    expect(nextStep([a, concept('b')], 0).concept.id).toBe('b')
    expect(nextStep([a, concept('b', { pL: 0.99 })], 0).concept.id).toBe('a')
  })

  it('moves on after three misses in a row, and comes back when nothing else is left', () => {
    let a = concept('a')
    for (let i = 0; i < 3; i++) a = recordAttempt(a, 10, 0)
    expect(nextStep([a, concept('b')], 0).concept.id).toBe('b')
    expect(nextStep([a, concept('b', { pL: 0.99 })], 0).concept.id).toBe('a')
    expect(recordAttempt(a, 90, 0).misses).toBe(0)
  })

  it('puts due reviews first', () => {
    const cs = [concept('a'), concept('b', { pL: 0.99, review: { due: 5 } })]
    expect(nextStep(cs, 10)).toMatchObject({ mode: 'review', concept: { id: 'b' } })
    expect(nextStep(cs, 1)).toMatchObject({ mode: 'learn', concept: { id: 'a' } })
  })

  it('returns null when everything is mastered and nothing is due', () => {
    expect(nextStep([concept('a', { pL: 0.99, review: { due: 100 } })], 0)).toBeNull()
  })
})

describe('plan validation', () => {
  const source = 'Attention computes a weighted sum of values.\nWeights come from a softmax over scaled dot products.'

  it('keeps valid concepts, drops bad types and forward or unknown prerequisites', () => {
    const plan = validatePlan({
      title: 'Attention',
      concepts: [
        { id: 'dot', name: 'Dot products', type: 'concept', prereqs: ['softmax'], quote: 'scaled dot products' },
        { id: 'softmax', name: 'Softmax', type: 'procedure', prereqs: ['dot', 'ghost'], quote: 'not in the text' },
        { id: 'x', name: 'Bad', type: 'vibes' },
      ],
    }, source)
    expect(plan.concepts.map((c) => c.id)).toEqual(['dot', 'softmax'])
    expect(plan.concepts[0].prereqs).toEqual([])
    expect(plan.concepts[1].prereqs).toEqual(['dot'])
    expect(plan.concepts.map((c) => c.grounded)).toEqual([true, false])
  })

  it('marks grounding as not applicable without a source and de-duplicates ids', () => {
    const plan = validatePlan({ concepts: [{ name: 'A', type: 'recall' }, { name: 'A', type: 'recall' }] }, '')
    expect(plan.concepts.map((c) => c.id)).toEqual(['a', 'a-2'])
    expect(plan.concepts[0].grounded).toBeNull()
  })

  it('rejects an empty plan', () => {
    expect(() => validatePlan({ concepts: [] }, '')).toThrow()
  })
})

describe('parseJSON', () => {
  it('extracts JSON wrapped in prose or code fences', () => {
    expect(parseJSON('Here:\n```json\n{"a": {"b": 1}}\n```')).toEqual({ a: { b: 1 } })
    expect(() => parseJSON('no json')).toThrow()
  })
})

describe('router', async () => {
  const { normalizeRoute } = await import('./router.js')
  const tracks = [{ id: 't1' }]

  it('keeps valid choices', () => {
    expect(normalizeRoute({ action: 'switch', env: 'code', trackId: 't1', say: 'ok', suggest: ['progress', 'hack'] }, tracks))
      .toEqual({ action: 'switch', env: 'code', trackId: 't1', say: 'ok', topic: '', suggest: ['progress'] })
  })

  it('turns unknown actions into chat and drops ids and environments that do not exist', () => {
    expect(normalizeRoute({ action: 'hack', env: 'ide', trackId: 'nope' }, tracks))
      .toMatchObject({ action: 'chat', env: null, trackId: null })
    expect(normalizeRoute(null, tracks).action).toBe('chat')
    expect(normalizeRoute({ action: 'toString' }, tracks).action).toBe('chat')
  })
})

describe('local step check', async () => {
  const { sameStep } = await import('./stepcheck.js')
  it('matches up to spacing, case and math delimiters', () => {
    expect(sameStep('$x^2 + 1$', 'x^2+1')).toBe(true)
    expect(sameStep('Quisiera.', 'quisiera')).toBe(true)
    expect(sameStep('x^2', 'x^3')).toBe(false)
    expect(sameStep('  ', '')).toBe(false)
  })
})

describe('simulation sandbox page', async () => {
  const { simPage } = await import('./simframe.js')
  const sim = { params: [{ name: 't', label: 'T', min: 0, max: 1, step: 0.1, value: 0.5 }], compute: 'return {values:[p.t], labels:["</script><b>x"]}' }

  it('blocks network access and cannot be broken out of by the model code', () => {
    const page = simPage(sim, false)
    expect(page).toContain("default-src 'none'")
    expect(page.match(/<\/script>/g)).toHaveLength(1)
  })
})

describe('exercise shape checks', async () => {
  const { VALID } = await import('./exercise.js')
  it('accepts well-formed sort exercises and rejects duplicates or missing buckets', () => {
    expect(VALID.sort({ mode: 'order', prompt: 'p', items: ['a', 'b', 'c'] })).toBe(true)
    expect(VALID.sort({ mode: 'order', prompt: 'p', items: ['a', 'a', 'c'] })).toBe(false)
    expect(VALID.sort({ mode: 'buckets', prompt: 'p', buckets: [{ name: 'x', items: ['a'] }] })).toBe(false)
  })
  it('rejects trace questions whose answer index is out of range', () => {
    expect(VALID.trace({ code: 'x', questions: [{ ask: 'q', choices: ['a', 'b'], answer: 1 }] })).toBe(true)
    expect(VALID.trace({ code: 'x', questions: [{ ask: 'q', choices: ['a', 'b'], answer: 2 }] })).toBe(false)
  })
})

describe('sync merge', async () => {
  const { merge } = await import('./sync.js')
  const t = (id, updatedAt, title = id) => ({ id, title, updatedAt, createdAt: updatedAt })

  it('keeps the newer copy of each objective and everything only one side has', () => {
    const m = merge({ tracks: [t('a', 5, 'old'), t('b', 1)], deleted: [] }, { tracks: [t('a', 9, 'new'), t('c', 2)], deleted: [] })
    expect(m.tracks.map((x) => [x.id, x.title])).toEqual([['a', 'new'], ['c', 'c'], ['b', 'b']])
  })

  it('applies deletions unless the objective changed after it was deleted', () => {
    const m = merge({ tracks: [t('a', 5), t('b', 20)], deleted: [] }, { tracks: [], deleted: [{ id: 'a', at: 10 }, { id: 'b', at: 10 }] })
    expect(m.tracks.map((x) => x.id)).toEqual(['b'])
    expect(m.deleted).toEqual(expect.arrayContaining([{ id: 'a', at: 10 }]))
  })
})

describe('daily climb', async () => {
  const { today } = await import('./daily.js')
  const D = 86_400_000
  const now = new Date(2026, 10, 24, 18).getTime()
  const track = (log, concepts = []) => ({ log, concepts })

  it('sets a goal from due reviews plus one new step, between 3 and 8', () => {
    const due = Array.from({ length: 4 }, () => ({ review: { due: now - 1 } }))
    expect(today([track([], due)], now).goal).toBe(5)
    expect(today([track([])], now).goal).toBe(3)
    expect(today([track([], Array(20).fill({ review: { due: 0 } }))], now).goal).toBe(8)
  })

  it('counts a streak of consecutive days, and today still counts before you practice', () => {
    const at = (daysAgo) => ({ at: now - daysAgo * D, mode: 'learn' })
    expect(today([track([at(1), at(2), at(3), at(5)])], now).streak).toBe(3)
    expect(today([track([at(0), at(1)])], now).streak).toBe(2)
    expect(today([track([at(2)])], now).streak).toBe(0)
    expect(today([track([at(0), at(0)])], now).done).toBe(2)
  })
})

describe('adjusting a climb', async () => {
  const { mergePlan } = await import('./plan.js')
  it('keeps progress on concepts that stay and starts new ones fresh', () => {
    const old = [{ id: 'a', name: 'A', pL: 0.97, attempts: 4, misses: 0, review: { due: 1, interval: 1, ease: 2.5, reps: 1 } }, { id: 'b', name: 'B', pL: 0.4, attempts: 1 }]
    const revised = [{ id: 'a', name: 'A, refocused', type: 'interview', pL: 0.1, attempts: 0, review: null, prereqs: [] }, { id: 'c', name: 'C', type: 'interview', pL: 0.1, attempts: 0, review: null, prereqs: ['a'] }]
    const m = mergePlan(old, revised)
    expect(m[0]).toMatchObject({ id: 'a', name: 'A, refocused', type: 'interview', pL: 0.97, attempts: 4 })
    expect(m[1]).toMatchObject({ id: 'c', pL: 0.1, attempts: 0 })
    expect(m.map((c) => c.id)).toEqual(['a', 'c'])
  })
})

describe('reading lists', async () => {
  const { isReadingList, pickArticles, findUrls } = await import('./readinglist.js')
  const exportFile = `LINK EXPORT
Source: browser storage
Entries: 6

TRAIN

1. Some notebook - Colab
https://colab.research.google.com/github/a/b/c.ipynb

2. A good post
https://example.com/post?utm_source=chatgpt.com

3. Someone on X
https://x.com/someone/status/1

4. Another post
https://blog.example.org/2026/11/01/idea.html

5. A good post
https://example.com/post#intro

6. Research Engineer @ Somewhere
https://jobs.ashbyhq.com/somewhere/123/application`

  it('recognises an export with titles above links as a reading list, not plain notes', () => {
    expect(isReadingList(exportFile)).toBe(true)
    expect(isReadingList('A paragraph of notes that cites https://a.com once.\nMore notes here.\nAnd more.')).toBe(false)
  })

  it('drops duplicates (ignoring tracking and anchors) and links that are not articles', () => {
    const { articles, skipped } = pickArticles(findUrls(exportFile))
    expect(articles).toEqual(['https://example.com/post?utm_source=chatgpt.com', 'https://blog.example.org/2026/11/01/idea.html'])
    expect(skipped).toBe(3)
  })
})
