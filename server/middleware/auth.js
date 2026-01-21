const { auth } = require('../config/firebase');

/**
 * Middleware to verify Firebase ID tokens
 * Extracts user information and attaches to request
 */
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    // Check for Bearer token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'No authentication token provided'
        });
    }

    const token = authHeader.split('Bearer ')[1];

    // Check if auth is available
    if (!auth) {
        console.warn('[AUTH] Firebase Auth not initialized - allowing request in demo mode');
        // Demo mode - create mock user
        req.user = {
            uid: 'demo-user',
            email: 'demo@example.com',
            name: 'Demo User'
        };
        return next();
    }

    try {
        // Verify the ID token
        const decodedToken = await auth.verifyIdToken(token);

        // Attach user info to request
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
            emailVerified: decodedToken.email_verified
        };

        next();
    } catch (error) {
        console.error('[AUTH] Token verification failed:', error.code, error.message);

        // Handle specific Firebase Auth errors
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({
                error: 'Token expired',
                message: 'Your session has expired. Please sign in again.'
            });
        }

        if (error.code === 'auth/id-token-revoked') {
            return res.status(401).json({
                error: 'Token revoked',
                message: 'Your session has been revoked. Please sign in again.'
            });
        }

        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid authentication token'
        });
    }
};

/**
 * Optional authentication - allows both authenticated and unauthenticated requests
 * If token is provided and valid, user info is attached to request
 */
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // No token - continue without user
        req.user = null;
        return next();
    }

    const token = authHeader.split('Bearer ')[1];

    if (!auth) {
        req.user = null;
        return next();
    }

    try {
        const decodedToken = await auth.verifyIdToken(token);
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User'
        };
    } catch (error) {
        // Token invalid - continue without user
        req.user = null;
    }

    next();
};

module.exports = { verifyToken, optionalAuth };
