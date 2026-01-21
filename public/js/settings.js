/**
 * Settings Module
 * Handles user settings management
 */

let currentSettings = null;

/**
 * Load user settings
 */
async function loadSettings() {
    try {
        currentSettings = await apiClient.getSettings();
        applySettingsToUI();
        applyTheme(currentSettings.theme);
    } catch (error) {
        console.error('[SETTINGS] Load failed:', error);
        // Use defaults
        currentSettings = getDefaultSettings();
        applySettingsToUI();
    }
}

/**
 * Get default settings
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

/**
 * Apply settings to UI elements
 */
function applySettingsToUI() {
    if (!currentSettings) return;

    // Matching preferences
    const dateRangeEl = document.getElementById('settingsDateRange');
    const amountToleranceEl = document.getElementById('settingsAmountTolerance');

    if (dateRangeEl) dateRangeEl.value = currentSettings.defaultDateRange;
    if (amountToleranceEl) amountToleranceEl.value = currentSettings.defaultAmountTolerance;

    // Display preferences
    const dateFormatEl = document.getElementById('settingsDateFormat');
    const currencyFormatEl = document.getElementById('settingsCurrencyFormat');
    const themeEl = document.getElementById('settingsTheme');

    if (dateFormatEl) dateFormatEl.value = currentSettings.dateFormat;
    if (currencyFormatEl) currencyFormatEl.value = currentSettings.currencyFormat;
    if (themeEl) themeEl.value = currentSettings.theme;

    // Export preferences
    const exportFormatEl = document.getElementById('settingsExportFormat');
    const autoSaveEl = document.getElementById('settingsAutoSave');
    const showConfidenceEl = document.getElementById('settingsShowConfidence');

    if (exportFormatEl) exportFormatEl.value = currentSettings.exportFormat;
    if (autoSaveEl) autoSaveEl.checked = currentSettings.autoSaveEnabled;
    if (showConfidenceEl) showConfidenceEl.checked = currentSettings.showConfidenceScores;

    // Also apply defaults to main reconciliation view
    applyDefaultsToReconciliation();
}

/**
 * Apply default settings to reconciliation view
 */
function applyDefaultsToReconciliation() {
    if (!currentSettings) return;

    const dateRangeInput = document.getElementById('dateRange');
    const amountToleranceInput = document.getElementById('amountTolerance');

    // Only apply if fields are at default/empty values
    if (dateRangeInput && (dateRangeInput.value === '3' || !dateRangeInput.value)) {
        dateRangeInput.value = currentSettings.defaultDateRange;
    }

    if (amountToleranceInput && (amountToleranceInput.value === '0.00' || !amountToleranceInput.value)) {
        amountToleranceInput.value = currentSettings.defaultAmountTolerance;
    }

    // Update app settings if available
    if (typeof app !== 'undefined' && app.settings) {
        app.settings.dateRange = currentSettings.defaultDateRange;
        app.settings.amountTolerance = currentSettings.defaultAmountTolerance;
    }
}

/**
 * Apply theme to document
 */
function applyTheme(theme) {
    const root = document.documentElement;

    // Remove existing theme classes
    root.classList.remove('theme-light', 'theme-dark');

    let resolvedTheme = theme;

    if (theme === 'system') {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        resolvedTheme = prefersDark ? 'dark' : 'light';
    }

    root.classList.add(`theme-${resolvedTheme}`);

    // Store in localStorage for persistence
    localStorage.setItem('theme', theme);

    console.log(`[THEME] Applied theme: ${resolvedTheme} (setting: ${theme})`);
}

/**
 * Gather settings from UI
 */
function gatherSettingsFromUI() {
    return {
        defaultDateRange: parseInt(document.getElementById('settingsDateRange')?.value) || 3,
        defaultAmountTolerance: parseFloat(document.getElementById('settingsAmountTolerance')?.value) || 0,
        dateFormat: document.getElementById('settingsDateFormat')?.value || 'MM/DD/YYYY',
        currencyFormat: document.getElementById('settingsCurrencyFormat')?.value || 'USD',
        theme: document.getElementById('settingsTheme')?.value || 'light',
        exportFormat: document.getElementById('settingsExportFormat')?.value || 'xlsx',
        autoSaveEnabled: document.getElementById('settingsAutoSave')?.checked || false,
        showConfidenceScores: document.getElementById('settingsShowConfidence')?.checked ?? true
    };
}

/**
 * Save settings
 */
async function saveSettings() {
    const saveBtn = document.getElementById('saveSettings');
    const originalText = saveBtn.textContent;

    saveBtn.classList.add('btn-loading');
    saveBtn.disabled = true;

    try {
        const settings = gatherSettingsFromUI();

        currentSettings = await apiClient.updateSettings(settings);

        // Apply theme immediately
        applyTheme(currentSettings.theme);

        // Apply defaults to reconciliation
        applyDefaultsToReconciliation();

        // Show success feedback
        saveBtn.textContent = 'Saved!';
        saveBtn.style.background = 'var(--success-color)';

        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.background = '';
        }, 2000);

    } catch (error) {
        console.error('[SETTINGS] Save failed:', error);
        alert('Failed to save settings: ' + error.message);
    } finally {
        saveBtn.classList.remove('btn-loading');
        saveBtn.disabled = false;
    }
}

/**
 * Get current settings
 */
function getCurrentSettings() {
    return currentSettings || getDefaultSettings();
}

// Apply theme immediately before DOM is fully loaded to prevent flash
(function() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');

    let resolvedTheme = savedTheme;
    if (savedTheme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        resolvedTheme = prefersDark ? 'dark' : 'light';
    }

    root.classList.add(`theme-${resolvedTheme}`);
})();

// Set up event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Save settings button
    const saveBtn = document.getElementById('saveSettings');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveSettings);
    }

    // Theme change - apply immediately
    const themeSelect = document.getElementById('settingsTheme');
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            applyTheme(e.target.value);
        });

        // Set initial value from localStorage
        const savedTheme = localStorage.getItem('theme') || 'light';
        themeSelect.value = savedTheme;
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const savedTheme = localStorage.getItem('theme') || 'light';
        if (savedTheme === 'system') {
            applyTheme('system');
        }
    });

    // Load settings on init
    if (typeof authManager !== 'undefined' && authManager.isAuthenticated()) {
        loadSettings();
    } else if (typeof authManager !== 'undefined') {
        // Wait for auth
        authManager.onAuthStateChanged((user) => {
            if (user) {
                loadSettings();
            }
        });
    }
});
