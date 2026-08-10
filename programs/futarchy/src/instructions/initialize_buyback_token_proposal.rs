use super::*;

/// The venue's DCA interface bounds (Jupiter's Trigger API suite): an
/// integral order count of at least 2, an interval between a minute and a
/// year, and a start at most 30 days out.
pub const MIN_BUYBACK_CYCLE_SECONDS: u32 = 60;
pub const MAX_BUYBACK_CYCLE_SECONDS: u32 = 365 * DAY_SECONDS;
pub const MAX_BUYBACK_START_DELAY_SECONDS: u32 = 30 * DAY_SECONDS;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeBuybackTokenProposalArgs {
    pub quote_amount: u64,
    pub quote_amount_per_cycle: u64,
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

        // The venue takes an integral order count with a two-order minimum,
        // so the total must be an exact multiple of the per-cycle amount, at
        // least twice over. A zero total falls out of the two-order check.
        require_gt!(
            args.quote_amount_per_cycle,
            0,
            FutarchyError::InvalidBuybackAmount
        );
        require_eq!(
            args.quote_amount % args.quote_amount_per_cycle,
            0,
            FutarchyError::InvalidBuybackAmount
        );
        require_gte!(
            args.quote_amount / args.quote_amount_per_cycle,
            2,
            FutarchyError::InvalidBuybackAmount
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
            "metadao-buyback/1 proposal={} spend={} per_cycle={} cycle_seconds={} start_delay={} min_price={} max_price={}",
            typed_initialize_accounts.proposal.key(),
            args.quote_amount,
            args.quote_amount_per_cycle,
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
                quote_amount_per_cycle: args.quote_amount_per_cycle,
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
