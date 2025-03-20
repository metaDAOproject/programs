# Verifying Builds

If you're on the MetaDAO security council, you will need to verify builds before
allowing the program to be upgraded. Here's how to do it:

1. Open up `futarchy` on GitHub.com
2. Navigate to the 'Actions' tab
3. Click on the 'generate-verifiable-builds' workflow
4. Click on the latest commit
5. Click on the relevant program
6. Open up the `anchor-verifiable-build` step
7. Verify that the action name is `metadaoproject/anchor-verifiable-build@v0.2`
8. Scroll down to the bottom of the step, you should see a hash right below "Program Solana version: vx.y.z"
9. Open up app.squads.so
10. Click on the program upgrade transaction, you should be able to see the buffer account from either simulating
    the transaction or looking at the transaction details
11. Now open up a terminal and run the following command: `solana-verify get-buffer-hash ${BUFFER_ACCT}` where
    `${BUFFER_ACCT}` is the buffer account from step 10
12. Compare the hash from step 11 with the hash from step 8, if they match, you can approve the upgrade

