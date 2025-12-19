export type BidWall = {
  version: "0.7.0";
  name: "bid_wall";
  instructions: [
    {
      name: "initializeBidWall";
      accounts: [
        {
          name: "bidWall";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "feeRecipient";
          isMut: false;
          isSigner: false;
        },
        {
          name: "creator";
          isMut: false;
          isSigner: true;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "bidWallQuoteTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "creatorQuoteTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "daoTreasury";
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
      args: [
        {
          name: "args";
          type: {
            defined: "InitializeBidWallArgs";
          };
        },
      ];
    },
    {
      name: "closeBidWall";
      accounts: [
        {
          name: "bidWall";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "feeRecipient";
          isMut: false;
          isSigner: false;
        },
        {
          name: "bidWallQuoteTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authorityQuoteTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "feeRecipientQuoteTokenAccount";
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
      args: [];
    },
    {
      name: "sellTokens";
      accounts: [
        {
          name: "bidWall";
          isMut: true;
          isSigner: false;
        },
        {
          name: "user";
          isMut: true;
          isSigner: true;
        },
        {
          name: "userTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userQuoteTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "bidWallQuoteTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "daoTreasury";
          isMut: false;
          isSigner: false;
        },
        {
          name: "daoTreasuryQuoteTokenAccount";
          isMut: false;
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
          name: "args";
          type: {
            defined: "SellTokensArgs";
          };
        },
      ];
    },
    {
      name: "collectFees";
      accounts: [
        {
          name: "bidWall";
          isMut: true;
          isSigner: false;
        },
        {
          name: "bidWallQuoteTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "feeRecipient";
          isMut: false;
          isSigner: false;
        },
        {
          name: "feeRecipientQuoteTokenAccount";
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
    {
      name: "cancelBidWall";
      accounts: [
        {
          name: "bidWall";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "feeRecipient";
          isMut: false;
          isSigner: false;
        },
        {
          name: "bidWallQuoteTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authorityQuoteTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "feeRecipientQuoteTokenAccount";
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
      args: [];
    },
  ];
  accounts: [
    {
      name: "bidWall";
      type: {
        kind: "struct";
        fields: [
          {
            name: "nonce";
            docs: ["The nonce of the bid wall."];
            type: "u64";
          },
          {
            name: "createdTimestamp";
            docs: ["When the bid wall was created."];
            type: "i64";
          },
          {
            name: "initialAmmQuoteReserves";
            docs: ["The initial quote (USDC) reserves of the Futarchy AMM."];
            type: "u64";
          },
          {
            name: "quoteAmount";
            docs: [
              "The current amount of quote tokens assigned to the bid wall.",
              "This is different from the amount in the bid wall quote token account,",
              "because anyone can transfer quote tokens to the bid wall, and we don't want that to affect the bid wall's NAV calculation.",
            ];
            type: "u64";
          },
          {
            name: "feesCollected";
            docs: ["The fees collected by the bid wall."];
            type: "u64";
          },
          {
            name: "baseBoughtAmount";
            docs: ["The amount of base tokens bought up by the bid wall."];
            type: "u64";
          },
          {
            name: "seqNum";
            docs: ["The event sequence number of the bid wall."];
            type: "u64";
          },
          {
            name: "creator";
            docs: ["The authority of the bid wall."];
            type: "publicKey";
          },
          {
            name: "authority";
            docs: ["The authority of the bid wall."];
            type: "publicKey";
          },
          {
            name: "daoTreasury";
            docs: ["The DAO treasury address."];
            type: "publicKey";
          },
          {
            name: "baseMint";
            docs: ["The mint of the token being sold into the bid wall."];
            type: "publicKey";
          },
          {
            name: "feeRecipient";
            docs: ["The recipient of the fees collected by the bid wall."];
            type: "publicKey";
          },
          {
            name: "durationSeconds";
            docs: [
              "The minimum duration in seconds before the bid wall can be closed.",
            ];
            type: "u32";
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
            name: "bidWallSeqNum";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "InitializeBidWallArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "nonce";
            type: "u64";
          },
          {
            name: "initialAmmQuoteReserves";
            type: "u64";
          },
          {
            name: "durationSeconds";
            type: "u32";
          },
        ];
      };
    },
    {
      name: "SellTokensArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amountIn";
            type: "u64";
          },
        ];
      };
    },
  ];
  events: [
    {
      name: "BidWallInitializedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "bidWall";
          type: "publicKey";
          index: false;
        },
        {
          name: "nonce";
          type: "u64";
          index: false;
        },
        {
          name: "initialAmmQuoteReserves";
          type: "u64";
          index: false;
        },
        {
          name: "amount";
          type: "u64";
          index: false;
        },
        {
          name: "creator";
          type: "publicKey";
          index: false;
        },
        {
          name: "authority";
          type: "publicKey";
          index: false;
        },
        {
          name: "daoTreasury";
          type: "publicKey";
          index: false;
        },
        {
          name: "baseMint";
          type: "publicKey";
          index: false;
        },
        {
          name: "feeRecipient";
          type: "publicKey";
          index: false;
        },
        {
          name: "durationSeconds";
          type: "u32";
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
      name: "BidWallTokensSoldEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "bidWall";
          type: "publicKey";
          index: false;
        },
        {
          name: "amountIn";
          type: "u64";
          index: false;
        },
        {
          name: "amountOut";
          type: "u64";
          index: false;
        },
        {
          name: "fee";
          type: "u64";
          index: false;
        },
        {
          name: "postBidWallQuoteTokenAccountAmount";
          type: "u64";
          index: false;
        },
        {
          name: "postBidWallBaseBoughtAmount";
          type: "u64";
          index: false;
        },
        {
          name: "user";
          type: "publicKey";
          index: false;
        },
      ];
    },
    {
      name: "BidWallFeesCollectedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "bidWall";
          type: "publicKey";
          index: false;
        },
        {
          name: "feesCollected";
          type: "u64";
          index: false;
        },
        {
          name: "postBidWallQuoteTokenAccountAmount";
          type: "u64";
          index: false;
        },
      ];
    },
    {
      name: "BidWallClosedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "bidWall";
          type: "publicKey";
          index: false;
        },
      ];
    },
    {
      name: "BidWallCanceledEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "bidWall";
          type: "publicKey";
          index: false;
        },
      ];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "BidWallExpired";
      msg: "Bid wall expired";
    },
    {
      code: 6001;
      name: "BidWallNotExpired";
      msg: "Bid wall not expired";
    },
    {
      code: 6002;
      name: "FeeRecipientMismatch";
      msg: "Fee recipient mismatch";
    },
    {
      code: 6003;
      name: "InsufficientQuoteReserves";
      msg: "Insufficient quote reserves";
    },
    {
      code: 6004;
      name: "BidWallDepleted";
      msg: "Bid wall depleted";
    },
    {
      code: 6005;
      name: "InvalidInputAmount";
      msg: "Invalid input amount";
    },
  ];
};

export const IDL: BidWall = {
  version: "0.7.0",
  name: "bid_wall",
  instructions: [
    {
      name: "initializeBidWall",
      accounts: [
        {
          name: "bidWall",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "feeRecipient",
          isMut: false,
          isSigner: false,
        },
        {
          name: "creator",
          isMut: false,
          isSigner: true,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "bidWallQuoteTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "creatorQuoteTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "daoTreasury",
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
          name: "args",
          type: {
            defined: "InitializeBidWallArgs",
          },
        },
      ],
    },
    {
      name: "closeBidWall",
      accounts: [
        {
          name: "bidWall",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "feeRecipient",
          isMut: false,
          isSigner: false,
        },
        {
          name: "bidWallQuoteTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authorityQuoteTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "feeRecipientQuoteTokenAccount",
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
      args: [],
    },
    {
      name: "sellTokens",
      accounts: [
        {
          name: "bidWall",
          isMut: true,
          isSigner: false,
        },
        {
          name: "user",
          isMut: true,
          isSigner: true,
        },
        {
          name: "userTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userQuoteTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "bidWallQuoteTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "daoTreasury",
          isMut: false,
          isSigner: false,
        },
        {
          name: "daoTreasuryQuoteTokenAccount",
          isMut: false,
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
          name: "args",
          type: {
            defined: "SellTokensArgs",
          },
        },
      ],
    },
    {
      name: "collectFees",
      accounts: [
        {
          name: "bidWall",
          isMut: true,
          isSigner: false,
        },
        {
          name: "bidWallQuoteTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "feeRecipient",
          isMut: false,
          isSigner: false,
        },
        {
          name: "feeRecipientQuoteTokenAccount",
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
    {
      name: "cancelBidWall",
      accounts: [
        {
          name: "bidWall",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "feeRecipient",
          isMut: false,
          isSigner: false,
        },
        {
          name: "bidWallQuoteTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authorityQuoteTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "feeRecipientQuoteTokenAccount",
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
      args: [],
    },
  ],
  accounts: [
    {
      name: "bidWall",
      type: {
        kind: "struct",
        fields: [
          {
            name: "nonce",
            docs: ["The nonce of the bid wall."],
            type: "u64",
          },
          {
            name: "createdTimestamp",
            docs: ["When the bid wall was created."],
            type: "i64",
          },
          {
            name: "initialAmmQuoteReserves",
            docs: ["The initial quote (USDC) reserves of the Futarchy AMM."],
            type: "u64",
          },
          {
            name: "quoteAmount",
            docs: [
              "The current amount of quote tokens assigned to the bid wall.",
              "This is different from the amount in the bid wall quote token account,",
              "because anyone can transfer quote tokens to the bid wall, and we don't want that to affect the bid wall's NAV calculation.",
            ],
            type: "u64",
          },
          {
            name: "feesCollected",
            docs: ["The fees collected by the bid wall."],
            type: "u64",
          },
          {
            name: "baseBoughtAmount",
            docs: ["The amount of base tokens bought up by the bid wall."],
            type: "u64",
          },
          {
            name: "seqNum",
            docs: ["The event sequence number of the bid wall."],
            type: "u64",
          },
          {
            name: "creator",
            docs: ["The authority of the bid wall."],
            type: "publicKey",
          },
          {
            name: "authority",
            docs: ["The authority of the bid wall."],
            type: "publicKey",
          },
          {
            name: "daoTreasury",
            docs: ["The DAO treasury address."],
            type: "publicKey",
          },
          {
            name: "baseMint",
            docs: ["The mint of the token being sold into the bid wall."],
            type: "publicKey",
          },
          {
            name: "feeRecipient",
            docs: ["The recipient of the fees collected by the bid wall."],
            type: "publicKey",
          },
          {
            name: "durationSeconds",
            docs: [
              "The minimum duration in seconds before the bid wall can be closed.",
            ],
            type: "u32",
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
            name: "bidWallSeqNum",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "InitializeBidWallArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "amount",
            type: "u64",
          },
          {
            name: "nonce",
            type: "u64",
          },
          {
            name: "initialAmmQuoteReserves",
            type: "u64",
          },
          {
            name: "durationSeconds",
            type: "u32",
          },
        ],
      },
    },
    {
      name: "SellTokensArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "amountIn",
            type: "u64",
          },
        ],
      },
    },
  ],
  events: [
    {
      name: "BidWallInitializedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "bidWall",
          type: "publicKey",
          index: false,
        },
        {
          name: "nonce",
          type: "u64",
          index: false,
        },
        {
          name: "initialAmmQuoteReserves",
          type: "u64",
          index: false,
        },
        {
          name: "amount",
          type: "u64",
          index: false,
        },
        {
          name: "creator",
          type: "publicKey",
          index: false,
        },
        {
          name: "authority",
          type: "publicKey",
          index: false,
        },
        {
          name: "daoTreasury",
          type: "publicKey",
          index: false,
        },
        {
          name: "baseMint",
          type: "publicKey",
          index: false,
        },
        {
          name: "feeRecipient",
          type: "publicKey",
          index: false,
        },
        {
          name: "durationSeconds",
          type: "u32",
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
      name: "BidWallTokensSoldEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "bidWall",
          type: "publicKey",
          index: false,
        },
        {
          name: "amountIn",
          type: "u64",
          index: false,
        },
        {
          name: "amountOut",
          type: "u64",
          index: false,
        },
        {
          name: "fee",
          type: "u64",
          index: false,
        },
        {
          name: "postBidWallQuoteTokenAccountAmount",
          type: "u64",
          index: false,
        },
        {
          name: "postBidWallBaseBoughtAmount",
          type: "u64",
          index: false,
        },
        {
          name: "user",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "BidWallFeesCollectedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "bidWall",
          type: "publicKey",
          index: false,
        },
        {
          name: "feesCollected",
          type: "u64",
          index: false,
        },
        {
          name: "postBidWallQuoteTokenAccountAmount",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "BidWallClosedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "bidWall",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "BidWallCanceledEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "bidWall",
          type: "publicKey",
          index: false,
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "BidWallExpired",
      msg: "Bid wall expired",
    },
    {
      code: 6001,
      name: "BidWallNotExpired",
      msg: "Bid wall not expired",
    },
    {
      code: 6002,
      name: "FeeRecipientMismatch",
      msg: "Fee recipient mismatch",
    },
    {
      code: 6003,
      name: "InsufficientQuoteReserves",
      msg: "Insufficient quote reserves",
    },
    {
      code: 6004,
      name: "BidWallDepleted",
      msg: "Bid wall depleted",
    },
    {
      code: 6005,
      name: "InvalidInputAmount",
      msg: "Invalid input amount",
    },
  ],
};
