#!/bin/bash
# Copies IDL type files from anchor build output into sdk2 program type directories.

TYPES_DIR="../target/types"

cp "$TYPES_DIR/bid_wall.ts"                        ./src/bid_wall/v0.7/types/
cp "$TYPES_DIR/conditional_vault.ts"               ./src/conditional_vault/v0.4/types/
cp "$TYPES_DIR/futarchy.ts"                        ./src/futarchy/v0.6/types/
cp "$TYPES_DIR/gated_mint.ts"                      ./src/gated_mint/v0.1/types/
cp "$TYPES_DIR/launchpad.ts"                       ./src/launchpad/v0.6/types/
cp "$TYPES_DIR/launchpad_v7.ts"                    ./src/launchpad/v0.7/types/
cp "$TYPES_DIR/launchpad_v8.ts"                    ./src/launchpad/v0.8/types/
cp "$TYPES_DIR/liquidation.ts"                     ./src/liquidation/v0.7/types/
cp "$TYPES_DIR/mint_governor.ts"                   ./src/mint_governor/v0.7/types/
cp "$TYPES_DIR/performance_package_v2.ts"          ./src/performance_package_v2/v0.7/types/
cp "$TYPES_DIR/price_based_performance_package.ts" ./src/price_based_performance_package/v0.6/types/
