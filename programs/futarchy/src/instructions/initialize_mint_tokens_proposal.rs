use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program_option::COption;
use anchor_lang::InstructionData;

use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeMintTokensProposalArgs {
    pub amount: u64,
    pub recipient: Pubkey,
}

#[derive(Accounts)]
#[event_cpi]
pub struct InitializeMintTokensProposal<'info> {
    pub typed_initialize_accounts: TypedInitializeAccounts<'info>,
    #[account(address = typed_initialize_accounts.dao.base_mint)]
    pub base_mint: Box<Account<'info, Mint>>,
    /// Only for governed mints (v0.8 launches): the `MintGovernor` holding the
    /// base mint's authority.
    pub mint_governor: Option<Box<Account<'info, mint_governor::MintGovernor>>>,
    /// Only for governed mints: the vault's minting rights on `mint_governor`.
    pub mint_authority: Option<Box<Account<'info, mint_governor::MintAuthority>>>,
}

impl InitializeMintTokensProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        self.typed_initialize_accounts.validate()?;

        let vault = self.typed_initialize_accounts.dao.squads_multisig_vault;

        if self.base_mint.mint_authority == COption::Some(vault) {
            return Ok(());
        }

        // Not the vault: the only other authority the vault can mint through
        // is a MintGovernor on which the vault is an authorized minter.
        let governor = self
            .mint_governor
            .as_ref()
            .ok_or(FutarchyError::UnknownMintAuthority)?;
        require!(
            self.base_mint.mint_authority == COption::Some(governor.key()),
            FutarchyError::UnknownMintAuthority
        );
        require_keys_eq!(
            governor.mint,
            self.base_mint.key(),
            FutarchyError::UnknownMintAuthority
        );

        let mint_authority = self
            .mint_authority
            .as_ref()
            .ok_or(FutarchyError::UnknownMintAuthority)?;
        require_keys_eq!(
            mint_authority.mint_governor,
            governor.key(),
            FutarchyError::UnknownMintAuthority
        );
        require_keys_eq!(
            mint_authority.authorized_minter,
            vault,
            FutarchyError::UnknownMintAuthority
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: InitializeMintTokensProposalArgs) -> Result<()> {
        let base_mint = ctx.accounts.base_mint.key();
        let vault = ctx
            .accounts
            .typed_initialize_accounts
            .dao
            .squads_multisig_vault;

        let recipient_ata =
            anchor_spl::associated_token::get_associated_token_address(&args.recipient, &base_mint);

        let mint_ix = if ctx.accounts.base_mint.mint_authority == COption::Some(vault) {
            token::spl_token::instruction::mint_to(
                &token::ID,
                &base_mint,
                &recipient_ata,
                &vault,
                &[],
                args.amount,
            )?
        } else {
            // validate() has pinned both governor-branch accounts
            let governor = ctx.accounts.mint_governor.as_ref().unwrap();
            let mint_authority = ctx.accounts.mint_authority.as_ref().unwrap();

            let (event_authority, _) =
                Pubkey::find_program_address(&[b"__event_authority"], &mint_governor::ID);

            Instruction {
                program_id: mint_governor::ID,
                accounts: mint_governor::accounts::MintTokens {
                    mint_governor: governor.key(),
                    mint_authority: mint_authority.key(),
                    mint: base_mint,
                    destination_ata: recipient_ata,
                    authorized_minter: vault,
                    token_program: token::ID,
                    event_authority,
                    program: mint_governor::ID,
                }
                .to_account_metas(None),
                data: mint_governor::instruction::MintTokens {
                    args: mint_governor::MintTokensArgs {
                        amount: args.amount,
                    },
                }
                .data(),
            }
        };

        let event = ctx.accounts.typed_initialize_accounts.initialize_proposal(
            &[mint_ix],
            ProposalAction::MintTokens {
                amount: args.amount,
                recipient: args.recipient,
            },
            ctx.bumps.typed_initialize_accounts.proposal,
        )?;

        emit_cpi!(event);

        Ok(())
    }
}
