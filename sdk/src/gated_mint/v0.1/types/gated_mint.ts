export type GatedMint = {
  version: "0.1.0";
  name: "gated_mint";
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
      args: [
        {
          name: "args";
          type: {
            defined: "InitializeGatedMintArgs";
          };
        },
      ];
    },
    {
      name: "addWhitelistedUser";
      accounts: [
        {
          name: "gatedMintConfig";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "mint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "user";
          isMut: false;
          isSigner: false;
        },
        {
          name: "whitelistedUser";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
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
      name: "removeWhitelistedUser";
      accounts: [
        {
          name: "gatedMintConfig";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "mint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "user";
          isMut: false;
          isSigner: false;
        },
        {
          name: "whitelistedUser";
          isMut: true;
          isSigner: false;
        },
        {
          name: "rentDestination";
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
      name: "setWhitelistAdmin";
      accounts: [
        {
          name: "gatedMintConfig";
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
      args: [
        {
          name: "args";
          type: {
            defined: "SetWhitelistAdminArgs";
          };
        },
      ];
    },
    {
      name: "gatedInvoke";
      accounts: [
        {
          name: "caller";
          isMut: false;
          isSigner: true;
        },
        {
          name: "gatedMintConfig";
          isMut: true;
          isSigner: false;
        },
        {
          name: "whitelistedUser";
          isMut: false;
          isSigner: false;
        },
        {
          name: "mint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "targetProgram";
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
      args: [
        {
          name: "args";
          type: {
            defined: "GatedInvokeArgs";
          };
        },
      ];
    },
    {
      name: "disableGating";
      accounts: [
        {
          name: "gatedMintConfig";
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
      name: "thawAccount";
      accounts: [
        {
          name: "gatedMintConfig";
          isMut: true;
          isSigner: false;
        },
        {
          name: "mint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenAccount";
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
            name: "whitelistAdmin";
            type: {
              option: "publicKey";
            };
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
    {
      name: "GatedInvokeArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "instructionData";
            type: "bytes";
          },
        ];
      };
    },
    {
      name: "InitializeGatedMintArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "whitelistAdmin";
            type: {
              option: "publicKey";
            };
          },
        ];
      };
    },
    {
      name: "SetWhitelistAdminArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "whitelistAdmin";
            type: {
              option: "publicKey";
            };
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
          name: "whitelistAdmin";
          type: {
            option: "publicKey";
          };
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
        {
          name: "authority";
          type: "publicKey";
          index: false;
        },
      ];
    },
    {
      name: "WhitelistedUserRemovedEvent";
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
        {
          name: "authority";
          type: "publicKey";
          index: false;
        },
      ];
    },
    {
      name: "WhitelistAdminSetEvent";
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
          name: "previousWhitelistAdmin";
          type: {
            option: "publicKey";
          };
          index: false;
        },
        {
          name: "newWhitelistAdmin";
          type: {
            option: "publicKey";
          };
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
      msg: "Target program is not on the gated_mint whitelist";
    },
    {
      code: 6006;
      name: "SelfInvocation";
      msg: "Target program may not be the gated_mint program itself";
    },
    {
      code: 6007;
      name: "InvalidTokenAccount";
      msg: "Invalid token account: account is not a valid SPL Token account of the gated mint";
    },
    {
      code: 6008;
      name: "UnauthorizedWhitelistAuthority";
      msg: "Unauthorized: signer is neither admin nor whitelist admin";
    },
    {
      code: 6009;
      name: "InvalidWhitelistAdmin";
      msg: "Whitelist admin may not equal admin";
    },
  ];
};

export const IDL: GatedMint = {
  version: "0.1.0",
  name: "gated_mint",
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
      args: [
        {
          name: "args",
          type: {
            defined: "InitializeGatedMintArgs",
          },
        },
      ],
    },
    {
      name: "addWhitelistedUser",
      accounts: [
        {
          name: "gatedMintConfig",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "mint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "user",
          isMut: false,
          isSigner: false,
        },
        {
          name: "whitelistedUser",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
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
      name: "removeWhitelistedUser",
      accounts: [
        {
          name: "gatedMintConfig",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "mint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "user",
          isMut: false,
          isSigner: false,
        },
        {
          name: "whitelistedUser",
          isMut: true,
          isSigner: false,
        },
        {
          name: "rentDestination",
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
      name: "setWhitelistAdmin",
      accounts: [
        {
          name: "gatedMintConfig",
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
      args: [
        {
          name: "args",
          type: {
            defined: "SetWhitelistAdminArgs",
          },
        },
      ],
    },
    {
      name: "gatedInvoke",
      accounts: [
        {
          name: "caller",
          isMut: false,
          isSigner: true,
        },
        {
          name: "gatedMintConfig",
          isMut: true,
          isSigner: false,
        },
        {
          name: "whitelistedUser",
          isMut: false,
          isSigner: false,
        },
        {
          name: "mint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "targetProgram",
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
      args: [
        {
          name: "args",
          type: {
            defined: "GatedInvokeArgs",
          },
        },
      ],
    },
    {
      name: "disableGating",
      accounts: [
        {
          name: "gatedMintConfig",
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
      name: "thawAccount",
      accounts: [
        {
          name: "gatedMintConfig",
          isMut: true,
          isSigner: false,
        },
        {
          name: "mint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenAccount",
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
            name: "whitelistAdmin",
            type: {
              option: "publicKey",
            },
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
    {
      name: "GatedInvokeArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "instructionData",
            type: "bytes",
          },
        ],
      },
    },
    {
      name: "InitializeGatedMintArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "whitelistAdmin",
            type: {
              option: "publicKey",
            },
          },
        ],
      },
    },
    {
      name: "SetWhitelistAdminArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "whitelistAdmin",
            type: {
              option: "publicKey",
            },
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
          name: "whitelistAdmin",
          type: {
            option: "publicKey",
          },
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
        {
          name: "authority",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "WhitelistedUserRemovedEvent",
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
        {
          name: "authority",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "WhitelistAdminSetEvent",
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
          name: "previousWhitelistAdmin",
          type: {
            option: "publicKey",
          },
          index: false,
        },
        {
          name: "newWhitelistAdmin",
          type: {
            option: "publicKey",
          },
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
      msg: "Target program is not on the gated_mint whitelist",
    },
    {
      code: 6006,
      name: "SelfInvocation",
      msg: "Target program may not be the gated_mint program itself",
    },
    {
      code: 6007,
      name: "InvalidTokenAccount",
      msg: "Invalid token account: account is not a valid SPL Token account of the gated mint",
    },
    {
      code: 6008,
      name: "UnauthorizedWhitelistAuthority",
      msg: "Unauthorized: signer is neither admin nor whitelist admin",
    },
    {
      code: 6009,
      name: "InvalidWhitelistAdmin",
      msg: "Whitelist admin may not equal admin",
    },
  ],
};
