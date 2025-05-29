import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { AmmClient, SwapType } from "./AmmClient.js";
import { AutocratClient } from "./AutocratClient.js";
import { ConditionalVaultClient } from "./ConditionalVaultClient.js";
import {
  getAmmAddr,
  getVaultAddr,
  getVaultFinalizeMintAddr,
  getVaultRevertMintAddr,
} from "./utils/pda.js";

export class FutarchyClient {
  public readonly provider: AnchorProvider;
  public readonly ammClient: AmmClient;
  public readonly autocratClient: AutocratClient;
  public readonly conditionalVaultClient: ConditionalVaultClient;

  constructor(provider: AnchorProvider) {
    this.provider = provider;
    this.ammClient = AmmClient.createClient({ provider });
    this.autocratClient = AutocratClient.createClient({ provider });
    this.conditionalVaultClient = ConditionalVaultClient.createClient({
      provider,
    });
  }

  public static createClient({
    provider,
  }: {
    provider: AnchorProvider;
  }): FutarchyClient {
    return new FutarchyClient(provider);
  }

  public async createMintAndSwapTx({
    proposal,
    inputAmount,
    quoteMint,
    baseMint,
    user,
    payer,
    swapType,
    outcome,
    conditionalAmount,
  }: {
    proposal: PublicKey;
    inputAmount: BN;
    quoteMint: PublicKey;
    baseMint: PublicKey;
    user: PublicKey;
    payer: PublicKey;
    swapType: SwapType;
    outcome: "pass" | "fail";
    conditionalAmount?: BN;
  }): Promise<Transaction> {
    const [baseVault] = getVaultAddr(
      this.conditionalVaultClient.vaultProgram.programId,
      proposal,
      baseMint
    );
    const [quoteVault] = getVaultAddr(
      this.conditionalVaultClient.vaultProgram.programId,
      proposal,
      quoteMint
    );

    const [underlyingVault, underlyingTokenMint] = swapType.buy
      ? [quoteVault, quoteMint]
      : [baseVault, baseMint];

    let mintTx: Transaction | undefined;

    // Check to see if we need to mint conditional tokens
    // If conditionalAmount is not passed we will mint all of the input amount
    // If conditionalAmount is passed we will mint the difference between the input amount and the conditional amount
    if (
      !conditionalAmount ||
      (conditionalAmount && conditionalAmount.lt(inputAmount))
    ) {
      const mintAmount = conditionalAmount
        ? inputAmount.sub(conditionalAmount)
        : inputAmount;

      mintTx = await this.conditionalVaultClient
        .mintConditionalTokensIx(
          underlyingVault,
          underlyingTokenMint,
          mintAmount,
          user,
          payer
        )
        .transaction();
    }

    const [pUSDC] = getVaultFinalizeMintAddr(
      this.conditionalVaultClient.vaultProgram.programId,
      quoteVault
    );
    const [pTOKE] = getVaultFinalizeMintAddr(
      this.conditionalVaultClient.vaultProgram.programId,
      baseVault
    );

    const [fUSDC] = getVaultRevertMintAddr(
      this.conditionalVaultClient.vaultProgram.programId,
      quoteVault
    );
    const [fTOKE] = getVaultRevertMintAddr(
      this.conditionalVaultClient.vaultProgram.programId,
      baseVault
    );

    const [passMarket] = getAmmAddr(
      this.ammClient.program.programId,
      pTOKE,
      pUSDC
    );
    const [failMarket] = getAmmAddr(
      this.ammClient.program.programId,
      fTOKE,
      fUSDC
    );

    const [market, ammBaseMint, ammQuoteMint] =
      outcome === "pass"
        ? [passMarket, pTOKE, pUSDC]
        : [failMarket, fTOKE, fUSDC];

    const swapTx = await this.ammClient
      .swapIx(
        market,
        ammBaseMint,
        ammQuoteMint,
        swapType,
        inputAmount,
        new BN(0),
        user,
        payer
      )
      .transaction();

    return mintTx ? new Transaction().add(mintTx, swapTx) : swapTx;
  }
}
