import { describe, expect, it } from 'vitest'
import { BKT, MASTERED, recordAttempt, schedule, updateMastery } from './learner.js'
import { envFor, nextStep } from './planner.js'
import { validatePlan } from './plan.js'
import { parseJSON } from './llm.js'

const DAY = 86_400_000
const concept = (id, extra = {}) => ({ id, name: id, type: 'concept', prereqs: [], pL: BKT.init, attempts: 0, review: null, ...extra })

describe('learner model', () => {
  it('raises mastery on correct answers and lowers it on wrong ones', () => {
    expect(updateMastery(0.5, true)).toBeGreaterThan(0.5)
    expect(updateMastery(0.5, false)).toBeLessThan(0.5)
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
    expect([envFor('concept'), envFor('procedure'), envFor('skill'), envFor('recall')]).toEqual(['explain', 'steps', 'code', 'drill'])
  })

  it('only offers concepts whose prerequisites are mastered', () => {
    const cs = [concept('a', { pL: 0.5 }), concept('b', { prereqs: ['a'], pL: 0.05 })]
    expect(nextStep(cs, 0).concept.id).toBe('a')
    cs[0].pL = 0.99
    expect(nextStep(cs, 0).concept.id).toBe('b')
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
    expect(normalizeRoute({ action: 'switch', env: 'code', trackId: 't1', say: 'ok' }, tracks))
      .toEqual({ action: 'switch', env: 'code', trackId: 't1', say: 'ok', topic: '' })
  })

  it('turns unknown actions into chat and drops ids and environments that do not exist', () => {
    expect(normalizeRoute({ action: 'hack', env: 'ide', trackId: 'nope' }, tracks))
      .toMatchObject({ action: 'chat', env: null, trackId: null })
    expect(normalizeRoute(null, tracks).action).toBe('chat')
    expect(normalizeRoute({ action: 'toString' }, tracks).action).toBe('chat')
  })
})
