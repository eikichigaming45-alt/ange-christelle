const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

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
        if (match) res.json({ success: true, role: user.role, userId: user.id, username: user.username });
        else res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

app.get('/api/profil', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'userId manquant' });
    try {
        const result = await pool.query('SELECT * FROM profiles WHERE user_id = \$1', [userId]);
        if (result.rows.length === 0) return res.json({ success: true, profil: null });
        res.json({ success: true, profil: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

app.post('/api/profil', async (req, res) => {
    const { userId, prenom, nom, date_naissance, email, telephone, profession, note, photo } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId manquant' });
    try {
        await pool.query(`
            INSERT INTO profiles (user_id, prenom, nom, date_naissance, email, telephone, profession, note, photo, updated_at)
            VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                prenom = \$2, nom = \$3, date_naissance = \$4, email = \$5,
                telephone = \$6, profession = \$7, note = \$8, photo = \$9, updated_at = NOW();
        `, [userId, prenom, nom, date_naissance || null, email, telephone, profession, note, photo]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

const versets = [
    { texte: "Je puis tout par celui qui me fortifie.", ref: "Philippiens 4:13" },
    { texte: "Car je connais les projets que j'ai formés sur vous, projets de paix et non de malheur.", ref: "Jérémie 29:11" },
    { texte: "L'Éternel est mon berger, je ne manquerai de rien.", ref: "Psaume 23:1" },
    { texte: "Toutes choses concourent au bien de ceux qui aiment Dieu.", ref: "Romains 8:28" },
    { texte: "Venez à moi, vous tous qui êtes fatigués et chargés, et je vous donnerai du repos.", ref: "Matthieu 11:28" },
    { texte: "Ne crains rien, car je suis avec toi.", ref: "Ésaïe 41:10" },
    { texte: "Ceux qui se confient en l'Éternel renouvellent leurs forces.", ref: "Ésaïe 40:31" },
    { texte: "L'Éternel est ma lumière et mon salut : de qui aurais-je crainte ?", ref: "Psaume 27:1" },
    { texte: "Confie-toi en l'Éternel de tout ton cœur.", ref: "Proverbes 3:5" },
    { texte: "La foi est une ferme assurance des choses qu'on espère.", ref: "Hébreux 11:1" },
    { texte: "Cherchez premièrement le royaume et la justice de Dieu.", ref: "Matthieu 6:33" },
    { texte: "Mon Dieu pourvoira à tous vos besoins selon sa richesse.", ref: "Philippiens 4:19" },
    { texte: "L'Éternel est proche de ceux qui ont le cœur brisé.", ref: "Psaume 34:19" },
    { texte: "Car Dieu n'a pas donné un esprit de timidité, mais un esprit de force.", ref: "2 Timothée 1:7" },
    { texte: "Je t'aime d'un amour éternel.", ref: "Jérémie 31:3" },
    { texte: "Que la paix de Dieu, qui surpasse toute intelligence, garde vos cœurs.", ref: "Philippiens 4:7" },
    { texte: "Sois fort et courageux. Ne crains point.", ref: "Josué 1:9" },
    { texte: "Heureux les artisans de paix, car ils seront appelés fils de Dieu.", ref: "Matthieu 5:9" },
    { texte: "Si quelqu'un est en Christ, il est une nouvelle créature.", ref: "2 Corinthiens 5:17" },
    { texte: "Celui qui habite sous l'abri du Très-Haut repose à l'ombre du Tout-Puissant.", ref: "Psaume 91:1" },
    { texte: "Dieu est notre refuge et notre force.", ref: "Psaume 46:2" },
    { texte: "L'amour est patient, il est plein de bonté.", ref: "1 Corinthiens 13:4" },
    { texte: "Réjouissez-vous toujours dans le Seigneur.", ref: "Philippiens 4:4" },
    { texte: "C'est par la grâce que vous êtes sauvés, par le moyen de la foi.", ref: "Éphésiens 2:8" },
    { texte: "Remets ton sort à l'Éternel, mets en lui ta confiance.", ref: "Psaume 37:5" },
    { texte: "L'Éternel combat pour vous. Gardez le silence.", ref: "Exode 14:14" },
    { texte: "Car Dieu a tant aimé le monde qu'il a donné son Fils unique.", ref: "Jean 3:16" },
    { texte: "Je suis le chemin, la vérité et la vie.", ref: "Jean 14:6" },
    { texte: "Que Dieu, source de l'espérance, vous remplisse de toute joie.", ref: "Romains 15:13" },
    { texte: "Ta parole est une lampe à mes pieds, et une lumière sur mon sentier.", ref: "Psaume 119:105" },
    { texte: "Soyez sans inquiétude d'aucune chose.", ref: "Philippiens 4:6" },
    { texte: "Les compassions de l'Éternel se renouvellent chaque matin.", ref: "Lamentations 3:22-23" },
    { texte: "Mon secours vient de l'Éternel.", ref: "Psaume 121:1-2" },
    { texte: "Rien ne pourra nous séparer de l'amour de Dieu.", ref: "Romains 8:38-39" },
    { texte: "Ma grâce te suffit, car ma puissance s'accomplit dans la faiblesse.", ref: "2 Corinthiens 12:9" },
    { texte: "Donnez, et il vous sera donné.", ref: "Luc 6:38" },
    { texte: "Nous l'aimons parce qu'il nous a aimés le premier.", ref: "1 Jean 4:19" },
    { texte: "Je suis avec vous tous les jours, jusqu'à la fin du monde.", ref: "Matthieu 28:20" },
    { texte: "L'Éternel, ton Dieu, est au milieu de toi, comme un héros qui sauve.", ref: "Sophonie 3:17" },
    { texte: "Ne vous lassez pas de faire le bien.", ref: "Galates 6:9" }
];

app.get('/api/priere', (req, res) => {
    const dernier = isNaN(parseInt(req.query.dernier)) ? -1 : parseInt(req.query.dernier);
    let index, tentatives = 0;
    do { index = Math.floor(Math.random() * versets.length); tentatives++; }
    while (index === dernier && tentatives < 20);
    res.json({ ...versets[index], index });
});

app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
