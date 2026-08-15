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

// ===== AUTH =====
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

// ===== PROFIL =====
app.get('/api/profil', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'userId manquant' });
    try {
        const result = await pool.query('SELECT * FROM profiles WHERE user_id = \$1', [userId]);
        if (result.rows.length === 0) return res.json({ success: true, profil: null });
        res.json({ success: true, profil: result.rows[0] });
    } catch (err) {
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
                prenom=\$2, nom=\$3, date_naissance=\$4, email=\$5,
                telephone=\$6, profession=\$7, note=\$8, photo=\$9, updated_at=NOW();
        `, [userId, prenom, nom, date_naissance||null, email, telephone, profession, note, photo]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ===== MOT DE PASSE =====
app.post('/api/changer-mdp', async (req, res) => {
    const { userId, ancienMdp, nouveauMdp } = req.body;
    if (!userId || !ancienMdp || !nouveauMdp) return res.status(400).json({ success: false, message: 'Champs manquants' });
    if (nouveauMdp.length < 6) return res.status(400).json({ success: false, message: 'Mot de passe trop court' });
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = \$1', [userId]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
        const match = await bcrypt.compare(ancienMdp, result.rows[0].password);
        if (!match) return res.status(401).json({ success: false, message: 'Ancien mot de passe incorrect' });
        const hash = await bcrypt.hash(nouveauMdp, 10);
        await pool.query('UPDATE users SET password = \$1 WHERE id = \$2', [hash, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ===== WIDGET ORDER =====
app.get('/api/widget-order', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: 'userId manquant' });
    try {
        const result = await pool.query('SELECT ordre FROM widget_order WHERE user_id = \$1', [userId]);
        if (result.rows.length === 0) return res.json({ success: true, ordre: null });
        res.json({ success: true, ordre: JSON.parse(result.rows[0].ordre) });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

app.post('/api/widget-order', async (req, res) => {
    const { userId, ordre } = req.body;
    if (!userId || !ordre) return res.status(400).json({ success: false, message: 'Données manquantes' });
    try {
        await pool.query(`
            INSERT INTO widget_order (user_id, ordre, updated_at)
            VALUES (\$1, \$2, NOW())
            ON CONFLICT (user_id) DO UPDATE SET ordre=\$2, updated_at=NOW();
        `, [userId, JSON.stringify(ordre)]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ===== TACHES =====
app.get('/api/taches', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: 'userId manquant' });
    try {
        const result = await pool.query(`
            SELECT * FROM taches
            WHERE user_id = \$1
            ORDER BY
                CASE WHEN date IS NULL THEN 1 ELSE 0 END,
                date ASC, heure ASC NULLS LAST, created_at ASC
        `, [userId]);
        res.json({ success: true, taches: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

app.post('/api/taches', async (req, res) => {
    const { userId, titre, date, heure, recurrence } = req.body;
    if (!userId || !titre) return res.status(400).json({ success: false, message: 'Champs manquants' });
    try {
        const result = await pool.query(`
            INSERT INTO taches (user_id, titre, date, heure, recurrence)
            VALUES (\$1, \$2, \$3, \$4, \$5) RETURNING *
        `, [userId, titre, date||null, heure||null, recurrence||'none']);
        res.json({ success: true, tache: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

app.post('/api/taches/:id/cocher', async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    try {
        const t = await pool.query('SELECT * FROM taches WHERE id=\$1 AND user_id=\$2', [id, userId]);
        if (!t.rows.length) return res.status(404).json({ success: false });
        const tache = t.rows[0];
        await pool.query('UPDATE taches SET faite=TRUE WHERE id=\$1', [id]);

        // Recréer si récurrente
        if (tache.recurrence !== 'none' && tache.date) {
            const base = new Date(tache.date);
            let next = new Date(base);
            if (tache.recurrence === 'daily')   next.setDate(base.getDate() + 1);
            if (tache.recurrence === 'weekly')  next.setDate(base.getDate() + 7);
            if (tache.recurrence === 'monthly') next.setMonth(base.getMonth() + 1);
            const nextDate = next.toISOString().split('T')[0];
            await pool.query(`
                INSERT INTO taches (user_id, titre, date, heure, recurrence)
                VALUES (\$1, \$2, \$3, \$4, \$5)
            `, [userId, tache.titre, nextDate, tache.heure, tache.recurrence]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

app.delete('/api/taches/:id', async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    try {
        await pool.query('DELETE FROM taches WHERE id=\$1 AND user_id=\$2', [id, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ===== ANNIVERSAIRES =====
app.get('/api/anniversaires', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: 'userId manquant' });
    try {
        const result = await pool.query(`
            SELECT * FROM anniversaires WHERE user_id=\$1
            ORDER BY mois ASC, jour ASC
        `, [userId]);
        res.json({ success: true, anniversaires: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

app.post('/api/anniversaires', async (req, res) => {
    const { userId, prenom, nom, jour, mois, annee } = req.body;
    if (!userId || !prenom || !jour || !mois) return res.status(400).json({ success: false, message: 'Champs manquants' });
    try {
        const result = await pool.query(`
            INSERT INTO anniversaires (user_id, prenom, nom, jour, mois, annee)
            VALUES (\$1, \$2, \$3, \$4, \$5, \$6) RETURNING *
        `, [userId, prenom, nom||null, parseInt(jour), parseInt(mois), annee ? parseInt(annee) : null]);
        res.json({ success: true, anniversaire: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

app.delete('/api/anniversaires/:id', async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    try {
        await pool.query('DELETE FROM anniversaires WHERE id=\$1 AND user_id=\$2', [id, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ===== PUSH SUBSCRIPTIONS =====
app.post('/api/push/subscribe', async (req, res) => {
    const { userId, subscription } = req.body;
    if (!userId || !subscription) return res.status(400).json({ success: false });
    try {
        await pool.query(`
            INSERT INTO push_subscriptions (user_id, subscription, updated_at)
            VALUES (\$1, \$2, NOW())
            ON CONFLICT (user_id) DO UPDATE SET subscription=\$2, updated_at=NOW();
        `, [userId, JSON.stringify(subscription)]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// ===== ADMIN =====
async function isAdmin(adminId) {
    const check = await pool.query('SELECT role FROM users WHERE id = \$1', [adminId]);
    return check.rows.length > 0 && check.rows[0].role === 'admin';
}

app.get('/api/admin/users', async (req, res) => {
    const { adminId } = req.query;
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        const result = await pool.query(`
            SELECT u.id, u.username, u.role, p.prenom, p.nom, p.email, p.profession, p.created_at
            FROM users u LEFT JOIN profiles p ON p.user_id = u.id ORDER BY u.id
        `);
        res.json({ success: true, users: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

app.post('/api/admin/create-user', async (req, res) => {
    const { adminId, username, password, role } = req.body;
    if (!adminId || !username || !password || !role) return res.status(400).json({ success: false, message: 'Champs manquants' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Mot de passe trop court' });
    if (!['admin','user'].includes(role)) return res.status(400).json({ success: false, message: 'Rôle invalide' });
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        const exists = await pool.query('SELECT id FROM users WHERE username=\$1', [username]);
        if (exists.rows.length > 0) return res.status(409).json({ success: false, message: "Nom d'utilisateur déjà pris" });
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query('INSERT INTO users (username, password, role) VALUES (\$1,\$2,\$3) RETURNING id', [username, hash, role]);
        res.json({ success: true, userId: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

app.post('/api/admin/update-user', async (req, res) => {
    const { adminId, targetUserId, username, role } = req.body;
    if (!adminId || !targetUserId) return res.status(400).json({ success: false, message: 'Champs manquants' });
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        if (username) {
            const exists = await pool.query('SELECT id FROM users WHERE username=\$1 AND id!=\$2', [username, targetUserId]);
            if (exists.rows.length > 0) return res.status(409).json({ success: false, message: "Nom déjà pris" });
            await pool.query('UPDATE users SET username=\$1 WHERE id=\$2', [username, targetUserId]);
        }
        if (role && ['admin','user'].includes(role)) {
            await pool.query('UPDATE users SET role=\$1 WHERE id=\$2', [role, targetUserId]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

app.post('/api/admin/delete-user', async (req, res) => {
    const { adminId, targetUserId } = req.body;
    if (!adminId || !targetUserId) return res.status(400).json({ success: false, message: 'Champs manquants' });
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        if (parseInt(adminId) === parseInt(targetUserId)) return res.status(400).json({ success: false, message: 'Impossible de se supprimer soi-même' });
        await pool.query('DELETE FROM users WHERE id=\$1', [targetUserId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

app.post('/api/admin/reset-mdp', async (req, res) => {
    const { adminId, targetUserId, nouveauMdp } = req.body;
    if (!adminId || !targetUserId || !nouveauMdp) return res.status(400).json({ success: false, message: 'Champs manquants' });
    if (nouveauMdp.length < 6) return res.status(400).json({ success: false, message: 'Mot de passe trop court' });
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        const hash = await bcrypt.hash(nouveauMdp, 10);
        await pool.query('UPDATE users SET password=\$1 WHERE id=\$2', [hash, targetUserId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

app.get('/api/admin/stats', async (req, res) => {
    const { adminId } = req.query;
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        const totalUsers    = await pool.query('SELECT COUNT(*) FROM users');
        const totalAdmins   = await pool.query("SELECT COUNT(*) FROM users WHERE role='admin'");
        const totalProfiles = await pool.query('SELECT COUNT(*) FROM profiles');
        const lastLogins    = await pool.query(`
            SELECT u.username, p.updated_at FROM users u
            LEFT JOIN profiles p ON p.user_id=u.id
            ORDER BY p.updated_at DESC NULLS LAST LIMIT 5
        `);
        res.json({ success: true, stats: {
            totalUsers: parseInt(totalUsers.rows[0].count),
            totalAdmins: parseInt(totalAdmins.rows[0].count),
            totalProfiles: parseInt(totalProfiles.rows[0].count),
            lastActivity: lastLogins.rows
        }});
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// ===== PRIERE =====
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
