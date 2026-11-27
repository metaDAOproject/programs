/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL was converted from the legacy format with `anchor idl convert` and lives in
 * the `.json` file next to this one.
 */
export type Futarchy = {
  address: "FUTARELBfJfQ8RDGhg1wdhddq1odMAJUePHFuBYfUxKq";
  metadata: {
    name: "futarchy";
    version: "0.6.0";
    spec: "0.1.0";
  };
  instructions: [
    {
      name: "initializeDao";
      discriminator: [128, 226, 96, 90, 39, 56, 24, 196];
      accounts: [
        {
          name: "dao";
          writable: true;
        },
        {
          name: "daoCreator";
          signer: true;
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "systemProgram";
        },
        {
          name: "baseMint";
        },
        {
          name: "quoteMint";
        },
        {
          name: "squadsMultisig";
          writable: true;
        },
        {
          name: "squadsMultisigVault";
        },
        {
          name: "squadsProgram";
        },
        {
          name: "squadsProgramConfig";
        },
        {
          name: "squadsProgramConfigTreasury";
          writable: true;
        },
        {
          name: "spendingLimit";
          writable: true;
        },
        {
          name: "futarchyAmmBaseVault";
          writable: true;
        },
        {
          name: "futarchyAmmQuoteVault";
          writable: true;
        },
        {
          name: "tokenProgram";
        },
        {
          name: "associatedTokenProgram";
        },
        {
          name: "eventAuthority";
        },
        {
          name: "program";
        },
      ];
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "initializeDaoParams";
            };
          };
        },
      ];
    },
    {
      name: "initializeProposal";
      discriminator: [50, 73, 156, 98, 129, 149, 21, 158];
      accounts: [
        {
          name: "proposal";
          writable: true;
        },
        {
          name: "squadsProposal";
        },
        {
          name: "dao";
          writable: true;
        },
        {
          name: "question";
        },
        {
          name: "quoteVault";
        },
        {
          name: "baseVault";
        },
        {
          name: "proposer";
          signer: true;
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "systemProgram";
        },
        {
          name: "eventAuthority";
        },
        {
          name: "program";
        },
      ];
      args: [];
    },
    {
      name: "stakeToProposal";
      discriminator: [10, 169, 175, 238, 80, 221, 37, 16];
      accounts: [
        {
          name: "proposal";
          writable: true;
        },
        {
          name: "dao";
          writable: true;
        },
        {
          name: "stakerBaseAccount";
          writable: true;
        },
        {
          name: "proposalBaseAccount";
          writable: true;
        },
        {
          name: "stakeAccount";
          writable: true;
        },
        {
          name: "staker";
          signer: true;
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "tokenProgram";
        },
        {
          name: "associatedTokenProgram";
        },
        {
          name: "systemProgram";
        },
        {
          name: "eventAuthority";
        },
        {
          name: "program";
        },
      ];
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "stakeToProposalParams";
            };
          };
        },
      ];
    },
    {
      name: "unstakeFromProposal";
      discriminator: [179, 220, 186, 86, 2, 96, 50, 161];
      accounts: [
        {
          name: "proposal";
          writable: true;
        },
        {
          name: "dao";
          writable: true;
        },
        {
          name: "stakerBaseAccount";
          writable: true;
        },
        {
          name: "proposalBaseAccount";
          writable: true;
        },
        {
          name: "stakeAccount";
          writable: true;
        },
        {
          name: "staker";
          signer: true;
        },
        {
          name: "tokenProgram";
        },
        {
          name: "associatedTokenProgram";
        },
        {
          name: "eventAuthority";
        },
        {
          name: "program";
        },
      ];
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "unstakeFromProposalParams";
            };
          };
        },
      ];
    },
    {
      name: "launchProposal";
      discriminator: [16, 211, 189, 119, 245, 72, 0, 229];
      accounts: [
        {
          name: "proposal";
          writable: true;
        },
        {
          name: "baseVault";
        },
        {
          name: "quoteVault";
        },
        {
          name: "passBaseMint";
        },
        {
          name: "passQuoteMint";
        },
        {
          name: "failBaseMint";
        },
        {
          name: "failQuoteMint";
        },
        {
          name: "dao";
          writable: true;
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "ammPassBaseVault";
          writable: true;
        },
        {
          name: "ammPassQuoteVault";
          writable: true;
        },
        {
          name: "ammFailBaseVault";
          writable: true;
        },
        {
          name: "ammFailQuoteVault";
          writable: true;
        },
        {
          name: "systemProgram";
        },
        {
          name: "tokenProgram";
        },
        {
          name: "associatedTokenProgram";
        },
        {
          name: "eventAuthority";
        },
        {
          name: "program";
        },
      ];
      args: [];
    },
    {
      name: "finalizeProposal";
      discriminator: [23, 68, 51, 167, 109, 173, 187, 164];
      accounts: [
        {
          name: "proposal";
          writable: true;
        },
        {
          name: "dao";
          writable: true;
        },
        {
          name: "question";
          writable: true;
        },
        {
          name: "squadsProposal";
          writable: true;
        },
        {
          name: "squadsMultisig";
        },
        {
          name: "squadsMultisigProgram";
        },
        {
          name: "ammPassBaseVault";
          writable: true;
        },
        {
          name: "ammPassQuoteVault";
          writable: true;
        },
        {
          name: "ammFailBaseVault";
          writable: true;
        },
        {
          name: "ammFailQuoteVault";
          writable: true;
        },
        {
          name: "ammBaseVault";
          writable: true;
        },
        {
          name: "ammQuoteVault";
          writable: true;
        },
        {
          name: "vaultProgram";
        },
        {
          name: "vaultEventAuthority";
        },
        {
          name: "tokenProgram";
        },
        {
          name: "quoteVault";
          writable: true;
        },
        {
          name: "quoteVaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "passQuoteMint";
          writable: true;
        },
        {
          name: "failQuoteMint";
          writable: true;
        },
        {
          name: "passBaseMint";
          writable: true;
        },
        {
          name: "failBaseMint";
          writable: true;
        },
        {
          name: "baseVault";
          writable: true;
        },
        {
          name: "baseVaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "eventAuthority";
        },
        {
          name: "program";
        },
      ];
      args: [];
    },
    {
      name: "updateDao";
      discriminator: [131, 72, 75, 25, 112, 210, 109, 2];
      accounts: [
        {
          name: "dao";
          writable: true;
        },
        {
          name: "squadsMultisigVault";
          signer: true;
        },
        {
          name: "eventAuthority";
        },
        {
          name: "program";
        },
      ];
      args: [
        {
          name: "daoParams";
          type: {
            defined: {
              name: "updateDaoParams";
            };
          };
        },
      ];
    },
    {
      name: "spotSwap";
      discriminator: [167, 97, 12, 231, 237, 78, 166, 251];
      accounts: [
        {
          name: "dao";
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
          name: "ammBaseVault";
          writable: true;
        },
        {
          name: "ammQuoteVault";
          writable: true;
        },
        {
          name: "user";
          signer: true;
        },
        {
          name: "tokenProgram";
        },
        {
          name: "eventAuthority";
        },
        {
          name: "program";
        },
      ];
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "spotSwapParams";
            };
          };
        },
      ];
    },
    {
      name: "conditionalSwap";
      discriminator: [194, 136, 220, 89, 242, 169, 130, 157];
      accounts: [
        {
          name: "dao";
          writable: true;
        },
        {
          name: "ammBaseVault";
          writable: true;
        },
        {
          name: "ammQuoteVault";
          writable: true;
        },
        {
          name: "proposal";
        },
        {
          name: "ammPassBaseVault";
          writable: true;
        },
        {
          name: "ammPassQuoteVault";
          writable: true;
        },
        {
          name: "ammFailBaseVault";
          writable: true;
        },
        {
          name: "ammFailQuoteVault";
          writable: true;
        },
        {
          name: "trader";
          signer: true;
        },
        {
          name: "userInputAccount";
          writable: true;
        },
        {
          name: "userOutputAccount";
          writable: true;
        },
        {
          name: "baseVault";
          writable: true;
        },
        {
          name: "baseVaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "quoteVault";
          writable: true;
        },
        {
          name: "quoteVaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "passBaseMint";
          writable: true;
        },
        {
          name: "failBaseMint";
          writable: true;
        },
        {
          name: "passQuoteMint";
          writable: true;
        },
        {
          name: "failQuoteMint";
          writable: true;
        },
        {
          name: "conditionalVaultProgram";
        },
        {
          name: "vaultEventAuthority";
        },
        {
          name: "question";
        },
        {
          name: "tokenProgram";
        },
        {
          name: "eventAuthority";
        },
        {
          name: "program";
        },
      ];
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "conditionalSwapParams";
            };
          };
        },
      ];
    },
    {
      name: "provideLiquidity";
      discriminator: [40, 110, 107, 116, 174, 127, 97, 204];
      accounts: [
        {
          name: "dao";
          writable: true;
        },
        {
          name: "liquidityProvider";
          signer: true;
        },
        {
          name: "liquidityProviderBaseAccount";
          writable: true;
        },
        {
          name: "liquidityProviderQuoteAccount";
          writable: true;
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "systemProgram";
        },
        {
          name: "ammBaseVault";
          writable: true;
        },
        {
          name: "ammQuoteVault";
          writable: true;
        },
        {
          name: "ammPosition";
          writable: true;
        },
        {
          name: "tokenProgram";
        },
        {
          name: "eventAuthority";
        },
        {
          name: "program";
        },
      ];
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "provideLiquidityParams";
            };
          };
        },
      ];
    },
    {
      name: "withdrawLiquidity";
      discriminator: [149, 158, 33, 185, 47, 243, 253, 31];
      accounts: [
        {
          name: "dao";
          writable: true;
        },
        {
          name: "positionAuthority";
          signer: true;
        },
        {
          name: "liquidityProviderBaseAccount";
          writable: true;
        },
        {
          name: "liquidityProviderQuoteAccount";
          writable: true;
        },
        {
          name: "ammBaseVault";
          writable: true;
        },
        {
          name: "ammQuoteVault";
          writable: true;
        },
        {
          name: "ammPosition";
          writable: true;
        },
        {
          name: "tokenProgram";
        },
        {
          name: "eventAuthority";
        },
        {
          name: "program";
        },
      ];
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "withdrawLiquidityParams";
            };
          };
        },
      ];
    },
    {
      name: "collectFees";
      discriminator: [164, 152, 207, 99, 30, 186, 19, 182];
      accounts: [
        {
          name: "dao";
          writable: true;
        },
        {
          name: "admin";
          signer: true;
        },
        {
          name: "baseTokenAccount";
          writable: true;
        },
        {
          name: "quoteTokenAccount";
          writable: true;
        },
        {
          name: "ammBaseVault";
          writable: true;
        },
        {
          name: "ammQuoteVault";
          writable: true;
        },
        {
          name: "tokenProgram";
        },
        {
          name: "eventAuthority";
        },
        {
          name: "program";
        },
      ];
      args: [];
    },
    {
      name: "executeSpendingLimitChange";
      discriminator: [146, 175, 145, 31, 184, 129, 252, 79];
      accounts: [
        {
          name: "proposal";
          writable: true;
        },
        {
          name: "dao";
          writable: true;
        },
        {
          name: "squadsProposal";
          writable: true;
        },
        {
          name: "squadsMultisig";
        },
        {
          name: "squadsMultisigProgram";
        },
        {
          name: "vaultTransaction";
        },
        {
          name: "eventAuthority";
        },
        {
          name: "program";
        },
      ];
      args: [];
    },
  ];
  accounts: [
    {
      name: "ammPosition";
      discriminator: [34, 97, 105, 74, 17, 226, 212, 0];
    },
    {
      name: "dao";
      discriminator: [163, 9, 47, 31, 52, 85, 197, 49];
    },
    {
      name: "proposal";
      discriminator: [26, 94, 189, 187, 116, 136, 53, 33];
    },
    {
      name: "stakeAccount";
      discriminator: [80, 158, 67, 124, 50, 189, 192, 255];
    },
  ];
  events: [
    {
      name: "collectFeesEvent";
      discriminator: [226, 2, 53, 67, 132, 158, 125, 173];
    },
    {
      name: "initializeDaoEvent";
      discriminator: [119, 48, 153, 116, 127, 37, 226, 228];
    },
    {
      name: "updateDaoEvent";
      discriminator: [12, 58, 244, 224, 171, 25, 33, 56];
    },
    {
      name: "initializeProposalEvent";
      discriminator: [141, 56, 246, 192, 168, 254, 64, 111];
    },
    {
      name: "stakeToProposalEvent";
      discriminator: [94, 69, 68, 151, 90, 149, 240, 191];
    },
    {
      name: "unstakeFromProposalEvent";
      discriminator: [89, 129, 63, 211, 55, 33, 194, 171];
    },
    {
      name: "launchProposalEvent";
      discriminator: [177, 55, 191, 93, 203, 124, 184, 11];
    },
    {
      name: "finalizeProposalEvent";
      discriminator: [45, 29, 122, 181, 79, 224, 57, 141];
    },
    {
      name: "spotSwapEvent";
      discriminator: [29, 253, 121, 255, 82, 60, 148, 195];
    },
    {
      name: "conditionalSwapEvent";
      discriminator: [2, 166, 200, 160, 94, 212, 68, 45];
    },
    {
      name: "provideLiquidityEvent";
      discriminator: [38, 2, 37, 238, 229, 214, 255, 235];
    },
    {
      name: "withdrawLiquidityEvent";
      discriminator: [214, 6, 161, 45, 191, 142, 124, 186];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "ammTooOld";
      msg: "Amms must have been created within 5 minutes (counted in slots) of proposal initialization";
    },
    {
      code: 6001;
      name: "invalidInitialObservation";
      msg: "An amm has an `initial_observation` that doesn't match the `dao`'s config";
    },
    {
      code: 6002;
      name: "invalidMaxObservationChange";
      msg: "An amm has a `max_observation_change_per_update` that doesn't match the `dao`'s config";
    },
    {
      code: 6003;
      name: "invalidStartDelaySlots";
      msg: "An amm has a `start_delay_slots` that doesn't match the `dao`'s config";
    },
    {
      code: 6004;
      name: "invalidSettlementAuthority";
      msg: "One of the vaults has an invalid `settlement_authority`";
    },
    {
      code: 6005;
      name: "proposalTooYoung";
      msg: "Proposal is too young to be executed or rejected";
    },
    {
      code: 6006;
      name: "marketsTooYoung";
      msg: "Markets too young for proposal to be finalized. TWAP might need to be cranked";
    },
    {
      code: 6007;
      name: "proposalAlreadyFinalized";
      msg: "This proposal has already been finalized";
    },
    {
      code: 6008;
      name: "invalidVaultNonce";
      msg: "A conditional vault has an invalid nonce. A nonce should encode the proposal number";
    },
    {
      code: 6009;
      name: "proposalNotPassed";
      msg: "This proposal can't be executed because it isn't in the passed state";
    },
    {
      code: 6010;
      name: "insufficientLiquidity";
      msg: "More liquidity needs to be in the AMM to launch this proposal";
    },
    {
      code: 6011;
      name: "proposalDurationTooShort";
      msg: "Proposal duration must be longer 1 day and longer than 2 times the TWAP start delay";
    },
    {
      code: 6012;
      name: "passThresholdTooHigh";
      msg: "Pass threshold must be less than 10%";
    },
    {
      code: 6013;
      name: "questionMustBeBinary";
      msg: "Question must have exactly 2 outcomes for binary futarchy";
    },
    {
      code: 6014;
      name: "invalidSquadsProposalStatus";
      msg: "Squads proposal must be in Draft status";
    },
    {
      code: 6015;
      name: "castingOverflow";
      msg: "Casting overflow. If you're seeing this, please report this";
    },
    {
      code: 6016;
      name: "insufficientBalance";
      msg: "Insufficient balance";
    },
    {
      code: 6017;
      name: "zeroLiquidityRemove";
      msg: "Cannot remove zero liquidity";
    },
    {
      code: 6018;
      name: "swapSlippageExceeded";
      msg: "Swap slippage exceeded";
    },
    {
      code: 6019;
      name: "assertFailed";
      msg: "Assert failed";
    },
    {
      code: 6020;
      name: "invalidAdmin";
      msg: "Invalid admin";
    },
    {
      code: 6021;
      name: "proposalNotInDraftState";
      msg: "Proposal is not in draft state";
    },
    {
      code: 6022;
      name: "insufficientTokenBalance";
      msg: "Insufficient token balance";
    },
    {
      code: 6023;
      name: "invalidAmount";
      msg: "Invalid amount";
    },
    {
      code: 6024;
      name: "insufficientStakeToLaunch";
      msg: "Insufficient stake to launch proposal";
    },
    {
      code: 6025;
      name: "stakerNotFound";
      msg: "Staker not found in proposal";
    },
    {
      code: 6026;
      name: "poolNotInSpotState";
      msg: "Pool must be in spot state";
    },
    {
      code: 6027;
      name: "invalidDaoCreateLiquidity";
      msg: "If you're providing liquidity, you must provide both base and quote token accounts";
    },
    {
      code: 6028;
      name: "invalidStakeAccount";
      msg: "Invalid stake account";
    },
    {
      code: 6029;
      name: "invariantViolated";
      msg: "An invariant was violated. You should get in contact with the MetaDAO team if you see this";
    },
    {
      code: 6030;
      name: "proposalNotActive";
      msg: "Proposal needs to be active to perform a conditional swap";
    },
    {
      code: 6031;
      name: "invalidTransaction";
      msg: "This Squads transaction should only contain calls to update spending limits";
    },
  ];
  types: [
    {
      name: "commonFields";
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
          },
          {
            name: "daoSeqNum";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "conditionalSwapParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "market";
            type: {
              defined: {
                name: "market";
              };
            };
          },
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
            name: "minOutputAmount";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "initializeDaoParams";
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
            name: "twapStartDelaySeconds";
            type: "u32";
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
            name: "baseToStake";
            type: "u64";
          },
          {
            name: "passThresholdBps";
            type: "u16";
          },
          {
            name: "secondsPerProposal";
            type: "u32";
          },
          {
            name: "nonce";
            type: "u64";
          },
          {
            name: "initialSpendingLimit";
            type: {
              option: {
                defined: {
                  name: "initialSpendingLimit";
                };
              };
            };
          },
        ];
      };
    },
    {
      name: "provideLiquidityParams";
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
            name: "minLiquidity";
            docs: ["The minimum liquidity you will be assigned"];
            type: "u128";
          },
          {
            name: "positionAuthority";
            docs: [
              "The account that will own the LP position, usually the same as the",
              "liquidity provider",
            ];
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "spotSwapParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "inputAmount";
            type: "u64";
          },
          {
            name: "swapType";
            type: {
              defined: {
                name: "swapType";
              };
            };
          },
          {
            name: "minOutputAmount";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "stakeToProposalParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amount";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "unstakeFromProposalParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amount";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "updateDaoParams";
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
            name: "secondsPerProposal";
            type: {
              option: "u32";
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
          },
          {
            name: "baseToStake";
            type: {
              option: "u64";
            };
          },
        ];
      };
    },
    {
      name: "withdrawLiquidityParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "liquidityToWithdraw";
            docs: ["How much liquidity to withdraw"];
            type: "u128";
          },
          {
            name: "minBaseAmount";
            docs: ["Minimum base tokens to receive"];
            type: "u64";
          },
          {
            name: "minQuoteAmount";
            docs: ["Minimum quote tokens to receive"];
            type: "u64";
          },
        ];
      };
    },
    {
      name: "initialSpendingLimit";
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
              vec: "pubkey";
            };
          },
        ];
      };
    },
    {
      name: "futarchyAmm";
      type: {
        kind: "struct";
        fields: [
          {
            name: "state";
            type: {
              defined: {
                name: "poolState";
              };
            };
          },
          {
            name: "totalLiquidity";
            type: "u128";
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
            name: "ammBaseVault";
            type: "pubkey";
          },
          {
            name: "ammQuoteVault";
            type: "pubkey";
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
              "aggregator at T2 being smaller than an aggregator at T1.",
            ];
            type: "u128";
          },
          {
            name: "lastUpdatedTimestamp";
            type: "i64";
          },
          {
            name: "createdAtTimestamp";
            type: "i64";
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
            name: "maxObservationChangePerUpdate";
            docs: ["The most that an observation can change per update."];
            type: "u128";
          },
          {
            name: "initialObservation";
            docs: ["What the initial `latest_observation` is set to."];
            type: "u128";
          },
          {
            name: "startDelaySeconds";
            docs: [
              "Number of seconds after amm.created_at_slot to start recording TWAP",
            ];
            type: "u32";
          },
        ];
      };
    },
    {
      name: "pool";
      type: {
        kind: "struct";
        fields: [
          {
            name: "oracle";
            type: {
              defined: {
                name: "twapOracle";
              };
            };
          },
          {
            name: "quoteReserves";
            type: "u64";
          },
          {
            name: "baseReserves";
            type: "u64";
          },
          {
            name: "quoteProtocolFeeBalance";
            type: "u64";
          },
          {
            name: "baseProtocolFeeBalance";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "poolState";
      type: {
        kind: "enum";
        variants: [
          {
            name: "spot";
            fields: [
              {
                name: "spot";
                type: {
                  defined: {
                    name: "pool";
                  };
                };
              },
            ];
          },
          {
            name: "futarchy";
            fields: [
              {
                name: "spot";
                type: {
                  defined: {
                    name: "pool";
                  };
                };
              },
              {
                name: "pass";
                type: {
                  defined: {
                    name: "pool";
                  };
                };
              },
              {
                name: "fail";
                type: {
                  defined: {
                    name: "pool";
                  };
                };
              },
            ];
          },
        ];
      };
    },
    {
      name: "market";
      type: {
        kind: "enum";
        variants: [
          {
            name: "spot";
          },
          {
            name: "pass";
          },
          {
            name: "fail";
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
      name: "token";
      type: {
        kind: "enum";
        variants: [
          {
            name: "base";
          },
          {
            name: "quote";
          },
        ];
      };
    },
    {
      name: "proposalState";
      type: {
        kind: "enum";
        variants: [
          {
            name: "draft";
            fields: [
              {
                name: "amountStaked";
                type: "u64";
              },
            ];
          },
          {
            name: "pending";
          },
          {
            name: "passed";
          },
          {
            name: "failed";
          },
        ];
      };
    },
    {
      name: "ammPosition";
      type: {
        kind: "struct";
        fields: [
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "positionAuthority";
            type: "pubkey";
          },
          {
            name: "liquidity";
            type: "u128";
          },
        ];
      };
    },
    {
      name: "dao";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amm";
            docs: ["Embedded FutarchyAmm - 1:1 relationship"];
            type: {
              defined: {
                name: "futarchyAmm";
              };
            };
          },
          {
            name: "nonce";
            docs: ["`nonce` + `dao_creator` are PDA seeds"];
            type: "u64";
          },
          {
            name: "daoCreator";
            type: "pubkey";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
          {
            name: "squadsMultisig";
            type: "pubkey";
          },
          {
            name: "squadsMultisigVault";
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
            name: "proposalCount";
            type: "u32";
          },
          {
            name: "passThresholdBps";
            type: "u16";
          },
          {
            name: "secondsPerProposal";
            type: "u32";
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
              "in 50 minutes.",
            ];
            type: "u128";
          },
          {
            name: "twapMaxObservationChangePerUpdate";
            type: "u128";
          },
          {
            name: "twapStartDelaySeconds";
            docs: [
              "Forces TWAP calculation to start after `twap_start_delay_seconds` seconds",
            ];
            type: "u32";
          },
          {
            name: "minQuoteFutarchicLiquidity";
            docs: [
              "As an anti-spam measure and to help liquidity, you need to lock up some liquidity",
              "in both futarchic markets in order to create a proposal.",
              "",
              "For example, for META, we can use a `min_quote_futarchic_liquidity` of",
              "5000 * 1_000_000 (5000 USDC) and a `min_base_futarchic_liquidity` of",
              "10 * 1_000_000_000 (10 META).",
            ];
            type: "u64";
          },
          {
            name: "minBaseFutarchicLiquidity";
            type: "u64";
          },
          {
            name: "baseToStake";
            docs: [
              "Minimum amount of base tokens that must be staked to launch a proposal",
            ];
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
                defined: {
                  name: "initialSpendingLimit";
                };
              };
            };
          },
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
            type: "pubkey";
          },
          {
            name: "timestampEnqueued";
            type: "i64";
          },
          {
            name: "state";
            type: {
              defined: {
                name: "proposalState";
              };
            };
          },
          {
            name: "baseVault";
            type: "pubkey";
          },
          {
            name: "quoteVault";
            type: "pubkey";
          },
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
          {
            name: "question";
            type: "pubkey";
          },
          {
            name: "durationInSeconds";
            type: "u32";
          },
          {
            name: "squadsProposal";
            type: "pubkey";
          },
          {
            name: "passBaseMint";
            type: "pubkey";
          },
          {
            name: "passQuoteMint";
            type: "pubkey";
          },
          {
            name: "failBaseMint";
            type: "pubkey";
          },
          {
            name: "failQuoteMint";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "stakeAccount";
      type: {
        kind: "struct";
        fields: [
          {
            name: "proposal";
            type: "pubkey";
          },
          {
            name: "staker";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "bump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "collectFeesEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "baseTokenAccount";
            type: "pubkey";
          },
          {
            name: "quoteTokenAccount";
            type: "pubkey";
          },
          {
            name: "ammBaseVault";
            type: "pubkey";
          },
          {
            name: "ammQuoteVault";
            type: "pubkey";
          },
          {
            name: "quoteMint";
            type: "pubkey";
          },
          {
            name: "baseMint";
            type: "pubkey";
          },
          {
            name: "quoteFeesCollected";
            type: "u64";
          },
          {
            name: "baseFeesCollected";
            type: "u64";
          },
          {
            name: "postAmmState";
            type: {
              defined: {
                name: "futarchyAmm";
              };
            };
          },
        ];
      };
    },
    {
      name: "initializeDaoEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "dao";
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
            name: "passThresholdBps";
            type: "u16";
          },
          {
            name: "secondsPerProposal";
            type: "u32";
          },
          {
            name: "twapInitialObservation";
            type: "u128";
          },
          {
            name: "twapMaxObservationChangePerUpdate";
            type: "u128";
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
            name: "baseToStake";
            type: "u64";
          },
          {
            name: "initialSpendingLimit";
            type: {
              option: {
                defined: {
                  name: "initialSpendingLimit";
                };
              };
            };
          },
          {
            name: "squadsMultisig";
            type: "pubkey";
          },
          {
            name: "squadsMultisigVault";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "updateDaoEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "passThresholdBps";
            type: "u16";
          },
          {
            name: "secondsPerProposal";
            type: "u32";
          },
          {
            name: "twapInitialObservation";
            type: "u128";
          },
          {
            name: "twapMaxObservationChangePerUpdate";
            type: "u128";
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
            name: "baseToStake";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "initializeProposalEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "proposal";
            type: "pubkey";
          },
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "question";
            type: "pubkey";
          },
          {
            name: "quoteVault";
            type: "pubkey";
          },
          {
            name: "baseVault";
            type: "pubkey";
          },
          {
            name: "proposer";
            type: "pubkey";
          },
          {
            name: "number";
            type: "u32";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
          {
            name: "durationInSeconds";
            type: "u32";
          },
          {
            name: "squadsProposal";
            type: "pubkey";
          },
          {
            name: "squadsMultisig";
            type: "pubkey";
          },
          {
            name: "squadsMultisigVault";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "stakeToProposalEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "proposal";
            type: "pubkey";
          },
          {
            name: "staker";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "totalStaked";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "unstakeFromProposalEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "proposal";
            type: "pubkey";
          },
          {
            name: "staker";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "totalStaked";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "launchProposalEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "proposal";
            type: "pubkey";
          },
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "totalStaked";
            type: "u64";
          },
          {
            name: "postAmmState";
            type: {
              defined: {
                name: "futarchyAmm";
              };
            };
          },
        ];
      };
    },
    {
      name: "finalizeProposalEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "proposal";
            type: "pubkey";
          },
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "passMarketTwap";
            type: "u128";
          },
          {
            name: "failMarketTwap";
            type: "u128";
          },
          {
            name: "threshold";
            type: "u128";
          },
          {
            name: "state";
            type: {
              defined: {
                name: "proposalState";
              };
            };
          },
          {
            name: "squadsProposal";
            type: "pubkey";
          },
          {
            name: "squadsMultisig";
            type: "pubkey";
          },
          {
            name: "postAmmState";
            type: {
              defined: {
                name: "futarchyAmm";
              };
            };
          },
        ];
      };
    },
    {
      name: "spotSwapEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "user";
            type: "pubkey";
          },
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
            name: "outputAmount";
            type: "u64";
          },
          {
            name: "minOutputAmount";
            type: "u64";
          },
          {
            name: "postAmmState";
            type: {
              defined: {
                name: "futarchyAmm";
              };
            };
          },
        ];
      };
    },
    {
      name: "conditionalSwapEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "proposal";
            type: "pubkey";
          },
          {
            name: "trader";
            type: "pubkey";
          },
          {
            name: "market";
            type: {
              defined: {
                name: "market";
              };
            };
          },
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
            name: "outputAmount";
            type: "u64";
          },
          {
            name: "minOutputAmount";
            type: "u64";
          },
          {
            name: "postAmmState";
            type: {
              defined: {
                name: "futarchyAmm";
              };
            };
          },
        ];
      };
    },
    {
      name: "provideLiquidityEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "liquidityProvider";
            type: "pubkey";
          },
          {
            name: "positionAuthority";
            type: "pubkey";
          },
          {
            name: "quoteAmount";
            type: "u64";
          },
          {
            name: "baseAmount";
            type: "u64";
          },
          {
            name: "liquidityMinted";
            type: "u128";
          },
          {
            name: "minLiquidity";
            type: "u128";
          },
          {
            name: "postAmmState";
            type: {
              defined: {
                name: "futarchyAmm";
              };
            };
          },
        ];
      };
    },
    {
      name: "withdrawLiquidityEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "liquidityProvider";
            type: "pubkey";
          },
          {
            name: "liquidityWithdrawn";
            type: "u128";
          },
          {
            name: "minBaseAmount";
            type: "u64";
          },
          {
            name: "minQuoteAmount";
            type: "u64";
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
            name: "postAmmState";
            type: {
              defined: {
                name: "futarchyAmm";
              };
            };
          },
        ];
      };
    },
  ];
};
