#!/bin/sh

# Default values
PROGRAM=""
NO_BUILD=false
NO_SDK_BUILD=false
NO_LOGS=false
WATCH=true

# Parse command line arguments
while [ $# -gt 0 ]; do
    case "$1" in
        -p|--program)
            PROGRAM="$2"
            shift 2
            ;;
        --skip-build)
            NO_BUILD=true
            shift
            ;;
        --no-sdk-build)
            NO_SDK_BUILD=true
            shift
            ;;
        --no-logs)
            NO_LOGS=true
            shift
            ;;
        --no-watch)
            WATCH=false
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -p, --program <name>     Build specific program (e.g., autocrat, amm, conditional_vault)"
            echo "  --skip-build             Skip program building"
            echo "  --no-sdk-build           Skip SDK building"
            echo "  --no-logs                Suppress logs (add RUST_LOG=)"
            echo "  --no-watch               Run once instead of watching for changes"
            echo "  -h, --help               Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Build all programs, SDK, and test with logs"
            echo "  $0 -p autocrat                        # Build only autocrat program and test"
            echo "  $0 --skip-build                       # Skip building, just test"
            echo "  $0 --no-logs                          # Test without logs"
            echo "  $0 -p amm --no-sdk-build --no-logs    # Build amm, skip SDK, no logs"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Build the command components
BUILD_CMD=""
SDK_CMD=""
TEST_CMD="anchor test --skip-build"
LOG_PREFIX=""

# Add program-specific build if specified
if [ -n "$PROGRAM" ]; then
    BUILD_CMD="anchor build -p $PROGRAM"
else
    BUILD_CMD="anchor build"
fi

# Add SDK build if not skipped
if [ "$NO_SDK_BUILD" = false ]; then
    SDK_CMD="(cd sdk && yarn build) &&"
fi

# Add log suppression if requested
if [ "$NO_LOGS" = true ]; then
    LOG_PREFIX="RUST_LOG= "
fi

# Construct the final command
if [ "$NO_BUILD" = true ]; then
    # Skip program building
    FINAL_CMD="$SDK_CMD $LOG_PREFIX$TEST_CMD"
else
    # Include program building
    FINAL_CMD="$BUILD_CMD && $SDK_CMD $LOG_PREFIX$TEST_CMD"
fi

# Determine what to watch based on what we're building
if [ "$WATCH" = true ]; then
    if [ "$NO_BUILD" = true ]; then
        # Only watch tests and SDK if not building programs
        WATCH_PATHS="tests sdk"
    else
        # Watch everything
        WATCH_PATHS="programs tests sdk"
    fi
    
    echo "Watching for changes in: $WATCH_PATHS"
    echo "Command: $FINAL_CMD"
    echo ""
    find $WATCH_PATHS | entr -sc "$FINAL_CMD"
else
    echo "Running command: $FINAL_CMD"
    echo ""
    eval "$FINAL_CMD"
fi 