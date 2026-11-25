const SOURCE_LIMIT = 15_000

export function system(track) {
  return [
    'You are Stepwise, a strict and brief tutor. Your goal is real mastery, not encouragement.',
    track?.source
      ? 'Ground everything in the SOURCE you are given. Do not teach claims the source does not support.'
      : 'No source material was given, so use well-established, standard knowledge only.',
    ...(track?.context ? ["The learner's own material is the source of truth about them and their goal. Never contradict it or make up details it doesn't contain."] : []),
    'Reply with a single JSON object and nothing else.',
  ].join('\n')
}

const sourceBlock = (source) => (source ? `\nSOURCE:\n<<<\n${source.slice(0, SOURCE_LIMIT)}\n>>>\n` : '')
const contextBlock = (context) => (context ? `\nTHE LEARNER'S OWN MATERIAL (source of truth about them and their goal: use these facts exactly as given, never contradict them, and never invent facts about the learner such as experience, numbers, dates, names or companies; if something you need is missing, ask the learner instead of guessing):\n<<<\n${context.slice(0, SOURCE_LIMIT)}\n>>>\n` : '')
export const readPastePrompt = (text) => `A learner pasted this message into a learning app:
<<<
${text.slice(0, SOURCE_LIMIT)}
>>>
Decide what it is.
- "notes": material to learn from (an article, lecture notes, documentation), with no instructions about what they want.
- "request": they describe what they want to learn or prepare for (it may include their background).
If it is a request, state their objective in one sentence, in their terms. Also list anything the message says is attached or included but is not actually in the message (for example "my resume" or "the two job descriptions"); list nothing if all is present.
Return: {"kind":"notes|request","objective":"one sentence, or empty for notes","missing":["short names"]}`

export const planPrompt = (objective, source, context) => `The learner's objective: "${objective}"
${sourceBlock(source)}${contextBlock(context)}
Break the objective into 3–12 concepts the learner must master, ordered so every concept comes after its prerequisites.
Label each with ONE task type:
- "concept": understanding an idea (why/what it means)
- "procedure": carrying out steps (a derivation, a calculation, an algorithm by hand)
- "skill": doing it in code
- "recall": remembering facts, terms, vocabulary
- "intuition": getting a feel for how something behaves as its inputs change (best explored with sliders); use only when a small numeric model captures it
- "reading": reading code: predicting what it prints, spotting and fixing bugs
- "ordering": putting steps in the right order, or sorting items into categories
- "data": exploring data or numerical results in Python with numpy, pandas or matplotlib
- "interview": answering interview questions out loud (telling their own background and stories, explaining why they want a role, explaining a technical topic clearly under time pressure)
- "algorithm": tracing how a specific algorithm or data structure changes state step by step (sorting, searching, graph traversal, dynamic programming), and its complexity
${source ? 'For each concept, copy a short exact quote (5–25 words) from the SOURCE that supports it.' : ''}
Return: {"title":"short title","concepts":[{"id":"kebab-id","name":"","type":"concept|procedure|skill|recall|intuition|reading|ordering|data|algorithm|interview","summary":"one sentence","prereqs":["ids of earlier concepts"]${source ? ',"quote":"exact words from the source"' : ''}}]}`

export const adjustPrompt = (track, change) => `${planPrompt(track.objective, track.source, track.context)}

The learner already has this plan: ${JSON.stringify(track.concepts.map((c) => ({ id: c.id, name: c.name, type: c.type, mastered: c.pL >= 0.95 })))}
They asked to change it: """${change}"""
Revise the plan to do what they asked. Keep concepts that still fit, with their exact ids; drop ones that no longer fit; add what is missing. Return the full revised plan in the same JSON format.`

const SHAPES = {
  explain: `an explain-it-back question. Return: {"question":"","rubric":["3–5 key points a full answer must contain"],"reference":"model answer, markdown"}`,
  steps: `a worked problem the learner solves one step at a time. Return: {"problem":"markdown","steps":[{"expected":"what this step should produce","hint":"a nudge, not the answer"}]} with 3–7 steps`,
  code: `a Python coding exercise using only the standard library. Return: {"brief":"task, markdown, with the function signature","starter":"starter code with the signature and a pass body","reference":"full correct solution","hints":["2–3 nudges, mildest first"],"tests":[{"name":"short name","code":"assert statements calling the function"}]} with 4–8 tests including edge cases`,
  drill: `a retrieval drill. Return: {"cards":[{"front":"prompt","back":"short exact answer"}]} with 4–8 cards`,
  readcode: `a code-reading exercise in Python (standard library only). Part 1: 3–4 short snippets (under 15 lines) whose printed output the learner must predict; each must print something and must not read input. Part 2: one function with a single realistic bug, plus tests that the fixed version passes and the buggy version fails. Return: {"snippets":[{"code":"","ask":"one line, e.g. What does this print?"}],"debug":{"brief":"markdown: what the function should do","buggy":"code with exactly one bug","reference":"the fixed code","tests":[{"name":"","code":"assert ..."}]}}`,
  sort: `a sorting exercise. Either "order" (put items in the correct sequence) or "buckets" (sort items into 2–4 named categories). Items are short phrases, 5–9 of them, all different. Return either {"mode":"order","prompt":"","items":["in the correct order"],"why":"one or two sentences on the logic of the order"} or {"mode":"buckets","prompt":"","buckets":[{"name":"","items":[""]}],"why":""}`,
  notebook: `a small data-exploration notebook in Python using numpy, pandas and/or matplotlib. Make your own small dataset in the setup code (seeded, no files or network). Each task asks the learner to compute or plot something and store it in a named variable; its check is hidden assert code that reads that variable. Return: {"intro":"markdown","setup":"code that creates the data","tasks":[{"ask":"markdown; name the variable to create","solution":"reference code for this task","check":"assert ..."}]} with 2–4 tasks`,
  trace: `an algorithm-tracing exercise. Write a short Python implementation (standard library only, under 30 lines) that runs on a small fixed input and calls trace(name=value, ...) after each meaningful step, recording 1–3 simple state variables (lists, numbers, strings; e.g. the array after each swap, or the queue and visited set as a list). Use 4–12 trace calls in total. The code must run the algorithm on the input at the top level (call the function; no __main__ guard), so trace() fires when the file is executed as is. trace() is provided by the runtime: do not define or import it. Then 2 multiple-choice questions on complexity or behavior. Return: {"brief":"markdown: the algorithm and what each traced variable means","code":"the implementation including the input and the trace() calls","questions":[{"ask":"","choices":["",""],"answer":0,"why":""}]}`,
  interview: `a mock interview round on this concept, asked out loud one question at a time, by the kind of interviewer who would really ask it. Use what you know about the learner to make the questions specific to them; never assume facts about them they haven't given. Return: {"role":"who is asking, e.g. Recruiter or Hiring manager","questions":[{"ask":"the question, as spoken","seconds":60,"strong":["3–5 things a strong answer does or covers"],"followup":"a probing follow-up to ask if the answer is weak"}]} with 2–4 questions; seconds is the target answer length (30–150)`,
  sim: `an interactive simulation the learner explores with sliders, then predict-and-check questions. "compute" is the BODY of a plain JavaScript function of one argument p (an object of the parameter values) that returns {"labels":[strings],"values":[finite numbers]} (at most 24 bars). Use only Math and plain JS: no DOM, network, or globals. Return: {"intro":"one or two sentences, markdown","params":[{"name":"jsIdentifier","label":"","min":0,"max":1,"step":0.1,"value":0.5}],"compute":"...","chart":"what the bars show","questions":[{"ask":"a prediction to make by moving a slider","answer":"what actually happens and why"}]} with 1–4 params and 2–4 questions`,
}

export function exercisePrompt(env, concept, track, mode) {
  const level = concept.pL < 0.3 ? 'introductory' : concept.pL < 0.7 ? 'intermediate' : 'challenging'
  return `Objective: "${track.objective}"
Concept: ${concept.name} (${concept.type}) — ${concept.summary}
${concept.quote ? `Supporting quote: "${concept.quote}"` : ''}
${sourceBlock(track.source)}${contextBlock(track.context)}
${mode === 'review' ? 'This is a short spaced review of a concept the learner already mastered.' : `Difficulty: ${level}.`}
Write ${SHAPES[env]}`
}

export const gradeExplainPrompt = (exercise, answer) => `Question: ${exercise.question}
Rubric: ${JSON.stringify(exercise.rubric)}
Learner's answer: """${answer}"""
Grade strictly against the rubric, point by point, in the rubric's order. Return: {"score":0-100,"verdict":"one line","points":[{"met":true|false,"note":"short reason"}]}`

export const gradeInterviewPrompt = (question, strong, answer, target, took) => `Mock interview question: ${question}
A strong answer: ${JSON.stringify(strong)}
Target length: ${target} seconds. The learner took ${took} seconds.
Their answer (spoken and transcribed, so ignore filler words and transcription slips): """${answer}"""
Grade it as the interviewer would: content, structure, specifics, and fit to the time.
"tighter" rewrites THEIR answer in their own voice and words, keeping only facts they actually said (never add facts about them), short enough to say in the target time.
Return: {"score":0-100,"verdict":"one line","weak":"the main weakness, one or two sentences","missing":["what a strong answer had that theirs didn't"],"tighter":"the tighter spoken version"}`

export const checkStepPrompt = (exercise, index, done, answer) => `Problem: ${exercise.problem}
Steps completed so far: ${JSON.stringify(done)}
Step ${index + 1} should produce: ${exercise.steps[index].expected}
Learner's step: """${answer}"""
Is the learner's step correct and equivalent in substance to the expected step? Accept different notation, wording, rounding, or a shorter answer that gives the key result; reject only if it is wrong or answers a different step. Return: {"ok":true|false,"feedback":"one sentence; if wrong, say what is off without giving the answer"}`
