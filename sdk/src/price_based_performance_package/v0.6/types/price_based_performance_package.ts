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
    version: "0.6.0";
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
          name: "admin";
          writable: true;
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
          name: "performancePackageTokenVault";
          docs: ["The token account where locked tokens are stored"];
          writable: true;
          relations: ["performancePackage"];
        },
        {
          name: "tokenMint";
          docs: ["The token mint - validated via has_one constraint on locker"];
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
                path: "tokenRecipient";
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
          name: "tokenRecipient";
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
      args: [];
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
  ];
  accounts: [
    {
      name: "changeRequest";
      discriminator: [75, 130, 166, 47, 15, 217, 131, 190];
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
  ];
  types: [
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
      name: "oracleConfig";
      docs: [
        "Starting at `byte_offset` in `oracle_account`, this program expects to read:",
        "- 16 bytes for the aggregator, stored as a little endian u128",
        "- 8 bytes for the slot that the aggregator was last updated, stored as a",
        "little endian u64",
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
  ];
};
