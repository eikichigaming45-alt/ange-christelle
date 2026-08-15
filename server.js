const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
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

const versets = [
    { texte: "Je puis tout par celui qui me fortifie.", ref: "Philippiens 4:13" },
    { texte: "Car je connais les projets que j'ai formés sur vous, projets de paix et non de malheur, afin de vous donner un avenir et de l'espérance.", ref: "Jérémie 29:11" },
    { texte: "L'Éternel est mon berger, je ne manquerai de rien.", ref: "Psaume 23:1" },
    { texte: "Toutes choses concourent au bien de ceux qui aiment Dieu.", ref: "Romains 8:28" },
    { texte: "Venez à moi, vous tous qui êtes fatigués et chargés, et je vous donnerai du repos.", ref: "Matthieu 11:28" },
    { texte: "Ne crains rien, car je suis avec toi. Ne promène pas des regards inquiets, car je suis ton Dieu.", ref: "Ésaïe 41:10" },
    { texte: "Ceux qui se confient en l'Éternel renouvellent leurs forces. Ils prennent le vol comme les aigles.", ref: "Ésaïe 40:31" },
    { texte: "L'Éternel est ma lumière et mon salut : de qui aurais-je crainte ?", ref: "Psaume 27:1" },
    { texte: "Confie-toi en l'Éternel de tout ton cœur, et ne t'appuie pas sur ta sagesse.", ref: "Proverbes 3:5" },
    { texte: "La foi est une ferme assurance des choses qu'on espère, une démonstration de celles qu'on ne voit pas.", ref: "Hébreux 11:1" },
    { texte: "Cherchez premièrement le royaume et la justice de Dieu, et toutes ces choses vous seront données par-dessus.", ref: "Matthieu 6:33" },
    { texte: "Mon Dieu pourvoira à tous vos besoins selon sa richesse, avec gloire, en Jésus-Christ.", ref: "Philippiens 4:19" },
    { texte: "L'Éternel est proche de ceux qui ont le cœur brisé, et il sauve ceux qui ont l'esprit dans l'abattement.", ref: "Psaume 34:19" },
    { texte: "Car Dieu n'a pas donné un esprit de timidité, mais un esprit de force, d'amour et de sagesse.", ref: "2 Timothée 1:7" },
    { texte: "Je t'aime d'un amour éternel, c'est pourquoi je te conserve ma grâce.", ref: "Jérémie 31:3" },
    { texte: "Que la paix de Dieu, qui surpasse toute intelligence, garde vos cœurs et vos pensées.", ref: "Philippiens 4:7" },
    { texte: "Sois fort et courageux. Ne crains point et ne t'effraie point, car l'Éternel ton Dieu est avec toi.", ref: "Josué 1:9" },
    { texte: "Heureux les artisans de paix, car ils seront appelés fils de Dieu.", ref: "Matthieu 5:9" },
    { texte: "Si quelqu'un est en Christ, il est une nouvelle créature. Les choses anciennes sont passées, toutes choses sont devenues nouvelles.", ref: "2 Corinthiens 5:17" },
    { texte: "Celui qui habite sous l'abri du Très-Haut repose à l'ombre du Tout-Puissant.", ref: "Psaume 91:1" },
    { texte: "Dieu est notre refuge et notre force, un secours qui ne manque jamais dans la détresse.", ref: "Psaume 46:2" },
    { texte: "L'amour est patient, il est plein de bonté. L'amour ne jalouse pas.", ref: "1 Corinthiens 13:4" },
    { texte: "Réjouissez-vous toujours dans le Seigneur. Encore une fois, je vous le dis, réjouissez-vous.", ref: "Philippiens 4:4" },
    { texte: "C'est par la grâce que vous êtes sauvés, par le moyen de la foi.", ref: "Éphésiens 2:8" },
    { texte: "Tu me feras connaître le sentier de la vie. Il y a d'abondantes joies devant ta face.", ref: "Psaume 16:11" },
    { texte: "Remets ton sort à l'Éternel, mets en lui ta confiance, et il agira.", ref: "Psaume 37:5" },
    { texte: "L'Éternel combat pour vous. Gardez le silence.", ref: "Exode 14:14" },
    { texte: "Car Dieu a tant aimé le monde qu'il a donné son Fils unique, afin que quiconque croit en lui ne périsse point.", ref: "Jean 3:16" },
    { texte: "Je suis le chemin, la vérité et la vie. Nul ne vient au Père que par moi.", ref: "Jean 14:6" },
    { texte: "Je suis venu afin que les brebis aient la vie, et qu'elles soient dans l'abondance.", ref: "Jean 10:10" },
    { texte: "Que Dieu, source de l'espérance, vous remplisse de toute joie et de toute paix dans la foi.", ref: "Romains 15:13" },
    { texte: "Il essuiera toute larme de leurs yeux, et la mort ne sera plus.", ref: "Apocalypse 21:4" },
    { texte: "Ta parole est une lampe à mes pieds, et une lumière sur mon sentier.", ref: "Psaume 119:105" },
    { texte: "L'Éternel te gardera de tout mal, il gardera ton âme.", ref: "Psaume 121:7" },
    { texte: "Soyez sans inquiétude d'aucune chose. Mais en toute chose faites connaître vos besoins à Dieu.", ref: "Philippiens 4:6" },
    { texte: "Les compassions de l'Éternel ne sont pas épuisées, elles se renouvellent chaque matin.", ref: "Lamentations 3:22-23" },
    { texte: "Je lève mes yeux vers les montagnes. D'où me viendra le secours ? Mon secours vient de l'Éternel.", ref: "Psaume 121:1-2" },
    { texte: "Lorsque tu passeras par les eaux, je serai avec toi. Les fleuves ne te submergeront point.", ref: "Ésaïe 43:2" },
    { texte: "Rien ne pourra nous séparer de l'amour de Dieu manifesté en Jésus-Christ notre Seigneur.", ref: "Romains 8:38-39" },
    { texte: "Je te loue de ce que je suis une créature si merveilleuse.", ref: "Psaume 139:14" },
    { texte: "Ma grâce te suffit, car ma puissance s'accomplit dans la faiblesse.", ref: "2 Corinthiens 12:9" },
    { texte: "Donnez, et il vous sera donné. On versera dans votre sein une bonne mesure.", ref: "Luc 6:38" },
    { texte: "Soyez bons les uns envers les autres, compatissants, vous pardonnant mutuellement.", ref: "Éphésiens 4:32" },
    { texte: "Tout don excellent et tout don parfait descend d'en haut, du Père des lumières.", ref: "Jacques 1:17" },
    { texte: "Nous l'aimons parce qu'il nous a aimés le premier.", ref: "1 Jean 4:19" },
    { texte: "Je suis avec vous tous les jours, jusqu'à la fin du monde.", ref: "Matthieu 28:20" },
    { texte: "La vérité vous affranchira.", ref: "Jean 8:32" },
    { texte: "Il donne de la force à celui qui est fatigué, et il augmente la vigueur de celui qui tombe en défaillance.", ref: "Ésaïe 40:29" },
    { texte: "Heureux les miséricordieux, car ils obtiendront miséricorde.", ref: "Matthieu 5:7" },
    { texte: "Ne vous lassez pas de faire le bien, car nous moissonnerons au temps convenable, si nous ne nous relâchons pas.", ref: "Galates 6:9" },
    { texte: "L'Éternel, ton Dieu, est au milieu de toi, comme un héros qui sauve.", ref: "Sophonie 3:17" },
    { texte: "Toutes les voies de l'Éternel sont miséricorde et fidélité pour ceux qui gardent son alliance.", ref: "Psaume 25:10" },
    { texte: "Cherche l'Éternel et sa force, cherche continuellement sa face.", ref: "Psaume 105:4" },
    { texte: "Que votre lumière luise ainsi devant les hommes, afin qu'ils voient vos bonnes œuvres.", ref: "Matthieu 5:16" },
    { texte: "L'Éternel est bon, il est un refuge au jour de la détresse.", ref: "Nahum 1:7" },
    { texte: "C'est l'Éternel qui marche devant toi, il sera avec toi, il ne te délaissera point.", ref: "Deutéronome 31:8" },
    { texte: "Heureux l'homme qui trouve la sagesse, et l'homme qui possède l'intelligence.", ref: "Proverbes 3:13" },
    { texte: "Goûtez et voyez combien l'Éternel est bon ! Heureux l'homme qui cherche son refuge en lui !", ref: "Psaume 34:9" },
    { texte: "L'espérance ne trompe point, parce que l'amour de Dieu est répandu dans nos cœurs.", ref: "Romains 5:5" },
    { texte: "Fortifiez-vous et prenez courage ! Ne craignez pas et ne vous effrayez pas.", ref: "Josué 10:25" },
    { texte: "Mon âme, bénis l'Éternel, et n'oublie aucun de ses bienfaits !", ref: "Psaume 103:2" }
];

app.get('/api/priere', (req, res) => {
    const dernierIndex = parseInt(req.query.dernier);
    const dernier = isNaN(dernierIndex) ? -1 : dernierIndex;
    let index;
    let tentatives = 0;
    do {
        index = Math.floor(Math.random() * versets.length);
        tentatives++;
    } while (index === dernier && tentatives < 20);
    res.json({ ...versets[index], index });
});

app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
