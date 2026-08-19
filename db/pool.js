// ============================================================
// db/pool.js
// Connexion PostgreSQL via Supabase + initialisation des tables.
// Utilise DATABASE_URL (variable Render) — pas de config fragmentée.
// Ne contient aucune logique métier ni seed de données.
// ============================================================

const { Pool } = require('pg');

// ── Connexion ─────────────────────────────────────────────────
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

// ── Création des tables au démarrage ──────────────────────────
// CREATE TABLE IF NOT EXISTS = sans effet si la table existe déjà.
// Les ALTER TABLE en fin de fonction ajoutent les colonnes manquantes
// sur les bases existantes sans casser les données.
async function initDB() {
    try {

        // ── Utilisateurs ──────────────────────────────────────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id                   SERIAL PRIMARY KEY,
                username             VARCHAR(50)  UNIQUE NOT NULL,
                password             VARCHAR(255) NOT NULL,
                role                 VARCHAR(20)  NOT NULL,
                must_change_password BOOLEAN      DEFAULT FALSE,
                last_login           TIMESTAMP
            );
        `);

        // ── Profils ───────────────────────────────────────────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS profiles (
                id               SERIAL PRIMARY KEY,
                user_id          INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                prenom           VARCHAR(100),
                nom              VARCHAR(100),
                date_naissance   DATE,
                email            VARCHAR(150),
                telephone        VARCHAR(30),
                profession       VARCHAR(150),
                note             TEXT,
                photo            TEXT,
                widgets_visibles TEXT[],
                created_at       TIMESTAMP DEFAULT NOW(),
                updated_at       TIMESTAMP DEFAULT NOW()
            );
        `);

        // ── Ordre des widgets ─────────────────────────────────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS widget_order (
                id         SERIAL PRIMARY KEY,
                user_id    INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                ordre      TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // ── Tâches ────────────────────────────────────────────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS taches (
                id           SERIAL PRIMARY KEY,
                user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
                titre        VARCHAR(255) NOT NULL,
                date         DATE,
                heure        TIME,
                recurrence   VARCHAR(20)  DEFAULT 'none',
                rappel_avant INTEGER      DEFAULT 0,
                faite        BOOLEAN      DEFAULT FALSE,
                created_at   TIMESTAMP    DEFAULT NOW()
            );
        `);

        // ── Anniversaires ─────────────────────────────────────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS anniversaires (
                id         SERIAL PRIMARY KEY,
                user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
                prenom     VARCHAR(100) NOT NULL,
                nom        VARCHAR(100),
                jour       INTEGER NOT NULL,
                mois       INTEGER NOT NULL,
                annee      INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // ── Abonnements push ──────────────────────────────────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id           SERIAL PRIMARY KEY,
                user_id      INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                subscription TEXT      NOT NULL,
                updated_at   TIMESTAMP DEFAULT NOW()
            );
        `);

        // ── Cycles menstruels ─────────────────────────────────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cycles (
                id           SERIAL PRIMARY KEY,
                user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                date_debut   DATE    NOT NULL,
                duree_regles INTEGER DEFAULT 5,
                duree_cycle  INTEGER DEFAULT 28,
                notes        TEXT,
                created_at   TIMESTAMP DEFAULT NOW()
            );
        `);

        // ── Journal de cycle ──────────────────────────────────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cycle_journal (
                id         SERIAL PRIMARY KEY,
                user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                date       DATE    NOT NULL,
                humeur     VARCHAR(50),
                symptomes  TEXT,
                notes      TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, date)
            );
        `);

        // ── Rendez-vous ───────────────────────────────────────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS rendezvous (
                id           SERIAL PRIMARY KEY,
                user_id      INTEGER   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                titre        VARCHAR(255) NOT NULL,
                date_rdv     TIMESTAMP NOT NULL,
                praticien    VARCHAR(255),
                lieu         VARCHAR(255),
                type_rdv     VARCHAR(100),
                notes        TEXT,
                rappel_avant INTEGER   DEFAULT 0,
                created_at   TIMESTAMP DEFAULT NOW()
            );
        `);

        // ── Planning ──────────────────────────────────────────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS planning (
                id           SERIAL PRIMARY KEY,
                user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                date         DATE    NOT NULL,
                type         VARCHAR(50) NOT NULL,
                heure_debut  TIME,
                heure_fin    TIME,
                employeur    VARCHAR(255),
                adresse      VARCHAR(255),
                telephone    VARCHAR(50),
                notes        TEXT,
                rappel_avant INTEGER   DEFAULT 120,
                created_at   TIMESTAMP DEFAULT NOW()
            );
        `);

        // ── Employeurs ────────────────────────────────────────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS planning_employeurs (
                id         SERIAL PRIMARY KEY,
                user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                nom        VARCHAR(255) NOT NULL,
                adresse    VARCHAR(255),
                telephone  VARCHAR(50),
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, nom)
            );
        `);

        // ── Migrations — colonnes ajoutées après création ─────
        // Sans effet si les colonnes existent déjà.
        await pool.query(`ALTER TABLE users      ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN   DEFAULT FALSE;`);
        await pool.query(`ALTER TABLE users      ADD COLUMN IF NOT EXISTS last_login           TIMESTAMP;`);
        await pool.query(`ALTER TABLE taches     ADD COLUMN IF NOT EXISTS rappel_avant         INTEGER   DEFAULT 0;`);
        await pool.query(`ALTER TABLE rendezvous ADD COLUMN IF NOT EXISTS rappel_avant         INTEGER   DEFAULT 0;`);
        await pool.query(`ALTER TABLE profiles   ADD COLUMN IF NOT EXISTS widgets_visibles     TEXT[];`);
        // ✅ Signe du zodiaque — saisi manuellement si pas de date_naissance
        await pool.query(`ALTER TABLE profiles   ADD COLUMN IF NOT EXISTS signe_zodiaque       VARCHAR(20);`);

        console.log('[DB] Tables initialisées.');
    } catch (err) {
        console.error('[DB] Erreur initialisation :', err.message);
    }
}

module.exports = { pool, initDB };
