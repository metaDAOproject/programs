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
