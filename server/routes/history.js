const router = require('express').Router();
const { db } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');

/**
 * GET /api/history
 * Get reconciliation history with pagination and filtering
 */
router.get('/', verifyToken, async (req, res, next) => {
    try {
        if (!db) {
            // Demo mode - return empty history
            return res.json({
                reconciliations: [],
                hasMore: false
            });
        }

        const {
            limit = '20',
            startAfter,
            status,
            search
        } = req.query;

        const pageLimit = Math.min(parseInt(limit) || 20, 100);

        // Build query
        let query = db.collection('reconciliations')
            .where('userId', '==', req.user.uid)
            .orderBy('createdAt', 'desc');

        // Filter by status if provided
        if (status && status !== 'all') {
            query = query.where('status', '==', status);
        }

        // Pagination
        if (startAfter) {
            const startDoc = await db.collection('reconciliations').doc(startAfter).get();
            if (startDoc.exists) {
                query = query.startAfter(startDoc);
            }
        }

        query = query.limit(pageLimit);

        const snapshot = await query.get();

        let reconciliations = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                description: data.description,
                status: data.status,
                bankFileName: data.bankFileName,
                glFileName: data.glFileName,
                summary: data.summary,
                createdAt: data.createdAt?.toDate?.() || data.createdAt,
                updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
            };
        });

        // Client-side search filtering (Firestore doesn't support full-text search)
        if (search) {
            const searchLower = search.toLowerCase();
            reconciliations = reconciliations.filter(r =>
                r.name?.toLowerCase().includes(searchLower) ||
                r.description?.toLowerCase().includes(searchLower) ||
                r.bankFileName?.toLowerCase().includes(searchLower) ||
                r.glFileName?.toLowerCase().includes(searchLower)
            );
        }

        res.json({
            reconciliations,
            hasMore: snapshot.docs.length === pageLimit,
            lastId: snapshot.docs.length > 0
                ? snapshot.docs[snapshot.docs.length - 1].id
                : null
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/history/stats
 * Get user's reconciliation statistics
 */
router.get('/stats', verifyToken, async (req, res, next) => {
    try {
        if (!db) {
            return res.json({
                totalReconciliations: 0,
                totalMatched: 0,
                totalUnmatched: 0,
                lastReconciliation: null
            });
        }

        const snapshot = await db.collection('reconciliations')
            .where('userId', '==', req.user.uid)
            .get();

        let totalMatched = 0;
        let totalUnmatchedBank = 0;
        let totalUnmatchedGL = 0;
        let lastReconciliation = null;
        let latestDate = null;

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const summary = data.summary || {};

            totalMatched += summary.totalMatched || 0;
            totalUnmatchedBank += summary.totalUnmatchedBank || 0;
            totalUnmatchedGL += summary.totalUnmatchedGL || 0;

            const createdAt = data.createdAt?.toDate?.() || data.createdAt;
            if (!latestDate || (createdAt && createdAt > latestDate)) {
                latestDate = createdAt;
                lastReconciliation = {
                    id: doc.id,
                    name: data.name,
                    createdAt
                };
            }
        });

        res.json({
            totalReconciliations: snapshot.docs.length,
            totalMatched,
            totalUnmatched: totalUnmatchedBank + totalUnmatchedGL,
            totalUnmatchedBank,
            totalUnmatchedGL,
            lastReconciliation
        });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/history/:id
 * Delete a reconciliation and all its data
 */
router.delete('/:id', verifyToken, async (req, res, next) => {
    try {
        if (!db) {
            return res.json({ message: 'Deleted (demo mode)' });
        }

        const docRef = db.collection('reconciliations').doc(req.params.id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Reconciliation not found'
            });
        }

        // Check ownership
        if (doc.data().userId !== req.user.uid) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You do not have permission to delete this reconciliation'
            });
        }

        // Delete subcollections first
        const subcollections = ['matches', 'unmatchedBank', 'unmatchedGL'];

        for (const subcol of subcollections) {
            const subSnapshot = await docRef.collection(subcol).get();

            // Delete in batches
            const BATCH_SIZE = 400;
            for (let i = 0; i < subSnapshot.docs.length; i += BATCH_SIZE) {
                const batch = db.batch();
                const chunk = subSnapshot.docs.slice(i, i + BATCH_SIZE);
                chunk.forEach(subDoc => batch.delete(subDoc.ref));
                await batch.commit();
            }
        }

        // Delete main document
        await docRef.delete();

        res.json({ message: 'Reconciliation deleted successfully' });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/history/:id/duplicate
 * Create a copy of an existing reconciliation
 */
router.post('/:id/duplicate', verifyToken, async (req, res, next) => {
    try {
        if (!db) {
            return res.json({
                id: 'demo-duplicate-' + Date.now(),
                message: 'Duplicated (demo mode)'
            });
        }

        const sourceRef = db.collection('reconciliations').doc(req.params.id);
        const sourceDoc = await sourceRef.get();

        if (!sourceDoc.exists) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Reconciliation not found'
            });
        }

        if (sourceDoc.data().userId !== req.user.uid) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You do not have permission to duplicate this reconciliation'
            });
        }

        // Create new document
        const newRef = db.collection('reconciliations').doc();
        const sourceData = sourceDoc.data();

        await newRef.set({
            ...sourceData,
            name: `${sourceData.name} (Copy)`,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'draft'
        });

        // Copy subcollections
        const subcollections = ['matches', 'unmatchedBank', 'unmatchedGL'];

        for (const subcol of subcollections) {
            const subSnapshot = await sourceRef.collection(subcol).get();
            const batch = db.batch();

            subSnapshot.docs.forEach(subDoc => {
                const newSubRef = newRef.collection(subcol).doc();
                batch.set(newSubRef, subDoc.data());
            });

            await batch.commit();
        }

        res.json({
            id: newRef.id,
            message: 'Reconciliation duplicated successfully'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
