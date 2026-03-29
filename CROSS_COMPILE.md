# Cross-Compilation Guide (macOS)

This document explains how to build the ZhengMing project for multiple target architectures (ARM and x86_64) on a macOS host.

## Prerequisites

To cross-compile for Linux (x86_64) on macOS, the recommended tool is `cargo-zigbuild`. It uses the `zig` linker to simplify the process significantly.

### 1. Install Zig and cargo-zigbuild
```bash
brew install zig
cargo install cargo-zigbuild
```

### 2. Add the Target Triple
```bash
rustup target add x86_64-unknown-linux-gnu
```

## Running the Build Script

A script is provided to automate the build process for both ARM (native) and x86_64 (Linux).

```bash
chmod +x scripts/build_all.sh
./scripts/build_all.sh
```

This will produce the following binaries:
-   **ARM (Native Release)**: `target/release/zhengming`
-   **x86_64 (Linux Release)**: `target/x86_64-unknown-linux-gnu/release/zhengming`

## Publishing to Docker

Once the binaries are built, you can use the multi-arch Docker setup to build and push the image to a remote x86 server or Docker Hub:

```bash
chmod +x scripts/publish_docker.sh
./scripts/publish_docker.sh <your-docker-repo>
```

### Why this works?
-   **Client (Mac)**: Cross-compiles both binaries and sends them to the remote Docker server.
-   **Server (Remote x86)**: The `Dockerfile` automatically detects its architecture (`amd64`) and selects the correct x86_64 binary.
-   **Optimized .dockerignore**: Only the required release binaries are sent to the remote host, keeping the build context fast.
