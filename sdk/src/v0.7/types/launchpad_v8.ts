export type LaunchpadV8 = {
  version: "0.8.0";
  name: "launchpad_v8";
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
          name: "additionalTokensRecipient";
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: "mintGovernor";
          isMut: true;
          isSigner: false;
          docs: [
            'PDA: seeds = [b"mint_governor", base_mint, launch_signer (create_key)]',
            "Initialized via CPI to mint_governor::initialize_mint_governor",
          ];
        },
        {
          name: "mintAuthority";
          isMut: true;
          isSigner: false;
          docs: [
            'PDA: seeds = [b"mint_authority", mint_governor, launch_signer (authorized_minter)]',
            "Initialized via CPI to mint_governor::add_mint_authority",
          ];
        },
        {
          name: "mintGovernorProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "mintGovernorEventAuthority";
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
          {
            name: "approvedAmount";
            docs: [
              "The amount of USDC that the launch authority has approved for the funder.",
              "If zero, the funder has not been approved for any amount.",
            ];
            type: "u64";
          },
          {
            name: "committedAmountAccumulator";
            docs: [
              "Running integral of committed_amount over time (committed_amount * seconds).",
            ];
            type: "u128";
          },
          {
            name: "lastAccumulatorUpdate";
            docs: ["Unix timestamp of the last accumulator update."];
            type: "i64";
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
            docs: ["The launch signer address."];
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
            docs: ["The token vault, used to send tokens to the AMM."];
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
          {
            name: "totalApprovedAmount";
            docs: [
              "The amount of USDC that the launch authority has approved across all funders.",
            ];
            type: "u64";
          },
          {
            name: "additionalTokensAmount";
            docs: [
              "The amount of additional tokens to be minted on a successful launch.",
            ];
            type: "u64";
          },
          {
            name: "additionalTokensRecipient";
            docs: [
              "The token account that will receive the additional tokens.",
            ];
            type: {
              option: "publicKey";
            };
          },
          {
            name: "additionalTokensClaimed";
            docs: ["Are the additional tokens claimed."];
            type: "bool";
          },
          {
            name: "unixTimestampCompleted";
            docs: ["The unix timestamp when the launch was completed."];
            type: {
              option: "i64";
            };
          },
          {
            name: "isPerformancePackageInitialized";
            docs: ["Whether the performance package has been initialized."];
            type: "bool";
          },
          {
            name: "accumulatorActivationDelaySeconds";
            docs: [
              "Number of seconds after launch start before the funding accumulator",
              "begins tracking.",
            ];
            type: "u32";
          },
          {
            name: "hasBidWall";
            docs: ["Whether the launch has a bid wall."];
            type: "bool";
          },
          {
            name: "mintGovernor";
            docs: ["The MintGovernor PDA that owns the SPL mint authority."];
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
          {
            name: "additionalTokensAmount";
            type: "u64";
          },
          {
            name: "accumulatorActivationDelaySeconds";
            type: "u32";
          },
          {
            name: "hasBidWall";
            type: "bool";
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
        {
          name: "additionalTokensAmount";
          type: "u64";
          index: false;
        },
        {
          name: "additionalTokensRecipient";
          type: {
            option: "publicKey";
          };
          index: false;
        },
        {
          name: "accumulatorActivationDelaySeconds";
          type: "u32";
          index: false;
        },
        {
          name: "hasBidWall";
          type: "bool";
          index: false;
        },
        {
          name: "mintGovernor";
          type: "publicKey";
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
        {
          name: "committedAmountAccumulator";
          type: "u128";
          index: false;
        },
      ];
    },
    {
      name: "FundingRecordApprovalSetEvent";
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
          name: "fundingRecord";
          type: "publicKey";
          index: false;
        },
        {
          name: "funder";
          type: "publicKey";
          index: false;
        },
        {
          name: "approvedAmount";
          type: "u64";
          index: false;
        },
        {
          name: "totalApproved";
          type: "u64";
          index: false;
        },
      ];
    },
    {
      name: "LaunchSettledEvent";
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
          name: "totalApprovedAmount";
          type: "u64";
          index: false;
        },
        {
          name: "bidWall";
          type: {
            option: "publicKey";
          };
          index: false;
        },
        {
          name: "bidWallAmount";
          type: "u64";
          index: false;
        },
        {
          name: "mintGovernor";
          type: "publicKey";
          index: false;
        },
        {
          name: "tokensMinted";
          type: "u64";
          index: false;
        },
      ];
    },
    {
      name: "LaunchFinalizedEvent";
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
          name: "performancePackage";
          type: "publicKey";
          index: false;
        },
        {
          name: "mintGovernor";
          type: "publicKey";
          index: false;
        },
        {
          name: "mintGovernorNewAdmin";
          type: "publicKey";
          index: false;
        },
        {
          name: "ppMintAuthority";
          type: "publicKey";
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
      name: "LaunchClaimAdditionalTokenAllocationEvent";
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
          name: "additionalTokensAmount";
          type: "u64";
          index: false;
        },
        {
          name: "additionalTokensRecipient";
          type: "publicKey";
          index: false;
        },
      ];
    },
    {
      name: "LaunchExtendedEvent";
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
          name: "oldSecondsForLaunch";
          type: "u32";
          index: false;
        },
        {
          name: "newSecondsForLaunch";
          type: "u32";
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
      name: "InvalidLaunchState";
      msg: "Invalid launch state";
    },
    {
      code: 6005;
      name: "LaunchPeriodNotOver";
      msg: "Launch period not over";
    },
    {
      code: 6006;
      name: "LaunchExpired";
      msg: "Launch is complete, no more funding allowed";
    },
    {
      code: 6007;
      name: "LaunchNotRefunding";
      msg: "Refund not available";
    },
    {
      code: 6008;
      name: "LaunchNotInitialized";
      msg: "Launch must be initialized to be started";
    },
    {
      code: 6009;
      name: "FreezeAuthoritySet";
      msg: "Freeze authority can't be set on launchpad tokens";
    },
    {
      code: 6010;
      name: "InvalidMonthlySpendingLimit";
      msg: "Monthly spending limit must be less than 1/6th of the minimum raise amount and cannot be 0";
    },
    {
      code: 6011;
      name: "InvalidMonthlySpendingLimitMembers";
      msg: "There can only be at most 10 monthly spending limit members";
    },
    {
      code: 6012;
      name: "InvalidPerformancePackageTokenAmount";
      msg: "Invalid performance package token amount";
    },
    {
      code: 6013;
      name: "InvalidPerformancePackageMinUnlockTime";
      msg: "Insiders must wait at least 12 months before unlocking";
    },
    {
      code: 6014;
      name: "LaunchAuthorityNotSet";
      msg: "Launch authority must be set to complete the launch until 2 days after closing";
    },
    {
      code: 6015;
      name: "FinalRaiseAmountTooLow";
      msg: "The final amount raised must be >= the minimum raise amount";
    },
    {
      code: 6016;
      name: "TokensAlreadyClaimed";
      msg: "Tokens already claimed";
    },
    {
      code: 6017;
      name: "MoneyAlreadyRefunded";
      msg: "USDC already refunded";
    },
    {
      code: 6018;
      name: "InvariantViolated";
      msg: "Invariant violated";
    },
    {
      code: 6019;
      name: "LaunchNotLive";
      msg: "Launch must be live to be closed";
    },
    {
      code: 6020;
      name: "InvalidMinimumRaiseAmount";
      msg: "Minimum raise amount too low for liquidity";
    },
    {
      code: 6021;
      name: "FinalRaiseAmountAlreadySet";
      msg: "Final raise amount already set";
    },
    {
      code: 6022;
      name: "TotalApprovedAmountTooLow";
      msg: "Total approved amount too low";
    },
    {
      code: 6023;
      name: "InvalidAdditionalTokensRecipient";
      msg: "Additional tokens recipient must be set when amount > 0";
    },
    {
      code: 6024;
      name: "NoAdditionalTokensRecipientSet";
      msg: "No additional tokens recipient set";
    },
    {
      code: 6025;
      name: "AdditionalTokensAlreadyClaimed";
      msg: "Additional tokens already claimed";
    },
    {
      code: 6026;
      name: "FundingRecordApprovalPeriodOver";
      msg: "Funding record approval period is over";
    },
    {
      code: 6027;
      name: "PerformancePackageAlreadyInitialized";
      msg: "Performance package already initialized";
    },
    {
      code: 6028;
      name: "InvalidDao";
      msg: "Invalid DAO";
    },
    {
      code: 6029;
      name: "InvalidAccumulatorActivationDelaySeconds";
      msg: "Accumulator activation delay must be less than the launch duration";
    },
    {
      code: 6030;
      name: "ExtendDurationExceedsMax";
      msg: "Extend duration would exceed maximum allowed launch duration";
    },
    {
      code: 6031;
      name: "InvalidMintAuthority";
      msg: "Mint authority does not match expected";
    },
  ];
};

export const IDL: LaunchpadV8 = {
  version: "0.8.0",
  name: "launchpad_v8",
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
          name: "additionalTokensRecipient",
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: "mintGovernor",
          isMut: true,
          isSigner: false,
          docs: [
            'PDA: seeds = [b"mint_governor", base_mint, launch_signer (create_key)]',
            "Initialized via CPI to mint_governor::initialize_mint_governor",
          ],
        },
        {
          name: "mintAuthority",
          isMut: true,
          isSigner: false,
          docs: [
            'PDA: seeds = [b"mint_authority", mint_governor, launch_signer (authorized_minter)]',
            "Initialized via CPI to mint_governor::add_mint_authority",
          ],
        },
        {
          name: "mintGovernorProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "mintGovernorEventAuthority",
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
          {
            name: "approvedAmount",
            docs: [
              "The amount of USDC that the launch authority has approved for the funder.",
              "If zero, the funder has not been approved for any amount.",
            ],
            type: "u64",
          },
          {
            name: "committedAmountAccumulator",
            docs: [
              "Running integral of committed_amount over time (committed_amount * seconds).",
            ],
            type: "u128",
          },
          {
            name: "lastAccumulatorUpdate",
            docs: ["Unix timestamp of the last accumulator update."],
            type: "i64",
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
            docs: ["The launch signer address."],
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
            docs: ["The token vault, used to send tokens to the AMM."],
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
          {
            name: "totalApprovedAmount",
            docs: [
              "The amount of USDC that the launch authority has approved across all funders.",
            ],
            type: "u64",
          },
          {
            name: "additionalTokensAmount",
            docs: [
              "The amount of additional tokens to be minted on a successful launch.",
            ],
            type: "u64",
          },
          {
            name: "additionalTokensRecipient",
            docs: [
              "The token account that will receive the additional tokens.",
            ],
            type: {
              option: "publicKey",
            },
          },
          {
            name: "additionalTokensClaimed",
            docs: ["Are the additional tokens claimed."],
            type: "bool",
          },
          {
            name: "unixTimestampCompleted",
            docs: ["The unix timestamp when the launch was completed."],
            type: {
              option: "i64",
            },
          },
          {
            name: "isPerformancePackageInitialized",
            docs: ["Whether the performance package has been initialized."],
            type: "bool",
          },
          {
            name: "accumulatorActivationDelaySeconds",
            docs: [
              "Number of seconds after launch start before the funding accumulator",
              "begins tracking.",
            ],
            type: "u32",
          },
          {
            name: "hasBidWall",
            docs: ["Whether the launch has a bid wall."],
            type: "bool",
          },
          {
            name: "mintGovernor",
            docs: ["The MintGovernor PDA that owns the SPL mint authority."],
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
          {
            name: "additionalTokensAmount",
            type: "u64",
          },
          {
            name: "accumulatorActivationDelaySeconds",
            type: "u32",
          },
          {
            name: "hasBidWall",
            type: "bool",
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
        {
          name: "additionalTokensAmount",
          type: "u64",
          index: false,
        },
        {
          name: "additionalTokensRecipient",
          type: {
            option: "publicKey",
          },
          index: false,
        },
        {
          name: "accumulatorActivationDelaySeconds",
          type: "u32",
          index: false,
        },
        {
          name: "hasBidWall",
          type: "bool",
          index: false,
        },
        {
          name: "mintGovernor",
          type: "publicKey",
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
        {
          name: "committedAmountAccumulator",
          type: "u128",
          index: false,
        },
      ],
    },
    {
      name: "FundingRecordApprovalSetEvent",
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
          name: "fundingRecord",
          type: "publicKey",
          index: false,
        },
        {
          name: "funder",
          type: "publicKey",
          index: false,
        },
        {
          name: "approvedAmount",
          type: "u64",
          index: false,
        },
        {
          name: "totalApproved",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "LaunchSettledEvent",
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
          name: "totalApprovedAmount",
          type: "u64",
          index: false,
        },
        {
          name: "bidWall",
          type: {
            option: "publicKey",
          },
          index: false,
        },
        {
          name: "bidWallAmount",
          type: "u64",
          index: false,
        },
        {
          name: "mintGovernor",
          type: "publicKey",
          index: false,
        },
        {
          name: "tokensMinted",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "LaunchFinalizedEvent",
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
          name: "performancePackage",
          type: "publicKey",
          index: false,
        },
        {
          name: "mintGovernor",
          type: "publicKey",
          index: false,
        },
        {
          name: "mintGovernorNewAdmin",
          type: "publicKey",
          index: false,
        },
        {
          name: "ppMintAuthority",
          type: "publicKey",
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
      name: "LaunchClaimAdditionalTokenAllocationEvent",
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
          name: "additionalTokensAmount",
          type: "u64",
          index: false,
        },
        {
          name: "additionalTokensRecipient",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "LaunchExtendedEvent",
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
          name: "oldSecondsForLaunch",
          type: "u32",
          index: false,
        },
        {
          name: "newSecondsForLaunch",
          type: "u32",
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
      name: "InvalidLaunchState",
      msg: "Invalid launch state",
    },
    {
      code: 6005,
      name: "LaunchPeriodNotOver",
      msg: "Launch period not over",
    },
    {
      code: 6006,
      name: "LaunchExpired",
      msg: "Launch is complete, no more funding allowed",
    },
    {
      code: 6007,
      name: "LaunchNotRefunding",
      msg: "Refund not available",
    },
    {
      code: 6008,
      name: "LaunchNotInitialized",
      msg: "Launch must be initialized to be started",
    },
    {
      code: 6009,
      name: "FreezeAuthoritySet",
      msg: "Freeze authority can't be set on launchpad tokens",
    },
    {
      code: 6010,
      name: "InvalidMonthlySpendingLimit",
      msg: "Monthly spending limit must be less than 1/6th of the minimum raise amount and cannot be 0",
    },
    {
      code: 6011,
      name: "InvalidMonthlySpendingLimitMembers",
      msg: "There can only be at most 10 monthly spending limit members",
    },
    {
      code: 6012,
      name: "InvalidPerformancePackageTokenAmount",
      msg: "Invalid performance package token amount",
    },
    {
      code: 6013,
      name: "InvalidPerformancePackageMinUnlockTime",
      msg: "Insiders must wait at least 12 months before unlocking",
    },
    {
      code: 6014,
      name: "LaunchAuthorityNotSet",
      msg: "Launch authority must be set to complete the launch until 2 days after closing",
    },
    {
      code: 6015,
      name: "FinalRaiseAmountTooLow",
      msg: "The final amount raised must be >= the minimum raise amount",
    },
    {
      code: 6016,
      name: "TokensAlreadyClaimed",
      msg: "Tokens already claimed",
    },
    {
      code: 6017,
      name: "MoneyAlreadyRefunded",
      msg: "USDC already refunded",
    },
    {
      code: 6018,
      name: "InvariantViolated",
      msg: "Invariant violated",
    },
    {
      code: 6019,
      name: "LaunchNotLive",
      msg: "Launch must be live to be closed",
    },
    {
      code: 6020,
      name: "InvalidMinimumRaiseAmount",
      msg: "Minimum raise amount too low for liquidity",
    },
    {
      code: 6021,
      name: "FinalRaiseAmountAlreadySet",
      msg: "Final raise amount already set",
    },
    {
      code: 6022,
      name: "TotalApprovedAmountTooLow",
      msg: "Total approved amount too low",
    },
    {
      code: 6023,
      name: "InvalidAdditionalTokensRecipient",
      msg: "Additional tokens recipient must be set when amount > 0",
    },
    {
      code: 6024,
      name: "NoAdditionalTokensRecipientSet",
      msg: "No additional tokens recipient set",
    },
    {
      code: 6025,
      name: "AdditionalTokensAlreadyClaimed",
      msg: "Additional tokens already claimed",
    },
    {
      code: 6026,
      name: "FundingRecordApprovalPeriodOver",
      msg: "Funding record approval period is over",
    },
    {
      code: 6027,
      name: "PerformancePackageAlreadyInitialized",
      msg: "Performance package already initialized",
    },
    {
      code: 6028,
      name: "InvalidDao",
      msg: "Invalid DAO",
    },
    {
      code: 6029,
      name: "InvalidAccumulatorActivationDelaySeconds",
      msg: "Accumulator activation delay must be less than the launch duration",
    },
    {
      code: 6030,
      name: "ExtendDurationExceedsMax",
      msg: "Extend duration would exceed maximum allowed launch duration",
    },
    {
      code: 6031,
      name: "InvalidMintAuthority",
      msg: "Mint authority does not match expected",
    },
  ],
};
