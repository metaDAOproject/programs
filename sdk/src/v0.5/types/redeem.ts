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
          isSigner: false;
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
          isMut: false;
          isSigner: false;
          docs: ["Base token mint (must match DAO and pool configuration)"];
        },
        {
          name: "quoteMint";
          isMut: false;
          isSigner: false;
          docs: [
            "Quote token mint (USDC - must match DAO and pool configuration)",
          ];
        },
        {
          name: "lpAccount";
          isMut: true;
          isSigner: false;
          docs: ["Treasury's LP token account"];
        },
        {
          name: "baseAccount";
          isMut: true;
          isSigner: false;
          docs: ["Treasury's base token account"];
        },
        {
          name: "quoteAccount";
          isMut: true;
          isSigner: false;
          docs: ["Treasury's USDC account"];
        },
        {
          name: "poolBaseVault";
          isMut: true;
          isSigner: false;
          docs: ["Raydium pool's base token vault, vault 0"];
        },
        {
          name: "poolQuoteVault";
          isMut: true;
          isSigner: false;
          docs: ["Raydium pool's USDC vault, vault 1"];
        },
        {
          name: "destinationBaseAccount";
          isMut: true;
          isSigner: false;
          docs: ["Destination account for base tokens"];
        },
        {
          name: "destinationQuoteAccount";
          isMut: true;
          isSigner: false;
          docs: ["Destination account for USDC"];
        },
        {
          name: "lamportReceiver";
          isMut: true;
          isSigner: false;
          docs: ["Account that receives remaining SOL rent"];
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "autocratProgram";
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
          docs: ["Optional memo program for Raydium"];
        },
      ];
      args: [];
    },
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
      name: "InvalidTokenAccount";
      msg: "Invalid token account";
    },
    {
      code: 6004;
      name: "NoLpTokens";
      msg: "No LP tokens to withdraw";
    },
    {
      code: 6005;
      name: "InvalidPoolVault";
      msg: "Invalid pool vault";
    },
    {
      code: 6006;
      name: "InvalidDestination";
      msg: "Invalid destination account";
    },
    {
      code: 6007;
      name: "MathOverflow";
      msg: "Math overflow";
    },
    {
      code: 6008;
      name: "InvalidMint";
      msg: "Invalid mint - does not match DAO configuration";
    },
    {
      code: 6009;
      name: "WrongPool";
      msg: "Wrong pool - pool tokens don't match DAO configuration";
    },
    {
      code: 6010;
      name: "WithdrawalsDisabled";
      msg: "Withdrawals are disabled for this pool";
    },
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
          isSigner: false,
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
          isMut: false,
          isSigner: false,
          docs: ["Base token mint (must match DAO and pool configuration)"],
        },
        {
          name: "quoteMint",
          isMut: false,
          isSigner: false,
          docs: [
            "Quote token mint (USDC - must match DAO and pool configuration)",
          ],
        },
        {
          name: "lpAccount",
          isMut: true,
          isSigner: false,
          docs: ["Treasury's LP token account"],
        },
        {
          name: "baseAccount",
          isMut: true,
          isSigner: false,
          docs: ["Treasury's base token account"],
        },
        {
          name: "quoteAccount",
          isMut: true,
          isSigner: false,
          docs: ["Treasury's USDC account"],
        },
        {
          name: "poolBaseVault",
          isMut: true,
          isSigner: false,
          docs: ["Raydium pool's base token vault, vault 0"],
        },
        {
          name: "poolQuoteVault",
          isMut: true,
          isSigner: false,
          docs: ["Raydium pool's USDC vault, vault 1"],
        },
        {
          name: "destinationBaseAccount",
          isMut: true,
          isSigner: false,
          docs: ["Destination account for base tokens"],
        },
        {
          name: "destinationQuoteAccount",
          isMut: true,
          isSigner: false,
          docs: ["Destination account for USDC"],
        },
        {
          name: "lamportReceiver",
          isMut: true,
          isSigner: false,
          docs: ["Account that receives remaining SOL rent"],
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "autocratProgram",
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
          docs: ["Optional memo program for Raydium"],
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
      name: "InvalidTokenAccount",
      msg: "Invalid token account",
    },
    {
      code: 6004,
      name: "NoLpTokens",
      msg: "No LP tokens to withdraw",
    },
    {
      code: 6005,
      name: "InvalidPoolVault",
      msg: "Invalid pool vault",
    },
    {
      code: 6006,
      name: "InvalidDestination",
      msg: "Invalid destination account",
    },
    {
      code: 6007,
      name: "MathOverflow",
      msg: "Math overflow",
    },
    {
      code: 6008,
      name: "InvalidMint",
      msg: "Invalid mint - does not match DAO configuration",
    },
    {
      code: 6009,
      name: "WrongPool",
      msg: "Wrong pool - pool tokens don't match DAO configuration",
    },
    {
      code: 6010,
      name: "WithdrawalsDisabled",
      msg: "Withdrawals are disabled for this pool",
    },
  ],
};
