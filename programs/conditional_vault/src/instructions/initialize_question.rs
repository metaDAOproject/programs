use std::mem::size_of;

use super::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeQuestionArgs {
    pub question_id: [u8; 32],
    pub oracle: Pubkey,
    pub num_outcomes: u8,
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(args: InitializeQuestionArgs)]
pub struct InitializeQuestion<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Question::INIT_SPACE + (args.num_outcomes as usize * size_of::<u32>()),
        seeds = [
            SEED_QUESTION,
            args.question_id.as_ref(),
            args.oracle.key().as_ref(),
            &[args.num_outcomes],
        ],
        bump
    )]
    pub question: Box<Account<'info, Question>>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// The InitializeQuestion instruction is permissionless.
// This is acceptable because no extra ownership is granted to the caller of the instruction.
impl InitializeQuestion<'_> {
    pub fn handle(ctx: Context<Self>, args: InitializeQuestionArgs) -> Result<()> {
        require_gte!(args.num_outcomes, 2, VaultError::InsufficientNumConditions);
        require_gte!(10, args.num_outcomes, VaultError::TooManyOutcomes);

        let question = &mut ctx.accounts.question;

        let InitializeQuestionArgs {
            question_id,
            oracle,
            num_outcomes,
        } = args;

        question.set_inner(Question {
            question_id,
            oracle,
            payout_numerators: vec![0; num_outcomes as usize],
            payout_denominator: 0,
        });

        let clock = Clock::get()?;
        emit_cpi!(InitializeQuestionEvent {
            common: CommonFields::new(&clock),
            question_id,
            oracle,
            num_outcomes,
            question: question.key(),
        });

        Ok(())
    }
}
