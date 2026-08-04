export type Relaunch = {
  version: "0.1.0";
  name: "relaunch";
  instructions: [];
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
            docs: ["The monthly spending limit the DAO allocates to the team."];
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
};

export const IDL: Relaunch = {
  version: "0.1.0",
  name: "relaunch",
  instructions: [],
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
            docs: ["The monthly spending limit the DAO allocates to the team."],
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
};
