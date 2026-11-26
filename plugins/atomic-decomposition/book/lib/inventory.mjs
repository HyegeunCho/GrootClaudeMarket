// 목차를 정하는 데 쓰는 목록을 만든다.
import path from 'node:path';
import { toPosix } from './fsutil.mjs';
import { validateOutline } from './bookfile.mjs';
import { loadContext } from './context.mjs';
import { layerGroups, layerName } from './layers.mjs';

const cell = (s) => String(s ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');

export function renderInventory({ store, lineage, relations, candidates, unsupported, book, bookDir, project }) {
  const live = store.atoms.filter((d) => d.live);
  const known = new Set((book?.context ?? []).flatMap((c) => c.versions.map((v) => toPosix(path.relative(project, path.resolve(bookDir, v.path))))));
  const ignored = new Set(book?.contextIgnored ?? []);
  const newCandidates = candidates.filter((c) => c.versions.some((v) => !known.has(v.path) && !ignored.has(v.path)));
  const outline = book ? validateOutline(book, store, loadContext(book, bookDir).docs) : null;
  const threads = live.map((d) => lineage.thread(d.name)).filter((t) => t.length > 1);

  const data = {
    counts: { live: live.length, archived: store.atoms.length - live.length, layers: store.layers.length, maps: store.maps.length },
    atoms: live.map((d) => ({ name: d.name, type: d.type, status: d.status, category: d.category, milestone: d.milestone, layer: d.layer, part_of: d.relations.part_of, date: d.date, title: d.title, requires: d.relations.requires, versions: lineage.thread(d.name).length })),
    orphans: lineage.orphans.map((d) => d.name),
    external: Object.fromEntries(relations.external),
    clashes: relations.clashes,
    candidates,
    newCandidates,
    unsupported,
    outline,
    problems: store.problems,
  };

  const out = [`# 저장소 목록`, '', `현행 ${data.counts.live}건, 과거 ${data.counts.archived}건, Layer ${data.counts.layers}건, 분해 기록 ${data.counts.maps}건`];
  // 부록의 Layer 묶음과 같은 기준으로 보여 준다. labels(짧은 이름)를 정할 때 이 묶음을 쓴다
  for (const g of layerGroups(store, lineage)) {
    const rows = g.atoms.filter((d) => d.live).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name < b.name ? -1 : 1));
    const head = g.doc ? `L${g.level} · ${layerName(g.doc.title)} (${g.doc.name})` : g.level ? `L${g.level} · 소속 Layer 문서가 없는 결정` : 'Layer를 정하지 않은 결정';
    out.push('', `## ${head} — ${rows.length}건`, '', rows.length ? table(['name', '종류', '상태', 'category', 'milestone', '날짜', '제목', '전제', '이력'], rows.map((d) => [d.name, d.type, d.status, d.category, d.milestone, d.date, d.title, d.relations.requires.filter((n) => store.docs.has(n)).join(', '), lineage.thread(d.name).length])) : '현행 결정 없음');
  }
  if (threads.length) out.push('', '## 이력이 있는 결정', '', ...threads.map((t) => `- ${t.map((d) => d.name).join(' → ')}`));
  if (data.orphans.length) out.push('', '## 후속 없는 폐기 (부록의 Layer 묶음에 실린다. 관련 장의 dropped에 넣으면 그 장의 근거 목록에도 나온다)', '', ...lineage.orphans.map((d) => `- ${d.name} — ${d.title}`));
  const list = book ? newCandidates : candidates;
  out.push('', book ? '## 새 컨텍스트 후보' : '## 컨텍스트 후보', '', list.length ? table(['id', '제목', '종류', '방식', '글자 수', '언급', '파일'], list.map((c) => [c.id, c.title, c.kind, c.mode, c.chars, c.mentions, c.versions.map((v) => (v.label ? `${v.label} ${v.path}` : v.path)).join('<br>')])) : '없음');
  if (unsupported.length) out.push('', '## 실을 수 없는 형식 (내용을 md로 옮겨야 실을 수 있다)', '', ...unsupported.map((f) => `- ${f}`));
  if (relations.external.size) out.push('', '## 책 밖을 가리키는 이름 (글자로만 싣는다)', '', ...[...relations.external].map(([n, from]) => `- ${n} ← ${from.join(', ')}`));
  if (data.clashes.length) out.push('', '## 현행끼리의 충돌', '', ...data.clashes.map((c) => `- ${c.from} ↔ ${c.to}`));
  if (store.problems.length) out.push('', '## 문제가 있는 파일', '', ...store.problems.map((p) => `- ${p.file}: ${p.message}`));
  if (outline) {
    const rows = [['목차에 없는 결정', outline.missing], ['한 장에 두 번, 또는 본문과 appendixOnly에 함께 있는 결정', outline.duplicate], ['저장소에 없는 이름', outline.unknown], ['archived인데 현행 자리에 있는 결정', outline.archived], ['그 밖', outline.problems]].filter(([, v]) => v.length);
    out.push('', '## 목차와의 차이', '', ...(rows.length ? rows.map(([k, v]) => `- ${k}: ${v.join(', ')}`) : ['없음']));
  }
  return { data, markdown: out.join('\n') + '\n' };
}
