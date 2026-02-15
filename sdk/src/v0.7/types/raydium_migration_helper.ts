export type RaydiumMigrationHelper = {
  version: "0.1.0";
  name: "raydium_migration_helper";
  instructions: [
    {
      name: "withdrawAndProvideLiquidity";
      accounts: [
        {
          name: "vaultAuthority";
          isMut: true;
          isSigner: true;
          docs: [
            "The vault/DAO that owns the LP tokens (must sign)",
            "This will be the V5 vault PDA signing via Squads",
          ];
        },
        {
          name: "migrationSigner";
          isMut: true;
          isSigner: false;
          docs: [
            "Migration signer PDA - used to sign for Meteora CPI token transfers",
            'Seeds: ["migration_signer", base_mint]',
          ];
        },
        {
          name: "migrationSignerBaseAta";
          isMut: true;
          isSigner: false;
          docs: [
            "Migration signer's base token account (receives tokens from vault, transfers to Meteora)",
          ];
        },
        {
          name: "migrationSignerQuoteAta";
          isMut: true;
          isSigner: false;
          docs: [
            "Migration signer's quote token account (receives tokens from vault, transfers to Meteora)",
          ];
        },
        {
          name: "poolState";
          isMut: true;
          isSigner: false;
          docs: ["Raydium CPMM pool state"];
        },
        {
          name: "lpMint";
          isMut: true;
          isSigner: false;
          docs: ["LP token mint"];
        },
        {
          name: "vaultLpToken";
          isMut: true;
          isSigner: false;
          docs: ["Vault's LP token account (will be burned from)"];
        },
        {
          name: "vaultToken0";
          isMut: true;
          isSigner: false;
          docs: [
            "Vault's token0 account (will receive tokens from pool)",
            "Note: token0/token1 ordering is derived from base_mint/quote_mint pubkey comparison",
          ];
        },
        {
          name: "vaultToken1";
          isMut: true;
          isSigner: false;
          docs: [
            "Vault's token1 account (will receive tokens from pool)",
            "Note: token0/token1 ordering is derived from base_mint/quote_mint pubkey comparison",
          ];
        },
        {
          name: "dao";
          isMut: true;
          isSigner: false;
          docs: ["V6 DAO account"];
        },
        {
          name: "baseMint";
          isMut: false;
          isSigner: false;
          docs: [
            "Base token mint (used for determining token0/token1 -> base/quote mapping)",
          ];
        },
        {
          name: "quoteMint";
          isMut: false;
          isSigner: false;
          docs: [
            "Quote token mint (used for determining token0/token1 -> base/quote mapping)",
          ];
        },
        {
          name: "raydiumAuthority";
          isMut: false;
          isSigner: false;
          docs: ["Raydium authority PDA"];
        },
        {
          name: "poolToken0Vault";
          isMut: true;
          isSigner: false;
          docs: ["Pool's token0 vault"];
        },
        {
          name: "poolToken1Vault";
          isMut: true;
          isSigner: false;
          docs: ["Pool's token1 vault"];
        },
        {
          name: "ammPosition";
          isMut: true;
          isSigner: false;
          docs: ["AMM position PDA (owned by futarchy program)"];
        },
        {
          name: "ammBaseVault";
          isMut: true;
          isSigner: false;
          docs: ["AMM base vault (owned by DAO)"];
        },
        {
          name: "ammQuoteVault";
          isMut: true;
          isSigner: false;
          docs: ["AMM quote vault (owned by DAO)"];
        },
        {
          name: "v6VaultBaseAta";
          isMut: true;
          isSigner: false;
          docs: [
            "V6 vault base treasury ATA (receives remaining base tokens after liquidity provision)",
          ];
        },
        {
          name: "v6VaultQuoteAta";
          isMut: true;
          isSigner: false;
          docs: [
            "V6 vault quote treasury ATA (receives remaining quote tokens after liquidity provision)",
          ];
        },
        {
          name: "v6VaultPda";
          isMut: false;
          isSigner: false;
          docs: [
            "V6 vault PDA (will be the position authority for the AMM position)",
            "This is separate from vault_authority (V5 vault) which signs the transaction",
          ];
        },
        {
          name: "eventAuthority";
          isMut: false;
          isSigner: false;
          docs: ["Event authority for futarchy CPI events"];
        },
        {
          name: "raydiumProgram";
          isMut: false;
          isSigner: false;
          docs: ["Raydium CPMM program"];
        },
        {
          name: "futarchyProgram";
          isMut: false;
          isSigner: false;
          docs: ["Futarchy v0.6 program"];
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
          docs: ["SPL Token program"];
        },
        {
          name: "tokenProgram2022";
          isMut: false;
          isSigner: false;
          docs: [
            "SPL Token 2022 program (required by Raydium for Token-2022 support)",
          ];
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
          docs: ["System program"];
        },
        {
          name: "memoProgram";
          isMut: false;
          isSigner: false;
          docs: ["Memo program (required by Raydium for withdrawal logs)"];
        },
        {
          name: "meteoraAccounts";
          accounts: [
            {
              name: "dammV2Program";
              isMut: false;
              isSigner: false;
            },
            {
              name: "config";
              isMut: false;
              isSigner: false;
            },
            {
              name: "token2022Program";
              isMut: false;
              isSigner: false;
            },
            {
              name: "positionNftAccount";
              isMut: true;
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
              name: "positionNftMint";
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
              name: "poolCreatorAuthority";
              isMut: false;
              isSigner: false;
            },
            {
              name: "poolAuthority";
              isMut: false;
              isSigner: false;
            },
            {
              name: "dammV2EventAuthority";
              isMut: false;
              isSigner: false;
            },
          ];
        },
      ];
      args: [
        {
          name: "lpAmount";
          type: "u64";
        },
        {
          name: "minRaydiumAmount0";
          type: "u64";
        },
        {
          name: "minRaydiumAmount1";
          type: "u64";
        },
        {
          name: "minFutarchyLiquidity";
          type: "u64";
        },
      ];
    },
  ];
  events: [
    {
      name: "MigrationExecuted";
      fields: [
        {
          name: "vaultAuthority";
          type: "publicKey";
          index: false;
        },
        {
          name: "lpAmount";
          type: "u64";
          index: false;
        },
        {
          name: "withdrawnBase";
          type: "u64";
          index: false;
        },
        {
          name: "withdrawnQuote";
          type: "u64";
          index: false;
        },
        {
          name: "baseToMeteora";
          type: "u64";
          index: false;
        },
        {
          name: "quoteToMeteora";
          type: "u64";
          index: false;
        },
        {
          name: "baseToFutarchy";
          type: "u64";
          index: false;
        },
        {
          name: "quoteToFutarchy";
          type: "u64";
          index: false;
        },
        {
          name: "meteoraPool";
          type: "publicKey";
          index: false;
        },
        {
          name: "treasuryBaseTransferred";
          type: "u64";
          index: false;
        },
        {
          name: "treasuryQuoteTransferred";
          type: "u64";
          index: false;
        },
      ];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "InsufficientLpBalance";
      msg: "Insufficient LP token balance";
    },
    {
      code: 6001;
      name: "TokenAccountOwnerMismatch";
      msg: "Token account owner mismatch";
    },
    {
      code: 6002;
      name: "InvalidTokenMint";
      msg: "Invalid token mint";
    },
    {
      code: 6003;
      name: "MathOverflow";
      msg: "Math overflow error";
    },
    {
      code: 6004;
      name: "DuplicateTokenMints";
      msg: "Base and quote mints must be different";
    },
  ];
};

export const IDL: RaydiumMigrationHelper = {
  version: "0.1.0",
  name: "raydium_migration_helper",
  instructions: [
    {
      name: "withdrawAndProvideLiquidity",
      accounts: [
        {
          name: "vaultAuthority",
          isMut: true,
          isSigner: true,
          docs: [
            "The vault/DAO that owns the LP tokens (must sign)",
            "This will be the V5 vault PDA signing via Squads",
          ],
        },
        {
          name: "migrationSigner",
          isMut: true,
          isSigner: false,
          docs: [
            "Migration signer PDA - used to sign for Meteora CPI token transfers",
            'Seeds: ["migration_signer", base_mint]',
          ],
        },
        {
          name: "migrationSignerBaseAta",
          isMut: true,
          isSigner: false,
          docs: [
            "Migration signer's base token account (receives tokens from vault, transfers to Meteora)",
          ],
        },
        {
          name: "migrationSignerQuoteAta",
          isMut: true,
          isSigner: false,
          docs: [
            "Migration signer's quote token account (receives tokens from vault, transfers to Meteora)",
          ],
        },
        {
          name: "poolState",
          isMut: true,
          isSigner: false,
          docs: ["Raydium CPMM pool state"],
        },
        {
          name: "lpMint",
          isMut: true,
          isSigner: false,
          docs: ["LP token mint"],
        },
        {
          name: "vaultLpToken",
          isMut: true,
          isSigner: false,
          docs: ["Vault's LP token account (will be burned from)"],
        },
        {
          name: "vaultToken0",
          isMut: true,
          isSigner: false,
          docs: [
            "Vault's token0 account (will receive tokens from pool)",
            "Note: token0/token1 ordering is derived from base_mint/quote_mint pubkey comparison",
          ],
        },
        {
          name: "vaultToken1",
          isMut: true,
          isSigner: false,
          docs: [
            "Vault's token1 account (will receive tokens from pool)",
            "Note: token0/token1 ordering is derived from base_mint/quote_mint pubkey comparison",
          ],
        },
        {
          name: "dao",
          isMut: true,
          isSigner: false,
          docs: ["V6 DAO account"],
        },
        {
          name: "baseMint",
          isMut: false,
          isSigner: false,
          docs: [
            "Base token mint (used for determining token0/token1 -> base/quote mapping)",
          ],
        },
        {
          name: "quoteMint",
          isMut: false,
          isSigner: false,
          docs: [
            "Quote token mint (used for determining token0/token1 -> base/quote mapping)",
          ],
        },
        {
          name: "raydiumAuthority",
          isMut: false,
          isSigner: false,
          docs: ["Raydium authority PDA"],
        },
        {
          name: "poolToken0Vault",
          isMut: true,
          isSigner: false,
          docs: ["Pool's token0 vault"],
        },
        {
          name: "poolToken1Vault",
          isMut: true,
          isSigner: false,
          docs: ["Pool's token1 vault"],
        },
        {
          name: "ammPosition",
          isMut: true,
          isSigner: false,
          docs: ["AMM position PDA (owned by futarchy program)"],
        },
        {
          name: "ammBaseVault",
          isMut: true,
          isSigner: false,
          docs: ["AMM base vault (owned by DAO)"],
        },
        {
          name: "ammQuoteVault",
          isMut: true,
          isSigner: false,
          docs: ["AMM quote vault (owned by DAO)"],
        },
        {
          name: "v6VaultBaseAta",
          isMut: true,
          isSigner: false,
          docs: [
            "V6 vault base treasury ATA (receives remaining base tokens after liquidity provision)",
          ],
        },
        {
          name: "v6VaultQuoteAta",
          isMut: true,
          isSigner: false,
          docs: [
            "V6 vault quote treasury ATA (receives remaining quote tokens after liquidity provision)",
          ],
        },
        {
          name: "v6VaultPda",
          isMut: false,
          isSigner: false,
          docs: [
            "V6 vault PDA (will be the position authority for the AMM position)",
            "This is separate from vault_authority (V5 vault) which signs the transaction",
          ],
        },
        {
          name: "eventAuthority",
          isMut: false,
          isSigner: false,
          docs: ["Event authority for futarchy CPI events"],
        },
        {
          name: "raydiumProgram",
          isMut: false,
          isSigner: false,
          docs: ["Raydium CPMM program"],
        },
        {
          name: "futarchyProgram",
          isMut: false,
          isSigner: false,
          docs: ["Futarchy v0.6 program"],
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
          docs: ["SPL Token program"],
        },
        {
          name: "tokenProgram2022",
          isMut: false,
          isSigner: false,
          docs: [
            "SPL Token 2022 program (required by Raydium for Token-2022 support)",
          ],
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
          docs: ["System program"],
        },
        {
          name: "memoProgram",
          isMut: false,
          isSigner: false,
          docs: ["Memo program (required by Raydium for withdrawal logs)"],
        },
        {
          name: "meteoraAccounts",
          accounts: [
            {
              name: "dammV2Program",
              isMut: false,
              isSigner: false,
            },
            {
              name: "config",
              isMut: false,
              isSigner: false,
            },
            {
              name: "token2022Program",
              isMut: false,
              isSigner: false,
            },
            {
              name: "positionNftAccount",
              isMut: true,
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
              name: "positionNftMint",
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
              name: "poolCreatorAuthority",
              isMut: false,
              isSigner: false,
            },
            {
              name: "poolAuthority",
              isMut: false,
              isSigner: false,
            },
            {
              name: "dammV2EventAuthority",
              isMut: false,
              isSigner: false,
            },
          ],
        },
      ],
      args: [
        {
          name: "lpAmount",
          type: "u64",
        },
        {
          name: "minRaydiumAmount0",
          type: "u64",
        },
        {
          name: "minRaydiumAmount1",
          type: "u64",
        },
        {
          name: "minFutarchyLiquidity",
          type: "u64",
        },
      ],
    },
  ],
  events: [
    {
      name: "MigrationExecuted",
      fields: [
        {
          name: "vaultAuthority",
          type: "publicKey",
          index: false,
        },
        {
          name: "lpAmount",
          type: "u64",
          index: false,
        },
        {
          name: "withdrawnBase",
          type: "u64",
          index: false,
        },
        {
          name: "withdrawnQuote",
          type: "u64",
          index: false,
        },
        {
          name: "baseToMeteora",
          type: "u64",
          index: false,
        },
        {
          name: "quoteToMeteora",
          type: "u64",
          index: false,
        },
        {
          name: "baseToFutarchy",
          type: "u64",
          index: false,
        },
        {
          name: "quoteToFutarchy",
          type: "u64",
          index: false,
        },
        {
          name: "meteoraPool",
          type: "publicKey",
          index: false,
        },
        {
          name: "treasuryBaseTransferred",
          type: "u64",
          index: false,
        },
        {
          name: "treasuryQuoteTransferred",
          type: "u64",
          index: false,
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "InsufficientLpBalance",
      msg: "Insufficient LP token balance",
    },
    {
      code: 6001,
      name: "TokenAccountOwnerMismatch",
      msg: "Token account owner mismatch",
    },
    {
      code: 6002,
      name: "InvalidTokenMint",
      msg: "Invalid token mint",
    },
    {
      code: 6003,
      name: "MathOverflow",
      msg: "Math overflow error",
    },
    {
      code: 6004,
      name: "DuplicateTokenMints",
      msg: "Base and quote mints must be different",
    },
  ],
};
