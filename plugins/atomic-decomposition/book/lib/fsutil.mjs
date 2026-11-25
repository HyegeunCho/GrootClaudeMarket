// 파일 읽기·쓰기. 읽을 때는 LF·BOM 없음으로 맞추고, 쓸 때는 UTF-8·LF로 쓴다.
import fs from 'node:fs';
import path from 'node:path';

export const toPosix = (p) => p.replaceAll('\\', '/');
export const normalizeText = (s) => s.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
export const readText = (file) => normalizeText(fs.readFileSync(file, 'utf8'));

export function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

/** 이름순으로 파일 전체 경로를 내놓는다. skip에 든 폴더 이름은 들어가지 않는다. */
export function walkFiles(dir, skip = []) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!skip.includes(e.name)) out.push(...walkFiles(f, skip));
    } else if (e.isFile()) out.push(f);
  }
  return out;
}

const MARKER = '.atomic-book';
const NOTE = '# 책 만들기 도구가 만든 파일 목록입니다. 다시 만들 때 이 목록의 파일만 지우거나 덮어씁니다.';

const readList = (dir) => {
  const f = path.join(dir, MARKER);
  return new Set(fs.existsSync(f) ? readText(f).split('\n').filter((l) => l && !l.startsWith('#')) : []);
};
const writeList = (dir, names) => writeText(path.join(dir, MARKER), [NOTE, ...[...names].sort()].join('\n') + '\n');

/** 이 도구가 만들지 않은 파일이 있으면 이름을 알리고 멈춘다. */
export function assertOwned(dir) {
  if (!fs.existsSync(dir)) return;
  const owned = readList(dir);
  const strangers = walkFiles(dir).map((f) => toPosix(path.relative(dir, f))).filter((f) => f !== MARKER && !owned.has(f));
  if (!strangers.length) return;
  const more = strangers.length > 5 ? ` 외 ${strangers.length - 5}개` : '';
  throw new Error(`이 도구가 만들지 않은 파일이 있어 멈춥니다. 지우지 않았습니다: ${toPosix(dir)} 안의 ${strangers.slice(0, 5).join(', ')}${more}`);
}

/**
 * 폴더의 내용을 files(상대 경로 → 글이나 바이트)와 같게 만든다.
 * 도중에 실패해도 다시 만들 수 있도록, 쓰기 전에 목록부터 적는다.
 * 폴더를 통째로 지우지 않는다. (Windows의 Node는 한글 경로에서 rmSync가 죽는다)
 */
export function publishDir(dir, files) {
  assertOwned(dir);
  const old = readList(dir);
  writeList(dir, new Set([...old, ...files.keys()]));
  for (const name of old) {
    if (files.has(name)) continue;
    const f = path.join(dir, name);
    if (fs.existsSync(f)) fs.unlinkSync(f);
    for (let d = path.dirname(f); d !== dir && d.startsWith(dir); d = path.dirname(d)) {
      try { fs.rmdirSync(d); } catch { break; } // 비어 있지 않거나 쓰는 중이면 둔다
    }
  }
  for (const [name, data] of files) {
    const f = path.join(dir, name);
    const next = Buffer.from(data);
    if (fs.existsSync(f) && fs.readFileSync(f).equals(next)) continue;
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, next);
  }
  writeList(dir, files.keys());
}
