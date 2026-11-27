/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL was converted from the legacy format with `anchor idl convert` and lives in
 * the `.json` file next to this one.
 */
export type Launchpad = {
  address: "MooNyh4CBUYEKyXVnjGYQ8mEiJDpGvJMdvrZx1iGeHV";
  metadata: {
    name: "launchpad";
    version: "0.6.0";
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
          name: "launchAuthority";
          signer: true;
          optional: true;
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
          name: "baseMint";
          writable: true;
        },
        {
          name: "quoteMint";
        },
        {
          name: "daoOwnedLpPosition";
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
          name: "performancePackage";
          writable: true;
        },
        {
          name: "performancePackageTokenAccount";
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
              name: "futarchyProgram";
            },
            {
              name: "tokenMetadataProgram";
            },
            {
              name: "autocratEventAuthority";
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
              name: "priceBasedPerformancePackageProgram";
            },
            {
              name: "priceBasedPerformancePackageEventAuthority";
            },
          ];
        },
        {
          name: "meteoraAccounts";
          accounts: [
            {
              name: "dammV2Program";
            },
            {
              name: "config";
            },
            {
              name: "token2022Program";
            },
            {
              name: "positionNftAccount";
              writable: true;
            },
            {
              name: "pool";
              writable: true;
            },
            {
              name: "position";
              writable: true;
            },
            {
              name: "positionNftMint";
              writable: true;
            },
            {
              name: "baseMint";
            },
            {
              name: "quoteMint";
            },
            {
              name: "tokenAVault";
              writable: true;
            },
            {
              name: "tokenBVault";
              writable: true;
            },
            {
              name: "poolCreatorAuthority";
            },
            {
              name: "poolAuthority";
            },
            {
              name: "dammV2EventAuthority";
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
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "completeLaunchArgs";
            };
          };
        },
      ];
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
    {
      name: "closeLaunch";
      discriminator: [27, 216, 111, 223, 10, 230, 19, 211];
      accounts: [
        {
          name: "launch";
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
    {
      name: "launchCloseEvent";
      discriminator: [229, 71, 160, 47, 144, 13, 115, 12];
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
      msg: "For you to get a refund, either the launch needs to be in a refunding state or the launch must have been over-committed";
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
      msg: "Monthly spending limit must be less than 1/6th of the minimum raise amount and cannot be 0";
    },
    {
      code: 6012;
      name: "invalidMonthlySpendingLimitMembers";
      msg: "There can only be at most 10 monthly spending limit members";
    },
    {
      code: 6013;
      name: "invalidPriceBasedPremineAmount";
      msg: "Cannot do more than a 50% premine";
    },
    {
      code: 6014;
      name: "invalidPerformancePackageMinUnlockTime";
      msg: "Insiders must be forced to wait at least 18 months before unlocking their tokens";
    },
    {
      code: 6015;
      name: "launchAuthorityNotSet";
      msg: "Launch authority must be set to complete the launch until 2 days after closing";
    },
    {
      code: 6016;
      name: "finalRaiseAmountTooLow";
      msg: "The final amount raised must be greater than or equal to the minimum raise amount";
    },
    {
      code: 6017;
      name: "tokensAlreadyClaimed";
      msg: "Tokens already claimed";
    },
    {
      code: 6018;
      name: "moneyAlreadyRefunded";
      msg: "Money already refunded";
    },
    {
      code: 6019;
      name: "invariantViolated";
      msg: "An invariant was violated. You should get in contact with the MetaDAO team if you see this";
    },
    {
      code: 6020;
      name: "launchNotLive";
      msg: "Launch must be live to be closed";
    },
    {
      code: 6021;
      name: "invalidMinimumRaiseAmount";
      msg: "Minimum raise amount must be greater than or equal to $0.5 so that there's enough liquidity for the launch";
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
      name: "completeLaunchArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "finalRaiseAmount";
            type: {
              option: "u64";
            };
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
          {
            name: "performancePackageGrantee";
            type: "pubkey";
          },
          {
            name: "performancePackageTokenAmount";
            type: "u64";
          },
          {
            name: "monthsUntilInsidersCanUnlock";
            type: "u8";
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
            name: "closed";
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
            name: "isTokensClaimed";
            docs: ["Whether the tokens have been claimed."];
            type: "bool";
          },
          {
            name: "isUsdcRefunded";
            docs: ["Whether the USDC has been refunded."];
            type: "bool";
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
            type: {
              option: "i64";
            };
          },
          {
            name: "unixTimestampClosed";
            docs: [
              "The unix timestamp when the launch stopped taking new contributions.",
            ];
            type: {
              option: "i64";
            };
          },
          {
            name: "totalCommittedAmount";
            docs: ["The amount of USDC that has been committed by the users."];
            type: "u64";
          },
          {
            name: "finalRaiseAmount";
            docs: ["The final raise amount."];
            type: {
              option: "u64";
            };
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
          {
            name: "performancePackageGrantee";
            docs: [
              "The address that will receive the performance package tokens.",
            ];
            type: "pubkey";
          },
          {
            name: "performancePackageTokenAmount";
            docs: [
              "The amount of tokens to be granted to the performance package grantee.",
            ];
            type: "u64";
          },
          {
            name: "monthsUntilInsidersCanUnlock";
            docs: [
              "The number of months that insiders must wait before unlocking their tokens.",
            ];
            type: "u8";
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
    {
      name: "launchCloseEvent";
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
            name: "newState";
            type: {
              defined: {
                name: "launchState";
              };
            };
          },
        ];
      };
    },
  ];
};
