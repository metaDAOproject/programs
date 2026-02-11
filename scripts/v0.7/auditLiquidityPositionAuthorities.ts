import * as anchor from "@coral-xyz/anchor";
import {
  FUTARCHY_PROGRAM_ID,
  CONDITIONAL_VAULT_PROGRAM_ID,
  LAUNCHPAD_PROGRAM_ID,
  FutarchyClient,
  getLaunchAddr,
  getLaunchSignerAddr,
} from "@metadaoproject/futarchy/v0.7";
import { LAUNCHPAD_PROGRAM_ID as V06_LAUNCHPAD_PROGRAM_ID } from "@metadaoproject/futarchy/v0.6";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

const provider = anchor.AnchorProvider.env();

const futarchy: FutarchyClient = new FutarchyClient(
  provider,
  FUTARCHY_PROGRAM_ID,
  CONDITIONAL_VAULT_PROGRAM_ID,
  [],
);

function getDiscriminator(accountName: string): Buffer {
  return Buffer.from(
    anchor.BorshAccountsCoder.accountDiscriminator(accountName),
  );
}

async function main() {
  // 1. Fetch all DAO accounts
  console.log("Fetching all DAO accounts...");
  const daoDiscriminator = getDiscriminator("Dao");
  const daoAccounts = await provider.connection.getProgramAccounts(
    futarchy.autocrat.programId,
    {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(daoDiscriminator),
          },
        },
      ],
    },
  );
  console.log(`Found ${daoAccounts.length} DAOs`);

  // Build map: DAO pubkey -> { squadsMultisigVault, v07LaunchSigner, v06LaunchSigner }
  const daoMap = new Map<
    string,
    {
      squadsMultisigVault: PublicKey;
      v07LaunchSigner: PublicKey;
      v06LaunchSigner: PublicKey;
    }
  >();

  for (const { pubkey, account } of daoAccounts) {
    const dao = futarchy.autocrat.coder.accounts.decode("dao", account.data);
    const [v07Launch] = getLaunchAddr(LAUNCHPAD_PROGRAM_ID, dao.baseMint);
    const [v07LaunchSigner] = getLaunchSignerAddr(
      LAUNCHPAD_PROGRAM_ID,
      v07Launch,
    );
    const [v06Launch] = getLaunchAddr(V06_LAUNCHPAD_PROGRAM_ID, dao.baseMint);
    const [v06LaunchSigner] = getLaunchSignerAddr(
      V06_LAUNCHPAD_PROGRAM_ID,
      v06Launch,
    );
    daoMap.set(pubkey.toBase58(), {
      squadsMultisigVault: dao.squadsMultisigVault,
      v07LaunchSigner,
      v06LaunchSigner,
    });
  }

  // 2. Fetch all AmmPosition accounts
  console.log("Fetching all AmmPosition accounts...");
  const positionDiscriminator = getDiscriminator("AmmPosition");
  const positionAccounts = await provider.connection.getProgramAccounts(
    futarchy.autocrat.programId,
    {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(positionDiscriminator),
          },
        },
      ],
    },
  );
  console.log(`Found ${positionAccounts.length} AmmPositions\n`);

  // 3. Compare each position's authority against its DAO's squadsMultisigVault
  // AND verify whether the position's PDA was derived from squadsMultisigVault
  let matchCount = 0;
  let v07LaunchSignerCount = 0;
  let v06LaunchSignerCount = 0;
  let unknownCount = 0;
  let derivedFromVaultCount = 0;
  let notDerivedFromVaultCount = 0;

  for (const { pubkey, account } of positionAccounts) {
    const position = futarchy.autocrat.coder.accounts.decode(
      "ammPosition",
      account.data,
    );

    const daoPubkey = (position.dao as PublicKey).toBase58();
    const daoInfo = daoMap.get(daoPubkey);

    const positionAuthority = (
      position.positionAuthority as PublicKey
    ).toBase58();
    const expectedAuthority = daoInfo
      ? daoInfo.squadsMultisigVault.toBase58()
      : "DAO NOT FOUND";
    const v07LaunchSigner = daoInfo
      ? daoInfo.v07LaunchSigner.toBase58()
      : "DAO NOT FOUND";
    const v06LaunchSigner = daoInfo
      ? daoInfo.v06LaunchSigner.toBase58()
      : "DAO NOT FOUND";

    // Derive the expected PDA using dao.squadsMultisigVault as position authority
    let derivedFromVault = false;
    let expectedPda = "DAO NOT FOUND";
    if (daoInfo) {
      const [pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("amm_position"),
          new PublicKey(daoPubkey).toBuffer(),
          daoInfo.squadsMultisigVault.toBuffer(),
        ],
        FUTARCHY_PROGRAM_ID,
      );
      expectedPda = pda.toBase58();
      derivedFromVault = pubkey.toBase58() === expectedPda;
      if (derivedFromVault) {
        derivedFromVaultCount++;
      } else {
        notDerivedFromVaultCount++;
      }
    }

    let status: string;
    if (positionAuthority === expectedAuthority) {
      status = "OK (squads multisig vault)";
      matchCount++;
    } else if (positionAuthority === v07LaunchSigner) {
      status =
        "V0.7 LAUNCH SIGNER (current authority is the v0.7 launch signer)";
      v07LaunchSignerCount++;
    } else if (positionAuthority === v06LaunchSigner) {
      status =
        "V0.6 LAUNCH SIGNER (current authority is the v0.6 launch signer)";
      v06LaunchSignerCount++;
    } else {
      status = "UNKNOWN *** MISMATCH ***";
      unknownCount++;
    }

    console.log(`Position: ${pubkey.toBase58()}`);
    console.log(`  DAO:                  ${daoPubkey}`);
    console.log(`  Position Authority:   ${positionAuthority}`);
    console.log(`  Expected Authority:   ${expectedAuthority}`);
    console.log(`  v0.7 Launch Signer:   ${v07LaunchSigner}`);
    console.log(`  v0.6 Launch Signer:   ${v06LaunchSigner}`);
    console.log(
      `  Derived from vault:   ${derivedFromVault ? "YES" : "NO"} (expected PDA: ${expectedPda})`,
    );
    console.log(`  Belongs to: ${status}`);
    console.log();
  }

  // 4. Summary
  console.log("=== Summary ===");
  console.log(`Total positions:        ${positionAccounts.length}`);
  console.log(`Squads vault (OK):      ${matchCount}`);
  console.log(`v0.7 launch signer:     ${v07LaunchSignerCount}`);
  console.log(`v0.6 launch signer:     ${v06LaunchSignerCount}`);
  console.log(`Unknown mismatch:       ${unknownCount}`);
  console.log();
  console.log("=== PDA Derivation Check ===");
  console.log(`Derived from vault:     ${derivedFromVaultCount}`);
  console.log(`NOT derived from vault: ${notDerivedFromVaultCount}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
