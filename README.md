# Zhengming (Verbatim Parser RS)

A high-performance Rust service for parsing and indexing debate "cards" from Microsoft Word (`.docx`) files into Zinc Search.

## Overview

"Verbatim" is a standard Microsoft Word template used by competitive policy debaters to format evidence. This project extracts structured "cards" from these documents, preserving formatting like highlights, underlines, and meta-data (Hats, Blocks, Pockets, Tags, Cites).

The parsed data is indexed into [Zinc Search](https://zincsearch-docs.netlify.app/), a lightweight alternative to Elasticsearch, making thousands of cards searchable in milliseconds.

## Features

- **Blazing Fast Parsing**: Built in Rust using `docx-rs` and `rayon` for multi-threaded document processing.
- **Bulk Upload**: Support for uploading individual `.docx` files or `.zip` archives containing many documents.
- **Rich Metadata Extraction**: Extracts and indices:
    - **Hierarchy**: Hat, Block, Pocket.
    - **Card Data**: Tag, Cite (with date extraction), Body text.
    - **Formatting**: Highlights, Underlines, and Emphasis (preserved as character offsets).
- **REST API**: Simple endpoints for uploading, querying, and monitoring job progress.
- **Search Interface**: A minimalist, high-performance web frontend for uploading and searching cards.

## Tech Stack

- **Backend**: Rust, Axum, Tokio, Rayon.
- **Search Engine**: Zinc Search.
- **Frontend**: Vanilla HTML/JS/CSS.

## Getting Started

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Zinc Search](https://zincsearch-docs.netlify.app/quickstart/) (running on port 4080 by default)

### Configuration

Create a `.env` file in the root directory:

```env
ZINC_URL=http://localhost:4080
ZINC_USER=admin
ZINC_PASS=admin
INDEX_NAME=debate-cards
```

### Running the Server

1. Start Zinc Search (e.g., via Docker):
   ```bash
   docker-compose up -d
   ```
2. Run the Rust backend:
   ```bash
   cargo run --release
   ```
3. Open `http://localhost:3000` in your browser.

## API Documentation

- `POST /api/upload`: Upload a `.docx` or `.zip` file. Returns a `job_id`.
- `GET /api/progress/:job_id`: Check the status of an upload job.
- `GET /api/query?q=search+term`: Search for cards.
- `GET /api/card/:id`: Retrieve a specific card by its ID.

## Directory Structure

- `src/`: Rust source code.
    - `main.rs`: Axum server and route handlers.
    - `parser.rs`: Core logic for parsing Word documents.
    - `zinc.rs`: Client for interacting with Zinc Search.
    - `card.rs`: Data models for cards.
- `public/`: Frontend assets (HTML, CSS, JS).
- `docker-compose.yml`: Minimal setup for Zinc Search.
