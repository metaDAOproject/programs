# rebuild.sh
#!/bin/bash
set -e
anchor build
cd sdk
yarn build-local
cd ..
cd sdk2
yarn install --force
yarn build-local
cd ..
yarn lint:fix
echo "✅ SDK types synced successfully"