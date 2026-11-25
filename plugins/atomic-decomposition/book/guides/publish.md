# 빌드와 배포 안내

이 커맨드는 책의 내용인 md까지만 만듭니다. GitBook 빌드, HTML 만들기, 올리기는 각자 원하는 도구로 합니다. 아래에서 `<md>`는 책 폴더의 `md/`입니다.

`<md>`에는 `README.md`(표지), `SUMMARY.md`(목차), `.gitbook.yaml`, 본문과 부록이 모두 들어 있고 서로 상대 링크로만 이어져 있습니다. 폴더째 옮겨도 링크가 유지됩니다.

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

GitBook은 Mermaid 코드 블록을 그림으로 보여 줍니다. GitBook에서 내용을 고쳐 저장소로 되돌려 보내면 다음 build에서 덮어써지니, 고칠 것은 `manuscript/`에서 고칩니다.

참고: [GitBook Git Sync 설정](https://gitbook.com/docs/getting-started/git-sync/content-configuration)

## 로컬 HTML로 보기

`README.md`와 `SUMMARY.md`를 쓰는 정적 사이트 도구면 됩니다. 예를 들어 [HonKit](https://github.com/honkit/honkit)은 다음과 같습니다.

```powershell
npx honkit build <md> <출력 폴더>
```

이 커맨드는 HonKit으로 빌드해 보지 않았습니다. 다음에 주의합니다.

- 관계 그림(Mermaid)을 그리려면 플러그인이 따로 필요합니다.
- 본문의 `{{ }}`와 `{% %}`를 템플릿 문법으로 읽습니다. `check`가 `liquid` 경고를 낸 쪽이 있으면 그 부분에서 빌드가 실패할 수 있습니다.
