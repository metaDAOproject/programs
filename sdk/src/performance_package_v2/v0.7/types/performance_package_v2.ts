/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/performance_package_v2.json`.
 */
export type PerformancePackageV2 = {
  address: "pPV2pfrxnmstSb9j7kEeCLny5BGj6SNwCWGd6xbGGzz";
  metadata: {
    name: "performancePackageV2";
    version: "0.7.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "changeAuthority";
      discriminator: [50, 106, 66, 104, 99, 118, 145, 88];
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
                path: "performance_package.create_key";
                account: "performancePackage";
              },
            ];
          };
        },
        {
          name: "authority";
          docs: ["Must be the current authority of the performance package"];
          signer: true;
          relations: ["performancePackage"];
        },
        {
          name: "newAuthority";
          docs: ["The new authority address"];
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
      name: "closePerformancePackage";
      discriminator: [166, 35, 29, 1, 172, 39, 254, 135];
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
                path: "performance_package.create_key";
                account: "performancePackage";
              },
            ];
          };
        },
        {
          name: "admin";
          signer: true;
        },
        {
          name: "rentDestination";
          writable: true;
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
      name: "completeUnlock";
      discriminator: [22, 203, 15, 189, 239, 125, 25, 132];
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
                path: "performance_package.create_key";
                account: "performancePackage";
              },
            ];
          };
        },
        {
          name: "mintGovernor";
          writable: true;
        },
        {
          name: "mintAuthority";
          writable: true;
        },
        {
          name: "mint";
          writable: true;
        },
        {
          name: "recipientAta";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "performance_package.recipient";
                account: "performancePackage";
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
                path: "mint";
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
          name: "signer";
          signer: true;
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "mintGovernorProgram";
          address: "gvnr27cVeyW3AVf3acL7VCJ5WjGAphytnsgcK1feHyH";
        },
        {
          name: "mintGovernorEventAuthority";
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
          name: "performancePackage";
          writable: true;
          relations: ["changeRequest"];
        },
        {
          name: "changeRequest";
          writable: true;
        },
        {
          name: "executor";
          signer: true;
        },
        {
          name: "rentDestination";
          writable: true;
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
          name: "mint";
          relations: ["mintGovernor"];
        },
        {
          name: "mintGovernor";
          relations: ["mintAuthority"];
        },
        {
          name: "mintAuthority";
        },
        {
          name: "createKey";
          signer: true;
        },
        {
          name: "authority";
        },
        {
          name: "recipient";
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
          name: "args";
          type: {
            defined: {
              name: "initializePerformancePackageArgs";
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
          name: "performancePackage";
          writable: true;
        },
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
                path: "args.pda_nonce";
              },
            ];
          };
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
          name: "args";
          type: {
            defined: {
              name: "proposeChangeArgs";
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
                path: "performance_package.create_key";
                account: "performancePackage";
              },
            ];
          };
        },
        {
          name: "signer";
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
  ];
  accounts: [
    {
      name: "changeRequest";
      discriminator: [75, 130, 166, 47, 15, 217, 131, 190];
    },
    {
      name: "mintAuthority";
      discriminator: [148, 0, 219, 228, 254, 237, 76, 128];
    },
    {
      name: "mintGovernor";
      discriminator: [110, 173, 19, 114, 217, 193, 37, 71];
    },
    {
      name: "performancePackage";
      discriminator: [228, 146, 174, 131, 121, 249, 99, 132];
    },
  ];
  events: [
    {
      name: "authorityChangedEvent";
      discriminator: [85, 105, 159, 188, 6, 44, 52, 28];
    },
    {
      name: "changeExecutedEvent";
      discriminator: [210, 68, 107, 108, 205, 125, 171, 37];
    },
    {
      name: "changeProposedEvent";
      discriminator: [235, 3, 116, 187, 11, 199, 254, 249];
    },
    {
      name: "performancePackageClosedEvent";
      discriminator: [6, 236, 112, 207, 221, 238, 59, 75];
    },
    {
      name: "performancePackageCreatedEvent";
      discriminator: [201, 17, 26, 145, 170, 42, 219, 154];
    },
    {
      name: "unlockCompletedEvent";
      discriminator: [218, 116, 8, 71, 184, 86, 230, 9];
    },
    {
      name: "unlockStartedEvent";
      discriminator: [143, 238, 115, 206, 153, 246, 44, 253];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "unauthorized";
      msg: "Signer is neither authority nor recipient";
    },
    {
      code: 6001;
      name: "invalidExecutor";
      msg: "Executor is not the opposite party from proposer";
    },
    {
      code: 6002;
      name: "invalidAuthority";
      msg: "Signer is not the current authority";
    },
    {
      code: 6003;
      name: "invalidAdmin";
      msg: "Signer is not the admin";
    },
    {
      code: 6004;
      name: "invalidMintGovernor";
      msg: "Mint governor does not match the provided mint";
    },
    {
      code: 6005;
      name: "invalidMintAuthority";
      msg: "Mint authority does not match expected configuration";
    },
    {
      code: 6006;
      name: "notLocked";
      msg: "Expected Locked status";
    },
    {
      code: 6007;
      name: "notUnlocking";
      msg: "Expected Unlocking status";
    },
    {
      code: 6008;
      name: "oracleMissingAccount";
      msg: "Expected remaining_accounts not provided";
    },
    {
      code: 6009;
      name: "oracleInvalidAccount";
      msg: "Account pubkey doesn't match expected";
    },
    {
      code: 6010;
      name: "oracleParseError";
      msg: "Failed to parse account data";
    },
    {
      code: 6011;
      name: "oracleInvalidState";
      msg: "Oracle state invalid";
    },
    {
      code: 6012;
      name: "oracleMinDurationNotReached";
      msg: "Minimum duration hasn't passed yet";
    },
    {
      code: 6013;
      name: "unlockTimestampNotReached";
      msg: "Minimum unlock timestamp not yet reached";
    },
    {
      code: 6014;
      name: "rewardCalculationOverflow";
      msg: "Math overflow in reward function";
    },
    {
      code: 6015;
      name: "invalidTranches";
      msg: "Tranches should be sorted and non-empty";
    },
    {
      code: 6016;
      name: "invalidVestingSchedule";
      msg: "Invalid vesting schedule configuration";
    },
    {
      code: 6017;
      name: "changeRequestNotFound";
      msg: "Missing proposal for execute";
    },
    {
      code: 6018;
      name: "noChangesProposed";
      msg: "All optional change fields are None";
    },
    {
      code: 6019;
      name: "minDurationTooLarge";
      msg: "min_duration exceeds maximum allowed (365 days)";
    },
    {
      code: 6020;
      name: "staleChangeRequest";
      msg: "Change request is stale: PP was recreated or the proposing party has changed";
    },
  ];
  types: [
    {
      name: "authorityChangedEvent";
      docs: ["Emitted by: `change_authority`"];
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
            name: "oldAuthority";
            type: "pubkey";
          },
          {
            name: "newAuthority";
            type: "pubkey";
          },
          {
            name: "ppCreatedAtTimestamp";
            type: "i64";
          },
        ];
      };
    },
    {
      name: "changeExecutedEvent";
      docs: ["Emitted by: `execute_change`"];
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
            name: "executedBy";
            type: "pubkey";
          },
          {
            name: "newRecipient";
            type: {
              option: "pubkey";
            };
          },
          {
            name: "newOracleReader";
            type: {
              option: {
                defined: {
                  name: "oracleReader";
                };
              };
            };
          },
          {
            name: "newRewardFunction";
            type: {
              option: {
                defined: {
                  name: "rewardFunction";
                };
              };
            };
          },
          {
            name: "changeRequest";
            docs: [
              "The ChangeRequest PDA that was executed (and closed) by this instruction",
            ];
            type: "pubkey";
          },
          {
            name: "ppCreatedAtTimestamp";
            type: "i64";
          },
        ];
      };
    },
    {
      name: "changeProposedEvent";
      docs: ["Emitted by: `propose_change`"];
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
            name: "proposer";
            type: "pubkey";
          },
          {
            name: "pdaNonce";
            type: "u32";
          },
          {
            name: "newRecipient";
            type: {
              option: "pubkey";
            };
          },
          {
            name: "newOracleReader";
            type: {
              option: {
                defined: {
                  name: "oracleReader";
                };
              };
            };
          },
          {
            name: "newRewardFunction";
            type: {
              option: {
                defined: {
                  name: "rewardFunction";
                };
              };
            };
          },
          {
            name: "ppCreatedAtTimestamp";
            docs: [
              "`PerformancePackage.created_at_timestamp` as stamped onto the ChangeRequest",
            ];
            type: "i64";
          },
        ];
      };
    },
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
            type: "pubkey";
          },
          {
            name: "proposer";
            docs: ["The proposer's pubkey at proposal time"];
            type: "pubkey";
          },
          {
            name: "ppCreatedAtTimestamp";
            docs: [
              "PP's created_at_timestamp at proposal time; used to detect stale CRs after close/recreate",
            ];
            type: "i64";
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
              option: "pubkey";
            };
          },
          {
            name: "newOracleReader";
            docs: ["New oracle configuration (if changing)"];
            type: {
              option: {
                defined: {
                  name: "oracleReader";
                };
              };
            };
          },
          {
            name: "newRewardFunction";
            docs: ["New reward function (if changing)"];
            type: {
              option: {
                defined: {
                  name: "rewardFunction";
                };
              };
            };
          },
        ];
      };
    },
    {
      name: "commonFields";
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
      name: "initializePerformancePackageArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "oracleReader";
            type: {
              defined: {
                name: "oracleReader";
              };
            };
          },
          {
            name: "rewardFunction";
            type: {
              defined: {
                name: "rewardFunction";
              };
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
      name: "mintAuthority";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mintGovernor";
            type: "pubkey";
          },
          {
            name: "authorizedMinter";
            type: "pubkey";
          },
          {
            name: "maxTotal";
            type: {
              option: "u64";
            };
          },
          {
            name: "totalMinted";
            type: "u64";
          },
          {
            name: "bump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "mintGovernor";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "admin";
            type: "pubkey";
          },
          {
            name: "createKey";
            type: "pubkey";
          },
          {
            name: "seqNum";
            type: "u64";
          },
          {
            name: "bump";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "oracleReader";
      docs: [
        "Oracle reader that knows how to read from an external oracle account.",
        "Extracts a `value: u128` for reward calculations.",
      ];
      type: {
        kind: "enum";
        variants: [
          {
            name: "time";
          },
          {
            name: "futarchyTwap";
            fields: [
              {
                name: "amm";
                docs: [
                  "The Futarchy DAO account to read (contains embedded AMM)",
                ];
                type: "pubkey";
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
      name: "packageStatus";
      docs: ["Lifecycle state for the performance package."];
      type: {
        kind: "enum";
        variants: [
          {
            name: "locked";
          },
          {
            name: "unlocking";
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
            type: "pubkey";
          },
          {
            name: "mintGovernor";
            docs: ["MintGovernor account"];
            type: "pubkey";
          },
          {
            name: "mintAuthority";
            docs: ["MintAuthority PDA for this PP"];
            type: "pubkey";
          },
          {
            name: "authority";
            docs: ["Usually the DAO multisig vault - can modify PP"];
            type: "pubkey";
          },
          {
            name: "recipient";
            docs: ["Usually the team multisig - receives minted tokens"];
            type: "pubkey";
          },
          {
            name: "oracleReader";
            docs: ["Stores start/end snapshots for oracle calculations"];
            type: {
              defined: {
                name: "oracleReader";
              };
            };
          },
          {
            name: "rewardFunction";
            docs: ["How to calculate rewards"];
            type: {
              defined: {
                name: "rewardFunction";
              };
            };
          },
          {
            name: "status";
            docs: ["Locked or Unlocking state"];
            type: {
              defined: {
                name: "packageStatus";
              };
            };
          },
          {
            name: "minUnlockTimestamp";
            docs: ["Can't start unlock before this time"];
            type: "i64";
          },
          {
            name: "createdAtTimestamp";
            docs: [
              "Timestamp when this PP was created; used to invalidate stale ChangeRequests",
            ];
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
            type: "pubkey";
          },
          {
            name: "bump";
            docs: ["PDA bump"];
            type: "u8";
          },
        ];
      };
    },
    {
      name: "performancePackageClosedEvent";
      docs: ["Emitted by: `close_performance_package`"];
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
            name: "totalRewardsPaidOut";
            docs: ["Final cumulative amount paid"];
            type: "u64";
          },
          {
            name: "ppCreatedAtTimestamp";
            type: "i64";
          },
        ];
      };
    },
    {
      name: "performancePackageCreatedEvent";
      docs: ["Emitted by: `initialize_performance_package`"];
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
            name: "mint";
            type: "pubkey";
          },
          {
            name: "mintGovernor";
            type: "pubkey";
          },
          {
            name: "authority";
            type: "pubkey";
          },
          {
            name: "recipient";
            type: "pubkey";
          },
          {
            name: "createKey";
            type: "pubkey";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
          {
            name: "oracleReader";
            type: {
              defined: {
                name: "oracleReader";
              };
            };
          },
          {
            name: "rewardFunction";
            type: {
              defined: {
                name: "rewardFunction";
              };
            };
          },
          {
            name: "minUnlockTimestamp";
            type: "i64";
          },
          {
            name: "ppCreatedAtTimestamp";
            type: "i64";
          },
        ];
      };
    },
    {
      name: "proposeChangeArgs";
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
              option: "pubkey";
            };
          },
          {
            name: "newOracleReader";
            type: {
              option: {
                defined: {
                  name: "oracleReader";
                };
              };
            };
          },
          {
            name: "newRewardFunction";
            type: {
              option: {
                defined: {
                  name: "rewardFunction";
                };
              };
            };
          },
        ];
      };
    },
    {
      name: "rewardFunction";
      docs: [
        "Reward function that calculates cumulative rewards from oracle values.",
        "Returns total tokens deserved so far (not incremental).",
      ];
      type: {
        kind: "enum";
        variants: [
          {
            name: "cliffLinear";
            fields: [
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
            name: "threshold";
            fields: [
              {
                name: "tranches";
                docs: ["Must be sorted by threshold ascending"];
                type: {
                  vec: {
                    defined: {
                      name: "thresholdTranche";
                    };
                  };
                };
              },
            ];
          },
        ];
      };
    },
    {
      name: "thresholdTranche";
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
      name: "unlockCompletedEvent";
      docs: ["Emitted by: `complete_unlock`"];
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
            name: "oracleValue";
            type: "u128";
          },
          {
            name: "recipient";
            type: "pubkey";
          },
          {
            name: "amountMinted";
            type: "u64";
          },
          {
            name: "totalRewardsPaidOut";
            docs: ["Cumulative after this unlock"];
            type: "u64";
          },
          {
            name: "ppCreatedAtTimestamp";
            type: "i64";
          },
        ];
      };
    },
    {
      name: "unlockStartedEvent";
      docs: ["Emitted by: `start_unlock`"];
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
            name: "startTime";
            type: "i64";
          },
          {
            name: "startOracleValue";
            type: "u128";
          },
          {
            name: "ppCreatedAtTimestamp";
            type: "i64";
          },
        ];
      };
    },
  ];
  constants: [
    {
      name: "maxMinDuration";
      type: "u32";
      value: "31536000";
    },
  ];
};
