const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Venue data state
let venueData = {
    totalAttendees: 4250,
    maxCapacity: 8000,
    avgWaitTime: 8,
    timestamp: new Date(),
    zones: {
        entrance: {
            occupancy: 25,
            waitTime: 2,
            incidents: 0,
            entries: 2,
            crowd: 'Low',
            maxCapacity: 500,
            staffMembers: 5
        },
        'main-arena': {
            occupancy: 68,
            waitTime: 0,
            incidents: 0,
            entries: 4,
            crowd: 'Medium',
            maxCapacity: 5000,
            staffMembers: 12
        },
        'food-court': {
            occupancy: 85,
            waitTime: 35,
            incidents: 1,
            entries: 1,
            crowd: 'High',
            maxCapacity: 800,
            staffMembers: 8
        },
        'parking': {
            occupancy: 55,
            waitTime: 12,
            incidents: 0,
            entries: 3,
            crowd: 'Medium',
            maxCapacity: 2000,
            staffMembers: 3
        },
        'restrooms': {
            occupancy: 32,
            waitTime: 5,
            incidents: 0,
            entries: 2,
            crowd: 'Low',
            maxCapacity: 200,
            staffMembers: 2
        }
    },
    events: [
        { id: 1, zone: 'food-court', type: 'overcrowding', severity: 'high', timestamp: new Date(), message: 'High occupancy in food court' },
        { id: 2, zone: 'parking', type: 'warning', severity: 'medium', timestamp: new Date(Date.now() - 300000), message: 'Parking lot at 55% capacity' }
    ]
};

// Demo mode data for showcase
const demoModes = {
    peakHour: {
        totalAttendees: 7500,
        maxCapacity: 8000,
        avgWaitTime: 25,
        zones: {
            entrance: { occupancy: 95, waitTime: 45, incidents: 2, entries: 2, crowd: 'High', maxCapacity: 500, staffMembers: 12 },
            'main-arena': { occupancy: 92, waitTime: 5, incidents: 0, entries: 4, crowd: 'High', maxCapacity: 5000, staffMembers: 15 },
            'food-court': { occupancy: 98, waitTime: 60, incidents: 3, entries: 1, crowd: 'High', maxCapacity: 800, staffMembers: 10 },
            'parking': { occupancy: 89, waitTime: 25, incidents: 1, entries: 3, crowd: 'High', maxCapacity: 2000, staffMembers: 4 },
            'restrooms': { occupancy: 87, waitTime: 15, incidents: 0, entries: 2, crowd: 'High', maxCapacity: 200, staffMembers: 3 }
        }
    },
    lowOccupancy: {
        totalAttendees: 1500,
        maxCapacity: 8000,
        avgWaitTime: 2,
        zones: {
            entrance: { occupancy: 15, waitTime: 1, incidents: 0, entries: 2, crowd: 'Low', maxCapacity: 500, staffMembers: 2 },
            'main-arena': { occupancy: 25, waitTime: 0, incidents: 0, entries: 4, crowd: 'Low', maxCapacity: 5000, staffMembers: 5 },
            'food-court': { occupancy: 18, waitTime: 3, incidents: 0, entries: 1, crowd: 'Low', maxCapacity: 800, staffMembers: 2 },
            'parking': { occupancy: 20, waitTime: 2, incidents: 0, entries: 3, crowd: 'Low', maxCapacity: 2000, staffMembers: 1 },
            'restrooms': { occupancy: 10, waitTime: 1, incidents: 0, entries: 2, crowd: 'Low', maxCapacity: 200, staffMembers: 1 }
        }
    },
    emergencyEvacuation: {
        totalAttendees: 5000,
        maxCapacity: 8000,
        avgWaitTime: 120,
        zones: {
            entrance: { occupancy: 78, waitTime: 180, incidents: 4, entries: 2, crowd: 'High', maxCapacity: 500, staffMembers: 20 },
            'main-arena': { occupancy: 60, waitTime: 120, incidents: 2, entries: 4, crowd: 'High', maxCapacity: 5000, staffMembers: 25 },
            'food-court': { occupancy: 40, waitTime: 60, incidents: 1, entries: 1, crowd: 'Medium', maxCapacity: 800, staffMembers: 8 },
            'parking': { occupancy: 95, waitTime: 180, incidents: 3, entries: 3, crowd: 'High', maxCapacity: 2000, staffMembers: 15 },
            'restrooms': { occupancy: 50, waitTime: 30, incidents: 0, entries: 2, crowd: 'Medium', maxCapacity: 200, staffMembers: 2 }
        }
    }
};

let currentMode = 'realtime'; // 'realtime', 'demo-peak', 'demo-low', 'demo-evacuation'
let demoMode = null;

// Map mode names to demo object keys
const modeKeyMap = {
    'demo-peak': 'peakHour',
    'demo-low': 'lowOccupancy',
    'demo-evacuation': 'emergencyEvacuation'
};

// Helper function to get data for current mode
function getCurrentModeData() {
    if (currentMode === 'realtime') {
        return venueData;
    } else {
        const demoKey = modeKeyMap[currentMode];
        return (demoKey && demoModes[demoKey]) ? demoModes[demoKey] : venueData;
    }
}

// Function to update real-time data with realistic variations
function updateRealtimeData() {
    venueData.timestamp = new Date();

    // Update total attendees
    const change = Math.floor(Math.random() * 20 - 8);
    venueData.totalAttendees = Math.max(0, Math.min(venueData.totalAttendees + change, venueData.maxCapacity));

    // Update zones
    Object.keys(venueData.zones).forEach(zone => {
        const zoneData = venueData.zones[zone];
        
        // Occupancy with realistic bounds
        const occupancyChange = Math.floor(Math.random() * 6 - 2);
        zoneData.occupancy = Math.max(0, Math.min(100, zoneData.occupancy + occupancyChange));

        // Wait time based on occupancy
        const waitChange = Math.round((zoneData.occupancy / 10) + (Math.random() * 4 - 2));
        zoneData.waitTime = Math.max(0, Math.min(120, zoneData.waitTime + waitChange));

        // Crowd level
        if (zoneData.occupancy > 80) zoneData.crowd = 'High';
        else if (zoneData.occupancy > 50) zoneData.crowd = 'Medium';
        else zoneData.crowd = 'Low';
    });

    // Update average wait time
    const totalWaitTime = Object.values(venueData.zones).reduce((acc, zone) => acc + zone.waitTime, 0);
    venueData.avgWaitTime = Math.round(totalWaitTime / Object.keys(venueData.zones).length);
}

// --- INSANE LEVEL UPGRADES ---

// 1. AI Crowd Prediction
function predictCrowd(current, zones) {
    const growthFactor = 1 + (Math.random() * 0.1 - 0.05); // Simulate trend +/- 5%
    const zonePressure = Object.values(zones).reduce((acc, z) => acc + z.occupancy, 0) / (Object.keys(zones).length * 100); // Avg occupancy
    let predicted = Math.round(current * growthFactor * (1 + zonePressure * 0.1));
    return Math.min(venueData.maxCapacity, predicted); // Cap at max capacity
}

// 2. AI Decision Engine
function generateInsight(data) {
    if (data.events.some(e => e.severity === 'high')) {
        return "High-severity event detected! Prioritize immediate response.";
    }
    if (data.predicted > data.totalAttendees * 1.15) {
        return "Significant crowd surge expected. Alert staff and prepare for increased flow.";
    }
    if (data.avgWaitTime > 20) {
        return "High average wait times. Redirect patrons from congested zones.";
    }
    const highOccupancyZones = Object.entries(data.zones).filter(([_, z]) => z.occupancy > 85);
    if (highOccupancyZones.length > 1) {
        return `Multiple zones (${highOccupancyZones.map(z => z[0]).join(', ')}) are nearing capacity. Proactive crowd management required.`;
    }
    return "System stable. Crowd flow is optimal.";
}

// 3. Smart Exit Routing
function getBestExit(zones) {
    // Find the exit zone with the lowest combination of occupancy and wait time
    const exitZones = ['entrance', 'parking']; // Assuming these are the primary exits
    return exitZones.map(zone => ({
        name: zone,
        score: zones[zone].occupancy + (zones[zone].waitTime / 5) // Weight occupancy higher
    })).sort((a, b) => a.score - b.score)[0].name;
}

// 4. Real-World Integration Simulation
function simulateRealWorldSignals() {
    return {
        ticketScansPerMin: Math.floor(Math.random() * 100) + 20,
        cctvAnomalies: Math.random() > 0.95 ? 1 : 0, // 5% chance of an anomaly
        publicTransportLoad: Math.floor(Math.random() * 40) + 50, // 50-90%
    };
}

// --- END INSANE LEVEL UPGRADES ---

// API Endpoints
app.get('/api/mode', (req, res) => {
    res.json({ mode: currentMode });
});

app.post('/api/mode', (req, res) => {
    const { mode } = req.body;
    if (['realtime', 'demo-peak', 'demo-low', 'demo-evacuation'].includes(mode)) {
        currentMode = mode;
        console.log(`Switched to ${mode} mode`);
        broadcast(JSON.stringify({ type: 'modeChange', mode: currentMode }));
        res.status(200).json({ message: `Mode switched to ${mode}` });
    } else {
        res.status(400).json({ error: 'Invalid mode' });
    }
});

app.get('/api/venue-data', (req, res) => {
    let data = getCurrentModeData();
    
    // If in realtime, add the insane upgrades
    if (currentMode === 'realtime') {
        data = {
            ...data,
            predicted: predictCrowd(data.totalAttendees, data.zones),
            insight: generateInsight(data),
            bestExit: getBestExit(data.zones),
            signals: simulateRealWorldSignals()
        };
    }

    res.json(data);
});

// WebSocket Logic
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

setInterval(() => {
    if (currentMode === 'realtime') {
        updateRealtimeData();
    }
    
    let data = getCurrentModeData();

    // Add insane upgrades for broadcasting too
    if (currentMode === 'realtime') {
        data = {
            ...data,
            predicted: predictCrowd(data.totalAttendees, data.zones),
            insight: generateInsight(data),
            bestExit: getBestExit(data.zones),
            signals: simulateRealWorldSignals()
        };
    }
    
    broadcast(JSON.stringify({ type: 'venueDataUpdate', data }));
}, 3000);

wss.on('connection', ws => {
    console.log('Client connected');
    let initialData = getCurrentModeData();
    if (currentMode === 'realtime') {
        initialData = {
            ...initialData,
            predicted: predictCrowd(initialData.totalAttendees, initialData.zones),
            insight: generateInsight(initialData),
            bestExit: getBestExit(initialData.zones),
            signals: simulateRealWorldSignals()
        };
    }
    ws.send(JSON.stringify({ type: 'initialData', data: initialData, mode: currentMode }));
    ws.on('close', () => console.log('Client disconnected'));
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

        // Update crowd level
        if (zoneData.occupancy < 40) {
            zoneData.crowd = 'Low';
        } else if (zoneData.occupancy < 70) {
            zoneData.crowd = 'Medium';
        } else {
            zoneData.crowd = 'High';
        }

        // Wait times based on occupancy
        zoneData.waitTime = Math.round(zoneData.occupancy / 2.5);

        // Random incidents (rare)
        if (Math.random() < 0.05) {
            zoneData.incidents += 1;
        }
    });

    // Calculate average wait time
    const waitTimes = Object.values(venueData.zones).map(z => z.waitTime);
    venueData.avgWaitTime = Math.round(waitTimes.reduce((a, b) => a + b) / waitTimes.length);

    return venueData;
}

// API Routes

// Get current venue data
app.get('/api/venue/data', (req, res) => {
    if (currentMode === 'realtime') {
        res.json(venueData);
    } else {
        const demoKey = modeKeyMap[currentMode];
        if (demoKey && demoModes[demoKey]) {
            res.json({
                ...demoModes[demoKey],
                timestamp: new Date(),
                mode: 'demo',
                demoType: currentMode.replace('demo-', '')
            });
        } else {
            res.json(venueData); // Fallback to realtime
        }
    }
});

// Get specific zone data
app.get('/api/venue/zone/:zoneName', (req, res) => {
    const zoneName = req.params.zoneName;
    if (currentMode === 'realtime') {
        const zone = venueData.zones[zoneName];
        if (zone) {
            res.json({ zone: zoneName, ...zone, timestamp: new Date() });
        } else {
            res.status(404).json({ error: 'Zone not found' });
        }
    } else {
        const demoKey = modeKeyMap[currentMode];
        if (demoKey && demoModes[demoKey]) {
            const zone = demoModes[demoKey].zones[zoneName];
            if (zone) {
                res.json({ zone: zoneName, ...zone, timestamp: new Date(), mode: 'demo', demoType: currentMode.replace('demo-', '') });
            } else {
                res.status(404).json({ error: 'Zone not found' });
            }
        } else {
            res.status(400).json({ error: 'Invalid demo mode' });
        }
    }
});

// Get all zones
app.get('/api/venue/zones', (req, res) => {
    if (currentMode === 'realtime') {
        res.json({
            zones: venueData.zones,
            timestamp: new Date(),
            totalAttendees: venueData.totalAttendees,
            maxCapacity: venueData.maxCapacity
        });
    } else {
        const demoKey = modeKeyMap[currentMode];
        if (demoKey && demoModes[demoKey]) {
            res.json({
                zones: demoModes[demoKey].zones,
                timestamp: new Date(),
                totalAttendees: demoModes[demoKey].totalAttendees,
                maxCapacity: demoModes[demoKey].maxCapacity,
                mode: 'demo',
                demoType: currentMode.replace('demo-', '')
            });
        } else {
            res.status(400).json({ error: 'Invalid demo mode' });
        }
    }
});

// Get events/alerts
app.get('/api/venue/events', (req, res) => {
    res.json({
        events: venueData.events,
        timestamp: new Date()
    });
});

// Update zone capacity (manual override)
app.post('/api/venue/zone/:zoneName/update', (req, res) => {
    const zoneName = req.params.zoneName;
    const { occupancy, waitTime } = req.body;

    if (currentMode === 'realtime' && venueData.zones[zoneName]) {
        if (occupancy !== undefined) venueData.zones[zoneName].occupancy = occupancy;
        if (waitTime !== undefined) venueData.zones[zoneName].waitTime = waitTime;
        res.json({ success: true, zone: zoneName, data: venueData.zones[zoneName] });
    } else {
        res.status(400).json({ error: 'Cannot update in demo mode or zone not found' });
    }
});

// Set mode (realtime or demo)
app.post('/api/mode', (req, res) => {
    const { mode } = req.body;
    if (['realtime', 'demo-peak', 'demo-low', 'demo-evacuation'].includes(mode)) {
        currentMode = mode;
        res.json({ success: true, currentMode: mode });
    } else {
        res.status(400).json({ error: 'Invalid mode' });
    }
});

// Get current mode
app.get('/api/mode', (req, res) => {
    res.json({ currentMode });
});

// WebSocket connection for real-time updates
wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');

    // Send initial data
    ws.send(JSON.stringify({
        type: 'initial',
        data: getCurrentModeData(),
        mode: currentMode
    }));

    // Send updates every 3 seconds
    const interval = setInterval(() => {
        if (currentMode === 'realtime') {
            updateRealtimeData();
        }
        
        const dataToSend = getCurrentModeData();
        
        ws.send(JSON.stringify({
            type: 'update',
            data: dataToSend,
            mode: currentMode,
            timestamp: new Date()
        }));
    }, 3000);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'modeChange') {
                currentMode = data.mode;
                ws.send(JSON.stringify({
                    type: 'modeChanged',
                    currentMode: currentMode,
                    data: getCurrentModeData()
                }));
            }
        } catch (err) {
            console.error('WebSocket message error:', err);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected from WebSocket');
        clearInterval(interval);
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
    });
});

// Real-time data update loop
const dataUpdateInterval = setInterval(() => {
    if (currentMode === 'realtime') {
        updateRealtimeData();
    }
}, 3000);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date(), mode: currentMode });
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`VenueFlow Backend Server running on port ${PORT}`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
    console.log(`HTTP endpoint: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    clearInterval(dataUpdateInterval);
    wss.close();
    server.close();
});

module.exports = server;
