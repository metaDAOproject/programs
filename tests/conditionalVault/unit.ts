import * as anchor from "@coral-xyz/anchor";
import { BN, Program, web3 } from "@coral-xyz/anchor";
import { MPL_TOKEN_METADATA_PROGRAM_ID as UMI_MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { Umi, keypairIdentity } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  fromWeb3JsKeypair,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import * as token from "@solana/spl-token";
import { BankrunProvider } from "anchor-bankrun";
import { assert } from "chai";
import { BanksClient, ProgramTestContext, startAnchor } from "solana-bankrun";
import {
  createAssociatedTokenAccount,
  createMint,
  getAccount,
  getMint,
  mintTo,
  transfer,
} from "spl-token-bankrun";

const { PublicKey, Keypair } = web3;

import {
  ConditionalVault,
  IDL as ConditionalVaultIDL,
} from "../../target/types/conditional_vault.js";
import {
  CONDITIONAL_VAULT_V0_4_PROGRAM_ID,
  ConditionalVaultClient,
  getConditionalTokenMintAddr,
  getQuestionAddr,
  getVaultAddr,
  sha256,
} from "@metadaoproject/programs";

export type VaultProgram = anchor.Program<ConditionalVault>;
export type PublicKey = anchor.web3.PublicKey;
export type Signer = anchor.web3.Signer;
export type Keypair = anchor.web3.Keypair;

const METADATA_URI =
  "https://ftgnmxferax7tpgqyzdo76sisk5fhpsjv34omvgz33m7udvnsfba.arweave.net/LMzWXKSIL_m80MZG7_pIkrpTvkmu-OZU2d7Z-g6tkUI";
const MPL_TOKEN_METADATA_PROGRAM_ID = toWeb3JsPublicKey(
  UMI_MPL_TOKEN_METADATA_PROGRAM_ID,
);

export enum VaultStatus {
  Active,
  Finalized,
  Reverted,
}

// this test file isn't 'clean' or DRY or whatever; sorry!

describe("conditional_vault", async function () {
  let provider: anchor.Provider;
  let vaultClient: ConditionalVaultClient;

  let vault: PublicKey;
  let proposal: PublicKey;
  let vaultUnderlyingTokenAccount: anchor.web3.PublicKey;
  let underlyingTokenMint: anchor.web3.PublicKey;
  let conditionalOnFinalizeMint: anchor.web3.PublicKey;
  let conditionalOnRevertMint: anchor.web3.PublicKey;
  let nonce: BN;
  let settlementAuthority: anchor.web3.Keypair;
  let underlyingMintAuthority: anchor.web3.Keypair;
  let alice: anchor.web3.Keypair;
  let context: ProgramTestContext;
  let banksClient: BanksClient;
  let umi: Umi;

  // note: adding types to these creates a slew of type errors below
  let payer;
  let vaultProgram;

  before(async function () {
    context = await startAnchor(
      "./",
      [
        // even though the program is loaded into the test validator, we need
        // to tell banks test client to load it as well
        {
          name: "mpl_token_metadata",
          programId: MPL_TOKEN_METADATA_PROGRAM_ID,
        },
      ],
      [],
    );
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    umi = createUmi(anchor.AnchorProvider.env().connection);

    vaultProgram = new Program<ConditionalVault>(
      ConditionalVaultIDL,
      CONDITIONAL_VAULT_V0_4_PROGRAM_ID,
      provider,
    );

    vaultClient = ConditionalVaultClient.createClient({
      provider: provider as any,
    });

    payer = vaultProgram.provider.wallet.payer;
    alice = anchor.web3.Keypair.generate();
    settlementAuthority = anchor.web3.Keypair.generate();
    underlyingMintAuthority = anchor.web3.Keypair.generate();
    umi.use(keypairIdentity(fromWeb3JsKeypair(payer)));

    underlyingTokenMint = await createMint(
      banksClient,
      payer as anchor.web3.Keypair,
      underlyingMintAuthority.publicKey,
      null,
      8,
    );

    proposal = Keypair.generate().publicKey;

    [vault] = getVaultAddr(
      vaultProgram.programId,
      settlementAuthority.publicKey,
      underlyingTokenMint,
    );

    vaultUnderlyingTokenAccount = await token.getAssociatedTokenAddress(
      underlyingTokenMint,
      vault,
      true,
    );
  });

  describe("#initialize_question", async function () {
    it("initializes 2-outcome questions", async function () {
      const questionId = sha256(new Uint8Array([1, 2, 3]));

      await vaultClient
        .initializeQuestionIx(questionId, settlementAuthority.publicKey, 2)
        .rpc();

      const [question] = getQuestionAddr(
        vaultProgram.programId,
        questionId,
        settlementAuthority.publicKey,
        2,
      );

      const storedQuestion = await vaultClient.fetchQuestion(question);
      assert.deepEqual(storedQuestion.questionId, Array.from(questionId));
      assert.ok(storedQuestion.oracle.equals(settlementAuthority.publicKey));
      assert.deepEqual(storedQuestion.payoutNumerators, [0, 0]);
      assert.equal(storedQuestion.payoutDenominator, 0);
    });
  });

  describe("#initialize_new_conditional_vault", async function () {
    const testCases = [
      { name: "2-outcome question", idArray: [3, 2, 1], outcomes: 2 },
      { name: "3-outcome question", idArray: [4, 5, 6], outcomes: 3 },
      { name: "4-outcome question", idArray: [7, 8, 9], outcomes: 4 },
    ];

    testCases.forEach(({ name, idArray, outcomes }) => {
      describe(name, function () {
        let question: PublicKey;

        beforeEach(async function () {
          const questionId = sha256(new Uint8Array(idArray));
          question = await vaultClient.initializeQuestion(
            questionId,
            settlementAuthority.publicKey,
            outcomes,
          );
        });

        it("initializes vaults correctly", async function () {
          await vaultClient
            .initializeVaultIx(question, underlyingTokenMint, outcomes)
            .rpc();

          const [vault, pdaBump] = getVaultAddr(
            vaultProgram.programId,
            question,
            underlyingTokenMint,
          );

          const storedVault = await vaultClient.fetchVault(vault);
          assert.ok(storedVault.question.equals(question));
          assert.ok(
            storedVault.underlyingTokenMint.equals(underlyingTokenMint),
          );

          const vaultUnderlyingTokenAccount =
            token.getAssociatedTokenAddressSync(
              underlyingTokenMint,
              vault,
              true,
            );
          assert.ok(
            storedVault.underlyingTokenAccount.equals(
              vaultUnderlyingTokenAccount,
            ),
          );
          const storedConditionalTokenMints = storedVault.conditionalTokenMints;
          storedConditionalTokenMints.forEach((mint, i) => {
            const [expectedMint] = getConditionalTokenMintAddr(
              vaultProgram.programId,
              vault,
              i,
            );
            assert.ok(mint.equals(expectedMint));
          });
          assert.equal(storedVault.pdaBump, pdaBump);
          assert.equal(storedVault.decimals, 8);

          for (const mint of storedConditionalTokenMints) {
            const storedMint = await getMint(banksClient, mint);
            assert.ok(storedMint.mintAuthority.equals(vault));
            assert.equal(storedMint.supply.toString(), "0");
            assert.equal(storedMint.decimals, 8);
            assert.isNull(storedMint.freezeAuthority);
          }
        });
      });
    });
  });

  describe("#resolve_question", async function () {
    let question: PublicKey;

    beforeEach(async function () {
      const questionId = sha256(new Uint8Array([4, 2, 1]));

      question = await vaultClient.initializeQuestion(
        questionId,
        settlementAuthority.publicKey,
        2,
      );
    });

    it("resolves questions", async function () {
      let storedQuestion = await vaultClient.fetchQuestion(question);

      assert.deepEqual(storedQuestion.payoutNumerators, [0, 0]);
      assert.equal(storedQuestion.payoutDenominator, 0);

      await vaultClient
        .resolveQuestionIx(question, settlementAuthority, [1, 0])
        .rpc();

      storedQuestion = await vaultClient.fetchQuestion(question);

      assert.deepEqual(storedQuestion.payoutNumerators, [1, 0]);
      assert.equal(storedQuestion.payoutDenominator, 1);
    });
  });

  describe("#split_tokens", async function () {
    let question: PublicKey;
    let vault: PublicKey;

    beforeEach(async function () {
      const questionId = sha256(new Uint8Array([5, 2, 1]));

      question = await vaultClient.initializeQuestion(
        questionId,
        settlementAuthority.publicKey,
        2,
      );
      vault = await vaultClient.initializeVault(
        question,
        underlyingTokenMint,
        2,
      );

      const userUnderlyingTokenAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        underlyingTokenMint,
        payer.publicKey,
      );

      await mintTo(
        banksClient,
        payer,
        underlyingTokenMint,
        userUnderlyingTokenAccount,
        underlyingMintAuthority,
        10_000_000_000n,
      );
    });

    it("splits tokens", async function () {
      await vaultClient
        .splitTokensIx(question, vault, underlyingTokenMint, new BN(1000), 2)
        .rpc();

      const storedVault = await vaultClient.fetchVault(vault);

      const storedVaultUnderlyingAcc = await getAccount(
        banksClient,
        storedVault.underlyingTokenAccount,
      );
      assert.equal(storedVaultUnderlyingAcc.amount.toString(), "1000");

      const storedConditionalTokenMints = storedVault.conditionalTokenMints;
      for (const mint of storedConditionalTokenMints) {
        const storedMint = await getMint(banksClient, mint);
        assert.equal(storedMint.supply.toString(), "1000");
        const storedTokenAcc = await getAccount(
          banksClient,
          token.getAssociatedTokenAddressSync(mint, payer.publicKey),
        );
        assert.equal(storedTokenAcc.amount.toString(), "1000");
      }
    });
  });

  describe("#merge_tokens", async function () {
    let question: PublicKey;
    let vault: PublicKey;

    beforeEach(async function () {
      const questionId = sha256(new Uint8Array([9, 2, 1]));

      question = await vaultClient.initializeQuestion(
        questionId,
        settlementAuthority.publicKey,
        2,
      );
      vault = await vaultClient.initializeVault(
        question,
        underlyingTokenMint,
        2,
      );

      await vaultClient
        .splitTokensIx(question, vault, underlyingTokenMint, new BN(1000), 2)
        .rpc();
    });

    it("merges tokens", async function () {
      const balanceBefore = await getAccount(
        banksClient,
        token.getAssociatedTokenAddressSync(
          underlyingTokenMint,
          payer.publicKey,
        ),
      ).then((acc) => acc.amount);
      await vaultClient
        .mergeTokensIx(question, vault, underlyingTokenMint, new BN(600), 2)
        .rpc();
      const balanceAfter = await getAccount(
        banksClient,
        token.getAssociatedTokenAddressSync(
          underlyingTokenMint,
          payer.publicKey,
        ),
      ).then((acc) => acc.amount);

      assert.isTrue(balanceAfter > balanceBefore);
      assert.equal(balanceAfter - balanceBefore, 600);
    });
  });

  describe("#redeem_tokens", async function () {
    let question: PublicKey;
    let vault: PublicKey;

    beforeEach(async function () {
      const questionId = sha256(new Uint8Array([9, 28, 2, 1]));

      question = await vaultClient.initializeQuestion(
        questionId,
        settlementAuthority.publicKey,
        2,
      );
      vault = await vaultClient.initializeVault(
        question,
        underlyingTokenMint,
        2,
      );

      await vaultClient
        .splitTokensIx(question, vault, underlyingTokenMint, new BN(1000), 2)
        .rpc();
    });

    // it("can't redeem tokens when question is not resolved", async function () {
    //   const callbacks = expectError(
    //     "CantRedeemConditionalTokens",
    //     "redeemed tokens despite question not being resolved"
    //   );

    //   await vaultClient
    //     .redeemTokensIx(question, vault, underlyingTokenMint, new BN(600), 2)
    //     .rpc()
    //     .then(callbacks[0], callbacks[1]);
    // });

    // it("can redeem tokens when question is resolved", async function () {
    //   await vaultClient
    //     .resolveQuestionIx(question, settlementAuthority, [1, 0])
    //     .rpc();

    //   const underlyingTokenAccount = await token.getAssociatedTokenAddress(
    //     underlyingTokenMint,
    //     payer.publicKey
    //   );

    //   const balanceBefore = await getAccount(banksClient, underlyingTokenAccount)
    //     .then(acc => acc.amount);

    //   await vaultClient
    //     .redeemTokensIx(question, vault, underlyingTokenMint, new BN(600), 2)
    //     .rpc();

    //   const balanceAfter = await getAccount(banksClient, underlyingTokenAccount)
    //     .then(acc => acc.amount);

    //   assert.isTrue(balanceAfter > balanceBefore);
    //   assert.equal(balanceAfter - balanceBefore, 1000n);
    // });

    it("can redeem tokens when question is resolved", async function () {
      await vaultClient
        .resolveQuestionIx(question, settlementAuthority, [1, 0])
        .rpc();

      const storedVault = await vaultClient.fetchVault(vault);

      const outcome0Tokens = storedVault.conditionalTokenMints[0];

      const burne = Keypair.generate();
      await createAssociatedTokenAccount(
        banksClient,
        payer,
        outcome0Tokens,
        burne.publicKey,
      );

      await transfer(
        banksClient,
        payer,
        token.getAssociatedTokenAddressSync(outcome0Tokens, payer.publicKey),
        token.getAssociatedTokenAddressSync(outcome0Tokens, burne.publicKey),
        payer,
        1000n,
      );

      const underlyingTokenAccount = await token.getAssociatedTokenAddress(
        underlyingTokenMint,
        payer.publicKey,
      );

      const balanceBefore = await getAccount(
        banksClient,
        underlyingTokenAccount,
      ).then((acc) => acc.amount);

      await vaultClient
        .redeemTokensIx(question, vault, underlyingTokenMint, 2)
        .rpc();

      const balanceAfter = await getAccount(
        banksClient,
        underlyingTokenAccount,
      ).then((acc) => acc.amount);

      assert.isTrue(balanceAfter == balanceBefore);
    });
  });
});

//   describe("#initialize_conditional_vault", async function () {
//     it("initializes vaults", async function () {
//       await vaultClient
//         .initializeVaultIx(
//           settlementAuthority.publicKey,
//           underlyingTokenMint,
//           proposal
//         )
//         .rpc();

//       conditionalOnFinalizeMint = getVaultFinalizeMintAddr(
//         vaultProgram.programId,
//         vault
//       )[0];

//       conditionalOnRevertMint = getVaultRevertMintAddr(
//         vaultProgram.programId,
//         vault
//       )[0];

//       const storedVault = await vaultProgram.account.conditionalVault.fetch(
//         vault
//       );
//       assert.exists(storedVault.status.active);
//       assert.ok(
//         storedVault.settlementAuthority.equals(settlementAuthority.publicKey)
//       );
//       assert.ok(storedVault.underlyingTokenMint.equals(underlyingTokenMint));
//       assert.ok(
//         storedVault.underlyingTokenAccount.equals(vaultUnderlyingTokenAccount)
//       );
//       assert.ok(
//         storedVault.conditionalOnFinalizeTokenMint.equals(
//           conditionalOnFinalizeMint
//         )
//       );
//       assert.ok(
//         storedVault.conditionalOnRevertTokenMint.equals(conditionalOnRevertMint)
//       );
//     });
//   });

//   describe("#mint_conditional_tokens", async function () {
//     // alice is available throughout the tests, bob is just for mint_conditional_tokens
//     let bob: Keypair;
//     let amount = 1000;
//     let bobUnderlyingTokenAccount: PublicKey;
//     let bobConditionalOnFinalizeTokenAccount: PublicKey;
//     let bobConditionalOnRevertTokenAccount: PublicKey;

//     beforeEach(async function () {
//       bob = anchor.web3.Keypair.generate();

//       bobUnderlyingTokenAccount = await createAssociatedTokenAccount(
//         /* bobUnderlyingTokenAccount = await createAccount( */
//         banksClient,
//         payer,
//         underlyingTokenMint,
//         bob.publicKey
//       );

//       bobConditionalOnFinalizeTokenAccount = await createAssociatedTokenAccount(
//         banksClient,
//         payer,
//         conditionalOnFinalizeMint,
//         bob.publicKey
//       );
//       bobConditionalOnRevertTokenAccount = await createAssociatedTokenAccount(
//         banksClient,
//         payer,
//         conditionalOnRevertMint,
//         bob.publicKey
//       );

//       await mintTo(
//         banksClient,
//         payer,
//         underlyingTokenMint,
//         bobUnderlyingTokenAccount,
//         underlyingMintAuthority,
//         amount
//       );
//     });

//     it("mints conditional tokens", async function () {
//       await mintConditionalTokens(
//         vaultProgram,
//         amount,
//         bob,
//         vault,
//         banksClient
//       );
//     });

//     it("mints conditional tokens twice", async function () {
//       await mintConditionalTokens(
//         vaultProgram,
//         amount / 2,
//         bob,
//         vault,
//         banksClient
//       );

//       await mintConditionalTokens(
//         vaultProgram,
//         amount / 2,
//         bob,
//         vault,
//         banksClient
//       );
//     });

//     it("blocks mints when the user doesn't have enough underlying tokens", async function () {
//       const callbacks = expectError(
//         "InsufficientUnderlyingTokens",
//         "mint suceeded despite user not having enough underlying tokens"
//       );
//       await mintConditionalTokens(
//         vaultProgram,
//         amount + 10,
//         bob,
//         vault,
//         banksClient
//       ).then(callbacks[0], callbacks[1]);
//     });

//     it("checks that `vault_underlying_token_account` and `conditional_vault` match up", async function () {
//       const maliciousVaultUnderlyingTokenAccount = await createAccount(
//         banksClient,
//         payer,
//         underlyingTokenMint,
//         anchor.web3.Keypair.generate().publicKey
//       );

//       const callbacks = expectError(
//         "InvalidVaultUnderlyingTokenAccount",
//         "was able to mint conditional tokens while supplying an invalid vault underlying account"
//       );
//       await mintConditionalTokens(
//         vaultProgram,
//         amount,
//         bob,
//         vault,
//         banksClient,
//         undefined,
//         undefined,
//         undefined,
//         maliciousVaultUnderlyingTokenAccount
//       ).then(callbacks[0], callbacks[1]);
//     });

//     it("checks that `user_underlying_token_account` is owned by the user", async function () {
//       const nonOwnedUserUnderlyingAccount = await createAccount(
//         banksClient,
//         payer,
//         underlyingTokenMint,
//         anchor.web3.Keypair.generate().publicKey
//       );

//       await mintTo(
//         banksClient,
//         payer,
//         underlyingTokenMint,
//         nonOwnedUserUnderlyingAccount,
//         underlyingMintAuthority,
//         amount
//       );

//       const callbacks = expectError(
//         "ConstraintTokenOwner",
//         "mint suceeded despite `user_underlying_token_account` not being owned by the user"
//       );

//       await mintConditionalTokens(
//         vaultProgram,
//         amount,
//         bob,
//         vault,
//         banksClient,
//         nonOwnedUserUnderlyingAccount
//       ).then(callbacks[0], callbacks[1]);
//     });

//     it("checks that `user_conditional_on_finalize_token_account` is owned by the user", async function () {
//       const nonOwnedUserConditionalAccount = await createAccount(
//         banksClient,
//         payer,
//         conditionalOnFinalizeMint,
//         anchor.web3.Keypair.generate().publicKey
//       );

//       const callbacks = expectError(
//         "ConstraintTokenOwner",
//         "mint suceeded despite `user_conditional_token_account` not being owned by the user"
//       );

//       await mintConditionalTokens(
//         vaultProgram,
//         amount,
//         bob,
//         vault,
//         banksClient,
//         undefined,
//         nonOwnedUserConditionalAccount
//       ).then(callbacks[0], callbacks[1]);
//     });

//     it("checks that `user_conditional_on_revert_token_account` is owned by the user", async function () {
//       const nonOwnedUserConditionalAccount = await createAccount(
//         banksClient,
//         payer,
//         conditionalOnRevertMint,
//         anchor.web3.Keypair.generate().publicKey
//       );

//       const callbacks = expectError(
//         "ConstraintTokenOwner",
//         "mint suceeded despite `user_conditional_token_account` not being owned by the user"
//       );

//       await mintConditionalTokens(
//         vaultProgram,
//         amount,
//         bob,
//         vault,
//         banksClient,
//         undefined,
//         nonOwnedUserConditionalAccount
//       ).then(callbacks[0], callbacks[1]);
//     });

//     it("checks that `user_conditional_token_account` has `conditional_token_mint` as its mint", async function () {
//       const wrongConditionalTokenMint = await createMint(
//         banksClient,
//         payer,
//         vault,
//         vault,
//         8
//       );
//       const wrongMintBobConditionalTokenAccount = await createAccount(
//         banksClient,
//         payer,
//         wrongConditionalTokenMint,
//         bob.publicKey
//       );

//       const callbacks = expectError(
//         "ConstraintTokenMint",
//         "mint suceeded despite `user_conditional_token_account` having a wrong mint"
//       );

//       await mintConditionalTokens(
//         vaultProgram,
//         amount,
//         bob,
//         vault,
//         banksClient,
//         undefined,
//         wrongMintBobConditionalTokenAccount
//       ).then(callbacks[0], callbacks[1]);
//     });

//     it("checks that `user_underlying_token_account` has the correct mint", async function () {
//       const mintAuthority = anchor.web3.Keypair.generate();
//       const randomMint = await createMint(
//         banksClient,
//         payer,
//         mintAuthority.publicKey,
//         mintAuthority.publicKey,
//         8
//       );
//       const wrongMintBobUnderlyingAccount = await createAccount(
//         banksClient,
//         payer,
//         randomMint,
//         bob.publicKey
//       );

//       await mintTo(
//         banksClient,
//         payer,
//         randomMint,
//         wrongMintBobUnderlyingAccount,
//         mintAuthority,
//         amount
//       );

//       const callbacks = expectError(
//         "ConstraintTokenMint",
//         "mint suceeded despite `user_underlying_token_account` having the wrong mint"
//       );

//       await mintConditionalTokens(
//         vaultProgram,
//         amount,
//         bob,
//         vault,
//         banksClient,
//         wrongMintBobUnderlyingAccount
//       ).then(callbacks[0], callbacks[1]);
//     });

//     it("checks that `conditional_token_mint` is the one stored in the conditional vault", async function () {
//       const wrongConditionalTokenMint = await createMint(
//         banksClient,
//         payer,
//         vault,
//         null,
//         10
//       );

//       const wrongMintBobConditionalTokenAccount = await createAccount(
//         banksClient,
//         payer,
//         wrongConditionalTokenMint,
//         bob.publicKey
//       );

//       const callbacks = expectError(
//         "InvalidConditionalTokenMint",
//         "mint suceeded despite `conditional_token_mint` not being the one stored in the conditional vault"
//       );

//       await mintConditionalTokens(
//         vaultProgram,
//         amount,
//         bob,
//         vault,
//         banksClient,
//         undefined,
//         wrongMintBobConditionalTokenAccount,
//         undefined,
//         undefined,
//         wrongConditionalTokenMint
//       ).then(callbacks[0], callbacks[1]);
//     });
//   });

//   describe("#settle_conditional_vault", async function () {
//     it("allows vaults to be finalized", async function () {
//       let [vault, _, settlementAuthority] = await generateRandomVault(
//         vaultProgram,
//         vaultClient,
//         payer,
//         banksClient,
//         umi
//       );

//       await vaultProgram.methods
//         .settleConditionalVault({ finalized: {} })
//         .accounts({
//           settlementAuthority: settlementAuthority.publicKey,
//           vault,
//         })
//         .signers([settlementAuthority])
//         .rpc();
//     });

//     it("allows vaults to be reverted", async function () {
//       let [vault, _, settlementAuthority] = await generateRandomVault(
//         vaultProgram,
//         vaultClient,
//         payer,
//         banksClient,
//         umi
//       );

//       await vaultProgram.methods
//         .settleConditionalVault({ reverted: {} })
//         .accounts({
//           settlementAuthority: settlementAuthority.publicKey,
//           vault,
//         })
//         .signers([settlementAuthority])
//         .rpc();
//     });

//     it("disallows vaults from being finalized twice", async function () {
//       let [vault, _, settlementAuthority] = await generateRandomVault(
//         vaultProgram,
//         vaultClient,
//         payer,
//         banksClient,
//         umi
//       );

//       await vaultProgram.methods
//         .settleConditionalVault({ finalized: {} })
//         .accounts({
//           settlementAuthority: settlementAuthority.publicKey,
//           vault,
//         })
//         .signers([settlementAuthority])
//         .rpc();

//       const callbacks = expectError(
//         "VaultAlreadySettled",
//         "settle suceeded even though this vault had already been settled"
//       );

//       await vaultProgram.methods
//         .settleConditionalVault({ reverted: {} })
//         .accounts({
//           settlementAuthority: settlementAuthority.publicKey,
//           vault,
//         })
//         .signers([settlementAuthority])
//         .rpc()
//         .then(callbacks[0], callbacks[1]);
//     });
//   });

//   describe("#redeem_and_merge_conditional_tokens_for_underlying_tokens", async function () {
//     let bob: Keypair;
//     let amount = 1000;
//     let mergeAmount = 10;
//     let bobUnderlyingTokenAccount: PublicKey;
//     let bobConditionalOnFinalizeTokenAccount: PublicKey;
//     let bobConditionalOnRevertTokenAccount: PublicKey;

//     beforeEach(async function () {
//       [vault, underlyingMintAuthority, settlementAuthority] =
//         await generateRandomVault(
//           vaultProgram,
//           vaultClient,
//           payer,
//           banksClient,
//           umi
//         );
//       let storedVault = await vaultProgram.account.conditionalVault.fetch(
//         vault
//       );
//       underlyingTokenMint = storedVault.underlyingTokenMint;
//       conditionalOnFinalizeMint = storedVault.conditionalOnFinalizeTokenMint;
//       conditionalOnRevertMint = storedVault.conditionalOnRevertTokenMint;
//       vaultUnderlyingTokenAccount = storedVault.underlyingTokenAccount;

//       bob = anchor.web3.Keypair.generate();

//       bobUnderlyingTokenAccount = await createAssociatedTokenAccount(
//         banksClient,
//         payer,
//         underlyingTokenMint,
//         bob.publicKey
//       );

//       bobConditionalOnFinalizeTokenAccount = await createAssociatedTokenAccount(
//         banksClient,
//         payer,
//         conditionalOnFinalizeMint,
//         bob.publicKey
//       );

//       bobConditionalOnRevertTokenAccount = await createAccount(
//         banksClient,
//         payer,
//         conditionalOnRevertMint,
//         bob.publicKey
//       );

//       await mintTo(
//         banksClient,
//         payer,
//         underlyingTokenMint,
//         bobUnderlyingTokenAccount,
//         underlyingMintAuthority,
//         amount
//       );

//       await mintConditionalTokens(
//         vaultProgram,
//         amount,
//         bob,
//         vault,
//         banksClient
//       );
//     });

//     it("successfully merges 10 tokens before the vault has been finalized", async function () {
//       // Assuming the vault has not yet been finalized

//       await mergeConditionalTokens(
//         vaultProgram,
//         mergeAmount,
//         bob,
//         bobConditionalOnFinalizeTokenAccount,
//         bobConditionalOnRevertTokenAccount,
//         conditionalOnFinalizeMint,
//         conditionalOnRevertMint,
//         bobUnderlyingTokenAccount,
//         vaultUnderlyingTokenAccount,
//         vault,
//         banksClient
//       );
//     });

//     it("prevents users from merging conditional tokens after the vault has been finalized", async function () {
//       await vaultProgram.methods
//         .settleConditionalVault({ finalized: {} })
//         .accounts({
//           settlementAuthority: settlementAuthority.publicKey,
//           vault,
//         })
//         .signers([settlementAuthority])
//         .rpc();

//       const callbacks = expectError(
//         "VaultAlreadySettled",
//         "merge suceeded even though this vault was finalized"
//       );
//       await mergeConditionalTokens(
//         vaultProgram,
//         mergeAmount,
//         bob,
//         bobConditionalOnFinalizeTokenAccount,
//         bobConditionalOnRevertTokenAccount,
//         conditionalOnFinalizeMint,
//         conditionalOnRevertMint,
//         bobUnderlyingTokenAccount,
//         vaultUnderlyingTokenAccount,
//         vault,
//         banksClient
//       ).then(callbacks[0], callbacks[1]);
//     });

//     it("allows users to redeem conditional-on-finalize tokens for underlying tokens when a vault has been finalized", async function () {
//       await vaultProgram.methods
//         .settleConditionalVault({ finalized: {} })
//         .accounts({
//           settlementAuthority: settlementAuthority.publicKey,
//           vault,
//         })
//         .signers([settlementAuthority])
//         .rpc();

//       await redeemConditionalTokens(
//         vaultProgram,
//         bob,
//         bobConditionalOnFinalizeTokenAccount,
//         bobConditionalOnRevertTokenAccount,
//         conditionalOnFinalizeMint,
//         conditionalOnRevertMint,
//         bobUnderlyingTokenAccount,
//         vaultUnderlyingTokenAccount,
//         vault,
//         banksClient
//       );
//     });

//     it("allows user to redeeming conditional-on-revert tokens for underlying tokens when a vault is reverted", async function () {
//       await vaultProgram.methods
//         .settleConditionalVault({ reverted: {} })
//         .accounts({
//           settlementAuthority: settlementAuthority.publicKey,
//           vault,
//         })
//         .signers([settlementAuthority])
//         .rpc();

//       await redeemConditionalTokens(
//         vaultProgram,
//         bob,
//         bobConditionalOnFinalizeTokenAccount,
//         bobConditionalOnRevertTokenAccount,
//         conditionalOnFinalizeMint,
//         conditionalOnRevertMint,
//         bobUnderlyingTokenAccount,
//         vaultUnderlyingTokenAccount,
//         vault,
//         banksClient
//       );
//     });

//     it("prevents users from redeeming conditional tokens while a vault is still active", async function () {
//       const callbacks = expectError(
//         "CantRedeemConditionalTokens",
//         "redemption suceeded even though this vault was still active"
//       );
//       await redeemConditionalTokens(
//         vaultProgram,
//         bob,
//         bobConditionalOnFinalizeTokenAccount,
//         bobConditionalOnRevertTokenAccount,
//         conditionalOnFinalizeMint,
//         conditionalOnRevertMint,
//         bobUnderlyingTokenAccount,
//         vaultUnderlyingTokenAccount,
//         vault,
//         banksClient
//       ).then(callbacks[0], callbacks[1]);
//     });

//     it("checks that the user has provided the correct conditional token mint", async function () {
//       const wrongConditionalTokenMint = await createMint(
//         banksClient,
//         payer,
//         vault,
//         null,
//         10
//       );

//       const wrongMintBobConditionalTokenAccount = await createAccount(
//         banksClient,
//         payer,
//         wrongConditionalTokenMint,
//         bob.publicKey
//       );

//       const callbacks = expectError(
//         "InvalidConditionalTokenMint",
//         "redemption suceeded despite `conditional_token_mint` not being the one stored in the conditional vault"
//       );
//       await redeemConditionalTokens(
//         vaultProgram,
//         bob,
//         wrongMintBobConditionalTokenAccount,
//         bobConditionalOnRevertTokenAccount,
//         wrongConditionalTokenMint,
//         conditionalOnRevertMint,
//         bobUnderlyingTokenAccount,
//         vaultUnderlyingTokenAccount,
//         vault,
//         banksClient
//       ).then(callbacks[0], callbacks[1]);
//     });
//   });
// });

// async function generateRandomVault(
//   vaultProgram: VaultProgram,
//   vaultClient: ConditionalVaultClient,
//   payer: Keypair,
//   banksClient: BanksClient,
//   umi: Umi,
//   settlementAuthority: Keypair = anchor.web3.Keypair.generate()
// ): Promise<[PublicKey, Keypair, Keypair]> {
//   const underlyingMintAuthority = anchor.web3.Keypair.generate();

//   const underlyingTokenMint = await createMint(
//     banksClient,
//     payer,
//     underlyingMintAuthority.publicKey,
//     null,
//     8
//   );

//   const tokenMint = fromWeb3JsPublicKey(underlyingTokenMint);
//   let builder = createMetadataAccountV3(umi, {
//     mint: tokenMint,
//     mintAuthority: createSignerFromKeypair(
//       umi,
//       fromWeb3JsKeypair(underlyingMintAuthority)
//     ),
//     data: {
//       name: "TOKE",
//       symbol: "TOKE",
//       uri: "METADATA_URI",
//       sellerFeeBasisPoints: 0,
//       creators: none(),
//       collection: none(),
//       uses: none(),
//     },
//     isMutable: false,
//     collectionDetails: none(),
//   });
//   builder = builder.setBlockhash(
//     (await umi.rpc.getLatestBlockhash()).blockhash
//   );

//   const createMetadataResult = await vaultProgram.provider.sendAndConfirm(
//     toWeb3JsLegacyTransaction(builder.build(umi)),
//     [underlyingMintAuthority],
//     {
//       skipPreflight: true,
//       commitment: "confirmed",
//     }
//   );
//   //   console.log(createMetadataResult);

//   const proposal = Keypair.generate().publicKey;

//   const [vault] = getVaultAddr(
//     vaultProgram.programId,
//     settlementAuthority.publicKey,
//     underlyingTokenMint,
//     proposal
//   );

//   const conditionalOnFinalizeTokenMint = getVaultFinalizeMintAddr(
//     vaultProgram.programId,
//     vault
//   )[0];
//   const conditionalOnRevertTokenMint = getVaultRevertMintAddr(
//     vaultProgram.programId,
//     vault
//   )[0];

//   const vaultUnderlyingTokenAccount = await token.getAssociatedTokenAddress(
//     underlyingTokenMint,
//     vault,
//     true
//   );

//   // when we have a ts lib, we can consolidate this logic there
//   const [conditionalOnFinalizeTokenMetadata] =
//     anchor.web3.PublicKey.findProgramAddressSync(
//       [
//         anchor.utils.bytes.utf8.encode("metadata"),
//         MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
//         conditionalOnFinalizeTokenMint.toBuffer(),
//       ],
//       MPL_TOKEN_METADATA_PROGRAM_ID
//     );

//   const [conditionalOnRevertTokenMetadata] =
//     anchor.web3.PublicKey.findProgramAddressSync(
//       [
//         anchor.utils.bytes.utf8.encode("metadata"),
//         MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
//         conditionalOnRevertTokenMint.toBuffer(),
//       ],
//       MPL_TOKEN_METADATA_PROGRAM_ID
//     );

//   const [underlyingTokenMetadata] =
//     anchor.web3.PublicKey.findProgramAddressSync(
//       [
//         anchor.utils.bytes.utf8.encode("metadata"),
//         MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
//         underlyingTokenMint.toBuffer(),
//       ],
//       MPL_TOKEN_METADATA_PROGRAM_ID
//     );

//   // const addMetadataToConditionalTokensIx = await vaultProgram.methods
//   //   .addMetadataToConditionalTokens({
//   //     proposalNumber: new BN(0), // nonce,
//   //     onFinalizeUri: METADATA_URI,
//   //     onRevertUri: METADATA_URI,
//   //   })
//   //   .accounts({
//   //     payer: payer.publicKey,
//   //     vault,
//   //     underlyingTokenMint,
//   //     underlyingTokenMetadata,
//   //     conditionalOnFinalizeTokenMint,
//   //     conditionalOnRevertTokenMint,
//   //     conditionalOnFinalizeTokenMetadata,
//   //     conditionalOnRevertTokenMetadata,
//   //     tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
//   //     systemProgram: anchor.web3.SystemProgram.programId,
//   //     rent: SYSVAR_RENT_PUBKEY,
//   //   })
//   //   .instruction();
//   const addMetadataToConditionalTokensIx = await vaultClient
//     .addMetadataToConditionalTokensIx(
//       vault,
//       underlyingTokenMint,
//       1,
//       METADATA_URI,
//       METADATA_URI
//     )
//     .instruction();

//   await vaultClient
//     .initializeVaultIx(
//       settlementAuthority.publicKey,
//       underlyingTokenMint,
//       proposal
//     )
//     .postInstructions([addMetadataToConditionalTokensIx])
//     .rpc();

//   return [vault, underlyingMintAuthority, settlementAuthority];
// }

// export async function mintConditionalTokens(
//   program: VaultProgram,
//   amount: number | bigint,
//   user: Signer,
//   vault: PublicKey,
//   banksClient: BanksClient,
//   userUnderlyingTokenAccount?: PublicKey,
//   userConditionalOnFinalizeTokenAccount?: PublicKey,
//   userConditionalOnRevertTokenAccount?: PublicKey,
//   vaultUnderlyingTokenAccount?: PublicKey,
//   conditionalOnFinalizeTokenMint?: PublicKey
// ) {
//   const storedVault = await program.account.conditionalVault.fetch(vault);
//   if (!userUnderlyingTokenAccount) {
//     userUnderlyingTokenAccount = await token.getAssociatedTokenAddress(
//       storedVault.underlyingTokenMint,
//       user.publicKey,
//       true
//     );
//   }
//   if (!userConditionalOnFinalizeTokenAccount) {
//     userConditionalOnFinalizeTokenAccount =
//       await token.getAssociatedTokenAddress(
//         storedVault.conditionalOnFinalizeTokenMint,
//         user.publicKey,
//         true
//       );
//   }
//   if (!userConditionalOnRevertTokenAccount) {
//     userConditionalOnRevertTokenAccount = await token.getAssociatedTokenAddress(
//       storedVault.conditionalOnRevertTokenMint,
//       user.publicKey,
//       true
//     );
//   }
//   if (!vaultUnderlyingTokenAccount) {
//     vaultUnderlyingTokenAccount = storedVault.underlyingTokenAccount;
//   }
//   if (!conditionalOnFinalizeTokenMint) {
//     conditionalOnFinalizeTokenMint = storedVault.conditionalOnFinalizeTokenMint;
//   }

//   const vaultUnderlyingTokenAccountBefore = await getAccount(
//     banksClient,
//     vaultUnderlyingTokenAccount
//   );
//   const userUnderlyingTokenAccountBefore = await getAccount(
//     banksClient,
//     userUnderlyingTokenAccount
//   );
//   const userConditionalOnFinalizeTokenAccountBefore = await getAccount(
//     banksClient,
//     userConditionalOnFinalizeTokenAccount
//   );
//   const userConditionalOnRevertTokenAccountBefore = await getAccount(
//     banksClient,
//     userConditionalOnRevertTokenAccount
//   );

//   const bnAmount = new anchor.BN(amount.toString());
//   /* try { */
//   await program.methods
//     .mintConditionalTokens(bnAmount)
//     .accounts({
//       authority: user.publicKey,
//       vault,
//       vaultUnderlyingTokenAccount,
//       userUnderlyingTokenAccount,
//       conditionalOnFinalizeTokenMint,
//       userConditionalOnFinalizeTokenAccount,
//       conditionalOnRevertTokenMint: storedVault.conditionalOnRevertTokenMint,
//       userConditionalOnRevertTokenAccount,
//     })
//     .signers([user])
//     .rpc();

//   const vaultUnderlyingTokenAccountAfter = await getAccount(
//     banksClient,
//     vaultUnderlyingTokenAccount
//   );
//   const userUnderlyingTokenAccountAfter = await getAccount(
//     banksClient,
//     userUnderlyingTokenAccount
//   );
//   const userConditionalOnFinalizeTokenAccountAfter = await getAccount(
//     banksClient,
//     userConditionalOnFinalizeTokenAccount
//   );
//   const userConditionalOnRevertTokenAccountAfter = await getAccount(
//     banksClient,
//     userConditionalOnRevertTokenAccount
//   );

//   assert.equal(
//     vaultUnderlyingTokenAccountAfter.amount,
//     vaultUnderlyingTokenAccountBefore.amount + BigInt(amount)
//   );
//   assert.equal(
//     userUnderlyingTokenAccountAfter.amount,
//     userUnderlyingTokenAccountBefore.amount - BigInt(amount)
//   );
//   assert.equal(
//     userConditionalOnFinalizeTokenAccountAfter.amount,
//     userConditionalOnFinalizeTokenAccountBefore.amount + BigInt(amount)
//   );
//   assert.equal(
//     userConditionalOnRevertTokenAccountAfter.amount,
//     userConditionalOnRevertTokenAccountBefore.amount + BigInt(amount)
//   );
// }

// export async function mergeConditionalTokens(
//   vaultProgram: VaultProgram,
//   amount: number | bigint,
//   user: Signer,
//   userConditionalOnFinalizeTokenAccount: PublicKey,
//   userConditionalOnRevertTokenAccount: PublicKey,
//   conditionalOnFinalizeTokenMint: PublicKey,
//   conditionalOnRevertTokenMint: PublicKey,
//   userUnderlyingTokenAccount: PublicKey,
//   vaultUnderlyingTokenAccount: PublicKey,
//   vault: PublicKey,
//   banksClient: BanksClient
// ) {
//   const vaultUnderlyingTokenAccountBefore = await getAccount(
//     banksClient,
//     vaultUnderlyingTokenAccount
//   );
//   const userUnderlyingTokenAccountBefore = await getAccount(
//     banksClient,
//     userUnderlyingTokenAccount
//   );
//   const userConditionalOnFinalizeTokenAccountBefore = await getAccount(
//     banksClient,
//     userConditionalOnFinalizeTokenAccount
//   );
//   const userConditionalOnRevertTokenAccountBefore = await getAccount(
//     banksClient,
//     userConditionalOnRevertTokenAccount
//   );

//   const bnAmount = new anchor.BN(amount.toString());
//   await vaultProgram.methods
//     .mergeConditionalTokensForUnderlyingTokens(bnAmount)
//     .accounts({
//       authority: user.publicKey,
//       userConditionalOnFinalizeTokenAccount,
//       userConditionalOnRevertTokenAccount,
//       userUnderlyingTokenAccount,
//       vaultUnderlyingTokenAccount,
//       vault,
//       conditionalOnFinalizeTokenMint,
//       conditionalOnRevertTokenMint,
//       tokenProgram: token.TOKEN_PROGRAM_ID,
//     })
//     .signers([user])
//     .rpc();

//   const vaultUnderlyingTokenAccountAfter = await getAccount(
//     banksClient,
//     vaultUnderlyingTokenAccount
//   );
//   const userUnderlyingTokenAccountAfter = await getAccount(
//     banksClient,
//     userUnderlyingTokenAccount
//   );
//   const userConditionalOnFinalizeTokenAccountAfter = await getAccount(
//     banksClient,
//     userConditionalOnFinalizeTokenAccount
//   );
//   const userConditionalOnRevertTokenAccountAfter = await getAccount(
//     banksClient,
//     userConditionalOnRevertTokenAccount
//   );

//   assert.equal(
//     vaultUnderlyingTokenAccountAfter.amount,
//     vaultUnderlyingTokenAccountBefore.amount - BigInt(amount)
//   );
//   assert.equal(
//     userUnderlyingTokenAccountAfter.amount,
//     userUnderlyingTokenAccountBefore.amount + BigInt(amount)
//   );
//   assert.equal(
//     userConditionalOnFinalizeTokenAccountAfter.amount,
//     userConditionalOnFinalizeTokenAccountBefore.amount - BigInt(amount)
//   );
//   assert.equal(
//     userConditionalOnRevertTokenAccountAfter.amount,
//     userConditionalOnRevertTokenAccountBefore.amount - BigInt(amount)
//   );
// }

// export async function redeemConditionalTokens(
//   vaultProgram: VaultProgram,
//   user: Signer,
//   userConditionalOnFinalizeTokenAccount: PublicKey,
//   userConditionalOnRevertTokenAccount: PublicKey,
//   conditionalOnFinalizeTokenMint: PublicKey,
//   conditionalOnRevertTokenMint: PublicKey,
//   userUnderlyingTokenAccount: PublicKey,
//   vaultUnderlyingTokenAccount: PublicKey,
//   vault: PublicKey,
//   banksClient: BanksClient
// ) {
//   const vaultUnderlyingTokenAccountBefore = await getAccount(
//     banksClient,
//     vaultUnderlyingTokenAccount
//   );
//   const userUnderlyingTokenAccountBefore = await getAccount(
//     banksClient,
//     userUnderlyingTokenAccount
//   );
//   const userConditionalOnFinalizeTokenAccountBefore = await getAccount(
//     banksClient,
//     userConditionalOnFinalizeTokenAccount
//   );
//   const userConditionalOnRevertTokenAccountBefore = await getAccount(
//     banksClient,
//     userConditionalOnRevertTokenAccount
//   );

//   await vaultProgram.methods
//     .redeemConditionalTokensForUnderlyingTokens()
//     .accounts({
//       authority: user.publicKey,
//       userConditionalOnFinalizeTokenAccount,
//       userConditionalOnRevertTokenAccount,
//       userUnderlyingTokenAccount,
//       vaultUnderlyingTokenAccount,
//       vault,
//       conditionalOnFinalizeTokenMint,
//       conditionalOnRevertTokenMint,
//       tokenProgram: token.TOKEN_PROGRAM_ID,
//     })
//     .signers([user])
//     .rpc();

//   const vaultUnderlyingTokenAccountAfter = await getAccount(
//     banksClient,
//     vaultUnderlyingTokenAccount
//   );
//   const userUnderlyingTokenAccountAfter = await getAccount(
//     banksClient,
//     userUnderlyingTokenAccount
//   );
//   const userConditionalOnFinalizeTokenAccountAfter = await getAccount(
//     banksClient,
//     userConditionalOnFinalizeTokenAccount
//   );
//   const userConditionalOnRevertTokenAccountAfter = await getAccount(
//     banksClient,
//     userConditionalOnRevertTokenAccount
//   );

//   let storedVault = await vaultProgram.account.conditionalVault.fetch(vault);

//   let amount;
//   if (storedVault.status.finalized) {
//     amount = userConditionalOnFinalizeTokenAccountBefore.amount;
//   } else {
//     amount = userConditionalOnRevertTokenAccountBefore.amount;
//   }

//   assert.equal(
//     vaultUnderlyingTokenAccountAfter.amount,
//     vaultUnderlyingTokenAccountBefore.amount - BigInt(amount)
//   );
//   assert.equal(
//     userUnderlyingTokenAccountAfter.amount,
//     userUnderlyingTokenAccountBefore.amount + BigInt(amount)
//   );
//   assert.equal(userConditionalOnFinalizeTokenAccountAfter.amount, BigInt(0));
//   assert.equal(userConditionalOnRevertTokenAccountAfter.amount, BigInt(0));
// }
