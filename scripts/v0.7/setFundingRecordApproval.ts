import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient, getLaunchAddr } from "@metadaoproject/futarchy/v0.7";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

// ============= CONFIGURATION =============
// The base mint of the launch
const BASE_MINT = new PublicKey("PRVT6TB7uss3FrUd2D9xs2zqDBsa3GbMJMwCQsgmeta");

// The funder to approve
const FUNDER = new PublicKey("...");

// The approved amount (in USDC atoms, 6 decimals)
// Set to undefined to approve for full committed amount
const APPROVED_AMOUNT: BN | undefined = undefined;
// =========================================

export const setFundingRecordApproval = async () => {
  const [launch] = getLaunchAddr(undefined, BASE_MINT);

  console.log(`Setting approval for funder: ${FUNDER.toBase58()}`);
  console.log(`Launch address: ${launch.toBase58()}`);

  // Get the funding record to see committed amount
  const fundingRecordAddr = launchpad.getFundingRecordAddress({
    launch,
    funder: FUNDER,
  });
  const fundingRecord = await launchpad.getFundingRecord(fundingRecordAddr);

  const amountToApprove = APPROVED_AMOUNT ?? fundingRecord.committedAmount;

  console.log(`Committed amount: ${fundingRecord.committedAmount.toString()}`);
  console.log(`Approving amount: ${amountToApprove.toString()}`);

  const txHash = await launchpad
    .setFundingRecordApprovalIx({
      launch,
      funder: FUNDER,
      approvedAmount: amountToApprove,
    })
    .rpc();

  console.log("Approval set:", txHash);
};

setFundingRecordApproval().catch(console.error);
