# ZhengMing (争鸣): A Debate Search Engine

A high-performance Rust service for parsing, indexing, and searching massive debate datasets. Originally built to extract "cards" from Microsoft Word (`.docx`) Verbatim files, it now supports native, high-speed CSV parsing for massive datasets like the `OpenCaseList-Deduplicated`.

## Overview

ZhengMing (meaning "contention of a hundred schools of thought") extracts structured "cards" from debate documents and datasets. 

It is completely self-contained, powered by [Tantivy](https://github.com/quickwit-oss/tantivy) (a fast, Rust-native search library inspired by Apache Lucene). This eliminates the need for external full-text search services and Docker containers, making setup incredibly simple and search blazing fast.

## Features

- **Embedded Search**: Zero external dependencies. Uses Tantivy to provide sub-millisecond search latency.
- **Massive Scale**: Optimized to securely upload and ingest 10GB+ datasets without memory crashes using streaming chunk reads and background batch processing.
- **Richer Metadata Extraction**: Parses exhaustive metadata including `Tournament`, `Round`, `Judge`, `School`, `Team`, `Event`, and `Level`, deduplicating evidence on ingestion to keep the index clean.
- **Formatting Preservation**: Preserves original visual aesthetics to recreate the "Debate Card" feel.
    - Extracts `Bold`, `Underline`, and `Highlight` styles directly from `.docx` files.
    - Honors embedded HTML tags (`<strong>`, `<mark>`, `<u>`) from `CSV markup`.
- **Database Insights**: A dedicated standalone dashboard at `/stats.html` offering real-time analytics on index size, pending ingestion tasks, and deep aggregations (by Tournament, School, Event, Year).
- **REST API**: Simple, robust endpoints for uploading, querying, and checking stats.

## Tech Stack

- **Backend / Search**: Rust, Axum, Tokio, Rayon, Tantivy.
- **Parsers**: `docx-rs` for Verbatim processing, `csv` for massive datasets.
- **Frontend**: Vanilla HTML/JS/CSS for optimal performance.

## Getting Started

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (latest stable)

### Configuration

Create a `.env` file in the root directory (optional). Default settings will use a `debate_index` folder in the project root:

```env
TANTIVY_PATH=debate_index
```

### Running the Server

1. Run the Rust backend (this automatically builds the search index folder):
   ```bash
   cargo run --release
   ```
2. Open `http://localhost:3000` in your browser.

## API Documentation

- `POST /api/upload`: Upload a `.docx`, `.zip`, or `.csv` file.
- `GET /api/progress/:job_id`: Check the status of background upload/indexing jobs.
- `GET /api/query?q=search+term`: Full-text search across cards and metadata.
- `GET /api/stats`: Retrieve index aggregations, total cards, and pending ingestion count.

## Directory Structure

- `src/`: Rust backend
    - `main.rs`: Axum server API and background job state.
    - `index.rs`: Tantivy embedded schema and search query logic.
    - `parser.rs`: Microsoft Word (`.docx`) extraction.
    - `csv_parser.rs`: Massive dataset CSV extraction.
    - `card.rs`: Core database struct representation.
- `public/`: High-performance Vanilla frontend assets.
