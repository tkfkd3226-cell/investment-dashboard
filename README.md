# 투자 성과 대시보드 자동 업데이트형 - 스냅샷 구조

과거 성과는 현재 보유수량으로 재계산하지 않고, 기존 v9 HTML의 실제 장부 로우데이터를 `performance_snapshots.json`으로 분리해 표시합니다.

## 핵심 구조

```text
index.html
data/portfolio.json
data/prices.json
data/performance_snapshots.json
scripts/update_prices.py
.github/workflows/update-prices.yml
requirements.txt
README.md
```

## 작동 방식

1. 과거 차트는 `data/performance_snapshots.json`의 실제 장부 스냅샷을 기준으로 표시합니다.
2. 현재 보유분/퇴직연금 표와 카드 값은 `portfolio.json + prices.json`으로 계산합니다.
3. GitHub Actions가 장중/종가 가격을 갱신하면 `prices.json`을 업데이트합니다.
4. 같은 실행에서 현재 보유분 기준 성과 스냅샷을 계산해 `performance_snapshots.json`에도 저장합니다.
5. Netlify가 새 커밋을 감지해 자동 배포합니다.

## 장중/종가 표시

- `marketStatus: intraday` → `장중 HH:MM 기준`
- `marketStatus: close` → `KRX 종가 기준`

## 모바일

모바일에서는 상단 날짜 탭 대신 기준일 선택 메뉴로 표시됩니다.

## 업로드 주의

ZIP을 풀고 **내용물 전체를 저장소 루트에 덮어쓰기** 하세요.

정상 구조:

```text
.github/
data/
scripts/
index.html
requirements.txt
README.md
```
