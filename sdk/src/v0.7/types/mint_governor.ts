export type MintGovernor = {
  version: "0.7.0";
  name: "mint_governor";
  instructions: [];
  accounts: [
    {
      name: "mintAuthority";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mintGovernor";
            type: "publicKey";
          },
          {
            name: "authorizedMinter";
            type: "publicKey";
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
            type: "publicKey";
          },
          {
            name: "admin";
            type: "publicKey";
          },
          {
            name: "createKey";
            type: "publicKey";
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
          },
          {
            name: "mintGovernorSeqNum";
            type: "u64";
          },
        ];
      };
    },
  ];
  errors: [
    {
      code: 6000;
      name: "Placeholder";
      msg: "Placeholder error - will be replaced in Phase 3";
    },
  ];
};

export const IDL: MintGovernor = {
  version: "0.7.0",
  name: "mint_governor",
  instructions: [],
  accounts: [
    {
      name: "mintAuthority",
      type: {
        kind: "struct",
        fields: [
          {
            name: "mintGovernor",
            type: "publicKey",
          },
          {
            name: "authorizedMinter",
            type: "publicKey",
          },
          {
            name: "maxTotal",
            type: {
              option: "u64",
            },
          },
          {
            name: "totalMinted",
            type: "u64",
          },
          {
            name: "bump",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "mintGovernor",
      type: {
        kind: "struct",
        fields: [
          {
            name: "mint",
            type: "publicKey",
          },
          {
            name: "admin",
            type: "publicKey",
          },
          {
            name: "createKey",
            type: "publicKey",
          },
          {
            name: "seqNum",
            type: "u64",
          },
          {
            name: "bump",
            type: "u8",
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
          {
            name: "mintGovernorSeqNum",
            type: "u64",
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: "Placeholder",
      msg: "Placeholder error - will be replaced in Phase 3",
    },
  ],
};
