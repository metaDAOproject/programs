export type PerformancePackageV2 = {
  version: "0.7.0";
  name: "performance_package_v2";
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
          name: "mint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "mintGovernor";
          isMut: false;
          isSigner: false;
        },
        {
          name: "mintAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "createKey";
          isMut: false;
          isSigner: true;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "recipient";
          isMut: false;
          isSigner: false;
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
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "InitializePerformancePackageArgs";
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
          name: "signer";
          isMut: false;
          isSigner: true;
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
          name: "mintGovernor";
          isMut: true;
          isSigner: false;
        },
        {
          name: "mintAuthority";
          isMut: true;
          isSigner: false;
        },
        {
          name: "mint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "recipientAta";
          isMut: true;
          isSigner: false;
        },
        {
          name: "signer";
          isMut: false;
          isSigner: true;
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
          name: "mintGovernorProgram";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: "changeAuthority";
      accounts: [
        {
          name: "performancePackage";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
          docs: ["Must be the current authority of the performance package"];
        },
        {
          name: "newAuthority";
          isMut: false;
          isSigner: false;
          docs: ["The new authority address"];
        },
      ];
      args: [];
    },
    {
      name: "proposeChange";
      accounts: [
        {
          name: "performancePackage";
          isMut: true;
          isSigner: false;
        },
        {
          name: "changeRequest";
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
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "ProposeChangeArgs";
          };
        },
      ];
    },
    {
      name: "executeChange";
      accounts: [
        {
          name: "performancePackage";
          isMut: true;
          isSigner: false;
        },
        {
          name: "changeRequest";
          isMut: true;
          isSigner: false;
        },
        {
          name: "executor";
          isMut: false;
          isSigner: true;
        },
        {
          name: "rentDestination";
          isMut: true;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: "closePerformancePackage";
      accounts: [
        {
          name: "performancePackage";
          isMut: true;
          isSigner: false;
        },
        {
          name: "admin";
          isMut: false;
          isSigner: true;
        },
        {
          name: "rentDestination";
          isMut: true;
          isSigner: false;
        },
      ];
      args: [];
    },
  ];
  accounts: [
    {
      name: "changeRequest";
      docs: [
        "Temporary account for two-party approval flow.",
        'Seeds: `["change_request", performance_package, proposer, pda_nonce.to_le_bytes()]`',
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "performancePackage";
            docs: ["The performance package this change applies to"];
            type: "publicKey";
          },
          {
            name: "proposerType";
            docs: ["Who proposed this change"];
            type: {
              defined: "ProposerType";
            };
          },
          {
            name: "proposedAt";
            docs: ["When the change was proposed"];
            type: "i64";
          },
          {
            name: "pdaNonce";
            docs: [
              "For unique PDA derivation (allows multiple concurrent proposals)",
            ];
            type: "u32";
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "newRecipient";
            docs: ["New recipient address (if changing)"];
            type: {
              option: "publicKey";
            };
          },
          {
            name: "newOracleReader";
            docs: ["New oracle configuration (if changing)"];
            type: {
              option: {
                defined: "OracleReader";
              };
            };
          },
          {
            name: "newRewardFunction";
            docs: ["New reward function (if changing)"];
            type: {
              option: {
                defined: "RewardFunction";
              };
            };
          },
        ];
      };
    },
    {
      name: "performancePackage";
      docs: [
        "The main account representing a performance package.",
        "Acts as the `authorized_minter` in mint_governor.",
        'Seeds: `["performance_package", create_key]`',
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            docs: ["Token mint controlled by mint_governor"];
            type: "publicKey";
          },
          {
            name: "mintGovernor";
            docs: ["MintGovernor account"];
            type: "publicKey";
          },
          {
            name: "mintAuthority";
            docs: ["MintAuthority PDA for this PP"];
            type: "publicKey";
          },
          {
            name: "authority";
            docs: ["Usually the DAO multisig vault - can modify PP"];
            type: "publicKey";
          },
          {
            name: "recipient";
            docs: ["Usually the team multisig - receives minted tokens"];
            type: "publicKey";
          },
          {
            name: "oracleReader";
            docs: ["Stores start/end snapshots for oracle calculations"];
            type: {
              defined: "OracleReader";
            };
          },
          {
            name: "rewardFunction";
            docs: ["How to calculate rewards"];
            type: {
              defined: "RewardFunction";
            };
          },
          {
            name: "status";
            docs: ["Locked or Unlocking state"];
            type: {
              defined: "PackageStatus";
            };
          },
          {
            name: "minUnlockTimestamp";
            docs: ["Can't start unlock before this time"];
            type: "i64";
          },
          {
            name: "totalRewardsPaidOut";
            docs: ["Cumulative tokens minted to the recipient"];
            type: "u64";
          },
          {
            name: "seqNum";
            docs: ["Event sequence number"];
            type: "u64";
          },
          {
            name: "createKey";
            docs: ["Used for PDA derivation"];
            type: "publicKey";
          },
          {
            name: "bump";
            docs: ["PDA bump"];
            type: "u8";
          },
        ];
      };
    },
  ];
  types: [
    {
      name: "CommonFields";
      docs: ["Common fields included in all events for consistent metadata."];
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
      name: "InitializePerformancePackageArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "oracleReader";
            type: {
              defined: "OracleReader";
            };
          },
          {
            name: "rewardFunction";
            type: {
              defined: "RewardFunction";
            };
          },
          {
            name: "minUnlockTimestamp";
            type: "i64";
          },
        ];
      };
    },
    {
      name: "ProposeChangeArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "pdaNonce";
            type: "u32";
          },
          {
            name: "newRecipient";
            type: {
              option: "publicKey";
            };
          },
          {
            name: "newOracleReader";
            type: {
              option: {
                defined: "OracleReader";
              };
            };
          },
          {
            name: "newRewardFunction";
            type: {
              option: {
                defined: "RewardFunction";
              };
            };
          },
        ];
      };
    },
    {
      name: "ThresholdTranche";
      docs: ["A threshold tranche for step-based rewards."];
      type: {
        kind: "struct";
        fields: [
          {
            name: "threshold";
            docs: ["Oracle value threshold"];
            type: "u128";
          },
          {
            name: "cumulativeAmount";
            docs: [
              "Total tokens at this tranche (cumulative, not incremental)",
            ];
            type: "u64";
          },
        ];
      };
    },
    {
      name: "ProposerType";
      docs: ["Who proposed the change."];
      type: {
        kind: "enum";
        variants: [
          {
            name: "Authority";
          },
          {
            name: "Recipient";
          },
        ];
      };
    },
    {
      name: "PackageStatus";
      docs: ["Lifecycle state for the performance package."];
      type: {
        kind: "enum";
        variants: [
          {
            name: "Locked";
          },
          {
            name: "Unlocking";
          },
        ];
      };
    },
    {
      name: "OracleReader";
      docs: [
        "Oracle reader that knows how to read from an external oracle account.",
        "Extracts a `value: u128` for reward calculations.",
      ];
      type: {
        kind: "enum";
        variants: [
          {
            name: "Time";
          },
          {
            name: "FutarchyTwap";
            fields: [
              {
                name: "amm";
                docs: [
                  "The Futarchy DAO account to read (contains embedded AMM)",
                ];
                type: "publicKey";
              },
              {
                name: "minDuration";
                docs: ["Minimum seconds between start and end"];
                type: "u32";
              },
              {
                name: "startValue";
                docs: ["Start snapshot (recorded on start_unlock)"];
                type: "u128";
              },
              {
                name: "startTime";
                type: "i64";
              },
              {
                name: "endValue";
                docs: ["End snapshot (recorded on complete_unlock)"];
                type: "u128";
              },
              {
                name: "endTime";
                type: "i64";
              },
            ];
          },
        ];
      };
    },
    {
      name: "RewardFunction";
      docs: [
        "Reward function that calculates cumulative rewards from oracle values.",
        "Returns total tokens deserved so far (not incremental).",
      ];
      type: {
        kind: "enum";
        variants: [
          {
            name: "CliffLinear";
            fields: [
              {
                name: "startValue";
                type: "u128";
              },
              {
                name: "cliffValue";
                type: "u128";
              },
              {
                name: "endValue";
                type: "u128";
              },
              {
                name: "cliffAmount";
                type: "u64";
              },
              {
                name: "totalAmount";
                docs: ["Total amount including cliff"];
                type: "u64";
              },
            ];
          },
          {
            name: "Threshold";
            fields: [
              {
                name: "tranches";
                docs: ["Must be sorted by threshold ascending"];
                type: {
                  vec: {
                    defined: "ThresholdTranche";
                  };
                };
              },
            ];
          },
        ];
      };
    },
  ];
  events: [
    {
      name: "PerformancePackageCreatedEvent";
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
          name: "mint";
          type: "publicKey";
          index: false;
        },
        {
          name: "mintGovernor";
          type: "publicKey";
          index: false;
        },
        {
          name: "authority";
          type: "publicKey";
          index: false;
        },
        {
          name: "recipient";
          type: "publicKey";
          index: false;
        },
        {
          name: "createKey";
          type: "publicKey";
          index: false;
        },
        {
          name: "pdaBump";
          type: "u8";
          index: false;
        },
      ];
    },
    {
      name: "UnlockStartedEvent";
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
          name: "startTime";
          type: "i64";
          index: false;
        },
      ];
    },
    {
      name: "UnlockCompletedEvent";
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
          name: "oracleValue";
          type: "u128";
          index: false;
        },
        {
          name: "recipient";
          type: "publicKey";
          index: false;
        },
        {
          name: "amountMinted";
          type: "u64";
          index: false;
        },
        {
          name: "totalRewardsPaidOut";
          type: "u64";
          index: false;
        },
      ];
    },
    {
      name: "AuthorityChangedEvent";
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
    {
      name: "ChangeProposedEvent";
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
          name: "proposerType";
          type: {
            defined: "ProposerType";
          };
          index: false;
        },
        {
          name: "pdaNonce";
          type: "u32";
          index: false;
        },
        {
          name: "newRecipient";
          type: {
            option: "publicKey";
          };
          index: false;
        },
        {
          name: "newOracleReader";
          type: {
            option: {
              defined: "OracleReader";
            };
          };
          index: false;
        },
        {
          name: "newRewardFunction";
          type: {
            option: {
              defined: "RewardFunction";
            };
          };
          index: false;
        },
      ];
    },
    {
      name: "ChangeExecutedEvent";
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
          name: "executedBy";
          type: "publicKey";
          index: false;
        },
        {
          name: "newRecipient";
          type: {
            option: "publicKey";
          };
          index: false;
        },
        {
          name: "newOracleReader";
          type: {
            option: {
              defined: "OracleReader";
            };
          };
          index: false;
        },
        {
          name: "newRewardFunction";
          type: {
            option: {
              defined: "RewardFunction";
            };
          };
          index: false;
        },
      ];
    },
    {
      name: "PerformancePackageClosedEvent";
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
          name: "totalRewardsPaidOut";
          type: "u64";
          index: false;
        },
      ];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "Unauthorized";
      msg: "Signer is neither authority nor recipient";
    },
    {
      code: 6001;
      name: "InvalidExecutor";
      msg: "Executor is not the opposite party from proposer";
    },
    {
      code: 6002;
      name: "InvalidAuthority";
      msg: "Signer is not the current authority";
    },
    {
      code: 6003;
      name: "InvalidAdmin";
      msg: "Signer is not the admin";
    },
    {
      code: 6004;
      name: "InvalidMintGovernor";
      msg: "Mint governor does not match the provided mint";
    },
    {
      code: 6005;
      name: "InvalidMintAuthority";
      msg: "Mint authority does not match expected configuration";
    },
    {
      code: 6006;
      name: "NotLocked";
      msg: "Expected Locked status";
    },
    {
      code: 6007;
      name: "NotUnlocking";
      msg: "Expected Unlocking status";
    },
    {
      code: 6008;
      name: "OracleMissingAccount";
      msg: "Expected remaining_accounts not provided";
    },
    {
      code: 6009;
      name: "OracleInvalidAccount";
      msg: "Account pubkey doesn't match expected";
    },
    {
      code: 6010;
      name: "OracleParseError";
      msg: "Failed to parse account data";
    },
    {
      code: 6011;
      name: "OracleInvalidState";
      msg: "Oracle state invalid";
    },
    {
      code: 6012;
      name: "OracleMinDurationNotReached";
      msg: "Minimum duration hasn't passed yet";
    },
    {
      code: 6013;
      name: "UnlockTimestampNotReached";
      msg: "Minimum unlock timestamp not yet reached";
    },
    {
      code: 6014;
      name: "RewardCalculationOverflow";
      msg: "Math overflow in reward function";
    },
    {
      code: 6015;
      name: "InvalidTranches";
      msg: "Tranches should be sorted and non-empty";
    },
    {
      code: 6016;
      name: "InvalidVestingSchedule";
      msg: "Invalid vesting schedule configuration";
    },
    {
      code: 6017;
      name: "ChangeRequestNotFound";
      msg: "Missing proposal for execute";
    },
    {
      code: 6018;
      name: "NoChangesProposed";
      msg: "All optional change fields are None";
    },
  ];
};

export const IDL: PerformancePackageV2 = {
  version: "0.7.0",
  name: "performance_package_v2",
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
          name: "mint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "mintGovernor",
          isMut: false,
          isSigner: false,
        },
        {
          name: "mintAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "createKey",
          isMut: false,
          isSigner: true,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "recipient",
          isMut: false,
          isSigner: false,
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
      ],
      args: [
        {
          name: "args",
          type: {
            defined: "InitializePerformancePackageArgs",
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
          name: "signer",
          isMut: false,
          isSigner: true,
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
          name: "mintGovernor",
          isMut: true,
          isSigner: false,
        },
        {
          name: "mintAuthority",
          isMut: true,
          isSigner: false,
        },
        {
          name: "mint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "recipientAta",
          isMut: true,
          isSigner: false,
        },
        {
          name: "signer",
          isMut: false,
          isSigner: true,
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
          name: "mintGovernorProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "changeAuthority",
      accounts: [
        {
          name: "performancePackage",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
          docs: ["Must be the current authority of the performance package"],
        },
        {
          name: "newAuthority",
          isMut: false,
          isSigner: false,
          docs: ["The new authority address"],
        },
      ],
      args: [],
    },
    {
      name: "proposeChange",
      accounts: [
        {
          name: "performancePackage",
          isMut: true,
          isSigner: false,
        },
        {
          name: "changeRequest",
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
      ],
      args: [
        {
          name: "args",
          type: {
            defined: "ProposeChangeArgs",
          },
        },
      ],
    },
    {
      name: "executeChange",
      accounts: [
        {
          name: "performancePackage",
          isMut: true,
          isSigner: false,
        },
        {
          name: "changeRequest",
          isMut: true,
          isSigner: false,
        },
        {
          name: "executor",
          isMut: false,
          isSigner: true,
        },
        {
          name: "rentDestination",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "closePerformancePackage",
      accounts: [
        {
          name: "performancePackage",
          isMut: true,
          isSigner: false,
        },
        {
          name: "admin",
          isMut: false,
          isSigner: true,
        },
        {
          name: "rentDestination",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "changeRequest",
      docs: [
        "Temporary account for two-party approval flow.",
        'Seeds: `["change_request", performance_package, proposer, pda_nonce.to_le_bytes()]`',
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "performancePackage",
            docs: ["The performance package this change applies to"],
            type: "publicKey",
          },
          {
            name: "proposerType",
            docs: ["Who proposed this change"],
            type: {
              defined: "ProposerType",
            },
          },
          {
            name: "proposedAt",
            docs: ["When the change was proposed"],
            type: "i64",
          },
          {
            name: "pdaNonce",
            docs: [
              "For unique PDA derivation (allows multiple concurrent proposals)",
            ],
            type: "u32",
          },
          {
            name: "bump",
            type: "u8",
          },
          {
            name: "newRecipient",
            docs: ["New recipient address (if changing)"],
            type: {
              option: "publicKey",
            },
          },
          {
            name: "newOracleReader",
            docs: ["New oracle configuration (if changing)"],
            type: {
              option: {
                defined: "OracleReader",
              },
            },
          },
          {
            name: "newRewardFunction",
            docs: ["New reward function (if changing)"],
            type: {
              option: {
                defined: "RewardFunction",
              },
            },
          },
        ],
      },
    },
    {
      name: "performancePackage",
      docs: [
        "The main account representing a performance package.",
        "Acts as the `authorized_minter` in mint_governor.",
        'Seeds: `["performance_package", create_key]`',
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "mint",
            docs: ["Token mint controlled by mint_governor"],
            type: "publicKey",
          },
          {
            name: "mintGovernor",
            docs: ["MintGovernor account"],
            type: "publicKey",
          },
          {
            name: "mintAuthority",
            docs: ["MintAuthority PDA for this PP"],
            type: "publicKey",
          },
          {
            name: "authority",
            docs: ["Usually the DAO multisig vault - can modify PP"],
            type: "publicKey",
          },
          {
            name: "recipient",
            docs: ["Usually the team multisig - receives minted tokens"],
            type: "publicKey",
          },
          {
            name: "oracleReader",
            docs: ["Stores start/end snapshots for oracle calculations"],
            type: {
              defined: "OracleReader",
            },
          },
          {
            name: "rewardFunction",
            docs: ["How to calculate rewards"],
            type: {
              defined: "RewardFunction",
            },
          },
          {
            name: "status",
            docs: ["Locked or Unlocking state"],
            type: {
              defined: "PackageStatus",
            },
          },
          {
            name: "minUnlockTimestamp",
            docs: ["Can't start unlock before this time"],
            type: "i64",
          },
          {
            name: "totalRewardsPaidOut",
            docs: ["Cumulative tokens minted to the recipient"],
            type: "u64",
          },
          {
            name: "seqNum",
            docs: ["Event sequence number"],
            type: "u64",
          },
          {
            name: "createKey",
            docs: ["Used for PDA derivation"],
            type: "publicKey",
          },
          {
            name: "bump",
            docs: ["PDA bump"],
            type: "u8",
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "CommonFields",
      docs: ["Common fields included in all events for consistent metadata."],
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
      name: "InitializePerformancePackageArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "oracleReader",
            type: {
              defined: "OracleReader",
            },
          },
          {
            name: "rewardFunction",
            type: {
              defined: "RewardFunction",
            },
          },
          {
            name: "minUnlockTimestamp",
            type: "i64",
          },
        ],
      },
    },
    {
      name: "ProposeChangeArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pdaNonce",
            type: "u32",
          },
          {
            name: "newRecipient",
            type: {
              option: "publicKey",
            },
          },
          {
            name: "newOracleReader",
            type: {
              option: {
                defined: "OracleReader",
              },
            },
          },
          {
            name: "newRewardFunction",
            type: {
              option: {
                defined: "RewardFunction",
              },
            },
          },
        ],
      },
    },
    {
      name: "ThresholdTranche",
      docs: ["A threshold tranche for step-based rewards."],
      type: {
        kind: "struct",
        fields: [
          {
            name: "threshold",
            docs: ["Oracle value threshold"],
            type: "u128",
          },
          {
            name: "cumulativeAmount",
            docs: [
              "Total tokens at this tranche (cumulative, not incremental)",
            ],
            type: "u64",
          },
        ],
      },
    },
    {
      name: "ProposerType",
      docs: ["Who proposed the change."],
      type: {
        kind: "enum",
        variants: [
          {
            name: "Authority",
          },
          {
            name: "Recipient",
          },
        ],
      },
    },
    {
      name: "PackageStatus",
      docs: ["Lifecycle state for the performance package."],
      type: {
        kind: "enum",
        variants: [
          {
            name: "Locked",
          },
          {
            name: "Unlocking",
          },
        ],
      },
    },
    {
      name: "OracleReader",
      docs: [
        "Oracle reader that knows how to read from an external oracle account.",
        "Extracts a `value: u128` for reward calculations.",
      ],
      type: {
        kind: "enum",
        variants: [
          {
            name: "Time",
          },
          {
            name: "FutarchyTwap",
            fields: [
              {
                name: "amm",
                docs: [
                  "The Futarchy DAO account to read (contains embedded AMM)",
                ],
                type: "publicKey",
              },
              {
                name: "minDuration",
                docs: ["Minimum seconds between start and end"],
                type: "u32",
              },
              {
                name: "startValue",
                docs: ["Start snapshot (recorded on start_unlock)"],
                type: "u128",
              },
              {
                name: "startTime",
                type: "i64",
              },
              {
                name: "endValue",
                docs: ["End snapshot (recorded on complete_unlock)"],
                type: "u128",
              },
              {
                name: "endTime",
                type: "i64",
              },
            ],
          },
        ],
      },
    },
    {
      name: "RewardFunction",
      docs: [
        "Reward function that calculates cumulative rewards from oracle values.",
        "Returns total tokens deserved so far (not incremental).",
      ],
      type: {
        kind: "enum",
        variants: [
          {
            name: "CliffLinear",
            fields: [
              {
                name: "startValue",
                type: "u128",
              },
              {
                name: "cliffValue",
                type: "u128",
              },
              {
                name: "endValue",
                type: "u128",
              },
              {
                name: "cliffAmount",
                type: "u64",
              },
              {
                name: "totalAmount",
                docs: ["Total amount including cliff"],
                type: "u64",
              },
            ],
          },
          {
            name: "Threshold",
            fields: [
              {
                name: "tranches",
                docs: ["Must be sorted by threshold ascending"],
                type: {
                  vec: {
                    defined: "ThresholdTranche",
                  },
                },
              },
            ],
          },
        ],
      },
    },
  ],
  events: [
    {
      name: "PerformancePackageCreatedEvent",
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
          name: "mint",
          type: "publicKey",
          index: false,
        },
        {
          name: "mintGovernor",
          type: "publicKey",
          index: false,
        },
        {
          name: "authority",
          type: "publicKey",
          index: false,
        },
        {
          name: "recipient",
          type: "publicKey",
          index: false,
        },
        {
          name: "createKey",
          type: "publicKey",
          index: false,
        },
        {
          name: "pdaBump",
          type: "u8",
          index: false,
        },
      ],
    },
    {
      name: "UnlockStartedEvent",
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
          name: "startTime",
          type: "i64",
          index: false,
        },
      ],
    },
    {
      name: "UnlockCompletedEvent",
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
          name: "oracleValue",
          type: "u128",
          index: false,
        },
        {
          name: "recipient",
          type: "publicKey",
          index: false,
        },
        {
          name: "amountMinted",
          type: "u64",
          index: false,
        },
        {
          name: "totalRewardsPaidOut",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "AuthorityChangedEvent",
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
    {
      name: "ChangeProposedEvent",
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
          name: "proposerType",
          type: {
            defined: "ProposerType",
          },
          index: false,
        },
        {
          name: "pdaNonce",
          type: "u32",
          index: false,
        },
        {
          name: "newRecipient",
          type: {
            option: "publicKey",
          },
          index: false,
        },
        {
          name: "newOracleReader",
          type: {
            option: {
              defined: "OracleReader",
            },
          },
          index: false,
        },
        {
          name: "newRewardFunction",
          type: {
            option: {
              defined: "RewardFunction",
            },
          },
          index: false,
        },
      ],
    },
    {
      name: "ChangeExecutedEvent",
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
          name: "executedBy",
          type: "publicKey",
          index: false,
        },
        {
          name: "newRecipient",
          type: {
            option: "publicKey",
          },
          index: false,
        },
        {
          name: "newOracleReader",
          type: {
            option: {
              defined: "OracleReader",
            },
          },
          index: false,
        },
        {
          name: "newRewardFunction",
          type: {
            option: {
              defined: "RewardFunction",
            },
          },
          index: false,
        },
      ],
    },
    {
      name: "PerformancePackageClosedEvent",
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
          name: "totalRewardsPaidOut",
          type: "u64",
          index: false,
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "Unauthorized",
      msg: "Signer is neither authority nor recipient",
    },
    {
      code: 6001,
      name: "InvalidExecutor",
      msg: "Executor is not the opposite party from proposer",
    },
    {
      code: 6002,
      name: "InvalidAuthority",
      msg: "Signer is not the current authority",
    },
    {
      code: 6003,
      name: "InvalidAdmin",
      msg: "Signer is not the admin",
    },
    {
      code: 6004,
      name: "InvalidMintGovernor",
      msg: "Mint governor does not match the provided mint",
    },
    {
      code: 6005,
      name: "InvalidMintAuthority",
      msg: "Mint authority does not match expected configuration",
    },
    {
      code: 6006,
      name: "NotLocked",
      msg: "Expected Locked status",
    },
    {
      code: 6007,
      name: "NotUnlocking",
      msg: "Expected Unlocking status",
    },
    {
      code: 6008,
      name: "OracleMissingAccount",
      msg: "Expected remaining_accounts not provided",
    },
    {
      code: 6009,
      name: "OracleInvalidAccount",
      msg: "Account pubkey doesn't match expected",
    },
    {
      code: 6010,
      name: "OracleParseError",
      msg: "Failed to parse account data",
    },
    {
      code: 6011,
      name: "OracleInvalidState",
      msg: "Oracle state invalid",
    },
    {
      code: 6012,
      name: "OracleMinDurationNotReached",
      msg: "Minimum duration hasn't passed yet",
    },
    {
      code: 6013,
      name: "UnlockTimestampNotReached",
      msg: "Minimum unlock timestamp not yet reached",
    },
    {
      code: 6014,
      name: "RewardCalculationOverflow",
      msg: "Math overflow in reward function",
    },
    {
      code: 6015,
      name: "InvalidTranches",
      msg: "Tranches should be sorted and non-empty",
    },
    {
      code: 6016,
      name: "InvalidVestingSchedule",
      msg: "Invalid vesting schedule configuration",
    },
    {
      code: 6017,
      name: "ChangeRequestNotFound",
      msg: "Missing proposal for execute",
    },
    {
      code: 6018,
      name: "NoChangesProposed",
      msg: "All optional change fields are None",
    },
  ],
};
