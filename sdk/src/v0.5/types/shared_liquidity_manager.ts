export type SharedLiquidityManager = {
  version: "0.1.0";
  name: "shared_liquidity_manager";
  docs: ["TODO:", "- add unstake", "- add unit tests"];
  instructions: [];
  errors: [
    {
      code: 6000;
      name: "InsufficientStake";
      msg: "Insufficient stake amount";
    },
    {
      code: 6001;
      name: "ProposalNotFinalized";
      msg: "Proposal is not finalized";
    },
    {
      code: 6002;
      name: "NoLpTokensToRemove";
      msg: "No LP tokens to remove from AMM";
    },
    {
      code: 6003;
      name: "NoTokensFromAmm";
      msg: "No tokens received from AMM removal";
    },
    {
      code: 6004;
      name: "InsufficientReservesReturned";
      msg: "Insufficient reserves returned to spot AMM (less than 99.5%)";
    },
    {
      code: 6005;
      name: "PoolInUse";
      msg: "Pool is currently being used by an active proposal";
    },
    {
      code: 6006;
      name: "InsufficientLpShares";
      msg: "User does not have enough LP shares to withdraw";
    },
    {
      code: 6007;
      name: "SlippageExceeded";
      msg: "Slippage exceeded minimum token amounts";
    },
    {
      code: 6008;
      name: "NoLpTokensInPool";
      msg: "No LP tokens in pool's LP token account";
    },
    {
      code: 6009;
      name: "NotEnoughLpTokens";
      msg: "Not enough LP tokens to provide liquidity to proposal";
    },
    {
      code: 6010;
      name: "InsufficientFunds";
      msg: "Insufficient funds";
    },
    {
      code: 6011;
      name: "NoActiveProposal";
      msg: "No active proposal";
    },
    {
      code: 6012;
      name: "ProposalNotInDraftStatus";
      msg: "Proposal is not in draft status";
    },
    {
      code: 6013;
      name: "ProposalAlreadyActive";
      msg: "Proposal already active";
    },
    {
      code: 6014;
      name: "AmmAlreadyHasLiquidity";
      msg: "AMM already has liquidity";
    },
    {
      code: 6015;
      name: "QuestionAlreadyResolved";
      msg: "Question already resolved";
    }
  ];
};

export const IDL: SharedLiquidityManager = {
  version: "0.1.0",
  name: "shared_liquidity_manager",
  docs: ["TODO:", "- add unstake", "- add unit tests"],
  instructions: [],
  errors: [
    {
      code: 6000,
      name: "InsufficientStake",
      msg: "Insufficient stake amount",
    },
    {
      code: 6001,
      name: "ProposalNotFinalized",
      msg: "Proposal is not finalized",
    },
    {
      code: 6002,
      name: "NoLpTokensToRemove",
      msg: "No LP tokens to remove from AMM",
    },
    {
      code: 6003,
      name: "NoTokensFromAmm",
      msg: "No tokens received from AMM removal",
    },
    {
      code: 6004,
      name: "InsufficientReservesReturned",
      msg: "Insufficient reserves returned to spot AMM (less than 99.5%)",
    },
    {
      code: 6005,
      name: "PoolInUse",
      msg: "Pool is currently being used by an active proposal",
    },
    {
      code: 6006,
      name: "InsufficientLpShares",
      msg: "User does not have enough LP shares to withdraw",
    },
    {
      code: 6007,
      name: "SlippageExceeded",
      msg: "Slippage exceeded minimum token amounts",
    },
    {
      code: 6008,
      name: "NoLpTokensInPool",
      msg: "No LP tokens in pool's LP token account",
    },
    {
      code: 6009,
      name: "NotEnoughLpTokens",
      msg: "Not enough LP tokens to provide liquidity to proposal",
    },
    {
      code: 6010,
      name: "InsufficientFunds",
      msg: "Insufficient funds",
    },
    {
      code: 6011,
      name: "NoActiveProposal",
      msg: "No active proposal",
    },
    {
      code: 6012,
      name: "ProposalNotInDraftStatus",
      msg: "Proposal is not in draft status",
    },
    {
      code: 6013,
      name: "ProposalAlreadyActive",
      msg: "Proposal already active",
    },
    {
      code: 6014,
      name: "AmmAlreadyHasLiquidity",
      msg: "AMM already has liquidity",
    },
    {
      code: 6015,
      name: "QuestionAlreadyResolved",
      msg: "Question already resolved",
    },
  ],
};
