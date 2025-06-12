/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/streamflow_escrow.json`.
 */
export type StreamflowEscrow = {
  "address": "ESCRoWj8QUJ5cTXCBWbGpW6AzaaEAtRbZuwKp8c4YYGs",
  "name": "streamflow_escrow",
  "version": "0.1.0",
  "metadata": {
    "name": "streamflowEscrow",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "cancelOrder",
      "docs": [
        "Cancel an order.",
        "",
        "- Order creator creator can cancel anytime;",
        "- pre-configured `executor` can also cancel the order, meaning that they reject it;",
        "- anyone can cancel an order after it has been expired, tokens will always be returned to the order creator;"
      ],
      "discriminator": [
        95,
        129,
        237,
        240,
        8,
        49,
        223,
        132
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Account that will cover tx fees, should be equal to creator if not is not expired"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "order",
          "docs": [
            "Order to cancel"
          ],
          "writable": true
        },
        {
          "name": "vault",
          "docs": [
            "Vault that stores base tokens"
          ],
          "writable": true,
          "relations": [
            "order"
          ]
        },
        {
          "name": "creator",
          "writable": true,
          "relations": [
            "order"
          ]
        },
        {
          "name": "to",
          "docs": [
            "Token account that will receive back base mint tokens"
          ],
          "writable": true
        },
        {
          "name": "baseMint",
          "docs": [
            "Quote mint of the order"
          ],
          "writable": true,
          "relations": [
            "order"
          ]
        },
        {
          "name": "tokenProgram",
          "docs": [
            "SPL token program interface."
          ]
        },
        {
          "name": "systemProgram",
          "docs": [
            "System program."
          ],
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": []
    },
    {
      "name": "createOrderFixed",
      "docs": [
        "Create an order with fixed `start_price`"
      ],
      "discriminator": [
        238,
        32,
        66,
        30,
        214,
        227,
        110,
        135
      ],
      "accounts": [
        {
          "name": "creator",
          "docs": [
            "Order creator"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "from",
          "docs": [
            "Token account from which base token will be transferred"
          ],
          "writable": true
        },
        {
          "name": "order",
          "docs": [
            "Order to cancel"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "account",
                "path": "baseMint"
              },
              {
                "kind": "arg",
                "path": "ix.nonce"
              }
            ]
          }
        },
        {
          "name": "vault",
          "docs": [
            "Vault that stores base tokens"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "order"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "baseMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "executor",
          "optional": true
        },
        {
          "name": "partner",
          "optional": true
        },
        {
          "name": "baseMint",
          "docs": [
            "Quote mint of the order"
          ]
        },
        {
          "name": "quoteMint",
          "docs": [
            "Quote mint of the order"
          ]
        },
        {
          "name": "tokenProgram",
          "docs": [
            "SPL token program interface."
          ]
        },
        {
          "name": "associatedTokenProgram",
          "docs": [
            "The [Associated Token] program."
          ],
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "docs": [
            "System program."
          ],
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "ix",
          "type": {
            "defined": {
              "name": "CreateOrderFixedIx"
            }
          }
        }
      ]
    },
    {
      "name": "fillOrderInstant",
      "docs": [
        "Fill an order, claim `amount` of base tokens instantly."
      ],
      "discriminator": [
        247,
        221,
        198,
        23,
        4,
        169,
        68,
        121
      ],
      "accounts": [
        {
          "name": "common",
          "accounts": [
            {
              "name": "executor",
              "docs": [
                "Order executor"
              ],
              "writable": true,
              "signer": true
            },
            {
              "name": "from",
              "docs": [
                "Token account from which quote token will be transferred"
              ],
              "writable": true
            },
            {
              "name": "toBase",
              "docs": [
                "Executor TA that will receive base tokens"
              ],
              "writable": true
            },
            {
              "name": "order",
              "docs": [
                "Order to cancel"
              ],
              "writable": true
            },
            {
              "name": "vault",
              "docs": [
                "Vault that stores base tokens"
              ],
              "writable": true,
              "relations": [
                "order"
              ]
            },
            {
              "name": "creator",
              "writable": true,
              "relations": [
                "order"
              ]
            },
            {
              "name": "toQuote",
              "docs": [
                "Creator TA that will receive quote mint tokens"
              ],
              "writable": true
            },
            {
              "name": "baseMint",
              "docs": [
                "Base mint of the order"
              ],
              "writable": true,
              "relations": [
                "order"
              ]
            },
            {
              "name": "quoteMint",
              "docs": [
                "Quote mint of the order"
              ],
              "relations": [
                "order"
              ]
            },
            {
              "name": "baseTokenProgram",
              "docs": [
                "Token program used for base mint tokens"
              ]
            },
            {
              "name": "quotaTokenProgram",
              "docs": [
                "Token program used for quote mint tokens"
              ]
            }
          ]
        },
        {
          "name": "executionRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  101,
                  99,
                  117,
                  116,
                  105,
                  111,
                  110,
                  45,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "common.order",
                "account": "fillCommon"
              },
              {
                "kind": "account",
                "path": "common.executor",
                "account": "fillCommon"
              },
              {
                "kind": "arg",
                "path": "nonce"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "docs": [
            "System program."
          ],
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u32"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "price",
          "type": "u64"
        },
        {
          "name": "ceilAllowed",
          "type": "bool"
        }
      ]
    },
    {
      "name": "fillOrderVested",
      "docs": [
        "Fill an order, claim `amount` of base tokens in a vested fashion."
      ],
      "discriminator": [
        69,
        211,
        62,
        131,
        240,
        89,
        30,
        218
      ],
      "accounts": [
        {
          "name": "common",
          "accounts": [
            {
              "name": "executor",
              "docs": [
                "Order executor"
              ],
              "writable": true,
              "signer": true
            },
            {
              "name": "from",
              "docs": [
                "Token account from which quote token will be transferred"
              ],
              "writable": true
            },
            {
              "name": "toBase",
              "docs": [
                "Executor TA that will receive base tokens"
              ],
              "writable": true
            },
            {
              "name": "order",
              "docs": [
                "Order to cancel"
              ],
              "writable": true
            },
            {
              "name": "vault",
              "docs": [
                "Vault that stores base tokens"
              ],
              "writable": true,
              "relations": [
                "order"
              ]
            },
            {
              "name": "creator",
              "writable": true,
              "relations": [
                "order"
              ]
            },
            {
              "name": "toQuote",
              "docs": [
                "Creator TA that will receive quote mint tokens"
              ],
              "writable": true
            },
            {
              "name": "baseMint",
              "docs": [
                "Base mint of the order"
              ],
              "writable": true,
              "relations": [
                "order"
              ]
            },
            {
              "name": "quoteMint",
              "docs": [
                "Quote mint of the order"
              ],
              "relations": [
                "order"
              ]
            },
            {
              "name": "baseTokenProgram",
              "docs": [
                "Token program used for base mint tokens"
              ]
            },
            {
              "name": "quotaTokenProgram",
              "docs": [
                "Token program used for quote mint tokens"
              ]
            }
          ]
        },
        {
          "name": "executionRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  101,
                  99,
                  117,
                  116,
                  105,
                  111,
                  110,
                  45,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "common.order",
                "account": "fillCommon"
              },
              {
                "kind": "account",
                "path": "common.executor",
                "account": "fillCommon"
              },
              {
                "kind": "arg",
                "path": "nonce"
              }
            ]
          }
        },
        {
          "name": "streamMetadata",
          "writable": true,
          "signer": true
        },
        {
          "name": "escrowTokens",
          "writable": true
        },
        {
          "name": "withdrawor",
          "writable": true,
          "address": "wdrwhnCv4pzW8beKsbPa4S2UDZrXenjg16KJdKSpb5u"
        },
        {
          "name": "streamflowProgram",
          "address": "strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m"
        },
        {
          "name": "feeOracle",
          "address": "B743wFVk2pCYhV91cn287e1xY7f1vt4gdY48hhNiuQmT"
        },
        {
          "name": "associatedTokenProgram",
          "docs": [
            "Associated token program."
          ],
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "rent",
          "docs": [
            "Sysvar rent."
          ],
          "address": "SysvarRent111111111111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "docs": [
            "System program."
          ],
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u32"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "price",
          "type": "u64"
        },
        {
          "name": "ceilAllowed",
          "type": "bool"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "executionRecord",
      "discriminator": [
        133,
        201,
        182,
        206,
        224,
        111,
        45,
        168
      ]
    },
    {
      "name": "order",
      "discriminator": [
        134,
        173,
        223,
        185,
        77,
        86,
        28,
        51
      ]
    }
  ],
  "events": [
    {
      "name": "cancelEvent",
      "discriminator": [
        71,
        137,
        239,
        100,
        220,
        3,
        242,
        47
      ]
    },
    {
      "name": "createEvent",
      "discriminator": [
        27,
        114,
        169,
        77,
        222,
        235,
        99,
        118
      ]
    },
    {
      "name": "fillEvent",
      "discriminator": [
        13,
        89,
        41,
        228,
        105,
        178,
        45,
        112
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Authority does not have permission for this action"
    },
    {
      "code": 6001,
      "name": "arithmeticError",
      "msg": "Arithmetic error"
    },
    {
      "code": 6002,
      "name": "invalidStreamMetadata",
      "msg": "Invalid Stream Metadata"
    },
    {
      "code": 6003,
      "name": "invalidAmount",
      "msg": "Amount should be greater than 0"
    },
    {
      "code": 6004,
      "name": "invalidPrice",
      "msg": "Price should be greater than 0"
    },
    {
      "code": 6005,
      "name": "invalidExpiryTs",
      "msg": "Expiry ts should be in the future"
    },
    {
      "code": 6006,
      "name": "invalidVestingOptions",
      "msg": "Provided vesting claim options are invalid"
    },
    {
      "code": 6007,
      "name": "invalidMints",
      "msg": "Base mint can not equal quote mint"
    },
    {
      "code": 6008,
      "name": "unsupportedTokenExtensions",
      "msg": "Mint has unsupported Token Extensions"
    },
    {
      "code": 6009,
      "name": "invalidFillPrice",
      "msg": "Price to fill the order does not match the order price"
    },
    {
      "code": 6010,
      "name": "invalidFillAmount",
      "msg": "Provided amount to fill is not valid"
    },
    {
      "code": 6011,
      "name": "invalidClaimType",
      "msg": "Provided claim type is invalid"
    },
    {
      "code": 6012,
      "name": "orderFilled",
      "msg": "Order is already fully filled"
    },
    {
      "code": 6013,
      "name": "orderCancelled",
      "msg": "Order is cancelled"
    },
    {
      "code": 6014,
      "name": "orderExpired",
      "msg": "Order is expired"
    },
    {
      "code": 6015,
      "name": "accurateTransferNotPossible",
      "msg": "Cannot accurately transfer the requested amount accounted for transfer fees"
    }
  ],
  "types": [
    {
      "name": "cancelEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "order",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "claimType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "instant"
          },
          {
            "name": "vested"
          }
        ]
      }
    },
    {
      "name": "createEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "baseMint",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "quoteMint",
            "type": "pubkey"
          },
          {
            "name": "pricingModel",
            "type": {
              "defined": {
                "name": "pricingModel"
              }
            }
          },
          {
            "name": "startPrice",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "CreateOrderFixedIx",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nonce",
            "type": "u32"
          },
          {
            "name": "amount",
            "docs": [
              "Amount of `base_mint` tokens"
            ],
            "type": "u64"
          },
          {
            "name": "startPrice",
            "docs": [
              "Start Price in `quote_mint` decimal value for base tokens"
            ],
            "type": "u64"
          },
          {
            "name": "partialAllowed",
            "docs": [
              "Whether to allow partial fulfillment"
            ],
            "type": "bool"
          },
          {
            "name": "expiryTs",
            "docs": [
              "Timestamp when order expires"
            ],
            "type": "u64"
          },
          {
            "name": "claimType",
            "docs": [
              "How the token should be claimed after order fulfillment"
            ],
            "type": {
              "defined": {
                "name": "claimType"
              }
            }
          },
          {
            "name": "vestingStartTs",
            "docs": [
              "Vesting Claim Type options",
              "When vesting contract start time should be"
            ],
            "type": "u64"
          },
          {
            "name": "vestingPeriod",
            "docs": [
              "Vesting release period in seconds"
            ],
            "type": "u64"
          },
          {
            "name": "vestingAmountPerPeriod",
            "docs": [
              "When vesting contract end time should be"
            ],
            "type": "u64"
          },
          {
            "name": "vestingCliffAmount",
            "docs": [
              "Amount of tokens to be unlocked right at the start of vesting"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "executionRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nonce",
            "docs": [
              "Nonce used to differentiate records of the same executor"
            ],
            "type": "u32"
          },
          {
            "name": "order",
            "docs": [
              "Order id"
            ],
            "type": "pubkey"
          },
          {
            "name": "executor",
            "docs": [
              "Counterparty that filled the order"
            ],
            "type": "pubkey"
          },
          {
            "name": "contract",
            "docs": [
              "Vesting contract created after the order was filled"
            ],
            "type": "pubkey"
          },
          {
            "name": "filledAmount",
            "docs": [
              "Filled amount"
            ],
            "type": "u64"
          },
          {
            "name": "paidAmount",
            "docs": [
              "How much quote tokens were paid"
            ],
            "type": "u64"
          },
          {
            "name": "createdTs",
            "docs": [
              "Timestamp when the record was created"
            ],
            "type": "u64"
          },
          {
            "name": "buffer",
            "docs": [
              "Buffer for additional fields"
            ],
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    },
    {
      "name": "fillEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "order",
            "type": "pubkey"
          },
          {
            "name": "executor",
            "type": "pubkey"
          },
          {
            "name": "contract",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "fillAmount",
            "type": "u64"
          },
          {
            "name": "paidAmount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "order",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "docs": [
              "Bump Seed used to sign transactions"
            ],
            "type": "u8"
          },
          {
            "name": "nonce",
            "docs": [
              "Nonce to differentiate orders for the same mint"
            ],
            "type": "u32"
          },
          {
            "name": "baseMint",
            "docs": [
              "Mint of the Token stored in Escrow"
            ],
            "type": "pubkey"
          },
          {
            "name": "quoteMint",
            "docs": [
              "Mint of the Token to exchange base mint tokens for"
            ],
            "type": "pubkey"
          },
          {
            "name": "creator",
            "docs": [
              "Current authority"
            ],
            "type": "pubkey"
          },
          {
            "name": "executor",
            "docs": [
              "Optional constraint of the counterparty to fulfill the order"
            ],
            "type": "pubkey"
          },
          {
            "name": "partner",
            "docs": [
              "Optional partner/referral account"
            ],
            "type": "pubkey"
          },
          {
            "name": "vault",
            "docs": [
              "Token Account that stores deposited tokens"
            ],
            "type": "pubkey"
          },
          {
            "name": "config",
            "type": {
              "defined": {
                "name": "orderConfig"
              }
            }
          },
          {
            "name": "vestingConfig",
            "type": {
              "defined": {
                "name": "vestingConfig"
              }
            }
          },
          {
            "name": "state",
            "type": {
              "defined": {
                "name": "orderState"
              }
            }
          },
          {
            "name": "buffer1",
            "docs": [
              "Buffer for additional fields"
            ],
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "buffer2",
            "docs": [
              "Buffer for additional fields"
            ],
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    },
    {
      "name": "orderConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "docs": [
              "Amount of base tokens"
            ],
            "type": "u64"
          },
          {
            "name": "startPrice",
            "docs": [
              "Price in `quote_mint` decimal value for every whole `base_mint` token"
            ],
            "type": "u64"
          },
          {
            "name": "partialAllowed",
            "docs": [
              "Whether to allow partial fulfillment"
            ],
            "type": "bool"
          },
          {
            "name": "expiryTs",
            "docs": [
              "Timestamp when order should expire if not fulfilled by that point"
            ],
            "type": "u64"
          },
          {
            "name": "pricingModel",
            "docs": [
              "Model used for pricing:",
              "- fixed stands for instant sell at `start_price`"
            ],
            "type": {
              "defined": {
                "name": "pricingModel"
              }
            }
          },
          {
            "name": "claimType",
            "docs": [
              "How base token should be claimed on order fulfillment"
            ],
            "type": {
              "defined": {
                "name": "claimType"
              }
            }
          },
          {
            "name": "buffer",
            "docs": [
              "Buffer for additional fields"
            ],
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    },
    {
      "name": "orderState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "filledAmount",
            "docs": [
              "Filled amount of the order"
            ],
            "type": "u64"
          },
          {
            "name": "createdTs",
            "docs": [
              "Timestamp when order was created"
            ],
            "type": "u64"
          },
          {
            "name": "lastFilledTs",
            "docs": [
              "Timestamp when order was filled last time"
            ],
            "type": "u64"
          },
          {
            "name": "cancelledTs",
            "docs": [
              "Timestamp when order was cancelled"
            ],
            "type": "u64"
          },
          {
            "name": "buffer",
            "docs": [
              "Buffer for additional fields"
            ],
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    },
    {
      "name": "pricingModel",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "fixed"
          }
        ]
      }
    },
    {
      "name": "vestingConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "startTs",
            "docs": [
              "When vesting contract start time should be, use 0 to start immediately after fulfillment"
            ],
            "type": "u64"
          },
          {
            "name": "period",
            "docs": [
              "Vesting unlock period in seconds"
            ],
            "type": "u64"
          },
          {
            "name": "amountPerPeriod",
            "docs": [
              "Vesting unlock amount"
            ],
            "type": "u64"
          },
          {
            "name": "cliffAmount",
            "docs": [
              "Amount to be unlocked right at the start of vesting"
            ],
            "type": "u64"
          },
          {
            "name": "buffer",
            "docs": [
              "Buffer for additional fields"
            ],
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    }
  ]
};

export const IDL = {
  "version": "0.1.0",
  "name": "streamflow_escrow",
  "instructions": [
    {
      "name": "cancelOrder",
      "docs": [
        "Cancel an order.",
        "",
        "- Order creator creator can cancel anytime;",
        "- pre-configured `executor` can also cancel the order, meaning that they reject it;",
        "- anyone can cancel an order after it has been expired, tokens will always be returned to the order creator;"
      ],
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true,
          "docs": [
            "Account that will cover tx fees, should be equal to creator if not is not expired"
          ]
        },
        {
          "name": "order",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Order to cancel"
          ]
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Vault that stores base tokens"
          ]
        },
        {
          "name": "creator",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "to",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Token account that will receive back base mint tokens"
          ]
        },
        {
          "name": "baseMint",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Quote mint of the order"
          ]
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "SPL token program interface."
          ]
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "System program."
          ]
        },
        {
          "name": "eventAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "program",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "createOrderFixed",
      "docs": [
        "Create an order with fixed `start_price`"
      ],
      "accounts": [
        {
          "name": "creator",
          "isMut": true,
          "isSigner": true,
          "docs": [
            "Order creator"
          ]
        },
        {
          "name": "from",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Token account from which base token will be transferred"
          ]
        },
        {
          "name": "order",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Order to cancel"
          ]
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Vault that stores base tokens"
          ]
        },
        {
          "name": "executor",
          "isMut": false,
          "isSigner": false,
          "isOptional": true
        },
        {
          "name": "partner",
          "isMut": false,
          "isSigner": false,
          "isOptional": true
        },
        {
          "name": "baseMint",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "Quote mint of the order"
          ]
        },
        {
          "name": "quoteMint",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "Quote mint of the order"
          ]
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "SPL token program interface."
          ]
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "The [Associated Token] program."
          ]
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "System program."
          ]
        },
        {
          "name": "eventAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "program",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "ix",
          "type": {
            "defined": "CreateOrderFixedIx"
          }
        }
      ]
    },
    {
      "name": "fillOrderInstant",
      "docs": [
        "Fill an order, claim `amount` of base tokens instantly."
      ],
      "accounts": [
        {
          "name": "common",
          "accounts": [
            {
              "name": "executor",
              "isMut": true,
              "isSigner": true,
              "docs": [
                "Order executor"
              ]
            },
            {
              "name": "from",
              "isMut": true,
              "isSigner": false,
              "docs": [
                "Token account from which quote token will be transferred"
              ]
            },
            {
              "name": "toBase",
              "isMut": true,
              "isSigner": false,
              "docs": [
                "Executor TA that will receive base tokens"
              ]
            },
            {
              "name": "order",
              "isMut": true,
              "isSigner": false,
              "docs": [
                "Order to cancel"
              ]
            },
            {
              "name": "vault",
              "isMut": true,
              "isSigner": false,
              "docs": [
                "Vault that stores base tokens"
              ]
            },
            {
              "name": "creator",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "toQuote",
              "isMut": true,
              "isSigner": false,
              "docs": [
                "Creator TA that will receive quote mint tokens"
              ]
            },
            {
              "name": "baseMint",
              "isMut": true,
              "isSigner": false,
              "docs": [
                "Base mint of the order"
              ]
            },
            {
              "name": "quoteMint",
              "isMut": false,
              "isSigner": false,
              "docs": [
                "Quote mint of the order"
              ]
            },
            {
              "name": "baseTokenProgram",
              "isMut": false,
              "isSigner": false,
              "docs": [
                "Token program used for base mint tokens"
              ]
            },
            {
              "name": "quotaTokenProgram",
              "isMut": false,
              "isSigner": false,
              "docs": [
                "Token program used for quote mint tokens"
              ]
            }
          ]
        },
        {
          "name": "executionRecord",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "System program."
          ]
        },
        {
          "name": "eventAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "program",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u32"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "price",
          "type": "u64"
        },
        {
          "name": "ceilAllowed",
          "type": "bool"
        }
      ]
    },
    {
      "name": "fillOrderVested",
      "docs": [
        "Fill an order, claim `amount` of base tokens in a vested fashion."
      ],
      "accounts": [
        {
          "name": "common",
          "accounts": [
            {
              "name": "executor",
              "isMut": true,
              "isSigner": true,
              "docs": [
                "Order executor"
              ]
            },
            {
              "name": "from",
              "isMut": true,
              "isSigner": false,
              "docs": [
                "Token account from which quote token will be transferred"
              ]
            },
            {
              "name": "toBase",
              "isMut": true,
              "isSigner": false,
              "docs": [
                "Executor TA that will receive base tokens"
              ]
            },
            {
              "name": "order",
              "isMut": true,
              "isSigner": false,
              "docs": [
                "Order to cancel"
              ]
            },
            {
              "name": "vault",
              "isMut": true,
              "isSigner": false,
              "docs": [
                "Vault that stores base tokens"
              ]
            },
            {
              "name": "creator",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "toQuote",
              "isMut": true,
              "isSigner": false,
              "docs": [
                "Creator TA that will receive quote mint tokens"
              ]
            },
            {
              "name": "baseMint",
              "isMut": true,
              "isSigner": false,
              "docs": [
                "Base mint of the order"
              ]
            },
            {
              "name": "quoteMint",
              "isMut": false,
              "isSigner": false,
              "docs": [
                "Quote mint of the order"
              ]
            },
            {
              "name": "baseTokenProgram",
              "isMut": false,
              "isSigner": false,
              "docs": [
                "Token program used for base mint tokens"
              ]
            },
            {
              "name": "quotaTokenProgram",
              "isMut": false,
              "isSigner": false,
              "docs": [
                "Token program used for quote mint tokens"
              ]
            }
          ]
        },
        {
          "name": "executionRecord",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "streamMetadata",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "escrowTokens",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "withdrawor",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "streamflowProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "feeOracle",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "Associated token program."
          ]
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "Sysvar rent."
          ]
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "System program."
          ]
        },
        {
          "name": "eventAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "program",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u32"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "price",
          "type": "u64"
        },
        {
          "name": "ceilAllowed",
          "type": "bool"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "executionRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nonce",
            "type": "u32",
            "docs": [
              "Nonce used to differentiate records of the same executor"
            ]
          },
          {
            "name": "order",
            "type": "publicKey",
            "docs": [
              "Order id"
            ]
          },
          {
            "name": "executor",
            "type": "publicKey",
            "docs": [
              "Counterparty that filled the order"
            ]
          },
          {
            "name": "contract",
            "type": "publicKey",
            "docs": [
              "Vesting contract created after the order was filled"
            ]
          },
          {
            "name": "filledAmount",
            "type": "u64",
            "docs": [
              "Filled amount"
            ]
          },
          {
            "name": "paidAmount",
            "type": "u64",
            "docs": [
              "How much quote tokens were paid"
            ]
          },
          {
            "name": "createdTs",
            "type": "u64",
            "docs": [
              "Timestamp when the record was created"
            ]
          },
          {
            "name": "buffer",
            "type": {
              "array": [
                "u8",
                64
              ]
            },
            "docs": [
              "Buffer for additional fields"
            ]
          }
        ]
      }
    },
    {
      "name": "order",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8",
            "docs": [
              "Bump Seed used to sign transactions"
            ]
          },
          {
            "name": "nonce",
            "type": "u32",
            "docs": [
              "Nonce to differentiate orders for the same mint"
            ]
          },
          {
            "name": "baseMint",
            "type": "publicKey",
            "docs": [
              "Mint of the Token stored in Escrow"
            ]
          },
          {
            "name": "quoteMint",
            "type": "publicKey",
            "docs": [
              "Mint of the Token to exchange base mint tokens for"
            ]
          },
          {
            "name": "creator",
            "type": "publicKey",
            "docs": [
              "Current authority"
            ]
          },
          {
            "name": "executor",
            "type": "publicKey",
            "docs": [
              "Optional constraint of the counterparty to fulfill the order"
            ]
          },
          {
            "name": "partner",
            "type": "publicKey",
            "docs": [
              "Optional partner/referral account"
            ]
          },
          {
            "name": "vault",
            "type": "publicKey",
            "docs": [
              "Token Account that stores deposited tokens"
            ]
          },
          {
            "name": "config",
            "type": {
              "defined": "OrderConfig"
            }
          },
          {
            "name": "vestingConfig",
            "type": {
              "defined": "VestingConfig"
            }
          },
          {
            "name": "state",
            "type": {
              "defined": "OrderState"
            }
          },
          {
            "name": "buffer1",
            "type": {
              "array": [
                "u8",
                64
              ]
            },
            "docs": [
              "Buffer for additional fields"
            ]
          },
          {
            "name": "buffer2",
            "type": {
              "array": [
                "u8",
                64
              ]
            },
            "docs": [
              "Buffer for additional fields"
            ]
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "CreateOrderFixedIx",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nonce",
            "type": "u32"
          },
          {
            "name": "amount",
            "type": "u64",
            "docs": [
              "Amount of `base_mint` tokens"
            ]
          },
          {
            "name": "startPrice",
            "type": "u64",
            "docs": [
              "Start Price in `quote_mint` decimal value for base tokens"
            ]
          },
          {
            "name": "partialAllowed",
            "type": "bool",
            "docs": [
              "Whether to allow partial fulfillment"
            ]
          },
          {
            "name": "expiryTs",
            "type": "u64",
            "docs": [
              "Timestamp when order expires"
            ]
          },
          {
            "name": "claimType",
            "type": {
              "defined": "ClaimType"
            },
            "docs": [
              "How the token should be claimed after order fulfillment"
            ]
          },
          {
            "name": "vestingStartTs",
            "type": "u64",
            "docs": [
              "Vesting Claim Type options",
              "When vesting contract start time should be"
            ]
          },
          {
            "name": "vestingPeriod",
            "type": "u64",
            "docs": [
              "Vesting release period in seconds"
            ]
          },
          {
            "name": "vestingAmountPerPeriod",
            "type": "u64",
            "docs": [
              "When vesting contract end time should be"
            ]
          },
          {
            "name": "vestingCliffAmount",
            "type": "u64",
            "docs": [
              "Amount of tokens to be unlocked right at the start of vesting"
            ]
          }
        ]
      }
    },
    {
      "name": "OrderConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64",
            "docs": [
              "Amount of base tokens"
            ]
          },
          {
            "name": "startPrice",
            "type": "u64",
            "docs": [
              "Price in `quote_mint` decimal value for every whole `base_mint` token"
            ]
          },
          {
            "name": "partialAllowed",
            "type": "bool",
            "docs": [
              "Whether to allow partial fulfillment"
            ]
          },
          {
            "name": "expiryTs",
            "type": "u64",
            "docs": [
              "Timestamp when order should expire if not fulfilled by that point"
            ]
          },
          {
            "name": "pricingModel",
            "type": {
              "defined": "PricingModel"
            },
            "docs": [
              "Model used for pricing:",
              "- fixed stands for instant sell at `start_price`"
            ]
          },
          {
            "name": "claimType",
            "type": {
              "defined": "ClaimType"
            },
            "docs": [
              "How base token should be claimed on order fulfillment"
            ]
          },
          {
            "name": "buffer",
            "type": {
              "array": [
                "u8",
                64
              ]
            },
            "docs": [
              "Buffer for additional fields"
            ]
          }
        ]
      }
    },
    {
      "name": "OrderState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "filledAmount",
            "type": "u64",
            "docs": [
              "Filled amount of the order"
            ]
          },
          {
            "name": "createdTs",
            "type": "u64",
            "docs": [
              "Timestamp when order was created"
            ]
          },
          {
            "name": "lastFilledTs",
            "type": "u64",
            "docs": [
              "Timestamp when order was filled last time"
            ]
          },
          {
            "name": "cancelledTs",
            "type": "u64",
            "docs": [
              "Timestamp when order was cancelled"
            ]
          },
          {
            "name": "buffer",
            "type": {
              "array": [
                "u8",
                64
              ]
            },
            "docs": [
              "Buffer for additional fields"
            ]
          }
        ]
      }
    },
    {
      "name": "VestingConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "startTs",
            "type": "u64",
            "docs": [
              "When vesting contract start time should be, use 0 to start immediately after fulfillment"
            ]
          },
          {
            "name": "period",
            "type": "u64",
            "docs": [
              "Vesting unlock period in seconds"
            ]
          },
          {
            "name": "amountPerPeriod",
            "type": "u64",
            "docs": [
              "Vesting unlock amount"
            ]
          },
          {
            "name": "cliffAmount",
            "type": "u64",
            "docs": [
              "Amount to be unlocked right at the start of vesting"
            ]
          },
          {
            "name": "buffer",
            "type": {
              "array": [
                "u8",
                64
              ]
            },
            "docs": [
              "Buffer for additional fields"
            ]
          }
        ]
      }
    },
    {
      "name": "ClaimType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Instant"
          },
          {
            "name": "Vested"
          }
        ]
      }
    },
    {
      "name": "PricingModel",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Fixed"
          }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "CancelEvent",
      "fields": [
        {
          "name": "order",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "u64",
          "index": false
        }
      ]
    },
    {
      "name": "CreateEvent",
      "fields": [
        {
          "name": "baseMint",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "creator",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "quoteMint",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "pricingModel",
          "type": {
            "defined": "PricingModel"
          },
          "index": false
        },
        {
          "name": "startPrice",
          "type": "u64",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "u64",
          "index": false
        }
      ]
    },
    {
      "name": "FillEvent",
      "fields": [
        {
          "name": "order",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "executor",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "contract",
          "type": {
            "option": "publicKey"
          },
          "index": false
        },
        {
          "name": "fillAmount",
          "type": "u64",
          "index": false
        },
        {
          "name": "paidAmount",
          "type": "u64",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "u64",
          "index": false
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "Unauthorized",
      "msg": "Authority does not have permission for this action"
    },
    {
      "code": 6001,
      "name": "ArithmeticError",
      "msg": "Arithmetic error"
    },
    {
      "code": 6002,
      "name": "InvalidStreamMetadata",
      "msg": "Invalid Stream Metadata"
    },
    {
      "code": 6003,
      "name": "InvalidAmount",
      "msg": "Amount should be greater than 0"
    },
    {
      "code": 6004,
      "name": "InvalidPrice",
      "msg": "Price should be greater than 0"
    },
    {
      "code": 6005,
      "name": "InvalidExpiryTs",
      "msg": "Expiry ts should be in the future"
    },
    {
      "code": 6006,
      "name": "InvalidVestingOptions",
      "msg": "Provided vesting claim options are invalid"
    },
    {
      "code": 6007,
      "name": "InvalidMints",
      "msg": "Base mint can not equal quote mint"
    },
    {
      "code": 6008,
      "name": "UnsupportedTokenExtensions",
      "msg": "Mint has unsupported Token Extensions"
    },
    {
      "code": 6009,
      "name": "InvalidFillPrice",
      "msg": "Price to fill the order does not match the order price"
    },
    {
      "code": 6010,
      "name": "InvalidFillAmount",
      "msg": "Provided amount to fill is not valid"
    },
    {
      "code": 6011,
      "name": "InvalidClaimType",
      "msg": "Provided claim type is invalid"
    },
    {
      "code": 6012,
      "name": "OrderFilled",
      "msg": "Order is already fully filled"
    },
    {
      "code": 6013,
      "name": "OrderCancelled",
      "msg": "Order is cancelled"
    },
    {
      "code": 6014,
      "name": "OrderExpired",
      "msg": "Order is expired"
    },
    {
      "code": 6015,
      "name": "AccurateTransferNotPossible",
      "msg": "Cannot accurately transfer the requested amount accounted for transfer fees"
    }
  ],
  "metadata": {
    "address": "ESCRoWj8QUJ5cTXCBWbGpW6AzaaEAtRbZuwKp8c4YYGs"
  }
};
