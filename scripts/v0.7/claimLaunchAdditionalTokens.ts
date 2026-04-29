import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient } from "@metadaoproject/programs/launchpad/v0.7";
import { PublicKey } from "@solana/web3.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

const launch = new PublicKey("HUM66D4uRnWTFHm3fJkA2rvQWqpHnJZWgRUt5QNxWF6E");

export const closeLaunch = async () => {
  console.log(
    `Claiming additional token allocation for launch at address: ${launch.toBase58()}`,
  );

  const launchAccount = await launchpad.fetchLaunch(launch);

  console.log(
    `Additional tokens recipient: ${launchAccount.additionalTokensRecipient.toBase58()}`,
  );
  console.log(
    `Additional tokens amount: ${launchAccount.additionalTokensAmount.toString()}`,
  );

  const txSignature = await launchpad
    .claimAdditionalTokenAllocationIx({
      launch,
      baseMint: launchAccount.baseMint,
      additionalTokensRecipient: launchAccount.additionalTokensRecipient,
    })
    .rpc();

  console.log(
    `Additional token allocation claimed successfully: ${txSignature}`,
  );
};

closeLaunch().catch(console.error);
