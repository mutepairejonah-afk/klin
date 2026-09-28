#!/usr/bin/env python3
"""Build public/agents/ from a checkout of msitarzewski/agency-agents (MIT).
Usage: python3 scripts/build-agents.py /path/to/agency-agents"""
import glob, json, os, re, sys
src = sys.argv[1]
out = os.path.join(os.path.dirname(__file__), '..', 'public', 'agents')
os.makedirs(out, exist_ok=True)
divs = json.load(open(os.path.join(src, 'divisions.json')))['divisions']
index = []
for d, meta in sorted(divs.items()):
    for f in sorted(glob.glob(os.path.join(src, d, '**', '*.md'), recursive=True)):
        t = open(f, encoding='utf-8').read()
        m = re.match(r'^---\n(.*?)\n---\n(.*)$', t, re.S)
        if not m: continue
        fm = {}
        for line in m.group(1).splitlines():
            k, _, v = line.partition(':')
            if v: fm[k.strip()] = v.strip().strip('"\'')
        if 'name' not in fm: continue
        slug = os.path.splitext(os.path.basename(f))[0]
        open(os.path.join(out, slug + '.md'), 'w', encoding='utf-8').write(m.group(2).strip() + '\n')
        index.append({'slug': slug, 'name': fm['name'], 'description': fm.get('description', ''),
                      'emoji': fm.get('emoji', '🤖'), 'vibe': fm.get('vibe', ''), 'division': d})
json.dump({'divisions': {k: v['label'] for k, v in divs.items()}, 'agents': index},
          open(os.path.join(out, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
shutil = __import__('shutil'); shutil.copy(os.path.join(src, 'LICENSE'), os.path.join(out, 'LICENSE-agency-agents.txt'))
print(len(index), 'agents')
