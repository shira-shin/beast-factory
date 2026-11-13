# 単体で開ける preview.html を作る（JSと素材画像を全部埋め込む）
import re, base64, glob, os, json
root = os.path.dirname(os.path.abspath(__file__))
# assets/beasts の PNG/JPG を最適化（余白を切り、768px以内のWebPにする）。元画像は assets/beasts_src/ に退避
_bdir = os.path.join(root, 'assets/beasts')
try:
    from PIL import Image
    for f in sorted(os.listdir(_bdir)) if os.path.isdir(_bdir) else []:
        stem, ext = os.path.splitext(f)
        if ext.lower() not in ('.png', '.jpg', '.jpeg'):
            continue
        src = os.path.join(_bdir, f)
        im = Image.open(src).convert('RGBA')
        px = im.load(); W, H = im.size
        corners = [px[0, 0], px[W - 1, 0], px[0, H - 1], px[W - 1, H - 1]]
        if all(c[3] > 250 and min(c[:3]) > 240 for c in corners):
            # 白背景：四隅から白をたどって透過にする
            from collections import deque
            seen = set(); q = deque([(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)])
            while q:
                x, y = q.popleft()
                if (x, y) in seen or not (0 <= x < W and 0 <= y < H): continue
                seen.add((x, y)); r, g, b, a = px[x, y]
                if min(r, g, b) < 232: continue
                px[x, y] = (r, g, b, 0)
                q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
        bb = im.split()[3].point(lambda v: 255 if v > 12 else 0).getbbox() or (0, 0, W, H)
        im = im.crop(bb); m = int(max(im.size) * 0.03)
        c = Image.new('RGBA', (im.width + 2 * m, im.height + m), (0, 0, 0, 0)); c.paste(im, (m, m))
        sc = 768 / max(c.size)
        if sc < 1: c = c.resize((round(c.width * sc), round(c.height * sc)), Image.LANCZOS)
        c.save(os.path.join(_bdir, stem + '.webp'), quality=88, method=6)
        os.makedirs(os.path.join(root, 'assets/beasts_src'), exist_ok=True)
        os.replace(src, os.path.join(root, 'assets/beasts_src', f))
        print('最適化:', f, '->', stem + '.webp', c.size)
except ImportError:
    print('（Pillowが無いので画像の最適化は省略。pip install pillow で有効になる）')

# assets/beasts の画像から js/manifest.js を自動生成（ファイル名がID）
_data = open(os.path.join(root, 'js/data.js'), encoding='utf-8').read()
_ids = set(re.findall(r"\{ id: '([a-z0-9]+)'", _data))
_have = sorted({os.path.splitext(f)[0] for f in os.listdir(os.path.join(root, 'assets/beasts')) if os.path.splitext(f)[1].lower() in ('.png', '.webp', '.jpg', '.jpeg')} & _ids) if os.path.isdir(os.path.join(root, 'assets/beasts')) else []
_unknown = sorted({os.path.splitext(f)[0] for f in os.listdir(os.path.join(root, 'assets/beasts'))} - _ids) if os.path.isdir(os.path.join(root, 'assets/beasts')) else []
open(os.path.join(root, 'js/manifest.js'), 'w', encoding='utf-8').write(
    '// build.py が assets/beasts の中身から自動生成する。手で編集しない\n'
    'const IMAGE_MANIFEST = {\n  beasts: %s,\n  bg: [],\n};\n' % json.dumps(_have))
print('画像あり:', len(_have), '体', _have)
if _unknown: print('警告：IDに一致しないファイル名（無視した）:', _unknown)
html = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
fx = {os.path.basename(f)[:-4]: 'data:image/png;base64,' + base64.b64encode(open(f, 'rb').read()).decode() for f in sorted(glob.glob(os.path.join(root, 'assets/fx/*.png')))}
MIME = {'.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'}
beasts = {}
for f in sorted(glob.glob(os.path.join(root, 'assets/beasts/*'))):
    ext = os.path.splitext(f)[1].lower()
    if ext in MIME: beasts[os.path.splitext(os.path.basename(f))[0]] = 'data:%s;base64,' % MIME[ext] + base64.b64encode(open(f, 'rb').read()).decode()
def inline(m):
    src = m.group(1)
    if src.startswith('http'): return m.group(0)
    code = open(os.path.join(root, src), encoding='utf-8').read()
    if src == 'js/manifest.js':
        code = 'const IMAGE_MANIFEST = { beasts: [], bg: [] };'
    return '<script>\n' + code.replace('</script', '<\\/script') + '\n</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
sfx = {os.path.basename(f)[:-4]: 'data:audio/mpeg;base64,' + base64.b64encode(open(f, 'rb').read()).decode() for f in sorted(glob.glob(os.path.join(root, 'assets/sfx/*.mp3')))}
data = '<script>window.FX_DATA=' + json.dumps(fx) + ';window.SFX_DATA=' + json.dumps(sfx) + ';</script>\n<script>window.BEAST_DATA=/*BEAST_DATA_START*/' + json.dumps(beasts) + '/*BEAST_DATA_END*/;</script>\n'
out = '<!doctype html>\n<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + data + '</head><body>\n' + html + '\n</body></html>'
os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
open(os.path.join(root, 'dist/preview.html'), 'w', encoding='utf-8').write(out)
os.makedirs(os.path.join(root, 'docs'), exist_ok=True)
open(os.path.join(root, 'docs/index.html'), 'w', encoding='utf-8').write(out)  # GitHub Pages 用
import shutil; shutil.copy(os.path.join(root, 'build-preview.ps1'), os.path.join(root, 'dist/build-preview.ps1'))
print('dist/preview.html', round(len(out) / 1e6, 2), 'MB, fx', len(fx), 'beasts', len(beasts))
