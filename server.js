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
        const mode = currentMode.replace('demo-', '');
        res.json({
            ...demoModes[mode],
            timestamp: new Date(),
            mode: 'demo',
            demoType: mode
        });
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
        const mode = currentMode.replace('demo-', '');
        const zone = demoModes[mode].zones[zoneName];
        if (zone) {
            res.json({ zone: zoneName, ...zone, timestamp: new Date(), mode: 'demo', demoType: mode });
        } else {
            res.status(404).json({ error: 'Zone not found' });
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
        const mode = currentMode.replace('demo-', '');
        res.json({
            zones: demoModes[mode].zones,
            timestamp: new Date(),
            totalAttendees: demoModes[mode].totalAttendees,
            maxCapacity: demoModes[mode].maxCapacity,
            mode: 'demo',
            demoType: mode
        });
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
        data: currentMode === 'realtime' ? venueData : demoModes[currentMode.replace('demo-', '')],
        mode: currentMode
    }));

    // Send updates every 3 seconds
    const interval = setInterval(() => {
        if (currentMode === 'realtime') {
            updateRealtimeData();
        }
        
        const dataToSend = currentMode === 'realtime' ? venueData : demoModes[currentMode.replace('demo-', '')];
        
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
                    data: currentMode === 'realtime' ? venueData : demoModes[currentMode.replace('demo-', '')]
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
