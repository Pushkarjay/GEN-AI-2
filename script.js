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
                    updateZoneDisplays();
                    updateQueueDisplays();
                    updateZoneAnalytics();
                    updateAlerts();
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
            await fetchVenueData();
            
            // Refresh ALL page data
            updateMetrics();
            updateZoneDisplays();
            updateQueueDisplays();
            updateZoneAnalytics();
            updateAlerts();
            
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
    
    // Update queue management page
    updateQueueDisplays();
    
    // Update zone analytics page
    updateZoneAnalytics();
    
    // Update alerts page
    updateAlerts();
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
            updateZoneAnalytics();
            updateAlerts();
        }
        
        showNotification('✓ Queue optimization applied successfully!', 'success');
    } catch (err) {
        console.error('Queue optimization failed:', err);
        showNotification('Failed to optimize queues', 'error');
    }
}

// Clear all alerts
function clearAllAlerts() {
    const alertsList = document.getElementById('alerts-list');
    if (alertsList) {
        alertsList.innerHTML = '';
        // Add info message
        const infoDiv = document.createElement('div');
        infoDiv.className = 'alert alert-info';
        infoDiv.innerHTML = `
            <div class="alert-icon">ℹ️</div>
            <div class="alert-content">
                <strong>All Alerts Cleared</strong>
                <p>System monitoring resumed. New alerts will appear if issues are detected.</p>
            </div>
        `;
        alertsList.appendChild(infoDiv);
    }
    showNotification('All alerts cleared', 'info');
}

// Update queue management page with dynamic data
function updateQueueDisplays() {
    if (!venueData || !venueData.zones) return;

    // Calculate queue sizes from zone occupancy
    const entrance = venueData.zones.entrance;
    const foodCourt = venueData.zones['food-court'];
    const restrooms = venueData.zones.restrooms;
    const parking = venueData.zones.parking;

    // Gates Queue (based on entrance occupancy)
    if (entrance && document.getElementById('gates-queue')) {
        const gatesQueue = Math.round((entrance.occupancy / 100) * 300);
        const gatesWait = Math.round((entrance.occupancy / 3));
        document.getElementById('gates-queue').textContent = `Queue: ${gatesQueue} people | Wait: ${gatesWait} min`;
        document.getElementById('gates-progress').style.width = entrance.occupancy + '%';
        document.getElementById('gates-status').textContent = entrance.occupancy > 80 ? '⚠️ All gates open - near capacity' : 'Gate 1-3: Open | Gate 4: On-call';
    }

    // Food Court Queue (based on food court occupancy)
    if (foodCourt && document.getElementById('food-queue')) {
        const foodQueue = Math.round((foodCourt.occupancy / 100) * 400);
        const foodWait = foodCourt.waitTime;
        document.getElementById('food-queue').textContent = `Queue: ${foodQueue} people | Wait: ${foodWait} min`;
        document.getElementById('food-progress').style.width = foodCourt.occupancy + '%';
        document.getElementById('food-status').innerHTML = foodCourt.occupancy > 85 ? '🔴 CRITICAL - Open all counters' : '✓ Normal operations';
    }

    // Restroom Queue (based on restroom occupancy)
    if (restrooms && document.getElementById('restroom-queue')) {
        const restroomQueue = Math.round((restrooms.occupancy / 100) * 100);
        const restroomWait = restrooms.waitTime;
        document.getElementById('restroom-queue').textContent = `Queue: ${restroomQueue} people | Wait: ${restroomWait} min`;
        document.getElementById('restroom-progress').style.width = restrooms.occupancy + '%';
        document.getElementById('restroom-status').textContent = restrooms.occupancy > 70 ? '⚠️ Consider alternate facilities' : '✓ All facilities operational';
    }

    // Parking Queue (based on parking occupancy)
    if (parking && document.getElementById('parking-queue')) {
        const parkingQueue = Math.round((parking.occupancy / 100) * 250);
        const parkingWait = parking.waitTime;
        document.getElementById('parking-queue').textContent = `Queue: ${parkingQueue} cars | Wait: ${parkingWait} min`;
        document.getElementById('parking-progress').style.width = parking.occupancy + '%';
        document.getElementById('parking-status').textContent = parking.occupancy > 80 ? '🔴 Use alternate lot' : 'Alternate exit route available';
    }
}

// Update Zone Analytics page with dynamic data
function updateZoneAnalytics() {
    if (!venueData || !venueData.zones) return;

    const zones = venueData.zones;
    
    // Update density chart bars
    const zoneNames = [
        { key: 'entrance', barId: 'entrance-bar', valueId: 'entrance-value' },
        { key: 'main-arena', barId: 'arena-bar', valueId: 'arena-value' },
        { key: 'food-court', barId: 'food-bar', valueId: 'food-value' },
        { key: 'parking', barId: 'parking-bar', valueId: 'parking-value' }
    ];

    zoneNames.forEach(zone => {
        if (zones[zone.key]) {
            const occupancy = zones[zone.key].occupancy;
            const barColor = occupancy > 85 ? '#FF5722' : occupancy > 60 ? '#FFC107' : '#4CAF50';
            
            const bar = document.getElementById(zone.barId);
            const value = document.getElementById(zone.valueId);
            
            if (bar) {
                bar.style.width = occupancy + '%';
                bar.style.background = barColor;
            }
            if (value) {
                value.textContent = occupancy + '%';
            }
        }
    });

    // Update flow statistics based on total occupancy
    const totalOccupancy = Object.values(zones).reduce((sum, z) => sum + z.occupancy, 0) / 4;
    const entriesPerMin = Math.round((100 - totalOccupancy) * 0.8); // More entries when less crowded
    const exitsPerMin = Math.round((totalOccupancy / 100) * 25); // More exits when crowded
    const netFlow = entriesPerMin - exitsPerMin;

    const flowEntries = document.getElementById('flow-entries');
    const flowExits = document.getElementById('flow-exits');
    const flowNet = document.getElementById('flow-net');

    if (flowEntries) flowEntries.textContent = entriesPerMin + ' people';
    if (flowExits) flowExits.textContent = exitsPerMin + ' people';
    if (flowNet) flowNet.textContent = (netFlow > 0 ? '+' : '') + netFlow + ' people/min';
}

// Generate dynamic alerts based on mode and occupancy
function updateAlerts() {
    if (!venueData || !venueData.zones) return;

    const alertsList = document.getElementById('alerts-list');
    if (!alertsList) return;

    alertsList.innerHTML = ''; // Clear existing alerts
    const alerts = [];
    const zones = venueData.zones;
    const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Generate alerts based on occupancy thresholds
    Object.keys(zones).forEach(zoneName => {
        const zone = zones[zoneName];
        const displayName = zoneName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        if (zone.occupancy > 90) {
            alerts.push({
                type: 'critical',
                icon: '🔴',
                title: `${displayName} - CRITICAL CAPACITY`,
                message: `Zone at ${zone.occupancy}% capacity. IMMEDIATE ACTION REQUIRED. Restrict entries and reroute traffic.`,
                priority: 1
            });
        } else if (zone.occupancy > 75) {
            alerts.push({
                type: 'warning',
                icon: '⚠️',
                title: `${displayName} - Near Capacity`,
                message: `Zone at ${zone.occupancy}% capacity. ${zone.waitTime} min wait time. Consider opening additional services.`,
                priority: 2
            });
        } else if (zone.occupancy > 50 && zone.waitTime > 20) {
            alerts.push({
                type: 'warning',
                icon: '⚠️',
                title: `${displayName} - High Wait Time`,
                message: `Wait time: ${zone.waitTime} minutes. Recommend staff reallocation.`,
                priority: 3
            });
        } else if (zone.incidents && zone.incidents > 0) {
            alerts.push({
                type: 'warning',
                icon: '⚠️',
                title: `${displayName} - Incidents Reported`,
                message: `${zone.incidents} incident(s) reported in this zone.`,
                priority: 4
            });
        }
    });

    // Add mode-specific alerts
    const currentMode = document.getElementById('modeSelector')?.value || 'realtime';
    if (currentMode.includes('evacuation')) {
        alerts.unshift({
            type: 'critical',
            icon: '🚨',
            title: 'EMERGENCY EVACUATION',
            message: 'Evacuation mode activated. All staff assist with orderly exit.',
            priority: 0
        });
    } else if (currentMode.includes('peak')) {
        alerts.unshift({
            type: 'warning',
            icon: '📊',
            title: 'Peak Hour Operations',
            message: 'Venue operating at peak capacity. All services at maximum throughput.',
            priority: 1
        });
    } else if (currentMode.includes('low')) {
        if (alerts.length === 0) {
            alerts.push({
                type: 'success',
                icon: '✓',
                title: 'Normal Operations',
                message: 'All zones operating normally. No issues detected.',
                priority: 5
            });
        }
    } else {
        // Realtime mode - only show if there are issues
        if (alerts.length === 0) {
            alerts.push({
                type: 'info',
                icon: 'ℹ️',
                title: 'System Status',
                message: 'All systems operational. Real-time monitoring active.',
                priority: 5
            });
        }
    }

    // Sort by priority and render
    alerts.sort((a, b) => a.priority - b.priority);
    alerts.slice(0, 6).forEach(alert => {
        const alertDiv = document.createElement('div');
        const typeClass = alert.type === 'critical' ? 'alert-warning' : alert.type === 'success' ? 'alert-success' : alert.type === 'info' ? 'alert-info' : 'alert-warning';
        alertDiv.className = `alert ${typeClass}`;
        alertDiv.innerHTML = `
            <div class="alert-icon">${alert.icon}</div>
            <div class="alert-content">
                <strong>${alert.title}</strong>
                <p>${alert.message}</p>
                <small>${timestamp}</small>
            </div>
            <button class="alert-close" onclick="this.parentElement.style.display='none';">✕</button>
        `;
        alertsList.appendChild(alertDiv);
    });
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
