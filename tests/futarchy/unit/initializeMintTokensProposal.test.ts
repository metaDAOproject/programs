import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  AuthorityType,
  createSetAuthorityInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import {
  getMintAuthorityAddr,
  MintGovernorClient,
  MINT_GOVERNOR_V0_7_PROGRAM_ID,
} from "@metadaoproject/programs";
import { BankrunProvider } from "anchor-bankrun";
import { initializeMintGovernorWithDefaults } from "../../mintGovernor/utils.js";
import {
  executeVaultTransaction,
  expectError,
  forceApproveSquadsProposal,
} from "../../utils.js";
import { TestContext } from "../../main.test.js";

async function setMintAuthority(
  context: TestContext,
  mint: PublicKey,
  newAuthority: PublicKey | null,
) {
  const tx = new Transaction().add(
    createSetAuthorityInstruction(
      mint,
      context.payer.publicKey,
      AuthorityType.MintTokens,
      newAuthority,
    ),
  );
  [tx.recentBlockhash] = await context.banksClient.getLatestBlockhash();
  tx.feePayer = context.payer.publicKey;
  tx.sign(context.payer);
  await context.banksClient.processTransaction(tx);
}

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;
  let squadsMultisigVault: PublicKey;
  let recipient: PublicKey;
  let mintGovernorClient: MintGovernorClient;

  before(async function () {
    mintGovernorClient = MintGovernorClient.createClient({
      provider: new BankrunProvider(this.context) as any,
    });
  });

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(
      META,
      this.payer.publicKey,
      this.payer,
      100_000 * 10 ** 6,
    );
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      100_000 * 10 ** 6,
    );

    dao = await this.setupBasicDao({ baseMint: META, quoteMint: USDC });
    ({ squadsMultisigVault } = await this.futarchy.getDao(dao));
    recipient = Keypair.generate().publicKey;
  });

  it("bakes exactly one MintTo when the vault holds the mint authority and snapshots the kind's params", async function () {
    await setMintAuthority(this, META, squadsMultisigVault);

    // 1,000 tokens
    const amount = new BN(1_000_000_000);

    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeMintTokensProposal({
        dao,
        amount,
        recipient,
      });

    const vaultTransaction =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        this.squadsConnection,
        squadsTransaction,
      );
    const message = vaultTransaction.message;

    assert.equal(message.instructions.length, 1);
    // the Squads vault is the inner transaction's only signer
    assert.equal(message.numSigners, 1);
    assert.ok(message.accountKeys[0].equals(squadsMultisigVault));

    const [mintIx] = message.instructions;
    assert.ok(
      message.accountKeys[mintIx.programIdIndex].equals(TOKEN_PROGRAM_ID),
    );

    const accounts = [...mintIx.accountIndexes].map(
      (index) => message.accountKeys[index],
    );
    assert.equal(accounts.length, 3);
    assert.ok(accounts[0].equals(META));
    assert.ok(
      accounts[1].equals(getAssociatedTokenAddressSync(META, recipient, true)),
    );
    assert.ok(accounts[2].equals(squadsMultisigVault));

    // SPL mint_to data: tag 7 + u64 LE amount
    const data = Buffer.from(mintIx.data);
    assert.equal(data.length, 9);
    assert.equal(data[0], 7);
    assert.equal(new BN(data.subarray(1), "le").toString(), amount.toString());

    const storedProposal = await this.futarchy.getProposal(proposal);

    assert.ok(storedProposal.dao.equals(dao));
    assert.ok(storedProposal.squadsProposal.equals(squadsProposal));
    assert.exists(storedProposal.state.draft);

    assert.equal(
      storedProposal.action.mintTokens.amount.toString(),
      amount.toString(),
    );
    assert.ok(storedProposal.action.mintTokens.recipient.equals(recipient));
    assert.equal(storedProposal.durationInSeconds, 432_000);
    assert.equal(storedProposal.passThresholdBps, 500);
    assert.isTrue(storedProposal.councilCanBlock);
  });

  it("bakes exactly one mint_governor::mint_tokens when a governor holds the mint authority", async function () {
    const { mintGovernor } = await initializeMintGovernorWithDefaults(
      this.banksClient,
      mintGovernorClient,
      this.payer,
      META,
    );
    await mintGovernorClient
      .transferAuthorityToGovernorIx({
        mintGovernor,
        mint: META,
        currentAuthority: this.payer.publicKey,
      })
      .rpc();
    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor,
        admin: this.payer.publicKey,
        authorizedMinter: squadsMultisigVault,
        maxTotal: null,
      })
      .rpc();

    // 500 tokens
    const amount = new BN(500_000_000);

    const { proposal, squadsTransaction } =
      await this.futarchy.initializeMintTokensProposal({
        dao,
        amount,
        recipient,
      });

    // the baked instruction must be byte-for-byte what a direct client call
    // to mint_governor would send
    const expectedIx = await mintGovernorClient
      .mintTokensIx({
        mintGovernor,
        mint: META,
        destinationAta: getAssociatedTokenAddressSync(META, recipient, true),
        authorizedMinter: squadsMultisigVault,
        amount,
      })
      .instruction();

    const vaultTransaction =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        this.squadsConnection,
        squadsTransaction,
      );
    const message = vaultTransaction.message;

    assert.equal(message.instructions.length, 1);
    assert.equal(message.numSigners, 1);
    assert.ok(message.accountKeys[0].equals(squadsMultisigVault));

    const [mintIx] = message.instructions;
    assert.ok(
      message.accountKeys[mintIx.programIdIndex].equals(
        MINT_GOVERNOR_V0_7_PROGRAM_ID,
      ),
    );

    const accounts = [...mintIx.accountIndexes].map(
      (index) => message.accountKeys[index],
    );
    assert.deepEqual(
      accounts.map((account) => account.toBase58()),
      expectedIx.keys.map((key) => key.pubkey.toBase58()),
    );
    assert.deepEqual(Buffer.from(mintIx.data), expectedIx.data);

    const storedProposal = await this.futarchy.getProposal(proposal);

    assert.equal(
      storedProposal.action.mintTokens.amount.toString(),
      amount.toString(),
    );
    assert.ok(storedProposal.action.mintTokens.recipient.equals(recipient));
    assert.equal(storedProposal.durationInSeconds, 432_000);
    assert.equal(storedProposal.passThresholdBps, 500);
    assert.isTrue(storedProposal.councilCanBlock);
  });

  it("throws error when the mint authority is neither the vault nor a governor", async function () {
    const callbacks = expectError(
      "UnknownMintAuthority",
      "created a mint tokens proposal with an unknown mint authority",
    );
    await this.futarchy
      .initializeMintTokensProposal({
        dao,
        amount: new BN(1_000_000),
        recipient,
      })
      .then(...callbacks);
  });

  it("throws error when the mint authority is burned", async function () {
    await setMintAuthority(this, META, null);

    const callbacks = expectError(
      "UnknownMintAuthority",
      "created a mint tokens proposal for a mint with a burned authority",
    );
    await this.futarchy
      .initializeMintTokensProposal({
        dao,
        amount: new BN(1_000_000),
        recipient,
      })
      .then(...callbacks);
  });

  it("the MintTo payload executes once the Squads proposal is approved", async function () {
    await setMintAuthority(this, META, squadsMultisigVault);

    // 1,000 tokens
    const amount = new BN(1_000_000_000);

    const { squadsProposal, squadsTransaction } =
      await this.futarchy.initializeMintTokensProposal({
        dao,
        amount,
        recipient,
      });

    await forceApproveSquadsProposal(this, squadsProposal);
    // MintTo does not create the recipient's ATA — it must exist at execution
    await this.createTokenAccount(META, recipient);
    await executeVaultTransaction(this, dao, squadsTransaction);

    const balance = await this.getTokenBalance(META, recipient);
    assert.equal(balance.toString(), amount.toString());
  });

  it("the mint_governor payload executes once the Squads proposal is approved", async function () {
    const { mintGovernor } = await initializeMintGovernorWithDefaults(
      this.banksClient,
      mintGovernorClient,
      this.payer,
      META,
    );
    await mintGovernorClient
      .transferAuthorityToGovernorIx({
        mintGovernor,
        mint: META,
        currentAuthority: this.payer.publicKey,
      })
      .rpc();
    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor,
        admin: this.payer.publicKey,
        authorizedMinter: squadsMultisigVault,
        maxTotal: null,
      })
      .rpc();

    // 500 tokens
    const amount = new BN(500_000_000);

    const { squadsProposal, squadsTransaction } =
      await this.futarchy.initializeMintTokensProposal({
        dao,
        amount,
        recipient,
      });

    await forceApproveSquadsProposal(this, squadsProposal);
    await this.createTokenAccount(META, recipient);
    await executeVaultTransaction(this, dao, squadsTransaction);

    const balance = await this.getTokenBalance(META, recipient);
    assert.equal(balance.toString(), amount.toString());

    const [mintAuthority] = getMintAuthorityAddr({
      mintGovernor,
      authorizedMinter: squadsMultisigVault,
    });
    const mintAuthorityAccount =
      await mintGovernorClient.fetchMintAuthority(mintAuthority);
    assert.equal(
      mintAuthorityAccount.totalMinted.toString(),
      amount.toString(),
    );
  });
}
