# 単体で開ける preview.html を作る（JSと素材画像を全部埋め込む）
import re, base64, glob, os, json
root = os.path.dirname(os.path.abspath(__file__))
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
