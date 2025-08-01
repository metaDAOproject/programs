export type TokenConverter = {
  "version": "0.1.0",
  "name": "token_converter",
  "instructions": [
    {
      "name": "initializeTokenConverterConfig",
      "accounts": [
        {
          "name": "tokenConverterConfig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inboundTokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "outboundTokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "maxInboundTokenAmount",
          "type": "u64"
        },
        {
          "name": "maxOutboundTokenAmount",
          "type": "u64"
        },
        {
          "name": "burnInboundToken",
          "type": "bool"
        }
      ]
    },
    {
      "name": "initializeTokenConverter",
      "accounts": [
        {
          "name": "tokenConverter",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenConverterConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "inboundTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "outboundTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inboundTokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "outboundTokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "convert",
      "accounts": [
        {
          "name": "tokenConverter",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenConverterConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "from",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "to",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inboundTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "outboundTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inboundTokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "outboundTokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "tokenConverter",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seqNum",
            "type": "u64"
          },
          {
            "name": "tokenConverterConfig",
            "type": "publicKey"
          },
          {
            "name": "inboundTokenVault",
            "type": "publicKey"
          },
          {
            "name": "outboundTokenVault",
            "type": "publicKey"
          },
          {
            "name": "inboundTokenAmount",
            "type": "u64"
          },
          {
            "name": "outboundTokenAmount",
            "type": "u64"
          },
          {
            "name": "maxInboundTokenAmount",
            "type": "u64"
          },
          {
            "name": "maxOutboundTokenAmount",
            "type": "u64"
          },
          {
            "name": "burnInboundToken",
            "type": "bool"
          },
          {
            "name": "inboundTokenDecimals",
            "type": "u8"
          },
          {
            "name": "outboundTokenDecimals",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tokenConverterConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "inboundTokenMint",
            "type": "publicKey"
          },
          {
            "name": "outboundTokenMint",
            "type": "publicKey"
          },
          {
            "name": "inboundTokenDecimals",
            "type": "u8"
          },
          {
            "name": "outboundTokenDecimals",
            "type": "u8"
          },
          {
            "name": "maxInboundTokenAmount",
            "type": "u64"
          },
          {
            "name": "maxOutboundTokenAmount",
            "type": "u64"
          },
          {
            "name": "burnInboundToken",
            "type": "bool"
          },
          {
            "name": "seqNum",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidAmount",
      "msg": "Invalid amount - must be greater than 0"
    },
    {
      "code": 6001,
      "name": "InvalidInboundToken",
      "msg": "Invalid inbound token mint"
    },
    {
      "code": 6002,
      "name": "InvalidOutboundToken",
      "msg": "Invalid outbound token mint"
    },
    {
      "code": 6003,
      "name": "InvalidConverterInboundTokenAccount",
      "msg": "Invalid converter inbound token account"
    },
    {
      "code": 6004,
      "name": "InvalidConverterOutboundTokenAccount",
      "msg": "Invalid converter outbound token account"
    },
    {
      "code": 6005,
      "name": "InvalidAuthority",
      "msg": "Invalid authority"
    },
    {
      "code": 6006,
      "name": "InsufficientBalance",
      "msg": "Insufficient balance"
    },
    {
      "code": 6007,
      "name": "InsufficientConverterBalance",
      "msg": "Insufficient converter balance"
    },
    {
      "code": 6008,
      "name": "ConverterNotActive",
      "msg": "Converter not active"
    },
    {
      "code": 6009,
      "name": "Overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6010,
      "name": "AssertFailed",
      "msg": "Assertion failed"
    }
  ]
};

export const IDL: TokenConverter = {
  "version": "0.1.0",
  "name": "token_converter",
  "instructions": [
    {
      "name": "initializeTokenConverterConfig",
      "accounts": [
        {
          "name": "tokenConverterConfig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inboundTokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "outboundTokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "maxInboundTokenAmount",
          "type": "u64"
        },
        {
          "name": "maxOutboundTokenAmount",
          "type": "u64"
        },
        {
          "name": "burnInboundToken",
          "type": "bool"
        }
      ]
    },
    {
      "name": "initializeTokenConverter",
      "accounts": [
        {
          "name": "tokenConverter",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenConverterConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "inboundTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "outboundTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inboundTokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "outboundTokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "convert",
      "accounts": [
        {
          "name": "tokenConverter",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenConverterConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "from",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "to",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inboundTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "outboundTokenVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "inboundTokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "outboundTokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "tokenConverter",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seqNum",
            "type": "u64"
          },
          {
            "name": "tokenConverterConfig",
            "type": "publicKey"
          },
          {
            "name": "inboundTokenVault",
            "type": "publicKey"
          },
          {
            "name": "outboundTokenVault",
            "type": "publicKey"
          },
          {
            "name": "inboundTokenAmount",
            "type": "u64"
          },
          {
            "name": "outboundTokenAmount",
            "type": "u64"
          },
          {
            "name": "maxInboundTokenAmount",
            "type": "u64"
          },
          {
            "name": "maxOutboundTokenAmount",
            "type": "u64"
          },
          {
            "name": "burnInboundToken",
            "type": "bool"
          },
          {
            "name": "inboundTokenDecimals",
            "type": "u8"
          },
          {
            "name": "outboundTokenDecimals",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tokenConverterConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "inboundTokenMint",
            "type": "publicKey"
          },
          {
            "name": "outboundTokenMint",
            "type": "publicKey"
          },
          {
            "name": "inboundTokenDecimals",
            "type": "u8"
          },
          {
            "name": "outboundTokenDecimals",
            "type": "u8"
          },
          {
            "name": "maxInboundTokenAmount",
            "type": "u64"
          },
          {
            "name": "maxOutboundTokenAmount",
            "type": "u64"
          },
          {
            "name": "burnInboundToken",
            "type": "bool"
          },
          {
            "name": "seqNum",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidAmount",
      "msg": "Invalid amount - must be greater than 0"
    },
    {
      "code": 6001,
      "name": "InvalidInboundToken",
      "msg": "Invalid inbound token mint"
    },
    {
      "code": 6002,
      "name": "InvalidOutboundToken",
      "msg": "Invalid outbound token mint"
    },
    {
      "code": 6003,
      "name": "InvalidConverterInboundTokenAccount",
      "msg": "Invalid converter inbound token account"
    },
    {
      "code": 6004,
      "name": "InvalidConverterOutboundTokenAccount",
      "msg": "Invalid converter outbound token account"
    },
    {
      "code": 6005,
      "name": "InvalidAuthority",
      "msg": "Invalid authority"
    },
    {
      "code": 6006,
      "name": "InsufficientBalance",
      "msg": "Insufficient balance"
    },
    {
      "code": 6007,
      "name": "InsufficientConverterBalance",
      "msg": "Insufficient converter balance"
    },
    {
      "code": 6008,
      "name": "ConverterNotActive",
      "msg": "Converter not active"
    },
    {
      "code": 6009,
      "name": "Overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6010,
      "name": "AssertFailed",
      "msg": "Assertion failed"
    }
  ]
};
