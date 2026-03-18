#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$ROOT_DIR/target/deploy"
ACCOUNTS_DIR="$ROOT_DIR/test-ledger-accounts"

ACCOUNTS_DIR_FLAG=()
if [ -d "$ACCOUNTS_DIR" ]; then
  ACCOUNTS_DIR_FLAG=(--account-dir "$ACCOUNTS_DIR")
fi

solana-test-validator \
  --bpf-program WALL8ucBuUyL46QYxwYJjidaFYhdvxUFrgvBxPshERx "$DEPLOY_DIR/bid_wall.so" \
  --bpf-program VLTX1ishMBbcX3rdBWGssxawAo1Q2X2qxYFYqiGodVg "$DEPLOY_DIR/conditional_vault.so" \
  --bpf-program FUTARELBfJfQ8RDGhg1wdhddq1odMAJUePHFuBYfUxKq "$DEPLOY_DIR/futarchy.so" \
  --bpf-program MooNyh4CBUYEKyXVnjGYQ8mEiJDpGvJMdvrZx1iGeHV "$DEPLOY_DIR/launchpad.so" \
  --bpf-program moontUzsdepotRGe5xsfip7vLPTJnVuafqdUWexVnPM "$DEPLOY_DIR/launchpad_v7.so" \
  --bpf-program LiQnowFbFQdYyZhF4pUbpsrZCjxRTQ1upKJxZ2VXjde "$DEPLOY_DIR/liquidation.so" \
  --bpf-program gvnr27cVeyW3AVf3acL7VCJ5WjGAphytnsgcK1feHyH "$DEPLOY_DIR/mint_governor.so" \
  --bpf-program pPV2pfrxnmstSb9j7kEeCLny5BGj6SNwCWGd6xbGGzz "$DEPLOY_DIR/performance_package_v2.so" \
  --bpf-program pbPPQH7jyKoSLu8QYs3rSY3YkDRXEBojKbTgnUg7NDS "$DEPLOY_DIR/price_based_performance_package.so" \
  ${ACCOUNTS_DIR_FLAG[@]} \
  --reset
