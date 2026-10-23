#!/bin/bash
# 배포: 버전 파일 갱신 → 커밋 → 푸시 → 사이트 반영 확인. 사용: ./deploy.sh "설명"
set -e
cd "$(dirname "$0")"
VER=$(date +%Y%m%d.%H%M)
echo "window.NARACAL_VER = \"$VER\";" > version.js
echo "{\"ver\":\"$VER\"}" > version.json
sed -i '' -E "s/(app\.(js|css)\?v=)[0-9a-z.]+/\1$VER/g; s/(version|effects|imgedit|elements|templates|templates2|templates3|templates4|calendar|storage|lib|ai|defaults|assets|assets-brand|webfonts|fonts|news|video|media|vtemplates|astream)\.js\?v=[0-9a-z.]+/\1.js?v=$VER/g" index.html
git add -A
git -c user.name=narachadata -c user.email=masterlim01@gmail.com commit -q -m "${1:-업데이트} ($VER)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" || true
git push -q origin main
echo "pushed $VER"
for i in $(seq 1 30); do if curl -s "https://narachadata.github.io/design/version.json?t=$i" | grep -q "$VER"; then echo "live after $((i*10))s"; exit 0; fi; sleep 10; done
echo "아직 반영되지 않음 (잠시 후 다시 확인)"
