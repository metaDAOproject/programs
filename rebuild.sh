# rebuild.sh
#!/bin/bash
set -e
anchor build
cd sdk
yarn install
yarn build-local
cd ..
yarn install --force
yarn lint:fix
echo "✅ rebuild complete"