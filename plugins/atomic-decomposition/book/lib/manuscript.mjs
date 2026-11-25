// Claude가 쓴 장 원고를 읽는다. 절의 원문은 HTML 주석 표식으로 밝힌다.
import { splitSections } from './store.mjs';

export const MARK = /<!--\s*(atoms|layers|context|history|open)\s*(?::\s*([^>]*?))?\s*-->/g;

const names = (s) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

function readHistory(text) {
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/<!--\s*history\s*:\s*([^>]*?)\s*-->/);
    if (!m) continue;
    const items = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      const item = line.match(/^\d+\.\s+(.*)$/);
      if (item) items.push(item[1]);
      else if (items.length && /^\s+\S/.test(line)) items[items.length - 1] += `\n${line.trim()}`;
      else if (line.trim() !== '') break;
    }
    out.push({ name: m[1].trim(), items });
  }
  return out;
}

function readSection({ heading, text }) {
  const section = { title: heading, atoms: [], layers: [], context: [], open: false, history: readHistory(text), text };
  for (const m of text.matchAll(MARK)) {
    if (m[1] === 'open') section.open = true;
    else if (m[1] !== 'history') section[m[1]].push(...names(m[2]));
  }
  return section;
}

export function parseManuscript(text) {
  const { head, sections } = splitSections(text);
  const title = head.match(/^#\s+(.*)$/m)?.[1].trim() ?? '';
  return { title, intro: head.replace(/^#\s+.*$/m, '').trim(), sections: sections.map(readSection) };
}
