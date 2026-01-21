const router = require('express').Router();
const { db } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');

// Valid settings keys
const VALID_SETTINGS = [
    'defaultDateRange',
    'defaultAmountTolerance',
    'dateFormat',
    'currencyFormat',
    'theme',
    'exportFormat',
    'autoSaveEnabled',
    'showConfidenceScores'
];

// Default settings
const DEFAULT_SETTINGS = {
    defaultDateRange: 3,
    defaultAmountTolerance: 0.00,
    dateFormat: 'MM/DD/YYYY',
    currencyFormat: 'USD',
    theme: 'light',
    exportFormat: 'xlsx',
    autoSaveEnabled: false,
    showConfidenceScores: true
};

/**
 * GET /api/settings
 * Get user settings
 */
router.get('/', verifyToken, async (req, res, next) => {
    try {
        if (!db) {
            // Demo mode - return default settings
            return res.json(DEFAULT_SETTINGS);
        }

        const userDoc = await db.collection('users').doc(req.user.uid).get();

        if (!userDoc.exists) {
            return res.json(DEFAULT_SETTINGS);
        }

        const settings = userDoc.data()?.settings || {};

        // Merge with defaults to ensure all keys exist
        res.json({
            ...DEFAULT_SETTINGS,
            ...settings
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/settings
 * Update user settings
 */
router.put('/', verifyToken, async (req, res, next) => {
    try {
        // Validate and extract only valid settings
        const updates = {};
        for (const key of VALID_SETTINGS) {
            if (req.body[key] !== undefined) {
                // Type validation
                const value = req.body[key];

                switch (key) {
                    case 'defaultDateRange':
                        if (typeof value !== 'number' || value < 0 || value > 30) {
                            return res.status(400).json({
                                error: 'Invalid value',
                                message: 'defaultDateRange must be a number between 0 and 30'
                            });
                        }
                        break;

                    case 'defaultAmountTolerance':
                        if (typeof value !== 'number' || value < 0) {
                            return res.status(400).json({
                                error: 'Invalid value',
                                message: 'defaultAmountTolerance must be a non-negative number'
                            });
                        }
                        break;

                    case 'dateFormat':
                        if (!['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].includes(value)) {
                            return res.status(400).json({
                                error: 'Invalid value',
                                message: 'Invalid date format'
                            });
                        }
                        break;

                    case 'currencyFormat':
                        if (!['USD', 'EUR', 'GBP'].includes(value)) {
                            return res.status(400).json({
                                error: 'Invalid value',
                                message: 'Invalid currency format'
                            });
                        }
                        break;

                    case 'theme':
                        if (!['light', 'dark', 'system'].includes(value)) {
                            return res.status(400).json({
                                error: 'Invalid value',
                                message: 'Invalid theme'
                            });
                        }
                        break;

                    case 'exportFormat':
                        if (!['xlsx', 'csv'].includes(value)) {
                            return res.status(400).json({
                                error: 'Invalid value',
                                message: 'Invalid export format'
                            });
                        }
                        break;

                    case 'autoSaveEnabled':
                    case 'showConfidenceScores':
                        if (typeof value !== 'boolean') {
                            return res.status(400).json({
                                error: 'Invalid value',
                                message: `${key} must be a boolean`
                            });
                        }
                        break;
                }

                updates[`settings.${key}`] = value;
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                error: 'No updates',
                message: 'No valid settings provided'
            });
        }

        if (!db) {
            // Demo mode - return merged settings
            const mergedSettings = { ...DEFAULT_SETTINGS };
            for (const key of VALID_SETTINGS) {
                if (req.body[key] !== undefined) {
                    mergedSettings[key] = req.body[key];
                }
            }
            return res.json(mergedSettings);
        }

        // Update settings in Firestore
        await db.collection('users').doc(req.user.uid).update(updates);

        // Return updated settings
        const userDoc = await db.collection('users').doc(req.user.uid).get();
        const settings = userDoc.data()?.settings || {};

        res.json({
            ...DEFAULT_SETTINGS,
            ...settings
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/settings/reset
 * Reset settings to defaults
 */
router.post('/reset', verifyToken, async (req, res, next) => {
    try {
        if (!db) {
            return res.json(DEFAULT_SETTINGS);
        }

        await db.collection('users').doc(req.user.uid).update({
            settings: DEFAULT_SETTINGS
        });

        res.json(DEFAULT_SETTINGS);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
