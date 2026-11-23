# Stepwise

Give it an objective, like "understand and implement attention" or "learn Spanish travel phrases", and optionally some source material. Stepwise breaks the objective into concepts, labels what kind of learning each one takes, and gives you one exercise at a time in the environment that fits:

| Task type | Environment | What you do |
|---|---|---|
| Concept | **Explain it back** | Explain the idea; it's graded against a rubric, with what you missed |
| Procedure | **Step workspace** | Work a problem one step at a time; each step is checked |
| Skill | **Code sandbox** | Write Python in the browser against tests that were checked against a reference solution |
| Recall | **Retrieval drill** | Answer cards from memory |

A learner model tracks how well you know each concept and picks what comes next. Concepts open up once their prerequisites are mastered, and mastered concepts come back for spaced reviews.

CS205 (UCR, Fall 2026) final project. It builds on [Straight Shot](https://github.com/Vedant2100/straightshot), my earlier single-file tutor; see [Lineage](#lineage).

## Features

- **Objective → concept plan:** the model proposes 3–12 concepts in prerequisite order, each with a task type. The plan is validated before use: unknown types are dropped, and prerequisites may only point to earlier concepts, so the graph can't loop.
- **Grounding check:** with source material, every concept must quote the source, and the quote is checked against it word for word. Concepts whose quote isn't found are flagged.
- **Environment chosen per concept,** with a recommended default and a manual override. Each attempt logs which environment was recommended and which was used.
- **Learner model:** Bayesian Knowledge Tracing per concept (mastery at 95%), then SM-2 spaced reviews.
- **Planner:** due reviews first, then the weakest concept whose prerequisites are all mastered. You can also pick any concept yourself.
- **Code sandbox:** CodeMirror editor; Python runs in a Web Worker via Pyodide; infinite loops are stopped and the runner restarts. Generated tests that the hidden reference solution fails are removed before you see them.
- **Guardrails against over-relying on help:** hints come one at a time; a step can only be revealed after a wrong try; the code solution unlocks only after a run, and revealing it caps the score at 50.
- **Progress:** mastery bars, prerequisite locks, review dates and recent practice per objective.
- **Data:** saved in your browser; export to and import from JSON, with the file's structure checked on import.
- **Dark mode.**

## Setup

```bash
npm install
cp .env.example .env   # add ANTHROPIC_API_KEY
npm run dev            # http://localhost:5173
npm test               # unit tests (learner model, planner, plan validation)
npm run build
```

The API key is read only by `api/llm.js` on the server, in local development and on Vercel alike. It is never sent to the browser.

## Deploy (Vercel)

1. Import the repo in Vercel (framework: Vite).
2. Set `ANTHROPIC_API_KEY` in Project Settings → Environment Variables. Optionally set `STEPWISE_ACCESS_CODE` so strangers can't spend your key; users then enter the code under Settings.
3. Deploy. `api/llm.js` becomes a serverless function at `/api/llm`.

## How it fits together

```
src/
├── lib/
│   ├── planner.js     task types, environments, nextStep()
│   ├── learner.js     BKT mastery + SM-2 reviews
│   ├── plan.js        validates the model's concept plan, grounding check
│   ├── prompts.js     all model prompts
│   ├── exercise.js    generates and validates an exercise for an environment
│   ├── runner.js      Pyodide worker runner + test verification
│   ├── harness.py     runs learner code and tests (from Straight Shot)
│   ├── llm.js         client for /api/llm
│   └── storage.js     localStorage, import/export validation
├── envs/              the four environments
└── components/        Home, TrackView, Settings, Md
api/llm.js             server-side proxy to the Anthropic API
```

## Lineage

Stepwise builds on Straight Shot (Study Loop), which already picked a teaching method per kind of material. From it, Stepwise reuses the test harness, the verify-tests-against-a-reference idea, the code-runner design (worker, timeout and restart), SM-2 scheduling and the guardrails. What changes: Straight Shot has the model generate a whole custom workspace per subject, while Stepwise keeps four fixed environments and generates only their content. It also replaces the free-text learner note with a per-concept mastery model and a prerequisite graph, and replaces the single 100 KB HTML file with a tested React app.

See [THESIS.md](THESIS.md) for the reasoning and [AI_USAGE.md](AI_USAGE.md) for how AI tools were used.
