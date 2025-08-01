import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { IDL, TokenConverter } from "./types/token_converter.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";

export class TokenConverterClient {
  private connection: Connection;
  private programId: PublicKey;
  private program: Program<TokenConverter>;

  constructor(connection: Connection, programId: PublicKey, provider: AnchorProvider) {
    this.connection = connection;
    this.programId = programId;
    this.program = new Program(IDL, programId, provider);
  }

  static createClient({ provider }: { provider: any }): TokenConverterClient {
    const programId = new PublicKey("tknMiQZDHrrJe4VDESf3cJorj1jWCfCYK2g4d7nqjT1");
    return new TokenConverterClient(provider.connection, programId, provider);
  }

  /**
   * Derive the token converter config PDA
   */
  static getTokenConverterConfigAddress(
    inboundTokenMint: PublicKey,
    outboundTokenMint: PublicKey,
    programId: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_converter_config"),
        inboundTokenMint.toBuffer(),
        outboundTokenMint.toBuffer(),
      ],
      programId
    );
  }

  /**
   * Derive the token converter PDA
   */
  static getTokenConverterAddress(
    inboundTokenMint: PublicKey,
    outboundTokenMint: PublicKey,
    programId: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_converter"),
        inboundTokenMint.toBuffer(),
        outboundTokenMint.toBuffer(),
      ],
      programId
    );
  }

  /**
   * Get the inbound token vault address for a converter
   */
  static async getInboundTokenVaultAddress(
    tokenConverter: PublicKey,
    inboundTokenMint: PublicKey
  ): Promise<PublicKey> {
    return getAssociatedTokenAddress(inboundTokenMint, tokenConverter);
  }

  /**
   * Get the outbound token vault address for a converter
   */
  static async getOutboundTokenVaultAddress(
    tokenConverter: PublicKey,
    outboundTokenMint: PublicKey
  ): Promise<PublicKey> {
    return getAssociatedTokenAddress(outboundTokenMint, tokenConverter);
  }

  /**
   * Initialize token converter config
   */
  async initializeTokenConverterConfig(
    authority: PublicKey,
    inboundTokenMint: PublicKey,
    outboundTokenMint: PublicKey,
    maxInboundTokenAmount: BN,
    maxOutboundTokenAmount: BN,
    burnInboundToken: boolean
  ): Promise<TransactionInstruction> {
    const [tokenConverterConfig] = TokenConverterClient.getTokenConverterConfigAddress(
      inboundTokenMint,
      outboundTokenMint,
      this.programId
    );

    return this.program.methods
      .initializeTokenConverterConfig(
        maxInboundTokenAmount,
        maxOutboundTokenAmount,
        burnInboundToken
      )
      .accounts({
        tokenConverterConfig,
        inboundTokenMint,
        outboundTokenMint,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  /**
   * Initialize token converter
   */
  async initializeTokenConverter(
    authority: PublicKey,
    inboundTokenMint: PublicKey,
    outboundTokenMint: PublicKey
  ): Promise<TransactionInstruction> {
    const [tokenConverterConfig] = TokenConverterClient.getTokenConverterConfigAddress(
      inboundTokenMint,
      outboundTokenMint,
      this.programId
    );

    const [tokenConverter] = TokenConverterClient.getTokenConverterAddress(
      inboundTokenMint,
      outboundTokenMint,
      this.programId
    );

    const inboundTokenVault = await TokenConverterClient.getInboundTokenVaultAddress(
      tokenConverter,
      inboundTokenMint
    );

    const outboundTokenVault = await TokenConverterClient.getOutboundTokenVaultAddress(
      tokenConverter,
      outboundTokenMint
    );

    return this.program.methods
      .initializeTokenConverter()
      .accounts({
        tokenConverter,
        tokenConverterConfig,
        inboundTokenVault,
        outboundTokenVault,
        inboundTokenMint,
        outboundTokenMint,
        authority,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  /**
   * Convert tokens
   */
  async convert(
    authority: PublicKey,
    from: PublicKey,
    to: PublicKey,
    inboundTokenMint: PublicKey,
    outboundTokenMint: PublicKey,
    amount: BN
  ): Promise<TransactionInstruction> {
    const [tokenConverterConfig] = TokenConverterClient.getTokenConverterConfigAddress(
      inboundTokenMint,
      outboundTokenMint,
      this.programId
    );

    const [tokenConverter] = TokenConverterClient.getTokenConverterAddress(
      inboundTokenMint,
      outboundTokenMint,
      this.programId
    );

    const inboundTokenVault = await TokenConverterClient.getInboundTokenVaultAddress(
      tokenConverter,
      inboundTokenMint
    );

    const outboundTokenVault = await TokenConverterClient.getOutboundTokenVaultAddress(
      tokenConverter,
      outboundTokenMint
    );

    return this.program.methods
      .convert(amount)
      .accounts({
        tokenConverter,
        tokenConverterConfig,
        authority,
        from,
        to,
        inboundTokenVault,
        outboundTokenVault,
        inboundTokenMint,
        outboundTokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  /**
   * Get token converter config account data
   */
  async getTokenConverterConfig(
    inboundTokenMint: PublicKey,
    outboundTokenMint: PublicKey
  ): Promise<any> {
    const [tokenConverterConfig] = TokenConverterClient.getTokenConverterConfigAddress(
      inboundTokenMint,
      outboundTokenMint,
      this.programId
    );

    return this.program.account.tokenConverterConfig.fetch(tokenConverterConfig);
  }

  /**
   * Get token converter account data
   */
  async getTokenConverter(
    inboundTokenMint: PublicKey,
    outboundTokenMint: PublicKey
  ): Promise<any> {
    const [tokenConverter] = TokenConverterClient.getTokenConverterAddress(
      inboundTokenMint,
      outboundTokenMint,
      this.programId
    );

    return this.program.account.tokenConverter.fetch(tokenConverter);
  }

  /**
   * Create a transaction with multiple instructions
   */
  async createTransaction(instructions: TransactionInstruction[]): Promise<Transaction> {
    const transaction = new Transaction();
    transaction.add(...instructions);
    return transaction;
  }
} 