export type PriceBasedTokenLock = {
  version: "0.1.0";
  name: "price_based_token_lock";
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
          name: "recipientTokenAccount";
          isMut: false;
          isSigner: false;
          docs: [
            "The recipient's token account where tokens will be sent when unlocked",
          ];
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
          name: "recipientTokenAccount";
          isMut: true;
          isSigner: false;
          docs: ["The recipient's token account where tokens will be sent"];
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
      name: "locker";
      type: {
        kind: "struct";
        fields: [
          {
            name: "priceThreshold";
            docs: [
              "The price threshold that must be met for tokens to be unlocked",
            ];
            type: "u128";
          },
          {
            name: "tokenAmount";
            docs: ["The amount of tokens locked"];
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
        ];
      };
    },
  ];
  types: [
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
            name: "tokenRecipient";
            type: "publicKey";
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
  ];
  errors: [
    {
      code: 6000;
      name: "UnlockTimestampNotReached";
      msg: "Unlock timestamp has not been reached yet";
    },
    {
      code: 6001;
      name: "InvalidLockerState";
      msg: "Locker is not in the expected state";
    },
    {
      code: 6002;
      name: "TwapCalculationFailed";
      msg: "TWAP calculation failed";
    },
    {
      code: 6003;
      name: "PriceThresholdNotMet";
      msg: "Price threshold not met";
    },
    {
      code: 6004;
      name: "InvalidOracleData";
      msg: "Invalid oracle account data";
    },
  ];
};

export const IDL: PriceBasedTokenLock = {
  version: "0.1.0",
  name: "price_based_token_lock",
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
          name: "recipientTokenAccount",
          isMut: false,
          isSigner: false,
          docs: [
            "The recipient's token account where tokens will be sent when unlocked",
          ],
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
          name: "recipientTokenAccount",
          isMut: true,
          isSigner: false,
          docs: ["The recipient's token account where tokens will be sent"],
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
      name: "locker",
      type: {
        kind: "struct",
        fields: [
          {
            name: "priceThreshold",
            docs: [
              "The price threshold that must be met for tokens to be unlocked",
            ],
            type: "u128",
          },
          {
            name: "tokenAmount",
            docs: ["The amount of tokens locked"],
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
        ],
      },
    },
  ],
  types: [
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
            name: "tokenRecipient",
            type: "publicKey",
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
  ],
  errors: [
    {
      code: 6000,
      name: "UnlockTimestampNotReached",
      msg: "Unlock timestamp has not been reached yet",
    },
    {
      code: 6001,
      name: "InvalidLockerState",
      msg: "Locker is not in the expected state",
    },
    {
      code: 6002,
      name: "TwapCalculationFailed",
      msg: "TWAP calculation failed",
    },
    {
      code: 6003,
      name: "PriceThresholdNotMet",
      msg: "Price threshold not met",
    },
    {
      code: 6004,
      name: "InvalidOracleData",
      msg: "Invalid oracle account data",
    },
  ],
};
