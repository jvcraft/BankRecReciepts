/**
 * Authentication Manager
 * Handles Firebase Authentication and session management
 */

// Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
};

class AuthManager {
    constructor() {
        this.user = null;
        this.token = null;
        this.isInitialized = false;
        this.demoMode = localStorage.getItem('demoMode') === 'true';
        this.onAuthStateChangedCallback = null;

        this.init();
    }

    /**
     * Initialize Firebase and set up auth listener
     */
    init() {
        // Check if Firebase is configured
        if (firebaseConfig.apiKey === 'YOUR_API_KEY') {
            console.warn('[AUTH] Firebase not configured - running in demo mode');
            this.demoMode = true;
            this.isInitialized = true;

            if (this.demoMode) {
                // Set up demo user
                this.user = {
                    uid: 'demo-user',
                    email: 'demo@example.com',
                    displayName: 'Demo User'
                };
                this.token = 'demo-token';
                this.updateUI(true);
            }
            return;
        }

        try {
            // Initialize Firebase if not already done
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }

            this.auth = firebase.auth();

            // Listen for auth state changes
            this.auth.onAuthStateChanged(async (user) => {
                this.user = user;

                if (user) {
                    // Get ID token for API calls
                    this.token = await user.getIdToken();

                    // Sync profile with backend
                    await this.syncProfile();

                    console.log('[AUTH] User signed in:', user.email);
                } else {
                    this.token = null;
                    console.log('[AUTH] User signed out');

                    // Redirect to home if on app page and not in demo mode
                    if (window.location.pathname === '/app' && !this.demoMode) {
                        window.location.href = '/home.html';
                    }
                }

                this.isInitialized = true;
                this.updateUI(!!user);

                // Call callback if set
                if (this.onAuthStateChangedCallback) {
                    this.onAuthStateChangedCallback(user);
                }
            });
        } catch (error) {
            console.error('[AUTH] Firebase initialization error:', error);
            this.demoMode = true;
            this.isInitialized = true;
        }
    }

    /**
     * Sync user profile with backend
     */
    async syncProfile() {
        if (this.demoMode || !this.token) return;

        try {
            const response = await fetch('/api/auth/profile', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const profile = await response.json();
                console.log('[AUTH] Profile synced:', profile.displayName);
                return profile;
            }
        } catch (error) {
            console.error('[AUTH] Profile sync failed:', error);
        }
    }

    /**
     * Update UI based on auth state
     */
    updateUI(isLoggedIn) {
        const mainNav = document.getElementById('mainNav');
        const userEmail = document.getElementById('userEmail');
        const logoutBtn = document.getElementById('logoutBtn');

        if (isLoggedIn && this.user) {
            // Show navigation
            if (mainNav) mainNav.style.display = 'flex';

            // Update user info
            if (userEmail) {
                userEmail.textContent = this.user.displayName || this.user.email;
            }

            // Set up logout button
            if (logoutBtn) {
                logoutBtn.onclick = () => this.signOut();
            }
        } else {
            // Hide navigation for non-logged in users
            // (or redirect to login)
            if (!this.demoMode && window.location.pathname !== '/login.html') {
                // Uncomment to require login:
                // window.location.href = '/login.html';
            }

            if (mainNav) mainNav.style.display = 'none';
        }
    }

    /**
     * Sign in with email and password
     */
    async signIn(email, password) {
        if (this.demoMode) {
            throw new Error('Firebase not configured - use demo mode');
        }

        return this.auth.signInWithEmailAndPassword(email, password);
    }

    /**
     * Create new account
     */
    async signUp(email, password, displayName) {
        if (this.demoMode) {
            throw new Error('Firebase not configured - use demo mode');
        }

        const credential = await this.auth.createUserWithEmailAndPassword(email, password);

        // Update display name
        if (displayName) {
            await credential.user.updateProfile({ displayName });
        }

        return credential;
    }

    /**
     * Sign out
     */
    async signOut() {
        if (this.demoMode) {
            localStorage.removeItem('demoMode');
            this.showLogoutSuccess();
            return;
        }

        await this.auth.signOut();
        this.showLogoutSuccess();
    }

    /**
     * Show logout success modal and redirect to landing page
     */
    showLogoutSuccess() {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.2s ease;
        `;

        // Create modal content
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            border-radius: 16px;
            padding: 2.5rem;
            text-align: center;
            max-width: 400px;
            margin: 1rem;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
            animation: scaleIn 0.3s ease;
        `;

        modal.innerHTML = `
            <div style="
                width: 64px;
                height: 64px;
                background: linear-gradient(135deg, #10b981, #059669);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 1.5rem;
            ">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            </div>
            <h2 style="
                font-size: 1.5rem;
                font-weight: 700;
                color: #0f172a;
                margin-bottom: 0.5rem;
                font-family: 'Roboto Serif', Georgia, serif;
            ">Signed Out Successfully</h2>
            <p style="
                color: #64748b;
                font-size: 1rem;
                margin-bottom: 1.5rem;
                font-family: 'Roboto Serif', Georgia, serif;
            ">You have been securely logged out.</p>
            <p style="
                color: #94a3b8;
                font-size: 0.875rem;
                font-family: 'Roboto Serif', Georgia, serif;
            ">Redirecting to home page...</p>
        `;

        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes scaleIn {
                from { opacity: 0; transform: scale(0.9); }
                to { opacity: 1; transform: scale(1); }
            }
        `;
        document.head.appendChild(style);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Redirect after delay
        setTimeout(() => {
            window.location.href = '/home.html';
        }, 1500);
    }

    /**
     * Send password reset email
     */
    async resetPassword(email) {
        if (this.demoMode) {
            throw new Error('Firebase not configured');
        }

        return this.auth.sendPasswordResetEmail(email);
    }

    /**
     * Get current ID token (refreshed if needed)
     */
    async getToken() {
        if (this.demoMode) {
            return 'demo-token';
        }

        if (!this.user) {
            return null;
        }

        // Get fresh token
        this.token = await this.user.getIdToken(true);
        return this.token;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.user || this.demoMode;
    }

    /**
     * Get current user
     */
    getUser() {
        return this.user;
    }

    /**
     * Check if running in demo mode
     */
    isDemoMode() {
        return this.demoMode;
    }

    /**
     * Set callback for auth state changes
     */
    onAuthStateChanged(callback) {
        this.onAuthStateChangedCallback = callback;

        // If already initialized, call immediately
        if (this.isInitialized) {
            callback(this.user);
        }
    }
}

// Create global instance
const authManager = new AuthManager();
