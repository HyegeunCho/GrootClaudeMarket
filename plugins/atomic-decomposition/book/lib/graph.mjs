// 장 안의 결정 사이 관계를 Mermaid 그림으로 만든다.

const LABEL = { requires: '전제', derives_from: '근거', affects: '영향' };
const ORDER = ['전제', '근거', '영향'];

/** 앞선 결정에서 뒤따르는 결정으로 향하는 선. 같은 두 결정 사이의 관계는 한 선으로 합친다. */
export function chapterGraph(names, ctx) {
  const nodes = names.map((n) => ctx.store.docs.get(n)).filter((d) => d?.live).map((d) => ({ name: d.name, title: d.title }));
  const inside = new Set(nodes.map((n) => n.name));
  const edges = new Map();
  for (const { name } of nodes) {
    for (const { rel, to } of ctx.relations.out.get(name) ?? []) {
      if (!LABEL[rel] || !inside.has(to)) continue;
      const [a, b] = rel === 'affects' ? [name, to] : [to, name];
      const key = `${a}\n${b}`;
      if (!edges.has(key)) edges.set(key, { from: a, to: b, rels: [] });
      const e = edges.get(key);
      if (!e.rels.includes(LABEL[rel])) e.rels.push(LABEL[rel]);
    }
  }
  const list = [...edges.values()].sort((a, b) => (`${a.from}\n${a.to}` < `${b.from}\n${b.to}` ? -1 : 1));
  for (const e of list) e.rels.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  return list.length ? { nodes, edges: list } : null;
}

const wide = (ch) => (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠]/.test(ch) ? 2 : 1);
export const textWidth = (s) => [...s].reduce((n, c) => n + wide(c), 0);

/** 글을 너비에 맞춰 줄로 나눈다. */
export function wrap(text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let rest = word;
    if (line && textWidth(line) + 1 + textWidth(rest) <= width) { line += ` ${rest}`; continue; }
    if (line) { lines.push(line); line = ''; }
    while (textWidth(rest) > width) {
      let cut = '';
      for (const ch of rest) { if (textWidth(cut) + wide(ch) > width) break; cut += ch; }
      lines.push(cut);
      rest = rest.slice(cut.length);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines;
}

const mermaidText = (s) => s.replaceAll('#', '#35;').replaceAll('"', '#quot;').replaceAll('<', '#lt;').replaceAll('>', '#gt;').replaceAll('`', "'");

export function toMermaid(graph) {
  const id = new Map(graph.nodes.map((n, i) => [n.name, `n${i}`]));
  return [
    'graph TD',
    ...graph.nodes.map((n) => `  ${id.get(n.name)}["${wrap(n.title, 32).map(mermaidText).join('<br/>')}"]`),
    ...graph.edges.map((e) => `  ${id.get(e.from)} -->|${e.rels.join('·')}| ${id.get(e.to)}`),
  ].join('\n');
}
