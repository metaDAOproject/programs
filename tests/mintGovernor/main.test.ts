import initializeMintGovernor from "./unit/initializeMintGovernor.test.js";
import transferAuthorityToGovernor from "./unit/transferAuthorityToGovernor.test.js";
import addMintAuthority from "./unit/addMintAuthority.test.js";
import updateMintAuthority from "./unit/updateMintAuthority.test.js";
import removeMintAuthority from "./unit/removeMintAuthority.test.js";
import mintTokens from "./unit/mintTokens.test.js";
import updateMintGovernorAdmin from "./unit/updateMintGovernorAdmin.test.js";
import reclaimAuthority from "./unit/reclaimAuthority.test.js";
import { MintGovernorClient } from "@metadaoproject/futarchy/v0.7";
import { BankrunProvider } from "anchor-bankrun";

export default function suite() {
  before(async function () {
    const provider = new BankrunProvider(this.context);
    this.mintGovernor = MintGovernorClient.createClient({
      provider: provider as any,
    });
  });

  describe("#initialize_mint_governor", initializeMintGovernor);
  describe("#transfer_authority_to_governor", transferAuthorityToGovernor);
  describe("#add_mint_authority", addMintAuthority);
  describe("#update_mint_authority", updateMintAuthority);
  describe("#remove_mint_authority", removeMintAuthority);
  describe("#mint_tokens", mintTokens);
  describe("#update_mint_governor_admin", updateMintGovernorAdmin);
  describe("#reclaim_authority", reclaimAuthority);
}
