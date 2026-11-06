/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/liquidation.json`.
 */
export type Liquidation = {
  address: "LiQnowFbFQdYyZhF4pUbpsrZCjxRTQ1upKJxZ2VXjde";
  metadata: {
    name: "liquidation";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Manages the orderly liquidation of a project's treasury back to token holders.";
  };
  instructions: [
    {
      name: "activateLiquidation";
      discriminator: [142, 154, 220, 96, 71, 12, 193, 18];
      accounts: [
        {
          name: "liquidationAuthority";
          signer: true;
          relations: ["liquidation"];
        },
        {
          name: "liquidation";
          writable: true;
        },
        {
          name: "liquidationAuthorityQuoteAccount";
          writable: true;
        },
        {
          name: "liquidationQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "liquidation";
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
          relations: ["liquidation"];
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
      name: "initializeLiquidation";
      discriminator: [176, 137, 148, 128, 141, 254, 91, 255];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "createKey";
          signer: true;
        },
        {
          name: "recordAuthority";
        },
        {
          name: "liquidationAuthority";
        },
        {
          name: "baseMint";
        },
        {
          name: "quoteMint";
        },
        {
          name: "liquidation";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [108, 105, 113, 117, 105, 100, 97, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "baseMint";
              },
              {
                kind: "account";
                path: "quoteMint";
              },
              {
                kind: "account";
                path: "createKey";
              },
            ];
          };
        },
        {
          name: "liquidationQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "liquidation";
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
          name: "args";
          type: {
            defined: {
              name: "initializeLiquidationArgs";
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
          name: "recipient";
          writable: true;
          signer: true;
          relations: ["refundRecord"];
        },
        {
          name: "liquidation";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [108, 105, 113, 117, 105, 100, 97, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "baseMint";
              },
              {
                kind: "account";
                path: "quoteMint";
              },
              {
                kind: "account";
                path: "liquidation.create_key";
                account: "liquidation";
              },
            ];
          };
          relations: ["refundRecord"];
        },
        {
          name: "refundRecord";
          writable: true;
        },
        {
          name: "recipientBaseAccount";
          writable: true;
        },
        {
          name: "liquidationQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "liquidation";
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
          name: "baseMint";
          writable: true;
          relations: ["liquidation"];
        },
        {
          name: "quoteMint";
          relations: ["liquidation"];
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
      args: [];
    },
    {
      name: "setRefundRecord";
      discriminator: [179, 197, 210, 86, 84, 87, 43, 16];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "recordAuthority";
          signer: true;
        },
        {
          name: "liquidation";
          writable: true;
        },
        {
          name: "recipient";
        },
        {
          name: "refundRecord";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  114,
                  101,
                  102,
                  117,
                  110,
                  100,
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
                path: "liquidation";
              },
              {
                kind: "account";
                path: "recipient";
              },
            ];
          };
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
              name: "setRefundRecordArgs";
            };
          };
        },
      ];
    },
    {
      name: "withdrawRemainingQuote";
      discriminator: [54, 253, 188, 34, 100, 145, 59, 127];
      accounts: [
        {
          name: "liquidationAuthority";
          signer: true;
          relations: ["liquidation"];
        },
        {
          name: "liquidation";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [108, 105, 113, 117, 105, 100, 97, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "liquidation.base_mint";
                account: "liquidation";
              },
              {
                kind: "account";
                path: "quoteMint";
              },
              {
                kind: "account";
                path: "liquidation.create_key";
                account: "liquidation";
              },
            ];
          };
        },
        {
          name: "liquidationQuoteVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "liquidation";
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
          name: "liquidationAuthorityQuoteAccount";
          writable: true;
        },
        {
          name: "quoteMint";
          relations: ["liquidation"];
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
      name: "liquidation";
      discriminator: [47, 86, 219, 172, 131, 174, 18, 227];
    },
    {
      name: "refundRecord";
      discriminator: [101, 159, 85, 113, 48, 38, 7, 215];
    },
  ];
  events: [
    {
      name: "liquidationActivatedEvent";
      discriminator: [156, 171, 134, 76, 106, 29, 65, 180];
    },
    {
      name: "liquidationCreatedEvent";
      discriminator: [5, 223, 88, 192, 206, 170, 143, 203];
    },
    {
      name: "refundEvent";
      discriminator: [176, 159, 218, 59, 94, 213, 129, 218];
    },
    {
      name: "refundRecordSetEvent";
      discriminator: [8, 130, 38, 95, 71, 11, 27, 213];
    },
    {
      name: "withdrawRemainingQuoteEvent";
      discriminator: [89, 109, 106, 25, 96, 35, 166, 12];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "refundingNotEnabled";
      msg: "Refunding is not enabled";
    },
    {
      code: 6001;
      name: "alreadyActivated";
      msg: "Liquidation is already activated";
    },
    {
      code: 6002;
      name: "nothingToFund";
      msg: "No quote tokens to fund";
    },
    {
      code: 6003;
      name: "noBaseAssigned";
      msg: "No base tokens assigned";
    },
    {
      code: 6004;
      name: "refundWindowExpired";
      msg: "Refund window has expired";
    },
    {
      code: 6005;
      name: "refundWindowNotExpired";
      msg: "Refund window has not expired";
    },
    {
      code: 6006;
      name: "invalidDuration";
      msg: "Duration must be greater than zero";
    },
    {
      code: 6007;
      name: "nothingToRefund";
      msg: "Nothing to refund";
    },
    {
      code: 6008;
      name: "invalidAllocation";
      msg: "Invalid allocation";
    },
    {
      code: 6009;
      name: "invalidAuthority";
      msg: "Invalid authority";
    },
    {
      code: 6010;
      name: "invalidMint";
      msg: "Invalid mint";
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
            name: "liquidationSeqNum";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "initializeLiquidationArgs";
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
      name: "liquidation";
      type: {
        kind: "struct";
        fields: [
          {
            name: "createKey";
            docs: ["Arbitrary keypair used to make the PDA unique."];
            type: "pubkey";
          },
          {
            name: "recordAuthority";
            docs: [
              "The address that can create and modify RefundRecords during setup.",
            ];
            type: "pubkey";
          },
          {
            name: "liquidationAuthority";
            docs: [
              "The address that activates the liquidation and receives remaining quote tokens post-deadline.",
            ];
            type: "pubkey";
          },
          {
            name: "baseMint";
            docs: ["The project token mint (tokens to be burned)."];
            type: "pubkey";
          },
          {
            name: "quoteMint";
            docs: ["The refund token mint (USDC)."];
            type: "pubkey";
          },
          {
            name: "totalQuoteRefundable";
            docs: ["Sum of all RefundRecord quote_refundable values."];
            type: "u64";
          },
          {
            name: "totalQuoteRefunded";
            docs: [
              "Sum of all quote tokens actually transferred to users so far.",
            ];
            type: "u64";
          },
          {
            name: "totalBaseAssigned";
            docs: ["Sum of all RefundRecord base_assigned values."];
            type: "u64";
          },
          {
            name: "totalBaseBurned";
            docs: ["Sum of all base tokens actually burned so far."];
            type: "u64";
          },
          {
            name: "startedAt";
            docs: [
              "Unix timestamp when ActivateLiquidation was called. 0 before activation.",
            ];
            type: "i64";
          },
          {
            name: "durationSeconds";
            docs: ["How long the refund window lasts after activation."];
            type: "u32";
          },
          {
            name: "seqNum";
            docs: ["Event sequence number for indexing."];
            type: "u64";
          },
          {
            name: "isRefunding";
            docs: ["Whether refunds are currently enabled."];
            type: "bool";
          },
          {
            name: "pdaBump";
            docs: ["PDA bump seed."];
            type: "u8";
          },
        ];
      };
    },
    {
      name: "liquidationActivatedEvent";
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
            name: "liquidation";
            type: "pubkey";
          },
          {
            name: "totalQuoteFunded";
            type: "u64";
          },
          {
            name: "startedAt";
            type: "i64";
          },
        ];
      };
    },
    {
      name: "liquidationCreatedEvent";
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
            name: "liquidation";
            type: "pubkey";
          },
          {
            name: "createKey";
            type: "pubkey";
          },
          {
            name: "recordAuthority";
            type: "pubkey";
          },
          {
            name: "liquidationAuthority";
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
      name: "refundEvent";
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
            name: "liquidation";
            type: "pubkey";
          },
          {
            name: "refundRecord";
            type: "pubkey";
          },
          {
            name: "recipient";
            type: "pubkey";
          },
          {
            name: "baseBurned";
            type: "u64";
          },
          {
            name: "quoteRefunded";
            type: "u64";
          },
          {
            name: "postRecordBaseBurned";
            type: "u64";
          },
          {
            name: "postRecordQuoteRefunded";
            type: "u64";
          },
          {
            name: "postLiquidationTotalBaseBurned";
            type: "u64";
          },
          {
            name: "postLiquidationTotalQuoteRefunded";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "refundRecord";
      type: {
        kind: "struct";
        fields: [
          {
            name: "liquidation";
            docs: ["The parent Liquidation account."];
            type: "pubkey";
          },
          {
            name: "recipient";
            docs: ["The user this record belongs to."];
            type: "pubkey";
          },
          {
            name: "baseAssigned";
            docs: ["Total base tokens this user is eligible to burn."];
            type: "u64";
          },
          {
            name: "baseBurned";
            docs: ["Base tokens this user has burned so far."];
            type: "u64";
          },
          {
            name: "quoteRefundable";
            docs: [
              "Total quote tokens this user can receive if they burn all assigned base.",
            ];
            type: "u64";
          },
          {
            name: "quoteRefunded";
            docs: ["Quote tokens already transferred to this user."];
            type: "u64";
          },
          {
            name: "pdaBump";
            docs: ["PDA bump seed."];
            type: "u8";
          },
        ];
      };
    },
    {
      name: "refundRecordSetEvent";
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
            name: "liquidation";
            type: "pubkey";
          },
          {
            name: "refundRecord";
            type: "pubkey";
          },
          {
            name: "recipient";
            type: "pubkey";
          },
          {
            name: "baseAssigned";
            type: "u64";
          },
          {
            name: "quoteRefundable";
            type: "u64";
          },
          {
            name: "liquidationTotalBaseAssigned";
            type: "u64";
          },
          {
            name: "liquidationTotalQuoteRefundable";
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
      name: "setRefundRecordArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "baseAssigned";
            type: "u64";
          },
          {
            name: "quoteRefundable";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "withdrawRemainingQuoteEvent";
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
            name: "liquidation";
            type: "pubkey";
          },
          {
            name: "liquidationAuthority";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          },
        ];
      };
    },
  ];
};
