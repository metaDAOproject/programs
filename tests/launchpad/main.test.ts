import initializeLaunch from "./unit/initializeLaunch.test.js";
import startLaunch from "./unit/startLaunch.test.js";
import fund from "./unit/fund.test.js";
import completeLaunch from "./unit/completeLaunch.test.js";
import claim from "./unit/claim.test.js";
import refund from "./unit/refund.test.js";
import closeLaunch from "./unit/closeLaunch.test.js";
import returnFunds from "./unit/returnFunds.test.js";
import { PublicKey } from "@solana/web3.js";
import {
  LAUNCHPAD_V0_6_PROGRAM_ID,
  LAUNCHPAD_V0_6_MAINNET_METEORA_CONFIG,
  MAINNET_USDC,
} from "@metadaoproject/programs";
import BN from "bn.js";

// TODO add a many-outcome integration test
export default function suite() {
  before(async function () {
    const dynamicConfig = await this.banksClient.getAccount(
      new PublicKey("4mPQ4VuvvtYL3CeMPt14Uj1CLpBWcVdJoLoTH9ea4Kod"),
    );

    // discriminator + vault config authority
    const poolCreatorAuthorityOffset = 8 + 32;
    // discriminator + vault config authority + pool creator authority + pool fees config + activation type + collect fee mode
    const configTypeOffset = 8 + 32 + 32 + 128 + 1 + 1;

    const [poolCreatorAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("damm_pool_creator_authority")],
      LAUNCHPAD_V0_6_PROGRAM_ID,
    );

    dynamicConfig.data.set(
      poolCreatorAuthority.toBuffer(),
      poolCreatorAuthorityOffset,
    );
    dynamicConfig.data.set([1], configTypeOffset);

    this.context.setAccount(
      LAUNCHPAD_V0_6_MAINNET_METEORA_CONFIG,
      dynamicConfig,
    );

    this.setupBasicLaunch = async ({
      baseMint,
      founders,
    }: {
      baseMint: PublicKey;
      founders: PublicKey[];
      launchAuthority: PublicKey;
    }) => {
      await this.launchpad_v6
        .initializeLaunchIx({
          tokenName: "META",
          tokenSymbol: "META",
          tokenUri: "https://example.com",
          minimumRaiseAmount: new BN(100_000 * 10 ** 6), // 100k
          secondsForLaunch: 60 * 60 * 24 * 4, // 4 days
          baseMint,
          quoteMint: MAINNET_USDC,
          monthlySpendingLimitAmount: new BN(10_000 * 10 ** 6), // 15k burn
          monthlySpendingLimitMembers: founders,
          performancePackageGrantee: founders[0],
          performancePackageTokenAmount: new BN(5_000_000 * 10 ** 6), // 5M
          monthsUntilInsidersCanUnlock: 24, // 2 years
          teamAddress: PublicKey.default,
        })
        .rpc();
    };
  });

  describe("#initialize_launch", initializeLaunch);
  describe("#start_launch", startLaunch);
  describe("#fund", fund);
  describe("#complete_launch", completeLaunch);
  describe("#claim", claim);
  describe("#refund", refund);
  describe("#close_launch", closeLaunch);

  describe("#return_funds", returnFunds);
}
