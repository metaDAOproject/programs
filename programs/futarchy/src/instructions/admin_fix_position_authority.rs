use super::*;

pub mod admin {
    use anchor_lang::prelude::declare_id;
    // MetaDAO multisig vault
    declare_id!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
}

pub mod v07_launchpad {
    use anchor_lang::prelude::declare_id;
    declare_id!("moontUzsdepotRGe5xsfip7vLPTJnVuafqdUWexVnPM");
}

pub mod v06_launchpad {
    use anchor_lang::prelude::declare_id;
    declare_id!("MooNyh4CBUYEKyXVnjGYQ8mEiJDpGvJMdvrZx1iGeHV");
}

#[derive(Accounts)]
#[event_cpi]
pub struct AdminFixPositionAuthority<'info> {
    #[account(mut)]
    pub dao: Box<Account<'info, Dao>>,
    #[account(
        mut,
        seeds = [b"amm_position", dao.key().as_ref(), dao.squads_multisig_vault.as_ref()],
        bump,
        has_one = dao,
    )]
    pub amm_position: Box<Account<'info, AmmPosition>>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

impl AdminFixPositionAuthority<'_> {
    pub fn validate(&self) -> Result<()> {
        #[cfg(feature = "production")]
        require_keys_eq!(self.admin.key(), admin::ID, FutarchyError::InvalidAdmin);

        // Derive v0.7 launch signer
        let (v07_launch, _) = Pubkey::find_program_address(
            &[b"launch", self.dao.base_mint.as_ref()],
            &v07_launchpad::ID,
        );
        let (v07_launch_signer, _) = Pubkey::find_program_address(
            &[b"launch_signer", v07_launch.as_ref()],
            &v07_launchpad::ID,
        );

        // Derive v0.6 launch signer
        let (v06_launch, _) = Pubkey::find_program_address(
            &[b"launch", self.dao.base_mint.as_ref()],
            &v06_launchpad::ID,
        );
        let (v06_launch_signer, _) = Pubkey::find_program_address(
            &[b"launch_signer", v06_launch.as_ref()],
            &v06_launchpad::ID,
        );

        // Verify current authority is a known launch signer (confirms bug-affected position)
        require!(
            self.amm_position.position_authority == v07_launch_signer
                || self.amm_position.position_authority == v06_launch_signer,
            FutarchyError::AssertFailed
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let dao = &mut ctx.accounts.dao;
        let amm_position = &mut ctx.accounts.amm_position;

        let old_authority = amm_position.position_authority;
        amm_position.position_authority = dao.squads_multisig_vault;

        dao.seq_num += 1;
        let clock = Clock::get()?;

        emit_cpi!(AdminFixPositionAuthorityEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            dao: dao.key(),
            admin: ctx.accounts.admin.key(),
            amm_position: ctx.accounts.amm_position.key(),
            old_authority,
            new_authority: dao.squads_multisig_vault,
        });

        Ok(())
    }
}
