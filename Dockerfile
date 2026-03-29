# Stage 1: Selector Stage
# This stage runs on the build host architecture (BUILDPLATFORM) 
# to select the correct pre-compiled binary.
FROM --platform=$BUILDPLATFORM busybox AS selector
ARG TARGETARCH=amd64

# Copy both binaries into the selector stage. 
# paths as provided: target/x86_64... for amd64, target/release... for arm64
COPY target/x86_64-unknown-linux-gnu/release/zhengming /zhengming-amd64
COPY target/release/zhengming /zhengming-arm64

# Move the correct binary to a common path based on the target architecture
RUN if [ "${TARGETARCH}" = "amd64" ]; then \
    mv /zhengming-amd64 /zhengming; \
    else \
    mv /zhengming-arm64 /zhengming; \
    fi

# Stage 2: Final Run Stage
FROM debian:bookworm-slim

# Install CA certificates for HTTPS requests if needed by reqwest
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the selected binary from the selector stage
COPY --from=selector /zhengming /app/zhengming
RUN chmod +x /app/zhengming

# Copy the public directory for static assets
COPY public ./public

# Copy the private directory for authenticated admin assets
COPY private ./private

# Create directory for tantivy index
RUN mkdir -p /data

# Set environment variables
ENV TANTIVY_PATH=/data/debate_index
ENV RUST_LOG=info

# Expose the port the app runs on
EXPOSE 3000

# Run the application
CMD ["./zhengming"]
