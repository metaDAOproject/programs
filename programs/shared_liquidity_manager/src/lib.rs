//! Enables LPs to provide liquidity that is by default stored in a Raydium
//! constant-product pool, but that can be rented for the purpose of decision
//! markets.
use anchor_lang::prelude::*;

declare_id!("EoJc1PYxZbnCjszampLcwJGYcB5Md47jM4oSQacRtD4d");

mod state;
mod instructions;

use state::SharedLiquidityPool;
use instructions::*;

// TODO:
// - provide_liquidity
// - remove_my_liquidity
// - initialize_proposal_with_liquidity
// - remove_proposal_liquidity

// use anchor_lang::solana_program::custom_heap_default;

// #[cfg(target_os = "solana")]
// use {
//     solana_program::entrypoint::{HEAP_START_ADDRESS},
//     std::{alloc::Layout, mem::size_of, ptr::null_mut, usize},
// };

/// Developers can implement their own heap by defining their own
/// `#[global_allocator]`.  The following implements a dummy for test purposes
/// but can be flushed out with whatever the developer sees fit.
// #[cfg(target_os = "solana")]
// struct BumpAllocator;
// #[cfg(target_os = "solana")]
// unsafe impl std::alloc::GlobalAlloc for BumpAllocator {
//     #[inline]
//     unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
//         const POS_PTR: *mut usize = HEAP_START_ADDRESS as usize as *mut usize;
//         const TOP_ADDRESS: usize = HEAP_START_ADDRESS as usize + 1024 * 128;
//         const BOTTOM_ADDRESS: usize = HEAP_START_ADDRESS as usize + size_of::<*mut u8>();

//         let mut pos = *POS_PTR;
//         if pos == 0 {
//             // First time, set starting position
//             pos = TOP_ADDRESS;
//         }
//         pos = pos.saturating_sub(layout.size());
//         pos &= !(layout.align().saturating_sub(1));
//         if pos < BOTTOM_ADDRESS {
//             return null_mut();
//         }
//         *POS_PTR = pos;
//         pos as *mut u8
//     }
//     #[inline]
//     unsafe fn dealloc(&self, _: *mut u8, _: Layout) {
//         // I'm a bump allocator, I don't free
//     }
// }

// custom_heap_default!();

// #[cfg(target_os = "solana")]
// #[global_allocator]
// static A: BumpAllocator = BumpAllocator;


#[program]
pub mod shared_liquidity_manager {
    use super::*;

    pub fn initialize_pool(ctx: Context<InitializePool>) -> Result<()> {
        InitializePool::handle(ctx)
    }

    pub fn deposit(ctx: Context<Deposit>, args: DepositArgs) -> Result<()> {
        Deposit::handle(ctx, args)
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        Withdraw::handle(ctx)
    }

    pub fn initialize_proposal_with_liquidity(ctx: Context<InitializeProposalWithLiquidity>) -> Result<()> {
        InitializeProposalWithLiquidity::handle(ctx)
    }

    pub fn remove_proposal_liquidity(ctx: Context<RemoveProposalLiquidity>) -> Result<()> {
        RemoveProposalLiquidity::handle(ctx)
    }
}
