/**
 * History Module
 * Handles reconciliation history display and management
 */

let historyData = [];
let historyLoading = false;
let historyHasMore = false;
let historyLastId = null;

/**
 * Load reconciliation history
 */
async function loadHistory(reset = true) {
    if (historyLoading) return;

    const historyList = document.getElementById('historyList');
    const historyEmpty = document.getElementById('historyEmpty');
    const historyLoadingEl = document.getElementById('historyLoading');

    if (reset) {
        historyData = [];
        historyLastId = null;
        historyList.innerHTML = '';
    }

    historyLoading = true;
    historyLoadingEl.style.display = 'block';
    historyEmpty.style.display = 'none';

    try {
        const search = document.getElementById('historySearch')?.value || '';
        const status = document.getElementById('historyFilter')?.value || 'all';

        const params = {
            limit: 20,
            ...(historyLastId && { startAfter: historyLastId }),
            ...(status !== 'all' && { status }),
            ...(search && { search })
        };

        const response = await apiClient.getHistory(params);

        historyData = reset
            ? response.reconciliations
            : [...historyData, ...response.reconciliations];

        historyHasMore = response.hasMore;
        historyLastId = response.lastId;

        renderHistoryList();
    } catch (error) {
        console.error('[HISTORY] Load failed:', error);
        // Show empty state instead of error for common cases (no data, not authenticated, etc.)
        if (error.message?.includes('401') || error.message?.includes('not authenticated') ||
            error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            // Show empty state for auth/network issues
            showHistoryEmpty();
        } else {
            showHistoryEmpty();
        }
    } finally {
        historyLoading = false;
        historyLoadingEl.style.display = 'none';
    }
}

/**
 * Render history list
 */
function renderHistoryList() {
    const historyList = document.getElementById('historyList');
    const historyEmpty = document.getElementById('historyEmpty');

    if (historyData.length === 0) {
        historyList.innerHTML = '';
        historyEmpty.style.display = 'block';
        return;
    }

    historyEmpty.style.display = 'none';

    historyList.innerHTML = historyData.map(item => `
        <div class="history-item" onclick="openHistoryItem('${item.id}')">
            <div class="history-item-info">
                <h4>${escapeHtml(item.name)}</h4>
                <p>
                    ${formatHistoryDate(item.createdAt)}
                    ${item.description ? ` - ${escapeHtml(item.description.substring(0, 50))}${item.description.length > 50 ? '...' : ''}` : ''}
                </p>
            </div>
            <div class="history-item-meta">
                <div class="history-item-stat">
                    <div class="value">${item.summary?.totalMatched || 0}</div>
                    <div class="label">Matched</div>
                </div>
                <div class="history-item-stat">
                    <div class="value">${(item.summary?.totalUnmatchedBank || 0) + (item.summary?.totalUnmatchedGL || 0)}</div>
                    <div class="label">Unmatched</div>
                </div>
                <div class="history-item-actions" onclick="event.stopPropagation();">
                    <button class="action-btn match-btn" onclick="openHistoryItem('${item.id}')" title="Open">
                        Open
                    </button>
                    <button class="action-btn secondary-btn" onclick="duplicateHistoryItem('${item.id}')" title="Duplicate" style="padding: 0.375rem 0.5rem;">
                        Copy
                    </button>
                    <button class="action-btn unmatch-btn" onclick="deleteHistoryItem('${item.id}')" title="Delete" style="padding: 0.375rem 0.5rem;">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    // Add load more button if there's more data
    if (historyHasMore) {
        historyList.innerHTML += `
            <div style="text-align: center; padding: 1rem;">
                <button class="secondary-btn" onclick="loadHistory(false)">
                    Load More
                </button>
            </div>
        `;
    }
}

/**
 * Open a history item
 */
async function openHistoryItem(id) {
    try {
        await loadReconciliationFromHistory(id);
    } catch (error) {
        console.error('[HISTORY] Load item failed:', error);
        alert('Failed to load reconciliation: ' + error.message);
    }
}

/**
 * Delete a history item
 */
async function deleteHistoryItem(id) {
    if (!confirm('Are you sure you want to delete this reconciliation? This cannot be undone.')) {
        return;
    }

    try {
        await apiClient.deleteReconciliation(id);

        // Remove from local data
        historyData = historyData.filter(item => item.id !== id);
        renderHistoryList();

    } catch (error) {
        console.error('[HISTORY] Delete failed:', error);
        alert('Failed to delete reconciliation: ' + error.message);
    }
}

/**
 * Duplicate a history item
 */
async function duplicateHistoryItem(id) {
    try {
        const result = await apiClient.duplicateReconciliation(id);
        alert('Reconciliation duplicated successfully!');

        // Reload history
        loadHistory(true);

    } catch (error) {
        console.error('[HISTORY] Duplicate failed:', error);
        alert('Failed to duplicate reconciliation: ' + error.message);
    }
}

/**
 * Format date for history display
 */
function formatHistoryDate(date) {
    if (!date) return 'Unknown date';

    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Unknown date';

    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Today at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
}

/**
 * Show history error message
 */
function showHistoryError(message) {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = `
        <div class="alert alert-error">
            ${escapeHtml(message)}
        </div>
    `;
}

/**
 * Show history empty state
 */
function showHistoryEmpty() {
    const historyList = document.getElementById('historyList');
    const historyEmpty = document.getElementById('historyEmpty');

    historyList.innerHTML = '';
    historyEmpty.style.display = 'block';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// Set up event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Search input
    const historySearch = document.getElementById('historySearch');
    if (historySearch) {
        let searchTimeout;
        historySearch.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => loadHistory(true), 300);
        });
    }

    // Filter select
    const historyFilter = document.getElementById('historyFilter');
    if (historyFilter) {
        historyFilter.addEventListener('change', () => loadHistory(true));
    }
});
