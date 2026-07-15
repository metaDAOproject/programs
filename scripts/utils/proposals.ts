import * as anchor from "@coral-xyz/anchor";
import { InstructionUtils } from "@metadaoproject/programs";
import {
  FutarchyClient,
  getProposalAddr,
} from "@metadaoproject/programs/futarchy";
import { ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";

const provider = anchor.AnchorProvider.env();

const futarchyClient = FutarchyClient.createClient({ provider });

export const initializeFutarchyProposal = async (
  daoAddress: PublicKey,
  squadsProposalPda: PublicKey,
) => {
  const dao = await futarchyClient.getDao(daoAddress);
  const [proposal] = getProposalAddr(
    futarchyClient.futarchy.programId,
    squadsProposalPda,
  );

  const existing = await futarchyClient.fetchProposal(proposal);
  if (existing) {
    console.log("  Futarchy Proposal PDA:", proposal.toBase58());
    console.log("  ✓ Futarchy proposal already initialized");
    return proposal;
  }

  const { question, baseVault, quoteVault } = futarchyClient.getProposalPdas(
    proposal,
    dao.baseMint,
    dao.quoteMint,
    daoAddress,
  );

  const questionAccount =
    await futarchyClient.vaultClient.fetchQuestion(question);
  if (!questionAccount) {
    await futarchyClient.vaultClient.initializeQuestion(
      sha256(`Will ${proposal} pass?/FAIL/PASS`),
      proposal,
      2,
    );
    console.log("  ✓ Question initialized");
  } else {
    console.log("  ✓ Question already exists");
  }

  const [baseVaultAccount, quoteVaultAccount] = await Promise.all([
    futarchyClient.vaultClient.fetchVault(baseVault),
    futarchyClient.vaultClient.fetchVault(quoteVault),
  ]);

  if (!baseVaultAccount || !quoteVaultAccount) {
    // Avoid starting vault init if only one side exists — that would fail mid-way.
    if (baseVaultAccount || quoteVaultAccount) {
      throw new Error(
        `Partial vault state: base=${!!baseVaultAccount} quote=${!!quoteVaultAccount}`,
      );
    }
    await futarchyClient.vaultClient
      .initializeVaultIx(question, dao.baseMint, 2)
      .postInstructions(
        await InstructionUtils.getInstructions(
          futarchyClient.vaultClient.initializeVaultIx(
            question,
            dao.quoteMint,
            2,
          ),
        ),
      )
      .rpc();
    console.log("  ✓ Vaults initialized");
  } else {
    console.log("  ✓ Vaults already exist");
  }

  // initialize_proposal itself does not need the conditional ATAs; the SDK
  // still creates them as preInstructions for later AMM use. Those CreateIdempotent
  // calls require the conditional mints to already exist (vaults above).
  await futarchyClient
    .initializeProposalIx(
      squadsProposalPda,
      daoAddress,
      dao.baseMint,
      dao.quoteMint,
      question,
    )
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ])
    .rpc();

  console.log("  Futarchy Proposal PDA:", proposal.toBase58());
  console.log("  ✓ Futarchy proposal initialized");

  return proposal;
};
