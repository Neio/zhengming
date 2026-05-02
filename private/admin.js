// --- Auth & API Helpers ---

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts or older browsers
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function authHeaders() {
  return {
    'X-Nonce': generateUUID(),
    // Note: session is handled via HttpOnly cookie
  };
}

function handleAuthError(res) {
  if (res.status === 401) {
    // Session expired or invalid, redirect to login
    window.location.href = '/login.html';
    return true;
  }
  return false;
}

// --- DOM Elements ---
const logoutBtn = document.getElementById('logout-btn');
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const uploadStatus = document.getElementById('upload-status');
const statCount = document.getElementById('stat-count');
const statSize = document.getElementById('stat-size');
const statPending = document.getElementById('stat-pending');

// Modal Elements
const yearModal = document.getElementById('year-modal');
const modalFilename = document.getElementById('modal-filename');
const modalYearInput = document.getElementById('modal-year-input');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');
const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmCancel = document.getElementById('confirm-cancel');
const confirmDo = document.getElementById('confirm-do');
const categorySelect = document.getElementById('mgmt-category-select');
const refreshMgmtBtn = document.getElementById('refresh-mgmt-btn');
const categoryListContainer = document.getElementById('category-list-container');
const clearIndexBtn = document.getElementById('clear-index-btn');
const auditLogsContainer = document.getElementById('audit-logs-container');
const refreshLogsBtn = document.getElementById('refresh-logs-btn');
const downloadLogsBtn = document.getElementById('download-logs-btn');

let pendingFile = null;
let onConfirm = null;

// --- Logout ---
async function handleLogout() {
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers: authHeaders(),
    });
  } catch (e) {
    console.error('Logout failed:', e);
  }
  window.location.href = '/login.html';
}

if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

/** CONFIRMATION MODAL */
function showConfirm(title, message, callback) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  onConfirm = callback;
  confirmModal.style.display = 'flex';
}

if (confirmCancel) {
  confirmCancel.addEventListener('click', () => {
    confirmModal.style.display = 'none';
    onConfirm = null;
  });
}

if (confirmDo) {
  confirmDo.addEventListener('click', () => {
    if (onConfirm) onConfirm();
    confirmModal.style.display = 'none';
    onConfirm = null;
  });
}

/** UPLOAD LOGIC */
if (uploadZone) {
  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });
  uploadZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
  });
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      initiateFileUpload(e.dataTransfer.files[0]);
    }
  });
}

if (fileInput) {
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      initiateFileUpload(e.target.files[0]);
    }
  });
}

function initiateFileUpload(file) {
  if (!file.name.endsWith('.docx') && !file.name.endsWith('.zip') && !file.name.endsWith('.csv')) {
    showUploadStatus('Only .docx, .zip, and .csv files are supported.', false);
    return;
  }

  pendingFile = file;
  
  // Try to detect year from filename
  const yearMatch = file.name.match(/(?:^|[^0-9])(20\d{2}|19\d{2})(?:$|[^0-9])/);
  const detectedYear = yearMatch ? yearMatch[1] : '';
  
  // Show modal
  modalFilename.textContent = file.name;
  modalYearInput.value = detectedYear;
  yearModal.style.display = 'flex';
  modalYearInput.focus();
}

modalCancel.addEventListener('click', () => {
  yearModal.style.display = 'none';
  pendingFile = null;
  fileInput.value = '';
});

modalConfirm.addEventListener('click', () => {
  const year = modalYearInput.value.trim();
  yearModal.style.display = 'none';
  if (pendingFile) {
    handleUpload(pendingFile, year);
    pendingFile = null;
    fileInput.value = '';
  }
});

async function handleUpload(file, year) {
  showUploadStatus(`Initiating upload for ${file.name}...`, null);

  const formData = new FormData();
  formData.append('file', file);
  if (year) {
    formData.append('year', year);
  }

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    });

    if (handleAuthError(res)) return;

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
    const res = await fetch(`/api/progress/${jobId}`, {
      headers: authHeaders(),
    });

    if (handleAuthError(res)) return;

    if (!res.ok) {
      showUploadStatus('Failed to fetch job progress', false);
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
      updateAuditLogs();
    } else {
      setTimeout(() => pollJobProgress(jobId), 300);
    }
  } catch (e) {
    showUploadStatus(`Error polling progress: ${e.message}`, false);
  }
}

function showUploadStatus(msg, isSuccess) {
  if (!uploadStatus) return;
  uploadStatus.className = 'status-msg';
  if (isSuccess === true) uploadStatus.classList.add('status-success');
  if (isSuccess === false) uploadStatus.classList.add('status-error');
  uploadStatus.textContent = msg;
}

/** STATS LOGIC (public — no auth needed) */
async function updateStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const stats = await res.json();
    if (statCount) statCount.textContent = stats.num_docs.toLocaleString();
    if (statSize) statSize.textContent = formatBytes(stats.index_size_bytes);
    if (statPending) statPending.textContent = (stats.pending_cards || 0).toLocaleString();
    
    // Update management list if stats are refreshed
    updateManagementList();
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

if (clearIndexBtn) {
  clearIndexBtn.addEventListener('click', () => {
    showConfirm(
      'Clear Database?',
      'This will PERMANENTLY delete all indexed cards in the database. This action is irreversible.',
      async () => {
        showUploadStatus('Clearing database...', null);
        try {
          const res = await fetch('/api/admin/clear-index', {
            method: 'POST',
            headers: authHeaders(),
          });
          if (handleAuthError(res)) return;
          if (res.ok) {
            showUploadStatus('Database cleared successfully.', true);
            updateStats();
            updateAuditLogs();
          } else {
            const err = await res.text();
            showUploadStatus(`Failed to clear database: ${err}`, false);
          }
        } catch (e) {
          showUploadStatus(`Network error: ${e.message}`, false);
        }
      }
    );
  });
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
const categoryToField = {
  years: 'year',
  tournaments: 'tournament',
  schools: 'school',
  rounds: 'round',
  events: 'event',
  versions: 'version'
};

async function updateManagementList() {
  if (!categorySelect || !categoryListContainer) return;
  const category = categorySelect.value;
  const field = categoryToField[category];
  
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const stats = await res.json();
    
    if (!stats.insights || !stats.insights[category]) {
      categoryListContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: #888;">Insights not available for this category.</div>`;
      return;
    }

    const buckets = stats.insights[category].buckets;
    
    if (!buckets || buckets.length === 0) {
      categoryListContainer.innerHTML = `<div style="padding: 30px; text-align: center; color: #888; background:#fcfcfc; border-radius:12px;">No cards found for this category.</div>`;
      return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
    buckets.forEach(bucket => {
      const displayKey = bucket.key || '(Not Specified)';
      const safeValue = bucket.key.replace(/'/g, "\\'");
      
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #fcfcfc; border-radius: 10px; border: 1px solid #eee;">
          <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 20px;">
            <span style="font-weight: 600; color: #333; font-size: 0.95rem;">${displayKey}</span>
            <div style="font-size: 0.75rem; color: #999; margin-top: 2px; font-weight: 600;">${bucket.doc_count.toLocaleString()} cards</div>
          </div>
          <button onclick="window.deleteBatch('${field}', '${safeValue}')" style="background: #fff; border: 1px solid #eee; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; color: #c41e3a; font-weight: 800; transition: all 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">Delete Batch</button>
        </div>
      `;
    });
    html += '</div>';
    categoryListContainer.innerHTML = html;
  } catch (e) {
    console.error('Failed to update management list:', e);
  }
}

window.deleteBatch = function(field, value) {
  const displayValue = value || '(Not Specified)';
  showConfirm(
    'Delete Batch?',
    `Are you sure you want to delete all cards where ${field} is "${displayValue}"? This action cannot be undone.`,
    async () => {
      showUploadStatus(`Deleting batch for ${field}="${displayValue}"...`, null);
      try {
        const res = await fetch('/api/admin/delete-batch', {
          method: 'POST',
          headers: {
            ...authHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ field, value }),
        });
        if (handleAuthError(res)) return;
        if (res.ok) {
          showUploadStatus(`Successfully deleted all cards for ${field}="${displayValue}"`, true);
          updateStats(); // This will trigger updateManagementList()
          updateAuditLogs();
        } else {
          const err = await res.text();
          showUploadStatus(`Failed to delete: ${err}`, false);
        }
      } catch (e) {
        showUploadStatus(`Network error: ${e.message}`, false);
      }
    }
  );
};

if (categorySelect) categorySelect.addEventListener('change', updateManagementList);
if (refreshMgmtBtn) refreshMgmtBtn.addEventListener('click', updateManagementList);

async function updateAuditLogs() {
  if (!auditLogsContainer) return;
  try {
    const res = await fetch('/api/admin/audit-logs', {
      headers: authHeaders(),
    });
    if (handleAuthError(res)) return;
    if (!res.ok) return;
    const logs = await res.json();
    
    if (!logs || logs.length === 0) {
      auditLogsContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: #aaa;">No audit logs found.</div>`;
      return;
    }

    let html = '';
    logs.forEach(log => {
      const date = new Date(log.timestamp).toLocaleString();
      html += `
        <div style="padding: 8px; border-bottom: 1px solid #eee; font-size: 0.85rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <strong style="color: #333;">${log.action}</strong>
            <span style="color: #999; font-size: 0.75rem;">${date}</span>
          </div>
          <div style="color: #666; font-family: monospace; font-size: 0.8rem; word-break: break-all;">${log.details}</div>
        </div>
      `;
    });
    auditLogsContainer.innerHTML = html;
  } catch (e) {
    console.error('Failed to update audit logs:', e);
  }
}

if (refreshLogsBtn) refreshLogsBtn.addEventListener('click', updateAuditLogs);

if (downloadLogsBtn) {
  downloadLogsBtn.addEventListener('click', () => {
    window.location.href = '/api/admin/audit-logs/download';
  });
}

// Initial list population
setTimeout(() => {
  updateManagementList();
  updateAuditLogs();
}, 500);
