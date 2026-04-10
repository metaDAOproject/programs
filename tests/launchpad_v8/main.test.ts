import { PublicKey } from "@solana/web3.js";
import {
  LAUNCHPAD_V0_8_PROGRAM_ID,
  LAUNCHPAD_V0_8_MAINNET_METEORA_CONFIG,
  MAINNET_USDC,
} from "@metadaoproject/futarchy-v2";
import BN from "bn.js";
import initializeLaunch from "./unit/initializeLaunch.test.js";
import startLaunch from "./unit/startLaunch.test.js";
import fund from "./unit/fund.test.js";
import closeLaunch from "./unit/closeLaunch.test.js";

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
      LAUNCHPAD_V0_8_PROGRAM_ID,
    );

    dynamicConfig.data.set(
      poolCreatorAuthority.toBuffer(),
      poolCreatorAuthorityOffset,
    );
    dynamicConfig.data.set([1], configTypeOffset);

    this.context.setAccount(
      LAUNCHPAD_V0_8_MAINNET_METEORA_CONFIG,
      dynamicConfig,
    );

    this.setupBasicLaunch = async ({
      baseMint,
      founders,
      launchAuthority,
    }: {
      baseMint: PublicKey;
      founders: PublicKey[];
      launchAuthority: PublicKey;
    }) => {
      await this.launchpad_v8
        .initializeLaunchIx({
          tokenName: "META",
          tokenSymbol: "META",
          tokenUri: "https://example.com",
          minimumRaiseAmount: new BN(100_000 * 10 ** 6), // 100k
          secondsForLaunch: 60 * 60 * 24 * 4, // 4 days
          baseMint,
          quoteMint: MAINNET_USDC,
          monthlySpendingLimitAmount: new BN(10_000 * 10 ** 6), // 10k burn
          monthlySpendingLimitMembers: founders,
          performancePackageGrantee: founders[0],
          performancePackageTokenAmount: new BN(5_000_000 * 10 ** 6), // 5M
          monthsUntilInsidersCanUnlock: 24, // 2 years
          teamAddress: PublicKey.default,
          launchAuthority: launchAuthority,
          hasBidWall: false,
        })
        .rpc();
    };
  });

  describe("#initialize_launch", initializeLaunch);
  describe("#start_launch", startLaunch);
  describe("#fund", fund);
  describe("#close_launch", closeLaunch);
}
