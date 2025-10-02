export type Redemption = {
  version: "0.1.0";
  name: "redemption";
  instructions: [
    {
      name: "initRedemptionConfig";
      accounts: [
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "redeemConfig";
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
      ];
      args: [
        {
          name: "maxRedeemAmount";
          type: "u64";
        },
        {
          name: "burnToken";
          type: "bool";
        },
      ];
    },
    {
      name: "triggerRedemption";
      accounts: [
        {
          name: "redemption";
          isMut: true;
          isSigner: false;
        },
        {
          name: "redeemConfig";
          isMut: true;
          isSigner: false;
        },
        {
          name: "incomingMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "user";
          isMut: false;
          isSigner: true;
        },
        {
          name: "userIncomingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userOutgoingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
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
  ];
  accounts: [
    {
      name: "redemption";
      type: {
        kind: "struct";
        fields: [
          {
            name: "authority";
            type: "publicKey";
          },
          {
            name: "maxRedeemAmount";
            type: "u64";
          },
          {
            name: "incomingMint";
            type: "publicKey";
          },
          {
            name: "vault";
            type: "publicKey";
          },
          {
            name: "burnToken";
            type: "bool";
          },
          {
            name: "redeemedAmount";
            type: "u64";
          },
          {
            name: "bump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "redeemConfig";
      type: {
        kind: "struct";
        fields: [
          {
            name: "authority";
            type: "publicKey";
          },
          {
            name: "maxRedeemAmount";
            type: "u64";
          },
          {
            name: "burnToken";
            type: "bool";
          },
          {
            name: "bump";
            type: "u8";
          },
        ];
      };
    },
  ];
  errors: [
    {
      code: 6000;
      name: "RedeemAmountExceedsMaxRedeemAmount";
      msg: "Redeem amount exceeds max redeem amount";
    },
    {
      code: 6001;
      name: "Overflow";
      msg: "Overflow";
    },
  ];
};

export const IDL: Redemption = {
  version: "0.1.0",
  name: "redemption",
  instructions: [
    {
      name: "initRedemptionConfig",
      accounts: [
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "redeemConfig",
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
      ],
      args: [
        {
          name: "maxRedeemAmount",
          type: "u64",
        },
        {
          name: "burnToken",
          type: "bool",
        },
      ],
    },
    {
      name: "triggerRedemption",
      accounts: [
        {
          name: "redemption",
          isMut: true,
          isSigner: false,
        },
        {
          name: "redeemConfig",
          isMut: true,
          isSigner: false,
        },
        {
          name: "incomingMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "user",
          isMut: false,
          isSigner: true,
        },
        {
          name: "userIncomingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userOutgoingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
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
  ],
  accounts: [
    {
      name: "redemption",
      type: {
        kind: "struct",
        fields: [
          {
            name: "authority",
            type: "publicKey",
          },
          {
            name: "maxRedeemAmount",
            type: "u64",
          },
          {
            name: "incomingMint",
            type: "publicKey",
          },
          {
            name: "vault",
            type: "publicKey",
          },
          {
            name: "burnToken",
            type: "bool",
          },
          {
            name: "redeemedAmount",
            type: "u64",
          },
          {
            name: "bump",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "redeemConfig",
      type: {
        kind: "struct",
        fields: [
          {
            name: "authority",
            type: "publicKey",
          },
          {
            name: "maxRedeemAmount",
            type: "u64",
          },
          {
            name: "burnToken",
            type: "bool",
          },
          {
            name: "bump",
            type: "u8",
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: "RedeemAmountExceedsMaxRedeemAmount",
      msg: "Redeem amount exceeds max redeem amount",
    },
    {
      code: 6001,
      name: "Overflow",
      msg: "Overflow",
    },
  ],
};
