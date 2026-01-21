/**
 * OFX/QFX (Open Financial Exchange) Parser
 * Parses SGML-like OFX format commonly exported by banks
 */

/**
 * Parse OFX/QFX content
 * @param {string} content - OFX file content as string
 * @returns {Array} Parsed transactions
 */
function parse(content) {
    const transactions = [];

    console.log('[OFX] Parsing OFX/QFX content');

    // Remove SGML headers (everything before <OFX>)
    const ofxStart = content.indexOf('<OFX>');
    if (ofxStart === -1) {
        // Try case-insensitive
        const lowerContent = content.toLowerCase();
        const ofxStartLower = lowerContent.indexOf('<ofx>');
        if (ofxStartLower === -1) {
            console.warn('[OFX] No <OFX> tag found in content');
            return transactions;
        }
    }

    // Extract all STMTTRN (statement transaction) blocks
    const stmtTrnPattern = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;

    while ((match = stmtTrnPattern.exec(content)) !== null) {
        const block = match[1];

        const transaction = {
            type: extractTag(block, 'TRNTYPE') || 'OTHER',
            date: parseOFXDate(extractTag(block, 'DTPOSTED')),
            amount: parseFloat(extractTag(block, 'TRNAMT') || '0'),
            fitId: extractTag(block, 'FITID'),
            name: extractTag(block, 'NAME'),
            memo: extractTag(block, 'MEMO'),
            checkNumber: extractTag(block, 'CHECKNUM'),
            refNumber: extractTag(block, 'REFNUM')
        };

        // Build description from available fields
        transaction.description = [transaction.name, transaction.memo]
            .filter(Boolean)
            .join(' - ') || 'OFX Transaction';

        // Determine credit/debit based on amount sign
        if (transaction.amount > 0) {
            transaction.amountCredit = transaction.amount;
            transaction.amountDebit = 0;
        } else {
            transaction.amountCredit = 0;
            transaction.amountDebit = Math.abs(transaction.amount);
        }

        // Normalize amount to positive for consistent handling
        transaction.amount = Math.abs(transaction.amount);

        transactions.push(transaction);
    }

    // Also try to extract bank account info
    const bankAcctInfo = {
        bankId: extractTag(content, 'BANKID'),
        acctId: extractTag(content, 'ACCTID'),
        acctType: extractTag(content, 'ACCTTYPE')
    };

    // Extract statement date range
    const dtStart = parseOFXDate(extractTag(content, 'DTSTART'));
    const dtEnd = parseOFXDate(extractTag(content, 'DTEND'));

    console.log(`[OFX] Extracted ${transactions.length} transactions`);
    if (dtStart && dtEnd) {
        console.log(`[OFX] Date range: ${dtStart} to ${dtEnd}`);
    }

    return transactions;
}

/**
 * Extract value from OFX tag
 * OFX uses SGML-like format: <TAG>value (no closing tag sometimes)
 */
function extractTag(block, tagName) {
    // Try with closing tag first
    const closingPattern = new RegExp(`<${tagName}>([^<]+)<\/${tagName}>`, 'i');
    let match = block.match(closingPattern);

    if (match) {
        return match[1].trim();
    }

    // Try without closing tag (SGML style)
    const openPattern = new RegExp(`<${tagName}>([^<\\r\\n]+)`, 'i');
    match = block.match(openPattern);

    if (match) {
        return match[1].trim();
    }

    return '';
}

/**
 * Parse OFX date format
 * OFX dates are in format: YYYYMMDDHHMMSS or YYYYMMDD
 * Sometimes with timezone: YYYYMMDDHHMMSS[-5:EST]
 */
function parseOFXDate(dateStr) {
    if (!dateStr) return null;

    // Remove timezone info if present
    const cleanDate = dateStr.split('[')[0].trim();

    if (cleanDate.length < 8) return null;

    const year = cleanDate.substring(0, 4);
    const month = cleanDate.substring(4, 6);
    const day = cleanDate.substring(6, 8);

    // Validate
    const y = parseInt(year);
    const m = parseInt(month);
    const d = parseInt(day);

    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
        return null;
    }

    return `${month}/${day}/${year}`;
}

/**
 * Get transaction type description
 */
function getTransactionTypeDescription(type) {
    const types = {
        'CREDIT': 'Credit',
        'DEBIT': 'Debit',
        'INT': 'Interest',
        'DIV': 'Dividend',
        'FEE': 'Fee',
        'SRVCHG': 'Service Charge',
        'DEP': 'Deposit',
        'ATM': 'ATM',
        'POS': 'Point of Sale',
        'XFER': 'Transfer',
        'CHECK': 'Check',
        'PAYMENT': 'Payment',
        'CASH': 'Cash',
        'DIRECTDEP': 'Direct Deposit',
        'DIRECTDEBIT': 'Direct Debit',
        'REPEATPMT': 'Recurring Payment',
        'OTHER': 'Other'
    };

    return types[type?.toUpperCase()] || type || 'Unknown';
}

module.exports = { parse, parseOFXDate, extractTag };
