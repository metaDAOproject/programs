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
          name: "conditionalVault";
          accounts: [
            {
              name: "question";
              isMut: true;
              isSigner: false;
            },
            {
              name: "baseVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "quoteVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "baseVaultUnderlyingTokenAccount";
              isMut: true;
              isSigner: false;
            },
            {
              name: "quoteVaultUnderlyingTokenAccount";
              isMut: true;
              isSigner: false;
            },
            {
              name: "conditionalVaultProgram";
              isMut: false;
              isSigner: false;
            },
            {
              name: "passBaseMint";
              isMut: true;
              isSigner: false;
            },
            {
              name: "failBaseMint";
              isMut: true;
              isSigner: false;
            },
            {
              name: "passQuoteMint";
              isMut: true;
              isSigner: false;
            },
            {
              name: "failQuoteMint";
              isMut: true;
              isSigner: false;
            },
            {
              name: "slPoolPassBaseVault";
              isMut: true;
              isSigner: true;
            },
            {
              name: "slPoolFailBaseVault";
              isMut: true;
              isSigner: true;
            },
            {
              name: "slPoolPassQuoteVault";
              isMut: true;
              isSigner: true;
            },
            {
              name: "slPoolFailQuoteVault";
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
            },
            {
              name: "slPoolSigner";
              isMut: true;
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
              name: "slPoolPassLpAccount";
              isMut: true;
              isSigner: false;
            },
            {
              name: "slPoolFailLpAccount";
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
              name: "proposalPassLpVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "proposalFailLpVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "ammProgram";
              isMut: false;
              isSigner: false;
            },
            {
              name: "eventAuthority";
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
              name: "tokenProgram";
              isMut: false;
              isSigner: false;
            },
            {
              name: "associatedTokenProgram";
              isMut: false;
              isSigner: false;
            },
            {
              name: "slPoolSigner";
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
          name: "autocratEventAuthority";
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
            defined: "InitializeProposalWithLiquidityParams";
          };
        }
      ];
    },
    {
      name: "removeProposalLiquidity";
      accounts: [
        {
          name: "slPool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "proposal";
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
          name: "ray";
          accounts: [
            {
              name: "activeSpotPool";
              isMut: true;
              isSigner: false;
            },
            {
              name: "activeSpotPoolBaseVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "activeSpotPoolQuoteVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "activeSpotPoolLpMint";
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
            },
            {
              name: "nextSpotPool";
              isMut: true;
              isSigner: false;
            },
            {
              name: "nextSpotPoolLpMint";
              isMut: true;
              isSigner: false;
            },
            {
              name: "nextSpotPoolObservationState";
              isMut: true;
              isSigner: false;
            },
            {
              name: "nextSpotPoolBaseVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "nextSpotPoolQuoteVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "slPoolNextSpotLpVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "createPoolFeeReceiver";
              isMut: true;
              isSigner: false;
            },
            {
              name: "observationState";
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
              name: "slPoolSigner";
              isMut: false;
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
            }
          ];
        },
        {
          name: "cond";
          accounts: [
            {
              name: "question";
              isMut: true;
              isSigner: false;
            },
            {
              name: "baseVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "quoteVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "baseVaultUnderlyingTokenAccount";
              isMut: true;
              isSigner: false;
            },
            {
              name: "quoteVaultUnderlyingTokenAccount";
              isMut: true;
              isSigner: false;
            },
            {
              name: "conditionalVaultProgram";
              isMut: false;
              isSigner: false;
            },
            {
              name: "passBaseMint";
              isMut: true;
              isSigner: false;
            },
            {
              name: "failBaseMint";
              isMut: true;
              isSigner: false;
            },
            {
              name: "passQuoteMint";
              isMut: true;
              isSigner: false;
            },
            {
              name: "failQuoteMint";
              isMut: true;
              isSigner: false;
            },
            {
              name: "slPoolPassBaseVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "slPoolFailBaseVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "slPoolPassQuoteVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "slPoolFailQuoteVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "vaultEventAuthority";
              isMut: false;
              isSigner: false;
            },
            {
              name: "tokenProgram";
              isMut: false;
              isSigner: false;
            },
            {
              name: "slPoolSigner";
              isMut: true;
              isSigner: false;
            }
          ];
        },
        {
          name: "ammm2";
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
              name: "slPoolPassLpAccount";
              isMut: true;
              isSigner: false;
            },
            {
              name: "slPoolFailLpAccount";
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
              name: "proposalPassLpVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "proposalFailLpVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "ammProgram";
              isMut: false;
              isSigner: false;
            },
            {
              name: "eventAuthority";
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
          name: "autocratEventAuthority";
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
            name: "slPoolSignerBump";
            docs: ["The pda bump of the signer."];
            type: "u8";
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
      name: "ProposalAccount";
      type: {
        kind: "struct";
        fields: [
          {
            name: "pubkey";
            type: "publicKey";
          },
          {
            name: "isSigner";
            type: "bool";
          },
          {
            name: "isWritable";
            type: "bool";
          }
        ];
      };
    },
    {
      name: "ProposalInstruction";
      type: {
        kind: "struct";
        fields: [
          {
            name: "programId";
            type: "publicKey";
          },
          {
            name: "accounts";
            type: {
              vec: {
                defined: "ProposalAccount";
              };
            };
          },
          {
            name: "data";
            type: "bytes";
          }
        ];
      };
    },
    {
      name: "InitializeProposalWithLiquidityParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "instruction";
            type: {
              defined: "ProposalInstruction";
            };
          },
          {
            name: "nonce";
            type: "u64";
          }
        ];
      };
    },
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
      name: "NoLpTokensInPool";
      msg: "No LP tokens in pool's LP token account";
    },
    {
      code: 6001;
      name: "NotEnoughLpTokens";
      msg: "Not enough LP tokens to withdraw half";
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
          name: "conditionalVault",
          accounts: [
            {
              name: "question",
              isMut: true,
              isSigner: false,
            },
            {
              name: "baseVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "quoteVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "baseVaultUnderlyingTokenAccount",
              isMut: true,
              isSigner: false,
            },
            {
              name: "quoteVaultUnderlyingTokenAccount",
              isMut: true,
              isSigner: false,
            },
            {
              name: "conditionalVaultProgram",
              isMut: false,
              isSigner: false,
            },
            {
              name: "passBaseMint",
              isMut: true,
              isSigner: false,
            },
            {
              name: "failBaseMint",
              isMut: true,
              isSigner: false,
            },
            {
              name: "passQuoteMint",
              isMut: true,
              isSigner: false,
            },
            {
              name: "failQuoteMint",
              isMut: true,
              isSigner: false,
            },
            {
              name: "slPoolPassBaseVault",
              isMut: true,
              isSigner: true,
            },
            {
              name: "slPoolFailBaseVault",
              isMut: true,
              isSigner: true,
            },
            {
              name: "slPoolPassQuoteVault",
              isMut: true,
              isSigner: true,
            },
            {
              name: "slPoolFailQuoteVault",
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
            {
              name: "slPoolSigner",
              isMut: true,
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
              name: "slPoolPassLpAccount",
              isMut: true,
              isSigner: false,
            },
            {
              name: "slPoolFailLpAccount",
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
              name: "proposalPassLpVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "proposalFailLpVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "ammProgram",
              isMut: false,
              isSigner: false,
            },
            {
              name: "eventAuthority",
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
              name: "tokenProgram",
              isMut: false,
              isSigner: false,
            },
            {
              name: "associatedTokenProgram",
              isMut: false,
              isSigner: false,
            },
            {
              name: "slPoolSigner",
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
          name: "autocratEventAuthority",
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
            defined: "InitializeProposalWithLiquidityParams",
          },
        },
      ],
    },
    {
      name: "removeProposalLiquidity",
      accounts: [
        {
          name: "slPool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "proposal",
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
          name: "ray",
          accounts: [
            {
              name: "activeSpotPool",
              isMut: true,
              isSigner: false,
            },
            {
              name: "activeSpotPoolBaseVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "activeSpotPoolQuoteVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "activeSpotPoolLpMint",
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
            {
              name: "nextSpotPool",
              isMut: true,
              isSigner: false,
            },
            {
              name: "nextSpotPoolLpMint",
              isMut: true,
              isSigner: false,
            },
            {
              name: "nextSpotPoolObservationState",
              isMut: true,
              isSigner: false,
            },
            {
              name: "nextSpotPoolBaseVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "nextSpotPoolQuoteVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "slPoolNextSpotLpVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "createPoolFeeReceiver",
              isMut: true,
              isSigner: false,
            },
            {
              name: "observationState",
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
              name: "slPoolSigner",
              isMut: false,
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
          ],
        },
        {
          name: "cond",
          accounts: [
            {
              name: "question",
              isMut: true,
              isSigner: false,
            },
            {
              name: "baseVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "quoteVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "baseVaultUnderlyingTokenAccount",
              isMut: true,
              isSigner: false,
            },
            {
              name: "quoteVaultUnderlyingTokenAccount",
              isMut: true,
              isSigner: false,
            },
            {
              name: "conditionalVaultProgram",
              isMut: false,
              isSigner: false,
            },
            {
              name: "passBaseMint",
              isMut: true,
              isSigner: false,
            },
            {
              name: "failBaseMint",
              isMut: true,
              isSigner: false,
            },
            {
              name: "passQuoteMint",
              isMut: true,
              isSigner: false,
            },
            {
              name: "failQuoteMint",
              isMut: true,
              isSigner: false,
            },
            {
              name: "slPoolPassBaseVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "slPoolFailBaseVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "slPoolPassQuoteVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "slPoolFailQuoteVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "vaultEventAuthority",
              isMut: false,
              isSigner: false,
            },
            {
              name: "tokenProgram",
              isMut: false,
              isSigner: false,
            },
            {
              name: "slPoolSigner",
              isMut: true,
              isSigner: false,
            },
          ],
        },
        {
          name: "ammm2",
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
              name: "slPoolPassLpAccount",
              isMut: true,
              isSigner: false,
            },
            {
              name: "slPoolFailLpAccount",
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
              name: "proposalPassLpVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "proposalFailLpVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "ammProgram",
              isMut: false,
              isSigner: false,
            },
            {
              name: "eventAuthority",
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
          name: "autocratEventAuthority",
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
            name: "slPoolSignerBump",
            docs: ["The pda bump of the signer."],
            type: "u8",
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
      name: "ProposalAccount",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pubkey",
            type: "publicKey",
          },
          {
            name: "isSigner",
            type: "bool",
          },
          {
            name: "isWritable",
            type: "bool",
          },
        ],
      },
    },
    {
      name: "ProposalInstruction",
      type: {
        kind: "struct",
        fields: [
          {
            name: "programId",
            type: "publicKey",
          },
          {
            name: "accounts",
            type: {
              vec: {
                defined: "ProposalAccount",
              },
            },
          },
          {
            name: "data",
            type: "bytes",
          },
        ],
      },
    },
    {
      name: "InitializeProposalWithLiquidityParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "instruction",
            type: {
              defined: "ProposalInstruction",
            },
          },
          {
            name: "nonce",
            type: "u64",
          },
        ],
      },
    },
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
      name: "NoLpTokensInPool",
      msg: "No LP tokens in pool's LP token account",
    },
    {
      code: 6001,
      name: "NotEnoughLpTokens",
      msg: "Not enough LP tokens to withdraw half",
    },
  ],
};
