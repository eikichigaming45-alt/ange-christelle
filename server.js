const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
    host: 'aws-0-eu-west-2.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.euqnxhfzivikoxkzwsxi',
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
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
        const adminHash = await bcrypt.hash('admin2026', 10);
        await pool.query(`INSERT INTO users (username, password, role) VALUES ('admin', \$1, 'admin') ON CONFLICT (username) DO NOTHING;`, [adminHash]);
        const angeHash = await bcrypt.hash('ange2026', 10);
        await pool.query(`INSERT INTO users (username, password, role) VALUES ('ange-christelle', \$1, 'user') ON CONFLICT (username) DO NOTHING;`, [angeHash]);
        console.log('Base de données initialisée !');
    } catch (err) {
        console.error('Erreur BDD :', err.message);
    }
}
initDB();

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = \$1', [username]);
        if (result.rows.length === 0) return res.status(401).json({ success: false, message: 'Utilisateur inconnu' });
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (match) res.json({ success: true, role: user.role });
        else res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Liste de références bibliques variées
const references = [
    'john 3:16', 'psalm 23:1', 'romans 8:28', 'philippians 4:13',
    'isaiah 40:31', 'jeremiah 29:11', 'psalm 46:1', 'matthew 11:28',
    'john 14:6', 'romans 12:2', 'psalm 27:1', 'proverbs 3:5',
    'matthew 5:9', '1corinthians 13:4', 'psalm 121:1', 'john 15:13',
    'romans 5:8', 'galatians 5:22', 'ephesians 4:32', 'james 1:17',
    'hebrews 11:1', '1john 4:19', 'psalm 34:18', 'matthew 6:33',
    'isaiah 41:10', 'psalm 139:14', '2corinthians 12:9', 'luke 6:38',
    'psalm 91:1', 'revelation 21:4', 'john 10:10', 'romans 15:13'
];

app.get('/api/priere', (req, res) => {
    const ref = references[Math.floor(Math.random() * references.length)];
    const url = `https://bible-api.com/${encodeURIComponent(ref)}?translation=louis_segond`;

    https.get(url, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
            try {
                const json = JSON.parse(data);
                res.json({
                    reference: json.reference,
                    texte: json.text.trim()
                });
            } catch {
                res.json({ reference: 'Philippiens 4:13', texte: "Je puis tout par celui qui me fortifie." });
            }
        });
    }).on('error', () => {
        res.json({ reference: 'Philippiens 4:13', texte: "Je puis tout par celui qui me fortifie." });
    });
});

app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
