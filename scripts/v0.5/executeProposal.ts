import * as anchor from "@coral-xyz/anchor";
import {
  PERMISSIONLESS_ACCOUNT,
  DEVNET_SQUADS_PROGRAM_CONFIG_TREASURY,
} from "@metadaoproject/futarchy";
import { AutocratClient } from "@metadaoproject/futarchy/autocrat/v0.5";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import * as multisig from "@sqds/multisig";
import * as token from "@solana/spl-token";

const EXISTING_TOKEN = new PublicKey(
  "METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr",
);
const ONE_DAY_IN_SLOTS = new BN(216_000);
const THREE_DAYS_IN_SLOTS = ONE_DAY_IN_SLOTS.mul(new BN(3));
const NEW_TOKEN = new PublicKey("METAwkXcqyXKy1AtsSgJ8JiUHwGCafnZL38n3vYmeta");

// DAO DETAILS
const SPENDING_MEMBERS = [
  new PublicKey("4LpE9Lxqb4jYYh8jA8oDhsGDKPNBNkcoXobbAJTa3pWw"), // Kollan
  new PublicKey("613BRiXuAEn7vibs2oAYzpGW9fXgjzDNuFMM4wPzLdY"), // Proph3t
];
const SPENDING_LIMIT = 85_000; // 85_000 USDC HUMAN READABLE
const MIN_QUOTE_FUTARCHIC_LIQUIDITY = 101_000_000; // NOTE: CHANGE ME TO 15k USDC 15_000_000
const MIN_BASE_FUTARCHIC_LIQUIDITY = 5_000_000; // NOTE: CHANGE ME TO 5k META 5_000_000_000
const PASS_THRESHOLD_BPS = 150; // 1.5%

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const autocrat: AutocratClient = AutocratClient.createClient({ provider });

const PROPOSAL = new PublicKey("GfJhLniJENRzYTrYA9x75JaMc3DcEvoLKijtynx3yRSQ");

const executeProposal = async () => {
  const proposal = await autocrat.getProposal(PROPOSAL);
  console.log(proposal);

  const squadsProposal = proposal.squadsProposal;

  const proposalAccount = await multisig.accounts.Proposal.fromAccountAddress(
    provider.connection,
    squadsProposal,
  );

  const dao = await autocrat.getDao(proposal.dao);
  const multisigPda = dao.squadsMultisig;

  // multisig.instructions.vau

  const txExecuteIx = await multisig.instructions.vaultTransactionExecute({
    connection: provider.connection,
    multisigPda,
    transactionIndex: BigInt(proposalAccount.transactionIndex.toString()),
    member: PERMISSIONLESS_ACCOUNT.publicKey,
  });

  const txExecute = new Transaction().add(txExecuteIx.instruction);
  txExecute.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  txExecute.feePayer = payer.publicKey;
  txExecute.sign(payer, PERMISSIONLESS_ACCOUNT);

  console.log(txExecute);

  const txHash = await provider.connection.sendRawTransaction(
    txExecute.serialize(),
  );
  await provider.connection.confirmTransaction(txHash, "confirmed");

  console.log(`Transaction sent: ${txHash}`);
};

executeProposal().catch(console.error);
