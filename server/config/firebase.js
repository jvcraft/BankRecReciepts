const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let db, auth;

try {
    // Check if Firebase is already initialized
    if (!admin.apps.length) {
        // Build credentials from environment variables
        const serviceAccount = {
            type: 'service_account',
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL
        };

        // Only initialize if we have valid credentials
        if (serviceAccount.project_id && serviceAccount.private_key && serviceAccount.client_email) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: process.env.FIREBASE_PROJECT_ID
            });
            console.log('[FIREBASE] Admin SDK initialized successfully');
        } else {
            console.warn('[FIREBASE] Missing credentials - running in demo mode');
            // Initialize without credentials for local development
            admin.initializeApp({
                projectId: process.env.FIREBASE_PROJECT_ID || 'demo-project'
            });
        }
    }

    db = admin.firestore();
    auth = admin.auth();

    // Configure Firestore settings
    db.settings({
        ignoreUndefinedProperties: true
    });

} catch (error) {
    console.error('[FIREBASE] Initialization error:', error.message);
    console.warn('[FIREBASE] Some features may not work without proper Firebase configuration');
}

module.exports = { admin, db, auth };
