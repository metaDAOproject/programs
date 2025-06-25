export type SharedLiquidityManager = {
  version: "0.1.0";
  name: "shared_liquidity_manager";
  docs: ["TODO:", "- add unstake", "- add unit tests"];
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
          name: "creatorSlPoolPosition";
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
          name: "raydiumInitPoolStatic";
          accounts: [
            {
              name: "raydiumAuthority";
              isMut: false;
              isSigner: false;
            },
            {
              name: "createPoolFee";
              isMut: true;
              isSigner: false;
            },
            {
              name: "ammConfig";
              isMut: true;
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
              name: "associatedTokenProgram";
              isMut: false;
              isSigner: false;
            },
            {
              name: "tokenProgram";
              isMut: false;
              isSigner: false;
            }
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
      name: "initializeDraftProposal";
      accounts: [
        {
          name: "draftProposal";
          isMut: true;
          isSigner: false;
        },
        {
          name: "sharedLiquidityPool";
          isMut: false;
          isSigner: false;
        },
        {
          name: "baseMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "stakedTokenVault";
          isMut: true;
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
          name: "associatedTokenProgram";
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
          name: "params";
          type: {
            defined: "InitializeDraftProposalParams";
          };
        }
      ];
    },
    {
      name: "stakeToDraftProposal";
      accounts: [
        {
          name: "draftProposal";
          isMut: true;
          isSigner: false;
        },
        {
          name: "staker";
          isMut: false;
          isSigner: true;
        },
        {
          name: "stakerTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "stakedTokenVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "stakeRecord";
          isMut: true;
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
      args: [
        {
          name: "params";
          type: {
            defined: "StakeToDraftProposalParams";
          };
        }
      ];
    },
    {
      name: "unstakeFromDraftProposal";
      accounts: [
        {
          name: "draftProposal";
          isMut: true;
          isSigner: false;
        },
        {
          name: "staker";
          isMut: false;
          isSigner: true;
        },
        {
          name: "stakerTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "stakedTokenVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "stakeRecord";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
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
            defined: "UnstakeFromDraftProposalParams";
          };
        }
      ];
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
          name: "activeSpotPool";
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
          isMut: false;
          isSigner: true;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "raydiumAuthority";
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
          name: "params";
          type: {
            defined: "DepositSharedLiquidityParams";
          };
        }
      ];
    },
    {
      name: "withdrawSharedLiquidity";
      accounts: [
        {
          name: "slPool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "slPoolSigner";
          isMut: false;
          isSigner: false;
        },
        {
          name: "activeSpotPool";
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
          name: "feeReceiver";
          isMut: false;
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
            defined: "WithdrawSharedLiquidityParams";
          };
        }
      ];
    },
    {
      name: "initializeProposalWithLiquidity";
      accounts: [
        {
          name: "sharedLiquidityPool";
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
          name: "draftProposal";
          isMut: true;
          isSigner: false;
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
          name: "raydiumInitPoolStatic";
          accounts: [
            {
              name: "raydiumAuthority";
              isMut: false;
              isSigner: false;
            },
            {
              name: "createPoolFee";
              isMut: true;
              isSigner: false;
            },
            {
              name: "ammConfig";
              isMut: true;
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
              name: "associatedTokenProgram";
              isMut: false;
              isSigner: false;
            },
            {
              name: "tokenProgram";
              isMut: false;
              isSigner: false;
            }
          ];
        },
        {
          name: "raydium";
          accounts: [
            {
              name: "activeSpotPool";
              isMut: true;
              isSigner: false;
            },
            {
              name: "activeSpotPoolLpMint";
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
              name: "nextSpotPoolObservationState";
              isMut: true;
              isSigner: false;
            },
            {
              name: "slPoolNextSpotLpVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "slPool";
              isMut: false;
              isSigner: false;
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
          name: "ammm";
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
              name: "slPoolSigner";
              isMut: false;
              isSigner: false;
            }
          ];
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
          name: "payer";
          isMut: true;
          isSigner: true;
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
      name: "draftProposal";
      type: {
        kind: "struct";
        fields: [
          {
            name: "sharedLiquidityPool";
            type: "publicKey";
          },
          {
            name: "baseMint";
            type: "publicKey";
          },
          {
            name: "instruction";
            type: {
              defined: "ProposalInstruction";
            };
          },
          {
            name: "status";
            type: {
              defined: "DraftProposalStatus";
            };
          },
          {
            name: "stakedTokenAmount";
            docs: [
              "The amount of tokens that have been staked on this draft proposal"
            ];
            type: "u64";
          },
          {
            name: "stakedTokenVault";
            docs: ["The vault that holds the staked tokens"];
            type: "publicKey";
          },
          {
            name: "nonce";
            docs: ["The nonce used to create this draft proposal PDA"];
            type: "u64";
          },
          {
            name: "pdaBump";
            type: "u8";
          }
        ];
      };
    },
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
            name: "proposalStakeRateThresholdBps";
            docs: [
              "The percentage of a token's supply, in basis points, that needs to be",
              "staked to a draft proposal before it can be initialized."
            ];
            type: "u16";
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
    },
    {
      name: "stakeRecord";
      type: {
        kind: "struct";
        fields: [
          {
            name: "staker";
            type: "publicKey";
          },
          {
            name: "amount";
            type: "u64";
          }
        ];
      };
    }
  ];
  types: [
    {
      name: "DepositSharedLiquidityParams";
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
      name: "InitializeDraftProposalParams";
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
            name: "draftProposalNonce";
            docs: [
              "The nonce for the draft proposal, not used for anything aside from the PDA"
            ];
            type: "u64";
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
          },
          {
            name: "proposalStakeRateThresholdBps";
            type: "u16";
          }
        ];
      };
    },
    {
      name: "StakeToDraftProposalParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amount";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "UnstakeFromDraftProposalParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amount";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "WithdrawSharedLiquidityParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "lpTokenAmount";
            docs: ["The amount of LP tokens to withdraw"];
            type: "u64";
          },
          {
            name: "minimumToken0Amount";
            docs: ["The minimum amount of token0 to receive"];
            type: "u64";
          },
          {
            name: "minimumToken1Amount";
            docs: ["The minimum amount of token1 to receive"];
            type: "u64";
          }
        ];
      };
    },
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
      name: "DraftProposalStatus";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Draft";
          },
          {
            name: "Initialized";
          }
        ];
      };
    }
  ];
  errors: [
    {
      code: 6000;
      name: "InsufficientStake";
      msg: "Insufficient stake amount";
    },
    {
      code: 6001;
      name: "ProposalNotFinalized";
      msg: "Proposal is not finalized";
    },
    {
      code: 6002;
      name: "NoLpTokensToRemove";
      msg: "No LP tokens to remove from AMM";
    },
    {
      code: 6003;
      name: "NoTokensFromAmm";
      msg: "No tokens received from AMM removal";
    },
    {
      code: 6004;
      name: "InsufficientReservesReturned";
      msg: "Insufficient reserves returned to spot AMM (less than 99.5%)";
    },
    {
      code: 6005;
      name: "PoolInUse";
      msg: "Pool is currently being used by an active proposal";
    },
    {
      code: 6006;
      name: "InsufficientLpShares";
      msg: "User does not have enough LP shares to withdraw";
    },
    {
      code: 6007;
      name: "SlippageExceeded";
      msg: "Slippage exceeded minimum token amounts";
    },
    {
      code: 6008;
      name: "NoLpTokensInPool";
      msg: "No LP tokens in pool's LP token account";
    },
    {
      code: 6009;
      name: "NotEnoughLpTokens";
      msg: "Not enough LP tokens to provide liquidity to proposal";
    },
    {
      code: 6010;
      name: "InsufficientFunds";
      msg: "Insufficient funds";
    },
    {
      code: 6011;
      name: "NoActiveProposal";
      msg: "No active proposal";
    },
    {
      code: 6012;
      name: "ProposalNotInDraftStatus";
      msg: "Proposal is not in draft status";
    }
  ];
};

export const IDL: SharedLiquidityManager = {
  version: "0.1.0",
  name: "shared_liquidity_manager",
  docs: ["TODO:", "- add unstake", "- add unit tests"],
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
          name: "creatorSlPoolPosition",
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
          name: "raydiumInitPoolStatic",
          accounts: [
            {
              name: "raydiumAuthority",
              isMut: false,
              isSigner: false,
            },
            {
              name: "createPoolFee",
              isMut: true,
              isSigner: false,
            },
            {
              name: "ammConfig",
              isMut: true,
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
              name: "associatedTokenProgram",
              isMut: false,
              isSigner: false,
            },
            {
              name: "tokenProgram",
              isMut: false,
              isSigner: false,
            },
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
      name: "initializeDraftProposal",
      accounts: [
        {
          name: "draftProposal",
          isMut: true,
          isSigner: false,
        },
        {
          name: "sharedLiquidityPool",
          isMut: false,
          isSigner: false,
        },
        {
          name: "baseMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "stakedTokenVault",
          isMut: true,
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
          name: "associatedTokenProgram",
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
          name: "params",
          type: {
            defined: "InitializeDraftProposalParams",
          },
        },
      ],
    },
    {
      name: "stakeToDraftProposal",
      accounts: [
        {
          name: "draftProposal",
          isMut: true,
          isSigner: false,
        },
        {
          name: "staker",
          isMut: false,
          isSigner: true,
        },
        {
          name: "stakerTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "stakedTokenVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "stakeRecord",
          isMut: true,
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
      args: [
        {
          name: "params",
          type: {
            defined: "StakeToDraftProposalParams",
          },
        },
      ],
    },
    {
      name: "unstakeFromDraftProposal",
      accounts: [
        {
          name: "draftProposal",
          isMut: true,
          isSigner: false,
        },
        {
          name: "staker",
          isMut: false,
          isSigner: true,
        },
        {
          name: "stakerTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "stakedTokenVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "stakeRecord",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
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
            defined: "UnstakeFromDraftProposalParams",
          },
        },
      ],
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
          name: "activeSpotPool",
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
          isMut: false,
          isSigner: true,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "raydiumAuthority",
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
          name: "params",
          type: {
            defined: "DepositSharedLiquidityParams",
          },
        },
      ],
    },
    {
      name: "withdrawSharedLiquidity",
      accounts: [
        {
          name: "slPool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "slPoolSigner",
          isMut: false,
          isSigner: false,
        },
        {
          name: "activeSpotPool",
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
          name: "feeReceiver",
          isMut: false,
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
            defined: "WithdrawSharedLiquidityParams",
          },
        },
      ],
    },
    {
      name: "initializeProposalWithLiquidity",
      accounts: [
        {
          name: "sharedLiquidityPool",
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
          name: "draftProposal",
          isMut: true,
          isSigner: false,
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
          name: "raydiumInitPoolStatic",
          accounts: [
            {
              name: "raydiumAuthority",
              isMut: false,
              isSigner: false,
            },
            {
              name: "createPoolFee",
              isMut: true,
              isSigner: false,
            },
            {
              name: "ammConfig",
              isMut: true,
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
              name: "associatedTokenProgram",
              isMut: false,
              isSigner: false,
            },
            {
              name: "tokenProgram",
              isMut: false,
              isSigner: false,
            },
          ],
        },
        {
          name: "raydium",
          accounts: [
            {
              name: "activeSpotPool",
              isMut: true,
              isSigner: false,
            },
            {
              name: "activeSpotPoolLpMint",
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
              name: "nextSpotPoolObservationState",
              isMut: true,
              isSigner: false,
            },
            {
              name: "slPoolNextSpotLpVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "slPool",
              isMut: false,
              isSigner: false,
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
          name: "ammm",
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
              name: "slPoolSigner",
              isMut: false,
              isSigner: false,
            },
          ],
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
          name: "payer",
          isMut: true,
          isSigner: true,
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
      name: "draftProposal",
      type: {
        kind: "struct",
        fields: [
          {
            name: "sharedLiquidityPool",
            type: "publicKey",
          },
          {
            name: "baseMint",
            type: "publicKey",
          },
          {
            name: "instruction",
            type: {
              defined: "ProposalInstruction",
            },
          },
          {
            name: "status",
            type: {
              defined: "DraftProposalStatus",
            },
          },
          {
            name: "stakedTokenAmount",
            docs: [
              "The amount of tokens that have been staked on this draft proposal",
            ],
            type: "u64",
          },
          {
            name: "stakedTokenVault",
            docs: ["The vault that holds the staked tokens"],
            type: "publicKey",
          },
          {
            name: "nonce",
            docs: ["The nonce used to create this draft proposal PDA"],
            type: "u64",
          },
          {
            name: "pdaBump",
            type: "u8",
          },
        ],
      },
    },
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
            name: "proposalStakeRateThresholdBps",
            docs: [
              "The percentage of a token's supply, in basis points, that needs to be",
              "staked to a draft proposal before it can be initialized.",
            ],
            type: "u16",
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
    {
      name: "stakeRecord",
      type: {
        kind: "struct",
        fields: [
          {
            name: "staker",
            type: "publicKey",
          },
          {
            name: "amount",
            type: "u64",
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "DepositSharedLiquidityParams",
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
      name: "InitializeDraftProposalParams",
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
            name: "draftProposalNonce",
            docs: [
              "The nonce for the draft proposal, not used for anything aside from the PDA",
            ],
            type: "u64",
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
          {
            name: "proposalStakeRateThresholdBps",
            type: "u16",
          },
        ],
      },
    },
    {
      name: "StakeToDraftProposalParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "amount",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "UnstakeFromDraftProposalParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "amount",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "WithdrawSharedLiquidityParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "lpTokenAmount",
            docs: ["The amount of LP tokens to withdraw"],
            type: "u64",
          },
          {
            name: "minimumToken0Amount",
            docs: ["The minimum amount of token0 to receive"],
            type: "u64",
          },
          {
            name: "minimumToken1Amount",
            docs: ["The minimum amount of token1 to receive"],
            type: "u64",
          },
        ],
      },
    },
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
      name: "DraftProposalStatus",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Draft",
          },
          {
            name: "Initialized",
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: "InsufficientStake",
      msg: "Insufficient stake amount",
    },
    {
      code: 6001,
      name: "ProposalNotFinalized",
      msg: "Proposal is not finalized",
    },
    {
      code: 6002,
      name: "NoLpTokensToRemove",
      msg: "No LP tokens to remove from AMM",
    },
    {
      code: 6003,
      name: "NoTokensFromAmm",
      msg: "No tokens received from AMM removal",
    },
    {
      code: 6004,
      name: "InsufficientReservesReturned",
      msg: "Insufficient reserves returned to spot AMM (less than 99.5%)",
    },
    {
      code: 6005,
      name: "PoolInUse",
      msg: "Pool is currently being used by an active proposal",
    },
    {
      code: 6006,
      name: "InsufficientLpShares",
      msg: "User does not have enough LP shares to withdraw",
    },
    {
      code: 6007,
      name: "SlippageExceeded",
      msg: "Slippage exceeded minimum token amounts",
    },
    {
      code: 6008,
      name: "NoLpTokensInPool",
      msg: "No LP tokens in pool's LP token account",
    },
    {
      code: 6009,
      name: "NotEnoughLpTokens",
      msg: "Not enough LP tokens to provide liquidity to proposal",
    },
    {
      code: 6010,
      name: "InsufficientFunds",
      msg: "Insufficient funds",
    },
    {
      code: 6011,
      name: "NoActiveProposal",
      msg: "No active proposal",
    },
    {
      code: 6012,
      name: "ProposalNotInDraftStatus",
      msg: "Proposal is not in draft status",
    },
  ],
};
