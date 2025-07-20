/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/autocrat.json`.
 */
export type Autocrat = {
  address: "EP3SoC2SvR3d4c2eXVBvhEMWSr2j3YtoCY3UMiQV7BPD";
  metadata: {
    name: "autocrat";
    version: "0.5.0";
    spec: "0.1.0";
    description: "SVM-based program for running futarchy";
  };
  instructions: [
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
              }
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
              }
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
              }
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
                  103
                ];
              }
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
                  116
                ];
              },
              {
                kind: "account";
                path: "dao";
              }
            ];
            program: {
              kind: "account";
              path: "squadsProgram";
            };
          };
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
                  121
                ];
              }
            ];
          };
        },
        {
          name: "program";
        }
      ];
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "initializeDaoParams";
            };
          };
        }
      ];
    },
    {
      name: "initializeFutarchyAmm";
      discriminator: [152, 34, 129, 79, 207, 32, 253, 162];
      accounts: [
        {
          name: "futarchyAmm";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [102, 117, 116, 97, 114, 99, 104, 121, 95, 97, 109, 109];
              }
            ];
          };
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "creator";
          signer: true;
        },
        {
          name: "dao";
        },
        {
          name: "baseMint";
          relations: ["dao"];
        },
        {
          name: "quoteMint";
          relations: ["dao"];
        },
        {
          name: "baseVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "futarchyAmm";
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
                  169
                ];
              },
              {
                kind: "account";
                path: "baseMint";
              }
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
                89
              ];
            };
          };
        },
        {
          name: "quoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "futarchyAmm";
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
                  169
                ];
              },
              {
                kind: "account";
                path: "quoteMint";
              }
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
                89
              ];
            };
          };
        },
        {
          name: "creatorBaseAccount";
          writable: true;
        },
        {
          name: "creatorQuoteAccount";
          writable: true;
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
                  121
                ];
              }
            ];
          };
        },
        {
          name: "program";
        }
      ];
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "initializeFutarchyAmmParams";
            };
          };
        }
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
              }
            ];
          };
        },
        {
          name: "squadsProposal";
        },
        {
          name: "dao";
          writable: true;
          relations: ["futarchyAmm"];
        },
        {
          name: "futarchyAmm";
          writable: true;
        },
        {
          name: "question";
          relations: ["quoteVault", "baseVault"];
        },
        {
          name: "ammTokenAccounts";
          accounts: [
            {
              name: "unconditionalBase";
              writable: true;
            },
            {
              name: "unconditionalQuote";
              writable: true;
            },
            {
              name: "passBase";
              writable: true;
            },
            {
              name: "passQuote";
              writable: true;
            },
            {
              name: "failBase";
              writable: true;
            },
            {
              name: "failQuote";
              writable: true;
            }
          ];
        },
        {
          name: "quoteVault";
          writable: true;
        },
        {
          name: "baseVault";
          writable: true;
        },
        {
          name: "baseVaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "quoteVaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "baseMint";
        },
        {
          name: "quoteMint";
        },
        {
          name: "failBaseMint";
          writable: true;
        },
        {
          name: "failQuoteMint";
          writable: true;
        },
        {
          name: "passBaseMint";
          writable: true;
        },
        {
          name: "passQuoteMint";
          writable: true;
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
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
          name: "conditionalVaultProgram";
          address: "VLTX1ishMBbcX3rdBWGssxawAo1Q2X2qxYFYqiGodVg";
        },
        {
          name: "vaultEventAuthority";
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
                  121
                ];
              }
            ];
          };
        },
        {
          name: "program";
        }
      ];
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "initializeProposalParams";
            };
          };
        }
      ];
    },
    {
      name: "predictionSwap";
      discriminator: [196, 11, 102, 50, 166, 8, 225, 211];
      accounts: [
        {
          name: "futarchyAmm";
          writable: true;
        },
        {
          name: "trader";
          signer: true;
        },
        {
          name: "traderInputAccount";
          writable: true;
        },
        {
          name: "traderOutputAccount";
          writable: true;
        },
        {
          name: "ammTokenAccounts";
          accounts: [
            {
              name: "unconditionalBase";
              writable: true;
            },
            {
              name: "unconditionalQuote";
              writable: true;
            },
            {
              name: "passBase";
              writable: true;
            },
            {
              name: "passQuote";
              writable: true;
            },
            {
              name: "failBase";
              writable: true;
            },
            {
              name: "failQuote";
              writable: true;
            }
          ];
        },
        {
          name: "question";
        },
        {
          name: "baseMint";
        },
        {
          name: "quoteMint";
        },
        {
          name: "quoteVault";
          writable: true;
        },
        {
          name: "quoteVaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "baseVault";
          writable: true;
        },
        {
          name: "baseVaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "conditionalVaultProgram";
          address: "VLTX1ishMBbcX3rdBWGssxawAo1Q2X2qxYFYqiGodVg";
        },
        {
          name: "vaultEventAuthority";
        },
        {
          name: "passQuoteMint";
          writable: true;
        },
        {
          name: "failQuoteMint";
          writable: true;
        },
        {
          name: "passBaseMint";
          writable: true;
        },
        {
          name: "failBaseMint";
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
                  121
                ];
              }
            ];
          };
        },
        {
          name: "program";
        }
      ];
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "predictionSwapParams";
            };
          };
        }
      ];
    },
    {
      name: "spotSwap";
      discriminator: [167, 97, 12, 231, 237, 78, 166, 251];
      accounts: [
        {
          name: "futarchyAmm";
          writable: true;
        },
        {
          name: "trader";
          signer: true;
        },
        {
          name: "traderInputAccount";
          writable: true;
        },
        {
          name: "traderOutputAccount";
          writable: true;
        },
        {
          name: "ammTokenAccounts";
          accounts: [
            {
              name: "unconditionalBase";
              writable: true;
            },
            {
              name: "unconditionalQuote";
              writable: true;
            },
            {
              name: "passBase";
              writable: true;
            },
            {
              name: "passQuote";
              writable: true;
            },
            {
              name: "failBase";
              writable: true;
            },
            {
              name: "failQuote";
              writable: true;
            }
          ];
        },
        {
          name: "question";
        },
        {
          name: "baseMint";
        },
        {
          name: "quoteMint";
        },
        {
          name: "quoteVault";
          writable: true;
        },
        {
          name: "quoteVaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "baseVault";
          writable: true;
        },
        {
          name: "baseVaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "conditionalVaultProgram";
          address: "VLTX1ishMBbcX3rdBWGssxawAo1Q2X2qxYFYqiGodVg";
        },
        {
          name: "vaultEventAuthority";
        },
        {
          name: "passQuoteMint";
          writable: true;
        },
        {
          name: "failQuoteMint";
          writable: true;
        },
        {
          name: "passBaseMint";
          writable: true;
        },
        {
          name: "failBaseMint";
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
                  121
                ];
              }
            ];
          };
        },
        {
          name: "program";
        }
      ];
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "spotTradeParams";
            };
          };
        }
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
                  121
                ];
              }
            ];
          };
        },
        {
          name: "program";
        }
      ];
      args: [
        {
          name: "daoParams";
          type: {
            defined: {
              name: "updateDaoParams";
            };
          };
        }
      ];
    }
  ];
  accounts: [
    {
      name: "amm";
      discriminator: [143, 245, 200, 17, 74, 214, 196, 135];
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
      name: "futarchyProposal";
      discriminator: [223, 2, 123, 23, 249, 7, 207, 255];
    },
    {
      name: "programConfig";
      discriminator: [196, 210, 90, 231, 144, 149, 140, 63];
    },
    {
      name: "proposal";
      discriminator: [26, 94, 189, 187, 116, 136, 53, 33];
    },
    {
      name: "question";
      discriminator: [111, 22, 150, 220, 181, 122, 118, 127];
    }
  ];
  events: [
    {
      name: "executeProposalEvent";
      discriminator: [153, 12, 41, 73, 206, 114, 248, 233];
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
      name: "updateDaoEvent";
      discriminator: [12, 58, 244, 224, 171, 25, 33, 56];
    }
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
      name: "insufficientLpTokenBalance";
      msg: "The proposer has fewer pass or fail LP tokens than they requested to lock";
    },
    {
      code: 6011;
      name: "insufficientLpTokenLock";
      msg: "The LP tokens passed in have less liquidity than the DAO's `min_quote_futarchic_liquidity` or `min_base_futachic_liquidity`";
    },
    {
      code: 6012;
      name: "proposalDurationTooShort";
      msg: "Proposal duration must be longer than TWAP start delay";
    },
    {
      code: 6013;
      name: "questionMustBeBinary";
      msg: "Question must have exactly 2 outcomes for binary futarchy";
    },
    {
      code: 6014;
      name: "invalidSquadsProposalStatus";
      msg: "Squads proposal must be in Draft status";
    },
    {
      code: 6015;
      name: "noReserves";
      msg: "No reserves";
    },
    {
      code: 6016;
      name: "castingOverflow";
      msg: "Got overflow when casting";
    },
    {
      code: 6017;
      name: "constantProductInvariantFailed";
      msg: "Constant product invariant failed";
    },
    {
      code: 6018;
      name: "proposalNotLive";
      msg: "Proposal must be live to swap conditional tokens";
    },
    {
      code: 6019;
      name: "invariantViolation";
      msg: "Invariant violation";
    }
  ];
  types: [
    {
      name: "amm";
      type: {
        kind: "struct";
        fields: [
          {
            name: "bump";
            type: "u8";
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
            name: "baseVault";
            type: "pubkey";
          },
          {
            name: "quoteVault";
            type: "pubkey";
          },
          {
            name: "state";
            type: {
              defined: {
                name: "ammState";
              };
            };
          }
        ];
      };
    },
    {
      name: "ammState";
      type: {
        kind: "enum";
        variants: [
          {
            name: "spot";
          },
          {
            name: "futarchy";
            fields: [
              {
                name: "proposal";
                type: "pubkey";
              },
              {
                name: "question";
                type: "pubkey";
              }
            ];
          }
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
          }
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
          }
        ];
      };
    },
    {
      name: "dao";
      type: {
        kind: "struct";
        fields: [
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
            name: "slotsPerProposal";
            type: "u64";
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
              "in 50 minutes."
            ];
            type: "u128";
          },
          {
            name: "twapMaxObservationChangePerUpdate";
            type: "u128";
          },
          {
            name: "twapStartDelaySlots";
            docs: [
              "Forces TWAP calculation to start after amm.created_at_slot + twap_start_delay_slots"
            ];
            type: "u64";
          },
          {
            name: "minQuoteFutarchicLiquidity";
            docs: [
              "As an anti-spam measure and to help liquidity, you need to lock up some liquidity",
              "in both futarchic markets in order to create a proposal.",
              "",
              "For example, for META, we can use a `min_quote_futarchic_liquidity` of",
              "5000 * 1_000_000 (5000 USDC) and a `min_base_futarchic_liquidity` of",
              "10 * 1_000_000_000 (10 META)."
            ];
            type: "u64";
          },
          {
            name: "minBaseFutarchicLiquidity";
            type: "u64";
          },
          {
            name: "seqNum";
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
          }
        ];
      };
    },
    {
      name: "executeProposalEvent";
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
          }
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
          }
        ];
      };
    },
    {
      name: "futarchyProposal";
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
            name: "slotEnqueued";
            type: "u64";
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
            name: "futarchyAmm";
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
            name: "durationInSlots";
            type: "u64";
          },
          {
            name: "squadsProposal";
            type: "pubkey";
          }
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
          }
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
            name: "slotsPerProposal";
            type: "u64";
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
            name: "minQuoteFutarchicLiquidity";
            type: "u64";
          },
          {
            name: "minBaseFutarchicLiquidity";
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
          }
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
            name: "twapStartDelaySlots";
            type: "u64";
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
            name: "passThresholdBps";
            type: "u16";
          },
          {
            name: "slotsPerProposal";
            type: "u64";
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
          }
        ];
      };
    },
    {
      name: "initializeFutarchyAmmParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "quoteAmount";
            type: "u64";
          },
          {
            name: "baseAmount";
            type: "u64";
          }
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
            name: "passAmm";
            type: "pubkey";
          },
          {
            name: "failAmm";
            type: "pubkey";
          },
          {
            name: "passLpMint";
            type: "pubkey";
          },
          {
            name: "failLpMint";
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
            name: "passLpTokensLocked";
            type: "u64";
          },
          {
            name: "failLpTokensLocked";
            type: "u64";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
          {
            name: "durationInSlots";
            type: "u64";
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
          }
        ];
      };
    },
    {
      name: "initializeProposalParams";
      type: {
        kind: "struct";
        fields: [];
      };
    },
    {
      name: "predictionSwapParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "side";
            type: {
              defined: {
                name: "side";
              };
            };
          },
          {
            name: "underlyingAsset";
            type: {
              defined: {
                name: "underlyingAsset";
              };
            };
          },
          {
            name: "amountIn";
            type: "u64";
          },
          {
            name: "minAmountOut";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "programConfig";
      docs: ["Global program configuration account."];
      type: {
        kind: "struct";
        fields: [
          {
            name: "authority";
            type: "pubkey";
          },
          {
            name: "multisigCreationFee";
            type: "u64";
          },
          {
            name: "treasury";
            type: "pubkey";
          },
          {
            name: "reserved";
            type: {
              array: ["u8", 64];
            };
          }
        ];
      };
    },
    {
      name: "proposal";
      docs: [
        "Stores the data required for tracking the status of a multisig proposal.",
        "Each `Proposal` has a 1:1 association with a transaction account, e.g. a `VaultTransaction` or a `ConfigTransaction`;",
        "the latter can be executed only after the `Proposal` has been approved and its time lock is released."
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "multisig";
            type: "pubkey";
          },
          {
            name: "transactionIndex";
            type: "u64";
          },
          {
            name: "status";
            type: {
              defined: {
                name: "proposalStatus";
              };
            };
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "approved";
            type: {
              vec: "pubkey";
            };
          },
          {
            name: "rejected";
            type: {
              vec: "pubkey";
            };
          },
          {
            name: "cancelled";
            type: {
              vec: "pubkey";
            };
          }
        ];
      };
    },
    {
      name: "proposalState";
      type: {
        kind: "enum";
        variants: [
          {
            name: "pending";
          },
          {
            name: "passed";
          },
          {
            name: "failed";
          }
        ];
      };
    },
    {
      name: "proposalStatus";
      docs: [
        "The status of a proposal.",
        "Each variant wraps a timestamp of when the status was set."
      ];
      type: {
        kind: "enum";
        variants: [
          {
            name: "draft";
            fields: [
              {
                name: "timestamp";
                type: "i64";
              }
            ];
          },
          {
            name: "active";
            fields: [
              {
                name: "timestamp";
                type: "i64";
              }
            ];
          },
          {
            name: "rejected";
            fields: [
              {
                name: "timestamp";
                type: "i64";
              }
            ];
          },
          {
            name: "approved";
            fields: [
              {
                name: "timestamp";
                type: "i64";
              }
            ];
          },
          {
            name: "executing";
          },
          {
            name: "executed";
            fields: [
              {
                name: "timestamp";
                type: "i64";
              }
            ];
          },
          {
            name: "cancelled";
            fields: [
              {
                name: "timestamp";
                type: "i64";
              }
            ];
          }
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
        "Once resolved, the sum of all outcome resolutions is exactly 1."
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
          }
        ];
      };
    },
    {
      name: "side";
      type: {
        kind: "enum";
        variants: [
          {
            name: "buy";
          },
          {
            name: "sell";
          }
        ];
      };
    },
    {
      name: "spotTradeParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "side";
            type: {
              defined: {
                name: "side";
              };
            };
          },
          {
            name: "amountIn";
            type: "u64";
          },
          {
            name: "minAmountOut";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "underlyingAsset";
      type: {
        kind: "enum";
        variants: [
          {
            name: "base";
          },
          {
            name: "quote";
          }
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
            name: "slotsPerProposal";
            type: "u64";
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
            name: "minQuoteFutarchicLiquidity";
            type: "u64";
          },
          {
            name: "minBaseFutarchicLiquidity";
            type: "u64";
          }
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
            name: "slotsPerProposal";
            type: {
              option: "u64";
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
          }
        ];
      };
    }
  ];
};
