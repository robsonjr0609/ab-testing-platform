require('dotenv').config();
const path = require('path');

const USE_SQLITE = process.env.USE_SQLITE === 'true';

let db;

if (USE_SQLITE) {
    // ---- LOCAL DEV: SQLite ----
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.resolve(__dirname, 'ab_testing.db');
    const sqliteDb = new sqlite3.Database(dbPath, (err) => {
        if (err) console.error('Error opening SQLite database', err.message);
        else {
            console.log('Connected to SQLite database.');
            initSqlite(sqliteDb);
        }
    });

    function initSqlite(d) {
        d.serialize(() => {
            d.run(`CREATE TABLE IF NOT EXISTS experiments (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT DEFAULT 'running',
                target_url TEXT NOT NULL,
                goals TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            d.run(`CREATE TABLE IF NOT EXISTS variants (
                id TEXT PRIMARY KEY,
                experiment_id TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                content TEXT,
                weight INTEGER DEFAULT 50,
                FOREIGN KEY (experiment_id) REFERENCES experiments(id)
            )`);
            d.run(`CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                experiment_id TEXT NOT NULL,
                variant_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                goal_id TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            console.log('SQLite tables initialized.');
        });
    }

    // Wrap SQLite to expose a unified interface
    db = {
        query: (sql, params) => new Promise((resolve, reject) => {
            // Translate $1,$2 -> ?,? for SQLite
            const sqliteSql = sql.replace(/\$\d+/g, '?');
            if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH')) {
                sqliteDb.all(sqliteSql, params || [], (err, rows) => {
                    if (err) reject(err);
                    else resolve({ rows });
                });
            } else {
                sqliteDb.run(sqliteSql, params || [], function (err) {
                    if (err) reject(err);
                    else resolve({ rows: [], lastID: this.lastID });
                });
            }
        })
    };

} else {
    // ---- PRODUCTION: PostgreSQL ----
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    pool.connect()
        .then(client => {
            console.log('Connected to PostgreSQL database.');
            return initPostgres(client).finally(() => client.release());
        })
        .catch(err => console.error('PostgreSQL connection error:', err.message));

    async function initPostgres(client) {
        await client.query(`CREATE TABLE IF NOT EXISTS experiments (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            status TEXT DEFAULT 'running',
            target_url TEXT NOT NULL,
            goals TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )`);
        await client.query(`CREATE TABLE IF NOT EXISTS variants (
            id TEXT PRIMARY KEY,
            experiment_id TEXT NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            content TEXT,
            weight INTEGER DEFAULT 50,
            FOREIGN KEY (experiment_id) REFERENCES experiments(id)
        )`);
        await client.query(`CREATE TABLE IF NOT EXISTS events (
            id SERIAL PRIMARY KEY,
            experiment_id TEXT NOT NULL,
            variant_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            goal_id TEXT,
            timestamp TIMESTAMPTZ DEFAULT NOW()
        )`);
        console.log('PostgreSQL tables initialized.');
    }

    db = { query: (sql, params) => pool.query(sql, params) };
}

module.exports = db;
