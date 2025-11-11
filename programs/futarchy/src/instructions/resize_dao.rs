// use anchor_lang::solana_program::system_program;
use anchor_lang::{system_program, Discriminator};

use super::*;

#[derive(Accounts)]
pub struct ResizeDao<'info> {
    /// CHECK: we check the discriminator
    #[account(mut)]
    pub dao: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl ResizeDao<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let dao = &mut ctx.accounts.dao;

        require_eq!(dao.owner, &ID);
        let is_discriminator_correct =
            dao.data.try_borrow_mut().unwrap()[..8] == Dao::discriminator();
        require_eq!(is_discriminator_correct, true);

        const AFTER_REALLOC_SIZE: usize = Dao::INIT_SPACE + 8;
        const BEFORE_REALLOC_SIZE: usize = AFTER_REALLOC_SIZE - (2 + 32); // 2 for `team_sponsored_pass_threshold_bps` and 32 for `team_address`

        // require_eq!(question.data_len(), V0_SIZE);
        if dao.data_len() != BEFORE_REALLOC_SIZE {
            // already realloced
            require_eq!(dao.data_len(), AFTER_REALLOC_SIZE);
            return Ok(());
        }

        dao.realloc(AFTER_REALLOC_SIZE, true)?;

        let lamports_needed = Rent::get()?.minimum_balance(AFTER_REALLOC_SIZE);

        // TODO: do this optionally?
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: dao.to_account_info(),
                },
            ),
            lamports_needed - dao.lamports(),
        )?;

        let mut dao_data = Dao::deserialize(&mut &dao.try_borrow_mut_data().unwrap()[8..])?;

        // the `team_sponsored_pass_threshold_bps` doesn't matter because they don't have a team address
        dao_data.team_sponsored_pass_threshold_bps = 0;
        dao_data.team_address = Pubkey::default();

        dao_data.serialize(&mut &mut dao.try_borrow_mut_data().unwrap()[8..])?;

        Ok(())
    }
}
