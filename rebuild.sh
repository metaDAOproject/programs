# rebuild.sh
#!/bin/bash
set -e
anchor build
cd sdk
yarn install
yarn build-local
cd ..
cd sdk2
yarn install
yarn build-local
cd ..
yarn install --force
yarn lint:fix
echo "✅ SDK types synced successfully"