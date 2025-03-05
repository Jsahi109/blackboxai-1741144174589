// Initialize everything when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    initEventListeners();
    startAutoRefresh();
});

// Chart initialization
function initCharts() {
    initDispositionChart();
    initGeographicChart();
}

// Initialize disposition donut chart
function initDispositionChart() {
    const ctx = document.getElementById('dispositionChart');
    if (!ctx) return;

    const chart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: window.dispositionData?.map(d => d.name) || [],
            datasets: [{
                data: window.dispositionData?.map(d => d.count) || [],
                backgroundColor: window.dispositionData?.map(d => d.color) || [],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

// Initialize geographic bar chart
function initGeographicChart() {
    const ctx = document.getElementById('geoDistributionChart');
    if (!ctx) return;

    const chart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: window.geoData?.labels || [],
            datasets: [{
                label: 'Records',
                data: window.geoData?.data || [],
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => value.toLocaleString()
                    }
                }
            }
        }
    });
}

// Event listeners initialization
function initEventListeners() {
    // Time period buttons
    document.querySelectorAll('.btn-group .btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.btn-group .btn').forEach(b => 
                b.classList.remove('active'));
            this.classList.add('active');
            refreshActivity(this.textContent.toLowerCase());
        });
    });

    // Geographic view selector
    const geoSelect = document.querySelector('select[name="geoView"]');
    if (geoSelect) {
        geoSelect.addEventListener('change', function() {
            refreshGeographicData(this.value);
        });
    }
}

// Auto-refresh functionality
function startAutoRefresh() {
    // Refresh stats every minute
    setInterval(refreshStats, 60000);
    
    // Refresh activity every 30 seconds
    setInterval(() => {
        const activeBtn = document.querySelector('.btn-group .btn.active');
        if (activeBtn) {
            refreshActivity(activeBtn.textContent.toLowerCase());
        }
    }, 30000);
}

// Refresh dashboard statistics
async function refreshStats() {
    try {
        const response = await fetch('/api/dashboard/stats');
        const stats = await response.json();
        
        Object.entries(stats).forEach(([key, value]) => {
            const el = document.querySelector(`[data-stat="${key}"]`);
            if (el) {
                if (typeof value === 'number') {
                    el.textContent = value.toLocaleString();
                } else {
                    el.textContent = value;
                }
            }
        });
    } catch (error) {
        console.error('Failed to refresh stats:', error);
    }
}

// Refresh activity table
async function refreshActivity(period) {
    try {
        const response = await fetch(`/api/dashboard/activity?period=${period}`);
        const activities = await response.json();
        
        const tbody = document.querySelector('#activityTable tbody');
        if (tbody) {
            tbody.innerHTML = activities.map(activity => `
                <tr>
                    <td>
                        <span class="badge bg-${getActivityBadge(activity.type)}">
                            <i class="bi bi-${getActivityIcon(activity.type)}"></i>
                            ${activity.type}
                        </span>
                    </td>
                    <td>
                        ${activity.description}
                        ${activity.metadata ? 
                            `<br><small class="text-muted">${activity.metadata}</small>` 
                            : ''}
                    </td>
                    <td>
                        <div>${activity.timeFormatted}</div>
                        <small class="text-muted">${activity.dateFormatted}</small>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to refresh activity:', error);
    }
}

// Refresh geographic data
async function refreshGeographicData(view) {
    try {
        const response = await fetch(`/api/dashboard/geo?view=${view}`);
        const data = await response.json();
        
        const chart = Chart.getChart('geoDistributionChart');
        if (chart) {
            chart.data.labels = data.labels;
            chart.data.datasets[0].data = data.data;
            chart.update();
        }
    } catch (error) {
        console.error('Failed to refresh geographic data:', error);
    }
}

// Helper functions
function getActivityBadge(type) {
    const badges = {
        upload: 'primary',
        download: 'success',
        disposition: 'info'
    };
    return badges[type] || 'secondary';
}

function getActivityIcon(type) {
    const icons = {
        upload: 'upload',
        download: 'download',
        disposition: 'telephone'
    };
    return icons[type] || 'circle';
}
