import json
from playwright.sync_api import sync_playwright, expect
from _env import BASE, LAUNCH, OUT, PYO, check_errors, route_reply
PASTE = ("You are my interview coach. I have attached my resume and the two job descriptions. Read all three files first. "
         "I am Shashwat, MS Robotics at UCR, interviewing for a robotics field engineer role at Nimble. ") * 6
PLAN = {"title": "Nimble field engineer interview", "concepts": [{"id": "why-nimble", "name": "Why Nimble", "type": "interview", "summary": "Explain why this role.", "prereqs": []}]}
IV = {"role": "Hiring manager", "questions": [
  {"ask": "Why do you want to work at Nimble?", "seconds": 40, "strong": ["specific to Nimble", "ties to field work"], "followup": "What would you do in your first month?"},
  {"ask": "Tell me about a robot you debugged on site.", "seconds": 60, "strong": ["situation", "method", "result"], "followup": "How did you confirm the root cause?"}]}
seen = []
def llm(route):
    p = json.loads(route.request.post_data)["prompt"]; seen.append(p)
    if 'recruiter side' in p: return route.fulfill(json={"text": json.dumps({"action": "adjust", "topic": "recruiter side only, not technical", "say": "", "suggest": []})})
    if route_reply(p): return route.fulfill(json={"text": json.dumps(route_reply(p))})
    if 'Decide what it is' in p: out = {"kind": "request", "objective": "Prepare for my Nimble robotics field engineer interview", "missing": ["your resume", "the two job descriptions"]}
    elif 'Break the objective' in p: out = PLAN
    elif 'Mock interview question' in p:
        weak = 'Why do you want' in p and 'first month' not in p
        out = {"score": 55 if weak else 85, "verdict": "Too general" if weak else "Clear", "weak": "No specifics about Nimble.", "missing": ["fleet scale"], "tighter": "I like robots that run in real warehouses."}
    else: out = IV
    route.fulfill(json={"text": json.dumps(out)})
FAKE_SR = """
class FakeSR { constructor(){ this.onresult=null; this.onend=null } start(){ window.__sr = this; setTimeout(() => this.onresult && this.onresult({ results: [Object.assign([{ transcript: 'I like robots that work in real warehouses' }], { isFinal: true })] }), 200) }
  stop(){ setTimeout(() => this.onend && this.onend(), 10) } abort(){} }
window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR; Object.defineProperty(window, "speechSynthesis", { value: { speak(u){ (window.__spoken ||= []).push(u.text) }, cancel(){} } });
"""
errors = []
with sync_playwright() as pw:
    b = pw.chromium.launch(**LAUNCH)
    p = b.new_page(viewport={'width': 1280, 'height': 860})
    p.add_init_script(FAKE_SR); p.route('**/api/llm', llm); p.on('pageerror', lambda e: errors.append(str(e)))
    p.goto(BASE + '/')
    expect(p.get_by_role('heading', name='Stepwise')).to_have_count(0)
    p.get_by_label('Message').fill(PASTE); p.get_by_label('Message').press('Enter')
    expect(p.get_by_text('Your message mentions your resume and the two job descriptions')).to_be_visible()
    print('1. long paste read as a request; asks for the missing resume and job descriptions')
    p.get_by_label('Message').fill('RESUME: Archtech Automation 2023-2024, Printerior KUKA deployment'); p.get_by_label('Message').press('Enter')
    expect(p.locator('.ws.open')).to_have_count(1)
    plan_prompt = next(x for x in seen if 'Break the objective' in x)
    assert "THE LEARNER'S OWN MATERIAL" in plan_prompt and 'RESUME: Archtech' in plan_prompt and 'SOURCE:' not in plan_prompt
    print('2. planned with the paste + resume as background (not as strict source)')
    expect(p.get_by_text('Why do you want to work at Nimble?')).to_be_visible()
    assert p.evaluate('window.__spoken')[0] == 'Why do you want to work at Nimble?'
    p.get_by_role('button', name='Start answering').click()
    expect(p.get_by_label('Your answer')).to_have_value('I like robots that work in real warehouses')
    expect(p.get_by_text('Listening')).to_be_visible()
    p.wait_for_timeout(1300); p.screenshot(path=f'{OUT}/iv1-answering.png')
    p.get_by_role('button', name='Done answering').click()
    expect(p.get_by_text('No specifics about Nimble.')).to_be_visible()
    expect(p.get_by_text('A tighter version, in your words')).to_be_visible()
    p.screenshot(path=f'{OUT}/iv2-graded.png')
    print('3. question read aloud, answer transcribed live, timed, graded with weak/missing/tighter')
    p.get_by_role('button', name='Take the follow-up').click()
    expect(p.get_by_text('What would you do in your first month?')).to_be_visible()
    p.get_by_role('button', name='Start answering').click(); p.wait_for_timeout(400)
    p.get_by_role('button', name='Done answering').click()
    p.get_by_role('button', name='Next question').click()
    p.get_by_role('button', name='Start answering').click(); p.wait_for_timeout(400)
    p.get_by_role('button', name='Done answering').click()
    p.get_by_role('button', name='Finish').click()
    expect(p.locator('.score')).to_contain_text('70')
    p.get_by_role('button', name='Record it').click()
    expect(p.get_by_text('70/100 on Why Nimble')).to_be_visible()
    print('4. weak answer -> one follow-up; score = average of main questions (55, 85 -> 70), recorded')
    plans = [x for x in seen if 'Break the objective' in x]
    assert 'technical interview preparation' in plans[-1], 'an interview with no round named defaults to technical'
    p.get_by_label('Message').fill('make it recruiter side only, not technical'); p.get_by_label('Message').press('Enter')
    expect(p.get_by_text('Updated climb: Recruiter screen')).to_be_visible()
    assert len([x for x in seen if 'Break the objective' in x]) == len(plans), 'the recruiter round is seeded, not generated'
    t = json.loads(p.evaluate("localStorage.getItem('stepwise.v1')"))['tracks'][0]
    names = [c['name'] for c in t['concepts']]
    assert names[:2] == ['Tell me about yourself', 'Walk me through a project'] and all(c['type'] == 'interview' for c in t['concepts']) and t['interview'] == 'recruiter', names
    expect(p.locator('.ws.open .tab.on')).to_have_text('Interview room')
    print('4b. no round named -> technical; "recruiter side" switches to the seeded recruiter screen, all in the interview room')
    p.get_by_role('button', name='Back to chat').click()
    p.get_by_role('button', name='Hide sidebar').click(); expect(p.locator('.side')).to_be_hidden()
    p.reload(); expect(p.locator('.side')).to_be_hidden()
    p.get_by_role('button', name='Show sidebar').click(); expect(p.locator('.side')).to_be_visible()
    print('5. sidebar hides, stays hidden after reload, shows again')
    b.close()
check_errors(errors)
