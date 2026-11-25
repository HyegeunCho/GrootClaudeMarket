# atomic-decomposition 책 만들기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **2026-03-25 변경 (사용자 결정):** HTML 생성(Task 7, Task 9의 HTML 확인, `marked` 내장)을 뺀다. 스킬은 md까지만 만들고 빌드는 안내한다. 아래의 HTML 관련 내용은 기록으로 남긴다.

**Goal:** `/atomic-decomposition:book` 커맨드로 Atom 저장소와 컨텍스트 문서를 사람이 읽는 책(GitBook용 md + 로컬 HTML)으로 만든다.

**Architecture:** Claude는 장 원고(`manuscript/`)만 쓴다. Node 스크립트(`book/cli.mjs`)가 저장소를 읽어 이력·관계를 계산하고, 장별 원문 발췌를 만들고, 원고를 검사하고, md와 HTML을 생성한다. 커맨드 md가 이 둘을 순서대로 부르고, 장마다 새 에이전트에게 원문 대조를 시킨다.

**Tech Stack:** Node 20+ (ESM, 내장 모듈만), `node --test`, 내장한 `marked` 18.1.3.

**Spec:** [docs/superpowers/specs/2026-03-24-atomic-book-design.md](../specs/2026-03-24-atomic-book-design.md)

## Global Constraints

- Node 20 이상. 사용자가 npm 설치를 하지 않는다. 외부 라이브러리는 `book/vendor/marked/`의 `marked.esm.js` 18.1.3과 `LICENSE`뿐이다.
- 원본 저장소(`<root>`)와 컨텍스트 문서에 아무것도 쓰지 않는다.
- 쓰는 곳은 `atomic-book/` 안뿐이다. 지우는 곳은 표식 파일 `.atomic-book`이 있는 `md/`, `html/`뿐이다.
- 모든 텍스트는 읽을 때 LF로 바꾸고 UTF-8(BOM 없음)·LF로 쓴다. 책 안의 경로는 `/`를 쓴다.
- md·html의 로컬 링크는 모두 상대 경로다. HTML은 `fetch`, 모듈 스크립트, 외부 주소의 자원을 쓰지 않는다.
- 원문이 같으면 결과물도 같다. 현재 시각을 넣지 않는다.
- 사용자에게 보이는 글(커맨드, 지침, 책의 고정 문구, CLI 메시지)은 한국어다.
- 이 저장소의 `plugins/clean-architecture-ddd/commands/*.md`와 같은 프론트매터(`description`, `argument-hint`)를 쓴다.
- 커밋은 사용자가 요청할 때만 한다. 작업마다 "전체 테스트 통과"를 체크포인트로 삼는다.

전체 테스트: `node --test plugins/atomic-decomposition/book/test/`

## Review Focus

1. 컨텍스트 문서 경로에 공백·한글·괄호가 있음 → 링크가 인코딩되어 md·html 모두에서 열린다. (Task 6)
2. 원문에 `<script>`나 `List<int>` 같은 날 HTML이 있음 → HTML에서 실행되거나 사라지지 않고 글자로 보인다. (Task 7)
3. 코드 안에 `[[...]]`, `{{`, `](C:\...)`가 있음 → 바꾸지 않고, 오류로도 잡지 않는다. (Task 5, 6)
4. 프론트매터가 없거나 `name`이 겹치는 파일, 서로를 가리키는 `conflicts_with` → 멈추지 않고 문제로 보고한 뒤 나머지로 진행한다. (Task 1, 2)
5. `--out`이나 `md/`에 사용자가 넣은 파일이 있음 → 지우지 않고 멈춘다. (Task 6)

## 파일 구성

```
plugins/atomic-decomposition/
├── commands/book.md                 # 절차 (Task 8)
└── book/
    ├── cli.mjs                      # stores | scan | bundle | record | check | build
    ├── lib/
    │   ├── store.mjs                # 저장소 읽기 (1)
    │   ├── lineage.mjs              # 이력·관계 (2)
    │   ├── context.mjs              # 컨텍스트 문서 (3)
    │   ├── bookfile.mjs             # book.json, book.state.json, openBook (3)
    │   ├── bundle.mjs               # 원문 발췌, 장 상태 (4)
    │   ├── manuscript.mjs           # 원고 읽기 (4)
    │   ├── check.mjs                # 원고·결과물 검사 (5, 6)
    │   ├── links.mjs                # 링크 변환 (6)
    │   ├── graph.mjs                # 관계 그림 (6 Mermaid, 7 SVG)
    │   ├── build-md.mjs             # md 결과물 (6)
    │   ├── build-html.mjs           # HTML 결과물 (7)
    │   └── fsutil.mjs               # 읽기·쓰기·폴더 초기화 (1, 6)
    ├── guides/{outline,editing,review}.md   # (8)
    ├── assets/{book.css,book.js}    # (7)
    ├── vendor/marked/               # (7)
    └── test/{*.test.mjs, fixtures/project/}
```

---

### Task 1: 저장소 읽기와 예제 저장소

**Files:**
- Create: `book/lib/store.mjs`, `book/lib/fsutil.mjs`, `book/test/store.test.mjs`, `book/test/fixtures/project/**`

**Interfaces:**
- Produces:
  - `readText(file): string` (LF, BOM 제거), `writeText(file, text)` (폴더 생성), `toPosix(p)` — `fsutil.mjs`
  - `parseFrontmatter(text): { data: Record<string, string|string[]>, body: string, raw: string|null }`
  - `splitSections(body): { head: string, sections: { heading, key, text }[] }` — `key`는 `## ` 뒤 첫 단어
  - `findStores(projectRoot): string[]` — `node_modules`, `.git`, `Library`, `Temp`, `build`, `dist` 제외
  - `loadStore(root): Store` = `{ root, docs: Map<string, Doc>, atoms: Doc[], layers: Doc[], maps: Doc[], problems: { code, file, message }[] }`
  - `Doc` = `{ name, kind: 'atom'|'layer'|'map', type, layer, category, milestone, status, title, created, updated, decided, date, live, file, rel, text, body, data, head, sections, summary, relations, source, atoms }`
    - `date`: `decided`가 `YYYY-MM-DD`면 그것, 아니면 `created`. `live`: `status !== 'archived'`
    - `summary`: `**한 문장 요약**: ` 뒤의 글. concept은 Definition 줄의 글
    - `relations`: `derives_from | affects | requires | conflicts_with | is_a | part_of`마다 이름 배열. 프론트매터 목록과 `## Relations`의 `[[...]]`를 합치고 중복 제거
  - `problems.code`: `no-frontmatter`, `no-name`, `dup-name`

예제 저장소 `fixtures/project/`(모든 Task가 공유):

| 파일 | 담는 경우 |
| :--- | :--- |
| `docs/atomic/_jit_manifest.json`, `_templates/atom-rule.md` | 표식, 템플릿 제외 확인 |
| `atoms/decisions/loan_limit_decision_v1~v3.md` | v1·v2 archived, 프론트매터 `conflicts_with`. v3는 CRLF, 예외 있음, 코드 안 `[[...]]` |
| `atoms/concepts/concept_loan_item_v1~v2.md` | Relations에만 적힌 `conflicts_with` |
| `atoms/rules/notice_mail_only_rule_v1.md` (archived) | `notice_time_rule_v1`, `notice_no_sms_rule_v1` 둘이 대체 |
| `atoms/rules/loan_return_rule_v1~v2.md` | v1 archived, v2에 `conflicts_with` 없음 |
| `atoms/rnd/loan_fee_values_rnd_v1.md` | pending, Invalidation, `[확인 필요: 판정 기준]`, 수치 3.5·8 |
| `atoms/rnd/loan_dropped_rnd_v1.md` | archived, 후속 없음 |
| `atoms/rules/notice_feedback_v1.md` | `type: feedback`, `[[outside_rule_v1]]`(책 밖) |
| `layers/L0_vision.md`, `layers/L1_loan_system.md` | Layer |
| `maps/2026-03-17_baseline.md`(`name: map_20260317_baseline`), `maps/2026-03-21_fees.md` | 파일명과 `name`이 다름 |
| `docs/Plan_v1.md`, `docs/Plan_v2.md` | 버전 있는 기획서. 책 안·책 밖 상대 링크, 이미지, 절대 경로 링크, 날 HTML, `{%` |
| `docs/안내문 프롬프트 (초안).md`, `docs/img/map.png`, `CLAUDE.md` | 공백·한글·괄호 경로, 이미지, 지침 |

- [ ] **Step 1: 예제 저장소를 만들고 실패하는 테스트를 쓴다**

```js
const store = loadStore(FIX + '/docs/atomic');
test('유형별로 읽고 템플릿은 뺀다', () => {
  assert.equal(store.atoms.length, 13); assert.equal(store.layers.length, 2); assert.equal(store.maps.length, 2);
  assert.equal(store.docs.has('map_20260317_baseline'), true);
});
test('CRLF·따옴표·줄 끝 주석을 읽는다', () => {
  const d = store.docs.get('loan_limit_decision_v3');
  assert.equal(d.status, 'draft'); assert.equal(d.text.includes('\r'), false); assert.equal(d.date, '2026-03-21');
});
test('관계는 프론트매터와 Relations의 합집합이다', () => {
  assert.deepEqual(store.docs.get('concept_loan_item_v2').relations.conflicts_with, ['concept_loan_item_v1']);
});
test('[Review Focus 4] 깨진 파일은 문제로 보고하고 나머지를 읽는다', () => {
  const s = loadStore(brokenCopy()); // 프론트매터 없는 파일 1, name이 겹치는 파일 1을 더한 임시 복사본
  assert.deepEqual(s.problems.map(p => p.code).sort(), ['dup-name', 'no-frontmatter']); assert.equal(s.atoms.length, 13);
});
```

- [ ] **Step 2: 실패 확인** — `node --test plugins/atomic-decomposition/book/test/store.test.mjs` → `Cannot find module`
- [ ] **Step 3: `fsutil.mjs`, `store.mjs` 구현** — YAML은 스칼라, 따옴표, ` #` 주석, `  - ` 목록, `[a, b]` 목록만 읽는다. 겹친 `name`은 경로 순서에서 먼저인 것을 쓴다.
- [ ] **Step 4: 통과 확인** — 같은 명령, 실패 0

---

### Task 2: 이력과 관계

**Files:**
- Create: `book/lib/lineage.mjs`, `book/test/lineage.test.mjs`

**Interfaces:**
- Consumes: `Store`, `Doc`
- Produces:
  - `buildLineage(store): { prev: Map<string,string[]>, next: Map<string,string[]>, thread(name): Doc[], orphans: Doc[] }` — `thread`는 조상 전부와 자신을 오래된 순(`date`, 그다음 버전 번호, 그다음 이름)으로
  - `buildRelations(store, lineage): { out: Map<string,{rel,to}[]>, in: Map<string,{rel,from}[]>, clashes: {from,to}[], external: Map<string,string[]> }` — `out`·`in`은 저장소 안 문서 사이의 `derives_from | affects | requires | part_of`. `external`은 책 밖 이름 → 가리키는 문서들(코드 안의 `[[...]]`는 세지 않음)

- [ ] **Step 1: 실패하는 테스트**

```js
test('버전 사슬', () => assert.deepEqual(L.thread('loan_limit_decision_v3').map(d => d.name.slice(-2)), ['v1','v2','v3']));
test('Relations에만 적힌 대체', () => assert.deepEqual(L.prev.get('concept_loan_item_v2'), ['concept_loan_item_v1']));
test('하나가 둘로 갈라짐', () => assert.deepEqual([...L.next.get('notice_mail_only_rule_v1')].sort(), ['notice_time_rule_v1','notice_no_sms_rule_v1']));
test('conflicts_with가 없으면 같은 이름의 다음 버전', () => assert.deepEqual(L.next.get('loan_return_rule_v1'), ['loan_return_rule_v2']));
test('후속 없는 폐기', () => assert.deepEqual(L.orphans.map(d => d.name), ['loan_dropped_rnd_v1']));
test('현행끼리의 충돌은 이력이 아니다', () => { const r = buildRelations(liveClash(), buildLineage(liveClash())); assert.equal(r.clashes.length, 1); });
test('책 밖 이름', () => assert.deepEqual([...R.external.keys()], ['outside_rule_v1']));
test('[Review Focus 4] 서로를 가리켜도 끝난다', () => assert.equal(buildLineage(cyclic()).thread('a_v1').length, 2));
```

- [ ] **Step 2: 실패 확인** → **Step 3: 구현**(방문 집합으로 순환을 끊는다) → **Step 4: 통과 확인**

---

### Task 3: 컨텍스트 문서, 책 설정, scan

**Files:**
- Create: `book/lib/context.mjs`, `book/lib/bookfile.mjs`, `book/cli.mjs`, `book/test/context.test.mjs`, `book/test/bookfile.test.mjs`

**Interfaces:**
- Produces:
  - `findCandidates(store, projectRoot): { id, title, kind, mode, chars, mentions, versions: {label, path}[] }[]` — `path`는 `projectRoot` 기준
  - `loadContext(book, bookDir): { docs: ContextDoc[], problems }`, `ContextDoc` = `{ id, title, kind, mode, versions: { label, name, file, ext, text, current }[] }`, `name` = `context_<id>_<label>`
  - `readBook(dir)`(없으면 `null`, 스키마가 다르면 던짐), `writeBook`, `readState`, `writeState`
  - `chapters(book)`: `{ part, chapter, key: '<part>/<chapter>' }`를 순서대로 내놓는 제너레이터
  - `validateOutline(book, store, context): { missing, duplicate, unknown, archived, problems }` — 이름 배열들. 장의 `atoms`에는 현행만 둔다. 후속 없는 폐기는 장의 `dropped` 배열에 두고, 어느 장에도 없으면 `missing`에 넣는다
  - `openBook(bookDir): Ctx` = `{ bookDir, store, lineage, relations, book, state, context }`
- CLI: `stores --project <dir>` / `scan --root <dir> --project <dir> --out <dir>` → `.work/inventory.json`, `.work/inventory.md`, `.gitignore`. 종료 코드 0 성공, 1 검사 실패, 2 사용법·준비 오류

후보 규칙: ① 저장소 문서가 경로나 파일명으로 언급하고 실제로 있는 문서(저장소 안 제외) ② `projectRoot`의 `CLAUDE.md`, `AGENTS.md`, `README.md` ③ 저장소의 상위 폴더에서 이름에 `기획|스펙|명세|계획|지침|프롬프트|plan|spec|guide|prompt`가 든 문서. 확장자는 `.md .txt .json .yaml .yml .csv`.
`kind`: `prompt|프롬프트` → prompt, `CLAUDE|AGENTS|지침|guide` → guide, `plan|spec|기획|스펙|명세|계획` → plan, 그 밖 → reference. `TODO|review|리뷰`가 들면 reference. `mode`: plan·guide → `edit`, 그 밖 → `appendix`. 이름 끝의 `_v<N>`만 다른 문서는 하나로 묶고 번호순으로 둔다.

- [ ] **Step 1: 실패하는 테스트**

```js
test('버전이 다른 기획서를 묶는다', () => { const c = byId('plan'); assert.deepEqual(c.versions.map(v => v.label), ['v1','v2']); assert.equal(c.mode, 'edit'); });
test('프롬프트는 원문만', () => assert.equal(find('프롬프트').mode, 'appendix'));
test('docx는 후보가 아니다', () => assert.equal(cands.some(c => c.versions[0].path.endsWith('.docx')), false));
test('목차 검증', () => { const r = validateOutline(bookWith({ drop: 'notice_time_rule_v1', twice: 'notice_feedback_v1', add: 'nope_v1' }), store, ctx);
  assert.deepEqual(r.missing, ['notice_time_rule_v1']); assert.deepEqual(r.duplicate, ['notice_feedback_v1']); assert.deepEqual(r.unknown, ['nope_v1']); });
test('archived를 목차에 넣으면 알린다', () => assert.deepEqual(validateOutline(bookWith({ add: 'loan_return_rule_v1' }), store, ctx).archived, ['loan_return_rule_v1']));
test('컨텍스트 파일이 없으면 문제로 보고', () => assert.equal(loadContext(bookMissingFile, dir).problems[0].code, 'context-missing'));
test('scan은 원본을 건드리지 않는다', () => { const before = hashTree(FIX); run('scan', …); assert.equal(hashTree(FIX), before); });
```

- [ ] **Step 2: 실패 확인** → **Step 3: 구현** → **Step 4: 통과 확인**. `inventory.md`는 `category`별 표(`name | 종류 | 상태 | milestone | part_of | 날짜 | 제목 | 전제`)와 후보·후속 없는 폐기·책 밖 이름·문제 목록이다.

---

### Task 4: 원문 발췌, 원고 읽기, 장 상태

**Files:**
- Create: `book/lib/bundle.mjs`, `book/lib/manuscript.mjs`, `book/test/bundle.test.mjs`, `book/test/manuscript.test.mjs`
- Modify: `book/cli.mjs` (`bundle`, `record`)

**Interfaces:**
- Consumes: `Ctx`, `chapters()`
- Produces:
  - `keptText(doc): string` — 제목, 요약, Why, Rule, Exceptions, Invalidation. concept은 Relations를 뺀 본문, layer는 목적·범위(L0는 본문 전체)
  - `sectionSources(section, ctx): string` — 절에 속한 문서와 그 이력 전체의 원문 전문을 이은 글(검사용)
  - `renderBundle(entry, ctx): string`, `hash(text): string`(sha256 hex)
  - `chapterStatus(entry, ctx): 'write'|'rewrite'|'review'|'unresolved'|'done'`
  - `parseManuscript(text): { title, intro, sections: { title, atoms, layers, context, history: {name, items}[], open, text }[] }`
- 상태: `state.chapters[key]` = `{ bundleHash, review: { manuscriptHash, by: 'agent'|'self', rounds, unresolved: [] } }`
- CLI: `bundle --out <dir> [--only <부 id|장 key|제목>]` → `.work/bundles/<part>/<chapter>.md`와 장별 상태 출력. `record --out <dir> --chapter <key> (--written | --review <json>)`

상태 규칙: 원고 없음 `write` → `bundleHash`가 다름 `rewrite` → 대조한 원고 해시가 다름 `review` → 남은 지적 있음 `unresolved` → `done`.

- [ ] **Step 1: 실패하는 테스트**

```js
test('핵심 섹션만 담는다', () => { const t = keptText(food3); assert.match(t, /## Why/); assert.doesNotMatch(t, /How to apply|Relations|owner/); });
test('발췌에 이력이 오래된 순으로 있다', () => { const b = renderBundle(foodEntry, ctx); assert.ok(b.indexOf('decision_v1') < b.indexOf('decision_v2')); });
test('근거 커밋만 바뀌면 다시 쓰지 않는다', () => assert.equal(hash(renderBundle(foodEntry, ctxWithNewEvidence)), hash(renderBundle(foodEntry, ctx))));
test('Rule이 바뀌면 rewrite', () => assert.equal(chapterStatus(foodEntry, ctxWithNewRule), 'rewrite'));
test('원고만 고치면 review', () => assert.equal(chapterStatus(foodEntry, ctxWithEditedManuscript), 'review'));
test('원고 표식을 읽는다', () => { const m = parseManuscript(SAMPLE); assert.deepEqual(m.sections[0].atoms, ['loan_limit_decision_v3','loan_fee_values_rnd_v1']);
  assert.equal(m.sections[0].history[0].items.length, 3); assert.equal(m.sections.at(-1).open, true); });
```

- [ ] **Step 2: 실패 확인** → **Step 3: 구현** → **Step 4: 통과 확인**

---

### Task 5: 원고 검사

**Files:**
- Create: `book/lib/check.mjs`, `book/test/check.test.mjs`
- Modify: `book/cli.mjs` (`check`)

**Interfaces:**
- Consumes: `parseManuscript`, `sectionSources`, `chapterStatus`, `validateOutline`
- Produces: `checkChapter(entry, ctx): Finding[]`, `checkBook(ctx): Finding[]`, `Finding` = `{ level: 'error'|'warn', code, chapter, section, message }`
- `code`: `coverage`, `history-count`, `identifier`, `number`, `open-missing`, `unknown-link`(책 밖이면 warn), `review-missing`, `review-unresolved`, `leftover`. 원고가 없는 장은 warn `unwritten` 하나만 낸다.

숫자: 코드 밖에서 `\d{4}-\d{2}-\d{2}` 또는 `(?<![\w.])\d+(?:\.\d+)?(?!\w)`를 토큰으로 본다. 줄 첫머리 목록 번호와 `v<N>`은 뺀다. 절의 원문(프론트매터 날짜, 코드 포함)에서 같은 방식으로 뽑은 토큰 집합에 없으면 오류다. 장 도입은 장 전체 원문과 비교한다. 식별자는 백틱 안의 글 전체가 원문에 있어야 한다.

- [ ] **Step 1: 실패하는 테스트** — 바른 원고는 오류 0, 아래처럼 하나씩 틀리게 고친 원고는 그 코드 하나만 낸다.

```js
const cases = [
  ['identifier', t => t.replace('`holdGap`', '`holdSize`')],
  ['number',     t => t.replace('값이 0이면', '값이 7이면')],            // 원문에 90ab12c가 있어도 잡는다
  ['number',     t => t.replace('2026-03-18', '2026-03-19')],
  ['history-count', t => t.replace(/^2\. .*\n/m, '')],
  ['open-missing',  t => t.replace('[[loan_fee_values_rnd_v1]]', '')],
  ['coverage',      t => t.replace(', loan_fee_values_rnd_v1 -->', ' -->')],
  ['unknown-link',  t => t + '\n[[no_such_atom_v1]]\n'],
  ['leftover',      t => t + '\n{{ROOT}}\n'],
];
test('[Review Focus 3] 코드 안의 {{ 와 [[ 는 오류가 아니다', () => assert.deepEqual(errors(good + '\n`{{x}}` `[[y]]`\n').filter(e => e.code !== 'identifier'), []));
test('대조 기록이 없으면 review-missing', …); test('남은 지적이 있으면 review-unresolved', …);
test('원고 없는 장은 경고만', …); // 종료 코드 0
```

- [ ] **Step 2: 실패 확인** → **Step 3: 구현** → **Step 4: 통과 확인**

---

### Task 6: GitBook md 만들기

**Files:**
- Create: `book/lib/links.mjs`, `book/lib/graph.mjs`, `book/lib/build-md.mjs`, `book/test/links.test.mjs`, `book/test/build-md.test.mjs`
- Modify: `book/lib/fsutil.mjs` (`resetDir`), `book/lib/check.mjs` (`checkBuilt`), `book/cli.mjs` (`build`)

**Interfaces:**
- Produces:
  - `mapOutsideCode(text, fn)`, `stripLinks(text)`, `relLink(fromFile, toFile, anchor?)`(구간마다 `encodeURIComponent`, 괄호도 인코딩) — `links.mjs`
  - `rewriteOriginal(text, { fromFile, resolveWiki, resolvePath, copyAsset }): string`
  - `chapterGraph(names, ctx): { nodes: {name,title}[], edges: {from,to,rel}[] }`, `toMermaid(graph): string` — `graph.mjs`
  - `buildMd(ctx): Page[]`, `Page` = `{ file, title, group, parent, md, graph|null }`. 순서는 `SUMMARY.md` 순서
  - `resetDir(dir)` — 없으면 만들고, 표식 `.atomic-book`이 있으면 비우고, 표식 없이 파일이 있으면 던진다
  - `checkBuilt(ctx): Finding[]` — `original-changed`, `link-broken`, `anchor-missing`, `absolute-link`, `liquid`(warn)

페이지 파일: `README.md`, `chapters/<부>/<장>.md`, `views/by-scope.md`·`by-work.md`·`changes.md`·`names.md`, `appendix/{history,atoms,layers,maps,context}/README.md`와 `<name>.md`, `assets/`. 부록 원문은 `<!-- original:begin -->`과 `<!-- original:end -->` 사이에 두고, 프론트매터는 `yaml` 코드 블록으로 보인다. `.md`·`.txt`가 아닌 컨텍스트는 코드 블록으로 싣는다.

`SUMMARY.md` 모양: `# 목차` → `* [책 이름](README.md)` → 부마다 `## 제목` → `## 다른 순서로 보기` → `## 부록`(A~E가 최상위, 원문은 그 아래 들여쓰기). 같은 파일은 한 번만 나온다. `.gitbook.yaml`은 다음과 같다.

```yaml
root: ./
structure:
  readme: README.md
  summary: SUMMARY.md
```

절 제목은 `## 제목 <a href="#ID" id="ID"></a>`(ID는 절의 첫 원문 이름). 절 아래 자동 줄은 `현재 v3 · 2026-03-21 · 초안(draft) · [원문](…)`이고, 상태 표기는 `초안(draft) 검증 중(pending) 승인(approved) 시행(active) 폐기(archived)`다. `feedback`은 앞에 `재발 방지 · `를 붙인다. Exceptions가 "없음"이 아니면 `예외 있음 → [원문](…)` 줄을 넣는다. 이력 항목 끝에는 그 버전의 `[원문](…)`을 붙인다. 절 끝에는 `이어진 결정: 전제 … / 영향 … / 이 결정을 참조 …`를 붙이고(`requires`·`derives_from`, `affects`, 역참조 순, 없는 것은 뺀다), 충돌이 있으면 `충돌 …`을 더한다. 장의 `dropped`는 "폐기된 결정" 절로 제목·한 문장 요약 원문·원문 링크를 싣는다. 표지는 책 이름, 기준 날짜(실은 문서의 `updated` 최댓값), 읽는 법, 부·장·보기·부록 목차다. 원고 없는 장은 Atom마다 제목, 한 문장 요약 원문, 원문 링크를 싣는다.

- [ ] **Step 1: 실패하는 테스트**

```js
test('원문은 링크 표기 말고는 같다', () => assert.equal(stripLinks(originalBlock(page)), stripLinks(food3.body)));
test('책 안 파일 링크는 책 페이지로, 책 밖 파일·절대 경로는 글자만', …);
test('http 링크는 그대로', …);
test('[Review Focus 3] 코드 안은 건드리지 않는다', () => assert.match(page.md, /`\/\/ Decision: \[\[loan_limit_decision_v3\]\]`/));
test('[Review Focus 1] 공백·한글·괄호 경로가 열린다', () => assert.deepEqual(checkBuilt(ctx).filter(f => f.code === 'link-broken'), []));
test('이미지를 assets로 복사한다', () => assert.ok(exists('md/assets/…/map.png')));
test('SUMMARY에 같은 파일이 두 번 없다', …); test('묶음 없는 링크는 README 하나뿐', …);
test('[[...]]는 절로, archived는 부록으로, 책 밖은 글자로', …);
test('제목의 대괄호는 이스케이프한다', () => assert.match(summary, /\\\[R&D\\\]/));
test('작업 순서별은 분해 기록 날짜순이고 archived에는 현재 결정을 잇는다', …);
test('milestone이 없으면 그 묶음을 만들지 않는다', …);
test('두 번 build하면 같은 결과', () => assert.equal(hashTree(md1), hashTree(md2)));
test('localNav: false면 이전/다음 줄이 없다', …);
test('절 끝에 전제·영향·역참조가 있고 원본에는 쓰지 않는다', …);
test('후속 없는 폐기는 "폐기된 결정" 절에 한 번 나온다', …);
test('[Review Focus 5] 표식 없는 폴더는 지우지 않고 멈춘다', () => { assert.throws(() => resetDir(userDir), /표식/); assert.ok(exists(userDir + '/mine.md')); });
test('checkBuilt는 원문 변경·깨진 링크·없는 앵커·절대 경로를 잡는다', …); // 결과물을 하나씩 망가뜨려 코드 확인
```

- [ ] **Step 2: 실패 확인** → **Step 3: 구현** → **Step 4: 통과 확인**

---

### Task 7: 로컬 HTML

**Files:**
- Create: `book/lib/build-html.mjs`, `book/assets/book.css`, `book/assets/book.js`, `book/vendor/marked/{marked.esm.js,LICENSE}`, `book/test/build-html.test.mjs`
- Modify: `book/lib/graph.mjs` (`toSvg`), `book/cli.mjs` (`build`가 HTML도 만듦), `book/lib/check.mjs` (`checkBuilt`가 html도 봄)

**Interfaces:**
- Consumes: `Page[]`
- Produces: `toSvg(graph): string`(전제가 위에 오는 층 배치, 순환 허용, 제목은 최대 3줄), `buildHtml(ctx, pages)` → `html/index.html`, 같은 구조의 `.html`, `assets/{book.css,book.js,search-index.js}`

`README.md` → `index.html`, 그 밖의 `.md` 링크는 `.html`로 바꾼다. `mermaid` 코드 블록 자리에는 그 페이지 그림의 SVG를 넣는다. 허용하는 날 HTML은 `<a id href>`, `<details>`, `<summary>`, `<br>`, `<sub>`, `<sup>`, 주석뿐이고 나머지는 이스케이프한다. 왼쪽 목차는 부·장·보기·부록 최상위까지, 부록 원문은 그 부록 안의 페이지에서만 보인다. 검색 색인은 검색칸에 처음 초점이 갈 때 `<script>`로 불러온다. `book.css`는 밝은·어두운 화면(`prefers-color-scheme`), 좁은 화면, 인쇄(목차 숨김)를 다룬다.

- [ ] **Step 1: `marked` 18.1.3을 받는다** — 새 빈 폴더에서 `npm pack marked@18.1.3`, 압축을 풀어 `lib/marked.esm.js`와 라이선스 파일만 복사한다. 패키지 스크립트는 실행하지 않는다. `package.json`의 `version`이 `18.1.3`, `license`가 `MIT`인지 확인한다.
- [ ] **Step 2: 실패하는 테스트**

```js
test('모든 페이지가 있고 링크·앵커가 산다', () => assert.deepEqual(checkBuilt(ctx).filter(f => f.level === 'error'), []));
test('서버가 필요한 것이 없다', () => { for (const h of htmlFiles) assert.doesNotMatch(h, /type="module"|fetch\(|XMLHttpRequest|(src|href)="(https?:)?\/\//); }); // 본문의 http 링크 <a>는 예외
test('[Review Focus 2] 날 HTML은 글자로 보인다', () => { assert.match(planHtml, /&lt;script&gt;/); assert.match(planHtml, /List&lt;int&gt;/); });
test('그림은 SVG로 들어간다', () => { assert.match(chapterHtml, /<svg/); assert.doesNotMatch(chapterHtml, /language-mermaid/); });
test('SVG 제목의 < & "를 이스케이프한다', …);
```

- [ ] **Step 3: 실패 확인** → **Step 4: 구현** → **Step 5: 통과 확인**

---

### Task 8: 커맨드, 지침, 플러그인 등록

**Files:**
- Create: `commands/book.md`, `book/guides/outline.md`, `book/guides/editing.md`, `book/guides/review.md`
- Modify: `.claude-plugin/plugin.json`(`"commands": ["./commands/"]`, `1.1.0`), `.claude-plugin/marketplace.json`(설명·키워드 `book`, `gitbook`), `README.md`, `skills/atomic-decomposition/SKILL.md`(책 커맨드 안내 한 줄), `skills/atomic-decomposition/templates/README.md`(생성·관리 도구 줄)

- [ ] **Step 1: `commands/book.md`** — 설계 12절의 8단계를 그대로 절차로 적는다. 스크립트 경로는 `${CLAUDE_PLUGIN_ROOT}/book/cli.mjs`이고, 에이전트에게는 치환된 절대 경로를 넘기라고 적는다. 확인받는 곳은 컨텍스트와 목차 두 번뿐이다.
- [ ] **Step 2: `guides/editing.md`** — 설계 9절의 표와 규칙, 원고 형식, 예시(원문 일부와 편집본)와 나쁜 예.
- [ ] **Step 3: `guides/review.md`** — 설계 10절의 네 종류, 입력(발췌·원고 경로), 출력 JSON `{ "findings": [{ "kind", "section", "manuscript", "source", "fix" }] }`. 고치지 말고 보고만 하라고 적는다. 빼도 되는 것은 지적하지 않는다.
- [ ] **Step 4: `guides/outline.md`** — 부는 `category`(없으면 "기타"), 1부 `background`, 장은 현행 5~15건, 순서는 전제 먼저 그다음 날짜, `id`는 영문 소문자와 `-`, 후속 없는 폐기는 관련 장에.
- [ ] **Step 5: 등록 파일 수정** → `claude plugin validate .` 통과

---

### Task 9: 실제 크기의 저장소로 확인

- [ ] **Step 1**: 저장소 하나와 컨텍스트 문서를 임시 폴더에 복사하고 `scan`, `build`를 실행한다. `checkBuilt` 오류 0. 원본 폴더의 `git status`가 그대로인지 본다.
- [ ] **Step 2**: headless `claude -p --plugin-dir`로 `/atomic-decomposition:book <부 이름>`을 실행해 원고, 대조 기록, check 통과, md가 나오는지 본다.
- [ ] **Step 3**: 만든 장 하나를 원문과 직접 대조한다. 지어낸 내용, 뒤집힌 조건, 확정처럼 쓴 초안이 없는지 본다.
- [ ] **Step 4**: 같은 커맨드를 다시 실행해 쓸 장이 0인지, Atom 하나의 Rule을 바꾸면 그 장만 `rewrite`인지 확인한다.
