#!/bin/bash
# Copies each program's IDL JSON and TypeScript type helper from the anchor build output into
# the SDK module for that program version.
set -e
cd "$(dirname "$0")"

IDL_DIR="../target/idl"
TYPES_DIR="../target/types"

cp "$IDL_DIR/bid_wall.json"                        "$TYPES_DIR/bid_wall.ts"                        ./src/bid_wall/v0.7/types/
cp "$IDL_DIR/conditional_vault.json"               "$TYPES_DIR/conditional_vault.ts"               ./src/conditional_vault/v0.4/types/
cp "$IDL_DIR/futarchy.json"                        "$TYPES_DIR/futarchy.ts"                        ./src/futarchy/v0.6/types/
cp "$IDL_DIR/gated_mint.json"                      "$TYPES_DIR/gated_mint.ts"                      ./src/gated_mint/v0.1/types/
cp "$IDL_DIR/launchpad.json"                       "$TYPES_DIR/launchpad.ts"                       ./src/launchpad/v0.6/types/
cp "$IDL_DIR/launchpad_v7.json"                    "$TYPES_DIR/launchpad_v7.ts"                    ./src/launchpad/v0.7/types/
cp "$IDL_DIR/launchpad_v8.json"                    "$TYPES_DIR/launchpad_v8.ts"                    ./src/launchpad/v0.8/types/
cp "$IDL_DIR/liquidation.json"                     "$TYPES_DIR/liquidation.ts"                     ./src/liquidation/v0.7/types/
cp "$IDL_DIR/mint_governor.json"                   "$TYPES_DIR/mint_governor.ts"                   ./src/mint_governor/v0.7/types/
cp "$IDL_DIR/performance_package_v2.json"          "$TYPES_DIR/performance_package_v2.ts"          ./src/performance_package_v2/v0.7/types/
cp "$IDL_DIR/price_based_performance_package.json" "$TYPES_DIR/price_based_performance_package.ts" ./src/price_based_performance_package/v0.6/types/
