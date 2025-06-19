export type AutocratMigrator = {
  version: "0.1.0";
  name: "autocrat_migrator";
  instructions: [
    {
      name: "multiTransfer2";
      accounts: [
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "from0";
          isMut: true;
          isSigner: false;
        },
        {
          name: "to0";
          isMut: true;
          isSigner: false;
        },
        {
          name: "from1";
          isMut: true;
          isSigner: false;
        },
        {
          name: "to1";
          isMut: true;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "lamportReceiver";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "multiTransfer4";
      accounts: [
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "from0";
          isMut: true;
          isSigner: false;
        },
        {
          name: "to0";
          isMut: true;
          isSigner: false;
        },
        {
          name: "from1";
          isMut: true;
          isSigner: false;
        },
        {
          name: "to1";
          isMut: true;
          isSigner: false;
        },
        {
          name: "from2";
          isMut: true;
          isSigner: false;
        },
        {
          name: "to2";
          isMut: true;
          isSigner: false;
        },
        {
          name: "from3";
          isMut: true;
          isSigner: false;
        },
        {
          name: "to3";
          isMut: true;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "lamportReceiver";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [];
    }
  ];
};

export const IDL: AutocratMigrator = {
  version: "0.1.0",
  name: "autocrat_migrator",
  instructions: [
    {
      name: "multiTransfer2",
      accounts: [
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "from0",
          isMut: true,
          isSigner: false,
        },
        {
          name: "to0",
          isMut: true,
          isSigner: false,
        },
        {
          name: "from1",
          isMut: true,
          isSigner: false,
        },
        {
          name: "to1",
          isMut: true,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "lamportReceiver",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "multiTransfer4",
      accounts: [
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "from0",
          isMut: true,
          isSigner: false,
        },
        {
          name: "to0",
          isMut: true,
          isSigner: false,
        },
        {
          name: "from1",
          isMut: true,
          isSigner: false,
        },
        {
          name: "to1",
          isMut: true,
          isSigner: false,
        },
        {
          name: "from2",
          isMut: true,
          isSigner: false,
        },
        {
          name: "to2",
          isMut: true,
          isSigner: false,
        },
        {
          name: "from3",
          isMut: true,
          isSigner: false,
        },
        {
          name: "to3",
          isMut: true,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "lamportReceiver",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [],
    },
  ],
};
