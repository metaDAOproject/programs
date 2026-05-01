export type GatedToken = {
  version: "0.1.0";
  name: "gated_token";
  instructions: [
    {
      name: "initializeGatedMint";
      accounts: [
        {
          name: "mint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "gatedMintConfig";
          isMut: true;
          isSigner: false;
        },
        {
          name: "currentFreezeAuthority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "admin";
          isMut: false;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
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
      name: "gatedMintConfig";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "publicKey";
          },
          {
            name: "admin";
            type: "publicKey";
          },
          {
            name: "gatingDisabled";
            type: "bool";
          },
          {
            name: "seqNum";
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
      name: "whitelistedUser";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "publicKey";
          },
          {
            name: "user";
            type: "publicKey";
          },
          {
            name: "bump";
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
            name: "gatedMintConfigSeqNum";
            type: "u64";
          },
        ];
      };
    },
  ];
  events: [
    {
      name: "GatedMintInitializedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "gatedMintConfig";
          type: "publicKey";
          index: false;
        },
        {
          name: "mint";
          type: "publicKey";
          index: false;
        },
        {
          name: "admin";
          type: "publicKey";
          index: false;
        },
        {
          name: "previousFreezeAuthority";
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
      name: "WhitelistedUserAddedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "gatedMintConfig";
          type: "publicKey";
          index: false;
        },
        {
          name: "whitelistedUser";
          type: "publicKey";
          index: false;
        },
        {
          name: "mint";
          type: "publicKey";
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
      name: "GatedInvokeEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "gatedMintConfig";
          type: "publicKey";
          index: false;
        },
        {
          name: "mint";
          type: "publicKey";
          index: false;
        },
        {
          name: "caller";
          type: "publicKey";
          index: false;
        },
        {
          name: "targetProgram";
          type: "publicKey";
          index: false;
        },
        {
          name: "thawedCount";
          type: "u32";
          index: false;
        },
        {
          name: "frozenCount";
          type: "u32";
          index: false;
        },
      ];
    },
    {
      name: "GatingDisabledEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "gatedMintConfig";
          type: "publicKey";
          index: false;
        },
        {
          name: "mint";
          type: "publicKey";
          index: false;
        },
      ];
    },
    {
      name: "AccountThawedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "gatedMintConfig";
          type: "publicKey";
          index: false;
        },
        {
          name: "mint";
          type: "publicKey";
          index: false;
        },
        {
          name: "tokenAccount";
          type: "publicKey";
          index: false;
        },
      ];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "UnauthorizedAdmin";
      msg: "Unauthorized: signer is not the gated mint admin";
    },
    {
      code: 6001;
      name: "UnauthorizedFreezeAuthority";
      msg: "Unauthorized: signer is not the current freeze authority of the mint";
    },
    {
      code: 6002;
      name: "MintMismatch";
      msg: "Mint mismatch: account does not match the expected gated mint";
    },
    {
      code: 6003;
      name: "GatingDisabled";
      msg: "Gating is already disabled for this mint";
    },
    {
      code: 6004;
      name: "GatingNotDisabled";
      msg: "Gating must be disabled to call this instruction";
    },
    {
      code: 6005;
      name: "TargetProgramNotWhitelisted";
      msg: "Target program is not on the gated_token whitelist";
    },
    {
      code: 6006;
      name: "SelfInvocation";
      msg: "Target program may not be the gated_token program itself";
    },
    {
      code: 6007;
      name: "InvalidTokenAccount";
      msg: "Invalid token account: account is not a valid SPL Token account of the gated mint";
    },
  ];
};

export const IDL: GatedToken = {
  version: "0.1.0",
  name: "gated_token",
  instructions: [
    {
      name: "initializeGatedMint",
      accounts: [
        {
          name: "mint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "gatedMintConfig",
          isMut: true,
          isSigner: false,
        },
        {
          name: "currentFreezeAuthority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "admin",
          isMut: false,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
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
      name: "gatedMintConfig",
      type: {
        kind: "struct",
        fields: [
          {
            name: "mint",
            type: "publicKey",
          },
          {
            name: "admin",
            type: "publicKey",
          },
          {
            name: "gatingDisabled",
            type: "bool",
          },
          {
            name: "seqNum",
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
      name: "whitelistedUser",
      type: {
        kind: "struct",
        fields: [
          {
            name: "mint",
            type: "publicKey",
          },
          {
            name: "user",
            type: "publicKey",
          },
          {
            name: "bump",
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
            name: "gatedMintConfigSeqNum",
            type: "u64",
          },
        ],
      },
    },
  ],
  events: [
    {
      name: "GatedMintInitializedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "gatedMintConfig",
          type: "publicKey",
          index: false,
        },
        {
          name: "mint",
          type: "publicKey",
          index: false,
        },
        {
          name: "admin",
          type: "publicKey",
          index: false,
        },
        {
          name: "previousFreezeAuthority",
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
      name: "WhitelistedUserAddedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "gatedMintConfig",
          type: "publicKey",
          index: false,
        },
        {
          name: "whitelistedUser",
          type: "publicKey",
          index: false,
        },
        {
          name: "mint",
          type: "publicKey",
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
      name: "GatedInvokeEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "gatedMintConfig",
          type: "publicKey",
          index: false,
        },
        {
          name: "mint",
          type: "publicKey",
          index: false,
        },
        {
          name: "caller",
          type: "publicKey",
          index: false,
        },
        {
          name: "targetProgram",
          type: "publicKey",
          index: false,
        },
        {
          name: "thawedCount",
          type: "u32",
          index: false,
        },
        {
          name: "frozenCount",
          type: "u32",
          index: false,
        },
      ],
    },
    {
      name: "GatingDisabledEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "gatedMintConfig",
          type: "publicKey",
          index: false,
        },
        {
          name: "mint",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "AccountThawedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "gatedMintConfig",
          type: "publicKey",
          index: false,
        },
        {
          name: "mint",
          type: "publicKey",
          index: false,
        },
        {
          name: "tokenAccount",
          type: "publicKey",
          index: false,
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "UnauthorizedAdmin",
      msg: "Unauthorized: signer is not the gated mint admin",
    },
    {
      code: 6001,
      name: "UnauthorizedFreezeAuthority",
      msg: "Unauthorized: signer is not the current freeze authority of the mint",
    },
    {
      code: 6002,
      name: "MintMismatch",
      msg: "Mint mismatch: account does not match the expected gated mint",
    },
    {
      code: 6003,
      name: "GatingDisabled",
      msg: "Gating is already disabled for this mint",
    },
    {
      code: 6004,
      name: "GatingNotDisabled",
      msg: "Gating must be disabled to call this instruction",
    },
    {
      code: 6005,
      name: "TargetProgramNotWhitelisted",
      msg: "Target program is not on the gated_token whitelist",
    },
    {
      code: 6006,
      name: "SelfInvocation",
      msg: "Target program may not be the gated_token program itself",
    },
    {
      code: 6007,
      name: "InvalidTokenAccount",
      msg: "Invalid token account: account is not a valid SPL Token account of the gated mint",
    },
  ],
};
