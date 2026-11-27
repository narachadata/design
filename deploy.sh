#!/bin/bash
# 배포: 버전 파일 갱신 → 커밋 → 푸시 → 사이트 반영 확인. 사용: ./deploy.sh "설명"
set -e
cd "$(dirname "$0")"
VER=$(date +%Y%m%d.%H%M)
echo "window.NARACAL_VER = \"$VER\";" > version.js
echo "{\"ver\":\"$VER\"}" > version.json
sed -i '' -E "s/(app\.(js|css)\?v=)[0-9a-z.]+/\1$VER/g; s/(version|effects|imgedit|elements|templates|templates2|templates3|templates4|templates5|templates6|templates7|book|import|calendar|storage|lib|ai|defaults|webfonts|fonts|news|video|media|vtemplates|astream|live|manual|attend|aichat|aistudio|gdrive)\.js\?v=[0-9a-z.]+/\1.js?v=$VER/g" index.html
# 큰 그림 묶음(assets.js 11MB 등)은 내용이 바뀔 때만 번호를 바꿈 — 배포마다 다시 받지 않게 (11/26 성능 조)
H=$(md5 -q fonts/fonts.css | cut -c1-10); sed -i '' -E "s/(fonts\/fonts\.css\?v=)[0-9a-z.]+/\1$H/g" index.html  # 글꼴 설정도 바뀔 때만 번호 (11/26 WOFF2)
for A in assets assets-brand; do if [ -f "$A.js" ]; then H=$(md5 -q "$A.js" | cut -c1-10); sed -i '' -E "s/($A)\.js\?v=[0-9a-z.]+/\1.js?v=$H/g" index.html; fi; done
# 새 파일 검사 (11/26 보안 조): 허용한 종류가 아닌 새 파일(명단 엑셀·한글·문서·사진 등)이 있으면 멈춤 — 실수로 공개되지 않게
BAD=$(git ls-files --others --exclude-standard -z | tr '\0' '\n' | grep -v -E '^(assets/.+\.(png|jpe?g|webp|svg|gif|pdf|md)|fonts/.+\.(woff2?|ttf|otf|css|js|md)|[^/]+\.(js|css|html|md|sh)|version\.json|manifest\.json|\.nojekyll)$' || true)
if [ -n "$BAD" ]; then echo "배포 멈춤: 공개하면 안 될 수 있는 새 파일이 있습니다 — 옮기거나 .gitignore에 넣은 뒤 다시:"; echo "$BAD"; exit 1; fi
git add -A
# 커밋 메일 주소는 스크립트에 적지 않고, 이 폴더의 git 설정(git config user.email)에서 씀 — 처음 한 번 팀장님이 직접 등록
if ! git config user.email >/dev/null; then echo "배포 멈춤: 이 폴더에 커밋 메일 주소가 없습니다. 한 번만 실행하세요 → git config user.email \"메일 주소\""; git reset -q; exit 1; fi
git -c user.name=narachadata commit -q -m "${1:-업데이트} ($VER)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" || true
git push -q origin main
echo "pushed $VER"
for i in $(seq 1 30); do if curl -s "https://narachadata.github.io/design/version.json?t=$i" | grep -q "$VER"; then echo "live after $((i*10))s"; exit 0; fi; sleep 10; done
echo "아직 반영되지 않음 (잠시 후 다시 확인)"
