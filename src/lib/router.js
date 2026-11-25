import { ENVIRONMENTS } from './planner.js'

export const ACTIONS = {
  learn: 'they want to learn something new ("topic" = their objective, with every detail they gave)',
  adjust: 'they want to change the current climb: skip a kind of practice, refocus, drop or add concepts ("topic" = the change, in their words)',
  next: 'move on / give me something to practice',
  skip: 'skip the current exercise',
  switch: 'redo the current exercise in another environment ("env")',
  progress: 'they ask what they are learning, how they are doing, or what is due',
  focus: 'they want to practice a specific objective now ("trackId")',
  delete: 'they explicitly ask to remove an objective ("trackId")',
  help: 'they ask about or answer the current exercise; help Socratically in "say", never give the full solution',
  chat: 'greetings, thanks, small talk, questions about Stepwise or anything else',
}

export const SUGGESTIONS = { next: 'Next exercise', progress: 'How am I doing?', new: 'Start something new', review: 'Review now' }

export const routeSystem = (tracks, current) => `You are the learner's personal teacher inside Stepwise: warm, brief and direct, in plain words.
Greet back when greeted. Answer questions. Keep replies to 1-3 sentences, and end with one concrete next step when there is one.
Stepwise turns a goal into a climb of concepts, each practiced in a workspace, and tracks mastery with spaced reviews.
OBJECTIVES: ${JSON.stringify(tracks.map((t) => ({ id: t.id, title: t.title, objective: t.objective, mastered: t.concepts.filter((c) => c.pL >= 0.95).length, of: t.concepts.length })))}
CURRENT EXERCISE: ${current ? JSON.stringify({ concept: current.concept.name, env: current.env, exercise: current.exercise }).slice(0, 4000) : 'none'}
ENVIRONMENTS: ${JSON.stringify(Object.fromEntries(Object.entries(ENVIRONMENTS).map(([k, v]) => [k, v.label])))}
For each message, pick ONE action:
${Object.entries(ACTIONS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
"suggest" lists 0-3 next steps worth offering as buttons, from: ${Object.keys(SUGGESTIONS).join(', ')}. Offer none when the action already does it.
Reply with JSON only: {"action":"","say":"","topic":"","env":"","trackId":"","suggest":[]}`

export const routePrompt = (text) => `LEARNER SAYS: """${text}"""`

export function normalizeRoute(r, tracks) {
  const action = Object.hasOwn(ACTIONS, r?.action) ? r.action : 'chat'
  return {
    action,
    say: typeof r?.say === 'string' ? r.say : '',
    topic: typeof r?.topic === 'string' ? r.topic.trim() : '',
    env: Object.hasOwn(ENVIRONMENTS, r?.env) ? r.env : null,
    trackId: tracks.some((t) => t.id === r?.trackId) ? r.trackId : null,
    suggest: (Array.isArray(r?.suggest) ? r.suggest : []).filter((k) => Object.hasOwn(SUGGESTIONS, k)).slice(0, 3),
  }
}
