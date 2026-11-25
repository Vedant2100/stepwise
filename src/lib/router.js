import { ENVIRONMENTS } from './planner.js'

export const ACTIONS = {
  learn: 'they want to learn something new ("topic" = their objective, with every detail they gave)',
  next: 'move on / give me something to practice',
  skip: 'skip the current exercise',
  switch: 'redo the current exercise in another environment ("env")',
  progress: 'they ask what they are learning, how they are doing, or what is due',
  focus: 'they want to practice a specific objective now ("trackId")',
  delete: 'they explicitly ask to remove an objective ("trackId")',
  help: 'they ask about or answer the current exercise; help Socratically in "say", never give the full solution',
  chat: 'anything else',
}

export const routePrompt = (text, tracks, current) => `You are the learner's personal teacher inside Stepwise: brief and direct. Decide what happens next.
OBJECTIVES: ${JSON.stringify(tracks.map((t) => ({ id: t.id, title: t.title, objective: t.objective })))}
CURRENT EXERCISE: ${current ? JSON.stringify({ concept: current.concept.name, env: current.env, exercise: current.exercise }).slice(0, 4000) : 'none'}
ENVIRONMENTS: ${JSON.stringify(Object.fromEntries(Object.entries(ENVIRONMENTS).map(([k, v]) => [k, v.label])))}
LEARNER SAYS: """${text}"""
Pick ONE action:
${Object.entries(ACTIONS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
Return: {"action":"","say":"1-3 sentences, plain words, or empty","topic":"","env":"","trackId":""}`

export function normalizeRoute(r, tracks) {
  const action = Object.hasOwn(ACTIONS, r?.action) ? r.action : 'chat'
  return {
    action,
    say: typeof r?.say === 'string' ? r.say : '',
    topic: typeof r?.topic === 'string' ? r.topic.trim() : '',
    env: Object.hasOwn(ENVIRONMENTS, r?.env) ? r.env : null,
    trackId: tracks.some((t) => t.id === r?.trackId) ? r.trackId : null,
  }
}
