export type PriceBasedUnlock = {
  version: "0.1.0";
  name: "price_based_unlock";
  constants: [
    {
      name: "SEED";
      type: "string";
      value: '"anchor"';
    },
  ];
  instructions: [
    {
      name: "initializeLocker";
      accounts: [
        {
          name: "locker";
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
          name: "fromTokenAccount";
          isMut: true;
          isSigner: false;
          docs: ["The token account containing the tokens to be locked"];
        },
        {
          name: "tokenAuthority";
          isMut: false;
          isSigner: true;
          docs: ["The authority of the token account"];
        },
        {
          name: "lockerTokenAccount";
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
            defined: "InitializeLockerParams";
          };
        },
      ];
    },
    {
      name: "startUnlock";
      accounts: [
        {
          name: "locker";
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
          name: "locker";
          isMut: true;
          isSigner: false;
        },
        {
          name: "oracleAccount";
          isMut: false;
          isSigner: false;
        },
        {
          name: "lockerTokenAccount";
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
          name: "locker";
          isMut: true;
          isSigner: false;
        },
        {
          name: "proposer";
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
          name: "locker";
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
      name: "changeLockerAuthority";
      accounts: [
        {
          name: "locker";
          isMut: true;
          isSigner: false;
        },
        {
          name: "currentAuthority";
          isMut: false;
          isSigner: true;
          docs: [
            "Only the current locker authority can change the locker authority",
          ];
        },
      ];
      args: [
        {
          name: "params";
          type: {
            defined: "ChangeLockerAuthorityParams";
          };
        },
      ];
    },
  ];
  accounts: [
    {
      name: "locker";
      type: {
        kind: "struct";
        fields: [
          {
            name: "priceThreshold";
            docs: ["The price threshold for 100% unlocking (max price target)"];
            type: "u128";
          },
          {
            name: "tokenAmount";
            docs: ["The amount of tokens locked"];
            type: "u64";
          },
          {
            name: "tokensAlreadyUnlocked";
            docs: ["The amount of tokens already unlocked"];
            type: "u64";
          },
          {
            name: "unlockTimestamp";
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
            docs: ["Length of time in seconds for TWAP calculation"];
            type: "u64";
          },
          {
            name: "tokenRecipient";
            docs: ["The recipient of the tokens when unlocked"];
            type: "publicKey";
          },
          {
            name: "state";
            docs: ["The current state of the locker"];
            type: {
              defined: "LockerState";
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
            name: "lockerAuthority";
            docs: ["The authorized locker authority that can execute changes"];
            type: "publicKey";
          },
          {
            name: "tokenMint";
            docs: ["The mint of the locked tokens"];
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
            name: "locker";
            docs: ["The locker this change applies to"];
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
            name: "previousState";
            docs: ["The locker state before the change was proposed"];
            type: {
              defined: "LockerState";
            };
          },
          {
            name: "proposer";
            docs: [
              "Who proposed this change (either token_recipient or locker_authority)",
            ];
            type: "publicKey";
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
      name: "ChangeLockerAuthorityParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "newLockerAuthority";
            type: "publicKey";
          },
        ];
      };
    },
    {
      name: "InitializeLockerParams";
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
            name: "unlockTimestamp";
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
            type: "u64";
          },
          {
            name: "beneficiary";
            type: "publicKey";
          },
          {
            name: "lockerAuthority";
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
      name: "LockerState";
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
          {
            name: "Unlocked";
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
  ];
  events: [
    {
      name: "LockerInitialized";
      fields: [
        {
          name: "locker";
          type: "publicKey";
          index: false;
        },
        {
          name: "priceThreshold";
          type: "u128";
          index: false;
        },
        {
          name: "tokenAmount";
          type: "u64";
          index: false;
        },
        {
          name: "unlockTimestamp";
          type: "i64";
          index: false;
        },
        {
          name: "oracleConfig";
          type: {
            defined: "OracleConfig";
          };
          index: false;
        },
        {
          name: "tokenRecipient";
          type: "publicKey";
          index: false;
        },
      ];
    },
    {
      name: "UnlockStarted";
      fields: [
        {
          name: "locker";
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
          name: "locker";
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
        {
          name: "priceThreshold";
          type: "u128";
          index: false;
        },
      ];
    },
    {
      name: "TokensClaimed";
      fields: [
        {
          name: "locker";
          type: "publicKey";
          index: false;
        },
        {
          name: "recipient";
          type: "publicKey";
          index: false;
        },
        {
          name: "tokensClaimed";
          type: "u64";
          index: false;
        },
        {
          name: "tokensAlreadyUnlocked";
          type: "u64";
          index: false;
        },
        {
          name: "totalTokenAmount";
          type: "u64";
          index: false;
        },
        {
          name: "currentPrice";
          type: "u128";
          index: false;
        },
        {
          name: "unlockPercentage";
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
        {
          name: "proposedAt";
          type: "i64";
          index: false;
        },
      ];
    },
    {
      name: "ChangeExecuted";
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
        {
          name: "executedAt";
          type: "i64";
          index: false;
        },
      ];
    },
    {
      name: "LockerAuthorityChanged";
      fields: [
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
        {
          name: "changedAt";
          type: "i64";
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
      name: "InvalidLockerState";
      msg: "Locker is not in the expected state";
    },
    {
      code: 6003;
      name: "TwapCalculationFailed";
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
  ];
};

export const IDL: PriceBasedUnlock = {
  version: "0.1.0",
  name: "price_based_unlock",
  constants: [
    {
      name: "SEED",
      type: "string",
      value: '"anchor"',
    },
  ],
  instructions: [
    {
      name: "initializeLocker",
      accounts: [
        {
          name: "locker",
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
          name: "fromTokenAccount",
          isMut: true,
          isSigner: false,
          docs: ["The token account containing the tokens to be locked"],
        },
        {
          name: "tokenAuthority",
          isMut: false,
          isSigner: true,
          docs: ["The authority of the token account"],
        },
        {
          name: "lockerTokenAccount",
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
            defined: "InitializeLockerParams",
          },
        },
      ],
    },
    {
      name: "startUnlock",
      accounts: [
        {
          name: "locker",
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
          name: "locker",
          isMut: true,
          isSigner: false,
        },
        {
          name: "oracleAccount",
          isMut: false,
          isSigner: false,
        },
        {
          name: "lockerTokenAccount",
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
          name: "locker",
          isMut: true,
          isSigner: false,
        },
        {
          name: "proposer",
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
          name: "locker",
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
      name: "changeLockerAuthority",
      accounts: [
        {
          name: "locker",
          isMut: true,
          isSigner: false,
        },
        {
          name: "currentAuthority",
          isMut: false,
          isSigner: true,
          docs: [
            "Only the current locker authority can change the locker authority",
          ],
        },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "ChangeLockerAuthorityParams",
          },
        },
      ],
    },
  ],
  accounts: [
    {
      name: "locker",
      type: {
        kind: "struct",
        fields: [
          {
            name: "priceThreshold",
            docs: ["The price threshold for 100% unlocking (max price target)"],
            type: "u128",
          },
          {
            name: "tokenAmount",
            docs: ["The amount of tokens locked"],
            type: "u64",
          },
          {
            name: "tokensAlreadyUnlocked",
            docs: ["The amount of tokens already unlocked"],
            type: "u64",
          },
          {
            name: "unlockTimestamp",
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
            docs: ["Length of time in seconds for TWAP calculation"],
            type: "u64",
          },
          {
            name: "tokenRecipient",
            docs: ["The recipient of the tokens when unlocked"],
            type: "publicKey",
          },
          {
            name: "state",
            docs: ["The current state of the locker"],
            type: {
              defined: "LockerState",
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
            name: "lockerAuthority",
            docs: ["The authorized locker authority that can execute changes"],
            type: "publicKey",
          },
          {
            name: "tokenMint",
            docs: ["The mint of the locked tokens"],
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
            name: "locker",
            docs: ["The locker this change applies to"],
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
            name: "previousState",
            docs: ["The locker state before the change was proposed"],
            type: {
              defined: "LockerState",
            },
          },
          {
            name: "proposer",
            docs: [
              "Who proposed this change (either token_recipient or locker_authority)",
            ],
            type: "publicKey",
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
      name: "ChangeLockerAuthorityParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "newLockerAuthority",
            type: "publicKey",
          },
        ],
      },
    },
    {
      name: "InitializeLockerParams",
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
            name: "unlockTimestamp",
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
            type: "u64",
          },
          {
            name: "beneficiary",
            type: "publicKey",
          },
          {
            name: "lockerAuthority",
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
      name: "LockerState",
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
          {
            name: "Unlocked",
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
  ],
  events: [
    {
      name: "LockerInitialized",
      fields: [
        {
          name: "locker",
          type: "publicKey",
          index: false,
        },
        {
          name: "priceThreshold",
          type: "u128",
          index: false,
        },
        {
          name: "tokenAmount",
          type: "u64",
          index: false,
        },
        {
          name: "unlockTimestamp",
          type: "i64",
          index: false,
        },
        {
          name: "oracleConfig",
          type: {
            defined: "OracleConfig",
          },
          index: false,
        },
        {
          name: "tokenRecipient",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "UnlockStarted",
      fields: [
        {
          name: "locker",
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
          name: "locker",
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
        {
          name: "priceThreshold",
          type: "u128",
          index: false,
        },
      ],
    },
    {
      name: "TokensClaimed",
      fields: [
        {
          name: "locker",
          type: "publicKey",
          index: false,
        },
        {
          name: "recipient",
          type: "publicKey",
          index: false,
        },
        {
          name: "tokensClaimed",
          type: "u64",
          index: false,
        },
        {
          name: "tokensAlreadyUnlocked",
          type: "u64",
          index: false,
        },
        {
          name: "totalTokenAmount",
          type: "u64",
          index: false,
        },
        {
          name: "currentPrice",
          type: "u128",
          index: false,
        },
        {
          name: "unlockPercentage",
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
        {
          name: "proposedAt",
          type: "i64",
          index: false,
        },
      ],
    },
    {
      name: "ChangeExecuted",
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
        {
          name: "executedAt",
          type: "i64",
          index: false,
        },
      ],
    },
    {
      name: "LockerAuthorityChanged",
      fields: [
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
        {
          name: "changedAt",
          type: "i64",
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
      name: "InvalidLockerState",
      msg: "Locker is not in the expected state",
    },
    {
      code: 6003,
      name: "TwapCalculationFailed",
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
  ],
};
