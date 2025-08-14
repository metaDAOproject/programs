export type UnwindMigrator = {
  version: "0.1.0";
  name: "unwind_migrator";
  instructions: [
    {
      name: "unwindAndMigrate";
      accounts: [
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "poolState";
          isMut: true;
          isSigner: false;
        },
        {
          name: "poolAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "lpMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "lpAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "usdcAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "poolTokenVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "poolUsdcVault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "destinationTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "destinationUsdcAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "lamportReceiver";
          isMut: true;
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
          name: "raydiumProgram";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
  ];
};

export const IDL: UnwindMigrator = {
  version: "0.1.0",
  name: "unwind_migrator",
  instructions: [
    {
      name: "unwindAndMigrate",
      accounts: [
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "poolState",
          isMut: true,
          isSigner: false,
        },
        {
          name: "poolAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "lpMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "lpAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "usdcAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "poolTokenVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "poolUsdcVault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "destinationTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "destinationUsdcAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "lamportReceiver",
          isMut: true,
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
          name: "raydiumProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
  ],
};
