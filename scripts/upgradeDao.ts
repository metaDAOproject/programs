import { PublicKey, Transaction, TransactionMessage } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as anchor from "@coral-xyz/anchor";
import { AutocratClient } from "../sdk/dist/v0.5/AutocratClient.js";
import { Keypair } from "@solana/web3.js";
import fs from 'fs';

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const bytes = JSON.parse(fs.readFileSync('./prop.json', 'utf8'));
const keypair = Keypair.fromSecretKey(new Uint8Array(bytes));

const proposer = keypair;

const autocratClient = AutocratClient.createClient({ provider });
const daoAddress = new PublicKey('B3AufDZCDtQN8JxZgJ5bSDZaiKCF4vtw7ynN9tuR9pXN')
const squadsPayer = new PublicKey("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf")

const daoUpgrade = async () => {
  const dao =
    typeof daoAddress === "string" ? new PublicKey(daoAddress) : daoAddress;
  
    const [multisigPda] = multisig.getMultisigPda({
    createKey: dao,
  });
  
  const metaDaoUpgradeTxn = await autocratClient.autocrat.methods
    .upgradeMultisigDao()
    .accounts({
      dao,
      squadsMultisig: multisigPda,
      squadsMultisigProgram: multisig.PROGRAM_ID,
      rentPayer: payer.pubkey,
      kollan: payer.pubkey
    }).transaction();

  return metaDaoUpgradeTxn;
}

const mainWoSquads = async () => {
  const metaDaoUpgradeTxn = await daoUpgrade();

  // const tx = new Transaction().add(metaDaoUpgradeTxn)
  
  metaDaoUpgradeTxn.feePayer = payer.publicKey;
  metaDaoUpgradeTxn.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  metaDaoUpgradeTxn.partialSign(payer);
  const txHash = await provider.connection.sendRawTransaction(metaDaoUpgradeTxn.serialize());
  console.log(`upgradeDao transaction sent:`, txHash); 

}

const main = async () => {
  
  const metaDaoUpgradeTxn = await daoUpgrade();
  

  const transactionMessage = new TransactionMessage({
    payerKey: squadsPayer,
    recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
    instructions: metaDaoUpgradeTxn.instructions,
  });

  const metaDaoUpgradeMultisigPda = new PublicKey("8N3Tvc6B1wEVKVC6iD4s6eyaCNqX2ovj2xze2q3Q9DWH")

  const multisigAccountInfo =
    await multisig.accounts.Multisig.fromAccountAddress(
      provider.connection,
      metaDaoUpgradeMultisigPda,
    );

  const currentTransactionIndex = Number(multisigAccountInfo.transactionIndex);

  const upgradeViaMultisigTxn = multisig.instructions.vaultTransactionCreate({
    multisigPda: metaDaoUpgradeMultisigPda,
    transactionIndex: BigInt(currentTransactionIndex + 1),
    creator: proposer.publicKey,
    rentPayer: payer.publicKey,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage 
  });

  const proposalCreateIx = multisig.instructions.proposalCreate({
    multisigPda: metaDaoUpgradeMultisigPda,
    transactionIndex: BigInt(currentTransactionIndex + 1),
    creator: proposer.publicKey,
    rentPayer: payer.publicKey,
    isDraft: false,
  });

  const tx = new Transaction().add(upgradeViaMultisigTxn, proposalCreateIx)
  
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.partialSign(payer, proposer);
  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  console.log(`upgradeDao transaction sent:`, txHash); 
}

mainWoSquads();