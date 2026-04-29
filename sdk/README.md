# @metadaoproject/programs

TypeScript SDK for the [MetaDAO Futarchy Protocol](https://github.com/metaDAOproject/programs) — a suite of Solana programs for market-driven governance, conditional markets, and token launches.

## Installation

```bash
yarn add @metadaoproject/programs
# or
npm install @metadaoproject/programs
# or
bun add @metadaoproject/programs
```

## Layout

The SDK is organized by program. Each program lives in its own module and is internally split into versioned subpaths (`v0.3`, `v0.4`, ...). The top-level module re-exports the **latest** version.

```
@metadaoproject/programs
├── amm                          (re-exports v0.5)
├── autocrat                     (re-exports v0.5)
├── bid_wall                     (re-exports v0.7)
├── conditional_vault            (re-exports v0.4)
├── futarchy                     (re-exports v0.6)
├── launchpad                    (re-exports v0.7, also exposes v0.6 events)
├── liquidation                  (re-exports v0.7)
├── mint_governor                (re-exports v0.7)
├── performance_package_v2       (re-exports v0.7)
├── price_based_performance_package  (re-exports v0.6)
└── shared_liquidity_manager     (re-exports v0.5)
```

Each versioned subpath exports:

- A `Client` class (e.g. `FutarchyClient`, `LaunchpadClient`, `ConditionalVaultClient`) — the main entry point for building instructions and fetching accounts.
- PDA derivation helpers (`getDaoAddr`, `getProposalAddr`, `getLaunchAddr`, ...).
- Generated Anchor types (accounts, args, IDL).

The package root also exports shared utilities: program IDs and constants (`MAINNET_USDC`, `SQUADS_PROGRAM_ID`, ...), top-level PDA helpers (`getEventAuthorityAddr`, `getMetadataAddr`), and price math (`AmmMath`).

## Usage

### Default (latest version) imports

```ts
import {
  FutarchyClient,
  LaunchpadClient,
  MAINNET_USDC,
} from "@metadaoproject/programs";
```

### Per-program imports

```ts
import { FutarchyClient } from "@metadaoproject/programs/futarchy";
import { LaunchpadClient } from "@metadaoproject/programs/launchpad";
```

### Pinning to a specific version

```ts
import { FutarchyClient } from "@metadaoproject/programs/futarchy/v0.6";
import { ConditionalVaultClient } from "@metadaoproject/programs/conditional_vault/v0.4";
```

### Creating a client

All clients follow the same construction pattern via a static `createClient` factory and accept an Anchor `AnchorProvider`. Program IDs default to mainnet; pass overrides for devnet or local testing.

```ts
import { AnchorProvider } from "@coral-xyz/anchor";
import { FutarchyClient } from "@metadaoproject/programs/futarchy";

const provider = AnchorProvider.env();
const futarchy = FutarchyClient.createClient({ provider });

const dao = await futarchy.fetchDao(daoAddress);
```

## Versioning

Programs are versioned independently (e.g. futarchy is at v0.6 while launchpad is at v0.7). Older versions remain available under their versioned subpaths so historical accounts can still be read and integrations can migrate at their own pace. New code should use the default (latest) imports.

See [the main repo README](https://github.com/metaDAOproject/programs/blob/develop/README.md) for the on-chain program IDs deployed to mainnet.

## License

BSL-1.0