#!/usr/bin/env node
// 책 만들기 도구. 종료 코드: 0 성공, 1 검사 실패, 2 사용법·준비 오류
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readText, writeText, toPosix } from './lib/fsutil.mjs';
import { loadStore, findStores } from './lib/store.mjs';
import { buildLineage, buildRelations } from './lib/lineage.mjs';
import { findCandidates, findUnsupported, inside } from './lib/context.mjs';
import { readBook, readState, writeState, chapters, validateOutline, openBook } from './lib/bookfile.mjs';
import { renderBundle, bundleHash, chapterStatus, diffLines, manuscriptFile, hash } from './lib/bundle.mjs';
import { renderInventory } from './lib/inventory.mjs';
import { checkBook, checkBuilt, formatFindings } from './lib/check.mjs';
import { buildMd } from './lib/build-md.mjs';

const USAGE = `사용법: node cli.mjs <명령> [옵션]
  stores --project <폴더>                              Atom 저장소를 찾는다
  scan   --root <저장소> --project <폴더> --out <책>    목록·이력·컨텍스트 후보를 모은다
  bundle --out <책> [--only <부·장>]                   장별 원문 발췌를 만들고 상태를 알린다
  record --out <책> --chapter <부/장> --written         원고를 썼음을 기록한다
  record --out <책> --chapter <부/장> --review <json>   대조 결과를 기록한다
  check  --out <책>                                    원고와 md를 검사한다
  build  --out <책>                                    md를 만든다`;

class UsageError extends Error {}
const fail = (message) => { throw new UsageError(message); };
const need = (opt, ...keys) => { for (const k of keys) if (!opt[k]) fail(`--${k}가 필요합니다\n\n${USAGE}`); };
const abs = (p) => path.resolve(p);
const workFile = (ctx, kind, key) => path.join(ctx.bookDir, '.work', kind, `${key}.md`);

function warnOutline(ctx) {
  const r = validateOutline(ctx.book, ctx.store, ctx.context);
  const label = { missing: '목차에 없는 결정', duplicate: '두 번 나오는 결정', unknown: '저장소에 없는 이름', archived: 'archived인데 현행 자리에 있는 결정' };
  for (const [k, text] of Object.entries(label)) if (r[k].length) console.error(`[목차] ${text}: ${r[k].join(', ')}`);
  for (const p of r.problems) console.error(`[목차] ${p}`);
  for (const p of ctx.contextProblems) console.error(`[컨텍스트] ${p.file}: ${p.message}`);
  for (const p of ctx.store.problems) console.error(`[저장소] ${p.file}: ${p.message}`);
  return r;
}

function report(findings) {
  console.log(formatFindings(findings));
  return findings.some((f) => f.level === 'error') ? 1 : 0;
}

const commands = {
  stores(opt) {
    need(opt, 'project');
    for (const s of findStores(abs(opt.project))) console.log(toPosix(s));
  },

  scan(opt) {
    need(opt, 'root', 'project', 'out');
    const root = abs(opt.root);
    const project = abs(opt.project);
    const out = abs(opt.out);
    if (!fs.existsSync(path.join(root, '_jit_manifest.json'))) fail(`저장소가 아닙니다: ${root}`);
    if (inside(out, root)) fail(`책 폴더가 저장소 안에 있습니다. 저장소 밖으로 정하세요: ${out}`);
    const store = loadStore(root);
    const lineage = buildLineage(store);
    const relations = buildRelations(store, lineage);
    const book = readBook(out);
    const candidates = findCandidates(store, project);
    const unsupported = findUnsupported(store, project);
    const inventory = renderInventory({ store, lineage, relations, candidates, unsupported, book, bookDir: out, project });
    writeText(path.join(out, '.work', 'inventory.json'), JSON.stringify(inventory.data, null, 2) + '\n');
    writeText(path.join(out, '.work', 'inventory.md'), inventory.markdown);
    if (!fs.existsSync(path.join(out, '.gitignore'))) writeText(path.join(out, '.gitignore'), '.work/\n');
    const c = inventory.data.counts;
    console.log(`현행 ${c.live}건, 과거 ${c.archived}건, Layer ${c.layers}건, 분해 기록 ${c.maps}건`);
    console.log(`컨텍스트 후보 ${candidates.length}건${book ? ` (새 후보 ${inventory.data.newCandidates.length}건)` : ''}, 책 밖 이름 ${relations.external.size}건, 문제 ${store.problems.length}건`);
    console.log(`목록: ${toPosix(path.join(out, '.work', 'inventory.md'))}`);
  },

  bundle(opt) {
    need(opt, 'out');
    const ctx = openBook(abs(opt.out));
    warnOutline(ctx);
    let list = [...chapters(ctx.book)];
    if (opt.only) {
      list = list.filter((e) => [e.part.id, e.part.title, e.key, e.chapter.id, e.chapter.title].includes(opt.only));
      if (!list.length) fail(`"${opt.only}"에 맞는 부나 장이 없습니다. 부: ${ctx.book.parts.map((p) => `${p.id}(${p.title})`).join(', ')}`);
    }
    for (const e of list) {
      const text = renderBundle(e, ctx);
      const status = chapterStatus(e, ctx);
      writeText(workFile(ctx, 'bundles', e.key), text);
      console.log(`${status.padEnd(10)} ${e.key}  ${e.chapter.title}  (발췌 ${text.length}자)`);
      const written = workFile(ctx, 'written', e.key);
      if (status !== 'rewrite' || !fs.existsSync(written)) continue;
      const changes = workFile(ctx, 'changes', e.key);
      writeText(changes, diffLines(readText(written), text));
      console.log(`           바뀐 곳: ${toPosix(changes)}`);
    }
  },

  record(opt) {
    need(opt, 'out', 'chapter');
    if (!opt.written && !opt.review) fail('--written이나 --review가 필요합니다');
    const ctx = openBook(abs(opt.out));
    const entry = [...chapters(ctx.book)].find((e) => e.key === opt.chapter) ?? fail(`장이 없습니다: ${opt.chapter}`);
    const file = manuscriptFile(ctx.bookDir, entry.key);
    if (!fs.existsSync(file)) fail(`원고가 없습니다: ${toPosix(file)}`);
    const state = readState(ctx.bookDir);
    const bundle = workFile(ctx, 'bundles', entry.key);
    if (!fs.existsSync(bundle)) fail(`발췌가 없습니다. 먼저 bundle을 실행하세요: ${toPosix(bundle)}`);
    const used = readText(bundle); // 지금 저장소가 아니라 쓰고 대조할 때 본 발췌를 기록한다
    const record = { ...state.chapters[entry.key], bundleHash: bundleHash(used) };
    if (opt.review) {
      let r;
      try { r = JSON.parse(readText(abs(opt.review))); } catch (e) { fail(`대조 결과를 읽을 수 없습니다: ${e.message}`); }
      if (!Array.isArray(r.unresolved)) fail('대조 결과에 unresolved 배열이 필요합니다 (남은 지적이 없으면 [])');
      if (!['agent', 'self'].includes(r.by)) fail('대조 결과의 by는 agent나 self입니다');
      record.review = { bundleHash: bundleHash(used), manuscriptHash: hash(readText(file)), by: r.by, rounds: Number(r.rounds) || 1, unresolved: r.unresolved };
    }
    writeText(workFile(ctx, 'written', entry.key), used);
    state.chapters[entry.key] = record;
    writeState(ctx.bookDir, state);
    console.log(`${chapterStatus(entry, { ...ctx, state })} ${entry.key}`);
  },

  check(opt) {
    need(opt, 'out');
    const ctx = openBook(abs(opt.out));
    return report([...checkBook(ctx), ...checkBuilt(ctx)]);
  },

  build(opt) {
    need(opt, 'out');
    const ctx = openBook(abs(opt.out));
    warnOutline(ctx);
    const pages = buildMd(ctx);
    console.log(`md ${pages.length}쪽: ${toPosix(path.join(ctx.bookDir, 'md'))}`);
    return report(checkBuilt(ctx));
  },
};

try {
  const [name, ...rest] = process.argv.slice(2);
  if (!Object.hasOwn(commands, name ?? '')) fail(USAGE);
  const { values } = parseArgs({
    args: rest,
    options: {
      project: { type: 'string' }, root: { type: 'string' }, out: { type: 'string' }, only: { type: 'string' },
      chapter: { type: 'string' }, written: { type: 'boolean' }, review: { type: 'string' },
    },
  });
  process.exitCode = (await commands[name](values)) ?? 0;
} catch (e) {
  console.error(e instanceof UsageError || !process.env.DEBUG ? e.message : e);
  process.exitCode = 2;
}
