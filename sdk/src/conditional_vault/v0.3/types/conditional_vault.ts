/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL was converted from the legacy format with `anchor idl convert` and lives in
 * the `.json` file next to this one.
 */
export type ConditionalVault = {
  address: "VAU1T7S5UuEHmMvXtXMVmpEoQtZ2ya7eRb7gcN47wDp";
  metadata: {
    name: "conditionalVault";
    version: "0.3.0";
    spec: "0.1.0";
  };
  instructions: [
    {
      name: "initializeConditionalVault";
      discriminator: [37, 88, 250, 212, 54, 218, 227, 175];
      accounts: [
        {
          name: "vault";
          writable: true;
        },
        {
          name: "underlyingTokenMint";
        },
        {
          name: "conditionalOnFinalizeTokenMint";
          writable: true;
        },
        {
          name: "conditionalOnRevertTokenMint";
          writable: true;
        },
        {
          name: "vaultUnderlyingTokenAccount";
        },
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "tokenProgram";
        },
        {
          name: "associatedTokenProgram";
        },
        {
          name: "systemProgram";
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "initializeConditionalVaultArgs";
            };
          };
        },
      ];
    },
    {
      name: "addMetadataToConditionalTokens";
      discriminator: [133, 20, 169, 231, 114, 112, 45, 1];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "vault";
          writable: true;
        },
        {
          name: "underlyingTokenMint";
          writable: true;
        },
        {
          name: "underlyingTokenMetadata";
        },
        {
          name: "conditionalOnFinalizeTokenMint";
          writable: true;
        },
        {
          name: "conditionalOnRevertTokenMint";
          writable: true;
        },
        {
          name: "conditionalOnFinalizeTokenMetadata";
          writable: true;
        },
        {
          name: "conditionalOnRevertTokenMetadata";
          writable: true;
        },
        {
          name: "tokenMetadataProgram";
        },
        {
          name: "systemProgram";
        },
        {
          name: "rent";
        },
      ];
      args: [
        {
          name: "args";
          type: {
            defined: {
              name: "addMetadataToConditionalTokensArgs";
            };
          };
        },
      ];
    },
    {
      name: "settleConditionalVault";
      discriminator: [119, 121, 76, 31, 130, 158, 252, 103];
      accounts: [
        {
          name: "settlementAuthority";
          signer: true;
        },
        {
          name: "vault";
          writable: true;
        },
      ];
      args: [
        {
          name: "newStatus";
          type: {
            defined: {
              name: "vaultStatus";
            };
          };
        },
      ];
    },
    {
      name: "mergeConditionalTokensForUnderlyingTokens";
      discriminator: [217, 250, 121, 158, 129, 16, 63, 240];
      accounts: [
        {
          name: "vault";
        },
        {
          name: "conditionalOnFinalizeTokenMint";
          writable: true;
        },
        {
          name: "conditionalOnRevertTokenMint";
          writable: true;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "authority";
          signer: true;
        },
        {
          name: "userConditionalOnFinalizeTokenAccount";
          writable: true;
        },
        {
          name: "userConditionalOnRevertTokenAccount";
          writable: true;
        },
        {
          name: "userUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "tokenProgram";
        },
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        },
      ];
    },
    {
      name: "mintConditionalTokens";
      discriminator: [63, 20, 202, 25, 179, 103, 54, 128];
      accounts: [
        {
          name: "vault";
        },
        {
          name: "conditionalOnFinalizeTokenMint";
          writable: true;
        },
        {
          name: "conditionalOnRevertTokenMint";
          writable: true;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "authority";
          signer: true;
        },
        {
          name: "userConditionalOnFinalizeTokenAccount";
          writable: true;
        },
        {
          name: "userConditionalOnRevertTokenAccount";
          writable: true;
        },
        {
          name: "userUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "tokenProgram";
        },
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        },
      ];
    },
    {
      name: "redeemConditionalTokensForUnderlyingTokens";
      discriminator: [88, 122, 227, 150, 217, 183, 89, 81];
      accounts: [
        {
          name: "vault";
        },
        {
          name: "conditionalOnFinalizeTokenMint";
          writable: true;
        },
        {
          name: "conditionalOnRevertTokenMint";
          writable: true;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "authority";
          signer: true;
        },
        {
          name: "userConditionalOnFinalizeTokenAccount";
          writable: true;
        },
        {
          name: "userConditionalOnRevertTokenAccount";
          writable: true;
        },
        {
          name: "userUnderlyingTokenAccount";
          writable: true;
        },
        {
          name: "tokenProgram";
        },
      ];
      args: [];
    },
  ];
  accounts: [
    {
      name: "conditionalVault";
      discriminator: [63, 132, 87, 98, 36, 51, 175, 247];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "insufficientUnderlyingTokens";
      msg: "Insufficient underlying token balance to mint this amount of conditional tokens";
    },
    {
      code: 6001;
      name: "invalidVaultUnderlyingTokenAccount";
      msg: "This `vault_underlying_token_account` is not this vault's `underlying_token_account`";
    },
    {
      code: 6002;
      name: "invalidConditionalTokenMint";
      msg: "This conditional token mint is not this vault's conditional token mint";
    },
    {
      code: 6003;
      name: "cantRedeemConditionalTokens";
      msg: "Vault needs to be settled as finalized before users can redeem conditional tokens for underlying tokens";
    },
    {
      code: 6004;
      name: "vaultAlreadySettled";
      msg: "Once a vault has been settled, its status as either finalized or reverted cannot be changed";
    },
  ];
  types: [
    {
      name: "addMetadataToConditionalTokensArgs";
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
          },
        ];
      };
    },
    {
      name: "initializeConditionalVaultArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "settlementAuthority";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "vaultStatus";
      type: {
        kind: "enum";
        variants: [
          {
            name: "active";
          },
          {
            name: "finalized";
          },
          {
            name: "reverted";
          },
        ];
      };
    },
    {
      name: "conditionalVault";
      type: {
        kind: "struct";
        fields: [
          {
            name: "status";
            type: {
              defined: {
                name: "vaultStatus";
              };
            };
          },
          {
            name: "settlementAuthority";
            docs: [
              "The account that can either finalize the vault to make conditional tokens",
              "redeemable for underlying tokens or revert the vault to make deposit",
              "slips redeemable for underlying tokens.",
            ];
            type: "pubkey";
          },
          {
            name: "underlyingTokenMint";
            docs: ["The mint of the tokens that are deposited into the vault."];
            type: "pubkey";
          },
          {
            name: "underlyingTokenAccount";
            docs: ["The vault's storage account for deposited funds."];
            type: "pubkey";
          },
          {
            name: "conditionalOnFinalizeTokenMint";
            type: "pubkey";
          },
          {
            name: "conditionalOnRevertTokenMint";
            type: "pubkey";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
          {
            name: "decimals";
            type: "u8";
          },
        ];
      };
    },
  ];
};
