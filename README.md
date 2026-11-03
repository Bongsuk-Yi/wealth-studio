# 자산형성 스튜디오

자산·수입·지출을 입력하면 원하는 기간(최대 100년)의 자산 추이를 계산하고, 몬테카를로 시뮬레이션으로 목표 달성 확률을 보여 주는 무료 계산기입니다. 모든 계산은 브라우저에서만 이루어지며 데이터는 localStorage에만 저장됩니다.

- 01 소개 · 02 입력(계획 저장/엑셀·JSON 불러오기) · 03 출력(표·5종 그래프) · 04 몬테카를로(변동성·세후) · 05 조언(재무 건강 점수·Q&A)
- A4 보고서: 인쇄 · PDF · PNG

## 빌드·배포
```
npm ci
npm run build   # dist/ 생성
npm start       # 로컬 미리보기 http://localhost:5173
```
`main`에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 빌드해 GitHub Pages로 배포합니다.
(저장소 Settings → Pages → Source를 **GitHub Actions**로 두면 됩니다.)
