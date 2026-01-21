const pdfParse = require('pdf-parse');

/**
 * Parse PDF file and extract transaction data
 * @param {Buffer} buffer - PDF file buffer
 * @param {string} fileType - 'bank' or 'gl'
 * @returns {Promise<Array>} Parsed transactions
 */
async function parse(buffer, fileType = 'bank') {
    try {
        const data = await pdfParse(buffer);
        const text = data.text;
        const lines = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        console.log(`[PDF] Extracted ${lines.length} lines from PDF`);

        if (fileType === 'bank') {
            return parseBankStatementPDF(lines);
        }

        return parseGLReportPDF(lines);
    } catch (error) {
        console.error('[PDF] Parse error:', error.message);
        throw new Error(`Failed to parse PDF: ${error.message}`);
    }
}

/**
 * Parse bank statement PDF
 */
function parseBankStatementPDF(lines) {
    const transactions = [];

    // Common date patterns
    const datePatterns = [
        /(\d{1,2}\/\d{1,2}\/\d{2,4})/,           // MM/DD/YYYY or M/D/YY
        /(\d{1,2}-\d{1,2}-\d{2,4})/,             // MM-DD-YYYY
        /(\d{4}-\d{2}-\d{2})/,                   // YYYY-MM-DD
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i  // Month DD, YYYY
    ];

    // Amount pattern - matches currency amounts
    const amountPattern = /\$?\s*([\d,]+\.?\d*)/g;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Try to find a date in the line
        let date = null;
        for (const pattern of datePatterns) {
            const dateMatch = line.match(pattern);
            if (dateMatch) {
                date = normalizeDate(dateMatch[0]);
                break;
            }
        }

        // If we found a date, try to extract transaction data
        if (date) {
            const amounts = [];
            let match;
            const tempPattern = /\$?\s*([\d,]+\.\d{2})/g;

            while ((match = tempPattern.exec(line)) !== null) {
                const amount = parseFloat(match[1].replace(/,/g, ''));
                if (!isNaN(amount) && amount > 0) {
                    amounts.push(amount);
                }
            }

            if (amounts.length > 0) {
                // Extract description (text between date and first amount)
                const dateIdx = line.search(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);
                const amountIdx = line.search(/\$?\s*[\d,]+\.\d{2}/);

                let description = '';
                if (dateIdx >= 0 && amountIdx > dateIdx) {
                    description = line.substring(dateIdx + 10, amountIdx).trim();
                }

                // Clean up description
                description = description
                    .replace(/^\s*[-:]\s*/, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                transactions.push({
                    date,
                    description: description || 'Transaction',
                    amount: amounts[amounts.length - 1], // Usually the last amount is the transaction amount
                    balance: amounts.length > 1 ? amounts[0] : null,
                    rawLine: line
                });
            }
        }
    }

    console.log(`[PDF] Extracted ${transactions.length} bank transactions`);
    return transactions;
}

/**
 * Parse GL report PDF
 */
function parseGLReportPDF(lines) {
    const entries = [];

    // Account number patterns
    const accountPatterns = [
        /(\d{4,}-\d{2,}-?\d*)/,      // 1234-567 or 1234-567-890
        /(\d{5,})/,                   // 5+ digit account numbers
        /([A-Z]{1,3}\d{4,})/          // Letter prefix + numbers
    ];

    for (const line of lines) {
        // Try to find an account number
        let accountNumber = null;
        for (const pattern of accountPatterns) {
            const match = line.match(pattern);
            if (match) {
                accountNumber = match[1];
                break;
            }
        }

        if (accountNumber) {
            // Extract amounts from the line
            const amounts = [];
            const amountPattern = /\$?\s*([\d,]+\.\d{2})/g;
            let match;

            while ((match = amountPattern.exec(line)) !== null) {
                const amount = parseFloat(match[1].replace(/,/g, ''));
                if (!isNaN(amount)) {
                    amounts.push(amount);
                }
            }

            if (amounts.length > 0) {
                // Get description (text after account number, before amounts)
                const accountIdx = line.indexOf(accountNumber);
                const amountIdx = line.search(/\$?\s*[\d,]+\.\d{2}/);

                let description = '';
                if (accountIdx >= 0 && amountIdx > accountIdx) {
                    description = line.substring(accountIdx + accountNumber.length, amountIdx).trim();
                }

                entries.push({
                    accountNumber,
                    description: description || 'GL Entry',
                    debit: amounts[0] || 0,
                    credit: amounts[1] || 0,
                    amount: amounts[0] || amounts[1] || 0,
                    rawLine: line
                });
            }
        }
    }

    console.log(`[PDF] Extracted ${entries.length} GL entries`);
    return entries;
}

/**
 * Normalize date string to MM/DD/YYYY format
 */
function normalizeDate(dateStr) {
    // Handle Month DD, YYYY format
    const monthNames = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };

    const monthMatch = dateStr.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i);
    if (monthMatch) {
        const month = monthNames[monthMatch[1].toLowerCase()];
        const day = monthMatch[2].padStart(2, '0');
        const year = monthMatch[3];
        return `${month}/${day}/${year}`;
    }

    // Handle YYYY-MM-DD
    const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return `${isoMatch[2]}/${isoMatch[3]}/${isoMatch[1]}`;
    }

    // Handle MM-DD-YYYY (convert dashes to slashes)
    return dateStr.replace(/-/g, '/');
}

module.exports = { parse };
