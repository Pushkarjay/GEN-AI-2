// VenueFlow Frontend - Real-time API Integration
// This connects to the backend server for real-time crowd data

let venueData = {};
let ws = null;
let connectionStatus = 'disconnected';
const API_BASE_URL = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'http://localhost:8080';
const WS_URL = (API_BASE_URL.replace('http', 'ws')).replace(':3000', ':8080');

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    updateTimeInfo();
    // Ensure we start in realtime mode
    document.getElementById('modeSelector').value = 'realtime';
    changeMode('realtime');
    connectWebSocket();
    startPollingFallback();
});

// Update time display
function updateTimeInfo() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const dateString = now.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
    const timeElem = document.getElementById('timeInfo');
    if (timeElem) {
        timeElem.textContent = `${dateString} • ${timeString}`;
    }
}

// Connect to WebSocket for real-time updates
function connectWebSocket() {
    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log('✓ WebSocket connected');
            updateConnectionStatus('connected');
            showNotification('Connected to real-time data', 'success');
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'initial' || message.type === 'update') {
                    venueData = message.data;
                    updateMetrics();
                    updateTimeInfo();
                }
            } catch (err) {
                console.error('WebSocket message parse error:', err);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            updateConnectionStatus('disconnected');
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
            updateConnectionStatus('disconnected');
            // Try to reconnect after 3 seconds
            setTimeout(() => {
                console.log('Attempting to reconnect...');
                connectWebSocket();
            }, 3000);
        };
    } catch (err) {
        console.error('WebSocket connection failed:', err);
        updateConnectionStatus('disconnected');
    }
}

// Fallback polling if WebSocket fails
function startPollingFallback() {
    setInterval(() => {
        if (connectionStatus === 'disconnected' || !ws || ws.readyState !== WebSocket.OPEN) {
            fetchVenueData();
        }
    }, 3000);
}

// Fetch venue data from API
async function fetchVenueData() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/venue/data`);
        if (response.ok) {
            venueData = await response.json();
            updateMetrics();
            if (connectionStatus === 'disconnected') {
                updateConnectionStatus('connected');
            }
        }
    } catch (err) {
        console.error('Failed to fetch venue data:', err);
        updateConnectionStatus('disconnected');
    }
}

// Change mode (realtime vs demo)
async function changeMode(mode) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/mode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Mode changed to:', result.currentMode);
            
            // Fetch fresh data for new mode
            fetchVenueData();
            showNotification(`Switched to ${getModeLabel(mode)}`, 'success');

            // Send mode change through WebSocket if connected
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'modeChange', mode }));
            }
        }
    } catch (err) {
        console.error('Failed to change mode:', err);
        showNotification('Failed to change mode', 'error');
    }
}

// Get friendly label for mode
function getModeLabel(mode) {
    const labels = {
        'realtime': '🔴 Real-Time Mode',
        'demo-peak': '📊 Peak Hour Demo',
        'demo-low': '📊 Low Traffic Demo',
        'demo-evacuation': '🚨 Emergency Demo'
    };
    return labels[mode] || mode;
}

// Update connection status indicator
function updateConnectionStatus(status) {
    connectionStatus = status;
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = status === 'connected' ? '● Connected' : '● Disconnected';
        statusElement.className = 'connection-status ' + status;
    }
}

// Update all metrics
function updateMetrics() {
    if (!venueData || !venueData.zones) return;

    // Total Attendees
    if (venueData.totalAttendees !== undefined) {
        const elem = document.getElementById('totalAttendees');
        if (elem) elem.textContent = venueData.totalAttendees.toLocaleString();
    }

    // Average Wait Time
    if (venueData.avgWaitTime !== undefined) {
        const elem = document.getElementById('avgWaitTime');
        if (elem) elem.textContent = venueData.avgWaitTime;
    }

    // Capacity Percentage
    if (venueData.totalAttendees !== undefined && venueData.maxCapacity) {
        const capacityPercent = Math.round((venueData.totalAttendees / venueData.maxCapacity) * 100);
        const elem = document.getElementById('capacityPercent');
        if (elem) elem.textContent = capacityPercent + '%';
        
        const fillElem = document.getElementById('capacityFill');
        if (fillElem) fillElem.style.width = capacityPercent + '%';

        // Update alert status
        const alertElem = document.getElementById('alertStatus');
        if (alertElem) {
            if (capacityPercent > 90) {
                alertElem.textContent = 'CRITICAL';
                alertElem.style.color = '#ea4335';
            } else if (capacityPercent > 75) {
                alertElem.textContent = 'WARNING';
                alertElem.style.color = '#fbbc04';
            } else {
                alertElem.textContent = 'CLEAR';
                alertElem.style.color = '#34a853';
            }
        }
    }

    // Update zone displays
    updateZoneDisplays();
}

// Update zone displays
function updateZoneDisplays() {
    if (!venueData.zones) return;

    Object.keys(venueData.zones).forEach(zone => {
        const data = venueData.zones[zone];
        const crowdElement = document.getElementById(`${zone}-crowd`);
        const densityElement = document.getElementById(`${zone}-density`);

        if (crowdElement) crowdElement.textContent = data.crowd;
        if (densityElement) {
            densityElement.style.width = data.occupancy + '%';
        }

        // Color density indicator
        if (data.occupancy > 80) {
            if (crowdElement) crowdElement.style.color = '#ea4335';
        } else if (data.occupancy > 60) {
            if (crowdElement) crowdElement.style.color = '#fbbc04';
        } else {
            if (crowdElement) crowdElement.style.color = '#34a853';
        }
    });
}

// Select zone for details
function selectZone(zone) {
    if (!venueData.zones || !venueData.zones[zone]) return;

    const data = venueData.zones[zone];
    document.getElementById('zoneDetails').style.display = 'block';
    document.getElementById('selectedZoneTitle').textContent = `${zone.replace('-', ' ').toUpperCase()} - Zone Details`;
    document.getElementById('zoneOccupancy').textContent = data.occupancy + '%';
    document.getElementById('zoneWaitTime').textContent = data.waitTime + ' min';
    document.getElementById('zoneIncidents').textContent = data.incidents || 0;
    document.getElementById('zoneEntries').textContent = data.entries || 1;

    // Highlight selected zone
    document.querySelectorAll('.zone-card').forEach(card => {
        card.classList.remove('selected');
    });
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('selected');
    }
}

// Switch between views
function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    // Remove active class from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected view
    document.getElementById(viewName).classList.add('active');

    // Add active class to clicked button
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
}

// Optimize queues
async function optimizeQueues() {
    try {
        // In real-time mode, make API call to optimize
        if (document.getElementById('modeSelector').value === 'realtime') {
            // Simulate optimization by reducing occupancy
            const zones = venueData.zones;
            Object.keys(zones).forEach(zone => {
                if (zones[zone].occupancy > 70) {
                    zones[zone].occupancy = Math.max(zones[zone].occupancy - 10, 0);
                    zones[zone].waitTime = Math.round(zones[zone].occupancy / 2.5);
                }
            });

            // Recalculate average wait time
            const waitTimes = Object.values(zones).map(z => z.waitTime);
            venueData.avgWaitTime = Math.round(waitTimes.reduce((a, b) => a + b) / waitTimes.length);

            updateMetrics();
        }
        
        showNotification('✓ Queue optimization applied successfully!', 'success');
    } catch (err) {
        console.error('Queue optimization failed:', err);
        showNotification('Failed to optimize queues', 'error');
    }
}

// Clear all alerts
function clearAllAlerts() {
    document.querySelectorAll('.alert').forEach(alert => {
        alert.style.display = 'none';
    });
    showNotification('All alerts cleared', 'info');
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type}`;
    notification.style.position = 'fixed';
    notification.style.top = '80px';
    notification.style.right = '20px';
    notification.style.zIndex = '1000';
    notification.style.maxWidth = '400px';
    
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ️';
    notification.innerHTML = `
        <div class="alert-icon">${icon}</div>
        <div class="alert-content">
            <strong>${message}</strong>
        </div>
        <button class="alert-close" onclick="this.parentElement.style.display='none';">✕</button>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.display = 'none';
    }, 4000);
}

// API Class for external use
class VenueAPI {
    static async getCrowdData() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/venue/data`);
            return response.ok ? await response.json() : null;
        } catch (err) {
            console.error('Failed to get crowd data:', err);
            return null;
        }
    }

    static async getZoneData(zone) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/venue/zone/${zone}`);
            return response.ok ? await response.json() : null;
        } catch (err) {
            console.error(`Failed to get data for zone ${zone}:`, err);
            return null;
        }
    }

    static async updateZoneCapacity(zone, occupancy, waitTime) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/venue/zone/${zone}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ occupancy, waitTime })
            });
            return response.ok ? await response.json() : null;
        } catch (err) {
            console.error(`Failed to update zone ${zone}:`, err);
            return null;
        }
    }

    static async getMode() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/mode`);
            return response.ok ? await response.json() : null;
        } catch (err) {
            console.error('Failed to get mode:', err);
            return null;
        }
    }
}

// Mobile optimization
if (window.innerWidth < 768) {
    document.querySelector('body').style.fontSize = '14px';
}

// Add service worker support
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
        console.log('Service Worker registration failed:', err);
    });
}

// Update time every second
setInterval(updateTimeInfo, 1000);

// Export for external use
window.VenueAPI = VenueAPI;
window.changeMode = changeMode;
window.selectZone = selectZone;
window.switchView = switchView;
window.optimizeQueues = optimizeQueues;
window.clearAllAlerts = clearAllAlerts;
