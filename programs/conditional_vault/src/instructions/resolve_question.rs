use super::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ResolveQuestionArgs {
    pub payout_numerators: Vec<u32>,
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(args: ResolveQuestionArgs)]
pub struct ResolveQuestion<'info> {
    #[account(mut, has_one = oracle)]
    pub question: Account<'info, Question>,
    pub oracle: Signer<'info>,
}

impl ResolveQuestion<'_> {
    pub fn handle(ctx: Context<Self>, args: ResolveQuestionArgs) -> Result<()> {
        let question = &mut ctx.accounts.question;

        require_eq!(
            question.payout_denominator,
            0,
            VaultError::QuestionAlreadyResolved
        );

        require_eq!(
            args.payout_numerators.len(),
            question.num_outcomes(),
            VaultError::InvalidNumPayoutNumerators
        );

        question.payout_denominator = args.payout_numerators.iter().sum();
        question.payout_numerators = args.payout_numerators.clone();

        require_gt!(question.payout_denominator, 0, VaultError::PayoutZero);

        let clock = Clock::get()?;
        emit_cpi!(ResolveQuestionEvent {
            common: CommonFields {
                slot: clock.slot,
                unix_timestamp: clock.unix_timestamp,
            },
            question: question.key(),
            payout_numerators: args.payout_numerators,
        });

        Ok(())
    }
}
