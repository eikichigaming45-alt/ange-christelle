const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Route temporaire pour tester la connexion
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    // Mot de passe par défaut provisoire : "Ange2026+"
    if (password === 'Ange2026+') {
        res.json({ success: true, message: 'Connexion réussie' });
    } else {
        res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
    }
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
