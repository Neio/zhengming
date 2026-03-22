#!/bin/bash
set -e

# ZhengMing Local CI Script

echo "--- 🛠️  Starting Local CI for ZhengMing ---"

# 1. Format Check
echo "--- 🎨 Checking code formatting ---"
cargo fmt --all -- --check

# 2. Linting
echo "--- 🔍 Running Clippy (Linter) ---"
cargo clippy -- -D warnings

# 3. Unit & Integration Tests
echo "--- 🧪 Running tests ---"
cargo test

# 4. Build Verification
echo "--- 🏗️  Building in release mode ---"
cargo build --release

# 5. Docker Build (Optional but recommended for Full CICD)
echo "--- 🐳 Building Docker image ---"
docker build -t zhengming:local .

echo "--- ✅ Local CI/CD completed successfully! ---"
