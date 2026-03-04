export type Liquidation = {
  version: "0.1.0";
  name: "liquidation";
  instructions: [
    {
      name: "initializeLiquidation";
      accounts: [
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "createKey";
          isMut: false;
          isSigner: true;
        },
        {
          name: "recordAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "liquidationAuthority";
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
          name: "liquidation";
          isMut: true;
          isSigner: false;
        },
        {
          name: "liquidationQuoteVault";
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
            defined: "InitializeLiquidationArgs";
          };
        },
      ];
    },
    {
      name: "setRefundRecord";
      accounts: [
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "recordAuthority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "liquidation";
          isMut: true;
          isSigner: false;
        },
        {
          name: "recipient";
          isMut: false;
          isSigner: false;
        },
        {
          name: "refundRecord";
          isMut: true;
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
            defined: "SetRefundRecordArgs";
          };
        },
      ];
    },
    {
      name: "activateLiquidation";
      accounts: [
        {
          name: "liquidationAuthority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "liquidation";
          isMut: true;
          isSigner: false;
        },
        {
          name: "liquidationAuthorityQuoteAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "liquidationQuoteVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "quoteMint";
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
        },
      ];
      args: [];
    },
    {
      name: "refund";
      accounts: [
        {
          name: "recipient";
          isMut: true;
          isSigner: true;
        },
        {
          name: "liquidation";
          isMut: true;
          isSigner: false;
        },
        {
          name: "refundRecord";
          isMut: true;
          isSigner: false;
        },
        {
          name: "baseMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "recipientBaseAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "liquidationQuoteVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "recipientQuoteAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "quoteMint";
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
      name: "liquidation";
      type: {
        kind: "struct";
        fields: [
          {
            name: "createKey";
            docs: ["Arbitrary keypair used to make the PDA unique."];
            type: "publicKey";
          },
          {
            name: "recordAuthority";
            docs: [
              "The address that can create and modify RefundRecords during setup.",
            ];
            type: "publicKey";
          },
          {
            name: "liquidationAuthority";
            docs: [
              "The address that activates the liquidation and receives remaining quote tokens post-deadline.",
            ];
            type: "publicKey";
          },
          {
            name: "baseMint";
            docs: ["The project token mint (tokens to be burned)."];
            type: "publicKey";
          },
          {
            name: "quoteMint";
            docs: ["The refund token mint (USDC)."];
            type: "publicKey";
          },
          {
            name: "totalQuoteRefundable";
            docs: ["Sum of all RefundRecord quote_refundable values."];
            type: "u64";
          },
          {
            name: "totalQuoteRefunded";
            docs: [
              "Sum of all quote tokens actually transferred to users so far.",
            ];
            type: "u64";
          },
          {
            name: "totalBaseAssigned";
            docs: ["Sum of all RefundRecord base_assigned values."];
            type: "u64";
          },
          {
            name: "totalBaseBurned";
            docs: ["Sum of all base tokens actually burned so far."];
            type: "u64";
          },
          {
            name: "startedAt";
            docs: [
              "Unix timestamp when ActivateLiquidation was called. 0 before activation.",
            ];
            type: "i64";
          },
          {
            name: "durationSeconds";
            docs: ["How long the refund window lasts after activation."];
            type: "u32";
          },
          {
            name: "seqNum";
            docs: ["Event sequence number for indexing."];
            type: "u64";
          },
          {
            name: "isRefunding";
            docs: ["Whether refunds are currently enabled."];
            type: "bool";
          },
          {
            name: "pdaBump";
            docs: ["PDA bump seed."];
            type: "u8";
          },
        ];
      };
    },
    {
      name: "refundRecord";
      type: {
        kind: "struct";
        fields: [
          {
            name: "liquidation";
            docs: ["The parent Liquidation account."];
            type: "publicKey";
          },
          {
            name: "recipient";
            docs: ["The user this record belongs to."];
            type: "publicKey";
          },
          {
            name: "baseAssigned";
            docs: ["Total base tokens this user is eligible to burn."];
            type: "u64";
          },
          {
            name: "baseBurned";
            docs: ["Base tokens this user has burned so far."];
            type: "u64";
          },
          {
            name: "quoteRefundable";
            docs: [
              "Total quote tokens this user can receive if they burn all assigned base.",
            ];
            type: "u64";
          },
          {
            name: "quoteRefunded";
            docs: ["Quote tokens already transferred to this user."];
            type: "u64";
          },
          {
            name: "pdaBump";
            docs: ["PDA bump seed."];
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
            name: "liquidationSeqNum";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "InitializeLiquidationArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "durationSeconds";
            type: "u32";
          },
        ];
      };
    },
    {
      name: "SetRefundRecordArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "baseAssigned";
            type: "u64";
          },
          {
            name: "quoteRefundable";
            type: "u64";
          },
        ];
      };
    },
  ];
  events: [
    {
      name: "LiquidationCreatedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "liquidation";
          type: "publicKey";
          index: false;
        },
        {
          name: "recordAuthority";
          type: "publicKey";
          index: false;
        },
        {
          name: "liquidationAuthority";
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
          name: "durationSeconds";
          type: "u32";
          index: false;
        },
      ];
    },
    {
      name: "LiquidationActivatedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "liquidation";
          type: "publicKey";
          index: false;
        },
        {
          name: "totalQuoteFunded";
          type: "u64";
          index: false;
        },
        {
          name: "startedAt";
          type: "i64";
          index: false;
        },
      ];
    },
    {
      name: "RefundRecordSetEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "liquidation";
          type: "publicKey";
          index: false;
        },
        {
          name: "recipient";
          type: "publicKey";
          index: false;
        },
        {
          name: "baseAssigned";
          type: "u64";
          index: false;
        },
        {
          name: "quoteRefundable";
          type: "u64";
          index: false;
        },
      ];
    },
    {
      name: "RefundEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "liquidation";
          type: "publicKey";
          index: false;
        },
        {
          name: "recipient";
          type: "publicKey";
          index: false;
        },
        {
          name: "baseBurned";
          type: "u64";
          index: false;
        },
        {
          name: "quoteRefunded";
          type: "u64";
          index: false;
        },
        {
          name: "postRecordBaseBurned";
          type: "u64";
          index: false;
        },
        {
          name: "postRecordQuoteRefunded";
          type: "u64";
          index: false;
        },
        {
          name: "postLiquidationTotalBaseBurned";
          type: "u64";
          index: false;
        },
        {
          name: "postLiquidationTotalQuoteRefunded";
          type: "u64";
          index: false;
        },
      ];
    },
    {
      name: "WithdrawRemainingQuoteEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "liquidation";
          type: "publicKey";
          index: false;
        },
        {
          name: "liquidationAuthority";
          type: "publicKey";
          index: false;
        },
        {
          name: "amount";
          type: "u64";
          index: false;
        },
      ];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "RefundingNotEnabled";
      msg: "Refunding is not enabled";
    },
    {
      code: 6001;
      name: "AlreadyActivated";
      msg: "Liquidation is already activated";
    },
    {
      code: 6002;
      name: "NothingToFund";
      msg: "No quote tokens to fund";
    },
    {
      code: 6003;
      name: "NoBaseAssigned";
      msg: "No base tokens assigned";
    },
    {
      code: 6004;
      name: "RefundWindowExpired";
      msg: "Refund window has expired";
    },
    {
      code: 6005;
      name: "RefundWindowNotExpired";
      msg: "Refund window has not expired";
    },
    {
      code: 6006;
      name: "InvalidDuration";
      msg: "Duration must be greater than zero";
    },
    {
      code: 6007;
      name: "NothingToRefund";
      msg: "Nothing to refund";
    },
    {
      code: 6008;
      name: "InvalidAllocation";
      msg: "Invalid allocation";
    },
    {
      code: 6009;
      name: "InvalidAuthority";
      msg: "Invalid authority";
    },
    {
      code: 6010;
      name: "InvalidMint";
      msg: "Invalid mint";
    },
  ];
};

export const IDL: Liquidation = {
  version: "0.1.0",
  name: "liquidation",
  instructions: [
    {
      name: "initializeLiquidation",
      accounts: [
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "createKey",
          isMut: false,
          isSigner: true,
        },
        {
          name: "recordAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "liquidationAuthority",
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
          name: "liquidation",
          isMut: true,
          isSigner: false,
        },
        {
          name: "liquidationQuoteVault",
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
            defined: "InitializeLiquidationArgs",
          },
        },
      ],
    },
    {
      name: "setRefundRecord",
      accounts: [
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "recordAuthority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "liquidation",
          isMut: true,
          isSigner: false,
        },
        {
          name: "recipient",
          isMut: false,
          isSigner: false,
        },
        {
          name: "refundRecord",
          isMut: true,
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
            defined: "SetRefundRecordArgs",
          },
        },
      ],
    },
    {
      name: "activateLiquidation",
      accounts: [
        {
          name: "liquidationAuthority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "liquidation",
          isMut: true,
          isSigner: false,
        },
        {
          name: "liquidationAuthorityQuoteAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "liquidationQuoteVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "quoteMint",
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
      args: [],
    },
    {
      name: "refund",
      accounts: [
        {
          name: "recipient",
          isMut: true,
          isSigner: true,
        },
        {
          name: "liquidation",
          isMut: true,
          isSigner: false,
        },
        {
          name: "refundRecord",
          isMut: true,
          isSigner: false,
        },
        {
          name: "baseMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "recipientBaseAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "liquidationQuoteVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "recipientQuoteAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "quoteMint",
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
      name: "liquidation",
      type: {
        kind: "struct",
        fields: [
          {
            name: "createKey",
            docs: ["Arbitrary keypair used to make the PDA unique."],
            type: "publicKey",
          },
          {
            name: "recordAuthority",
            docs: [
              "The address that can create and modify RefundRecords during setup.",
            ],
            type: "publicKey",
          },
          {
            name: "liquidationAuthority",
            docs: [
              "The address that activates the liquidation and receives remaining quote tokens post-deadline.",
            ],
            type: "publicKey",
          },
          {
            name: "baseMint",
            docs: ["The project token mint (tokens to be burned)."],
            type: "publicKey",
          },
          {
            name: "quoteMint",
            docs: ["The refund token mint (USDC)."],
            type: "publicKey",
          },
          {
            name: "totalQuoteRefundable",
            docs: ["Sum of all RefundRecord quote_refundable values."],
            type: "u64",
          },
          {
            name: "totalQuoteRefunded",
            docs: [
              "Sum of all quote tokens actually transferred to users so far.",
            ],
            type: "u64",
          },
          {
            name: "totalBaseAssigned",
            docs: ["Sum of all RefundRecord base_assigned values."],
            type: "u64",
          },
          {
            name: "totalBaseBurned",
            docs: ["Sum of all base tokens actually burned so far."],
            type: "u64",
          },
          {
            name: "startedAt",
            docs: [
              "Unix timestamp when ActivateLiquidation was called. 0 before activation.",
            ],
            type: "i64",
          },
          {
            name: "durationSeconds",
            docs: ["How long the refund window lasts after activation."],
            type: "u32",
          },
          {
            name: "seqNum",
            docs: ["Event sequence number for indexing."],
            type: "u64",
          },
          {
            name: "isRefunding",
            docs: ["Whether refunds are currently enabled."],
            type: "bool",
          },
          {
            name: "pdaBump",
            docs: ["PDA bump seed."],
            type: "u8",
          },
        ],
      },
    },
    {
      name: "refundRecord",
      type: {
        kind: "struct",
        fields: [
          {
            name: "liquidation",
            docs: ["The parent Liquidation account."],
            type: "publicKey",
          },
          {
            name: "recipient",
            docs: ["The user this record belongs to."],
            type: "publicKey",
          },
          {
            name: "baseAssigned",
            docs: ["Total base tokens this user is eligible to burn."],
            type: "u64",
          },
          {
            name: "baseBurned",
            docs: ["Base tokens this user has burned so far."],
            type: "u64",
          },
          {
            name: "quoteRefundable",
            docs: [
              "Total quote tokens this user can receive if they burn all assigned base.",
            ],
            type: "u64",
          },
          {
            name: "quoteRefunded",
            docs: ["Quote tokens already transferred to this user."],
            type: "u64",
          },
          {
            name: "pdaBump",
            docs: ["PDA bump seed."],
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
            name: "liquidationSeqNum",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "InitializeLiquidationArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "durationSeconds",
            type: "u32",
          },
        ],
      },
    },
    {
      name: "SetRefundRecordArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "baseAssigned",
            type: "u64",
          },
          {
            name: "quoteRefundable",
            type: "u64",
          },
        ],
      },
    },
  ],
  events: [
    {
      name: "LiquidationCreatedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "liquidation",
          type: "publicKey",
          index: false,
        },
        {
          name: "recordAuthority",
          type: "publicKey",
          index: false,
        },
        {
          name: "liquidationAuthority",
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
          name: "durationSeconds",
          type: "u32",
          index: false,
        },
      ],
    },
    {
      name: "LiquidationActivatedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "liquidation",
          type: "publicKey",
          index: false,
        },
        {
          name: "totalQuoteFunded",
          type: "u64",
          index: false,
        },
        {
          name: "startedAt",
          type: "i64",
          index: false,
        },
      ],
    },
    {
      name: "RefundRecordSetEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "liquidation",
          type: "publicKey",
          index: false,
        },
        {
          name: "recipient",
          type: "publicKey",
          index: false,
        },
        {
          name: "baseAssigned",
          type: "u64",
          index: false,
        },
        {
          name: "quoteRefundable",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "RefundEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "liquidation",
          type: "publicKey",
          index: false,
        },
        {
          name: "recipient",
          type: "publicKey",
          index: false,
        },
        {
          name: "baseBurned",
          type: "u64",
          index: false,
        },
        {
          name: "quoteRefunded",
          type: "u64",
          index: false,
        },
        {
          name: "postRecordBaseBurned",
          type: "u64",
          index: false,
        },
        {
          name: "postRecordQuoteRefunded",
          type: "u64",
          index: false,
        },
        {
          name: "postLiquidationTotalBaseBurned",
          type: "u64",
          index: false,
        },
        {
          name: "postLiquidationTotalQuoteRefunded",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "WithdrawRemainingQuoteEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "liquidation",
          type: "publicKey",
          index: false,
        },
        {
          name: "liquidationAuthority",
          type: "publicKey",
          index: false,
        },
        {
          name: "amount",
          type: "u64",
          index: false,
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "RefundingNotEnabled",
      msg: "Refunding is not enabled",
    },
    {
      code: 6001,
      name: "AlreadyActivated",
      msg: "Liquidation is already activated",
    },
    {
      code: 6002,
      name: "NothingToFund",
      msg: "No quote tokens to fund",
    },
    {
      code: 6003,
      name: "NoBaseAssigned",
      msg: "No base tokens assigned",
    },
    {
      code: 6004,
      name: "RefundWindowExpired",
      msg: "Refund window has expired",
    },
    {
      code: 6005,
      name: "RefundWindowNotExpired",
      msg: "Refund window has not expired",
    },
    {
      code: 6006,
      name: "InvalidDuration",
      msg: "Duration must be greater than zero",
    },
    {
      code: 6007,
      name: "NothingToRefund",
      msg: "Nothing to refund",
    },
    {
      code: 6008,
      name: "InvalidAllocation",
      msg: "Invalid allocation",
    },
    {
      code: 6009,
      name: "InvalidAuthority",
      msg: "Invalid authority",
    },
    {
      code: 6010,
      name: "InvalidMint",
      msg: "Invalid mint",
    },
  ],
};
