use super::*;

/// The venue's DCA interface bounds (Jupiter's Trigger API suite): a total
/// split across an integral order count of at least 2, with any remainder
/// landing in the last order; an interval between a minute and a year; and a
/// start at most 30 days out. Its per-order value floor is a USD figure set by
/// venue policy, so it is deliberately not mirrored here.
pub const MIN_BUYBACK_CYCLE_COUNT: u32 = 2;
pub const MIN_BUYBACK_CYCLE_SECONDS: u32 = 60;
pub const MAX_BUYBACK_CYCLE_SECONDS: u32 = 365 * DAY_SECONDS;
pub const MAX_BUYBACK_START_DELAY_SECONDS: u32 = 30 * DAY_SECONDS;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeBuybackTokenProposalArgs {
    pub quote_amount: u64,
    pub cycle_count: u32,
    pub cycle_frequency_seconds: u32,
    pub start_delay_seconds: u32,
    pub min_price: Option<u64>,
    pub max_price: Option<u64>,
}

#[derive(Accounts)]
#[event_cpi]
pub struct InitializeBuybackTokenProposal<'info> {
    pub typed_initialize_accounts: TypedInitializeAccounts<'info>,
}

impl InitializeBuybackTokenProposal<'_> {
    pub fn validate(&self, args: &InitializeBuybackTokenProposalArgs) -> Result<()> {
        self.typed_initialize_accounts.validate()?;

        // A zero total is a mandate to buy nothing.
        require_gt!(args.quote_amount, 0, FutarchyError::InvalidBuybackAmount);
        require_gte!(
            args.cycle_count,
            MIN_BUYBACK_CYCLE_COUNT,
            FutarchyError::InvalidBuybackCycleCount
        );

        require_gte!(
            args.cycle_frequency_seconds,
            MIN_BUYBACK_CYCLE_SECONDS,
            FutarchyError::InvalidBuybackCycleFrequency
        );
        require_gte!(
            MAX_BUYBACK_CYCLE_SECONDS,
            args.cycle_frequency_seconds,
            FutarchyError::InvalidBuybackCycleFrequency
        );

        require_gte!(
            MAX_BUYBACK_START_DELAY_SECONDS,
            args.start_delay_seconds,
            FutarchyError::InvalidBuybackStartDelay
        );

        if let (Some(min_price), Some(max_price)) = (args.min_price, args.max_price) {
            require_gte!(max_price, min_price, FutarchyError::InvalidBuybackPriceBand);
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: InitializeBuybackTokenProposalArgs) -> Result<()> {
        let typed_initialize_accounts = &mut ctx.accounts.typed_initialize_accounts;

        let format_price = |price: Option<u64>| match price {
            Some(price) => price.to_string(),
            None => "none".to_string(),
        };
        let memo = format!(
            "metadao-buyback/1 proposal={} spend={} cycles={} cycle_seconds={} start_delay={} min_price={} max_price={}",
            typed_initialize_accounts.proposal.key(),
            args.quote_amount,
            args.cycle_count,
            args.cycle_frequency_seconds,
            args.start_delay_seconds,
            format_price(args.min_price),
            format_price(args.max_price),
        );

        let memo_ix = spl_memo::build_memo(memo.as_bytes(), &[]);

        let event = typed_initialize_accounts.initialize_proposal(
            &[memo_ix],
            ProposalAction::BuybackToken {
                quote_amount: args.quote_amount,
                cycle_count: args.cycle_count,
                cycle_frequency_seconds: args.cycle_frequency_seconds,
                start_delay_seconds: args.start_delay_seconds,
                min_price: args.min_price,
                max_price: args.max_price,
            },
            ctx.bumps.typed_initialize_accounts.proposal,
        )?;

        emit_cpi!(event);

        Ok(())
    }
}
