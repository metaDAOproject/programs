use trident_fuzz::fuzzing::*;

use super::constants::*;

/// Standalone token helper functions that work with Trident directly
pub fn initialize_mint(
    trident: &mut Trident,
    payer: Pubkey,
    mint: Pubkey,
    decimals: u8,
    owner: Pubkey,
    freeze_authority: Option<&Pubkey>,
    message: Option<&str>,
) {
    let ix = trident.initialize_mint(&payer, &mint, decimals, &owner, freeze_authority);
    let res = trident.process_transaction(&ix, message);
    invariant!(res.is_success());
}

pub fn initialize_associated_token_account(
    trident: &mut Trident,
    payer: Pubkey,
    mint: Pubkey,
    owner: Pubkey,
) -> Pubkey {
    let ata = trident.get_associated_token_address(&mint, &owner, &TOKEN_PROGRAM_ID);

    match trident.get_token_account(ata) {
        Ok(_) => {
            // account already exists -- skip
        }
        Err(_) => {
            let ix = trident.initialize_associated_token_account(&payer, &mint, &owner);
            let res = trident.process_transaction(&[ix], None);

            invariant!(res.is_success());
        }
    }

    ata
}

pub fn mint_to(
    trident: &mut Trident,
    token_account_address: Pubkey,
    mint_address: Pubkey,
    mint_authority: Pubkey,
    amount: u64,
) {
    let mint = trident.mint_to(
        &token_account_address,
        &mint_address,
        &mint_authority,
        amount,
    );

    let res = trident.process_transaction(&[mint], None);

    invariant!(res.is_success());
}

pub fn get_or_initialize_associated_token_account(
    trident: &mut Trident,
    payer: Pubkey,
    mint: Pubkey,
    owner: Pubkey,
) -> Pubkey {
    let ata = trident.get_associated_token_address(&mint, &owner, &TOKEN_PROGRAM_ID);

    if trident.get_token_account(ata).is_err() {
        let ix = trident.initialize_associated_token_account(&payer, &mint, &owner);
        let res = trident.process_transaction(&[ix], None);
        invariant!(res.is_success());
    }

    ata
}
