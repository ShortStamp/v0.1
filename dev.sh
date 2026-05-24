#!/bin/bash

# ShortStamp — start all three services concurrently

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Starting ShortStamp dev environment...${NC}"
echo ""

# Kill background jobs on exit
trap 'echo -e "\n${RED}Shutting down...${NC}"; kill $(jobs -p) 2>/dev/null; exit' SIGINT SIGTERM EXIT

# Start backend
echo -e "${BLUE}[backend]${NC} Starting FastAPI on port 8000..."
(
  cd "$ROOT_DIR/backend"
  if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}[backend]${NC} Creating virtual environment..."
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -e ".[dev]" -q
  else
    source .venv/bin/activate
  fi
  uvicorn app.main:app --reload --port 8000
) &
BACKEND_PID=$!

# Start website
echo -e "${BLUE}[website]${NC} Starting Next.js on port 3000..."
(
  cd "$ROOT_DIR/website"
  if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[website]${NC} Installing dependencies..."
    npm install -q
  fi
  npm run dev
) &
WEBSITE_PID=$!

# Start desktop
echo -e "${BLUE}[desktop]${NC} Starting Electron dev..."
(
  cd "$ROOT_DIR/desktop"
  if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[desktop]${NC} Installing dependencies..."
    npm install -q
  fi
  npm run dev
) &
DESKTOP_PID=$!

echo ""
echo -e "${GREEN}All services started:${NC}"
echo -e "  Website:  ${BLUE}http://localhost:3000${NC}"
echo -e "  Backend:  ${BLUE}http://localhost:8000${NC}"
echo -e "  Desktop:  Electron overlay"
echo ""
echo -e "Press ${RED}Ctrl+C${NC} to stop all services."

wait
