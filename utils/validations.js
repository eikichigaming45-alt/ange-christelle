// ============================================================
// utils/validations.js
// Fonctions de validation partagées côté serveur.
// Importé par : routes/auth.js, routes/profil.js, routes/admin.js
// ============================================================

/**
 * Valide un mot de passe selon les règles de sécurité.
 * @param {string} password
 * @returns {string|null} Message d'erreur ou null si valide
 */
function validerMotDePasse(password) {
    if (!password || password.length < 8)  return 'Minimum 8 caractères.';
    if (!/[A-Z]/.test(password))           return 'Au moins une majuscule requise.';
    if (!/[a-z]/.test(password))           return 'Au moins une minuscule requise.';
    if (!/[0-9]/.test(password))           return 'Au moins un chiffre requis.';
    if (!/[^A-Za-z0-9]/.test(password))    return 'Au moins un caractère spécial requis.';
    return null;
}

module.exports = { validerMotDePasse };
