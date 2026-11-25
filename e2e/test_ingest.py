import base64, json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from _env import BASE, LAUNCH, OUT, check_errors, route_reply

PLAN = {"title": "From your material", "concepts": [{"id": "a", "name": "Idea A", "type": "recall", "summary": "s", "prereqs": [], "quote": "unique sentence"}]}
DRILL = {"cards": [{"front": "Q?", "back": "a"}]}
ingested = []
def llm(route):
    p = json.loads(route.request.post_data)["prompt"]
    if route_reply(p): return route.fulfill(json={"text": json.dumps(route_reply(p))})
    route.fulfill(json={"text": json.dumps(PLAN if "Break the objective" in p else DRILL)})
def ingest(route):
    body = json.loads(route.request.post_data); ingested.append(body)
    if 'url' in body: return route.fulfill(json={"title": "Softmax - Wikipedia", "text": "The softmax function has a unique sentence about exponentials."})
    route.fulfill(json={"title": body['image']['name'], "text": "Whiteboard: a unique sentence about attention."})

# a one-page PDF with a text layer
PDF = b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 100]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 52>>stream
BT /F1 12 Tf 10 50 Td (A unique sentence in a PDF.) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF"""
def tiny_docx(text):
    import io, zipfile
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        z.writestr('word/document.xml', f'<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>')
    return buf.getvalue()

def tiny_png():
    import struct, zlib
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d))
    raw = b''.join(b'\x00' + b'\xff\x00\x00' * 4 for _ in range(4))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 4, 4, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')

errors = []
with sync_playwright() as pw:
    b = pw.chromium.launch(**LAUNCH)
    p = b.new_page(viewport={'width': 1200, 'height': 850})
    p.route('**/api/llm', llm); p.route('**/api/ingest', ingest); p.on('pageerror', lambda e: errors.append(str(e)))
    p.goto(BASE + '/')
    msg = p.get_by_label('Message')
    msg.fill('https://en.wikipedia.org/wiki/Softmax_function'); msg.press('Enter')
    expect(p.get_by_text('I read Softmax - Wikipedia')).to_be_visible()
    expect(p.locator('.pkg')).to_contain_text('Softmax - Wikipedia')
    print('1. a link on its own is fetched and attached; asks what to do with it')
    p.locator('.pkg').get_by_role('button', name='Remove').click()

    p.locator('input[type=file]').set_input_files({'name': 'notes.pdf', 'mimeType': 'application/pdf', 'buffer': PDF})
    expect(p.locator('.pkg')).to_contain_text('notes.pdf')
    print('2. a PDF is read in the browser (no model call):', 'image' not in str(ingested[-1:]))
    p.locator('.pkg').get_by_role('button', name='Remove').click()

    p.locator('input[type=file]').set_input_files({'name': 'lecture.docx', 'mimeType': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'buffer': tiny_docx('A unique sentence in Word.')})
    expect(p.locator('.pkg')).to_contain_text('lecture.docx')
    expect(p.locator('.pkg')).to_contain_text('26 characters')
    print('2b. a Word file is read in the browser')
    p.locator('.pkg').get_by_role('button', name='Remove').click()

    png = tiny_png()
    p.locator('input[type=file]').set_input_files({'name': 'board.png', 'mimeType': 'image/png', 'buffer': png})
    expect(p.locator('.pkg')).to_contain_text('board.png')
    assert ingested[-1]['image']['mediaType'] == 'image/jpeg'
    print('3. an image is shrunk to JPEG and turned into notes by the model')

    msg.fill('Learn the key ideas from https://example.com/article please'); msg.press('Enter')
    expect(p.locator('.ws.open')).to_have_count(1)
    print('4. a link with a request plans straight from the fetched page')
    b.close()
check_errors(errors)
