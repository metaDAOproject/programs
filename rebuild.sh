#!/bin/bash
set -e

# cargo-build-sbf 4.4.0 emits SBPFv3 by default; the cargo-installed copy must win over the one bundled with Agave 4.3.0.
export PATH="$HOME/.cargo/bin:$PATH"
[ "$(cargo build-sbf --version | head -1)" = "cargo-build-sbf 4.4.0" ] ||
  { echo "cargo-build-sbf 4.4.0 required: cargo install cargo-build-sbf --version 4.4.0 --locked"; exit 1; }

anchor build

cd sdk
yarn install
yarn build-local
cd ..
yarn install
yarn lint:fix
echo "✅ rebuild complete"
