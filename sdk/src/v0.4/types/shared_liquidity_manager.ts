export type SharedLiquidityManager = {
  version: "0.1.0";
  name: "shared_liquidity_manager";
  instructions: [
    {
      name: "initializePool";
      accounts: [
        {
          name: "pool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "spotPoolState";
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
      name: "deposit";
      accounts: [
        {
          name: "pool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "spotPoolState";
          isMut: true;
          isSigner: false;
        },
        {
          name: "dao";
          isMut: false;
          isSigner: false;
        },
        {
          name: "userTokenA";
          isMut: true;
          isSigner: false;
          docs: ["The user's token accounts for the pool tokens"];
        },
        {
          name: "userTokenB";
          isMut: true;
          isSigner: false;
        },
        {
          name: "token0Vault";
          isMut: true;
          isSigner: false;
          docs: ["The pool's token accounts"];
        },
        {
          name: "token1Vault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vault0Mint";
          isMut: false;
          isSigner: false;
          docs: ["The vault mints"];
        },
        {
          name: "vault1Mint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "lpMint";
          isMut: true;
          isSigner: false;
          docs: ["The LP token mint and destination"];
        },
        {
          name: "userLpToken";
          isMut: true;
          isSigner: false;
        },
        {
          name: "position";
          isMut: true;
          isSigner: false;
          docs: ["The user's liquidity position"];
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
            defined: "DepositArgs";
          };
        }
      ];
    },
    {
      name: "withdraw";
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
            name: "pdaBump";
            docs: ["The PDA bump."];
            type: "u8";
          },
          {
            name: "spotPoolState";
            docs: ["The Raydium spot pool state."];
            type: "publicKey";
          },
          {
            name: "dao";
            docs: ["The DAO."];
            type: "publicKey";
          },
          {
            name: "isActiveProposal";
            docs: [
              "Whether there's an active proposal using liquidity from this pool."
            ];
            type: "bool";
          },
          {
            name: "seqNum";
            docs: [
              "The sequence number of this shared liquidity pool. Useful for sorting events."
            ];
            type: "u64";
          }
        ];
      };
    }
  ];
  types: [
    {
      name: "DepositArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "lpTokenAmount";
            docs: ["The amount of LP tokens to mint"];
            type: "u64";
          },
          {
            name: "maximumToken0Amount";
            docs: ["The maximum amount of token 0 to deposit"];
            type: "u64";
          },
          {
            name: "maximumToken1Amount";
            docs: ["The maximum amount of token 1 to deposit"];
            type: "u64";
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
      name: "initializePool",
      accounts: [
        {
          name: "pool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "spotPoolState",
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
      name: "deposit",
      accounts: [
        {
          name: "pool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "spotPoolState",
          isMut: true,
          isSigner: false,
        },
        {
          name: "dao",
          isMut: false,
          isSigner: false,
        },
        {
          name: "userTokenA",
          isMut: true,
          isSigner: false,
          docs: ["The user's token accounts for the pool tokens"],
        },
        {
          name: "userTokenB",
          isMut: true,
          isSigner: false,
        },
        {
          name: "token0Vault",
          isMut: true,
          isSigner: false,
          docs: ["The pool's token accounts"],
        },
        {
          name: "token1Vault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vault0Mint",
          isMut: false,
          isSigner: false,
          docs: ["The vault mints"],
        },
        {
          name: "vault1Mint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "lpMint",
          isMut: true,
          isSigner: false,
          docs: ["The LP token mint and destination"],
        },
        {
          name: "userLpToken",
          isMut: true,
          isSigner: false,
        },
        {
          name: "position",
          isMut: true,
          isSigner: false,
          docs: ["The user's liquidity position"],
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
            defined: "DepositArgs",
          },
        },
      ],
    },
    {
      name: "withdraw",
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
            name: "pdaBump",
            docs: ["The PDA bump."],
            type: "u8",
          },
          {
            name: "spotPoolState",
            docs: ["The Raydium spot pool state."],
            type: "publicKey",
          },
          {
            name: "dao",
            docs: ["The DAO."],
            type: "publicKey",
          },
          {
            name: "isActiveProposal",
            docs: [
              "Whether there's an active proposal using liquidity from this pool.",
            ],
            type: "bool",
          },
          {
            name: "seqNum",
            docs: [
              "The sequence number of this shared liquidity pool. Useful for sorting events.",
            ],
            type: "u64",
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "DepositArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "lpTokenAmount",
            docs: ["The amount of LP tokens to mint"],
            type: "u64",
          },
          {
            name: "maximumToken0Amount",
            docs: ["The maximum amount of token 0 to deposit"],
            type: "u64",
          },
          {
            name: "maximumToken1Amount",
            docs: ["The maximum amount of token 1 to deposit"],
            type: "u64",
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
