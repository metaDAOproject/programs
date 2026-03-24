import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { BID_WALL_V0_7_PROGRAM_ID } from "../../constants.js";

export const getBidWallAddr = ({
  programId = BID_WALL_V0_7_PROGRAM_ID,
  baseMint,
  creator,
  nonce,
}: {
  programId?: PublicKey;
  baseMint: PublicKey;
  creator: PublicKey;
  nonce: BN;
}) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("bid_wall"),
      baseMint.toBuffer(),
      creator.toBuffer(),
      nonce.toArrayLike(Buffer, "le", 8),
    ],
    programId,
  );
};
