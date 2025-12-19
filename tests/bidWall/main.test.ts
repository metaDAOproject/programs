import initializeBidWall from "./unit/initializeBidWall.test.js";
import sellTokens from "./unit/sellTokens.test.js";
import collectFees from "./unit/collectFees.test.js";
import closeBidWall from "./unit/closeBidWall.test.js";
import cancelBidWall from "./unit/cancelBidWall.test.js";
import { PublicKey } from "@solana/web3.js";
import {
  LAUNCHPAD_PROGRAM_ID,
  MAINNET_METEORA_CONFIG,
} from "@metadaoproject/futarchy/v0.7";

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
      LAUNCHPAD_PROGRAM_ID,
    );

    dynamicConfig.data.set(
      poolCreatorAuthority.toBuffer(),
      poolCreatorAuthorityOffset,
    );
    dynamicConfig.data.set([1], configTypeOffset);

    this.context.setAccount(MAINNET_METEORA_CONFIG, dynamicConfig);
  });
  describe("#initialize_bid_wall", initializeBidWall);
  describe("#sell_tokens", sellTokens);
  describe("#collect_fees", collectFees);
  describe("#close_bid_wall", closeBidWall);
  describe("#cancel_bid_wall", cancelBidWall);
}
