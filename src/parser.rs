use crate::card::Card;
use chrono::NaiveDate;
use docx_rs::*;
use regex::Regex;
use sha2::{Digest, Sha256};

pub struct CardParser {
    filename: String,
    content: Vec<u8>,
}

impl CardParser {
    pub fn new(filename: String, content: Vec<u8>) -> Self {
        Self { filename, content }
    }

    pub fn parse(&self) -> Result<Vec<Card>, Box<dyn std::error::Error + Send + Sync>> {
        let docx = read_docx(&self.content)?;
        let mut cards = Vec::new();
        let mut current_paragraphs = Vec::new();

        let mut current_hat = String::new();
        let mut current_block = String::new();
        let mut current_pocket = String::new();

        for child in docx.document.children {
            if let DocumentChild::Paragraph(p) = child {
                let style = p.property.style.clone().map(|s| s.val).unwrap_or_default();
                let clean_style = style.to_lowercase().replace(" ", "");

                match clean_style.as_str() {
                    "heading1" => current_hat = self.get_text(&p),
                    "heading2" => current_block = self.get_text(&p),
                    "heading3" => current_pocket = self.get_text(&p),
                    "heading4" => {
                        if !current_paragraphs.is_empty() {
                            if let Ok(mut c) = self.create_cards(
                                &current_paragraphs,
                                &current_hat,
                                &current_block,
                                &current_pocket,
                            ) {
                                cards.append(&mut c);
                            }
                        }
                        current_paragraphs = vec![(*p).clone()];
                    }
                    _ => {
                        current_paragraphs.push((*p).clone());
                    }
                }
            }
        }

        if !current_paragraphs.is_empty() {
            if let Ok(mut c) = self.create_cards(
                &current_paragraphs,
                &current_hat,
                &current_block,
                &current_pocket,
            ) {
                cards.append(&mut c);
            }
        }

        Ok(cards)
    }

    fn create_cards(
        &self,
        paragraphs: &[Paragraph],
        hat: &str,
        block: &str,
        pocket: &str,
    ) -> Result<Vec<Card>, String> {
        if paragraphs.is_empty() {
            return Err("No paragraphs".to_string());
        }

        let tag = self
            .get_text(&paragraphs[0])
            .trim_matches(|c| c == ',' || c == ' ')
            .to_string();

        // Find citation and metadata
        let mut tag_sub = String::new();
        let mut cite = String::new();
        let mut body_paragraphs = Vec::new();

        // Refined Cite detection for Verbatim
        for (i, p) in paragraphs.iter().enumerate().skip(1) {
            let style = p.property.style.clone().map(|s| s.val).unwrap_or_default();
            let text = self.get_text(p);

            // Heading 5 or 6 are explicit Cites in many templates
            if style == "Heading5"
                || style == "Heading6"
                || style == "Heading 5"
                || style == "Heading 6"
            {
                cite = text;
                body_paragraphs = paragraphs[i + 1..].to_vec();
                break;
            }

            // Heuristic for "Normal" style cites:
            // Often bolded or contains a date (number) and is the first non-empty paragraph after tag
            if i == 1 && !text.is_empty() && text.chars().any(|c| c.is_numeric()) {
                cite = text;
                body_paragraphs = paragraphs[i + 1..].to_vec();
                break;
            }

            if !text.is_empty() {
                tag_sub.push_str(&text);
                tag_sub.push('\n');
            }
        }

        if body_paragraphs.is_empty() {
            // Fallback if no cite found via heuristic
            body_paragraphs = if paragraphs.len() > 1 {
                paragraphs[1..].to_vec()
            } else {
                Vec::new()
            };
        }

        let mut highlighted_text = String::new();
        let mut highlights = Vec::new();
        let mut underlines = Vec::new();
        let mut bold = Vec::new();
        let mut emphasis = Vec::new();
        let mut body = Vec::new();

        let mut p_index = 0;
        for p in &body_paragraphs {
            let mut j = 0;
            let p_text = self.get_text(p);
            body.push(p_text.clone());

            for child in &p.children {
                if let ParagraphChild::Run(r) = child {
                    let run_text = self.get_run_text(r);
                    if run_text.trim().is_empty() {
                        continue;
                    }

                    if let Some(start) = p_text[j..].find(&run_text) {
                        let start = j + start;
                        let end = start + run_text.len();

                        if r.run_property.highlight.is_some() {
                            highlights.push(vec![p_index, start as i32, end as i32]);
                            highlighted_text.push(' ');
                            highlighted_text.push_str(&run_text);
                        }
                        if r.run_property.underline.is_some() {
                            underlines.push(vec![p_index, start as i32, end as i32]);
                        }
                        if r.run_property.bold.is_some() {
                            bold.push(vec![p_index, start as i32, end as i32]);
                        }
                        // Emphasis is often a style name in the original project
                        if let Some(style) = &r.run_property.style {
                            if style.val == "Emphasis" {
                                emphasis.push(vec![p_index, start as i32, end as i32]);
                            }
                        }

                        j = end;
                    }
                }
            }
            p_index += 1;
        }

        let cite_date = self.extract_date(&cite);

        let mut hasher = Sha256::new();
        hasher.update(format!("{}{}{}", tag, cite, body.join("")).as_bytes());
        let id = format!("{:x}", hasher.finalize());

        Ok(vec![Card {
            id,
            tag,
            tag_sub: tag_sub.trim().to_string(),
            pocket: pocket.to_string(),
            block: block.to_string(),
            hat: hat.to_string(),
            cite,
            highlighted_text: highlighted_text.trim().to_string(),
            body,
            highlights,
            emphasis,
            underlines,
            bold,
            cite_emphasis: Vec::new(),
            cite_date: cite_date.map(|d| d.format("%Y-%m-%d").to_string()),
            filename: self.filename.clone(),
            author: String::new(),
            source: String::new(),
            round: String::new(),
            year: String::new(),
            fullcite: String::new(),
            summary: String::new(),
            tournament: String::new(),
            opponent: String::new(),
            judge: String::new(),
            team: String::new(),
            school: String::new(),
            event: String::new(),
            level: String::new(),
        }])
    }

    fn extract_date(&self, cite: &str) -> Option<NaiveDate> {
        // Simplified version of the date extraction logic
        // Looking for common date patterns like MM-DD-YY or Month DD, YYYY
        let re = Regex::new(r"(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})").unwrap();
        if let Some(cap) = re.captures(cite) {
            let m: u32 = cap[1].parse().ok()?;
            let d: u32 = cap[2].parse().ok()?;
            let mut y: i32 = cap[3].parse().ok()?;

            if y < 100 {
                if y <= 21 {
                    y += 2000;
                } else {
                    y += 1900;
                }
            }
            return NaiveDate::from_ymd_opt(y, m, d);
        }
        None
    }

    fn get_text(&self, p: &Paragraph) -> String {
        let mut text = String::new();
        for child in &p.children {
            if let ParagraphChild::Run(r) = child {
                text.push_str(&self.get_run_text(r));
            }
        }
        text
    }

    fn get_run_text(&self, r: &Run) -> String {
        let mut text = String::new();
        for child in &r.children {
            if let RunChild::Text(t) = child {
                text.push_str(&t.text);
            }
        }
        text
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;

    #[test]
    fn test_parse_docx() {
        let path = Path::new("test-docs/1nc.docx");
        if !path.exists() {
            println!("test-docs/1nc.docx not found, skipping docx test");
            return;
        }
        let content = fs::read(path).expect("Failed to read test docx");
        let parser = CardParser::new("1nc.docx".to_string(), content);

        let res = parser.parse();
        assert!(res.is_ok(), "Docx parsing failed");

        let cards = res.unwrap();
        assert!(
            !cards.is_empty(),
            "Should extract at least one card from docx"
        );

        let first_card = &cards[0];
        assert!(!first_card.tag.is_empty(), "Card should have a tag");
        assert!(
            !first_card.id.is_empty(),
            "Card should have an ID generated"
        );
        assert!(!first_card.body.is_empty(), "Card should have body text");
    }
}
