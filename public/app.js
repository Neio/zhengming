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
  statCount: document.getElementById('stat-count'),
  statSize: document.getElementById('stat-size'),
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
    const res = await fetch(`/api/query?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Search failed');
    const data = await fetch(res.url).then(r => r.json());
    
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
    summary.innerHTML = `<strong>Summary:</strong> ${card.summary}`;
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
    const range = document.createRange();
    range.selectNode(contentWrapper);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand('copy');
    window.getSelection().removeAllRanges();
    
    const orig = copyBtn.innerHTML;
    copyBtn.innerHTML = '✅ Copied!';
    setTimeout(() => copyBtn.innerHTML = orig, 1500);
  });

  return el;
}

/** FORMATTING LOGIC (Extracted from utils.ts in reference repo) */
function generateStyledCite(cite, citeEmphasis = []) {
  if (!cite) return '';
  if (!citeEmphasis || citeEmphasis.length === 0) return cite;

  const citeObj = {};
  for (const [start, end] of citeEmphasis) {
    citeObj[start] = `${citeObj[start] || ''}<span style="font-weight:bold;">`;
    citeObj[end] = `${citeObj[end] || ''}</span>`;
  }

  return cite.replace(/(?:)/g, (_, index) => citeObj[index] || '');
}

function generateStyledParagraph(card, i, paragraph) {
  // In the reference repo, paragraphs were offset by 2. In our Rust parser, body paragraphs are 0-indexed.
  const highlights = (card.highlights || []).filter(h => h[0] === i);
  const underlines = (card.underlines || []).filter(u => u[0] === i);
  const bolds = (card.bold || []).filter(b => b[0] === i);
  const emphases = (card.emphasis || []).filter(e => e[0] === i);

  const obj = {};
  
  for (const [_, s, e] of highlights) {
    obj[s] = `${obj[s] || ''}<span style="background:${HIGHLIGHT_COLOR};">`;
    obj[e] = `${obj[e] || ''}</span>`;
  }
  for (const [_, s, e] of bolds) {
    obj[s] = `${obj[s] || ''}<b>`;
    obj[e] = `${obj[e] || ''}</b>`;
  }
  for (const [_, s, e] of emphases) {
    obj[s] = `${obj[s] || ''}<b><u>`;
    obj[e] = `${obj[e] || ''}</u></b>`;
  }
  for (const [_, s, e] of underlines) {
    obj[s] = `${obj[s] || ''}<u>`;
    obj[e] = `${obj[e] || ''}</u>`;
  }

  return paragraph.replace(/(?:)/g, (_, index) => obj[index] || '');
}

/** STATS LOGIC */
async function updateStats() {
    try {
        const res = await fetch('/api/stats');
        if (!res.ok) return;
        const stats = await res.json();
        DOM.statCount.textContent = stats.num_docs.toLocaleString();
        DOM.statSize.textContent = formatBytes(stats.index_size_bytes);
    } catch (e) {
        console.error('Failed to fetch stats:', e);
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Initial stats fetch
updateStats();
