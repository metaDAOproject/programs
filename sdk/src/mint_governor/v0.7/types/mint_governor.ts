export type MintGovernor = {
  version: "0.7.0";
  name: "mint_governor";
  instructions: [
    {
      name: "initializeMintGovernor";
      accounts: [
        {
          name: "mint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "mintGovernor";
          isMut: true;
          isSigner: false;
        },
        {
          name: "createKey";
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
      name: "transferAuthorityToGovernor";
      accounts: [
        {
          name: "mintGovernor";
          isMut: true;
          isSigner: false;
        },
        {
          name: "mint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "currentAuthority";
          isMut: false;
          isSigner: true;
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
      name: "addMintAuthority";
      accounts: [
        {
          name: "mintGovernor";
          isMut: true;
          isSigner: false;
        },
        {
          name: "mintAuthority";
          isMut: true;
          isSigner: false;
        },
        {
          name: "admin";
          isMut: false;
          isSigner: true;
        },
        {
          name: "authorizedMinter";
          isMut: false;
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
      args: [
        {
          name: "args";
          type: {
            defined: "AddMintAuthorityArgs";
          };
        },
      ];
    },
    {
      name: "mintTokens";
      accounts: [
        {
          name: "mintGovernor";
          isMut: true;
          isSigner: false;
        },
        {
          name: "mintAuthority";
          isMut: true;
          isSigner: false;
        },
        {
          name: "mint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "destinationAta";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authorizedMinter";
          isMut: false;
          isSigner: true;
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
            defined: "MintTokensArgs";
          };
        },
      ];
    },
    {
      name: "updateMintAuthority";
      accounts: [
        {
          name: "mintGovernor";
          isMut: true;
          isSigner: false;
        },
        {
          name: "mintAuthority";
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
            defined: "UpdateMintAuthorityArgs";
          };
        },
      ];
    },
    {
      name: "removeMintAuthority";
      accounts: [
        {
          name: "mintGovernor";
          isMut: true;
          isSigner: false;
        },
        {
          name: "mintAuthority";
          isMut: true;
          isSigner: false;
        },
        {
          name: "admin";
          isMut: false;
          isSigner: true;
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
      name: "updateMintGovernorAdmin";
      accounts: [
        {
          name: "mintGovernor";
          isMut: true;
          isSigner: false;
        },
        {
          name: "admin";
          isMut: false;
          isSigner: true;
        },
        {
          name: "newAdmin";
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
      name: "reclaimAuthority";
      accounts: [
        {
          name: "mintGovernor";
          isMut: true;
          isSigner: false;
        },
        {
          name: "mint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "admin";
          isMut: false;
          isSigner: true;
        },
        {
          name: "newAuthority";
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
  ];
  accounts: [
    {
      name: "mintAuthority";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mintGovernor";
            type: "publicKey";
          },
          {
            name: "authorizedMinter";
            type: "publicKey";
          },
          {
            name: "maxTotal";
            type: {
              option: "u64";
            };
          },
          {
            name: "totalMinted";
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
      name: "mintGovernor";
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
            name: "createKey";
            type: "publicKey";
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
            name: "mintGovernorSeqNum";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "AddMintAuthorityArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "maxTotal";
            type: {
              option: "u64";
            };
          },
        ];
      };
    },
    {
      name: "MintTokensArgs";
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
      name: "UpdateMintAuthorityArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "maxTotal";
            type: {
              option: "u64";
            };
          },
        ];
      };
    },
  ];
  events: [
    {
      name: "MintGovernorInitializedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "mintGovernor";
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
          name: "createKey";
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
      name: "MintAuthorityTransferredEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "mintGovernor";
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
      name: "MintAuthorityAddedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "mintGovernor";
          type: "publicKey";
          index: false;
        },
        {
          name: "mintAuthority";
          type: "publicKey";
          index: false;
        },
        {
          name: "authorizedMinter";
          type: "publicKey";
          index: false;
        },
        {
          name: "maxTotal";
          type: {
            option: "u64";
          };
          index: false;
        },
      ];
    },
    {
      name: "TokensMintedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "mintGovernor";
          type: "publicKey";
          index: false;
        },
        {
          name: "mint";
          type: "publicKey";
          index: false;
        },
        {
          name: "authorizedMinter";
          type: "publicKey";
          index: false;
        },
        {
          name: "destinationAta";
          type: "publicKey";
          index: false;
        },
        {
          name: "amount";
          type: "u64";
          index: false;
        },
        {
          name: "postTotalMinted";
          type: "u64";
          index: false;
        },
        {
          name: "authorityMaxTotal";
          type: {
            option: "u64";
          };
          index: false;
        },
        {
          name: "postMintSupply";
          type: "u64";
          index: false;
        },
      ];
    },
    {
      name: "MintAuthorityUpdatedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "mintGovernor";
          type: "publicKey";
          index: false;
        },
        {
          name: "mintAuthority";
          type: "publicKey";
          index: false;
        },
        {
          name: "authorizedMinter";
          type: "publicKey";
          index: false;
        },
        {
          name: "maxTotal";
          type: {
            option: "u64";
          };
          index: false;
        },
        {
          name: "totalMinted";
          type: "u64";
          index: false;
        },
      ];
    },
    {
      name: "MintAuthorityRemovedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "mintGovernor";
          type: "publicKey";
          index: false;
        },
        {
          name: "mintAuthority";
          type: "publicKey";
          index: false;
        },
        {
          name: "authorizedMinter";
          type: "publicKey";
          index: false;
        },
        {
          name: "maxTotal";
          type: {
            option: "u64";
          };
          index: false;
        },
        {
          name: "totalMinted";
          type: "u64";
          index: false;
        },
      ];
    },
    {
      name: "MintGovernorAdminUpdatedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "mintGovernor";
          type: "publicKey";
          index: false;
        },
        {
          name: "newAdmin";
          type: "publicKey";
          index: false;
        },
      ];
    },
    {
      name: "MintAuthorityReclaimedEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "mintGovernor";
          type: "publicKey";
          index: false;
        },
        {
          name: "mint";
          type: "publicKey";
          index: false;
        },
        {
          name: "newAuthority";
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
      msg: "Unauthorized: signer is not the admin";
    },
    {
      code: 6001;
      name: "UnauthorizedMinter";
      msg: "Unauthorized: signer is not the authorized minter";
    },
    {
      code: 6002;
      name: "MintMismatch";
      msg: "Mint mismatch: mint_governor.mint does not match provided mint";
    },
    {
      code: 6003;
      name: "MintLimitExceeded";
      msg: "Mint limit exceeded: would exceed max_total";
    },
  ];
};

export const IDL: MintGovernor = {
  version: "0.7.0",
  name: "mint_governor",
  instructions: [
    {
      name: "initializeMintGovernor",
      accounts: [
        {
          name: "mint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "mintGovernor",
          isMut: true,
          isSigner: false,
        },
        {
          name: "createKey",
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
      name: "transferAuthorityToGovernor",
      accounts: [
        {
          name: "mintGovernor",
          isMut: true,
          isSigner: false,
        },
        {
          name: "mint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "currentAuthority",
          isMut: false,
          isSigner: true,
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
      name: "addMintAuthority",
      accounts: [
        {
          name: "mintGovernor",
          isMut: true,
          isSigner: false,
        },
        {
          name: "mintAuthority",
          isMut: true,
          isSigner: false,
        },
        {
          name: "admin",
          isMut: false,
          isSigner: true,
        },
        {
          name: "authorizedMinter",
          isMut: false,
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
      args: [
        {
          name: "args",
          type: {
            defined: "AddMintAuthorityArgs",
          },
        },
      ],
    },
    {
      name: "mintTokens",
      accounts: [
        {
          name: "mintGovernor",
          isMut: true,
          isSigner: false,
        },
        {
          name: "mintAuthority",
          isMut: true,
          isSigner: false,
        },
        {
          name: "mint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "destinationAta",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authorizedMinter",
          isMut: false,
          isSigner: true,
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
            defined: "MintTokensArgs",
          },
        },
      ],
    },
    {
      name: "updateMintAuthority",
      accounts: [
        {
          name: "mintGovernor",
          isMut: true,
          isSigner: false,
        },
        {
          name: "mintAuthority",
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
            defined: "UpdateMintAuthorityArgs",
          },
        },
      ],
    },
    {
      name: "removeMintAuthority",
      accounts: [
        {
          name: "mintGovernor",
          isMut: true,
          isSigner: false,
        },
        {
          name: "mintAuthority",
          isMut: true,
          isSigner: false,
        },
        {
          name: "admin",
          isMut: false,
          isSigner: true,
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
      name: "updateMintGovernorAdmin",
      accounts: [
        {
          name: "mintGovernor",
          isMut: true,
          isSigner: false,
        },
        {
          name: "admin",
          isMut: false,
          isSigner: true,
        },
        {
          name: "newAdmin",
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
      name: "reclaimAuthority",
      accounts: [
        {
          name: "mintGovernor",
          isMut: true,
          isSigner: false,
        },
        {
          name: "mint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "admin",
          isMut: false,
          isSigner: true,
        },
        {
          name: "newAuthority",
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
  ],
  accounts: [
    {
      name: "mintAuthority",
      type: {
        kind: "struct",
        fields: [
          {
            name: "mintGovernor",
            type: "publicKey",
          },
          {
            name: "authorizedMinter",
            type: "publicKey",
          },
          {
            name: "maxTotal",
            type: {
              option: "u64",
            },
          },
          {
            name: "totalMinted",
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
      name: "mintGovernor",
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
            name: "createKey",
            type: "publicKey",
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
            name: "mintGovernorSeqNum",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "AddMintAuthorityArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "maxTotal",
            type: {
              option: "u64",
            },
          },
        ],
      },
    },
    {
      name: "MintTokensArgs",
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
      name: "UpdateMintAuthorityArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "maxTotal",
            type: {
              option: "u64",
            },
          },
        ],
      },
    },
  ],
  events: [
    {
      name: "MintGovernorInitializedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "mintGovernor",
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
          name: "createKey",
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
      name: "MintAuthorityTransferredEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "mintGovernor",
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
      name: "MintAuthorityAddedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "mintGovernor",
          type: "publicKey",
          index: false,
        },
        {
          name: "mintAuthority",
          type: "publicKey",
          index: false,
        },
        {
          name: "authorizedMinter",
          type: "publicKey",
          index: false,
        },
        {
          name: "maxTotal",
          type: {
            option: "u64",
          },
          index: false,
        },
      ],
    },
    {
      name: "TokensMintedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "mintGovernor",
          type: "publicKey",
          index: false,
        },
        {
          name: "mint",
          type: "publicKey",
          index: false,
        },
        {
          name: "authorizedMinter",
          type: "publicKey",
          index: false,
        },
        {
          name: "destinationAta",
          type: "publicKey",
          index: false,
        },
        {
          name: "amount",
          type: "u64",
          index: false,
        },
        {
          name: "postTotalMinted",
          type: "u64",
          index: false,
        },
        {
          name: "authorityMaxTotal",
          type: {
            option: "u64",
          },
          index: false,
        },
        {
          name: "postMintSupply",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "MintAuthorityUpdatedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "mintGovernor",
          type: "publicKey",
          index: false,
        },
        {
          name: "mintAuthority",
          type: "publicKey",
          index: false,
        },
        {
          name: "authorizedMinter",
          type: "publicKey",
          index: false,
        },
        {
          name: "maxTotal",
          type: {
            option: "u64",
          },
          index: false,
        },
        {
          name: "totalMinted",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "MintAuthorityRemovedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "mintGovernor",
          type: "publicKey",
          index: false,
        },
        {
          name: "mintAuthority",
          type: "publicKey",
          index: false,
        },
        {
          name: "authorizedMinter",
          type: "publicKey",
          index: false,
        },
        {
          name: "maxTotal",
          type: {
            option: "u64",
          },
          index: false,
        },
        {
          name: "totalMinted",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "MintGovernorAdminUpdatedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "mintGovernor",
          type: "publicKey",
          index: false,
        },
        {
          name: "newAdmin",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "MintAuthorityReclaimedEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "mintGovernor",
          type: "publicKey",
          index: false,
        },
        {
          name: "mint",
          type: "publicKey",
          index: false,
        },
        {
          name: "newAuthority",
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
      msg: "Unauthorized: signer is not the admin",
    },
    {
      code: 6001,
      name: "UnauthorizedMinter",
      msg: "Unauthorized: signer is not the authorized minter",
    },
    {
      code: 6002,
      name: "MintMismatch",
      msg: "Mint mismatch: mint_governor.mint does not match provided mint",
    },
    {
      code: 6003,
      name: "MintLimitExceeded",
      msg: "Mint limit exceeded: would exceed max_total",
    },
  ],
};
