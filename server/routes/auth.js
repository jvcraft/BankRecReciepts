const router = require('express').Router();
const { db } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');

/**
 * POST /api/auth/profile
 * Create or update user profile after Firebase Auth login
 */
router.post('/profile', verifyToken, async (req, res, next) => {
    try {
        const { uid, email, name } = req.user;

        if (!db) {
            // Demo mode response
            return res.json({
                uid,
                email,
                displayName: name,
                settings: getDefaultSettings()
            });
        }

        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        const userData = {
            email,
            displayName: name,
            lastLogin: new Date()
        };

        if (!userDoc.exists) {
            // Create new user with default settings
            userData.createdAt = new Date();
            userData.settings = getDefaultSettings();
        }

        await userRef.set(userData, { merge: true });

        const updatedDoc = await userRef.get();
        res.json({
            uid,
            ...updatedDoc.data()
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/auth/profile
 * Get current user profile
 */
router.get('/profile', verifyToken, async (req, res, next) => {
    try {
        if (!db) {
            // Demo mode response
            return res.json({
                uid: req.user.uid,
                email: req.user.email,
                displayName: req.user.name,
                settings: getDefaultSettings()
            });
        }

        const userDoc = await db.collection('users').doc(req.user.uid).get();

        if (!userDoc.exists) {
            return res.status(404).json({
                error: 'User not found',
                message: 'User profile does not exist'
            });
        }

        res.json({
            uid: req.user.uid,
            ...userDoc.data()
        });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/auth/profile
 * Delete user account and all associated data
 */
router.delete('/profile', verifyToken, async (req, res, next) => {
    try {
        if (!db) {
            return res.json({ message: 'Account deleted (demo mode)' });
        }

        const userId = req.user.uid;

        // Delete all user's reconciliations and subcollections
        const reconciliations = await db.collection('reconciliations')
            .where('userId', '==', userId)
            .get();

        const batch = db.batch();

        for (const doc of reconciliations.docs) {
            // Delete subcollections
            const subcollections = ['matches', 'unmatchedBank', 'unmatchedGL'];
            for (const subcol of subcollections) {
                const subDocs = await doc.ref.collection(subcol).get();
                subDocs.docs.forEach(subDoc => batch.delete(subDoc.ref));
            }
            batch.delete(doc.ref);
        }

        // Delete user document
        batch.delete(db.collection('users').doc(userId));

        await batch.commit();

        res.json({ message: 'Account and all associated data deleted successfully' });
    } catch (error) {
        next(error);
    }
});

/**
 * Helper function to get default user settings
 */
function getDefaultSettings() {
    return {
        defaultDateRange: 3,
        defaultAmountTolerance: 0.00,
        dateFormat: 'MM/DD/YYYY',
        currencyFormat: 'USD',
        theme: 'light',
        exportFormat: 'xlsx',
        autoSaveEnabled: false,
        showConfidenceScores: true
    };
}

module.exports = router;
