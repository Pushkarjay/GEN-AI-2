const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Avoid stale shell caching of the app entry and service worker.
app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html' || req.path === '/sw.js') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

// Serve hashed static assets with long cache; HTML/SW are handled by no-store above.
app.use(express.static(path.join(__dirname), {
    setHeaders: (res, filePath) => {
        const base = path.basename(filePath);
        const isVersionedAsset = /\.(\d+)\.(css|js)$/.test(base);
        if (isVersionedAsset) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

let currentMode = 'realtime';

const venueData = {
    totalAttendees: 4250,
    maxCapacity: 8000,
    avgWaitTime: 8,
    timestamp: new Date(),
    zones: {
        entrance: { occupancy: 25, waitTime: 2, incidents: 0, entries: 2, crowd: 'Low', maxCapacity: 500, staffMembers: 5 },
        'main-arena': { occupancy: 68, waitTime: 0, incidents: 0, entries: 4, crowd: 'Medium', maxCapacity: 5000, staffMembers: 12 },
        'food-court': { occupancy: 85, waitTime: 35, incidents: 1, entries: 1, crowd: 'High', maxCapacity: 800, staffMembers: 8 },
        parking: { occupancy: 55, waitTime: 12, incidents: 0, entries: 3, crowd: 'Medium', maxCapacity: 2000, staffMembers: 3 },
        restrooms: { occupancy: 32, waitTime: 5, incidents: 0, entries: 2, crowd: 'Low', maxCapacity: 200, staffMembers: 2 }
    },
    events: [
        { id: 1, zone: 'food-court', type: 'overcrowding', severity: 'high', timestamp: new Date(), message: 'High occupancy in food court' },
        { id: 2, zone: 'parking', type: 'warning', severity: 'medium', timestamp: new Date(Date.now() - 300000), message: 'Parking lot at 55% capacity' }
    ]
};

const demoModes = {
    'demo-peak': {
        totalAttendees: 7500,
        maxCapacity: 8000,
        avgWaitTime: 25,
        zones: {
            entrance: { occupancy: 95, waitTime: 45, incidents: 2, entries: 2, crowd: 'High', maxCapacity: 500, staffMembers: 12 },
            'main-arena': { occupancy: 92, waitTime: 5, incidents: 0, entries: 4, crowd: 'High', maxCapacity: 5000, staffMembers: 15 },
            'food-court': { occupancy: 98, waitTime: 60, incidents: 3, entries: 1, crowd: 'High', maxCapacity: 800, staffMembers: 10 },
            parking: { occupancy: 89, waitTime: 25, incidents: 1, entries: 3, crowd: 'High', maxCapacity: 2000, staffMembers: 4 },
            restrooms: { occupancy: 87, waitTime: 15, incidents: 0, entries: 2, crowd: 'High', maxCapacity: 200, staffMembers: 3 }
        }
    },
    'demo-low': {
        totalAttendees: 1500,
        maxCapacity: 8000,
        avgWaitTime: 2,
        zones: {
            entrance: { occupancy: 15, waitTime: 1, incidents: 0, entries: 2, crowd: 'Low', maxCapacity: 500, staffMembers: 2 },
            'main-arena': { occupancy: 25, waitTime: 0, incidents: 0, entries: 4, crowd: 'Low', maxCapacity: 5000, staffMembers: 5 },
            'food-court': { occupancy: 18, waitTime: 3, incidents: 0, entries: 1, crowd: 'Low', maxCapacity: 800, staffMembers: 2 },
            parking: { occupancy: 20, waitTime: 2, incidents: 0, entries: 3, crowd: 'Low', maxCapacity: 2000, staffMembers: 1 },
            restrooms: { occupancy: 10, waitTime: 1, incidents: 0, entries: 2, crowd: 'Low', maxCapacity: 200, staffMembers: 1 }
        }
    },
    'demo-evacuation': {
        totalAttendees: 5000,
        maxCapacity: 8000,
        avgWaitTime: 120,
        zones: {
            entrance: { occupancy: 78, waitTime: 180, incidents: 4, entries: 2, crowd: 'High', maxCapacity: 500, staffMembers: 20 },
            'main-arena': { occupancy: 60, waitTime: 120, incidents: 2, entries: 4, crowd: 'High', maxCapacity: 5000, staffMembers: 25 },
            'food-court': { occupancy: 40, waitTime: 60, incidents: 1, entries: 1, crowd: 'Medium', maxCapacity: 800, staffMembers: 8 },
            parking: { occupancy: 95, waitTime: 180, incidents: 3, entries: 3, crowd: 'High', maxCapacity: 2000, staffMembers: 15 },
            restrooms: { occupancy: 50, waitTime: 30, incidents: 0, entries: 2, crowd: 'Medium', maxCapacity: 200, staffMembers: 2 }
        }
    }
};

function predictCrowd(current, zones) {
    const growthFactor = 1 + (Math.random() * 0.1 - 0.05);
    const zonePressure = Object.values(zones).reduce((acc, z) => acc + z.occupancy, 0) / (Object.keys(zones).length * 100);
    const predicted = Math.round(current * growthFactor * (1 + zonePressure * 0.1));
    return Math.min(venueData.maxCapacity, predicted);
}

function generateInsight(data) {
    if (data.events.some(e => e.severity === 'high')) return 'High-severity event detected. Prioritize immediate response.';
    if (data.predicted > data.totalAttendees * 1.15) return 'Significant crowd surge expected. Prepare increased flow capacity.';
    if (data.avgWaitTime > 20) return 'Average wait time is high. Redirect guests from congested zones.';
    return 'System stable. Crowd flow is optimal.';
}

function getBestExit(zones) {
    const exits = ['entrance', 'parking'];
    return exits
        .map(zone => ({ zone, score: zones[zone].occupancy + zones[zone].waitTime / 5 }))
        .sort((a, b) => a.score - b.score)[0].zone;
}

function simulateRealWorldSignals() {
    return {
        ticketScansPerMin: Math.floor(Math.random() * 100) + 20,
        cctvAnomalies: Math.random() > 0.95 ? 1 : 0,
        publicTransportLoad: Math.floor(Math.random() * 40) + 50
    };
}

function updateRealtimeData() {
    venueData.timestamp = new Date();
    venueData.totalAttendees = Math.max(0, Math.min(venueData.maxCapacity, venueData.totalAttendees + Math.floor(Math.random() * 20 - 8)));

    Object.keys(venueData.zones).forEach((zone) => {
        const z = venueData.zones[zone];
        z.occupancy = Math.max(0, Math.min(100, z.occupancy + Math.floor(Math.random() * 6 - 2)));
        z.waitTime = Math.max(0, Math.min(120, Math.round(z.waitTime + (z.occupancy / 10) + (Math.random() * 4 - 2))));

        if (z.occupancy > 80) z.crowd = 'High';
        else if (z.occupancy > 50) z.crowd = 'Medium';
        else z.crowd = 'Low';
    });

    const totalWait = Object.values(venueData.zones).reduce((sum, z) => sum + z.waitTime, 0);
    venueData.avgWaitTime = Math.round(totalWait / Object.keys(venueData.zones).length);
}

function getCurrentModeData() {
    if (currentMode === 'realtime') return venueData;
    return demoModes[currentMode] || venueData;
}

function buildPayload() {
    const base = getCurrentModeData();
    return {
        ...base,
        predicted: predictCrowd(base.totalAttendees, base.zones),
        insight: generateInsight({ ...base, predicted: predictCrowd(base.totalAttendees, base.zones) }),
        bestExit: getBestExit(base.zones),
        signals: simulateRealWorldSignals(),
        timestamp: new Date(),
        mode: currentMode
    };
}

function broadcast(json) {
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(json);
        }
    }
}

app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', mode: currentMode, timestamp: new Date() });
});

app.get('/api/mode', (_req, res) => {
    res.json({ currentMode: currentMode, mode: currentMode });
});

app.post('/api/mode', (req, res) => {
    const { mode } = req.body || {};
    if (!['realtime', 'demo-peak', 'demo-low', 'demo-evacuation'].includes(mode)) {
        res.status(400).json({ error: 'Invalid mode' });
        return;
    }

    currentMode = mode;
    const data = buildPayload();
    broadcast(JSON.stringify({ type: 'modeChanged', mode: currentMode, data }));
    res.json({ success: true, currentMode: currentMode, mode: currentMode, message: `Mode switched to ${mode}` });
});

app.get('/api/venue/data', (_req, res) => {
    res.json(buildPayload());
});

// Backward-compatible alias used by some client versions.
app.get('/api/venue-data', (_req, res) => {
    res.json(buildPayload());
});

wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'initial', data: buildPayload(), mode: currentMode }));

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw.toString());
            if (msg && msg.type === 'modeChange' && msg.mode) {
                currentMode = msg.mode;
                ws.send(JSON.stringify({ type: 'modeChanged', currentMode: currentMode, data: buildPayload() }));
            }
        } catch (_err) {
            // Ignore malformed websocket messages.
        }
    });
});

setInterval(() => {
    if (currentMode === 'realtime') updateRealtimeData();
    broadcast(JSON.stringify({ type: 'update', data: buildPayload(), mode: currentMode, timestamp: new Date() }));
}, 3000);

app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`VenueFlow server running on port ${PORT}`);
});
