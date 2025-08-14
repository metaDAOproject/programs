import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

export function getLaunchDaoAddr(programId, launch) {
  return PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("launch_dao"),
      launch.toBuffer()
    ],
    programId
  );
}

export function getPoolStateAddr(launchpadProgramId, dao) {
  return PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("pool_state"),
      dao.toBuffer()
    ],
    launchpadProgramId
  );
}

export function getCpmmLpMintAddr(poolState, cpSwapProgramId) {
  return PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("pool_lp_mint"),
      poolState.toBuffer()
    ],
    cpSwapProgramId
  );
}

export function getCpmmPoolVaultAddr(poolState, tokenMint, cpSwapProgramId) {
  return PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("pool_vault"),
      poolState.toBuffer(),
      tokenMint.toBuffer()
    ],
    cpSwapProgramId
  );
}

export function getCpmmAuthorityAddr(cpSwapProgramId) {
  return PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("vault_and_lp_mint_auth_seed")],
    cpSwapProgramId
  );
}

export function getLaunchAddr(programId, tokenMint) {
  return PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("launch"),
      tokenMint.toBuffer()
    ],
    programId
  );
}

export function getLaunchSignerAddr(programId, launch) {
  return PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("launch_signer"),
      launch.toBuffer()
    ],
    programId
  );
}

export function getFundingRecordAddr(programId, launch, funder) {
  return PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("funding_record"),
      launch.toBuffer(),
      funder.toBuffer()
    ],
    programId
  );
}

export function getMetadataAddr(tokenMint) {
  const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  );
  
  return PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("metadata"),
      MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      tokenMint.toBuffer()
    ],
    MPL_TOKEN_METADATA_PROGRAM_ID
  );
}