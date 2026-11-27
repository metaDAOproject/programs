/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/bid_wall.json`.
 */
export type BidWall = {
  address: "WALL8ucBuUyL46QYxwYJjidaFYhdvxUFrgvBxPshERx";
  metadata: {
    name: "bidWall";
    version: "0.7.0";
    spec: "0.1.0";
    description: "A big wall of cash sitting at NAV, ready to take tokens from weak hands and burn them.";
  };
  instructions: [
    {
      name: "cancelBidWall";
      discriminator: [61, 200, 60, 115, 213, 88, 115, 138];
      accounts: [
        {
          name: "bidWall";
          writable: true;
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "authority";
          signer: true;
          relations: ["bidWall"];
        },
        {
          name: "feeRecipient";
          address: "6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf";
        },
        {
          name: "bidWallQuoteTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "bidWall";
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
          name: "authorityQuoteTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "authority";
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
          name: "feeRecipientQuoteTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "feeRecipient";
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
        },
        {
          name: "quoteMint";
          address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
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
      args: [];
    },
    {
      name: "closeBidWall";
      discriminator: [58, 249, 140, 44, 227, 80, 109, 78];
      accounts: [
        {
          name: "bidWall";
          writable: true;
        },
        {
          name: "authority";
          writable: true;
          relations: ["bidWall"];
        },
        {
          name: "feeRecipient";
          address: "6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf";
        },
        {
          name: "bidWallQuoteTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "bidWall";
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
          name: "authorityQuoteTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "authority";
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
          name: "feeRecipientQuoteTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "feeRecipient";
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
        },
        {
          name: "quoteMint";
          address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
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
      args: [];
    },
    {
      name: "collectFees";
      discriminator: [164, 152, 207, 99, 30, 186, 19, 182];
      accounts: [
        {
          name: "bidWall";
          writable: true;
        },
        {
          name: "cranker";
          signer: true;
        },
        {
          name: "bidWallQuoteTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "bidWall";
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
          name: "feeRecipientQuoteTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  82,
                  252,
                  193,
                  172,
                  131,
                  78,
                  181,
                  126,
                  228,
                  156,
                  201,
                  238,
                  216,
                  61,
                  22,
                  232,
                  177,
                  119,
                  80,
                  4,
                  10,
                  174,
                  136,
                  68,
                  116,
                  84,
                  24,
                  244,
                  205,
                  59,
                  72,
                  150,
                ];
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
          name: "quoteMint";
          address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
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
      name: "initializeBidWall";
      discriminator: [255, 36, 136, 45, 188, 82, 221, 218];
      accounts: [
        {
          name: "bidWall";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 105, 100, 95, 119, 97, 108, 108];
              },
              {
                kind: "account";
                path: "baseMint";
              },
              {
                kind: "account";
                path: "creator";
              },
              {
                kind: "arg";
                path: "args.nonce";
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
          name: "feeRecipient";
          address: "6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf";
        },
        {
          name: "creator";
          signer: true;
        },
        {
          name: "authority";
        },
        {
          name: "bidWallQuoteTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "bidWall";
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
          name: "creatorQuoteTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "creator";
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
          name: "daoTreasury";
        },
        {
          name: "baseMint";
        },
        {
          name: "quoteMint";
          address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
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
              name: "initializeBidWallArgs";
            };
          };
        },
      ];
    },
    {
      name: "sellTokens";
      discriminator: [114, 242, 25, 12, 62, 126, 92, 2];
      accounts: [
        {
          name: "bidWall";
          writable: true;
        },
        {
          name: "user";
          signer: true;
        },
        {
          name: "userTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "user";
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
          name: "userQuoteTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "user";
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
          name: "bidWallQuoteTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "bidWall";
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
          name: "daoTreasury";
        },
        {
          name: "daoTreasuryQuoteTokenAccount";
          pda: {
            seeds: [
              {
                kind: "account";
                path: "daoTreasury";
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
          relations: ["bidWall"];
        },
        {
          name: "quoteMint";
          address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
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
              name: "sellTokensArgs";
            };
          };
        },
      ];
    },
  ];
  accounts: [
    {
      name: "bidWall";
      discriminator: [61, 136, 53, 25, 97, 70, 228, 176];
    },
  ];
  events: [
    {
      name: "bidWallCanceledEvent";
      discriminator: [184, 235, 84, 224, 65, 67, 5, 82];
    },
    {
      name: "bidWallClosedEvent";
      discriminator: [184, 167, 138, 68, 201, 210, 121, 77];
    },
    {
      name: "bidWallFeesCollectedEvent";
      discriminator: [155, 195, 135, 59, 213, 142, 137, 41];
    },
    {
      name: "bidWallInitializedEvent";
      discriminator: [62, 174, 125, 214, 55, 40, 12, 76];
    },
    {
      name: "bidWallTokensSoldEvent";
      discriminator: [113, 125, 131, 85, 252, 189, 79, 96];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "bidWallExpired";
      msg: "Bid wall expired";
    },
    {
      code: 6001;
      name: "bidWallNotExpired";
      msg: "Bid wall not expired";
    },
    {
      code: 6002;
      name: "feeRecipientMismatch";
      msg: "Fee recipient mismatch";
    },
    {
      code: 6003;
      name: "insufficientQuoteReserves";
      msg: "Insufficient quote reserves";
    },
    {
      code: 6004;
      name: "bidWallDepleted";
      msg: "Bid wall depleted";
    },
    {
      code: 6005;
      name: "invalidInputAmount";
      msg: "Invalid input amount";
    },
    {
      code: 6006;
      name: "invalidCrankAddress";
      msg: "Invalid crank address";
    },
    {
      code: 6007;
      name: "insufficientOutputAmount";
      msg: "Insufficient output amount";
    },
  ];
  types: [
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
            type: "pubkey";
          },
          {
            name: "authority";
            docs: ["The authority of the bid wall."];
            type: "pubkey";
          },
          {
            name: "daoTreasury";
            docs: ["The DAO treasury address."];
            type: "pubkey";
          },
          {
            name: "baseMint";
            docs: ["The mint of the token being sold into the bid wall."];
            type: "pubkey";
          },
          {
            name: "feeRecipient";
            docs: ["The recipient of the fees collected by the bid wall."];
            type: "pubkey";
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
    {
      name: "bidWallCanceledEvent";
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
            name: "bidWall";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "bidWallClosedEvent";
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
            name: "bidWall";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "bidWallFeesCollectedEvent";
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
            name: "bidWall";
            type: "pubkey";
          },
          {
            name: "feesCollected";
            type: "u64";
          },
          {
            name: "postBidWallQuoteTokenAccountAmount";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "bidWallInitializedEvent";
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
            name: "bidWall";
            type: "pubkey";
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
            name: "amount";
            type: "u64";
          },
          {
            name: "creator";
            type: "pubkey";
          },
          {
            name: "authority";
            type: "pubkey";
          },
          {
            name: "daoTreasury";
            type: "pubkey";
          },
          {
            name: "baseMint";
            type: "pubkey";
          },
          {
            name: "feeRecipient";
            type: "pubkey";
          },
          {
            name: "durationSeconds";
            type: "u32";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "bidWallTokensSoldEvent";
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
            name: "bidWall";
            type: "pubkey";
          },
          {
            name: "amountIn";
            type: "u64";
          },
          {
            name: "amountOut";
            type: "u64";
          },
          {
            name: "fee";
            type: "u64";
          },
          {
            name: "postBidWallQuoteTokenAccountAmount";
            type: "u64";
          },
          {
            name: "postBidWallBaseBoughtAmount";
            type: "u64";
          },
          {
            name: "user";
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
            name: "bidWallSeqNum";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "initializeBidWallArgs";
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
      name: "sellTokensArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amountIn";
            type: "u64";
          },
          {
            name: "minAmountOut";
            type: "u64";
          },
        ];
      };
    },
  ];
};
