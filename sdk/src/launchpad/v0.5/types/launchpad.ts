/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL was converted from the legacy format with `anchor idl convert` and lives in
 * the `.json` file next to this one.
 */
export type Launchpad = {
  address: "mooNhciQJi1LqHDmse2JPic2NqG2PXCanbE3ZYzP3qA";
  metadata: {
    name: "launchpad";
    version: "0.5.0";
    spec: "0.1.0";
  };
  instructions: [
    {
      name: "initializeLaunch";
      discriminator: [90, 201, 220, 142, 112, 253, 100, 13];
      accounts: [
        {
          name: "launch";
          writable: true;
        },
        {
          name: "baseMint";
          writable: true;
        },
        {
          name: "tokenMetadata";
          writable: true;
        },
        {
          name: "launchSigner";
        },
        {
          name: "quoteVault";
          writable: true;
        },
        {
          name: "baseVault";
          writable: true;
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "launchAuthority";
        },
        {
          name: "quoteMint";
        },
        {
          name: "rent";
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
          name: "tokenMetadataProgram";
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
          name: "args";
          type: {
            defined: {
              name: "initializeLaunchArgs";
            };
          };
        },
      ];
    },
    {
      name: "startLaunch";
      discriminator: [205, 178, 36, 232, 95, 202, 241, 68];
      accounts: [
        {
          name: "launch";
          writable: true;
        },
        {
          name: "launchAuthority";
          signer: true;
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
      name: "fund";
      discriminator: [218, 188, 111, 221, 152, 113, 174, 7];
      accounts: [
        {
          name: "launch";
          writable: true;
        },
        {
          name: "fundingRecord";
          writable: true;
        },
        {
          name: "launchSigner";
        },
        {
          name: "launchQuoteVault";
          writable: true;
        },
        {
          name: "funder";
          signer: true;
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "funderQuoteAccount";
          writable: true;
        },
        {
          name: "tokenProgram";
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
          name: "amount";
          type: "u64";
        },
      ];
    },
    {
      name: "completeLaunch";
      discriminator: [118, 207, 250, 130, 44, 148, 251, 237];
      accounts: [
        {
          name: "launch";
          writable: true;
        },
        {
          name: "tokenMetadata";
          writable: true;
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "launchSigner";
          writable: true;
        },
        {
          name: "launchQuoteVault";
          writable: true;
        },
        {
          name: "launchBaseVault";
          writable: true;
        },
        {
          name: "treasuryQuoteAccount";
          writable: true;
        },
        {
          name: "treasuryLpAccount";
          writable: true;
        },
        {
          name: "poolState";
          writable: true;
        },
        {
          name: "baseMint";
          writable: true;
        },
        {
          name: "quoteMint";
        },
        {
          name: "lpMint";
          writable: true;
        },
        {
          name: "lpVault";
          writable: true;
        },
        {
          name: "poolTokenVault";
          writable: true;
        },
        {
          name: "poolUsdcVault";
          writable: true;
        },
        {
          name: "observationState";
          writable: true;
        },
        {
          name: "dao";
          writable: true;
        },
        {
          name: "squadsMultisig";
          writable: true;
        },
        {
          name: "squadsMultisigVault";
        },
        {
          name: "spendingLimit";
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
          name: "staticAccounts";
          accounts: [
            {
              name: "authority";
            },
            {
              name: "ammConfig";
              docs: [
                "Use the lowest fee pool, can see fees at https://api-v3.raydium.io/main/cpmm-config",
              ];
              writable: true;
            },
            {
              name: "createPoolFee";
              docs: ["create pool fee account"];
              writable: true;
            },
            {
              name: "cpSwapProgram";
            },
            {
              name: "autocratProgram";
            },
            {
              name: "tokenMetadataProgram";
            },
            {
              name: "autocratEventAuthority";
            },
            {
              name: "rent";
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
          ];
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
      name: "refund";
      discriminator: [2, 96, 183, 251, 63, 208, 46, 46];
      accounts: [
        {
          name: "launch";
          writable: true;
        },
        {
          name: "fundingRecord";
          writable: true;
        },
        {
          name: "launchQuoteVault";
          writable: true;
        },
        {
          name: "launchSigner";
        },
        {
          name: "funder";
          writable: true;
          signer: true;
        },
        {
          name: "funderQuoteAccount";
          writable: true;
        },
        {
          name: "tokenProgram";
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
      name: "claim";
      discriminator: [62, 198, 214, 193, 213, 159, 108, 210];
      accounts: [
        {
          name: "launch";
          writable: true;
        },
        {
          name: "fundingRecord";
          writable: true;
        },
        {
          name: "launchSigner";
        },
        {
          name: "baseMint";
          writable: true;
        },
        {
          name: "launchBaseVault";
          writable: true;
        },
        {
          name: "funder";
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "funderTokenAccount";
          writable: true;
        },
        {
          name: "tokenProgram";
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
  ];
  accounts: [
    {
      name: "fundingRecord";
      discriminator: [20, 34, 251, 238, 204, 117, 11, 67];
    },
    {
      name: "launch";
      discriminator: [144, 51, 51, 163, 206, 85, 213, 38];
    },
  ];
  events: [
    {
      name: "launchInitializedEvent";
      discriminator: [227, 109, 144, 20, 65, 239, 101, 176];
    },
    {
      name: "launchStartedEvent";
      discriminator: [187, 129, 95, 253, 255, 206, 36, 239];
    },
    {
      name: "launchFundedEvent";
      discriminator: [107, 1, 188, 175, 129, 59, 38, 79];
    },
    {
      name: "launchCompletedEvent";
      discriminator: [11, 31, 43, 56, 39, 157, 147, 101];
    },
    {
      name: "launchRefundedEvent";
      discriminator: [59, 128, 76, 161, 92, 17, 206, 130];
    },
    {
      name: "launchClaimEvent";
      discriminator: [185, 124, 167, 74, 161, 160, 106, 96];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "invalidAmount";
      msg: "Invalid amount";
    },
    {
      code: 6001;
      name: "supplyNonZero";
      msg: "Supply must be zero";
    },
    {
      code: 6002;
      name: "invalidSecondsForLaunch";
      msg: "Launch period must be between 1 hour and 2 weeks";
    },
    {
      code: 6003;
      name: "insufficientFunds";
      msg: "Insufficient funds";
    },
    {
      code: 6004;
      name: "invalidTokenKey";
      msg: "Token mint key must end in 'meta'";
    },
    {
      code: 6005;
      name: "invalidLaunchState";
      msg: "Invalid launch state";
    },
    {
      code: 6006;
      name: "launchPeriodNotOver";
      msg: "Launch period not over";
    },
    {
      code: 6007;
      name: "launchExpired";
      msg: "Launch is complete, no more funding allowed";
    },
    {
      code: 6008;
      name: "launchNotRefunding";
      msg: "Launch needs to be in refunding state to get a refund";
    },
    {
      code: 6009;
      name: "launchNotInitialized";
      msg: "Launch must be initialized to be started";
    },
    {
      code: 6010;
      name: "freezeAuthoritySet";
      msg: "Freeze authority can't be set on launchpad tokens";
    },
    {
      code: 6011;
      name: "invalidMonthlySpendingLimit";
      msg: "Monthly spending limit must be less than 1/6th of the minimum raise amount";
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
            name: "launchSeqNum";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "initializeLaunchArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "minimumRaiseAmount";
            type: "u64";
          },
          {
            name: "monthlySpendingLimitAmount";
            type: "u64";
          },
          {
            name: "monthlySpendingLimitMembers";
            type: {
              vec: "pubkey";
            };
          },
          {
            name: "secondsForLaunch";
            type: "u32";
          },
          {
            name: "tokenName";
            type: "string";
          },
          {
            name: "tokenSymbol";
            type: "string";
          },
          {
            name: "tokenUri";
            type: "string";
          },
        ];
      };
    },
    {
      name: "launchState";
      type: {
        kind: "enum";
        variants: [
          {
            name: "initialized";
          },
          {
            name: "live";
          },
          {
            name: "complete";
          },
          {
            name: "refunding";
          },
        ];
      };
    },
    {
      name: "fundingRecord";
      type: {
        kind: "struct";
        fields: [
          {
            name: "pdaBump";
            docs: ["The PDA bump."];
            type: "u8";
          },
          {
            name: "funder";
            docs: ["The funder."];
            type: "pubkey";
          },
          {
            name: "launch";
            docs: ["The launch."];
            type: "pubkey";
          },
          {
            name: "committedAmount";
            docs: ["The amount of USDC that has been committed by the funder."];
            type: "u64";
          },
          {
            name: "seqNum";
            docs: [
              "The sequence number of this funding record. Useful for sorting events.",
            ];
            type: "u64";
          },
        ];
      };
    },
    {
      name: "launch";
      type: {
        kind: "struct";
        fields: [
          {
            name: "pdaBump";
            docs: ["The PDA bump."];
            type: "u8";
          },
          {
            name: "minimumRaiseAmount";
            docs: [
              "The minimum amount of USDC that must be raised, otherwise",
              "everyone can get their USDC back.",
            ];
            type: "u64";
          },
          {
            name: "monthlySpendingLimitAmount";
            docs: [
              "The monthly spending limit the DAO allocates to the team. Must be",
              "less than 1/6th of the minimum raise amount (so 6 months of burn).",
            ];
            type: "u64";
          },
          {
            name: "monthlySpendingLimitMembers";
            docs: [
              "The wallets that have access to the monthly spending limit.",
            ];
            type: {
              vec: "pubkey";
            };
          },
          {
            name: "launchAuthority";
            docs: ["The account that can start the launch."];
            type: "pubkey";
          },
          {
            name: "launchSigner";
            docs: [
              "The launch signer address. Needed because Raydium pools need a SOL payer and this PDA can't hold SOL.",
            ];
            type: "pubkey";
          },
          {
            name: "launchSignerPdaBump";
            docs: ["The PDA bump for the launch signer."];
            type: "u8";
          },
          {
            name: "launchQuoteVault";
            docs: [
              "The USDC vault that will hold the USDC raised until the launch is over.",
            ];
            type: "pubkey";
          },
          {
            name: "launchBaseVault";
            docs: ["The token vault, used to send tokens to Raydium."];
            type: "pubkey";
          },
          {
            name: "baseMint";
            docs: [
              "The token that will be minted to funders and that will control the DAO.",
            ];
            type: "pubkey";
          },
          {
            name: "quoteMint";
            docs: ["The USDC mint."];
            type: "pubkey";
          },
          {
            name: "unixTimestampStarted";
            docs: ["The unix timestamp when the launch was started."];
            type: "i64";
          },
          {
            name: "totalCommittedAmount";
            docs: ["The amount of USDC that has been committed by the users."];
            type: "u64";
          },
          {
            name: "state";
            docs: ["The state of the launch."];
            type: {
              defined: {
                name: "launchState";
              };
            };
          },
          {
            name: "seqNum";
            docs: [
              "The sequence number of this launch. Useful for sorting events.",
            ];
            type: "u64";
          },
          {
            name: "secondsForLaunch";
            docs: ["The number of seconds that the launch will be live for."];
            type: "u32";
          },
          {
            name: "dao";
            docs: ["The DAO, if the launch is complete."];
            type: {
              option: "pubkey";
            };
          },
          {
            name: "daoVault";
            docs: [
              "The DAO treasury that USDC / LP is sent to, if the launch is complete.",
            ];
            type: {
              option: "pubkey";
            };
          },
        ];
      };
    },
    {
      name: "launchInitializedEvent";
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
            name: "launch";
            type: "pubkey";
          },
          {
            name: "minimumRaiseAmount";
            type: "u64";
          },
          {
            name: "launchAuthority";
            type: "pubkey";
          },
          {
            name: "launchSigner";
            type: "pubkey";
          },
          {
            name: "launchSignerPdaBump";
            type: "u8";
          },
          {
            name: "launchUsdcVault";
            type: "pubkey";
          },
          {
            name: "launchTokenVault";
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
            name: "pdaBump";
            type: "u8";
          },
          {
            name: "secondsForLaunch";
            type: "u32";
          },
        ];
      };
    },
    {
      name: "launchStartedEvent";
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
            name: "launch";
            type: "pubkey";
          },
          {
            name: "launchAuthority";
            type: "pubkey";
          },
          {
            name: "slotStarted";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "launchFundedEvent";
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
            name: "fundingRecord";
            type: "pubkey";
          },
          {
            name: "launch";
            type: "pubkey";
          },
          {
            name: "funder";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "totalCommittedByFunder";
            type: "u64";
          },
          {
            name: "totalCommitted";
            type: "u64";
          },
          {
            name: "fundingRecordSeqNum";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "launchCompletedEvent";
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
            name: "launch";
            type: "pubkey";
          },
          {
            name: "finalState";
            type: {
              defined: {
                name: "launchState";
              };
            };
          },
          {
            name: "totalCommitted";
            type: "u64";
          },
          {
            name: "dao";
            type: {
              option: "pubkey";
            };
          },
          {
            name: "daoTreasury";
            type: {
              option: "pubkey";
            };
          },
        ];
      };
    },
    {
      name: "launchRefundedEvent";
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
            name: "launch";
            type: "pubkey";
          },
          {
            name: "funder";
            type: "pubkey";
          },
          {
            name: "usdcRefunded";
            type: "u64";
          },
          {
            name: "fundingRecord";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "launchClaimEvent";
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
            name: "launch";
            type: "pubkey";
          },
          {
            name: "funder";
            type: "pubkey";
          },
          {
            name: "tokensClaimed";
            type: "u64";
          },
          {
            name: "fundingRecord";
            type: "pubkey";
          },
        ];
      };
    },
  ];
};
