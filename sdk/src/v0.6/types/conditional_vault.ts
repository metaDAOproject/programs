/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/conditional_vault.json`.
 */
export type ConditionalVault = {
  address: "613BRiXuAEn7vibs2oAYzpGW9fXgjzDNuFMM4wPzLdY";
  metadata: {
    name: "conditionalVault";
    version: "0.4.0";
    spec: "0.1.0";
    description: "SVM-based program for minting conditional tokens";
  };
  instructions: [
    {
      name: "addMetadataToConditionalTokens";
      discriminator: [133, 20, 169, 231, 114, 112, 45, 1];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "vault";
          writable: true;
        },
        {
          name: "conditionalTokenMint";
          writable: true;
        },
        {
          name: "conditionalTokenMetadata";
          writable: true;
        },
        {
          name: "tokenMetadataProgram";
          address: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "rent";
          address: "SysvarRent111111111111111111111111111111111";
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
          name: "args";
          type: {
            defined: {
              name: "addMetadataToConditionalTokensArgs";
            };
          };
        }
      ];
    },
    {
      name: "initializeConditionalVault";
      discriminator: [37, 88, 250, 212, 54, 218, 227, 175];
      accounts: [
        {
          name: "vault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  99,
                  111,
                  110,
                  100,
                  105,
                  116,
                  105,
                  111,
                  110,
                  97,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ];
              },
              {
                kind: "account";
                path: "question";
              },
              {
                kind: "account";
                path: "underlyingTokenMint";
              }
            ];
          };
        },
        {
          name: "question";
        },
        {
          name: "underlyingTokenMint";
        },
        {
          name: "vaultUnderlyingTokenAccount";
          pda: {
            seeds: [
              {
                kind: "account";
                path: "vault";
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
                path: "underlyingTokenMint";
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
          name: "payer";
          writable: true;
          signer: true;
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
      args: [];
    },
    {
      name: "initializeQuestion";
      discriminator: [245, 151, 106, 188, 88, 44, 65, 212];
      accounts: [
        {
          name: "question";
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
          name: "args";
          type: {
            defined: {
              name: "initializeQuestionArgs";
            };
          };
        }
      ];
    },
    {
      name: "mergeTokens";
      discriminator: [226, 89, 251, 121, 225, 130, 180, 14];
      accounts: [
        {
          name: "question";
          relations: ["vault"];
        },
        {
          name: "vault";
          writable: true;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "authority";
          signer: true;
        },
        {
          name: "userUnderlyingTokenAccount";
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
          name: "amount";
          type: "u64";
        }
      ];
    },
    {
      name: "redeemTokens";
      discriminator: [246, 98, 134, 41, 152, 33, 120, 69];
      accounts: [
        {
          name: "question";
        },
        {
          name: "vault";
          writable: true;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "authority";
          signer: true;
        },
        {
          name: "userUnderlyingTokenAccount";
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
      args: [];
    },
    {
      name: "resolveQuestion";
      discriminator: [52, 32, 224, 179, 180, 8, 0, 246];
      accounts: [
        {
          name: "question";
          writable: true;
        },
        {
          name: "oracle";
          signer: true;
          relations: ["question"];
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
          name: "args";
          type: {
            defined: {
              name: "resolveQuestionArgs";
            };
          };
        }
      ];
    },
    {
      name: "splitTokens";
      discriminator: [79, 195, 116, 0, 140, 176, 73, 179];
      accounts: [
        {
          name: "question";
          relations: ["vault"];
        },
        {
          name: "vault";
          writable: true;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "authority";
          signer: true;
        },
        {
          name: "userUnderlyingTokenAccount";
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
          name: "amount";
          type: "u64";
        }
      ];
    }
  ];
  accounts: [
    {
      name: "conditionalVault";
      discriminator: [63, 132, 87, 98, 36, 51, 175, 247];
    },
    {
      name: "question";
      discriminator: [111, 22, 150, 220, 181, 122, 118, 127];
    }
  ];
  events: [
    {
      name: "addMetadataToConditionalTokensEvent";
      discriminator: [185, 201, 129, 156, 179, 177, 111, 50];
    },
    {
      name: "initializeConditionalVaultEvent";
      discriminator: [62, 212, 201, 253, 217, 193, 232, 182];
    },
    {
      name: "initializeQuestionEvent";
      discriminator: [89, 199, 242, 209, 55, 67, 183, 201];
    },
    {
      name: "mergeTokensEvent";
      discriminator: [34, 107, 222, 189, 126, 194, 10, 90];
    },
    {
      name: "redeemTokensEvent";
      discriminator: [36, 211, 53, 194, 23, 5, 75, 90];
    },
    {
      name: "resolveQuestionEvent";
      discriminator: [0, 175, 131, 95, 5, 84, 50, 29];
    },
    {
      name: "splitTokensEvent";
      discriminator: [42, 188, 142, 203, 78, 60, 242, 149];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "assertFailed";
      msg: "An assertion failed";
    },
    {
      code: 6001;
      name: "insufficientUnderlyingTokens";
      msg: "Insufficient underlying token balance to mint this amount of conditional tokens";
    },
    {
      code: 6002;
      name: "insufficientConditionalTokens";
      msg: "Insufficient conditional token balance to merge this `amount`";
    },
    {
      code: 6003;
      name: "invalidVaultUnderlyingTokenAccount";
      msg: "This `vault_underlying_token_account` is not this vault's `underlying_token_account`";
    },
    {
      code: 6004;
      name: "invalidConditionalTokenMint";
      msg: "This conditional token mint is not this vault's conditional token mint";
    },
    {
      code: 6005;
      name: "cantRedeemConditionalTokens";
      msg: "Question needs to be resolved before users can redeem conditional tokens for underlying tokens";
    },
    {
      code: 6006;
      name: "insufficientNumConditions";
      msg: "Questions need 2 or more conditions";
    },
    {
      code: 6007;
      name: "invalidNumPayoutNumerators";
      msg: "Invalid number of payout numerators";
    },
    {
      code: 6008;
      name: "invalidConditionals";
      msg: "Client needs to pass in the list of conditional mints for a vault followed by the user's token accounts for those tokens";
    },
    {
      code: 6009;
      name: "conditionalMintMismatch";
      msg: "Conditional mint not in vault";
    },
    {
      code: 6010;
      name: "badConditionalMint";
      msg: "Unable to deserialize a conditional token mint";
    },
    {
      code: 6011;
      name: "badConditionalTokenAccount";
      msg: "Unable to deserialize a conditional token account";
    },
    {
      code: 6012;
      name: "conditionalTokenMintMismatch";
      msg: "User conditional token account mint does not match conditional mint";
    },
    {
      code: 6013;
      name: "payoutZero";
      msg: "Payouts must sum to 1 or more";
    },
    {
      code: 6014;
      name: "questionAlreadyResolved";
      msg: "Question already resolved";
    },
    {
      code: 6015;
      name: "conditionalTokenMetadataAlreadySet";
      msg: "Conditional token metadata already set";
    },
    {
      code: 6016;
      name: "unauthorizedConditionalTokenAccount";
      msg: "Conditional token account is not owned by the authority";
    }
  ];
  types: [
    {
      name: "addMetadataToConditionalTokensArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "name";
            type: "string";
          },
          {
            name: "symbol";
            type: "string";
          },
          {
            name: "uri";
            type: "string";
          }
        ];
      };
    },
    {
      name: "addMetadataToConditionalTokensEvent";
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
            name: "vault";
            type: "pubkey";
          },
          {
            name: "conditionalTokenMint";
            type: "pubkey";
          },
          {
            name: "conditionalTokenMetadata";
            type: "pubkey";
          },
          {
            name: "name";
            type: "string";
          },
          {
            name: "symbol";
            type: "string";
          },
          {
            name: "uri";
            type: "string";
          },
          {
            name: "seqNum";
            type: "u64";
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
      name: "initializeConditionalVaultEvent";
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
            name: "vault";
            type: "pubkey";
          },
          {
            name: "question";
            type: "pubkey";
          },
          {
            name: "underlyingTokenMint";
            type: "pubkey";
          },
          {
            name: "vaultUnderlyingTokenAccount";
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
            name: "seqNum";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "initializeQuestionArgs";
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
            name: "numOutcomes";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "initializeQuestionEvent";
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
            name: "numOutcomes";
            type: "u8";
          },
          {
            name: "question";
            type: "pubkey";
          }
        ];
      };
    },
    {
      name: "mergeTokensEvent";
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
            name: "user";
            type: "pubkey";
          },
          {
            name: "vault";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "postUserUnderlyingBalance";
            type: "u64";
          },
          {
            name: "postVaultUnderlyingBalance";
            type: "u64";
          },
          {
            name: "postUserConditionalTokenBalances";
            type: {
              vec: "u64";
            };
          },
          {
            name: "postConditionalTokenSupplies";
            type: {
              vec: "u64";
            };
          },
          {
            name: "seqNum";
            type: "u64";
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
      name: "redeemTokensEvent";
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
            name: "user";
            type: "pubkey";
          },
          {
            name: "vault";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "postUserUnderlyingBalance";
            type: "u64";
          },
          {
            name: "postVaultUnderlyingBalance";
            type: "u64";
          },
          {
            name: "postConditionalTokenSupplies";
            type: {
              vec: "u64";
            };
          },
          {
            name: "seqNum";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "resolveQuestionArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "payoutNumerators";
            type: {
              vec: "u32";
            };
          }
        ];
      };
    },
    {
      name: "resolveQuestionEvent";
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
            name: "question";
            type: "pubkey";
          },
          {
            name: "payoutNumerators";
            type: {
              vec: "u32";
            };
          }
        ];
      };
    },
    {
      name: "splitTokensEvent";
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
            name: "user";
            type: "pubkey";
          },
          {
            name: "vault";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "postUserUnderlyingBalance";
            type: "u64";
          },
          {
            name: "postVaultUnderlyingBalance";
            type: "u64";
          },
          {
            name: "postUserConditionalTokenBalances";
            type: {
              vec: "u64";
            };
          },
          {
            name: "postConditionalTokenSupplies";
            type: {
              vec: "u64";
            };
          },
          {
            name: "seqNum";
            type: "u64";
          }
        ];
      };
    }
  ];
};
