#
# Docker image to generate deterministic, verifiable builds of Anchor programs.
# This must be run *after* a given ANCHOR_CLI version is published and a git tag
# is released on GitHub.
#

# amd64: Solana 1.17 has no prebuilt aarch64-linux binaries.
FROM --platform=linux/amd64 rust:1.75

ARG DEBIAN_FRONTEND=noninteractive

# Keep in sync with Anchor.toml.
ARG SOLANA_CLI="1.17.34"
ARG ANCHOR_CLI="0.29.0"
ARG NODE_VERSION="v18.16.0"

ENV HOME="/root"
ENV PATH="${HOME}/.cargo/bin:${PATH}"
ENV PATH="${HOME}/.local/share/solana/install/active_release/bin:${PATH}"
ENV PATH="${HOME}/.nvm/versions/node/${NODE_VERSION}/bin:${PATH}"

# Install base utilities.
RUN mkdir -p /workdir && mkdir -p /tmp && \
    apt-get update -qq && apt-get upgrade -qq && apt-get install -qq \
    build-essential git curl wget jq pkg-config python3-pip \
    libssl-dev libudev-dev

#RUN wget http://nz2.archive.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2.19_amd64.deb
#RUN dpkg -i libssl1.1_1.1.1f-1ubuntu2.19_amd64.deb

# Install rust.
RUN curl "https://sh.rustup.rs" -sfo rustup.sh && \
    sh rustup.sh -y && \
    rustup component add rustfmt clippy

# Install node / npm / yarn.
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash
ENV NVM_DIR="${HOME}/.nvm"
RUN . $NVM_DIR/nvm.sh && \
    nvm install ${NODE_VERSION} && \
    nvm use ${NODE_VERSION} && \
    nvm alias default node && \
    npm install -g yarn

# Install Solana tools.
RUN curl -sSfL "https://release.anza.xyz/v${SOLANA_CLI}/install" -o /tmp/solana-install.sh && \
    sh /tmp/solana-install.sh && \
    rm /tmp/solana-install.sh

# Install anchor.
RUN cargo install --git https://github.com/coral-xyz/anchor --tag v${ANCHOR_CLI} anchor-cli --locked

# set up keypair
RUN solana-keygen new --no-bip39-passphrase && \
    solana config set --url localhost

# zsh
RUN apt-get update -qq && apt-get install -qq zsh && \
    sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended && \
    chsh -s /usr/bin/zsh root

WORKDIR /workdir

