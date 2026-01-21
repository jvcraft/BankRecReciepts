/**
 * API Client
 * Handles all HTTP requests to the backend API
 */

class APIClient {
    constructor() {
        this.baseURL = '/api';
    }

    /**
     * Make authenticated API request
     */
    async request(endpoint, options = {}) {
        const token = await authManager.getToken();

        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
                ...options.headers
            }
        };

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, config);

            // Handle non-JSON responses
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                if (!response.ok) {
                    throw new Error(`Request failed with status ${response.status}`);
                }
                return response.text();
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('[API] Request failed:', endpoint, error);
            throw error;
        }
    }

    // ==================== Reconciliation ====================

    /**
     * Save reconciliation session
     */
    async saveReconciliation(data) {
        return this.request('/reconciliation/save', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * Load reconciliation session
     */
    async loadReconciliation(id) {
        return this.request(`/reconciliation/${id}`);
    }

    /**
     * Parse file (server-side parsing for PDF/OFX/QIF)
     */
    async parseFile(file, fileType) {
        const token = await authManager.getToken();

        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileType', fileType);

        const response = await fetch(`${this.baseURL}/reconciliation/parse`, {
            method: 'POST',
            headers: {
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || 'File parsing failed');
        }

        return data;
    }

    /**
     * Update reconciliation
     */
    async updateReconciliation(id, updates) {
        return this.request(`/reconciliation/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    }

    // ==================== History ====================

    /**
     * Get reconciliation history
     */
    async getHistory(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/history?${query}`);
    }

    /**
     * Get history statistics
     */
    async getHistoryStats() {
        return this.request('/history/stats');
    }

    /**
     * Delete reconciliation
     */
    async deleteReconciliation(id) {
        return this.request(`/history/${id}`, {
            method: 'DELETE'
        });
    }

    /**
     * Duplicate reconciliation
     */
    async duplicateReconciliation(id) {
        return this.request(`/history/${id}/duplicate`, {
            method: 'POST'
        });
    }

    // ==================== Settings ====================

    /**
     * Get user settings
     */
    async getSettings() {
        return this.request('/settings');
    }

    /**
     * Update user settings
     */
    async updateSettings(settings) {
        return this.request('/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
    }

    /**
     * Reset settings to defaults
     */
    async resetSettings() {
        return this.request('/settings/reset', {
            method: 'POST'
        });
    }

    // ==================== Auth ====================

    /**
     * Get user profile
     */
    async getProfile() {
        return this.request('/auth/profile');
    }

    /**
     * Delete user account
     */
    async deleteAccount() {
        return this.request('/auth/profile', {
            method: 'DELETE'
        });
    }
}

// Create global instance
const apiClient = new APIClient();

/**
 * Helper function to save current reconciliation
 * Called from the save modal
 */
async function saveReconciliation(name, description) {
    if (!app) {
        throw new Error('Application not initialized');
    }

    const data = {
        name,
        description,
        bankFileName: app.bankFileName || '',
        glFileName: app.glFileName || '',
        settings: app.settings,
        matchedTransactions: app.matchedTransactions.map(m => ({
            bankTransaction: m.bankTransaction,
            glEntry: m.glEntry,
            matchScore: m.matchScore,
            matchType: m.matchType,
            isManual: m.isManual || false
        })),
        unmatchedBank: app.unmatchedBank,
        unmatchedGL: app.unmatchedGL
    };

    return apiClient.saveReconciliation(data);
}

/**
 * Load a reconciliation from history
 */
async function loadReconciliationFromHistory(id) {
    const data = await apiClient.loadReconciliation(id);

    if (!app) {
        throw new Error('Application not initialized');
    }

    // Restore data to app
    app.matchedTransactions = data.matchedTransactions || [];
    app.unmatchedBank = data.unmatchedBank || [];
    app.unmatchedGL = data.unmatchedGL || [];
    app.settings = data.settings || app.settings;
    app.bankFileName = data.bankFileName;
    app.glFileName = data.glFileName;

    // Update UI
    document.getElementById('bankFileName').textContent = data.bankFileName || 'Loaded from history';
    document.getElementById('glFileName').textContent = data.glFileName || 'Loaded from history';

    // Show results
    app.displayResults();

    // Switch to reconciliation view
    if (typeof switchView === 'function') {
        switchView('reconciliation');
    }

    return data;
}
