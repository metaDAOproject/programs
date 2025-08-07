# Scripts

A collection of scripts to interact with various parts of the futarchy protocol

## Setup

It's best to use these scripts with the latest build of the SDK.

To do this, run the following commands, starting in the root dir of the repository:

```sh
cd sdk # Move into the repository dir

yarn
yarn build
yarn link

cd .. # Move back into the root dir
yarn link @metadaoproject/futarchy # Link to your local build of the futarchy sdk
```

Afterwards, you can run the scripts as you see fit.

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
