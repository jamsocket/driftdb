FROM mcr.microsoft.com/devcontainers/base:ubuntu

RUN apt-get update
RUN apt-get install -y build-essential

# Install node
RUN curl -sL https://deb.nodesource.com/setup_19.x | sh
RUN apt install nodejs
RUN npm install -g npm@9.3.1

# Install Cloudflare Wrangler CLI tool
RUN npm i -g wrangler@2.8.0

RUN npm i -g typescript@4.9.4

# Helpful CLI tools
RUN apt install -y bat exa

# ==== SWITCH TO USER ====

USER vscode

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

ENV PATH=/home/vscode/.cargo/bin:$PATH

# Helpful CLI tools (non-root installs)
RUN cargo install tokei
RUN cargo install du-dust
RUN cargo install cargo-workspaces

RUN rustup target add wasm32-unknown-unknown

# Disable terminal message (https://github.com/orgs/community/discussions/43534)
RUN mkdir -p $HOME/.config/vscode-dev-containers/ && touch $HOME/.config/vscode-dev-containers/first-run-notice-already-displayed

RUN echo "alias cat=batcat" >> $HOME/.zshrc
RUN echo "alias bat=batcat" >> $HOME/.zshrc
RUN echo "alias ls=exa" >> $HOME/.zshrc
RUN echo "bindkey -v" >> $HOME/.zshrc
