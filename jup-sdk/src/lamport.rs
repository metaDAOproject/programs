use crate::FutarchyAmmError;
use anyhow::anyhow;
use std::ops::{Add, Div, Mul, Sub};

/// A wrapper for lamport values that will bail on
/// any overflows.
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct Lamport(u128);

impl Lamport {
    pub const ZERO: Self = Lamport(0);

    pub const fn new(lamports: u64) -> Self {
        Lamport(lamports as _)
    }

    pub const fn val(self) -> u64 {
        self.0 as _
    }
}

impl Add for Lamport {
    type Output = anyhow::Result<Self>;
    fn add(self, rhs: Self) -> Self::Output {
        self.0
            .checked_add(rhs.0)
            .map(|v| Self(v))
            .ok_or(anyhow!(FutarchyAmmError::MathOverflow))
    }
}

impl Sub for Lamport {
    type Output = anyhow::Result<Self>;
    fn sub(self, rhs: Self) -> Self::Output {
        self.0
            .checked_sub(rhs.0)
            .map(|v| Self(v))
            .ok_or(anyhow!(FutarchyAmmError::MathOverflow))
    }
}

impl Div for Lamport {
    type Output = anyhow::Result<Self>;
    fn div(self, rhs: Self) -> Self::Output {
        self.0
            .checked_div(rhs.0)
            .map(|v| Self(v))
            .ok_or(anyhow!(FutarchyAmmError::MathOverflow))
    }
}

impl Mul for Lamport {
    type Output = anyhow::Result<Self>;
    fn mul(self, rhs: Self) -> Self::Output {
        self.0
            .checked_mul(rhs.0)
            .map(|v| Self(v))
            .ok_or(anyhow!(FutarchyAmmError::MathOverflow))
    }
}

impl Div<anyhow::Result<Self>> for Lamport {
    type Output = anyhow::Result<Self>;
    fn div(self, rhs: anyhow::Result<Self>) -> Self::Output {
        rhs.and_then(|rhs| {
            self.0
                .checked_div(rhs.0)
                .map(|v| Self(v))
                .ok_or(anyhow!(FutarchyAmmError::MathOverflow))
        })
    }
}

impl Mul<anyhow::Result<Self>> for Lamport {
    type Output = anyhow::Result<Self>;
    fn mul(self, rhs: anyhow::Result<Self>) -> Self::Output {
        rhs.and_then(|rhs| {
            self.0
                .checked_mul(rhs.0)
                .map(|v| Self(v))
                .ok_or(anyhow!(FutarchyAmmError::MathOverflow))
        })
    }
}

impl Div<Lamport> for anyhow::Result<Lamport> {
    type Output = Self;
    fn div(self, rhs: Lamport) -> Self::Output {
        self.and_then(|v| v / rhs)
    }
}

impl Add<Lamport> for anyhow::Result<Lamport> {
    type Output = Self;
    fn add(self, rhs: Lamport) -> Self::Output {
        self.and_then(|v| v + rhs)
    }
}

pub trait ToLamport {
    fn lamports(self) -> Lamport;
}

impl ToLamport for u64 {
    fn lamports(self) -> Lamport {
        Lamport::new(self)
    }
}

impl ToLamport for u16 {
    fn lamports(self) -> Lamport {
        Lamport::new(self as _)
    }
}
