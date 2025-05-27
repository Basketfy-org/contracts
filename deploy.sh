#!/bin/bash

# Basketfy Devnet Deployment Script
echo "🚀 Basketfy Devnet Deployment"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if required tools are installed
check_dependencies() {
    print_info "Checking dependencies..."
    
    if ! command -v solana &> /dev/null; then
        print_error "Solana CLI not found. Please install from https://docs.solana.com/cli/install-solana-cli-tools"
        exit 1
    fi
    
    if ! command -v anchor &> /dev/null; then
        print_error "Anchor CLI not found. Please install from https://www.anchor-lang.com/docs/installation"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Please install Node.js"
        exit 1
    fi
    
    if ! command -v yarn &> /dev/null && ! command -v npm &> /dev/null; then
        print_error "Neither yarn nor npm found. Please install a package manager"
        exit 1
    fi
    
    print_status "All dependencies found"
}

# Setup Solana configuration
setup_solana() {
    print_info "Setting up Solana configuration..."
    
    # Set cluster to devnet
    solana config set --url devnet
    print_status "Cluster set to devnet"
    
    # Check wallet
    if ! solana address &> /dev/null; then
        print_warning "No wallet found. Generating new keypair..."
        solana-keygen new --no-bip39-passphrase
    fi
    
    WALLET_ADDRESS=$(solana address)
    print_info "Using wallet: $WALLET_ADDRESS"
    
    # Check balance
    BALANCE=$(solana balance --url devnet | cut -d' ' -f1)
    print_info "Current balance: $BALANCE SOL"
    
    # Request airdrop if balance is low
    if (( $(echo "$BALANCE < 2" | bc -l) )); then
        print_warning "Low balance detected. Requesting airdrop..."
        solana airdrop 2 --url devnet
        sleep 5
        NEW_BALANCE=$(solana balance --url devnet | cut -d' ' -f1)
        print_status "New balance: $NEW_BALANCE SOL"
    fi
}

# Install dependencies
install_dependencies() {
    print_info "Installing dependencies..."
    
    if command -v yarn &> /dev/null; then
        yarn install
    else
        npm install
    fi
    
    print_status "Dependencies installed"
}

# Build the program
build_program() {
    print_info "Building Anchor program..."
    
    # Clean build
    anchor clean
    
    # Build program
    if anchor build; then
        print_status "Program built successfully"
    else
        print_error "Program build failed"
        exit 1
    fi
}

# Deploy to devnet
deploy_program() {
    print_info "Deploying program to devnet..."
    
    if anchor deploy --provider.cluster devnet; then
        print_status "Program deployed successfully"
        
        # Get program ID
        PROGRAM_ID=$(solana address -k target/deploy/basketfy-keypair.json)
        print_info "Program ID: $PROGRAM_ID"
        
        # Update Anchor.toml and lib.rs with program ID if needed
        print_info "Make sure your program ID in Anchor.toml matches: $PROGRAM_ID"
        
    else
        print_error "Program deployment failed"
        exit 1
    fi
}

# Run the TypeScript deployment script
run_deployment_script() {
    print_info "Running basket creation script..."
    
    # Compile TypeScript if needed
    if [ -f "tsconfig.json" ]; then
        if command -v tsc &> /dev/null; then
            tsc scripts/deploy-devnet.ts --outDir scripts/dist --module commonjs --target es2020 --esModuleInterop --allowSyntheticDefaultImports --skipLibCheck
        fi
    fi
    
    # Run the script
    if command -v ts-node &> /dev/null; then
        ts-node scripts/deploy-devnet.ts
    else
        node scripts/dist/deploy-devnet.js
    fi
    
    print_status "Deployment script completed"
}

# Main execution
main() {
    print_info "Starting Basketfy deployment process..."
    
    # Check if we're in the right directory
    if [ ! -f "Anchor.toml" ]; then
        print_error "Anchor.toml not found. Please run this script from your Anchor project root"
        exit 1
    fi
    
    # Run all steps
    check_dependencies
    setup_solana
    install_dependencies
    build_program
    deploy_program
    run_deployment_script
    
    print_status "🎉 Deployment completed successfully!"
    
    echo ""
    echo "📋 Summary:"
    echo "   • Program deployed to devnet"
    echo "   • Factory initialized"
    echo "   • Sample baskets created"
    echo "   • Ready for testing!"
    echo ""
    echo "🔗 Next steps:"
    echo "   1. Test your baskets using the Solana Explorer (devnet)"
    echo "   2. Implement minting/redeeming functionality"
    echo "   3. Build a frontend interface"
    echo ""
    echo "🌐 Useful links:"
    echo "   • Solana Explorer (devnet): https://explorer.solana.com/?cluster=devnet"
    echo "   • Your wallet: $(solana address)"
}

# Error handling
set -e
trap 'print_error "Script failed at line $LINENO"' ERR

# Run main function
main "$@"