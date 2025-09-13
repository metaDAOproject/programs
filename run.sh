#!/bin/sh

build() {
    find programs | entr -sc 'anchor build'
}

test() {
    find programs tests sdk | entr -sc 'anchor build && (cd sdk && yarn build) && RUST_LOG= anchor test --skip-build'
}

test_logs() {
    find programs tests sdk | entr -sc 'anchor build && (cd sdk && yarn build) && anchor test --skip-build'
}

build_vault() {
    find programs | entr -sc 'anchor build -p conditional_vault'
}

build_launchpad() {
    find programs | entr -sc 'anchor build -p launchpad'
}

build_shared_liquidity_manager() {
    find programs | entr -sc 'anchor build -p shared_liquidity_manager'
}

test_shared_liquidity_manager_logs() {
    find programs tests sdk | entr -sc 'anchor build -p shared_liquidity_manager && (cd sdk && yarn build) && anchor test --skip-build'
}

test_vault() {
    # anchor doesn't let you past test files, so we do this weird thing where we
    # modify the Anchor.toml and then put it back
    #sed -i '2s/\(\(\S\+\s\+\)\{9\}\)\S\+/\1tests\/conditionalVault.ts"/' Anchor.toml
    #sleep 10 && sed -i '2s/\(\(\S\+\s\+\)\{9\}\)\S\+/\1tests\/*.ts"/' Anchor.toml &
    # find programs tests sdk | entr -sc \
	#     "anchor build -p conditional_vault && (cd sdk && yarn build) && sed -i '2s/\(\(\S\+\s\+\)\{10\}\)\S\+/\1tests\/conditionalVault\/*.ts\"/' Anchor.toml && (sleep 3 && sed -i '2s/\(\(\S\+\s\+\)\{10\}\)\S\+/\1tests\/\**\/*.ts\"/' Anchor.toml) & RUST_LOG= anchor test --skip-build"
    find programs tests sdk | entr -sc 'anchor build -p conditional_vault && (cd sdk && yarn build) && RUST_LOG= anchor test --skip-build'
}

test_no_build() {
    find programs tests sdk | entr -sc '(cd sdk && yarn build) && RUST_LOG= anchor test --skip-build'
}

test_logs_no_build() {
    find programs tests sdk | entr -sc '(cd sdk && yarn build) && anchor test --skip-build'
}

# ./test.sh build_verifiable autocrat
build_verifiable() {
    PROGRAM_NAME=$1
    solana-verify build --library-name "$PROGRAM_NAME" -b ellipsislabs/solana:1.16.10
}

deploy() {
    PROGRAM_NAME=$1
    CLUSTER=$2
    solana program deploy --use-rpc -u "$CLUSTER" --program-id ./target/deploy/"$PROGRAM_NAME"-keypair.json ./target/deploy/"$PROGRAM_NAME".so --with-compute-unit-price 5 --max-sign-attempts 15 && PROGRAM_ID=$(solana-keygen pubkey ./target/deploy/"$PROGRAM_NAME"-keypair.json) && anchor idl init --filepath ./target/idl/"$PROGRAM_NAME".json $PROGRAM_ID --provider.cluster "$CLUSTER"
}

deploy_verifiable() {
    PROGRAM_NAME=$1
    CLUSTER=$2
    FEATURES=$3
    solana program deploy --use-rpc -u "$CLUSTER" --program-id ./target/deploy/"$PROGRAM_NAME"-keypair.json ./verifiable-builds/"$PROGRAM_NAME".so --with-compute-unit-price 5 --max-sign-attempts 15 && 
    PROGRAM_ID=$(solana-keygen pubkey ./target/deploy/"$PROGRAM_NAME"-keypair.json) && 
    anchor idl init --filepath ./target/idl/"$PROGRAM_NAME".json $PROGRAM_ID --provider.cluster "$CLUSTER" &&
    solana-verify verify-from-repo --remote -u "$CLUSTER" --program-id $PROGRAM_ID https://github.com/metaDAOproject/programs --library-name $PROGRAM_NAME -b ellipsislabs/solana:1.17.16 -y -- --features $FEATURES
}

verify() {
    PROGRAM_NAME=$1
    PROGRAM_ID=$2
    CLUSTER=$3
    FEATURES=$4
    solana-verify verify-from-repo --remote -u "$CLUSTER" --program-id $PROGRAM_ID https://github.com/metaDAOproject/programs --library-name $PROGRAM_NAME -b ellipsislabs/solana:1.17.16 -y -- --features $FEATURES
}

assign_to_multisig() {
    PROGRAM_ID=$1
    CLUSTER=$2
    solana program set-upgrade-authority -u "$CLUSTER" $PROGRAM_ID --new-upgrade-authority 6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf --skip-new-upgrade-authority-signer-check
}

write_buffer_verifiable() {
    PROGRAM_NAME=$1
    CLUSTER=$2
    solana program write-buffer --use-rpc -u "$CLUSTER" ./verifiable-builds/"$PROGRAM_NAME".so --with-compute-unit-price 5 --max-sign-attempts 15
}

export_verifiable() {
    PROGRAM_NAME=$1
    PROGRAM_ID=$2
    FEATURES=$3
    solana-verify export-pda-tx https://github.com/metaDAOproject/futarchy --program-id "$PROGRAM_ID" --uploader 6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf -b ellipsislabs/solana:1.17.16 --library-name "$PROGRAM_NAME" -- --features $FEATURES
}

verify_local() {
    PROGRAM_NAME=$1
    PROGRAM_ID=$2
    FEATURES=$3
    solana-verify verify-from-repo --remote -um --program-id $PROGRAM_ID https://github.com/metaDAOproject/futarchy --library-name $PROGRAM_NAME -b ellipsislabs/solana:1.17.16 -- --features $FEATURES
}

# verify() {
#     PROGRAM_ID=$1
#     solana-verify remote submit-job --program-id "$PROGRAM_ID" --uploader 6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf
# }

upgrade() {
    PROGRAM_NAME=$1
    PROGRAM_ID=$2
    CLUSTER=$3
    anchor upgrade ./target/deploy/"$PROGRAM_NAME".so -p "$PROGRAM_ID" --provider.cluster "$CLUSTER"
}

upgrade_idl() {
    PROGRAM_NAME=$1
    PROGRAM_ID=$2
    CLUSTER=$3
    anchor idl upgrade --filepath ./target/idl/"$PROGRAM_NAME".json "$PROGRAM_ID" --provider.cluster "$CLUSTER"
}

# this is for if our program isn't big enough, must be in solana 1.18.x
show_size_diff() {
    PROGRAM_NAME=$1
    PROGRAM_ID=$2
    CLUSTER=$3
    IS_VERIFIABLE=$4

    EXISTING_SIZE=$(solana program show "$PROGRAM_ID" -u "$CLUSTER" | awk '/Data Length:/ {print $3}')

    if [ "$IS_VERIFIABLE" = "true" ]; then
        NEW_SIZE=$(wc -c < ./verifiable-builds/"$PROGRAM_NAME".so)
    else
        NEW_SIZE=$(wc -c < ./target/deploy/"$PROGRAM_NAME".so)
    fi

    echo "Existing size: $EXISTING_SIZE bytes"
    echo "New size: $NEW_SIZE bytes"

    DIFF=$((NEW_SIZE - EXISTING_SIZE))
    echo "Size difference: $DIFF bytes"

    if [ "$NEW_SIZE" -gt "$EXISTING_SIZE" ]; then
        echo "New program is larger than existing one. You may need to run: solana program extend $PROGRAM_ID $DIFF -u \"$CLUSTER\""
    fi
}

bankrun() {
    (find programs && find tests) | entr -csr 'anchor build -p autocrat && RUST_LOG= yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/autocrat.ts'
}

test_amm() {
    find programs tests | entr -csr 'anchor build -p amm && RUST_LOG= yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/amm.ts'
}

test_amm_logs() {
    find programs tests | entr -csr 'anchor build -p amm && yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/amm.ts'
}


bankrun_migrator() {
    (find programs && find tests) | entr -csr 'anchor build -p autocrat_migrator && RUST_LOG= yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/migrator.ts'
}

bankrun_timelock() {
    find programs tests sdk | entr -cs '(cd sdk && yarn build) && anchor build -p optimistic_timelock && RUST_LOG= yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/timelock.ts'
}

bankrun_vault_logs() {
    find programs tests sdk | entr -cs '(cd sdk && yarn build) && anchor build -p optimistic_timelock && RUST_LOG= yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/timelock.ts'
}

bankrun_logs() {
    (find programs && find tests) | entr -csr 'anchor build -p autocrat && yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/autocrat.ts'
}

case "$1" in
    build) build ;;
    build_launchpad) build_launchpad ;;
    test) test ;;
    test_logs) test_logs ;;
    test_logs_no_build) test_logs_no_build ;;
    vault) test_vault ;;
    build_vault) build_vault ;;
    build_shared_liquidity_manager) build_shared_liquidity_manager ;;
    test_shared_liquidity_manager_logs) test_shared_liquidity_manager_logs ;;
    test_no_build) test_no_build ;;
    build_verifiable) build_verifiable "$2" ;;
    deploy) deploy "$2" "$3" ;;
    deploy_verifiable) deploy_verifiable "$2" "$3" ;;
    write_buffer_verifiable) write_buffer_verifiable "$2" "$3" ;;
    export_verifiable) export_verifiable "$2" "$3" "$4" ;;
    verify_local) verify_local "$2" "$3" "$4" ;;
    verify) verify "$2" "$3" "$4" "$5" ;;
    assign_to_multisig) assign_to_multisig "$2" "$3" ;;
    upgrade) upgrade "$2" "$3" "$4" ;;
    upgrade_idl) upgrade_idl "$2" "$3" "$4" ;;
    bankrun) bankrun ;;
    test_amm) test_amm ;;
    test_amm_logs) test_amm_logs ;;
    bankrun_vault) bankrun_vault ;;
    bankrun_migrator) bankrun_migrator ;;
    bankrun_timelock) bankrun_timelock ;;
    bankrun_vault_logs) bankrun_vault_logs ;;
    bankrun_logs) bankrun_logs ;;
    show_size_diff) show_size_diff "$2" "$3" "$4" "$5" ;;
    *) echo "Unknown command: $1" ;;
esac
