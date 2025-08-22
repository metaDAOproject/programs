# Price-Based Token Lock Program

This Solana program implements a price-based token locking mechanism that allows users to lock tokens until a specific price threshold is met over a time-weighted average period.

## Overview

The program allows users to:
1. Initialize a locker with tokens, a price threshold, and unlock conditions
2. Start the unlocking process when the unlock timestamp is reached
3. Complete the unlock if the TWAP (Time-Weighted Average Price) meets the threshold

## Program Structure

### State

- **Locker**: The main account that holds the locked tokens and configuration
- **LockerState**: Enum representing the current state (Locked, Unlocking, Unlocked)

### Instructions

1. **initialize_locker**: Creates a new locker with the specified parameters
2. **start_unlock**: Begins the unlocking process when the timestamp is reached
3. **complete_unlock**: Finalizes the unlock if the TWAP meets the threshold

## Usage

### Initializing a Locker

```typescript
const params = {
  priceThreshold: new BN(1000), // $10.00 in smallest units (u128)
  tokenAmount: new BN(1000000), // Amount of tokens to lock
  unlockTimestamp: new BN(Date.now() / 1000 + 3600), // 1 hour from now
  oracleAccount: oraclePubkey, // Pyth or other oracle account
  aggregatorByteOffset: 0, // Byte offset for price data in oracle account
  twapLengthSeconds: new BN(300), // 5 minutes TWAP period
  tokenRecipient: recipientPubkey, // Who receives the tokens when unlocked
};

await program.methods.initializeLocker(params)
  .accounts({
    locker,
    tokenMint,
    tokenAccount: userTokenAccount,
    tokenAuthority: user.publicKey,
    lockerAuthority: user.publicKey,
    lockerTokenAccount,
    recipientTokenAccount,
    payer: user.publicKey,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  })
  .signers([user])
  .rpc();
```

### Starting Unlock

```typescript
await program.methods.startUnlock()
  .accounts({
    locker,
    lockerAuthority: user.publicKey,
    oracleAccount,
    clock: SYSVAR_CLOCK_PUBKEY,
  })
  .rpc();
```

### Completing Unlock

```typescript
await program.methods.completeUnlock()
  .accounts({
    locker,
    lockerAuthority: user.publicKey,
    oracleAccount,
    lockerTokenAccount,
    recipientTokenAccount,
    clock: SYSVAR_CLOCK_PUBKEY,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .rpc();
```

## Parameters

- **price_threshold**: The minimum price that must be met for tokens to be unlocked (u128)
- **token_amount**: The amount of tokens to be locked
- **unlock_timestamp**: Unix timestamp when unlocking can begin
- **oracle_account**: Account containing price data (e.g., Pyth oracle)
- **aggregator_byte_offset**: Byte offset in the oracle account where the price aggregator is stored
- **twap_length_seconds**: Duration in seconds for the TWAP calculation
- **token_recipient**: Public key of the account that will receive the unlocked tokens

## TWAP Calculation

The program calculates TWAP as:
```
TWAP = (current_aggregator - start_aggregator) / time_passed
```

Where:
- `current_aggregator`: Current value from the oracle account
- `start_aggregator`: Value when unlocking started
- `time_passed`: Time elapsed since unlocking started

## Security Considerations

1. **Oracle Security**: The program relies on the oracle account for price data. Ensure the oracle is trusted and secure.
2. **Re-initialization**: The `init_if_needed` feature is used for token accounts. Be aware of potential re-initialization attacks.
3. **PDA Authority**: The locker uses a PDA (Program Derived Address) as authority for token transfers.

## Testing

Run the tests with:
```bash
anchor test tests/price_based_token_lock/
```

## Building

Build the program with:
```bash
anchor build --program-name price_based_token_lock
```
