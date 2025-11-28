export type BidWall = {
  version: "0.6.0";
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
          name: "authority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "bidWallUsdcTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authorityUsdcTokenAccount";
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
          isSigner: true;
        },
        {
          name: "feeRecipient";
          isMut: false;
          isSigner: false;
        },
        {
          name: "bidWallUsdcTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authorityUsdcTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "feeRecipientUsdcTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "baseMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "usdcMint";
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
          name: "userUsdcTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "bidWallUsdcTokenAccount";
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
  ];
  accounts: [
    {
      name: "bidWall";
      type: {
        kind: "struct";
        fields: [
          {
            name: "createdTimestamp";
            docs: ["When the bid wall was created."];
            type: "i64";
          },
          {
            name: "feesCollected";
            docs: ["The fees collected by the bid wall."];
            type: "u64";
          },
          {
            name: "initialAmmBaseReserves";
            docs: ["The initial base reserves of the Futarchy AMM."];
            type: "u64";
          },
          {
            name: "initialAmmQuoteReserves";
            docs: ["The initial quote (USDC) reserves of the Futarchy AMM."];
            type: "u64";
          },
          {
            name: "authority";
            docs: ["The authority of the bid wall."];
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
            name: "minDuration";
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
      name: "InitializeBidWallArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "initialAmmBaseReserves";
            type: "u64";
          },
          {
            name: "initialAmmQuoteReserves";
            type: "u64";
          },
          {
            name: "minDuration";
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
  errors: [
    {
      code: 6000;
      name: "BidWallNotExpired";
      msg: "Bid wall not expired";
    },
  ];
};

export const IDL: BidWall = {
  version: "0.6.0",
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
          name: "authority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "bidWallUsdcTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authorityUsdcTokenAccount",
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
          isSigner: true,
        },
        {
          name: "feeRecipient",
          isMut: false,
          isSigner: false,
        },
        {
          name: "bidWallUsdcTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authorityUsdcTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "feeRecipientUsdcTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "baseMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "usdcMint",
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
          name: "userUsdcTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "bidWallUsdcTokenAccount",
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
  ],
  accounts: [
    {
      name: "bidWall",
      type: {
        kind: "struct",
        fields: [
          {
            name: "createdTimestamp",
            docs: ["When the bid wall was created."],
            type: "i64",
          },
          {
            name: "feesCollected",
            docs: ["The fees collected by the bid wall."],
            type: "u64",
          },
          {
            name: "initialAmmBaseReserves",
            docs: ["The initial base reserves of the Futarchy AMM."],
            type: "u64",
          },
          {
            name: "initialAmmQuoteReserves",
            docs: ["The initial quote (USDC) reserves of the Futarchy AMM."],
            type: "u64",
          },
          {
            name: "authority",
            docs: ["The authority of the bid wall."],
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
            name: "minDuration",
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
      name: "InitializeBidWallArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "amount",
            type: "u64",
          },
          {
            name: "initialAmmBaseReserves",
            type: "u64",
          },
          {
            name: "initialAmmQuoteReserves",
            type: "u64",
          },
          {
            name: "minDuration",
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
  errors: [
    {
      code: 6000,
      name: "BidWallNotExpired",
      msg: "Bid wall not expired",
    },
  ],
};
