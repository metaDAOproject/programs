/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL was converted from the legacy format with `anchor idl convert` and lives in
 * the `.json` file next to this one.
 */
export type SharedLiquidityManager = {
  address: "EoJc1PYxZbnCjszampLcwJGYcB5Md47jM4oSQacRtD4d";
  metadata: {
    name: "sharedLiquidityManager";
    version: "0.1.0";
    spec: "0.1.0";
  };
  docs: ["TODO:", "- add unstake", "- add unit tests"];
  instructions: [];
  errors: [
    {
      code: 6000;
      name: "insufficientStake";
      msg: "Insufficient stake amount";
    },
    {
      code: 6001;
      name: "proposalNotFinalized";
      msg: "Proposal is not finalized";
    },
    {
      code: 6002;
      name: "noLpTokensToRemove";
      msg: "No LP tokens to remove from AMM";
    },
    {
      code: 6003;
      name: "noTokensFromAmm";
      msg: "No tokens received from AMM removal";
    },
    {
      code: 6004;
      name: "insufficientReservesReturned";
      msg: "Insufficient reserves returned to spot AMM (less than 99.5%)";
    },
    {
      code: 6005;
      name: "poolInUse";
      msg: "Pool is currently being used by an active proposal";
    },
    {
      code: 6006;
      name: "insufficientLpShares";
      msg: "User does not have enough LP shares to withdraw";
    },
    {
      code: 6007;
      name: "slippageExceeded";
      msg: "Slippage exceeded minimum token amounts";
    },
    {
      code: 6008;
      name: "noLpTokensInPool";
      msg: "No LP tokens in pool's LP token account";
    },
    {
      code: 6009;
      name: "notEnoughLpTokens";
      msg: "Not enough LP tokens to provide liquidity to proposal";
    },
    {
      code: 6010;
      name: "insufficientFunds";
      msg: "Insufficient funds";
    },
    {
      code: 6011;
      name: "noActiveProposal";
      msg: "No active proposal";
    },
    {
      code: 6012;
      name: "proposalNotInDraftStatus";
      msg: "Proposal is not in draft status";
    },
    {
      code: 6013;
      name: "proposalAlreadyActive";
      msg: "Proposal already active";
    },
    {
      code: 6014;
      name: "ammAlreadyHasLiquidity";
      msg: "AMM already has liquidity";
    },
    {
      code: 6015;
      name: "questionAlreadyResolved";
      msg: "Question already resolved";
    },
  ];
};
