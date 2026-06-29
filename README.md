# 투자 성과 대시보드 자동 업데이트형

수량과 현금이 변하지 않는다는 전제에서 KRX 종가만 매일 업데이트해 투자 성과 대시보드를 자동 생성합니다.

## 구조

```text
index.html
data/portfolio.json   # 고정값: 수량, 매수원금, 확정손익, 현금, 퇴직연금 납입원금
data/prices.json      # 날짜별 KRX 종가 스냅샷
scripts/update_prices.py
.github/workflows/update-prices.yml
```

## 작동 방식

1. GitHub Actions가 평일 한국시간 18:00에 실행됩니다.
2. `scripts/update_prices.py`가 보유 종목 종가를 조회합니다.
3. `data/prices.json`에 오늘 날짜 스냅샷을 추가합니다.
4. 변경사항을 자동 커밋/푸시합니다.
5. Netlify가 GitHub 변경사항을 감지해 자동 배포합니다.
6. 사이트 상단에 새 날짜 탭이 자동으로 생깁니다.

## 수동 실행

GitHub 저장소에서 `Actions → Update KRX closing prices → Run workflow`로 실행합니다.
날짜를 넣으면 해당 날짜 기준으로 조회합니다.

## 주의

- 퇴직연금 현금성자산은 KRX 종가가 아니므로 직전 값을 승계합니다.
- 종목 조회가 실패하면 직전 스냅샷의 가격을 임시로 사용하고 `warnings`에 기록합니다.
- 수량이 바뀌거나 매수/매도가 발생하면 `data/portfolio.json`을 수정해야 합니다.
