use crate::card::Card;
use tantivy::collector::TopDocs;
use tantivy::query::{QueryParser, AllQuery};
use tantivy::schema::*;
use tantivy::{Index, IndexReader, IndexWriter, ReloadPolicy, TantivyDocument};
use tantivy::aggregation::AggregationCollector;
use tantivy::aggregation::agg_req::Aggregations;
use std::path::Path;
use std::fs;
use std::error::Error;

pub struct TantivyIndex {
    index: Index,
    reader: IndexReader,
    schema: Schema,
    index_path: String,
}

impl TantivyIndex {
    pub fn new(index_path: &str) -> Result<Self, Box<dyn Error>> {
        let path = Path::new(index_path);
        if !path.exists() {
            fs::create_dir_all(path)?;
        }

        let mut schema_builder = Schema::builder();
        
        schema_builder.add_text_field("id", STRING | STORED);
        schema_builder.add_text_field("tag", TEXT | STORED);
        schema_builder.add_text_field("tag_sub", TEXT | STORED);
        schema_builder.add_text_field("pocket", TEXT | STORED);
        schema_builder.add_text_field("block", TEXT | STORED);
        schema_builder.add_text_field("hat", TEXT | STORED);
        schema_builder.add_text_field("cite", TEXT | STORED);
        schema_builder.add_text_field("highlighted_text", TEXT | STORED);
        schema_builder.add_text_field("body", TEXT | STORED);
        schema_builder.add_text_field("filename", TEXT | STORED);
        schema_builder.add_text_field("author", TEXT | STORED);
        schema_builder.add_text_field("source", TEXT | STORED);
        schema_builder.add_text_field("round", STRING | STORED | FAST);
        schema_builder.add_text_field("year", STRING | STORED | FAST);
        schema_builder.add_text_field("cite_date", TEXT | STORED);
        // Deduplicated Dataset Metadata
        schema_builder.add_text_field("fullcite", TEXT | STORED);
        schema_builder.add_text_field("summary", TEXT | STORED);
        schema_builder.add_text_field("tournament", STRING | STORED | FAST);
        schema_builder.add_text_field("opponent", STRING | STORED | FAST);
        schema_builder.add_text_field("judge", STRING | STORED | FAST);
        schema_builder.add_text_field("team", STRING | STORED | FAST);
        schema_builder.add_text_field("school", STRING | STORED | FAST);
        schema_builder.add_text_field("event", STRING | STORED | FAST);
        schema_builder.add_text_field("level", STRING | STORED | FAST);
        schema_builder.add_text_field("full_json", STORED);

        let schema = schema_builder.build();

        let index = if path.join("meta.json").exists() {
            Index::open_in_dir(path)?
        } else {
            Index::create_in_dir(path, schema.clone())?
        };

        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()?;

        Ok(Self { index, reader, schema, index_path: index_path.to_string() })
    }

    pub fn add_cards(&self, cards: &[Card]) -> Result<(), Box<dyn Error>> {
        let mut index_writer: IndexWriter = self.index.writer(50_000_000)?;
        self.add_cards_internal(&mut index_writer, cards)?;
        index_writer.commit()?;
        Ok(())
    }

    pub fn create_writer(&self, heap_size: usize) -> Result<IndexWriter, Box<dyn Error>> {
        Ok(self.index.writer(heap_size)?)
    }

    pub fn add_cards_to_writer(&self, index_writer: &mut IndexWriter, cards: &[Card]) -> Result<(), Box<dyn Error>> {
        self.add_cards_internal(index_writer, cards)
    }

    fn add_cards_internal(&self, index_writer: &mut IndexWriter, cards: &[Card]) -> Result<(), Box<dyn Error>> {
        for card in cards {
            let mut doc = TantivyDocument::default();
            
            let id_field = self.schema.get_field("id")?;
            let tag_field = self.schema.get_field("tag")?;
            let tag_sub_field = self.schema.get_field("tag_sub")?;
            let pocket_field = self.schema.get_field("pocket")?;
            let block_field = self.schema.get_field("block")?;
            let hat_field = self.schema.get_field("hat")?;
            let cite_field = self.schema.get_field("cite")?;
            let highlighted_text_field = self.schema.get_field("highlighted_text")?;
            let body_field = self.schema.get_field("body")?;
            let filename_field = self.schema.get_field("filename")?;
            let author_field = self.schema.get_field("author")?;
            let source_field = self.schema.get_field("source")?;
            let round_field = self.schema.get_field("round")?;
            let year_field = self.schema.get_field("year")?;
            let cite_date_field = self.schema.get_field("cite_date")?;
            let fullcite_field = self.schema.get_field("fullcite")?;
            let summary_field = self.schema.get_field("summary")?;
            let tournament_field = self.schema.get_field("tournament")?;
            let opponent_field = self.schema.get_field("opponent")?;
            let judge_field = self.schema.get_field("judge")?;
            let team_field = self.schema.get_field("team")?;
            let school_field = self.schema.get_field("school")?;
            let event_field = self.schema.get_field("event")?;
            let level_field = self.schema.get_field("level")?;
            let full_json_field = self.schema.get_field("full_json")?;
  
            doc.add_text(id_field, &card.id);
            doc.add_text(tag_field, &card.tag);
            doc.add_text(tag_sub_field, &card.tag_sub);
            doc.add_text(pocket_field, &card.pocket);
            doc.add_text(block_field, &card.block);
            doc.add_text(hat_field, &card.hat);
            doc.add_text(cite_field, &card.cite);
            doc.add_text(highlighted_text_field, &card.highlighted_text);
            doc.add_text(body_field, &card.body.join("\n"));
            doc.add_text(filename_field, &card.filename);
            doc.add_text(author_field, &card.author);
            doc.add_text(source_field, &card.source);
            doc.add_text(round_field, &card.round);
            doc.add_text(year_field, &card.year);
            if let Some(date) = &card.cite_date {
                doc.add_text(cite_date_field, date);
            }
            doc.add_text(fullcite_field, &card.fullcite);
            doc.add_text(summary_field, &card.summary);
            doc.add_text(tournament_field, &card.tournament);
            doc.add_text(opponent_field, &card.opponent);
            doc.add_text(judge_field, &card.judge);
            doc.add_text(team_field, &card.team);
            doc.add_text(school_field, &card.school);
            doc.add_text(event_field, &card.event);
            doc.add_text(level_field, &card.level);
            
            let json = serde_json::to_string(card)?;
            doc.add_text(full_json_field, &json);

            // Deduplication: Delete any existing document with this ID
            let id_term = tantivy::Term::from_field_text(id_field, &card.id);
            index_writer.delete_term(id_term);
            
            index_writer.add_document(doc)?;
        }
        Ok(())
    }

    pub fn search(&self, q: &str, limit: usize) -> Result<Vec<serde_json::Value>, Box<dyn Error>> {
        let searcher = self.reader.searcher();
        
        let tag_field = self.schema.get_field("tag")?;
        let highlighted_text_field = self.schema.get_field("highlighted_text")?;
        let cite_field = self.schema.get_field("cite")?;
        let body_field = self.schema.get_field("body")?;
        let author_field = self.schema.get_field("author")?;

        let query_parser = QueryParser::for_index(&self.index, vec![
            tag_field, highlighted_text_field, cite_field, body_field, author_field
        ]);
        
        let query = query_parser.parse_query(q)?;
        let top_docs = searcher.search(&query, &TopDocs::with_limit(limit))?;

        let mut results = Vec::new();
        for (_score, doc_address) in top_docs {
            let retrieved_doc: TantivyDocument = searcher.doc(doc_address)?;
            let full_json_field = self.schema.get_field("full_json")?;
            if let Some(owned_value) = retrieved_doc.get_first(full_json_field) {
                if let Some(json_str) = owned_value.as_str() {
                    let card: serde_json::Value = serde_json::from_str(json_str)?;
                    results.push(card);
                }
            }
        }

        Ok(results)
    }

    pub fn get_card(&self, id: &str) -> Result<Option<serde_json::Value>, Box<dyn Error>> {
        let searcher = self.reader.searcher();
        let id_field = self.schema.get_field("id")?;
        let query_parser = QueryParser::for_index(&self.index, vec![id_field]);
        let query = query_parser.parse_query(&format!("id:\"{}\"", id))?;
        
        let top_docs = searcher.search(&query, &TopDocs::with_limit(1))?;
        if let Some((_score, doc_address)) = top_docs.first() {
            let retrieved_doc: TantivyDocument = searcher.doc(*doc_address)?;
            let full_json_field = self.schema.get_field("full_json")?;
            if let Some(owned_value) = retrieved_doc.get_first(full_json_field) {
                if let Some(json_str) = owned_value.as_str() {
                    let card: serde_json::Value = serde_json::from_str(json_str)?;
                    return Ok(Some(card));
                }
            }
        }
        Ok(None)
    }

    pub fn get_stats(&self) -> Result<serde_json::Value, Box<dyn Error>> {
        let searcher = self.reader.searcher();
        let num_docs = searcher.num_docs();
        
        let mut total_size = 0;
        if let Ok(entries) = std::fs::read_dir(&self.index_path) {
            for entry in entries.flatten() {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_file() {
                        total_size += metadata.len();
                    }
                }
            }
        }

        // Detailed Insights: Aggregations for Round and Year
        let agg_req: Aggregations = serde_json::from_value(serde_json::json!({
            "rounds": {
                "terms": { "field": "round", "size": 10 }
            },
            "years": {
                "terms": { "field": "year", "size": 10 }
            },
            "tournaments": {
                "terms": { "field": "tournament", "size": 10 }
            },
            "schools": {
                "terms": { "field": "school", "size": 10 }
            },
            "events": {
                "terms": { "field": "event", "size": 10 }
            }
        }))?;

        let collector = AggregationCollector::from_aggs(agg_req, tantivy::aggregation::AggregationLimits::default());
        let agg_res = searcher.search(&AllQuery, &collector)?;

        Ok(serde_json::json!({
            "num_docs": num_docs,
            "index_size_bytes": total_size,
            "insights": agg_res
        }))
    }
}
