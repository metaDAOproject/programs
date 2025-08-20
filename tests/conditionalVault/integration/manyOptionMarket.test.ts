import { sha256 } from "@metadaoproject/futarchy";
import {
  Keypair,
  PublicKey,
  AddressLookupTableProgram,
  TransactionInstruction,
  Connection,
  Transaction,
  TransactionMessage,
  AddressLookupTableAccount,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import {
  createMint,
  getMint,
  mintTo,
  createAssociatedTokenAccount,
  transfer,
  getAccount,
} from "spl-token-bankrun";
import * as token from "@solana/spl-token";
import { BanksClient } from "solana-bankrun";

export default async function test() {
  // A 10-option prediction market test. Alice, Bob, and Charlie are betting on
  // which of 10 candidates will win the next election. Each splits 100 USDC into
  // 10 different token types (CAND1, CAND2, ..., CAND10).

  const vaultClient = this.vaultClient;


  let alice: Keypair = Keypair.generate();
  let bob: Keypair = Keypair.generate();
  let charlie: Keypair = Keypair.generate();
  let operator: Keypair = Keypair.generate();

  const numCandidates = 10;


  let question: PublicKey = await vaultClient.initializeQuestion(
    sha256(
      new TextEncoder().encode(
        "Who's going to win the next election?/CAND1/CAND2/CAND3/CAND4/CAND5/CAND6/CAND7/CAND8/CAND9/CAND10"
      )
    ),
    operator.publicKey,
    numCandidates
  );

  let USDC: PublicKey = await this.createMint(operator.publicKey, 6);

  await this.createTokenAccount(USDC, alice.publicKey);
  await this.createTokenAccount(USDC, bob.publicKey);
  await this.createTokenAccount(USDC, charlie.publicKey);

  await this.mintTo(USDC, alice.publicKey, operator, 100);
  await this.mintTo(USDC, bob.publicKey, operator, 100);
  await this.mintTo(USDC, charlie.publicKey, operator, 100);

  const vault = await vaultClient.initializeVault(
    question,
    USDC,
    numCandidates
  );
  const storedVault = await vaultClient.fetchVault(vault);

  const slot = await this.banksClient.getSlot();
  const [lookupTableInst, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
    authority: this.payer.publicKey,
    payer: this.payer.publicKey,
    recentSlot: slot - 1n,
  });

  let conditionalTokenMints = vaultClient.getConditionalTokenMints(vault, numCandidates);

  // Add all the accounts needed for fillOrderVested to the lookup table
  const extendInstruction = AddressLookupTableProgram.extendLookupTable({
    payer: this.payer.publicKey,
    authority: this.payer.publicKey,
    lookupTable: lookupTableAddress,
    addresses: [
      token.TOKEN_PROGRAM_ID,
      question,
      vault,
      ...conditionalTokenMints,
    ],
  });

  await this.advanceBySlots(1n);

  let tx = new Transaction().add(lookupTableInst, extendInstruction);
  tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  tx.feePayer = this.payer.publicKey;
  tx.sign(this.payer);
  await this.banksClient.processTransaction(tx);

  await this.advanceBySlots(1n)

  const extentIx2 = AddressLookupTableProgram.extendLookupTable({
    payer: this.payer.publicKey,
    authority: this.payer.publicKey,
    lookupTable: lookupTableAddress,
    addresses: [
      Keypair.generate().publicKey,
    ],
  });

  tx = new Transaction().add(extentIx2);
  tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  tx.feePayer = this.payer.publicKey;
  tx.sign(this.payer);
  await this.banksClient.processTransaction(tx);

  // // Create a lookup table
  // // const connection = this.provider.connection as Connection;
  // const slot = await this.banksClient.getSlot();
  // console.log("slot", slot);
  // const [lookupTableInst, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
  //   authority: this.payer.publicKey,
  //   payer: this.payer.publicKey,
  //   recentSlot: slot -1n,
  // });

  // const extendInstruction = AddressLookupTableProgram.extendLookupTable({
  //   payer: this.payer.publicKey,
  //   authority: this.payer.publicKey,
  //   lookupTable: lookupTableAddress,
  //   addresses: [
  //     vault,
  //     vaultClient.vaultProgram.programId,
  //     question,
  //     storedVault.underlyingTokenAccount,
  //   ],
  // });

  // let tx = new Transaction().add(lookupTableInst, extendInstruction);
  // tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  // tx.feePayer = this.payer.publicKey;
  // tx.sign(this.payer);

  // await (this.banksClient as BanksClient).processTransaction(tx)

  // // Send the instructions to create and extend the lookup table
  // // await vaultClient.vaultProgram.provider.sendAndConfirm(
  // //   [tx],
  // //   [this.payer]
  // // );

  // // Verify that the lookup table was created and extended correctly
  // const lookupTable = await this.banksClient.getAccount(lookupTableAddress);
  // console.log(lookupTable);
  // const lookupTable = await connection.getAddressLookupTable(lookupTableAddress);
  // assert.ok(lookupTable.value !== null, "Lookup table not found");
  // assert.equal(lookupTable.value.state.addresses.length, 4, "Incorrect number of addresses in lookup table");
  // assert.ok(lookupTable.value.state.addresses.includes(vault), "Vault address not in lookup table");
  // assert.ok(lookupTable.value.state.addresses.includes(vaultClient.vaultProgram.programId), "Vault program ID not in lookup table");
  // assert.ok(lookupTable.value.state.addresses.includes(question), "Question address not in lookup table");
  // assert.ok(lookupTable.value.state.addresses.includes(storedVault.underlyingTokenAccount), "Underlying vault account not in lookup table");

  // Add metadata to conditional tokens
  for (let i = 0; i < numCandidates; i++) {
    await vaultClient
      .addMetadataToConditionalTokensIx(
        vault,
        i,
        `Candidate ${i + 1}`,
        `CAND${i + 1}`,
        `https://example.com/candidate${i + 1}.png`
      )
      .rpc();
  }

  // Split tokens for Alice, Bob, and Charlie
  const aliceTx = await vaultClient
    .splitTokensIx(
      question,
      vault,
      USDC,
      new BN(100),
      numCandidates,
      alice.publicKey
    )
    .transaction();

  // aliceTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  // aliceTx.feePayer = this.payer.publicKey;
  // aliceTx.sign(this.payer, alice);
  // await this.banksClient.processTransaction(aliceTx);

  let rawStoredLookupTable = await this.banksClient.getAccount(lookupTableAddress);

  let storedLookupTable = new AddressLookupTableAccount({
    key: lookupTableAddress,
    state: AddressLookupTableAccount.deserialize(rawStoredLookupTable.data),
  });

  let messageV0 = new TransactionMessage({
    payerKey: this.payer.publicKey,
    recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
    instructions: aliceTx.instructions,
  }).compileToV0Message([storedLookupTable]);

  let txV0 = new VersionedTransaction(messageV0);

  txV0.sign([this.payer, alice]);

  // console.log(txV0.serialize().length);

  await this.banksClient.processTransaction(txV0);

  const resolutionArray = Array(numCandidates).fill(0);
  resolutionArray[2] = 1; // CAND3 wins
  await vaultClient
    .resolveQuestionIx(question, operator, resolutionArray)
    .rpc();

  // Redeem tokens
  const redeemTx = await vaultClient
    .redeemTokensIx(question, vault, USDC, numCandidates, alice.publicKey)
    .transaction();

  messageV0 = new TransactionMessage({
    payerKey: this.payer.publicKey,
    recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
    instructions: redeemTx.instructions,
  }).compileToV0Message([storedLookupTable]);

  txV0 = new VersionedTransaction(messageV0);

  txV0.sign([this.payer, alice]);

  await this.banksClient.processTransaction(txV0);

  // await this.banksClient.processTransaction(txV0);
  // console.log("alice tx processed");

  // const tx = new Transaction().add(txV0);

  // tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  // tx.feePayer = this.payer.publicKey;
  // tx.sign(this.payer);
  // // const tx = new Transaction().add(messageV0);

  return;

  await vaultClient
    .splitTokensIx(
      question,
      vault,
      USDC,
      new BN(100),
      numCandidates,
      bob.publicKey
    )
    .signers([bob])
    .rpc();

  await vaultClient
    .splitTokensIx(
      question,
      vault,
      USDC,
      new BN(100),
      numCandidates,
      charlie.publicKey
    )
    .signers([charlie])
    .rpc();

  // Perform some token transfers
  const candidateTokens = storedVault.conditionalTokenMints;

  // Alice believes in CAND1, Bob in CAND2, and Charlie in CAND3
  await this.transfer(candidateTokens[1], alice, bob.publicKey, 50);
  await this.transfer(candidateTokens[2], alice, charlie.publicKey, 50);
  await this.transfer(candidateTokens[0], bob, alice.publicKey, 50);
  await this.transfer(candidateTokens[2], bob, charlie.publicKey, 50);
  await this.transfer(candidateTokens[0], charlie, alice.publicKey, 50);
  await this.transfer(candidateTokens[1], charlie, bob.publicKey, 50);

  // Resolve the question (let's say CAND3 wins)
  // const resolutionArray = Array(numCandidates).fill(0);
  resolutionArray[2] = 1; // CAND3 wins
  await vaultClient
    .resolveQuestionIx(question, operator, resolutionArray)
    .rpc();

  // Redeem tokens
  await vaultClient
    .redeemTokensIx(question, vault, USDC, numCandidates, alice.publicKey)
    .signers([alice])
    .rpc();
  await vaultClient
    .redeemTokensIx(question, vault, USDC, numCandidates, bob.publicKey)
    .signers([bob])
    .rpc();
  await vaultClient
    .redeemTokensIx(question, vault, USDC, numCandidates, charlie.publicKey)
    .signers([charlie])
    .rpc();

  // Assert final balances
  await this.assertBalance(USDC, alice.publicKey, 50);
  await this.assertBalance(USDC, bob.publicKey, 50);
  await this.assertBalance(USDC, charlie.publicKey, 200); // Charlie wins!

  // Verify that all conditional token balances are now 0
  for (let i = 0; i < numCandidates; i++) {
    await this.assertBalance(candidateTokens[i], alice.publicKey, 0);
    await this.assertBalance(candidateTokens[i], bob.publicKey, 0);
    await this.assertBalance(candidateTokens[i], charlie.publicKey, 0);
  }
}
