import initializeGatedMint from "./unit/initializeGatedMint.test.js";
import addWhitelistedUser from "./unit/addWhitelistedUser.test.js";
import removeWhitelistedUser from "./unit/removeWhitelistedUser.test.js";
import setWhitelistAdmin from "./unit/setWhitelistAdmin.test.js";
import gatedInvoke from "./unit/gatedInvoke.test.js";
import disableGating from "./unit/disableGating.test.js";
import thawAccount from "./unit/thawAccount.test.js";
import { GatedMintClient } from "@metadaoproject/programs";
import { BankrunProvider } from "anchor-bankrun";

export default function suite() {
  before(async function () {
    const provider = new BankrunProvider(this.context);
    this.gatedMint = GatedMintClient.createClient({
      provider: provider as any,
    });
  });

  describe("#initialize_gated_mint", initializeGatedMint);
  describe("#add_whitelisted_user", addWhitelistedUser);
  describe("#remove_whitelisted_user", removeWhitelistedUser);
  describe("#set_whitelist_admin", setWhitelistAdmin);
  describe("#gated_invoke", gatedInvoke);
  describe("#disable_gating", disableGating);
  describe("#thaw_account", thawAccount);
}
