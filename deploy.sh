#!/bin/bash
# 배포: 버전 파일 갱신 → 커밋 → 푸시 → 사이트 반영 확인. 사용: ./deploy.sh "설명"
set -e
cd "$(dirname "$0")"
VER=$(date +%Y%m%d.%H%M)
echo "window.NARACAL_VER = \"$VER\";" > version.js
echo "{\"ver\":\"$VER\"}" > version.json
sed -i '' -E "s/(app\.(js|css)\?v=)[0-9a-z.]+/\1$VER/g; s/(version|effects|imgedit|elements|templates|templates2|templates3|templates4|calendar|storage|lib|ai|defaults|assets|assets-brand|webfonts|fonts|news|video|media|vtemplates|astream|live)\.js\?v=[0-9a-z.]+/\1.js?v=$VER/g" index.html
git add -A
# 커밋 메일 주소는 스크립트에 적지 않고, 이 폴더의 git 설정(git config user.email)에서 씀 — 처음 한 번 관장님이 직접 등록
if ! git config user.email >/dev/null; then echo "배포 멈춤: 이 폴더에 커밋 메일 주소가 없습니다. 한 번만 실행하세요 → git config user.email \"메일 주소\""; git reset -q; exit 1; fi
git -c user.name=narachadata commit -q -m "${1:-업데이트} ($VER)

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>" || true
git push -q origin main
echo "pushed $VER"
for i in $(seq 1 30); do if curl -s "https://narachadata.github.io/design/version.json?t=$i" | grep -q "$VER"; then echo "live after $((i*10))s"; exit 0; fi; sleep 10; done
echo "아직 반영되지 않음 (잠시 후 다시 확인)"
