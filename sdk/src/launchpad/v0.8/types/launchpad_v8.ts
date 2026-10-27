/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/launchpad_v8.json`.
 */
export type LaunchpadV8 = {
  address: "moonDJUoHteKkGATejA5bdJVwJ6V6Dg74gyqyJTx73n";
  metadata: {
    name: "launchpadV8";
    version: "0.8.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "claim";
      discriminator: [62, 198, 214, 193, 213, 159, 108, 210];
      accounts: [
        {
          name: "launch";
          writable: true;
          relations: ["fundingRecord"];
        },
        {
          name: "fundingRecord";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  102,
                  117,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100,
                ];
              },
              {
                kind: "account";
                path: "launch";
              },
              {
                kind: "account";
                path: "funder";
              },
            ];
          };
        },
        {
          name: "launchSigner";
          relations: ["launch"];
        },
        {
          name: "baseMint";
          relations: ["launch"];
        },
        {
          name: "launchBaseVault";
          writable: true;
          relations: ["launch"];
        },
        {
          name: "funder";
          relations: ["fundingRecord"];
        },
        {
          name: "funderTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "funder";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ];
              },
              {
                kind: "account";
                path: "baseMint";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
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
      name: "claimAdditionalTokenAllocation";
      discriminator: [245, 214, 225, 140, 237, 135, 163, 244];
      accounts: [
        {
          name: "launch";
          writable: true;
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "launchSigner";
          relations: ["launch"];
        },
        {
          name: "launchBaseVault";
          writable: true;
          relations: ["launch"];
        },
        {
          name: "baseMint";
          relations: ["launch"];
        },
        {
          name: "additionalTokensRecipient";
        },
        {
          name: "additionalTokensRecipientTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "additionalTokensRecipient";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ];
              },
              {
                kind: "account";
                path: "baseMint";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
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
      name: "closeLaunch";
      discriminator: [27, 216, 111, 223, 10, 230, 19, 211];
      accounts: [
        {
          name: "launch";
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
      name: "extendLaunch";
      discriminator: [50, 150, 200, 194, 216, 50, 60, 253];
      accounts: [
        {
          name: "launch";
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
              name: "extendLaunchArgs";
            };
          };
        },
      ];
    },
    {
      name: "finalizeLaunch";
      discriminator: [113, 133, 62, 196, 58, 212, 118, 166];
      accounts: [
        {
          name: "launch";
          writable: true;
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "launchSigner";
          relations: ["launch"];
        },
        {
          name: "baseMint";
          relations: ["launch"];
        },
        {
          name: "dao";
        },
        {
          name: "squadsMultisig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 117, 108, 116, 105, 115, 105, 103];
              },
              {
                kind: "const";
                value: [109, 117, 108, 116, 105, 115, 105, 103];
              },
              {
                kind: "account";
                path: "dao";
              },
            ];
            program: {
              kind: "account";
              path: "squadsProgram";
            };
          };
        },
        {
          name: "squadsMultisigVault";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 117, 108, 116, 105, 115, 105, 103];
              },
              {
                kind: "account";
                path: "squadsMultisig";
              },
              {
                kind: "const";
                value: [118, 97, 117, 108, 116];
              },
              {
                kind: "const";
                value: [0];
              },
            ];
            program: {
              kind: "account";
              path: "squadsProgram";
            };
          };
        },
        {
          name: "performancePackageGrantee";
          relations: ["launch"];
        },
        {
          name: "mintGovernor";
          writable: true;
          relations: ["launch"];
        },
        {
          name: "ppMintAuthority";
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
                path: "performancePackage";
              },
            ];
            program: {
              kind: "account";
              path: "mintGovernorProgram";
            };
          };
        },
        {
          name: "daoMintAuthority";
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
                path: "squadsMultisigVault";
              },
            ];
            program: {
              kind: "account";
              path: "mintGovernorProgram";
            };
          };
        },
        {
          name: "performancePackage";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  112,
                  101,
                  114,
                  102,
                  111,
                  114,
                  109,
                  97,
                  110,
                  99,
                  101,
                  95,
                  112,
                  97,
                  99,
                  107,
                  97,
                  103,
                  101,
                ];
              },
              {
                kind: "account";
                path: "launchSigner";
              },
            ];
            program: {
              kind: "account";
              path: "performancePackageV2Program";
            };
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "squadsProgram";
          address: "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
        },
        {
          name: "mintGovernorProgram";
          address: "gvnr27cVeyW3AVf3acL7VCJ5WjGAphytnsgcK1feHyH";
        },
        {
          name: "mintGovernorEventAuthority";
        },
        {
          name: "performancePackageV2Program";
          address: "pPV2pfrxnmstSb9j7kEeCLny5BGj6SNwCWGd6xbGGzz";
        },
        {
          name: "performancePackageV2EventAuthority";
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
      name: "fund";
      discriminator: [218, 188, 111, 221, 152, 113, 174, 7];
      accounts: [
        {
          name: "launch";
          writable: true;
        },
        {
          name: "fundingRecord";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  102,
                  117,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100,
                ];
              },
              {
                kind: "account";
                path: "launch";
              },
              {
                kind: "account";
                path: "funder";
              },
            ];
          };
        },
        {
          name: "launchQuoteVault";
          writable: true;
          relations: ["launch"];
        },
        {
          name: "funder";
          signer: true;
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "funderQuoteAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "funder";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ];
              },
              {
                kind: "account";
                path: "launch.quote_mint";
                account: "launch";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
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
          name: "amount";
          type: "u64";
        },
      ];
    },
    {
      name: "initializeLaunch";
      discriminator: [90, 201, 220, 142, 112, 253, 100, 13];
      accounts: [
        {
          name: "launch";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [108, 97, 117, 110, 99, 104];
              },
              {
                kind: "account";
                path: "baseMint";
              },
            ];
          };
        },
        {
          name: "baseMint";
          writable: true;
        },
        {
          name: "tokenMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 101, 116, 97, 100, 97, 116, 97];
              },
              {
                kind: "const";
                value: [
                  11,
                  112,
                  101,
                  177,
                  227,
                  209,
                  124,
                  69,
                  56,
                  157,
                  82,
                  127,
                  107,
                  4,
                  195,
                  205,
                  88,
                  184,
                  108,
                  115,
                  26,
                  160,
                  253,
                  181,
                  73,
                  182,
                  209,
                  188,
                  3,
                  248,
                  41,
                  70,
                ];
              },
              {
                kind: "account";
                path: "baseMint";
              },
            ];
            program: {
              kind: "const";
              value: [
                11,
                112,
                101,
                177,
                227,
                209,
                124,
                69,
                56,
                157,
                82,
                127,
                107,
                4,
                195,
                205,
                88,
                184,
                108,
                115,
                26,
                160,
                253,
                181,
                73,
                182,
                209,
                188,
                3,
                248,
                41,
                70,
              ];
            };
          };
        },
        {
          name: "launchSigner";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104,
                  95,
                  115,
                  105,
                  103,
                  110,
                  101,
                  114,
                ];
              },
              {
                kind: "account";
                path: "launch";
              },
            ];
          };
        },
        {
          name: "quoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "launchSigner";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ];
              },
              {
                kind: "account";
                path: "quoteMint";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: "baseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "launchSigner";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ];
              },
              {
                kind: "account";
                path: "baseMint";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "launchAuthority";
        },
        {
          name: "quoteMint";
          address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
        },
        {
          name: "additionalTokensRecipient";
          optional: true;
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
                path: "baseMint";
              },
              {
                kind: "account";
                path: "launchSigner";
              },
            ];
            program: {
              kind: "account";
              path: "mintGovernorProgram";
            };
          };
        },
        {
          name: "mintGovernorProgram";
          address: "gvnr27cVeyW3AVf3acL7VCJ5WjGAphytnsgcK1feHyH";
        },
        {
          name: "mintGovernorEventAuthority";
        },
        {
          name: "rent";
          address: "SysvarRent111111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenMetadataProgram";
          address: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
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
              name: "initializeLaunchArgs";
            };
          };
        },
      ];
    },
    {
      name: "refund";
      discriminator: [2, 96, 183, 251, 63, 208, 46, 46];
      accounts: [
        {
          name: "launch";
          writable: true;
          relations: ["fundingRecord"];
        },
        {
          name: "fundingRecord";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  102,
                  117,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100,
                ];
              },
              {
                kind: "account";
                path: "launch";
              },
              {
                kind: "account";
                path: "funder";
              },
            ];
          };
        },
        {
          name: "launchQuoteVault";
          writable: true;
          relations: ["launch"];
        },
        {
          name: "launchSigner";
          relations: ["launch"];
        },
        {
          name: "funder";
          relations: ["fundingRecord"];
        },
        {
          name: "funderQuoteAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "funder";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ];
              },
              {
                kind: "account";
                path: "launch.quote_mint";
                account: "launch";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
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
      name: "setFundingRecordApproval";
      discriminator: [18, 197, 233, 219, 37, 33, 186, 25];
      accounts: [
        {
          name: "launch";
          writable: true;
          relations: ["fundingRecord"];
        },
        {
          name: "fundingRecord";
          writable: true;
        },
        {
          name: "launchAuthority";
          signer: true;
          relations: ["launch"];
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
          name: "approvedAmount";
          type: "u64";
        },
      ];
    },
    {
      name: "settleLaunch";
      discriminator: [200, 143, 23, 151, 91, 142, 43, 125];
      accounts: [
        {
          name: "launch";
          writable: true;
        },
        {
          name: "launchAuthority";
          signer: true;
          optional: true;
        },
        {
          name: "tokenMetadata";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 101, 116, 97, 100, 97, 116, 97];
              },
              {
                kind: "const";
                value: [
                  11,
                  112,
                  101,
                  177,
                  227,
                  209,
                  124,
                  69,
                  56,
                  157,
                  82,
                  127,
                  107,
                  4,
                  195,
                  205,
                  88,
                  184,
                  108,
                  115,
                  26,
                  160,
                  253,
                  181,
                  73,
                  182,
                  209,
                  188,
                  3,
                  248,
                  41,
                  70,
                ];
              },
              {
                kind: "account";
                path: "baseMint";
              },
            ];
            program: {
              kind: "const";
              value: [
                11,
                112,
                101,
                177,
                227,
                209,
                124,
                69,
                56,
                157,
                82,
                127,
                107,
                4,
                195,
                205,
                88,
                184,
                108,
                115,
                26,
                160,
                253,
                181,
                73,
                182,
                209,
                188,
                3,
                248,
                41,
                70,
              ];
            };
          };
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "launchSigner";
          writable: true;
          relations: ["launch"];
        },
        {
          name: "launchQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "launchSigner";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ];
              },
              {
                kind: "account";
                path: "quoteMint";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
          relations: ["launch"];
        },
        {
          name: "launchBaseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "launchSigner";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ];
              },
              {
                kind: "account";
                path: "baseMint";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
          relations: ["launch"];
        },
        {
          name: "treasuryQuoteAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "squadsMultisigVault";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ];
              },
              {
                kind: "account";
                path: "quoteMint";
              },
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: "baseMint";
          writable: true;
          relations: ["launch"];
        },
        {
          name: "quoteMint";
          relations: ["launch"];
        },
        {
          name: "daoOwnedLpPosition";
          writable: true;
        },
        {
          name: "futarchyAmmBaseVault";
          writable: true;
        },
        {
          name: "futarchyAmmQuoteVault";
          writable: true;
        },
        {
          name: "dao";
          writable: true;
        },
        {
          name: "squadsMultisig";
          writable: true;
        },
        {
          name: "squadsMultisigVault";
        },
        {
          name: "spendingLimit";
          writable: true;
        },
        {
          name: "bidWall";
          writable: true;
        },
        {
          name: "bidWallQuoteTokenAccount";
          writable: true;
        },
        {
          name: "feeRecipient";
          address: "6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "staticAccounts";
          accounts: [
            {
              name: "futarchyProgram";
              address: "FUTARELBfJfQ8RDGhg1wdhddq1odMAJUePHFuBYfUxKq";
            },
            {
              name: "tokenMetadataProgram";
              address: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
            },
            {
              name: "futarchyEventAuthority";
            },
            {
              name: "squadsProgram";
              address: "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
            },
            {
              name: "squadsProgramConfig";
              pda: {
                seeds: [
                  {
                    kind: "const";
                    value: [109, 117, 108, 116, 105, 115, 105, 103];
                  },
                  {
                    kind: "const";
                    value: [
                      112,
                      114,
                      111,
                      103,
                      114,
                      97,
                      109,
                      95,
                      99,
                      111,
                      110,
                      102,
                      105,
                      103,
                    ];
                  },
                ];
                program: {
                  kind: "account";
                  path: "squadsProgram";
                };
              };
            },
            {
              name: "squadsProgramConfigTreasury";
              writable: true;
            },
            {
              name: "bidWallProgram";
              address: "WALL8ucBuUyL46QYxwYJjidaFYhdvxUFrgvBxPshERx";
            },
            {
              name: "bidWallEventAuthority";
            },
          ];
        },
        {
          name: "meteoraAccounts";
          accounts: [
            {
              name: "dammV2Program";
              address: "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG";
            },
            {
              name: "config";
            },
            {
              name: "token2022Program";
              address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
            },
            {
              name: "positionNftAccount";
              writable: true;
              pda: {
                seeds: [
                  {
                    kind: "const";
                    value: [
                      112,
                      111,
                      115,
                      105,
                      116,
                      105,
                      111,
                      110,
                      95,
                      110,
                      102,
                      116,
                      95,
                      97,
                      99,
                      99,
                      111,
                      117,
                      110,
                      116,
                    ];
                  },
                  {
                    kind: "account";
                    path: "positionNftMint";
                  },
                ];
                program: {
                  kind: "account";
                  path: "dammV2Program";
                };
              };
            },
            {
              name: "pool";
              writable: true;
            },
            {
              name: "position";
              writable: true;
              pda: {
                seeds: [
                  {
                    kind: "const";
                    value: [112, 111, 115, 105, 116, 105, 111, 110];
                  },
                  {
                    kind: "account";
                    path: "positionNftMint";
                  },
                ];
                program: {
                  kind: "account";
                  path: "dammV2Program";
                };
              };
            },
            {
              name: "positionNftMint";
              writable: true;
              pda: {
                seeds: [
                  {
                    kind: "const";
                    value: [
                      112,
                      111,
                      115,
                      105,
                      116,
                      105,
                      111,
                      110,
                      95,
                      110,
                      102,
                      116,
                      95,
                      109,
                      105,
                      110,
                      116,
                    ];
                  },
                  {
                    kind: "account";
                    path: "baseMint";
                  },
                ];
              };
            },
            {
              name: "baseMint";
            },
            {
              name: "quoteMint";
            },
            {
              name: "tokenAVault";
              writable: true;
              pda: {
                seeds: [
                  {
                    kind: "const";
                    value: [
                      116,
                      111,
                      107,
                      101,
                      110,
                      95,
                      118,
                      97,
                      117,
                      108,
                      116,
                    ];
                  },
                  {
                    kind: "account";
                    path: "baseMint";
                  },
                  {
                    kind: "account";
                    path: "pool";
                  },
                ];
                program: {
                  kind: "account";
                  path: "dammV2Program";
                };
              };
            },
            {
              name: "tokenBVault";
              writable: true;
              pda: {
                seeds: [
                  {
                    kind: "const";
                    value: [
                      116,
                      111,
                      107,
                      101,
                      110,
                      95,
                      118,
                      97,
                      117,
                      108,
                      116,
                    ];
                  },
                  {
                    kind: "account";
                    path: "quoteMint";
                  },
                  {
                    kind: "account";
                    path: "pool";
                  },
                ];
                program: {
                  kind: "account";
                  path: "dammV2Program";
                };
              };
            },
            {
              name: "poolCreatorAuthority";
              pda: {
                seeds: [
                  {
                    kind: "const";
                    value: [
                      100,
                      97,
                      109,
                      109,
                      95,
                      112,
                      111,
                      111,
                      108,
                      95,
                      99,
                      114,
                      101,
                      97,
                      116,
                      111,
                      114,
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
              name: "poolAuthority";
              pda: {
                seeds: [
                  {
                    kind: "const";
                    value: [
                      112,
                      111,
                      111,
                      108,
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
                program: {
                  kind: "account";
                  path: "dammV2Program";
                };
              };
            },
            {
              name: "dammV2EventAuthority";
            },
          ];
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
      name: "startLaunch";
      discriminator: [205, 178, 36, 232, 95, 202, 241, 68];
      accounts: [
        {
          name: "launch";
          writable: true;
        },
        {
          name: "launchAuthority";
          signer: true;
          relations: ["launch"];
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
      name: "fundingRecord";
      discriminator: [20, 34, 251, 238, 204, 117, 11, 67];
    },
    {
      name: "launch";
      discriminator: [144, 51, 51, 163, 206, 85, 213, 38];
    },
    {
      name: "mintGovernor";
      discriminator: [110, 173, 19, 114, 217, 193, 37, 71];
    },
  ];
  events: [
    {
      name: "fundingRecordApprovalSetEvent";
      discriminator: [33, 45, 100, 94, 3, 52, 35, 246];
    },
    {
      name: "launchClaimAdditionalTokenAllocationEvent";
      discriminator: [228, 82, 146, 235, 214, 251, 170, 28];
    },
    {
      name: "launchClaimEvent";
      discriminator: [185, 124, 167, 74, 161, 160, 106, 96];
    },
    {
      name: "launchCloseEvent";
      discriminator: [229, 71, 160, 47, 144, 13, 115, 12];
    },
    {
      name: "launchExtendedEvent";
      discriminator: [178, 224, 112, 157, 98, 161, 2, 229];
    },
    {
      name: "launchFinalizedEvent";
      discriminator: [82, 58, 210, 25, 233, 142, 81, 250];
    },
    {
      name: "launchFundedEvent";
      discriminator: [107, 1, 188, 175, 129, 59, 38, 79];
    },
    {
      name: "launchInitializedEvent";
      discriminator: [227, 109, 144, 20, 65, 239, 101, 176];
    },
    {
      name: "launchRefundedEvent";
      discriminator: [59, 128, 76, 161, 92, 17, 206, 130];
    },
    {
      name: "launchSettledEvent";
      discriminator: [222, 55, 230, 150, 71, 177, 177, 50];
    },
    {
      name: "launchStartedEvent";
      discriminator: [187, 129, 95, 253, 255, 206, 36, 239];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "invalidAmount";
      msg: "Invalid amount";
    },
    {
      code: 6001;
      name: "supplyNonZero";
      msg: "Supply must be zero";
    },
    {
      code: 6002;
      name: "invalidSecondsForLaunch";
      msg: "Launch period must be between 1 hour and 2 weeks";
    },
    {
      code: 6003;
      name: "insufficientFunds";
      msg: "Insufficient funds";
    },
    {
      code: 6004;
      name: "invalidLaunchState";
      msg: "Invalid launch state";
    },
    {
      code: 6005;
      name: "launchPeriodNotOver";
      msg: "Launch period not over";
    },
    {
      code: 6006;
      name: "launchExpired";
      msg: "Launch is complete, no more funding allowed";
    },
    {
      code: 6007;
      name: "launchNotRefunding";
      msg: "Refund not available";
    },
    {
      code: 6008;
      name: "launchNotInitialized";
      msg: "Launch must be initialized to be started";
    },
    {
      code: 6009;
      name: "freezeAuthoritySet";
      msg: "Freeze authority can't be set on launchpad tokens";
    },
    {
      code: 6010;
      name: "invalidMonthlySpendingLimit";
      msg: "Monthly spending limit must be less than 1/6th of the minimum raise amount and cannot be 0";
    },
    {
      code: 6011;
      name: "invalidMonthlySpendingLimitMembers";
      msg: "There can only be at most 10 monthly spending limit members";
    },
    {
      code: 6012;
      name: "invalidPerformancePackageTokenAmount";
      msg: "Invalid performance package token amount";
    },
    {
      code: 6013;
      name: "invalidPerformancePackageMinUnlockTime";
      msg: "Insiders must wait at least 12 months before unlocking";
    },
    {
      code: 6014;
      name: "launchAuthorityNotSet";
      msg: "Launch authority must be set to complete the launch until 2 days after closing";
    },
    {
      code: 6015;
      name: "finalRaiseAmountTooLow";
      msg: "The final amount raised must be >= the minimum raise amount";
    },
    {
      code: 6016;
      name: "tokensAlreadyClaimed";
      msg: "Tokens already claimed";
    },
    {
      code: 6017;
      name: "moneyAlreadyRefunded";
      msg: "USDC already refunded";
    },
    {
      code: 6018;
      name: "invariantViolated";
      msg: "Invariant violated";
    },
    {
      code: 6019;
      name: "launchNotLive";
      msg: "Launch must be live to be closed";
    },
    {
      code: 6020;
      name: "invalidMinimumRaiseAmount";
      msg: "Minimum raise amount too low for liquidity";
    },
    {
      code: 6021;
      name: "finalRaiseAmountAlreadySet";
      msg: "Final raise amount already set";
    },
    {
      code: 6022;
      name: "totalApprovedAmountTooLow";
      msg: "Total approved amount too low";
    },
    {
      code: 6023;
      name: "invalidAdditionalTokensRecipient";
      msg: "Additional tokens recipient must be set when amount > 0";
    },
    {
      code: 6024;
      name: "noAdditionalTokensRecipientSet";
      msg: "No additional tokens recipient set";
    },
    {
      code: 6025;
      name: "additionalTokensAlreadyClaimed";
      msg: "Additional tokens already claimed";
    },
    {
      code: 6026;
      name: "fundingRecordApprovalPeriodOver";
      msg: "Funding record approval period is over";
    },
    {
      code: 6027;
      name: "performancePackageAlreadyInitialized";
      msg: "Performance package already initialized";
    },
    {
      code: 6028;
      name: "invalidDao";
      msg: "Invalid DAO";
    },
    {
      code: 6029;
      name: "invalidAccumulatorActivationDelaySeconds";
      msg: "Accumulator activation delay must be less than the launch duration";
    },
    {
      code: 6030;
      name: "extendDurationExceedsMax";
      msg: "Extend duration would exceed maximum allowed launch duration";
    },
    {
      code: 6031;
      name: "invalidMintAuthority";
      msg: "Mint authority does not match expected";
    },
    {
      code: 6032;
      name: "invalidMeteoraAccount";
      msg: "Invalid Meteora account";
    },
  ];
  types: [
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
            name: "launchSeqNum";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "extendLaunchArgs";
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
      name: "fundingRecord";
      type: {
        kind: "struct";
        fields: [
          {
            name: "pdaBump";
            docs: ["The PDA bump."];
            type: "u8";
          },
          {
            name: "funder";
            docs: ["The funder."];
            type: "pubkey";
          },
          {
            name: "launch";
            docs: ["The launch."];
            type: "pubkey";
          },
          {
            name: "committedAmount";
            docs: ["The amount of USDC that has been committed by the funder."];
            type: "u64";
          },
          {
            name: "isTokensClaimed";
            docs: ["Whether the tokens have been claimed."];
            type: "bool";
          },
          {
            name: "isUsdcRefunded";
            docs: ["Whether the USDC has been refunded."];
            type: "bool";
          },
          {
            name: "approvedAmount";
            docs: [
              "The amount of USDC that the launch authority has approved for the funder.",
              "If zero, the funder has not been approved for any amount.",
            ];
            type: "u64";
          },
          {
            name: "committedAmountAccumulator";
            docs: [
              "Running integral of committed_amount over time (committed_amount * seconds).",
            ];
            type: "u128";
          },
          {
            name: "lastAccumulatorUpdate";
            docs: ["Unix timestamp of the last accumulator update."];
            type: "i64";
          },
        ];
      };
    },
    {
      name: "fundingRecordApprovalSetEvent";
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
            name: "launch";
            type: "pubkey";
          },
          {
            name: "fundingRecord";
            type: "pubkey";
          },
          {
            name: "funder";
            type: "pubkey";
          },
          {
            name: "approvedAmount";
            type: "u64";
          },
          {
            name: "totalApproved";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "initializeLaunchArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "minimumRaiseAmount";
            type: "u64";
          },
          {
            name: "monthlySpendingLimitAmount";
            type: "u64";
          },
          {
            name: "monthlySpendingLimitMembers";
            type: {
              vec: "pubkey";
            };
          },
          {
            name: "secondsForLaunch";
            type: "u32";
          },
          {
            name: "tokenName";
            type: "string";
          },
          {
            name: "tokenSymbol";
            type: "string";
          },
          {
            name: "tokenUri";
            type: "string";
          },
          {
            name: "performancePackageGrantee";
            type: "pubkey";
          },
          {
            name: "performancePackageTokenAmount";
            type: "u64";
          },
          {
            name: "monthsUntilInsidersCanUnlock";
            type: "u8";
          },
          {
            name: "teamAddress";
            type: "pubkey";
          },
          {
            name: "additionalTokensAmount";
            type: "u64";
          },
          {
            name: "accumulatorActivationDelaySeconds";
            type: "u32";
          },
          {
            name: "hasBidWall";
            type: "bool";
          },
        ];
      };
    },
    {
      name: "launch";
      type: {
        kind: "struct";
        fields: [
          {
            name: "pdaBump";
            docs: ["The PDA bump."];
            type: "u8";
          },
          {
            name: "minimumRaiseAmount";
            docs: [
              "The minimum amount of USDC that must be raised, otherwise",
              "everyone can get their USDC back.",
            ];
            type: "u64";
          },
          {
            name: "monthlySpendingLimitAmount";
            docs: [
              "The monthly spending limit the DAO allocates to the team. Must be",
              "less than 1/6th of the minimum raise amount (so 6 months of burn).",
            ];
            type: "u64";
          },
          {
            name: "monthlySpendingLimitMembers";
            docs: [
              "The wallets that have access to the monthly spending limit.",
            ];
            type: {
              vec: "pubkey";
            };
          },
          {
            name: "launchAuthority";
            docs: ["The account that can start the launch."];
            type: "pubkey";
          },
          {
            name: "launchSigner";
            docs: ["The launch signer address."];
            type: "pubkey";
          },
          {
            name: "launchSignerPdaBump";
            docs: ["The PDA bump for the launch signer."];
            type: "u8";
          },
          {
            name: "launchQuoteVault";
            docs: [
              "The USDC vault that will hold the USDC raised until the launch is over.",
            ];
            type: "pubkey";
          },
          {
            name: "launchBaseVault";
            docs: ["The token vault, used to send tokens to the AMM."];
            type: "pubkey";
          },
          {
            name: "baseMint";
            docs: [
              "The token that will be minted to funders and that will control the DAO.",
            ];
            type: "pubkey";
          },
          {
            name: "quoteMint";
            docs: ["The USDC mint."];
            type: "pubkey";
          },
          {
            name: "unixTimestampStarted";
            docs: ["The unix timestamp when the launch was started."];
            type: {
              option: "i64";
            };
          },
          {
            name: "unixTimestampClosed";
            docs: [
              "The unix timestamp when the launch stopped taking new contributions.",
            ];
            type: {
              option: "i64";
            };
          },
          {
            name: "totalCommittedAmount";
            docs: ["The amount of USDC that has been committed by the users."];
            type: "u64";
          },
          {
            name: "state";
            docs: ["The state of the launch."];
            type: {
              defined: {
                name: "launchState";
              };
            };
          },
          {
            name: "seqNum";
            docs: [
              "The sequence number of this launch. Useful for sorting events.",
            ];
            type: "u64";
          },
          {
            name: "secondsForLaunch";
            docs: ["The number of seconds that the launch will be live for."];
            type: "u32";
          },
          {
            name: "dao";
            docs: ["The DAO, if the launch is complete."];
            type: {
              option: "pubkey";
            };
          },
          {
            name: "daoVault";
            docs: [
              "The DAO treasury that USDC / LP is sent to, if the launch is complete.",
            ];
            type: {
              option: "pubkey";
            };
          },
          {
            name: "performancePackageGrantee";
            docs: [
              "The address that will receive the performance package tokens.",
            ];
            type: "pubkey";
          },
          {
            name: "performancePackageTokenAmount";
            docs: [
              "The amount of tokens to be granted to the performance package grantee.",
            ];
            type: "u64";
          },
          {
            name: "monthsUntilInsidersCanUnlock";
            docs: [
              "The number of months that insiders must wait before unlocking their tokens.",
            ];
            type: "u8";
          },
          {
            name: "teamAddress";
            docs: ["The initial address used to sponsor team proposals."];
            type: "pubkey";
          },
          {
            name: "totalApprovedAmount";
            docs: [
              "The amount of USDC that the launch authority has approved across all funders.",
            ];
            type: "u64";
          },
          {
            name: "additionalTokensAmount";
            docs: [
              "The amount of additional tokens to be minted on a successful launch.",
            ];
            type: "u64";
          },
          {
            name: "additionalTokensRecipient";
            docs: [
              "The token account that will receive the additional tokens.",
            ];
            type: {
              option: "pubkey";
            };
          },
          {
            name: "additionalTokensClaimed";
            docs: ["Are the additional tokens claimed."];
            type: "bool";
          },
          {
            name: "unixTimestampCompleted";
            docs: ["The unix timestamp when the launch was completed."];
            type: {
              option: "i64";
            };
          },
          {
            name: "isFinalized";
            docs: ["Whether the launch has been finalized."];
            type: "bool";
          },
          {
            name: "accumulatorActivationDelaySeconds";
            docs: [
              "Number of seconds after launch start before the funding accumulator",
              "begins tracking.",
            ];
            type: "u32";
          },
          {
            name: "hasBidWall";
            docs: ["Whether the launch has a bid wall."];
            type: "bool";
          },
          {
            name: "mintGovernor";
            docs: ["The MintGovernor PDA that owns the SPL mint authority."];
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "launchClaimAdditionalTokenAllocationEvent";
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
            name: "launch";
            type: "pubkey";
          },
          {
            name: "additionalTokensAmount";
            type: "u64";
          },
          {
            name: "additionalTokensRecipient";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "launchClaimEvent";
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
            name: "launch";
            type: "pubkey";
          },
          {
            name: "funder";
            type: "pubkey";
          },
          {
            name: "tokensClaimed";
            type: "u64";
          },
          {
            name: "fundingRecord";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "launchCloseEvent";
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
            name: "launch";
            type: "pubkey";
          },
          {
            name: "newState";
            type: {
              defined: {
                name: "launchState";
              };
            };
          },
        ];
      };
    },
    {
      name: "launchExtendedEvent";
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
            name: "launch";
            type: "pubkey";
          },
          {
            name: "oldSecondsForLaunch";
            type: "u32";
          },
          {
            name: "newSecondsForLaunch";
            type: "u32";
          },
        ];
      };
    },
    {
      name: "launchFinalizedEvent";
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
            name: "launch";
            type: "pubkey";
          },
          {
            name: "performancePackage";
            type: "pubkey";
          },
          {
            name: "mintGovernor";
            type: "pubkey";
          },
          {
            name: "mintGovernorNewAdmin";
            type: "pubkey";
          },
          {
            name: "ppMintAuthority";
            type: "pubkey";
          },
          {
            name: "daoMintAuthority";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "launchFundedEvent";
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
            name: "fundingRecord";
            type: "pubkey";
          },
          {
            name: "launch";
            type: "pubkey";
          },
          {
            name: "funder";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "totalCommittedByFunder";
            type: "u64";
          },
          {
            name: "totalCommitted";
            type: "u64";
          },
          {
            name: "committedAmountAccumulator";
            type: "u128";
          },
        ];
      };
    },
    {
      name: "launchInitializedEvent";
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
            name: "launch";
            type: "pubkey";
          },
          {
            name: "minimumRaiseAmount";
            type: "u64";
          },
          {
            name: "launchAuthority";
            type: "pubkey";
          },
          {
            name: "launchSigner";
            type: "pubkey";
          },
          {
            name: "launchSignerPdaBump";
            type: "u8";
          },
          {
            name: "launchUsdcVault";
            type: "pubkey";
          },
          {
            name: "launchTokenVault";
            type: "pubkey";
          },
          {
            name: "performancePackageGrantee";
            type: "pubkey";
          },
          {
            name: "performancePackageTokenAmount";
            type: "u64";
          },
          {
            name: "monthsUntilInsidersCanUnlock";
            type: "u8";
          },
          {
            name: "monthlySpendingLimitAmount";
            type: "u64";
          },
          {
            name: "monthlySpendingLimitMembers";
            type: {
              vec: "pubkey";
            };
          },
          {
            name: "baseMint";
            type: "pubkey";
          },
          {
            name: "quoteMint";
            type: "pubkey";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
          {
            name: "secondsForLaunch";
            type: "u32";
          },
          {
            name: "additionalTokensAmount";
            type: "u64";
          },
          {
            name: "additionalTokensRecipient";
            type: {
              option: "pubkey";
            };
          },
          {
            name: "accumulatorActivationDelaySeconds";
            type: "u32";
          },
          {
            name: "hasBidWall";
            type: "bool";
          },
          {
            name: "mintGovernor";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "launchRefundedEvent";
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
            name: "launch";
            type: "pubkey";
          },
          {
            name: "funder";
            type: "pubkey";
          },
          {
            name: "usdcRefunded";
            type: "u64";
          },
          {
            name: "fundingRecord";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "launchSettledEvent";
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
            name: "launch";
            type: "pubkey";
          },
          {
            name: "finalState";
            type: {
              defined: {
                name: "launchState";
              };
            };
          },
          {
            name: "totalCommitted";
            type: "u64";
          },
          {
            name: "dao";
            type: {
              option: "pubkey";
            };
          },
          {
            name: "daoTreasury";
            type: {
              option: "pubkey";
            };
          },
          {
            name: "totalApprovedAmount";
            type: "u64";
          },
          {
            name: "bidWall";
            type: {
              option: "pubkey";
            };
          },
          {
            name: "bidWallAmount";
            type: "u64";
          },
          {
            name: "tokensMinted";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "launchStartedEvent";
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
            name: "launch";
            type: "pubkey";
          },
          {
            name: "launchAuthority";
            type: "pubkey";
          },
          {
            name: "slotStarted";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "launchState";
      type: {
        kind: "enum";
        variants: [
          {
            name: "initialized";
          },
          {
            name: "live";
          },
          {
            name: "closed";
          },
          {
            name: "complete";
          },
          {
            name: "refunding";
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
  ];
};
