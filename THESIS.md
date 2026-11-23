# Stepwise — Thesis (v0.2)

> **CS205 note:** the course grades a shipped app (feature depth 30%, breadth 25%, demo 20%, code quality and security 15%, AI usage 10%), not a study. The app below is the deliverable. The evaluation section is a stretch goal, and the app already logs what it would need (recommended vs. used environment, score, time).

## One line

You give Stepwise an **objective** (and optionally source material). It works out the **task type**, then spawns the **environment** that fits it: what you practice, in which form, and what comes next.

## The problem

Learning tools give everyone the same container. NotebookLM and Google's Learn Your Way give you summaries, quizzes, flashcards and audio no matter whether you're trying to understand an idea, derive a result, build something or memorize facts. Chat gives you a text box no matter what. In each case the learner has to work out what kind of practice the goal calls for, and that's the hard part.

The research is consistent on two points:

- Active practice beats passive exposure (Freeman et al. 2014, PNAS: +0.47 SD on exams, and failure rates of 21.8% vs 33.8%).
- Feedback at each step beats feedback on the final answer only (VanLehn 2011: step-based tutors d ≈ 0.76, answer-based d ≈ 0.31).

The best form of practice depends on the task: a derivation needs a place to work the steps, a skill needs a place to do it, and recall needs spaced retrieval. No current tool makes that choice for you.

It also gives one warning: AI help without guardrails raises scores during practice and lowers them once the help is removed (Bastani et al. 2025, PNAS: −17% on the unassisted exam).

## Hypothesis

> Spawning an environment that matches the objective's task type, and adapting within it using a running model of the learner, produces better **unassisted, delayed** performance than (a) a general chat assistant or (b) the same fixed set of generated study materials for every task.

If this is false, we want to know, and the project still counts as a result.

## Core idea

```
objective (+ optional sources)
      │
      ▼
task-type classifier ──► environment selector ──► environment (fixed primitive, generated content)
      ▲                                                  │
      └────────── learner model (mastery, errors) ◄──────┘
```

- **Objective:** what you want to be able to do, e.g. "understand how attention works", "pass a SQL interview", "learn Spanish travel phrases", "implement BFS".
- **Task type:** what kind of learning the objective calls for. This is what decides the environment.
- **Environment:** one of a small, fixed set of primitives. Only the content inside it is generated; the interface never is.

## Scope: what we build

The ambition is in the decision-making. The parts stay small.

1. **Four task types → four environments:**

   | Task type | Example objective | Environment |
   |---|---|---|
   | Conceptual understanding | "Understand attention" | **Explain-back:** you explain it, and it's graded against a rubric |
   | Procedural / derivation | "Derive backprop for a 2-layer net" | **Step workspace:** work it one step at a time, with a check on each step |
   | Skill / implementation | "Implement BFS", "write window-function SQL" | **Code sandbox:** a task with hidden tests |
   | Factual recall | "Spanish travel phrases", "OS syscall names" | **Retrieval drill:** spaced recall prompts |

   An objective can mix types (attention = concept + implementation). The planner chooses which environment to use next.
2. **Inputs:** an objective as text, plus optional sources (PDF, text, URL). With sources, everything taught must trace back to them. Without them, the content is generated and then checked.
3. **Objective → concept plan:** break the objective into concepts with prerequisites, each labeled with its task type.
4. **Learner model:** a mastery estimate per concept (simple BKT or Elo), saved between sessions.
5. **Planner:** rules first. Pick the weakest concept whose prerequisites are mastered, then the environment its task type maps to, then a difficulty level. Make it smarter only if the rules fall short.
6. **Guardrails:** never show the answer before an attempt; give hints step by step.
7. **UI:** one page showing one environment at a time. No dashboard.

## Non-goals (for now)

- More than four environments: no simulations, concept-map UI, full IDE or research workspace.
- Generating new kinds of interface.
- Feeds, notifications or habit loops.
- Learning the learner's preferred style; multiple users; mobile.

## Evaluation

- **Conditions:** (A) general chat assistant, (B) fixed generated materials (summary + quiz) for every objective, (C) Stepwise.
- **Objectives:** 3, one per task-type mix (e.g. one conceptual + derivation, one implementation, one recall), with each participant given a different objective per condition (within-subjects, counterbalanced).
- **Participants:** about 6–12 people. Small, and that will be stated plainly.
- **Measures, all unassisted:**
  - immediate post-test
  - transfer questions not seen during practice
  - delayed post-test after about 1 week
- **Also measured:** how accurately task types are classified, compared with human labels; how often the chosen environment looked wrong to a human rater; time on task; grounding errors.

The key ablation: Stepwise with the **wrong** environment (a random choice instead of the one the task type calls for). This shows whether matching the environment to the task is what helps, rather than just the extra interactivity.

## Milestones

1. Objective → concept plan with task-type labels; check it on about 20 objectives against human labels.
2. The four environments working end to end on one objective each.
3. Learner model + rule-based planner; works across sessions.
4. Baselines A and B, plus the wrong-environment ablation; test questions written.
5. Run the study; write up the results.

## Main risks

- **Task types are misclassified.** Mitigation: a small fixed set of types, labels checked by a human, and the learner can override the choice.
- **Generated content is wrong or trivial.** Mitigation: tie it to the sources when there are any; hand-check a sample.
- **Explain-back grading is unreliable.** Mitigation: a rubric checked against a human grader.
- **The sample is too small to show an effect.** Mitigation: report effect sizes; treat the study as a pilot.

## Related work to position against

- Google, *Towards an AI-Augmented Textbook* / Learn Your Way (2025): several formats, but the learner picks one, and it starts from a document rather than an objective.
- NotebookLM: one set of tools for every task; progress saved per notebook.
- PAL, Personal Adaptive Learner (2026): adapts within a single session, from lecture video.
- Kestin et al. 2025, *Scientific Reports*: a hand-built AI tutor for one course.
- Bastani et al. 2025, *PNAS*: AI without guardrails harms learning.
- VanLehn 2011; Freeman et al. 2014.

What we add: **choosing the environment automatically from the objective and its task type**, adapted by a learner model that persists across sessions, with the matching itself tested by an ablation.
