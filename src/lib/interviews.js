import { BKT } from './learner.js'

const SEEDS = {
  recruiter: {
    title: 'Recruiter screen',
    concepts: [
      ['intro', 'Tell me about yourself', 'The opener. A 60–90 second story: who you are, the most relevant things you have done, and what you want next. Also asked as "Walk me through your background" or "Walk me through your resume".'],
      ['project', 'Walk me through a project', 'One project told clearly: the problem, your part in it, what you did, and the result, in plain words a non-specialist follows. Also asked as "Tell me about something you are proud of".'],
      ['why-company', 'Why this company?', 'What specifically draws you to this company: its product, its customers, how it works. Shows you looked into it.'],
      ['why-role', 'Why this role, and why now?', 'How the role fits what you have done and where you want to go, and why this is the right time.'],
      ['fit', 'How does your experience fit this job?', 'Matching your experience to what the role needs, with one or two concrete examples, and being honest about gaps.'],
      ['logistics', 'Timeline, location and salary expectations', 'When you can start, relocation or on-site questions, other processes you are in, and how you answer salary expectations.'],
      ['questions', 'What questions do you have for me?', 'Two or three good questions for the recruiter about the team, the role and the next steps.'],
    ],
  },
  behavioral: {
    title: 'Behavioral interview',
    concepts: [
      ['ownership', 'A time you took ownership', 'A STAR story (situation, task, action, result) where you owned a problem end to end.'],
      ['conflict', 'A time you disagreed with someone', 'A STAR story about a disagreement or conflict and how you resolved it.'],
      ['failure', 'A time something went wrong', 'A STAR story about a mistake or failure and what you changed afterwards.'],
      ['pressure', 'Working under pressure', 'A STAR story about a deadline, an outage or a customer escalation.'],
      ['learning', 'Learning something fast', 'A STAR story about picking up a new skill or system quickly.'],
      ['teamwork', 'Working with a team or a customer', 'A STAR story about collaboration, especially with people outside your field.'],
    ],
  },
}

export const isInterview = (text = '') => /\binterview|recruiter|phone screen|hr screen|screening call|hiring manager|onsite\b/i.test(text)

export function interviewFormat(text = '') {
  if (/recruiter|hr screen|phone screen|screening call|non-?technical|not technical|too technical/i.test(text)) return 'recruiter'
  if (/behaviou?ral|star stor/i.test(text)) return 'behavioral'
  if (/technical/i.test(text)) return 'technical'
  return null
}

export function seededPlan(format) {
  const seed = SEEDS[format]
  return {
    title: seed.title,
    concepts: seed.concepts.map(([id, name, summary]) => ({ id, name, type: 'interview', summary, quote: '', grounded: null, prereqs: [], pL: BKT.init, attempts: 0, review: null })),
  }
}

export const TECHNICAL_NOTE = '\nThis is technical interview preparation. Make every concept a technical area the interviewer will probe for this role, named as something the learner must explain or work through out loud.'

export const asInterview = (plan) => ({ ...plan, concepts: plan.concepts.map((c) => ({ ...c, type: 'interview' })) })
