use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Card {
    pub id: String,
    pub tag: String, // Heading 4
    pub tag_sub: String,
    pub pocket: String, // Heading 3
    pub block: String,  // Heading 2
    pub hat: String,    // Heading 1
    pub cite: String,   // Heading 5/6 or first bold
    pub highlighted_text: String,
    pub body: Vec<String>,
    pub highlights: Vec<Vec<i32>>, // [para_index, start, end]
    pub emphasis: Vec<Vec<i32>>,
    pub underlines: Vec<Vec<i32>>,
    pub bold: Vec<Vec<i32>>,
    pub cite_emphasis: Vec<Vec<i32>>,
    pub cite_date: Option<String>,
    pub filename: String,
    // OpenCaselist / Additional Metadata
    pub author: String,
    pub source: String,
    pub round: String,
    pub year: String,
    // Deduplicated Dataset Metadata
    pub fullcite: String,
    pub summary: String,
    pub tournament: String,
    pub opponent: String,
    pub judge: String,
    pub team: String,
    pub school: String,
    pub event: String,
    pub level: String,
}

impl Card {
    pub fn new_empty() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            tag: String::new(),
            tag_sub: String::new(),
            pocket: String::new(),
            block: String::new(),
            hat: String::new(),
            cite: String::new(),
            highlighted_text: String::new(),
            body: Vec::new(),
            highlights: Vec::new(),
            emphasis: Vec::new(),
            underlines: Vec::new(),
            bold: Vec::new(),
            cite_emphasis: Vec::new(),
            cite_date: None,
            filename: String::new(),
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
        }
    }
}
