export type Relaunch = {
  version: "0.1.0";
  name: "relaunch";
  instructions: [
    {
      name: "initializeRelaunch";
      accounts: [
        {
          name: "relaunch";
          isMut: true;
          isSigner: false;
        },
        {
          name: "newMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "mintAuthority";
          isMut: false;
          isSigner: true;
          docs: [
            "Proof that the initializer controls the new mint: must sign, and the",
            "handler CPIs `set_authority` to hand minting to `relaunch_signer`.",
          ];
        },
        {
          name: "relaunchSigner";
          isMut: false;
          isSigner: false;
        },
        {
          name: "oldMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "sourcePool";
          isMut: false;
          isSigner: false;
        },
        {
          name: "sourceQuoteMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "usdcMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "oldTokenVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "newTokenVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "sourceQuoteVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "usdcVault";
          isMut: true;
          isSigner: false;
          docs: [
            "The same account as `source_quote_vault` for USDC-quoted sources, in",
            "which case the `init_if_needed` is a no-op revalidation.",
          ];
        },
        {
          name: "tokenMetadata";
          isMut: true;
          isSigner: false;
        },
        {
          name: "admin";
          isMut: false;
          isSigner: false;
          docs: [
            "period. Not required to sign, mirroring launchpad's launch_authority.",
          ];
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        },
        {
          name: "oldTokenProgram";
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
            defined: "InitializeRelaunchArgs";
          };
        },
      ];
    },
    {
      name: "startDeposits";
      accounts: [
        {
          name: "relaunch";
          isMut: true;
          isSigner: false;
        },
        {
          name: "admin";
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
      name: "deposit";
      accounts: [
        {
          name: "relaunch";
          isMut: true;
          isSigner: false;
        },
        {
          name: "depositRecord";
          isMut: true;
          isSigner: false;
        },
        {
          name: "oldMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "oldTokenVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "depositor";
          isMut: false;
          isSigner: true;
        },
        {
          name: "depositorTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "oldTokenProgram";
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
          name: "args";
          type: {
            defined: "DepositArgs";
          };
        },
      ];
    },
    {
      name: "closeDeposits";
      accounts: [
        {
          name: "relaunch";
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
      name: "executeSell";
      accounts: [
        {
          name: "relaunch";
          isMut: true;
          isSigner: false;
        },
        {
          name: "admin";
          isMut: false;
          isSigner: true;
        },
        {
          name: "relaunchSigner";
          isMut: true;
          isSigner: false;
          docs: ["user account writable."];
        },
        {
          name: "oldMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "sourceQuoteMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "oldTokenVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "sourceQuoteVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "sourcePool";
          isMut: true;
          isSigner: false;
          docs: ["rechecks its internal consistency."];
        },
        {
          name: "pumpGlobalConfig";
          isMut: false;
          isSigner: false;
        },
        {
          name: "protocolFeeRecipient";
          isMut: false;
          isSigner: false;
        },
        {
          name: "protocolFeeRecipientTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "poolBaseTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "poolQuoteTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "coinCreatorVaultAta";
          isMut: true;
          isSigner: false;
        },
        {
          name: "coinCreatorVaultAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "pumpFeeConfig";
          isMut: false;
          isSigner: false;
        },
        {
          name: "pumpFeeProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "poolV2";
          isMut: false;
          isSigner: false;
        },
        {
          name: "buybackFeeRecipient";
          isMut: false;
          isSigner: false;
        },
        {
          name: "buybackFeeRecipientTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "pumpEventAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "pumpAmmProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "baseTokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "quoteTokenProgram";
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
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "ExecuteSellArgs";
          };
        },
      ];
    },
    {
      name: "markFailed";
      accounts: [
        {
          name: "relaunch";
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
      name: "claimRefund";
      accounts: [
        {
          name: "relaunch";
          isMut: true;
          isSigner: false;
        },
        {
          name: "depositRecord";
          isMut: true;
          isSigner: false;
        },
        {
          name: "oldMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "oldTokenVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "relaunchSigner";
          isMut: false;
          isSigner: false;
        },
        {
          name: "depositor";
          isMut: false;
          isSigner: false;
          docs: ["refunds for any depositor."];
        },
        {
          name: "depositorTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "oldTokenProgram";
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
  ];
  accounts: [
    {
      name: "depositRecord";
      type: {
        kind: "struct";
        fields: [
          {
            name: "relaunch";
            docs: ["The relaunch this record belongs to."];
            type: "publicKey";
          },
          {
            name: "depositor";
            docs: ["The depositor."];
            type: "publicKey";
          },
          {
            name: "amountDeposited";
            docs: [
              "The amount of old tokens deposited, including tokens bought via",
              "`deposit_via_buy`.",
            ];
            type: "u64";
          },
          {
            name: "claimed";
            docs: [
              "Whether the record has been settled by `claim` / `claim_refund`.",
            ];
            type: "bool";
          },
          {
            name: "seqNum";
            docs: [
              "The sequence number of this record. Useful for sorting events.",
            ];
            type: "u64";
          },
          {
            name: "pdaBump";
            docs: ["The PDA bump."];
            type: "u8";
          },
        ];
      };
    },
    {
      name: "relaunch";
      type: {
        kind: "struct";
        fields: [
          {
            name: "admin";
            docs: ["The initializer; executes the sell + swap legs."];
            type: "publicKey";
          },
          {
            name: "newMint";
            docs: [
              "The token that will be distributed to depositors and that will control the DAO.",
            ];
            type: "publicKey";
          },
          {
            name: "oldMint";
            docs: ["The token being relaunched."];
            type: "publicKey";
          },
          {
            name: "sourcePool";
            docs: [
              "The canonical PumpSwap pool for the old mint, validated at init.",
            ];
            type: "publicKey";
          },
          {
            name: "sourceQuoteMint";
            docs: [
              "The source pool's quote mint — WSOL or USDC. WSOL sources swap through",
              "the `usdc_swap_pool` constant.",
            ];
            type: "publicKey";
          },
          {
            name: "relaunchSigner";
            docs: [
              'The PDA that signs all CPIs and owns the vaults: `["relaunch_signer", relaunch]`.',
            ];
            type: "publicKey";
          },
          {
            name: "relaunchSignerBump";
            docs: ["The PDA bump for the relaunch signer."];
            type: "u8";
          },
          {
            name: "oldTokenVault";
            docs: ["The vault that escrows deposited old tokens."];
            type: "publicKey";
          },
          {
            name: "newTokenVault";
            docs: [
              "The vault that holds the minted new tokens until claim / liquidity provision.",
            ];
            type: "publicKey";
          },
          {
            name: "sourceQuoteVault";
            docs: ["The vault that receives raw sell proceeds (WSOL or USDC)."];
            type: "publicKey";
          },
          {
            name: "usdcVault";
            docs: [
              "The vault that receives the swap-leg output; == `source_quote_vault`",
              "for USDC sources.",
            ];
            type: "publicKey";
          },
          {
            name: "thresholdBps";
            docs: [
              "The minimum participation, denominated in bps of old-token total supply.",
            ];
            type: "u16";
          },
          {
            name: "oldSupplySnapshot";
            docs: [
              "The old mint supply captured at init (threshold denominator).",
            ];
            type: "u64";
          },
          {
            name: "secondsForDeposits";
            docs: ["The number of seconds that deposits will be open for."];
            type: "u32";
          },
          {
            name: "gracePeriodSeconds";
            docs: ["The admin's window to sell after deposits close."];
            type: "u32";
          },
          {
            name: "monthlySpendingLimitAmount";
            docs: [
              "The monthly spending limit the DAO allocates to the team. Zero, with",
              "no members, means the DAO launches without a spending limit.",
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
            name: "teamAddress";
            docs: ["The initial address used to sponsor team proposals."];
            type: "publicKey";
          },
          {
            name: "state";
            docs: ["The state of the relaunch."];
            type: {
              defined: "RelaunchState";
            };
          },
          {
            name: "totalDeposited";
            docs: ["The amount of old tokens deposited across all depositors."];
            type: "u64";
          },
          {
            name: "quoteRecovered";
            docs: ["The raw sell proceeds, in the source quote asset."];
            type: "u64";
          },
          {
            name: "usdcRecovered";
            docs: [
              "The post-swap USDC (== `quote_recovered` for USDC sources).",
            ];
            type: "u64";
          },
          {
            name: "unixTimestampStarted";
            docs: ["The unix timestamp when deposits were opened."];
            type: {
              option: "i64";
            };
          },
          {
            name: "unixTimestampClosed";
            docs: ["The unix timestamp when deposits were closed."];
            type: {
              option: "i64";
            };
          },
          {
            name: "unixTimestampCompleted";
            docs: ["The unix timestamp when the relaunch was completed."];
            type: {
              option: "i64";
            };
          },
          {
            name: "dao";
            docs: ["The DAO, if the relaunch is complete."];
            type: {
              option: "publicKey";
            };
          },
          {
            name: "daoVault";
            docs: [
              "The DAO's Squads multisig vault, if the relaunch is complete.",
            ];
            type: {
              option: "publicKey";
            };
          },
          {
            name: "seqNum";
            docs: [
              "The sequence number of this relaunch used for sorting events.",
            ];
            type: "u64";
          },
          {
            name: "pdaBump";
            docs: ["The PDA bump."];
            type: "u8";
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
            name: "relaunchSeqNum";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "DepositArgs";
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
      name: "ExecuteSellArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "minQuoteOut";
            docs: [
              "The admin's live, client-computed slippage floor on the sell proceeds.",
            ];
            type: "u64";
          },
        ];
      };
    },
    {
      name: "InitializeRelaunchArgs";
      type: {
        kind: "struct";
        fields: [
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
            name: "secondsForDeposits";
            type: "u32";
          },
          {
            name: "gracePeriodSeconds";
            type: "u32";
          },
          {
            name: "thresholdBps";
            type: "u16";
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
            name: "teamAddress";
            type: "publicKey";
          },
        ];
      };
    },
    {
      name: "RelaunchState";
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
            name: "SellPending";
          },
          {
            name: "Sold";
          },
          {
            name: "Swapped";
          },
          {
            name: "Complete";
          },
          {
            name: "Failed";
          },
        ];
      };
    },
  ];
  events: [
    {
      name: "RelaunchInitializedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "relaunch";
          type: "publicKey";
          index: false;
        },
        {
          name: "admin";
          type: "publicKey";
          index: false;
        },
        {
          name: "newMint";
          type: "publicKey";
          index: false;
        },
        {
          name: "oldMint";
          type: "publicKey";
          index: false;
        },
        {
          name: "sourcePool";
          type: "publicKey";
          index: false;
        },
        {
          name: "sourceQuoteMint";
          type: "publicKey";
          index: false;
        },
        {
          name: "relaunchSigner";
          type: "publicKey";
          index: false;
        },
        {
          name: "relaunchSignerBump";
          type: "u8";
          index: false;
        },
        {
          name: "oldTokenVault";
          type: "publicKey";
          index: false;
        },
        {
          name: "newTokenVault";
          type: "publicKey";
          index: false;
        },
        {
          name: "sourceQuoteVault";
          type: "publicKey";
          index: false;
        },
        {
          name: "usdcVault";
          type: "publicKey";
          index: false;
        },
        {
          name: "thresholdBps";
          type: "u16";
          index: false;
        },
        {
          name: "oldSupplySnapshot";
          type: "u64";
          index: false;
        },
        {
          name: "secondsForDeposits";
          type: "u32";
          index: false;
        },
        {
          name: "gracePeriodSeconds";
          type: "u32";
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
          name: "teamAddress";
          type: "publicKey";
          index: false;
        },
        {
          name: "pdaBump";
          type: "u8";
          index: false;
        },
      ];
    },
    {
      name: "DepositsStartedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "relaunch";
          type: "publicKey";
          index: false;
        },
        {
          name: "admin";
          type: "publicKey";
          index: false;
        },
      ];
    },
    {
      name: "TokensDepositedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "relaunch";
          type: "publicKey";
          index: false;
        },
        {
          name: "depositor";
          type: "publicKey";
          index: false;
        },
        {
          name: "depositRecord";
          type: "publicKey";
          index: false;
        },
        {
          name: "amount";
          type: "u64";
          index: false;
        },
        {
          name: "totalDeposited";
          type: "u64";
          index: false;
        },
        {
          name: "totalDepositedByDepositor";
          type: "u64";
          index: false;
        },
        {
          name: "depositRecordSeqNum";
          type: "u64";
          index: false;
        },
      ];
    },
    {
      name: "DepositsClosedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "relaunch";
          type: "publicKey";
          index: false;
        },
        {
          name: "newState";
          type: {
            defined: "RelaunchState";
          };
          index: false;
        },
      ];
    },
    {
      name: "RelaunchMarkedFailedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "relaunch";
          type: "publicKey";
          index: false;
        },
      ];
    },
    {
      name: "SellExecutedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "relaunch";
          type: "publicKey";
          index: false;
        },
        {
          name: "baseSold";
          type: "u64";
          index: false;
        },
        {
          name: "quoteRecovered";
          type: "u64";
          index: false;
        },
        {
          name: "newState";
          type: {
            defined: "RelaunchState";
          };
          index: false;
        },
      ];
    },
    {
      name: "RefundClaimedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "relaunch";
          type: "publicKey";
          index: false;
        },
        {
          name: "depositor";
          type: "publicKey";
          index: false;
        },
        {
          name: "depositRecord";
          type: "publicKey";
          index: false;
        },
        {
          name: "amountRefunded";
          type: "u64";
          index: false;
        },
        {
          name: "depositRecordSeqNum";
          type: "u64";
          index: false;
        },
      ];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "SupplyNonZero";
      msg: "New mint supply must be zero";
    },
    {
      code: 6001;
      name: "FreezeAuthoritySet";
      msg: "New mint must not have a freeze authority";
    },
    {
      code: 6002;
      name: "SourcePoolNotCanonical";
      msg: "Source pool is not the canonical PumpSwap pool for the old mint";
    },
    {
      code: 6003;
      name: "SourcePoolQuoteMintMismatch";
      msg: "Source quote mint does not match the source pool's quote mint";
    },
    {
      code: 6004;
      name: "InvalidQuoteMint";
      msg: "Source quote mint must be WSOL or USDC";
    },
    {
      code: 6005;
      name: "ForbiddenOldMintExtension";
      msg: "Old mint carries a Token-2022 extension outside the metadata allowlist";
    },
    {
      code: 6006;
      name: "InvalidThresholdBps";
      msg: "Threshold must be between 1 and 10000 bps";
    },
    {
      code: 6007;
      name: "InvalidSecondsForDeposits";
      msg: "Deposit period must be at most 1 year";
    },
    {
      code: 6008;
      name: "InvalidMonthlySpendingLimit";
      msg: "Monthly spending limit amount and members must both be set or both be empty";
    },
    {
      code: 6009;
      name: "InvalidMonthlySpendingLimitMembers";
      msg: "There can be at most 10 monthly spending limit members, without duplicates";
    },
    {
      code: 6010;
      name: "RelaunchNotInitialized";
      msg: "Relaunch must be in the Initialized state";
    },
    {
      code: 6011;
      name: "RelaunchNotLive";
      msg: "Relaunch must be in the Live state";
    },
    {
      code: 6012;
      name: "DepositWindowClosed";
      msg: "Deposit window has closed";
    },
    {
      code: 6013;
      name: "InvalidAmount";
      msg: "Amount must be greater than zero";
    },
    {
      code: 6014;
      name: "InsufficientFunds";
      msg: "Insufficient balance";
    },
    {
      code: 6015;
      name: "DepositWindowStillOpen";
      msg: "Deposit window is still open";
    },
    {
      code: 6016;
      name: "RelaunchNotSellPending";
      msg: "Relaunch must be in the SellPending state";
    },
    {
      code: 6017;
      name: "GracePeriodStillActive";
      msg: "Grace period has not elapsed";
    },
    {
      code: 6018;
      name: "RelaunchNotFailed";
      msg: "Relaunch must be in the Failed state";
    },
    {
      code: 6019;
      name: "AlreadyClaimed";
      msg: "Deposit record has already been claimed";
    },
    {
      code: 6020;
      name: "GracePeriodElapsed";
      msg: "Grace period has elapsed";
    },
  ];
};

export const IDL: Relaunch = {
  version: "0.1.0",
  name: "relaunch",
  instructions: [
    {
      name: "initializeRelaunch",
      accounts: [
        {
          name: "relaunch",
          isMut: true,
          isSigner: false,
        },
        {
          name: "newMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "mintAuthority",
          isMut: false,
          isSigner: true,
          docs: [
            "Proof that the initializer controls the new mint: must sign, and the",
            "handler CPIs `set_authority` to hand minting to `relaunch_signer`.",
          ],
        },
        {
          name: "relaunchSigner",
          isMut: false,
          isSigner: false,
        },
        {
          name: "oldMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "sourcePool",
          isMut: false,
          isSigner: false,
        },
        {
          name: "sourceQuoteMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "usdcMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "oldTokenVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "newTokenVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "sourceQuoteVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "usdcVault",
          isMut: true,
          isSigner: false,
          docs: [
            "The same account as `source_quote_vault` for USDC-quoted sources, in",
            "which case the `init_if_needed` is a no-op revalidation.",
          ],
        },
        {
          name: "tokenMetadata",
          isMut: true,
          isSigner: false,
        },
        {
          name: "admin",
          isMut: false,
          isSigner: false,
          docs: [
            "period. Not required to sign, mirroring launchpad's launch_authority.",
          ],
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
        {
          name: "oldTokenProgram",
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
            defined: "InitializeRelaunchArgs",
          },
        },
      ],
    },
    {
      name: "startDeposits",
      accounts: [
        {
          name: "relaunch",
          isMut: true,
          isSigner: false,
        },
        {
          name: "admin",
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
      name: "deposit",
      accounts: [
        {
          name: "relaunch",
          isMut: true,
          isSigner: false,
        },
        {
          name: "depositRecord",
          isMut: true,
          isSigner: false,
        },
        {
          name: "oldMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "oldTokenVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "depositor",
          isMut: false,
          isSigner: true,
        },
        {
          name: "depositorTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "oldTokenProgram",
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
          name: "args",
          type: {
            defined: "DepositArgs",
          },
        },
      ],
    },
    {
      name: "closeDeposits",
      accounts: [
        {
          name: "relaunch",
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
      name: "executeSell",
      accounts: [
        {
          name: "relaunch",
          isMut: true,
          isSigner: false,
        },
        {
          name: "admin",
          isMut: false,
          isSigner: true,
        },
        {
          name: "relaunchSigner",
          isMut: true,
          isSigner: false,
          docs: ["user account writable."],
        },
        {
          name: "oldMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "sourceQuoteMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "oldTokenVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "sourceQuoteVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "sourcePool",
          isMut: true,
          isSigner: false,
          docs: ["rechecks its internal consistency."],
        },
        {
          name: "pumpGlobalConfig",
          isMut: false,
          isSigner: false,
        },
        {
          name: "protocolFeeRecipient",
          isMut: false,
          isSigner: false,
        },
        {
          name: "protocolFeeRecipientTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "poolBaseTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "poolQuoteTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "coinCreatorVaultAta",
          isMut: true,
          isSigner: false,
        },
        {
          name: "coinCreatorVaultAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "pumpFeeConfig",
          isMut: false,
          isSigner: false,
        },
        {
          name: "pumpFeeProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "poolV2",
          isMut: false,
          isSigner: false,
        },
        {
          name: "buybackFeeRecipient",
          isMut: false,
          isSigner: false,
        },
        {
          name: "buybackFeeRecipientTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "pumpEventAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "pumpAmmProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "baseTokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "quoteTokenProgram",
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
          name: "args",
          type: {
            defined: "ExecuteSellArgs",
          },
        },
      ],
    },
    {
      name: "markFailed",
      accounts: [
        {
          name: "relaunch",
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
      name: "claimRefund",
      accounts: [
        {
          name: "relaunch",
          isMut: true,
          isSigner: false,
        },
        {
          name: "depositRecord",
          isMut: true,
          isSigner: false,
        },
        {
          name: "oldMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "oldTokenVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "relaunchSigner",
          isMut: false,
          isSigner: false,
        },
        {
          name: "depositor",
          isMut: false,
          isSigner: false,
          docs: ["refunds for any depositor."],
        },
        {
          name: "depositorTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "oldTokenProgram",
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
      name: "depositRecord",
      type: {
        kind: "struct",
        fields: [
          {
            name: "relaunch",
            docs: ["The relaunch this record belongs to."],
            type: "publicKey",
          },
          {
            name: "depositor",
            docs: ["The depositor."],
            type: "publicKey",
          },
          {
            name: "amountDeposited",
            docs: [
              "The amount of old tokens deposited, including tokens bought via",
              "`deposit_via_buy`.",
            ],
            type: "u64",
          },
          {
            name: "claimed",
            docs: [
              "Whether the record has been settled by `claim` / `claim_refund`.",
            ],
            type: "bool",
          },
          {
            name: "seqNum",
            docs: [
              "The sequence number of this record. Useful for sorting events.",
            ],
            type: "u64",
          },
          {
            name: "pdaBump",
            docs: ["The PDA bump."],
            type: "u8",
          },
        ],
      },
    },
    {
      name: "relaunch",
      type: {
        kind: "struct",
        fields: [
          {
            name: "admin",
            docs: ["The initializer; executes the sell + swap legs."],
            type: "publicKey",
          },
          {
            name: "newMint",
            docs: [
              "The token that will be distributed to depositors and that will control the DAO.",
            ],
            type: "publicKey",
          },
          {
            name: "oldMint",
            docs: ["The token being relaunched."],
            type: "publicKey",
          },
          {
            name: "sourcePool",
            docs: [
              "The canonical PumpSwap pool for the old mint, validated at init.",
            ],
            type: "publicKey",
          },
          {
            name: "sourceQuoteMint",
            docs: [
              "The source pool's quote mint — WSOL or USDC. WSOL sources swap through",
              "the `usdc_swap_pool` constant.",
            ],
            type: "publicKey",
          },
          {
            name: "relaunchSigner",
            docs: [
              'The PDA that signs all CPIs and owns the vaults: `["relaunch_signer", relaunch]`.',
            ],
            type: "publicKey",
          },
          {
            name: "relaunchSignerBump",
            docs: ["The PDA bump for the relaunch signer."],
            type: "u8",
          },
          {
            name: "oldTokenVault",
            docs: ["The vault that escrows deposited old tokens."],
            type: "publicKey",
          },
          {
            name: "newTokenVault",
            docs: [
              "The vault that holds the minted new tokens until claim / liquidity provision.",
            ],
            type: "publicKey",
          },
          {
            name: "sourceQuoteVault",
            docs: ["The vault that receives raw sell proceeds (WSOL or USDC)."],
            type: "publicKey",
          },
          {
            name: "usdcVault",
            docs: [
              "The vault that receives the swap-leg output; == `source_quote_vault`",
              "for USDC sources.",
            ],
            type: "publicKey",
          },
          {
            name: "thresholdBps",
            docs: [
              "The minimum participation, denominated in bps of old-token total supply.",
            ],
            type: "u16",
          },
          {
            name: "oldSupplySnapshot",
            docs: [
              "The old mint supply captured at init (threshold denominator).",
            ],
            type: "u64",
          },
          {
            name: "secondsForDeposits",
            docs: ["The number of seconds that deposits will be open for."],
            type: "u32",
          },
          {
            name: "gracePeriodSeconds",
            docs: ["The admin's window to sell after deposits close."],
            type: "u32",
          },
          {
            name: "monthlySpendingLimitAmount",
            docs: [
              "The monthly spending limit the DAO allocates to the team. Zero, with",
              "no members, means the DAO launches without a spending limit.",
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
            name: "teamAddress",
            docs: ["The initial address used to sponsor team proposals."],
            type: "publicKey",
          },
          {
            name: "state",
            docs: ["The state of the relaunch."],
            type: {
              defined: "RelaunchState",
            },
          },
          {
            name: "totalDeposited",
            docs: ["The amount of old tokens deposited across all depositors."],
            type: "u64",
          },
          {
            name: "quoteRecovered",
            docs: ["The raw sell proceeds, in the source quote asset."],
            type: "u64",
          },
          {
            name: "usdcRecovered",
            docs: [
              "The post-swap USDC (== `quote_recovered` for USDC sources).",
            ],
            type: "u64",
          },
          {
            name: "unixTimestampStarted",
            docs: ["The unix timestamp when deposits were opened."],
            type: {
              option: "i64",
            },
          },
          {
            name: "unixTimestampClosed",
            docs: ["The unix timestamp when deposits were closed."],
            type: {
              option: "i64",
            },
          },
          {
            name: "unixTimestampCompleted",
            docs: ["The unix timestamp when the relaunch was completed."],
            type: {
              option: "i64",
            },
          },
          {
            name: "dao",
            docs: ["The DAO, if the relaunch is complete."],
            type: {
              option: "publicKey",
            },
          },
          {
            name: "daoVault",
            docs: [
              "The DAO's Squads multisig vault, if the relaunch is complete.",
            ],
            type: {
              option: "publicKey",
            },
          },
          {
            name: "seqNum",
            docs: [
              "The sequence number of this relaunch used for sorting events.",
            ],
            type: "u64",
          },
          {
            name: "pdaBump",
            docs: ["The PDA bump."],
            type: "u8",
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
            name: "relaunchSeqNum",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "DepositArgs",
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
      name: "ExecuteSellArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "minQuoteOut",
            docs: [
              "The admin's live, client-computed slippage floor on the sell proceeds.",
            ],
            type: "u64",
          },
        ],
      },
    },
    {
      name: "InitializeRelaunchArgs",
      type: {
        kind: "struct",
        fields: [
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
            name: "secondsForDeposits",
            type: "u32",
          },
          {
            name: "gracePeriodSeconds",
            type: "u32",
          },
          {
            name: "thresholdBps",
            type: "u16",
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
            name: "teamAddress",
            type: "publicKey",
          },
        ],
      },
    },
    {
      name: "RelaunchState",
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
            name: "SellPending",
          },
          {
            name: "Sold",
          },
          {
            name: "Swapped",
          },
          {
            name: "Complete",
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
      name: "RelaunchInitializedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "relaunch",
          type: "publicKey",
          index: false,
        },
        {
          name: "admin",
          type: "publicKey",
          index: false,
        },
        {
          name: "newMint",
          type: "publicKey",
          index: false,
        },
        {
          name: "oldMint",
          type: "publicKey",
          index: false,
        },
        {
          name: "sourcePool",
          type: "publicKey",
          index: false,
        },
        {
          name: "sourceQuoteMint",
          type: "publicKey",
          index: false,
        },
        {
          name: "relaunchSigner",
          type: "publicKey",
          index: false,
        },
        {
          name: "relaunchSignerBump",
          type: "u8",
          index: false,
        },
        {
          name: "oldTokenVault",
          type: "publicKey",
          index: false,
        },
        {
          name: "newTokenVault",
          type: "publicKey",
          index: false,
        },
        {
          name: "sourceQuoteVault",
          type: "publicKey",
          index: false,
        },
        {
          name: "usdcVault",
          type: "publicKey",
          index: false,
        },
        {
          name: "thresholdBps",
          type: "u16",
          index: false,
        },
        {
          name: "oldSupplySnapshot",
          type: "u64",
          index: false,
        },
        {
          name: "secondsForDeposits",
          type: "u32",
          index: false,
        },
        {
          name: "gracePeriodSeconds",
          type: "u32",
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
          name: "teamAddress",
          type: "publicKey",
          index: false,
        },
        {
          name: "pdaBump",
          type: "u8",
          index: false,
        },
      ],
    },
    {
      name: "DepositsStartedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "relaunch",
          type: "publicKey",
          index: false,
        },
        {
          name: "admin",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "TokensDepositedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "relaunch",
          type: "publicKey",
          index: false,
        },
        {
          name: "depositor",
          type: "publicKey",
          index: false,
        },
        {
          name: "depositRecord",
          type: "publicKey",
          index: false,
        },
        {
          name: "amount",
          type: "u64",
          index: false,
        },
        {
          name: "totalDeposited",
          type: "u64",
          index: false,
        },
        {
          name: "totalDepositedByDepositor",
          type: "u64",
          index: false,
        },
        {
          name: "depositRecordSeqNum",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "DepositsClosedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "relaunch",
          type: "publicKey",
          index: false,
        },
        {
          name: "newState",
          type: {
            defined: "RelaunchState",
          },
          index: false,
        },
      ],
    },
    {
      name: "RelaunchMarkedFailedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "relaunch",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "SellExecutedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "relaunch",
          type: "publicKey",
          index: false,
        },
        {
          name: "baseSold",
          type: "u64",
          index: false,
        },
        {
          name: "quoteRecovered",
          type: "u64",
          index: false,
        },
        {
          name: "newState",
          type: {
            defined: "RelaunchState",
          },
          index: false,
        },
      ],
    },
    {
      name: "RefundClaimedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "relaunch",
          type: "publicKey",
          index: false,
        },
        {
          name: "depositor",
          type: "publicKey",
          index: false,
        },
        {
          name: "depositRecord",
          type: "publicKey",
          index: false,
        },
        {
          name: "amountRefunded",
          type: "u64",
          index: false,
        },
        {
          name: "depositRecordSeqNum",
          type: "u64",
          index: false,
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "SupplyNonZero",
      msg: "New mint supply must be zero",
    },
    {
      code: 6001,
      name: "FreezeAuthoritySet",
      msg: "New mint must not have a freeze authority",
    },
    {
      code: 6002,
      name: "SourcePoolNotCanonical",
      msg: "Source pool is not the canonical PumpSwap pool for the old mint",
    },
    {
      code: 6003,
      name: "SourcePoolQuoteMintMismatch",
      msg: "Source quote mint does not match the source pool's quote mint",
    },
    {
      code: 6004,
      name: "InvalidQuoteMint",
      msg: "Source quote mint must be WSOL or USDC",
    },
    {
      code: 6005,
      name: "ForbiddenOldMintExtension",
      msg: "Old mint carries a Token-2022 extension outside the metadata allowlist",
    },
    {
      code: 6006,
      name: "InvalidThresholdBps",
      msg: "Threshold must be between 1 and 10000 bps",
    },
    {
      code: 6007,
      name: "InvalidSecondsForDeposits",
      msg: "Deposit period must be at most 1 year",
    },
    {
      code: 6008,
      name: "InvalidMonthlySpendingLimit",
      msg: "Monthly spending limit amount and members must both be set or both be empty",
    },
    {
      code: 6009,
      name: "InvalidMonthlySpendingLimitMembers",
      msg: "There can be at most 10 monthly spending limit members, without duplicates",
    },
    {
      code: 6010,
      name: "RelaunchNotInitialized",
      msg: "Relaunch must be in the Initialized state",
    },
    {
      code: 6011,
      name: "RelaunchNotLive",
      msg: "Relaunch must be in the Live state",
    },
    {
      code: 6012,
      name: "DepositWindowClosed",
      msg: "Deposit window has closed",
    },
    {
      code: 6013,
      name: "InvalidAmount",
      msg: "Amount must be greater than zero",
    },
    {
      code: 6014,
      name: "InsufficientFunds",
      msg: "Insufficient balance",
    },
    {
      code: 6015,
      name: "DepositWindowStillOpen",
      msg: "Deposit window is still open",
    },
    {
      code: 6016,
      name: "RelaunchNotSellPending",
      msg: "Relaunch must be in the SellPending state",
    },
    {
      code: 6017,
      name: "GracePeriodStillActive",
      msg: "Grace period has not elapsed",
    },
    {
      code: 6018,
      name: "RelaunchNotFailed",
      msg: "Relaunch must be in the Failed state",
    },
    {
      code: 6019,
      name: "AlreadyClaimed",
      msg: "Deposit record has already been claimed",
    },
    {
      code: 6020,
      name: "GracePeriodElapsed",
      msg: "Grace period has elapsed",
    },
  ],
};
