use super::*;

#[derive(Accounts)]
pub struct MeteoraAccounts<'info> {
    pub damm_v2_program: Program<'info, DammV2Cpi>,

    /// CHECK: checked by damm v2 program - custom Meteora config
    pub config: UncheckedAccount<'info>,

    pub token_2022_program: Program<'info, Token2022>,

    /// CHECK: checked by damm v2 program
    #[account(mut, seeds = [POSITION_NFT_ACCOUNT_PREFIX.as_ref(), position_nft_mint.key().as_ref()], bump, seeds::program = damm_v2_program)]
    pub position_nft_account: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    #[account(mut, seeds = [
        POOL_PREFIX.as_ref(),
        config.key().as_ref(),
        &max_key(&base_mint.key(), &quote_mint.key()),
        &min_key(&base_mint.key(), &quote_mint.key()),
    ], bump, seeds::program = damm_v2_program)]
    pub pool: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    #[account(mut, seeds = [POSITION_PREFIX.as_ref(), position_nft_mint.key().as_ref()], bump, seeds::program = damm_v2_program)]
    pub position: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program - PDA derived from base_mint for uniqueness
    #[account(mut, seeds = [b"position_nft_mint", base_mint.key().as_ref()], bump)]
    pub position_nft_mint: UncheckedAccount<'info>,

    /// CHECK: references from root struct
    pub base_mint: UncheckedAccount<'info>,

    /// CHECK: references from root struct
    pub quote_mint: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    #[account(mut, seeds = [
        TOKEN_VAULT_PREFIX.as_ref(),
        base_mint.key().as_ref(),
        pool.key().as_ref(),
    ], bump, seeds::program = damm_v2_program)]
    pub token_a_vault: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    #[account(mut, seeds = [
        TOKEN_VAULT_PREFIX.as_ref(),
        quote_mint.key().as_ref(),
        pool.key().as_ref(),
    ], bump, seeds::program = damm_v2_program)]
    pub token_b_vault: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program - global authority for pool creation
    #[account(seeds = [b"damm_pool_creator_authority"], bump)]
    pub pool_creator_authority: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    #[account(seeds = [POOL_AUTHORITY_PREFIX.as_ref()], bump, seeds::program = damm_v2_program)]
    pub pool_authority: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    pub damm_v2_event_authority: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct WithdrawAndProvideLiquidity<'info> {
    /// The vault/DAO that owns the LP tokens (must sign)
    /// This will be the V5 vault PDA signing via Squads
    #[account(mut)]
    pub vault_authority: Signer<'info>,

    /// Migration signer PDA - used to sign for Meteora CPI token transfers
    /// Seeds: ["migration_signer", base_mint]
    /// CHECK: PDA owned by this program, validated by seeds
    #[account(
        mut,
        seeds = [b"migration_signer", base_mint.key().as_ref()],
        bump
    )]
    pub migration_signer: UncheckedAccount<'info>,

    /// Migration signer's base token account (receives tokens from vault, transfers to Meteora)
    #[account(
        mut,
        token::mint = base_mint,
        token::authority = migration_signer,
    )]
    pub migration_signer_base_ata: Account<'info, TokenAccount>,

    /// Migration signer's quote token account (receives tokens from vault, transfers to Meteora)
    #[account(
        mut,
        token::mint = quote_mint,
        token::authority = migration_signer,
    )]
    pub migration_signer_quote_ata: Account<'info, TokenAccount>,

    // ===== Raydium Withdrawal Accounts =====
    /// Raydium CPMM pool state
    /// CHECK: Validated by Raydium CPMM program via CPI - program verifies pool ownership and structure
    #[account(mut)]
    pub pool_state: UncheckedAccount<'info>,

    /// LP token mint
    #[account(mut)]
    pub lp_mint: Account<'info, Mint>,

    /// Vault's LP token account (will be burned from)
    #[account(
        mut,
        constraint = vault_lp_token.owner == vault_authority.key() @ RaydiumMigrationError::TokenAccountOwnerMismatch,
        constraint = vault_lp_token.mint == lp_mint.key() @ RaydiumMigrationError::InvalidTokenMint,
    )]
    pub vault_lp_token: Account<'info, TokenAccount>,

    /// Vault's token0 account (will receive tokens from pool)
    /// Note: token0/token1 ordering is derived from base_mint/quote_mint pubkey comparison
    #[account(
        mut,
        constraint = vault_token0.owner == vault_authority.key() @ RaydiumMigrationError::TokenAccountOwnerMismatch,
    )]
    pub vault_token0: Account<'info, TokenAccount>,

    /// Vault's token1 account (will receive tokens from pool)
    /// Note: token0/token1 ordering is derived from base_mint/quote_mint pubkey comparison
    #[account(
        mut,
        constraint = vault_token1.owner == vault_authority.key() @ RaydiumMigrationError::TokenAccountOwnerMismatch,
    )]
    pub vault_token1: Account<'info, TokenAccount>,

    // ===== V6 Futarchy AMM Accounts =====
    /// V6 DAO account
    /// CHECK: Validated by futarchy program via CPI - program verifies DAO ownership and state
    #[account(mut)]
    pub dao: UncheckedAccount<'info>,

    /// Base token mint (used for determining token0/token1 -> base/quote mapping)
    pub base_mint: Account<'info, Mint>,

    /// Quote token mint (used for determining token0/token1 -> base/quote mapping)
    pub quote_mint: Account<'info, Mint>,

    /// Raydium authority PDA
    /// CHECK: Validated by Raydium program via CPI - derived from pool state seeds
    pub raydium_authority: UncheckedAccount<'info>,

    /// Pool's token0 vault
    /// CHECK: Validated by Raydium program via CPI - program verifies vault ownership
    #[account(mut)]
    pub pool_token0_vault: UncheckedAccount<'info>,

    /// Pool's token1 vault
    /// CHECK: Validated by Raydium program via CPI - program verifies vault ownership
    #[account(mut)]
    pub pool_token1_vault: UncheckedAccount<'info>,

    /// AMM position PDA (owned by futarchy program)
    /// CHECK: Created/validated by futarchy program via CPI - PDA derived from dao + position_authority
    #[account(mut)]
    pub amm_position: UncheckedAccount<'info>,

    /// AMM base vault (owned by DAO)
    /// CHECK: Validated by futarchy program via CPI - program verifies vault ownership by DAO
    #[account(mut)]
    pub amm_base_vault: UncheckedAccount<'info>,

    /// AMM quote vault (owned by DAO)
    /// CHECK: Validated by futarchy program via CPI - program verifies vault ownership by DAO
    #[account(mut)]
    pub amm_quote_vault: UncheckedAccount<'info>,

    /// V6 vault base treasury ATA (receives remaining base tokens after liquidity provision)
    /// CHECK: Token account validated by SPL token program during transfer - must be valid ATA
    #[account(mut)]
    pub v6_vault_base_ata: UncheckedAccount<'info>,

    /// V6 vault quote treasury ATA (receives remaining quote tokens after liquidity provision)
    /// CHECK: Token account validated by SPL token program during transfer - must be valid ATA
    #[account(mut)]
    pub v6_vault_quote_ata: UncheckedAccount<'info>,

    /// V6 vault PDA (will be the position authority for the AMM position)
    /// This is separate from vault_authority (V5 vault) which signs the transaction
    /// CHECK: Used as position_authority in futarchy CPI - futarchy validates during provide_liquidity
    pub v6_vault_pda: UncheckedAccount<'info>,

    /// Event authority for futarchy CPI events
    /// CHECK: Required by futarchy #[event_cpi] - PDA derived from futarchy program ID
    pub event_authority: UncheckedAccount<'info>,

    // ===== Programs =====
    /// Raydium CPMM program
    pub raydium_program: Program<'info, RaydiumCpmm>,

    /// Futarchy v0.6 program
    pub futarchy_program: Program<'info, Futarchy>,

    /// SPL Token program
    pub token_program: Program<'info, Token>,

    /// SPL Token 2022 program (required by Raydium for Token-2022 support)
    /// CHECK: Passed to Raydium CPI - Raydium validates program ID internally
    pub token_program_2022: UncheckedAccount<'info>,

    /// System program
    pub system_program: Program<'info, System>,

    /// Memo program (required by Raydium for withdrawal logs)
    /// CHECK: Passed to Raydium CPI - Raydium validates memo program ID
    pub memo_program: UncheckedAccount<'info>,

    // ===== Meteora DAMM v2 Accounts =====
    pub meteora_accounts: MeteoraAccounts<'info>,
}

impl WithdrawAndProvideLiquidity<'_> {
    pub fn validate(&self, lp_amount: u64) -> Result<()> {
        // Validate base and quote mints are different
        require!(
            self.base_mint.key() != self.quote_mint.key(),
            RaydiumMigrationError::DuplicateTokenMints
        );

        // Derive token0/token1 ordering from base/quote mints
        let base_is_token0 = self.base_mint.key() < self.quote_mint.key();

        // Validate that vault token accounts match the expected base/quote mints
        let expected_token0_mint = if base_is_token0 {
            self.base_mint.key()
        } else {
            self.quote_mint.key()
        };
        let expected_token1_mint = if base_is_token0 {
            self.quote_mint.key()
        } else {
            self.base_mint.key()
        };

        require!(
            self.vault_token0.mint == expected_token0_mint,
            RaydiumMigrationError::InvalidTokenMint
        );
        require!(
            self.vault_token1.mint == expected_token1_mint,
            RaydiumMigrationError::InvalidTokenMint
        );

        // Validate LP amount and balance
        require!(lp_amount > 0, RaydiumMigrationError::InsufficientLpBalance);
        require!(
            self.vault_lp_token.amount >= lp_amount,
            RaydiumMigrationError::InsufficientLpBalance
        );

        Ok(())
    }

    pub fn handle(
        ctx: Context<Self>,
        lp_amount: u64,
        min_raydium_amount_0: u64,
        min_raydium_amount_1: u64,
        min_futarchy_liquidity: u64,
    ) -> Result<()> {
        // Derive token0/token1 ordering from base/quote mints
        let base_is_token0 = ctx.accounts.base_mint.key() < ctx.accounts.quote_mint.key();

        // 1. Snapshot current vault token balances BEFORE Raydium withdrawal
        let token0_balance_before = ctx.accounts.vault_token0.amount;
        let token1_balance_before = ctx.accounts.vault_token1.amount;

        // 2. Execute Raydium withdraw CPI
        raydium_cpmm_cpi::cpi::withdraw(
            CpiContext::new(
                ctx.accounts.raydium_program.to_account_info(),
                raydium_cpmm_cpi::cpi::accounts::Withdraw {
                    owner: ctx.accounts.vault_authority.to_account_info(),
                    authority: ctx.accounts.raydium_authority.to_account_info(),
                    pool_state: ctx.accounts.pool_state.to_account_info(),
                    owner_lp_token: ctx.accounts.vault_lp_token.to_account_info(),
                    token_0_account: ctx.accounts.vault_token0.to_account_info(),
                    token_1_account: ctx.accounts.vault_token1.to_account_info(),
                    token_0_vault: ctx.accounts.pool_token0_vault.to_account_info(),
                    token_1_vault: ctx.accounts.pool_token1_vault.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    token_program_2022: ctx.accounts.token_program_2022.to_account_info(),
                    vault_0_mint: if base_is_token0 {
                        ctx.accounts.base_mint.to_account_info()
                    } else {
                        ctx.accounts.quote_mint.to_account_info()
                    },
                    vault_1_mint: if base_is_token0 {
                        ctx.accounts.quote_mint.to_account_info()
                    } else {
                        ctx.accounts.base_mint.to_account_info()
                    },
                    lp_mint: ctx.accounts.lp_mint.to_account_info(),
                    memo_program: ctx.accounts.memo_program.to_account_info(),
                },
            ),
            lp_amount,
            min_raydium_amount_0,
            min_raydium_amount_1,
        )?;

        // 3. Reload token accounts and calculate withdrawn amounts (delta)
        ctx.accounts.vault_token0.reload()?;
        ctx.accounts.vault_token1.reload()?;

        let withdrawn_token0 = ctx
            .accounts
            .vault_token0
            .amount
            .checked_sub(token0_balance_before)
            .ok_or(RaydiumMigrationError::MathOverflow)?;
        let withdrawn_token1 = ctx
            .accounts
            .vault_token1
            .amount
            .checked_sub(token1_balance_before)
            .ok_or(RaydiumMigrationError::MathOverflow)?;

        // 4. Map token0/token1 to base/quote using the ordering we derived earlier
        let (withdrawn_base, withdrawn_quote) = if base_is_token0 {
            (withdrawn_token0, withdrawn_token1)
        } else {
            (withdrawn_token1, withdrawn_token0)
        };

        // 5. Calculate split: 90% to futarchy, 10% to Meteora (both base AND quote)
        let base_to_meteora = withdrawn_base / 10; // 10%
        let base_to_futarchy = withdrawn_base - base_to_meteora; // 90%

        let quote_to_meteora = withdrawn_quote / 10; // 10%
        let quote_to_futarchy = withdrawn_quote - quote_to_meteora; // 90%

        // 6. Transfer 10% of tokens to migration_signer's accounts for Meteora CPI
        let (migration_signer_base_source, migration_signer_quote_source) = if base_is_token0 {
            (
                ctx.accounts.vault_token0.to_account_info(),
                ctx.accounts.vault_token1.to_account_info(),
            )
        } else {
            (
                ctx.accounts.vault_token1.to_account_info(),
                ctx.accounts.vault_token0.to_account_info(),
            )
        };

        // Transfer base tokens to migration_signer
        let transfer_base_to_signer_ix = spl_token::instruction::transfer(
            &ctx.accounts.token_program.key(),
            &migration_signer_base_source.key(),
            &ctx.accounts.migration_signer_base_ata.key(),
            &ctx.accounts.vault_authority.key(),
            &[],
            base_to_meteora,
        )?;

        invoke(
            &transfer_base_to_signer_ix,
            &[
                migration_signer_base_source.clone(),
                ctx.accounts.migration_signer_base_ata.to_account_info(),
                ctx.accounts.vault_authority.to_account_info(),
            ],
        )?;

        // Transfer quote tokens to migration_signer
        let transfer_quote_to_signer_ix = spl_token::instruction::transfer(
            &ctx.accounts.token_program.key(),
            &migration_signer_quote_source.key(),
            &ctx.accounts.migration_signer_quote_ata.key(),
            &ctx.accounts.vault_authority.key(),
            &[],
            quote_to_meteora,
        )?;

        invoke(
            &transfer_quote_to_signer_ix,
            &[
                migration_signer_quote_source.clone(),
                ctx.accounts.migration_signer_quote_ata.to_account_info(),
                ctx.accounts.vault_authority.to_account_info(),
            ],
        )?;

        // Verify transfers succeeded by reloading and checking balances
        ctx.accounts.migration_signer_base_ata.reload()?;
        ctx.accounts.migration_signer_quote_ata.reload()?;

        require!(
            ctx.accounts.migration_signer_base_ata.amount >= base_to_meteora,
            RaydiumMigrationError::InsufficientLpBalance
        );
        require!(
            ctx.accounts.migration_signer_quote_ata.amount >= quote_to_meteora,
            RaydiumMigrationError::InsufficientLpBalance
        );

        // 7. Create Meteora DAMM v2 pool with 10% of tokens (two-sided liquidity)
        msg!(
            "Before Meteora CPI - migration_signer base: {}, quote: {}",
            ctx.accounts.migration_signer_base_ata.amount,
            ctx.accounts.migration_signer_quote_ata.amount
        );

        ctx.accounts.create_meteora_pool(
            base_to_meteora,
            quote_to_meteora,
            base_is_token0,
            ctx.bumps.migration_signer,
            ctx.bumps.meteora_accounts.position_nft_mint,
            ctx.bumps.meteora_accounts.pool_creator_authority,
        )?;

        // Check if tokens were deducted after Meteora CPI
        ctx.accounts.migration_signer_base_ata.reload()?;
        ctx.accounts.migration_signer_quote_ata.reload()?;
        msg!(
            "After Meteora CPI - migration_signer base: {}, quote: {}",
            ctx.accounts.migration_signer_base_ata.amount,
            ctx.accounts.migration_signer_quote_ata.amount
        );

        // 8. CPI to V6 futarchy program to provide liquidity with 90% of tokens
        ctx.accounts.vault_token0.reload()?;
        ctx.accounts.vault_token1.reload()?;
        msg!(
            "Before Futarchy CPI - vault_token0: {}, vault_token1: {}",
            ctx.accounts.vault_token0.amount,
            ctx.accounts.vault_token1.amount
        );
        msg!(
            "Futarchy params - quote_to_futarchy: {}, base_to_futarchy: {}, min_liquidity: {}",
            quote_to_futarchy,
            base_to_futarchy,
            min_futarchy_liquidity
        );

        let (liquidity_provider_base_info, liquidity_provider_quote_info) = if base_is_token0 {
            (
                ctx.accounts.vault_token0.to_account_info(),
                ctx.accounts.vault_token1.to_account_info(),
            )
        } else {
            (
                ctx.accounts.vault_token1.to_account_info(),
                ctx.accounts.vault_token0.to_account_info(),
            )
        };

        futarchy::cpi::provide_liquidity(
            CpiContext::new(
                ctx.accounts.futarchy_program.to_account_info(),
                futarchy::cpi::accounts::ProvideLiquidity {
                    dao: ctx.accounts.dao.to_account_info(),
                    liquidity_provider: ctx.accounts.vault_authority.to_account_info(),
                    liquidity_provider_base_account: liquidity_provider_base_info,
                    liquidity_provider_quote_account: liquidity_provider_quote_info,
                    payer: ctx.accounts.vault_authority.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    amm_base_vault: ctx.accounts.amm_base_vault.to_account_info(),
                    amm_quote_vault: ctx.accounts.amm_quote_vault.to_account_info(),
                    amm_position: ctx.accounts.amm_position.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    event_authority: ctx.accounts.event_authority.to_account_info(),
                    program: ctx.accounts.futarchy_program.to_account_info(),
                },
            ),
            ProvideLiquidityParams {
                quote_amount: quote_to_futarchy,
                max_base_amount: base_to_futarchy,
                min_liquidity: min_futarchy_liquidity as u128,
                position_authority: ctx.accounts.v6_vault_pda.key(),
            },
        )?;

        msg!("Futarchy provide_liquidity CPI completed");

        // 9. Transfer REMAINING balances to V6 vault treasury
        ctx.accounts.vault_token0.reload()?;
        ctx.accounts.vault_token1.reload()?;

        let remaining_token0 = ctx.accounts.vault_token0.amount;
        let remaining_token1 = ctx.accounts.vault_token1.amount;

        // Transfer remaining token0 to appropriate V6 vault treasury ATA
        if remaining_token0 > 0 {
            let (destination_key, destination_account_info) = if base_is_token0 {
                (
                    ctx.accounts.v6_vault_base_ata.key(),
                    ctx.accounts.v6_vault_base_ata.to_account_info(),
                )
            } else {
                (
                    ctx.accounts.v6_vault_quote_ata.key(),
                    ctx.accounts.v6_vault_quote_ata.to_account_info(),
                )
            };

            let transfer_ix = spl_token::instruction::transfer(
                &ctx.accounts.token_program.key(),
                &ctx.accounts.vault_token0.key(),
                &destination_key,
                &ctx.accounts.vault_authority.key(),
                &[],
                remaining_token0,
            )?;

            invoke(
                &transfer_ix,
                &[
                    ctx.accounts.vault_token0.to_account_info(),
                    destination_account_info,
                    ctx.accounts.vault_authority.to_account_info(),
                ],
            )?;
        }

        // Transfer remaining token1 to appropriate V6 vault treasury ATA
        if remaining_token1 > 0 {
            let (destination_key, destination_account_info) = if base_is_token0 {
                (
                    ctx.accounts.v6_vault_quote_ata.key(),
                    ctx.accounts.v6_vault_quote_ata.to_account_info(),
                )
            } else {
                (
                    ctx.accounts.v6_vault_base_ata.key(),
                    ctx.accounts.v6_vault_base_ata.to_account_info(),
                )
            };

            let transfer_ix = spl_token::instruction::transfer(
                &ctx.accounts.token_program.key(),
                &ctx.accounts.vault_token1.key(),
                &destination_key,
                &ctx.accounts.vault_authority.key(),
                &[],
                remaining_token1,
            )?;

            invoke(
                &transfer_ix,
                &[
                    ctx.accounts.vault_token1.to_account_info(),
                    destination_account_info,
                    ctx.accounts.vault_authority.to_account_info(),
                ],
            )?;
        }

        // Map remaining token0/token1 to base/quote for event
        let (treasury_base_transferred, treasury_quote_transferred) = if base_is_token0 {
            (remaining_token0, remaining_token1)
        } else {
            (remaining_token1, remaining_token0)
        };

        // 10. Emit migration event for audit trail
        emit!(MigrationExecuted {
            vault_authority: ctx.accounts.vault_authority.key(),
            lp_amount,
            withdrawn_base,
            withdrawn_quote,
            base_to_meteora,
            quote_to_meteora,
            base_to_futarchy,
            quote_to_futarchy,
            meteora_pool: ctx.accounts.meteora_accounts.pool.key(),
            treasury_base_transferred,
            treasury_quote_transferred,
        });

        Ok(())
    }

    #[inline(never)]
    fn create_meteora_pool(
        &self,
        base_to_meteora: u64,
        quote_to_meteora: u64,
        _base_is_token0: bool,
        migration_signer_bump: u8,
        position_nft_mint_bump: u8,
        pool_creator_authority_bump: u8,
    ) -> Result<()> {
        let base_mint_key = self.base_mint.key();

        // Migration signer seeds - this PDA will sign for token transfers to Meteora
        let migration_signer_seeds = &[
            b"migration_signer".as_ref(),
            base_mint_key.as_ref(),
            &[migration_signer_bump],
        ];

        let position_nft_mint_signer_seeds = &[
            b"position_nft_mint".as_ref(),
            base_mint_key.as_ref(),
            &[position_nft_mint_bump],
        ];

        let pool_creator_authority_signer_seeds = &[
            b"damm_pool_creator_authority".as_ref(),
            &[pool_creator_authority_bump],
        ];

        // Include migration_signer_seeds so it can sign for token transfers
        let pool_init_signer = &[
            &migration_signer_seeds[..],
            &position_nft_mint_signer_seeds[..],
            &pool_creator_authority_signer_seeds[..],
        ];

        // Calculate price from the token amounts: price = quote / base
        let float_price = quote_to_meteora as f64 / base_to_meteora as f64;
        let sqrt_price_float = float_price.sqrt();
        // sqrt_price in Q64.64 format (scaled by 2^64) for the CPI
        let sqrt_price = (sqrt_price_float * 2_f64.powf(64.0)) as u128;

        // Calculate liquidity for TWO-SIDED full-range position (MIN to MAX)
        let liquidity = (base_to_meteora as u128)
            .checked_mul(sqrt_price)
            .ok_or(RaydiumMigrationError::MathOverflow)?;

        msg!(
            "Meteora two-sided liquidity calc: base={}, quote={}, sqrt_price={}, liquidity={}",
            base_to_meteora,
            quote_to_meteora,
            sqrt_price,
            liquidity
        );

        msg!("Meteora liquidity: {}", liquidity);
        msg!(
            "Meteora pool: {}, token_a_vault: {}, token_b_vault: {}",
            self.meteora_accounts.pool.key(),
            self.meteora_accounts.token_a_vault.key(),
            self.meteora_accounts.token_b_vault.key()
        );

        // Meteora requires token_b (quote) to be SOL or USDC
        let payer_token_a = self.migration_signer_base_ata.to_account_info();
        let payer_token_b = self.migration_signer_quote_ata.to_account_info();

        damm_v2_cpi::cpi::initialize_pool_with_dynamic_config(
            CpiContext::new_with_signer(
                self.meteora_accounts.damm_v2_program.to_account_info(),
                damm_v2_cpi::cpi::accounts::InitializePoolWithDynamicConfigCtx {
                    creator: self.v6_vault_pda.to_account_info(),
                    position_nft_mint: self.meteora_accounts.position_nft_mint.to_account_info(),
                    position_nft_account: self
                        .meteora_accounts
                        .position_nft_account
                        .to_account_info(),
                    payer: self.migration_signer.to_account_info(),
                    pool_creator_authority: self
                        .meteora_accounts
                        .pool_creator_authority
                        .to_account_info(),
                    config: self.meteora_accounts.config.to_account_info(),
                    pool_authority: self.meteora_accounts.pool_authority.to_account_info(),
                    token_a_vault: self.meteora_accounts.token_a_vault.to_account_info(),
                    token_b_vault: self.meteora_accounts.token_b_vault.to_account_info(),
                    payer_token_a,
                    payer_token_b,
                    token_a_program: self.token_program.to_account_info(),
                    token_b_program: self.token_program.to_account_info(),
                    token_2022_program: self.meteora_accounts.token_2022_program.to_account_info(),
                    system_program: self.system_program.to_account_info(),
                    pool: self.meteora_accounts.pool.to_account_info(),
                    position: self.meteora_accounts.position.to_account_info(),
                    token_a_mint: self.base_mint.to_account_info(),
                    token_b_mint: self.quote_mint.to_account_info(),
                    event_authority: self
                        .meteora_accounts
                        .damm_v2_event_authority
                        .to_account_info(),
                    program: self.meteora_accounts.damm_v2_program.to_account_info(),
                },
                pool_init_signer,
            ),
            damm_v2_cpi::InitializeCustomizablePoolParameters {
                pool_fees: damm_v2_cpi::PoolFeeParameters {
                    base_fee: BaseFeeParameters {
                        cliff_fee_numerator: 5000000, // 0.5%
                        number_of_period: 0,
                        period_frequency: 0,
                        reduction_factor: 0,
                        fee_scheduler_mode: 0,
                    },
                    padding: [0; 3],
                    dynamic_fee: None,
                },
                activation_point: None,
                activation_type: 0,
                collect_fee_mode: 0,
                sqrt_min_price: MIN_SQRT_PRICE,
                sqrt_max_price: MAX_SQRT_PRICE,
                has_alpha_vault: false,
                liquidity,
                sqrt_price,
            },
        )
    }
}

// ===== Helper Functions =====

pub fn max_key(left: &Pubkey, right: &Pubkey) -> [u8; 32] {
    std::cmp::max(left, right).to_bytes()
}

pub fn min_key(left: &Pubkey, right: &Pubkey) -> [u8; 32] {
    std::cmp::min(left, right).to_bytes()
}
