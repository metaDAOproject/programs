/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL was converted from the legacy format with `anchor idl convert` and lives in
 * the `.json` file next to this one.
 */
export type Amm = {
  address: "AMM5G2nxuKUwCLRYTW7qqEwuoqCtNSjtbipwEmm2g8bH";
  metadata: {
    name: "amm";
    version: "0.3.0";
    spec: "0.1.0";
  };
  instructions: [
    {
      name: "createAmm";
      discriminator: [242, 91, 21, 170, 5, 68, 125, 64];
      accounts: [
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "amm";
          writable: true;
        },
        {
          name: "lpMint";
          writable: true;
        },
        {
          name: "baseMint";
        },
        {
          name: "quoteMint";
        },
        {
          name: "vaultAtaBase";
          writable: true;
        },
        {
          name: "vaultAtaQuote";
          writable: true;
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "createAmmArgs";
            };
          };
        },
      ];
    },
    {
      name: "addLiquidity";
      discriminator: [181, 157, 89, 67, 143, 182, 52, 72];
      accounts: [
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "amm";
          writable: true;
        },
        {
          name: "lpMint";
          writable: true;
        },
        {
          name: "userLpAccount";
          writable: true;
        },
        {
          name: "userBaseAccount";
          writable: true;
        },
        {
          name: "userQuoteAccount";
          writable: true;
        },
        {
          name: "vaultAtaBase";
          writable: true;
        },
        {
          name: "vaultAtaQuote";
          writable: true;
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "addLiquidityArgs";
            };
          };
        },
      ];
    },
    {
      name: "removeLiquidity";
      discriminator: [80, 85, 209, 72, 24, 206, 177, 108];
      accounts: [
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "amm";
          writable: true;
        },
        {
          name: "lpMint";
          writable: true;
        },
        {
          name: "userLpAccount";
          writable: true;
        },
        {
          name: "userBaseAccount";
          writable: true;
        },
        {
          name: "userQuoteAccount";
          writable: true;
        },
        {
          name: "vaultAtaBase";
          writable: true;
        },
        {
          name: "vaultAtaQuote";
          writable: true;
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "removeLiquidityArgs";
            };
          };
        },
      ];
    },
    {
      name: "swap";
      discriminator: [248, 198, 158, 145, 225, 117, 135, 200];
      accounts: [
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "amm";
          writable: true;
        },
        {
          name: "userBaseAccount";
          writable: true;
        },
        {
          name: "userQuoteAccount";
          writable: true;
        },
        {
          name: "vaultAtaBase";
          writable: true;
        },
        {
          name: "vaultAtaQuote";
          writable: true;
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "swapArgs";
            };
          };
        },
      ];
    },
    {
      name: "crankThatTwap";
      discriminator: [220, 100, 25, 249, 0, 92, 195, 193];
      accounts: [
        {
          name: "amm";
          writable: true;
        },
      ];
      args: [];
    },
  ];
  accounts: [
    {
      name: "amm";
      discriminator: [143, 245, 200, 17, 74, 214, 196, 135];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "noSlotsPassed";
      msg: "Can't get a TWAP before some observations have been stored";
    },
    {
      code: 6001;
      name: "noReserves";
      msg: "Can't swap through a pool without token reserves on either side";
    },
    {
      code: 6002;
      name: "inputAmountOverflow";
      msg: "Input token amount is too large for a swap, causes overflow";
    },
    {
      code: 6003;
      name: "addLiquidityCalculationError";
      msg: "Add liquidity calculation error";
    },
    {
      code: 6004;
      name: "decimalScaleError";
      msg: "Error in decimal scale conversion";
    },
    {
      code: 6005;
      name: "sameTokenMints";
      msg: "You can't create an AMM pool where the token mints are the same";
    },
    {
      code: 6006;
      name: "swapSlippageExceeded";
      msg: "A user wouldn't have gotten back their `output_amount_min`, reverting";
    },
    {
      code: 6007;
      name: "insufficientBalance";
      msg: "The user had insufficient balance to do this";
    },
    {
      code: 6008;
      name: "zeroLiquidityRemove";
      msg: "Must remove a non-zero amount of liquidity";
    },
    {
      code: 6009;
      name: "zeroLiquidityToAdd";
      msg: "Cannot add liquidity with 0 tokens on either side";
    },
    {
      code: 6010;
      name: "zeroMinLpTokens";
      msg: "Must specify a non-zero `min_lp_tokens` when adding to an existing pool";
    },
    {
      code: 6011;
      name: "addLiquiditySlippageExceeded";
      msg: "LP wouldn't have gotten back `lp_token_min`";
    },
    {
      code: 6012;
      name: "addLiquidityMaxBaseExceeded";
      msg: "LP would have spent more than `max_base_amount`";
    },
    {
      code: 6013;
      name: "insufficientQuoteAmount";
      msg: "`quote_amount` must be greater than 100000000 when initializing a pool";
    },
    {
      code: 6014;
      name: "zeroSwapAmount";
      msg: "Users must swap a non-zero amount";
    },
    {
      code: 6015;
      name: "constantProductInvariantFailed";
      msg: "K should always be increasing";
    },
    {
      code: 6016;
      name: "castingOverflow";
      msg: "Casting has caused an overflow";
    },
  ];
  types: [
    {
      name: "addLiquidityArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "quoteAmount";
            docs: ["How much quote token you will deposit to the pool"];
            type: "u64";
          },
          {
            name: "maxBaseAmount";
            docs: ["The maximum base token you will deposit to the pool"];
            type: "u64";
          },
          {
            name: "minLpTokens";
            docs: ["The minimum LP token you will get back"];
            type: "u64";
          },
        ];
      };
    },
    {
      name: "createAmmArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "twapInitialObservation";
            type: "u128";
          },
          {
            name: "twapMaxObservationChangePerUpdate";
            type: "u128";
          },
        ];
      };
    },
    {
      name: "removeLiquidityArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "lpTokensToBurn";
            type: "u64";
          },
          {
            name: "minQuoteAmount";
            type: "u64";
          },
          {
            name: "minBaseAmount";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "swapArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "swapType";
            type: {
              defined: {
                name: "swapType";
              };
            };
          },
          {
            name: "inputAmount";
            type: "u64";
          },
          {
            name: "outputAmountMin";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "twapOracle";
      type: {
        kind: "struct";
        fields: [
          {
            name: "lastUpdatedSlot";
            type: "u64";
          },
          {
            name: "lastPrice";
            docs: [
              "A price is the number of quote units per base unit multiplied by 1e12.",
              "You cannot simply divide by 1e12 to get a price you can display in the UI",
              "because the base and quote decimals may be different. Instead, do:",
              "ui_price = (price * (10**(base_decimals - quote_decimals))) / 1e12",
            ];
            type: "u128";
          },
          {
            name: "lastObservation";
            docs: [
              "If we did a raw TWAP over prices, someone could push the TWAP heavily with",
              "a few extremely large outliers. So we use observations, which can only move",
              "by `max_observation_change_per_update` per update.",
            ];
            type: "u128";
          },
          {
            name: "aggregator";
            docs: [
              "Running sum of slots_per_last_update * last_observation.",
              "",
              "Assuming latest observations are as big as possible (u64::MAX * 1e12),",
              "we can store 18 million slots worth of observations, which turns out to",
              "be ~85 days worth of slots.",
              "",
              "Assuming that latest observations are 100x smaller than they could theoretically",
              "be, we can store 8500 days (23 years) worth of them. Even this is a very",
              "very conservative assumption - META/USDC prices should be between 1e9 and",
              "1e15, which would overflow after 1e15 years worth of slots.",
              "",
              "So in the case of an overflow, the aggregator rolls back to 0. It's the",
              "client's responsibility to sanity check the assets or to handle an",
              "aggregator at t2 being smaller than an aggregator at t1.",
            ];
            type: "u128";
          },
          {
            name: "maxObservationChangePerUpdate";
            docs: ["The most that an observation can change per update."];
            type: "u128";
          },
          {
            name: "initialObservation";
            docs: ["What the initial `latest_observation` is set to."];
            type: "u128";
          },
        ];
      };
    },
    {
      name: "swapType";
      type: {
        kind: "enum";
        variants: [
          {
            name: "buy";
          },
          {
            name: "sell";
          },
        ];
      };
    },
    {
      name: "amm";
      type: {
        kind: "struct";
        fields: [
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "createdAtSlot";
            type: "u64";
          },
          {
            name: "lpMint";
            type: "pubkey";
          },
          {
            name: "baseMint";
            type: "pubkey";
          },
          {
            name: "quoteMint";
            type: "pubkey";
          },
          {
            name: "baseMintDecimals";
            type: "u8";
          },
          {
            name: "quoteMintDecimals";
            type: "u8";
          },
          {
            name: "baseAmount";
            type: "u64";
          },
          {
            name: "quoteAmount";
            type: "u64";
          },
          {
            name: "oracle";
            type: {
              defined: {
                name: "twapOracle";
              };
            };
          },
        ];
      };
    },
  ];
};
