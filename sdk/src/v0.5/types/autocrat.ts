export type Autocrat = {
  version: "0.5.0";
  name: "autocrat";
  instructions: [
    {
      name: "initializeDao";
      accounts: [
        {
          name: "dao";
          isMut: true;
          isSigner: false;
        },
        {
          name: "daoCreator";
          isMut: false;
          isSigner: true;
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
          name: "squadsMultisig";
          isMut: true;
          isSigner: false;
        },
        {
          name: "squadsMultisigVault";
          isMut: false;
          isSigner: false;
        },
        {
          name: "squadsProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "squadsProgramConfig";
          isMut: false;
          isSigner: false;
        },
        {
          name: "squadsProgramConfigTreasury";
          isMut: true;
          isSigner: false;
        },
        {
          name: "spendingLimit";
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
      args: [
        {
          name: "params";
          type: {
            defined: "InitializeDaoParams";
          };
        }
      ];
    },
    {
      name: "initializeProposal";
      accounts: [
        {
          name: "proposal";
          isMut: true;
          isSigner: false;
        },
        {
          name: "squadsProposal";
          isMut: false;
          isSigner: false;
        },
        {
          name: "dao";
          isMut: true;
          isSigner: false;
        },
        {
          name: "futarchyAmm";
          isMut: true;
          isSigner: false;
        },
        {
          name: "question";
          isMut: false;
          isSigner: false;
        },
        {
          name: "ammTokenAccounts";
          accounts: [
            {
              name: "baseUnconditional";
              isMut: true;
              isSigner: false;
            },
            {
              name: "quoteUnconditional";
              isMut: true;
              isSigner: false;
            },
            {
              name: "basePass";
              isMut: true;
              isSigner: false;
            },
            {
              name: "quotePass";
              isMut: true;
              isSigner: false;
            },
            {
              name: "baseFail";
              isMut: true;
              isSigner: false;
            },
            {
              name: "quoteFail";
              isMut: true;
              isSigner: false;
            }
          ];
        },
        {
          name: "quoteVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "baseVault";
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
          name: "failBaseMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "failQuoteMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "passBaseMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "passQuoteMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "proposer";
          isMut: false;
          isSigner: true;
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
          name: "conditionalVaultProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vaultEventAuthority";
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
            defined: "InitializeProposalParams";
          };
        }
      ];
    },
    {
      name: "updateDao";
      accounts: [
        {
          name: "dao";
          isMut: true;
          isSigner: false;
        },
        {
          name: "squadsMultisigVault";
          isMut: false;
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
      args: [
        {
          name: "daoParams";
          type: {
            defined: "UpdateDaoParams";
          };
        }
      ];
    },
    {
      name: "initializeFutarchyAmm";
      accounts: [
        {
          name: "futarchyAmm";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "creator";
          isMut: false;
          isSigner: true;
        },
        {
          name: "dao";
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
          name: "creatorBaseAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "creatorQuoteAccount";
          isMut: true;
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
            defined: "InitializeFutarchyAmmParams";
          };
        }
      ];
    },
    {
      name: "arbitrarySwap";
      docs: ["You should NOT be calling into this directly."];
      accounts: [
        {
          name: "futarchyAmm";
          isMut: true;
          isSigner: false;
        },
        {
          name: "trader";
          isMut: false;
          isSigner: true;
        },
        {
          name: "traderInputAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "ammTokenAccounts";
          accounts: [
            {
              name: "baseUnconditional";
              isMut: true;
              isSigner: false;
            },
            {
              name: "quoteUnconditional";
              isMut: true;
              isSigner: false;
            },
            {
              name: "basePass";
              isMut: true;
              isSigner: false;
            },
            {
              name: "quotePass";
              isMut: true;
              isSigner: false;
            },
            {
              name: "baseFail";
              isMut: true;
              isSigner: false;
            },
            {
              name: "quoteFail";
              isMut: true;
              isSigner: false;
            }
          ];
        },
        {
          name: "question";
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
        },
        {
          name: "quoteVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "quoteVaultUnderlyingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "baseVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "baseVaultUnderlyingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "conditionalVaultProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vaultEventAuthority";
          isMut: false;
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
            defined: "ArbitrarySwapParams";
          };
        }
      ];
    },
    {
      name: "spotSwap";
      accounts: [
        {
          name: "arbitrarySwap";
          accounts: [
            {
              name: "futarchyAmm";
              isMut: true;
              isSigner: false;
            },
            {
              name: "trader";
              isMut: false;
              isSigner: true;
            },
            {
              name: "traderInputAccount";
              isMut: true;
              isSigner: false;
            },
            {
              name: "ammTokenAccounts";
              accounts: [
                {
                  name: "baseUnconditional";
                  isMut: true;
                  isSigner: false;
                },
                {
                  name: "quoteUnconditional";
                  isMut: true;
                  isSigner: false;
                },
                {
                  name: "basePass";
                  isMut: true;
                  isSigner: false;
                },
                {
                  name: "quotePass";
                  isMut: true;
                  isSigner: false;
                },
                {
                  name: "baseFail";
                  isMut: true;
                  isSigner: false;
                },
                {
                  name: "quoteFail";
                  isMut: true;
                  isSigner: false;
                }
              ];
            },
            {
              name: "question";
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
            },
            {
              name: "quoteVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "quoteVaultUnderlyingTokenAccount";
              isMut: true;
              isSigner: false;
            },
            {
              name: "baseVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "baseVaultUnderlyingTokenAccount";
              isMut: true;
              isSigner: false;
            },
            {
              name: "tokenProgram";
              isMut: false;
              isSigner: false;
            },
            {
              name: "conditionalVaultProgram";
              isMut: false;
              isSigner: false;
            },
            {
              name: "vaultEventAuthority";
              isMut: false;
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
            defined: "SpotSwapParams";
          };
        }
      ];
    },
    {
      name: "swap";
      accounts: [
        {
          name: "futarchyAmm";
          isMut: true;
          isSigner: false;
        },
        {
          name: "trader";
          isMut: false;
          isSigner: true;
        },
        {
          name: "traderBaseAccount";
          isMut: false;
          isSigner: false;
        },
        {
          name: "traderQuoteAccount";
          isMut: false;
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
            defined: "SwapParams";
          };
        }
      ];
    },
    {
      name: "conditionalSwap";
      accounts: [
        {
          name: "futarchyAmm";
          isMut: true;
          isSigner: false;
        },
        {
          name: "trader";
          isMut: false;
          isSigner: true;
        },
        {
          name: "traderBaseAccount";
          isMut: false;
          isSigner: false;
        },
        {
          name: "traderQuoteAccount";
          isMut: false;
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
            defined: "ConditionalSwapParams";
          };
        }
      ];
    }
  ];
  accounts: [
    {
      name: "dao";
      type: {
        kind: "struct";
        fields: [
          {
            name: "nonce";
            docs: ["`nonce` + `dao_creator` are PDA seeds"];
            type: "u64";
          },
          {
            name: "daoCreator";
            type: "publicKey";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
          {
            name: "squadsMultisig";
            type: "publicKey";
          },
          {
            name: "squadsMultisigVault";
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
            name: "proposalCount";
            type: "u32";
          },
          {
            name: "passThresholdBps";
            type: "u16";
          },
          {
            name: "slotsPerProposal";
            type: "u64";
          },
          {
            name: "twapInitialObservation";
            docs: [
              "For manipulation-resistance the TWAP is a time-weighted average observation,",
              "where observation tries to approximate price but can only move by",
              "`twap_max_observation_change_per_update` per update. Because it can only move",
              "a little bit per update, you need to check that it has a good initial observation.",
              "Otherwise, an attacker could create a very high initial observation in the pass",
              "market and a very low one in the fail market to force the proposal to pass.",
              "",
              "We recommend setting an initial observation around the spot price of the token,",
              "and max observation change per update around 2% the spot price of the token.",
              "For example, if the spot price of META is $400, we'd recommend setting an initial",
              "observation of 400 (converted into the AMM prices) and a max observation change per",
              "update of 8 (also converted into the AMM prices). Observations can be updated once",
              "a minute, so 2% allows the proposal market to reach double the spot price or 0",
              "in 50 minutes."
            ];
            type: "u128";
          },
          {
            name: "twapMaxObservationChangePerUpdate";
            type: "u128";
          },
          {
            name: "twapStartDelaySlots";
            docs: [
              "Forces TWAP calculation to start after amm.created_at_slot + twap_start_delay_slots"
            ];
            type: "u64";
          },
          {
            name: "minQuoteFutarchicLiquidity";
            docs: [
              "As an anti-spam measure and to help liquidity, you need to lock up some liquidity",
              "in both futarchic markets in order to create a proposal.",
              "",
              "For example, for META, we can use a `min_quote_futarchic_liquidity` of",
              "5000 * 1_000_000 (5000 USDC) and a `min_base_futarchic_liquidity` of",
              "10 * 1_000_000_000 (10 META)."
            ];
            type: "u64";
          },
          {
            name: "minBaseFutarchicLiquidity";
            type: "u64";
          },
          {
            name: "seqNum";
            type: "u64";
          },
          {
            name: "initialSpendingLimit";
            type: {
              option: {
                defined: "InitialSpendingLimit";
              };
            };
          }
        ];
      };
    },
    {
      name: "futarchyAmm";
      type: {
        kind: "struct";
        fields: [
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "dao";
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
            name: "spotPool";
            type: {
              defined: "Pool";
            };
          },
          {
            name: "baseVault";
            type: "publicKey";
          },
          {
            name: "quoteVault";
            type: "publicKey";
          },
          {
            name: "liveProposal";
            type: {
              option: {
                defined: "LiveProposalDetails";
              };
            };
          }
        ];
      };
    },
    {
      name: "proposal";
      type: {
        kind: "struct";
        fields: [
          {
            name: "number";
            type: "u32";
          },
          {
            name: "proposer";
            type: "publicKey";
          },
          {
            name: "slotEnqueued";
            type: "u64";
          },
          {
            name: "state";
            type: {
              defined: "ProposalState";
            };
          },
          {
            name: "baseVault";
            type: "publicKey";
          },
          {
            name: "quoteVault";
            type: "publicKey";
          },
          {
            name: "futarchyAmm";
            type: "publicKey";
          },
          {
            name: "dao";
            type: "publicKey";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
          {
            name: "question";
            type: "publicKey";
          },
          {
            name: "durationInSlots";
            type: "u64";
          },
          {
            name: "squadsProposal";
            type: "publicKey";
          }
        ];
      };
    }
  ];
  types: [
    {
      name: "CommonFields";
      type: {
        kind: "struct";
        fields: [
          {
            name: "slot";
            type: "u64";
          },
          {
            name: "unixTimestamp";
            type: "i64";
          }
        ];
      };
    },
    {
      name: "ArbitrarySwapParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "input";
            type: {
              defined: "AssetAndAmount";
            };
          },
          {
            name: "outputs";
            type: {
              vec: {
                defined: "AssetAndAmount";
              };
            };
          },
          {
            name: "quoteSplitOrMerge";
            type: {
              defined: "SplitOrMergeAndAmount";
            };
          },
          {
            name: "baseSplitOrMerge";
            type: {
              defined: "SplitOrMergeAndAmount";
            };
          }
        ];
      };
    },
    {
      name: "SpotSwapParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "side";
            type: {
              defined: "Side";
            };
          },
          {
            name: "amountIn";
            type: "u64";
          },
          {
            name: "minAmountOut";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "SplitOrMergeAndAmount";
      type: {
        kind: "struct";
        fields: [
          {
            name: "splitOrMerge";
            type: {
              defined: "SplitOrMerge";
            };
          },
          {
            name: "amount";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "AssetAndAmount";
      type: {
        kind: "struct";
        fields: [
          {
            name: "asset";
            type: {
              defined: "Asset";
            };
          },
          {
            name: "amount";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "ConditionalSwapParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "side";
            type: {
              defined: "Side";
            };
          },
          {
            name: "condition";
            type: {
              defined: "Condition";
            };
          },
          {
            name: "amountIn";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "InitializeDaoParams";
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
          {
            name: "twapStartDelaySlots";
            type: "u64";
          },
          {
            name: "minQuoteFutarchicLiquidity";
            type: "u64";
          },
          {
            name: "minBaseFutarchicLiquidity";
            type: "u64";
          },
          {
            name: "passThresholdBps";
            type: "u16";
          },
          {
            name: "slotsPerProposal";
            type: "u64";
          },
          {
            name: "nonce";
            type: "u64";
          },
          {
            name: "initialSpendingLimit";
            type: {
              option: {
                defined: "InitialSpendingLimit";
              };
            };
          }
        ];
      };
    },
    {
      name: "InitializeFutarchyAmmParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "quoteAmount";
            type: "u64";
          },
          {
            name: "baseAmount";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "InitializeProposalParams";
      type: {
        kind: "struct";
        fields: [
          {
<<<<<<< HEAD
            name: "descriptionUrl";
            type: "string";
          },
          {
            name: "passLpTokensToLock";
            type: "u64";
          },
          {
            name: "failLpTokensToLock";
=======
            name: "nonce";
>>>>>>> af0016f (Get basic swap + conditional swap accounting working)
            type: "u64";
          }
        ];
      };
    },
    {
      name: "SwapParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "side";
            type: {
              defined: "Side";
            };
          },
          {
            name: "amountIn";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "UpdateDaoParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "passThresholdBps";
            type: {
              option: "u16";
            };
          },
          {
            name: "slotsPerProposal";
            type: {
              option: "u64";
            };
          },
          {
            name: "twapInitialObservation";
            type: {
              option: "u128";
            };
          },
          {
            name: "twapMaxObservationChangePerUpdate";
            type: {
              option: "u128";
            };
          },
          {
            name: "minQuoteFutarchicLiquidity";
            type: {
              option: "u64";
            };
          },
          {
            name: "minBaseFutarchicLiquidity";
            type: {
              option: "u64";
            };
          }
        ];
      };
    },
    {
      name: "InitialSpendingLimit";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amountPerMonth";
            type: "u64";
          },
          {
            name: "members";
            type: {
              vec: "publicKey";
            };
          }
        ];
      };
    },
    {
      name: "LiveProposalDetails";
      type: {
        kind: "struct";
        fields: [
          {
            name: "proposal";
            type: "publicKey";
          },
          {
            name: "question";
            type: "publicKey";
          },
          {
            name: "passPool";
            type: {
              defined: "Pool";
            };
          },
          {
            name: "failPool";
            type: {
              defined: "Pool";
            };
          }
        ];
      };
    },
    {
      name: "Pool";
      type: {
        kind: "struct";
        fields: [
          {
            name: "baseReserves";
            type: "u64";
          },
          {
            name: "quoteReserves";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "SplitOrMerge";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Split";
          },
          {
            name: "Merge";
          }
        ];
      };
    },
    {
      name: "Asset";
      type: {
        kind: "enum";
        variants: [
          {
            name: "SpotQuote";
          },
          {
            name: "SpotBase";
          },
          {
            name: "PassQuote";
          },
          {
            name: "PassBase";
          },
          {
            name: "FailQuote";
          },
          {
            name: "FailBase";
          }
        ];
      };
    },
    {
      name: "AssetType";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Quote";
          },
          {
            name: "Base";
          }
        ];
      };
    },
    {
      name: "Condition";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Unconditional";
          },
          {
            name: "Pass";
          },
          {
            name: "Fail";
          }
        ];
      };
    },
    {
      name: "Side";
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
    },
    {
      name: "ProposalState";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Pending";
          },
          {
            name: "Passed";
          },
          {
            name: "Failed";
          }
        ];
      };
    }
  ];
  events: [
    {
      name: "InitializeDaoEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "dao";
          type: "publicKey";
          index: false;
        },
        {
          name: "baseMint";
          type: "publicKey";
          index: false;
        },
        {
          name: "quoteMint";
          type: "publicKey";
          index: false;
        },
        {
          name: "passThresholdBps";
          type: "u16";
          index: false;
        },
        {
          name: "slotsPerProposal";
          type: "u64";
          index: false;
        },
        {
          name: "twapInitialObservation";
          type: "u128";
          index: false;
        },
        {
          name: "twapMaxObservationChangePerUpdate";
          type: "u128";
          index: false;
        },
        {
          name: "minQuoteFutarchicLiquidity";
          type: "u64";
          index: false;
        },
        {
          name: "minBaseFutarchicLiquidity";
          type: "u64";
          index: false;
        },
        {
          name: "initialSpendingLimit";
          type: {
            option: {
              defined: "InitialSpendingLimit";
            };
          };
          index: false;
        },
        {
          name: "squadsMultisig";
          type: "publicKey";
          index: false;
        },
        {
          name: "squadsMultisigVault";
          type: "publicKey";
          index: false;
        }
      ];
    },
    {
      name: "UpdateDaoEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "dao";
          type: "publicKey";
          index: false;
        },
        {
          name: "passThresholdBps";
          type: "u16";
          index: false;
        },
        {
          name: "slotsPerProposal";
          type: "u64";
          index: false;
        },
        {
          name: "twapInitialObservation";
          type: "u128";
          index: false;
        },
        {
          name: "twapMaxObservationChangePerUpdate";
          type: "u128";
          index: false;
        },
        {
          name: "minQuoteFutarchicLiquidity";
          type: "u64";
          index: false;
        },
        {
          name: "minBaseFutarchicLiquidity";
          type: "u64";
          index: false;
        }
      ];
    },
    {
      name: "InitializeProposalEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "proposal";
          type: "publicKey";
          index: false;
        },
        {
          name: "dao";
          type: "publicKey";
          index: false;
        },
        {
          name: "question";
          type: "publicKey";
          index: false;
        },
        {
          name: "quoteVault";
          type: "publicKey";
          index: false;
        },
        {
          name: "baseVault";
          type: "publicKey";
          index: false;
        },
        {
          name: "passAmm";
          type: "publicKey";
          index: false;
        },
        {
          name: "failAmm";
          type: "publicKey";
          index: false;
        },
        {
          name: "passLpMint";
          type: "publicKey";
          index: false;
        },
        {
          name: "failLpMint";
          type: "publicKey";
          index: false;
        },
        {
          name: "proposer";
          type: "publicKey";
          index: false;
        },
        {
          name: "number";
          type: "u32";
          index: false;
        },
        {
          name: "passLpTokensLocked";
          type: "u64";
          index: false;
        },
        {
          name: "failLpTokensLocked";
          type: "u64";
          index: false;
        },
        {
          name: "pdaBump";
          type: "u8";
          index: false;
        },
        {
          name: "durationInSlots";
          type: "u64";
          index: false;
        },
        {
          name: "squadsProposal";
          type: "publicKey";
          index: false;
        },
        {
          name: "squadsMultisig";
          type: "publicKey";
          index: false;
        },
        {
          name: "squadsMultisigVault";
          type: "publicKey";
          index: false;
        }
      ];
    },
    {
      name: "FinalizeProposalEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "proposal";
          type: "publicKey";
          index: false;
        },
        {
          name: "dao";
          type: "publicKey";
          index: false;
        },
        {
          name: "passMarketTwap";
          type: "u128";
          index: false;
        },
        {
          name: "failMarketTwap";
          type: "u128";
          index: false;
        },
        {
          name: "threshold";
          type: "u128";
          index: false;
        },
        {
          name: "state";
          type: {
            defined: "ProposalState";
          };
          index: false;
        },
        {
          name: "squadsProposal";
          type: "publicKey";
          index: false;
        },
        {
          name: "squadsMultisig";
          type: "publicKey";
          index: false;
        }
      ];
    },
    {
      name: "ExecuteProposalEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "proposal";
          type: "publicKey";
          index: false;
        },
        {
          name: "dao";
          type: "publicKey";
          index: false;
        }
      ];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "AmmTooOld";
      msg: "Amms must have been created within 5 minutes (counted in slots) of proposal initialization";
    },
    {
      code: 6001;
      name: "InvalidInitialObservation";
      msg: "An amm has an `initial_observation` that doesn't match the `dao`'s config";
    },
    {
      code: 6002;
      name: "InvalidMaxObservationChange";
      msg: "An amm has a `max_observation_change_per_update` that doesn't match the `dao`'s config";
    },
    {
      code: 6003;
      name: "InvalidStartDelaySlots";
      msg: "An amm has a `start_delay_slots` that doesn't match the `dao`'s config";
    },
    {
      code: 6004;
      name: "InvalidSettlementAuthority";
      msg: "One of the vaults has an invalid `settlement_authority`";
    },
    {
      code: 6005;
      name: "ProposalTooYoung";
      msg: "Proposal is too young to be executed or rejected";
    },
    {
      code: 6006;
      name: "MarketsTooYoung";
      msg: "Markets too young for proposal to be finalized. TWAP might need to be cranked";
    },
    {
      code: 6007;
      name: "ProposalAlreadyFinalized";
      msg: "This proposal has already been finalized";
    },
    {
      code: 6008;
      name: "InvalidVaultNonce";
      msg: "A conditional vault has an invalid nonce. A nonce should encode the proposal number";
    },
    {
      code: 6009;
      name: "ProposalNotPassed";
      msg: "This proposal can't be executed because it isn't in the passed state";
    },
    {
      code: 6010;
      name: "InsufficientLpTokenBalance";
      msg: "The proposer has fewer pass or fail LP tokens than they requested to lock";
    },
    {
      code: 6011;
      name: "InsufficientLpTokenLock";
      msg: "The LP tokens passed in have less liquidity than the DAO's `min_quote_futarchic_liquidity` or `min_base_futachic_liquidity`";
    },
    {
      code: 6012;
      name: "ProposalDurationTooShort";
      msg: "Proposal duration must be longer than TWAP start delay";
    },
    {
      code: 6013;
      name: "QuestionMustBeBinary";
      msg: "Question must have exactly 2 outcomes for binary futarchy";
    },
    {
      code: 6014;
<<<<<<< HEAD
      name: "InvalidSquadsProposalStatus";
      msg: "Squads proposal must be in Draft status";
=======
      name: "NoReserves";
      msg: "No reserves";
    },
    {
      code: 6015;
      name: "CastingOverflow";
      msg: "Got overflow when casting";
    },
    {
      code: 6016;
      name: "ConstantProductInvariantFailed";
      msg: "Constant product invariant failed";
<<<<<<< HEAD
>>>>>>> c9984c7 (Get basic `swap` working)
=======
    },
    {
      code: 6017;
      name: "ProposalNotLive";
      msg: "Proposal must be live to swap conditional tokens";
<<<<<<< HEAD
>>>>>>> af0016f (Get basic swap + conditional swap accounting working)
=======
    },
    {
      code: 6018;
      name: "InvariantViolation";
      msg: "Invariant violation";
>>>>>>> 0caa311 (Get closed-form swap working)
    }
  ];
};

export const IDL: Autocrat = {
  version: "0.5.0",
  name: "autocrat",
  instructions: [
    {
      name: "initializeDao",
      accounts: [
        {
          name: "dao",
          isMut: true,
          isSigner: false,
        },
        {
          name: "daoCreator",
          isMut: false,
          isSigner: true,
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
          name: "squadsMultisig",
          isMut: true,
          isSigner: false,
        },
        {
          name: "squadsMultisigVault",
          isMut: false,
          isSigner: false,
        },
        {
          name: "squadsProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "squadsProgramConfig",
          isMut: false,
          isSigner: false,
        },
        {
          name: "squadsProgramConfigTreasury",
          isMut: true,
          isSigner: false,
        },
        {
          name: "spendingLimit",
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
      args: [
        {
          name: "params",
          type: {
            defined: "InitializeDaoParams",
          },
        },
      ],
    },
    {
      name: "initializeProposal",
      accounts: [
        {
          name: "proposal",
          isMut: true,
          isSigner: false,
        },
        {
          name: "squadsProposal",
          isMut: false,
          isSigner: false,
        },
        {
          name: "dao",
          isMut: true,
          isSigner: false,
        },
        {
          name: "futarchyAmm",
          isMut: true,
          isSigner: false,
        },
        {
          name: "question",
          isMut: false,
          isSigner: false,
        },
        {
          name: "ammTokenAccounts",
          accounts: [
            {
              name: "baseUnconditional",
              isMut: true,
              isSigner: false,
            },
            {
              name: "quoteUnconditional",
              isMut: true,
              isSigner: false,
            },
            {
              name: "basePass",
              isMut: true,
              isSigner: false,
            },
            {
              name: "quotePass",
              isMut: true,
              isSigner: false,
            },
            {
              name: "baseFail",
              isMut: true,
              isSigner: false,
            },
            {
              name: "quoteFail",
              isMut: true,
              isSigner: false,
            },
          ],
        },
        {
          name: "quoteVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "baseVault",
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
          name: "failBaseMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "failQuoteMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "passBaseMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "passQuoteMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "proposer",
          isMut: false,
          isSigner: true,
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
          name: "conditionalVaultProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vaultEventAuthority",
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
            defined: "InitializeProposalParams",
          },
        },
      ],
    },
    {
      name: "updateDao",
      accounts: [
        {
          name: "dao",
          isMut: true,
          isSigner: false,
        },
        {
          name: "squadsMultisigVault",
          isMut: false,
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
      args: [
        {
          name: "daoParams",
          type: {
            defined: "UpdateDaoParams",
          },
        },
      ],
    },
    {
      name: "initializeFutarchyAmm",
      accounts: [
        {
          name: "futarchyAmm",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "creator",
          isMut: false,
          isSigner: true,
        },
        {
          name: "dao",
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
          name: "creatorBaseAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "creatorQuoteAccount",
          isMut: true,
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
            defined: "InitializeFutarchyAmmParams",
          },
        },
      ],
    },
    {
      name: "arbitrarySwap",
      docs: ["You should NOT be calling into this directly."],
      accounts: [
        {
          name: "futarchyAmm",
          isMut: true,
          isSigner: false,
        },
        {
          name: "trader",
          isMut: false,
          isSigner: true,
        },
        {
          name: "traderInputAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "ammTokenAccounts",
          accounts: [
            {
              name: "baseUnconditional",
              isMut: true,
              isSigner: false,
            },
            {
              name: "quoteUnconditional",
              isMut: true,
              isSigner: false,
            },
            {
              name: "basePass",
              isMut: true,
              isSigner: false,
            },
            {
              name: "quotePass",
              isMut: true,
              isSigner: false,
            },
            {
              name: "baseFail",
              isMut: true,
              isSigner: false,
            },
            {
              name: "quoteFail",
              isMut: true,
              isSigner: false,
            },
          ],
        },
        {
          name: "question",
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
        {
          name: "quoteVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "quoteVaultUnderlyingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "baseVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "baseVaultUnderlyingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "conditionalVaultProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vaultEventAuthority",
          isMut: false,
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
            defined: "ArbitrarySwapParams",
          },
        },
      ],
    },
    {
      name: "spotSwap",
      accounts: [
        {
          name: "arbitrarySwap",
          accounts: [
            {
              name: "futarchyAmm",
              isMut: true,
              isSigner: false,
            },
            {
              name: "trader",
              isMut: false,
              isSigner: true,
            },
            {
              name: "traderInputAccount",
              isMut: true,
              isSigner: false,
            },
            {
              name: "ammTokenAccounts",
              accounts: [
                {
                  name: "baseUnconditional",
                  isMut: true,
                  isSigner: false,
                },
                {
                  name: "quoteUnconditional",
                  isMut: true,
                  isSigner: false,
                },
                {
                  name: "basePass",
                  isMut: true,
                  isSigner: false,
                },
                {
                  name: "quotePass",
                  isMut: true,
                  isSigner: false,
                },
                {
                  name: "baseFail",
                  isMut: true,
                  isSigner: false,
                },
                {
                  name: "quoteFail",
                  isMut: true,
                  isSigner: false,
                },
              ],
            },
            {
              name: "question",
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
            {
              name: "quoteVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "quoteVaultUnderlyingTokenAccount",
              isMut: true,
              isSigner: false,
            },
            {
              name: "baseVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "baseVaultUnderlyingTokenAccount",
              isMut: true,
              isSigner: false,
            },
            {
              name: "tokenProgram",
              isMut: false,
              isSigner: false,
            },
            {
              name: "conditionalVaultProgram",
              isMut: false,
              isSigner: false,
            },
            {
              name: "vaultEventAuthority",
              isMut: false,
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
            defined: "SpotSwapParams",
          },
        },
      ],
    },
    {
      name: "swap",
      accounts: [
        {
          name: "futarchyAmm",
          isMut: true,
          isSigner: false,
        },
        {
          name: "trader",
          isMut: false,
          isSigner: true,
        },
        {
          name: "traderBaseAccount",
          isMut: false,
          isSigner: false,
        },
        {
          name: "traderQuoteAccount",
          isMut: false,
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
            defined: "SwapParams",
          },
        },
      ],
    },
    {
      name: "conditionalSwap",
      accounts: [
        {
          name: "futarchyAmm",
          isMut: true,
          isSigner: false,
        },
        {
          name: "trader",
          isMut: false,
          isSigner: true,
        },
        {
          name: "traderBaseAccount",
          isMut: false,
          isSigner: false,
        },
        {
          name: "traderQuoteAccount",
          isMut: false,
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
            defined: "ConditionalSwapParams",
          },
        },
      ],
    },
  ],
  accounts: [
    {
      name: "dao",
      type: {
        kind: "struct",
        fields: [
          {
            name: "nonce",
            docs: ["`nonce` + `dao_creator` are PDA seeds"],
            type: "u64",
          },
          {
            name: "daoCreator",
            type: "publicKey",
          },
          {
            name: "pdaBump",
            type: "u8",
          },
          {
            name: "squadsMultisig",
            type: "publicKey",
          },
          {
            name: "squadsMultisigVault",
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
            name: "proposalCount",
            type: "u32",
          },
          {
            name: "passThresholdBps",
            type: "u16",
          },
          {
            name: "slotsPerProposal",
            type: "u64",
          },
          {
            name: "twapInitialObservation",
            docs: [
              "For manipulation-resistance the TWAP is a time-weighted average observation,",
              "where observation tries to approximate price but can only move by",
              "`twap_max_observation_change_per_update` per update. Because it can only move",
              "a little bit per update, you need to check that it has a good initial observation.",
              "Otherwise, an attacker could create a very high initial observation in the pass",
              "market and a very low one in the fail market to force the proposal to pass.",
              "",
              "We recommend setting an initial observation around the spot price of the token,",
              "and max observation change per update around 2% the spot price of the token.",
              "For example, if the spot price of META is $400, we'd recommend setting an initial",
              "observation of 400 (converted into the AMM prices) and a max observation change per",
              "update of 8 (also converted into the AMM prices). Observations can be updated once",
              "a minute, so 2% allows the proposal market to reach double the spot price or 0",
              "in 50 minutes.",
            ],
            type: "u128",
          },
          {
            name: "twapMaxObservationChangePerUpdate",
            type: "u128",
          },
          {
            name: "twapStartDelaySlots",
            docs: [
              "Forces TWAP calculation to start after amm.created_at_slot + twap_start_delay_slots",
            ],
            type: "u64",
          },
          {
            name: "minQuoteFutarchicLiquidity",
            docs: [
              "As an anti-spam measure and to help liquidity, you need to lock up some liquidity",
              "in both futarchic markets in order to create a proposal.",
              "",
              "For example, for META, we can use a `min_quote_futarchic_liquidity` of",
              "5000 * 1_000_000 (5000 USDC) and a `min_base_futarchic_liquidity` of",
              "10 * 1_000_000_000 (10 META).",
            ],
            type: "u64",
          },
          {
            name: "minBaseFutarchicLiquidity",
            type: "u64",
          },
          {
            name: "seqNum",
            type: "u64",
          },
          {
            name: "initialSpendingLimit",
            type: {
              option: {
                defined: "InitialSpendingLimit",
              },
            },
          },
        ],
      },
    },
    {
      name: "futarchyAmm",
      type: {
        kind: "struct",
        fields: [
          {
            name: "bump",
            type: "u8",
          },
          {
            name: "dao",
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
            name: "spotPool",
            type: {
              defined: "Pool",
            },
          },
          {
            name: "baseVault",
            type: "publicKey",
          },
          {
            name: "quoteVault",
            type: "publicKey",
          },
          {
            name: "liveProposal",
            type: {
              option: {
                defined: "LiveProposalDetails",
              },
            },
          },
        ],
      },
    },
    {
      name: "proposal",
      type: {
        kind: "struct",
        fields: [
          {
            name: "number",
            type: "u32",
          },
          {
            name: "proposer",
            type: "publicKey",
          },
          {
            name: "slotEnqueued",
            type: "u64",
          },
          {
            name: "state",
            type: {
              defined: "ProposalState",
            },
          },
          {
            name: "baseVault",
            type: "publicKey",
          },
          {
            name: "quoteVault",
            type: "publicKey",
          },
          {
            name: "futarchyAmm",
            type: "publicKey",
          },
          {
            name: "dao",
            type: "publicKey",
          },
          {
            name: "pdaBump",
            type: "u8",
          },
          {
            name: "question",
            type: "publicKey",
          },
          {
            name: "durationInSlots",
            type: "u64",
          },
          {
            name: "squadsProposal",
            type: "publicKey",
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "CommonFields",
      type: {
        kind: "struct",
        fields: [
          {
            name: "slot",
            type: "u64",
          },
          {
            name: "unixTimestamp",
            type: "i64",
          },
        ],
      },
    },
    {
      name: "ArbitrarySwapParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "input",
            type: {
              defined: "AssetAndAmount",
            },
          },
          {
            name: "outputs",
            type: {
              vec: {
                defined: "AssetAndAmount",
              },
            },
          },
          {
            name: "quoteSplitOrMerge",
            type: {
              defined: "SplitOrMergeAndAmount",
            },
          },
          {
            name: "baseSplitOrMerge",
            type: {
              defined: "SplitOrMergeAndAmount",
            },
          },
        ],
      },
    },
    {
      name: "SpotSwapParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "side",
            type: {
              defined: "Side",
            },
          },
          {
            name: "amountIn",
            type: "u64",
          },
          {
            name: "minAmountOut",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "SplitOrMergeAndAmount",
      type: {
        kind: "struct",
        fields: [
          {
            name: "splitOrMerge",
            type: {
              defined: "SplitOrMerge",
            },
          },
          {
            name: "amount",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "AssetAndAmount",
      type: {
        kind: "struct",
        fields: [
          {
            name: "asset",
            type: {
              defined: "Asset",
            },
          },
          {
            name: "amount",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "ConditionalSwapParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "side",
            type: {
              defined: "Side",
            },
          },
          {
            name: "condition",
            type: {
              defined: "Condition",
            },
          },
          {
            name: "amountIn",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "InitializeDaoParams",
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
          {
            name: "twapStartDelaySlots",
            type: "u64",
          },
          {
            name: "minQuoteFutarchicLiquidity",
            type: "u64",
          },
          {
            name: "minBaseFutarchicLiquidity",
            type: "u64",
          },
          {
            name: "passThresholdBps",
            type: "u16",
          },
          {
            name: "slotsPerProposal",
            type: "u64",
          },
          {
            name: "nonce",
            type: "u64",
          },
          {
            name: "initialSpendingLimit",
            type: {
              option: {
                defined: "InitialSpendingLimit",
              },
            },
          },
        ],
      },
    },
    {
      name: "InitializeFutarchyAmmParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "quoteAmount",
            type: "u64",
          },
          {
            name: "baseAmount",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "InitializeProposalParams",
      type: {
        kind: "struct",
        fields: [
          {
<<<<<<< HEAD
            name: "descriptionUrl",
            type: "string",
          },
          {
            name: "passLpTokensToLock",
            type: "u64",
          },
          {
            name: "failLpTokensToLock",
=======
            name: "nonce",
>>>>>>> af0016f (Get basic swap + conditional swap accounting working)
            type: "u64",
          },
        ],
      },
    },
    {
      name: "SwapParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "side",
            type: {
              defined: "Side",
            },
          },
          {
            name: "amountIn",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "UpdateDaoParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "passThresholdBps",
            type: {
              option: "u16",
            },
          },
          {
            name: "slotsPerProposal",
            type: {
              option: "u64",
            },
          },
          {
            name: "twapInitialObservation",
            type: {
              option: "u128",
            },
          },
          {
            name: "twapMaxObservationChangePerUpdate",
            type: {
              option: "u128",
            },
          },
          {
            name: "minQuoteFutarchicLiquidity",
            type: {
              option: "u64",
            },
          },
          {
            name: "minBaseFutarchicLiquidity",
            type: {
              option: "u64",
            },
          },
        ],
      },
    },
    {
      name: "InitialSpendingLimit",
      type: {
        kind: "struct",
        fields: [
          {
            name: "amountPerMonth",
            type: "u64",
          },
          {
            name: "members",
            type: {
              vec: "publicKey",
            },
          },
        ],
      },
    },
    {
      name: "LiveProposalDetails",
      type: {
        kind: "struct",
        fields: [
          {
            name: "proposal",
            type: "publicKey",
          },
          {
            name: "question",
            type: "publicKey",
          },
          {
            name: "passPool",
            type: {
              defined: "Pool",
            },
          },
          {
            name: "failPool",
            type: {
              defined: "Pool",
            },
          },
        ],
      },
    },
    {
      name: "Pool",
      type: {
        kind: "struct",
        fields: [
          {
            name: "baseReserves",
            type: "u64",
          },
          {
            name: "quoteReserves",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "SplitOrMerge",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Split",
          },
          {
            name: "Merge",
          },
        ],
      },
    },
    {
      name: "Asset",
      type: {
        kind: "enum",
        variants: [
          {
            name: "SpotQuote",
          },
          {
            name: "SpotBase",
          },
          {
            name: "PassQuote",
          },
          {
            name: "PassBase",
          },
          {
            name: "FailQuote",
          },
          {
            name: "FailBase",
          },
        ],
      },
    },
    {
      name: "AssetType",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Quote",
          },
          {
            name: "Base",
          },
        ],
      },
    },
    {
      name: "Condition",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Unconditional",
          },
          {
            name: "Pass",
          },
          {
            name: "Fail",
          },
        ],
      },
    },
    {
      name: "Side",
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
    {
      name: "ProposalState",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Pending",
          },
          {
            name: "Passed",
          },
          {
            name: "Failed",
          },
        ],
      },
    },
  ],
  events: [
    {
      name: "InitializeDaoEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "dao",
          type: "publicKey",
          index: false,
        },
        {
          name: "baseMint",
          type: "publicKey",
          index: false,
        },
        {
          name: "quoteMint",
          type: "publicKey",
          index: false,
        },
        {
          name: "passThresholdBps",
          type: "u16",
          index: false,
        },
        {
          name: "slotsPerProposal",
          type: "u64",
          index: false,
        },
        {
          name: "twapInitialObservation",
          type: "u128",
          index: false,
        },
        {
          name: "twapMaxObservationChangePerUpdate",
          type: "u128",
          index: false,
        },
        {
          name: "minQuoteFutarchicLiquidity",
          type: "u64",
          index: false,
        },
        {
          name: "minBaseFutarchicLiquidity",
          type: "u64",
          index: false,
        },
        {
          name: "initialSpendingLimit",
          type: {
            option: {
              defined: "InitialSpendingLimit",
            },
          },
          index: false,
        },
        {
          name: "squadsMultisig",
          type: "publicKey",
          index: false,
        },
        {
          name: "squadsMultisigVault",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "UpdateDaoEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "dao",
          type: "publicKey",
          index: false,
        },
        {
          name: "passThresholdBps",
          type: "u16",
          index: false,
        },
        {
          name: "slotsPerProposal",
          type: "u64",
          index: false,
        },
        {
          name: "twapInitialObservation",
          type: "u128",
          index: false,
        },
        {
          name: "twapMaxObservationChangePerUpdate",
          type: "u128",
          index: false,
        },
        {
          name: "minQuoteFutarchicLiquidity",
          type: "u64",
          index: false,
        },
        {
          name: "minBaseFutarchicLiquidity",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "InitializeProposalEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "proposal",
          type: "publicKey",
          index: false,
        },
        {
          name: "dao",
          type: "publicKey",
          index: false,
        },
        {
          name: "question",
          type: "publicKey",
          index: false,
        },
        {
          name: "quoteVault",
          type: "publicKey",
          index: false,
        },
        {
          name: "baseVault",
          type: "publicKey",
          index: false,
        },
        {
          name: "passAmm",
          type: "publicKey",
          index: false,
        },
        {
          name: "failAmm",
          type: "publicKey",
          index: false,
        },
        {
          name: "passLpMint",
          type: "publicKey",
          index: false,
        },
        {
          name: "failLpMint",
          type: "publicKey",
          index: false,
        },
        {
          name: "proposer",
          type: "publicKey",
          index: false,
        },
        {
          name: "number",
          type: "u32",
          index: false,
        },
        {
          name: "passLpTokensLocked",
          type: "u64",
          index: false,
        },
        {
          name: "failLpTokensLocked",
          type: "u64",
          index: false,
        },
        {
          name: "pdaBump",
          type: "u8",
          index: false,
        },
        {
          name: "durationInSlots",
          type: "u64",
          index: false,
        },
        {
          name: "squadsProposal",
          type: "publicKey",
          index: false,
        },
        {
          name: "squadsMultisig",
          type: "publicKey",
          index: false,
        },
        {
          name: "squadsMultisigVault",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "FinalizeProposalEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "proposal",
          type: "publicKey",
          index: false,
        },
        {
          name: "dao",
          type: "publicKey",
          index: false,
        },
        {
          name: "passMarketTwap",
          type: "u128",
          index: false,
        },
        {
          name: "failMarketTwap",
          type: "u128",
          index: false,
        },
        {
          name: "threshold",
          type: "u128",
          index: false,
        },
        {
          name: "state",
          type: {
            defined: "ProposalState",
          },
          index: false,
        },
        {
          name: "squadsProposal",
          type: "publicKey",
          index: false,
        },
        {
          name: "squadsMultisig",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "ExecuteProposalEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "proposal",
          type: "publicKey",
          index: false,
        },
        {
          name: "dao",
          type: "publicKey",
          index: false,
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "AmmTooOld",
      msg: "Amms must have been created within 5 minutes (counted in slots) of proposal initialization",
    },
    {
      code: 6001,
      name: "InvalidInitialObservation",
      msg: "An amm has an `initial_observation` that doesn't match the `dao`'s config",
    },
    {
      code: 6002,
      name: "InvalidMaxObservationChange",
      msg: "An amm has a `max_observation_change_per_update` that doesn't match the `dao`'s config",
    },
    {
      code: 6003,
      name: "InvalidStartDelaySlots",
      msg: "An amm has a `start_delay_slots` that doesn't match the `dao`'s config",
    },
    {
      code: 6004,
      name: "InvalidSettlementAuthority",
      msg: "One of the vaults has an invalid `settlement_authority`",
    },
    {
      code: 6005,
      name: "ProposalTooYoung",
      msg: "Proposal is too young to be executed or rejected",
    },
    {
      code: 6006,
      name: "MarketsTooYoung",
      msg: "Markets too young for proposal to be finalized. TWAP might need to be cranked",
    },
    {
      code: 6007,
      name: "ProposalAlreadyFinalized",
      msg: "This proposal has already been finalized",
    },
    {
      code: 6008,
      name: "InvalidVaultNonce",
      msg: "A conditional vault has an invalid nonce. A nonce should encode the proposal number",
    },
    {
      code: 6009,
      name: "ProposalNotPassed",
      msg: "This proposal can't be executed because it isn't in the passed state",
    },
    {
      code: 6010,
      name: "InsufficientLpTokenBalance",
      msg: "The proposer has fewer pass or fail LP tokens than they requested to lock",
    },
    {
      code: 6011,
      name: "InsufficientLpTokenLock",
      msg: "The LP tokens passed in have less liquidity than the DAO's `min_quote_futarchic_liquidity` or `min_base_futachic_liquidity`",
    },
    {
      code: 6012,
      name: "ProposalDurationTooShort",
      msg: "Proposal duration must be longer than TWAP start delay",
    },
    {
      code: 6013,
      name: "QuestionMustBeBinary",
      msg: "Question must have exactly 2 outcomes for binary futarchy",
    },
    {
      code: 6014,
<<<<<<< HEAD
      name: "InvalidSquadsProposalStatus",
      msg: "Squads proposal must be in Draft status",
=======
      name: "NoReserves",
      msg: "No reserves",
    },
    {
      code: 6015,
      name: "CastingOverflow",
      msg: "Got overflow when casting",
    },
    {
      code: 6016,
      name: "ConstantProductInvariantFailed",
      msg: "Constant product invariant failed",
>>>>>>> c9984c7 (Get basic `swap` working)
    },
    {
      code: 6017,
      name: "ProposalNotLive",
      msg: "Proposal must be live to swap conditional tokens",
    },
    {
      code: 6018,
      name: "InvariantViolation",
      msg: "Invariant violation",
    },
  ],
};
