const router = require('express').Router();
const multer = require('multer');
const { db } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');
const pdfParser = require('../parsers/pdfParser');
const ofxParser = require('../parsers/ofxParser');
const qifParser = require('../parsers/qifParser');

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv',
            'text/plain',
            'application/octet-stream' // For OFX/QFX/QIF files
        ];
        const allowedExtensions = ['.pdf', '.csv', '.xlsx', '.xls', '.ofx', '.qfx', '.qif'];
        const ext = '.' + file.originalname.split('.').pop().toLowerCase();

        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`));
        }
    }
});

/**
 * POST /api/reconciliation/parse
 * Parse uploaded file (server-side parsing for PDF, OFX, QIF)
 */
router.post('/parse', verifyToken, upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No file uploaded',
                message: 'Please provide a file to parse'
            });
        }

        const { buffer, originalname } = req.file;
        const fileType = req.body.fileType || 'bank'; // 'bank' or 'gl'
        const ext = originalname.split('.').pop().toLowerCase();

        let parsedData;
        let parserUsed;

        switch (ext) {
            case 'pdf':
                parsedData = await pdfParser.parse(buffer, fileType);
                parserUsed = 'pdf';
                break;

            case 'ofx':
            case 'qfx':
                parsedData = ofxParser.parse(buffer.toString('utf-8'));
                parserUsed = 'ofx';
                break;

            case 'qif':
                parsedData = qifParser.parse(buffer.toString('utf-8'));
                parserUsed = 'qif';
                break;

            default:
                return res.status(400).json({
                    error: 'Unsupported format',
                    message: 'Use client-side parsing for CSV/Excel files'
                });
        }

        res.json({
            success: true,
            data: parsedData,
            fileName: originalname,
            parser: parserUsed,
            rowCount: parsedData.length
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/reconciliation/save
 * Save reconciliation session
 */
router.post('/save', verifyToken, async (req, res, next) => {
    try {
        const {
            name,
            description,
            bankFileName,
            glFileName,
            settings,
            matchedTransactions,
            unmatchedBank,
            unmatchedGL
        } = req.body;

        // Validate required fields
        if (!matchedTransactions && !unmatchedBank && !unmatchedGL) {
            return res.status(400).json({
                error: 'Invalid data',
                message: 'No reconciliation data provided'
            });
        }

        // Calculate summary
        const summary = {
            totalMatched: matchedTransactions?.length || 0,
            totalUnmatchedBank: unmatchedBank?.length || 0,
            totalUnmatchedGL: unmatchedGL?.length || 0,
            totalMatchedAmount: (matchedTransactions || []).reduce(
                (sum, m) => sum + Math.abs(m.bankTransaction?.amount || 0),
                0
            )
        };

        if (!db) {
            // Demo mode - return mock response
            return res.json({
                id: 'demo-' + Date.now(),
                message: 'Reconciliation saved (demo mode)',
                summary
            });
        }

        // Create main reconciliation document
        const reconciliationRef = db.collection('reconciliations').doc();
        const reconciliationData = {
            userId: req.user.uid,
            name: name || `Reconciliation ${new Date().toLocaleDateString()}`,
            description: description || '',
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'completed',
            bankFileName: bankFileName || '',
            glFileName: glFileName || '',
            settings: settings || {},
            summary
        };

        await reconciliationRef.set(reconciliationData);

        // Save matches and unmatched items in batches
        const BATCH_SIZE = 400; // Firestore batch limit is 500

        // Save matched transactions
        if (matchedTransactions?.length > 0) {
            for (let i = 0; i < matchedTransactions.length; i += BATCH_SIZE) {
                const batch = db.batch();
                const chunk = matchedTransactions.slice(i, i + BATCH_SIZE);

                chunk.forEach(match => {
                    const matchRef = reconciliationRef.collection('matches').doc();
                    batch.set(matchRef, {
                        ...match,
                        createdAt: new Date()
                    });
                });

                await batch.commit();
            }
        }

        // Save unmatched bank items
        if (unmatchedBank?.length > 0) {
            for (let i = 0; i < unmatchedBank.length; i += BATCH_SIZE) {
                const batch = db.batch();
                const chunk = unmatchedBank.slice(i, i + BATCH_SIZE);

                chunk.forEach(item => {
                    const ref = reconciliationRef.collection('unmatchedBank').doc();
                    batch.set(ref, item);
                });

                await batch.commit();
            }
        }

        // Save unmatched GL items
        if (unmatchedGL?.length > 0) {
            for (let i = 0; i < unmatchedGL.length; i += BATCH_SIZE) {
                const batch = db.batch();
                const chunk = unmatchedGL.slice(i, i + BATCH_SIZE);

                chunk.forEach(item => {
                    const ref = reconciliationRef.collection('unmatchedGL').doc();
                    batch.set(ref, item);
                });

                await batch.commit();
            }
        }

        res.json({
            id: reconciliationRef.id,
            message: 'Reconciliation saved successfully',
            summary
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/reconciliation/:id
 * Load reconciliation session
 */
router.get('/:id', verifyToken, async (req, res, next) => {
    try {
        if (!db) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Reconciliation not found (demo mode)'
            });
        }

        const docRef = db.collection('reconciliations').doc(req.params.id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Reconciliation not found'
            });
        }

        const data = doc.data();

        // Check ownership
        if (data.userId !== req.user.uid) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You do not have permission to access this reconciliation'
            });
        }

        // Get subcollections
        const [matchesSnap, unmatchedBankSnap, unmatchedGLSnap] = await Promise.all([
            docRef.collection('matches').get(),
            docRef.collection('unmatchedBank').get(),
            docRef.collection('unmatchedGL').get()
        ]);

        res.json({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
            matchedTransactions: matchesSnap.docs.map(d => ({
                id: d.id,
                ...d.data()
            })),
            unmatchedBank: unmatchedBankSnap.docs.map(d => ({
                id: d.id,
                ...d.data()
            })),
            unmatchedGL: unmatchedGLSnap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }))
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/reconciliation/:id
 * Update reconciliation (e.g., add manual matches)
 */
router.put('/:id', verifyToken, async (req, res, next) => {
    try {
        if (!db) {
            return res.json({ message: 'Updated (demo mode)' });
        }

        const docRef = db.collection('reconciliations').doc(req.params.id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Reconciliation not found'
            });
        }

        if (doc.data().userId !== req.user.uid) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You do not have permission to modify this reconciliation'
            });
        }

        const { name, description, status } = req.body;
        const updates = { updatedAt: new Date() };

        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (status !== undefined) updates.status = status;

        await docRef.update(updates);

        res.json({ message: 'Reconciliation updated successfully' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
