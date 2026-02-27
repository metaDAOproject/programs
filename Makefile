.PHONY: build-performance-package-v2 build-mint-governor build-bid-wall build-v06-launchpad build-futarchy build-price-based-performance-package build-v07-launchpad build-damm-v2-cpi build-conditional-vault build-all

# Build individual programs
build-bid-wall:
	cargo build-sbf --manifest-path programs/bid_wall/Cargo.toml --arch v2

build-futarchy:
	cargo build-sbf --manifest-path programs/futarchy/Cargo.toml --arch v2

build-price-based-performance-package:
	cargo build-sbf --manifest-path programs/price_based_performance_package/Cargo.toml --arch v2

build-v07-launchpad:
	cargo build-sbf --manifest-path programs/v07_launchpad/Cargo.toml --arch v2

build-conditional-vault:
	cargo build-sbf --manifest-path programs/conditional_vault/Cargo.toml --arch v2

# Build all programs
build-all: build-bid-wall build-futarchy build-price-based-performance-package build-v07-launchpad build-conditional-vault

