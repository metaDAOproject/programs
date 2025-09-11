export type ConditionalVault = {
  version: "0.3.0";
  name: "conditional_vault";
  instructions: [
    {
      name: "initializeConditionalVault";
      accounts: [
        {
          name: "vault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "underlyingTokenMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "conditionalOnFinalizeTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "conditionalOnRevertTokenMint";
          isMut: true;
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
        }
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "InitializeConditionalVaultArgs";
          };
        }
      ];
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
          name: "underlyingTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "underlyingTokenMetadata";
          isMut: false;
          isSigner: false;
        },
        {
          name: "conditionalOnFinalizeTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "conditionalOnRevertTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "conditionalOnFinalizeTokenMetadata";
          isMut: true;
          isSigner: false;
        },
        {
          name: "conditionalOnRevertTokenMetadata";
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
    },
    {
      name: "settleConditionalVault";
      accounts: [
        {
          name: "settlementAuthority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "vault";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "newStatus";
          type: {
            defined: "VaultStatus";
          };
        }
      ];
    },
    {
      name: "mergeConditionalTokensForUnderlyingTokens";
      accounts: [
        {
          name: "vault";
          isMut: false;
          isSigner: false;
        },
        {
          name: "conditionalOnFinalizeTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "conditionalOnRevertTokenMint";
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
          name: "userConditionalOnFinalizeTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userConditionalOnRevertTokenAccount";
          isMut: true;
          isSigner: false;
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
      name: "mintConditionalTokens";
      accounts: [
        {
          name: "vault";
          isMut: false;
          isSigner: false;
        },
        {
          name: "conditionalOnFinalizeTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "conditionalOnRevertTokenMint";
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
          name: "userConditionalOnFinalizeTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userConditionalOnRevertTokenAccount";
          isMut: true;
          isSigner: false;
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
      name: "redeemConditionalTokensForUnderlyingTokens";
      accounts: [
        {
          name: "vault";
          isMut: false;
          isSigner: false;
        },
        {
          name: "conditionalOnFinalizeTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "conditionalOnRevertTokenMint";
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
          name: "userConditionalOnFinalizeTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userConditionalOnRevertTokenAccount";
          isMut: true;
          isSigner: false;
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
        }
      ];
      args: [];
    }
  ];
  accounts: [
    {
      name: "conditionalVault";
      type: {
        kind: "struct";
        fields: [
          {
            name: "status";
            type: {
              defined: "VaultStatus";
            };
          },
          {
            name: "settlementAuthority";
            docs: [
              "The account that can either finalize the vault to make conditional tokens",
              "redeemable for underlying tokens or revert the vault to make deposit",
              "slips redeemable for underlying tokens."
            ];
            type: "publicKey";
          },
          {
            name: "underlyingTokenMint";
            docs: ["The mint of the tokens that are deposited into the vault."];
            type: "publicKey";
          },
          {
            name: "underlyingTokenAccount";
            docs: ["The vault's storage account for deposited funds."];
            type: "publicKey";
          },
          {
            name: "conditionalOnFinalizeTokenMint";
            type: "publicKey";
          },
          {
            name: "conditionalOnRevertTokenMint";
            type: "publicKey";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
          {
            name: "decimals";
            type: "u8";
          }
        ];
      };
    }
  ];
  types: [
    {
      name: "AddMetadataToConditionalTokensArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "proposalNumber";
            type: "u64";
          },
          {
            name: "onFinalizeUri";
            type: "string";
          },
          {
            name: "onRevertUri";
            type: "string";
          }
        ];
      };
    },
    {
      name: "InitializeConditionalVaultArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "settlementAuthority";
            type: "publicKey";
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
  errors: [
    {
      code: 6000;
      name: "InsufficientUnderlyingTokens";
      msg: "Insufficient underlying token balance to mint this amount of conditional tokens";
    },
    {
      code: 6001;
      name: "InvalidVaultUnderlyingTokenAccount";
      msg: "This `vault_underlying_token_account` is not this vault's `underlying_token_account`";
    },
    {
      code: 6002;
      name: "InvalidConditionalTokenMint";
      msg: "This conditional token mint is not this vault's conditional token mint";
    },
    {
      code: 6003;
      name: "CantRedeemConditionalTokens";
      msg: "Vault needs to be settled as finalized before users can redeem conditional tokens for underlying tokens";
    },
    {
      code: 6004;
      name: "VaultAlreadySettled";
      msg: "Once a vault has been settled, its status as either finalized or reverted cannot be changed";
    }
  ];
};

export const IDL: ConditionalVault = {
  version: "0.3.0",
  name: "conditional_vault",
  instructions: [
    {
      name: "initializeConditionalVault",
      accounts: [
        {
          name: "vault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "underlyingTokenMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "conditionalOnFinalizeTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "conditionalOnRevertTokenMint",
          isMut: true,
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
      ],
      args: [
        {
          name: "args",
          type: {
            defined: "InitializeConditionalVaultArgs",
          },
        },
      ],
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
          name: "underlyingTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "underlyingTokenMetadata",
          isMut: false,
          isSigner: false,
        },
        {
          name: "conditionalOnFinalizeTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "conditionalOnRevertTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "conditionalOnFinalizeTokenMetadata",
          isMut: true,
          isSigner: false,
        },
        {
          name: "conditionalOnRevertTokenMetadata",
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
    {
      name: "settleConditionalVault",
      accounts: [
        {
          name: "settlementAuthority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "vault",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "newStatus",
          type: {
            defined: "VaultStatus",
          },
        },
      ],
    },
    {
      name: "mergeConditionalTokensForUnderlyingTokens",
      accounts: [
        {
          name: "vault",
          isMut: false,
          isSigner: false,
        },
        {
          name: "conditionalOnFinalizeTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "conditionalOnRevertTokenMint",
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
          name: "userConditionalOnFinalizeTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userConditionalOnRevertTokenAccount",
          isMut: true,
          isSigner: false,
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
      ],
      args: [
        {
          name: "amount",
          type: "u64",
        },
      ],
    },
    {
      name: "mintConditionalTokens",
      accounts: [
        {
          name: "vault",
          isMut: false,
          isSigner: false,
        },
        {
          name: "conditionalOnFinalizeTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "conditionalOnRevertTokenMint",
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
          name: "userConditionalOnFinalizeTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userConditionalOnRevertTokenAccount",
          isMut: true,
          isSigner: false,
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
      ],
      args: [
        {
          name: "amount",
          type: "u64",
        },
      ],
    },
    {
      name: "redeemConditionalTokensForUnderlyingTokens",
      accounts: [
        {
          name: "vault",
          isMut: false,
          isSigner: false,
        },
        {
          name: "conditionalOnFinalizeTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "conditionalOnRevertTokenMint",
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
          name: "userConditionalOnFinalizeTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userConditionalOnRevertTokenAccount",
          isMut: true,
          isSigner: false,
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
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "conditionalVault",
      type: {
        kind: "struct",
        fields: [
          {
            name: "status",
            type: {
              defined: "VaultStatus",
            },
          },
          {
            name: "settlementAuthority",
            docs: [
              "The account that can either finalize the vault to make conditional tokens",
              "redeemable for underlying tokens or revert the vault to make deposit",
              "slips redeemable for underlying tokens.",
            ],
            type: "publicKey",
          },
          {
            name: "underlyingTokenMint",
            docs: ["The mint of the tokens that are deposited into the vault."],
            type: "publicKey",
          },
          {
            name: "underlyingTokenAccount",
            docs: ["The vault's storage account for deposited funds."],
            type: "publicKey",
          },
          {
            name: "conditionalOnFinalizeTokenMint",
            type: "publicKey",
          },
          {
            name: "conditionalOnRevertTokenMint",
            type: "publicKey",
          },
          {
            name: "pdaBump",
            type: "u8",
          },
          {
            name: "decimals",
            type: "u8",
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "AddMetadataToConditionalTokensArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "proposalNumber",
            type: "u64",
          },
          {
            name: "onFinalizeUri",
            type: "string",
          },
          {
            name: "onRevertUri",
            type: "string",
          },
        ],
      },
    },
    {
      name: "InitializeConditionalVaultArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "settlementAuthority",
            type: "publicKey",
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
  errors: [
    {
      code: 6000,
      name: "InsufficientUnderlyingTokens",
      msg: "Insufficient underlying token balance to mint this amount of conditional tokens",
    },
    {
      code: 6001,
      name: "InvalidVaultUnderlyingTokenAccount",
      msg: "This `vault_underlying_token_account` is not this vault's `underlying_token_account`",
    },
    {
      code: 6002,
      name: "InvalidConditionalTokenMint",
      msg: "This conditional token mint is not this vault's conditional token mint",
    },
    {
      code: 6003,
      name: "CantRedeemConditionalTokens",
      msg: "Vault needs to be settled as finalized before users can redeem conditional tokens for underlying tokens",
    },
    {
      code: 6004,
      name: "VaultAlreadySettled",
      msg: "Once a vault has been settled, its status as either finalized or reverted cannot be changed",
    },
  ],
};
