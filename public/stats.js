async function fetchStats() {
    try {
        const res = await fetch('/api/stats');
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
        
        renderStats(data);
    } catch (e) {
        console.error(e);
        document.getElementById('total-docs').textContent = 'Error';
    }
}

function renderStats(data) {
    document.getElementById('total-docs').textContent = data.num_docs.toLocaleString();
    document.getElementById('storage-size').textContent = formatBytes(data.index_size_bytes);
    document.getElementById('pending-docs').textContent = (data.pending_cards || 0).toLocaleString();
    
    if (data.insights && data.insights.rounds) {
        renderBars('rounds-chart', data.insights.rounds.buckets, data.num_docs);
    }
    
    if (data.insights && data.insights.tournaments) {
        renderBars('tournaments-chart', data.insights.tournaments.buckets, data.num_docs);
    }

    if (data.insights && data.insights.schools) {
        renderBars('schools-chart', data.insights.schools.buckets, data.num_docs);
    }

    if (data.insights && data.insights.years) {
        renderBars('years-chart', data.insights.years.buckets, data.num_docs);
    }

    if (data.insights && data.insights.events) {
        renderBars('events-chart', data.insights.events.buckets, data.num_docs);
    }
}

function renderBars(containerId, buckets, total) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (!buckets || buckets.length === 0) {
        container.innerHTML = '<p style="color:#999;">No data available.</p>';
        return;
    }

    // Find max for scaling
    const max = Math.max(...buckets.map(b => b.doc_count));

    buckets.forEach(bucket => {
        const perc = (bucket.doc_count / max) * 100;
        
        const item = document.createElement('div');
        item.className = 'bar-item';
        
        item.innerHTML = `
            <div class="bar-label" title="${bucket.key}">${bucket.key}</div>
            <div class="bar-container">
                <div class="bar-fill" style="width: 0%"></div>
            </div>
            <div class="bar-val">${bucket.doc_count}</div>
        `;
        
        container.appendChild(item);
        
        // Trigger animation
        setTimeout(() => {
            item.querySelector('.bar-fill').style.width = `${perc}%`;
        }, 100);
    });
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

fetchStats();
