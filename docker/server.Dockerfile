FROM node:20

RUN npm i -g pnpm

RUN apt-get update && apt-get install -y \
  gh \
  openssh-client \
  sshpass \
  imagemagick \
  graphicsmagick \
  ghostscript

RUN cat > /start.sh <<'EOF'
#!/bin/sh
pnpm install
pnpm run server
EOF

RUN chmod +x /start.sh

CMD ["/start.sh"]
