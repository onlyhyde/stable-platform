# Seminar Deck Package

## 파일 구성
- `00-master-deck-30-slides.md`: 일반 마크다운 30장 구조
- `00-master-deck-30-slides.marp.md`: Marp 호환 메인 덱
- `01-track-bd.md`: BD 관점 보조자료
- `01-track-bd.marp.md`: BD Marp 슬라이드
- `02-track-engineering.md`: 개발 관점 보조자료
- `02-track-engineering.marp.md`: 개발 Marp 슬라이드
- `03-track-cto.md`: CTO 관점 보조자료
- `03-track-cto.marp.md`: CTO Marp 슬라이드

## Marp 사용
1. 메인 덱 PDF
`npx @marp-team/marp-cli docs/seminar-deck/00-master-deck-30-slides.marp.md -o seminar-main.pdf`

2. 트랙별 PDF
`npx @marp-team/marp-cli docs/seminar-deck/01-track-bd.marp.md -o seminar-bd.pdf`
`npx @marp-team/marp-cli docs/seminar-deck/02-track-engineering.marp.md -o seminar-eng.pdf`
`npx @marp-team/marp-cli docs/seminar-deck/03-track-cto.marp.md -o seminar-cto.pdf`

3. 전체 일괄 생성
`npx @marp-team/marp-cli "docs/seminar-deck/*.marp.md" -o docs/seminar-deck/export/`
