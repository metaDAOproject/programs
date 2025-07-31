use anchor_lang::prelude::*;
use dashu_int::{IBig, ops::{SquareRoot}};

#[allow(non_snake_case)]
pub fn min_d_dashu(a: u64, b: u64, c: u64, e: u64, f: u64, k1: u128, k2: u128, k3: u128) -> Option<(u64, i64, i64)> {
    let a = &(IBig::from(a) * IBig::from(10_u128.pow(18)));
    let b = &(IBig::from(b) * IBig::from(10_u128.pow(18)));
    let c = &(IBig::from(c) * IBig::from(10_u128.pow(18)));
    let e = &(IBig::from(e) * IBig::from(10_u128.pow(18)));
    let f = &(IBig::from(f) * IBig::from(10_u128.pow(18)));

    let k1 = &(IBig::from(k1) * IBig::from(10_u128.pow(18)) * IBig::from(10_u128.pow(18)));
    let k2 = &(IBig::from(k2) * IBig::from(10_u128.pow(18)) * IBig::from(10_u128.pow(18)));
    let k3 = &(IBig::from(k3) * IBig::from(10_u128.pow(18)) * IBig::from(10_u128.pow(18)));
    
    let mut d12 = None; let mut x12 = None; let mut y12 = None;
    let mut d23 = None; let mut x23 = None; let mut y23 = None;
    let mut d13 = None; let mut x13 = None; let mut y13 = None;

    // Constraint 1:
    // (a - x)(b - y) = k1
    // b - y = k1 / (a - x)
    // y = b - k1 / (a - x)
    let y1 = |x: &IBig| b - (k1 / (a - x));

    // Constraint 3:
    // (e + x)(f + y) = k3
    // f + y = k3 / (e + x)
    // y = k3 / (e + x) - f
    let y3 = |x: &IBig| (k3 / (e + x)) - f;

    // --- Case 1: (1)&(2) tight ---
    // y from (1): y=y1(x);
    // then solve (c+x)(d+y)=k2 → d(x)=k2/(c+x)-y1(x)
    // minimize via tangency of f1,f2 → sqrt(k1)/(a-x)=sqrt(k2)/(c+x)
    {
        // Solve for x: sqrt(k1)*(c+x)=sqrt(k2)*(a-x)
        let x = &((a * k2.sqrt() - c * k1.sqrt()) / (k1.sqrt() + k2.sqrt()));

        if x > &-c && x < a && x > &-e {
            let y = &y1(&x);

            // ensure constraint3 slack: y >= y3(x)
            if y >= &y3(&x) {
                let d_val = k2 / (c + x) - y;
                d12 = Some(d_val); x12 = Some(x); y12 = Some(y);
            }
        }
    }

    // --- Case 2: (2)&(3) tight ---
    // y from (3): y=y3(x);
    // (c+x)(d+y)=k2 → d(x)=k2/(c+x)-y3(x)
    // tangency f2,f3 → sqrt(k2)/(c+x)=sqrt(k3)/(e+x)
    {
        let x = &((c * k3.sqrt() - e * k2.sqrt()) / (k2.sqrt() + k3.sqrt()));
        // msg!("x: {}, k2.sqrt(): {}, k1.sqrt(): {}, (a * k2.sqrt()) = {}, (c * k1.sqrt()) = {}, (a * k2.sqrt()) - (c * k1.sqrt()) = {}, a = {a}, c = {c}", x, k2.sqrt(), k1.sqrt(), a * k2.sqrt(), c * k1.sqrt(), (a * k2.sqrt()) - (c * k1.sqrt()));
        if x > &-e && x > &-c && x < a {
            let y = &y3(&x);
            // msg!("y: {}, y1(x): {}, y3(x): {}, d_val: {}", y, y1(x), y3(x), k2 / (c + x) - y);
            // ensure constraint1 slack: y <= b - k1/(a-x)
            if y <= &y1(&x) {
                let d_val = k2 / (c + x) - y;
                d23 = Some(d_val); x23 = Some(x.clone()); y23 = Some(y.clone());
            }
        }
    }

    // --- Case 3: (1)&(3) tight ---
    // Constraints tight:
    //   (1) (a - x)(b - y) = k1  ⇒  y = b - k1/(a-x)
    //   (3) (e + x)(f + y) = k3  ⇒  y = k3/(e+x) - f_
    // Set equal: b - k1/(a-x) = k3/(e+x) - f_
    // Multiply both sides by (a-x)(e+x):
    //   (b - f_)*(a-x)*(e+x) = (k3)*(a-x) + (k1)*(e+x)
    // Expand LHS: (b-f_)*(ae + a x - e x - x^2)
    // Bring RHS terms over to form quadratic in x:
    //   (b-f_)*(-x^2) + (b-f_)*(a - e)*x + (b-f_)*a e - k3*(a-x) - k1*(e+x) = 0
    // Combine like terms to Ax^2 + Bx + C = 0:
    let A = &(b + f);
    let B = &((k1 - k3) - (b + f)*(a - e));
    let C = &(k1*e + k3*a - (b + f)*a*e);
    // let A = &(-(&b + &f)); // bounds: up to u64::MAX * 2
    // let B = &((&b + &f)*(&a - &e) + &k3 - &k1); 
    // let C = &((&b + &f)*&a*&e - &k3*&a - &k1*&e); // up to u197::MAX + u128::MAX + u128::MAX;


    // let C = (b + f_).checked_mul(e).unwrap().checked_sub(k3).unwrap().checked_mul(a).unwrap() - k1*e; // up to u197::MAX + u128::MAX + u128::MAX;
    // msg!("k3*a: {}", k3*a);
    // Now solve A x^2 + B x + C = 0
    let mut test = |x: &IBig| {
        if x > &-c && x > &-e && x < a {
            let y = &y1(&x);
            let d_val = k2 / (c + x) - y;    // from constraint 2
            // ensure slack on 2: (c+x)(d+y)>=k2 ⇒ no extra check as computed x from tight 1&3
            d13 = Some(d_val); x13 = Some(x.clone()); y13 = Some(y.clone());
        }
    };
    if A == &IBig::ZERO {
        // If A is 0, then either:
        // 1) B is non-zero and this is a linear equation (Bx + C = 0 <=> x = -C/B)
        if B != &IBig::ZERO { test(&(-C / B)); }
        // 2) B is 0 and C is non-zero, then this is infeasible (C = 0) and there's no intersection,
        //    we should rely on the other constraints
        // 3) B is 0 and C is 0, which only happens if the curves are identical, in which case we can
        //    still rely on the other constraints
    } else {
        // let b_tick = &(B / A);
        // let c_tick = &(C / A);

        // let disc = b_tick * b_tick - &IBig::from(4) * c_tick;
        // msg!("disc: {}", disc);
        // // TODO: this can easily overflow. if we only need to check if discriminator is positive, maybe we
        // //       can compute from B, A, and C sign? no, because we'd need to compare A*C, which we can't do.
        // if disc >= IBig::ZERO {
        //     let rt = &disc.sqrt();
        //     test((-b_tick - rt) / IBig::from(2));
        //     test((-b_tick + rt) / IBig::from(2));
        // }
        let disc = B * B - IBig::from(4) * A * C;
        if disc >= IBig::ZERO {
        // if (A > 0 && (B * B) / A >= I110F18::from_num(4.0) * C) || (A < 0 && (B * B) / A <= I110F18::from_num(4.0) * C) {
            let rt = &disc.sqrt();
            test(&((-B - rt) / (IBig::from(2) * A)));
            test(&((-B + rt) / (IBig::from(2) * A)));
        }
    }

    msg!("d13: {:?}, d12: {:?}, d23: {:?}", d13, d12, d23);

    let scaled_d13 = d13.unwrap() / IBig::from(10_u128.pow(18));
    let scaled_x13 = x13.unwrap() / IBig::from(10_u128.pow(18));
    let scaled_y13 = y13.unwrap() / IBig::from(10_u128.pow(18));

    Some((scaled_d13.try_into().unwrap(), scaled_x13.try_into().unwrap(), scaled_y13.try_into().unwrap()))
}

#[allow(non_snake_case)]
pub fn min_b1(a1: u64, a2: u64, b2: u64, a3: u64, b3: u64, k1: u128, k2: u128, k3: u128) -> Option<(u64, i64, i64)> {
    let a1 = &(IBig::from(a1) * IBig::from(10_u128.pow(18)));
    let a2 = &(IBig::from(a2) * IBig::from(10_u128.pow(18)));
    let b2 = &(IBig::from(b2) * IBig::from(10_u128.pow(18)));
    let a3 = &(IBig::from(a3) * IBig::from(10_u128.pow(18)));
    let b3 = &(IBig::from(b3) * IBig::from(10_u128.pow(18)));

    let k1 = &(IBig::from(k1) * IBig::from(10_u128.pow(18)) * IBig::from(10_u128.pow(18)));
    let k2 = &(IBig::from(k2) * IBig::from(10_u128.pow(18)) * IBig::from(10_u128.pow(18)));
    let k3 = &(IBig::from(k3) * IBig::from(10_u128.pow(18)) * IBig::from(10_u128.pow(18)));


    // let mut b12 = None; let mut x12 = None; let mut y12 = None;
    // let mut b13 = None; let mut x13 = None; let mut y13 = None;
    // let mut b23 = None; let mut x23 = None; let mut y23 = None;

    // Constraint 1:
    // (a1 - x)(b1 - y) = k1
    // b1 - y = k1 / (a1 - x)
    // y = b1 - k1 / (a1 - x)

    // Constraint 2:
    // (a2 + x)(b2 + y) = k2
    // b2 + y = k2 / (a2 + x)
    // y = k2 / (a2 + x) - b2
    let y2 = |x: &IBig| (k2 / (a2 + x)) - b2;

    // Constraint 3:
    // (a3 + x)(b3 + y) = k3
    // b3 + y = k3 / (a3 + x)
    // y = k3 / (a3 + x) - b3
    let y3 = |x: &IBig| (k3 / (a3 + x)) - b3;

    // Case 1: (1)&(2) tight
    // Set 1 & 2 equal:
    // b1 - k1 / (a1 - x) = k2 / (a2 + x) - b2
    // b1 = k2 / (a2 + x) + k1 / (a1 - x) - b2
    // b1(x) = k2 / (a2 + x) + k1 / (a1 - x) - b2
    //
    // Now we differentiate
    // b1'(x) = d/dx [k2/(a2 + x)] + d/dx [k1/(a1 - x)] + d/dx [-b2]
    //
    // d/dx [k2/(a2 + x)]:
    //   = k2 * d/dx[(a2 + x)^(-1)]
    //   = k2 * (−1) * (a2 + x)^(-2) * 1    ← power rule + chain rule
    //   = − k2 / (a2 + x)^2
    //
    // d/dx [k1/(a1 - x)]:
    //   = k1 * d/dx[(a1 - x)^(-1)]
    //   = k1 * (−1) * (a1 - x)^(-2) * (−1) ← power rule + chain rule (inner derivative of a1-x is -1)
    //   = + k1 / (a1 - x)^2
    //
    // d/dx [−b2] = 0    ← constant term
    //
    // b1'(x) = − k2 / (a2 + x)^2 + k1 / (a1 - x)^2
    //
    // Now we set b1'(x) = 0 to find the minimum:
    // − k2 / (a2 + x)^2 + k1 / (a1 - x)^2 = 0
    // k1 / (a1 - x)^2 = k2 / (a2 + x)^2
    // sqrt(k1) / (a1 - x) = sqrt(k2) / (a2 + x)
    // sqrt(k1) * (a2 + x) = sqrt(k2) * (a1 - x)
    // sqrt(k1) * a2 + sqrt(k1) * x = sqrt(k2) * a1 - sqrt(k2) * x
    // sqrt(k1) * x + sqrt(k2) * x = sqrt(k2) * a1 - sqrt(k1) * a2
    // (sqrt(k1) + sqrt(k2)) * x = sqrt(k2) * a1 - sqrt(k1) * a2
    // x = (sqrt(k2) * a1 - sqrt(k1) * a2) / (sqrt(k1) + sqrt(k2))
    let x_12 = &((k2.sqrt() * a1 - k1.sqrt() * a2) / (k1.sqrt() + k2.sqrt()));

    // Then we check if this x is within the bounds of the constraints:
    // a1 -x > 0 -> x < a1
    // a2 + x > 0 -> x > -a2
    // a3 + x > 0 -> x > -a3
    if x_12 > &-a1 && x_12 > &-a2 && x_12 < a1 {
        // We get the y value from constraint 1:
        let y_12 = &y2(x_12);

        // This is only a valid b1 if it satsifies constraint 3:
        if y_12 >= &y3(x_12) {
            // We want to plug x12 back into b1(x) to get b1_12:
            // b1(x) = k2 / (a2 + x) + k1 / (a1 - x) - b2
            // But remember that y2 = k2 / (a2 + x) - b2, so we can plug that in:
            // b1(x) = y2 + k1 / (a1 - x)
            let b1_12 = y_12 + k1 / (a1 - x_12);
            msg!("b1_12: {:?}, x_12: {:?}, y_12: {:?}", b1_12, x_12, y_12);

            let scaled_b1_12 = b1_12 / IBig::from(10_u128.pow(18));
            let scaled_x_12 = x_12 / IBig::from(10_u128.pow(18));
            let scaled_y_12 = y_12 / IBig::from(10_u128.pow(18));

            return Some((scaled_b1_12.try_into().unwrap(), scaled_x_12.try_into().unwrap(), scaled_y_12.try_into().unwrap()))
        }
    }

        
    // Case 2: (1)&(3) tight
    // Set 1 & 3 equal:
    // b1 - k1 / (a1 - x) = k3 / (a3 + x) - b3
    // b1 = k3 / (a3 + x) + k1 / (a1 - x) - b3
    // b1(x) = k3 / (a3 + x) + k1 / (a1 - x) - b3

    // then solve (c+x)(d+y)=k2 → d(x)=k2/(c+x)-y1(x)
    // minimize via tangency of f1,f2 → sqrt(k1)/(a-x)=sqrt(k2)/(c+x)

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_min_b1() {
        let a1 = 100;
        let b1 = 100;
        let a2 = 100;
        let b2 = 100;
        let a3 = 100;
        let b3 = 100;

        let _ = min_b1(a1 + 1, a2, b2, a3, b3, a1 as u128 * b1 as u128, a2 as u128 * b2 as u128, a3 as u128 * b3 as u128);

                let a1 = 100;
        let b1 = 100;
        let a2 = 100;
        let b2 = 100;
        let a3 = 1000;
        let b3 = 1000;

        let (new_b1, x, y) = min_b1(a1 + 5, a2, b2, a3, b3, a1 as u128 * b1 as u128, a2 as u128 * b2 as u128, a3 as u128 * b3 as u128).unwrap();
        msg!("b1: {}, x: {}, y: {}", new_b1, x, y);
        msg!("left side: {}, right side: {}", ((a1 + 5) as i64 - x) * (new_b1 as i64 - y), (a1 * b1) as i64);

        assert!(((a1 + 5) as i64 - x) * (new_b1 as i64 - y) >= (a1 * b1) as i64);
    }

    #[test]
    fn test_min_d_dashu() {
        let unscaled_a = 100;
        let unscaled_b = 100;
        let unscaled_c = 100;
        let unscaled_d = 100;
        let unscaled_e = 100;
        let unscaled_f = 100;

        let a = unscaled_a * 1_000_000;
        let b = unscaled_b * 1_000_000;
        let c = unscaled_c * 1_000_000;
        let d = unscaled_d * 1_000_000;
        let e = unscaled_e * 1_000_000;
        let f = unscaled_f * 1_000_000;

        let (new_d, x, y) = min_d_dashu(a, b, c + 1_000_000, e, f, a as u128 * b as u128, c as u128 * d as u128, e as u128 * f as u128).unwrap();
        println!("new_d: {}, x: {}, y: {}", new_d, x, y);
    }
}