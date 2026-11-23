// Prompts for planning, exercise generation and grading. Every prompt asks for JSON only.

const SOURCE_LIMIT = 15_000

export function system(track) {
  return [
    'You are Stepwise, a strict and brief tutor. Your goal is real mastery, not encouragement.',
    track?.source
      ? 'Ground everything in the SOURCE you are given. Do not teach claims the source does not support.'
      : 'No source material was given, so use well-established, standard knowledge only.',
    'Reply with a single JSON object and nothing else.',
  ].join('\n')
}

const sourceBlock = (source) => (source ? `\nSOURCE:\n<<<\n${source.slice(0, SOURCE_LIMIT)}\n>>>\n` : '')

export const planPrompt = (objective, source) => `The learner's objective: "${objective}"
${sourceBlock(source)}
Break the objective into 3–12 concepts the learner must master, ordered so every concept comes after its prerequisites.
Label each with ONE task type:
- "concept": understanding an idea (why/what it means)
- "procedure": carrying out steps (a derivation, a calculation, an algorithm by hand)
- "skill": doing it in code
- "recall": remembering facts, terms, vocabulary
- "intuition": getting a feel for how something behaves as its inputs change (best explored with sliders); use only when a small numeric model captures it
${source ? 'For each concept, copy a short exact quote (5–25 words) from the SOURCE that supports it.' : ''}
Return: {"title":"short title","concepts":[{"id":"kebab-id","name":"","type":"concept|procedure|skill|recall|intuition","summary":"one sentence","prereqs":["ids of earlier concepts"]${source ? ',"quote":"exact words from the source"' : ''}}]}`

const SHAPES = {
  explain: `an explain-it-back question. Return: {"question":"","rubric":["3–5 key points a full answer must contain"],"reference":"model answer, markdown"}`,
  steps: `a worked problem the learner solves one step at a time. Return: {"problem":"markdown","steps":[{"expected":"what this step should produce","hint":"a nudge, not the answer"}]} with 3–7 steps`,
  code: `a Python coding exercise using only the standard library. Return: {"brief":"task, markdown, with the function signature","starter":"starter code with the signature and a pass body","reference":"full correct solution","hints":["2–3 nudges, mildest first"],"tests":[{"name":"short name","code":"assert statements calling the function"}]} with 4–8 tests including edge cases`,
  drill: `a retrieval drill. Return: {"cards":[{"front":"prompt","back":"short exact answer"}]} with 4–8 cards`,
  sim: `an interactive simulation the learner explores with sliders, then predict-and-check questions. "compute" is the BODY of a plain JavaScript function of one argument p (an object of the parameter values) that returns {"labels":[strings],"values":[finite numbers]} (at most 24 bars). Use only Math and plain JS: no DOM, network, or globals. Return: {"intro":"one or two sentences, markdown","params":[{"name":"jsIdentifier","label":"","min":0,"max":1,"step":0.1,"value":0.5}],"compute":"...","chart":"what the bars show","questions":[{"ask":"a prediction to make by moving a slider","answer":"what actually happens and why"}]} with 1–4 params and 2–4 questions`,
}

export function exercisePrompt(env, concept, track, mode) {
  const level = concept.pL < 0.3 ? 'introductory' : concept.pL < 0.7 ? 'intermediate' : 'challenging'
  return `Objective: "${track.objective}"
Concept: ${concept.name} (${concept.type}) — ${concept.summary}
${concept.quote ? `Supporting quote: "${concept.quote}"` : ''}
${sourceBlock(track.source)}
${mode === 'review' ? 'This is a short spaced review of a concept the learner already mastered.' : `Difficulty: ${level}.`}
Write ${SHAPES[env]}`
}

export const gradeExplainPrompt = (exercise, answer) => `Question: ${exercise.question}
Rubric: ${JSON.stringify(exercise.rubric)}
Learner's answer: """${answer}"""
Grade strictly against the rubric, point by point, in the rubric's order. Return: {"score":0-100,"verdict":"one line","points":[{"met":true|false,"note":"short reason"}]}`

export const checkStepPrompt = (exercise, index, done, answer) => `Problem: ${exercise.problem}
Steps completed so far: ${JSON.stringify(done)}
Step ${index + 1} should produce: ${exercise.steps[index].expected}
Learner's step: """${answer}"""
Is the learner's step correct and equivalent to the expected step (notation may differ)? Return: {"ok":true|false,"feedback":"one sentence; if wrong, say what is off without giving the answer"}`
