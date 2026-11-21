# Instinct — Thesis (v0)

## One line

Given a technical source and a goal, Instinct decides **what to practice next and in which form**, and builds that small practice space from the source alone.

## The problem

Tools like NotebookLM and Google's Learn Your Way can already turn a document into summaries, quizzes, flashcards and audio. What they leave to the learner is the hard part: deciding what to work on next and how. Most of their output is also passive or answer-based (read it, listen to it, pick an option).

The research is consistent on two points:

- Active practice beats passive exposure (Freeman et al. 2014, PNAS: +0.47 SD on exams, and failure rates of 21.8% vs 33.8%).
- Feedback at each step beats feedback on the final answer only (VanLehn 2011: step-based tutors d ≈ 0.76, answer-based d ≈ 0.31).

It also gives one warning: AI help without guardrails raises scores during practice and lowers them once the help is removed (Bastani et al. 2025, PNAS: −17% on the unassisted exam).

## Hypothesis

> For a technical paper, a planner that picks the next concept and the right **step-based** exercise for it, using a running estimate of what the learner knows, produces better **unassisted, delayed** performance than (a) chatting with an LLM over the paper or (b) a fixed set of generated study materials.

If this is false, we want to know, and the project still counts as a result.

## Scope: what we build

Deliberately small.

1. **One domain:** ML / CS papers (text and LaTeX math). No video, no blogs yet.
2. **Ingestion:** paper → list of concepts with prerequisite edges, where **every concept is tied to a span of the source**. Nothing is taught that can't be traced back to the paper.
3. **Learner model:** a mastery estimate per concept (start with simple Bayesian Knowledge Tracing or Elo), updated after each attempt and saved between sessions.
4. **Three primitives only:**
   - **Explain-back / Recall:** a free-text answer, graded against the source span.
   - **Derivation step:** fill in or check the next line of an equation.
   - **Implement:** write a small function that has to pass hidden tests.
5. **Planner:** rules first. Pick the weakest concept whose prerequisites are mastered, then pick the primitive by concept type (math → derivation, algorithm → implement, idea → recall). Make it smarter only if the rules fall short.
6. **Guardrails:** never show the answer before an attempt; give hints step by step.
7. **UI:** one page showing one exercise at a time. No dashboard.

## Non-goals (for now)

- Simulations, concept-map UI, an IDE, multi-document research workspaces.
- Feeds, notifications or habit loops (the retention question is real, but it isn't this project's).
- Learning the learner's preferred style; multi-user accounts; mobile.
- Generating new kinds of interface. The primitives are fixed; only their content is generated.

## Evaluation

- **Conditions:** (A) LLM chat over the paper, (B) fixed generated materials (summary + quiz), (C) Instinct.
- **Material:** 2–3 papers, with each participant given a different one per condition (within-subjects, counterbalanced).
- **Participants:** about 6–12 people (classmates). Small, and that will be stated plainly.
- **Measures, all unassisted:**
  - immediate post-test
  - transfer questions not seen during practice
  - delayed post-test after about 1 week
- **Secondary measures:** time on task, grounding errors (claims not supported by the source), and how often the planner's choice of exercise looked wrong to a human rater.

## Milestones

1. Ingestion + concept graph for one paper, with grounding checked by hand.
2. The three primitives working end to end on that paper.
3. Learner model + rule-based planner; works across sessions.
4. Baselines A and B; test questions written.
5. Run the study; write up the results.

## Main risks

- **Generated exercises are wrong or trivial.** Mitigation: tie each exercise to its source span; hand-check a sample.
- **The grader is unreliable for explain-back.** Mitigation: grade against a rubric drawn from the source; check agreement with a human grader.
- **The sample is too small to show an effect.** Mitigation: report effect sizes and per-person results; treat the study as a pilot.

## Related work to position against

- Google, *Towards an AI-Augmented Textbook* / Learn Your Way (2025): several representations of the content, but the learner picks the format.
- NotebookLM: flashcards, quizzes, Learning Guide; progress saved per notebook.
- PAL, Personal Adaptive Learner (2026): adapts within a single session, from lecture video.
- Kestin et al. 2025, *Scientific Reports*: a hand-built AI tutor that beat an active-learning classroom.
- Bastani et al. 2025, *PNAS*: AI without guardrails harms learning.
- VanLehn 2011; Freeman et al. 2014.

What we add: **automatic choice of the next step-based exercise, driven by a learner model that persists across sessions**, measured on delayed, unassisted performance.
