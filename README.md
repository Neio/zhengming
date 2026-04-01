# ZhengMing (争鸣): A Debate Search Engine

**Live Website**: [zhengming.neio.pub](https://zhengming.neio.pub/)

A high-performance Rust service for parsing, indexing, and searching massive debate datasets. Originally built to extract "cards" from Microsoft Word (`.docx`) Verbatim files, it now supports native, high-speed CSV parsing for massive datasets like the `OpenCaseList-Deduplicated`.

## Overview

ZhengMing (meaning "contention of a hundred schools of thought") extracts structured "cards" from debate documents and datasets. 

It is completely self-contained, powered by [Tantivy](https://github.com/quickwit-oss/tantivy) (a fast, Rust-native search library inspired by Apache Lucene). This eliminates the need for external full-text search services and Docker containers, making setup incredibly simple and search blazing fast.

## Features

- **Embedded Search**: Zero external dependencies. Uses Tantivy to provide sub-millisecond search latency.
- **Admin Dashboard**: A secure, standalone interface at `/admin` for uploading and managing datasets.
- **Selective Index Search**: Optimize search performance by toggling deep content (`body`) indexing on or off.
- **Massive Scale**: Optimized to securely upload and ingest 10GB+ datasets without memory crashes using streaming chunk reads and background batch processing.
- **Richer Metadata Extraction**: Parses exhaustive metadata including `Tournament`, `Round`, `Judge`, `School`, `Team`, `Event`, and `Level`, deduplicating evidence on ingestion to keep the index clean.
- **Formatting Preservation**: Preserves original visual aesthetics to recreate the "Debate Card" feel.
    - Extracts `Bold`, `Underline`, and `Highlight` styles directly from `.docx` files.
    - Honors embedded HTML tags (`<strong>`, `<mark>`, `<u>`) from `CSV markup`.
- **Mobile First UI**: Fully responsive frontend optimized for both desktop and small-screen access.
- **Database Insights**: A public standalone dashboard at `/stats.html` offering real-time analytics on index size, pending ingestion tasks, and deep aggregations.
- **REST API**: Simple, robust endpoints for uploading, querying, and checking stats.

## Tech Stack

- **Backend / Search**: Rust, Axum, Tokio, Rayon, Tantivy.
- **Security**: Argon2/UUID based session management with nonce replay protection.
- **Parsers**: `docx-rs` for Verbatim processing, `csv` for massive datasets.
- **Frontend**: Vanilla HTML/JS/CSS for optimal performance.

## Getting Started

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (latest stable)

### Configuration

Create a `.env` file in the root directory. `TANTIVY_PATH` defines where the search index is stored, and `ADMIN_PASSWORD` is required to access the upload and management tools.

```env
TANTIVY_PATH=debate_index
ADMIN_PASSWORD=your_secure_password
```

### Running the Server

1. Run the Rust backend (this automatically builds the search index folder):
   ```bash
   cargo run --release
   ```
2. Open `http://localhost:3000` in your browser.

### Admin Dashboard

Access the administrative interface at `http://localhost:3000/admin`. 

- **Security**: All management routes are protected by session-based authentication and X-Nonce headers to prevent replay attacks.
- **Uploads**: Supports `.docx` (Verbatim), `.zip` (archived docs), and large `.csv` datasets.
- **Monitoring**: Real-time progress updates for background indexing jobs.

### Running Tests

To run the unit and integration tests:
```bash
cargo test
```
The test suite utilizes the `tempfile` crate to create isolated storage directories for `TantivyIndex` during test execution. This ensures that your actual runtime `debate_index` or `TANTIVY_PATH` environment is never affected or modified by automated tests.

### Local CI/CD

A comprehensive CI/CD script is provided to ensure code quality and build stability:
```bash
bash scripts/ci.sh
```
This script performs:
1. **Format Check**: `cargo fmt`
2. **Linting**: `cargo clippy` (treating warnings as errors)
3. **Tests**: `cargo test`
4. **Build**: `cargo build --release`
5. **Docker**: `docker build -t zhengming:local .`

You can also run the full pipeline using the Antigravity workflow: `/cicd`.

## API Documentation

### Public Endpoints

- `GET /api/query?q=search+term&size=40&body=false`: Full-text search across cards and metadata. 
    - `size`: (Optional) Results per page. Default 40.
    - `body`: (Optional) Toggle searching within the large document body field.
- `GET /api/card/:id`: Retrieve full details and preservation markup for a specific card.
- `GET /api/stats`: Retrieve index aggregations, total cards, and pending ingestion count.

### Admin Endpoints (Requires `admin_session` cookie)

- `POST /api/admin/login`: Exchange `password` for a session cookie.
- `POST /api/admin/logout`: Invalidate the current administrative session.
- `GET /api/admin/ping`: Verify if the current session is still valid.
- `POST /api/upload`: Upload a `.docx`, `.zip`, or `.csv` file. Requires `X-Nonce` header.
- `GET /api/progress/:id`: Check the status of background upload/indexing jobs.

## Directory Structure

- `src/`: Rust backend
    - `main.rs`: Axum server API and background job state.
    - `index.rs`: Tantivy embedded schema and search query logic.
    - `parser.rs`: Microsoft Word (`.docx`) extraction.
    - `csv_parser.rs`: Massive dataset CSV extraction.
    - `card.rs`: Core database struct representation.
- `public/`: High-performance Vanilla frontend assets.
- `private/`: Assets for the authenticated Admin Dashboard.
- `test-docs/`: Sample datasets and `.docx` files for testing.
- `test_storage/`: Isolated Tantivy indices used during automated testing.
