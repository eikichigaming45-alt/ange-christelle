// ============================================================
// middleware/auth.js
// Middleware d'authentification JWT partagé côté serveur.
// Importé par : toutes les routes protégées.
// Remplace les fonctions authMiddleware/authenticateToken
// dupliquées dans chaque fichier de route.
// ============================================================

const jwt = require('jsonwebtoken');

/**
 * Vérifie le token JWT dans le header Authorization.
 * En cas de succès, injecte req.user avec les données du token.
 * En cas d'échec, retourne 401 ou 403.
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token manquant' });
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Token invalide' });
        req.user = user;
        next();
    });
}

/**
 * Vérifie que l'utilisateur authentifié est admin.
 * À utiliser après authenticateToken.
 */
function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
    next();
}

module.exports = { authenticateToken, requireAdmin };
