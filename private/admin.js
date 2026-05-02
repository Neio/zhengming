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

let pendingFile = null;

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
