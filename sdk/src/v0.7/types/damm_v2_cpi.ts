export type DammV2Cpi = {
  version: "0.1.0";
  name: "damm_v2_cpi";
  instructions: [
    {
      name: "initializePoolWithDynamicConfig";
      accounts: [
        {
          name: "creator";
          isMut: false;
          isSigner: false;
        },
        {
          name: "positionNftMint";
          isMut: true;
          isSigner: true;
        },
        {
          name: "positionNftAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
          docs: ["Address paying to create the pool. Can be anyone"];
        },
        {
          name: "poolCreatorAuthority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "config";
          isMut: false;
          isSigner: false;
        },
        {
          name: "poolAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "pool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "position";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenAMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenBMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenAVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenBVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payerTokenA";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payerTokenB";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenAProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenBProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "token2022Program";
          isMut: false;
          isSigner: false;
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
            defined: "InitializeCustomizablePoolParameters";
          };
        },
      ];
    },
  ];
  types: [
    {
      name: "PoolFeeParameters";
      docs: ["Information regarding fee charges"];
      type: {
        kind: "struct";
        fields: [
          {
            name: "baseFee";
            docs: ["Base fee"];
            type: {
              defined: "BaseFeeParameters";
            };
          },
          {
            name: "padding";
            docs: ["padding"];
            type: {
              array: ["u8", 3];
            };
          },
          {
            name: "dynamicFee";
            docs: ["dynamic fee"];
            type: {
              option: {
                defined: "DynamicFeeParameters";
              };
            };
          },
        ];
      };
    },
    {
      name: "BaseFeeParameters";
      type: {
        kind: "struct";
        fields: [
          {
            name: "cliffFeeNumerator";
            type: "u64";
          },
          {
            name: "numberOfPeriod";
            type: "u16";
          },
          {
            name: "periodFrequency";
            type: "u64";
          },
          {
            name: "reductionFactor";
            type: "u64";
          },
          {
            name: "feeSchedulerMode";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "DynamicFeeParameters";
      type: {
        kind: "struct";
        fields: [
          {
            name: "binStep";
            type: "u16";
          },
          {
            name: "binStepU128";
            type: "u128";
          },
          {
            name: "filterPeriod";
            type: "u16";
          },
          {
            name: "decayPeriod";
            type: "u16";
          },
          {
            name: "reductionFactor";
            type: "u16";
          },
          {
            name: "maxVolatilityAccumulator";
            type: "u32";
          },
          {
            name: "variableFeeControl";
            type: "u32";
          },
        ];
      };
    },
    {
      name: "InitializeCustomizablePoolParameters";
      type: {
        kind: "struct";
        fields: [
          {
            name: "poolFees";
            docs: ["pool fees"];
            type: {
              defined: "PoolFeeParameters";
            };
          },
          {
            name: "sqrtMinPrice";
            docs: ["sqrt min price"];
            type: "u128";
          },
          {
            name: "sqrtMaxPrice";
            docs: ["sqrt max price"];
            type: "u128";
          },
          {
            name: "hasAlphaVault";
            docs: ["has alpha vault"];
            type: "bool";
          },
          {
            name: "liquidity";
            docs: ["initialize liquidity"];
            type: "u128";
          },
          {
            name: "sqrtPrice";
            docs: [
              "The init price of the pool as a sqrt(token_b/token_a) Q64.64 value",
            ];
            type: "u128";
          },
          {
            name: "activationType";
            docs: ["activation type"];
            type: "u8";
          },
          {
            name: "collectFeeMode";
            docs: ["collect fee mode"];
            type: "u8";
          },
          {
            name: "activationPoint";
            docs: ["activation point"];
            type: {
              option: "u64";
            };
          },
        ];
      };
    },
  ];
};

export const IDL: DammV2Cpi = {
  version: "0.1.0",
  name: "damm_v2_cpi",
  instructions: [
    {
      name: "initializePoolWithDynamicConfig",
      accounts: [
        {
          name: "creator",
          isMut: false,
          isSigner: false,
        },
        {
          name: "positionNftMint",
          isMut: true,
          isSigner: true,
        },
        {
          name: "positionNftAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
          docs: ["Address paying to create the pool. Can be anyone"],
        },
        {
          name: "poolCreatorAuthority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "config",
          isMut: false,
          isSigner: false,
        },
        {
          name: "poolAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "pool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "position",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenAMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenBMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenAVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenBVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payerTokenA",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payerTokenB",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenAProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenBProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "token2022Program",
          isMut: false,
          isSigner: false,
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
            defined: "InitializeCustomizablePoolParameters",
          },
        },
      ],
    },
  ],
  types: [
    {
      name: "PoolFeeParameters",
      docs: ["Information regarding fee charges"],
      type: {
        kind: "struct",
        fields: [
          {
            name: "baseFee",
            docs: ["Base fee"],
            type: {
              defined: "BaseFeeParameters",
            },
          },
          {
            name: "padding",
            docs: ["padding"],
            type: {
              array: ["u8", 3],
            },
          },
          {
            name: "dynamicFee",
            docs: ["dynamic fee"],
            type: {
              option: {
                defined: "DynamicFeeParameters",
              },
            },
          },
        ],
      },
    },
    {
      name: "BaseFeeParameters",
      type: {
        kind: "struct",
        fields: [
          {
            name: "cliffFeeNumerator",
            type: "u64",
          },
          {
            name: "numberOfPeriod",
            type: "u16",
          },
          {
            name: "periodFrequency",
            type: "u64",
          },
          {
            name: "reductionFactor",
            type: "u64",
          },
          {
            name: "feeSchedulerMode",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "DynamicFeeParameters",
      type: {
        kind: "struct",
        fields: [
          {
            name: "binStep",
            type: "u16",
          },
          {
            name: "binStepU128",
            type: "u128",
          },
          {
            name: "filterPeriod",
            type: "u16",
          },
          {
            name: "decayPeriod",
            type: "u16",
          },
          {
            name: "reductionFactor",
            type: "u16",
          },
          {
            name: "maxVolatilityAccumulator",
            type: "u32",
          },
          {
            name: "variableFeeControl",
            type: "u32",
          },
        ],
      },
    },
    {
      name: "InitializeCustomizablePoolParameters",
      type: {
        kind: "struct",
        fields: [
          {
            name: "poolFees",
            docs: ["pool fees"],
            type: {
              defined: "PoolFeeParameters",
            },
          },
          {
            name: "sqrtMinPrice",
            docs: ["sqrt min price"],
            type: "u128",
          },
          {
            name: "sqrtMaxPrice",
            docs: ["sqrt max price"],
            type: "u128",
          },
          {
            name: "hasAlphaVault",
            docs: ["has alpha vault"],
            type: "bool",
          },
          {
            name: "liquidity",
            docs: ["initialize liquidity"],
            type: "u128",
          },
          {
            name: "sqrtPrice",
            docs: [
              "The init price of the pool as a sqrt(token_b/token_a) Q64.64 value",
            ],
            type: "u128",
          },
          {
            name: "activationType",
            docs: ["activation type"],
            type: "u8",
          },
          {
            name: "collectFeeMode",
            docs: ["collect fee mode"],
            type: "u8",
          },
          {
            name: "activationPoint",
            docs: ["activation point"],
            type: {
              option: "u64",
            },
          },
        ],
      },
    },
  ],
};
