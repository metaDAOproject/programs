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
          name: "token0Mint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "token1Mint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "spotPoolState";
          isMut: false;
          isSigner: false;
        },
        {
          name: "lpTokenVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "token0Vault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "token1Vault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "lpMint";
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
          name: "lpTokenVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userLpTokenAccount";
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
          name: "token0Vault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "token1Vault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "token0Mint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "token1Mint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "raydium";
          accounts: [
            {
              name: "spotPoolState";
              isMut: true;
              isSigner: false;
            },
            {
              name: "token0Vault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "token1Vault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "lpMint";
              isMut: true;
              isSigner: false;
            },
            {
              name: "poolLpTokenAccount";
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
          name: "conditionalVault";
          accounts: [
            {
              name: "question";
              isMut: true;
              isSigner: false;
            },
            {
              name: "vault0";
              isMut: true;
              isSigner: false;
            },
            {
              name: "vault1";
              isMut: true;
              isSigner: false;
            },
            {
              name: "vault0UnderlyingTokenAccount";
              isMut: true;
              isSigner: false;
            },
            {
              name: "vault1UnderlyingTokenAccount";
              isMut: true;
              isSigner: false;
            },
            {
              name: "poolToken0Account";
              isMut: true;
              isSigner: false;
            },
            {
              name: "poolToken1Account";
              isMut: true;
              isSigner: false;
            },
            {
              name: "conditionalVaultProgram";
              isMut: false;
              isSigner: false;
            },
            {
              name: "token0PassMint";
              isMut: true;
              isSigner: false;
            },
            {
              name: "token0FailMint";
              isMut: true;
              isSigner: false;
            },
            {
              name: "token1PassMint";
              isMut: true;
              isSigner: false;
            },
            {
              name: "token1FailMint";
              isMut: true;
              isSigner: false;
            },
            {
              name: "token0PassVault";
              isMut: true;
              isSigner: true;
            },
            {
              name: "token0FailVault";
              isMut: true;
              isSigner: true;
            },
            {
              name: "token1PassVault";
              isMut: true;
              isSigner: true;
            },
            {
              name: "token1FailVault";
              isMut: true;
              isSigner: true;
            },
            {
              name: "vaultEventAuthority";
              isMut: false;
              isSigner: false;
            },
            {
              name: "payer";
              isMut: true;
              isSigner: true;
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
        },
        {
          name: "amm";
          accounts: [
            {
              name: "passAmm";
              isMut: true;
              isSigner: false;
            },
            {
              name: "failAmm";
              isMut: true;
              isSigner: false;
            },
            {
              name: "passLpMint";
              isMut: true;
              isSigner: false;
            },
            {
              name: "failLpMint";
              isMut: true;
              isSigner: false;
            },
            {
              name: "poolPassLpAccount";
              isMut: true;
              isSigner: false;
            },
            {
              name: "poolFailLpAccount";
              isMut: true;
              isSigner: false;
            },
            {
              name: "passAmmVaultAtaBase";
              isMut: true;
              isSigner: false;
            },
            {
              name: "passAmmVaultAtaQuote";
              isMut: true;
              isSigner: false;
            },
            {
              name: "failAmmVaultAtaBase";
              isMut: true;
              isSigner: false;
            },
            {
              name: "failAmmVaultAtaQuote";
              isMut: true;
              isSigner: false;
            },
            {
              name: "ammProgram";
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
          },
          {
            name: "lpTokenVault";
            docs: ["Holds the Raydium LP tokens for this pool."];
            type: "publicKey";
          },
          {
            name: "token0Vault";
            docs: ["Holds the token0s for this pool."];
            type: "publicKey";
          },
          {
            name: "token1Vault";
            docs: ["Holds the token1s for this pool."];
            type: "publicKey";
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
      name: "initializePool",
      accounts: [
        {
          name: "pool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "token0Mint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "token1Mint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "spotPoolState",
          isMut: false,
          isSigner: false,
        },
        {
          name: "lpTokenVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "token0Vault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "token1Vault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "lpMint",
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
          name: "lpTokenVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userLpTokenAccount",
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
          name: "token0Vault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "token1Vault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "token0Mint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "token1Mint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "raydium",
          accounts: [
            {
              name: "spotPoolState",
              isMut: true,
              isSigner: false,
            },
            {
              name: "token0Vault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "token1Vault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "lpMint",
              isMut: true,
              isSigner: false,
            },
            {
              name: "poolLpTokenAccount",
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
          name: "conditionalVault",
          accounts: [
            {
              name: "question",
              isMut: true,
              isSigner: false,
            },
            {
              name: "vault0",
              isMut: true,
              isSigner: false,
            },
            {
              name: "vault1",
              isMut: true,
              isSigner: false,
            },
            {
              name: "vault0UnderlyingTokenAccount",
              isMut: true,
              isSigner: false,
            },
            {
              name: "vault1UnderlyingTokenAccount",
              isMut: true,
              isSigner: false,
            },
            {
              name: "poolToken0Account",
              isMut: true,
              isSigner: false,
            },
            {
              name: "poolToken1Account",
              isMut: true,
              isSigner: false,
            },
            {
              name: "conditionalVaultProgram",
              isMut: false,
              isSigner: false,
            },
            {
              name: "token0PassMint",
              isMut: true,
              isSigner: false,
            },
            {
              name: "token0FailMint",
              isMut: true,
              isSigner: false,
            },
            {
              name: "token1PassMint",
              isMut: true,
              isSigner: false,
            },
            {
              name: "token1FailMint",
              isMut: true,
              isSigner: false,
            },
            {
              name: "token0PassVault",
              isMut: true,
              isSigner: true,
            },
            {
              name: "token0FailVault",
              isMut: true,
              isSigner: true,
            },
            {
              name: "token1PassVault",
              isMut: true,
              isSigner: true,
            },
            {
              name: "token1FailVault",
              isMut: true,
              isSigner: true,
            },
            {
              name: "vaultEventAuthority",
              isMut: false,
              isSigner: false,
            },
            {
              name: "payer",
              isMut: true,
              isSigner: true,
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
        },
        {
          name: "amm",
          accounts: [
            {
              name: "passAmm",
              isMut: true,
              isSigner: false,
            },
            {
              name: "failAmm",
              isMut: true,
              isSigner: false,
            },
            {
              name: "passLpMint",
              isMut: true,
              isSigner: false,
            },
            {
              name: "failLpMint",
              isMut: true,
              isSigner: false,
            },
            {
              name: "poolPassLpAccount",
              isMut: true,
              isSigner: false,
            },
            {
              name: "poolFailLpAccount",
              isMut: true,
              isSigner: false,
            },
            {
              name: "passAmmVaultAtaBase",
              isMut: true,
              isSigner: false,
            },
            {
              name: "passAmmVaultAtaQuote",
              isMut: true,
              isSigner: false,
            },
            {
              name: "failAmmVaultAtaBase",
              isMut: true,
              isSigner: false,
            },
            {
              name: "failAmmVaultAtaQuote",
              isMut: true,
              isSigner: false,
            },
            {
              name: "ammProgram",
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
          {
            name: "lpTokenVault",
            docs: ["Holds the Raydium LP tokens for this pool."],
            type: "publicKey",
          },
          {
            name: "token0Vault",
            docs: ["Holds the token0s for this pool."],
            type: "publicKey",
          },
          {
            name: "token1Vault",
            docs: ["Holds the token1s for this pool."],
            type: "publicKey",
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
