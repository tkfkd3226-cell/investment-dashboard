# 투자 대시보드

삼성증권 증권계좌와 퇴직연금 계좌의 날짜별 성과를 확인하는 정적 웹 대시보드입니다. 정적 화면은 **GitHub Pages**, 데이터 저장과 GitHub Actions 실행 요청은 **Google Apps Script 웹 앱**을 사용합니다.

---

## 주요 기능

- 날짜별 증권계좌·퇴직연금 성과 복원
- 증권계좌 보유분, 계좌별 성과, 퇴직연금 상품별 현황 표시
- 모바일 카드/표 보기 전환
- 퇴직연금 기업적립금 및 현금성자산 평가금액 등록·삭제
- KRX 현재가 최신/누락 반영 및 선택일 재갱신
- 누적수익률과 코스피 지수 차트 전환
- 웹·모바일 목차 메뉴
- 모바일 우측 하단 `TOP` 버튼
- 별도 투자 계산기(`calc.html`)

---

## 파일 구조

```text
index.html
style.css
script.js
calc.html
favicon.png
README.md
requirements.txt

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
```

---

## 화면 조작

### 기준일 선택

상단의 월 셀렉트와 일·요일 셀렉트에서 조회 기준일을 선택합니다. 선택 가능한 날짜는 현재 데이터 파일에 존재하는 날짜를 기준으로 생성됩니다.

### 목차

- 모바일: 상단 `☰` 버튼
- 웹: 상단 우측 `목차` 버튼

목차에서 주요 영역으로 바로 이동할 수 있습니다.

### 모바일 TOP 버튼

모바일에서 화면을 일정 거리 이상 내리면 우측 하단에 `TOP` 버튼이 나타납니다. 누르면 화면 최상단으로 이동합니다.

---

## KRX 현재가 반영

상단 `KRX 현재가 반영` 버튼에서 PIN을 입력한 뒤 실행합니다.

### 최신/누락 반영

- 날짜를 전달하지 않고 Google Apps Script에 실행을 요청합니다.
- 서버가 최신·누락 데이터와 당일 종가 반영 상태를 판단합니다.
- 이미 당일 종가까지 반영되어 있으면 GitHub Actions 실행을 건너뛸 수 있습니다.

### 선택일 재갱신

- 현재 화면에서 선택한 기준일을 전달합니다.
- 해당 날짜의 KRX 가격과 스냅샷을 다시 계산할 때 사용합니다.

### 실행 흐름

```text
대시보드
  → Google Apps Script 웹 앱
  → GitHub Actions workflow_dispatch
  → scripts/update_prices.py
  → data/prices.json / data/performance_snapshots.json 갱신
  → GitHub Pages 재배포
```

GitHub Pages에 반영되기까지 보통 수 분이 걸릴 수 있습니다.

---

## 코스피 지수 반영

`update_prices.py`는 저장된 전체 기간의 코스피 종가를 보충하고 다음 위치에 기록합니다.

```text
data/prices.json
  날짜.indices.KOSPI

data/performance_snapshots.json
  날짜.kospi
```

조회 순서는 다음과 같습니다.

1. pykrx KRX 지수 조회
2. 네이버 금융 차트 데이터
3. Yahoo Finance KOSPI `^KS11`

세 경로가 모두 실패하면 워크플로를 성공으로 끝내지 않고 실패 처리합니다. 따라서 GitHub Actions는 성공했는데 코스피 데이터가 비어 있는 상태를 방지합니다.

퇴직연금의 `운용수익 및 누적수익률`, 증권계좌의 `누적손익 및 누적수익률` 차트에서 `수익률 / 코스피` 버튼으로 우측 선 그래프를 전환합니다.

---

## 퇴직연금 금액 조정

상단 `퇴직연금 금액 조정`에서 다음 두 항목을 관리합니다.

### 현금성자산 평가금액

- 기본 선택 항목입니다.
- 퇴직연금 앱에 표시된 특정일의 현금성자산 평가금액을 저장합니다.
- 같은 날짜는 한 건만 유지하며 다시 저장하면 기존 항목을 수정합니다.

### 기업적립금

- 회사가 납입한 퇴직연금 적립금을 등록합니다.
- 같은 날짜에 여러 건이 있을 수 있어 `id` 기준으로 개별 관리합니다.

### 저장 및 삭제

- Google Apps Script를 통해 GitHub JSON 파일에 직접 반영합니다.
- PIN은 **6자리**입니다.
- PIN 6자리가 일치하면 별도의 실행 버튼 없이 자동으로 저장 또는 삭제합니다.
- PIN 오류는 PIN 입력 모달 안에 표시됩니다.

---

## 데이터 파일 역할

### `data/portfolio.json`

보유 종목, 퇴직연금 상품, 수량, 원가, 표시명과 대시보드 기본 설정을 담습니다.

### `data/prices.json`

날짜별 증권·퇴직연금 가격과 코스피 지수를 담습니다.

### `data/performance_snapshots.json`

날짜별 전체 성과 스냅샷과 코스피 지수를 담습니다.

### `data/account1_daily_snapshots.json`

증권계좌 일별 원시·보정 스냅샷을 담습니다.

### `data/pension_contributions.json`

퇴직연금 기업적립금 등록 내역입니다.

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

퇴직연금 앱에서 확인한 현금성자산 평가금액 스냅샷입니다.

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

## 현금성자산 계산 기준

### 매수원금

```text
기준 현금성자산 원금 + 해당일까지 등록된 기업적립금 누적액
```

### 평가금액

스냅샷이 없으면:

```text
기준 현금성자산 원금 + 해당일까지 등록된 기업적립금 누적액
```

스냅샷이 있으면:

```text
최근 현금성자산 평가금액 스냅샷 + 스냅샷 이후 추가 기업적립금
```

### 평가손익

```text
현금성자산 평가금액 - 현금성자산 매수원금
```

---

## Google Apps Script 설정

Google Apps Script 웹 앱에는 다음 Script Properties가 필요합니다.

```text
ADMIN_PIN
GITHUB_TOKEN
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
```

권장 Fine-grained GitHub Token 권한:

```text
Repository access: 투자 대시보드 저장소만 선택
Contents: Read and write
Actions: Read and write
Metadata: Read-only
```

용도:

- `Contents: Read and write`: 퇴직연금 JSON 저장·삭제
- `Actions: Read and write`: KRX 업데이트 워크플로 실행
- `Metadata: Read-only`: 저장소 기본 접근

Apps Script 코드를 바꾼 경우에는 새 버전으로 웹 앱을 다시 배포합니다. Script Properties 값만 변경한 경우에는 일반적으로 코드 재배포가 필요하지 않습니다.

---

## GitHub Pages 배포

정적 사이트는 GitHub Pages의 `Deploy from a branch` 방식을 기준으로 합니다.

권장 설정:

```text
Source: Deploy from a branch
Branch: main
Folder: /root
```

데이터나 소스가 커밋되면 Pages 재배포가 진행됩니다. `pages build and deployment`의 build는 성공했지만 deploy만 실패한 경우에는 재실행하거나 작은 커밋으로 배포를 다시 트리거합니다.

---

## 운영 데이터 주의

다음 파일은 실제 운영 데이터이므로 소스 ZIP을 올릴 때 덮어쓰지 않도록 주의해야 합니다.

```text
data/prices.json
data/performance_snapshots.json
data/pension_contributions.json
data/pension_cash_snapshots.json
```

- `prices.json`, `performance_snapshots.json`은 워크플로 실행으로 복구·재생성할 수 있는 범위가 있습니다.
- `pension_contributions.json`, `pension_cash_snapshots.json`은 화면에서 직접 입력한 내역이므로 덮어쓰기 전에 반드시 GitHub 현재 파일을 확인합니다.

---

## 저장소 정리

더 이상 사용하지 않는 항목:

```text
netlify/
netlify/functions/
netlify/functions/save-pension-contribution.js
```

파이썬 캐시는 저장소에 올리지 않습니다.

```gitignore
__pycache__/
*.pyc
```
