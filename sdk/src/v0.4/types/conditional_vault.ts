export type ConditionalVault = {
  version: "0.4.0";
  name: "conditional_vault";
  instructions: [
    {
      name: "initializeQuestion";
      accounts: [
        {
          name: "question";
          isMut: true;
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
        {
          name: "eventAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "program";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "InitializeQuestionArgs";
          };
        }
      ];
    },
    {
      name: "resolveQuestion";
      accounts: [
        {
          name: "question";
          isMut: true;
          isSigner: false;
        },
        {
          name: "oracle";
          isMut: false;
          isSigner: true;
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
        }
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "ResolveQuestionArgs";
          };
        }
      ];
    },
    {
      name: "initializeConditionalVault";
      accounts: [
        {
          name: "vault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "question";
          isMut: false;
          isSigner: false;
        },
        {
          name: "underlyingTokenMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          isMut: false;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
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
        }
      ];
      args: [];
    },
    {
      name: "splitTokens";
      accounts: [
        {
          name: "question";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "userUnderlyingTokenAccount";
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
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        }
      ];
    },
    {
      name: "mergeTokens";
      accounts: [
        {
          name: "question";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "userUnderlyingTokenAccount";
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
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        }
      ];
    },
    {
      name: "redeemTokens";
      accounts: [
        {
          name: "question";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "userUnderlyingTokenAccount";
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
        }
      ];
      args: [];
    },
    {
      name: "addMetadataToConditionalTokens";
      accounts: [
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "vault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "conditionalTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "conditionalTokenMetadata";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenMetadataProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
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
        }
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "AddMetadataToConditionalTokensArgs";
          };
        }
      ];
    }
  ];
  accounts: [
    {
      name: "conditionalVault";
      type: {
        kind: "struct";
        fields: [
          {
            name: "question";
            type: "publicKey";
          },
          {
            name: "underlyingTokenMint";
            type: "publicKey";
          },
          {
            name: "underlyingTokenAccount";
            type: "publicKey";
          },
          {
            name: "conditionalTokenMints";
            type: {
              vec: "publicKey";
            };
          },
          {
            name: "pdaBump";
            type: "u8";
          },
          {
            name: "decimals";
            type: "u8";
          },
          {
            name: "seqNum";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "question";
      docs: [
        "Questions represent statements about future events.",
        "",
        "These statements include:",
        '- "Will this proposal pass?"',
        '- "Who, if anyone, will be hired?"',
        '- "How effective will the grant committee deem this grant?"',
        "",
        'Questions have 2 or more possible outcomes. For a question like "will this',
        'proposal pass," the outcomes are "yes" and "no." For a question like "who',
        'will be hired," the outcomes could be "Alice," "Bob," and "neither."',
        "",
        'Outcomes resolve to a number between 0 and 1. Binary questions like "will',
        'this proposal pass" have outcomes that resolve to exactly 0 or 1. You can',
        'also have questions with scalar outcomes. For example, the question "how',
        'effective will the grant committee deem this grant" could have two outcomes:',
        '"ineffective" and "effective." If the grant committee deems the grant 70%',
        'effective, the "effective" outcome would resolve to 0.7 and the "ineffective"',
        "outcome would resolve to 0.3.",
        "",
        "Once resolved, the sum of all outcome resolutions is exactly 1."
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "questionId";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "oracle";
            type: "publicKey";
          },
          {
            name: "payoutNumerators";
            type: {
              vec: "u32";
            };
          },
          {
            name: "payoutDenominator";
            type: "u32";
          }
        ];
      };
    }
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
          }
        ];
      };
    },
    {
      name: "AddMetadataToConditionalTokensArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "name";
            type: "string";
          },
          {
            name: "symbol";
            type: "string";
          },
          {
            name: "uri";
            type: "string";
          }
        ];
      };
    },
    {
      name: "InitializeQuestionArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "questionId";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "oracle";
            type: "publicKey";
          },
          {
            name: "numOutcomes";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "ResolveQuestionArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "payoutNumerators";
            type: {
              vec: "u32";
            };
          }
        ];
      };
    },
    {
      name: "VaultStatus";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Active";
          },
          {
            name: "Finalized";
          },
          {
            name: "Reverted";
          }
        ];
      };
    }
  ];
  events: [
    {
      name: "AddMetadataToConditionalTokensEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "vault";
          type: "publicKey";
          index: false;
        },
        {
          name: "conditionalTokenMint";
          type: "publicKey";
          index: false;
        },
        {
          name: "conditionalTokenMetadata";
          type: "publicKey";
          index: false;
        },
        {
          name: "name";
          type: "string";
          index: false;
        },
        {
          name: "symbol";
          type: "string";
          index: false;
        },
        {
          name: "uri";
          type: "string";
          index: false;
        },
        {
          name: "seqNum";
          type: "u64";
          index: false;
        }
      ];
    },
    {
      name: "InitializeConditionalVaultEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "vault";
          type: "publicKey";
          index: false;
        },
        {
          name: "question";
          type: "publicKey";
          index: false;
        },
        {
          name: "underlyingTokenMint";
          type: "publicKey";
          index: false;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          type: "publicKey";
          index: false;
        },
        {
          name: "conditionalTokenMints";
          type: {
            vec: "publicKey";
          };
          index: false;
        },
        {
          name: "pdaBump";
          type: "u8";
          index: false;
        },
        {
          name: "seqNum";
          type: "u64";
          index: false;
        }
      ];
    },
    {
      name: "InitializeQuestionEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "questionId";
          type: {
            array: ["u8", 32];
          };
          index: false;
        },
        {
          name: "oracle";
          type: "publicKey";
          index: false;
        },
        {
          name: "numOutcomes";
          type: "u8";
          index: false;
        },
        {
          name: "question";
          type: "publicKey";
          index: false;
        }
      ];
    },
    {
      name: "MergeTokensEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "user";
          type: "publicKey";
          index: false;
        },
        {
          name: "vault";
          type: "publicKey";
          index: false;
        },
        {
          name: "amount";
          type: "u64";
          index: false;
        },
        {
          name: "postUserUnderlyingBalance";
          type: "u64";
          index: false;
        },
        {
          name: "postVaultUnderlyingBalance";
          type: "u64";
          index: false;
        },
        {
          name: "postUserConditionalTokenBalances";
          type: {
            vec: "u64";
          };
          index: false;
        },
        {
          name: "postConditionalTokenSupplies";
          type: {
            vec: "u64";
          };
          index: false;
        },
        {
          name: "seqNum";
          type: "u64";
          index: false;
        }
      ];
    },
    {
      name: "RedeemTokensEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "user";
          type: "publicKey";
          index: false;
        },
        {
          name: "vault";
          type: "publicKey";
          index: false;
        },
        {
          name: "amount";
          type: "u64";
          index: false;
        },
        {
          name: "postUserUnderlyingBalance";
          type: "u64";
          index: false;
        },
        {
          name: "postVaultUnderlyingBalance";
          type: "u64";
          index: false;
        },
        {
          name: "postConditionalTokenSupplies";
          type: {
            vec: "u64";
          };
          index: false;
        },
        {
          name: "seqNum";
          type: "u64";
          index: false;
        }
      ];
    },
    {
      name: "ResolveQuestionEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "question";
          type: "publicKey";
          index: false;
        },
        {
          name: "payoutNumerators";
          type: {
            vec: "u32";
          };
          index: false;
        }
      ];
    },
    {
      name: "SplitTokensEvent";
      fields: [
        {
          name: "common";
          type: {
            defined: "CommonFields";
          };
          index: false;
        },
        {
          name: "user";
          type: "publicKey";
          index: false;
        },
        {
          name: "vault";
          type: "publicKey";
          index: false;
        },
        {
          name: "amount";
          type: "u64";
          index: false;
        },
        {
          name: "postUserUnderlyingBalance";
          type: "u64";
          index: false;
        },
        {
          name: "postVaultUnderlyingBalance";
          type: "u64";
          index: false;
        },
        {
          name: "postUserConditionalTokenBalances";
          type: {
            vec: "u64";
          };
          index: false;
        },
        {
          name: "postConditionalTokenSupplies";
          type: {
            vec: "u64";
          };
          index: false;
        },
        {
          name: "seqNum";
          type: "u64";
          index: false;
        }
      ];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "AssertFailed";
      msg: "An assertion failed";
    },
    {
      code: 6001;
      name: "InsufficientUnderlyingTokens";
      msg: "Insufficient underlying token balance to mint this amount of conditional tokens";
    },
    {
      code: 6002;
      name: "InsufficientConditionalTokens";
      msg: "Insufficient conditional token balance to merge this `amount`";
    },
    {
      code: 6003;
      name: "InvalidVaultUnderlyingTokenAccount";
      msg: "This `vault_underlying_token_account` is not this vault's `underlying_token_account`";
    },
    {
      code: 6004;
      name: "InvalidConditionalTokenMint";
      msg: "This conditional token mint is not this vault's conditional token mint";
    },
    {
      code: 6005;
      name: "CantRedeemConditionalTokens";
      msg: "Question needs to be resolved before users can redeem conditional tokens for underlying tokens";
    },
    {
      code: 6006;
      name: "InsufficientNumConditions";
      msg: "Questions need 2 or more conditions";
    },
    {
      code: 6007;
      name: "InvalidNumPayoutNumerators";
      msg: "Invalid number of payout numerators";
    },
    {
      code: 6008;
      name: "InvalidConditionals";
      msg: "Client needs to pass in the list of conditional mints for a vault followed by the user's token accounts for those tokens";
    },
    {
      code: 6009;
      name: "ConditionalMintMismatch";
      msg: "Conditional mint not in vault";
    },
    {
      code: 6010;
      name: "BadConditionalMint";
      msg: "Unable to deserialize a conditional token mint";
    },
    {
      code: 6011;
      name: "BadConditionalTokenAccount";
      msg: "Unable to deserialize a conditional token account";
    },
    {
      code: 6012;
      name: "ConditionalTokenMintMismatch";
      msg: "User conditional token account mint does not match conditional mint";
    },
    {
      code: 6013;
      name: "PayoutZero";
      msg: "Payouts must sum to 1 or more";
    },
    {
      code: 6014;
      name: "QuestionAlreadyResolved";
      msg: "Question already resolved";
    },
    {
      code: 6015;
      name: "ConditionalTokenMetadataAlreadySet";
      msg: "Conditional token metadata already set";
    }
  ];
};

export const IDL: ConditionalVault = {
  version: "0.4.0",
  name: "conditional_vault",
  instructions: [
    {
      name: "initializeQuestion",
      accounts: [
        {
          name: "question",
          isMut: true,
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
            defined: "InitializeQuestionArgs",
          },
        },
      ],
    },
    {
      name: "resolveQuestion",
      accounts: [
        {
          name: "question",
          isMut: true,
          isSigner: false,
        },
        {
          name: "oracle",
          isMut: false,
          isSigner: true,
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
            defined: "ResolveQuestionArgs",
          },
        },
      ],
    },
    {
      name: "initializeConditionalVault",
      accounts: [
        {
          name: "vault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "question",
          isMut: false,
          isSigner: false,
        },
        {
          name: "underlyingTokenMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vaultUnderlyingTokenAccount",
          isMut: false,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
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
      name: "splitTokens",
      accounts: [
        {
          name: "question",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vaultUnderlyingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "userUnderlyingTokenAccount",
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
      args: [
        {
          name: "amount",
          type: "u64",
        },
      ],
    },
    {
      name: "mergeTokens",
      accounts: [
        {
          name: "question",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vaultUnderlyingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "userUnderlyingTokenAccount",
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
      args: [
        {
          name: "amount",
          type: "u64",
        },
      ],
    },
    {
      name: "redeemTokens",
      accounts: [
        {
          name: "question",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vaultUnderlyingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "userUnderlyingTokenAccount",
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
    {
      name: "addMetadataToConditionalTokens",
      accounts: [
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "vault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "conditionalTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "conditionalTokenMetadata",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenMetadataProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
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
            defined: "AddMetadataToConditionalTokensArgs",
          },
        },
      ],
    },
  ],
  accounts: [
    {
      name: "conditionalVault",
      type: {
        kind: "struct",
        fields: [
          {
            name: "question",
            type: "publicKey",
          },
          {
            name: "underlyingTokenMint",
            type: "publicKey",
          },
          {
            name: "underlyingTokenAccount",
            type: "publicKey",
          },
          {
            name: "conditionalTokenMints",
            type: {
              vec: "publicKey",
            },
          },
          {
            name: "pdaBump",
            type: "u8",
          },
          {
            name: "decimals",
            type: "u8",
          },
          {
            name: "seqNum",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "question",
      docs: [
        "Questions represent statements about future events.",
        "",
        "These statements include:",
        '- "Will this proposal pass?"',
        '- "Who, if anyone, will be hired?"',
        '- "How effective will the grant committee deem this grant?"',
        "",
        'Questions have 2 or more possible outcomes. For a question like "will this',
        'proposal pass," the outcomes are "yes" and "no." For a question like "who',
        'will be hired," the outcomes could be "Alice," "Bob," and "neither."',
        "",
        'Outcomes resolve to a number between 0 and 1. Binary questions like "will',
        'this proposal pass" have outcomes that resolve to exactly 0 or 1. You can',
        'also have questions with scalar outcomes. For example, the question "how',
        'effective will the grant committee deem this grant" could have two outcomes:',
        '"ineffective" and "effective." If the grant committee deems the grant 70%',
        'effective, the "effective" outcome would resolve to 0.7 and the "ineffective"',
        "outcome would resolve to 0.3.",
        "",
        "Once resolved, the sum of all outcome resolutions is exactly 1.",
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "questionId",
            type: {
              array: ["u8", 32],
            },
          },
          {
            name: "oracle",
            type: "publicKey",
          },
          {
            name: "payoutNumerators",
            type: {
              vec: "u32",
            },
          },
          {
            name: "payoutDenominator",
            type: "u32",
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
        ],
      },
    },
    {
      name: "AddMetadataToConditionalTokensArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "name",
            type: "string",
          },
          {
            name: "symbol",
            type: "string",
          },
          {
            name: "uri",
            type: "string",
          },
        ],
      },
    },
    {
      name: "InitializeQuestionArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "questionId",
            type: {
              array: ["u8", 32],
            },
          },
          {
            name: "oracle",
            type: "publicKey",
          },
          {
            name: "numOutcomes",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "ResolveQuestionArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "payoutNumerators",
            type: {
              vec: "u32",
            },
          },
        ],
      },
    },
    {
      name: "VaultStatus",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Active",
          },
          {
            name: "Finalized",
          },
          {
            name: "Reverted",
          },
        ],
      },
    },
  ],
  events: [
    {
      name: "AddMetadataToConditionalTokensEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "vault",
          type: "publicKey",
          index: false,
        },
        {
          name: "conditionalTokenMint",
          type: "publicKey",
          index: false,
        },
        {
          name: "conditionalTokenMetadata",
          type: "publicKey",
          index: false,
        },
        {
          name: "name",
          type: "string",
          index: false,
        },
        {
          name: "symbol",
          type: "string",
          index: false,
        },
        {
          name: "uri",
          type: "string",
          index: false,
        },
        {
          name: "seqNum",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "InitializeConditionalVaultEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "vault",
          type: "publicKey",
          index: false,
        },
        {
          name: "question",
          type: "publicKey",
          index: false,
        },
        {
          name: "underlyingTokenMint",
          type: "publicKey",
          index: false,
        },
        {
          name: "vaultUnderlyingTokenAccount",
          type: "publicKey",
          index: false,
        },
        {
          name: "conditionalTokenMints",
          type: {
            vec: "publicKey",
          },
          index: false,
        },
        {
          name: "pdaBump",
          type: "u8",
          index: false,
        },
        {
          name: "seqNum",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "InitializeQuestionEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "questionId",
          type: {
            array: ["u8", 32],
          },
          index: false,
        },
        {
          name: "oracle",
          type: "publicKey",
          index: false,
        },
        {
          name: "numOutcomes",
          type: "u8",
          index: false,
        },
        {
          name: "question",
          type: "publicKey",
          index: false,
        },
      ],
    },
    {
      name: "MergeTokensEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "user",
          type: "publicKey",
          index: false,
        },
        {
          name: "vault",
          type: "publicKey",
          index: false,
        },
        {
          name: "amount",
          type: "u64",
          index: false,
        },
        {
          name: "postUserUnderlyingBalance",
          type: "u64",
          index: false,
        },
        {
          name: "postVaultUnderlyingBalance",
          type: "u64",
          index: false,
        },
        {
          name: "postUserConditionalTokenBalances",
          type: {
            vec: "u64",
          },
          index: false,
        },
        {
          name: "postConditionalTokenSupplies",
          type: {
            vec: "u64",
          },
          index: false,
        },
        {
          name: "seqNum",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "RedeemTokensEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "user",
          type: "publicKey",
          index: false,
        },
        {
          name: "vault",
          type: "publicKey",
          index: false,
        },
        {
          name: "amount",
          type: "u64",
          index: false,
        },
        {
          name: "postUserUnderlyingBalance",
          type: "u64",
          index: false,
        },
        {
          name: "postVaultUnderlyingBalance",
          type: "u64",
          index: false,
        },
        {
          name: "postConditionalTokenSupplies",
          type: {
            vec: "u64",
          },
          index: false,
        },
        {
          name: "seqNum",
          type: "u64",
          index: false,
        },
      ],
    },
    {
      name: "ResolveQuestionEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "question",
          type: "publicKey",
          index: false,
        },
        {
          name: "payoutNumerators",
          type: {
            vec: "u32",
          },
          index: false,
        },
      ],
    },
    {
      name: "SplitTokensEvent",
      fields: [
        {
          name: "common",
          type: {
            defined: "CommonFields",
          },
          index: false,
        },
        {
          name: "user",
          type: "publicKey",
          index: false,
        },
        {
          name: "vault",
          type: "publicKey",
          index: false,
        },
        {
          name: "amount",
          type: "u64",
          index: false,
        },
        {
          name: "postUserUnderlyingBalance",
          type: "u64",
          index: false,
        },
        {
          name: "postVaultUnderlyingBalance",
          type: "u64",
          index: false,
        },
        {
          name: "postUserConditionalTokenBalances",
          type: {
            vec: "u64",
          },
          index: false,
        },
        {
          name: "postConditionalTokenSupplies",
          type: {
            vec: "u64",
          },
          index: false,
        },
        {
          name: "seqNum",
          type: "u64",
          index: false,
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "AssertFailed",
      msg: "An assertion failed",
    },
    {
      code: 6001,
      name: "InsufficientUnderlyingTokens",
      msg: "Insufficient underlying token balance to mint this amount of conditional tokens",
    },
    {
      code: 6002,
      name: "InsufficientConditionalTokens",
      msg: "Insufficient conditional token balance to merge this `amount`",
    },
    {
      code: 6003,
      name: "InvalidVaultUnderlyingTokenAccount",
      msg: "This `vault_underlying_token_account` is not this vault's `underlying_token_account`",
    },
    {
      code: 6004,
      name: "InvalidConditionalTokenMint",
      msg: "This conditional token mint is not this vault's conditional token mint",
    },
    {
      code: 6005,
      name: "CantRedeemConditionalTokens",
      msg: "Question needs to be resolved before users can redeem conditional tokens for underlying tokens",
    },
    {
      code: 6006,
      name: "InsufficientNumConditions",
      msg: "Questions need 2 or more conditions",
    },
    {
      code: 6007,
      name: "InvalidNumPayoutNumerators",
      msg: "Invalid number of payout numerators",
    },
    {
      code: 6008,
      name: "InvalidConditionals",
      msg: "Client needs to pass in the list of conditional mints for a vault followed by the user's token accounts for those tokens",
    },
    {
      code: 6009,
      name: "ConditionalMintMismatch",
      msg: "Conditional mint not in vault",
    },
    {
      code: 6010,
      name: "BadConditionalMint",
      msg: "Unable to deserialize a conditional token mint",
    },
    {
      code: 6011,
      name: "BadConditionalTokenAccount",
      msg: "Unable to deserialize a conditional token account",
    },
    {
      code: 6012,
      name: "ConditionalTokenMintMismatch",
      msg: "User conditional token account mint does not match conditional mint",
    },
    {
      code: 6013,
      name: "PayoutZero",
      msg: "Payouts must sum to 1 or more",
    },
    {
      code: 6014,
      name: "QuestionAlreadyResolved",
      msg: "Question already resolved",
    },
    {
      code: 6015,
      name: "ConditionalTokenMetadataAlreadySet",
      msg: "Conditional token metadata already set",
    },
  ],
};
