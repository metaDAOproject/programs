export type SharedLiquidityManager = {
  version: "0.1.0";
  name: "shared_liquidity_manager";
  instructions: [
    {
      name: "initializeSharedLiquidityPool";
      accounts: [
        {
          name: "slPool";
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
          name: "spotPool";
          isMut: false;
          isSigner: false;
        },
        {
          name: "slPoolSpotLpVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "slPoolBaseVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "slPoolQuoteVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "spotPoolLpMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "dao";
          isMut: false;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
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
        },
        {
          name: "eventAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "program";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "depositSharedLiquidity";
      accounts: [
        {
          name: "slPool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "spotPool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "slPoolSpotLpVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userQuoteTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userBaseTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "spotPoolBaseVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "spotPoolQuoteVault";
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
          name: "spotPoolLpMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userLpTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userSlPoolPosition";
          isMut: true;
          isSigner: false;
        },
        {
          name: "user";
          isMut: true;
          isSigner: true;
        },
        {
          name: "raydiumAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram2022";
          isMut: false;
          isSigner: false;
        },
        {
          name: "cpSwapProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "eventAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "program";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "DepositSharedLiquidityArgs";
          };
        }
      ];
    },
    {
      name: "withdrawSharedLiquidity";
      accounts: [
        {
          name: "pool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "eventAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "program";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "initializeProposalWithLiquidity";
      accounts: [
        {
          name: "slPool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "proposalCreator";
          isMut: false;
          isSigner: true;
        },
        {
          name: "proposal";
          isMut: false;
          isSigner: false;
        },
        {
          name: "slPoolBaseVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "slPoolQuoteVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "slPoolSpotLpVault";
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
          name: "raydium";
          accounts: [
            {
              name: "spotPool";
              isMut: true;
              isSigner: false;
            },
            {
              name: "spotPoolBaseVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "spotPoolQuoteVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "lpMint";
              isMut: true;
              isSigner: false;
            },
            {
              name: "raydiumAuthority";
              isMut: false;
              isSigner: false;
            },
            {
              name: "tokenProgram";
              isMut: false;
              isSigner: false;
            },
            {
              name: "tokenProgram2022";
              isMut: false;
              isSigner: false;
            },
            {
              name: "cpSwapProgram";
              isMut: false;
              isSigner: false;
            },
            {
              name: "memoProgram";
              isMut: false;
              isSigner: false;
            }
          ];
        },
        {
          name: "dao";
          isMut: true;
          isSigner: false;
        },
        {
          name: "autocratProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "eventAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "program";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "removeProposalLiquidity";
      accounts: [
        {
          name: "pool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "eventAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "program";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    }
  ];
  accounts: [
    {
      name: "liquidityPosition";
      type: {
        kind: "struct";
        fields: [
          {
            name: "owner";
            docs: ["The owner of this position"];
            type: "publicKey";
          },
          {
            name: "pool";
            docs: ["The shared liquidity pool this position belongs to"];
            type: "publicKey";
          },
          {
            name: "underlyingSpotLpShares";
            docs: [
              "The amount of underlying spot LP shares this position represents"
            ];
            type: "u64";
          },
          {
            name: "bump";
            docs: ["The PDA bump"];
            type: "u8";
          }
        ];
      };
    },
    {
      name: "sharedLiquidityPool";
      type: {
        kind: "struct";
        fields: [
          {
            name: "dao";
            docs: ["The DAO."];
            type: "publicKey";
          },
          {
            name: "baseMint";
            docs: ["The base mint."];
            type: "publicKey";
          },
          {
            name: "quoteMint";
            docs: ["The quote mint."];
            type: "publicKey";
          },
          {
            name: "spotPool";
            docs: ["The Raydium spot pool state."];
            type: "publicKey";
          },
          {
            name: "isBaseToken0";
            docs: [
              "Whether the base token is token0 in the Raydium spot pool (otherwise it's token1)."
            ];
            type: "bool";
          },
          {
            name: "activeProposal";
            docs: [
              "Whether there's an active proposal using liquidity from this pool."
            ];
            type: {
              option: "publicKey";
            };
          },
          {
            name: "slPoolSpotLpVault";
            docs: [
              "Holds the Raydium LP tokens for the shared liquidity pool."
            ];
            type: "publicKey";
          },
          {
            name: "slPoolBaseVault";
            docs: [
              "Holds the base tokens for the shared liquidity pool when it's moving liquidity to/from proposals."
            ];
            type: "publicKey";
          },
          {
            name: "slPoolQuoteVault";
            docs: [
              "Holds the quote tokens for the shared liquidity pool when it's moving liquidity to/from proposals."
            ];
            type: "publicKey";
          },
          {
            name: "seqNum";
            docs: [
              "The sequence number of this shared liquidity pool. Useful for sorting events."
            ];
            type: "u64";
          },
          {
            name: "pdaBump";
            docs: ["The PDA bump."];
            type: "u8";
          }
        ];
      };
    }
  ];
  types: [
    {
      name: "DepositSharedLiquidityArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "lpTokenAmount";
            docs: ["The amount of LP tokens to mint"];
            type: "u64";
          },
          {
            name: "maxQuoteTokenAmount";
            docs: ["The maximum amount of quote tokens to deposit"];
            type: "u64";
          },
          {
            name: "maxBaseTokenAmount";
            docs: ["The maximum amount of base tokens to deposit"];
            type: "u64";
          }
        ];
      };
    },
    {
      name: "ErrorCode";
      type: {
        kind: "enum";
        variants: [
          {
            name: "NoLpTokensInPool";
          },
          {
            name: "NotEnoughLpTokens";
          }
        ];
      };
    }
  ];
  errors: [
    {
      code: 6000;
      name: "PoolInUse";
      msg: "Pool is currently being used by an active proposal";
    }
  ];
};

export const IDL: SharedLiquidityManager = {
  version: "0.1.0",
  name: "shared_liquidity_manager",
  instructions: [
    {
      name: "initializeSharedLiquidityPool",
      accounts: [
        {
          name: "slPool",
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
          name: "spotPool",
          isMut: false,
          isSigner: false,
        },
        {
          name: "slPoolSpotLpVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "slPoolBaseVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "slPoolQuoteVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "spotPoolLpMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "dao",
          isMut: false,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
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
        {
          name: "eventAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "program",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "depositSharedLiquidity",
      accounts: [
        {
          name: "slPool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "spotPool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "slPoolSpotLpVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userQuoteTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userBaseTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "spotPoolBaseVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "spotPoolQuoteVault",
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
          name: "spotPoolLpMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userLpTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userSlPoolPosition",
          isMut: true,
          isSigner: false,
        },
        {
          name: "user",
          isMut: true,
          isSigner: true,
        },
        {
          name: "raydiumAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram2022",
          isMut: false,
          isSigner: false,
        },
        {
          name: "cpSwapProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "eventAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "program",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "args",
          type: {
            defined: "DepositSharedLiquidityArgs",
          },
        },
      ],
    },
    {
      name: "withdrawSharedLiquidity",
      accounts: [
        {
          name: "pool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "eventAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "program",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "initializeProposalWithLiquidity",
      accounts: [
        {
          name: "slPool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "proposalCreator",
          isMut: false,
          isSigner: true,
        },
        {
          name: "proposal",
          isMut: false,
          isSigner: false,
        },
        {
          name: "slPoolBaseVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "slPoolQuoteVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "slPoolSpotLpVault",
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
          name: "raydium",
          accounts: [
            {
              name: "spotPool",
              isMut: true,
              isSigner: false,
            },
            {
              name: "spotPoolBaseVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "spotPoolQuoteVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "lpMint",
              isMut: true,
              isSigner: false,
            },
            {
              name: "raydiumAuthority",
              isMut: false,
              isSigner: false,
            },
            {
              name: "tokenProgram",
              isMut: false,
              isSigner: false,
            },
            {
              name: "tokenProgram2022",
              isMut: false,
              isSigner: false,
            },
            {
              name: "cpSwapProgram",
              isMut: false,
              isSigner: false,
            },
            {
              name: "memoProgram",
              isMut: false,
              isSigner: false,
            },
          ],
        },
        {
          name: "dao",
          isMut: true,
          isSigner: false,
        },
        {
          name: "autocratProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "eventAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "program",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "removeProposalLiquidity",
      accounts: [
        {
          name: "pool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "eventAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "program",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "liquidityPosition",
      type: {
        kind: "struct",
        fields: [
          {
            name: "owner",
            docs: ["The owner of this position"],
            type: "publicKey",
          },
          {
            name: "pool",
            docs: ["The shared liquidity pool this position belongs to"],
            type: "publicKey",
          },
          {
            name: "underlyingSpotLpShares",
            docs: [
              "The amount of underlying spot LP shares this position represents",
            ],
            type: "u64",
          },
          {
            name: "bump",
            docs: ["The PDA bump"],
            type: "u8",
          },
        ],
      },
    },
    {
      name: "sharedLiquidityPool",
      type: {
        kind: "struct",
        fields: [
          {
            name: "dao",
            docs: ["The DAO."],
            type: "publicKey",
          },
          {
            name: "baseMint",
            docs: ["The base mint."],
            type: "publicKey",
          },
          {
            name: "quoteMint",
            docs: ["The quote mint."],
            type: "publicKey",
          },
          {
            name: "spotPool",
            docs: ["The Raydium spot pool state."],
            type: "publicKey",
          },
          {
            name: "isBaseToken0",
            docs: [
              "Whether the base token is token0 in the Raydium spot pool (otherwise it's token1).",
            ],
            type: "bool",
          },
          {
            name: "activeProposal",
            docs: [
              "Whether there's an active proposal using liquidity from this pool.",
            ],
            type: {
              option: "publicKey",
            },
          },
          {
            name: "slPoolSpotLpVault",
            docs: [
              "Holds the Raydium LP tokens for the shared liquidity pool.",
            ],
            type: "publicKey",
          },
          {
            name: "slPoolBaseVault",
            docs: [
              "Holds the base tokens for the shared liquidity pool when it's moving liquidity to/from proposals.",
            ],
            type: "publicKey",
          },
          {
            name: "slPoolQuoteVault",
            docs: [
              "Holds the quote tokens for the shared liquidity pool when it's moving liquidity to/from proposals.",
            ],
            type: "publicKey",
          },
          {
            name: "seqNum",
            docs: [
              "The sequence number of this shared liquidity pool. Useful for sorting events.",
            ],
            type: "u64",
          },
          {
            name: "pdaBump",
            docs: ["The PDA bump."],
            type: "u8",
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "DepositSharedLiquidityArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "lpTokenAmount",
            docs: ["The amount of LP tokens to mint"],
            type: "u64",
          },
          {
            name: "maxQuoteTokenAmount",
            docs: ["The maximum amount of quote tokens to deposit"],
            type: "u64",
          },
          {
            name: "maxBaseTokenAmount",
            docs: ["The maximum amount of base tokens to deposit"],
            type: "u64",
          },
        ],
      },
    },
    {
      name: "ErrorCode",
      type: {
        kind: "enum",
        variants: [
          {
            name: "NoLpTokensInPool",
          },
          {
            name: "NotEnoughLpTokens",
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: "PoolInUse",
      msg: "Pool is currently being used by an active proposal",
    },
  ],
};
