# Builder stage
FROM rust:1.94-bookworm AS builder

WORKDIR /usr/src/app

# Copy the source code
COPY . .

# Build the application
RUN cargo build --release

# Run stage
FROM debian:bookworm-slim

# Install CA certificates for HTTPS requests if needed by reqwest
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the compiled binary from the builder environment
COPY --from=builder /usr/src/app/target/release/zhengming .

# Copy the public directory for static assets
COPY --from=builder /usr/src/app/public ./public

# Create directory for tantivy index
RUN mkdir -p /data

# Set environment variables
ENV TANTIVY_PATH=/data/debate_index
ENV RUST_LOG=info

# Expose the port the app runs on
EXPOSE 3000

# Run the application
CMD ["./zhengming"]
