/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/futarchy.json`.
 */
export type Futarchy = {
  address: "FUTARELBfJfQ8RDGhg1wdhddq1odMAJUePHFuBYfUxKq";
  metadata: {
    name: "futarchy";
    version: "0.6.2";
    spec: "0.1.0";
    description: "SVM-based program for running futarchy";
  };
  instructions: [
    {
      name: "adminCancelProposal";
      discriminator: [95, 233, 121, 193, 90, 80, 147, 255];
      accounts: [
        {
          name: "proposal";
          writable: true;
        },
        {
          name: "dao";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "question";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "squadsProposal";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "squadsMultisig";
          relations: ["dao"];
        },
        {
          name: "squadsMultisigProgram";
          address: "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
        },
        {
          name: "ammPassBaseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "proposal.pass_base_mint";
                account: "proposal";
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
          name: "ammPassQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "proposal.pass_quote_mint";
                account: "proposal";
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
          name: "ammFailBaseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "proposal.fail_base_mint";
                account: "proposal";
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
          name: "ammFailQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "proposal.fail_quote_mint";
                account: "proposal";
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
          name: "ammBaseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "dao.base_mint";
                account: "dao";
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
          name: "ammQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "dao.quote_mint";
                account: "dao";
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
          name: "vaultProgram";
          address: "VLTX1ishMBbcX3rdBWGssxawAo1Q2X2qxYFYqiGodVg";
        },
        {
          name: "vaultEventAuthority";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "quoteVault";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "quoteVaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "passQuoteMint";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "failQuoteMint";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "passBaseMint";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "failBaseMint";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "baseVault";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "baseVaultUnderlyingTokenAccount";
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
      name: "adminEnqueueMultisigProposalApproval";
      discriminator: [61, 199, 241, 100, 238, 220, 84, 78];
      accounts: [
        {
          name: "dao";
        },
        {
          name: "admin";
          writable: true;
          signer: true;
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
              kind: "const";
              value: [
                6,
                129,
                196,
                206,
                71,
                226,
                35,
                104,
                184,
                177,
                85,
                94,
                200,
                135,
                175,
                9,
                46,
                252,
                126,
                251,
                182,
                108,
                163,
                245,
                47,
                191,
                104,
                212,
                172,
                156,
                183,
                168,
              ];
            };
          };
          relations: ["dao"];
        },
        {
          name: "squadsMultisigProposal";
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
                value: [116, 114, 97, 110, 115, 97, 99, 116, 105, 111, 110];
              },
              {
                kind: "arg";
                path: "args.transaction_index";
              },
              {
                kind: "const";
                value: [112, 114, 111, 112, 111, 115, 97, 108];
              },
            ];
            program: {
              kind: "const";
              value: [
                6,
                129,
                196,
                206,
                71,
                226,
                35,
                104,
                184,
                177,
                85,
                94,
                200,
                135,
                175,
                9,
                46,
                252,
                126,
                251,
                182,
                108,
                163,
                245,
                47,
                191,
                104,
                212,
                172,
                156,
                183,
                168,
              ];
            };
          };
        },
        {
          name: "enqueuedApproval";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  101,
                  110,
                  113,
                  117,
                  101,
                  117,
                  101,
                  100,
                  95,
                  97,
                  112,
                  112,
                  114,
                  111,
                  118,
                  97,
                  108,
                ];
              },
              {
                kind: "account";
                path: "dao";
              },
              {
                kind: "arg";
                path: "args.transaction_index";
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "adminEnqueueMultisigProposalApprovalArgs";
            };
          };
        },
      ];
    },
    {
      name: "adminEnqueueMultisigProposalCancellation";
      discriminator: [130, 141, 11, 45, 40, 95, 131, 2];
      accounts: [
        {
          name: "dao";
        },
        {
          name: "admin";
          writable: true;
          signer: true;
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
              kind: "const";
              value: [
                6,
                129,
                196,
                206,
                71,
                226,
                35,
                104,
                184,
                177,
                85,
                94,
                200,
                135,
                175,
                9,
                46,
                252,
                126,
                251,
                182,
                108,
                163,
                245,
                47,
                191,
                104,
                212,
                172,
                156,
                183,
                168,
              ];
            };
          };
          relations: ["dao"];
        },
        {
          name: "squadsMultisigProposal";
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
                value: [116, 114, 97, 110, 115, 97, 99, 116, 105, 111, 110];
              },
              {
                kind: "arg";
                path: "args.transaction_index";
              },
              {
                kind: "const";
                value: [112, 114, 111, 112, 111, 115, 97, 108];
              },
            ];
            program: {
              kind: "const";
              value: [
                6,
                129,
                196,
                206,
                71,
                226,
                35,
                104,
                184,
                177,
                85,
                94,
                200,
                135,
                175,
                9,
                46,
                252,
                126,
                251,
                182,
                108,
                163,
                245,
                47,
                191,
                104,
                212,
                172,
                156,
                183,
                168,
              ];
            };
          };
        },
        {
          name: "enqueuedCancellation";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  101,
                  110,
                  113,
                  117,
                  101,
                  117,
                  101,
                  100,
                  95,
                  99,
                  97,
                  110,
                  99,
                  101,
                  108,
                  108,
                  97,
                  116,
                  105,
                  111,
                  110,
                ];
              },
              {
                kind: "account";
                path: "dao";
              },
              {
                kind: "arg";
                path: "args.transaction_index";
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "adminEnqueueMultisigProposalCancellationArgs";
            };
          };
        },
      ];
    },
    {
      name: "adminExecuteMultisigProposal";
      discriminator: [226, 221, 40, 160, 169, 90, 48, 42];
      accounts: [
        {
          name: "dao";
          writable: true;
        },
        {
          name: "admin";
          writable: true;
          signer: true;
        },
        {
          name: "squadsMultisig";
          writable: true;
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
              path: "squadsMultisigProgram";
            };
          };
          relations: ["dao"];
        },
        {
          name: "squadsMultisigProposal";
          writable: true;
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
                value: [116, 114, 97, 110, 115, 97, 99, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "squads_multisig_vault_transaction.index";
                account: "squadsVaultTransaction";
              },
              {
                kind: "const";
                value: [112, 114, 111, 112, 111, 115, 97, 108];
              },
            ];
            program: {
              kind: "account";
              path: "squadsMultisigProgram";
            };
          };
        },
        {
          name: "squadsMultisigVaultTransaction";
          writable: true;
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
                value: [116, 114, 97, 110, 115, 97, 99, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "squads_multisig_vault_transaction.index";
                account: "squadsVaultTransaction";
              },
            ];
            program: {
              kind: "account";
              path: "squadsMultisigProgram";
            };
          };
        },
        {
          name: "squadsMultisigProgram";
          address: "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
        },
      ];
      args: [];
    },
    {
      name: "adminRemoveProposal";
      discriminator: [242, 199, 27, 28, 7, 108, 122, 73];
      accounts: [
        {
          name: "proposal";
          writable: true;
        },
        {
          name: "dao";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "admin";
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
      args: [];
    },
    {
      name: "adminUpdateProposalParams";
      discriminator: [147, 207, 200, 2, 66, 7, 119, 180];
      accounts: [
        {
          name: "dao";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "proposal";
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
              name: "adminUpdateProposalParamsArgs";
            };
          };
        },
      ];
    },
    {
      name: "collectFees";
      discriminator: [164, 152, 207, 99, 30, 186, 19, 182];
      accounts: [
        {
          name: "dao";
          writable: true;
        },
        {
          name: "admin";
          signer: true;
        },
        {
          name: "baseTokenAccount";
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
                path: "dao.base_mint";
                account: "dao";
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
          name: "quoteTokenAccount";
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
                path: "dao.quote_mint";
                account: "dao";
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
          name: "ammBaseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "dao.base_mint";
                account: "dao";
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
          name: "ammQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "dao.quote_mint";
                account: "dao";
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
      name: "collectMeteoraDammFees";
      discriminator: [139, 212, 105, 118, 126, 54, 214, 143];
      accounts: [
        {
          name: "dao";
          writable: true;
        },
        {
          name: "admin";
          writable: true;
          signer: true;
        },
        {
          name: "squadsMultisig";
          writable: true;
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
          writable: true;
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
          name: "squadsMultisigVaultTransaction";
          writable: true;
        },
        {
          name: "squadsMultisigProposal";
          writable: true;
        },
        {
          name: "squadsMultisigPermissionlessAccount";
          signer: true;
          address: "EP3SoC2SvR3d4c2eXVBvhEMWSr2j3YtoCY3UMiQV7BPD";
        },
        {
          name: "meteoraClaimPositionFeesAccounts";
          accounts: [
            {
              name: "dammV2Program";
              address: "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG";
            },
            {
              name: "dammV2EventAuthority";
            },
            {
              name: "poolAuthority";
              address: "HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC";
            },
            {
              name: "pool";
            },
            {
              name: "position";
              writable: true;
            },
            {
              name: "tokenAAccount";
              docs: ["Token account of base tokens recipient"];
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
                    path: "tokenAMint";
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
              name: "tokenBAccount";
              docs: ["Token account of quote tokens recipient"];
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
                    path: "tokenBMint";
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
              name: "tokenAVault";
              writable: true;
            },
            {
              name: "tokenBVault";
              writable: true;
            },
            {
              name: "tokenAMint";
            },
            {
              name: "tokenBMint";
            },
            {
              name: "positionNftAccount";
            },
            {
              name: "owner";
            },
            {
              name: "tokenAProgram";
            },
            {
              name: "tokenBProgram";
            },
          ];
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
      name: "conditionalSwap";
      discriminator: [194, 136, 220, 89, 242, 169, 130, 157];
      accounts: [
        {
          name: "dao";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "ammBaseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "dao.base_mint";
                account: "dao";
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
          name: "ammQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "dao.quote_mint";
                account: "dao";
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
          name: "proposal";
        },
        {
          name: "ammPassBaseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "proposal.pass_base_mint";
                account: "proposal";
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
          name: "ammPassQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "proposal.pass_quote_mint";
                account: "proposal";
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
          name: "ammFailBaseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "proposal.fail_base_mint";
                account: "proposal";
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
          name: "ammFailQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "proposal.fail_quote_mint";
                account: "proposal";
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
          name: "trader";
          signer: true;
        },
        {
          name: "userInputAccount";
          writable: true;
        },
        {
          name: "userOutputAccount";
          writable: true;
        },
        {
          name: "baseVault";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "baseVaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "quoteVault";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "quoteVaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "passBaseMint";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "failBaseMint";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "passQuoteMint";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "failQuoteMint";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "conditionalVaultProgram";
          address: "VLTX1ishMBbcX3rdBWGssxawAo1Q2X2qxYFYqiGodVg";
        },
        {
          name: "vaultEventAuthority";
        },
        {
          name: "question";
          relations: ["proposal"];
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
          name: "params";
          type: {
            defined: {
              name: "conditionalSwapParams";
            };
          };
        },
      ];
    },
    {
      name: "executeMultisigProposalApproval";
      discriminator: [124, 144, 201, 164, 182, 226, 193, 224];
      accounts: [
        {
          name: "dao";
          writable: true;
          relations: ["enqueuedApproval"];
        },
        {
          name: "rentReceiver";
          writable: true;
          signer: true;
        },
        {
          name: "squadsMultisig";
          writable: true;
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
              kind: "const";
              value: [
                6,
                129,
                196,
                206,
                71,
                226,
                35,
                104,
                184,
                177,
                85,
                94,
                200,
                135,
                175,
                9,
                46,
                252,
                126,
                251,
                182,
                108,
                163,
                245,
                47,
                191,
                104,
                212,
                172,
                156,
                183,
                168,
              ];
            };
          };
          relations: ["dao"];
        },
        {
          name: "squadsMultisigProposal";
          writable: true;
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
                value: [116, 114, 97, 110, 115, 97, 99, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "enqueued_approval.transaction_index";
                account: "enqueuedMultisigProposalApproval";
              },
              {
                kind: "const";
                value: [112, 114, 111, 112, 111, 115, 97, 108];
              },
            ];
            program: {
              kind: "const";
              value: [
                6,
                129,
                196,
                206,
                71,
                226,
                35,
                104,
                184,
                177,
                85,
                94,
                200,
                135,
                175,
                9,
                46,
                252,
                126,
                251,
                182,
                108,
                163,
                245,
                47,
                191,
                104,
                212,
                172,
                156,
                183,
                168,
              ];
            };
          };
        },
        {
          name: "enqueuedApproval";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  101,
                  110,
                  113,
                  117,
                  101,
                  117,
                  101,
                  100,
                  95,
                  97,
                  112,
                  112,
                  114,
                  111,
                  118,
                  97,
                  108,
                ];
              },
              {
                kind: "account";
                path: "dao";
              },
              {
                kind: "account";
                path: "enqueued_approval.transaction_index";
                account: "enqueuedMultisigProposalApproval";
              },
            ];
          };
        },
        {
          name: "squadsMultisigProgram";
          address: "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
        },
      ];
      args: [];
    },
    {
      name: "executeMultisigProposalCancellation";
      discriminator: [249, 69, 159, 255, 236, 21, 243, 30];
      accounts: [
        {
          name: "dao";
          writable: true;
          relations: ["enqueuedCancellation"];
        },
        {
          name: "rentReceiver";
          writable: true;
          signer: true;
        },
        {
          name: "squadsMultisig";
          writable: true;
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
              kind: "const";
              value: [
                6,
                129,
                196,
                206,
                71,
                226,
                35,
                104,
                184,
                177,
                85,
                94,
                200,
                135,
                175,
                9,
                46,
                252,
                126,
                251,
                182,
                108,
                163,
                245,
                47,
                191,
                104,
                212,
                172,
                156,
                183,
                168,
              ];
            };
          };
          relations: ["dao"];
        },
        {
          name: "squadsMultisigProposal";
          writable: true;
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
                value: [116, 114, 97, 110, 115, 97, 99, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "enqueued_cancellation.transaction_index";
                account: "enqueuedMultisigProposalCancellation";
              },
              {
                kind: "const";
                value: [112, 114, 111, 112, 111, 115, 97, 108];
              },
            ];
            program: {
              kind: "const";
              value: [
                6,
                129,
                196,
                206,
                71,
                226,
                35,
                104,
                184,
                177,
                85,
                94,
                200,
                135,
                175,
                9,
                46,
                252,
                126,
                251,
                182,
                108,
                163,
                245,
                47,
                191,
                104,
                212,
                172,
                156,
                183,
                168,
              ];
            };
          };
        },
        {
          name: "enqueuedCancellation";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  101,
                  110,
                  113,
                  117,
                  101,
                  117,
                  101,
                  100,
                  95,
                  99,
                  97,
                  110,
                  99,
                  101,
                  108,
                  108,
                  97,
                  116,
                  105,
                  111,
                  110,
                ];
              },
              {
                kind: "account";
                path: "dao";
              },
              {
                kind: "account";
                path: "enqueued_cancellation.transaction_index";
                account: "enqueuedMultisigProposalCancellation";
              },
            ];
          };
        },
        {
          name: "squadsMultisigProgram";
          address: "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
        },
      ];
      args: [];
    },
    {
      name: "finalizeProposal";
      discriminator: [23, 68, 51, 167, 109, 173, 187, 164];
      accounts: [
        {
          name: "proposal";
          writable: true;
        },
        {
          name: "dao";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "question";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "squadsProposal";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "squadsMultisig";
          relations: ["dao"];
        },
        {
          name: "squadsMultisigProgram";
          address: "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
        },
        {
          name: "ammPassBaseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "proposal.pass_base_mint";
                account: "proposal";
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
          name: "ammPassQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "proposal.pass_quote_mint";
                account: "proposal";
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
          name: "ammFailBaseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "proposal.fail_base_mint";
                account: "proposal";
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
          name: "ammFailQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "proposal.fail_quote_mint";
                account: "proposal";
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
          name: "ammBaseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "dao.base_mint";
                account: "dao";
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
          name: "ammQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "dao.quote_mint";
                account: "dao";
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
          name: "vaultProgram";
          address: "VLTX1ishMBbcX3rdBWGssxawAo1Q2X2qxYFYqiGodVg";
        },
        {
          name: "vaultEventAuthority";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "quoteVault";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "quoteVaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "passQuoteMint";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "failQuoteMint";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "passBaseMint";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "failBaseMint";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "baseVault";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "baseVaultUnderlyingTokenAccount";
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
      name: "initializeBuybackTokenProposal";
      discriminator: [78, 26, 73, 211, 28, 51, 142, 107];
      accounts: [
        {
          name: "typedInitializeAccounts";
          accounts: [
            {
              name: "proposal";
              writable: true;
              pda: {
                seeds: [
                  {
                    kind: "const";
                    value: [112, 114, 111, 112, 111, 115, 97, 108];
                  },
                  {
                    kind: "account";
                    path: "squadsProposal";
                  },
                ];
              };
            },
            {
              name: "dao";
              writable: true;
            },
            {
              name: "squadsMultisig";
              writable: true;
              relations: ["dao"];
            },
            {
              name: "squadsTransaction";
              docs: [
                "and enforces that it is the transaction PDA for the next transaction index",
              ];
              writable: true;
            },
            {
              name: "squadsProposal";
              docs: [
                "enforces that it is the proposal PDA for the next transaction index",
              ];
              writable: true;
            },
            {
              name: "question";
              relations: ["baseVault", "quoteVault"];
            },
            {
              name: "baseVault";
            },
            {
              name: "quoteVault";
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
              name: "permissionlessAccount";
              docs: [
                "The Squads-side creator of the vault transaction and proposal, an",
                "Initiate | Execute member of every DAO multisig. Its keypair ships in",
                "the SDK, so anyone can provide this signature.",
              ];
              signer: true;
              address: "EP3SoC2SvR3d4c2eXVBvhEMWSr2j3YtoCY3UMiQV7BPD";
            },
            {
              name: "squadsProgram";
              address: "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
            },
            {
              name: "systemProgram";
              address: "11111111111111111111111111111111";
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
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "initializeBuybackTokenProposalArgs";
            };
          };
        },
      ];
    },
    {
      name: "initializeDao";
      discriminator: [128, 226, 96, 90, 39, 56, 24, 196];
      accounts: [
        {
          name: "dao";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [100, 97, 111];
              },
              {
                kind: "account";
                path: "daoCreator";
              },
              {
                kind: "arg";
                path: "params.nonce";
              },
            ];
          };
        },
        {
          name: "daoCreator";
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
          name: "baseMint";
        },
        {
          name: "quoteMint";
        },
        {
          name: "squadsMultisig";
          writable: true;
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
          name: "spendingLimit";
          writable: true;
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
                value: [
                  115,
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  108,
                  105,
                  109,
                  105,
                  116,
                ];
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
          name: "futarchyAmmBaseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
          name: "futarchyAmmQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
              name: "initializeDaoParams";
            };
          };
        },
      ];
    },
    {
      name: "initializeHostileLiquidateProposal";
      discriminator: [16, 196, 240, 71, 224, 103, 82, 202];
      accounts: [
        {
          name: "typedInitializeAccounts";
          accounts: [
            {
              name: "proposal";
              writable: true;
              pda: {
                seeds: [
                  {
                    kind: "const";
                    value: [112, 114, 111, 112, 111, 115, 97, 108];
                  },
                  {
                    kind: "account";
                    path: "squadsProposal";
                  },
                ];
              };
            },
            {
              name: "dao";
              writable: true;
            },
            {
              name: "squadsMultisig";
              writable: true;
              relations: ["dao"];
            },
            {
              name: "squadsTransaction";
              docs: [
                "and enforces that it is the transaction PDA for the next transaction index",
              ];
              writable: true;
            },
            {
              name: "squadsProposal";
              docs: [
                "enforces that it is the proposal PDA for the next transaction index",
              ];
              writable: true;
            },
            {
              name: "question";
              relations: ["baseVault", "quoteVault"];
            },
            {
              name: "baseVault";
            },
            {
              name: "quoteVault";
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
              name: "permissionlessAccount";
              docs: [
                "The Squads-side creator of the vault transaction and proposal, an",
                "Initiate | Execute member of every DAO multisig. Its keypair ships in",
                "the SDK, so anyone can provide this signature.",
              ];
              signer: true;
              address: "EP3SoC2SvR3d4c2eXVBvhEMWSr2j3YtoCY3UMiQV7BPD";
            },
            {
              name: "squadsProgram";
              address: "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
            },
            {
              name: "systemProgram";
              address: "11111111111111111111111111111111";
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
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "initializeHostileLiquidateProposalArgs";
            };
          };
        },
      ];
    },
    {
      name: "initializeHostileTakeoverProposal";
      discriminator: [10, 6, 136, 25, 198, 217, 241, 40];
      accounts: [
        {
          name: "typedInitializeAccounts";
          accounts: [
            {
              name: "proposal";
              writable: true;
              pda: {
                seeds: [
                  {
                    kind: "const";
                    value: [112, 114, 111, 112, 111, 115, 97, 108];
                  },
                  {
                    kind: "account";
                    path: "squadsProposal";
                  },
                ];
              };
            },
            {
              name: "dao";
              writable: true;
            },
            {
              name: "squadsMultisig";
              writable: true;
              relations: ["dao"];
            },
            {
              name: "squadsTransaction";
              docs: [
                "and enforces that it is the transaction PDA for the next transaction index",
              ];
              writable: true;
            },
            {
              name: "squadsProposal";
              docs: [
                "enforces that it is the proposal PDA for the next transaction index",
              ];
              writable: true;
            },
            {
              name: "question";
              relations: ["baseVault", "quoteVault"];
            },
            {
              name: "baseVault";
            },
            {
              name: "quoteVault";
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
              name: "permissionlessAccount";
              docs: [
                "The Squads-side creator of the vault transaction and proposal, an",
                "Initiate | Execute member of every DAO multisig. Its keypair ships in",
                "the SDK, so anyone can provide this signature.",
              ];
              signer: true;
              address: "EP3SoC2SvR3d4c2eXVBvhEMWSr2j3YtoCY3UMiQV7BPD";
            },
            {
              name: "squadsProgram";
              address: "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
            },
            {
              name: "systemProgram";
              address: "11111111111111111111111111111111";
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
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "initializeHostileTakeoverProposalArgs";
            };
          };
        },
      ];
    },
    {
      name: "initializeLargeSpendProposal";
      discriminator: [215, 213, 32, 17, 217, 208, 27, 106];
      accounts: [
        {
          name: "typedInitializeAccounts";
          accounts: [
            {
              name: "proposal";
              writable: true;
              pda: {
                seeds: [
                  {
                    kind: "const";
                    value: [112, 114, 111, 112, 111, 115, 97, 108];
                  },
                  {
                    kind: "account";
                    path: "squadsProposal";
                  },
                ];
              };
            },
            {
              name: "dao";
              writable: true;
            },
            {
              name: "squadsMultisig";
              writable: true;
              relations: ["dao"];
            },
            {
              name: "squadsTransaction";
              docs: [
                "and enforces that it is the transaction PDA for the next transaction index",
              ];
              writable: true;
            },
            {
              name: "squadsProposal";
              docs: [
                "enforces that it is the proposal PDA for the next transaction index",
              ];
              writable: true;
            },
            {
              name: "question";
              relations: ["baseVault", "quoteVault"];
            },
            {
              name: "baseVault";
            },
            {
              name: "quoteVault";
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
              name: "permissionlessAccount";
              docs: [
                "The Squads-side creator of the vault transaction and proposal, an",
                "Initiate | Execute member of every DAO multisig. Its keypair ships in",
                "the SDK, so anyone can provide this signature.",
              ];
              signer: true;
              address: "EP3SoC2SvR3d4c2eXVBvhEMWSr2j3YtoCY3UMiQV7BPD";
            },
            {
              name: "squadsProgram";
              address: "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
            },
            {
              name: "systemProgram";
              address: "11111111111111111111111111111111";
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
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "initializeLargeSpendProposalArgs";
            };
          };
        },
      ];
    },
    {
      name: "initializeMintTokensProposal";
      discriminator: [15, 181, 2, 221, 93, 107, 219, 13];
      accounts: [
        {
          name: "typedInitializeAccounts";
          accounts: [
            {
              name: "proposal";
              writable: true;
              pda: {
                seeds: [
                  {
                    kind: "const";
                    value: [112, 114, 111, 112, 111, 115, 97, 108];
                  },
                  {
                    kind: "account";
                    path: "squadsProposal";
                  },
                ];
              };
            },
            {
              name: "dao";
              writable: true;
            },
            {
              name: "squadsMultisig";
              writable: true;
              relations: ["dao"];
            },
            {
              name: "squadsTransaction";
              docs: [
                "and enforces that it is the transaction PDA for the next transaction index",
              ];
              writable: true;
            },
            {
              name: "squadsProposal";
              docs: [
                "enforces that it is the proposal PDA for the next transaction index",
              ];
              writable: true;
            },
            {
              name: "question";
              relations: ["baseVault", "quoteVault"];
            },
            {
              name: "baseVault";
            },
            {
              name: "quoteVault";
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
              name: "permissionlessAccount";
              docs: [
                "The Squads-side creator of the vault transaction and proposal, an",
                "Initiate | Execute member of every DAO multisig. Its keypair ships in",
                "the SDK, so anyone can provide this signature.",
              ];
              signer: true;
              address: "EP3SoC2SvR3d4c2eXVBvhEMWSr2j3YtoCY3UMiQV7BPD";
            },
            {
              name: "squadsProgram";
              address: "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
            },
            {
              name: "systemProgram";
              address: "11111111111111111111111111111111";
            },
          ];
        },
        {
          name: "baseMint";
        },
        {
          name: "mintGovernor";
          docs: [
            "Only for governed mints (v0.8 launches): the `MintGovernor` holding the",
            "base mint's authority.",
          ];
          optional: true;
        },
        {
          name: "mintAuthority";
          docs: [
            "Only for governed mints: the vault's minting rights on `mint_governor`.",
          ];
          optional: true;
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
              name: "initializeMintTokensProposalArgs";
            };
          };
        },
      ];
    },
    {
      name: "initializeProposal";
      discriminator: [50, 73, 156, 98, 129, 149, 21, 158];
      accounts: [
        {
          name: "proposal";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 114, 111, 112, 111, 115, 97, 108];
              },
              {
                kind: "account";
                path: "squadsProposal";
              },
            ];
          };
        },
        {
          name: "squadsProposal";
        },
        {
          name: "squadsMultisig";
          relations: ["dao"];
        },
        {
          name: "squadsVaultTransaction";
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
                value: [116, 114, 97, 110, 115, 97, 99, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "squads_proposal.transaction_index";
                account: "squadsProposal";
              },
            ];
            program: {
              kind: "const";
              value: [
                6,
                129,
                196,
                206,
                71,
                226,
                35,
                104,
                184,
                177,
                85,
                94,
                200,
                135,
                175,
                9,
                46,
                252,
                126,
                251,
                182,
                108,
                163,
                245,
                47,
                191,
                104,
                212,
                172,
                156,
                183,
                168,
              ];
            };
          };
        },
        {
          name: "dao";
          writable: true;
        },
        {
          name: "question";
          relations: ["quoteVault", "baseVault"];
        },
        {
          name: "quoteVault";
        },
        {
          name: "baseVault";
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
      args: [];
    },
    {
      name: "initializeSpendingLimitChangeProposal";
      discriminator: [119, 145, 71, 234, 49, 54, 124, 66];
      accounts: [
        {
          name: "typedInitializeAccounts";
          accounts: [
            {
              name: "proposal";
              writable: true;
              pda: {
                seeds: [
                  {
                    kind: "const";
                    value: [112, 114, 111, 112, 111, 115, 97, 108];
                  },
                  {
                    kind: "account";
                    path: "squadsProposal";
                  },
                ];
              };
            },
            {
              name: "dao";
              writable: true;
            },
            {
              name: "squadsMultisig";
              writable: true;
              relations: ["dao"];
            },
            {
              name: "squadsTransaction";
              docs: [
                "and enforces that it is the transaction PDA for the next transaction index",
              ];
              writable: true;
            },
            {
              name: "squadsProposal";
              docs: [
                "enforces that it is the proposal PDA for the next transaction index",
              ];
              writable: true;
            },
            {
              name: "question";
              relations: ["baseVault", "quoteVault"];
            },
            {
              name: "baseVault";
            },
            {
              name: "quoteVault";
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
              name: "permissionlessAccount";
              docs: [
                "The Squads-side creator of the vault transaction and proposal, an",
                "Initiate | Execute member of every DAO multisig. Its keypair ships in",
                "the SDK, so anyone can provide this signature.",
              ];
              signer: true;
              address: "EP3SoC2SvR3d4c2eXVBvhEMWSr2j3YtoCY3UMiQV7BPD";
            },
            {
              name: "squadsProgram";
              address: "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
            },
            {
              name: "systemProgram";
              address: "11111111111111111111111111111111";
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
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "initializeSpendingLimitChangeProposalArgs";
            };
          };
        },
      ];
    },
    {
      name: "launchProposal";
      discriminator: [16, 211, 189, 119, 245, 72, 0, 229];
      accounts: [
        {
          name: "proposal";
          writable: true;
        },
        {
          name: "baseVault";
          relations: ["proposal"];
        },
        {
          name: "quoteVault";
          relations: ["proposal"];
        },
        {
          name: "passBaseMint";
        },
        {
          name: "passQuoteMint";
        },
        {
          name: "failBaseMint";
        },
        {
          name: "failQuoteMint";
        },
        {
          name: "dao";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "ammPassBaseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "passBaseMint";
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
          name: "ammPassQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "passQuoteMint";
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
          name: "ammFailBaseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "failBaseMint";
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
          name: "ammFailQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "failQuoteMint";
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
              kind: "const";
              value: [
                6,
                129,
                196,
                206,
                71,
                226,
                35,
                104,
                184,
                177,
                85,
                94,
                200,
                135,
                175,
                9,
                46,
                252,
                126,
                251,
                182,
                108,
                163,
                245,
                47,
                191,
                104,
                212,
                172,
                156,
                183,
                168,
              ];
            };
          };
          relations: ["dao"];
        },
        {
          name: "squadsProposal";
          relations: ["proposal"];
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
      name: "provideLiquidity";
      discriminator: [40, 110, 107, 116, 174, 127, 97, 204];
      accounts: [
        {
          name: "dao";
          writable: true;
        },
        {
          name: "liquidityProvider";
          signer: true;
        },
        {
          name: "liquidityProviderBaseAccount";
          writable: true;
        },
        {
          name: "liquidityProviderQuoteAccount";
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
        {
          name: "ammBaseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "dao.base_mint";
                account: "dao";
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
          name: "ammQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "dao.quote_mint";
                account: "dao";
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
          name: "ammPosition";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  97,
                  109,
                  109,
                  95,
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110,
                ];
              },
              {
                kind: "account";
                path: "dao";
              },
              {
                kind: "arg";
                path: "params.position_authority";
              },
            ];
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
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "provideLiquidityParams";
            };
          };
        },
      ];
    },
    {
      name: "resizeDao";
      discriminator: [142, 52, 68, 81, 113, 14, 90, 40];
      accounts: [
        {
          name: "dao";
          writable: true;
        },
        {
          name: "spendingLimit";
          docs: [
            "spending-limit PDA (`create_key` is always the DAO); read-only and may",
            "not exist",
          ];
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
      name: "resizeProposal";
      discriminator: [40, 213, 88, 206, 213, 184, 30, 181];
      accounts: [
        {
          name: "proposal";
          writable: true;
        },
        {
          name: "dao";
          docs: [
            "The proposal's DAO, checked against the deserialized proposal in the",
            "handler.",
          ];
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
      name: "setSpendingLimit";
      discriminator: [39, 48, 237, 161, 49, 171, 155, 208];
      accounts: [
        {
          name: "dao";
          writable: true;
        },
        {
          name: "squadsMultisigVault";
          signer: true;
          relations: ["dao"];
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
              name: "setSpendingLimitArgs";
            };
          };
        },
      ];
    },
    {
      name: "sponsorProposal";
      discriminator: [193, 57, 170, 136, 101, 196, 58, 173];
      accounts: [
        {
          name: "proposal";
          writable: true;
        },
        {
          name: "dao";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "teamAddress";
          signer: true;
          relations: ["dao"];
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
      name: "spotSwap";
      discriminator: [167, 97, 12, 231, 237, 78, 166, 251];
      accounts: [
        {
          name: "dao";
          writable: true;
        },
        {
          name: "userBaseAccount";
          writable: true;
        },
        {
          name: "userQuoteAccount";
          writable: true;
        },
        {
          name: "ammBaseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "dao.base_mint";
                account: "dao";
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
          name: "ammQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "dao.quote_mint";
                account: "dao";
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
          name: "user";
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
          name: "params";
          type: {
            defined: {
              name: "spotSwapParams";
            };
          };
        },
      ];
    },
    {
      name: "stakeToProposal";
      discriminator: [10, 169, 175, 238, 80, 221, 37, 16];
      accounts: [
        {
          name: "proposal";
          writable: true;
        },
        {
          name: "dao";
          writable: true;
        },
        {
          name: "stakerBaseAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "staker";
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
                path: "dao.base_mint";
                account: "dao";
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
          name: "proposalBaseAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "proposal";
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
                path: "dao.base_mint";
                account: "dao";
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
          name: "stakeAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [115, 116, 97, 107, 101];
              },
              {
                kind: "account";
                path: "proposal";
              },
              {
                kind: "account";
                path: "staker";
              },
            ];
          };
        },
        {
          name: "staker";
          signer: true;
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
          name: "params";
          type: {
            defined: {
              name: "stakeToProposalParams";
            };
          };
        },
      ];
    },
    {
      name: "syncSpendingLimit";
      discriminator: [24, 110, 161, 237, 185, 161, 169, 141];
      accounts: [
        {
          name: "dao";
          writable: true;
        },
        {
          name: "squadsMultisig";
          writable: true;
          relations: ["dao"];
        },
        {
          name: "spendingLimit";
          writable: true;
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
                value: [
                  115,
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  108,
                  105,
                  109,
                  105,
                  116,
                ];
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
          name: "rentPayer";
          docs: [
            "Pays rent when the limit is recreated and receives freed rent when it is removed.",
          ];
          writable: true;
          signer: true;
        },
        {
          name: "squadsProgram";
          address: "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
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
      name: "unstakeFromProposal";
      discriminator: [179, 220, 186, 86, 2, 96, 50, 161];
      accounts: [
        {
          name: "proposal";
          writable: true;
        },
        {
          name: "dao";
          writable: true;
          relations: ["proposal"];
        },
        {
          name: "stakerBaseAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "staker";
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
          name: "proposalBaseAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "proposal";
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
          name: "stakeAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [115, 116, 97, 107, 101];
              },
              {
                kind: "account";
                path: "proposal";
              },
              {
                kind: "account";
                path: "staker";
              },
            ];
          };
        },
        {
          name: "baseMint";
          relations: ["dao"];
        },
        {
          name: "staker";
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
              name: "unstakeFromProposalParams";
            };
          };
        },
      ];
    },
    {
      name: "updateDao";
      discriminator: [131, 72, 75, 25, 112, 210, 109, 2];
      accounts: [
        {
          name: "dao";
          writable: true;
        },
        {
          name: "squadsMultisigVault";
          signer: true;
          relations: ["dao"];
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
          name: "daoParams";
          type: {
            defined: {
              name: "updateDaoParams";
            };
          };
        },
      ];
    },
    {
      name: "withdrawLiquidity";
      discriminator: [149, 158, 33, 185, 47, 243, 253, 31];
      accounts: [
        {
          name: "dao";
          writable: true;
          relations: ["ammPosition"];
        },
        {
          name: "positionAuthority";
          signer: true;
          relations: ["ammPosition"];
        },
        {
          name: "liquidityProviderBaseAccount";
          writable: true;
        },
        {
          name: "liquidityProviderQuoteAccount";
          writable: true;
        },
        {
          name: "ammBaseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "dao.base_mint";
                account: "dao";
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
          name: "ammQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "dao";
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
                path: "dao.quote_mint";
                account: "dao";
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
          name: "ammPosition";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  97,
                  109,
                  109,
                  95,
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110,
                ];
              },
              {
                kind: "account";
                path: "dao";
              },
              {
                kind: "account";
                path: "positionAuthority";
              },
            ];
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
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "withdrawLiquidityParams";
            };
          };
        },
      ];
    },
  ];
  accounts: [
    {
      name: "ammPosition";
      discriminator: [34, 97, 105, 74, 17, 226, 212, 0];
    },
    {
      name: "conditionalVault";
      discriminator: [63, 132, 87, 98, 36, 51, 175, 247];
    },
    {
      name: "dao";
      discriminator: [163, 9, 47, 31, 52, 85, 197, 49];
    },
    {
      name: "enqueuedMultisigProposalApproval";
      discriminator: [172, 225, 237, 72, 8, 241, 28, 124];
    },
    {
      name: "enqueuedMultisigProposalCancellation";
      discriminator: [18, 48, 13, 143, 11, 244, 203, 114];
    },
    {
      name: "mintAuthority";
      discriminator: [148, 0, 219, 228, 254, 237, 76, 128];
    },
    {
      name: "mintGovernor";
      discriminator: [110, 173, 19, 114, 217, 193, 37, 71];
    },
    {
      name: "proposal";
      discriminator: [26, 94, 189, 187, 116, 136, 53, 33];
    },
    {
      name: "question";
      discriminator: [111, 22, 150, 220, 181, 122, 118, 127];
    },
    {
      name: "stakeAccount";
      discriminator: [80, 158, 67, 124, 50, 189, 192, 255];
    },
  ];
  events: [
    {
      name: "adminCancelProposalEvent";
      discriminator: [118, 2, 87, 75, 91, 217, 71, 124];
    },
    {
      name: "adminFixPositionAuthorityEvent";
      discriminator: [174, 79, 62, 1, 150, 182, 236, 147];
    },
    {
      name: "adminUpdateProposalParamsEvent";
      discriminator: [20, 195, 243, 106, 255, 93, 238, 187];
    },
    {
      name: "collectFeesEvent";
      discriminator: [226, 2, 53, 67, 132, 158, 125, 173];
    },
    {
      name: "collectMeteoraDammFeesEvent";
      discriminator: [193, 114, 225, 241, 209, 213, 175, 85];
    },
    {
      name: "conditionalSwapEvent";
      discriminator: [2, 166, 200, 160, 94, 212, 68, 45];
    },
    {
      name: "finalizeProposalEvent";
      discriminator: [45, 29, 122, 181, 79, 224, 57, 141];
    },
    {
      name: "initializeDaoEvent";
      discriminator: [119, 48, 153, 116, 127, 37, 226, 228];
    },
    {
      name: "initializeProposalEvent";
      discriminator: [141, 56, 246, 192, 168, 254, 64, 111];
    },
    {
      name: "launchProposalEvent";
      discriminator: [177, 55, 191, 93, 203, 124, 184, 11];
    },
    {
      name: "provideLiquidityEvent";
      discriminator: [38, 2, 37, 238, 229, 214, 255, 235];
    },
    {
      name: "removeProposalEvent";
      discriminator: [135, 152, 254, 224, 208, 81, 197, 215];
    },
    {
      name: "setSpendingLimitEvent";
      discriminator: [242, 139, 252, 83, 95, 147, 15, 58];
    },
    {
      name: "sponsorProposalEvent";
      discriminator: [202, 190, 250, 176, 79, 235, 77, 194];
    },
    {
      name: "spotSwapEvent";
      discriminator: [29, 253, 121, 255, 82, 60, 148, 195];
    },
    {
      name: "stakeToProposalEvent";
      discriminator: [94, 69, 68, 151, 90, 149, 240, 191];
    },
    {
      name: "syncSpendingLimitEvent";
      discriminator: [155, 35, 236, 84, 219, 60, 115, 167];
    },
    {
      name: "unstakeFromProposalEvent";
      discriminator: [89, 129, 63, 211, 55, 33, 194, 171];
    },
    {
      name: "updateDaoEvent";
      discriminator: [12, 58, 244, 224, 171, 25, 33, 56];
    },
    {
      name: "withdrawLiquidityEvent";
      discriminator: [214, 6, 161, 45, 191, 142, 124, 186];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "ammTooOld";
      msg: "Amms must have been created within 5 minutes (counted in slots) of proposal initialization";
    },
    {
      code: 6001;
      name: "invalidInitialObservation";
      msg: "An amm has an `initial_observation` that doesn't match the `dao`'s config";
    },
    {
      code: 6002;
      name: "invalidMaxObservationChange";
      msg: "An amm has a `max_observation_change_per_update` that doesn't match the `dao`'s config";
    },
    {
      code: 6003;
      name: "invalidStartDelaySlots";
      msg: "An amm has a `start_delay_slots` that doesn't match the `dao`'s config";
    },
    {
      code: 6004;
      name: "invalidSettlementAuthority";
      msg: "One of the vaults has an invalid `settlement_authority`";
    },
    {
      code: 6005;
      name: "proposalTooYoung";
      msg: "Proposal is too young to be executed or rejected";
    },
    {
      code: 6006;
      name: "marketsTooYoung";
      msg: "Markets too young for proposal to be finalized. TWAP might need to be cranked";
    },
    {
      code: 6007;
      name: "proposalAlreadyFinalized";
      msg: "This proposal has already been finalized";
    },
    {
      code: 6008;
      name: "invalidVaultNonce";
      msg: "A conditional vault has an invalid nonce. A nonce should encode the proposal number";
    },
    {
      code: 6009;
      name: "proposalNotPassed";
      msg: "This proposal can't be executed because it isn't in the passed state";
    },
    {
      code: 6010;
      name: "insufficientLiquidity";
      msg: "More liquidity needs to be in the AMM to launch this proposal";
    },
    {
      code: 6011;
      name: "proposalDurationTooShort";
      msg: "Proposal duration must be longer 1 day and longer than 2 times the TWAP start delay";
    },
    {
      code: 6012;
      name: "passThresholdTooHigh";
      msg: "Pass threshold must be less than 10%";
    },
    {
      code: 6013;
      name: "questionMustBeBinary";
      msg: "Question must have exactly 2 outcomes for binary futarchy";
    },
    {
      code: 6014;
      name: "invalidSquadsProposalStatus";
      msg: "Squads proposal must be in Active status";
    },
    {
      code: 6015;
      name: "castingOverflow";
      msg: "Casting overflow. If you're seeing this, please report this";
    },
    {
      code: 6016;
      name: "insufficientBalance";
      msg: "Insufficient balance";
    },
    {
      code: 6017;
      name: "zeroLiquidityRemove";
      msg: "Cannot remove zero liquidity";
    },
    {
      code: 6018;
      name: "swapSlippageExceeded";
      msg: "Swap slippage exceeded";
    },
    {
      code: 6019;
      name: "assertFailed";
      msg: "Assert failed";
    },
    {
      code: 6020;
      name: "invalidAdmin";
      msg: "Invalid admin";
    },
    {
      code: 6021;
      name: "proposalNotInDraftState";
      msg: "Proposal is not in draft state";
    },
    {
      code: 6022;
      name: "insufficientTokenBalance";
      msg: "Insufficient token balance";
    },
    {
      code: 6023;
      name: "invalidAmount";
      msg: "Invalid amount";
    },
    {
      code: 6024;
      name: "insufficientStakeToLaunch";
      msg: "Insufficient stake to launch proposal";
    },
    {
      code: 6025;
      name: "stakerNotFound";
      msg: "Staker not found in proposal";
    },
    {
      code: 6026;
      name: "poolNotInSpotState";
      msg: "Pool must be in spot state";
    },
    {
      code: 6027;
      name: "invalidDaoCreateLiquidity";
      msg: "If you're providing liquidity, you must provide both base and quote token accounts";
    },
    {
      code: 6028;
      name: "invalidStakeAccount";
      msg: "Invalid stake account";
    },
    {
      code: 6029;
      name: "invariantViolated";
      msg: "An invariant was violated. You should get in contact with the MetaDAO team if you see this";
    },
    {
      code: 6030;
      name: "proposalNotActive";
      msg: "Proposal needs to be active to perform a conditional swap";
    },
    {
      code: 6031;
      name: "invalidTransaction";
      msg: "This Squads transaction should only contain calls to update spending limits";
    },
    {
      code: 6032;
      name: "proposalAlreadySponsored";
      msg: "Proposal has already been sponsored";
    },
    {
      code: 6033;
      name: "invalidTeamSponsoredPassThreshold";
      msg: "Team sponsored pass threshold must be between -10% and 10%";
    },
    {
      code: 6034;
      name: "invalidTargetK";
      msg: "Target K must be greater than the current K";
    },
    {
      code: 6035;
      name: "invalidTransactionMessage";
      msg: "Failed to compile transaction message for Squads vault transaction";
    },
    {
      code: 6036;
      name: "invalidMint";
      msg: "Base mint and quote mint must be different";
    },
    {
      code: 6037;
      name: "proposalNotReadyToUnstake";
      msg: "Proposal is not ready to be unstaked";
    },
    {
      code: 6038;
      name: "optimisticGovernanceDisabled";
      msg: "Optimistic governance is disabled";
    },
    {
      code: 6039;
      name: "activeOptimisticProposalAlreadyEnqueued";
      msg: "An active optimistic proposal is already enqueued";
    },
    {
      code: 6040;
      name: "optimisticProposalAlreadyPassed";
      msg: "Optimistic proposal has already passed";
    },
    {
      code: 6041;
      name: "invalidSpendingLimitMint";
      msg: "Invalid spending limit mint. Must be the same as the DAO's quote mint";
    },
    {
      code: 6042;
      name: "noActiveOptimisticProposal";
      msg: "No active optimistic proposal";
    },
    {
      code: 6043;
      name: "daoLiquidated";
      msg: "This DAO has been liquidated";
    },
    {
      code: 6044;
      name: "proposalKindCooldownActive";
      msg: "A proposal of this kind finalized recently, so the cooldown must elapse first";
    },
    {
      code: 6045;
      name: "noSpendingLimit";
      msg: "The DAO has no spending limit";
    },
    {
      code: 6046;
      name: "spendCapExceeded";
      msg: "Amount exceeds the cap of 3x the monthly spending limit";
    },
    {
      code: 6047;
      name: "unknownMintAuthority";
      msg: "The base mint's authority is neither the treasury vault nor a mint governor";
    },
    {
      code: 6048;
      name: "proposalNotTeamSponsored";
      msg: "This proposal kind must be team-sponsored before it can launch";
    },
    {
      code: 6049;
      name: "spendingLimitNotDirty";
      msg: "The spending limit record hasn't changed, so there is nothing to sync";
    },
    {
      code: 6050;
      name: "invalidProposalKind";
      msg: "Wrong proposal kind for this instruction";
    },
    {
      code: 6051;
      name: "tooManySpendingLimitMembers";
      msg: "A spending limit can have at most 10 members";
    },
    {
      code: 6052;
      name: "invalidLiquidator";
      msg: "Invalid liquidator";
    },
    {
      code: 6053;
      name: "invalidProposalPassThreshold";
      msg: "Pass threshold must be between -99.99% and 99.99%";
    },
    {
      code: 6054;
      name: "emptyProposalParamsUpdate";
      msg: "A proposal params update must set at least one field";
    },
    {
      code: 6055;
      name: "buybackCapExceeded";
      msg: "Buyback amount exceeds 25% of the treasury";
    },
    {
      code: 6056;
      name: "invalidBuybackAmount";
      msg: "Buyback total must be non-zero";
    },
    {
      code: 6057;
      name: "invalidBuybackCycleFrequency";
      msg: "Cycle frequency must be between 60 seconds and 1 year";
    },
    {
      code: 6058;
      name: "invalidBuybackStartDelay";
      msg: "Start delay must be at most 30 days";
    },
    {
      code: 6059;
      name: "invalidBuybackPriceBand";
      msg: "min_price must be no greater than max_price";
    },
    {
      code: 6060;
      name: "invalidTreasuryAccount";
      msg: "A treasury account is neither a vault-owned quote account nor the treasury's AMM position";
    },
    {
      code: 6061;
      name: "treasuryAccountsNotSorted";
      msg: "Treasury accounts must be in strictly ascending key order";
    },
    {
      code: 6062;
      name: "unexpectedLaunchAccounts";
      msg: "This proposal kind's launch takes no extra accounts";
    },
    {
      code: 6063;
      name: "invalidSpendingLimitAccount";
      msg: "Spending limit account is not the canonical spending-limit PDA";
    },
    {
      code: 6064;
      name: "staleTeamAddress";
      msg: "The DAO's team has changed since this draft was created";
    },
    {
      code: 6065;
      name: "accountNotMigrated";
      msg: "Account is not migrated to latest layout";
    },
    {
      code: 6066;
      name: "invalidSpendingLimitAmount";
      msg: "A spending limit's monthly amount must be non-zero";
    },
    {
      code: 6067;
      name: "emptySpendingLimitMembers";
      msg: "A spending limit must have at least one member";
    },
    {
      code: 6068;
      name: "duplicateSpendingLimitMember";
      msg: "A spending limit's members must be unique";
    },
    {
      code: 6069;
      name: "invalidBuybackCycleCount";
      msg: "A buyback must run at least two cycles";
    },
    {
      code: 6070;
      name: "invalidTeamAddress";
      msg: "Invalid team address";
    },
    {
      code: 6071;
      name: "teamSponsorshipForbidden";
      msg: "This proposal kind cannot be team-sponsored";
    },
    {
      code: 6072;
      name: "squadsProposalNotApproved";
      msg: "Squads proposal must be in Approved status to be cancelled";
    },
    {
      code: 6073;
      name: "typedProposalsDisabled";
      msg: "This DAO has not opted into typed proposals";
    },
    {
      code: 6074;
      name: "typedProposalsCannotBeDisabled";
      msg: "Typed proposals cannot be disabled";
    },
    {
      code: 6075;
      name: "unfrozenAddressLookupTable";
      msg: "Address lookup tables referenced by the vault transaction must be frozen";
    },
    {
      code: 6076;
      name: "invalidAddressLookupTable";
      msg: "Lookup table accounts must match the vault transaction's address table lookups";
    },
    {
      code: 6077;
      name: "invalidSquadsVaultTransaction";
      msg: "Expected the proposal's Squads vault transaction as the first launch account";
    },
  ];
  types: [
    {
      name: "adminCancelProposalEvent";
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
            name: "proposal";
            type: "pubkey";
          },
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "admin";
            type: "pubkey";
          },
          {
            name: "postAmmState";
            type: {
              defined: {
                name: "futarchyAmm";
              };
            };
          },
        ];
      };
    },
    {
      name: "adminEnqueueMultisigProposalApprovalArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "transactionIndex";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "adminEnqueueMultisigProposalCancellationArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "transactionIndex";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "adminFixPositionAuthorityEvent";
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
            name: "dao";
            type: "pubkey";
          },
          {
            name: "admin";
            type: "pubkey";
          },
          {
            name: "ammPosition";
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
      name: "adminUpdateProposalParamsArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "durationInSeconds";
            type: {
              option: "u32";
            };
          },
          {
            name: "passThresholdBps";
            type: {
              option: "i16";
            };
          },
        ];
      };
    },
    {
      name: "adminUpdateProposalParamsEvent";
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
            name: "dao";
            type: "pubkey";
          },
          {
            name: "proposal";
            type: "pubkey";
          },
          {
            name: "admin";
            type: "pubkey";
          },
          {
            name: "oldDurationInSeconds";
            type: "u32";
          },
          {
            name: "newDurationInSeconds";
            type: "u32";
          },
          {
            name: "oldPassThresholdBps";
            type: "i16";
          },
          {
            name: "newPassThresholdBps";
            type: "i16";
          },
        ];
      };
    },
    {
      name: "ammPosition";
      type: {
        kind: "struct";
        fields: [
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "positionAuthority";
            type: "pubkey";
          },
          {
            name: "liquidity";
            type: "u128";
          },
        ];
      };
    },
    {
      name: "collectFeesEvent";
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
            name: "dao";
            type: "pubkey";
          },
          {
            name: "baseTokenAccount";
            type: "pubkey";
          },
          {
            name: "quoteTokenAccount";
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
          {
            name: "quoteMint";
            type: "pubkey";
          },
          {
            name: "baseMint";
            type: "pubkey";
          },
          {
            name: "quoteFeesCollected";
            type: "u64";
          },
          {
            name: "baseFeesCollected";
            type: "u64";
          },
          {
            name: "postAmmState";
            type: {
              defined: {
                name: "futarchyAmm";
              };
            };
          },
        ];
      };
    },
    {
      name: "collectMeteoraDammFeesEvent";
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
            name: "dao";
            type: "pubkey";
          },
          {
            name: "pool";
            type: "pubkey";
          },
          {
            name: "baseTokenAccount";
            type: "pubkey";
          },
          {
            name: "quoteTokenAccount";
            type: "pubkey";
          },
          {
            name: "quoteMint";
            type: "pubkey";
          },
          {
            name: "baseMint";
            type: "pubkey";
          },
          {
            name: "quoteFeesCollected";
            type: "u64";
          },
          {
            name: "baseFeesCollected";
            type: "u64";
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
            name: "daoSeqNum";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "conditionalSwapEvent";
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
            name: "dao";
            type: "pubkey";
          },
          {
            name: "proposal";
            type: "pubkey";
          },
          {
            name: "trader";
            type: "pubkey";
          },
          {
            name: "market";
            type: {
              defined: {
                name: "market";
              };
            };
          },
          {
            name: "swapType";
            type: {
              defined: {
                name: "swapType";
              };
            };
          },
          {
            name: "inputAmount";
            type: "u64";
          },
          {
            name: "outputAmount";
            type: "u64";
          },
          {
            name: "minOutputAmount";
            type: "u64";
          },
          {
            name: "postAmmState";
            type: {
              defined: {
                name: "futarchyAmm";
              };
            };
          },
        ];
      };
    },
    {
      name: "conditionalSwapParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "market";
            type: {
              defined: {
                name: "market";
              };
            };
          },
          {
            name: "swapType";
            type: {
              defined: {
                name: "swapType";
              };
            };
          },
          {
            name: "inputAmount";
            type: "u64";
          },
          {
            name: "minOutputAmount";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "conditionalVault";
      type: {
        kind: "struct";
        fields: [
          {
            name: "question";
            type: "pubkey";
          },
          {
            name: "underlyingTokenMint";
            type: "pubkey";
          },
          {
            name: "underlyingTokenAccount";
            type: "pubkey";
          },
          {
            name: "conditionalTokenMints";
            type: {
              vec: "pubkey";
            };
          },
          {
            name: "pdaBump";
            type: "u8";
          },
          {
            name: "decimals";
            type: "u8";
          },
          {
            name: "seqNum";
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
      name: "enqueuedMultisigProposalApproval";
      type: {
        kind: "struct";
        fields: [
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "transactionIndex";
            type: "u64";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "enqueuedMultisigProposalCancellation";
      type: {
        kind: "struct";
        fields: [
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "transactionIndex";
            type: "u64";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "finalizeProposalEvent";
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
            name: "proposal";
            type: "pubkey";
          },
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "passMarketTwap";
            type: "u128";
          },
          {
            name: "failMarketTwap";
            type: "u128";
          },
          {
            name: "threshold";
            type: "u128";
          },
          {
            name: "state";
            type: {
              defined: {
                name: "proposalState";
              };
            };
          },
          {
            name: "squadsProposal";
            type: "pubkey";
          },
          {
            name: "squadsMultisig";
            type: "pubkey";
          },
          {
            name: "postAmmState";
            type: {
              defined: {
                name: "futarchyAmm";
              };
            };
          },
          {
            name: "isTeamSponsored";
            type: "bool";
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
      name: "initializeBuybackTokenProposalArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "quoteAmount";
            type: "u64";
          },
          {
            name: "cycleCount";
            type: "u32";
          },
          {
            name: "cycleFrequencySeconds";
            type: "u32";
          },
          {
            name: "startDelaySeconds";
            type: "u32";
          },
          {
            name: "minPrice";
            type: {
              option: "u64";
            };
          },
          {
            name: "maxPrice";
            type: {
              option: "u64";
            };
          },
        ];
      };
    },
    {
      name: "initializeDaoEvent";
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
            name: "dao";
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
            name: "passThresholdBps";
            type: "u16";
          },
          {
            name: "secondsPerProposal";
            type: "u32";
          },
          {
            name: "twapInitialObservation";
            type: "u128";
          },
          {
            name: "twapMaxObservationChangePerUpdate";
            type: "u128";
          },
          {
            name: "twapStartDelaySeconds";
            type: "u32";
          },
          {
            name: "minQuoteFutarchicLiquidity";
            type: "u64";
          },
          {
            name: "minBaseFutarchicLiquidity";
            type: "u64";
          },
          {
            name: "baseToStake";
            type: "u64";
          },
          {
            name: "initialSpendingLimit";
            type: {
              option: {
                defined: {
                  name: "initialSpendingLimit";
                };
              };
            };
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
            name: "teamSponsoredPassThresholdBps";
            type: "i16";
          },
          {
            name: "teamAddress";
            type: "pubkey";
          },
          {
            name: "typedProposalsEnabled";
            type: "bool";
          },
        ];
      };
    },
    {
      name: "initializeDaoParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "twapInitialObservation";
            type: "u128";
          },
          {
            name: "twapMaxObservationChangePerUpdate";
            type: "u128";
          },
          {
            name: "twapStartDelaySeconds";
            type: "u32";
          },
          {
            name: "minQuoteFutarchicLiquidity";
            type: "u64";
          },
          {
            name: "minBaseFutarchicLiquidity";
            type: "u64";
          },
          {
            name: "baseToStake";
            type: "u64";
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
            name: "nonce";
            type: "u64";
          },
          {
            name: "initialSpendingLimit";
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
            type: "i16";
          },
          {
            name: "teamAddress";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "initializeHostileLiquidateProposalArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "liquidator";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "initializeHostileTakeoverProposalArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "newTeamAddress";
            type: "pubkey";
          },
          {
            name: "spendingLimitAction";
            type: {
              defined: {
                name: "spendingLimitAction";
              };
            };
          },
        ];
      };
    },
    {
      name: "initializeLargeSpendProposalArgs";
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
      name: "initializeMintTokensProposalArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "recipient";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "initializeProposalEvent";
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
            name: "proposal";
            type: "pubkey";
          },
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "question";
            type: "pubkey";
          },
          {
            name: "quoteVault";
            type: "pubkey";
          },
          {
            name: "baseVault";
            type: "pubkey";
          },
          {
            name: "proposer";
            type: "pubkey";
          },
          {
            name: "number";
            type: "u32";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
          {
            name: "durationInSeconds";
            type: "u32";
          },
          {
            name: "squadsProposal";
            type: "pubkey";
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
            name: "action";
            type: {
              defined: {
                name: "proposalAction";
              };
            };
          },
        ];
      };
    },
    {
      name: "initializeSpendingLimitChangeProposalArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "config";
            docs: ["`Some` replaces the record, `None` removes it."];
            type: {
              option: {
                defined: {
                  name: "initialSpendingLimit";
                };
              };
            };
          },
        ];
      };
    },
    {
      name: "launchProposalEvent";
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
            name: "proposal";
            type: "pubkey";
          },
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "timestampEnqueued";
            type: "i64";
          },
          {
            name: "totalStaked";
            type: "u64";
          },
          {
            name: "postAmmState";
            type: {
              defined: {
                name: "futarchyAmm";
              };
            };
          },
          {
            name: "durationInSeconds";
            docs: ["The terms the market opened with, as written by launch."];
            type: "u32";
          },
          {
            name: "passThresholdBps";
            type: "i16";
          },
          {
            name: "isTeamSponsored";
            type: "bool";
          },
        ];
      };
    },
    {
      name: "market";
      type: {
        kind: "enum";
        variants: [
          {
            name: "spot";
          },
          {
            name: "pass";
          },
          {
            name: "fail";
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
      name: "proposal";
      type: {
        kind: "struct";
        fields: [
          {
            name: "number";
            type: "u32";
          },
          {
            name: "proposer";
            type: "pubkey";
          },
          {
            name: "timestampEnqueued";
            type: "i64";
          },
          {
            name: "state";
            type: {
              defined: {
                name: "proposalState";
              };
            };
          },
          {
            name: "baseVault";
            type: "pubkey";
          },
          {
            name: "quoteVault";
            type: "pubkey";
          },
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
          {
            name: "question";
            type: "pubkey";
          },
          {
            name: "durationInSeconds";
            type: "u32";
          },
          {
            name: "squadsProposal";
            type: "pubkey";
          },
          {
            name: "passBaseMint";
            type: "pubkey";
          },
          {
            name: "passQuoteMint";
            type: "pubkey";
          },
          {
            name: "failBaseMint";
            type: "pubkey";
          },
          {
            name: "failQuoteMint";
            type: "pubkey";
          },
          {
            name: "sponsoredBy";
            docs: [
              "The team that last sponsored the proposal. `None` = never sponsored.",
            ];
            type: {
              option: "pubkey";
            };
          },
          {
            name: "passThresholdBps";
            type: "i16";
          },
          {
            name: "councilCanBlock";
            docs: ["Snapshot of the kind's blockable flag at create."];
            type: "bool";
          },
          {
            name: "action";
            docs: ["The typed action parameters."];
            type: {
              defined: {
                name: "proposalAction";
              };
            };
          },
          {
            name: "paramsOverridden";
            docs: [
              "Set by `admin_update_proposal_params`. `launch_proposal` then leaves the",
              "duration and threshold alone.",
            ];
            type: "bool";
          },
        ];
      };
    },
    {
      name: "proposalAction";
      docs: [
        "The typed action parameters, stored on the proposal. The borsh variant tag",
        "is the proposal's kind discriminator, so variants are append-only — the",
        "variant index is the wire tag.",
      ];
      type: {
        kind: "enum";
        variants: [
          {
            name: "largeSpend";
            fields: [
              {
                name: "amount";
                type: "u64";
              },
              {
                name: "teamAddress";
                docs: [
                  "The team the baked transfer pays, snapshotted at create. Launch",
                  "requires it to still be the DAO's team.",
                ];
                type: "pubkey";
              },
            ];
          },
          {
            name: "mintTokens";
            fields: [
              {
                name: "amount";
                type: "u64";
              },
              {
                name: "recipient";
                type: "pubkey";
              },
            ];
          },
          {
            name: "spendingLimitChange";
            fields: [
              {
                name: "config";
                type: {
                  option: {
                    defined: {
                      name: "initialSpendingLimit";
                    };
                  };
                };
              },
            ];
          },
          {
            name: "executeArbitrary";
          },
          {
            name: "hostileTakeover";
            fields: [
              {
                name: "newTeamAddress";
                docs: [
                  "The team to install. Launch requires it to still differ from the",
                  "DAO's team.",
                ];
                type: "pubkey";
              },
              {
                name: "spendingLimitAction";
                type: {
                  defined: {
                    name: "spendingLimitAction";
                  };
                };
              },
            ];
          },
          {
            name: "hostileLiquidate";
            fields: [
              {
                name: "liquidator";
                type: "pubkey";
              },
            ];
          },
          {
            name: "buybackToken";
            fields: [
              {
                name: "quoteAmount";
                docs: ["Total quote to deploy. Capped at 25% of the treasury."];
                type: "u64";
              },
              {
                name: "cycleCount";
                docs: ["Orders the total is split across. At least 2."];
                type: "u32";
              },
              {
                name: "cycleFrequencySeconds";
                docs: ["Seconds between orders."];
                type: "u32";
              },
              {
                name: "startDelaySeconds";
                docs: [
                  "Seconds after execution before the first order. 0 = immediately.",
                ];
                type: "u32";
              },
              {
                name: "minPrice";
                docs: [
                  "Optional price band, in quote native units per whole base token:",
                  "1_600_000 = 1.6 USDC per token.",
                  "`None` = unguarded.",
                ];
                type: {
                  option: "u64";
                };
              },
              {
                name: "maxPrice";
                type: {
                  option: "u64";
                };
              },
            ];
          },
        ];
      };
    },
    {
      name: "proposalState";
      type: {
        kind: "enum";
        variants: [
          {
            name: "draft";
            fields: [
              {
                name: "amountStaked";
                type: "u64";
              },
            ];
          },
          {
            name: "pending";
          },
          {
            name: "passed";
          },
          {
            name: "failed";
          },
          {
            name: "removed";
          },
        ];
      };
    },
    {
      name: "provideLiquidityEvent";
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
            name: "dao";
            type: "pubkey";
          },
          {
            name: "liquidityProvider";
            type: "pubkey";
          },
          {
            name: "positionAuthority";
            type: "pubkey";
          },
          {
            name: "quoteAmount";
            type: "u64";
          },
          {
            name: "baseAmount";
            type: "u64";
          },
          {
            name: "liquidityMinted";
            type: "u128";
          },
          {
            name: "minLiquidity";
            type: "u128";
          },
          {
            name: "postAmmState";
            type: {
              defined: {
                name: "futarchyAmm";
              };
            };
          },
        ];
      };
    },
    {
      name: "provideLiquidityParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "quoteAmount";
            docs: ["How much quote token you will deposit to the pool"];
            type: "u64";
          },
          {
            name: "maxBaseAmount";
            docs: ["The maximum base token you will deposit to the pool"];
            type: "u64";
          },
          {
            name: "minLiquidity";
            docs: ["The minimum liquidity you will be assigned"];
            type: "u128";
          },
          {
            name: "positionAuthority";
            docs: [
              "The account that will own the LP position, usually the same as the",
              "liquidity provider",
            ];
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "question";
      docs: [
        "Questions represent statements about future events.",
        "",
        "These statements include:",
        '- "Will this proposal pass?"',
        '- "Who, if anyone, will be hired?"',
        '- "How effective will the grant committee deem this grant?"',
        "",
        'Questions have 2 or more possible outcomes. For a question like "will this',
        'proposal pass," the outcomes are "yes" and "no." For a question like "who',
        'will be hired," the outcomes could be "Alice," "Bob," and "neither."',
        "",
        'Outcomes resolve to a number between 0 and 1. Binary questions like "will',
        'this proposal pass" have outcomes that resolve to exactly 0 or 1. You can',
        'also have questions with scalar outcomes. For example, the question "how',
        'effective will the grant committee deem this grant" could have two outcomes:',
        '"ineffective" and "effective." If the grant committee deems the grant 70%',
        'effective, the "effective" outcome would resolve to 0.7 and the "ineffective"',
        "outcome would resolve to 0.3.",
        "",
        "Once resolved, the sum of all outcome resolutions is exactly 1.",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "questionId";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "oracle";
            type: "pubkey";
          },
          {
            name: "payoutNumerators";
            type: {
              vec: "u32";
            };
          },
          {
            name: "payoutDenominator";
            type: "u32";
          },
        ];
      };
    },
    {
      name: "removeProposalEvent";
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
            name: "proposal";
            type: "pubkey";
          },
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "admin";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "setSpendingLimitArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "config";
            docs: [
              "`Some` becomes the new record verbatim; `None` deletes it.",
            ];
            type: {
              option: {
                defined: {
                  name: "initialSpendingLimit";
                };
              };
            };
          },
        ];
      };
    },
    {
      name: "setSpendingLimitEvent";
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
            name: "dao";
            type: "pubkey";
          },
          {
            name: "config";
            type: {
              option: {
                defined: {
                  name: "initialSpendingLimit";
                };
              };
            };
          },
        ];
      };
    },
    {
      name: "spendingLimitAction";
      docs: ["What a hostile takeover declares for the spending limit."];
      type: {
        kind: "enum";
        variants: [
          {
            name: "keep";
          },
          {
            name: "remove";
          },
          {
            name: "set";
            fields: [
              {
                defined: {
                  name: "initialSpendingLimit";
                };
              },
            ];
          },
        ];
      };
    },
    {
      name: "sponsorProposalEvent";
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
            name: "proposal";
            type: "pubkey";
          },
          {
            name: "dao";
            type: "pubkey";
          },
          {
            name: "teamAddress";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "spotSwapEvent";
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
            name: "dao";
            type: "pubkey";
          },
          {
            name: "user";
            type: "pubkey";
          },
          {
            name: "swapType";
            type: {
              defined: {
                name: "swapType";
              };
            };
          },
          {
            name: "inputAmount";
            type: "u64";
          },
          {
            name: "outputAmount";
            type: "u64";
          },
          {
            name: "minOutputAmount";
            type: "u64";
          },
          {
            name: "postAmmState";
            type: {
              defined: {
                name: "futarchyAmm";
              };
            };
          },
        ];
      };
    },
    {
      name: "spotSwapParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "inputAmount";
            type: "u64";
          },
          {
            name: "swapType";
            type: {
              defined: {
                name: "swapType";
              };
            };
          },
          {
            name: "minOutputAmount";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "stakeAccount";
      type: {
        kind: "struct";
        fields: [
          {
            name: "proposal";
            type: "pubkey";
          },
          {
            name: "staker";
            type: "pubkey";
          },
          {
            name: "amount";
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
      name: "stakeToProposalEvent";
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
            name: "proposal";
            type: "pubkey";
          },
          {
            name: "staker";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "totalStaked";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "stakeToProposalParams";
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
      name: "swapType";
      type: {
        kind: "enum";
        variants: [
          {
            name: "buy";
          },
          {
            name: "sell";
          },
        ];
      };
    },
    {
      name: "syncSpendingLimitEvent";
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
            name: "dao";
            type: "pubkey";
          },
          {
            name: "spendingLimit";
            docs: [
              "The Squads-side SpendingLimit PDA the record was projected onto.",
            ];
            type: "pubkey";
          },
          {
            name: "config";
            docs: [
              "The projected record — the Squads-side end-state after the sync.",
              "`None` = no limit (removed or never existed).",
            ];
            type: {
              option: {
                defined: {
                  name: "initialSpendingLimit";
                };
              };
            };
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
      name: "unstakeFromProposalEvent";
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
            name: "proposal";
            type: "pubkey";
          },
          {
            name: "staker";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "totalStaked";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "unstakeFromProposalParams";
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
      name: "updateDaoEvent";
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
            name: "dao";
            type: "pubkey";
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
            type: "u128";
          },
          {
            name: "twapMaxObservationChangePerUpdate";
            type: "u128";
          },
          {
            name: "twapStartDelaySeconds";
            type: "u32";
          },
          {
            name: "minQuoteFutarchicLiquidity";
            type: "u64";
          },
          {
            name: "minBaseFutarchicLiquidity";
            type: "u64";
          },
          {
            name: "baseToStake";
            type: "u64";
          },
          {
            name: "teamSponsoredPassThresholdBps";
            type: "i16";
          },
          {
            name: "teamAddress";
            type: "pubkey";
          },
          {
            name: "isOptimisticGovernanceEnabled";
            type: "bool";
          },
          {
            name: "typedProposalsEnabled";
            type: "bool";
          },
        ];
      };
    },
    {
      name: "updateDaoParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "passThresholdBps";
            type: {
              option: "u16";
            };
          },
          {
            name: "secondsPerProposal";
            type: {
              option: "u32";
            };
          },
          {
            name: "twapInitialObservation";
            type: {
              option: "u128";
            };
          },
          {
            name: "twapMaxObservationChangePerUpdate";
            type: {
              option: "u128";
            };
          },
          {
            name: "twapStartDelaySeconds";
            type: {
              option: "u32";
            };
          },
          {
            name: "minQuoteFutarchicLiquidity";
            type: {
              option: "u64";
            };
          },
          {
            name: "minBaseFutarchicLiquidity";
            type: {
              option: "u64";
            };
          },
          {
            name: "baseToStake";
            type: {
              option: "u64";
            };
          },
          {
            name: "teamSponsoredPassThresholdBps";
            type: {
              option: "i16";
            };
          },
          {
            name: "teamAddress";
            type: {
              option: "pubkey";
            };
          },
          {
            name: "deprecatedIsOptimisticGovernanceEnabled";
            docs: [
              "Ignored. The retired optimistic-governance flag, kept in place so",
              "payloads encoded before the upgrade are refused, not reinterpreted.",
            ];
            type: {
              option: "bool";
            };
          },
          {
            name: "typedProposalsEnabled";
            docs: [
              "`Some(true)` turns typed proposals on for this DAO. `None` leaves them",
              "as they are. `Some(false)` is refused: there is no way to turn them off.",
            ];
            type: {
              option: "bool";
            };
          },
        ];
      };
    },
    {
      name: "withdrawLiquidityEvent";
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
            name: "dao";
            type: "pubkey";
          },
          {
            name: "liquidityProvider";
            type: "pubkey";
          },
          {
            name: "liquidityWithdrawn";
            type: "u128";
          },
          {
            name: "minBaseAmount";
            type: "u64";
          },
          {
            name: "minQuoteAmount";
            type: "u64";
          },
          {
            name: "baseAmount";
            type: "u64";
          },
          {
            name: "quoteAmount";
            type: "u64";
          },
          {
            name: "postAmmState";
            type: {
              defined: {
                name: "futarchyAmm";
              };
            };
          },
        ];
      };
    },
    {
      name: "withdrawLiquidityParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "liquidityToWithdraw";
            docs: ["How much liquidity to withdraw"];
            type: "u128";
          },
          {
            name: "minBaseAmount";
            docs: ["Minimum base tokens to receive"];
            type: "u64";
          },
          {
            name: "minQuoteAmount";
            docs: ["Minimum quote tokens to receive"];
            type: "u64";
          },
        ];
      };
    },
  ];
};
