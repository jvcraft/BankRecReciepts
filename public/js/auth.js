/**
 * Authentication Manager
 * Handles Firebase Authentication and session management
 */

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDvSJyK2VW928tZTTyxCLzRqKhhjS-Tweg",
    authDomain: "bankrecreciepts.firebaseapp.com",
    projectId: "bankrecreciepts",
    storageBucket: "bankrecreciepts.firebasestorage.app",
    messagingSenderId: "298789104173",
    appId: "1:298789104173:web:338e4827a2b40e777866a4",
    measurementId: "G-WD70M7R787"
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
            window.location.href = '/login.html';
            return;
        }

        await this.auth.signOut();
        window.location.href = '/login.html';
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
