import { PublicKey } from "@solana/web3.js";
import { LIQUIDATION_V0_7_PROGRAM_ID } from "../../constants.js";

export const getLiquidationAddr = ({
  programId = LIQUIDATION_V0_7_PROGRAM_ID,
  baseMint,
  quoteMint,
  createKey,
}: {
  programId?: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  createKey: PublicKey;
}) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("liquidation"),
      baseMint.toBuffer(),
      quoteMint.toBuffer(),
      createKey.toBuffer(),
    ],
    programId,
  );
};

export const getRefundRecordAddr = ({
  programId = LIQUIDATION_V0_7_PROGRAM_ID,
  liquidation,
  recipient,
}: {
  programId?: PublicKey;
  liquidation: PublicKey;
  recipient: PublicKey;
}) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("refund_record"),
      liquidation.toBuffer(),
      recipient.toBuffer(),
    ],
    programId,
  );
};
