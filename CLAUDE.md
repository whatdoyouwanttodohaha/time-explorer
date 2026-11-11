# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**시간 탐색기**: "같은 해, 다른 세계"를 보여주는 한국어 세계사 연표 앱. 기원전 4000년~2026년을 지역별 줄(트랙)로 나란히 놓고, 선택한 해 앞뒤에 각 지역에서 일어난 일을 비교한다.

- 실제 소스는 `time-explorer/`에 있다(Vite + React 18 + TypeScript, 런타임 의존성은 React뿐).
- 테스트와 린트 설정은 없다.
- UI 문구와 데이터는 모두 한국어로 쓴다.

## 명령어

`time-explorer/`에서 실행한다.

```bash
npm run dev       # 개발 서버 (Vite)
npm run build     # tsc -b 타입 검사 + 프로덕션 빌드 → dist/
npm run preview   # 빌드 결과 미리보기
npx tsc -b        # 타입 검사만
```

브라우저 미리보기는 루트 `.claude/launch.json`의 `time-explorer` 설정(포트 5173)으로 띄운다.

데이터를 고친 뒤에는 ID 중복과 트랙 ID 오류를 확인한다(타입 검사로는 잡히지 않는다).

```bash
cat src/data/entries-*.ts | python3 -c "
import re,sys; from collections import Counter
s=sys.stdin.read(); rows=re.findall(r\"^  \['([^']+)', ([EPN]), '([a-z]+)', (-?\d+),\", s, re.M)
tracks=set(re.findall(r\"id: '([a-z]+)',\n    name\", open('src/data/tracks.ts').read()))|{'world'}
print('total', len(rows)); print('dup', [k for k,v in Counter(r[0] for r in rows).items() if v>1])
print('bad', [r[0] for r in rows if r[2] not in tracks or int(r[3])==0])
print(Counter(r[2] for r in rows).most_common())"
```

## 구조

### 연도 규약
연도는 정수다. 음수가 기원전이고(`-221` = 기원전 221년), 0년은 없다. 화면 좌표에서 연도로 바꿀 때는 `lib/time.ts`의 `toYear`를 거친다. 표기는 `formatYear`, `formatRange`, `formatTick`으로 한다.

### 데이터 흐름
1. `src/data/tracks.ts`: 시대 띠 `ERAS`, 지역 줄 목록 `TRACKS`(배열 순서가 화면 위→아래 순서), `WORLD_TRACK`, `MIN_YEAR`/`MAX_YEAR`를 정의한다. 각 줄은 시대 막대 `periods`를 가진다.
2. `src/data/entries-*.ts`: 줄마다 파일 하나가 있고, 각 파일은 `Row` 튜플 배열을 내보낸다. `Row`는 `src/data/row.ts`에 정의되어 있으며 순서는 `[id, kind(E/P/N), trackId, year, title, certainty, importance, summary]`다.
3. `src/data/entries.ts`: 모든 `*_ROWS`를 합쳐 연도순으로 정렬한 `ENTRIES`와 `ENTRY_BY_ID`를 만든다.

파일 이름과 트랙 ID가 다른 경우:

| 트랙 ID | 줄 이름 | 파일 |
|---|---|---|
| `world` | 세계 | `entries-global.ts` |
| `india` | 남아시아 | `entries-southasia.ts` |
| `steppe` | 중앙아시아 | `entries-steppe.ts` |
| `wafrica` | 서아프리카 | `entries-westafrica.ts` |
| `eafrica` | 동·남부 아프리카 | `entries-eastafrica.ts` |
| `namerica` | 북미 | `entries-northamerica.ts` |

**새 줄을 추가할 때:** `TRACKS`에 항목을 넣고, `entries-<지역>.ts`를 만들고, `entries.ts`에서 import와 spread를 추가한다.

### 시대 막대와 줄 높이
같은 줄 안에서 기간이 겹치는 시대는 `lib/time.ts`의 `assignLanes`가 탐욕적으로 여러 줄(lane)로 쌓는다. 줄 높이는 lane 수에 비례하고, `Timeline.tsx`의 `ROWS`에서 모듈 로드 시 한 번만 계산한다.

연이어지는 시대는 같은 lane을 공유하지만, 길게 겹치는 시대는 lane을 하나씩 늘린다. 한 줄이 5~6 lane을 넘지 않게 하고, 넘으면 시대를 합치거나 빼거나 줄을 나눈다. 아프리카와 아메리카를 여러 줄로 나눈 이유가 이것이다. 시대를 바꾼 뒤에는 lane 수를 시뮬레이션해서 확인한다.

### 화면 구성
- **`App.tsx`:** 보는 범위(`view`), 선택한 해, 선택한 항목, 종류 필터, 검색 창 상태를 가진다.
  - URL 해시(`#y=-221`, `#e=<id>`)와 동기화하고 `hashchange`도 처리한다.
  - 키보드 단축키는 ⌘K 또는 `/`(검색), ←/→(해 이동), `[` `]`(이전·다음 사건), `+`/`-`(확대·축소)다.
  - 줌 애니메이션은 범위 폭을 로그 스케일로 보간한다.
- **`Timeline.tsx`:** 눈금자, 시대 띠, 줄별 시대 막대, 사건 표식을 그린다. 휠은 ⌘/Ctrl(트랙패드 핀치)일 때 확대·축소하고, 가로 스크롤일 때 이동한다. 세로 스크롤은 페이지에 넘긴다.
  - 이름표 배치: 중요도 순으로 오른쪽, 안 되면 왼쪽에 놓는다. 다른 이름표와는 겹치지 않고, 자기보다 중요도가 같거나 높은 표식은 가리지 않는다. 보는 범위가 1500년보다 넓으면 중요도 1은 이름표를 생략한다.
  - `.tl-plot`은 `overflow: clip`이어야 한다. `hidden`이면 포커스된 표식 쪽으로 브라우저가 몰래 스크롤해 좌표가 어긋난다.
- **`WorldPanel.tsx`("그 무렵 세계는"):** 선택한 해 ±`windowFor(view)`년 안의 시대와 사건을 줄별 카드로 보여준다. 이 창의 폭은 보는 범위 폭에 비례한다.
- **`DetailDrawer.tsx`:** "같은 무렵, 다른 곳에서는"은 다른 줄의 가까운 항목만 고른다. 소속 시대 표시는 겹치는 시대 중 제목·설명에 이름이 나오는 것(두 글자 이상)을 먼저 고르고, 없으면 가장 늦게 시작한 시대를 고른다.
- **`SearchDialog.tsx`:** `parseYear`는 `기원전 500`, `-500`, `BC500`, `1443년` 같은 입력을 연도로 해석한다. 한글 IME 조합 중의 Enter는 무시한다(`isComposing`).
- **`styles.css`:** 유리 느낌(글래스모피즘) 디자인이다. 색은 `:root` 토큰과 다크 모드 토큰으로 정의한다. 다크 토큰은 `prefers-color-scheme` 블록과 `[data-theme='dark']` 블록에 똑같이 두 번 있으므로 함께 고친다.
  - 배경은 `body::before`에 고정한 색 번짐(`--bg-art`)이고, 그 위에 반투명 판을 얹는다. 판 채움은 `--glass`, 버튼·칩은 `--glass-soft`, 내용 위에 뜨는 판(헤더, 상세 패널, 검색 창)은 `--glass-strong`을 쓴다.
  - `backdrop-filter`는 내용 위에 뜨는 판에만 건다. 연표와 카드는 뒤에 고정 배경뿐이라 흐림 효과가 보이지 않고, 연표는 끌 때마다 다시 그려지므로 걸지 않는다.
  - 판이 반투명이라 불투명한 면 색이 없다. 글자 후광과 표식 테두리는 `--halo`, 마우스를 올린 면은 `--tint`, 시대 막대는 줄 색을 `transparent`와 섞어 칠한다.
  - 헤더는 861px 이상에서 화면 위에 붙어 있다(`position: sticky`). `.timeline`의 `isolation: isolate`는 표식의 z-index가 헤더 위로 올라오지 않게 한다.
  - 흐림 효과를 못 쓰는 브라우저와 `prefers-reduced-transparency`에서는 `--glass-solid`로 불투명하게 바꾼다.
  - 왼쪽 이름칸 폭은 `--label-w`(데스크톱 124px, 600px 이하 88px)이고, 줄 이름은 줄바꿈을 허용한다.

## 데이터 작성 규칙
- **ID:** 모든 파일을 통틀어 고유해야 한다. 영문 소문자로 쓴다. 이미 중복이 여러 번 생겼으므로 추가 후 위 검증을 돌린다.
- **줄 배정:** 한 사건은 한 줄에만 둔다. 여러 지역에 걸치면 가장 직접 관련된 줄에 두거나 `world`에 둔다.
- **`summary`:** 1~2문장, '~했다'체로 쓴다. 학설이 갈리는 수치는 '추정', '~가량', 범위로 쓴다.
- **`certainty`:**
  - `confirmed`: 사료로 확인된 연대
  - `probable`: 몇 년 오차가 있을 수 있음
  - `estimated`: 고고학·과학적 추정
  - `disputed`: 전승이거나 학설이 크게 갈림
- **`importance`:** 1(참고)~3(핵심). 3은 아껴 쓴다. `kind`는 `E` 사건, `P` 인물, `N` 자연현상이다.
- **줄 이름:** 이름칸에 맞게 짧게 짓고, 자세한 범위는 `region`에 적는다. `region`은 마우스를 올렸을 때 나오는 설명이다.
