const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    host: 'aws-0-eu-west-2.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.euqnxhfzivikoxkzwsxi',
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS profiles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                prenom VARCHAR(100),
                nom VARCHAR(100),
                date_naissance DATE,
                email VARCHAR(150),
                telephone VARCHAR(30),
                profession VARCHAR(150),
                note TEXT,
                photo TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS widget_order (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                ordre TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS taches (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                titre VARCHAR(255) NOT NULL,
                date DATE,
                heure TIME,
                recurrence VARCHAR(20) DEFAULT 'none',
                faite BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS anniversaires (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                prenom VARCHAR(100) NOT NULL,
                nom VARCHAR(100),
                jour INTEGER NOT NULL,
                mois INTEGER NOT NULL,
                annee INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                subscription TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Nouvelles tables : Suivi du cycle & Rendez-vous médicaux
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cycles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                date_debut DATE NOT NULL,
                duree_regles INTEGER DEFAULT 5,
                duree_cycle INTEGER DEFAULT 28,
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cycle_journal (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                humeur VARCHAR(50),
                symptomes TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS rendezvous (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                titre VARCHAR(255) NOT NULL,
                date_rdv TIMESTAMP NOT NULL,
                praticien VARCHAR(255),
                lieu VARCHAR(255),
                type_rdv VARCHAR(100),
                notes TEXT,
                rappel_active BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        const adminHash = await bcrypt.hash('admin2026', 10);
        await pool.query(`INSERT INTO users (username, password, role) VALUES ('admin', \\$1, 'admin') ON CONFLICT (username) DO NOTHING;`, [adminHash]);
        const angeHash = await bcrypt.hash('ange2026', 10);
        await pool.query(`INSERT INTO users (username, password, role) VALUES ('ange-christelle', \\$1, 'user') ON CONFLICT (username) DO NOTHING;`, [angeHash]);
        console.log('Base de données initialisée !');
    } catch (err) {
        console.error('Erreur BDD :', err.message);
    }
}

module.exports = { pool, initDB };
