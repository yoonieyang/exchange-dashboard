# 환율 체크

접속 또는 새로고침할 때 USD/KRW 기준환율을 조회하고, 개인이 설정한 관심 매수 환율과 비교하는 정적 웹페이지입니다. 매수·매도 기록을 남기면 보유 달러, 평균 매수 환율, 현재 평가액과 평가 손익도 확인할 수 있습니다. 거래 기록과 설정은 서버가 아닌 현재 사용 중인 브라우저에만 저장됩니다.

> 기준환율은 실제 환전·송금·매매 환율과 다를 수 있으며, 이 도구는 투자 조언이 아닙니다.

## GitHub Pages 배포

저장소의 **Settings → Pages → Build and deployment**에서 `Deploy from a branch`, `main` 브랜치와 `/ (root)`를 선택해 저장하면 됩니다.

환율 데이터는 [Frankfurter API](https://frankfurter.dev/)에서 브라우저가 직접 받아옵니다. API 키나 서버가 필요하지 않습니다.
