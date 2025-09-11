import * as anchor from "@coral-xyz/anchor";
import {
  Metadata,
  deserializeMetadata,
  findMetadataPda,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  GenericFile,
  createGenericFile,
  keypairIdentity,
  publicKey,
  signerIdentity,
} from "@metaplex-foundation/umi";
import {
  fromWeb3JsPublicKey,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { bundlrUploader } from "@metaplex-foundation/umi-uploader-bundlr";
import { PublicKey } from "@solana/web3.js";

import fs from "fs";

const uploadedAssetMap: Record<string, string> = {
  fMETA: "https://arweave.net/tGxvOjMZw7B0qHsdCcIMO57oH5g5OaItOZdXo3BXKz8",
  fUSDC: "https://arweave.net/DpvxeAyVbaoivhIVCLjdf566k2SwVn0YVBL0sTOezWk",
  pMETA: "https://arweave.net/iuqi7PRRESdDxj1oRyk2WzR90_zdFcmZsuWicv3XGfs",
  pUSDC: "https://arweave.net/e4IO7F59F_RKCiuB--_ABPot7Qh1yFsGkWzVhcXuKDU",
};

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const payer = provider.wallet["payer"];

const umi = createUmi(provider.connection);
umi.use(keypairIdentity(payer));

type AcceptedVaultTokens = "META" | "USDC";
type ConditionalToken = "pMETA" | "fMETA" | "pUSDC" | "fUSDC";

const isConditionalToken = (value: string): value is ConditionalToken =>
  ["pMETA", "fMETA", "pUSDC", "fUSDC"].includes(value as ConditionalToken);

const isAcceptedVaultToken = (value: string): value is AcceptedVaultTokens =>
  ["META", "USDC"].includes(value as AcceptedVaultTokens);

/**
 * Usage options
 *
 * 1: just upload images
 * uploadImageData()
 *    .then((res) => console.log(res))
 *    .catch((err) => console.error(err));
 *
 * 2: Use pre-existing images in assets/ dir and upload new JSON
 *
 * const proposalNumber = new BN(0);
 * Promise.all(
 *   uploadedAssetMap.map((asset) =>
 *    uploadImageJson(proposalNumber, asset.name as ConditionalToken, asset.uri)
 *   )
 * ).then((res) => console.log(res))
 *  .catch((err) => console.error(err));
 *
 * 3: upload new images, then upload json. new images aren't needed everytime, but
 * leaving in for reference.
 *
 * const proposalNumber = new BN(0);
 * uploadImageData()
 *     .then((results) => {
 *       results.map((result) => {
 *         uploadImageJson(proposalNumber, result.name as ConditionalToken, result.uri);
 *       });
 *     })
 *     .catch((err) => console.error(err));
 */

const uploadImageData = async () => {
  // use bundlr, targeting arweave
  umi.use(bundlrUploader());

  const sourceDirContent = fs.readdirSync(`${__dirname}/assets`);
  console.log(sourceDirContent);

  if (
    !sourceDirContent
      .map((x) => isConditionalToken(x.split(".")[0]))
      .every((x) => x)
  ) {
    throw new Error(
      `Found unexpected filename in assets directory. Only setup to handle "ConditionalToken"`
    );
  }

  const filesToUpload: Array<GenericFile> = [];
  for (const filename of sourceDirContent) {
    const data = fs.readFileSync(`${__dirname}/assets/${filename}`);
    filesToUpload.push(
      createGenericFile(new Uint8Array(data), filename, {
        contentType: "image/png",
      })
    );
  }

  const uris = await umi.uploader.upload(filesToUpload);

  return uris.map((uri, idx) => {
    return {
      uri,
      name: filesToUpload[idx].fileName.split(".")[0],
    };
  });
};

export const uploadImageJson = async (
  proposal: anchor.BN,
  conditionalToken: ConditionalToken,
  image: string
) => {
  // use bundlr, targeting arweave
  umi.use(bundlrUploader());

  const market = conditionalToken.toLowerCase().startsWith("p")
    ? "pass"
    : "fail";
  return umi.uploader.uploadJson(
    {
      name: `Proposal ${proposal.toNumber()}: ${conditionalToken}`,
      image,
      symbol: conditionalToken,
      description: `Native token in the MetaDAO's conditional ${market} market for proposal ${proposal.toNumber()}`,
    },
    {
      onProgress: (percent: number, ...args: any) => {
        console.log(
          `percent metadata upload progress for ${conditionalToken} = ${percent}`
        );
        console.log("progress args: ", args);
      },
    }
  );
};

export const uploadOffchainMetadata = async (
  proposal: anchor.BN,
  symbol: string
):
  | Promise<{
      symbol: string;
      passTokenMetadataUri: string | undefined;
      failTokenMetadataUri: string | undefined;
    }>
  | undefined => {
  const isOverrideDefined = (value: string) =>
    value && value.trim().length > 0 && value.includes("https://");

  const getValueOrUndefined = <T>(
    result: PromiseSettledResult<T>,
    action?: string
  ): T | undefined => {
    if (result.status === "rejected") {
      console.error(
        `${action ? `[${action}] ` : "request failed: "}`,
        result.reason
      );
      return undefined;
    }

    return result.value;
  };

  // use bundlr, targeting arweave
  umi.use(bundlrUploader());

  if (!isAcceptedVaultToken(symbol)) {
    console.warn(
      `unrecognized symbol provided. Skipping upload since we do not have conditional images for token: ${symbol}...`
    );
    return undefined;
  }

  console.log(`uploading metadata for conditional ${symbol} tokens...`);
  const [passUploadResult, failUploadResult] = await Promise.allSettled(
    [
      {
        symbol: `p${symbol}`,
        override: process.env[`PASS_${symbol}_METADATA_URI`],
      },
      {
        symbol: `f${symbol}`,
        override: process.env[`FAIL_${symbol}_METADATA_URI`],
      },
    ].map((o) => {
      if (isOverrideDefined(o.override)) return o.override.trim();
      return uploadImageJson(
        proposal,
        o.symbol as ConditionalToken,
        uploadedAssetMap[o.symbol]
      );
    })
  );

  return {
    symbol,
    passTokenMetadataUri: getValueOrUndefined(
      passUploadResult,
      "upload pass token metadata"
    ),
    failTokenMetadataUri: getValueOrUndefined(
      failUploadResult,
      "upload fail token metadata"
    ),
  };
};

/**
 * todo: when we support other metadata implementations (e.g. metaplex, token22),
 * this method needs to check for those implementations
 */
export const fetchOnchainMetadataForMint = async (
  address: PublicKey
): Promise<
  | {
      key: PublicKey;
      metadata: Metadata;
    }
  | undefined
> => {
  const pda = findMetadataPda(umi, {
    mint: fromWeb3JsPublicKey(address),
  });

  const acct = await umi.rpc.getAccount(pda[0]);
  if (!acct.exists) return undefined;

  return {
    key: toWeb3JsPublicKey(pda[0]),
    metadata: deserializeMetadata(acct),
  };
};

// fetchOnchainMetadataForMint();
