// 결정을 Layer별로 묶는다. 부록의 차례와 목록에 쓴다.
// Atom은 part_of가 가리키는 Layer 문서 아래에 두고, 없으면 layer 숫자로 만든 묶음에 둔다. 짐작해서 Layer 문서에 넣지 않는다.

const PREFIX = /^L([0-4])_/;
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/** Layer 문서나 Atom의 층(0~4). 모르면 ''. */
export const levelOf = (doc) => (/^[0-4]$/.test(doc.layer) ? doc.layer : doc.name.match(PREFIX)?.[1] ?? '');

/** Layer 문서 제목에서 앞의 `L1`, `L1 ·` 같은 표기를 뗀다. */
export const layerName = (title) => title.replace(/^L[0-4]\s*[·:._-]?\s*/, '').trim() || title;

/**
 * Layer 묶음: [{ id, level, doc, atoms }]
 * - doc: Layer 문서. 소속 문서가 없는 결정의 묶음이면 null
 * - atoms: 현행 결정과 후속 없는 폐기. 후속이 있는 폐기는 지금의 결정을 따라간다
 * 순서는 L0부터이고, 같은 층에서는 Layer 문서(이름순) 다음에 소속 없는 묶음이 온다. 층을 모르는 묶음은 맨 뒤다.
 */
export function layerGroups(store, lineage) {
  const groups = new Map();
  for (const d of [...store.layers].sort(byName)) groups.set(d.name, { id: d.name, level: levelOf(d), doc: d, atoms: [] });
  const loose = (level) => {
    const id = level ? `L${level}-others` : 'no-layer';
    if (!groups.has(id)) groups.set(id, { id, level, doc: null, atoms: [] });
    return groups.get(id);
  };
  for (const a of [...store.atoms.filter((d) => d.live), ...lineage.orphans]) {
    const owner = a.relations.part_of.find((n) => store.docs.get(n)?.kind === 'layer');
    (owner ? groups.get(owner) : loose(/^[0-4]$/.test(a.layer) ? a.layer : '')).atoms.push(a);
  }
  const rank = (g) => (g.level === '' ? 10 : Number(g.level) * 2) + (g.doc ? 0 : 1);
  return [...groups.values()].sort((a, b) => rank(a) - rank(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
