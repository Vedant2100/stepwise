import json, re
from playwright.sync_api import sync_playwright, expect
from _env import BASE, LAUNCH, check_errors, route_reply

PAGES = {
  'https://blog.example/attention': ('Attention explained', 'Attention lets each token look at every other token. Scores come from dot products of queries and keys.'),
  'https://blog.example/softmax': ('Why softmax', 'Softmax turns raw scores into weights that sum to one. Dividing by the square root of the key size keeps gradients healthy.'),
  'https://blog.example/heads': ('Multi-head attention', 'Several heads attend in parallel to different relations. Their outputs are concatenated and projected.'),
}
LIST = '\n'.join(f'{i+1}. {t} - {u}' for i, (u, (t, _)) in enumerate(PAGES.items())) + '\n4. Paywalled post - https://blog.example/private\n'
prompts = []
def ingest(route):
    url = json.loads(route.request.post_data)['url']
    if url not in PAGES: return route.fulfill(status=422, json={'error': 'That page couldn’t be opened.'})
    t, text = PAGES[url]; route.fulfill(json={'title': t, 'text': text})
def llm(route):
    p = json.loads(route.request.post_data)['prompt']; prompts.append(p)
    if route_reply(p): return route.fulfill(json={'text': json.dumps(route_reply(p))})
    if 'Pull out what a learner' in p:
        title = re.search(r'titled "(.*?)"', p).group(1)
        text = next(x for t, x in PAGES.values() if t == title)
        first = text.split('. ')[0]
        out = {'summary': f'About {title}.', 'points': [{'point': 'main idea', 'quote': first}, {'point': 'made up', 'quote': 'words that are not in the post at all'}]}
    elif 'reading list' in p:
        out = {'themes': ['Attention basics'], 'steps': [{'doc': 1, 'ideas': ['scores to weights']}, {'doc': 0, 'ideas': ['tokens look at tokens']}, {'doc': 2, 'ideas': ['parallel heads']}], 'links': [{'from': 1, 'to': 0, 'why': 'weights feed attention'}]}
    elif 'Break the objective' in p:
        out = {'title': 'Attention from the blogs', 'concepts': [{'id': 'heads', 'name': 'Multi-head attention', 'type': 'absorb', 'summary': 's', 'prereqs': [], 'quote': 'Several heads attend in parallel to different relations'}]}
    elif 'read-and-retain' in p:
        out = {'chunks': [
          {'excerpt': 'Several heads attend in parallel to different relations.', 'key': 'Heads look for different relations at once.', 'cue': 'Why use several heads?'},
          {'excerpt': 'Their outputs are concatenated and projected.', 'key': 'Head outputs are joined, then projected.', 'cue': 'What happens to the head outputs?'},
          {'excerpt': 'This sentence is not in the post.', 'key': 'x', 'cue': 'y'}],
          'connect': 'How does this relate to softmax weights?'}
    else:
        out = {'cards': [{'front': 'What do heads do?', 'back': 'attend in parallel'}]}
    route.fulfill(json={'text': json.dumps(out)})

errors = []
with sync_playwright() as pw:
    b = pw.chromium.launch(**LAUNCH)
    p = b.new_page(viewport={'width': 1200, 'height': 900})
    p.route('**/api/llm', llm); p.route('**/api/ingest', ingest); p.on('pageerror', lambda e: errors.append(str(e)))
    p.goto(BASE + '/')
    p.locator('input[type=file]').set_input_files({'name': 'blogs.txt', 'mimeType': 'text/plain', 'buffer': LIST.encode()})
    expect(p.locator('.pkg', has_text='attached')).to_contain_text('blogs.txt')
    p.get_by_label('Message').fill('Teach me the key ideas from these'); p.get_by_label('Message').press('Enter')
    expect(p.get_by_text('Read 3 of 4 posts. Couldn’t open: https://blog.example/private.')).to_be_visible()
    nodes = p.locator('.rmap-node a')
    expect(nodes).to_have_text(['Why softmax', 'Attention explained', 'Multi-head attention'])
    expect(p.locator('.rmap-link')).to_have_text(['Builds on 1: weights feed attention'])
    p.screenshot(path='e2e/out/reading-map.png', full_page=True)
    print('1. a .txt of links: 3 of 4 read, the dead link named; flowchart in a suggested order with links')
    expect(p.locator('.ws.open')).to_have_count(1)
    plan = next(x for x in prompts if 'Break the objective' in x)
    assert 'Several heads attend in parallel' in plan and 'words that are not in the post' not in plan
    ex = next(x for x in prompts if 'read-and-retain' in x)
    assert 'Their outputs are concatenated and projected' in ex and 'Dividing by the square root' not in ex
    t = json.loads(p.evaluate("localStorage.getItem('stepwise.v1')"))['tracks'][0]
    assert len(t['pages']) == 3 and len(t['map']['steps']) == 3
    print('2. invented quotes dropped; the plan sees every post; the exercise is grounded in its own post')
    ws = p.locator('.ws.open')
    expect(ws.locator('.tab.on')).to_have_text('Read & retain')
    expect(ws.get_by_text('Part 1 of 2')).to_be_visible()
    for take in ['heads look at different things', 'outputs get joined and projected']:
        ws.get_by_label('Your takeaway').fill(take); ws.get_by_role('button', name='Compare').click()
        ws.get_by_role('button', name='Got it').click()
    p.screenshot(path='e2e/out/retain-recall.png')
    for ans, rating in [('different relations', 'Got it'), ('not sure', 'Partly')]:
        ws.get_by_label('Your answer').fill(ans); ws.get_by_role('button', name='Check').click()
        ws.get_by_role('button', name=rating).click()
    ws.get_by_label('Your connection').fill('Each head has its own softmax weights.'); ws.get_by_role('button', name='Done').click()
    expect(ws.locator('.score')).to_contain_text('85')
    ws.get_by_role('button', name='Record it').click()
    expect(p.get_by_text('85/100 on Multi-head attention')).to_be_visible()
    print('2b. Read & retain: invented excerpt dropped; read, recall, connect; recall weighted (40/60) -> 85')
    p.get_by_role('button', name='Reading map').click()
    expect(p.locator('.rmap')).to_have_count(2); p.locator('.rmap').last.scroll_into_view_if_needed(); p.screenshot(path='e2e/out/reading-map.png')
    print('3. the map reopens from the sidebar')
    b.close()
check_errors(errors)
