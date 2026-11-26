# 빌드와 배포 안내

이 커맨드는 책의 내용인 md까지 만듭니다. HTML은 요청하면 엮고(`html`), GitBook 연결과 올리기는 각자 합니다. 아래에서 `<md>`는 책 폴더의 `md/`입니다.

`<md>`에는 `README.md`(여는 글과 읽는 순서), `SUMMARY.md`(차례), `.gitbook.yaml`, 본문과 부록이 모두 들어 있고 서로 상대 링크로만 이어져 있습니다. 폴더째 옮겨도 링크가 유지됩니다. 장 끝의 근거 문서 목록과 원문 쪽의 문서 정보는 `<details>`로 접혀 있습니다.

## 올리기 전에

- 부록에는 컨텍스트 문서의 **원문이 그대로** 실립니다. 공개하면 안 되는 내용(비밀 값, 개인정보, 미공개 기획)이 없는지 확인합니다. 빼려면 `book.json`의 `context`에서 지우고 다시 build합니다.
- `check`에 오류가 남아 있으면 먼저 해결합니다.
- `<md>`는 build가 다시 만드는 폴더입니다. 직접 고치면 다음 build에서 덮어씁니다. 다른 도구의 설정 파일(`package.json`, `book.toml` 등)을 `<md>` 안에 두면 build가 멈추니, 바깥에 두거나 복사본에서 작업합니다.

## 로컬에서 md로 읽기

쪽 아래의 `← 이전 · 목차 · 다음 →` 줄로 옮겨 다닙니다.

- **VS Code**: `<md>/README.md`를 열고 미리보기(Ctrl+Shift+V)를 켭니다.
- **Obsidian**: `<md>` 폴더를 보관함으로 엽니다.
- 절로 가는 링크(`#이름`)는 보는 도구에 따라 쪽 맨 위로 갈 수 있습니다.

## GitBook

1. 책 폴더를 GitHub이나 GitLab 저장소에 올립니다.
2. GitBook 스페이스에서 Git Sync를 켜고 저장소를 연결합니다.
3. **Project directory**를 `<md>`의 저장소 안 경로로 지정합니다. `.gitbook.yaml`이 표지와 목차를 알려 줍니다.

GitBook은 `<details>`를 펼침 블록으로, `SUMMARY.md`의 들여쓰기를 차례의 묶음으로 보여 줍니다(부록의 Layer 아래 결정, 결정 아래 지난 버전). GitBook에서 내용을 고쳐 저장소로 되돌려 보내면 다음 build에서 덮어써지니, 고칠 것은 `manuscript/`에서 고칩니다.

참고: [GitBook Git Sync 설정](https://gitbook.com/docs/getting-started/git-sync/content-configuration)

## HTML로 엮기

`/atomic-decomposition:book html`을 실행하면 Claude가 `<md>`를 읽어 `<책 폴더>/html/`에 웹에서 읽는 책을 엮습니다. 지침은 `guides/html.md`에 있습니다. 차례 사이드바, 접히는 Layer 묶음, 쪽 넘김, 밝게·어둡게, 좁은 화면을 갖춘 기본 스타일이 있고, 원하는 분위기나 참고 사이트를 말하면 그쪽을 따릅니다.

다른 AI나 도구로 엮을 때도 그 AI에게 `guides/html.md`를 읽히면 같은 기준으로 엮습니다.

`README.md`와 `SUMMARY.md`를 쓰는 정적 사이트 도구를 쓸 수도 있습니다. 예를 들어 [HonKit](https://github.com/honkit/honkit)은 다음과 같습니다.

```powershell
npx honkit build <md> <출력 폴더>
```

이 커맨드는 HonKit으로 빌드해 보지 않았습니다. 본문의 `{{ }}`와 `{% %}`를 템플릿 문법으로 읽으므로, `check`가 `liquid` 경고를 낸 쪽이 있으면 그 부분에서 빌드가 실패할 수 있습니다.
