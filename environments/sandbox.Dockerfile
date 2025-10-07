FROM docker:dind

# Install dependencies (Alpine-based commands)
RUN apk add --no-cache \
  curl \
  wget \
  bash \
  ca-certificates \
  icu-libs \
  libstdc++

# Install .NET 9
RUN wget https://dot.net/v1/dotnet-install.sh -O dotnet-install.sh && \
  chmod +x dotnet-install.sh && \
  ./dotnet-install.sh --channel 9.0 --install-dir /usr/share/dotnet && \
  rm dotnet-install.sh && \
  ln -s /usr/share/dotnet/dotnet /usr/bin/dotnet

# Install Node.js and npm
RUN apk add --no-cache nodejs npm

# Install pnpm
RUN npm install -g pnpm

# Install Python and pip (required for uv)
RUN apk add --no-cache python3 py3-pip

# Install uv for Python
RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
  echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> /etc/profile

# Add uv to PATH for all users
ENV PATH="/root/.cargo/bin:$PATH"

