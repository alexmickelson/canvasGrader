FROM debian

RUN apt-get update && \
  DEBIAN_FRONTEND=noninteractive apt-get install -y \
  curl \
  gnupg \
  xvfb \
  x11vnc \
  fluxbox \
  chromium \
  ca-certificates \
  x11-utils \
  nodejs \
  npm \
  make \
  g++ \
  pip \
  && npm install -g n \
  && n stable \
  && apt-get install -y pipx python3-venv \
  && pipx install uv \
  && apt-get clean && rm -rf /var/lib/apt/lists/*
ENV PATH="/root/.local/bin:${PATH}"

RUN npx playwright install chrome

# Environment variables
ENV DISPLAY=:99
ENV SCREEN_RESOLUTION=1280x720x24

# Startup script
RUN cat <<'EOF' > /playwright-start.sh
#!/bin/bash

# Clean up any stale X server locks
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99

# Start virtual display
Xvfb :99 -screen 0 $SCREEN_RESOLUTION &
XVFB_PID=$!

# Wait for X server to be ready
for i in {1..10}; do
  if xdpyinfo -display :99 >/dev/null 2>&1; then
    echo "X server is ready"
    break
  fi
  echo "Waiting for X server... ($i/10)"
  sleep 1
done

# Start window manager
fluxbox &

# Start VNC server
x11vnc -nopw -display :99 -forever -shared &

# start playwright mcp with HTTP streaming in foreground (keeps container alive)
exec npx @playwright/mcp@latest --no-sandbox --isolated --port 3901

EOF

RUN chmod +x /playwright-start.sh
CMD ["/playwright-start.sh"]
