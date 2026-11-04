/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/price_based_performance_package.json`.
 */
export type PriceBasedPerformancePackage = {
  address: "pbPPQH7jyKoSLu8QYs3rSY3YkDRXEBojKbTgnUg7NDS";
  metadata: {
    name: "priceBasedPerformancePackage";
    version: "0.6.1";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "burnPerformancePackage";
      discriminator: [232, 251, 10, 122, 204, 255, 248, 208];
      accounts: [
        {
          name: "performancePackage";
          writable: true;
        },
        {
          name: "performancePackageTokenVault";
          docs: [
            "Emptied by the payout and the burn, then closed to the spill account",
          ];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "performancePackage";
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
                path: "tokenMint";
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
          relations: ["performancePackage"];
        },
        {
          name: "recipient";
          relations: ["performancePackage"];
        },
        {
          name: "recipientTokenAccount";
          docs: [
            "Any token account owned by the recipient; receives the unlocked balance",
          ];
          writable: true;
        },
        {
          name: "admin";
          signer: true;
        },
        {
          name: "spillAccount";
          writable: true;
        },
        {
          name: "tokenMint";
          writable: true;
          relations: ["performancePackage"];
        },
        {
          name: "quoteMint";
          docs: [
            "The mint of the package's quote ATA; any mint other than the package's token mint",
          ];
          optional: true;
        },
        {
          name: "packageQuoteAccount";
          docs: [
            "The package's quote ATA, swept into `quote_destination` and closed when passed",
          ];
          writable: true;
          optional: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "performancePackage";
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
          name: "quoteDestination";
          docs: ["Where the quote balance goes, chosen by the admin"];
          writable: true;
          optional: true;
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
      ];
      args: [];
    },
    {
      name: "changePerformancePackageAuthority";
      discriminator: [167, 96, 117, 32, 209, 186, 226, 179];
      accounts: [
        {
          name: "performancePackage";
          writable: true;
        },
        {
          name: "currentAuthority";
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
          name: "params";
          type: {
            defined: {
              name: "changePerformancePackageAuthorityParams";
            };
          };
        },
      ];
    },
    {
      name: "completeUnlock";
      discriminator: [22, 203, 15, 189, 239, 125, 25, 132];
      accounts: [
        {
          name: "performancePackage";
          writable: true;
        },
        {
          name: "oracleAccount";
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
      name: "executeChange";
      discriminator: [104, 53, 136, 238, 82, 222, 200, 42];
      accounts: [
        {
          name: "changeRequest";
          writable: true;
        },
        {
          name: "performancePackage";
          writable: true;
          relations: ["changeRequest"];
        },
        {
          name: "executor";
          docs: [
            "The party executing the change (must be opposite of proposer)",
          ];
          writable: true;
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
          name: "params";
          type: {
            defined: {
              name: "executeChangeParams";
            };
          };
        },
      ];
    },
    {
      name: "initializePerformancePackage";
      discriminator: [3, 171, 56, 55, 135, 100, 163, 186];
      accounts: [
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
                path: "createKey";
              },
            ];
          };
        },
        {
          name: "createKey";
          docs: ["Used to derive the PDA"];
          signer: true;
        },
        {
          name: "tokenMint";
          docs: ["The mint of the tokens to be locked"];
        },
        {
          name: "grantorTokenAccount";
          docs: ["The token account containing the tokens to be locked"];
          writable: true;
        },
        {
          name: "grantor";
          docs: ["The authority of the token account"];
          signer: true;
        },
        {
          name: "performancePackageTokenVault";
          docs: ["The locker's token account where tokens will be stored"];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "performancePackage";
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
                path: "tokenMint";
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
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "initializePerformancePackageParams";
            };
          };
        },
      ];
    },
    {
      name: "initializePerformancePackageWithLimits";
      discriminator: [49, 132, 41, 239, 119, 107, 42, 229];
      accounts: [
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
                path: "createKey";
              },
            ];
          };
        },
        {
          name: "createKey";
          docs: ["Used to derive the PDA"];
          signer: true;
        },
        {
          name: "tokenMint";
          docs: ["The mint of the tokens to be locked"];
        },
        {
          name: "grantorTokenAccount";
          docs: ["The token account containing the tokens to be locked"];
          writable: true;
        },
        {
          name: "grantor";
          docs: ["The authority of the token account"];
          signer: true;
        },
        {
          name: "performancePackageTokenVault";
          docs: ["The locker's token account where tokens will be stored"];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "performancePackage";
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
                path: "tokenMint";
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
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "initializePerformancePackageWithLimitsParams";
            };
          };
        },
      ];
    },
    {
      name: "proposeChange";
      discriminator: [167, 211, 18, 222, 93, 215, 74, 159];
      accounts: [
        {
          name: "changeRequest";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  99,
                  104,
                  97,
                  110,
                  103,
                  101,
                  95,
                  114,
                  101,
                  113,
                  117,
                  101,
                  115,
                  116,
                ];
              },
              {
                kind: "account";
                path: "performancePackage";
              },
              {
                kind: "account";
                path: "proposer";
              },
              {
                kind: "arg";
                path: "params.pda_nonce";
              },
            ];
          };
        },
        {
          name: "performancePackage";
          writable: true;
        },
        {
          name: "proposer";
          signer: true;
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
          name: "params";
          type: {
            defined: {
              name: "proposeChangeParams";
            };
          };
        },
      ];
    },
    {
      name: "resizePerformancePackage";
      discriminator: [99, 88, 136, 7, 47, 157, 30, 167];
      accounts: [
        {
          name: "performancePackage";
          writable: true;
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
      ];
      args: [];
    },
    {
      name: "startUnlock";
      discriminator: [53, 202, 212, 31, 76, 178, 31, 123];
      accounts: [
        {
          name: "performancePackage";
          writable: true;
        },
        {
          name: "oracleAccount";
        },
        {
          name: "recipient";
          docs: ["Only the token recipient can start unlock"];
          signer: true;
          relations: ["performancePackage"];
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
      name: "withdrawTokens";
      discriminator: [2, 4, 225, 61, 19, 182, 106, 170];
      accounts: [
        {
          name: "performancePackage";
          writable: true;
        },
        {
          name: "oracleAccount";
        },
        {
          name: "performancePackageTokenVault";
          docs: ["The token account where locked tokens are stored"];
          writable: true;
          relations: ["performancePackage"];
        },
        {
          name: "tokenMint";
          relations: ["performancePackage"];
        },
        {
          name: "recipientTokenAccount";
          docs: [
            "The recipient's ATA where tokens will be sent - created if needed",
          ];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "recipient";
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
                path: "tokenMint";
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
          name: "recipient";
          docs: ["Only the recipient can withdraw"];
          signer: true;
          relations: ["performancePackage"];
        },
        {
          name: "payer";
          docs: ["Payer for creating the ATA if needed"];
          writable: true;
          signer: true;
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
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "withdrawTokensParams";
            };
          };
        },
      ];
    },
    {
      name: "withdrawViaSell";
      discriminator: [14, 241, 77, 159, 41, 120, 59, 96];
      accounts: [
        {
          name: "performancePackage";
          writable: true;
        },
        {
          name: "dao";
          docs: ["The futarchy Dao whose spot pool buys the tokens"];
          writable: true;
        },
        {
          name: "performancePackageTokenVault";
          docs: [
            "The token account where locked tokens are stored; the sale is paid out of it",
          ];
          writable: true;
          relations: ["performancePackage"];
        },
        {
          name: "tokenMint";
          relations: ["performancePackage"];
        },
        {
          name: "quoteMint";
        },
        {
          name: "ammBaseVault";
          writable: true;
        },
        {
          name: "ammQuoteVault";
          writable: true;
        },
        {
          name: "packageQuoteAccount";
          docs: [
            "The package's quote ATA that receives the proceeds before they are forwarded",
          ];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "performancePackage";
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
          name: "recipientQuoteAccount";
          docs: ["The recipient's quote ATA where the proceeds are sent"];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "recipient";
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
          name: "recipient";
          docs: ["Only the recipient can withdraw"];
          signer: true;
          relations: ["performancePackage"];
        },
        {
          name: "payer";
          docs: ["Payer for creating the ATAs if needed"];
          writable: true;
          signer: true;
        },
        {
          name: "futarchyProgram";
          address: "FUTARELBfJfQ8RDGhg1wdhddq1odMAJUePHFuBYfUxKq";
        },
        {
          name: "futarchyEventAuthority";
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
            program: {
              kind: "account";
              path: "futarchyProgram";
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
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "withdrawViaSellParams";
            };
          };
        },
      ];
    },
  ];
  accounts: [
    {
      name: "changeRequest";
      discriminator: [75, 130, 166, 47, 15, 217, 131, 190];
    },
    {
      name: "dao";
      discriminator: [163, 9, 47, 31, 52, 85, 197, 49];
    },
    {
      name: "performancePackage";
      discriminator: [228, 146, 174, 131, 121, 249, 99, 132];
    },
  ];
  events: [
    {
      name: "changeExecuted";
      discriminator: [50, 115, 8, 12, 139, 8, 191, 26];
    },
    {
      name: "changeProposed";
      discriminator: [170, 10, 10, 8, 244, 196, 146, 151];
    },
    {
      name: "performancePackageAuthorityChanged";
      discriminator: [61, 106, 117, 16, 219, 103, 0, 43];
    },
    {
      name: "performancePackageInitialized";
      discriminator: [215, 87, 36, 3, 199, 219, 188, 121];
    },
    {
      name: "tokensSold";
      discriminator: [217, 83, 68, 137, 134, 225, 94, 45];
    },
    {
      name: "tokensWithdrawn";
      discriminator: [30, 116, 110, 147, 87, 89, 9, 158];
    },
    {
      name: "unlockCompleted";
      discriminator: [9, 6, 169, 127, 233, 218, 94, 165];
    },
    {
      name: "unlockStarted";
      discriminator: [156, 214, 102, 63, 177, 19, 228, 124];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "unlockTimestampNotReached";
      msg: "Unlock timestamp has not been reached yet";
    },
    {
      code: 6001;
      name: "unlockTimestampInThePast";
      msg: "Unlock timestamp must be in the future";
    },
    {
      code: 6002;
      name: "invalidPerformancePackageState";
      msg: "Performance package is not in the expected state";
    },
    {
      code: 6003;
      name: "twapPeriodNotElapsed";
      msg: "TWAP calculation failed";
    },
    {
      code: 6004;
      name: "priceThresholdNotMet";
      msg: "Price threshold not met";
    },
    {
      code: 6005;
      name: "invalidOracleData";
      msg: "Invalid oracle account data";
    },
    {
      code: 6006;
      name: "unauthorizedChangeRequest";
      msg: "Unauthorized to create or execute change request";
    },
    {
      code: 6007;
      name: "invalidChangeRequest";
      msg: "Change request does not match locker";
    },
    {
      code: 6008;
      name: "unauthorizedLockerAuthority";
      msg: "Unauthorized locker authority";
    },
    {
      code: 6009;
      name: "invariantViolated";
      msg: "An invariant was violated. You should get in contact with the MetaDAO team if you see this";
    },
    {
      code: 6010;
      name: "tranchePriceThresholdsNotMonotonic";
      msg: "Tranche price thresholds must be monotonically increasing";
    },
    {
      code: 6011;
      name: "trancheTokenAmountZero";
      msg: "Tranche token amount must be greater than 0";
    },
    {
      code: 6012;
      name: "invalidTwapLength";
      msg: "TWAP length must be greater than or equal to 1 day and less than 1 year";
    },
    {
      code: 6013;
      name: "invalidAdmin";
      msg: "Invalid admin";
    },
    {
      code: 6014;
      name: "totalTokenAmountOverflow";
      msg: "Total token amount calculation would overflow";
    },
    {
      code: 6015;
      name: "recipientAuthorityMustDiffer";
      msg: "Recipient and performance package authority must be different keys";
    },
    {
      code: 6016;
      name: "invalidWithdrawalLimits";
      msg: "Withdrawal limits must have non-zero caps, a future end, and a window of at least one second";
    },
    {
      code: 6017;
      name: "insufficientWithdrawableBalance";
      msg: "Amount exceeds the withdrawable balance";
    },
    {
      code: 6018;
      name: "tokenWindowLimitExceeded";
      msg: "Token cap for the current window exceeded";
    },
    {
      code: 6019;
      name: "quoteWindowLimitExceeded";
      msg: "Quote cap for the current window exceeded";
    },
    {
      code: 6020;
      name: "invalidPriceObservation";
      msg: "Oracle price observation is missing or zero";
    },
    {
      code: 6021;
      name: "withdrawTokensDisabled";
      msg: "Token withdrawals are disabled by the withdrawal mode";
    },
    {
      code: 6022;
      name: "withdrawViaSellDisabled";
      msg: "Sell withdrawals are disabled by the withdrawal mode";
    },
    {
      code: 6023;
      name: "accountNotMigrated";
      msg: "Performance package has not been resized to the current layout";
    },
    {
      code: 6024;
      name: "invalidQuoteMint";
      msg: "Quote mint must differ from the package's token mint";
    },
    {
      code: 6025;
      name: "quoteSweepAccountsIncomplete";
      msg: "The package's quote account and the quote destination must be passed together";
    },
    {
      code: 6026;
      name: "oracleMintMismatch";
      msg: "Oracle Dao's base mint must be the package's token mint";
    },
    {
      code: 6027;
      name: "maxQuoteValueExceeded";
      msg: "Withdrawal is valued above the recipient's maximum quote value";
    },
    {
      code: 6028;
      name: "staleChangeRequest";
      msg: "Change request was proposed before the last executed change was proposed";
    },
    {
      code: 6029;
      name: "changeRequestMismatch";
      msg: "Change request was proposed at a different time than the executor expected";
    },
  ];
  types: [
    {
      name: "cappedWithdrawal";
      docs: ["Present on a withdrawal that ran under active limits"];
      type: {
        kind: "struct";
        fields: [
          {
            name: "price";
            docs: [
              "The price the withdrawal was valued at: the higher of the spot pool's observation and its reserve price",
            ];
            type: "u128";
          },
          {
            name: "quoteValue";
            docs: ["`amount` valued at that price, in quote atoms"];
            type: "u64";
          },
          {
            name: "usage";
            docs: ["Window usage after this withdrawal"];
            type: {
              defined: {
                name: "windowUsage";
              };
            };
          },
        ];
      };
    },
    {
      name: "changeExecuted";
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
            name: "performancePackage";
            type: "pubkey";
          },
          {
            name: "changeRequest";
            type: "pubkey";
          },
          {
            name: "executor";
            type: "pubkey";
          },
          {
            name: "changeType";
            type: {
              defined: {
                name: "changeType";
              };
            };
          },
        ];
      };
    },
    {
      name: "changePerformancePackageAuthorityParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "newPerformancePackageAuthority";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "changeProposed";
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
            name: "locker";
            type: "pubkey";
          },
          {
            name: "changeRequest";
            type: "pubkey";
          },
          {
            name: "proposer";
            type: "pubkey";
          },
          {
            name: "changeType";
            type: {
              defined: {
                name: "changeType";
              };
            };
          },
        ];
      };
    },
    {
      name: "changeRequest";
      type: {
        kind: "struct";
        fields: [
          {
            name: "performancePackage";
            docs: ["The performance package this change applies to"];
            type: "pubkey";
          },
          {
            name: "changeType";
            docs: ["What is being changed"];
            type: {
              defined: {
                name: "changeType";
              };
            };
          },
          {
            name: "proposedAt";
            docs: ["When the change was proposed"];
            type: "i64";
          },
          {
            name: "proposerType";
            docs: [
              "Who proposed this change (either token_recipient or locker_authority)",
            ];
            type: {
              defined: {
                name: "proposerType";
              };
            };
          },
          {
            name: "pdaNonce";
            docs: ["Used to derive the PDA along with the proposer"];
            type: "u32";
          },
          {
            name: "pdaBump";
            docs: ["The PDA bump"];
            type: "u8";
          },
        ];
      };
    },
    {
      name: "changeType";
      type: {
        kind: "enum";
        variants: [
          {
            name: "oracle";
            fields: [
              {
                name: "newOracleConfig";
                type: {
                  defined: {
                    name: "oracleConfig";
                  };
                };
              },
            ];
          },
          {
            name: "recipient";
            fields: [
              {
                name: "newRecipient";
                type: "pubkey";
              },
            ];
          },
          {
            name: "unlockTerms";
            fields: [
              {
                name: "minUnlockTimestamp";
                type: "i64";
              },
              {
                name: "limits";
                type: {
                  option: {
                    defined: {
                      name: "limitsParams";
                    };
                  };
                };
              },
            ];
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
            name: "performancePackageSeqNum";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "dao";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amm";
            docs: ["Embedded FutarchyAmm - 1:1 relationship"];
            type: {
              defined: {
                name: "futarchyAmm";
              };
            };
          },
          {
            name: "nonce";
            docs: ["`nonce` + `dao_creator` are PDA seeds"];
            type: "u64";
          },
          {
            name: "daoCreator";
            type: "pubkey";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
          {
            name: "squadsMultisig";
            type: "pubkey";
          },
          {
            name: "squadsMultisigVault";
            type: "pubkey";
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
            name: "proposalCount";
            type: "u32";
          },
          {
            name: "passThresholdBps";
            type: "u16";
          },
          {
            name: "secondsPerProposal";
            type: "u32";
          },
          {
            name: "twapInitialObservation";
            docs: [
              "For manipulation-resistance the TWAP is a time-weighted average observation,",
              "where observation tries to approximate price but can only move by",
              "`twap_max_observation_change_per_update` per update. Because it can only move",
              "a little bit per update, you need to check that it has a good initial observation.",
              "Otherwise, an attacker could create a very high initial observation in the pass",
              "market and a very low one in the fail market to force the proposal to pass.",
              "",
              "We recommend setting an initial observation around the spot price of the token,",
              "and max observation change per update around 2% the spot price of the token.",
              "For example, if the spot price of META is $400, we'd recommend setting an initial",
              "observation of 400 (converted into the AMM prices) and a max observation change per",
              "update of 8 (also converted into the AMM prices). Observations can be updated once",
              "a minute, so 2% allows the proposal market to reach double the spot price or 0",
              "in 50 minutes.",
            ];
            type: "u128";
          },
          {
            name: "twapMaxObservationChangePerUpdate";
            type: "u128";
          },
          {
            name: "twapStartDelaySeconds";
            docs: [
              "Forces TWAP calculation to start after `twap_start_delay_seconds` seconds",
            ];
            type: "u32";
          },
          {
            name: "minQuoteFutarchicLiquidity";
            docs: [
              "As an anti-spam measure and to help liquidity, you need to lock up some liquidity",
              "in both futarchic markets in order to create a proposal.",
              "",
              "For example, for META, we can use a `min_quote_futarchic_liquidity` of",
              "5000 * 1_000_000 (5000 USDC) and a `min_base_futarchic_liquidity` of",
              "10 * 1_000_000_000 (10 META).",
            ];
            type: "u64";
          },
          {
            name: "minBaseFutarchicLiquidity";
            type: "u64";
          },
          {
            name: "baseToStake";
            docs: [
              "Minimum amount of base tokens that must be staked to launch a proposal",
            ];
            type: "u64";
          },
          {
            name: "seqNum";
            type: "u64";
          },
          {
            name: "initialSpendingLimit";
            docs: [
              "The authoritative record of what the Squads spending limit should be.",
              "`None` = no limit. Kept in sync with the Squads-side account by",
              "`sync_spending_limit`. (Named for its original init-only role)",
            ];
            type: {
              option: {
                defined: {
                  name: "initialSpendingLimit";
                };
              };
            };
          },
          {
            name: "teamSponsoredPassThresholdBps";
            docs: [
              "The percentage, in basis points, the pass price needs to be above the",
              "fail price in order for the proposal to pass for team-sponsored proposals.",
              "",
              "Can be negative to allow for team-sponsored proposals to pass by default.",
            ];
            type: "i16";
          },
          {
            name: "teamAddress";
            type: "pubkey";
          },
          {
            name: "optimisticProposal";
            docs: ["Deprecated in favor of typed proposals"];
            type: {
              option: {
                defined: {
                  name: "optimisticProposal";
                };
              };
            };
          },
          {
            name: "isOptimisticGovernanceEnabled";
            docs: ["Deprecated in favor of typed proposals"];
            type: "bool";
          },
          {
            name: "liquidator";
            docs: [
              "`Some` means the DAO has been liquidated, and holds who runs the estate.",
              "Set once by `finalize_proposal` the moment a hostile liquidation",
              "passes, never cleared.",
            ];
            type: {
              option: "pubkey";
            };
          },
          {
            name: "lastFailedTakeoverAt";
            docs: ["Unix time of the last failed hostile takeover. 0 = never."];
            type: "i64";
          },
          {
            name: "lastFailedLiquidationAt";
            docs: [
              "Unix time of the last failed hostile liquidation. 0 = never.",
            ];
            type: "i64";
          },
          {
            name: "spendingLimitDirty";
            docs: [
              "Set by every write to the spending-limit record (`initial_spending_limit`),",
              "consumed by `sync_spending_limit`.",
            ];
            type: "bool";
          },
          {
            name: "lastBuybackFinalizedAt";
            docs: ["Unix time of the last buyback finalization. 0 = never."];
            type: "i64";
          },
          {
            name: "typedProposalsEnabled";
            docs: [
              "Whether the DAO runs on the mini-instructions catalog. Never turns off.",
            ];
            type: "bool";
          },
        ];
      };
    },
    {
      name: "executeChangeParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "expectedProposedAt";
            type: "i64";
          },
        ];
      };
    },
    {
      name: "futarchyAmm";
      type: {
        kind: "struct";
        fields: [
          {
            name: "state";
            type: {
              defined: {
                name: "poolState";
              };
            };
          },
          {
            name: "totalLiquidity";
            type: "u128";
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
            name: "ammBaseVault";
            type: "pubkey";
          },
          {
            name: "ammQuoteVault";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "initialSpendingLimit";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amountPerMonth";
            type: "u64";
          },
          {
            name: "members";
            type: {
              vec: "pubkey";
            };
          },
        ];
      };
    },
    {
      name: "initializePerformancePackageParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "tranches";
            type: {
              vec: {
                defined: {
                  name: "tranche";
                };
              };
            };
          },
          {
            name: "minUnlockTimestamp";
            type: "i64";
          },
          {
            name: "oracleConfig";
            type: {
              defined: {
                name: "oracleConfig";
              };
            };
          },
          {
            name: "twapLengthSeconds";
            type: "u32";
          },
          {
            name: "grantee";
            type: "pubkey";
          },
          {
            name: "performancePackageAuthority";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "initializePerformancePackageWithLimitsParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "base";
            type: {
              defined: {
                name: "initializePerformancePackageParams";
              };
            };
          },
          {
            name: "limits";
            type: {
              option: {
                defined: {
                  name: "limitsParams";
                };
              };
            };
          },
        ];
      };
    },
    {
      name: "limitsParams";
      docs: [
        "What the two parties agree on; the program supplies `start_timestamp`",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "endTimestamp";
            type: "i64";
          },
          {
            name: "windowSeconds";
            type: "u32";
          },
          {
            name: "maxTokensPerWindow";
            type: "u64";
          },
          {
            name: "maxQuotePerWindow";
            type: "u64";
          },
          {
            name: "withdrawalMode";
            type: {
              defined: {
                name: "withdrawalMode";
              };
            };
          },
        ];
      };
    },
    {
      name: "optimisticProposal";
      type: {
        kind: "struct";
        fields: [
          {
            name: "squadsProposal";
            docs: [
              "The squads proposal currently enqueued for execution if not challenged by a new proposal.",
            ];
            type: "pubkey";
          },
          {
            name: "enqueuedTimestamp";
            docs: [
              "The timestamp when the active optimistic squads proposal was enqueued.",
            ];
            type: "i64";
          },
        ];
      };
    },
    {
      name: "oracleConfig";
      docs: [
        "Starting at `byte_offset` in `oracle_account`, the unlock instructions read:",
        "- 16 bytes for the aggregator, stored as a little endian u128",
        "- 8 bytes for the timestamp that the aggregator was last updated, stored as",
        "a little endian i64",
        "",
        "While withdrawal limits are active, `oracle_account` must also be a futarchy",
        "`Dao`: the withdraw instructions value withdrawals from its spot pool, at the",
        "higher of the pool's damped observation and its reserve price.",
        "",
        "The aggregator should be a weighted sum of prices, where the weight is the",
        "number of seconds between prices. Here's an example:",
        "- at second 0, the aggregator is 0",
        "- at second 1, the price is 10 and the aggregator is 10 (10 * 1)",
        "- at second 4, the price is 11 and 3 seconds have passed, so the aggregator is",
        "10 + 11 * 3 = 43",
        "",
        "This allows our program to read a TWAP over a time period by reading the",
        "aggregator value at the beginning and at the end, and dividing the difference",
        "by the number of seconds between the two.",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "oracleAccount";
            type: "pubkey";
          },
          {
            name: "byteOffset";
            type: "u32";
          },
        ];
      };
    },
    {
      name: "performancePackage";
      type: {
        kind: "struct";
        fields: [
          {
            name: "tranches";
            docs: ["The tranches that make up the performance package"];
            type: {
              vec: {
                defined: {
                  name: "storedTranche";
                };
              };
            };
          },
          {
            name: "totalTokenAmount";
            docs: ["Total amount of tokens in the performance package"];
            type: "u64";
          },
          {
            name: "alreadyUnlockedAmount";
            docs: ["Amount of tokens already unlocked"];
            type: "u64";
          },
          {
            name: "minUnlockTimestamp";
            docs: ["The timestamp when unlocking can begin"];
            type: "i64";
          },
          {
            name: "oracleConfig";
            docs: ["Where to pull price data from"];
            type: {
              defined: {
                name: "oracleConfig";
              };
            };
          },
          {
            name: "twapLengthSeconds";
            docs: [
              "Length of time in seconds for TWAP calculation, between 1 day and 1 year",
            ];
            type: "u32";
          },
          {
            name: "recipient";
            docs: ["The recipient of the tokens when unlocked"];
            type: "pubkey";
          },
          {
            name: "state";
            docs: ["The current state of the locker"];
            type: {
              defined: {
                name: "performancePackageState";
              };
            };
          },
          {
            name: "createKey";
            docs: ["Used to derive the PDA"];
            type: "pubkey";
          },
          {
            name: "pdaBump";
            docs: ["The PDA bump"];
            type: "u8";
          },
          {
            name: "performancePackageAuthority";
            docs: [
              "The authorized locker authority that can execute changes, usually the organization",
            ];
            type: "pubkey";
          },
          {
            name: "tokenMint";
            docs: ["The mint of the locked tokens"];
            type: "pubkey";
          },
          {
            name: "seqNum";
            docs: [
              "The sequence number of the performance package, used for indexing events",
            ];
            type: "u64";
          },
          {
            name: "performancePackageTokenVault";
            docs: ["The vault that stores the tokens"];
            type: "pubkey";
          },
          {
            name: "withdrawalPolicy";
            docs: ["`None` means uncapped, and so do expired limits"];
            type: {
              option: {
                defined: {
                  name: "withdrawalPolicy";
                };
              };
            };
          },
          {
            name: "lastChangeProposedAt";
            docs: [
              "When the last executed change was proposed (the creation time until then); requests proposed earlier can no longer be executed",
            ];
            type: "i64";
          },
        ];
      };
    },
    {
      name: "performancePackageAuthorityChanged";
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
            name: "locker";
            type: "pubkey";
          },
          {
            name: "oldAuthority";
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
      name: "performancePackageInitialized";
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
            name: "performancePackage";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "performancePackageState";
      type: {
        kind: "enum";
        variants: [
          {
            name: "locked";
          },
          {
            name: "unlocking";
            fields: [
              {
                name: "startAggregator";
                docs: ["The aggregator value when unlocking started"];
                type: "u128";
              },
              {
                name: "startTimestamp";
                docs: ["The timestamp when unlocking started"];
                type: "i64";
              },
            ];
          },
        ];
      };
    },
    {
      name: "pool";
      type: {
        kind: "struct";
        fields: [
          {
            name: "oracle";
            type: {
              defined: {
                name: "twapOracle";
              };
            };
          },
          {
            name: "quoteReserves";
            type: "u64";
          },
          {
            name: "baseReserves";
            type: "u64";
          },
          {
            name: "quoteProtocolFeeBalance";
            type: "u64";
          },
          {
            name: "baseProtocolFeeBalance";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "poolState";
      type: {
        kind: "enum";
        variants: [
          {
            name: "spot";
            fields: [
              {
                name: "spot";
                type: {
                  defined: {
                    name: "pool";
                  };
                };
              },
            ];
          },
          {
            name: "futarchy";
            fields: [
              {
                name: "spot";
                type: {
                  defined: {
                    name: "pool";
                  };
                };
              },
              {
                name: "pass";
                type: {
                  defined: {
                    name: "pool";
                  };
                };
              },
              {
                name: "fail";
                type: {
                  defined: {
                    name: "pool";
                  };
                };
              },
            ];
          },
        ];
      };
    },
    {
      name: "proposeChangeParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "changeType";
            type: {
              defined: {
                name: "changeType";
              };
            };
          },
          {
            name: "pdaNonce";
            type: "u32";
          },
        ];
      };
    },
    {
      name: "proposerType";
      type: {
        kind: "enum";
        variants: [
          {
            name: "recipient";
          },
          {
            name: "authority";
          },
        ];
      };
    },
    {
      name: "storedTranche";
      type: {
        kind: "struct";
        fields: [
          {
            name: "priceThreshold";
            type: "u128";
          },
          {
            name: "tokenAmount";
            type: "u64";
          },
          {
            name: "isUnlocked";
            type: "bool";
          },
        ];
      };
    },
    {
      name: "tokensSold";
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
            name: "performancePackage";
            type: "pubkey";
          },
          {
            name: "recipient";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "quoteReceived";
            type: "u64";
          },
          {
            name: "minQuoteOut";
            type: "u64";
          },
          {
            name: "capped";
            docs: [
              "Window usage after this sale; `None` when no limits were active",
            ];
            type: {
              option: {
                defined: {
                  name: "windowUsage";
                };
              };
            };
          },
        ];
      };
    },
    {
      name: "tokensWithdrawn";
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
            name: "performancePackage";
            type: "pubkey";
          },
          {
            name: "recipient";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "capped";
            docs: ["`None` when no limits were active"];
            type: {
              option: {
                defined: {
                  name: "cappedWithdrawal";
                };
              };
            };
          },
        ];
      };
    },
    {
      name: "tranche";
      type: {
        kind: "struct";
        fields: [
          {
            name: "priceThreshold";
            docs: ["The price at which this tranch unlocks"];
            type: "u128";
          },
          {
            name: "tokenAmount";
            docs: ["The amount of tokens in this tranch"];
            type: "u64";
          },
        ];
      };
    },
    {
      name: "twapOracle";
      type: {
        kind: "struct";
        fields: [
          {
            name: "aggregator";
            docs: [
              "Running sum of seconds_since_last_update * last_observation.",
              "",
              "Assuming latest observations are as big as possible (u64::MAX * 1e12),",
              "we can store 18 million seconds worth of observations, which turns out to",
              "be ~213 days.",
              "",
              "Assuming that latest observations are 100x smaller than they could theoretically",
              "be, we can store ~57 years worth of them. Even this is a very",
              "very conservative assumption - META/USDC prices should be between 1e9 and",
              "1e15, which would overflow after 1e15 years.",
              "",
              "So in the case of an overflow, the aggregator rolls back to 0. It's the",
              "client's responsibility to sanity check the assets or to handle an",
              "aggregator at T2 being smaller than an aggregator at T1.",
            ];
            type: "u128";
          },
          {
            name: "lastUpdatedTimestamp";
            type: "i64";
          },
          {
            name: "createdAtTimestamp";
            type: "i64";
          },
          {
            name: "lastPrice";
            docs: [
              "A price is the number of quote units per base unit multiplied by 1e12.",
              "You cannot simply divide by 1e12 to get a price you can display in the UI",
              "because the base and quote decimals may be different. Instead, do:",
              "ui_price = (price * (10**(base_decimals - quote_decimals))) / 1e12",
            ];
            type: "u128";
          },
          {
            name: "lastObservation";
            docs: [
              "If we did a raw TWAP over prices, someone could push the TWAP heavily with",
              "a few extremely large outliers. So we use observations, which can only move",
              "by `max_observation_change_per_update` per update.",
            ];
            type: "u128";
          },
          {
            name: "maxObservationChangePerUpdate";
            docs: ["The most that an observation can change per update."];
            type: "u128";
          },
          {
            name: "initialObservation";
            docs: ["What the initial `latest_observation` is set to."];
            type: "u128";
          },
          {
            name: "startDelaySeconds";
            docs: [
              "Number of seconds after amm.created_at_slot to start recording TWAP",
            ];
            type: "u32";
          },
        ];
      };
    },
    {
      name: "unlockCompleted";
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
            name: "performancePackage";
            type: "pubkey";
          },
          {
            name: "tokenAmount";
            type: "u64";
          },
          {
            name: "recipient";
            type: "pubkey";
          },
          {
            name: "twapPrice";
            type: "u128";
          },
        ];
      };
    },
    {
      name: "unlockStarted";
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
            name: "performancePackage";
            type: "pubkey";
          },
          {
            name: "startAggregator";
            type: "u128";
          },
          {
            name: "startTimestamp";
            type: "i64";
          },
        ];
      };
    },
    {
      name: "windowUsage";
      docs: ["Usage in the window the last withdrawal fell in"];
      type: {
        kind: "struct";
        fields: [
          {
            name: "windowIndex";
            docs: [
              "`(now - limits.start_timestamp) / limits.window_seconds` at the last withdrawal",
            ];
            type: "i64";
          },
          {
            name: "tokensUsed";
            type: "u64";
          },
          {
            name: "quoteUsed";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "withdrawTokensParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "maxQuoteValue";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "withdrawViaSellParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "minQuoteOut";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "withdrawalLimits";
      type: {
        kind: "struct";
        fields: [
          {
            name: "startTimestamp";
            docs: [
              "Anchor for window boundaries; set by the program when limits take effect or `window_seconds` changes",
            ];
            type: "i64";
          },
          {
            name: "endTimestamp";
            docs: ["Caps apply while `now < end_timestamp`"];
            type: "i64";
          },
          {
            name: "windowSeconds";
            docs: ["Duration of the window in seconds"];
            type: "u32";
          },
          {
            name: "maxTokensPerWindow";
            docs: ["Max base tokens withdrawn per window"];
            type: "u64";
          },
          {
            name: "maxQuotePerWindow";
            docs: ["Max quote value withdrawn per window, in quote atoms"];
            type: "u64";
          },
          {
            name: "withdrawalMode";
            docs: [
              "Which withdrawal routes the recipient may use while the caps are active",
            ];
            type: {
              defined: {
                name: "withdrawalMode";
              };
            };
          },
        ];
      };
    },
    {
      name: "withdrawalMode";
      type: {
        kind: "enum";
        variants: [
          {
            name: "tokens";
          },
          {
            name: "sell";
          },
          {
            name: "both";
          },
        ];
      };
    },
    {
      name: "withdrawalPolicy";
      docs: [
        "The agreed limits together with the usage they are enforced against",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "limits";
            type: {
              defined: {
                name: "withdrawalLimits";
              };
            };
          },
          {
            name: "usage";
            type: {
              defined: {
                name: "windowUsage";
              };
            };
          },
        ];
      };
    },
  ];
  constants: [
    {
      name: "priceScale";
      docs: ["Scale of oracle prices: quote atoms per base atom, times 1e12"];
      type: "u128";
      value: "1000000000000";
    },
  ];
};
