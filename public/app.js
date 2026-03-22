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
  uploadZone: document.getElementById('upload-zone'),
  fileInput: document.getElementById('file-input'),
  uploadStatus: document.getElementById('upload-status'),
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

  // Hierarchy Metadata (Hat > Block > Pocket)
  if (card.hat || card.block || card.pocket) {
    const meta = document.createElement('p');
    meta.className = 'card-metadata';
    const parts = [];
    if (card.hat) parts.push(`<span class="meta-hat">${card.hat}</span>`);
    if (card.block) parts.push(`<span class="meta-block">${card.block}</span>`);
    if (card.pocket) parts.push(`<span class="meta-pocket">${card.pocket}</span>`);
    meta.innerHTML = parts.join(' ❯ ');
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

/** UPLOAD LOGIC */
DOM.uploadZone.addEventListener('click', () => DOM.fileInput.click());
DOM.uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  DOM.uploadZone.classList.add('dragover');
});
DOM.uploadZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  DOM.uploadZone.classList.remove('dragover');
});
DOM.uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  DOM.uploadZone.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleUpload(e.dataTransfer.files[0]);
  }
});

DOM.fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handleUpload(e.target.files[0]);
  }
});

async function handleUpload(file) {
  if (!file.name.endsWith('.docx') && !file.name.endsWith('.zip') && !file.name.endsWith('.csv')) {
    showUploadStatus('Only .docx, .zip, and .csv files are supported.', false);
    return;
  }

  showUploadStatus('Initiating upload...', null);
  DOM.uploadStatus.className = 'status-msg'; // clear styles
  
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
        const errText = await res.text();
        showUploadStatus(`Error: ${errText}`, false);
        return;
    }

    const data = await res.json();
    if (data.job_id) {
        pollJobProgress(data.job_id);
    } else {
        showUploadStatus('Error: Returned no Job ID', false);
    }
  } catch (e) {
    showUploadStatus(`Network error: ${e.message}`, false);
  }
}

async function pollJobProgress(jobId) {
    try {
        const res = await fetch(`/api/progress/${jobId}`);
        if (!res.ok) {
            showUploadStatus(`Failed to fetch job progress`, false);
            return;
        }

        const job = await res.json();

        if (job.error) {
            showUploadStatus(`Job Failed: ${job.error}`, false);
            return;
        }

        let msg = `${job.status}`;
        
        if (job.status.includes('Indexing')) {
            if (job.cards_indexed > 0) {
                const perc = Math.round((job.cards_uploaded / job.cards_indexed) * 100);
                msg += ` (${job.cards_uploaded}/${job.cards_indexed} cards - ${perc}%)`;
            }
        } else if (job.total_files > 0) {
            const perc = Math.round((job.processed_files / job.total_files) * 100);
            msg += ` (${job.processed_files}/${job.total_files} documents - ${perc}%)`;
        }

        showUploadStatus(msg, null);

        if (job.status === 'Completed') {
            showUploadStatus(`Success! Finished indexing ${job.cards_indexed} cards!`, true);
            updateStats();
        } else {
            setTimeout(() => pollJobProgress(jobId), 300);
        }

    } catch(e) {
        showUploadStatus(`Error polling progress: ${e.message}`, false);
    }
}

function showUploadStatus(msg, isSuccess) {
  DOM.uploadStatus.className = 'status-msg';
  if (isSuccess === true) DOM.uploadStatus.classList.add('status-success');
  if (isSuccess === false) DOM.uploadStatus.classList.add('status-error');
  DOM.uploadStatus.textContent = msg;
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
