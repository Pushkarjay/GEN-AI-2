// VenueFlow Frontend - Real-time API Integration
// This connects to the backend server for real-time crowd data

let venueData = {};
let ws = null;
let connectionStatus = 'disconnected';
const API_BASE_URL = typeof window !== 'undefined' && window.location.origin.includes('localhost') ? 'http://localhost:8080' : window.location.origin;
const WS_URL = API_BASE_URL.replace(/http(s?):/, 'ws$1:');

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Set the active button on page load
    const initialView = 'dashboard';
    document.querySelector(`.nav-btn[onclick="switchView('${initialView}')"]`).classList.add('active');
    
    updateTimeInfo();
    setInterval(updateTimeInfo, 1000); // Update time every second

    // Connect and fetch initial data
    connectWebSocket();
    startPollingFallback();

    // Set default mode and fetch data for it
    const modeSelector = document.getElementById('modeSelector');
    if (modeSelector) {
        changeMode(modeSelector.value);
    }
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
                
                if (message.type === 'initialData' || message.type === 'venueDataUpdate') {
                    venueData = message.data;
                    updateAllPages();
                } else if (message.type === 'modeChange') {
                    showNotification(`Switched to ${getModeLabel(message.mode)}`, 'success');
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
        const response = await fetch(`${API_BASE_URL}/api/venue-data`);
        if (response.ok) {
            venueData = await response.json();
            updateAllPages();
            if (connectionStatus === 'disconnected') {
                updateConnectionStatus('connected');
                showNotification('Connection restored via polling.', 'info');
            }
        } else {
            throw new Error(`API request failed with status ${response.status}`);
        }
    } catch (err) {
        console.error('Failed to fetch venue data:', err);
        updateConnectionStatus('disconnected');
    }
}

// A new function to update all visible data at once
function updateAllPages() {
    if (!venueData) return;
    updateMetrics();
    updateZoneDisplays();
    updateQueueDisplays();
    updateZoneAnalytics();
    updateAlerts();
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
            // The backend will broadcast the change, so we just fetch the latest data
            await fetchVenueData();
            showNotification(`Switching to ${getModeLabel(mode)}...`, 'info');
        } else {
            throw new Error(`Failed to switch mode with status ${response.status}`);
        }
    } catch (err) {
        console.error('Failed to change mode:', err);
        showNotification('Error switching mode.', 'error');
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
        
        if (crowdElement) {
            crowdElement.textContent = data.crowd;
            // Reset color
            crowdElement.style.color = '';
            // Remove old classes
            crowdElement.classList.remove('crowd-high', 'crowd-medium', 'crowd-low');

            // Add new class based on crowd level
            if (data.crowd === 'High') {
                crowdElement.classList.add('crowd-high');
            } else if (data.crowd === 'Medium') {
                crowdElement.classList.add('crowd-medium');
            } else {
                crowdElement.classList.add('crowd-low');
            }
        }
    });
}

// Select zone for details
function selectZone(zone) {
    if (!venueData.zones || !venueData.zones[zone]) return;
    
    // This function seems to be for a details view that is not in the final HTML.
    // If it were, we would update it here. For now, it does nothing.
    console.log(`Zone selected: ${zone}`, venueData.zones[zone]);
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
    const activeView = document.getElementById(viewName);
    if (activeView) {
        activeView.classList.add('active');
    }

    // Add active class to clicked button
    const activeButton = document.querySelector(`.nav-btn[onclick="switchView('${viewName}')"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }

    // Refresh data for all views, as data might have updated
    updateAllPages();
}

// Optimize queues
async function optimizeQueues() {
    showNotification('Simulating queue optimization...', 'info');
    // This is a mock function for the demo.
    // In a real system, this would trigger a backend process.
    setTimeout(() => {
        showNotification('✓ Queue optimization simulation complete!', 'success');
    }, 1500);
}

// Clear all alerts
function clearAllAlerts() {
    if (venueData && venueData.events) {
        venueData.events = []; // Clear events locally
    }
    const alertsList = document.getElementById('alerts-list');
    if (alertsList) {
        alertsList.innerHTML = '';
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

    const updateQueueCard = (zoneName, cardPrefix) => {
        const zone = venueData.zones[zoneName];
        if (!zone) return;

        const queueElem = document.getElementById(`${cardPrefix}-queue`);
        const waitElem = document.getElementById(`${cardPrefix}-wait`);
        const progressElem = document.getElementById(`${cardPrefix}-progress`);
        const statusElem = document.getElementById(`${cardPrefix}-status`);

        if (queueElem) queueElem.textContent = Math.round((zone.occupancy / 100) * (zone.maxCapacity / 10));
        if (waitElem) waitElem.textContent = zone.waitTime;
        if (progressElem) progressElem.style.width = zone.occupancy + '%';
        if (statusElem) {
            if (zone.occupancy > 85) {
                statusElem.textContent = 'CRITICAL - Reroute traffic';
                progressElem.style.backgroundColor = '#ea4335';
            } else if (zone.occupancy > 60) {
                statusElem.textContent = 'High - Monitor closely';
                progressElem.style.backgroundColor = '#fbbc04';
            } else {
                statusElem.textContent = 'Normal';
                progressElem.style.backgroundColor = '#34a853';
            }
        }
    };

    updateQueueCard('entrance', 'gates');
    updateQueueCard('food-court', 'food');
    updateQueueCard('restrooms', 'restroom');
    updateQueueCard('parking', 'parking');
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

    zoneNames.forEach(zoneInfo => {
        if (zones[zoneInfo.key]) {
            const occupancy = zones[zoneInfo.key].occupancy;
            const barColor = occupancy > 85 ? '#ea4335' : occupancy > 60 ? '#fbbc04' : '#34a853';
            
            const bar = document.getElementById(zoneInfo.barId);
            const value = document.getElementById(zoneInfo.valueId);
            
            if (bar) {
                bar.style.width = occupancy + '%';
                bar.style.background = barColor;
            }
            if (value) {
                value.textContent = occupancy + '%';
            }
        }
    });

    // Update flow statistics
    const totalAttendees = venueData.totalAttendees || 0;
    const entriesPerMin = Math.round(totalAttendees * (Math.random() * 0.01 + 0.005));
    const exitsPerMin = Math.round(totalAttendees * (Math.random() * 0.005 + 0.002));
    const netFlow = entriesPerMin - exitsPerMin;

    const flowEntries = document.getElementById('flow-entries');
    const flowExits = document.getElementById('flow-exits');
    const flowNet = document.getElementById('flow-net');

    if (flowEntries) flowEntries.textContent = entriesPerMin;
    if (flowExits) flowExits.textContent = exitsPerMin;
    if (flowNet) {
        flowNet.textContent = (netFlow > 0 ? '+' : '') + netFlow;
        flowNet.parentElement.className = netFlow > 0 ? 'stat-box positive' : 'stat-box negative';
    }
}

// Generate dynamic alerts based on mode and occupancy
function updateAlerts() {
    if (!venueData) return;

    const alertsList = document.getElementById('alerts-list');
    if (!alertsList) return;

    alertsList.innerHTML = ''; // Clear existing alerts
    const alerts = venueData.events || [];
    const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Add alerts for high occupancy zones not already in events
    Object.entries(venueData.zones).forEach(([zoneName, zoneData]) => {
        if (zoneData.occupancy > 90 && !alerts.some(a => a.zone === zoneName && a.type === 'overcrowding')) {
            alerts.unshift({
                id: Date.now(),
                zone: zoneName,
                type: 'overcrowding',
                severity: 'high',
                timestamp: new Date(),
                message: `Zone at ${zoneData.occupancy}% capacity. IMMEDIATE ACTION REQUIRED.`
            });
        }
    });

    // Sort alerts by timestamp (newest first)
    alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Display alerts
    if (alerts.length > 0) {
        alerts.forEach(alert => {
            const alertDiv = document.createElement('div');
            const alertType = alert.severity === 'high' ? 'critical' : 'warning';
            alertDiv.className = `alert alert-${alertType}`;
            alertDiv.innerHTML = `
                <div class="alert-icon">${alertType === 'critical' ? '🔴' : '⚠️'}</div>
                <div class="alert-content">
                    <strong>${alert.type.toUpperCase()} in ${alert.zone.replace('-', ' ')}</strong>
                    <p>${alert.message}</p>
                </div>
                <div class="alert-timestamp">${new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            `;
            alertsList.appendChild(alertDiv);
        });
    } else {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'alert alert-info';
        infoDiv.innerHTML = `
            <div class="alert-icon">✅</div>
            <div class="alert-content">
                <strong>System Status: Normal</strong>
                <p>No active alerts. All systems are operating within normal parameters.</p>
            </div>
        `;
        alertsList.appendChild(infoDiv);
    }
}

// Show notification toast
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type} show`;
    notification.textContent = message;
    container.appendChild(notification);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 3000);
}

// --- INSANE LEVEL UPGRADES ---

// Update Performance Page with AI data
function updatePerformancePage() {
    if (!venueData) return;

    // AI Insight
    const aiInsightElem = document.getElementById('aiInsight');
    if (aiInsightElem && venueData.insight) {
        aiInsightElem.textContent = venueData.insight;
    }

    // Predicted Crowd
    const predictedCrowdElem = document.getElementById('predictedCrowd');
    if (predictedCrowdElem && venueData.predicted) {
        predictedCrowdElem.textContent = venueData.predicted.toLocaleString();
    }

    // Best Exit
    const bestExitElem = document.getElementById('bestExit');
    if (bestExitElem && venueData.bestExit) {
        bestExitElem.textContent = venueData.bestExit.replace('-', ' ').toUpperCase();
    }

    // Real-World Signals
    const signalsElem = document.getElementById('realWorldSignals');
    if (signalsElem && venueData.signals) {
        signalsElem.innerHTML = `
            <div>Ticket Scans/min: <strong>${venueData.signals.ticketScansPerMin}</strong></div>
            <div>CCTV Anomalies: <strong>${venueData.signals.cctvAnomalies}</strong></div>
            <div>Transport Load: <strong>${venueData.signals.publicTransportLoad}%</strong></div>
        `;
    }

    // Zone Performance Table
    const tbody = document.getElementById('zone-performance-tbody');
    if (tbody && venueData.zones) {
        tbody.innerHTML = ''; // Clear existing rows
        Object.entries(venueData.zones).forEach(([zoneName, zoneData]) => {
            const efficiency = 100 - Math.round(zoneData.occupancy * 0.5 + zoneData.waitTime * 0.5);
            const status = efficiency > 85 ? '✅ Good' : efficiency > 65 ? '⚠️ Moderate' : '🔴 High';
            const efficiencyColor = efficiency > 85 ? '🟢' : efficiency > 65 ? '🟡' : '🔴';

            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid #e0e0e0';
            row.innerHTML = `
                <td style="padding: 0.75rem;">${zoneName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</td>
                <td style="text-align: center;">${zoneData.occupancy}%</td>
                <td style="text-align: center;">${zoneData.waitTime} min</td>
                <td style="text-align: center;">${status}</td>
                <td style="text-align: center;">${efficiencyColor} ${efficiency}%</td>
            `;
            tbody.appendChild(row);
        });
    }
}


// Personalized User Assistant
function getRecommendation() {
    if (!venueData || !venueData.zones) {
        document.getElementById('recommendation').innerText = "Data not available. Please wait.";
        return;
    }

    const goal = document.getElementById('userGoal').value;
    let suggestion = "";

    if (goal === "exit") {
        suggestion = `For the fastest exit, please use the ${venueData.bestExit.replace('-', ' ')} gate.`;
    } else if (goal === "food") {
        const foodZone = Object.entries(venueData.zones).filter(([name, _]) => name.includes('food')).sort((a, b) => a[1].waitTime - b[1].waitTime)[0];
        suggestion = `Head to the ${foodZone[0].replace('-', ' ')} - it currently has the lowest wait time of ${foodZone[1].waitTime} minutes.`;
    } else if (goal === "restroom") {
        const restroomZone = Object.entries(venueData.zones).filter(([name, _]) => name.includes('restroom')).sort((a, b) => a[1].waitTime - b[1].waitTime)[0];
        suggestion = `The ${restroomZone[0].replace('-', ' ')}s have the shortest queue right now.`;
    }

    document.getElementById('recommendation').innerText = suggestion;
    speakAlert(suggestion); // Voice feedback
}

// Voice Alert System
function speakAlert(message) {
    if ('speechSynthesis' in window) {
        // Cancel any previous speech to prevent overlap
        window.speechSynthesis.cancel();
        const speech = new SpeechSynthesisUtterance(message);
        speech.volume = 1;
        speech.rate = 1.1;
        speech.pitch = 1;
        window.speechSynthesis.speak(speech);
    } else {
        console.log("Speech synthesis not supported in this browser.");
    }
}

// Override the main updateMetrics function to include the new performance page update
// This is no longer needed with the new updateAllPages function
// const originalUpdateMetrics = updateMetrics;
// updateMetrics = function() {
//     originalUpdateMetrics();
//     updatePerformancePage();
// }
// --- END INSANE LEVEL UPGRADES ---

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
