import BN from "bn.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { Connection } from "@solana/web3.js";
import { bundlrUploader } from "@metaplex-foundation/umi-uploader-bundlr";
import { UmiPlugin } from "@metaplex-foundation/umi";

export const assetImageMap: Record<string, string> = {
  fMETA: "https://arweave.net/tGxvOjMZw7B0qHsdCcIMO57oH5g5OaItOZdXo3BXKz8",
  fUSDC: "https://arweave.net/DpvxeAyVbaoivhIVCLjdf566k2SwVn0YVBL0sTOezWk",
  pMETA: "https://arweave.net/iuqi7PRRESdDxj1oRyk2WzR90_zdFcmZsuWicv3XGfs",
  pUSDC: "https://arweave.net/e4IO7F59F_RKCiuB--_ABPot7Qh1yFsGkWzVhcXuKDU",
};

// Upload some JSON, returning its URL
export const uploadConditionalTokenMetadataJson = async (
  connection: Connection,
  identityPlugin: UmiPlugin,
  proposalNumber: number,
  symbol: string
  //   proposal: BN,
  //   conditionalToken: string,
  //   image: string
): Promise<string> => {
  // use bundlr, targeting arweave
  const umi = createUmi(connection);
  umi.use(bundlrUploader());
  umi.use(identityPlugin);

  return umi.uploader.uploadJson({
    name: `Proposal ${proposalNumber}: ${symbol}`,
    image: assetImageMap[symbol],
    symbol,
    description: "A conditional token for use in futarchy.",
  });
};
