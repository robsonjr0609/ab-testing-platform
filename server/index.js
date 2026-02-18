require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Serve dashboard and tracker as static files
app.use(express.static(path.join(__dirname, '../client')));

// --- HELPERS ---

function normalizeUrl(rawUrl) {
    try {
        const u = new URL(rawUrl);
        const host = u.hostname.replace('127.0.0.1', 'localhost');
        const port = u.port || (u.protocol === 'https:' ? '443' : '80');
        return `${u.protocol}//${host}:${port}${u.pathname}`.replace(/\/$/, '');
    } catch {
        return rawUrl.replace(/\/$/, '');
    }
}

// --- API ROUTES ---

// 1. Get Active Experiments for a URL (used by tracker.js)
app.get('/api/experiments/active', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const { rows: experiments } = await db.query(
            `SELECT id, name, target_url, goals FROM experiments WHERE status = 'running'`
        );

        const normalizedIncoming = normalizeUrl(url);
        const matched = experiments.filter(exp =>
            normalizedIncoming.startsWith(normalizeUrl(exp.target_url))
        );

        if (matched.length === 0) return res.json([]);

        const ids = matched.map(e => e.id);
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
        const { rows: variants } = await db.query(
            `SELECT * FROM variants WHERE experiment_id IN (${placeholders})`, ids
        );

        const result = matched.map(exp => ({
            ...exp,
            variants: variants.filter(v => v.experiment_id === exp.id)
        }));

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Track Event (impression / conversion)
app.post('/api/track', async (req, res) => {
    const { experiment_id, variant_id, session_id, event_type, goal_id } = req.body;
    if (!experiment_id || !variant_id || !session_id || !event_type) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        await db.query(
            `INSERT INTO events (experiment_id, variant_id, session_id, event_type, goal_id) VALUES ($1, $2, $3, $4, $5)`,
            [experiment_id, variant_id, session_id, event_type, goal_id || null]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 3. List all experiments
app.get('/api/experiments', async (req, res) => {
    try {
        const { rows } = await db.query(`SELECT * FROM experiments ORDER BY created_at DESC`);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Create experiment
app.post('/api/experiments', async (req, res) => {
    const { name, target_url, variants, goals } = req.body;
    if (!name || !target_url || !variants || variants.length === 0) {
        return res.status(400).json({ error: 'name, target_url and variants are required' });
    }
    const experimentId = uuidv4();
    try {
        await db.query(
            `INSERT INTO experiments (id, name, target_url, status, goals) VALUES ($1, $2, $3, 'running', $4)`,
            [experimentId, name, target_url, JSON.stringify(goals || [])]
        );
        for (const v of variants) {
            await db.query(
                `INSERT INTO variants (id, experiment_id, name, type, content, weight) VALUES ($1, $2, $3, $4, $5, $6)`,
                [uuidv4(), experimentId, v.name, v.type, v.content, v.weight || 50]
            );
        }
        res.json({ success: true, experimentId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 5. Update experiment status (pause/resume)
app.patch('/api/experiments/:id', async (req, res) => {
    const { status } = req.body;
    try {
        await db.query(`UPDATE experiments SET status = $1 WHERE id = $2`, [status, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Delete experiment
app.delete('/api/experiments/:id', async (req, res) => {
    try {
        await db.query(`DELETE FROM events WHERE experiment_id = $1`, [req.params.id]);
        await db.query(`DELETE FROM variants WHERE experiment_id = $1`, [req.params.id]);
        await db.query(`DELETE FROM experiments WHERE id = $1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Get stats for an experiment
app.get('/api/stats/:experimentId', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT
                v.id as variant_id,
                v.name as variant_name,
                COUNT(CASE WHEN e.event_type = 'impression' THEN 1 END) as impressions,
                COUNT(CASE WHEN e.event_type = 'conversion' THEN 1 END) as conversions
            FROM variants v
            LEFT JOIN events e ON v.id = e.variant_id AND e.experiment_id = $1
            WHERE v.experiment_id = $1
            GROUP BY v.id, v.name
        `, [req.params.experimentId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve tracker.js with dynamic API_BASE (replaces localhost with actual server URL)
app.get('/tracker.js', (req, res) => {
    const fs = require('fs');
    const trackerPath = path.join(__dirname, '../client/tracker.js');
    let content = fs.readFileSync(trackerPath, 'utf8');
    // Replace hardcoded localhost with the actual server origin
    const serverOrigin = `${req.protocol}://${req.get('host')}`;
    content = content.replace(/http:\/\/localhost:3000\/api/g, `${serverOrigin}/api`);
    res.setHeader('Content-Type', 'application/javascript');
    res.send(content);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}/dashboard.html`);
    console.log(`Mode: ${process.env.USE_SQLITE === 'true' ? 'SQLite (local)' : 'PostgreSQL (production)'}`);
});
