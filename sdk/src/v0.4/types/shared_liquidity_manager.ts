export type SharedLiquidityManager = {
  version: "0.1.0";
  name: "shared_liquidity_manager";
  instructions: [
    {
      name: "initializePool";
      accounts: [
        {
          name: "pool";
          isMut: true;
          isSigner: false;
        },
        {
          name: "spotPoolState";
          isMut: false;
          isSigner: false;
        },
        {
          name: "dao";
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
    }
  ];
  accounts: [
    {
      name: "sharedLiquidityPool";
      type: {
        kind: "struct";
        fields: [
          {
            name: "pdaBump";
            docs: ["The PDA bump."];
            type: "u8";
          },
          {
            name: "spotPoolState";
            docs: ["The Raydium spot pool state."];
            type: "publicKey";
          },
          {
            name: "dao";
            docs: ["The DAO."];
            type: "publicKey";
          },
          {
            name: "seqNum";
            docs: [
              "The sequence number of this shared liquidity pool. Useful for sorting events."
            ];
            type: "u64";
          }
        ];
      };
    }
  ];
};

export const IDL: SharedLiquidityManager = {
  version: "0.1.0",
  name: "shared_liquidity_manager",
  instructions: [
    {
      name: "initializePool",
      accounts: [
        {
          name: "pool",
          isMut: true,
          isSigner: false,
        },
        {
          name: "spotPoolState",
          isMut: false,
          isSigner: false,
        },
        {
          name: "dao",
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
  ],
  accounts: [
    {
      name: "sharedLiquidityPool",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pdaBump",
            docs: ["The PDA bump."],
            type: "u8",
          },
          {
            name: "spotPoolState",
            docs: ["The Raydium spot pool state."],
            type: "publicKey",
          },
          {
            name: "dao",
            docs: ["The DAO."],
            type: "publicKey",
          },
          {
            name: "seqNum",
            docs: [
              "The sequence number of this shared liquidity pool. Useful for sorting events.",
            ],
            type: "u64",
          },
        ],
      },
    },
  ],
};
