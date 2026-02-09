# rebuild.sh
#!/bin/bash
set -e
anchor build
cd sdk
yarn build-local
cd ..
yarn install --force
yarn lint:fix
echo "✅ SDK types synced successfully"