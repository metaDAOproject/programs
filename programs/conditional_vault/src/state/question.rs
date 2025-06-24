use super::*;

/// Questions represent statements about future events.
///
/// These statements include:
/// - "Will this proposal pass?"
/// - "Who, if anyone, will be hired?"
/// - "How effective will the grant committee deem this grant?"
///
/// Questions have 2 or more possible outcomes. For a question like "will this
/// proposal pass," the outcomes are "yes" and "no." For a question like "who
/// will be hired," the outcomes could be "Alice," "Bob," and "neither."
///
/// Outcomes resolve to a number between 0 and 1. Binary questions like "will
/// this proposal pass" have outcomes that resolve to exactly 0 or 1. You can
/// also have questions with scalar outcomes. For example, the question "how
/// effective will the grant committee deem this grant" could have two outcomes:
/// "ineffective" and "effective." If the grant committee deems the grant 70%
/// effective, the "effective" outcome would resolve to 0.7 and the "ineffective"
/// outcome would resolve to 0.3.
///
/// Once resolved, the sum of all outcome resolutions is exactly 1.
#[account]
#[derive(InitSpace)]
pub struct Question {
    pub question_id: [u8; 32],
    pub oracle: Pubkey,
    #[max_len(0)]
    pub payout_numerators: Vec<u32>,
    pub payout_denominator: u32,
}

impl Question {
    pub fn num_outcomes(&self) -> usize {
        self.payout_numerators.len()
    }

    pub fn is_resolved(&self) -> bool {
        self.payout_denominator != 0
    }
}
