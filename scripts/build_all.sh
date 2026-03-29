#!/bin/bash
set -e

# ZhengMing Cross-Compilation Build Script
# This script builds for both native ARM (Mac) and x86_64 (Linux) targets.

echo "--- 🛠️ Starting Multi-Arch Build for ZhengMing ---"

# 1. Native Build (usually ARM on Mac)
echo "--- 🍏 Building Native (ARM) Release ---"
cargo build --release
echo "✅ Native build completed: target/release/zhengming"

# 2. x86_64 Cross-Compilation
echo "--- 🖥️ Building x86_64 (Linux) Release ---"

TARGET="x86_64-unknown-linux-gnu"

# Recommendation: Use cargo-zigbuild for easy cross-compilation on Mac
if command -v cargo-zigbuild > /dev/null 2>&1; then
    echo "Using cargo-zigbuild..."
    cargo zigbuild --release --target "$TARGET"
elif command -v cross > /dev/null 2>&1; then
    echo "Using cross..."
    cross build --release --target "$TARGET"
else
    echo "⚠️ Warning: Neither 'cargo-zigbuild' nor 'cross' found."
    echo "Attempting standard cargo build (this requires x86_64-linux-gnu linkers installed)..."
    cargo build --release --target "$TARGET"
fi

echo "✅ x86_64 build completed: target/$TARGET/release/zhengming"

echo "--- 🎉 All builds completed successfully! ---"
echo "You can now run: ./scripts/publish_docker.sh <username/repo>"
