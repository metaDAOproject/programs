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
          name: "tokenAccount";
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
          name: "lockerAuthority";
          isMut: false;
          isSigner: false;
          docs: ["The authority of the locker"];
        },
        {
          name: "oracleAccount";
          isMut: false;
          isSigner: false;
          docs: ["The oracle account that provides price data"];
        },
        {
          name: "clock";
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
          name: "lockerAuthority";
          isMut: false;
          isSigner: false;
          docs: ["The authority of the locker"];
        },
        {
          name: "oracleAccount";
          isMut: false;
          isSigner: false;
          docs: ["The oracle account that provides price data"];
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
          name: "clock";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
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
            name: "oracleAccount";
            docs: ["The oracle account that provides price data"];
            type: "publicKey";
          },
          {
            name: "aggregatorByteOffset";
            docs: [
              "Byte offset in the oracle account where the aggregator value is stored",
            ];
            type: "u8";
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
            name: "oracleAccount";
            type: "publicKey";
          },
          {
            name: "aggregatorByteOffset";
            type: "u8";
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
          name: "oracleAccount";
          type: "publicKey";
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
          name: "tokenAccount",
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
          name: "lockerAuthority",
          isMut: false,
          isSigner: false,
          docs: ["The authority of the locker"],
        },
        {
          name: "oracleAccount",
          isMut: false,
          isSigner: false,
          docs: ["The oracle account that provides price data"],
        },
        {
          name: "clock",
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
          name: "lockerAuthority",
          isMut: false,
          isSigner: false,
          docs: ["The authority of the locker"],
        },
        {
          name: "oracleAccount",
          isMut: false,
          isSigner: false,
          docs: ["The oracle account that provides price data"],
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
          name: "clock",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
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
            name: "oracleAccount",
            docs: ["The oracle account that provides price data"],
            type: "publicKey",
          },
          {
            name: "aggregatorByteOffset",
            docs: [
              "Byte offset in the oracle account where the aggregator value is stored",
            ],
            type: "u8",
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
            name: "oracleAccount",
            type: "publicKey",
          },
          {
            name: "aggregatorByteOffset",
            type: "u8",
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
          name: "oracleAccount",
          type: "publicKey",
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
