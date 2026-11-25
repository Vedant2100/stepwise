# AI usage

## Tools

- **Claude (claude.ai, with code execution and GitHub access):** research, planning, writing the code, tests and docs, end-to-end testing.
- **Claude (earlier):** built Straight Shot, the project Stepwise inherits from.

## How it helped

- **Positioning and scope:** surveyed existing tools (NotebookLM, Google's Learn Your Way, RemNote, Recall) and the learning-science evidence (Freeman 2014, VanLehn 2011, Bastani 2025, Kestin 2025), then cut the idea down to four task types and four environments.
- **Reuse:** read my earlier repos and identified what to carry over from Straight Shot (test harness, test verification, runner design, SM-2) and what to drop (generated whole-page workspaces, the single-file structure).
- **Implementation:** scaffolded the React/Vite/Tailwind app with current package versions, wrote the learner model, planner, plan validation, the four environments and the serverless proxy.
- **Interface:** after the first version used a generic dashboard, ported Straight Shot's chat-first interface and visual style onto the new engine, and dropped Tailwind for the ported stylesheet.
- **Workspaces:** designed a full-screen workspace per task type (IDE, derivation pad, explain, deck, sandboxed simulation) and the backend each needs.
- **Visual redesign:** after feedback that the interface was too minimal, planned a design system (palette, type, layout) around the idea of a climb, checked it against generic AI-design defaults, built it, then reviewed screenshots in light, dark and mobile and fixed what didn't work (the first staircase read as a list, so it became a drawn staircase).
- **More workspaces:** read & debug, sort & sequence, data notebook and algorithm tracer, each with ground truth from running Python rather than trusting the model.
- **Cost:** designed the shared cache for plans and exercises on Vercel's Runtime Cache (no database), with variants for repeat practice and a fresh-retry path so a bad cached exercise gets replaced.
- **Planner fix from a screenshot:** I showed a case where a 12/100 score still moved on and raised mastery; the agent traced it to the planner order and the learning bonus, and changed both (missed concepts come straight back; mastery never rises on a fail).
- **Accounts and sync:** designed username/password accounts on Upstash Redis with merging per objective (timestamps, deletion tombstones, compare-and-set saves), and a two-browser test to prove it.
- **Product direction:** when I asked how to make people actually want to use it, proposed starter climbs served from the shared cache, progress animations, and shareable climb pages; I chose which to build.
- **Interview room:** I set the constraints (no deadlines, mastery-driven, voice with free tools, no extra writing workspace); the agent designed the environment around the browser's own speech APIs, plus reading long pastes for intent and asking for missing material.
- **Look:** built an optional liquid-glass look and iterated on it from screenshots.
- **Testing:** unit tests for the core logic, and browser tests (now in `e2e/`, run in CI when app code changes) through every workspace, the chat router, accounts across two browsers, sharing, the interview room and Stop, with the model mocked and real Python via Pyodide. Pre-generation of the starter climbs runs the same prompts and Python checks against production.

## Limitations and issues

- **No live model in the build environment** (no API key there), so the end-to-end test used canned model replies. Prompt quality still has to be checked against the real model.
- **CDN blocked in the build sandbox:** the Pyodide CDN was unreachable, so the end-to-end test served Pyodide's files from `node_modules`.
- **A browser change caught by testing:** recent Chrome returns a Promise from `scrollIntoView`, which React rejects when an effect returns it; found in the headless run and fixed.
- **Bugs found by end-to-end tests:** pressing Enter to flip a card also clicked the newly focused “I had it” button, inflating scores; the simulation sandbox's content policy also blocked running the model's compute function, so nothing drew. Both fixed.
- **Found by checking against the real model:** Haiku sometimes defined its own `trace()` (now stripped before running), used `float('inf')`, which isn't valid JSON (now converted), and once rejected its own expected step (the step checker now accepts equivalent answers). Exercise generation also retries once when verification fails.
- **Test selectors:** the first end-to-end runs failed on ambiguous selectors, not app bugs; they were fixed in the test script.
- **Races found only in CI:** the sidebar showed “Synced” for one frame after a change; the faster local machine hid it, the CI runner caught it. The status is now derived during render. A test also typed the next step before the previous check finished; it now waits.
- **A crash the tests caught:** the interview room read past the last question before checking it was finished, leaving a blank screen. Fixed.
- **Design misses I had to point out:** sign-in first appeared as a message in the chat instead of its own screen; a long pasted request was treated as notes; the first “glass” was a frosted wash rather than liquid glass. Each was redone after feedback.
- **Stale tests:** after the redesign one browser test still checked old text; it was rewritten for the current interface rather than deleted.
- **Pre-generation isn't perfect:** each run stores about 97% of starter exercises; the rest return malformed JSON from the model and are generated on first use. Any prompt change invalidates the stored entries, so the workflow has to be re-run.
- **Review against the course's list of agent shortcomings:** no helpers used only once, error handling only at boundaries (model output, imported files, the API route), small commits, `npm audit` clean, and no secrets in the repo (`.env` is gitignored).
