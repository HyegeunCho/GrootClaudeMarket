// 이력(무엇이 무엇을 대체했나)과 관계(전제·영향·소속)를 계산한다.
import { wikiNames } from './store.mjs';
import { outsideCode } from './links.mjs';

const LINKED = ['derives_from', 'affects', 'requires', 'part_of'];

const version = (name) => Number(name.match(/_v(\d+)$/)?.[1] ?? 0);
const stem = (name) => name.replace(/_v\d+$/, '');
const push = (map, key, value) => { if (!map.has(key)) map.set(key, []); if (!map.get(key).includes(value)) map.get(key).push(value); };

export const byAge = (a, b) =>
  (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || version(a.name) - version(b.name) || (a.name < b.name ? -1 : 1);

export function buildLineage(store) {
  const prev = new Map();
  const next = new Map();
  const link = (to, from) => { push(prev, to, from); push(next, from, to); };
  for (const doc of store.atoms) {
    for (const old of doc.relations.conflicts_with) {
      const target = store.docs.get(old);
      if (old !== doc.name && target?.kind === 'atom' && !target.live) link(doc.name, old);
    }
  }
  for (const doc of store.atoms) {
    if (doc.live || next.has(doc.name)) continue;
    const later = store.atoms
      .filter((d) => stem(d.name) === stem(doc.name) && version(d.name) > version(doc.name))
      .sort((a, b) => version(a.name) - version(b.name))[0];
    if (later) link(later.name, doc.name);
  }
  const thread = (name) => {
    const seen = new Set();
    const visit = (n) => { if (seen.has(n)) return; seen.add(n); for (const p of prev.get(n) ?? []) visit(p); };
    visit(name);
    seen.delete(name);
    return [...[...seen].map((n) => store.docs.get(n)).sort(byAge), store.docs.get(name)];
  };
  /** 폐기된 결정을 지금 대신하는 현행 결정들. */
  const current = (name) => {
    const seen = new Set();
    const found = [];
    const visit = (n) => {
      if (seen.has(n)) return;
      seen.add(n);
      for (const x of next.get(n) ?? []) (store.docs.get(x).live ? found.push(x) : visit(x));
    };
    visit(name);
    return [...new Set(found)];
  };
  return { prev, next, thread, current, orphans: store.atoms.filter((d) => !d.live && !next.has(d.name)) };
}

export function buildRelations(store, lineage) {
  const out = new Map();
  const incoming = new Map();
  const clashes = [];
  const external = new Map();
  for (const doc of store.docs.values()) {
    for (const rel of LINKED) {
      for (const to of doc.relations[rel]) {
        if (!store.docs.has(to) || to === doc.name) continue;
        if (!out.has(doc.name)) out.set(doc.name, []);
        out.get(doc.name).push({ rel, to });
        if (!incoming.has(to)) incoming.set(to, []);
        incoming.get(to).push({ rel, from: doc.name });
      }
    }
    for (const to of doc.relations.conflicts_with) {
      if (doc.live && store.docs.get(to)?.live && to !== doc.name) clashes.push({ from: doc.name, to });
    }
    for (const n of wikiNames(outsideCode(doc.body))) if (!store.docs.has(n)) push(external, n, doc.name);
  }
  return { out, in: incoming, clashes, external };
}
