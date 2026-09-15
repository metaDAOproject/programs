# Scripts

A collection of scripts to interact with various parts of the futarchy protocol

## Setup

The scripts import `@metadaoproject/programs` from the root `node_modules`, where it is a symlink to `sdk/`, so they always run against your local SDK build. No linking is needed. From the root of the repository:

```sh
./rebuild.sh
```

This builds the programs, installs and builds the SDK, and installs the root dependencies. See [Development Setup](../README.md#development-setup) in the main README for toolchain prerequisites. If the programs are already built and you only changed SDK code, `cd sdk && yarn build-local` is enough.

## Launchpad

In the root directory of this repo, you will find a `.env.example` file with settings for launches. Move into `.env`, change everything, and then simply hold enter throughout the script. If you don't, you can always enter everything manually.

To initialize a launch, run:
```sh
yarn launch-init
```

To start a launch, run:
```sh
yarn launch-start
```

To complete a launch, run:
```sh
yarn launch-complete
```

## Futarchy AMM Setup

To set up a complete futarchy AMM with tokens, DAO, and liquidity, run:
```sh
yarn setup-futarchy-amm
```

This script will:
1. Create META and USDC token mints
2. Mint initial tokens to your wallet
3. Initialize a DAO with the tokens
4. Create a futarchy AMM
5. Provide initial liquidity to the AMM

The script outputs all the important addresses (tokens, DAO, AMM, position) for future reference.
