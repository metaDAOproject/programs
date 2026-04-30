import { PublicKey } from "@solana/web3.js";

import { PRICE_BASED_PERFORMANCE_PACKAGE_PROGRAM_ID } from "../../constants.js";

export const getPerformancePackageAddr = ({
  programId = PRICE_BASED_PERFORMANCE_PACKAGE_PROGRAM_ID,
  createKey,
}: {
  programId?: PublicKey;
  createKey: PublicKey;
}) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("performance_package"), createKey.toBuffer()],
    programId,
  );
};

export const getChangeRequestAddr = ({
  programId = PRICE_BASED_PERFORMANCE_PACKAGE_PROGRAM_ID,
  performancePackage,
  proposer,
  pdaNonce,
}: {
  programId?: PublicKey;
  performancePackage: PublicKey;
  proposer: PublicKey;
  pdaNonce: number;
}) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("change_request"),
      performancePackage.toBuffer(),
      proposer.toBuffer(),
      Buffer.from(new Uint8Array(new Uint32Array([pdaNonce]).buffer)),
    ],
    programId,
  );
};
