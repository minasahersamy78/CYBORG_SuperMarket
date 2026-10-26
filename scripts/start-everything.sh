#!/usr/bin/env bash
# Cyborg Supermarket - Master One-Command Ecosystem Launcher
# Launches: Backend (3000), Admin (3001), Customer Web (3002), Voice AI (5000), Desktop POS (Linux), Mobile App (Linux)

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo -e "\033[1;34m================================================================\033[0m"
echo -e "\033[1;32m⚡ CYBORG SUPERMARKET — LAUNCHING COMPLETE SYSTEM (ONE-CLICK)\033[0m"
echo -e "\033[1;34m================================================================\033[0m"
echo -e "🟢 1. Core REST API:            http://localhost:3000"
echo -e "🔵 2. Admin Operations HQ:      http://localhost:3001"
echo -e "🟣 3. Customer Web Storefront:  http://localhost:3002"
echo -e "🖥️  4. Flutter Desktop POS:       Linux Native Window"
echo -e "📱 5. Flutter Mobile App:        Linux Native Window"
echo -e "\033[1;34m================================================================\033[0m\n"

# 1. Start Web Ecosystem & Backend (Ports 3000, 3001, 3002)
node scripts/start-all.js &
SERVER_PID=$!

# Wait for HTTP servers to bind
sleep 3

# 2. Launch Desktop POS Application
echo -e "\n\033[1;36m[DESKTOP POS] Launching Flutter Desktop POS on Linux...\033[0m"
(cd "$DIR/desktop-application" && flutter run -d linux) &
POS_PID=$!

# Wait briefly for Flutter build lock release
sleep 4

# 3. Launch Mobile Application
echo -e "\n\033[1;35m[MOBILE APP] Launching Flutter Mobile App on Linux...\033[0m"
(cd "$DIR/mobile-application" && flutter run -d linux) &
MOBILE_PID=$!

# Cleanup on exit (Ctrl+C)
cleanup() {
  echo -e "\n\033[1;33m[SHUTDOWN] Terminating all services and applications...\033[0m"
  kill $SERVER_PID $POS_PID $MOBILE_PID 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT
wait
