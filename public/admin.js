const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const uploadStatus = document.getElementById('upload-status');
const statCount = document.getElementById('stat-count');
const statSize = document.getElementById('stat-size');
const statPending = document.getElementById('stat-pending');

/** UPLOAD LOGIC */
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
    handleUpload(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
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
  uploadStatus.className = 'status-msg';
  if (isSuccess === true) uploadStatus.classList.add('status-success');
  if (isSuccess === false) uploadStatus.classList.add('status-error');
  uploadStatus.textContent = msg;
}

/** STATS LOGIC */
async function updateStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const stats = await res.json();
    statCount.textContent = stats.num_docs.toLocaleString();
    statSize.textContent = formatBytes(stats.index_size_bytes);
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
