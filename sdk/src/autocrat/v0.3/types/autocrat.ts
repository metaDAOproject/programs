/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL was converted from the legacy format with `anchor idl convert` and lives in
 * the `.json` file next to this one.
 */
export type Autocrat = {
  address: "autoQP9RmUNkzzKRXsMkWicDVZ3h29vvyMDcAYjCxxg";
  metadata: {
    name: "autocrat";
    version: "0.3.0";
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
          name: "tokenMint";
        },
        {
          name: "usdcMint";
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
          name: "dao";
          writable: true;
        },
        {
          name: "quoteVault";
        },
        {
          name: "baseVault";
        },
        {
          name: "passAmm";
        },
        {
          name: "passLpMint";
        },
        {
          name: "failLpMint";
        },
        {
          name: "failAmm";
        },
        {
          name: "passLpUserAccount";
          writable: true;
        },
        {
          name: "failLpUserAccount";
          writable: true;
        },
        {
          name: "passLpVaultAccount";
          writable: true;
        },
        {
          name: "failLpVaultAccount";
          writable: true;
        },
        {
          name: "proposer";
          writable: true;
          signer: true;
        },
        {
          name: "tokenProgram";
        },
        {
          name: "systemProgram";
        },
      ];
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "initializeProposalParams";
            };
          };
        },
      ];
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
          name: "passAmm";
        },
        {
          name: "failAmm";
        },
        {
          name: "dao";
        },
        {
          name: "baseVault";
          writable: true;
        },
        {
          name: "quoteVault";
          writable: true;
        },
        {
          name: "treasury";
        },
        {
          name: "passLpUserAccount";
          writable: true;
        },
        {
          name: "failLpUserAccount";
          writable: true;
        },
        {
          name: "passLpVaultAccount";
          writable: true;
        },
        {
          name: "failLpVaultAccount";
          writable: true;
        },
        {
          name: "tokenProgram";
        },
        {
          name: "vaultProgram";
        },
      ];
      args: [];
    },
    {
      name: "executeProposal";
      discriminator: [186, 60, 116, 133, 108, 128, 111, 28];
      accounts: [
        {
          name: "proposal";
          writable: true;
        },
        {
          name: "dao";
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
          name: "treasury";
          signer: true;
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
  ];
  accounts: [
    {
      name: "dao";
      discriminator: [163, 9, 47, 31, 52, 85, 197, 49];
    },
    {
      name: "proposal";
      discriminator: [26, 94, 189, 187, 116, 136, 53, 33];
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
      name: "invalidSettlementAuthority";
      msg: "One of the vaults has an invalid `settlement_authority`";
    },
    {
      code: 6004;
      name: "proposalTooYoung";
      msg: "Proposal is too young to be executed or rejected";
    },
    {
      code: 6005;
      name: "marketsTooYoung";
      msg: "Markets too young for proposal to be finalized. TWAP might need to be cranked";
    },
    {
      code: 6006;
      name: "proposalAlreadyFinalized";
      msg: "This proposal has already been finalized";
    },
    {
      code: 6007;
      name: "invalidVaultNonce";
      msg: "A conditional vault has an invalid nonce. A nonce should encode the proposal number";
    },
    {
      code: 6008;
      name: "proposalNotPassed";
      msg: "This proposal can't be executed because it isn't in the passed state";
    },
    {
      code: 6009;
      name: "insufficientLpTokenBalance";
      msg: "The proposer has fewer pass or fail LP tokens than they requested to lock";
    },
    {
      code: 6010;
      name: "insufficientLpTokenLock";
      msg: "The LP tokens passed in have less liquidity than the DAO's `min_quote_futarchic_liquidity` or `min_base_futachic_liquidity`";
    },
  ];
  types: [
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
            name: "minQuoteFutarchicLiquidity";
            type: "u64";
          },
          {
            name: "minBaseFutarchicLiquidity";
            type: "u64";
          },
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
        ];
      };
    },
    {
      name: "initializeProposalParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "descriptionUrl";
            type: "string";
          },
          {
            name: "instruction";
            type: {
              defined: {
                name: "proposalInstruction";
              };
            };
          },
          {
            name: "passLpTokensToLock";
            type: "u64";
          },
          {
            name: "failLpTokensToLock";
            type: "u64";
          },
          {
            name: "nonce";
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
          },
        ];
      };
    },
    {
      name: "proposalAccount";
      type: {
        kind: "struct";
        fields: [
          {
            name: "pubkey";
            type: "pubkey";
          },
          {
            name: "isSigner";
            type: "bool";
          },
          {
            name: "isWritable";
            type: "bool";
          },
        ];
      };
    },
    {
      name: "proposalInstruction";
      type: {
        kind: "struct";
        fields: [
          {
            name: "programId";
            type: "pubkey";
          },
          {
            name: "accounts";
            type: {
              vec: {
                defined: {
                  name: "proposalAccount";
                };
              };
            };
          },
          {
            name: "data";
            type: "bytes";
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
            name: "pending";
          },
          {
            name: "passed";
          },
          {
            name: "failed";
          },
          {
            name: "executed";
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
            name: "treasuryPdaBump";
            type: "u8";
          },
          {
            name: "treasury";
            type: "pubkey";
          },
          {
            name: "tokenMint";
            type: "pubkey";
          },
          {
            name: "usdcMint";
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
              "in 50 minutes.",
            ];
            type: "u128";
          },
          {
            name: "twapMaxObservationChangePerUpdate";
            type: "u128";
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
            name: "descriptionUrl";
            type: "string";
          },
          {
            name: "slotEnqueued";
            type: "u64";
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
            name: "instruction";
            type: {
              defined: {
                name: "proposalInstruction";
              };
            };
          },
          {
            name: "passAmm";
            type: "pubkey";
          },
          {
            name: "failAmm";
            type: "pubkey";
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
            name: "passLpTokensLocked";
            type: "u64";
          },
          {
            name: "failLpTokensLocked";
            type: "u64";
          },
          {
            name: "nonce";
            docs: [
              "We need to include a per-proposer nonce to prevent some weird proposal",
              "front-running edge cases. Using a `u64` means that proposers are unlikely",
              "to run into collisions, even if they generate nonces randomly - I've run",
              "the math :D",
            ];
            type: "u64";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
        ];
      };
    },
  ];
};
