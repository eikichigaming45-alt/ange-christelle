const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Connexion à la base de données Supabase
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Création automatique de la table des utilisateurs au démarrage
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

        // Créer un compte admin par défaut si inexistant (mdp: admin2026)
        const adminHash = await bcrypt.hash('admin2026', 10);
        await pool.query(`
            INSERT INTO users (username, password, role) 
            VALUES ('admin', \$1, 'admin') 
            ON CONFLICT (username) DO NOTHING;
        `, [adminHash]);

        // Créer le compte d'Ange Christelle par défaut si inexistant (mdp: ange2026)
        const angeHash = await bcrypt.hash('ange2026', 10);
        await pool.query(`
            INSERT INTO users (username, password, role) 
            VALUES ('ange-christelle', \$1, 'user') 
            ON CONFLICT (username) DO NOTHING;
        `, [angeHash]);

        console.log('Base de données initialisée avec succès !');
    } catch (err) {
        console.error('Erreur initialisation BDD :', err);
    }
}
initDB();

// Route de connexion
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = \$1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Utilisateur inconnu' });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);

        if (match) {
            res.json({ success: true, role: user.role, message: 'Connexion réussie' });
        } else {
            res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
