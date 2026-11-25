// 글 안의 링크를 다룬다. 코드(울타리 블록, 들여쓴 코드, 백틱) 안은 건드리지 않는다.
import path from 'node:path';

/** 울타리를 여는 줄이면 울타리 글자열을 돌려준다. 백틱 울타리의 뒤에는 백틱이 올 수 없다. */
export function fenceOpen(line) {
  const m = line.match(/^\s*(?:>\s?)*\s*(?:(`{3,})([^`\n]*)|(~{3,}).*)\s*$/);
  return m ? m[1] ?? m[3] : null;
}

const fenceClose = (line, fence) => {
  const m = line.match(/^\s*(?:>\s?)*\s*(`{3,}|~{3,})\s*$/);
  return Boolean(m) && m[1][0] === fence[0] && m[1].length >= fence.length;
};

const BLANK = /^\s*$/;
const LIST_ITEM = /^\s{0,3}(?:[-*+]|\d{1,9}[.)])\s/;
// 백틱 짝이 넘을 수 없는 줄: 목록, 제목, 표, 인용
const BLOCK_START = /^\s*(?:[-*+]\s|\d{1,9}[.)]\s|#{1,6}\s|\||>)/;

/** 글을 코드와 코드 아닌 조각으로 나눈다. 조각을 이으면 원래 글이다. */
export function splitCode(text) {
  const parts = [];
  const push = (code, s) => { if (s) parts.push({ code, text: s }); };
  let para = '';
  const flush = () => {
    let last = 0;
    for (const m of para.matchAll(/(?<!`)(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g)) {
      push(false, para.slice(last, m.index));
      push(true, m[0]);
      last = m.index + m[0].length;
    }
    push(false, para.slice(last));
    para = '';
  };
  const lines = text.split(/(?<=\n)/);
  let fence = null;
  let block = '';
  let inList = false;
  let afterBlank = true;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fence) {
      block += line;
      if (fenceClose(line, fence)) { push(true, block); fence = null; block = ''; afterBlank = false; }
      continue;
    }
    const open = fenceOpen(line);
    if (open) { flush(); fence = open; block = line; continue; }
    if (BLANK.test(line)) { flush(); push(false, line); afterBlank = true; continue; }
    if (afterBlank && !inList && /^(?: {4}|\t| {1,3}\t)/.test(line)) {
      flush();
      let code = line;
      while (i + 1 < lines.length && /^(?: {4}|\t| {1,3}\t)\s*\S/.test(lines[i + 1])) code += lines[++i];
      push(true, code);
      afterBlank = false;
      continue;
    }
    if (LIST_ITEM.test(line)) inList = true;
    else if (/^#{1,6}\s/.test(line) || (afterBlank && /^\S/.test(line))) inList = false;
    if (BLOCK_START.test(line)) flush();
    para += line;
    afterBlank = false;
  }
  flush();
  push(true, block);
  return parts;
}

export const mapOutsideCode = (text, fn) => splitCode(text).map((p) => (p.code ? p.text : fn(p.text))).join('');
export const outsideCode = (text) => splitCode(text).filter((p) => !p.code).map((p) => p.text).join(' ');

/** 일부 글을 자리표시 글자로 감췄다가 되돌린다. */
function masker() {
  const kept = [];
  return {
    hide: (s) => `${kept.push(s) - 1}`,
    restore: (s) => { let out = s; while (/\d+/.test(out)) out = out.replace(/(\d+)/g, (_, i) => kept[Number(i)]); return out; },
  };
}

function maskCode(text, m) {
  return splitCode(text).map((p) => (p.code ? m.hide(p.text) : p.text.replace(/<!--[\s\S]*?-->/g, m.hide))).join('');
}

function closing(s, start, open, close) {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '\\') i++;
    else if (s[i] === '\n' && s[i + 1] === '\n') return -1;
    else if (s[i] === open) depth++;
    else if (s[i] === close && --depth === 0) return i;
  }
  return -1;
}

/** start의 `[`부터 `[글](주소 "설명")`을 읽는다. */
function parseLink(s, start) {
  const end = closing(s, start, '[', ']');
  if (end < 0 || s[end + 1] !== '(') return null;
  let i = end + 2;
  while (s[i] === ' ') i++;
  let dest;
  if (s[i] === '<') {
    const e = s.indexOf('>', i);
    if (e < 0 || s.slice(i, e).includes('\n')) return null;
    dest = s.slice(i + 1, e);
    i = e + 1;
  } else {
    const from = i;
    let depth = 0;
    for (; i < s.length; i++) {
      if (/\s/.test(s[i])) break;
      if (s[i] === '(') depth++;
      else if (s[i] === ')' && depth-- === 0) break;
    }
    dest = s.slice(from, i);
  }
  const tail = s.slice(i).match(/^\s*(?:"[^"]*"|'[^']*'|\([^()]*\))?\s*\)/);
  return tail ? { label: s.slice(start + 1, end), labelEnd: end, dest, end: i + tail[0].length } : null;
}

function replaceLinks(s, fn) {
  let out = '';
  for (let i = 0; i < s.length;) {
    if (s[i] === '\\') { out += s.slice(i, i + 2); i += 2; continue; }
    const image = s[i] === '!' && s[i + 1] === '[';
    const hit = image || s[i] === '[' ? parseLink(s, image ? i + 1 : i) : null;
    if (hit) {
      out += fn({ image, label: replaceLinks(hit.label, fn), dest: hit.dest, raw: s.slice(i, hit.end), tail: s.slice(hit.labelEnd + 1, hit.end) });
      i = hit.end;
    } else out += s[i++];
  }
  return out;
}

const WIKI = /(?<!\\)(!?)\[\[([^[\]\n|]+)(?:\|([^[\]\n]+))?\]\](\(?)/g;
// 참조 정의: 주소 하나와 (있으면) 따옴표 설명으로 줄이 끝나야 한다. 각주([^1]:)는 아니다.
const DEFINITION = /^( {0,3})\[(?!\^)([^\]\n]+)\]:[ \t]*(\S+)[ \t]*("[^"\n]*"|'[^'\n]*')?[ \t]*$/gm;
const A_TAG = /<a\b([^<>]*?)\s+href\s*=\s*("[^"]*"|'[^']*'|[^\s"'<>]+)([^<>]*)>/gi;
const IMG_TAG = /<img\b([^<>]*?)\s+src\s*=\s*("[^"]*"|'[^']*'|[^\s"'<>]+)([^<>]*)>/gi;
const AUTOLINK = /<([a-z][a-z0-9+.-]{1,31}:[^\s<>]*)>/gi;

const unquote = (s) => s.replace(/^(["'])([\s\S]*)\1$/, '$2');

/** 주소처럼 생겼는가. `[한도](30)`, `[이름](가칭)`처럼 대괄호 이름 뒤에 괄호 글이 온 것은 링크가 아니라 글이다. */
export const looksLikeAddress = (dest) =>
  /^<.*>$/.test(dest) ||
  /^[a-z][a-z0-9+.-]*:/i.test(dest.trim()) ||
  /^(?:\.{1,2}(?:[\\/]|$)|[\\/#])/.test(dest.trim()) ||
  /\.[A-Za-z][A-Za-z0-9]{0,4}(?:[?#].*)?$/.test(dest) ||
  /^[\x21-\x7e]*\/[\x21-\x7e]*$/.test(dest);

/** 웹 주소는 그대로, 상대 경로는 찾아보고, 나머지(절대 경로·쪽 안 앵커·그 밖의 주소)는 링크로 남기지 않는다. */
export function linkKind(dest) {
  const d = dest.replace(/[\t\n\r]/g, '').replace(/^[\u0000- ]+|[\u0000- ]+$/g, '');
  if (/^(https?:|mailto:)/i.test(d)) return 'web';
  if (d === '' || /^[a-z][a-z0-9+.-]*:/i.test(d) || /^[\\/#]/.test(d)) return 'none';
  return 'local';
}

export const localPath = (dest) => {
  const p = dest.replace(/[?#].*$/, '');
  try { return decodeURIComponent(p); } catch { return p; }
};

const encodeSegment = (s) => (s === '..' || s === '.' ? s : encodeURIComponent(s).replace(/[()'!*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`));

/** 책 폴더 기준 경로 둘 사이의 상대 링크. */
export function relLink(fromFile, toFile, anchor = '') {
  const hash = anchor ? `#${anchor}` : '';
  if (fromFile === toFile && hash) return hash;
  return path.posix.relative(path.posix.dirname(fromFile), toFile).split('/').map(encodeSegment).join('/') + hash;
}

/** 부록 원문의 링크를 책 안에서 통하게 바꾼다. 링크 표기 말고는 바꾸지 않는다. */
export function rewriteOriginal(text, { fromFile, resolveWiki, resolvePath, copyAsset }) {
  const target = (dest, image) => {
    const kind = linkKind(dest);
    if (kind === 'web') return dest;
    if (kind === 'none') return null;
    const p = localPath(dest);
    const page = image ? null : resolvePath(p);
    if (page) return relLink(fromFile, page.file, page.anchor);
    const asset = copyAsset(p);
    return asset ? relLink(fromFile, asset) : null;
  };
  const m = masker();
  // `[[이름]](글)`의 괄호 글을 링크 주소로 잘못 읽지 않도록 이름 링크를 먼저 떼어 낸다
  let s = maskCode(text, m).replace(WIKI, (raw, bang, name, label, paren) => {
    const page = resolveWiki(name.trim());
    if (page) return m.hide(`[${label ?? name.trim()}](${relLink(fromFile, page.file, page.anchor)})`) + paren;
    const kept = paren ? raw.slice(0, -1).replace('[[', '\\[\\[').replace(']]', '\\]\\]') : raw;
    return m.hide(kept) + paren;
  });
  s = s.replace(DEFINITION, (raw, indent, id, dest, title) => {
    if (!looksLikeAddress(dest)) return raw;
    const t = target(dest.replace(/^<(.*)>$/, '$1'), false);
    if (t === null) return `${indent}\\[${id}]: ${dest}${title ? ` ${title}` : ''}`;
    return t === dest ? raw : `${indent}[${id}]: ${t}`;
  });
  s = replaceLinks(s, ({ image, label, dest, raw, tail }) => {
    if (!looksLikeAddress(dest)) return `${image ? '!' : ''}\\[${label}\\]${tail}`;
    const t = target(dest, image);
    if (t === null) return label;
    return t === dest ? raw : `${image ? '!' : ''}[${label}](${t})`;
  });
  s = s.replace(A_TAG, (raw, a, dest, b) => { const t = target(unquote(dest), false); return t === null ? `<a${a}${b}>` : `<a${a} href="${t}"${b}>`; });
  s = s.replace(IMG_TAG, (raw, a, dest, b) => `<img${a} src="${target(unquote(dest), true) ?? ''}"${b}>`);
  s = s.replace(AUTOLINK, (raw, dest) => (linkKind(dest) === 'web' ? raw : dest));
  return m.restore(s);
}

/** 원고의 `[[name]]`을 바꾼다. */
export const replaceWiki = (text, fn) => mapOutsideCode(text, (s) => s.replace(WIKI, (raw, bang, name, label, paren) => fn(name.trim(), label) + paren));

/** 주소가 아닌 괄호 글이 링크로 읽히지 않게 대괄호를 이스케이프한다. */
export function escapeFakeLinks(text) {
  const m = masker();
  return m.restore(replaceLinks(maskCode(text, m).replace(WIKI, (raw, bang, name, label, paren) => m.hide(paren ? raw.slice(0, -1) : raw) + paren), ({ image, label, dest, raw, tail }) => (looksLikeAddress(dest) ? raw : `${image ? '!' : ''}\\[${label}\\]${tail}`)));
}

/** 글에 든 링크 주소를 모두 찾는다. 보는 도구가 링크로 읽을 것을 찾으므로 이름 링크를 떼어 내지 않는다. */
export function findLinks(text) {
  const out = [];
  const masked = maskCode(text, masker());
  const s = replaceLinks(masked, ({ image, dest }) => { out.push({ image, dest }); return ''; });
  for (const d of masked.matchAll(DEFINITION)) if (looksLikeAddress(d[3])) out.push({ image: false, dest: d[3].replace(/^<(.*)>$/, '$1') });
  for (const t of s.matchAll(A_TAG)) out.push({ image: false, dest: unquote(t[2]) });
  for (const t of s.matchAll(IMG_TAG)) out.push({ image: true, dest: unquote(t[2]) });
  for (const t of s.matchAll(AUTOLINK)) out.push({ image: false, dest: t[1] });
  return out;
}

/** 링크 글이나 표 칸에 넣을 글. */
export const mdText = (s) => String(s).replace(/([\\[\]<>*`|~])/g, '\\$1').replace(/\s+/g, ' ').trim();
