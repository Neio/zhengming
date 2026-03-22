use crate::card::Card;
use csv::ReaderBuilder;
use std::io::Read;
use std::error::Error;
use sha2::{Sha256, Digest};

pub struct OpenCaselistParser<R: Read> {
    reader: csv::Reader<R>,
}

impl<R: Read> OpenCaselistParser<R> {
    pub fn new(read: R) -> Self {
        let reader = ReaderBuilder::new()
            .flexible(true)
            .has_headers(true)
            .from_reader(read);
        Self { reader }
    }

    pub fn parse_records(mut self) -> impl Iterator<Item = Result<Card, Box<dyn Error>>> {
        let headers = self.reader.headers().unwrap().clone();
        
        self.reader.into_records().map(move |result| {
            let record = result?;
            let mut card = Card::new_empty();

            let mut plain_body = None;
            let mut markup_body = None;

            for (i, header) in headers.iter().enumerate() {
                let val = record.get(i).unwrap_or("").trim().to_string();
                if val.is_empty() { continue; }

                match header.to_lowercase().as_str() {
                    "tag" | "title" => card.tag = val,
                    "cite" | "citation" | "citation details" => card.cite = val,
                    "fullcite" => card.fullcite = val,
                    "summary" => card.summary = val,
                    "body" | "text" | "content" | "fulltext" => plain_body = Some(val),
                    "markup" => markup_body = Some(val),
                    "author" => card.author = val,
                    "source" => card.source = val,
                    "round" | "debate round" => card.round = val,
                    "year" | "date" => card.year = val,
                    "hat" => card.hat = val,
                    "pocket" => card.pocket = val,
                    "block" => card.block = val,
                    "tournament" => card.tournament = val,
                    "opponent" => card.opponent = val,
                    "judge" => card.judge = val,
                    "teamname" | "team" => card.team = val,
                    "schoolname" | "school" => card.school = val,
                    "event" => card.event = val,
                    "level" => card.level = val,
                    "id" => card.id = val,
                    _ => {}
                }
            }

            if let Some(markup) = markup_body {
                card.body = vec![markup];
            } else if let Some(plain) = plain_body {
                card.body = vec![plain];
            }

            if card.id.is_empty() {
                let mut hasher = Sha256::new();
                hasher.update(format!("{}{}{}", card.tag, card.cite, card.body.join("")).as_bytes());
                card.id = format!("{:x}", hasher.finalize());
            }

            Ok(card)
        })
    }
}
