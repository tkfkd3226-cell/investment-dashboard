# 투자 대시보드

삼성증권 일반 증권계좌, 퇴직연금 계좌, 토스 현금성 자산을 함께 확인하는 정적 투자 대시보드입니다. GitHub Pages 배포를 기본으로 사용하고, 필요 시 Netlify Function도 보조 저장 경로로 사용할 수 있습니다.

---

## 주요 기능

- 날짜별 전체 투자 현황 복원
- 증권계좌 / 퇴직연금 / 토스 실현분 통합 성과 표시
- 퇴직연금 상품별 평가금액, 매수원금, 평가손익, 비중 표시
- 퇴직연금 현금성자산 평가금액 보정
- 퇴직연금 기업적립금 등록/삭제
- KRX 현재가 수동 반영 버튼
- 모바일 빠른 이동 메뉴 및 모바일 작업 메뉴

---

## 파일 구조

```text
index.html
style.css
script.js
README.md

data/
  portfolio.json
  prices.json
  performance_snapshots.json
  account1_daily_snapshots.json
  pension_contributions.json
  pension_cash_snapshots.json

scripts/
  update_prices.py

.github/workflows/
  update-prices.yml

netlify/functions/
  save-pension-contribution.js
```

---

## 데이터 파일 역할

### `data/portfolio.json`

보유 종목, 퇴직연금 상품, 수량, 원가, 표시명 등 포트폴리오 기본 정보를 담습니다.

### `data/prices.json`

날짜별 KRX 가격, 퇴직연금 가격, 현금성자산 기준값을 담습니다. `Update KRX closing prices` 워크플로우 또는 화면의 `KRX 현재가 반영` 버튼으로 갱신합니다.

### `data/performance_snapshots.json`

날짜별 전체 성과 스냅샷을 담습니다.

### `data/account1_daily_snapshots.json`

증권계좌 일별 원시/보정 스냅샷을 담습니다.

### `data/pension_contributions.json`

퇴직연금 기업적립금 등록 내역입니다.

원칙:

- 회사납입금만 저장합니다.
- 퇴직연금 납입원금과 현금성자산 매수원금을 증가시킵니다.
- 같은 날짜에 2건 이상 들어올 수 있으므로 `id` 기준으로 개별 관리합니다.
- 삭제도 날짜가 아니라 `id` 기준으로 처리합니다.

예시:

```json
[
  {
    "id": "contrib-2026-07-01-001",
    "date": "2026-07-01",
    "amount": 618060,
    "memo": "2026년 7월 기업적립금",
    "updatedBy": "google-apps-script",
    "updatedAtKST": "2026-07-03T15:44:40+09:00"
  }
]
```

### `data/pension_cash_snapshots.json`

퇴직연금앱에서 확인한 현금성자산 평가금액 스냅샷입니다.

원칙:

- 이자를 직접 등록하지 않습니다.
- 앱에 표시된 현금성자산 평가금액을 특정일 기준으로 저장합니다.
- 현금성자산 매수원금은 기존 현금성 원금과 기업적립금 누적으로 계산합니다.
- 현금성자산 평가손익은 `평가금액 - 매수원금`으로 계산됩니다.
- 같은 날짜 스냅샷은 1건만 유지합니다.

예시:

```json
[
  {
    "date": "2026-07-03",
    "valuation": 658044,
    "memo": "현금성자산 평가금액 앱 확인",
    "updatedBy": "google-apps-script",
    "updatedAtKST": "2026-07-03T19:55:00+09:00"
  }
]
```

---

## 퇴직연금 현금성자산 계산 기준

### 현금성자산 매수원금

```text
기준 현금성자산 원금 + 해당일까지 등록된 기업적립금 누적액
```

예시:

```text
39,717 + 618,060 = 657,777원
```

### 현금성자산 평가금액

스냅샷이 없으면:

```text
기준 현금성자산 원금 + 해당일까지 등록된 기업적립금 누적액
```

스냅샷이 있으면:

```text
최근 현금성자산 평가금액 스냅샷 + 스냅샷 이후 추가 기업적립금
```

### 현금성자산 평가손익

```text
현금성자산 평가금액 - 현금성자산 매수원금
```

---

## 화면 조작

### KRX 현재가 반영

- PC: `퇴직연금 금액 조정` 왼쪽의 `KRX 현재가 반영` 버튼 사용
- 모바일: 상단 톱니 메뉴 → `KRX 현재가 반영`
- Google Apps Script가 GitHub Actions의 `update-prices.yml`을 실행합니다.

### 퇴직연금 금액 조정

- PC: 상단 버튼 사용
- 모바일: 상단 톱니 메뉴 → `퇴직연금 금액 조정`
- 등록 유형:
  - `기업적립금`: 회사납입금 등록
  - `현금성자산 평가금액`: 앱 기준 현금성자산 평가금액 등록
- 저장 방식:
  - `GitHub Pages`: Apps Script로 GitHub 데이터 저장/삭제, PIN 필요
  - `Netlify`: Netlify Function으로 GitHub 데이터 저장/삭제, PIN 필요

---

## Google Apps Script 설정

`GoogleAppsScript_Code.gs` 내용을 Apps Script의 `Code.gs`에 붙여넣고 웹 앱으로 배포합니다.

필요한 Script Properties:

```text
ADMIN_PIN
GITHUB_TOKEN
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
```

권장 GitHub Fine-grained Token 권한:

```text
Repository access: 이 대시보드 저장소만 선택
Contents: Read and write
Actions: Read and write
Metadata: Read-only
```

권한 용도:

- `Contents: Read and write`: JSON 데이터 저장/삭제
- `Actions: Read and write`: KRX 현재가 반영 워크플로우 실행
- `Metadata: Read-only`: 저장소 접근 기본 권한

Apps Script 코드를 수정한 경우에는 반드시 새 버전으로 웹 앱을 다시 배포합니다. Script Properties 값만 바꾸는 경우에는 보통 재배포가 필요 없습니다.

---

## Netlify Function

보조 저장 경로입니다. Netlify를 사용할 경우 아래 환경변수가 필요합니다.

```text
ADMIN_PIN
GITHUB_TOKEN
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
```

GitHub Pages를 기본으로 사용할 경우 Netlify는 선택 사항입니다.

---

## GitHub Pages 배포

현재 정적 사이트 배포는 GitHub Pages의 `Deploy from a branch` 방식을 기준으로 합니다.

권장 설정:

```text
Source: Deploy from a branch
Branch: main
Folder: /root
```

`pages build and deployment`에서 build는 성공했는데 deploy만 실패하는 경우에는 보통 코드 문제가 아니라 Pages 배포 단계 문제입니다. 이때는 재실행하거나 작은 커밋으로 재배포를 트리거합니다.

---

## 운영 데이터 주의

아래 파일은 운영 데이터입니다. ZIP을 덮어쓰기 전에 GitHub 현재 파일과 비교해야 합니다.

```text
data/prices.json
data/performance_snapshots.json
data/pension_contributions.json
data/pension_cash_snapshots.json
```

특히 `pension_contributions.json`과 `pension_cash_snapshots.json`은 화면에서 직접 저장한 내역이 들어가므로 덮어쓰기 전에 반드시 확인합니다.

---

## 불필요 파일

파이썬 캐시 파일은 저장소에 올리지 않습니다.

`.gitignore` 권장값:

```gitignore
__pycache__/
*.pyc
```
