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
- **Testing:** unit tests for the core logic, and a headless-Chrome run through all four environments with the model mocked and real Python running via Pyodide.

## Limitations and issues

- **No live model in the build environment** (no API key there), so the end-to-end test used canned model replies. Prompt quality still has to be checked against the real model.
- **CDN blocked in the build sandbox:** the Pyodide CDN was unreachable, so the end-to-end test served Pyodide's files from `node_modules`.
- **A browser change caught by testing:** recent Chrome returns a Promise from `scrollIntoView`, which React rejects when an effect returns it; found in the headless run and fixed.
- **Bugs found by end-to-end tests:** pressing Enter to flip a card also clicked the newly focused “I had it” button, inflating scores; the simulation sandbox's content policy also blocked running the model's compute function, so nothing drew. Both fixed.
- **Test selectors:** the first end-to-end runs failed on ambiguous selectors, not app bugs; they were fixed in the test script.
- **Review against the course's list of agent shortcomings:** no helpers used only once, error handling only at boundaries (model output, imported files, the API route), small commits, `npm audit` clean, and no secrets in the repo (`.env` is gitignored).
