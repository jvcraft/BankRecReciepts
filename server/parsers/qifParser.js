/**
 * QIF (Quicken Interchange Format) Parser
 * Parses line-based QIF format used by Quicken and many financial applications
 */

/**
 * Parse QIF content
 * @param {string} content - QIF file content as string
 * @returns {Array} Parsed transactions
 */
function parse(content) {
    const transactions = [];
    const lines = content.split(/\r?\n/);

    console.log('[QIF] Parsing QIF content');

    let current = {};
    let accountType = 'Bank'; // Default account type

    for (const line of lines) {
        if (line.length === 0) continue;

        const code = line.charAt(0);
        const value = line.substring(1).trim();

        switch (code) {
            case '!':
                // Account type header
                if (value.startsWith('Type:')) {
                    accountType = value.substring(5).trim();
                }
                break;

            case 'D':
                // Date
                current.date = parseQIFDate(value);
                break;

            case 'T':
                // Amount (main transaction amount)
                current.amount = parseQIFAmount(value);
                break;

            case 'U':
                // Amount (same as T, used by some versions)
                if (current.amount === undefined) {
                    current.amount = parseQIFAmount(value);
                }
                break;

            case 'P':
                // Payee
                current.payee = value;
                break;

            case 'M':
                // Memo
                current.memo = value;
                break;

            case 'A':
                // Address (multi-line, collect all)
                current.address = (current.address || '') + value + '\n';
                break;

            case 'N':
                // Number (check number or reference)
                current.checkNumber = value;
                break;

            case 'C':
                // Cleared status
                // * or c = cleared, X or R = reconciled
                current.cleared = value === '*' || value.toLowerCase() === 'c' || value.toLowerCase() === 'x' || value.toLowerCase() === 'r';
                break;

            case 'L':
                // Category
                current.category = value;
                break;

            case 'S':
                // Split category
                if (!current.splits) current.splits = [];
                current.splits.push({ category: value });
                break;

            case 'E':
                // Split memo
                if (current.splits && current.splits.length > 0) {
                    current.splits[current.splits.length - 1].memo = value;
                }
                break;

            case '$':
                // Split amount
                if (current.splits && current.splits.length > 0) {
                    current.splits[current.splits.length - 1].amount = parseQIFAmount(value);
                }
                break;

            case '^':
                // End of transaction
                if (current.date || current.amount !== undefined) {
                    // Build description
                    current.description = [current.payee, current.memo]
                        .filter(Boolean)
                        .join(' - ') || 'QIF Transaction';

                    // Determine credit/debit
                    const amount = current.amount || 0;
                    if (amount >= 0) {
                        current.amountCredit = amount;
                        current.amountDebit = 0;
                    } else {
                        current.amountCredit = 0;
                        current.amountDebit = Math.abs(amount);
                    }

                    // Normalize amount
                    current.amount = Math.abs(amount);

                    transactions.push({
                        date: current.date,
                        description: current.description,
                        payee: current.payee,
                        memo: current.memo,
                        checkNumber: current.checkNumber,
                        amount: current.amount,
                        amountCredit: current.amountCredit,
                        amountDebit: current.amountDebit,
                        category: current.category,
                        cleared: current.cleared || false,
                        splits: current.splits,
                        accountType
                    });
                }
                current = {};
                break;
        }
    }

    console.log(`[QIF] Extracted ${transactions.length} transactions`);
    return transactions;
}

/**
 * Parse QIF date format
 * QIF dates can be in various formats:
 * - MM/DD/YY or MM/DD/YYYY
 * - M/D/YY or M/D/YYYY
 * - DD/MM/YY (UK format, less common)
 * - MM-DD-YY
 * - Special: 12/31'05 (apostrophe for year)
 */
function parseQIFDate(dateStr) {
    if (!dateStr) return null;

    // Handle apostrophe year format (12/31'05)
    const apostropheMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})'(\d{2})/);
    if (apostropheMatch) {
        const month = apostropheMatch[1].padStart(2, '0');
        const day = apostropheMatch[2].padStart(2, '0');
        let year = apostropheMatch[3];
        year = parseInt(year) > 50 ? '19' + year : '20' + year;
        return `${month}/${day}/${year}`;
    }

    // Handle standard formats
    const standardMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (standardMatch) {
        const month = standardMatch[1].padStart(2, '0');
        const day = standardMatch[2].padStart(2, '0');
        let year = standardMatch[3];

        // Handle 2-digit years
        if (year.length === 2) {
            year = parseInt(year) > 50 ? '19' + year : '20' + year;
        }

        return `${month}/${day}/${year}`;
    }

    return null;
}

/**
 * Parse QIF amount format
 * QIF amounts may include:
 * - Negative signs
 * - Commas as thousand separators
 * - Currency symbols
 */
function parseQIFAmount(value) {
    if (!value) return 0;

    // Remove currency symbols and spaces
    let cleaned = value.replace(/[$€£¥\s]/g, '');

    // Handle parentheses for negative (accounting notation)
    const isParenNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
    if (isParenNegative) {
        cleaned = '-' + cleaned.slice(1, -1);
    }

    // Remove commas
    cleaned = cleaned.replace(/,/g, '');

    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
}

module.exports = { parse, parseQIFDate, parseQIFAmount };
