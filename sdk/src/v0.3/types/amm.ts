export type Amm = {
  version: "0.3.0";
  name: "amm";
  instructions: [
    {
      name: "createAmm";
      accounts: [
        {
          name: "user";
          isMut: true;
          isSigner: true;
        },
        {
          name: "amm";
          isMut: true;
          isSigner: false;
        },
        {
          name: "lpMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "baseMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "quoteMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vaultAtaBase";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vaultAtaQuote";
          isMut: true;
          isSigner: false;
        },
        {
          name: "associatedTokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "CreateAmmArgs";
          };
        }
      ];
    },
    {
      name: "addLiquidity";
      accounts: [
        {
          name: "user";
          isMut: true;
          isSigner: true;
        },
        {
          name: "amm";
          isMut: true;
          isSigner: false;
        },
        {
          name: "lpMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userLpAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userBaseAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userQuoteAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vaultAtaBase";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vaultAtaQuote";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "AddLiquidityArgs";
          };
        }
      ];
    },
    {
      name: "removeLiquidity";
      accounts: [
        {
          name: "user";
          isMut: true;
          isSigner: true;
        },
        {
          name: "amm";
          isMut: true;
          isSigner: false;
        },
        {
          name: "lpMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userLpAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userBaseAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userQuoteAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vaultAtaBase";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vaultAtaQuote";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "RemoveLiquidityArgs";
          };
        }
      ];
    },
    {
      name: "swap";
      accounts: [
        {
          name: "user";
          isMut: true;
          isSigner: true;
        },
        {
          name: "amm";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userBaseAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userQuoteAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vaultAtaBase";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vaultAtaQuote";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "SwapArgs";
          };
        }
      ];
    },
    {
      name: "crankThatTwap";
      accounts: [
        {
          name: "amm";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [];
    }
  ];
  accounts: [
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
            type: "publicKey";
          },
          {
            name: "baseMint";
            type: "publicKey";
          },
          {
            name: "quoteMint";
            type: "publicKey";
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
              defined: "TwapOracle";
            };
          }
        ];
      };
    }
  ];
  types: [
    {
      name: "AddLiquidityArgs";
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
          }
        ];
      };
    },
    {
      name: "CreateAmmArgs";
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
          }
        ];
      };
    },
    {
      name: "RemoveLiquidityArgs";
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
          }
        ];
      };
    },
    {
      name: "SwapArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "swapType";
            type: {
              defined: "SwapType";
            };
          },
          {
            name: "inputAmount";
            type: "u64";
          },
          {
            name: "outputAmountMin";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "TwapOracle";
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
              "ui_price = (price * (10**(base_decimals - quote_decimals))) / 1e12"
            ];
            type: "u128";
          },
          {
            name: "lastObservation";
            docs: [
              "If we did a raw TWAP over prices, someone could push the TWAP heavily with",
              "a few extremely large outliers. So we use observations, which can only move",
              "by `max_observation_change_per_update` per update."
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
              "aggregator at t2 being smaller than an aggregator at t1."
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
          }
        ];
      };
    },
    {
      name: "SwapType";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Buy";
          },
          {
            name: "Sell";
          }
        ];
      };
    }
  ];
  errors: [
    {
      code: 6000;
      name: "NoSlotsPassed";
      msg: "Can't get a TWAP before some observations have been stored";
    },
    {
      code: 6001;
      name: "NoReserves";
      msg: "Can't swap through a pool without token reserves on either side";
    },
    {
      code: 6002;
      name: "InputAmountOverflow";
      msg: "Input token amount is too large for a swap, causes overflow";
    },
    {
      code: 6003;
      name: "AddLiquidityCalculationError";
      msg: "Add liquidity calculation error";
    },
    {
      code: 6004;
      name: "DecimalScaleError";
      msg: "Error in decimal scale conversion";
    },
    {
      code: 6005;
      name: "SameTokenMints";
      msg: "You can't create an AMM pool where the token mints are the same";
    },
    {
      code: 6006;
      name: "SwapSlippageExceeded";
      msg: "A user wouldn't have gotten back their `output_amount_min`, reverting";
    },
    {
      code: 6007;
      name: "InsufficientBalance";
      msg: "The user had insufficient balance to do this";
    },
    {
      code: 6008;
      name: "ZeroLiquidityRemove";
      msg: "Must remove a non-zero amount of liquidity";
    },
    {
      code: 6009;
      name: "ZeroLiquidityToAdd";
      msg: "Cannot add liquidity with 0 tokens on either side";
    },
    {
      code: 6010;
      name: "ZeroMinLpTokens";
      msg: "Must specify a non-zero `min_lp_tokens` when adding to an existing pool";
    },
    {
      code: 6011;
      name: "AddLiquiditySlippageExceeded";
      msg: "LP wouldn't have gotten back `lp_token_min`";
    },
    {
      code: 6012;
      name: "AddLiquidityMaxBaseExceeded";
      msg: "LP would have spent more than `max_base_amount`";
    },
    {
      code: 6013;
      name: "InsufficientQuoteAmount";
      msg: "`quote_amount` must be greater than 100000000 when initializing a pool";
    },
    {
      code: 6014;
      name: "ZeroSwapAmount";
      msg: "Users must swap a non-zero amount";
    },
    {
      code: 6015;
      name: "ConstantProductInvariantFailed";
      msg: "K should always be increasing";
    },
    {
      code: 6016;
      name: "CastingOverflow";
      msg: "Casting has caused an overflow";
    }
  ];
};

export const IDL: Amm = {
  version: "0.3.0",
  name: "amm",
  instructions: [
    {
      name: "createAmm",
      accounts: [
        {
          name: "user",
          isMut: true,
          isSigner: true,
        },
        {
          name: "amm",
          isMut: true,
          isSigner: false,
        },
        {
          name: "lpMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "baseMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "quoteMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vaultAtaBase",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vaultAtaQuote",
          isMut: true,
          isSigner: false,
        },
        {
          name: "associatedTokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "args",
          type: {
            defined: "CreateAmmArgs",
          },
        },
      ],
    },
    {
      name: "addLiquidity",
      accounts: [
        {
          name: "user",
          isMut: true,
          isSigner: true,
        },
        {
          name: "amm",
          isMut: true,
          isSigner: false,
        },
        {
          name: "lpMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userLpAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userBaseAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userQuoteAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vaultAtaBase",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vaultAtaQuote",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "args",
          type: {
            defined: "AddLiquidityArgs",
          },
        },
      ],
    },
    {
      name: "removeLiquidity",
      accounts: [
        {
          name: "user",
          isMut: true,
          isSigner: true,
        },
        {
          name: "amm",
          isMut: true,
          isSigner: false,
        },
        {
          name: "lpMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userLpAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userBaseAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userQuoteAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vaultAtaBase",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vaultAtaQuote",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "args",
          type: {
            defined: "RemoveLiquidityArgs",
          },
        },
      ],
    },
    {
      name: "swap",
      accounts: [
        {
          name: "user",
          isMut: true,
          isSigner: true,
        },
        {
          name: "amm",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userBaseAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userQuoteAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vaultAtaBase",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vaultAtaQuote",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "args",
          type: {
            defined: "SwapArgs",
          },
        },
      ],
    },
    {
      name: "crankThatTwap",
      accounts: [
        {
          name: "amm",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "amm",
      type: {
        kind: "struct",
        fields: [
          {
            name: "bump",
            type: "u8",
          },
          {
            name: "createdAtSlot",
            type: "u64",
          },
          {
            name: "lpMint",
            type: "publicKey",
          },
          {
            name: "baseMint",
            type: "publicKey",
          },
          {
            name: "quoteMint",
            type: "publicKey",
          },
          {
            name: "baseMintDecimals",
            type: "u8",
          },
          {
            name: "quoteMintDecimals",
            type: "u8",
          },
          {
            name: "baseAmount",
            type: "u64",
          },
          {
            name: "quoteAmount",
            type: "u64",
          },
          {
            name: "oracle",
            type: {
              defined: "TwapOracle",
            },
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "AddLiquidityArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "quoteAmount",
            docs: ["How much quote token you will deposit to the pool"],
            type: "u64",
          },
          {
            name: "maxBaseAmount",
            docs: ["The maximum base token you will deposit to the pool"],
            type: "u64",
          },
          {
            name: "minLpTokens",
            docs: ["The minimum LP token you will get back"],
            type: "u64",
          },
        ],
      },
    },
    {
      name: "CreateAmmArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "twapInitialObservation",
            type: "u128",
          },
          {
            name: "twapMaxObservationChangePerUpdate",
            type: "u128",
          },
        ],
      },
    },
    {
      name: "RemoveLiquidityArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "lpTokensToBurn",
            type: "u64",
          },
          {
            name: "minQuoteAmount",
            type: "u64",
          },
          {
            name: "minBaseAmount",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "SwapArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "swapType",
            type: {
              defined: "SwapType",
            },
          },
          {
            name: "inputAmount",
            type: "u64",
          },
          {
            name: "outputAmountMin",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "TwapOracle",
      type: {
        kind: "struct",
        fields: [
          {
            name: "lastUpdatedSlot",
            type: "u64",
          },
          {
            name: "lastPrice",
            docs: [
              "A price is the number of quote units per base unit multiplied by 1e12.",
              "You cannot simply divide by 1e12 to get a price you can display in the UI",
              "because the base and quote decimals may be different. Instead, do:",
              "ui_price = (price * (10**(base_decimals - quote_decimals))) / 1e12",
            ],
            type: "u128",
          },
          {
            name: "lastObservation",
            docs: [
              "If we did a raw TWAP over prices, someone could push the TWAP heavily with",
              "a few extremely large outliers. So we use observations, which can only move",
              "by `max_observation_change_per_update` per update.",
            ],
            type: "u128",
          },
          {
            name: "aggregator",
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
            ],
            type: "u128",
          },
          {
            name: "maxObservationChangePerUpdate",
            docs: ["The most that an observation can change per update."],
            type: "u128",
          },
          {
            name: "initialObservation",
            docs: ["What the initial `latest_observation` is set to."],
            type: "u128",
          },
        ],
      },
    },
    {
      name: "SwapType",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Buy",
          },
          {
            name: "Sell",
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: "NoSlotsPassed",
      msg: "Can't get a TWAP before some observations have been stored",
    },
    {
      code: 6001,
      name: "NoReserves",
      msg: "Can't swap through a pool without token reserves on either side",
    },
    {
      code: 6002,
      name: "InputAmountOverflow",
      msg: "Input token amount is too large for a swap, causes overflow",
    },
    {
      code: 6003,
      name: "AddLiquidityCalculationError",
      msg: "Add liquidity calculation error",
    },
    {
      code: 6004,
      name: "DecimalScaleError",
      msg: "Error in decimal scale conversion",
    },
    {
      code: 6005,
      name: "SameTokenMints",
      msg: "You can't create an AMM pool where the token mints are the same",
    },
    {
      code: 6006,
      name: "SwapSlippageExceeded",
      msg: "A user wouldn't have gotten back their `output_amount_min`, reverting",
    },
    {
      code: 6007,
      name: "InsufficientBalance",
      msg: "The user had insufficient balance to do this",
    },
    {
      code: 6008,
      name: "ZeroLiquidityRemove",
      msg: "Must remove a non-zero amount of liquidity",
    },
    {
      code: 6009,
      name: "ZeroLiquidityToAdd",
      msg: "Cannot add liquidity with 0 tokens on either side",
    },
    {
      code: 6010,
      name: "ZeroMinLpTokens",
      msg: "Must specify a non-zero `min_lp_tokens` when adding to an existing pool",
    },
    {
      code: 6011,
      name: "AddLiquiditySlippageExceeded",
      msg: "LP wouldn't have gotten back `lp_token_min`",
    },
    {
      code: 6012,
      name: "AddLiquidityMaxBaseExceeded",
      msg: "LP would have spent more than `max_base_amount`",
    },
    {
      code: 6013,
      name: "InsufficientQuoteAmount",
      msg: "`quote_amount` must be greater than 100000000 when initializing a pool",
    },
    {
      code: 6014,
      name: "ZeroSwapAmount",
      msg: "Users must swap a non-zero amount",
    },
    {
      code: 6015,
      name: "ConstantProductInvariantFailed",
      msg: "K should always be increasing",
    },
    {
      code: 6016,
      name: "CastingOverflow",
      msg: "Casting has caused an overflow",
    },
  ],
};
