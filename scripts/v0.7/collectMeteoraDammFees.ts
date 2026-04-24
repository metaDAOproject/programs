import * as anchor from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import {
  CONDITIONAL_VAULT_V0_4_PROGRAM_ID,
  FUTARCHY_V0_6_PROGRAM_ID,
  LAUNCHPAD_V0_7_MAINNET_METEORA_CONFIG,
} from "@metadaoproject/futarchy";
import { FutarchyClient } from "@metadaoproject/futarchy/futarchy/v0.6";

import { PublicKey } from "@solana/web3.js";

const provider = anchor.AnchorProvider.env();

// Payer MUST be the non-Squads signer - tSTp6B6kE9o6ZaTmHm2ZwnJBBtgd3x112tapxFhmBEQ
const payer = provider.wallet["payer"];

const futarchy: FutarchyClient = new FutarchyClient(
  provider,
  FUTARCHY_V0_6_PROGRAM_ID,
  CONDITIONAL_VAULT_V0_4_PROGRAM_ID,
  [],
);

// Set the DAO address before running the script
const dao = new PublicKey("");

export const collectMeteoraDammFees = async () => {
  const daoAccount = await futarchy.fetchDao(dao);

  const squadsMultisigAccount =
    await multisig.accounts.Multisig.fromAccountAddress(
      provider.connection,
      daoAccount.squadsMultisig,
    );

  const collectMeteoraDammFeesIx = await futarchy
    .collectMeteoraDammFeesIx({
      dao,
      baseMint: daoAccount.baseMint,
      quoteMint: daoAccount.quoteMint,
      transactionIndex:
        BigInt(squadsMultisigAccount.transactionIndex.toString()) + 1n,
      meteoraConfig: LAUNCHPAD_V0_7_MAINNET_METEORA_CONFIG,
    })
    .signers([payer])
    .rpc();

  console.log(
    "Collect Meteora DAMM fees transaction:",
    collectMeteoraDammFeesIx,
  );
};

collectMeteoraDammFees().catch(console.error);
