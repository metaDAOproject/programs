"""Classic SPL mint/ATA setup and independent packed-account readers."""

from __future__ import annotations

from wake_sol import Account, Instruction, Pubkey, signer, svm, writable

from ..constants import MINT_ACCOUNT_SIZE, TOKEN_ACCOUNT_SIZE, TOKEN_DECIMALS


def create_mint(payer: Account, mint: Account, authority: Account) -> None:
    """Create a classic SPL mint controlled by a signer account."""
    payer.tx(
        svm.system.create_account(
            svm.minimum_balance_for_rent_exemption(MINT_ACCOUNT_SIZE),
            MINT_ACCOUNT_SIZE,
            svm.token.program_id,
            from_=payer,
            to=mint,
        )
    )
    payer.tx(
        svm.token.initialize_mint2(
            TOKEN_DECIMALS,
            authority,
            mint=mint,
        )
    )


def create_ata(
    payer: Account, owner: Account | Pubkey, mint: Account
) -> Account:
    """Create and return the canonical ATA for an account or off-curve PDA."""
    address = Account(svm.token.ata_address(owner, mint))
    if not address.exists:
        payer.tx(svm.token.create_ata(payer, owner, mint))
    return address


def mint_to(
    payer: Account,
    mint: Account,
    destination: Account,
    authority: Account,
    amount: int,
) -> None:
    """Mint an exact native-unit amount to an initialized token account."""
    payer.tx(
        svm.token.mint_to_checked(
            amount,
            TOKEN_DECIMALS,
            mint=mint,
            account=destination,
            authority=authority,
        )
    )


def set_mint_authority(
    payer: Account,
    mint: Account,
    current_authority: Account,
    new_authority: Account | Pubkey | None,
) -> None:
    """Transfer or burn the classic SPL mint authority."""
    option = bytes([0])
    authority_bytes = bytes(32)
    if new_authority is not None:
        option = bytes([1])
        authority_key = (
            new_authority.pubkey
            if isinstance(new_authority, Account)
            else new_authority
        )
        authority_bytes = bytes(authority_key)
    instruction = Instruction(
        svm.token.program_id,
        [writable(mint), signer(current_authority)],
        bytes([6, 0]) + option + authority_bytes,
    )
    payer.tx(instruction)


def mint_supply(mint: Account) -> int:
    """Read a classic SPL Mint supply independently from its packed bytes."""
    data = mint.data
    assert len(data) == MINT_ACCOUNT_SIZE
    return int.from_bytes(data[36:44], "little")


def token_account_fields(token_account: Account) -> tuple[Pubkey, Pubkey, int]:
    """Read mint, owner, and amount from a classic SPL Token account."""
    data = token_account.data
    assert len(data) == TOKEN_ACCOUNT_SIZE
    return (
        Pubkey(data[0:32]),
        Pubkey(data[32:64]),
        int.from_bytes(data[64:72], "little"),
    )


def token_balance(token_account: Account) -> int:
    """Read only the native-unit balance of a classic SPL token account."""
    return token_account_fields(token_account)[2]
