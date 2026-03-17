export type Launchpad = {
  version: "0.6.1";
  name: "launchpad";
  instructions: [
    {
      name: "initializeLaunch";
      accounts: [
        {
          name: "launch";
          isMut: true;
          isSigner: false;
        },
        {
          name: "baseMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenMetadata";
          isMut: true;
          isSigner: false;
        },
        {
          name: "launchSigner";
          isMut: false;
          isSigner: false;
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
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "launchAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "quoteMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
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
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenMetadataProgram";
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
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "InitializeLaunchArgs";
          };
        },
      ];
    },
    {
      name: "startLaunch";
      accounts: [
        {
          name: "launch";
          isMut: true;
          isSigner: false;
        },
        {
          name: "launchAuthority";
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
        },
      ];
      args: [];
    },
    {
      name: "fund";
      accounts: [
        {
          name: "launch";
          isMut: true;
          isSigner: false;
        },
        {
          name: "fundingRecord";
          isMut: true;
          isSigner: false;
        },
        {
          name: "launchQuoteVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "funder";
          isMut: false;
          isSigner: true;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "funderQuoteAccount";
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
      accounts: [
        {
          name: "launch";
          isMut: true;
          isSigner: false;
        },
        {
          name: "launchAuthority";
          isMut: false;
          isSigner: true;
          isOptional: true;
        },
        {
          name: "tokenMetadata";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "launchSigner";
          isMut: true;
          isSigner: false;
        },
        {
          name: "launchQuoteVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "launchBaseVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "treasuryQuoteAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "baseMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "quoteMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "daoOwnedLpPosition";
          isMut: true;
          isSigner: false;
        },
        {
          name: "futarchyAmmBaseVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "futarchyAmmQuoteVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "dao";
          isMut: true;
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
          name: "spendingLimit";
          isMut: true;
          isSigner: false;
        },
        {
          name: "performancePackage";
          isMut: true;
          isSigner: false;
        },
        {
          name: "performancePackageTokenAccount";
          isMut: true;
          isSigner: false;
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
          name: "staticAccounts";
          accounts: [
            {
              name: "futarchyProgram";
              isMut: false;
              isSigner: false;
            },
            {
              name: "tokenMetadataProgram";
              isMut: false;
              isSigner: false;
            },
            {
              name: "autocratEventAuthority";
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
              name: "priceBasedPerformancePackageProgram";
              isMut: false;
              isSigner: false;
            },
            {
              name: "priceBasedPerformancePackageEventAuthority";
              isMut: false;
              isSigner: false;
            },
          ];
        },
        {
          name: "meteoraAccounts";
          accounts: [
            {
              name: "dammV2Program";
              isMut: false;
              isSigner: false;
            },
            {
              name: "config";
              isMut: false;
              isSigner: false;
            },
            {
              name: "token2022Program";
              isMut: false;
              isSigner: false;
            },
            {
              name: "positionNftAccount";
              isMut: true;
              isSigner: false;
            },
            {
              name: "pool";
              isMut: true;
              isSigner: false;
            },
            {
              name: "position";
              isMut: true;
              isSigner: false;
            },
            {
              name: "positionNftMint";
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
              name: "tokenAVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "tokenBVault";
              isMut: true;
              isSigner: false;
            },
            {
              name: "poolCreatorAuthority";
              isMut: false;
              isSigner: false;
            },
            {
              name: "poolAuthority";
              isMut: false;
              isSigner: false;
            },
            {
              name: "dammV2EventAuthority";
              isMut: false;
              isSigner: false;
            },
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
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "CompleteLaunchArgs";
          };
        },
      ];
    },
    {
      name: "refund";
      accounts: [
        {
          name: "launch";
          isMut: true;
          isSigner: false;
        },
        {
          name: "fundingRecord";
          isMut: true;
          isSigner: false;
        },
        {
          name: "launchQuoteVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "launchSigner";
          isMut: false;
          isSigner: false;
        },
        {
          name: "funder";
          isMut: false;
          isSigner: false;
        },
        {
          name: "funderQuoteAccount";
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
        },
      ];
      args: [];
    },
    {
      name: "claim";
      accounts: [
        {
          name: "launch";
          isMut: true;
          isSigner: false;
        },
        {
          name: "fundingRecord";
          isMut: true;
          isSigner: false;
        },
        {
          name: "launchSigner";
          isMut: false;
          isSigner: false;
        },
        {
          name: "baseMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "launchBaseVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "funder";
          isMut: false;
          isSigner: false;
        },
        {
          name: "funderTokenAccount";
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
        },
      ];
      args: [];
    },
    {
      name: "closeLaunch";
      accounts: [
        {
          name: "launch";
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
        },
      ];
      args: [];
    },
    {
      name: "returnFunds";
      accounts: [
        {
          name: "admin";
          isMut: false;
          isSigner: true;
        },
        {
          name: "launch";
          isMut: true;
          isSigner: false;
        },
        {
          name: "launchQuoteVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "launchSigner";
          isMut: false;
          isSigner: false;
        },
        {
          name: "recipient";
          isMut: false;
          isSigner: false;
        },
        {
          name: "recipientQuoteAccount";
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
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "ReturnFundsArgs";
          };
        },
      ];
    },
  ];
  accounts: [
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
            type: "publicKey";
          },
          {
            name: "launch";
            docs: ["The launch."];
            type: "publicKey";
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
              vec: "publicKey";
            };
          },
          {
            name: "launchAuthority";
            docs: ["The account that can start the launch."];
            type: "publicKey";
          },
          {
            name: "launchSigner";
            docs: [
              "The launch signer address. Needed because Raydium pools need a SOL payer and this PDA can't hold SOL.",
            ];
            type: "publicKey";
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
            type: "publicKey";
          },
          {
            name: "launchBaseVault";
            docs: ["The token vault, used to send tokens to Raydium."];
            type: "publicKey";
          },
          {
            name: "baseMint";
            docs: [
              "The token that will be minted to funders and that will control the DAO.",
            ];
            type: "publicKey";
          },
          {
            name: "quoteMint";
            docs: ["The USDC mint."];
            type: "publicKey";
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
              defined: "LaunchState";
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
              option: "publicKey";
            };
          },
          {
            name: "daoVault";
            docs: [
              "The DAO treasury that USDC / LP is sent to, if the launch is complete.",
            ];
            type: {
              option: "publicKey";
            };
          },
          {
            name: "performancePackageGrantee";
            docs: [
              "The address that will receive the performance package tokens.",
            ];
            type: "publicKey";
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
          {
            name: "teamAddress";
            docs: ["The initial address used to sponsor team proposals."];
            type: "publicKey";
          },
        ];
      };
    },
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
          },
          {
            name: "launchSeqNum";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "CompleteLaunchArgs";
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
      name: "InitializeLaunchArgs";
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
              vec: "publicKey";
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
            type: "publicKey";
          },
          {
            name: "performancePackageTokenAmount";
            type: "u64";
          },
          {
            name: "monthsUntilInsidersCanUnlock";
            type: "u8";
          },
          {
            name: "teamAddress";
            type: "publicKey";
          },
        ];
      };
    },
    {
      name: "ReturnFundsArgs";
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
      name: "LaunchState";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Initialized";
          },
          {
            name: "Live";
          },
          {
            name: "Closed";
          },
          {
            name: "Complete";
          },
          {
            name: "Refunding";
          },
        ];
      };
    },
  ];
  events: [
    {
      name: "LaunchInitializedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "launch";
          type: "publicKey";
          index: false;
        },
        {
          name: "minimumRaiseAmount";
          type: "u64";
          index: false;
        },
        {
          name: "launchAuthority";
          type: "publicKey";
          index: false;
        },
        {
          name: "launchSigner";
          type: "publicKey";
          index: false;
        },
        {
          name: "launchSignerPdaBump";
          type: "u8";
          index: false;
        },
        {
          name: "launchUsdcVault";
          type: "publicKey";
          index: false;
        },
        {
          name: "launchTokenVault";
          type: "publicKey";
          index: false;
        },
        {
          name: "performancePackageGrantee";
          type: "publicKey";
          index: false;
        },
        {
          name: "performancePackageTokenAmount";
          type: "u64";
          index: false;
        },
        {
          name: "monthsUntilInsidersCanUnlock";
          type: "u8";
          index: false;
        },
        {
          name: "monthlySpendingLimitAmount";
          type: "u64";
          index: false;
        },
        {
          name: "monthlySpendingLimitMembers";
          type: {
            vec: "publicKey";
          };
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
          name: "pdaBump";
          type: "u8";
          index: false;
        },
        {
          name: "secondsForLaunch";
          type: "u32";
          index: false;
        },
      ];
    },
    {
      name: "LaunchStartedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "launch";
          type: "publicKey";
          index: false;
        },
        {
          name: "launchAuthority";
          type: "publicKey";
          index: false;
        },
        {
          name: "slotStarted";
          type: "u64";
          index: false;
        },
      ];
    },
    {
      name: "LaunchFundedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "fundingRecord";
          type: "publicKey";
          index: false;
        },
        {
          name: "launch";
          type: "publicKey";
          index: false;
        },
        {
          name: "funder";
          type: "publicKey";
          index: false;
        },
        {
          name: "amount";
          type: "u64";
          index: false;
        },
        {
          name: "totalCommittedByFunder";
          type: "u64";
          index: false;
        },
        {
          name: "totalCommitted";
          type: "u64";
          index: false;
        },
      ];
    },
    {
      name: "LaunchCompletedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "launch";
          type: "publicKey";
          index: false;
        },
        {
          name: "finalState";
          type: {
            defined: "LaunchState";
          };
          index: false;
        },
        {
          name: "totalCommitted";
          type: "u64";
          index: false;
        },
        {
          name: "dao";
          type: {
            option: "publicKey";
          };
          index: false;
        },
        {
          name: "daoTreasury";
          type: {
            option: "publicKey";
          };
          index: false;
        },
        {
          name: "finalRaiseAmount";
          type: {
            option: "u64";
          };
          index: false;
        },
      ];
    },
    {
      name: "LaunchRefundedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "launch";
          type: "publicKey";
          index: false;
        },
        {
          name: "funder";
          type: "publicKey";
          index: false;
        },
        {
          name: "usdcRefunded";
          type: "u64";
          index: false;
        },
        {
          name: "fundingRecord";
          type: "publicKey";
          index: false;
        },
      ];
    },
    {
      name: "LaunchClaimEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "launch";
          type: "publicKey";
          index: false;
        },
        {
          name: "funder";
          type: "publicKey";
          index: false;
        },
        {
          name: "tokensClaimed";
          type: "u64";
          index: false;
        },
        {
          name: "fundingRecord";
          type: "publicKey";
          index: false;
        },
      ];
    },
    {
      name: "LaunchCloseEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "launch";
          type: "publicKey";
          index: false;
        },
        {
          name: "newState";
          type: {
            defined: "LaunchState";
          };
          index: false;
        },
      ];
    },
    {
      name: "LaunchFundsReturnedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "launch";
          type: "publicKey";
          index: false;
        },
        {
          name: "recipient";
          type: "publicKey";
          index: false;
        },
        {
          name: "usdcReturned";
          type: "u64";
          index: false;
        },
      ];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "InvalidAmount";
      msg: "Invalid amount";
    },
    {
      code: 6001;
      name: "SupplyNonZero";
      msg: "Supply must be zero";
    },
    {
      code: 6002;
      name: "InvalidSecondsForLaunch";
      msg: "Launch period must be between 1 hour and 2 weeks";
    },
    {
      code: 6003;
      name: "InsufficientFunds";
      msg: "Insufficient funds";
    },
    {
      code: 6004;
      name: "InvalidTokenKey";
      msg: "Token mint key must end in 'meta'";
    },
    {
      code: 6005;
      name: "InvalidLaunchState";
      msg: "Invalid launch state";
    },
    {
      code: 6006;
      name: "LaunchPeriodNotOver";
      msg: "Launch period not over";
    },
    {
      code: 6007;
      name: "LaunchExpired";
      msg: "Launch is complete, no more funding allowed";
    },
    {
      code: 6008;
      name: "LaunchNotRefunding";
      msg: "For you to get a refund, either the launch needs to be in a refunding state or the launch must have been over-committed";
    },
    {
      code: 6009;
      name: "LaunchNotInitialized";
      msg: "Launch must be initialized to be started";
    },
    {
      code: 6010;
      name: "FreezeAuthoritySet";
      msg: "Freeze authority can't be set on launchpad tokens";
    },
    {
      code: 6011;
      name: "InvalidMonthlySpendingLimit";
      msg: "Monthly spending limit must be less than 1/6th of the minimum raise amount and cannot be 0";
    },
    {
      code: 6012;
      name: "InvalidMonthlySpendingLimitMembers";
      msg: "There can only be at most 10 monthly spending limit members";
    },
    {
      code: 6013;
      name: "InvalidPriceBasedPremineAmount";
      msg: "Cannot do more than a 50% premine, minimum is 10 atoms of token";
    },
    {
      code: 6014;
      name: "InvalidPerformancePackageMinUnlockTime";
      msg: "Insiders must be forced to wait at least 18 months before unlocking their tokens";
    },
    {
      code: 6015;
      name: "LaunchAuthorityNotSet";
      msg: "Launch authority must be set to complete the launch until 2 days after closing";
    },
    {
      code: 6016;
      name: "FinalRaiseAmountTooLow";
      msg: "The final amount raised must be greater than or equal to the minimum raise amount";
    },
    {
      code: 6017;
      name: "TokensAlreadyClaimed";
      msg: "Tokens already claimed";
    },
    {
      code: 6018;
      name: "MoneyAlreadyRefunded";
      msg: "Money already refunded";
    },
    {
      code: 6019;
      name: "InvariantViolated";
      msg: "An invariant was violated. You should get in contact with the MetaDAO team if you see this";
    },
    {
      code: 6020;
      name: "LaunchNotLive";
      msg: "Launch must be live to be closed";
    },
    {
      code: 6021;
      name: "InvalidMinimumRaiseAmount";
      msg: "Minimum raise amount must be greater than or equal to $0.5 so that there's enough liquidity for the launch";
    },
    {
      code: 6022;
      name: "InvalidAdmin";
      msg: "Invalid admin";
    },
  ];
};

export const IDL: Launchpad = {
  version: "0.6.1",
  name: "launchpad",
  instructions: [
    {
      name: "initializeLaunch",
      accounts: [
        {
          name: "launch",
          isMut: true,
          isSigner: false,
        },
        {
          name: "baseMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenMetadata",
          isMut: true,
          isSigner: false,
        },
        {
          name: "launchSigner",
          isMut: false,
          isSigner: false,
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
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "launchAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "quoteMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
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
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenMetadataProgram",
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
            defined: "InitializeLaunchArgs",
          },
        },
      ],
    },
    {
      name: "startLaunch",
      accounts: [
        {
          name: "launch",
          isMut: true,
          isSigner: false,
        },
        {
          name: "launchAuthority",
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
      args: [],
    },
    {
      name: "fund",
      accounts: [
        {
          name: "launch",
          isMut: true,
          isSigner: false,
        },
        {
          name: "fundingRecord",
          isMut: true,
          isSigner: false,
        },
        {
          name: "launchQuoteVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "funder",
          isMut: false,
          isSigner: true,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "funderQuoteAccount",
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
          name: "amount",
          type: "u64",
        },
      ],
    },
    {
      name: "completeLaunch",
      accounts: [
        {
          name: "launch",
          isMut: true,
          isSigner: false,
        },
        {
          name: "launchAuthority",
          isMut: false,
          isSigner: true,
          isOptional: true,
        },
        {
          name: "tokenMetadata",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "launchSigner",
          isMut: true,
          isSigner: false,
        },
        {
          name: "launchQuoteVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "launchBaseVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "treasuryQuoteAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "baseMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "quoteMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "daoOwnedLpPosition",
          isMut: true,
          isSigner: false,
        },
        {
          name: "futarchyAmmBaseVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "futarchyAmmQuoteVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "dao",
          isMut: true,
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
          name: "spendingLimit",
          isMut: true,
          isSigner: false,
        },
        {
          name: "performancePackage",
          isMut: true,
          isSigner: false,
        },
        {
          name: "performancePackageTokenAccount",
          isMut: true,
          isSigner: false,
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
          name: "staticAccounts",
          accounts: [
            {
              name: "futarchyProgram",
              isMut: false,
              isSigner: false,
            },
            {
              name: "tokenMetadataProgram",
              isMut: false,
              isSigner: false,
            },
            {
              name: "autocratEventAuthority",
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
              name: "priceBasedPerformancePackageProgram",
              isMut: false,
              isSigner: false,
            },
            {
              name: "priceBasedPerformancePackageEventAuthority",
              isMut: false,
              isSigner: false,
            },
          ],
        },
        {
          name: "meteoraAccounts",
          accounts: [
            {
              name: "dammV2Program",
              isMut: false,
              isSigner: false,
            },
            {
              name: "config",
              isMut: false,
              isSigner: false,
            },
            {
              name: "token2022Program",
              isMut: false,
              isSigner: false,
            },
            {
              name: "positionNftAccount",
              isMut: true,
              isSigner: false,
            },
            {
              name: "pool",
              isMut: true,
              isSigner: false,
            },
            {
              name: "position",
              isMut: true,
              isSigner: false,
            },
            {
              name: "positionNftMint",
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
              name: "tokenAVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "tokenBVault",
              isMut: true,
              isSigner: false,
            },
            {
              name: "poolCreatorAuthority",
              isMut: false,
              isSigner: false,
            },
            {
              name: "poolAuthority",
              isMut: false,
              isSigner: false,
            },
            {
              name: "dammV2EventAuthority",
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
          name: "args",
          type: {
            defined: "CompleteLaunchArgs",
          },
        },
      ],
    },
    {
      name: "refund",
      accounts: [
        {
          name: "launch",
          isMut: true,
          isSigner: false,
        },
        {
          name: "fundingRecord",
          isMut: true,
          isSigner: false,
        },
        {
          name: "launchQuoteVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "launchSigner",
          isMut: false,
          isSigner: false,
        },
        {
          name: "funder",
          isMut: false,
          isSigner: false,
        },
        {
          name: "funderQuoteAccount",
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
      args: [],
    },
    {
      name: "claim",
      accounts: [
        {
          name: "launch",
          isMut: true,
          isSigner: false,
        },
        {
          name: "fundingRecord",
          isMut: true,
          isSigner: false,
        },
        {
          name: "launchSigner",
          isMut: false,
          isSigner: false,
        },
        {
          name: "baseMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "launchBaseVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "funder",
          isMut: false,
          isSigner: false,
        },
        {
          name: "funderTokenAccount",
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
      args: [],
    },
    {
      name: "closeLaunch",
      accounts: [
        {
          name: "launch",
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
      name: "returnFunds",
      accounts: [
        {
          name: "admin",
          isMut: false,
          isSigner: true,
        },
        {
          name: "launch",
          isMut: true,
          isSigner: false,
        },
        {
          name: "launchQuoteVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "launchSigner",
          isMut: false,
          isSigner: false,
        },
        {
          name: "recipient",
          isMut: false,
          isSigner: false,
        },
        {
          name: "recipientQuoteAccount",
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
          name: "args",
          type: {
            defined: "ReturnFundsArgs",
          },
        },
      ],
    },
  ],
  accounts: [
    {
      name: "fundingRecord",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pdaBump",
            docs: ["The PDA bump."],
            type: "u8",
          },
          {
            name: "funder",
            docs: ["The funder."],
            type: "publicKey",
          },
          {
            name: "launch",
            docs: ["The launch."],
            type: "publicKey",
          },
          {
            name: "committedAmount",
            docs: ["The amount of USDC that has been committed by the funder."],
            type: "u64",
          },
          {
            name: "isTokensClaimed",
            docs: ["Whether the tokens have been claimed."],
            type: "bool",
          },
          {
            name: "isUsdcRefunded",
            docs: ["Whether the USDC has been refunded."],
            type: "bool",
          },
        ],
      },
    },
    {
      name: "launch",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pdaBump",
            docs: ["The PDA bump."],
            type: "u8",
          },
          {
            name: "minimumRaiseAmount",
            docs: [
              "The minimum amount of USDC that must be raised, otherwise",
              "everyone can get their USDC back.",
            ],
            type: "u64",
          },
          {
            name: "monthlySpendingLimitAmount",
            docs: [
              "The monthly spending limit the DAO allocates to the team. Must be",
              "less than 1/6th of the minimum raise amount (so 6 months of burn).",
            ],
            type: "u64",
          },
          {
            name: "monthlySpendingLimitMembers",
            docs: [
              "The wallets that have access to the monthly spending limit.",
            ],
            type: {
              vec: "publicKey",
            },
          },
          {
            name: "launchAuthority",
            docs: ["The account that can start the launch."],
            type: "publicKey",
          },
          {
            name: "launchSigner",
            docs: [
              "The launch signer address. Needed because Raydium pools need a SOL payer and this PDA can't hold SOL.",
            ],
            type: "publicKey",
          },
          {
            name: "launchSignerPdaBump",
            docs: ["The PDA bump for the launch signer."],
            type: "u8",
          },
          {
            name: "launchQuoteVault",
            docs: [
              "The USDC vault that will hold the USDC raised until the launch is over.",
            ],
            type: "publicKey",
          },
          {
            name: "launchBaseVault",
            docs: ["The token vault, used to send tokens to Raydium."],
            type: "publicKey",
          },
          {
            name: "baseMint",
            docs: [
              "The token that will be minted to funders and that will control the DAO.",
            ],
            type: "publicKey",
          },
          {
            name: "quoteMint",
            docs: ["The USDC mint."],
            type: "publicKey",
          },
          {
            name: "unixTimestampStarted",
            docs: ["The unix timestamp when the launch was started."],
            type: {
              option: "i64",
            },
          },
          {
            name: "unixTimestampClosed",
            docs: [
              "The unix timestamp when the launch stopped taking new contributions.",
            ],
            type: {
              option: "i64",
            },
          },
          {
            name: "totalCommittedAmount",
            docs: ["The amount of USDC that has been committed by the users."],
            type: "u64",
          },
          {
            name: "finalRaiseAmount",
            docs: ["The final raise amount."],
            type: {
              option: "u64",
            },
          },
          {
            name: "state",
            docs: ["The state of the launch."],
            type: {
              defined: "LaunchState",
            },
          },
          {
            name: "seqNum",
            docs: [
              "The sequence number of this launch. Useful for sorting events.",
            ],
            type: "u64",
          },
          {
            name: "secondsForLaunch",
            docs: ["The number of seconds that the launch will be live for."],
            type: "u32",
          },
          {
            name: "dao",
            docs: ["The DAO, if the launch is complete."],
            type: {
              option: "publicKey",
            },
          },
          {
            name: "daoVault",
            docs: [
              "The DAO treasury that USDC / LP is sent to, if the launch is complete.",
            ],
            type: {
              option: "publicKey",
            },
          },
          {
            name: "performancePackageGrantee",
            docs: [
              "The address that will receive the performance package tokens.",
            ],
            type: "publicKey",
          },
          {
            name: "performancePackageTokenAmount",
            docs: [
              "The amount of tokens to be granted to the performance package grantee.",
            ],
            type: "u64",
          },
          {
            name: "monthsUntilInsidersCanUnlock",
            docs: [
              "The number of months that insiders must wait before unlocking their tokens.",
            ],
            type: "u8",
          },
          {
            name: "teamAddress",
            docs: ["The initial address used to sponsor team proposals."],
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
          {
            name: "launchSeqNum",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "CompleteLaunchArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "finalRaiseAmount",
            type: {
              option: "u64",
            },
          },
        ],
      },
    },
    {
      name: "InitializeLaunchArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "minimumRaiseAmount",
            type: "u64",
          },
          {
            name: "monthlySpendingLimitAmount",
            type: "u64",
          },
          {
            name: "monthlySpendingLimitMembers",
            type: {
              vec: "publicKey",
            },
          },
          {
            name: "secondsForLaunch",
            type: "u32",
          },
          {
            name: "tokenName",
            type: "string",
          },
          {
            name: "tokenSymbol",
            type: "string",
          },
          {
            name: "tokenUri",
            type: "string",
          },
          {
            name: "performancePackageGrantee",
            type: "publicKey",
          },
          {
            name: "performancePackageTokenAmount",
            type: "u64",
          },
          {
            name: "monthsUntilInsidersCanUnlock",
            type: "u8",
          },
          {
            name: "teamAddress",
            type: "publicKey",
          },
        ],
      },
    },
    {
      name: "ReturnFundsArgs",
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
      name: "LaunchState",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Initialized",
          },
          {
            name: "Live",
          },
          {
            name: "Closed",
          },
          {
            name: "Complete",
          },
          {
            name: "Refunding",
          },
        ],
      },
    },
  ],
  events: [
    {
      name: "LaunchInitializedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "launch",
          type: "publicKey",
          index: false,
        },
        {
          name: "minimumRaiseAmount",
          type: "u64",
          index: false,
        },
        {
          name: "launchAuthority",
          type: "publicKey",
          index: false,
        },
        {
          name: "launchSigner",
          type: "publicKey",
          index: false,
        },
        {
          name: "launchSignerPdaBump",
          type: "u8",
          index: false,
        },
        {
          name: "launchUsdcVault",
          type: "publicKey",
          index: false,
        },
        {
          name: "launchTokenVault",
          type: "publicKey",
          index: false,
        },
        {
          name: "performancePackageGrantee",
          type: "publicKey",
          index: false,
        },
        {
          name: "performancePackageTokenAmount",
          type: "u64",
          index: false,
        },
        {
          name: "monthsUntilInsidersCanUnlock",
          type: "u8",
          index: false,
        },
        {
          name: "monthlySpendingLimitAmount",
          type: "u64",
          index: false,
        },
        {
          name: "monthlySpendingLimitMembers",
          type: {
            vec: "publicKey",
          },
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
          name: "pdaBump",
          type: "u8",
          index: false,
        },
        {
          name: "secondsForLaunch",
          type: "u32",
          index: false,
        },
      ],
    },
    {
      name: "LaunchStartedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "launch",
          type: "publicKey",
          index: false,
        },
        {
          name: "launchAuthority",
          type: "publicKey",
          index: false,
        },
        {
          name: "slotStarted",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "LaunchFundedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "fundingRecord",
          type: "publicKey",
          index: false,
        },
        {
          name: "launch",
          type: "publicKey",
          index: false,
        },
        {
          name: "funder",
          type: "publicKey",
          index: false,
        },
        {
          name: "amount",
          type: "u64",
          index: false,
        },
        {
          name: "totalCommittedByFunder",
          type: "u64",
          index: false,
        },
        {
          name: "totalCommitted",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "LaunchCompletedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "launch",
          type: "publicKey",
          index: false,
        },
        {
          name: "finalState",
          type: {
            defined: "LaunchState",
          },
          index: false,
        },
        {
          name: "totalCommitted",
          type: "u64",
          index: false,
        },
        {
          name: "dao",
          type: {
            option: "publicKey",
          },
          index: false,
        },
        {
          name: "daoTreasury",
          type: {
            option: "publicKey",
          },
          index: false,
        },
        {
          name: "finalRaiseAmount",
          type: {
            option: "u64",
          },
          index: false,
        },
      ],
    },
    {
      name: "LaunchRefundedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "launch",
          type: "publicKey",
          index: false,
        },
        {
          name: "funder",
          type: "publicKey",
          index: false,
        },
        {
          name: "usdcRefunded",
          type: "u64",
          index: false,
        },
        {
          name: "fundingRecord",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "LaunchClaimEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "launch",
          type: "publicKey",
          index: false,
        },
        {
          name: "funder",
          type: "publicKey",
          index: false,
        },
        {
          name: "tokensClaimed",
          type: "u64",
          index: false,
        },
        {
          name: "fundingRecord",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "LaunchCloseEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "launch",
          type: "publicKey",
          index: false,
        },
        {
          name: "newState",
          type: {
            defined: "LaunchState",
          },
          index: false,
        },
      ],
    },
    {
      name: "LaunchFundsReturnedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "launch",
          type: "publicKey",
          index: false,
        },
        {
          name: "recipient",
          type: "publicKey",
          index: false,
        },
        {
          name: "usdcReturned",
          type: "u64",
          index: false,
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "InvalidAmount",
      msg: "Invalid amount",
    },
    {
      code: 6001,
      name: "SupplyNonZero",
      msg: "Supply must be zero",
    },
    {
      code: 6002,
      name: "InvalidSecondsForLaunch",
      msg: "Launch period must be between 1 hour and 2 weeks",
    },
    {
      code: 6003,
      name: "InsufficientFunds",
      msg: "Insufficient funds",
    },
    {
      code: 6004,
      name: "InvalidTokenKey",
      msg: "Token mint key must end in 'meta'",
    },
    {
      code: 6005,
      name: "InvalidLaunchState",
      msg: "Invalid launch state",
    },
    {
      code: 6006,
      name: "LaunchPeriodNotOver",
      msg: "Launch period not over",
    },
    {
      code: 6007,
      name: "LaunchExpired",
      msg: "Launch is complete, no more funding allowed",
    },
    {
      code: 6008,
      name: "LaunchNotRefunding",
      msg: "For you to get a refund, either the launch needs to be in a refunding state or the launch must have been over-committed",
    },
    {
      code: 6009,
      name: "LaunchNotInitialized",
      msg: "Launch must be initialized to be started",
    },
    {
      code: 6010,
      name: "FreezeAuthoritySet",
      msg: "Freeze authority can't be set on launchpad tokens",
    },
    {
      code: 6011,
      name: "InvalidMonthlySpendingLimit",
      msg: "Monthly spending limit must be less than 1/6th of the minimum raise amount and cannot be 0",
    },
    {
      code: 6012,
      name: "InvalidMonthlySpendingLimitMembers",
      msg: "There can only be at most 10 monthly spending limit members",
    },
    {
      code: 6013,
      name: "InvalidPriceBasedPremineAmount",
      msg: "Cannot do more than a 50% premine, minimum is 10 atoms of token",
    },
    {
      code: 6014,
      name: "InvalidPerformancePackageMinUnlockTime",
      msg: "Insiders must be forced to wait at least 18 months before unlocking their tokens",
    },
    {
      code: 6015,
      name: "LaunchAuthorityNotSet",
      msg: "Launch authority must be set to complete the launch until 2 days after closing",
    },
    {
      code: 6016,
      name: "FinalRaiseAmountTooLow",
      msg: "The final amount raised must be greater than or equal to the minimum raise amount",
    },
    {
      code: 6017,
      name: "TokensAlreadyClaimed",
      msg: "Tokens already claimed",
    },
    {
      code: 6018,
      name: "MoneyAlreadyRefunded",
      msg: "Money already refunded",
    },
    {
      code: 6019,
      name: "InvariantViolated",
      msg: "An invariant was violated. You should get in contact with the MetaDAO team if you see this",
    },
    {
      code: 6020,
      name: "LaunchNotLive",
      msg: "Launch must be live to be closed",
    },
    {
      code: 6021,
      name: "InvalidMinimumRaiseAmount",
      msg: "Minimum raise amount must be greater than or equal to $0.5 so that there's enough liquidity for the launch",
    },
    {
      code: 6022,
      name: "InvalidAdmin",
      msg: "Invalid admin",
    },
  ],
};
