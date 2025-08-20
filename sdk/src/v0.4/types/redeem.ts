export type Redeem = {
  version: "0.1.0";
  name: "redeem";
  instructions: [
    {
      name: "redeem";
      accounts: [
        {
          name: "dao";
          isMut: false;
          isSigner: false;
        },
        {
          name: "treasury";
          isMut: true;
          isSigner: true;
        },
        {
          name: "poolState";
          isMut: true;
          isSigner: false;
          docs: ["The Raydium CPMM pool state (zero-copy account)"];
        },
        {
          name: "poolAuthority";
          isMut: false;
          isSigner: false;
          docs: ["Raydium pool authority PDA"];
        },
        {
          name: "lpMint";
          isMut: true;
          isSigner: false;
          docs: ["LP token mint"];
        },
        {
          name: "baseMint";
          isMut: true;
          isSigner: false;
          docs: ["Base token mint (must match DAO )"];
        },
        {
          name: "quoteMint";
          isMut: false;
          isSigner: false;
          docs: ["Quote token mint (USDC - must match DAO )"];
        },
        {
          name: "lpAccount";
          isMut: true;
          isSigner: false;
          docs: ["Treasury's LP token account"];
        },
        {
          name: "treasuryBaseAccount";
          isMut: true;
          isSigner: false;
          docs: ["Treasury's base token account"];
        },
        {
          name: "treasuryQuoteAccount";
          isMut: true;
          isSigner: false;
          docs: ["Treasury's USDC account"];
        },
        {
          name: "poolBaseVault";
          isMut: true;
          isSigner: false;
          docs: ["Raydium pool's base token vault"];
        },
        {
          name: "poolQuoteVault";
          isMut: true;
          isSigner: false;
          docs: ["Raydium pool's quote token vault"];
        },
        {
          name: "migratorVault";
          isMut: true;
          isSigner: false;
          docs: ["IDLs don't work in our tests with anchor 0.29.0"];
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "cpSwapProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram2022";
          isMut: false;
          isSigner: false;
          docs: ["Token Program 2022 for potential token-2022 tokens"];
        },
        {
          name: "memoProgram";
          isMut: false;
          isSigner: false;
          docs: ["Memo program for Raydium CPI"];
        }
      ];
      args: [];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "InvalidAuthority";
      msg: "Invalid authority - treasury does not own the token account";
    },
    {
      code: 6001;
      name: "InvalidTreasuryPDA";
      msg: "Invalid treasury PDA";
    },
    {
      code: 6002;
      name: "InvalidPoolConfiguration";
      msg: "Invalid pool configuration";
    },
    {
      code: 6003;
      name: "InvalidPoolConfigurationToken0";
      msg: "Invalid pool configuration for token 0";
    },
    {
      code: 6004;
      name: "InvalidPoolConfigurationToken1";
      msg: "Invalid pool configuration for token 1";
    },
    {
      code: 6005;
      name: "InvalidPoolConfigurationLpMint";
      msg: "Invalid pool configuration for LP Mint";
    },
    {
      code: 6006;
      name: "InvalidTokenAccount";
      msg: "Invalid token account";
    },
    {
      code: 6007;
      name: "NoLpTokens";
      msg: "No LP tokens to withdraw";
    },
    {
      code: 6008;
      name: "InvalidPoolVault";
      msg: "Invalid pool vault";
    },
    {
      code: 6009;
      name: "InvalidDestination";
      msg: "Invalid destination account";
    },
    {
      code: 6010;
      name: "InvalidMint";
      msg: "Invalid mint - does not match DAO configuration";
    },
    {
      code: 6011;
      name: "WrongPool";
      msg: "Wrong pool - pool tokens don't match DAO configuration";
    },
    {
      code: 6012;
      name: "WithdrawalsDisabled";
      msg: "Withdrawals are disabled for this pool";
    },
    {
      code: 6013;
      name: "MigratorVaultNotInitialized";
      msg: "Migrator vault not initialized";
    },
    {
      code: 6014;
      name: "MigratorVaultNotFunded";
      msg: "Migrator vault must be funded to receive USDC";
    }
  ];
};

export const IDL: Redeem = {
  version: "0.1.0",
  name: "redeem",
  instructions: [
    {
      name: "redeem",
      accounts: [
        {
          name: "dao",
          isMut: false,
          isSigner: false,
        },
        {
          name: "treasury",
          isMut: true,
          isSigner: true,
        },
        {
          name: "poolState",
          isMut: true,
          isSigner: false,
          docs: ["The Raydium CPMM pool state (zero-copy account)"],
        },
        {
          name: "poolAuthority",
          isMut: false,
          isSigner: false,
          docs: ["Raydium pool authority PDA"],
        },
        {
          name: "lpMint",
          isMut: true,
          isSigner: false,
          docs: ["LP token mint"],
        },
        {
          name: "baseMint",
          isMut: true,
          isSigner: false,
          docs: ["Base token mint (must match DAO )"],
        },
        {
          name: "quoteMint",
          isMut: false,
          isSigner: false,
          docs: ["Quote token mint (USDC - must match DAO )"],
        },
        {
          name: "lpAccount",
          isMut: true,
          isSigner: false,
          docs: ["Treasury's LP token account"],
        },
        {
          name: "treasuryBaseAccount",
          isMut: true,
          isSigner: false,
          docs: ["Treasury's base token account"],
        },
        {
          name: "treasuryQuoteAccount",
          isMut: true,
          isSigner: false,
          docs: ["Treasury's USDC account"],
        },
        {
          name: "poolBaseVault",
          isMut: true,
          isSigner: false,
          docs: ["Raydium pool's base token vault"],
        },
        {
          name: "poolQuoteVault",
          isMut: true,
          isSigner: false,
          docs: ["Raydium pool's quote token vault"],
        },
        {
          name: "migratorVault",
          isMut: true,
          isSigner: false,
          docs: ["IDLs don't work in our tests with anchor 0.29.0"],
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "cpSwapProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram2022",
          isMut: false,
          isSigner: false,
          docs: ["Token Program 2022 for potential token-2022 tokens"],
        },
        {
          name: "memoProgram",
          isMut: false,
          isSigner: false,
          docs: ["Memo program for Raydium CPI"],
        },
      ],
      args: [],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "InvalidAuthority",
      msg: "Invalid authority - treasury does not own the token account",
    },
    {
      code: 6001,
      name: "InvalidTreasuryPDA",
      msg: "Invalid treasury PDA",
    },
    {
      code: 6002,
      name: "InvalidPoolConfiguration",
      msg: "Invalid pool configuration",
    },
    {
      code: 6003,
      name: "InvalidPoolConfigurationToken0",
      msg: "Invalid pool configuration for token 0",
    },
    {
      code: 6004,
      name: "InvalidPoolConfigurationToken1",
      msg: "Invalid pool configuration for token 1",
    },
    {
      code: 6005,
      name: "InvalidPoolConfigurationLpMint",
      msg: "Invalid pool configuration for LP Mint",
    },
    {
      code: 6006,
      name: "InvalidTokenAccount",
      msg: "Invalid token account",
    },
    {
      code: 6007,
      name: "NoLpTokens",
      msg: "No LP tokens to withdraw",
    },
    {
      code: 6008,
      name: "InvalidPoolVault",
      msg: "Invalid pool vault",
    },
    {
      code: 6009,
      name: "InvalidDestination",
      msg: "Invalid destination account",
    },
    {
      code: 6010,
      name: "InvalidMint",
      msg: "Invalid mint - does not match DAO configuration",
    },
    {
      code: 6011,
      name: "WrongPool",
      msg: "Wrong pool - pool tokens don't match DAO configuration",
    },
    {
      code: 6012,
      name: "WithdrawalsDisabled",
      msg: "Withdrawals are disabled for this pool",
    },
    {
      code: 6013,
      name: "MigratorVaultNotInitialized",
      msg: "Migrator vault not initialized",
    },
    {
      code: 6014,
      name: "MigratorVaultNotFunded",
      msg: "Migrator vault must be funded to receive USDC",
    },
  ],
};
