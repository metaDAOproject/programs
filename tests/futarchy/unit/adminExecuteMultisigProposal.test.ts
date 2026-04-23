import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/futarchy-v2";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import { expectError, setupBasicDao } from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import { createMemoInstruction } from "@solana/spl-memo";
import BN from "bn.js";

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 9);
    USDC = await this.createMint(this.payer.publicKey, 6);

    // Create payer's token accounts for both mints
    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    // Mint tokens to payer's accounts
    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      100_000 * 1_000_000,
    );

    dao = await setupBasicDao({
      context: this,
      baseMint: META,
      quoteMint: USDC,
    });
  });

  it("should execute an approved squads proposal", async function () {
    const daoAccount = await this.futarchy.getDao(dao);

    const multisigSetTimeLockIx = multisig.instructions.multisigSetTimeLock({
      multisigPda: daoAccount.squadsMultisig,
      timeLock: 100,
      configAuthority: dao,
    });

    const setTimeLockMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [multisigSetTimeLockIx],
    });

    const vaultTransactionCreateIx =
      multisig.instructions.vaultTransactionCreate({
        multisigPda: daoAccount.squadsMultisig,
        transactionIndex: 1n,
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: this.payer.publicKey,
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage: setTimeLockMessage,
      });

    const proposalCreateIx = multisig.instructions.proposalCreate({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
    });

    const squadsCreateTx = new Transaction().add(
      vaultTransactionCreateIx,
      proposalCreateIx,
    );
    squadsCreateTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    squadsCreateTx.feePayer = this.payer.publicKey;
    squadsCreateTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(squadsCreateTx);

    const [vaultTransactionPda] = multisig.getTransactionPda({
      multisigPda: daoAccount.squadsMultisig,
      index: 1n,
    });

    const [squadsProposalPda] = multisig.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
    });

    const transactionAccount =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        this.squadsConnection,
        vaultTransactionPda,
      );

    const { accountMetas: transactionAccountMetas } =
      await multisig.utils.accountsForTransactionExecute({
        connection: this.squadsConnection,
        message: transactionAccount.message,
        ephemeralSignerBumps: [...transactionAccount.ephemeralSignerBumps],
        vaultPda: daoAccount.squadsMultisigVault,
        transactionPda: vaultTransactionPda,
        programId: multisig.PROGRAM_ID,
      });

    // First approve
    await this.futarchy.futarchy.methods
      .adminApproveMultisigProposal({ transactionIndex: new BN(1) })
      .accounts({
        dao: dao,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: squadsProposalPda,
        admin: this.payer.publicKey,
        squadsMultisigProgram: multisig.PROGRAM_ID,
      })
      .signers([this.payer])
      .rpc();

    // Then execute
    await this.futarchy.futarchy.methods
      .adminExecuteMultisigProposal()
      .accounts({
        dao: dao,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: squadsProposalPda,
        squadsMultisigVaultTransaction: vaultTransactionPda,
        admin: this.payer.publicKey,
        squadsMultisigProgram: multisig.PROGRAM_ID,
      })
      .remainingAccounts(
        transactionAccountMetas.map((meta) =>
          meta.pubkey.equals(dao) ? { ...meta, isSigner: false } : meta,
        ),
      )
      .signers([this.payer])
      .rpc();

    const squadsProposal = await multisig.accounts.Proposal.fromAccountAddress(
      this.squadsConnection,
      squadsProposalPda,
    );

    assert.equal(squadsProposal.transactionIndex, 1);
    assert.equal(squadsProposal.approved[0].toBase58(), dao.toBase58());
    assert.isTrue(
      multisig.generated.isProposalStatusExecuted(squadsProposal.status),
    );

    const squadsMultisig = await multisig.accounts.Multisig.fromAccountAddress(
      this.squadsConnection,
      daoAccount.squadsMultisig,
    );
    assert.equal(squadsMultisig.staleTransactionIndex, 1);
  });

  it("should fail to execute a non-approved proposal", async function () {
    const daoAccount = await this.futarchy.getDao(dao);

    const vaultTransactionCreateIx =
      multisig.instructions.vaultTransactionCreate({
        multisigPda: daoAccount.squadsMultisig,
        transactionIndex: 1n,
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: this.payer.publicKey,
        vaultIndex: 0,
        transactionMessage: new TransactionMessage({
          payerKey: this.payer.publicKey,
          recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
          instructions: [createMemoInstruction("hello world")],
        }),
        ephemeralSigners: 0,
      });

    const proposalCreateIx = multisig.instructions.proposalCreate({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
    });

    const squadsCreateTx = new Transaction().add(
      vaultTransactionCreateIx,
      proposalCreateIx,
    );
    squadsCreateTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    squadsCreateTx.feePayer = this.payer.publicKey;
    squadsCreateTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(squadsCreateTx);

    const [vaultTransactionPda] = multisig.getTransactionPda({
      multisigPda: daoAccount.squadsMultisig,
      index: 1n,
    });

    const [squadsProposalPda] = multisig.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
    });

    const transactionAccount =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        this.squadsConnection,
        vaultTransactionPda,
      );

    const { accountMetas: transactionAccountMetas } =
      await multisig.utils.accountsForTransactionExecute({
        connection: this.squadsConnection,
        message: transactionAccount.message,
        ephemeralSignerBumps: [...transactionAccount.ephemeralSignerBumps],
        vaultPda: daoAccount.squadsMultisigVault,
        transactionPda: vaultTransactionPda,
        programId: multisig.PROGRAM_ID,
      });

    const callbacks = expectError(
      "InvalidProposalStatus",
      "The proposal should not be executed because it has not been approved",
    );

    await this.futarchy.futarchy.methods
      .adminExecuteMultisigProposal()
      .accounts({
        dao: dao,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: squadsProposalPda,
        squadsMultisigVaultTransaction: vaultTransactionPda,
        admin: this.payer.publicKey,
        squadsMultisigProgram: multisig.PROGRAM_ID,
      })
      .remainingAccounts(
        transactionAccountMetas.map((meta) =>
          meta.pubkey.equals(dao) ? { ...meta, isSigner: false } : meta,
        ),
      )
      .signers([this.payer])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
