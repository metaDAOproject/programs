export type BidWall = {
  version: "0.6.0";
  name: "bid_wall";
  instructions: [
    {
      name: "initializeBidWall";
      accounts: [
        {
          name: "bidWall";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "dao";
          isMut: false;
          isSigner: false;
        },
        {
          name: "bidWallUsdcTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authorityUsdcTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "baseMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "quoteMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "pool";
          isMut: false;
          isSigner: false;
        },
        {
          name: "position";
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
          name: "args";
          type: {
            defined: "InitializeBidWallArgs";
          };
        },
      ];
    },
    {
      name: "closeBidWall";
      accounts: [
        {
          name: "bidWall";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "feeRecipient";
          isMut: false;
          isSigner: false;
        },
        {
          name: "bidWallUsdcTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authorityUsdcTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "feeWalletUsdcTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "baseMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "usdcMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
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
      args: [];
    },
    {
      name: "sellTokens";
      accounts: [
        {
          name: "bidWall";
          isMut: true;
          isSigner: false;
        },
        {
          name: "user";
          isMut: true;
          isSigner: true;
        },
        {
          name: "userTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userUsdcTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "bidWallUsdcTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "baseMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "quoteMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "dao";
          isMut: false;
          isSigner: false;
        },
        {
          name: "daoTreasuryUsdcTokenAccount";
          isMut: false;
          isSigner: false;
        },
        {
          name: "pool";
          isMut: false;
          isSigner: false;
        },
        {
          name: "position";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
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
          name: "args";
          type: {
            defined: "SellTokensArgs";
          };
        },
      ];
    },
  ];
  accounts: [
    {
      name: "bidWall";
      type: {
        kind: "struct";
        fields: [
          {
            name: "createdTimestamp";
            docs: ["When the bid wall was created."];
            type: "i64";
          },
          {
            name: "feesCollected";
            docs: ["The fees collected by the bid wall."];
            type: "u64";
          },
          {
            name: "authority";
            docs: ["The authority of the bid wall."];
            type: "publicKey";
          },
          {
            name: "baseMint";
            docs: ["The mint of the token being sold into the bid wall."];
            type: "publicKey";
          },
          {
            name: "dao";
            docs: ["The related DAO."];
            type: "publicKey";
          },
          {
            name: "pool";
            docs: ["The DAO's Meteora DAMMv2 pool"];
            type: "publicKey";
          },
          {
            name: "position";
            docs: ["The DAO's Meteora DAMMv2 position"];
            type: "publicKey";
          },
          {
            name: "minDuration";
            docs: [
              "The minimum duration in seconds before the bid wall can be closed.",
            ];
            type: "u32";
          },
          {
            name: "pdaBump";
            docs: ["The PDA bump."];
            type: "u8";
          },
        ];
      };
    },
  ];
  types: [
    {
      name: "InitializeBidWallArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "minDuration";
            type: "u32";
          },
        ];
      };
    },
    {
      name: "SellTokensArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "amountIn";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "Pool";
      type: {
        kind: "struct";
        fields: [
          {
            name: "poolFees";
            docs: ["Pool fee"];
            type: {
              defined: "PoolFeesStruct";
            };
          },
          {
            name: "tokenAMint";
            docs: ["token a mint"];
            type: "publicKey";
          },
          {
            name: "tokenBMint";
            docs: ["token b mint"];
            type: "publicKey";
          },
          {
            name: "tokenAVault";
            docs: ["token a vault"];
            type: "publicKey";
          },
          {
            name: "tokenBVault";
            docs: ["token b vault"];
            type: "publicKey";
          },
          {
            name: "whitelistedVault";
            docs: [
              "Whitelisted vault to be able to buy pool before activation_point",
            ];
            type: "publicKey";
          },
          {
            name: "partner";
            docs: ["partner"];
            type: "publicKey";
          },
          {
            name: "liquidity";
            docs: ["liquidity share"];
            type: "u128";
          },
          {
            name: "padding";
            docs: [
              "padding, previous reserve amount, be careful to use that field",
            ];
            type: "u128";
          },
          {
            name: "protocolAFee";
            docs: ["protocol a fee"];
            type: "u64";
          },
          {
            name: "protocolBFee";
            docs: ["protocol b fee"];
            type: "u64";
          },
          {
            name: "partnerAFee";
            docs: ["partner a fee"];
            type: "u64";
          },
          {
            name: "partnerBFee";
            docs: ["partner b fee"];
            type: "u64";
          },
          {
            name: "sqrtMinPrice";
            docs: ["min price"];
            type: "u128";
          },
          {
            name: "sqrtMaxPrice";
            docs: ["max price"];
            type: "u128";
          },
          {
            name: "sqrtPrice";
            docs: ["current price"];
            type: "u128";
          },
          {
            name: "activationPoint";
            docs: ["Activation point, can be slot or timestamp"];
            type: "u64";
          },
          {
            name: "activationType";
            docs: ["Activation type, 0 means by slot, 1 means by timestamp"];
            type: "u8";
          },
          {
            name: "poolStatus";
            docs: ["pool status, 0: enable, 1 disable"];
            type: "u8";
          },
          {
            name: "tokenAFlag";
            docs: ["token a flag"];
            type: "u8";
          },
          {
            name: "tokenBFlag";
            docs: ["token b flag"];
            type: "u8";
          },
          {
            name: "collectFeeMode";
            docs: [
              "0 is collect fee in both token, 1 only collect fee in token a, 2 only collect fee in token b",
            ];
            type: "u8";
          },
          {
            name: "poolType";
            docs: ["pool type"];
            type: "u8";
          },
          {
            name: "version";
            docs: [
              "pool version, 0: max_fee is still capped at 50%, 1: max_fee is capped at 99%",
            ];
            type: "u8";
          },
          {
            name: "padding0";
            docs: ["padding"];
            type: "u8";
          },
          {
            name: "feeAPerLiquidity";
            docs: ["cumulative"];
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "feeBPerLiquidity";
            docs: ["cumulative"];
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "permanentLockLiquidity";
            type: "u128";
          },
          {
            name: "metrics";
            docs: ["metrics"];
            type: {
              defined: "PoolMetrics";
            };
          },
          {
            name: "creator";
            docs: ["pool creator"];
            type: "publicKey";
          },
          {
            name: "padding1";
            docs: ["Padding for further use"];
            type: {
              array: ["u64", 6];
            };
          },
          {
            name: "rewardInfos";
            docs: ["Farming reward information"];
            type: {
              array: [
                {
                  defined: "RewardInfo";
                },
                2,
              ];
            };
          },
        ];
      };
    },
    {
      name: "PoolMetrics";
      type: {
        kind: "struct";
        fields: [
          {
            name: "totalLpAFee";
            type: "u128";
          },
          {
            name: "totalLpBFee";
            type: "u128";
          },
          {
            name: "totalProtocolAFee";
            type: "u64";
          },
          {
            name: "totalProtocolBFee";
            type: "u64";
          },
          {
            name: "totalPartnerAFee";
            type: "u64";
          },
          {
            name: "totalPartnerBFee";
            type: "u64";
          },
          {
            name: "totalPosition";
            type: "u64";
          },
          {
            name: "padding";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "RewardInfo";
      docs: ["Stores the state relevant for tracking liquidity mining rewards"];
      type: {
        kind: "struct";
        fields: [
          {
            name: "initialized";
            docs: ["Indicates if the reward has been initialized"];
            type: "u8";
          },
          {
            name: "rewardTokenFlag";
            docs: ["reward token flag"];
            type: "u8";
          },
          {
            name: "padding0";
            docs: ["padding"];
            type: {
              array: ["u8", 6];
            };
          },
          {
            name: "padding1";
            docs: ["Padding to ensure `reward_rate: u128` is 16-byte aligned"];
            type: {
              array: ["u8", 8];
            };
          },
          {
            name: "mint";
            docs: ["Reward token mint."];
            type: "publicKey";
          },
          {
            name: "vault";
            docs: ["Reward vault token account."];
            type: "publicKey";
          },
          {
            name: "funder";
            docs: ["Authority account that allows to fund rewards"];
            type: "publicKey";
          },
          {
            name: "rewardDuration";
            docs: ["reward duration"];
            type: "u64";
          },
          {
            name: "rewardDurationEnd";
            docs: ["reward duration end"];
            type: "u64";
          },
          {
            name: "rewardRate";
            docs: ["reward rate"];
            type: "u128";
          },
          {
            name: "rewardPerTokenStored";
            docs: ["Reward per token stored"];
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "lastUpdateTime";
            docs: ["The last time reward states were updated."];
            type: "u64";
          },
          {
            name: "cumulativeSecondsWithEmptyLiquidityReward";
            docs: [
              "Accumulated seconds when the farm distributed rewards but the bin was empty.",
              "These rewards will be carried over to the next reward time window.",
            ];
            type: "u64";
          },
        ];
      };
    },
    {
      name: "PoolFeesStruct";
      type: {
        kind: "struct";
        fields: [
          {
            name: "baseFee";
            docs: [
              "Trade fees are extra token amounts that are held inside the token",
              "accounts during a trade, making the value of liquidity tokens rise.",
              "Trade fee numerator",
            ];
            type: {
              defined: "BaseFeeStruct";
            };
          },
          {
            name: "protocolFeePercent";
            docs: [
              "Protocol trading fees are extra token amounts that are held inside the token",
              "accounts during a trade, with the equivalent in pool tokens minted to",
              "the protocol of the program.",
              "Protocol trade fee numerator",
            ];
            type: "u8";
          },
          {
            name: "partnerFeePercent";
            docs: ["partner fee"];
            type: "u8";
          },
          {
            name: "referralFeePercent";
            docs: ["referral fee"];
            type: "u8";
          },
          {
            name: "padding0";
            docs: ["padding"];
            type: {
              array: ["u8", 5];
            };
          },
          {
            name: "dynamicFee";
            docs: ["dynamic fee"];
            type: {
              defined: "DynamicFeeStruct";
            };
          },
          {
            name: "padding1";
            docs: ["padding"];
            type: {
              array: ["u64", 2];
            };
          },
        ];
      };
    },
    {
      name: "BaseFeeStruct";
      type: {
        kind: "struct";
        fields: [
          {
            name: "cliffFeeNumerator";
            type: "u64";
          },
          {
            name: "baseFeeMode";
            type: "u8";
          },
          {
            name: "padding0";
            type: {
              array: ["u8", 5];
            };
          },
          {
            name: "firstFactor";
            type: "u16";
          },
          {
            name: "secondFactor";
            type: {
              array: ["u8", 8];
            };
          },
          {
            name: "thirdFactor";
            type: "u64";
          },
          {
            name: "padding1";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "DynamicFeeStruct";
      type: {
        kind: "struct";
        fields: [
          {
            name: "initialized";
            type: "u8";
          },
          {
            name: "padding";
            type: {
              array: ["u8", 7];
            };
          },
          {
            name: "maxVolatilityAccumulator";
            type: "u32";
          },
          {
            name: "variableFeeControl";
            type: "u32";
          },
          {
            name: "binStep";
            type: "u16";
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
            name: "lastUpdateTimestamp";
            type: "u64";
          },
          {
            name: "binStepU128";
            type: "u128";
          },
          {
            name: "sqrtPriceReference";
            type: "u128";
          },
          {
            name: "volatilityAccumulator";
            type: "u128";
          },
          {
            name: "volatilityReference";
            type: "u128";
          },
        ];
      };
    },
    {
      name: "Position";
      type: {
        kind: "struct";
        fields: [
          {
            name: "pool";
            type: "publicKey";
          },
          {
            name: "nftMint";
            docs: ["nft mint"];
            type: "publicKey";
          },
          {
            name: "feeAPerTokenCheckpoint";
            docs: ["fee a checkpoint"];
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "feeBPerTokenCheckpoint";
            docs: ["fee b checkpoint"];
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "feeAPending";
            docs: ["fee a pending"];
            type: "u64";
          },
          {
            name: "feeBPending";
            docs: ["fee b pending"];
            type: "u64";
          },
          {
            name: "unlockedLiquidity";
            docs: ["unlock liquidity"];
            type: "u128";
          },
          {
            name: "vestedLiquidity";
            docs: ["vesting liquidity"];
            type: "u128";
          },
          {
            name: "permanentLockedLiquidity";
            docs: ["permanent locked liquidity"];
            type: "u128";
          },
          {
            name: "metrics";
            docs: ["metrics"];
            type: {
              defined: "PositionMetrics";
            };
          },
          {
            name: "rewardInfos";
            docs: ["Farming reward information"];
            type: {
              array: [
                {
                  defined: "UserRewardInfo";
                },
                2,
              ];
            };
          },
          {
            name: "padding";
            docs: ["padding for future usage"];
            type: {
              array: ["u128", 6];
            };
          },
        ];
      };
    },
    {
      name: "PositionMetrics";
      type: {
        kind: "struct";
        fields: [
          {
            name: "totalClaimedAFee";
            type: "u64";
          },
          {
            name: "totalClaimedBFee";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "UserRewardInfo";
      type: {
        kind: "struct";
        fields: [
          {
            name: "rewardPerTokenCheckpoint";
            docs: ["The latest update reward checkpoint"];
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "rewardPendings";
            docs: ["Current pending rewards"];
            type: "u64";
          },
          {
            name: "totalClaimedRewards";
            docs: ["Total claimed rewards"];
            type: "u64";
          },
        ];
      };
    },
    {
      name: "Rounding";
      docs: ["Round up, down"];
      type: {
        kind: "enum";
        variants: [
          {
            name: "Up";
          },
          {
            name: "Down";
          },
        ];
      };
    },
  ];
  errors: [
    {
      code: 6000;
      name: "BidWallNotExpired";
      msg: "Bid wall not expired";
    },
    {
      code: 6001;
      name: "MeteoraDammPoolDiscriminatorMismatch";
      msg: "Meteora DAMM pool discriminator mismatch";
    },
    {
      code: 6002;
      name: "MeteoraDammPositionDiscriminatorMismatch";
      msg: "Meteora DAMM position discriminator mismatch";
    },
    {
      code: 6003;
      name: "MathOverflow";
      msg: "Math overflow";
    },
    {
      code: 6004;
      name: "TypeCastFailed";
      msg: "Type cast failed";
    },
    {
      code: 6005;
      name: "MeteoraDammPositionPoolMismatch";
      msg: "Meteora DAMM position pool mismatch";
    },
    {
      code: 6006;
      name: "MeteoraDammPoolMintsMismatch";
      msg: "Meteora DAMM pool mints do not match the bid wall mints";
    },
  ];
};

export const IDL: BidWall = {
  version: "0.6.0",
  name: "bid_wall",
  instructions: [
    {
      name: "initializeBidWall",
      accounts: [
        {
          name: "bidWall",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "dao",
          isMut: false,
          isSigner: false,
        },
        {
          name: "bidWallUsdcTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authorityUsdcTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "baseMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "quoteMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "pool",
          isMut: false,
          isSigner: false,
        },
        {
          name: "position",
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
          name: "args",
          type: {
            defined: "InitializeBidWallArgs",
          },
        },
      ],
    },
    {
      name: "closeBidWall",
      accounts: [
        {
          name: "bidWall",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "feeRecipient",
          isMut: false,
          isSigner: false,
        },
        {
          name: "bidWallUsdcTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authorityUsdcTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "feeWalletUsdcTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "baseMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "usdcMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
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
      args: [],
    },
    {
      name: "sellTokens",
      accounts: [
        {
          name: "bidWall",
          isMut: true,
          isSigner: false,
        },
        {
          name: "user",
          isMut: true,
          isSigner: true,
        },
        {
          name: "userTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userUsdcTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "bidWallUsdcTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "baseMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "quoteMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "dao",
          isMut: false,
          isSigner: false,
        },
        {
          name: "daoTreasuryUsdcTokenAccount",
          isMut: false,
          isSigner: false,
        },
        {
          name: "pool",
          isMut: false,
          isSigner: false,
        },
        {
          name: "position",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
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
          name: "args",
          type: {
            defined: "SellTokensArgs",
          },
        },
      ],
    },
  ],
  accounts: [
    {
      name: "bidWall",
      type: {
        kind: "struct",
        fields: [
          {
            name: "createdTimestamp",
            docs: ["When the bid wall was created."],
            type: "i64",
          },
          {
            name: "feesCollected",
            docs: ["The fees collected by the bid wall."],
            type: "u64",
          },
          {
            name: "authority",
            docs: ["The authority of the bid wall."],
            type: "publicKey",
          },
          {
            name: "baseMint",
            docs: ["The mint of the token being sold into the bid wall."],
            type: "publicKey",
          },
          {
            name: "dao",
            docs: ["The related DAO."],
            type: "publicKey",
          },
          {
            name: "pool",
            docs: ["The DAO's Meteora DAMMv2 pool"],
            type: "publicKey",
          },
          {
            name: "position",
            docs: ["The DAO's Meteora DAMMv2 position"],
            type: "publicKey",
          },
          {
            name: "minDuration",
            docs: [
              "The minimum duration in seconds before the bid wall can be closed.",
            ],
            type: "u32",
          },
          {
            name: "pdaBump",
            docs: ["The PDA bump."],
            type: "u8",
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "InitializeBidWallArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "amount",
            type: "u64",
          },
          {
            name: "minDuration",
            type: "u32",
          },
        ],
      },
    },
    {
      name: "SellTokensArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "amountIn",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "Pool",
      type: {
        kind: "struct",
        fields: [
          {
            name: "poolFees",
            docs: ["Pool fee"],
            type: {
              defined: "PoolFeesStruct",
            },
          },
          {
            name: "tokenAMint",
            docs: ["token a mint"],
            type: "publicKey",
          },
          {
            name: "tokenBMint",
            docs: ["token b mint"],
            type: "publicKey",
          },
          {
            name: "tokenAVault",
            docs: ["token a vault"],
            type: "publicKey",
          },
          {
            name: "tokenBVault",
            docs: ["token b vault"],
            type: "publicKey",
          },
          {
            name: "whitelistedVault",
            docs: [
              "Whitelisted vault to be able to buy pool before activation_point",
            ],
            type: "publicKey",
          },
          {
            name: "partner",
            docs: ["partner"],
            type: "publicKey",
          },
          {
            name: "liquidity",
            docs: ["liquidity share"],
            type: "u128",
          },
          {
            name: "padding",
            docs: [
              "padding, previous reserve amount, be careful to use that field",
            ],
            type: "u128",
          },
          {
            name: "protocolAFee",
            docs: ["protocol a fee"],
            type: "u64",
          },
          {
            name: "protocolBFee",
            docs: ["protocol b fee"],
            type: "u64",
          },
          {
            name: "partnerAFee",
            docs: ["partner a fee"],
            type: "u64",
          },
          {
            name: "partnerBFee",
            docs: ["partner b fee"],
            type: "u64",
          },
          {
            name: "sqrtMinPrice",
            docs: ["min price"],
            type: "u128",
          },
          {
            name: "sqrtMaxPrice",
            docs: ["max price"],
            type: "u128",
          },
          {
            name: "sqrtPrice",
            docs: ["current price"],
            type: "u128",
          },
          {
            name: "activationPoint",
            docs: ["Activation point, can be slot or timestamp"],
            type: "u64",
          },
          {
            name: "activationType",
            docs: ["Activation type, 0 means by slot, 1 means by timestamp"],
            type: "u8",
          },
          {
            name: "poolStatus",
            docs: ["pool status, 0: enable, 1 disable"],
            type: "u8",
          },
          {
            name: "tokenAFlag",
            docs: ["token a flag"],
            type: "u8",
          },
          {
            name: "tokenBFlag",
            docs: ["token b flag"],
            type: "u8",
          },
          {
            name: "collectFeeMode",
            docs: [
              "0 is collect fee in both token, 1 only collect fee in token a, 2 only collect fee in token b",
            ],
            type: "u8",
          },
          {
            name: "poolType",
            docs: ["pool type"],
            type: "u8",
          },
          {
            name: "version",
            docs: [
              "pool version, 0: max_fee is still capped at 50%, 1: max_fee is capped at 99%",
            ],
            type: "u8",
          },
          {
            name: "padding0",
            docs: ["padding"],
            type: "u8",
          },
          {
            name: "feeAPerLiquidity",
            docs: ["cumulative"],
            type: {
              array: ["u8", 32],
            },
          },
          {
            name: "feeBPerLiquidity",
            docs: ["cumulative"],
            type: {
              array: ["u8", 32],
            },
          },
          {
            name: "permanentLockLiquidity",
            type: "u128",
          },
          {
            name: "metrics",
            docs: ["metrics"],
            type: {
              defined: "PoolMetrics",
            },
          },
          {
            name: "creator",
            docs: ["pool creator"],
            type: "publicKey",
          },
          {
            name: "padding1",
            docs: ["Padding for further use"],
            type: {
              array: ["u64", 6],
            },
          },
          {
            name: "rewardInfos",
            docs: ["Farming reward information"],
            type: {
              array: [
                {
                  defined: "RewardInfo",
                },
                2,
              ],
            },
          },
        ],
      },
    },
    {
      name: "PoolMetrics",
      type: {
        kind: "struct",
        fields: [
          {
            name: "totalLpAFee",
            type: "u128",
          },
          {
            name: "totalLpBFee",
            type: "u128",
          },
          {
            name: "totalProtocolAFee",
            type: "u64",
          },
          {
            name: "totalProtocolBFee",
            type: "u64",
          },
          {
            name: "totalPartnerAFee",
            type: "u64",
          },
          {
            name: "totalPartnerBFee",
            type: "u64",
          },
          {
            name: "totalPosition",
            type: "u64",
          },
          {
            name: "padding",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "RewardInfo",
      docs: ["Stores the state relevant for tracking liquidity mining rewards"],
      type: {
        kind: "struct",
        fields: [
          {
            name: "initialized",
            docs: ["Indicates if the reward has been initialized"],
            type: "u8",
          },
          {
            name: "rewardTokenFlag",
            docs: ["reward token flag"],
            type: "u8",
          },
          {
            name: "padding0",
            docs: ["padding"],
            type: {
              array: ["u8", 6],
            },
          },
          {
            name: "padding1",
            docs: ["Padding to ensure `reward_rate: u128` is 16-byte aligned"],
            type: {
              array: ["u8", 8],
            },
          },
          {
            name: "mint",
            docs: ["Reward token mint."],
            type: "publicKey",
          },
          {
            name: "vault",
            docs: ["Reward vault token account."],
            type: "publicKey",
          },
          {
            name: "funder",
            docs: ["Authority account that allows to fund rewards"],
            type: "publicKey",
          },
          {
            name: "rewardDuration",
            docs: ["reward duration"],
            type: "u64",
          },
          {
            name: "rewardDurationEnd",
            docs: ["reward duration end"],
            type: "u64",
          },
          {
            name: "rewardRate",
            docs: ["reward rate"],
            type: "u128",
          },
          {
            name: "rewardPerTokenStored",
            docs: ["Reward per token stored"],
            type: {
              array: ["u8", 32],
            },
          },
          {
            name: "lastUpdateTime",
            docs: ["The last time reward states were updated."],
            type: "u64",
          },
          {
            name: "cumulativeSecondsWithEmptyLiquidityReward",
            docs: [
              "Accumulated seconds when the farm distributed rewards but the bin was empty.",
              "These rewards will be carried over to the next reward time window.",
            ],
            type: "u64",
          },
        ],
      },
    },
    {
      name: "PoolFeesStruct",
      type: {
        kind: "struct",
        fields: [
          {
            name: "baseFee",
            docs: [
              "Trade fees are extra token amounts that are held inside the token",
              "accounts during a trade, making the value of liquidity tokens rise.",
              "Trade fee numerator",
            ],
            type: {
              defined: "BaseFeeStruct",
            },
          },
          {
            name: "protocolFeePercent",
            docs: [
              "Protocol trading fees are extra token amounts that are held inside the token",
              "accounts during a trade, with the equivalent in pool tokens minted to",
              "the protocol of the program.",
              "Protocol trade fee numerator",
            ],
            type: "u8",
          },
          {
            name: "partnerFeePercent",
            docs: ["partner fee"],
            type: "u8",
          },
          {
            name: "referralFeePercent",
            docs: ["referral fee"],
            type: "u8",
          },
          {
            name: "padding0",
            docs: ["padding"],
            type: {
              array: ["u8", 5],
            },
          },
          {
            name: "dynamicFee",
            docs: ["dynamic fee"],
            type: {
              defined: "DynamicFeeStruct",
            },
          },
          {
            name: "padding1",
            docs: ["padding"],
            type: {
              array: ["u64", 2],
            },
          },
        ],
      },
    },
    {
      name: "BaseFeeStruct",
      type: {
        kind: "struct",
        fields: [
          {
            name: "cliffFeeNumerator",
            type: "u64",
          },
          {
            name: "baseFeeMode",
            type: "u8",
          },
          {
            name: "padding0",
            type: {
              array: ["u8", 5],
            },
          },
          {
            name: "firstFactor",
            type: "u16",
          },
          {
            name: "secondFactor",
            type: {
              array: ["u8", 8],
            },
          },
          {
            name: "thirdFactor",
            type: "u64",
          },
          {
            name: "padding1",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "DynamicFeeStruct",
      type: {
        kind: "struct",
        fields: [
          {
            name: "initialized",
            type: "u8",
          },
          {
            name: "padding",
            type: {
              array: ["u8", 7],
            },
          },
          {
            name: "maxVolatilityAccumulator",
            type: "u32",
          },
          {
            name: "variableFeeControl",
            type: "u32",
          },
          {
            name: "binStep",
            type: "u16",
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
            name: "lastUpdateTimestamp",
            type: "u64",
          },
          {
            name: "binStepU128",
            type: "u128",
          },
          {
            name: "sqrtPriceReference",
            type: "u128",
          },
          {
            name: "volatilityAccumulator",
            type: "u128",
          },
          {
            name: "volatilityReference",
            type: "u128",
          },
        ],
      },
    },
    {
      name: "Position",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pool",
            type: "publicKey",
          },
          {
            name: "nftMint",
            docs: ["nft mint"],
            type: "publicKey",
          },
          {
            name: "feeAPerTokenCheckpoint",
            docs: ["fee a checkpoint"],
            type: {
              array: ["u8", 32],
            },
          },
          {
            name: "feeBPerTokenCheckpoint",
            docs: ["fee b checkpoint"],
            type: {
              array: ["u8", 32],
            },
          },
          {
            name: "feeAPending",
            docs: ["fee a pending"],
            type: "u64",
          },
          {
            name: "feeBPending",
            docs: ["fee b pending"],
            type: "u64",
          },
          {
            name: "unlockedLiquidity",
            docs: ["unlock liquidity"],
            type: "u128",
          },
          {
            name: "vestedLiquidity",
            docs: ["vesting liquidity"],
            type: "u128",
          },
          {
            name: "permanentLockedLiquidity",
            docs: ["permanent locked liquidity"],
            type: "u128",
          },
          {
            name: "metrics",
            docs: ["metrics"],
            type: {
              defined: "PositionMetrics",
            },
          },
          {
            name: "rewardInfos",
            docs: ["Farming reward information"],
            type: {
              array: [
                {
                  defined: "UserRewardInfo",
                },
                2,
              ],
            },
          },
          {
            name: "padding",
            docs: ["padding for future usage"],
            type: {
              array: ["u128", 6],
            },
          },
        ],
      },
    },
    {
      name: "PositionMetrics",
      type: {
        kind: "struct",
        fields: [
          {
            name: "totalClaimedAFee",
            type: "u64",
          },
          {
            name: "totalClaimedBFee",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "UserRewardInfo",
      type: {
        kind: "struct",
        fields: [
          {
            name: "rewardPerTokenCheckpoint",
            docs: ["The latest update reward checkpoint"],
            type: {
              array: ["u8", 32],
            },
          },
          {
            name: "rewardPendings",
            docs: ["Current pending rewards"],
            type: "u64",
          },
          {
            name: "totalClaimedRewards",
            docs: ["Total claimed rewards"],
            type: "u64",
          },
        ],
      },
    },
    {
      name: "Rounding",
      docs: ["Round up, down"],
      type: {
        kind: "enum",
        variants: [
          {
            name: "Up",
          },
          {
            name: "Down",
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: "BidWallNotExpired",
      msg: "Bid wall not expired",
    },
    {
      code: 6001,
      name: "MeteoraDammPoolDiscriminatorMismatch",
      msg: "Meteora DAMM pool discriminator mismatch",
    },
    {
      code: 6002,
      name: "MeteoraDammPositionDiscriminatorMismatch",
      msg: "Meteora DAMM position discriminator mismatch",
    },
    {
      code: 6003,
      name: "MathOverflow",
      msg: "Math overflow",
    },
    {
      code: 6004,
      name: "TypeCastFailed",
      msg: "Type cast failed",
    },
    {
      code: 6005,
      name: "MeteoraDammPositionPoolMismatch",
      msg: "Meteora DAMM position pool mismatch",
    },
    {
      code: 6006,
      name: "MeteoraDammPoolMintsMismatch",
      msg: "Meteora DAMM pool mints do not match the bid wall mints",
    },
  ],
};
