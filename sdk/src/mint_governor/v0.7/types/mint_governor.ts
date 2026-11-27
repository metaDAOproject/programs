/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/mint_governor.json`.
 */
export type MintGovernor = {
  address: "gvnr27cVeyW3AVf3acL7VCJ5WjGAphytnsgcK1feHyH";
  metadata: {
    name: "mintGovernor";
    version: "0.7.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "addMintAuthority";
      discriminator: [41, 254, 251, 123, 155, 68, 213, 8];
      accounts: [
        {
          name: "mintGovernor";
          writable: true;
        },
        {
          name: "mintAuthority";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  109,
                  105,
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
              {
                kind: "account";
                path: "mintGovernor";
              },
              {
                kind: "account";
                path: "authorizedMinter";
              },
            ];
          };
        },
        {
          name: "admin";
          signer: true;
        },
        {
          name: "authorizedMinter";
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
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "addMintAuthorityArgs";
            };
          };
        },
      ];
    },
    {
      name: "initializeMintGovernor";
      discriminator: [198, 71, 122, 52, 99, 36, 35, 197];
      accounts: [
        {
          name: "mint";
        },
        {
          name: "mintGovernor";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  109,
                  105,
                  110,
                  116,
                  95,
                  103,
                  111,
                  118,
                  101,
                  114,
                  110,
                  111,
                  114,
                ];
              },
              {
                kind: "account";
                path: "mint";
              },
              {
                kind: "account";
                path: "createKey";
              },
            ];
          };
        },
        {
          name: "createKey";
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
      name: "mintTokens";
      discriminator: [59, 132, 24, 246, 122, 39, 8, 243];
      accounts: [
        {
          name: "mintGovernor";
          writable: true;
          relations: ["mintAuthority"];
        },
        {
          name: "mintAuthority";
          writable: true;
        },
        {
          name: "mint";
          writable: true;
          relations: ["destinationAta"];
        },
        {
          name: "destinationAta";
          writable: true;
        },
        {
          name: "authorizedMinter";
          signer: true;
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
              name: "mintTokensArgs";
            };
          };
        },
      ];
    },
    {
      name: "reclaimAuthority";
      discriminator: [156, 147, 67, 113, 251, 229, 162, 166];
      accounts: [
        {
          name: "mintGovernor";
          writable: true;
        },
        {
          name: "mint";
          writable: true;
        },
        {
          name: "admin";
          signer: true;
        },
        {
          name: "newAuthority";
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
    {
      name: "removeMintAuthority";
      discriminator: [33, 207, 52, 111, 106, 97, 9, 63];
      accounts: [
        {
          name: "mintGovernor";
          writable: true;
          relations: ["mintAuthority"];
        },
        {
          name: "mintAuthority";
          writable: true;
        },
        {
          name: "admin";
          signer: true;
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
      name: "transferAuthorityToGovernor";
      discriminator: [14, 48, 149, 50, 10, 197, 115, 141];
      accounts: [
        {
          name: "mintGovernor";
          writable: true;
        },
        {
          name: "mint";
          writable: true;
        },
        {
          name: "currentAuthority";
          signer: true;
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
    {
      name: "updateMintAuthority";
      discriminator: [103, 51, 57, 197, 223, 22, 44, 142];
      accounts: [
        {
          name: "mintGovernor";
          writable: true;
          relations: ["mintAuthority"];
        },
        {
          name: "mintAuthority";
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
              name: "updateMintAuthorityArgs";
            };
          };
        },
      ];
    },
    {
      name: "updateMintGovernorAdmin";
      discriminator: [13, 24, 126, 16, 56, 4, 123, 179];
      accounts: [
        {
          name: "mintGovernor";
          writable: true;
        },
        {
          name: "admin";
          signer: true;
        },
        {
          name: "newAdmin";
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
      name: "mintAuthority";
      discriminator: [148, 0, 219, 228, 254, 237, 76, 128];
    },
    {
      name: "mintGovernor";
      discriminator: [110, 173, 19, 114, 217, 193, 37, 71];
    },
  ];
  events: [
    {
      name: "mintAuthorityAddedEvent";
      discriminator: [169, 138, 119, 137, 190, 104, 6, 248];
    },
    {
      name: "mintAuthorityReclaimedEvent";
      discriminator: [230, 206, 54, 112, 17, 252, 238, 136];
    },
    {
      name: "mintAuthorityRemovedEvent";
      discriminator: [33, 191, 194, 66, 228, 81, 72, 195];
    },
    {
      name: "mintAuthorityTransferredEvent";
      discriminator: [205, 127, 250, 250, 151, 40, 121, 49];
    },
    {
      name: "mintAuthorityUpdatedEvent";
      discriminator: [62, 240, 230, 80, 136, 231, 9, 75];
    },
    {
      name: "mintGovernorAdminUpdatedEvent";
      discriminator: [65, 63, 211, 60, 91, 209, 207, 132];
    },
    {
      name: "mintGovernorInitializedEvent";
      discriminator: [19, 13, 254, 0, 215, 154, 195, 136];
    },
    {
      name: "tokensMintedEvent";
      discriminator: [197, 87, 251, 124, 83, 45, 57, 62];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "unauthorizedAdmin";
      msg: "Unauthorized: signer is not the admin";
    },
    {
      code: 6001;
      name: "unauthorizedMinter";
      msg: "Unauthorized: signer is not the authorized minter";
    },
    {
      code: 6002;
      name: "mintMismatch";
      msg: "Mint mismatch: mint_governor.mint does not match provided mint";
    },
    {
      code: 6003;
      name: "mintLimitExceeded";
      msg: "Mint limit exceeded: would exceed max_total";
    },
  ];
  types: [
    {
      name: "addMintAuthorityArgs";
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
            name: "mintGovernorSeqNum";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "mintAuthority";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mintGovernor";
            type: "pubkey";
          },
          {
            name: "authorizedMinter";
            type: "pubkey";
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
      name: "mintAuthorityAddedEvent";
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
            name: "mintGovernor";
            type: "pubkey";
          },
          {
            name: "mintAuthority";
            type: "pubkey";
          },
          {
            name: "authorizedMinter";
            type: "pubkey";
          },
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
      name: "mintAuthorityReclaimedEvent";
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
            name: "mintGovernor";
            type: "pubkey";
          },
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "newAuthority";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "mintAuthorityRemovedEvent";
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
            name: "mintGovernor";
            type: "pubkey";
          },
          {
            name: "mintAuthority";
            type: "pubkey";
          },
          {
            name: "authorizedMinter";
            type: "pubkey";
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
        ];
      };
    },
    {
      name: "mintAuthorityTransferredEvent";
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
            name: "mintGovernor";
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
      name: "mintAuthorityUpdatedEvent";
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
            name: "mintGovernor";
            type: "pubkey";
          },
          {
            name: "mintAuthority";
            type: "pubkey";
          },
          {
            name: "authorizedMinter";
            type: "pubkey";
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
            type: "pubkey";
          },
          {
            name: "admin";
            type: "pubkey";
          },
          {
            name: "createKey";
            type: "pubkey";
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
      name: "mintGovernorAdminUpdatedEvent";
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
            name: "mintGovernor";
            type: "pubkey";
          },
          {
            name: "newAdmin";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "mintGovernorInitializedEvent";
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
            name: "mintGovernor";
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
            name: "createKey";
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
      name: "mintTokensArgs";
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
      name: "tokensMintedEvent";
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
            name: "mintGovernor";
            type: "pubkey";
          },
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "authorizedMinter";
            type: "pubkey";
          },
          {
            name: "destinationAta";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "postTotalMinted";
            type: "u64";
          },
          {
            name: "authorityMaxTotal";
            type: {
              option: "u64";
            };
          },
          {
            name: "postMintSupply";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "updateMintAuthorityArgs";
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
};
