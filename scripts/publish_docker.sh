#!/bin/bash
set -e

# ZhengMing Docker Deployment Script
# Usage: ./scripts/publish_docker.sh <docker_username>

if [ -z "$1" ]; then
  echo "❌ Error: Docker Hub username/repo is required."
  echo "Usage: $0 <username/repo> (e.g., neio/zhengming)"
  exit 1
fi

REPO_NAME=$1
VERSION=$(grep '^version =' Cargo.toml | head -n 1 | cut -d '"' -f 2)

echo "--- 🚀 Preparing Docker Build for $REPO_NAME:$VERSION ---"

# Check for buildx
if ! docker buildx ls > /dev/null 2>&1; then
  echo "❌ Error: docker buildx is not available."
  exit 1
fi

# Build and Push multi-platform image
echo "--- 🐳 Building and Pushing multi-platform image (linux/amd64, linux/arm64) ---"
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t "$REPO_NAME:$VERSION" \
  -t "$REPO_NAME:latest" \
  --push .

echo "--- ✅ Deployment successful! ---"
echo "Image: $REPO_NAME:$VERSION"
echo "Image: $REPO_NAME:latest"
