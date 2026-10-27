/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/gated_mint.json`.
 */
export type GatedMint = {
  address: "GaTEjZy6eMdHg2BcL8dk3iE78jkJ9sPtyw1q2tMNi8PA";
  metadata: {
    name: "gatedMint";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "addWhitelistedUser";
      discriminator: [211, 199, 16, 14, 43, 46, 211, 130];
      accounts: [
        {
          name: "gatedMintConfig";
          writable: true;
        },
        {
          name: "authority";
          signer: true;
        },
        {
          name: "mint";
          relations: ["gatedMintConfig"];
        },
        {
          name: "user";
        },
        {
          name: "whitelistedUser";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  119,
                  104,
                  105,
                  116,
                  101,
                  108,
                  105,
                  115,
                  116,
                  101,
                  100,
                  95,
                  117,
                  115,
                  101,
                  114,
                ];
              },
              {
                kind: "account";
                path: "mint";
              },
              {
                kind: "account";
                path: "user";
              },
            ];
          };
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "eventAuthority";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ];
              },
            ];
          };
        },
        {
          name: "program";
        },
      ];
      args: [];
    },
    {
      name: "disableGating";
      discriminator: [26, 134, 241, 15, 176, 212, 81, 205];
      accounts: [
        {
          name: "gatedMintConfig";
          writable: true;
        },
        {
          name: "admin";
          signer: true;
        },
        {
          name: "eventAuthority";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ];
              },
            ];
          };
        },
        {
          name: "program";
        },
      ];
      args: [];
    },
    {
      name: "gatedInvoke";
      discriminator: [253, 225, 179, 175, 187, 144, 104, 247];
      accounts: [
        {
          name: "caller";
          signer: true;
        },
        {
          name: "gatedMintConfig";
          writable: true;
        },
        {
          name: "whitelistedUser";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  119,
                  104,
                  105,
                  116,
                  101,
                  108,
                  105,
                  115,
                  116,
                  101,
                  100,
                  95,
                  117,
                  115,
                  101,
                  114,
                ];
              },
              {
                kind: "account";
                path: "mint";
              },
              {
                kind: "account";
                path: "caller";
              },
            ];
          };
        },
        {
          name: "mint";
          relations: ["gatedMintConfig", "whitelistedUser"];
        },
        {
          name: "targetProgram";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "eventAuthority";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ];
              },
            ];
          };
        },
        {
          name: "program";
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "gatedInvokeArgs";
            };
          };
        },
      ];
    },
    {
      name: "initializeGatedMint";
      discriminator: [104, 52, 160, 240, 89, 118, 217, 147];
      accounts: [
        {
          name: "mint";
          writable: true;
        },
        {
          name: "gatedMintConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  103,
                  97,
                  116,
                  101,
                  100,
                  95,
                  109,
                  105,
                  110,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                ];
              },
              {
                kind: "account";
                path: "mint";
              },
            ];
          };
        },
        {
          name: "currentFreezeAuthority";
          signer: true;
        },
        {
          name: "admin";
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "eventAuthority";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ];
              },
            ];
          };
        },
        {
          name: "program";
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "initializeGatedMintArgs";
            };
          };
        },
      ];
    },
    {
      name: "removeWhitelistedUser";
      discriminator: [231, 10, 54, 151, 190, 230, 82, 6];
      accounts: [
        {
          name: "gatedMintConfig";
          writable: true;
        },
        {
          name: "authority";
          signer: true;
        },
        {
          name: "mint";
          relations: ["gatedMintConfig", "whitelistedUser"];
        },
        {
          name: "user";
        },
        {
          name: "whitelistedUser";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  119,
                  104,
                  105,
                  116,
                  101,
                  108,
                  105,
                  115,
                  116,
                  101,
                  100,
                  95,
                  117,
                  115,
                  101,
                  114,
                ];
              },
              {
                kind: "account";
                path: "mint";
              },
              {
                kind: "account";
                path: "user";
              },
            ];
          };
        },
        {
          name: "rentDestination";
          writable: true;
        },
        {
          name: "eventAuthority";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ];
              },
            ];
          };
        },
        {
          name: "program";
        },
      ];
      args: [];
    },
    {
      name: "setWhitelistAdmin";
      discriminator: [224, 247, 186, 24, 93, 98, 152, 25];
      accounts: [
        {
          name: "gatedMintConfig";
          writable: true;
        },
        {
          name: "admin";
          signer: true;
        },
        {
          name: "eventAuthority";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ];
              },
            ];
          };
        },
        {
          name: "program";
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "setWhitelistAdminArgs";
            };
          };
        },
      ];
    },
    {
      name: "thawAccount";
      discriminator: [115, 152, 79, 213, 213, 169, 184, 35];
      accounts: [
        {
          name: "gatedMintConfig";
          writable: true;
        },
        {
          name: "mint";
          relations: ["gatedMintConfig"];
        },
        {
          name: "tokenAccount";
          writable: true;
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "eventAuthority";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121,
                ];
              },
            ];
          };
        },
        {
          name: "program";
        },
      ];
      args: [];
    },
  ];
  accounts: [
    {
      name: "gatedMintConfig";
      discriminator: [58, 25, 220, 64, 205, 99, 235, 87];
    },
    {
      name: "whitelistedUser";
      discriminator: [156, 78, 95, 223, 72, 234, 174, 85];
    },
  ];
  events: [
    {
      name: "accountThawedEvent";
      discriminator: [172, 202, 68, 155, 173, 98, 79, 74];
    },
    {
      name: "gatedInvokeEvent";
      discriminator: [111, 20, 226, 55, 0, 110, 86, 58];
    },
    {
      name: "gatedMintInitializedEvent";
      discriminator: [34, 94, 74, 87, 153, 151, 220, 10];
    },
    {
      name: "gatingDisabledEvent";
      discriminator: [183, 85, 68, 72, 163, 69, 125, 149];
    },
    {
      name: "whitelistAdminSetEvent";
      discriminator: [59, 215, 174, 4, 139, 231, 18, 173];
    },
    {
      name: "whitelistedUserAddedEvent";
      discriminator: [6, 53, 76, 25, 100, 133, 240, 41];
    },
    {
      name: "whitelistedUserRemovedEvent";
      discriminator: [28, 48, 239, 140, 118, 240, 96, 109];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "unauthorizedAdmin";
      msg: "Unauthorized: signer is not the gated mint admin";
    },
    {
      code: 6001;
      name: "unauthorizedFreezeAuthority";
      msg: "Unauthorized: signer is not the current freeze authority of the mint";
    },
    {
      code: 6002;
      name: "mintMismatch";
      msg: "Mint mismatch: account does not match the expected gated mint";
    },
    {
      code: 6003;
      name: "gatingDisabled";
      msg: "Gating is already disabled for this mint";
    },
    {
      code: 6004;
      name: "gatingNotDisabled";
      msg: "Gating must be disabled to call this instruction";
    },
    {
      code: 6005;
      name: "targetProgramNotWhitelisted";
      msg: "Target program is not on the gated_mint whitelist";
    },
    {
      code: 6006;
      name: "selfInvocation";
      msg: "Target program may not be the gated_mint program itself";
    },
    {
      code: 6007;
      name: "invalidTokenAccount";
      msg: "Invalid token account: account is not a valid SPL Token account of the gated mint";
    },
    {
      code: 6008;
      name: "unauthorizedWhitelistAuthority";
      msg: "Unauthorized: signer is neither admin nor whitelist admin";
    },
    {
      code: 6009;
      name: "invalidWhitelistAdmin";
      msg: "Whitelist admin may not equal admin";
    },
  ];
  types: [
    {
      name: "accountThawedEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "gatedMintConfig";
            type: "pubkey";
          },
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "tokenAccount";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "commonFields";
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
      name: "gatedInvokeArgs";
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
      name: "gatedInvokeEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "gatedMintConfig";
            type: "pubkey";
          },
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "caller";
            type: "pubkey";
          },
          {
            name: "targetProgram";
            type: "pubkey";
          },
          {
            name: "thawedCount";
            type: "u32";
          },
          {
            name: "frozenCount";
            type: "u32";
          },
        ];
      };
    },
    {
      name: "gatedMintConfig";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "admin";
            type: "pubkey";
          },
          {
            name: "whitelistAdmin";
            type: {
              option: "pubkey";
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
      name: "gatedMintInitializedEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "gatedMintConfig";
            type: "pubkey";
          },
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "admin";
            type: "pubkey";
          },
          {
            name: "whitelistAdmin";
            type: {
              option: "pubkey";
            };
          },
          {
            name: "previousFreezeAuthority";
            type: "pubkey";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "gatingDisabledEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "gatedMintConfig";
            type: "pubkey";
          },
          {
            name: "mint";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "initializeGatedMintArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "whitelistAdmin";
            type: {
              option: "pubkey";
            };
          },
        ];
      };
    },
    {
      name: "setWhitelistAdminArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "whitelistAdmin";
            type: {
              option: "pubkey";
            };
          },
        ];
      };
    },
    {
      name: "whitelistAdminSetEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "gatedMintConfig";
            type: "pubkey";
          },
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "previousWhitelistAdmin";
            type: {
              option: "pubkey";
            };
          },
          {
            name: "newWhitelistAdmin";
            type: {
              option: "pubkey";
            };
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
            type: "pubkey";
          },
          {
            name: "user";
            type: "pubkey";
          },
          {
            name: "bump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "whitelistedUserAddedEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "gatedMintConfig";
            type: "pubkey";
          },
          {
            name: "whitelistedUser";
            type: "pubkey";
          },
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "user";
            type: "pubkey";
          },
          {
            name: "authority";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "whitelistedUserRemovedEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "common";
            type: {
              defined: {
                name: "commonFields";
              };
            };
          },
          {
            name: "gatedMintConfig";
            type: "pubkey";
          },
          {
            name: "whitelistedUser";
            type: "pubkey";
          },
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "user";
            type: "pubkey";
          },
          {
            name: "authority";
            type: "pubkey";
          },
        ];
      };
    },
  ];
};
