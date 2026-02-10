export type PriceBasedPerformancePackage = {
  version: "0.6.0";
  name: "price_based_performance_package";
  constants: [
    {
      name: "MAX_TRANCHES";
      type: {
        defined: "usize";
      };
      value: "10";
    },
  ];
  instructions: [
    {
      name: "initializePerformancePackage";
      accounts: [
        {
          name: "performancePackage";
          isMut: true;
          isSigner: false;
        },
        {
          name: "createKey";
          isMut: false;
          isSigner: true;
          docs: ["Used to derive the PDA"];
        },
        {
          name: "tokenMint";
          isMut: false;
          isSigner: false;
          docs: ["The mint of the tokens to be locked"];
        },
        {
          name: "grantorTokenAccount";
          isMut: true;
          isSigner: false;
          docs: ["The token account containing the tokens to be locked"];
        },
        {
          name: "grantor";
          isMut: false;
          isSigner: true;
          docs: ["The authority of the token account"];
        },
        {
          name: "performancePackageTokenVault";
          isMut: true;
          isSigner: false;
          docs: ["The locker's token account where tokens will be stored"];
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "associatedTokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "eventAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "program";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: "params";
          type: {
            defined: "InitializePerformancePackageParams";
          };
        },
      ];
    },
    {
      name: "startUnlock";
      accounts: [
        {
          name: "performancePackage";
          isMut: true;
          isSigner: false;
        },
        {
          name: "oracleAccount";
          isMut: false;
          isSigner: false;
        },
        {
          name: "recipient";
          isMut: false;
          isSigner: true;
          docs: ["Only the token recipient can start unlock"];
        },
        {
          name: "eventAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "program";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: "completeUnlock";
      accounts: [
        {
          name: "performancePackage";
          isMut: true;
          isSigner: false;
        },
        {
          name: "oracleAccount";
          isMut: false;
          isSigner: false;
        },
        {
          name: "performancePackageTokenVault";
          isMut: true;
          isSigner: false;
          docs: ["The token account where locked tokens are stored"];
        },
        {
          name: "tokenMint";
          isMut: false;
          isSigner: false;
          docs: ["The token mint - validated via has_one constraint on locker"];
        },
        {
          name: "recipientTokenAccount";
          isMut: true;
          isSigner: false;
          docs: [
            "The recipient's ATA where tokens will be sent - created if needed",
          ];
        },
        {
          name: "tokenRecipient";
          isMut: false;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
          docs: ["Payer for creating the ATA if needed"];
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "associatedTokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "eventAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "program";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: "proposeChange";
      accounts: [
        {
          name: "changeRequest";
          isMut: true;
          isSigner: false;
        },
        {
          name: "performancePackage";
          isMut: true;
          isSigner: false;
        },
        {
          name: "proposer";
          isMut: false;
          isSigner: true;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "eventAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "program";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: "params";
          type: {
            defined: "ProposeChangeParams";
          };
        },
      ];
    },
    {
      name: "executeChange";
      accounts: [
        {
          name: "changeRequest";
          isMut: true;
          isSigner: false;
        },
        {
          name: "performancePackage";
          isMut: true;
          isSigner: false;
        },
        {
          name: "executor";
          isMut: true;
          isSigner: true;
          docs: [
            "The party executing the change (must be opposite of proposer)",
          ];
        },
      ];
      args: [];
    },
    {
      name: "changePerformancePackageAuthority";
      accounts: [
        {
          name: "performancePackage";
          isMut: true;
          isSigner: false;
        },
        {
          name: "currentAuthority";
          isMut: false;
          isSigner: true;
        },
      ];
      args: [
        {
          name: "params";
          type: {
            defined: "ChangePerformancePackageAuthorityParams";
          };
        },
      ];
    },
    {
      name: "burnPerformancePackage";
      accounts: [
        {
          name: "performancePackage";
          isMut: true;
          isSigner: false;
        },
        {
          name: "performancePackageTokenVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "admin";
          isMut: true;
          isSigner: true;
        },
        {
          name: "spillAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "eventAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "program";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
  ];
  accounts: [
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
                defined: "StoredTranche";
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
              defined: "OracleConfig";
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
            type: "publicKey";
          },
          {
            name: "state";
            docs: ["The current state of the locker"];
            type: {
              defined: "PerformancePackageState";
            };
          },
          {
            name: "createKey";
            docs: ["Used to derive the PDA"];
            type: "publicKey";
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
            type: "publicKey";
          },
          {
            name: "tokenMint";
            docs: ["The mint of the locked tokens"];
            type: "publicKey";
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
            type: "publicKey";
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
            type: "publicKey";
          },
          {
            name: "changeType";
            docs: ["What is being changed"];
            type: {
              defined: "ChangeType";
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
              defined: "ProposerType";
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
  ];
  types: [
    {
      name: "CommonFields";
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
      name: "ChangePerformancePackageAuthorityParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "newPerformancePackageAuthority";
            type: "publicKey";
          },
        ];
      };
    },
    {
      name: "InitializePerformancePackageParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "tranches";
            type: {
              vec: {
                defined: "Tranche";
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
              defined: "OracleConfig";
            };
          },
          {
            name: "twapLengthSeconds";
            type: "u32";
          },
          {
            name: "grantee";
            type: "publicKey";
          },
          {
            name: "performancePackageAuthority";
            type: "publicKey";
          },
        ];
      };
    },
    {
      name: "ProposeChangeParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "changeType";
            type: {
              defined: "ChangeType";
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
      name: "OracleConfig";
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
            type: "publicKey";
          },
          {
            name: "byteOffset";
            type: "u32";
          },
        ];
      };
    },
    {
      name: "Tranche";
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
      name: "StoredTranche";
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
      name: "PerformancePackageState";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Locked";
          },
          {
            name: "Unlocking";
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
      name: "ChangeType";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Oracle";
            fields: [
              {
                name: "newOracleConfig";
                type: {
                  defined: "OracleConfig";
                };
              },
            ];
          },
          {
            name: "Recipient";
            fields: [
              {
                name: "newRecipient";
                type: "publicKey";
              },
            ];
          },
        ];
      };
    },
    {
      name: "ProposerType";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Recipient";
          },
          {
            name: "Authority";
          },
        ];
      };
    },
  ];
  events: [
    {
      name: "PerformancePackageInitialized";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "performancePackage";
          type: "publicKey";
          index: false;
        },
      ];
    },
    {
      name: "UnlockStarted";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "performancePackage";
          type: "publicKey";
          index: false;
        },
        {
          name: "startAggregator";
          type: "u128";
          index: false;
        },
        {
          name: "startTimestamp";
          type: "i64";
          index: false;
        },
      ];
    },
    {
      name: "UnlockCompleted";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "performancePackage";
          type: "publicKey";
          index: false;
        },
        {
          name: "tokenAmount";
          type: "u64";
          index: false;
        },
        {
          name: "recipient";
          type: "publicKey";
          index: false;
        },
        {
          name: "twapPrice";
          type: "u128";
          index: false;
        },
      ];
    },
    {
      name: "ChangeProposed";
      fields: [
        {
          name: "locker";
          type: "publicKey";
          index: false;
        },
        {
          name: "changeRequest";
          type: "publicKey";
          index: false;
        },
        {
          name: "proposer";
          type: "publicKey";
          index: false;
        },
        {
          name: "changeType";
          type: {
            defined: "ChangeType";
          };
          index: false;
        },
      ];
    },
    {
      name: "ChangeExecuted";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "performancePackage";
          type: "publicKey";
          index: false;
        },
        {
          name: "changeRequest";
          type: "publicKey";
          index: false;
        },
        {
          name: "executor";
          type: "publicKey";
          index: false;
        },
        {
          name: "changeType";
          type: {
            defined: "ChangeType";
          };
          index: false;
        },
      ];
    },
    {
      name: "PerformancePackageAuthorityChanged";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "locker";
          type: "publicKey";
          index: false;
        },
        {
          name: "oldAuthority";
          type: "publicKey";
          index: false;
        },
        {
          name: "newAuthority";
          type: "publicKey";
          index: false;
        },
      ];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "UnlockTimestampNotReached";
      msg: "Unlock timestamp has not been reached yet";
    },
    {
      code: 6001;
      name: "UnlockTimestampInThePast";
      msg: "Unlock timestamp must be in the future";
    },
    {
      code: 6002;
      name: "InvalidPerformancePackageState";
      msg: "Performance package is not in the expected state";
    },
    {
      code: 6003;
      name: "TwapPeriodNotElapsed";
      msg: "TWAP calculation failed";
    },
    {
      code: 6004;
      name: "PriceThresholdNotMet";
      msg: "Price threshold not met";
    },
    {
      code: 6005;
      name: "InvalidOracleData";
      msg: "Invalid oracle account data";
    },
    {
      code: 6006;
      name: "UnauthorizedChangeRequest";
      msg: "Unauthorized to create or execute change request";
    },
    {
      code: 6007;
      name: "InvalidChangeRequest";
      msg: "Change request does not match locker";
    },
    {
      code: 6008;
      name: "UnauthorizedLockerAuthority";
      msg: "Unauthorized locker authority";
    },
    {
      code: 6009;
      name: "InvariantViolated";
      msg: "An invariant was violated. You should get in contact with the MetaDAO team if you see this";
    },
    {
      code: 6010;
      name: "TranchePriceThresholdsNotMonotonic";
      msg: "Tranche price thresholds must be monotonically increasing";
    },
    {
      code: 6011;
      name: "TrancheTokenAmountZero";
      msg: "Tranche token amount must be greater than 0";
    },
    {
      code: 6012;
      name: "InvalidTwapLength";
      msg: "TWAP length must be greater than or equal to 1 day and less than 1 year";
    },
    {
      code: 6013;
      name: "InvalidAdmin";
      msg: "Invalid admin";
    },
  ];
};

export const IDL: PriceBasedPerformancePackage = {
  version: "0.6.0",
  name: "price_based_performance_package",
  constants: [
    {
      name: "MAX_TRANCHES",
      type: {
        defined: "usize",
      },
      value: "10",
    },
  ],
  instructions: [
    {
      name: "initializePerformancePackage",
      accounts: [
        {
          name: "performancePackage",
          isMut: true,
          isSigner: false,
        },
        {
          name: "createKey",
          isMut: false,
          isSigner: true,
          docs: ["Used to derive the PDA"],
        },
        {
          name: "tokenMint",
          isMut: false,
          isSigner: false,
          docs: ["The mint of the tokens to be locked"],
        },
        {
          name: "grantorTokenAccount",
          isMut: true,
          isSigner: false,
          docs: ["The token account containing the tokens to be locked"],
        },
        {
          name: "grantor",
          isMut: false,
          isSigner: true,
          docs: ["The authority of the token account"],
        },
        {
          name: "performancePackageTokenVault",
          isMut: true,
          isSigner: false,
          docs: ["The locker's token account where tokens will be stored"],
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "associatedTokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "eventAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "program",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "InitializePerformancePackageParams",
          },
        },
      ],
    },
    {
      name: "startUnlock",
      accounts: [
        {
          name: "performancePackage",
          isMut: true,
          isSigner: false,
        },
        {
          name: "oracleAccount",
          isMut: false,
          isSigner: false,
        },
        {
          name: "recipient",
          isMut: false,
          isSigner: true,
          docs: ["Only the token recipient can start unlock"],
        },
        {
          name: "eventAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "program",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "completeUnlock",
      accounts: [
        {
          name: "performancePackage",
          isMut: true,
          isSigner: false,
        },
        {
          name: "oracleAccount",
          isMut: false,
          isSigner: false,
        },
        {
          name: "performancePackageTokenVault",
          isMut: true,
          isSigner: false,
          docs: ["The token account where locked tokens are stored"],
        },
        {
          name: "tokenMint",
          isMut: false,
          isSigner: false,
          docs: ["The token mint - validated via has_one constraint on locker"],
        },
        {
          name: "recipientTokenAccount",
          isMut: true,
          isSigner: false,
          docs: [
            "The recipient's ATA where tokens will be sent - created if needed",
          ],
        },
        {
          name: "tokenRecipient",
          isMut: false,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
          docs: ["Payer for creating the ATA if needed"],
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "associatedTokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "eventAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "program",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "proposeChange",
      accounts: [
        {
          name: "changeRequest",
          isMut: true,
          isSigner: false,
        },
        {
          name: "performancePackage",
          isMut: true,
          isSigner: false,
        },
        {
          name: "proposer",
          isMut: false,
          isSigner: true,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "eventAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "program",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "ProposeChangeParams",
          },
        },
      ],
    },
    {
      name: "executeChange",
      accounts: [
        {
          name: "changeRequest",
          isMut: true,
          isSigner: false,
        },
        {
          name: "performancePackage",
          isMut: true,
          isSigner: false,
        },
        {
          name: "executor",
          isMut: true,
          isSigner: true,
          docs: [
            "The party executing the change (must be opposite of proposer)",
          ],
        },
      ],
      args: [],
    },
    {
      name: "changePerformancePackageAuthority",
      accounts: [
        {
          name: "performancePackage",
          isMut: true,
          isSigner: false,
        },
        {
          name: "currentAuthority",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "ChangePerformancePackageAuthorityParams",
          },
        },
      ],
    },
    {
      name: "burnPerformancePackage",
      accounts: [
        {
          name: "performancePackage",
          isMut: true,
          isSigner: false,
        },
        {
          name: "performancePackageTokenVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "admin",
          isMut: true,
          isSigner: true,
        },
        {
          name: "spillAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "eventAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "program",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "performancePackage",
      type: {
        kind: "struct",
        fields: [
          {
            name: "tranches",
            docs: ["The tranches that make up the performance package"],
            type: {
              vec: {
                defined: "StoredTranche",
              },
            },
          },
          {
            name: "totalTokenAmount",
            docs: ["Total amount of tokens in the performance package"],
            type: "u64",
          },
          {
            name: "alreadyUnlockedAmount",
            docs: ["Amount of tokens already unlocked"],
            type: "u64",
          },
          {
            name: "minUnlockTimestamp",
            docs: ["The timestamp when unlocking can begin"],
            type: "i64",
          },
          {
            name: "oracleConfig",
            docs: ["Where to pull price data from"],
            type: {
              defined: "OracleConfig",
            },
          },
          {
            name: "twapLengthSeconds",
            docs: [
              "Length of time in seconds for TWAP calculation, between 1 day and 1 year",
            ],
            type: "u32",
          },
          {
            name: "recipient",
            docs: ["The recipient of the tokens when unlocked"],
            type: "publicKey",
          },
          {
            name: "state",
            docs: ["The current state of the locker"],
            type: {
              defined: "PerformancePackageState",
            },
          },
          {
            name: "createKey",
            docs: ["Used to derive the PDA"],
            type: "publicKey",
          },
          {
            name: "pdaBump",
            docs: ["The PDA bump"],
            type: "u8",
          },
          {
            name: "performancePackageAuthority",
            docs: [
              "The authorized locker authority that can execute changes, usually the organization",
            ],
            type: "publicKey",
          },
          {
            name: "tokenMint",
            docs: ["The mint of the locked tokens"],
            type: "publicKey",
          },
          {
            name: "seqNum",
            docs: [
              "The sequence number of the performance package, used for indexing events",
            ],
            type: "u64",
          },
          {
            name: "performancePackageTokenVault",
            docs: ["The vault that stores the tokens"],
            type: "publicKey",
          },
        ],
      },
    },
    {
      name: "changeRequest",
      type: {
        kind: "struct",
        fields: [
          {
            name: "performancePackage",
            docs: ["The performance package this change applies to"],
            type: "publicKey",
          },
          {
            name: "changeType",
            docs: ["What is being changed"],
            type: {
              defined: "ChangeType",
            },
          },
          {
            name: "proposedAt",
            docs: ["When the change was proposed"],
            type: "i64",
          },
          {
            name: "proposerType",
            docs: [
              "Who proposed this change (either token_recipient or locker_authority)",
            ],
            type: {
              defined: "ProposerType",
            },
          },
          {
            name: "pdaNonce",
            docs: ["Used to derive the PDA along with the proposer"],
            type: "u32",
          },
          {
            name: "pdaBump",
            docs: ["The PDA bump"],
            type: "u8",
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "CommonFields",
      type: {
        kind: "struct",
        fields: [
          {
            name: "slot",
            type: "u64",
          },
          {
            name: "unixTimestamp",
            type: "i64",
          },
          {
            name: "performancePackageSeqNum",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "ChangePerformancePackageAuthorityParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "newPerformancePackageAuthority",
            type: "publicKey",
          },
        ],
      },
    },
    {
      name: "InitializePerformancePackageParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "tranches",
            type: {
              vec: {
                defined: "Tranche",
              },
            },
          },
          {
            name: "minUnlockTimestamp",
            type: "i64",
          },
          {
            name: "oracleConfig",
            type: {
              defined: "OracleConfig",
            },
          },
          {
            name: "twapLengthSeconds",
            type: "u32",
          },
          {
            name: "grantee",
            type: "publicKey",
          },
          {
            name: "performancePackageAuthority",
            type: "publicKey",
          },
        ],
      },
    },
    {
      name: "ProposeChangeParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "changeType",
            type: {
              defined: "ChangeType",
            },
          },
          {
            name: "pdaNonce",
            type: "u32",
          },
        ],
      },
    },
    {
      name: "OracleConfig",
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
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "oracleAccount",
            type: "publicKey",
          },
          {
            name: "byteOffset",
            type: "u32",
          },
        ],
      },
    },
    {
      name: "Tranche",
      type: {
        kind: "struct",
        fields: [
          {
            name: "priceThreshold",
            docs: ["The price at which this tranch unlocks"],
            type: "u128",
          },
          {
            name: "tokenAmount",
            docs: ["The amount of tokens in this tranch"],
            type: "u64",
          },
        ],
      },
    },
    {
      name: "StoredTranche",
      type: {
        kind: "struct",
        fields: [
          {
            name: "priceThreshold",
            type: "u128",
          },
          {
            name: "tokenAmount",
            type: "u64",
          },
          {
            name: "isUnlocked",
            type: "bool",
          },
        ],
      },
    },
    {
      name: "PerformancePackageState",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Locked",
          },
          {
            name: "Unlocking",
            fields: [
              {
                name: "startAggregator",
                docs: ["The aggregator value when unlocking started"],
                type: "u128",
              },
              {
                name: "startTimestamp",
                docs: ["The timestamp when unlocking started"],
                type: "i64",
              },
            ],
          },
        ],
      },
    },
    {
      name: "ChangeType",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Oracle",
            fields: [
              {
                name: "newOracleConfig",
                type: {
                  defined: "OracleConfig",
                },
              },
            ],
          },
          {
            name: "Recipient",
            fields: [
              {
                name: "newRecipient",
                type: "publicKey",
              },
            ],
          },
        ],
      },
    },
    {
      name: "ProposerType",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Recipient",
          },
          {
            name: "Authority",
          },
        ],
      },
    },
  ],
  events: [
    {
      name: "PerformancePackageInitialized",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "performancePackage",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "UnlockStarted",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "performancePackage",
          type: "publicKey",
          index: false,
        },
        {
          name: "startAggregator",
          type: "u128",
          index: false,
        },
        {
          name: "startTimestamp",
          type: "i64",
          index: false,
        },
      ],
    },
    {
      name: "UnlockCompleted",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "performancePackage",
          type: "publicKey",
          index: false,
        },
        {
          name: "tokenAmount",
          type: "u64",
          index: false,
        },
        {
          name: "recipient",
          type: "publicKey",
          index: false,
        },
        {
          name: "twapPrice",
          type: "u128",
          index: false,
        },
      ],
    },
    {
      name: "ChangeProposed",
      fields: [
        {
          name: "locker",
          type: "publicKey",
          index: false,
        },
        {
          name: "changeRequest",
          type: "publicKey",
          index: false,
        },
        {
          name: "proposer",
          type: "publicKey",
          index: false,
        },
        {
          name: "changeType",
          type: {
            defined: "ChangeType",
          },
          index: false,
        },
      ],
    },
    {
      name: "ChangeExecuted",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "performancePackage",
          type: "publicKey",
          index: false,
        },
        {
          name: "changeRequest",
          type: "publicKey",
          index: false,
        },
        {
          name: "executor",
          type: "publicKey",
          index: false,
        },
        {
          name: "changeType",
          type: {
            defined: "ChangeType",
          },
          index: false,
        },
      ],
    },
    {
      name: "PerformancePackageAuthorityChanged",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "locker",
          type: "publicKey",
          index: false,
        },
        {
          name: "oldAuthority",
          type: "publicKey",
          index: false,
        },
        {
          name: "newAuthority",
          type: "publicKey",
          index: false,
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "UnlockTimestampNotReached",
      msg: "Unlock timestamp has not been reached yet",
    },
    {
      code: 6001,
      name: "UnlockTimestampInThePast",
      msg: "Unlock timestamp must be in the future",
    },
    {
      code: 6002,
      name: "InvalidPerformancePackageState",
      msg: "Performance package is not in the expected state",
    },
    {
      code: 6003,
      name: "TwapPeriodNotElapsed",
      msg: "TWAP calculation failed",
    },
    {
      code: 6004,
      name: "PriceThresholdNotMet",
      msg: "Price threshold not met",
    },
    {
      code: 6005,
      name: "InvalidOracleData",
      msg: "Invalid oracle account data",
    },
    {
      code: 6006,
      name: "UnauthorizedChangeRequest",
      msg: "Unauthorized to create or execute change request",
    },
    {
      code: 6007,
      name: "InvalidChangeRequest",
      msg: "Change request does not match locker",
    },
    {
      code: 6008,
      name: "UnauthorizedLockerAuthority",
      msg: "Unauthorized locker authority",
    },
    {
      code: 6009,
      name: "InvariantViolated",
      msg: "An invariant was violated. You should get in contact with the MetaDAO team if you see this",
    },
    {
      code: 6010,
      name: "TranchePriceThresholdsNotMonotonic",
      msg: "Tranche price thresholds must be monotonically increasing",
    },
    {
      code: 6011,
      name: "TrancheTokenAmountZero",
      msg: "Tranche token amount must be greater than 0",
    },
    {
      code: 6012,
      name: "InvalidTwapLength",
      msg: "TWAP length must be greater than or equal to 1 day and less than 1 year",
    },
    {
      code: 6013,
      name: "InvalidAdmin",
      msg: "Invalid admin",
    },
  ],
};
