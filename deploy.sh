#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  deploy.sh — upload tracked files to FTP server
#  Credentials live in .env.deploy (gitignored)
#
#  Gebruik:
#    ./deploy.sh
#
#  Eerste keer:
#    cp .env.deploy.example .env.deploy
#    # vul .env.deploy met je echte credentials
#    chmod +x deploy.sh
#    ./deploy.sh
# ─────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load credentials
if [ -f .env.deploy ]; then
  # shellcheck disable=SC1091
  source .env.deploy
else
  echo "ERROR: .env.deploy not found."
  echo "Copy .env.deploy.example → .env.deploy and fill in your FTP credentials."
  exit 1
fi

: "${FTP_HOST:?Set FTP_HOST in .env.deploy}"
: "${FTP_USER:?Set FTP_USER in .env.deploy}"
: "${FTP_PASS:?Set FTP_PASS in .env.deploy}"
FTP_REMOTE_DIR="${FTP_REMOTE_DIR:-/www/wwwroot/auto.ingmarvanrheenen.nl}"

FILE_COUNT=$(git ls-files | wc -l | tr -d ' ')
echo ""
echo "  Deploying $FILE_COUNT files → ftp://$FTP_HOST$FTP_REMOTE_DIR"
echo ""

ERRORS=0
UPLOADED=0

git ls-files | while IFS= read -r file; do
  # Skip dotfiles/configs en deploy-tooling zelf
  case "$file" in
    .env.deploy.example|deploy.sh|CLAUDE.md|.gitignore|.claude/*|design/*)
      continue
      ;;
  esac

  RESULT=$(curl \
    --ftp-create-dirs \
    --silent \
    --show-error \
    --write-out "%{http_code}" \
    -T "$file" \
    "ftp://$FTP_HOST/$FTP_REMOTE_DIR/$file" \
    --user "$FTP_USER:$FTP_PASS" 2>&1) || {
      echo "  FAIL  $file"
      ERRORS=$((ERRORS + 1))
      continue
    }
  echo "  OK    $file"
  UPLOADED=$((UPLOADED + 1))
done

echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "  Deploy complete!"
else
  echo "  Done with $ERRORS error(s) — check output above."
  exit 1
fi
echo ""
