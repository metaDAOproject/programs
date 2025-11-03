import * as anchor from "@coral-xyz/anchor";
import {
  FutarchyClient,
  PERMISSIONLESS_ACCOUNT,
} from "@metadaoproject/futarchy/v0.6";
import { PublicKey, Transaction } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const autocrat: FutarchyClient = FutarchyClient.createClient({ provider });

const PROPOSAL = new PublicKey("GcdHiq8jzmYUHLg4inBagUTdjDmU8Z4zWeeX5ghTCAkd");

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
