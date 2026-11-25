// 테스트 공용 도구. 예제 저장소를 임시 폴더로 복사해 쓰고, 원본 예제는 바꾸지 않는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FIX = path.join(HERE, 'fixtures', 'project');
export const CLI = path.join(HERE, '..', 'cli.mjs');
export const ATOMS = 'docs/atomic/atoms/';

const made = [];
process.on('exit', () => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });

export function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-book-'));
  made.push(dir);
  return dir;
}

/** 폴더를 통째로 복사한다. */
export function copyTo(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const [a, b] = [path.join(from, e.name), path.join(to, e.name)];
    if (e.isDirectory()) copyTo(a, b);
    else fs.copyFileSync(a, b);
  }
}

/** 예제 프로젝트의 임시 복사본. mutate(복사본 경로)로 파일을 바꿀 수 있다. */
export function copyProject(mutate) {
  const dir = tempDir();
  copyTo(FIX, dir);
  if (mutate) mutate(dir);
  return dir;
}

export const rootOf = (project) => path.join(project, 'docs', 'atomic');
export const read = (project, rel) => fs.readFileSync(path.join(project, rel), 'utf8').replace(/\r\n/g, '\n');
export const exists = (project, rel) => fs.existsSync(path.join(project, rel));
export function write(project, rel, text) {
  const f = path.join(project, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
}
export function edit(project, rel, fn) {
  const before = read(project, rel);
  const after = fn(before);
  if (after === before) throw new Error(`edit가 아무것도 바꾸지 않았다: ${rel}`);
  write(project, rel, after);
}

/** 폴더 전체 내용의 해시. skip에 든 이름은 뺀다. */
export function hashTree(dir, skip = []) {
  const h = crypto.createHash('sha256');
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (skip.includes(e.name)) continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else h.update(path.relative(dir, f).replaceAll('\\', '/')).update('\0').update(fs.readFileSync(f)).update('\0');
    }
  };
  walk(dir);
  return h.digest('hex');
}

export function runCli(...args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
