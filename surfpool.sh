# Load environment variables from .env file
set -a
source .env
set +a

# Start surfpool with deploy-local-programs runbook
surfpool start -r deploy-local-programs