import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/futarchy/v0.6";
import { PublicKey, Transaction, TransactionMessage } from "@solana/web3.js";
import { expectError, setupBasicDao } from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import { createMemoInstruction } from "@solana/spl-memo";

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

  it("should approve a squads proposal with a config transaction that belongs to the DAO's multisig", async function () {
    const daoAccount = await this.futarchy.getDao(dao);

    // Create a vault transaction that will be invalidated by the config transaction
    const vaultTransactionToInvalidateCreateIx =
      multisig.instructions.vaultTransactionCreate({
        multisigPda: daoAccount.squadsMultisig,
        transactionIndex: 1n,
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: this.payer.publicKey,
        vaultIndex: 0,
        transactionMessage: new TransactionMessage({
          payerKey: this.payer.publicKey,
          recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
          instructions: [
            createMemoInstruction("I will never see the light of day"),
          ],
        }),
        ephemeralSigners: 0,
      });

    const vaultProposalToInvalidateCreateIx =
      multisig.instructions.proposalCreate({
        multisigPda: daoAccount.squadsMultisig,
        transactionIndex: 1n,
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: this.payer.publicKey,
      });

    const configTransactionIndex = 2n;

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

    const vaultConfigTransactionCreateIx =
      multisig.instructions.vaultTransactionCreate({
        multisigPda: daoAccount.squadsMultisig,
        transactionIndex: configTransactionIndex,
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: this.payer.publicKey,
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage: setTimeLockMessage,
      });

    const multisigConfigProposalCreateIx = multisig.instructions.proposalCreate(
      {
        multisigPda: daoAccount.squadsMultisig,
        transactionIndex: configTransactionIndex,
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: this.payer.publicKey,
      },
    );

    // Create the squads proposal first
    const squadsTransactionsCreateTx = new Transaction().add(
      vaultTransactionToInvalidateCreateIx,
      vaultProposalToInvalidateCreateIx,
      vaultConfigTransactionCreateIx,
      multisigConfigProposalCreateIx,
    );
    squadsTransactionsCreateTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    squadsTransactionsCreateTx.feePayer = this.payer.publicKey;
    squadsTransactionsCreateTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(squadsTransactionsCreateTx);

    const [vaultConfigTransactionPda] = multisig.getTransactionPda({
      multisigPda: daoAccount.squadsMultisig,
      index: configTransactionIndex,
    });

    const [squadsConfigProposalPda] = multisig.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: configTransactionIndex,
    });

    const configTransactionAccount =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        this.squadsConnection,
        vaultConfigTransactionPda,
      );

    const { accountMetas: configTransactionAccountMetas } =
      await multisig.utils.accountsForTransactionExecute({
        connection: this.squadsConnection,
        message: configTransactionAccount.message,
        ephemeralSignerBumps: [
          ...configTransactionAccount.ephemeralSignerBumps,
        ],
        vaultPda: daoAccount.squadsMultisigVault,
        transactionPda: vaultConfigTransactionPda,
        programId: multisig.PROGRAM_ID,
      });

    let squadsConfigProposal =
      await multisig.accounts.Proposal.fromAccountAddress(
        this.squadsConnection,
        squadsConfigProposalPda,
      );

    assert.equal(squadsConfigProposal.transactionIndex, 2); // We're looking at the correct proposal
    assert.equal(squadsConfigProposal.approved.length, 0); // Should have zero approvals
    assert.isTrue(
      multisig.generated.isProposalStatusActive(squadsConfigProposal.status),
    );

    await this.futarchy.autocrat.methods
      .adminApproveExecuteMultisigProposal()
      .accounts({
        dao: dao,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: squadsConfigProposalPda,
        squadsMultisigVaultTransaction: vaultConfigTransactionPda,
        admin: this.payer.publicKey,
        squadsMultisigProgram: multisig.PROGRAM_ID,
      })
      .remainingAccounts(
        configTransactionAccountMetas.map((meta) =>
          meta.pubkey.equals(dao) ? { ...meta, isSigner: false } : meta,
        ),
      )
      .signers([this.payer])
      .rpc();

    squadsConfigProposal = await multisig.accounts.Proposal.fromAccountAddress(
      this.squadsConnection,
      squadsConfigProposalPda,
    );

    assert.equal(squadsConfigProposal.transactionIndex, 2); // We're looking at the correct proposal
    assert.equal(squadsConfigProposal.approved[0].toBase58(), dao.toBase58()); // Should have DAO approval
    assert.isTrue(
      multisig.generated.isProposalStatusExecuted(squadsConfigProposal.status),
    );

    // Confirm that vault transactions before the config transaction are invalidated
    const squadsMultisig = await multisig.accounts.Multisig.fromAccountAddress(
      this.squadsConnection,
      daoAccount.squadsMultisig,
    );
    assert.equal(squadsMultisig.staleTransactionIndex, 2);

    // Attempt to execute the invalidated vault transaction
    // We could run a regular futarchy market as well here, but we can also just shortcut it using the admin function
    const [vaultInvalidatedTransactionPda] = multisig.getTransactionPda({
      multisigPda: daoAccount.squadsMultisig,
      index: configTransactionIndex,
    });

    const [squadsInvalidatedProposalPda] = multisig.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: configTransactionIndex,
    });

    const invalidatedTransactionAccount =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        this.squadsConnection,
        vaultInvalidatedTransactionPda,
      );

    const { accountMetas: invalidatedTransactionAccountMetas } =
      await multisig.utils.accountsForTransactionExecute({
        connection: this.squadsConnection,
        message: configTransactionAccount.message,
        ephemeralSignerBumps: [
          ...configTransactionAccount.ephemeralSignerBumps,
        ],
        vaultPda: daoAccount.squadsMultisigVault,
        transactionPda: vaultInvalidatedTransactionPda,
        programId: multisig.PROGRAM_ID,
      });

    const callbacks = expectError(
      "InvalidProposalStatus",
      "The proposal should not be executed because it should have been invalidated",
    );

    await this.futarchy.autocrat.methods
      .adminApproveExecuteMultisigProposal()
      .accounts({
        dao: dao,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: squadsInvalidatedProposalPda,
        squadsMultisigVaultTransaction: vaultInvalidatedTransactionPda,
        admin: this.payer.publicKey,
        squadsMultisigProgram: multisig.PROGRAM_ID,
      })
      .remainingAccounts(
        invalidatedTransactionAccountMetas.map((meta) =>
          meta.pubkey.equals(dao) ? { ...meta, isSigner: false } : meta,
        ),
      )
      .signers([this.payer])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
