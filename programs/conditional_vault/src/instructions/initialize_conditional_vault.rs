use super::*;

use anchor_lang::system_program;
use anchor_spl::token;

#[event_cpi]
#[derive(Accounts)]
pub struct InitializeConditionalVault<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + ConditionalVault::INIT_SPACE + (32 * question.num_outcomes()),
        seeds = [
            b"conditional_vault", 
            question.key().as_ref(),
            underlying_token_mint.key().as_ref(),
        ],
        bump
    )]
    pub vault: Box<Account<'info, ConditionalVault>>,
    pub question: Account<'info, Question>,
    pub underlying_token_mint: Account<'info, Mint>,
    #[account(
        associated_token::authority = vault,
        associated_token::mint = underlying_token_mint
    )]
    pub vault_underlying_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info, 'c: 'info> InitializeConditionalVault<'info> {
    pub fn handle(ctx: Context<'_, '_, 'c, 'info, Self>) -> Result<()> {
        require!(
            !ctx.accounts.question.is_resolved(),
            VaultError::QuestionAlreadyResolved
        );

        let vault = &mut ctx.accounts.vault;

        let decimals = ctx.accounts.underlying_token_mint.decimals;

        let remaining_accs = &mut ctx.remaining_accounts.iter();

        let expected_num_conditional_tokens = ctx.accounts.question.num_outcomes();
        let mut conditional_token_mints = vec![];

        let mint_lamports = Rent::get()?.minimum_balance(Mint::LEN);
        for i in 0..expected_num_conditional_tokens {
            let (conditional_token_mint_address, pda_bump) = Pubkey::find_program_address(
                &[b"conditional_token", vault.key().as_ref(), &[i as u8]],
                ctx.program_id,
            );

            let conditional_token_mint = next_account_info(remaining_accs)?;
            require_eq!(conditional_token_mint.key(), conditional_token_mint_address);

            conditional_token_mints.push(conditional_token_mint_address);

            let cpi_accounts = system_program::Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: conditional_token_mint.to_account_info(),
            };
            let cpi_ctx =
                CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts);
            system_program::transfer(cpi_ctx, mint_lamports)?;

            let vault_key = vault.key();
            let seeds = &[
                b"conditional_token",
                vault_key.as_ref(),
                &[i as u8],
                &[pda_bump],
            ];
            let signer = &[&seeds[..]];

            let cpi_accounts = system_program::Allocate {
                account_to_allocate: conditional_token_mint.to_account_info(),
            };
            let cpi_ctx =
                CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts);
            system_program::allocate(cpi_ctx.with_signer(signer), Mint::LEN as u64)?;

            let cpi_accounts = system_program::Assign {
                account_to_assign: conditional_token_mint.to_account_info(),
            };
            let cpi_ctx =
                CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts);
            system_program::assign(cpi_ctx.with_signer(signer), ctx.accounts.token_program.key)?;

            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_accounts = token::InitializeMint2 {
                mint: conditional_token_mint.to_account_info(),
            };
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

            token::initialize_mint2(cpi_ctx, decimals, &vault.key(), None)?;
        }

        vault.set_inner(ConditionalVault {
            question: ctx.accounts.question.key(),
            underlying_token_mint: ctx.accounts.underlying_token_mint.key(),
            underlying_token_account: ctx.accounts.vault_underlying_token_account.key(),
            conditional_token_mints,
            pda_bump: ctx.bumps.vault,
            decimals,
            seq_num: 0,
        });

        let clock = Clock::get()?;
        emit_cpi!(InitializeConditionalVaultEvent {
            common: CommonFields::new(&clock),
            vault: vault.key(),
            question: vault.question,
            underlying_token_mint: vault.underlying_token_mint,
            vault_underlying_token_account: vault.underlying_token_account,
            conditional_token_mints: vault.conditional_token_mints.clone(),
            pda_bump: vault.pda_bump,
            seq_num: vault.seq_num,
        });

        Ok(())
    }
}
