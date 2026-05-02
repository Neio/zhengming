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
                                &docx.styles,
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
                &docx.styles,
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
        styles: &Styles,
    ) -> Result<Vec<Card>, String> {
        if paragraphs.is_empty() {
            return Err("No paragraphs".to_string());
        }

        let tag = self
            .get_text(&paragraphs[0])
            .trim_matches(|c| c == ',' || c == ' ')
            .to_string();

        let mut tag_sub = String::new();
        let mut cite = String::new();
        let mut body_paragraphs = Vec::new();

        for (i, p) in paragraphs.iter().enumerate().skip(1) {
            let style = p.property.style.clone().map(|s| s.val).unwrap_or_default();
            let text = self.get_text(p);

            if style == "Heading5" || style == "Heading6" || style == "Heading 5" || style == "Heading 6" {
                cite = text;
                body_paragraphs = paragraphs[i + 1..].to_vec();
                break;
            }

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
            body_paragraphs = if paragraphs.len() > 1 { paragraphs[1..].to_vec() } else { Vec::new() };
        }

        let mut highlighted_text = String::new();
        let mut highlights = Vec::new();
        let mut underlines = Vec::new();
        let mut bold = Vec::new();
        let mut emphasis = Vec::new();
        let mut body = Vec::new();

        for (p_index, p) in body_paragraphs.iter().enumerate() {
            let mut current_utf16_offset = 0;
            let mut p_text = String::new();

            // Internal helper for recursive processing
            fn process_children(
                children: &[ParagraphChild],
                p_index: i32,
                offset: &mut usize,
                p_text: &mut String,
                highlights: &mut Vec<Vec<i32>>,
                underlines: &mut Vec<Vec<i32>>,
                bold: &mut Vec<Vec<i32>>,
                emphasis: &mut Vec<Vec<i32>>,
                highlighted_text: &mut String,
                parser: &CardParser,
                styles: &Styles,
                is_para_underlined: bool,
                is_para_bold: bool
            ) {
                for child in children {
                    match child {
                        ParagraphChild::Run(r) => {
                            let run_text = parser.get_run_text(r);
                            if run_text.is_empty() { continue; }

                            let run_len_utf16 = run_text.encode_utf16().count();
                            let start = *offset as i32;
                            let end = (*offset + run_len_utf16) as i32;

                            // Check direct formatting OR Run Style OR Paragraph Style
                            let is_highlighted = r.run_property.highlight.is_some();
                            let is_underlined = is_para_underlined || 
                                               r.run_property.underline.is_some() || 
                                               parser.style_has_underline(r.run_property.style.as_ref(), styles);
                            let is_bold = is_para_bold || 
                                         r.run_property.bold.is_some() || 
                                         parser.style_has_bold(r.run_property.style.as_ref(), styles);

                            if is_highlighted {
                                highlights.push(vec![p_index, start, end]);
                                highlighted_text.push(' ');
                                highlighted_text.push_str(&run_text);
                            }
                            if is_underlined {
                                underlines.push(vec![p_index, start, end]);
                            }
                            if is_bold {
                                bold.push(vec![p_index, start, end]);
                            }
                            
                            // Check for "Emphasis" style specifically as it's often used for Verbatim
                            if let Some(style) = &r.run_property.style {
                                if style.val == "Emphasis" || style.val == "Underline" {
                                    emphasis.push(vec![p_index, start, end]);
                                }
                            }
                            
                            p_text.push_str(&run_text);
                            *offset += run_len_utf16;
                        }
                        ParagraphChild::Insert(ins) => {
                            for ins_child in &ins.children {
                                match ins_child {
                                    InsertChild::Run(r) => {
                                        process_children(&[ParagraphChild::Run(r.clone())], p_index, offset, p_text, highlights, underlines, bold, emphasis, highlighted_text, parser, styles, is_para_underlined, is_para_bold);
                                    }
                                    _ => {}
                                }
                            }
                        }
                        ParagraphChild::Hyperlink(h) => {
                            process_children(&h.children, p_index, offset, p_text, highlights, underlines, bold, emphasis, highlighted_text, parser, styles, is_para_underlined, is_para_bold);
                        }
                        ParagraphChild::StructuredDataTag(sdt) => {
                            for sdt_child in &sdt.children {
                                match sdt_child {
                                    StructuredDataTagChild::Run(r) => {
                                        process_children(&[ParagraphChild::Run(r.clone())], p_index, offset, p_text, highlights, underlines, bold, emphasis, highlighted_text, parser, styles, is_para_underlined, is_para_bold);
                                    }
                                    _ => {}
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }

            let is_para_underlined = self.para_style_has_underline(p.property.style.as_ref(), styles);
            let is_para_bold = self.para_style_has_bold(p.property.style.as_ref(), styles);

            process_children(
                &p.children,
                p_index as i32,
                &mut current_utf16_offset,
                &mut p_text,
                &mut highlights,
                &mut underlines,
                &mut bold,
                &mut emphasis,
                &mut highlighted_text,
                self,
                styles,
                is_para_underlined,
                is_para_bold
            );

            body.push(p_text);
        }

        // Merge adjacent ranges to prevent fragmentation
        fn merge_ranges(ranges: &mut Vec<Vec<i32>>) {
            if ranges.len() < 2 { return; }
            ranges.sort_by(|a, b| a[0].cmp(&b[0]).then(a[1].cmp(&b[1])));
            let mut merged = Vec::new();
            if let Some(mut current) = ranges.first().cloned() {
                for next in ranges.iter().skip(1) {
                    // Bridge perfectly adjacent segments (offset 1)
                    if next[0] == current[0] && next[1] <= current[2] + 1 { 
                        current[2] = current[2].max(next[2]);
                    } else {
                        merged.push(current);
                        current = next.clone();
                    }
                }
                merged.push(current);
            }
            *ranges = merged;
        }

        merge_ranges(&mut highlights);
        merge_ranges(&mut underlines);
        merge_ranges(&mut bold);
        merge_ranges(&mut emphasis);

        let cite_date = self.extract_date(&cite);
        let mut hasher = Sha256::new();
        hasher.update(format!("{}{}{}", tag, cite, body.join("")).as_bytes());
        let id = format!("{:x}", hasher.finalize());

        Ok(vec![Card {
            id, tag, tag_sub: tag_sub.trim().to_string(),
            pocket: pocket.to_string(), block: block.to_string(), hat: hat.to_string(),
            cite, highlighted_text: highlighted_text.trim().to_string(), body,
            highlights, emphasis, underlines, bold,
            cite_emphasis: Vec::new(), cite_date: cite_date.map(|d| d.format("%Y-%m-%d").to_string()),
            filename: self.filename.clone(),
            author: String::new(), source: String::new(), round: String::new(), year: String::new(),
            fullcite: String::new(), summary: String::new(), tournament: String::new(), opponent: String::new(),
            judge: String::new(), team: String::new(), school: String::new(), event: String::new(), level: String::new(),
        }])
    }

    fn extract_date(&self, cite: &str) -> Option<NaiveDate> {
        let re = Regex::new(r"(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})").unwrap();
        if let Some(cap) = re.captures(cite) {
            let m: u32 = cap[1].parse().ok()?;
            let d: u32 = cap[2].parse().ok()?;
            let mut y: i32 = cap[3].parse().ok()?;
            if y < 100 { y += if y <= 21 { 2000 } else { 1900 }; }
            return NaiveDate::from_ymd_opt(y, m, d);
        }
        None
    }

    fn get_text(&self, p: &Paragraph) -> String {
        let mut text = String::new();
        for child in &p.children {
            match child {
                ParagraphChild::Run(r) => text.push_str(&self.get_run_text(r)),
                ParagraphChild::Hyperlink(h) => {
                    for h_child in &h.children {
                        if let ParagraphChild::Run(r) = h_child {
                            text.push_str(&self.get_run_text(r));
                        }
                    }
                }
                _ => {}
            }
        }
        text
    }

    fn get_run_text(&self, r: &Run) -> String {
        let mut text = String::new();
        for child in &r.children {
            match child {
                RunChild::Text(t) => text.push_str(&t.text),
                RunChild::Tab(_) => text.push('\t'),
                RunChild::Break(_) => text.push('\n'),
                _ => {}
            }
        }
        text
    }

    fn style_has_underline(&self, style: Option<&RunStyle>, styles: &Styles) -> bool {
        if let Some(s) = style {
            if let Some(style_def) = styles.styles.iter().find(|def| def.style_id == s.val) {
                return style_def.run_property.underline.is_some();
            }
        }
        false
    }

    fn style_has_bold(&self, style: Option<&RunStyle>, styles: &Styles) -> bool {
        if let Some(s) = style {
            if let Some(style_def) = styles.styles.iter().find(|def| def.style_id == s.val) {
                return style_def.run_property.bold.is_some();
            }
        }
        false
    }

    fn para_style_has_underline(&self, style: Option<&ParagraphStyle>, styles: &Styles) -> bool {
        if let Some(s) = style {
            if let Some(style_def) = styles.styles.iter().find(|def| def.style_id == s.val) {
                return style_def.run_property.underline.is_some();
            }
        }
        false
    }

    fn para_style_has_bold(&self, style: Option<&ParagraphStyle>, styles: &Styles) -> bool {
        if let Some(s) = style {
            if let Some(style_def) = styles.styles.iter().find(|def| def.style_id == s.val) {
                return style_def.run_property.bold.is_some();
            }
        }
        false
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
