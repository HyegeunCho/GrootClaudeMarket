// GitBook용 md를 만든다. 원고는 다듬어 싣고, 원문은 링크 표기만 바꿔 그대로 싣는다.
// 책의 차례: 여는 글 → 부·장(원고) → 부록(원문을 Layer별로) → 다른 순서로 보기
import fs from 'node:fs';
import path from 'node:path';
import { publishDir } from './fsutil.mjs';
import { hash, hasException } from './bundle.mjs';
import { OPENING_TITLE } from './bookfile.mjs';
import { escapeFakeLinks, mdText, relLink, replaceWiki, rewriteOriginal } from './links.mjs';
import { layerGroups, levelOf } from './layers.mjs';
import { planSite, statusLabel, versionLabel } from './site.mjs';
import { MARK } from './manuscript.mjs';

export const ORIGINAL_BEGIN = '<!-- original:begin -->';
export const ORIGINAL_END = '<!-- original:end -->';
const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.avif']);
const KIND = { plan: '기획서', guide: '지침', prompt: '프롬프트', reference: '참고 자료' };
const APPENDIX_GROUP = '부록 · 원문 찾아보기';
const APPENDIX_INDEX = 'appendix/README.md';
const VIEW_GROUP = '다른 순서로 보기';

export function fenced(lang, text) {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}${lang}\n${text.replace(/\n$/, '')}\n${fence}`;
}

const tidy = (s) => s.replace(/\n{3,}/g, '\n\n').trim() + '\n';
const anchorTag = (id) => ` <a href="#${id}" id="${id}"></a>`;
const stem = (name) => name.replace(/_v\d+$/, '');
const details = (summary, body) => ['<details>', `<summary>${summary}</summary>`, '', body, '', '</details>'].join('\n');
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name < b.name ? -1 : 1);

function makeRenderer(ctx, site, assets) {
  const link = (from, label, place) => `[${mdText(label)}](${relLink(from, place.file, place.anchor)})`;
  const toOriginal = (from, name, label = '원문') => { const o = site.originalOf(name); return o ? link(from, label, o) : ''; };
  const toPlace = (from, name, label) => { const p = site.placeOf(name); return p ? link(from, label ?? site.titleOf(name), p) : mdText(label ?? site.titleOf(name)); };

  /** 결정의 상태: 재발 방지 · 초안(draft) · v3 · 2026-03-21 · 예외 있음 · 이력 3건 */
  const stateOf = (d) => {
    const n = ctx.lineage.thread(d.name).length;
    return [d.type === 'feedback' ? '재발 방지' : '', statusLabel(d.status), versionLabel(d.name), d.date, hasException(d) ? '예외 있음' : '', d.live && n > 1 ? `이력 ${n}건` : '']
      .filter(Boolean).join(' · ');
  };

  /** 부록 차례의 Layer 묶음 이름: `L1 · 대출 시스템` */
  const groupTitle = (g) => {
    if (g.doc) return g.level ? `L${g.level} · ${site.labelOf(g.doc.name)}` : site.labelOf(g.doc.name);
    return g.level ? `L${g.level} · 소속 Layer 문서가 없는 결정` : 'Layer를 정하지 않은 결정';
  };

  /**
   * 원고의 [[이름]]. `부/장`은 그 장으로, 문서 이름은 부록 원문으로 잇는다 (근거 링크).
   * 링크 글은 원고의 별칭 → book.json의 labels → 제목 순서로 고른다.
   */
  const wiki = (from, text) => replaceWiki(escapeFakeLinks(text), (name, label) => {
    const o = name.includes('/') ? null : site.originalOf(name);
    if (o) return link(from, label ?? site.labelOf(name), o);
    const ch = site.chapterOf(name);
    return ch ? link(from, label ?? ch.title, { file: ch.file }) : mdText(label ?? name);
  });

  /** 이력 항목 끝에 그 버전의 원문 링크를 붙이고 표식을 걷어낸다. */
  function body(from, text) {
    const lines = text.split('\n');
    const out = [];
    let names = null;
    let at = -1;
    let lastLine = -1;
    const close = () => {
      if (lastLine >= 0 && names?.[at]) out[lastLine] += ` ${toOriginal(from, names[at])}`;
      lastLine = -1;
    };
    for (const line of lines) {
      const mark = line.match(/<!--\s*history\s*:\s*([^>]*?)\s*-->/);
      if (mark) {
        close();
        const n = mark[1].trim();
        const c = ctx.context.find((x) => x.id === n);
        names = c ? c.versions.map((v) => v.name) : ctx.store.docs.has(n) ? ctx.lineage.thread(n).map((d) => d.name) : null;
        at = -1;
        continue;
      }
      if (names && /^\d+\.\s+/.test(line)) { close(); at++; out.push(line); lastLine = out.length - 1; continue; }
      if (names && lastLine >= 0 && /^\s+\S/.test(line)) { out.push(line); lastLine = out.length - 1; continue; }
      if (names && line.trim() !== '') { close(); names = null; }
      out.push(line);
    }
    close();
    return wiki(from, out.join('\n').replace(MARK, '').replace(/<!--[\s\S]*?-->/g, ''));
  }

  /** 지난 결정의 짧은 이름. 같은 결정의 이전 버전이면 `v1 · 날짜`, 이름이 다른 결정이면 그 이름과 날짜. */
  const pastTitle = (p, now) => [stem(p.name) === stem(now.name) ? versionLabel(p.name) : `${site.labelOf(p.name)} (이전 결정)`, p.date].filter(Boolean).join(' · ') || p.title;

  /** 장 끝에 접어 두는 근거 문서 목록. 상태·버전·예외를 여기서 알린다. */
  function sources(from, chapter) {
    const rows = [];
    const atom = (n) => { const d = ctx.store.docs.get(n); return d?.kind === 'atom' ? d : null; };
    for (const n of chapter.atoms ?? []) { const d = atom(n); if (d) rows.push(`- ${toOriginal(from, n, site.labelOf(n))} · ${stateOf(d)}`); }
    for (const n of chapter.dropped ?? []) { const d = atom(n); if (d) rows.push(`- ${toOriginal(from, n, site.labelOf(n))} · ${stateOf(d)} · 후속 결정 없음`); }
    for (const n of chapter.layers ?? []) {
      const d = ctx.store.docs.get(n);
      if (d && site.originalOf(n)) rows.push(`- ${toOriginal(from, n, levelOf(d) ? `L${levelOf(d)} · ${site.labelOf(n)}` : site.labelOf(n))} · Layer 문서`);
    }
    for (const id of chapter.context ?? []) {
      const c = ctx.context.find((x) => x.id === id);
      if (c && site.originalOf(id)) rows.push(`- ${toOriginal(from, id, site.labelOf(id))} · ${KIND[c.kind] ?? c.kind}`);
    }
    return rows.length ? details(`이 장의 근거 문서 ${rows.length}편`, rows.join('\n')) : '';
  }

  /** 원문 쪽 맨 위: 이 원문을 근거로 쓴 장으로 돌아가는 줄. */
  const backLine = (from, name) => {
    const list = site.chaptersOf(name);
    return list.length ? `← 본문으로 돌아가기 · ${list.map(({ page, anchor }) => link(from, page.title, { file: page.file, anchor })).join(' · ')}` : '';
  };

  /** 원문 쪽 아래: 이 결정을 참조하는 현행 결정과 충돌. 정방향 관계는 원문의 Relations에 있다. */
  const backlinks = (from, d) => {
    if (d.kind !== 'atom' || !d.live) return '';
    const refs = [];
    const clash = [];
    for (const { rel, from: other } of ctx.relations.in.get(d.name) ?? []) {
      const o = ctx.store.docs.get(other);
      if (rel !== 'part_of' && o.kind === 'atom' && o.live && !refs.includes(other)) refs.push(other);
    }
    for (const c of ctx.relations.clashes) {
      if (c.from === d.name && !clash.includes(c.to)) clash.push(c.to);
      if (c.to === d.name && !clash.includes(c.from)) clash.push(c.from);
    }
    const lines = [];
    if (refs.length) lines.push(`- 이 결정을 참조: ${refs.map((n) => toOriginal(from, n, site.labelOf(n))).join(', ')}`);
    if (clash.length) lines.push(`- 충돌: ${clash.map((n) => toOriginal(from, n, site.labelOf(n))).join(', ')}`);
    return lines.length ? ['**이어진 결정**', '', ...lines].join('\n') : '';
  };

  const copyAssetFrom = (dir) => (dest) => {
    const f = path.resolve(dir, dest.replaceAll('\\', '/'));
    if (!IMAGE.has(path.extname(f).toLowerCase()) || !fs.existsSync(f)) return null;
    const data = fs.readFileSync(f);
    const name = `assets/${hash(data).slice(0, 8)}-${path.basename(f)}`;
    assets.set(name, data);
    return name;
  };

  /** 부록 원문 한 쪽. 원문은 표식 사이에 그대로 두고, 프론트매터는 맨 아래 "문서 정보"에 접어 둔다. */
  function originalPage(o, extra = '') {
    const dir = path.dirname(o.source);
    const next = (ctx.lineage.next.get(o.name) ?? []).map((n) => toOriginal(o.file, n, site.titleOf(n)));
    const note = [o.note, next.length ? `대체한 결정: ${next.join(', ')}` : ''].filter(Boolean).join(' · ');
    const content = o.code ? fenced(o.code, o.body) : rewriteOriginal(o.body, {
      fromFile: o.file,
      resolveWiki: (n) => site.originalOf(n),
      resolvePath: (p) => site.originalOfFile(path.resolve(dir, p.replaceAll('\\', '/'))),
      copyAsset: copyAssetFrom(dir),
    });
    const parts = [backLine(o.file, o.contextId && o.group === 'context' ? o.contextId : o.name), `# ${mdText(o.title)}`];
    if (note) parts.push(`> ${note}`);
    parts.push(`${ORIGINAL_BEGIN}\n${content}\n${ORIGINAL_END}`);
    if (o.doc) parts.push(backlinks(o.file, o.doc));
    parts.push(extra);
    if (o.raw !== null) parts.push(details('문서 정보', fenced('yaml', o.raw)));
    return parts.filter(Boolean).join('\n\n') + '\n';
  }

  return { link, toOriginal, toPlace, stateOf, groupTitle, pastTitle, wiki, body, sources, originalPage };
}

function chapterPage(page, ctx, r, site) {
  const { file, chapter, manuscript } = page;
  const out = [`# ${mdText(page.title)}`];
  const push = (...parts) => out.push(...parts.filter(Boolean));
  if (manuscript) {
    push(r.wiki(file, manuscript.intro));
    for (const s of manuscript.sections) push(`## ${s.title}${s.anchor ? anchorTag(s.anchor) : ''}`, r.body(file, s.text));
  } else {
    push('> 이 장은 아직 편집하지 않았습니다. 결정마다 한 문장 요약을 원문 그대로 싣습니다.');
    for (const n of chapter.atoms ?? []) {
      const d = ctx.store.docs.get(n);
      if (d?.kind !== 'atom') continue;
      const past = ctx.lineage.thread(n).slice(0, -1);
      push(`## ${mdText(site.labelOf(n))}${anchorTag(n)}`, r.wiki(file, d.summary), `${r.toOriginal(file, n)} · ${r.stateOf(d)}`);
      if (past.length) push(`지난 결정: ${past.map((p) => r.toOriginal(file, p.name, r.pastTitle(p, d))).join(', ')}`);
    }
    for (const id of chapter.context ?? []) if (site.originalOf(id)) push(`## ${mdText(site.labelOf(id))}${anchorTag(id)}`, r.toOriginal(file, id));
  }
  push(r.sources(file, chapter));
  return out.join('\n\n');
}

function coverPage(ctx, site, r, views) {
  const file = 'README.md';
  const out = [`# ${mdText(ctx.book.title)}`];
  const push = (...parts) => out.push(...parts.filter(Boolean));
  const o = site.opening;
  if (o) {
    push(r.wiki(file, o.intro));
    for (const s of o.sections) push(`## ${s.title}`, r.body(file, s.text));
  }
  push('## 읽는 순서');
  const parts = (ctx.book.parts ?? []).filter((p) => site.chapterPages.some((c) => c.part === p));
  for (const part of parts) {
    if (parts.length > 1) push(`### ${mdText(site.titles.part.get(part.id))}`);
    const rows = site.chapterPages.filter((c) => c.part === part).map((c) => `| ${r.link(file, c.title, c)} | ${mdText(c.chapter.lead ?? '')} |`);
    push(['| 장 | 이 장에서 만나는 장면 |', '|---|---|', ...rows].join('\n'));
  }
  const first = site.chapterPages[0];
  if (first) push(`**${r.link(file, `첫 장 읽기 → ${first.title}`, first)}**`);
  const dates = [...ctx.store.docs.values()].map((d) => d.updated || d.created).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  push('---', [
    dates.length ? `기준 날짜: ${dates.at(-1)}` : '',
    `결정의 원문은 ${r.link(file, APPENDIX_GROUP, { file: APPENDIX_INDEX })}에 Layer별로 있습니다. 본문 문단 끝의 링크가 그 문단의 근거 원문입니다.`,
    views.length ? `${VIEW_GROUP}: ${views.map((v) => r.link(file, v.title, v)).join(' · ')}` : '',
  ].filter(Boolean).join('\n\n'));
  return out.join('\n\n');
}

const STATUS_GUIDE = [
  ['초안(draft)', '기록했지만 아직 확정하지 않은 결정입니다.'],
  ['검증 중(pending)', '시험 중인 가설이나 값입니다. 무효화 조건이 함께 적혀 있습니다.'],
  ['승인(approved)', '승인한 결정입니다.'],
  ['시행(active)', '채택해 따르고 있는 결정입니다.'],
  ['폐기(archived)', '지난 결정입니다. 지금의 결정 아래에 버전 순서로 있습니다.'],
];

const plain = (s) => s.replace(/\[\[([^[\]\n|]+)(?:\|([^[\]\n]+))?\]\]/g, (raw, n, l) => l ?? n);

/** Layer 문서의 목적 첫 줄. 원문 그대로이며, 비어 있거나 미정이면 쓰지 않는다. */
function purposeOf(doc) {
  const s = doc.sections.find((x) => x.key === '목적');
  const line = s?.text.split('\n').map((l) => l.replace(/^\s*[-*]\s*/, '').trim()).find(Boolean) ?? '';
  return /^\[(MISSING|확인 필요|보류)/.test(line) ? '' : plain(line);
}

function appendixIndex(ctx, site, r, groups) {
  const file = APPENDIX_INDEX;
  const out = [
    '# 원문을 읽는 법',
    '본문 문단 끝의 링크는 그 문단의 근거가 된 원문으로 이어집니다. 원문은 고치지 않고 그대로 실었고, 링크만 책 안에서 통하게 바꿨습니다. 결정 하나가 문서(Atom) 하나이며, 결정이 속한 Layer(추상 계층)별로 묶었습니다. 바뀐 결정은 지금의 결정 아래에 지난 버전이 있습니다.',
    ['| Layer | 다루는 것 | 결정 |', '|---|---|---|', ...groups.map((g) => {
      const what = g.doc ? purposeOf(g.doc) : g.level ? `Layer 문서(part_of)를 적지 않은 L${g.level} 결정` : 'layer와 part_of를 적지 않은 결정';
      return `| ${r.link(file, r.groupTitle(g), g)} | ${mdText(what)} | ${g.atoms.filter((d) => d.live).length}편 |`;
    })].join('\n'),
    '## 상태 읽는 법',
    ['| 상태 | 뜻 |', '|---|---|', ...STATUS_GUIDE.map(([a, b]) => `| ${a} | ${b} |`)].join('\n'),
  ];
  const related = [
    ...ctx.context.map((c) => {
      const old = c.versions.length - 1;
      return `- ${r.toOriginal(file, c.id, site.labelOf(c.id))} · ${[KIND[c.kind] ?? c.kind, c.versions.at(-1).label, old ? `이전 판 ${old}편` : ''].filter(Boolean).join(' · ')}`;
    }),
    ...[...ctx.store.maps].sort(byDate).map((m) => `- ${r.toOriginal(file, m.name, m.title)} · 분해 기록${m.date ? ` · ${m.date}` : ''}`),
  ];
  if (related.length) out.push('## 관련 문서', '기획서·지침처럼 결정의 바탕이 된 문서와, 요청을 결정으로 나눈 분해 기록입니다.', related.join('\n'));
  return out.join('\n\n');
}

function decisionList(file, g, r, site) {
  if (!g.atoms.length) return '';
  const rows = g.atoms.map((d) => `- ${r.toOriginal(file, d.name, site.labelOf(d.name))} · ${r.stateOf(d)}${d.live ? '' : ' · 후속 결정 없음'}`);
  return [g.doc ? '## 이 Layer의 결정' : '## 결정', rows.join('\n')].join('\n\n');
}

// --- 다른 순서로 보기 ---

const listItem = (r, from, d) => `- ${r.toPlace(from, d.name)} · ${statusLabel(d.status)}`;

function scopeView(file, ctx, r) {
  const live = ctx.store.atoms.filter((d) => d.live);
  if (!live.some((d) => d.milestone)) return '';
  const out = ['# 마일스톤별', '현행 결정을 마일스톤으로 묶었습니다. Layer별 묶음은 부록에 있습니다.'];
  for (const m of [...new Set(live.map((d) => d.milestone))].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a < b ? -1 : 1))) {
    const docs = live.filter((d) => d.milestone === m).sort(byDate);
    out.push(`## ${m ? mdText(m) : '마일스톤 없음'}`, docs.map((d) => listItem(r, file, d)).join('\n'));
  }
  return out.join('\n\n');
}

function workView(file, ctx, r) {
  const item = (d) => {
    if (d.live) return listItem(r, file, d);
    const now = ctx.lineage.current(d.name).map((n) => r.toPlace(file, n));
    return `- ${r.toOriginal(file, d.name, d.title)} · ${statusLabel(d.status)}${now.length ? ` → 현재: ${now.join(', ')}` : ''}`;
  };
  const out = ['# 작업 순서별', '분해 기록의 날짜 순서로, 그때 만든 결정을 모았습니다.'];
  const seen = new Set();
  for (const m of [...ctx.store.maps].sort(byDate)) {
    const docs = m.atoms.map((n) => ctx.store.docs.get(n)).filter(Boolean);
    docs.forEach((d) => seen.add(d.name));
    out.push(`## ${m.date} ${mdText(m.title)}`, [m.source ? `출처: ${mdText(m.source)}` : '', r.toOriginal(file, m.name, '기록 원문')].filter(Boolean).join(' · '), docs.map(item).join('\n') || '결정 없음');
  }
  const rest = ctx.store.atoms.filter((d) => !seen.has(d.name)).sort(byDate);
  if (rest.length) out.push('## 분해 기록에 없는 결정', rest.map(item).join('\n'));
  return out.join('\n\n');
}

function changesView(file, ctx, r) {
  const threads = ctx.store.atoms.filter((d) => d.live).map((d) => ctx.lineage.thread(d.name)).filter((t) => t.length > 1)
    .sort((a, b) => -byDate(a.at(-1), b.at(-1)));
  const out = ['# 변경 이력 모아보기', '한 번 이상 바뀐 결정을 최근에 바뀐 순서로 모았습니다.'];
  for (const t of threads) {
    const now = t.at(-1);
    out.push(`## ${r.toPlace(file, now.name)}`, t.map((d, i) => `${i + 1}. ${[versionLabel(d.name), d.date].filter(Boolean).join(' · ')} ${r.toOriginal(file, d.name, d.title)}`).join('\n'));
  }
  if (!threads.length) out.push('바뀐 결정이 없습니다.');
  return out.join('\n\n');
}

function namesView(file, ctx, r, site) {
  const rows = [...ctx.store.atoms].sort((a, b) => (a.name < b.name ? -1 : 1))
    .map((d) => `| ${r.toOriginal(file, d.name, d.name)} | ${mdText(d.title)} | ${statusLabel(d.status)} | ${site.sectionOf(d.name) ? r.link(file, '본문', site.sectionOf(d.name)) : ''} |`);
  return ['# 이름 찾아보기', '코드 주석이나 문서에서 본 이름으로 찾습니다.', ['| 이름 | 제목 | 상태 | 본문 |', '|---|---|---|---|', ...rows].join('\n')].join('\n\n');
}

const VIEWS = [
  ['views/by-scope.md', '마일스톤별', scopeView],
  ['views/by-work.md', '작업 순서별', workView],
  ['views/changes.md', '변경 이력 모아보기', changesView],
  ['views/names.md', '이름 찾아보기', namesView],
];

function summaryPage(pages) {
  const out = ['# 목차', '', `* [${OPENING_TITLE}](README.md)`];
  let group = null;
  for (const p of pages) {
    if (p.group !== group) { out.push('', `## ${mdText(p.group)}`, ''); group = p.group; }
    out.push(`${'  '.repeat(p.depth)}* [${mdText(p.title)}](${relLink('SUMMARY.md', p.file)})`);
  }
  return out.join('\n') + '\n';
}

/** 부록의 쪽들: 원문을 읽는 법(관련 문서와 분해 기록) → Layer 묶음(결정 → 지난 버전). */
function appendixPages(ctx, site, r) {
  const originals = new Map(site.originals.map((o) => [o.name, o]));
  const order = new Map();
  for (const p of site.chapterPages) for (const n of p.chapter.atoms ?? []) if (!order.has(n)) order.set(n, order.size);
  const rank = (d) => (d.live ? 0 : 1);
  const groups = layerGroups(ctx.store, ctx.lineage).map((g) => ({
    ...g,
    file: g.doc ? originals.get(g.doc.name).file : `appendix/layers/${g.id}.md`,
    atoms: [...g.atoms].sort((a, b) => rank(a) - rank(b) || (order.get(a.name) ?? Infinity) - (order.get(b.name) ?? Infinity) || byDate(a, b)),
  }));
  const pages = [];
  const placed = new Set();
  const page = (file, title, depth, md, original = false) => pages.push({ file, title, group: APPENDIX_GROUP, depth, md, original });
  const original = (name, title, depth, extra) => { const o = originals.get(name); placed.add(name); page(o.file, title, depth, r.originalPage(o, extra), true); };

  page(APPENDIX_INDEX, '원문을 읽는 법', 0, appendixIndex(ctx, site, r, groups));
  for (const c of ctx.context) {
    original(c.versions.at(-1).name, site.labelOf(c.id), 1);
    for (const v of c.versions.slice(0, -1)) original(v.name, `${site.labelOf(c.id)} ${v.label || '이전 판'}`, 2);
  }
  for (const m of [...ctx.store.maps].sort(byDate)) original(m.name, m.title, 1);
  for (const g of groups) {
    if (g.doc) original(g.doc.name, r.groupTitle(g), 0, decisionList(g.file, g, r, site));
    else page(g.file, r.groupTitle(g), 0, [`# ${mdText(r.groupTitle(g))}`, g.level ? `layer가 ${g.level}이지만 part_of로 Layer 문서를 적지 않은 결정입니다.` : 'layer와 part_of를 적지 않은 결정입니다.', decisionList(g.file, g, r, site)].join('\n\n'));
    for (const d of g.atoms) {
      original(d.name, d.live ? site.labelOf(d.name) : `${site.labelOf(d.name)} (폐기)`, 1);
      for (const p of ctx.lineage.thread(d.name).slice(0, -1)) if (!placed.has(p.name)) original(p.name, r.pastTitle(p, d), 2);
    }
  }
  // 어디에도 매달리지 못한 원문(끝까지 폐기만 이어진 이력 등)도 빠뜨리지 않는다
  for (const o of site.originals) if (!placed.has(o.name)) original(o.name, o.title, 0);
  return pages;
}

export function buildMd(ctx) {
  const site = planSite(ctx);
  const assets = new Map();
  const r = makeRenderer(ctx, site, assets);
  const pages = site.chapterPages.map((p) => ({ file: p.file, title: p.title, group: p.partTitle, depth: 0, md: chapterPage(p, ctx, r, site) }));
  pages.push(...appendixPages(ctx, site, r));
  const views = VIEWS.map(([file, title, render]) => ({ file, title, group: VIEW_GROUP, depth: 0, md: render(file, ctx, r, site) })).filter((v) => v.md);
  pages.push(...views);
  const cover = { file: 'README.md', title: OPENING_TITLE, group: null, depth: 0, md: coverPage(ctx, site, r, views) };
  const all = [cover, ...pages];
  if (ctx.book.localNav !== false) {
    all.forEach((p, i) => {
      if (p === cover) return;
      const to = (q, label) => (q ? `[${mdText(label)}](${relLink(p.file, q.file)})` : '');
      const prev = all[i - 1];
      const next = all[i + 1];
      p.md = `${p.md.trimEnd()}\n\n---\n\n${[to(prev, `← ${prev.title}`), to(cover, '목차'), next ? to(next, `${next.title} →`) : ''].filter(Boolean).join(' · ')}\n`;
    });
  }
  const files = new Map(assets);
  for (const p of all) files.set(p.file, p.original ? p.md : tidy(p.md));
  files.set('SUMMARY.md', summaryPage(pages));
  files.set('.gitbook.yaml', 'root: ./\nstructure:\n  readme: README.md\n  summary: SUMMARY.md\n');
  publishDir(path.join(ctx.bookDir, 'md'), files);
  return all;
}
