import { GatedTokenClient } from "@metadaoproject/programs";
import { BankrunProvider } from "anchor-bankrun";

export default function suite() {
  before(async function () {
    const provider = new BankrunProvider(this.context);
    this.gatedToken = GatedTokenClient.createClient({
      provider: provider as any,
    });
  });
}
