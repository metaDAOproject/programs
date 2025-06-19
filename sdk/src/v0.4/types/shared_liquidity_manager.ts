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
          name: "dao";
          isMut: false;
          isSigner: false;
        },
        {
          name: "creator";
          isMut: true;
          isSigner: true;
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
          name: "slPoolSpotLpVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "creatorQuoteTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "creatorBaseTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "creatorLpAccount";
          isMut: true;
          isSigner: false;
          docs: ["so Raydium will create it"];
        },
        {
          name: "raydiumAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "ammConfig";
          isMut: true;
          isSigner: false;
          docs: [
            "Use the lowest fee pool, can see fees at https://api-v3.raydium.io/main/cpmm-config"
          ];
        },
        {
          name: "spotPool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "spotPoolLpMint";
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
          name: "createPoolFee";
          isMut: true;
          isSigner: false;
          docs: ["create pool fee account"];
        },
        {
          name: "spotPoolObservationState";
          isMut: true;
          isSigner: false;
        },
        {
          name: "slPoolSigner";
          isMut: false;
          isSigner: false;
        },
        {
          name: "slPoolBaseVault";
          isMut: false;
          isSigner: false;
        },
        {
          name: "slPoolQuoteVault";
          isMut: false;
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
        },
        {
          name: "cpSwapProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
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
          name: "params";
          type: {
            defined: "InitializeSharedLiquidityPoolParams";
          };
        }
      ];
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
            name: "slPoolSigner";
            docs: [
              "The signer of this pool, used because Raydium pools need a SOL payer and this PDA can't hold SOL."
            ];
            type: "publicKey";
          },
          {
            name: "slPoolBaseVault";
            docs: [
              "Holds the base tokens for the shared liquidity pool when it's moving liquidity around."
            ];
            type: "publicKey";
          },
          {
            name: "slPoolQuoteVault";
            docs: [
              "Holds the quote tokens for the shared liquidity pool when it's moving liquidity around."
            ];
            type: "publicKey";
          },
          {
            name: "slPoolSpotLpVault";
            docs: ["Holds the LP tokens for the shared liquidity pool."];
            type: "publicKey";
          },
          {
            name: "activeProposal";
            docs: ["The proposal that's using liquidity from this pool."];
            type: {
              option: "publicKey";
            };
          },
          {
            name: "seqNum";
            docs: [
              "The sequence number of this shared liquidity pool. Useful for sorting events."
            ];
            type: "u64";
          },
          {
            name: "activeSpotPool";
            docs: [
              "The current Raydium spot pool. Changes when a proposal is removed."
            ];
            type: "publicKey";
          },
          {
            name: "activeSpotPoolIndex";
            docs: [
              "The index of the current Raydium spot pool. Starts at 0 and increments by 1 for each new spot pool."
            ];
            type: "u32";
          },
          {
            name: "isBaseToken0";
            docs: [
              "Whether the base token is token0 in the current Raydium spot pool (otherwise it's token1)."
            ];
            type: "bool";
          }
        ];
      };
    }
  ];
  types: [
    {
      name: "InitializeSharedLiquidityPoolParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "baseAmount";
            type: "u64";
          },
          {
            name: "quoteAmount";
            type: "u64";
          }
        ];
      };
    }
  ];
  errors: [
    {
      code: 6000;
      name: "ProposalNotFinalized";
      msg: "Proposal is not finalized";
    },
    {
      code: 6001;
      name: "NoLpTokensToRemove";
      msg: "No LP tokens to remove from AMM";
    },
    {
      code: 6002;
      name: "NoTokensFromAmm";
      msg: "No tokens received from AMM removal";
    },
    {
      code: 6003;
      name: "InsufficientReservesReturned";
      msg: "Insufficient reserves returned to spot AMM (less than 99.5%)";
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
          name: "dao",
          isMut: false,
          isSigner: false,
        },
        {
          name: "creator",
          isMut: true,
          isSigner: true,
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
          name: "slPoolSpotLpVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "creatorQuoteTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "creatorBaseTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "creatorLpAccount",
          isMut: true,
          isSigner: false,
          docs: ["so Raydium will create it"],
        },
        {
          name: "raydiumAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "ammConfig",
          isMut: true,
          isSigner: false,
          docs: [
            "Use the lowest fee pool, can see fees at https://api-v3.raydium.io/main/cpmm-config",
          ],
        },
        {
          name: "spotPool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "spotPoolLpMint",
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
          name: "createPoolFee",
          isMut: true,
          isSigner: false,
          docs: ["create pool fee account"],
        },
        {
          name: "spotPoolObservationState",
          isMut: true,
          isSigner: false,
        },
        {
          name: "slPoolSigner",
          isMut: false,
          isSigner: false,
        },
        {
          name: "slPoolBaseVault",
          isMut: false,
          isSigner: false,
        },
        {
          name: "slPoolQuoteVault",
          isMut: false,
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
        {
          name: "cpSwapProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
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
          name: "params",
          type: {
            defined: "InitializeSharedLiquidityPoolParams",
          },
        },
      ],
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
            name: "slPoolSigner",
            docs: [
              "The signer of this pool, used because Raydium pools need a SOL payer and this PDA can't hold SOL.",
            ],
            type: "publicKey",
          },
          {
            name: "slPoolBaseVault",
            docs: [
              "Holds the base tokens for the shared liquidity pool when it's moving liquidity around.",
            ],
            type: "publicKey",
          },
          {
            name: "slPoolQuoteVault",
            docs: [
              "Holds the quote tokens for the shared liquidity pool when it's moving liquidity around.",
            ],
            type: "publicKey",
          },
          {
            name: "slPoolSpotLpVault",
            docs: ["Holds the LP tokens for the shared liquidity pool."],
            type: "publicKey",
          },
          {
            name: "activeProposal",
            docs: ["The proposal that's using liquidity from this pool."],
            type: {
              option: "publicKey",
            },
          },
          {
            name: "seqNum",
            docs: [
              "The sequence number of this shared liquidity pool. Useful for sorting events.",
            ],
            type: "u64",
          },
          {
            name: "activeSpotPool",
            docs: [
              "The current Raydium spot pool. Changes when a proposal is removed.",
            ],
            type: "publicKey",
          },
          {
            name: "activeSpotPoolIndex",
            docs: [
              "The index of the current Raydium spot pool. Starts at 0 and increments by 1 for each new spot pool.",
            ],
            type: "u32",
          },
          {
            name: "isBaseToken0",
            docs: [
              "Whether the base token is token0 in the current Raydium spot pool (otherwise it's token1).",
            ],
            type: "bool",
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "InitializeSharedLiquidityPoolParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "baseAmount",
            type: "u64",
          },
          {
            name: "quoteAmount",
            type: "u64",
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: "ProposalNotFinalized",
      msg: "Proposal is not finalized",
    },
    {
      code: 6001,
      name: "NoLpTokensToRemove",
      msg: "No LP tokens to remove from AMM",
    },
    {
      code: 6002,
      name: "NoTokensFromAmm",
      msg: "No tokens received from AMM removal",
    },
    {
      code: 6003,
      name: "InsufficientReservesReturned",
      msg: "Insufficient reserves returned to spot AMM (less than 99.5%)",
    },
  ],
};
