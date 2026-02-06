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
        // Matching preferences
        defaultDateRange: 3,
        defaultAmountTolerance: 0.00,
        matchByCheck: true,
        matchByDescription: false,
        minConfidence: 50,
        // Data parsing
        autoDetectHeaders: true,
        absoluteAmounts: true,
        skipExpenditure: true,
        dateParsing: 'MDY',
        // Display preferences
        dateFormat: 'MM/DD/YYYY',
        currencyFormat: 'USD',
        theme: 'light',
        resultsPerPage: 100,
        showConfidenceScores: true,
        highlightClose: true,
        // Export & Save
        exportFormat: 'xlsx',
        exportUnmatched: true,
        autoSaveEnabled: false
    };
}

/**
 * Apply settings to UI elements
 */
function applySettingsToUI() {
    if (!currentSettings) return;

    // Helper to set value/checked safely
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const setChecked = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };

    // Matching preferences
    setVal('settingsDateRange', currentSettings.defaultDateRange);
    setVal('settingsAmountTolerance', currentSettings.defaultAmountTolerance);
    setChecked('settingsMatchByCheck', currentSettings.matchByCheck ?? true);
    setChecked('settingsMatchByDescription', currentSettings.matchByDescription ?? false);
    setVal('settingsMinConfidence', currentSettings.minConfidence ?? 50);

    // Data parsing
    setChecked('settingsAutoDetectHeaders', currentSettings.autoDetectHeaders ?? true);
    setChecked('settingsAbsoluteAmounts', currentSettings.absoluteAmounts ?? true);
    setChecked('settingsSkipExpenditure', currentSettings.skipExpenditure ?? true);
    setVal('settingsDateParsing', currentSettings.dateParsing ?? 'MDY');

    // Display preferences
    setVal('settingsDateFormat', currentSettings.dateFormat);
    setVal('settingsCurrencyFormat', currentSettings.currencyFormat);
    setVal('settingsTheme', currentSettings.theme);
    setVal('settingsResultsPerPage', currentSettings.resultsPerPage ?? 100);
    setChecked('settingsShowConfidence', currentSettings.showConfidenceScores ?? true);
    setChecked('settingsHighlightClose', currentSettings.highlightClose ?? true);

    // Export & Save
    setVal('settingsExportFormat', currentSettings.exportFormat);
    setChecked('settingsExportUnmatched', currentSettings.exportUnmatched ?? true);
    setChecked('settingsAutoSave', currentSettings.autoSaveEnabled ?? false);

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
        // Matching preferences
        defaultDateRange: parseInt(document.getElementById('settingsDateRange')?.value) || 3,
        defaultAmountTolerance: parseFloat(document.getElementById('settingsAmountTolerance')?.value) || 0,
        matchByCheck: document.getElementById('settingsMatchByCheck')?.checked ?? true,
        matchByDescription: document.getElementById('settingsMatchByDescription')?.checked ?? false,
        minConfidence: parseInt(document.getElementById('settingsMinConfidence')?.value) || 50,
        // Data parsing
        autoDetectHeaders: document.getElementById('settingsAutoDetectHeaders')?.checked ?? true,
        absoluteAmounts: document.getElementById('settingsAbsoluteAmounts')?.checked ?? true,
        skipExpenditure: document.getElementById('settingsSkipExpenditure')?.checked ?? true,
        dateParsing: document.getElementById('settingsDateParsing')?.value || 'MDY',
        // Display preferences
        dateFormat: document.getElementById('settingsDateFormat')?.value || 'MM/DD/YYYY',
        currencyFormat: document.getElementById('settingsCurrencyFormat')?.value || 'USD',
        theme: document.getElementById('settingsTheme')?.value || 'light',
        resultsPerPage: parseInt(document.getElementById('settingsResultsPerPage')?.value) || 100,
        showConfidenceScores: document.getElementById('settingsShowConfidence')?.checked ?? true,
        highlightClose: document.getElementById('settingsHighlightClose')?.checked ?? true,
        // Export & Save
        exportFormat: document.getElementById('settingsExportFormat')?.value || 'xlsx',
        exportUnmatched: document.getElementById('settingsExportUnmatched')?.checked ?? true,
        autoSaveEnabled: document.getElementById('settingsAutoSave')?.checked ?? false
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
 * Reset settings to defaults
 */
function resetSettings() {
    currentSettings = getDefaultSettings();
    applySettingsToUI();
    applyTheme(currentSettings.theme);
    console.log('[SETTINGS] Reset to defaults');
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

    // Reset settings button
    const resetBtn = document.getElementById('resetSettings');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Reset all settings to their default values?')) {
                resetSettings();
            }
        });
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
