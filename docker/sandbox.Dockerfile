FROM docker:dind

RUN apk upgrade --no-cache && \
  apk add --no-cache \
  curl \
  wget \
  bash \
  ca-certificates \
  icu-libs \
  libstdc++ \
  tmux \
  screen \
  openssh-server \
  nodejs npm \
  python3 py3-pip

RUN wget https://dot.net/v1/dotnet-install.sh -O dotnet-install.sh && \
  chmod +x dotnet-install.sh && \
  ./dotnet-install.sh --channel 9.0 --install-dir /usr/share/dotnet && \
  rm dotnet-install.sh && \
  ln -s /usr/share/dotnet/dotnet /usr/bin/dotnet

RUN npm install -g pnpm
RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
  echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> /etc/profile
ENV PATH="/root/.cargo/bin:$PATH"

RUN mkdir -p /run/sshd && \
  ssh-keygen -A && \
  echo 'root:password' | chpasswd && \
  sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config

RUN printf '#!/bin/sh\n/usr/local/bin/dockerd-entrypoint.sh &\nexec /usr/sbin/sshd -D\n' > /start.sh && \
  chmod +x /start.sh

CMD ["/start.sh"]

