const DOM = {
  homeView: document.getElementById('home-view'),
  searchView: document.getElementById('search-view'),
  searchInput: document.getElementById('search-input'),
  searchBtn: document.getElementById('search-btn'),
  headerSearchInput: document.getElementById('header-search-input'),
  headerSearchBtn: document.getElementById('header-search-btn'),
  logoSmall: document.querySelector('.logo-small-container'),
  cardsContainer: document.getElementById('cards-container'),
  resultsCount: document.getElementById('results-count'),
  headerSearchBodyCheck: document.getElementById('header-search-body-check'),
};

const HIGHLIGHT_COLOR = '#ffff00'; // Standard yellow highlight
const LINE_HEIGHT = '107%';

/** VIEW MANAGEMENT */
function showHome() {
  DOM.homeView.classList.remove('hidden');
  DOM.searchView.classList.add('hidden');
  DOM.searchInput.value = DOM.headerSearchInput.value;
  DOM.searchInput.focus();
}

function showResults() {
  DOM.homeView.classList.add('hidden');
  DOM.searchView.classList.remove('hidden');
  DOM.headerSearchInput.value = DOM.searchInput.value;
  DOM.headerSearchInput.focus();
}

// Sync and handlers
DOM.logoSmall.addEventListener('click', showHome);

/** SEARCH LOGIC */
async function performSearch(query) {
  if (!query.trim()) return;
  
  DOM.searchInput.value = query;
  DOM.headerSearchInput.value = query;
  showResults();
  
  DOM.cardsContainer.innerHTML = '<p>Loading results...</p>';
  DOM.resultsCount.textContent = '';

  try {
    const isBodyChecked = DOM.headerSearchBodyCheck.checked;
    const res = await fetch(`/api/query?q=${encodeURIComponent(query)}&body=${isBodyChecked}`);
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    
    renderResults(data);
  } catch (e) {
    DOM.cardsContainer.innerHTML = `<p style="color:red;">Error: ${e.message}</p>`;
  }
}

DOM.searchBtn.addEventListener('click', () => performSearch(DOM.searchInput.value));
DOM.searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') performSearch(DOM.searchInput.value);
});

DOM.headerSearchBtn.addEventListener('click', () => performSearch(DOM.headerSearchInput.value));
DOM.headerSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') performSearch(DOM.headerSearchInput.value);
});

/** RENDERING LOGIC */
function renderResults(hits) {
  const total = hits.length;
  
  DOM.resultsCount.textContent = `Showing ${hits.length} results`;
  DOM.cardsContainer.innerHTML = '';

  if (hits.length === 0) {
    DOM.cardsContainer.innerHTML = '<p>No results found for your query.</p>';
    return;
  }

  hits.forEach(card => {
    DOM.cardsContainer.appendChild(createCardElement(card));
  });
}

function createCardElement(card) {
  const el = document.createElement('div');
  el.className = 'card-detail';
  
  const header = document.createElement('div');
  header.className = 'card-header';
  
  const tagEl = document.createElement('h4');
  tagEl.className = 'card-tag';
  tagEl.textContent = card.tag;
  header.appendChild(tagEl);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'card-actions';

  const expandBtn = document.createElement('button');
  expandBtn.className = 'action-btn expand-btn';
  expandBtn.innerHTML = '👁️ Expand';
  actionsDiv.appendChild(expandBtn);

  const copyBtn = document.createElement('button');
  copyBtn.className = 'action-btn copy-btn';
  copyBtn.innerHTML = '📋 Copy';
  copyBtn.title = 'Copy Card';
  actionsDiv.appendChild(copyBtn);

  header.appendChild(actionsDiv);
  el.appendChild(header);

  // Content wrapper for copying
  const contentWrapper = document.createElement('div');

  // Hierarchy Metadata & Original Filename
  if (card.hat || card.block || card.pocket || card.filename) {
    const meta = document.createElement('p');
    meta.className = 'card-metadata';
    const parts = [];
    if (card.hat) parts.push(`<span class="meta-hat">${card.hat}</span>`);
    if (card.block) parts.push(`<span class="meta-block">${card.block}</span>`);
    if (card.pocket) parts.push(`<span class="meta-pocket">${card.pocket}</span>`);
    
    let html = parts.join(' ❯ ');
    
    if (card.filename) {
      if (html) html += ' <span style="margin: 0 10px; color: #ccc;">|</span> ';
      html += `<span class="card-filename" title="Source Document"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>${card.filename}</span>`;
    }
    
    meta.innerHTML = html;
    contentWrapper.appendChild(meta);
  }


  // OpenCaselist Metadata (Author, Source, Round, Year, Tournament, School, Team, Judge)
  if (card.author || card.source || card.round || card.year || card.tournament || card.school || card.team || card.judge) {
    const openCaseMeta = document.createElement('p');
    openCaseMeta.className = 'card-opencaselist-meta';
    const parts = [];
    if (card.tournament) parts.push(`<strong>Tournament:</strong> ${card.tournament}`);
    if (card.round) parts.push(`<strong>Round:</strong> ${card.round}`);
    if (card.school) parts.push(`<strong>School:</strong> ${card.school}`);
    if (card.team) parts.push(`<strong>Team:</strong> ${card.team}`);
    if (card.judge) parts.push(`<strong>Judge:</strong> ${card.judge}`);
    if (card.year) parts.push(`<strong>Year:</strong> ${card.year}`);
    if (card.event) parts.push(`<strong>Event:</strong> ${card.event.toUpperCase()}`);
    if (card.level) parts.push(`<strong>Level:</strong> ${card.level.toUpperCase()}`);
    openCaseMeta.innerHTML = parts.join(' | ');
    contentWrapper.appendChild(openCaseMeta);
  }

  if (card.summary) {
    const summary = document.createElement('p');
    summary.className = 'card-summary';
    
    const maxLength = 300;
    if (card.summary.length > maxLength) {
      const truncated = card.summary.substring(0, maxLength);
      const full = card.summary;
      
      summary.innerHTML = `<strong>Summary:</strong> <span class="summary-text">${truncated}</span>`;
      
      const expandBtn = document.createElement('button');
      expandBtn.className = 'summary-expand-btn';
      expandBtn.textContent = '...';
      summary.appendChild(expandBtn);
      
      let isExpanded = false;
      expandBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isExpanded = !isExpanded;
        const textSpan = summary.querySelector('.summary-text');
        textSpan.textContent = isExpanded ? full : truncated;
        expandBtn.textContent = isExpanded ? ' (less)' : '...';
      });
    } else {
      summary.innerHTML = `<strong>Summary:</strong> ${card.summary}`;
    }
    contentWrapper.appendChild(summary);
  }
  
  if (card.tag_sub) {
    const sub = document.createElement('p');
    sub.className = 'card-tag-sub';
    sub.textContent = card.tag_sub;
    contentWrapper.appendChild(sub);
  }

  if (card.cite) {
    const cite = document.createElement('p');
    cite.className = 'card-cite';
    cite.innerHTML = `<strong>Cite:</strong> ${generateStyledCite(card.cite, card.cite_emphasis)}`;
    contentWrapper.appendChild(cite);
  }

  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'card-body hidden';
  
  card.body.forEach((paragraph, i) => {
    const p = document.createElement('div');
    p.className = 'card-paragraph';
    p.innerHTML = generateStyledParagraph(card, i, paragraph);
    bodyDiv.appendChild(p);
  });
  
  contentWrapper.appendChild(bodyDiv);
  el.appendChild(contentWrapper);

  expandBtn.addEventListener('click', () => {
    if (bodyDiv.classList.contains('hidden')) {
      bodyDiv.classList.remove('hidden');
      expandBtn.innerHTML = '🔽 Collapse';
    } else {
      bodyDiv.classList.add('hidden');
      expandBtn.innerHTML = '👁️ Expand';
    }
  });

  copyBtn.addEventListener('click', () => {
    const cleanHTML = generateVerbatimHTML(card, true); // Pass true for inlined styles
    
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.fontFamily = 'Calibri, Arial, sans-serif'; // Word-friendly font
    tempDiv.innerHTML = cleanHTML;
    document.body.appendChild(tempDiv);
    
    const range = document.createRange();
    range.selectNode(tempDiv);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    
    try {
      document.execCommand('copy');
      const orig = copyBtn.innerHTML;
      copyBtn.innerHTML = '✅ Copied!';
      setTimeout(() => copyBtn.innerHTML = orig, 1500);
    } catch (err) {
      console.error('Failed to copy card: ', err);
    }
    
    window.getSelection().removeAllRanges();
    document.body.removeChild(tempDiv);
  });

  return el;
}

/** FORMATTING LOGIC (Extracted from utils.ts in reference repo) */
function generateStyledCite(cite, citeEmphasis = [], isCopy = false) {
  if (!cite) return '';
  if (!citeEmphasis || citeEmphasis.length === 0) return cite;

  const citeObj = {};
  for (const [start, end] of citeEmphasis) {
    // Cites are 12pt bold in Verbatim
    citeObj[start] = `${citeObj[start] || ''}<span style="font-weight:bold; font-size: 12pt;">`;
    citeObj[end] = `${citeObj[end] || ''}</span>`;
  }

  return cite.replace(/(?:)/g, (_, index) => citeObj[index] || '');
}

function generateStyledParagraph(card, i, paragraph, isCopy = false) {
  // In the reference repo, paragraphs were offset by 2. In our Rust parser, body paragraphs are 0-indexed.
  const highlights = (card.highlights || []).filter(h => h[0] === i);
  const underlines = (card.underlines || []).filter(u => u[0] === i);
  const bolds = (card.bold || []).filter(b => b[0] === i);
  const emphases = (card.emphasis || []).filter(e => e[0] === i);

  const obj = {};
  
  // Full Verbatim Support (Always applied for consistency between display and copy):
  // "Read" text (highlights, etc.) is 11pt, normal spacing.
  // "Verbatim" text (everything else) is 8pt, condensed (handled by parent style).
  const readSize = 'font-size: 11pt; letter-spacing: normal;';

  for (const [_, s, e] of highlights) {
    obj[s] = `${obj[s] || ''}<span style="background-color:${HIGHLIGHT_COLOR}; ${readSize}">`;
    obj[e] = `${obj[e] || ''}</span>`;
  }
  for (const [_, s, e] of bolds) {
    obj[s] = `${obj[s] || ''}<b style="${readSize}">`;
    obj[e] = `${obj[e] || ''}</b>`;
  }
  for (const [_, s, e] of emphases) {
    obj[s] = `${obj[s] || ''}<b style="${readSize}"><u>`;
    obj[e] = `${obj[e] || ''}</u></b>`;
  }
  for (const [_, s, e] of underlines) {
    obj[s] = `${obj[s] || ''}<u style="${readSize}">`;
    obj[e] = `${obj[e] || ''}</u>`;
  }

  return paragraph.replace(/(?:)/g, (_, index) => obj[index] || '');
}

/** RECONSTRUCTION LOGIC (VERBATIM CLEAN HTML) */
function generateVerbatimHTML(card, isCopy = false) {
  let html = '';
  
  const hatStyle = isCopy ? 'style="font-size: 18pt; font-weight: bold; color: black; margin: 15px 0 5px 0;"' : '';
  const blockStyle = isCopy ? 'style="font-size: 16pt; font-weight: bold; color: black; margin: 10px 0 5px 0;"' : '';
  const pocketStyle = isCopy ? 'style="font-size: 14pt; font-weight: bold; font-style: italic; color: black; margin: 8px 0 5px 0;"' : '';
  const tagStyle = isCopy ? 'style="font-size: 14pt; font-weight: bold; color: black; margin: 5px 0 5px 0;"' : '';
  const subStyle = isCopy ? 'style="font-size: 11pt; color: #444; margin: 0 0 10px 0;"' : '';
  const citeStyle = isCopy ? 'style="font-size: 12pt; font-weight: bold; color: black; margin: 0 0 10px 0;"' : '';
  // Condense: letter-spacing: -0.2pt; Shrink: font-size: 8pt
  const bodyParaStyle = isCopy ? `style="font-size: 8pt; letter-spacing: -0.2pt; line-height: ${LINE_HEIGHT}; color: #333; margin: 0 0 10px 0;"` : '';

  // Include hierarchy if copying
  if (isCopy) {
    if (card.hat) html += `<h1 ${hatStyle}>${card.hat}</h1>`;
    if (card.block) html += `<h2 ${blockStyle}>${card.block}</h2>`;
    if (card.pocket) html += `<h3 ${pocketStyle}>${card.pocket}</h3>`;
  }

  // Card-only format: exclude top hierarchy (Hat, Block, Pocket)
  if (card.tag) html += `<h4 ${tagStyle}>${card.tag}</h4>`;
  if (card.tag_sub) html += `<p ${subStyle}>${card.tag_sub}</p>`;
  if (card.cite) html += `<h5 ${citeStyle}>${generateStyledCite(card.cite, card.cite_emphasis, isCopy)}</h5>`;
  
  card.body.forEach((paragraph, i) => {
    html += `<p ${bodyParaStyle}>${generateStyledParagraph(card, i, paragraph, isCopy)}</p>`;
  });
  
  return html;
}

