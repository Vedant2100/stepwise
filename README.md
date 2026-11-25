# Stepwise

Give it an objective, like "understand and implement attention" or "learn Spanish travel phrases", and optionally some source material. Stepwise breaks the objective into concepts, labels what kind of learning each one takes, and gives you one exercise at a time in the environment that fits:

| Task type | Environment | What you do |
|---|---|---|
| Concept | **Explain it back** | Explain the idea; it's graded against a rubric, with what you missed |
| Procedure | **Step workspace** | Work a problem one step at a time; each step is checked |
| Skill | **Code sandbox** | Write Python in the browser against tests that were checked against a reference solution |
| Recall | **Retrieval drill** | Answer cards from memory |
| Intuition | **Simulation** | Move sliders on a live model, then predict-and-check |
| Code reading | **Read & debug** | Predict what snippets print, then fix a bug until the tests pass |
| Ordering | **Sort & sequence** | Drag steps into order, or sort items into categories |
| Data | **Data notebook** | Python cells with numpy, pandas and matplotlib; hidden checks on your variables |
| Algorithm | **Algorithm tracer** | Predict the state after each step of a real run, then complexity questions |
| Interview | **Interview room** | Questions read aloud; answer out loud (live transcript) against a timer; each answer graded with what was weak, what was missing and a tighter version in your words; weak answers get one follow-up |

A learner model tracks how well you know each concept and picks what comes next. Concepts open up once their prerequisites are mastered, and mastered concepts come back for spaced reviews.

CS205 (UCR, Fall 2026) final project. It builds on [Straight Shot](https://github.com/Vedant2100/straightshot), my earlier single-file tutor; see [Lineage](#lineage).

## Features

- **Chat-first teacher** (ported from Straight Shot): one conversation is the whole interface. Type an objective, paste notes or a request (the model decides which a long paste is; if a request mentions things that aren't there, like a resume, Stepwise asks for them first) or attach a `.txt`/`.md` file; say “next”, “skip”, “switch to code”, “how am I doing?” or ask about the exercise. A model-based router picks the action, and its choice is validated before anything runs. Starting an exercise opens a full-screen workspace for its task type; “← Chat” minimises it without losing your work.
- **Objective → concept plan:** the model proposes 3–12 concepts in prerequisite order, each with a task type. The plan is validated before use: unknown types are dropped, and prerequisites may only point to earlier concepts, so the graph can't loop.
- **Shared cache, so the model isn't paid twice:** plans and exercises don't depend on who asks, so `/api/llm` stores them in Vercel's Runtime Cache under a hash of model, prompt and variant, and serves them to every later user (30-day TTL). Repeat practice on a concept rotates through 3 variants. If a cached exercise fails verification, the retry bypasses the cache and replaces it. Gradings and chat depend on your own words and are never cached. No database needed.
- **Starter climbs:** five ready-made objectives whose plans and first exercises are pre-generated into the shared cache (`scripts/warm.mjs`, run by the *Warm starter climbs* workflow). Cached replies are served without the access code, so a first-time visitor can start one immediately; anything that reaches the model still needs the code.
- **Accounts and sync:** optional username/password accounts (scrypt hashes, HttpOnly session cookie, rate-limited sign-in) with progress stored in Upstash Redis. Each objective carries an `updatedAt`, deletions leave tombstones, and saves use a versioned compare-and-set, so two devices merge per objective instead of overwriting each other.
- **Shareable climbs:** a public read-only page (`/c/<id>`) showing a climb's concepts and progress, with “Start this climb” to begin your own copy. Only the plan and progress are published, never notes, answers or the username.
- **Stop and timeouts:** every model call has a 90-second limit, and a Stop button cancels one in progress.
- **Grounding check:** with source material, every concept must quote the source, and the quote is checked against it word for word. Concepts whose quote isn't found are flagged.
- **Environment chosen per concept,** with a recommended default and a manual override. Each attempt logs which environment was recommended and which was used.
- **Learner model:** Bayesian Knowledge Tracing per concept (mastery at 95%); the learning bonus applies only to correct answers, so a failed attempt never raises mastery. Then SM-2 spaced reviews.
- **Planner:** due reviews first. Then, among concepts whose prerequisites are mastered: a concept you just missed comes straight back (with a different exercise), then new concepts in climb order, then ones you've passed but not mastered. After three misses in a row a concept waits until last. You can also pick any concept yourself.
- **Workspaces, each with its own backend:**
  - *Code IDE:* task and hints, editor, tests and console side by side; tests rerun as you type; ⌘/Ctrl+Enter runs.
  - *Derivation pad:* math renders as you type (KaTeX); steps that match the expected step are accepted locally without a model call; scratchpad.
  - *Explain:* writing pad with word count; the rubric ticks off point by point after grading, with the matching source passage.
  - *Deck:* progress strip, streaks, keyboard (Enter flips, 1 missed, 2 had it).
  - *Read & debug:* the expected output of each snippet comes from actually running it; snippets that error are dropped; the bug-fix part is kept only if its tests pass on the fixed code and fail on the buggy one.
  - *Sort & sequence:* drag and drop, with arrow buttons and click-to-place for keyboard users.
  - *Data notebook:* cells share one Python namespace; numpy/pandas/matplotlib load on demand; plots render as images; hidden checks run against a copy of your variables; tasks whose checks fail on their own solution are removed.
  - *Algorithm tracer:* the generated implementation runs once with a `trace()` hook that records the state at each step; you predict each state (Python literal syntax accepted) and are checked against the real run.
  - *Simulation:* the model writes only a small compute function. It runs in an iframe sandboxed with `allow-scripts` only (no access to Stepwise's storage or cookies) and a CSP that blocks all network requests; Stepwise's own code draws the sliders and chart.
- **Code sandbox runner:** CodeMirror editor; Python runs in a Web Worker via Pyodide; infinite loops are stopped and the runner restarts. Generated tests that the hidden reference solution fails are removed before you see them.
- **Guardrails against over-relying on help:** hints come one at a time; a step can only be revealed after a wrong try; the code solution unlocks only after a run, and revealing it caps the score at 50.
- **Progress:** mastery bars, prerequisite locks, review dates and recent practice per objective.
- **Data:** saved in your browser; export to and import from JSON, with the file's structure checked on import.
- **Design:** an ascent. A pine sidebar lists your objectives and draws each climb as a staircase: every concept is a step, marigold fills it with mastery, and a flag marks what's next. Bricolage Grotesque for headings, Atkinson Hyperlegible Next for reading, JetBrains Mono for code, all self-hosted. Light and dark themes; responsive down to phones.

## Setup

```bash
npm install
cp .env.example .env   # add ANTHROPIC_API_KEY
npm run dev            # http://localhost:5173
npm test               # unit tests (learner model, planner, plan validation)
npm run build
```

Browser tests (`e2e/`) drive the real app in Chromium with the model mocked, covering every workspace, the chat router, accounts and sync across two browsers, sharing, the interview room and the Stop button. They run in GitHub Actions when app code changes (not for styling- or docs-only changes); locally:

```bash
pip install playwright && python -m playwright install chromium
npx vite --port 5179 &   # then:
e2e/run.sh
```

The API key is read only by `api/llm.js` on the server, in local development and on Vercel alike. It is never sent to the browser.

## Deploy

Live at https://stepwise-topaz-nine.vercel.app. Vercel's GitHub integration deploys every push to `main`; GitHub Actions (`.github/workflows/checks.yml`) runs the tests, `npm audit` and the build on every push and pull request.

Secrets live in GitHub (Settings → Secrets → Actions) alongside `VERCEL_TOKEN`. The manual **Sync secrets to Vercel** workflow copies them into the Vercel project, and the manual **Smoke test production** workflow checks that the site is public, that a real model call works and that a wrong access code is refused.

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Used only by the `/api/llm` function |
| `STEPWISE_ACCESS_CODE` | recommended | If set, users enter it under Settings before the app calls the model, so strangers can't spend your key |
| `STEPWISE_MODEL` | no | Model id; defaults to `claude-haiku-5-5`, the cheapest API model |

## Mobile apps

Android and iOS apps are built with Capacitor (`android/`, `ios/`). They load the deployed site, so they always match the web version, with microphone permission for the interview room. The *Mobile apps* workflow builds a debug APK and an iOS simulator app and attaches both to the run as artifacts.

- **Android:** install `stepwise-android/app-debug.apk` on a phone (allow installs from unknown sources) or an emulator.
- **iOS:** unzip `stepwise-ios-simulator.zip` and drag `App.app` onto a running iOS Simulator (Xcode 26+). A real iPhone needs the app signed with an Apple account in Xcode (`npx cap open ios`).

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
│   ├── stepcheck.js   local step matching
│   ├── simframe.js    sandboxed simulation page
│   ├── verify.js      runs generated exercises before you see them
│   ├── harness_run.py run once with trace()
│   ├── harness_cell.py notebook cells
│   ├── harness.py     runs learner code and tests (from Straight Shot)
│   ├── router.js      chat actions, router prompt and validation
│   ├── llm.js         client for /api/llm
│   └── storage.js     localStorage, import/export validation
├── App.jsx            the teacher: feed state and actions
├── envs/              the four environments
└── components/        Sidebar (staircase), Workspace, FeedItem, Composer, Progress, Settings, Icons, Md
api/llm.js             server-side proxy to the Anthropic API
```

## Lineage

Stepwise builds on Straight Shot (Study Loop), which already picked a teaching method per kind of material. From it, Stepwise reuses its chat-first interface and look, the test harness, the verify-tests-against-a-reference idea, the code-runner design (worker, timeout and restart), SM-2 scheduling and the guardrails. What changes: Straight Shot has the model generate a whole custom workspace per subject, while Stepwise keeps four fixed environments and generates only their content. It also replaces the free-text learner note with a per-concept mastery model and a prerequisite graph, and replaces the single 100 KB HTML file with a tested React app.

See [THESIS.md](THESIS.md) for the reasoning and [AI_USAGE.md](AI_USAGE.md) for how AI tools were used.
