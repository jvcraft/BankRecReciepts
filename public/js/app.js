// Municipal Bank Reconciliation Application - Enhanced Version
class BankReconciliation {
    constructor() {
        this.bankData = [];
        this.glData = [];
        this.matchedTransactions = [];
        this.unmatchedBank = [];
        this.unmatchedGL = [];
        this.manualMatches = []; // Track manual matches
        this.selectedMatches = []; // Track multi-selected items for manual matching
        this.manualMatchSource = null; // Current source item for manual matching
        this.bankFileName = '';
        this.glFileName = '';
        this.settings = {
            dateRange: 3,
            amountTolerance: 0.00
        };
        this.filters = {
            dateFrom: null,
            dateTo: null,
            amountMin: null,
            amountMax: null,
            searchText: ''
        };
        this.currentTab = 'matched';
        this.smartMatchSuggestions = []; // Smart match suggestions
        this.pageSize = 15; // Items per page: 15, 50, or Infinity (All)
        this.currentPage = 1;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.addConsoleMessage();
    }

    addConsoleMessage() {
        console.log('%c Municipal Bank Reconciliation System v2.0 ', 'background: #2563eb; color: white; font-size: 14px; padding: 5px;');
        console.log('Debug mode enabled. File parsing and matching details will be logged here.');
        console.log('Excel files will be automatically converted for processing.');
    }

    setupEventListeners() {
        // File inputs
        document.getElementById('bankFile').addEventListener('change', (e) => this.handleFileSelect(e, 'bank'));
        document.getElementById('glFile').addEventListener('change', (e) => this.handleFileSelect(e, 'gl'));

        // Settings
        document.getElementById('dateRange').addEventListener('change', (e) => {
            this.settings.dateRange = parseInt(e.target.value);
        });
        document.getElementById('amountTolerance').addEventListener('change', (e) => {
            this.settings.amountTolerance = parseFloat(e.target.value);
        });

        // Reconcile button
        document.getElementById('reconcileBtn').addEventListener('click', () => this.startReconciliation());

        // Export buttons
        document.getElementById('exportExcel').addEventListener('click', () => this.exportToExcel());
        document.getElementById('exportCSV').addEventListener('click', () => this.exportToCSV());
        document.getElementById('printReport').addEventListener('click', () => this.printReport());

        // Debug button
        document.getElementById('debugBtn').addEventListener('click', () => this.showDebugInfo());

        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());

        // Tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Filter controls
        document.getElementById('dateFrom')?.addEventListener('change', (e) => {
            this.filters.dateFrom = e.target.value ? new Date(e.target.value) : null;
            this.applyFilters();
        });

        document.getElementById('dateTo')?.addEventListener('change', (e) => {
            this.filters.dateTo = e.target.value ? new Date(e.target.value) : null;
            this.applyFilters();
        });

        document.getElementById('amountMin')?.addEventListener('input', (e) => {
            this.filters.amountMin = e.target.value ? parseFloat(e.target.value) : null;
            this.applyFilters();
        });

        document.getElementById('amountMax')?.addEventListener('input', (e) => {
            this.filters.amountMax = e.target.value ? parseFloat(e.target.value) : null;
            this.applyFilters();
        });

        document.getElementById('searchText')?.addEventListener('input', (e) => {
            this.filters.searchText = e.target.value.toLowerCase();
            this.applyFilters();
        });

        document.getElementById('clearFilters')?.addEventListener('click', () => this.clearFilters());

        // Pagination controls
        document.querySelectorAll('.page-size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = btn.dataset.size;
                this.pageSize = size === 'all' ? Infinity : parseInt(size);
                this.currentPage = 1;
                // Update active state
                document.querySelectorAll('.page-size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.switchTab(this.currentTab);
            });
        });
    }

    handleFileSelect(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        console.log(`[FILE] Loading ${type} file: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);

        // Store filename
        if (type === 'bank') {
            this.bankFileName = file.name;
        } else {
            this.glFileName = file.name;
        }

        const fileNameElement = document.getElementById(`${type}FileName`);
        fileNameElement.textContent = file.name;
        fileNameElement.style.color = '#059669';

        const extension = file.name.split('.').pop().toLowerCase();

        // Handle new file formats via server-side parsing
        if (['pdf', 'ofx', 'qfx', 'qif'].includes(extension)) {
            this.parseServerSideFile(file, type);
            return;
        }

        if (type === 'bank') {
            if (extension === 'csv') {
                this.parseBankCSV(file);
            } else if (extension === 'xlsx' || extension === 'xls') {
                this.parseBankExcel(file);
            } else {
                this.parseBankCSV(file); // Default to CSV parsing
            }
        } else {
            this.parseGLFile(file);
        }
    }

    // Server-side parsing for PDF, OFX, QFX, QIF files
    async parseServerSideFile(file, type) {
        console.log(`[PARSE] Sending ${file.name} to server for parsing...`);

        const fileNameElement = document.getElementById(`${type}FileName`);
        fileNameElement.textContent = `${file.name} (parsing...)`;
        fileNameElement.style.color = '#d97706';

        try {
            const result = await apiClient.parseFile(file, type);

            console.log(`[PARSE] Server parsed ${result.rowCount} rows from ${result.parser} file`);

            if (type === 'bank') {
                // Transform server data to match expected format
                this.bankData = result.data.map(item => ({
                    transactionNumber: item.fitId || item.checkNumber || '',
                    date: item.date,
                    description: item.description || item.name || item.payee || '',
                    memo: item.memo || '',
                    amountCredit: item.amountCredit || (item.amount > 0 ? item.amount : 0),
                    amountDebit: item.amountDebit || (item.amount < 0 ? Math.abs(item.amount) : 0),
                    balance: item.balance || 0,
                    checkNumber: item.checkNumber || '',
                    amount: item.amountCredit || item.amount || 0,
                    rawRow: item.rawLine || JSON.stringify(item)
                }));

                console.log(`[SUCCESS] Parsed ${this.bankData.length} bank transactions from ${result.parser}`);
            } else {
                // GL data
                this.glData = result.data.map(item => ({
                    accountNumber: item.accountNumber || '',
                    description: item.description || '',
                    type: item.type || '',
                    beginBalance: item.beginBalance || 0,
                    endingBalance: item.endingBalance || 0,
                    debit: item.debit || item.amount || 0,
                    amount: item.debit || item.amount || 0,
                    rawRow: item.rawLine || JSON.stringify(item)
                }));

                console.log(`[SUCCESS] Parsed ${this.glData.length} GL entries from ${result.parser}`);
            }

            fileNameElement.textContent = `${file.name} (${result.rowCount} rows)`;
            fileNameElement.style.color = '#059669';

            this.checkReadyToReconcile();
        } catch (error) {
            console.error(`[ERROR] Server parsing failed:`, error);
            fileNameElement.textContent = `${file.name} (parse failed)`;
            fileNameElement.style.color = '#dc2626';
            alert(`Failed to parse ${file.name}: ${error.message}`);
        }
    }

    parseBankCSV(file) {
        Papa.parse(file, {
            header: false,  // Don't auto-detect headers - we'll do it smartly
            skipEmptyLines: true,
            complete: (results) => {
                console.log('[PARSE] Raw CSV data received, rows:', results.data.length);
                console.log('[PARSE] First 10 rows:', results.data.slice(0, 10));

                const parsed = this.smartParseBankData(results.data);
                this.bankData = parsed;

                console.log(`[SUCCESS] Parsed ${this.bankData.length} bank transactions`);
                if (this.bankData.length > 0) {
                    console.log('[SAMPLE] First bank transaction:', this.bankData[0]);
                    console.log('[SAMPLE] Last bank transaction:', this.bankData[this.bankData.length - 1]);
                } else {
                    console.error('[ERROR] No bank transactions were parsed!');
                }
                this.checkReadyToReconcile();
            },
            error: (error) => {
                console.error('[ERROR] Parsing bank CSV:', error);
                alert('Error parsing bank CSV: ' + error.message);
            }
        });
    }

    parseBankExcel(file) {
        console.log('[EXCEL] Starting Bank Excel file processing...');
        const reader = new FileReader();

        reader.onerror = () => {
            console.error('[ERROR] Failed to read Bank Excel file');
            alert('Failed to read Bank Excel file. Please try again.');
        };

        reader.onload = (e) => {
            try {
                console.log('[EXCEL] Bank file loaded, parsing workbook...');
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {
                    type: 'array',
                    cellDates: true,
                    cellNF: false,
                    cellText: false
                });

                console.log('[EXCEL] Workbook sheets found:', workbook.SheetNames);

                // Get the first sheet
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                console.log('[EXCEL] Processing sheet:', sheetName);

                // Convert sheet to array format
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                    header: 1,
                    defval: '',
                    raw: false,
                    dateNF: 'mm/dd/yyyy'
                });

                console.log('[EXCEL] Extracted', jsonData.length, 'rows from Bank Excel');
                console.log('[EXCEL] First 10 rows:', jsonData.slice(0, 10));

                const parsed = this.smartParseBankData(jsonData);
                this.bankData = parsed;

                console.log(`[SUCCESS] Parsed ${this.bankData.length} bank transactions`);
                if (this.bankData.length > 0) {
                    console.log('[SAMPLE] First bank transaction:', this.bankData[0]);
                    console.log('[SAMPLE] Last bank transaction:', this.bankData[this.bankData.length - 1]);
                } else {
                    console.error('[ERROR] No bank transactions were parsed!');
                }
                this.checkReadyToReconcile();
            } catch (error) {
                console.error('[ERROR] Bank Excel parsing failed:', error);
                console.error('[ERROR] Stack trace:', error.stack);
                alert('Error parsing Bank Excel file:\n\n' + error.message + '\n\nPlease check the console (F12) for details, or try saving as CSV first.');
            }
        };

        console.log('[EXCEL] Reading Bank file as ArrayBuffer...');
        reader.readAsArrayBuffer(file);
    }

    smartParseBankData(rows) {
        console.log('[SMART] Starting intelligent bank data parsing...');

        // Skip leading metadata rows (e.g., "Account Name : ...", "Account Number : ...", "Date Range : ...")
        // These are single-cell rows or rows with only the first cell populated
        let startIdx = 0;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
            const row = rows[i];
            const nonEmptyCells = row.filter(cell => cell && String(cell).trim() !== '').length;
            const firstCell = String(row[0] || '').toLowerCase().trim();

            // Skip metadata rows: single-cell rows containing labels like "account", "date range", etc.
            if (nonEmptyCells <= 1 && (
                firstCell.includes('account') || firstCell.includes('date range') ||
                firstCell.includes('report') || firstCell.includes('statement') ||
                firstCell === ''
            )) {
                startIdx = i + 1;
                continue;
            }
            break;
        }

        const cleanedRows = startIdx > 0 ? rows.slice(startIdx) : rows;
        console.log(`[SMART] Skipped ${startIdx} metadata rows`);

        // Check if this is a headerless format (like the complex bank export format)
        // Look for timestamp patterns like "20251205000000[-5:EST]*" in first column
        const firstRow = cleanedRows[0];
        if (firstRow && firstRow[0] && /^\d{14}\[/.test(String(firstRow[0]))) {
            console.log('[SMART] Detected headerless bank export format');
            return this.parseHeaderlessBankFormat(cleanedRows);
        }

        // Find header row by looking for date-like patterns and amount columns
        let headerRowIdx = -1;
        let headers = [];

        for (let i = 0; i < Math.min(cleanedRows.length, 20); i++) {
            const row = cleanedRows[i];
            if (!row || row.length < 3) continue;

            const rowStr = row.join('|').toLowerCase();

            // Skip rows that look like metadata (single important cell)
            const nonEmpty = row.filter(cell => cell && String(cell).trim() !== '').length;
            if (nonEmpty <= 1) continue;

            // Look for key indicators of a header row
            if (rowStr.includes('date') && (rowStr.includes('amount') || rowStr.includes('debit') || rowStr.includes('credit'))) {
                headerRowIdx = i;
                headers = row.map(h => String(h).trim());
                console.log(`[SMART] Found header row at line ${i + startIdx}:`, headers);
                break;
            }
        }

        if (headerRowIdx === -1) {
            console.log('[SMART] No header found, attempting to parse as data-only format');
            return this.parseDataOnlyBankFormat(cleanedRows);
        }

        // Create column mapping using fuzzy matching
        const columnMap = this.detectBankColumns(headers);
        console.log('[SMART] Column mapping:', columnMap);

        // Parse data rows
        const dataRows = cleanedRows.slice(headerRowIdx + 1);
        const transactions = [];

        for (const row of dataRows) {
            // Skip empty rows
            if (row.length === 0 || row.every(cell => !cell || String(cell).trim() === '')) {
                continue;
            }

            // Check if this row has a valid date
            const dateValue = row[columnMap.date];
            if (!dateValue || !this.isValidDate(dateValue)) {
                continue;
            }

            // Parse amounts - use Math.abs since some bank exports store debits as negative
            const rawCredit = this.parseAmount(row[columnMap.credit] || '0');
            const rawDebit = this.parseAmount(row[columnMap.debit] || '0');
            const credit = Math.abs(rawCredit);
            const debit = Math.abs(rawDebit);

            // Determine net amount: credits are positive (inflow), debits are negative (outflow)
            let amount;
            if (credit > 0 && debit > 0) {
                amount = credit - debit; // Both present, net them
            } else if (credit > 0) {
                amount = credit;
            } else if (debit > 0) {
                amount = -debit;
            } else if (columnMap.amount >= 0) {
                amount = this.parseAmount(row[columnMap.amount] || '0');
            } else {
                amount = 0;
            }

            // Skip if no amount
            if (amount === 0) {
                continue;
            }

            // Extract check number from the transaction number field if available
            // Format: "20250131000000[-5:EST]*-18340.00*1*42144*Check Withdrawal"
            let checkNumber = row[columnMap.checkNumber] || '';
            if (!checkNumber && columnMap.transactionNumber >= 0) {
                const txnStr = String(row[columnMap.transactionNumber] || '');
                const checkMatch = txnStr.match(/\*(\d{4,})\*(?:Check|Chk)/i);
                if (checkMatch) {
                    checkNumber = checkMatch[1];
                }
            }

            transactions.push({
                transactionNumber: row[columnMap.transactionNumber] || '',
                date: this.parseDate(dateValue),
                description: row[columnMap.description] || '',
                memo: row[columnMap.memo] || '',
                amountCredit: credit,
                amountDebit: debit,
                balance: this.parseAmount(row[columnMap.balance] || '0'),
                checkNumber: checkNumber,
                amount: Math.abs(amount),
                isDebit: amount < 0,
                rawRow: row
            });
        }

        console.log(`[SMART] Extracted ${transactions.length} valid transactions from bank`);
        return transactions;
    }

    parseHeaderlessBankFormat(rows) {
        // Format: "20251205000000[-5:EST]*-6270.42*1*18969*Check Withdrawal,12/5/2025,Check Withdrawal,..."
        const transactions = [];

        for (const row of rows) {
            // Skip empty rows
            if (!row || row.length === 0 || !row[0]) continue;

            const firstCell = String(row[0]).trim();

            // Skip summary rows or empty first cells
            if (!firstCell || firstCell.startsWith(',')) continue;

            // Try to parse the complex format
            // First cell contains: timestamp*amount*flag*checknum*description
            const parts = firstCell.split('*');
            if (parts.length >= 4) {
                const timestamp = parts[0]; // e.g., "20251205000000[-5:EST]"
                const amount = this.parseAmount(parts[1]); // e.g., "-6270.42"
                const checkNumber = parts[3]; // e.g., "18969"
                const description = parts[4] || '';

                // Parse date from timestamp (YYYYMMDD)
                const dateMatch = timestamp.match(/^(\d{4})(\d{2})(\d{2})/);
                let date = null;
                if (dateMatch) {
                    date = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
                }

                // Also check for date in other columns (e.g., column 1 might have "12/5/2025")
                if (!date && row[1]) {
                    date = this.parseDate(row[1]);
                }

                if (date && amount !== 0) {
                    transactions.push({
                        transactionNumber: checkNumber || '',
                        date: date,
                        description: description || row[2] || '',
                        memo: row[3] || '',
                        amountCredit: amount > 0 ? amount : 0,
                        amountDebit: amount < 0 ? Math.abs(amount) : 0,
                        balance: this.parseAmount(row[6] || '0'),
                        checkNumber: checkNumber || '',
                        amount: Math.abs(amount),
                        isDebit: amount < 0,
                        rawRow: row
                    });
                }
            } else {
                // Try standard column format
                // Columns might be: Date, Description, Memo, Debit, Credit, Balance, CheckNum
                const dateValue = row[1] || row[0];
                if (this.isValidDate(dateValue)) {
                    const debit = this.parseAmount(row[4] || '0');
                    const credit = this.parseAmount(row[5] || '0');
                    const amount = credit > 0 ? credit : debit;

                    if (amount !== 0) {
                        transactions.push({
                            transactionNumber: row[6] || '',
                            date: this.parseDate(dateValue),
                            description: row[2] || '',
                            memo: row[3] || '',
                            amountCredit: credit,
                            amountDebit: debit,
                            balance: 0,
                            checkNumber: row[6] || row[7] || '',
                            amount: Math.abs(amount),
                            isDebit: debit > 0,
                            rawRow: row
                        });
                    }
                }
            }
        }

        console.log(`[SMART] Parsed ${transactions.length} transactions from headerless format`);
        return transactions;
    }

    parseDataOnlyBankFormat(rows) {
        // Try to infer structure from data patterns
        const transactions = [];

        for (const row of rows) {
            if (!row || row.length < 3) continue;

            // Look for date pattern in any column
            let dateIdx = -1;
            let dateValue = null;

            for (let i = 0; i < Math.min(row.length, 5); i++) {
                if (this.isValidDate(row[i])) {
                    dateIdx = i;
                    dateValue = row[i];
                    break;
                }
            }

            if (!dateValue) continue;

            // Look for amount columns (numbers with currency formatting)
            let amounts = [];
            for (let i = 0; i < row.length; i++) {
                const val = this.parseAmount(row[i]);
                if (val !== 0) {
                    amounts.push({ idx: i, value: val });
                }
            }

            if (amounts.length === 0) continue;

            // Use the largest amount as the main amount
            const mainAmount = amounts.reduce((a, b) => Math.abs(a.value) > Math.abs(b.value) ? a : b);

            // Find description (usually longest text field)
            let description = '';
            for (let i = 0; i < row.length; i++) {
                const cell = String(row[i] || '').trim();
                if (cell.length > description.length && !/^[\d.,$()\-\s]+$/.test(cell) && !this.isValidDate(cell)) {
                    description = cell;
                }
            }

            transactions.push({
                transactionNumber: '',
                date: this.parseDate(dateValue),
                description: description,
                memo: '',
                amountCredit: mainAmount.value > 0 ? mainAmount.value : 0,
                amountDebit: mainAmount.value < 0 ? Math.abs(mainAmount.value) : 0,
                balance: 0,
                checkNumber: '',
                amount: Math.abs(mainAmount.value),
                isDebit: mainAmount.value < 0,
                rawRow: row
            });
        }

        console.log(`[SMART] Parsed ${transactions.length} transactions from data-only format`);
        return transactions;
    }

    detectBankColumns(headers) {
        console.log('[DETECT] Analyzing column headers...');

        const map = {
            transactionNumber: -1,
            date: -1,
            description: -1,
            memo: -1,
            debit: -1,
            credit: -1,
            amount: -1,
            balance: -1,
            checkNumber: -1,
            fees: -1
        };

        headers.forEach((header, idx) => {
            const h = String(header).toLowerCase().trim();

            // Date column
            if (h.includes('date') && !h.includes('update')) {
                map.date = idx;
            }
            // Transaction number
            else if (h.includes('transaction') && h.includes('number')) {
                map.transactionNumber = idx;
            }
            // Description
            else if (h === 'description' || h.includes('desc')) {
                map.description = idx;
            }
            // Memo
            else if (h === 'memo' || h.includes('note') || h.includes('comment')) {
                map.memo = idx;
            }
            // Debit
            else if (h.includes('debit') || h === 'dr' || h.includes('withdrawal')) {
                map.debit = idx;
            }
            // Credit
            else if (h.includes('credit') || h === 'cr' || h.includes('deposit')) {
                map.credit = idx;
            }
            // Amount
            else if (h === 'amount' || h === 'amt') {
                map.amount = idx;
            }
            // Balance
            else if (h.includes('balance') || h === 'bal') {
                map.balance = idx;
            }
            // Check number
            else if (h.includes('check') && h.includes('number')) {
                map.checkNumber = idx;
            }
            // Fees
            else if (h.includes('fee') || h.includes('charge')) {
                map.fees = idx;
            }
        });

        return map;
    }

    isValidDate(dateStr) {
        if (!dateStr || String(dateStr).trim() === '') return false;

        const str = String(dateStr).trim();

        // Check for common date patterns
        const patterns = [
            /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,  // MM/DD/YYYY or M/D/YY
            /^\d{4}-\d{2}-\d{2}$/,           // YYYY-MM-DD
            /^\d{1,2}-\d{1,2}-\d{2,4}$/      // MM-DD-YYYY
        ];

        return patterns.some(pattern => pattern.test(str));
    }

    parseGLFile(file) {
        const extension = file.name.split('.').pop().toLowerCase();

        if (extension === 'csv') {
            this.parseGLCSV(file);
        } else if (extension === 'xlsx' || extension === 'xls') {
            this.parseGLExcel(file);
        }
    }

    parseGLCSV(file) {
        console.log('[CSV] Starting GL CSV file processing...');
        Papa.parse(file, {
            header: false,  // Smart parsing
            skipEmptyLines: true,
            complete: (results) => {
                console.log('[CSV] GL CSV data received, rows:', results.data.length);
                console.log('[CSV] First 10 rows:', results.data.slice(0, 10));

                const parsed = this.smartParseGLData(results.data);
                this.glData = parsed;

                console.log(`[SUCCESS] Parsed ${this.glData.length} GL entries`);
                if (this.glData.length > 0) {
                    console.log('[SAMPLE] First GL entry:', this.glData[0]);
                    console.log('[SAMPLE] Last GL entry:', this.glData[this.glData.length - 1]);
                } else {
                    console.error('[ERROR] No GL entries were parsed!');
                }
                this.checkReadyToReconcile();
            },
            error: (error) => {
                console.error('[ERROR] Parsing GL CSV:', error);
                alert('Error parsing GL CSV: ' + error.message);
            }
        });
    }

    parseGLExcel(file) {
        console.log('[EXCEL] Starting Excel file processing...');
        const reader = new FileReader();

        reader.onerror = () => {
            console.error('[ERROR] Failed to read Excel file');
            alert('Failed to read Excel file. Please try again.');
        };

        reader.onload = (e) => {
            try {
                console.log('[EXCEL] File loaded, parsing workbook...');
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {
                    type: 'array',
                    cellDates: true,
                    cellNF: false,
                    cellText: false
                });

                console.log('[EXCEL] Workbook sheets found:', workbook.SheetNames);

                // Get the first sheet
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                console.log('[EXCEL] Processing sheet:', sheetName);

                // Convert sheet to array format
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                    header: 1,
                    defval: '',
                    raw: false,
                    dateNF: 'mm/dd/yyyy'
                });

                console.log('[EXCEL] Extracted', jsonData.length, 'rows from Excel');
                console.log('[EXCEL] First 10 rows:', jsonData.slice(0, 10));

                const parsed = this.smartParseGLData(jsonData);
                this.glData = parsed;

                console.log(`[SUCCESS] Parsed ${this.glData.length} GL entries`);
                if (this.glData.length > 0) {
                    console.log('[SAMPLE] First GL entry:', this.glData[0]);
                    console.log('[SAMPLE] Last GL entry:', this.glData[this.glData.length - 1]);
                } else {
                    console.error('[ERROR] No GL entries were parsed!');
                }
                this.checkReadyToReconcile();
            } catch (error) {
                console.error('[ERROR] Excel parsing failed:', error);
                console.error('[ERROR] Stack trace:', error.stack);
                alert('Error parsing GL Excel file:\n\n' + error.message + '\n\nPlease check the console (F12) for details, or try saving as CSV first.');
            }
        };

        console.log('[EXCEL] Reading file as ArrayBuffer...');
        reader.readAsArrayBuffer(file);
    }

    smartParseGLData(rows) {
        console.log('[SMART] Starting intelligent GL data parsing...');

        // Find header row
        let headerRowIdx = -1;
        let headers = [];

        for (let i = 0; i < Math.min(rows.length, 20); i++) {
            const row = rows[i];
            if (!row || row.length < 3) continue;

            // Skip rows that look like metadata (single cell or empty)
            const nonEmpty = row.filter(cell => cell && String(cell).trim() !== '').length;
            if (nonEmpty <= 1) continue;

            const rowStr = row.join('|').toLowerCase();

            // Look for account number column as key indicator
            if (rowStr.includes('account') && (rowStr.includes('number') || rowStr.includes('no') || rowStr.includes('description'))) {
                headerRowIdx = i;
                headers = row.map(h => String(h).trim());
                console.log(`[SMART] Found header row at line ${i}:`, headers);
                break;
            }

            // Check for "check" and "vendor" columns (Checks Issued / Check Register format)
            if (rowStr.includes('check') && (rowStr.includes('vendor') || rowStr.includes('amount') || rowStr.includes('payee'))) {
                headerRowIdx = i;
                headers = row.map(h => String(h).trim());
                console.log(`[SMART] Found check register header at line ${i}:`, headers);
                break;
            }

            // Check for debit/credit columns (generic GL format)
            if ((rowStr.includes('debit') || rowStr.includes('credit')) && (rowStr.includes('date') || rowStr.includes('description'))) {
                headerRowIdx = i;
                headers = row.map(h => String(h).trim());
                console.log(`[SMART] Found GL header at line ${i}:`, headers);
                break;
            }
        }

        if (headerRowIdx === -1) {
            console.error('[ERROR] Could not find header row in GL file');
            return [];
        }

        // Detect columns
        const columnMap = this.detectGLColumns(headers);
        console.log('[SMART] Column mapping:', columnMap);

        // Parse data rows
        const dataRows = rows.slice(headerRowIdx + 1);
        const entries = [];

        for (const row of dataRows) {
            // Skip empty rows
            if (row.length === 0 || row.every(cell => !cell || String(cell).trim() === '')) {
                continue;
            }

            // Check if this is a Check Register format (has check number and vendor name)
            if (columnMap.checkNumber >= 0 && columnMap.vendorName >= 0) {
                const checkNum = row[columnMap.checkNumber];
                const vendorName = row[columnMap.vendorName];
                const amount = this.parseAmount(row[columnMap.amount] || row[columnMap.netAmount] || '0');

                if (checkNum && amount !== 0) {
                    // Parse date (might be Excel serial number)
                    let date = null;
                    if (columnMap.checkDate >= 0 && row[columnMap.checkDate]) {
                        date = this.parseExcelDate(row[columnMap.checkDate]);
                    }

                    entries.push({
                        accountNumber: String(checkNum).trim(),
                        description: vendorName ? String(vendorName).trim() : '',
                        type: 'Check',
                        date: date,
                        beginBalance: 0,
                        endingBalance: 0,
                        debit: 0,
                        credit: amount,
                        amount: amount,
                        checkNumber: String(checkNum).trim(),
                        vendorCode: row[columnMap.vendor] ? String(row[columnMap.vendor]).trim() : '',
                        rawRow: row
                    });
                }
                continue;
            }

            // Standard GL format - must have account number
            const accountNumber = row[columnMap.accountNumber];
            if (!accountNumber || String(accountNumber).trim() === '') {
                continue;
            }

            // Skip summary/total rows (e.g., "Fund 01 Totals", "Report Totals")
            const acctStr = String(accountNumber).toLowerCase().trim();
            if (acctStr.includes('total') || acctStr.includes('report')) {
                continue;
            }

            // Get transaction type
            const transType = row[columnMap.transactionType] ?
                String(row[columnMap.transactionType]).trim() :
                (row[columnMap.type] ? String(row[columnMap.type]).trim() : '');

            // Skip Opening Balance rows and Expenditure rows (double-entry counterparts)
            const transTypeLower = transType.toLowerCase();
            if (transTypeLower === 'opening balance') {
                continue;
            }
            // Expenditure entries are internal journal entries, not actual bank transactions
            if (transTypeLower === 'expenditure') {
                continue;
            }

            // Get both debit and credit
            const debit = this.parseAmount(row[columnMap.debit] || '0');
            const credit = this.parseAmount(row[columnMap.credit] || '0');
            const amount = debit > 0 ? debit : credit;

            // Skip if no amount
            if (amount === 0) {
                continue;
            }

            // Parse date (might be Excel serial number)
            let date = null;
            if (columnMap.date >= 0 && row[columnMap.date]) {
                date = this.parseExcelDate(row[columnMap.date]);
            }

            // Get reference number (check number from description)
            // Handles: "Chk: 42131", "Chk:  42131", "Chk 42148", "Chk42148"
            let refNumber = '';
            let poNumber = '';
            const descStr = String(row[columnMap.glDescription] || row[columnMap.description] || '');
            const chkMatch = descStr.match(/Chk[:#]?\s*(\d+)/i);
            if (chkMatch) {
                refNumber = chkMatch[1];
            }

            // Extract PO number from description (e.g., "PO 25-00029", "PO: 25-00029")
            const poMatch = descStr.match(/PO[:#]?\s*([\d-]+)/i);
            if (poMatch) {
                poNumber = poMatch[1];
            }

            entries.push({
                accountNumber: String(accountNumber).trim(),
                description: row[columnMap.glDescription] ? String(row[columnMap.glDescription]).trim() :
                             (row[columnMap.description] ? String(row[columnMap.description]).trim() : ''),
                accountDescription: row[columnMap.accountDescription] ? String(row[columnMap.accountDescription]).trim() : '',
                type: transType,
                transactionType: transTypeLower,
                date: date,
                refNumber: row[columnMap.refNumber] || refNumber,
                checkNumber: refNumber,
                poNumber: poNumber,
                beginBalance: this.parseAmount(row[columnMap.beginBalance] || '0'),
                endingBalance: this.parseAmount(row[columnMap.endingBalance] || row[columnMap.balance] || '0'),
                debit: debit,
                credit: credit,
                amount: amount,
                isDebit: debit > 0,
                rawRow: row
            });
        }

        console.log(`[SMART] Extracted ${entries.length} valid GL entries`);
        return entries;
    }

    parseExcelDate(value) {
        if (!value) return null;

        // If it's already a date string, parse it
        if (typeof value === 'string') {
            if (this.isValidDate(value)) {
                return this.parseDate(value);
            }
            // Try parsing as number
            value = parseFloat(value);
        }

        // Excel serial date number (days since 1900-01-01, with Excel bug for 1900 leap year)
        if (typeof value === 'number' && value > 30000 && value < 60000) {
            // Excel epoch is January 1, 1900 (but Excel incorrectly treats 1900 as leap year)
            // For dates after Feb 28, 1900, we need to subtract 1
            const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
            const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
            return date;
        }

        return null;
    }

    detectGLColumns(headers) {
        console.log('[DETECT] Analyzing GL column headers...');

        const map = {
            accountNumber: -1,
            accountDescription: -1,
            description: -1,
            glDescription: -1,
            type: -1,
            transactionType: -1,
            date: -1,
            refLedger: -1,
            refNumber: -1,
            beginBalance: -1,
            endingBalance: -1,
            balance: -1,
            debit: -1,
            credit: -1,
            adjustment: -1,
            debitMinusCredit: -1,
            amount: -1,
            netAmount: -1,
            // Check register specific
            checkNumber: -1,
            checkDate: -1,
            vendor: -1,
            vendorName: -1,
            voidAmount: -1,
            reconciledDate: -1
        };

        headers.forEach((header, idx) => {
            const h = String(header).toLowerCase().trim();

            // Account number
            if ((h.includes('account') && h.includes('number')) || h === 'account no' || h === 'acct no' || h === 'account #') {
                map.accountNumber = idx;
            }
            // Account description or account name (separate from transaction description)
            else if (h === 'account description' || h === 'acct desc' || h === 'checking account' || h === 'account name') {
                map.accountDescription = idx;
            }
            // General description
            else if (h === 'description' || h === 'desc' || h === 'name') {
                if (map.description === -1) map.description = idx;
                else map.glDescription = idx;
            }
            // Type
            else if (h === 'type' && map.type === -1) {
                map.type = idx;
            }
            // Transaction type
            else if (h === 'transaction type' || h === 'trans type' || h === 'txn type') {
                map.transactionType = idx;
            }
            // Date
            else if (h === 'date' || h === 'trans date' || h === 'transaction date') {
                map.date = idx;
            }
            // Ref Ledger
            else if (h === 'ref ledger' || h === 'ledger') {
                map.refLedger = idx;
            }
            // Ref Number
            else if (h === 'ref number' || h === 'ref num' || h === 'reference' || h === 'ref #') {
                map.refNumber = idx;
            }
            // Begin balance
            else if (h.includes('begin') && h.includes('balance')) {
                map.beginBalance = idx;
            }
            // Ending balance
            else if ((h.includes('end') && h.includes('balance')) || h === 'ending balance') {
                map.endingBalance = idx;
            }
            // Balance
            else if (h === 'balance' || h === 'bal') {
                map.balance = idx;
            }
            // Debit
            else if (h === 'debit' || h === 'dr' || h === 'debits') {
                map.debit = idx;
            }
            // Credit
            else if (h === 'credit' || h === 'cr' || h === 'credits') {
                map.credit = idx;
            }
            // Adjustment
            else if (h === 'adjustment' || h === 'adj' || h === 'adjustments') {
                map.adjustment = idx;
            }
            // Debit minus Credit
            else if (h.includes('debit') && h.includes('credit')) {
                map.debitMinusCredit = idx;
            }
            // Amount
            else if (h === 'amount' || h === 'amt') {
                map.amount = idx;
            }
            // Net Amount
            else if (h === 'net amount' || h === 'net amt') {
                map.netAmount = idx;
            }
            // Check register columns
            else if (h === 'check #' || h === 'check number' || h === 'chk #' || h === 'check num') {
                map.checkNumber = idx;
            }
            else if (h === 'check date' || h === 'chk date') {
                map.checkDate = idx;
            }
            else if (h === 'vendor' || h === 'vendor code' || h === 'vend') {
                map.vendor = idx;
            }
            else if (h === 'vendor name' || h === 'payee' || h === 'pay to') {
                map.vendorName = idx;
            }
            else if (h === 'void amount' || h === 'void amt') {
                map.voidAmount = idx;
            }
            else if (h === 'reconciled date' || h === 'recon date') {
                map.reconciledDate = idx;
            }
        });

        return map;
    }

    parseDate(dateStr) {
        if (!dateStr) return null;

        // Handle MM/DD/YYYY format
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return new Date(parts[2], parts[0] - 1, parts[1]);
        }

        return new Date(dateStr);
    }

    parseAmount(value) {
        if (!value || value === '' || value === null || value === undefined) return 0;

        // Convert to string
        let str = String(value).trim();

        // Handle empty strings
        if (str === '') return 0;

        // Handle text representations like "zero", "none", etc.
        const lowerStr = str.toLowerCase();
        if (lowerStr === 'zero' || lowerStr === 'none' || lowerStr === 'n/a' || lowerStr === '-') {
            return 0;
        }

        // Remove common currency symbols and text
        str = str.replace(/[$€£¥₹]/g, '');
        str = str.replace(/\s+/g, ''); // Remove all whitespace

        // Handle parentheses notation for negative numbers (accounting format)
        // e.g., "(100.50)" means -100.50
        const hasParentheses = str.startsWith('(') && str.endsWith(')');
        if (hasParentheses) {
            str = str.slice(1, -1); // Remove parentheses
        }

        // Handle different decimal and thousand separators
        // European format: 1.234.567,89 or 1 234 567,89
        // US format: 1,234,567.89

        // Count dots and commas to determine format
        const dotCount = (str.match(/\./g) || []).length;
        const commaCount = (str.match(/,/g) || []).length;
        const dotPos = str.lastIndexOf('.');
        const commaPos = str.lastIndexOf(',');

        // Determine which is the decimal separator
        if (commaPos > dotPos) {
            // European format: comma is decimal separator
            // Remove dots (thousand separators) and replace comma with dot
            str = str.replace(/\./g, '').replace(',', '.');
        } else if (dotPos > commaPos) {
            // US format: dot is decimal separator
            // Remove commas (thousand separators)
            str = str.replace(/,/g, '');
        } else if (commaCount > 0 && dotCount === 0) {
            // Only commas, could be European decimal or US thousands
            // If 2 digits after comma, it's likely decimal
            const afterComma = str.split(',')[1];
            if (afterComma && afterComma.length === 2) {
                str = str.replace(',', '.');
            } else {
                str = str.replace(/,/g, '');
            }
        }

        // Remove any remaining non-numeric characters except . and -
        str = str.replace(/[^0-9.-]/g, '');

        // Handle multiple negative signs
        const negativeCount = (str.match(/-/g) || []).length;
        const isNegative = negativeCount % 2 === 1; // Odd number of negatives = negative
        str = str.replace(/-/g, '');

        // Parse the cleaned number
        let amount = parseFloat(str);

        // Return 0 if parsing failed
        if (isNaN(amount)) {
            console.warn(`[PARSE] Could not parse amount: "${value}" -> "${str}"`);
            return 0;
        }

        // Apply negative sign if needed
        if (isNegative || hasParentheses) {
            amount = -Math.abs(amount);
        }

        return amount;
    }

    checkReadyToReconcile() {
        const btn = document.getElementById('reconcileBtn');
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const ready = this.bankData.length > 0 && this.glData.length > 0;

        console.log(`[STATUS] Ready to reconcile: ${ready} (Bank: ${this.bankData.length}, GL: ${this.glData.length})`);

        btn.disabled = !ready;

        if (ready) {
            btn.style.cursor = 'pointer';
            statusIndicator.style.display = 'block';
            statusIndicator.style.background = '#d1fae5';
            statusIndicator.style.borderColor = '#059669';
            statusText.textContent = `READY - Bank: ${this.bankData.length} rows, GL: ${this.glData.length} rows`;
            console.log('[READY] Reconcile button is now ENABLED');
        } else {
            btn.style.cursor = 'not-allowed';
            statusIndicator.style.display = 'block';
            statusIndicator.style.background = '#fee2e2';
            statusIndicator.style.borderColor = '#dc2626';
            console.log('[WAITING] Reconcile button is DISABLED');

            // Show helpful message if user uploaded files but button is still disabled
            if (this.bankData.length === 0 && this.glData.length === 0) {
                statusText.textContent = 'Waiting for both files to be uploaded';
                console.log('[INFO] Waiting for both files to be uploaded...');
            } else if (this.bankData.length === 0) {
                statusText.textContent = `Waiting for bank statement file (GL: ${this.glData.length} rows loaded)`;
                console.log('[INFO] Still need bank statement file');
                this.showWarning('Bank statement file not loaded', 'Please upload a bank statement CSV file to continue.');
            } else if (this.glData.length === 0) {
                statusText.textContent = `Waiting for GL file (Bank: ${this.bankData.length} rows loaded)`;
                console.log('[INFO] Still need GL file');
                this.showWarning('General Ledger file not loaded', 'Please upload a general ledger Excel or CSV file to continue.');
            }
        }
    }

    showWarning(title, message) {
        // Don't auto-show warnings - user can click "Check System Status" button instead
        console.warn(`[WARNING] ${title}: ${message}`);
    }

    startReconciliation() {
        console.log('[START] Starting reconciliation...');

        // Show progress
        document.getElementById('progressSection').style.display = 'block';
        document.getElementById('resultsSection').style.display = 'none';

        // Simulate progress for better UX
        this.updateProgress(30, 'Analyzing bank transactions...');

        setTimeout(() => {
            this.updateProgress(60, 'Matching with GL entries...');

            setTimeout(() => {
                this.performReconciliation();
                this.updateProgress(100, 'Complete!');

                setTimeout(() => {
                    this.displayResults();
                }, 500);
            }, 500);
        }, 500);
    }

    performReconciliation() {
        this.matchedTransactions = [];
        this.unmatchedBank = [];
        this.unmatchedGL = [];

        const matchedBankIndices = new Set();
        const matchedGLIndices = new Set();

        console.log('[MATCH] Starting matching algorithm...');

        // Try to match each bank transaction with GL entries
        this.bankData.forEach((bankTx, bankIdx) => {
            let bestMatch = null;
            let bestMatchScore = 0;
            let bestGLIdx = -1;

            this.glData.forEach((glEntry, glIdx) => {
                if (matchedGLIndices.has(glIdx)) return;

                const score = this.calculateMatchScore(bankTx, glEntry);

                if (score > bestMatchScore && score > 0.5) { // Threshold for matching
                    bestMatchScore = score;
                    bestMatch = glEntry;
                    bestGLIdx = glIdx;
                }
            });

            if (bestMatch) {
                matchedBankIndices.add(bankIdx);
                matchedGLIndices.add(bestGLIdx);

                this.matchedTransactions.push({
                    bankTransaction: bankTx,
                    glEntry: bestMatch,
                    matchScore: bestMatchScore,
                    matchType: this.getMatchType(bankTx, bestMatch),
                    isManual: false
                });

                console.log(`[MATCH] Found: Bank check ${bankTx.checkNumber} ($${bankTx.amount}) -> GL ${bestMatch.accountNumber} ($${bestMatch.amount}) [Score: ${(bestMatchScore * 100).toFixed(0)}%]`);
            }
        });

        // Collect unmatched items
        this.bankData.forEach((tx, idx) => {
            if (!matchedBankIndices.has(idx)) {
                this.unmatchedBank.push(tx);
            }
        });

        this.glData.forEach((entry, idx) => {
            if (!matchedGLIndices.has(idx)) {
                this.unmatchedGL.push(entry);
            }
        });

        console.log('[COMPLETE] Reconciliation finished:', {
            matched: this.matchedTransactions.length,
            unmatchedBank: this.unmatchedBank.length,
            unmatchedGL: this.unmatchedGL.length
        });
    }

    calculateMatchScore(bankTx, glEntry) {
        let score = 0;
        const weights = {
            amount: 0.5,
            checkNumber: 0.3,
            date: 0.2
        };

        // Amount matching (most important)
        const bankAmount = Math.abs(bankTx.amount);
        const glAmount = Math.abs(glEntry.amount);
        const amountDiff = Math.abs(bankAmount - glAmount);

        if (amountDiff <= this.settings.amountTolerance) {
            score += weights.amount;
        } else if (amountDiff < bankAmount * 0.01) { // Within 1%
            score += weights.amount * 0.8;
        }

        // Check number matching
        if (bankTx.checkNumber && glEntry.accountNumber) {
            const checkNum = bankTx.checkNumber.replace(/\D/g, '');
            const acctNum = glEntry.accountNumber.replace(/\D/g, '');

            if (checkNum && acctNum.includes(checkNum)) {
                score += weights.checkNumber;
            }
        }

        // Date proximity (if dates are available)
        if (bankTx.date && this.settings.dateRange > 0) {
            // For GL, we'll use a general date match since GL might not have transaction dates
            // This is a placeholder - can be enhanced if GL has date fields
            score += weights.date * 0.5;
        }

        return score;
    }

    getMatchType(bankTx, glEntry) {
        const types = [];

        if (Math.abs(Math.abs(bankTx.amount) - Math.abs(glEntry.amount)) <= this.settings.amountTolerance) {
            types.push('Exact Amount');
        }

        if (bankTx.checkNumber && glEntry.accountNumber &&
            glEntry.accountNumber.includes(bankTx.checkNumber.replace(/\D/g, ''))) {
            types.push('Check #');
        }

        return types.length > 0 ? types.join(' + ') : 'Amount Match';
    }

    // ========================================
    // Smart Match (Experimental) - Algorithm
    // ========================================

    getSmartMatchLearning() {
        try {
            const raw = localStorage.getItem('bankRecSmartMatchLearning');
            return raw ? JSON.parse(raw) : this.createEmptyLearningData();
        } catch (e) {
            console.warn('[SMART] Failed to load learning data:', e);
            return this.createEmptyLearningData();
        }
    }

    saveSmartMatchLearning(data) {
        data.lastUpdated = new Date().toISOString();
        if (data.feedbackLog && data.feedbackLog.length > 200) {
            data.feedbackLog = data.feedbackLog.slice(-200);
        }
        localStorage.setItem('bankRecSmartMatchLearning', JSON.stringify(data));
    }

    createEmptyLearningData() {
        return {
            version: 1,
            lastUpdated: new Date().toISOString(),
            totalAccepted: 0,
            totalDenied: 0,
            patterns: { descToAccount: {}, amountToAccount: {}, descToDesc: {} },
            feedbackLog: []
        };
    }

    normalizeForLearning(str) {
        return (str || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim().replace(/\s+/g, ' ');
    }

    amountBucket(amount) {
        const abs = Math.abs(amount);
        if (abs < 100) return '0-100';
        if (abs < 500) return '100-500';
        if (abs < 1000) return '500-1000';
        if (abs < 2000) return '1000-2000';
        if (abs < 5000) return '2000-5000';
        if (abs < 10000) return '5000-10000';
        if (abs < 50000) return '10000-50000';
        return '50000+';
    }

    calculateAmountScore(sourceAmount, targetAmount) {
        const diff = Math.abs(sourceAmount - targetAmount);
        const pctDiff = sourceAmount > 0 ? diff / sourceAmount : (diff === 0 ? 0 : 1);
        if (diff <= 0.01) return 1.0;
        if (pctDiff <= 0.01) return 0.85;
        if (pctDiff <= 0.05) return 0.6;
        if (pctDiff <= 0.10) return 0.3;
        return 0.0;
    }

    calculateTextScore(sourceDesc, targetDesc) {
        if (!sourceDesc || !targetDesc) return 0;
        const normalize = (str) => str.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 2);
        const sourceTokens = new Set(normalize(sourceDesc));
        const targetTokens = new Set(normalize(targetDesc));
        if (sourceTokens.size === 0 || targetTokens.size === 0) return 0;
        let shared = 0;
        for (const token of sourceTokens) {
            if (targetTokens.has(token)) shared++;
        }
        const union = new Set([...sourceTokens, ...targetTokens]).size;
        return union > 0 ? shared / union : 0;
    }

    calculateDateScore(sourceDate, targetDate, maxDays) {
        if (!sourceDate || !targetDate) return 0.25;
        const date1 = sourceDate instanceof Date ? sourceDate : new Date(sourceDate);
        const date2 = targetDate instanceof Date ? targetDate : new Date(targetDate);
        if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return 0.25;
        const daysDiff = Math.abs((date1 - date2) / (1000 * 60 * 60 * 24));
        if (daysDiff < 1) return 1.0;
        const halfLife = Math.max(maxDays, 3) / 2;
        return Math.max(Math.exp(-daysDiff / halfLife), 0);
    }

    calculateRefScore(bankTx, glEntry) {
        const bankCheck = (bankTx.checkNumber || '').replace(/\D/g, '');
        const glCheck = (glEntry.checkNumber || glEntry.refNumber || '').replace(/\D/g, '');
        const glAccount = (glEntry.accountNumber || '').replace(/\D/g, '');

        if (bankCheck && bankCheck.length >= 3) {
            if (glCheck && glCheck === bankCheck) return 1.0;
            if (glAccount && glAccount.includes(bankCheck)) return 0.9;
            if (glCheck && glCheck.slice(-4) === bankCheck.slice(-4)) return 0.6;
        }

        const bankDesc = (bankTx.description || '') + ' ' + (bankTx.memo || '');
        const glDesc = (glEntry.description || '');
        const bankPO = bankDesc.match(/PO[:#]?\s*([\d-]+)/i);
        const glPO = glDesc.match(/PO[:#]?\s*([\d-]+)/i);
        if (bankPO && glPO && bankPO[1] === glPO[1]) return 0.8;

        return 0;
    }

    calculateLearningBias(bankTx, glEntry) {
        const learningData = this.getSmartMatchLearning();
        if (!learningData || !learningData.patterns) return 0;

        let bias = 0;
        const patterns = learningData.patterns;
        const descKey = this.normalizeForLearning(bankTx.description);
        const acctKey = (glEntry.accountNumber || '').trim();
        const glDescKey = this.normalizeForLearning(glEntry.description);
        const amtBucket = this.amountBucket(bankTx.amount);

        if (patterns.descToAccount && patterns.descToAccount[descKey]) {
            const rec = patterns.descToAccount[descKey][acctKey];
            if (rec) {
                const net = (rec.accepted || 0) - (rec.denied || 0);
                bias += Math.tanh(net * 0.3) * 0.06;
            }
        }

        if (patterns.amountToAccount && patterns.amountToAccount[amtBucket]) {
            const rec = patterns.amountToAccount[amtBucket][acctKey];
            if (rec) {
                const net = (rec.accepted || 0) - (rec.denied || 0);
                bias += Math.tanh(net * 0.2) * 0.02;
            }
        }

        if (patterns.descToDesc && patterns.descToDesc[descKey]) {
            const rec = patterns.descToDesc[descKey][glDescKey];
            if (rec) {
                const net = (rec.accepted || 0) - (rec.denied || 0);
                bias += Math.tanh(net * 0.3) * 0.02;
            }
        }

        return Math.max(-0.10, Math.min(0.10, bias));
    }

    findSubsetMatches(sourceAmount, targets, maxItems = 3) {
        const results = [];
        const tolerance = sourceAmount * 0.01;
        const getAmt = (item) => Math.abs(item.amount || item.amountCredit || item.amountDebit || item.debit || item.credit || 0);

        for (let i = 0; i < targets.length; i++) {
            for (let j = i + 1; j < targets.length; j++) {
                const sum = getAmt(targets[i]) + getAmt(targets[j]);
                if (Math.abs(sum - sourceAmount) <= tolerance) {
                    results.push({ indices: [i, j], items: [targets[i], targets[j]], sum, diff: Math.abs(sum - sourceAmount) });
                }
            }
        }

        const cap = Math.min(targets.length, 50);
        if (maxItems >= 3) {
            for (let i = 0; i < cap; i++) {
                for (let j = i + 1; j < cap; j++) {
                    for (let k = j + 1; k < cap; k++) {
                        const sum = getAmt(targets[i]) + getAmt(targets[j]) + getAmt(targets[k]);
                        if (Math.abs(sum - sourceAmount) <= tolerance) {
                            results.push({ indices: [i, j, k], items: [targets[i], targets[j], targets[k]], sum, diff: Math.abs(sum - sourceAmount) });
                        }
                    }
                }
            }
        }
        return results;
    }

    buildReasons(bankTx, glEntry, scores) {
        const reasons = [];
        const diff = Math.abs(Math.abs(bankTx.amount || 0) - Math.abs(glEntry.amount || glEntry.debit || 0));

        if (scores.amount >= 1.0) {
            reasons.push({ icon: '$', text: 'Exact amount match', score: 'Perfect' });
        } else if (scores.amount >= 0.85) {
            reasons.push({ icon: '$', text: `Amount within 1% ($${diff.toFixed(2)} diff)`, score: 'Strong' });
        } else if (scores.amount >= 0.3) {
            reasons.push({ icon: '$', text: `Amount within 10% ($${diff.toFixed(2)} diff)`, score: 'Weak' });
        }

        if (scores.text >= 0.5) {
            reasons.push({ icon: 'T', text: 'Description keywords match', score: 'Strong' });
        } else if (scores.text > 0.1) {
            reasons.push({ icon: 'T', text: 'Partial description overlap', score: 'Weak' });
        }

        if (scores.date >= 0.9) {
            reasons.push({ icon: 'D', text: 'Same day or within 1 day', score: 'Strong' });
        } else if (scores.date >= 0.5) {
            reasons.push({ icon: 'D', text: 'Close date proximity', score: 'Moderate' });
        }

        if (scores.ref >= 0.9) {
            reasons.push({ icon: '#', text: 'Check/reference number match', score: 'Perfect' });
        } else if (scores.ref >= 0.6) {
            reasons.push({ icon: '#', text: 'Partial reference match', score: 'Moderate' });
        }

        if (scores.learningBias > 0.02) {
            reasons.push({ icon: 'L', text: 'Boosted by past acceptances', score: 'Learned' });
        } else if (scores.learningBias < -0.02) {
            reasons.push({ icon: 'L', text: 'Penalized by past denials', score: 'Learned' });
        }

        return reasons;
    }

    // ========================================
    // Smart Match - Orchestration & UI
    // ========================================

    generateSmartMatchSuggestions() {
        const loading = document.getElementById('smartMatchLoading');
        const container = document.getElementById('smartMatchSuggestions');
        const emptyState = document.getElementById('smartMatchEmpty');

        loading.style.display = 'flex';
        container.innerHTML = '';
        emptyState.style.display = 'none';

        setTimeout(() => {
            const source = this.manualMatchSource;
            const sourceItem = source.type === 'bank' ? this.unmatchedBank[source.idx] : this.unmatchedGL[source.idx];
            const targetItems = source.type === 'bank' ? this.unmatchedGL : this.unmatchedBank;
            const sourceAmount = Math.abs(sourceItem.amount || sourceItem.amountCredit || sourceItem.amountDebit || 0);

            const suggestions = [];

            targetItems.forEach((target, idx) => {
                const targetAmount = Math.abs(target.amount || target.amountCredit || target.amountDebit || target.debit || target.credit || 0);
                const bankTx = source.type === 'bank' ? sourceItem : target;
                const glEntry = source.type === 'bank' ? target : sourceItem;

                const scores = {
                    amount: this.calculateAmountScore(sourceAmount, targetAmount),
                    text: this.calculateTextScore(
                        (sourceItem.description || '') + ' ' + (sourceItem.memo || ''),
                        (target.description || '') + ' ' + (target.accountDescription || '')
                    ),
                    date: this.calculateDateScore(sourceItem.date, target.date, this.settings.dateRange),
                    ref: this.calculateRefScore(bankTx, glEntry),
                    learningBias: this.calculateLearningBias(bankTx, glEntry)
                };

                const finalScore = (0.40 * scores.amount) + (0.20 * scores.text) + (0.15 * scores.date) + (0.15 * scores.ref) + scores.learningBias;

                if (finalScore >= 0.40) {
                    suggestions.push({
                        score: finalScore,
                        scores,
                        bankTx,
                        glEntry,
                        targetIndex: idx,
                        isSplit: false,
                        reasons: this.buildReasons(bankTx, glEntry, scores)
                    });
                }
            });

            // Subset-sum splits if no high-confidence single match
            if (!suggestions.some(s => s.score >= 0.85)) {
                const subsets = this.findSubsetMatches(sourceAmount, targetItems);
                subsets.forEach(subset => {
                    suggestions.push({
                        score: Math.min(0.40 * 0.95 + 0.10, 0.80),
                        scores: { amount: 0.95, text: 0, date: 0, ref: 0, learningBias: 0 },
                        bankTx: source.type === 'bank' ? sourceItem : subset.items[0],
                        glEntry: source.type === 'bank' ? subset.items[0] : sourceItem,
                        targetIndices: subset.indices,
                        targetItems: subset.items,
                        isSplit: true,
                        reasons: [{ icon: '$', text: `${subset.items.length} items sum to ${this.formatCurrency(subset.sum)} (target: ${this.formatCurrency(sourceAmount)})`, score: 'Split' }]
                    });
                });
            }

            suggestions.sort((a, b) => b.score - a.score);
            this.smartMatchSuggestions = suggestions.slice(0, 5);

            loading.style.display = 'none';
            this.renderSmartMatchSuggestions();
        }, 100);
    }

    renderSmartMatchSuggestions() {
        const container = document.getElementById('smartMatchSuggestions');
        const emptyState = document.getElementById('smartMatchEmpty');
        const stats = document.getElementById('smartMatchStats');

        if (!this.smartMatchSuggestions || this.smartMatchSuggestions.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            stats.innerHTML = '';
            return;
        }

        emptyState.style.display = 'none';
        const learningData = this.getSmartMatchLearning();
        stats.innerHTML = `<span class="smart-stats-label">Learning data: ${learningData.totalAccepted} accepted, ${learningData.totalDenied} denied</span>`;

        const sourceType = this.manualMatchSource.type;
        container.innerHTML = this.smartMatchSuggestions.map((suggestion, idx) => {
            const confidenceClass = suggestion.score >= 0.85 ? 'confidence-high' :
                                   suggestion.score >= 0.60 ? 'confidence-medium' : 'confidence-low';
            const pct = Math.round(suggestion.score * 100);

            let targetHtml;
            if (suggestion.isSplit) {
                const rows = suggestion.targetItems.map(item => {
                    const amt = Math.abs(item.amount || item.debit || item.credit || 0);
                    return `<tr>
                        <td>${this.formatDate(item.date)}</td>
                        <td title="${this.escapeHtml(item.description || '')}">${this.escapeHtml(this.truncate(item.description || '', 30))}</td>
                        <td>${this.escapeHtml(item.accountNumber || '')}</td>
                        <td class="target-amount">${this.formatCurrency(amt)}</td>
                    </tr>`;
                }).join('');
                const splitTotal = suggestion.targetItems.reduce((s, i) => s + Math.abs(i.amount || i.debit || i.credit || 0), 0);
                targetHtml = `
                    <div class="smart-match-split-label">Split match: ${suggestion.targetItems.length} items totalling ${this.formatCurrency(splitTotal)}</div>
                    <table class="smart-target-table">
                        <thead><tr><th>Date</th><th>Description</th><th>Account</th><th>Amount</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>`;
            } else {
                const item = sourceType === 'bank' ? suggestion.glEntry : suggestion.bankTx;
                const amt = Math.abs(item.amount || item.debit || item.credit || item.amountCredit || 0);
                targetHtml = `
                    <table class="smart-target-table">
                        <tbody>
                            <tr><td class="smart-field-label">Date</td><td>${this.formatDate(item.date)}</td></tr>
                            <tr><td class="smart-field-label">Description</td><td title="${this.escapeHtml(item.description || '')}">${this.escapeHtml(this.truncate(item.description || '', 50))}</td></tr>
                            ${item.accountNumber ? `<tr><td class="smart-field-label">Account #</td><td>${this.escapeHtml(item.accountNumber)}</td></tr>` : ''}
                            <tr><td class="smart-field-label">Amount</td><td class="target-amount">${this.formatCurrency(amt)}</td></tr>
                        </tbody>
                    </table>`;
            }

            const reasonsHtml = (suggestion.reasons || []).map(r => `
                <span class="reason-chip">
                    <span class="reason-icon">${r.icon}</span>
                    ${this.escapeHtml(r.text)}
                </span>
            `).join('');

            return `
                <div class="smart-match-card ${confidenceClass}" data-suggestion-idx="${idx}">
                    <div class="smart-match-card-top">
                        <div class="confidence-meter ${confidenceClass}">
                            <div class="confidence-fill" style="width: ${pct}%"></div>
                        </div>
                        <span class="confidence-pct ${confidenceClass}">${pct}%</span>
                    </div>
                    <div class="smart-match-card-body">
                        ${targetHtml}
                        <div class="smart-match-reasons">${reasonsHtml}</div>
                    </div>
                    <div class="smart-match-card-actions">
                        <button class="smart-match-deny-btn" data-smart-deny="${idx}">Deny</button>
                        <button class="smart-match-accept-btn" data-smart-accept="${idx}">Accept Match</button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach event listeners
        container.querySelectorAll('[data-smart-accept]').forEach(btn => {
            btn.addEventListener('click', () => this.acceptSmartMatch(parseInt(btn.dataset.smartAccept)));
        });
        container.querySelectorAll('[data-smart-deny]').forEach(btn => {
            btn.addEventListener('click', () => this.denySmartMatch(parseInt(btn.dataset.smartDeny)));
        });
    }

    acceptSmartMatch(suggestionIndex) {
        const suggestion = this.smartMatchSuggestions[suggestionIndex];
        if (!suggestion) return;

        const learningData = this.getSmartMatchLearning();
        const descKey = this.normalizeForLearning(suggestion.bankTx.description);
        const acctKey = (suggestion.glEntry.accountNumber || '').trim();
        const glDescKey = this.normalizeForLearning(suggestion.glEntry.description);
        const amtBucket = this.amountBucket(suggestion.bankTx.amount);

        // Update descToAccount
        if (!learningData.patterns.descToAccount[descKey]) learningData.patterns.descToAccount[descKey] = {};
        if (!learningData.patterns.descToAccount[descKey][acctKey]) learningData.patterns.descToAccount[descKey][acctKey] = { accepted: 0, denied: 0 };
        learningData.patterns.descToAccount[descKey][acctKey].accepted++;

        // Update amountToAccount
        if (!learningData.patterns.amountToAccount[amtBucket]) learningData.patterns.amountToAccount[amtBucket] = {};
        if (!learningData.patterns.amountToAccount[amtBucket][acctKey]) learningData.patterns.amountToAccount[amtBucket][acctKey] = { accepted: 0, denied: 0 };
        learningData.patterns.amountToAccount[amtBucket][acctKey].accepted++;

        // Update descToDesc
        if (!learningData.patterns.descToDesc[descKey]) learningData.patterns.descToDesc[descKey] = {};
        if (!learningData.patterns.descToDesc[descKey][glDescKey]) learningData.patterns.descToDesc[descKey][glDescKey] = { accepted: 0, denied: 0 };
        learningData.patterns.descToDesc[descKey][glDescKey].accepted++;

        learningData.totalAccepted++;
        learningData.feedbackLog.push({
            timestamp: new Date().toISOString(),
            action: 'accepted',
            bankDesc: suggestion.bankTx.description,
            bankAmount: suggestion.bankTx.amount,
            glAccount: acctKey,
            glDesc: suggestion.glEntry.description,
            score: suggestion.score
        });

        this.saveSmartMatchLearning(learningData);
        this.executeSmartMatchAccept(suggestion);
    }

    executeSmartMatchAccept(suggestion) {
        const source = this.manualMatchSource;

        if (suggestion.isSplit) {
            const sortedIndices = [...suggestion.targetIndices].sort((a, b) => b - a);
            const targetItems = suggestion.targetItems;

            if (source.type === 'bank') {
                const bankItem = this.unmatchedBank[source.idx];
                sortedIndices.forEach(idx => this.unmatchedGL.splice(idx, 1));
                this.unmatchedBank.splice(source.idx, 1);

                this.matchedTransactions.push({
                    bankTransaction: bankItem,
                    glEntry: {
                        accountNumber: targetItems.map(g => g.accountNumber).join(', '),
                        description: `[${targetItems.length} items combined] ` + targetItems.map(g => g.description).filter(Boolean).join('; '),
                        type: 'Combined',
                        date: targetItems[0].date,
                        amount: targetItems.reduce((s, i) => s + Math.abs(i.amount || i.debit || i.credit || 0), 0),
                        combinedItems: targetItems
                    },
                    matchScore: suggestion.score,
                    matchType: `Smart Match (${targetItems.length}-way split)`,
                    isManual: true,
                    isSmartMatch: true,
                    isMultiMatch: true,
                    matchedCount: targetItems.length
                });
            } else {
                const glItem = this.unmatchedGL[source.idx];
                sortedIndices.forEach(idx => this.unmatchedBank.splice(idx, 1));
                this.unmatchedGL.splice(source.idx, 1);

                this.matchedTransactions.push({
                    bankTransaction: {
                        description: `[${targetItems.length} items combined] ` + targetItems.map(b => b.description).filter(Boolean).join('; '),
                        date: targetItems[0].date,
                        amount: targetItems.reduce((s, i) => s + Math.abs(i.amount || i.amountCredit || 0), 0),
                        combinedItems: targetItems
                    },
                    glEntry: glItem,
                    matchScore: suggestion.score,
                    matchType: `Smart Match (${targetItems.length}-way split)`,
                    isManual: true,
                    isSmartMatch: true,
                    isMultiMatch: true,
                    matchedCount: targetItems.length
                });
            }
        } else {
            let bankItem, glItem;
            const targetIdx = suggestion.targetIndex;

            if (source.type === 'bank') {
                bankItem = this.unmatchedBank[source.idx];
                glItem = this.unmatchedGL[targetIdx];
                this.unmatchedGL.splice(targetIdx, 1);
                this.unmatchedBank.splice(source.idx, 1);
            } else {
                glItem = this.unmatchedGL[source.idx];
                bankItem = this.unmatchedBank[targetIdx];
                this.unmatchedBank.splice(targetIdx, 1);
                this.unmatchedGL.splice(source.idx, 1);
            }

            this.matchedTransactions.push({
                bankTransaction: bankItem,
                glEntry: glItem,
                matchScore: suggestion.score,
                matchType: 'Smart Match',
                isManual: true,
                isSmartMatch: true
            });
        }

        document.getElementById('manualMatchModal').style.display = 'none';
        // Reset to existing tab for next open
        if (typeof switchMatchTab === 'function') switchMatchTab('existing');
        this.smartMatchSuggestions = [];
        this.displayResults();
    }

    denySmartMatch(suggestionIndex) {
        const suggestion = this.smartMatchSuggestions[suggestionIndex];
        if (!suggestion) return;

        const learningData = this.getSmartMatchLearning();
        const descKey = this.normalizeForLearning(suggestion.bankTx.description);
        const acctKey = (suggestion.glEntry.accountNumber || '').trim();
        const glDescKey = this.normalizeForLearning(suggestion.glEntry.description);
        const amtBucket = this.amountBucket(suggestion.bankTx.amount);

        if (!learningData.patterns.descToAccount[descKey]) learningData.patterns.descToAccount[descKey] = {};
        if (!learningData.patterns.descToAccount[descKey][acctKey]) learningData.patterns.descToAccount[descKey][acctKey] = { accepted: 0, denied: 0 };
        learningData.patterns.descToAccount[descKey][acctKey].denied++;

        if (!learningData.patterns.amountToAccount[amtBucket]) learningData.patterns.amountToAccount[amtBucket] = {};
        if (!learningData.patterns.amountToAccount[amtBucket][acctKey]) learningData.patterns.amountToAccount[amtBucket][acctKey] = { accepted: 0, denied: 0 };
        learningData.patterns.amountToAccount[amtBucket][acctKey].denied++;

        if (!learningData.patterns.descToDesc[descKey]) learningData.patterns.descToDesc[descKey] = {};
        if (!learningData.patterns.descToDesc[descKey][glDescKey]) learningData.patterns.descToDesc[descKey][glDescKey] = { accepted: 0, denied: 0 };
        learningData.patterns.descToDesc[descKey][glDescKey].denied++;

        learningData.totalDenied++;
        learningData.feedbackLog.push({
            timestamp: new Date().toISOString(),
            action: 'denied',
            bankDesc: suggestion.bankTx.description,
            bankAmount: suggestion.bankTx.amount,
            glAccount: acctKey,
            glDesc: suggestion.glEntry.description,
            score: suggestion.score
        });

        this.saveSmartMatchLearning(learningData);

        this.smartMatchSuggestions.splice(suggestionIndex, 1);
        this.renderSmartMatchSuggestions();
    }

    updateProgress(percent, text) {
        document.getElementById('progressFill').style.width = percent + '%';
        document.getElementById('progressText').textContent = text;
    }

    displayResults() {
        document.getElementById('progressSection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'block';

        // Update summary cards
        const totalMatched = this.matchedTransactions.reduce((sum, match) =>
            sum + Math.abs(match.bankTransaction.amount), 0);

        // Calculate unmatched totals
        const unmatchedBankTotal = this.unmatchedBank.reduce((sum, tx) =>
            sum + Math.abs(tx.amount || tx.amountCredit || tx.amountDebit || 0), 0);
        const unmatchedGLTotal = this.unmatchedGL.reduce((sum, entry) =>
            sum + Math.abs(entry.amount || entry.debit || entry.credit || 0), 0);
        const totalUnmatched = unmatchedBankTotal + unmatchedGLTotal;

        document.getElementById('matchedCount').textContent = this.matchedTransactions.length;
        document.getElementById('unmatchedBankCount').textContent = this.unmatchedBank.length;
        document.getElementById('unmatchedGLCount').textContent = this.unmatchedGL.length;
        document.getElementById('totalAmount').textContent = this.formatCurrency(totalMatched);
        document.getElementById('unmatchedTotal').textContent = this.formatCurrency(totalUnmatched);

        // Display the current tab
        this.switchTab(this.currentTab);
    }

    switchTab(tab) {
        // Reset page to 1 when switching tabs
        if (this.currentTab !== tab) {
            this.currentPage = 1;
        }
        this.currentTab = tab;

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Update table based on tab
        let title, data, headers;

        switch(tab) {
            case 'matched':
                title = 'Matched Transactions';
                data = this.matchedTransactions;
                this.renderMatchedTable(data);
                break;

            case 'unmatched-bank':
                title = 'Unmatched Bank Transactions';
                data = this.unmatchedBank;
                this.renderUnmatchedBankTable(data);
                break;

            case 'unmatched-gl':
                title = 'Unmatched GL Entries';
                data = this.unmatchedGL;
                this.renderUnmatchedGLTable(data);
                break;
        }

        document.getElementById('resultsTitle').textContent = title;
    }

    /**
     * Get paginated slice of data for current page
     */
    paginateData(data) {
        if (this.pageSize === Infinity) return data;
        const start = (this.currentPage - 1) * this.pageSize;
        return data.slice(start, start + this.pageSize);
    }

    /**
     * Render pagination controls
     */
    renderPagination(totalItems) {
        const container = document.getElementById('paginationControls');
        const info = document.getElementById('paginationInfo');
        const nav = document.getElementById('paginationNav');
        if (!container) return;

        // Only show pagination if there are items
        if (totalItems === 0) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'flex';

        const totalPages = this.pageSize === Infinity ? 1 : Math.ceil(totalItems / this.pageSize);

        // Clamp current page
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const start = this.pageSize === Infinity ? 1 : (this.currentPage - 1) * this.pageSize + 1;
        const end = this.pageSize === Infinity ? totalItems : Math.min(this.currentPage * this.pageSize, totalItems);

        info.textContent = `${start}-${end} of ${totalItems}`;

        // Build page nav buttons
        if (totalPages <= 1) {
            nav.innerHTML = '';
            return;
        }

        let navHtml = '';
        navHtml += `<button class="page-nav-btn" data-page="prev" ${this.currentPage === 1 ? 'disabled' : ''}>&laquo;</button>`;

        // Show up to 5 page buttons centered around current
        let startPage = Math.max(1, this.currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

        for (let i = startPage; i <= endPage; i++) {
            navHtml += `<button class="page-nav-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        navHtml += `<button class="page-nav-btn" data-page="next" ${this.currentPage === totalPages ? 'disabled' : ''}>&raquo;</button>`;
        nav.innerHTML = navHtml;

        // Attach listeners
        nav.querySelectorAll('.page-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                if (page === 'prev') this.currentPage--;
                else if (page === 'next') this.currentPage++;
                else this.currentPage = parseInt(page);
                this.switchTab(this.currentTab);
            });
        });
    }

    renderMatchedTable(data, headers) {
        const thead = document.getElementById('resultsTableHead');
        const tbody = document.getElementById('resultsTableBody');

        const newHeaders = [
            { label: 'Bank Date', key: 'bankDate', sortable: true },
            { label: 'Bank Description', key: 'bankDesc', sortable: true },
            { label: 'Bank Credit', key: 'bankAmount', sortable: true },
            { label: 'GL Date', key: 'glDate', sortable: true },
            { label: 'GL Description', key: 'glDesc', sortable: true },
            { label: 'GL Account #', key: 'glAccount', sortable: true },
            { label: 'GL Debit', key: 'glAmount', sortable: true },
            { label: 'Match Type', key: 'matchType', sortable: true },
            { label: 'Actions', key: 'actions', sortable: false }
        ];

        thead.innerHTML = '<tr>' + newHeaders.map(h =>
            `<th class="${h.sortable ? 'sortable' : ''}" data-sort="${h.key}">${h.label}</th>`
        ).join('') + '</tr>';

        // Calculate totals from ALL data
        const totalBankAmount = data.reduce((sum, m) => sum + Math.abs(m.bankTransaction.amount || 0), 0);
        const totalGLAmount = data.reduce((sum, m) => sum + Math.abs(m.glEntry.amount || m.glEntry.debit || 0), 0);

        // Paginate
        const pageData = this.paginateData(data);
        const pageOffset = this.pageSize === Infinity ? 0 : (this.currentPage - 1) * this.pageSize;

        tbody.innerHTML = pageData.map((match, i) => {
            const idx = pageOffset + i;
            const bank = match.bankTransaction;
            const gl = match.glEntry;
            const bankAmount = bank.amount || bank.amountCredit || 0;
            const glAmount = gl.amount || gl.debit || 0;
            const manualBadge = match.isManual ? '<span class="manual-badge">Manual</span>' : '';
            const multiBadge = match.isMultiMatch ? `<span class="manual-badge" style="background:#fef3c7;color:#b45309;">×${match.matchedCount}</span>` : '';
            const difference = Math.abs(bankAmount - glAmount);
            const diffDisplay = difference > 0.01 ? `<span class="diff-badge">Diff: ${this.formatCurrency(difference)}</span>` : '';

            return `
                <tr>
                    <td>${this.formatDate(bank.date)}</td>
                    <td title="${this.escapeHtml(bank.description)}">${this.escapeHtml(this.truncate(bank.description, 40))}</td>
                    <td class="amount-credit">${this.formatCurrency(bankAmount)}</td>
                    <td>${this.formatDate(gl.date)}</td>
                    <td title="${this.escapeHtml(gl.description)}">${this.escapeHtml(this.truncate(gl.description, 40))}</td>
                    <td>${this.escapeHtml(gl.accountNumber)}</td>
                    <td class="amount-debit">${this.formatCurrency(glAmount)}</td>
                    <td>
                        <span class="match-status matched">${this.escapeHtml(match.matchType)}</span>
                        ${manualBadge}
                        ${multiBadge}
                        ${diffDisplay}
                    </td>
                    <td>
                        <button class="action-btn unmatch-btn" data-action="unmatch" data-idx="${idx}">Unmatch</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Add totals row
        tbody.innerHTML += `
            <tr class="table-footer">
                <td colspan="2" class="total-label">TOTALS (${data.length} transactions)</td>
                <td class="amount-credit total-value">${this.formatCurrency(totalBankAmount)}</td>
                <td colspan="2"></td>
                <td></td>
                <td class="amount-debit total-value">${this.formatCurrency(totalGLAmount)}</td>
                <td colspan="2"></td>
            </tr>
        `;

        // Attach event listeners to Unmatch buttons
        tbody.querySelectorAll('[data-action="unmatch"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                this.unmatchTransaction(idx);
            });
        });

        // Attach sorting listeners
        this.attachSortingListeners('matched', data);
        this.renderPagination(data.length);
    }

    truncate(str, length) {
        if (!str) return '';
        return str.length > length ? str.substring(0, length) + '...' : str;
    }

    attachSortingListeners(tabType, data) {
        const thead = document.getElementById('resultsTableHead');
        thead.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.sort;
                const currentDir = th.classList.contains('sort-asc') ? 'asc' : th.classList.contains('sort-desc') ? 'desc' : 'none';
                const newDir = currentDir === 'asc' ? 'desc' : 'asc';

                // Remove sort classes from all headers
                thead.querySelectorAll('th').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
                th.classList.add(`sort-${newDir}`);

                // Sort data
                this.sortTableData(tabType, key, newDir);
            });
        });
    }

    sortTableData(tabType, key, direction) {
        const multiplier = direction === 'asc' ? 1 : -1;

        const getSortValue = (item, key) => {
            switch(key) {
                case 'bankDate':
                    return item.bankTransaction?.date ? new Date(item.bankTransaction.date).getTime() : 0;
                case 'bankDesc':
                    return item.bankTransaction?.description?.toLowerCase() || '';
                case 'bankAmount':
                    return Math.abs(item.bankTransaction?.amount || item.bankTransaction?.amountCredit || 0);
                case 'glDate':
                    return item.glEntry?.date ? new Date(item.glEntry.date).getTime() : 0;
                case 'glAccount':
                    return item.glEntry?.accountNumber?.toLowerCase() || '';
                case 'glDesc':
                    return item.glEntry?.description?.toLowerCase() || '';
                case 'glAmount':
                    return Math.abs(item.glEntry?.amount || item.glEntry?.debit || 0);
                case 'matchType':
                    return item.matchType?.toLowerCase() || '';
                case 'date':
                    return item.date ? new Date(item.date).getTime() : 0;
                case 'description':
                    return item.description?.toLowerCase() || '';
                case 'amount':
                    return Math.abs(item.amount || item.amountCredit || item.debit || 0);
                case 'accountNumber':
                    return item.accountNumber?.toLowerCase() || '';
                case 'balance':
                    return Math.abs(item.balance || 0);
                case 'type':
                    return item.type?.toLowerCase() || '';
                default:
                    return '';
            }
        };

        if (tabType === 'matched') {
            this.matchedTransactions.sort((a, b) => {
                const aVal = getSortValue(a, key);
                const bVal = getSortValue(b, key);
                if (typeof aVal === 'string') {
                    return aVal.localeCompare(bVal) * multiplier;
                }
                return (aVal - bVal) * multiplier;
            });
            this.renderMatchedTable(this.matchedTransactions);
        } else if (tabType === 'unmatched-bank') {
            this.unmatchedBank.sort((a, b) => {
                const aVal = getSortValue(a, key);
                const bVal = getSortValue(b, key);
                if (typeof aVal === 'string') {
                    return aVal.localeCompare(bVal) * multiplier;
                }
                return (aVal - bVal) * multiplier;
            });
            this.renderUnmatchedBankTable(this.unmatchedBank);
        } else if (tabType === 'unmatched-gl') {
            this.unmatchedGL.sort((a, b) => {
                const aVal = getSortValue(a, key);
                const bVal = getSortValue(b, key);
                if (typeof aVal === 'string') {
                    return aVal.localeCompare(bVal) * multiplier;
                }
                return (aVal - bVal) * multiplier;
            });
            this.renderUnmatchedGLTable(this.unmatchedGL);
        }
    }

    renderUnmatchedBankTable(data, headers) {
        const thead = document.getElementById('resultsTableHead');
        const tbody = document.getElementById('resultsTableBody');

        const newHeaders = [
            { label: 'Date', key: 'date', sortable: true },
            { label: 'Description', key: 'description', sortable: true },
            { label: 'Credit Amount', key: 'amount', sortable: true },
            { label: 'Balance', key: 'balance', sortable: true },
            { label: 'Actions', key: 'actions', sortable: false }
        ];
        thead.innerHTML = '<tr>' + newHeaders.map(h =>
            `<th class="${h.sortable ? 'sortable' : ''}" data-sort="${h.key}">${h.label}</th>`
        ).join('') + '</tr>';

        // Calculate total from ALL data
        const totalAmount = data.reduce((sum, tx) =>
            sum + Math.abs(tx.amountCredit || tx.amount || 0), 0);

        // Paginate
        const pageData = this.paginateData(data);
        const pageOffset = this.pageSize === Infinity ? 0 : (this.currentPage - 1) * this.pageSize;

        tbody.innerHTML = pageData.map((tx, i) => {
            const idx = pageOffset + i;
            return `
            <tr>
                <td>${this.formatDate(tx.date)}</td>
                <td title="${this.escapeHtml(tx.description)}">${this.escapeHtml(this.truncate(tx.description, 50))}</td>
                <td class="amount-credit">${this.formatCurrency(tx.amountCredit || tx.amount || 0)}</td>
                <td>${this.formatCurrency(tx.balance)}</td>
                <td>
                    <button class="action-btn match-btn" data-action="find-match" data-type="bank" data-idx="${idx}">Find Match</button>
                </td>
            </tr>`;
        }).join('');

        // Add totals row
        tbody.innerHTML += `
            <tr class="table-footer">
                <td colspan="2" class="total-label">TOTAL UNMATCHED BANK (${data.length} items)</td>
                <td class="amount-credit total-value">${this.formatCurrency(totalAmount)}</td>
                <td colspan="2"></td>
            </tr>
        `;

        // Attach event listeners to Find Match buttons
        tbody.querySelectorAll('[data-action="find-match"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                const idx = parseInt(btn.dataset.idx);
                this.showManualMatch(type, idx);
            });
        });

        // Attach sorting listeners
        this.attachSortingListeners('unmatched-bank', data);
        this.renderPagination(data.length);
    }

    renderUnmatchedGLTable(data, headers) {
        const thead = document.getElementById('resultsTableHead');
        const tbody = document.getElementById('resultsTableBody');

        const newHeaders = [
            { label: 'Date', key: 'date', sortable: true },
            { label: 'Description', key: 'description', sortable: true },
            { label: 'Account Number', key: 'accountNumber', sortable: true },
            { label: 'Type', key: 'type', sortable: true },
            { label: 'Debit Amount', key: 'amount', sortable: true },
            { label: 'Actions', key: 'actions', sortable: false }
        ];
        thead.innerHTML = '<tr>' + newHeaders.map(h =>
            `<th class="${h.sortable ? 'sortable' : ''}" data-sort="${h.key}">${h.label}</th>`
        ).join('') + '</tr>';

        // Calculate total from ALL data
        const totalAmount = data.reduce((sum, entry) =>
            sum + Math.abs(entry.debit || entry.amount || entry.credit || 0), 0);

        // Paginate
        const pageData = this.paginateData(data);
        const pageOffset = this.pageSize === Infinity ? 0 : (this.currentPage - 1) * this.pageSize;

        tbody.innerHTML = pageData.map((entry, i) => {
            const idx = pageOffset + i;
            return `
            <tr>
                <td>${this.formatDate(entry.date)}</td>
                <td title="${this.escapeHtml(entry.description)}">${this.escapeHtml(this.truncate(entry.description, 50))}</td>
                <td>${this.escapeHtml(entry.accountNumber)}</td>
                <td>${this.escapeHtml(entry.type)}</td>
                <td class="amount-debit">${this.formatCurrency(entry.debit || entry.amount || 0)}</td>
                <td>
                    <button class="action-btn match-btn" data-action="find-match" data-type="gl" data-idx="${idx}">Find Match</button>
                </td>
            </tr>`;
        }).join('');

        // Add totals row
        tbody.innerHTML += `
            <tr class="table-footer">
                <td colspan="4" class="total-label">TOTAL UNMATCHED GL (${data.length} items)</td>
                <td class="amount-debit total-value">${this.formatCurrency(totalAmount)}</td>
                <td></td>
            </tr>
        `;

        // Attach event listeners to Find Match buttons
        tbody.querySelectorAll('[data-action="find-match"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                const idx = parseInt(btn.dataset.idx);
                this.showManualMatch(type, idx);
            });
        });

        // Attach sorting listeners
        this.attachSortingListeners('unmatched-gl', data);
        this.renderPagination(data.length);
    }

    unmatchTransaction(matchIdx) {
        const match = this.matchedTransactions[matchIdx];
        const confirmMsg = match.isMultiMatch
            ? `This is a multi-match with ${match.matchedCount} items. Are you sure you want to unmatch all of them?`
            : 'Are you sure you want to unmatch this transaction?';

        if (!confirm(confirmMsg)) return;

        // Handle multi-match - restore all original items
        if (match.isMultiMatch) {
            if (match.bankTransaction.combinedItems) {
                // Multiple bank items were matched to one GL
                match.bankTransaction.combinedItems.forEach(item => {
                    this.unmatchedBank.push(item);
                });
                this.unmatchedGL.push(match.glEntry);
            } else if (match.glEntry.combinedItems) {
                // Multiple GL items were matched to one bank
                match.glEntry.combinedItems.forEach(item => {
                    this.unmatchedGL.push(item);
                });
                this.unmatchedBank.push(match.bankTransaction);
            }
        } else {
            // Standard single match
            this.unmatchedBank.push(match.bankTransaction);
            this.unmatchedGL.push(match.glEntry);
        }

        // Remove from matched
        this.matchedTransactions.splice(matchIdx, 1);

        console.log('[UNMATCH] Transaction unmatched', match.isMultiMatch ? `(${match.matchedCount} items restored)` : '');

        // Refresh display
        this.displayResults();
    }

    showManualMatch(sourceType, sourceIdx) {
        const modal = document.getElementById('manualMatchModal');
        const list = document.getElementById('matchCandidatesList');
        const selectionSummary = document.getElementById('selectionSummary');

        // Store current selection
        this.manualMatchSource = { type: sourceType, idx: sourceIdx };
        this.selectedMatches = []; // Array to store multi-selected items

        // Get the source item
        const sourceItem = sourceType === 'bank' ? this.unmatchedBank[sourceIdx] : this.unmatchedGL[sourceIdx];
        const targetItems = sourceType === 'bank' ? this.unmatchedGL : this.unmatchedBank;
        const sourceAmount = sourceItem.amount || sourceItem.amountCredit || sourceItem.amountDebit || 0;

        // Update modal title with clearer context
        if (sourceType === 'bank') {
            const title = `Find GL Match for Bank Credit`;
            document.getElementById('manualMatchTitle').textContent = title;
            document.getElementById('manualMatchSourceInfo').innerHTML = `
                <div class="source-info bank-source">
                    <strong>Bank Transaction:</strong> ${this.escapeHtml(sourceItem.description)}<br>
                    <strong>Date:</strong> ${this.formatDate(sourceItem.date)}<br>
                    <strong>Credit Amount:</strong> <span class="amount-highlight">${this.formatCurrency(sourceAmount)}</span>
                </div>
            `;
        } else {
            const title = `Find Bank Match for GL Debit`;
            document.getElementById('manualMatchTitle').textContent = title;
            document.getElementById('manualMatchSourceInfo').innerHTML = `
                <div class="source-info gl-source">
                    <strong>GL Entry:</strong> ${this.escapeHtml(sourceItem.accountNumber)} - ${this.escapeHtml(sourceItem.description)}<br>
                    <strong>Type:</strong> ${this.escapeHtml(sourceItem.type)}<br>
                    <strong>Debit Amount:</strong> <span class="amount-highlight">${this.formatCurrency(sourceAmount)}</span>
                </div>
            `;
        }

        // Set target amount for selection summary
        document.getElementById('targetAmount').textContent = this.formatCurrency(sourceAmount);

        // Sort candidates by amount similarity
        const sortedTargets = targetItems.map((item, idx) => ({
            item,
            idx,
            amount: item.amount || item.amountCredit || item.amountDebit || item.debit || item.credit || 0,
            diff: Math.abs((item.amount || item.amountCredit || item.amountDebit || item.debit || item.credit || 0) - sourceAmount)
        })).sort((a, b) => a.diff - b.diff);

        // Build a table-based layout for candidates
        let tableHeaders = '';
        if (sourceType === 'bank') {
            // Showing GL items - date first, then description, then account, then amount
            tableHeaders = `
                <tr>
                    <th class="candidate-th-check"></th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Account #</th>
                    <th>Amount</th>
                    <th>Difference</th>
                </tr>`;
        } else {
            // Showing Bank items
            tableHeaders = `
                <tr>
                    <th class="candidate-th-check"></th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Difference</th>
                </tr>`;
        }

        const tableRows = sortedTargets.map(({item, idx, amount, diff}) => {
            const matchQuality = diff === 0 ? 'exact-match' : diff < sourceAmount * 0.01 ? 'close-match' : '';
            const diffBadge = diff > 0.01 ? `<span class="diff-indicator">${this.formatCurrency(diff)}</span>` : '<span class="exact-indicator">Exact</span>';

            if (sourceType === 'bank') {
                return `
                    <tr class="match-candidate-row ${matchQuality}" data-candidate-idx="${idx}" data-amount="${amount}">
                        <td class="candidate-td-check"><input type="checkbox" name="manualMatch" value="${idx}" id="match_${idx}"></td>
                        <td>${this.formatDate(item.date)}</td>
                        <td class="candidate-td-desc" title="${this.escapeHtml(item.description)}">${this.escapeHtml(this.truncate(item.description, 45))}</td>
                        <td>${this.escapeHtml(item.accountNumber)}</td>
                        <td class="candidate-td-amount">${this.formatCurrency(amount)}</td>
                        <td class="candidate-td-diff">${diffBadge}</td>
                    </tr>`;
            } else {
                return `
                    <tr class="match-candidate-row ${matchQuality}" data-candidate-idx="${idx}" data-amount="${amount}">
                        <td class="candidate-td-check"><input type="checkbox" name="manualMatch" value="${idx}" id="match_${idx}"></td>
                        <td>${this.formatDate(item.date)}</td>
                        <td class="candidate-td-desc" title="${this.escapeHtml(item.description)}">${this.escapeHtml(this.truncate(item.description, 50))}</td>
                        <td class="candidate-td-amount">${this.formatCurrency(amount)}</td>
                        <td class="candidate-td-diff">${diffBadge}</td>
                    </tr>`;
            }
        }).join('');

        if (sortedTargets.length === 0) {
            list.innerHTML = '<p class="no-matches">No available items to match with. All items may already be matched.</p>';
            selectionSummary.style.display = 'none';
        } else {
            list.innerHTML = `
                <div class="candidate-table-wrapper">
                    <table class="candidate-table">
                        <thead>${tableHeaders}</thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>`;
        }

        // Attach event listeners to checkboxes for multi-selection
        list.querySelectorAll('.match-candidate-row input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const row = e.target.closest('.match-candidate-row');
                const idx = parseInt(row.dataset.candidateIdx);
                const amount = parseFloat(row.dataset.amount);

                if (e.target.checked) {
                    row.classList.add('selected');
                    this.selectedMatches.push({ idx, amount });
                } else {
                    row.classList.remove('selected');
                    this.selectedMatches = this.selectedMatches.filter(m => m.idx !== idx);
                }

                this.updateSelectionSummary(sourceAmount);
            });
        });

        // Allow clicking on candidate row to toggle selection
        list.querySelectorAll('.match-candidate-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    const checkbox = row.querySelector('input[type="checkbox"]');
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });
        });

        // Clear selection button
        const clearBtn = document.getElementById('clearSelectionBtn');
        if (clearBtn) {
            clearBtn.onclick = () => {
                list.querySelectorAll('.match-candidate-row input[type="checkbox"]').forEach(cb => {
                    cb.checked = false;
                    cb.closest('.match-candidate-row').classList.remove('selected');
                });
                this.selectedMatches = [];
                this.updateSelectionSummary(sourceAmount);
            };
        }

        // Initialize selection summary as hidden
        selectionSummary.style.display = 'none';

        modal.style.display = 'flex';
    }

    updateSelectionSummary(targetAmount) {
        const selectionSummary = document.getElementById('selectionSummary');
        const selectedCount = document.getElementById('selectedCount');
        const selectedTotal = document.getElementById('selectedTotal');
        const selectionDifference = document.getElementById('selectionDifference');

        if (this.selectedMatches.length === 0) {
            selectionSummary.style.display = 'none';
            return;
        }

        selectionSummary.style.display = 'block';
        selectedCount.textContent = this.selectedMatches.length;

        const total = this.selectedMatches.reduce((sum, m) => sum + m.amount, 0);
        selectedTotal.textContent = this.formatCurrency(total);

        const diff = total - targetAmount;
        selectionDifference.textContent = this.formatCurrency(Math.abs(diff));

        // Update difference styling
        selectionDifference.classList.remove('exact', 'over');
        if (Math.abs(diff) < 0.01) {
            selectionDifference.classList.add('exact');
            selectionDifference.textContent = 'Exact Match!';
        } else if (diff > 0) {
            selectionDifference.classList.add('over');
            selectionDifference.textContent = `+${this.formatCurrency(diff)} over`;
        } else {
            selectionDifference.textContent = `${this.formatCurrency(Math.abs(diff))} under`;
        }
    }

    selectManualMatch(targetIdx) {
        // Toggle checkbox for the given index
        const checkbox = document.querySelector(`input[name="manualMatch"][value="${targetIdx}"]`);
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        }
    }

    confirmManualMatch() {
        const source = this.manualMatchSource;

        // Check if we have multi-selection
        if (this.selectedMatches && this.selectedMatches.length > 0) {
            // Multi-to-one matching
            this.confirmMultiMatch();
            return;
        }

        // Fallback: check for single selection (backwards compatibility)
        const selected = document.querySelectorAll('input[name="manualMatch"]:checked');
        if (selected.length === 0) {
            alert('Please select one or more items to match');
            return;
        }

        // If single selection, use original logic
        if (selected.length === 1) {
            const targetIdx = parseInt(selected[0].value);
            let bankItem, glItem;

            if (source.type === 'bank') {
                bankItem = this.unmatchedBank[source.idx];
                glItem = this.unmatchedGL[targetIdx];

                // Remove from unmatched
                this.unmatchedBank.splice(source.idx, 1);
                this.unmatchedGL.splice(targetIdx, 1);
            } else {
                glItem = this.unmatchedGL[source.idx];
                bankItem = this.unmatchedBank[targetIdx];

                // Remove from unmatched
                this.unmatchedGL.splice(source.idx, 1);
                this.unmatchedBank.splice(targetIdx, 1);
            }

            // Add to matched
            this.matchedTransactions.push({
                bankTransaction: bankItem,
                glEntry: glItem,
                matchScore: 1.0,
                matchType: 'Manual Match',
                isManual: true
            });

            console.log('[MANUAL] Manual match created');
        } else {
            // Multi-selection - process through confirmMultiMatch
            this.selectedMatches = Array.from(selected).map(cb => ({
                idx: parseInt(cb.value),
                amount: parseFloat(cb.closest('.match-candidate-row').dataset.amount)
            }));
            this.confirmMultiMatch();
            return;
        }

        this.closeManualMatchModal();
        this.displayResults();
    }

    confirmMultiMatch() {
        const source = this.manualMatchSource;

        if (!this.selectedMatches || this.selectedMatches.length === 0) {
            alert('Please select one or more items to match');
            return;
        }

        // Sort selected indices in descending order for safe removal
        const sortedSelections = [...this.selectedMatches].sort((a, b) => b.idx - a.idx);

        if (source.type === 'bank') {
            // Bank item matched to multiple GL items
            const bankItem = this.unmatchedBank[source.idx];
            const glItems = sortedSelections.map(s => this.unmatchedGL[s.idx]);
            const totalGLAmount = glItems.reduce((sum, item) =>
                sum + Math.abs(item.amount || item.debit || item.credit || 0), 0);

            // Remove GL items (in reverse order to preserve indices)
            sortedSelections.forEach(s => {
                this.unmatchedGL.splice(s.idx, 1);
            });

            // Remove bank item
            this.unmatchedBank.splice(source.idx, 1);

            // Create a combined match entry
            this.matchedTransactions.push({
                bankTransaction: bankItem,
                glEntry: {
                    accountNumber: glItems.map(g => g.accountNumber).join(', '),
                    description: glItems.length > 1
                        ? `[${glItems.length} items combined] ` + glItems.map(g => g.description).filter(d => d).join('; ')
                        : glItems[0].description,
                    type: 'Combined',
                    amount: totalGLAmount,
                    debit: totalGLAmount,
                    combinedItems: glItems // Store original items for reference
                },
                matchScore: 1.0,
                matchType: `Multi-Match (${glItems.length} GL → 1 Bank)`,
                isManual: true,
                isMultiMatch: true,
                matchedCount: glItems.length
            });

            console.log(`[MULTI-MATCH] Matched ${glItems.length} GL items to 1 Bank item`);
        } else {
            // GL item matched to multiple Bank items
            const glItem = this.unmatchedGL[source.idx];
            const bankItems = sortedSelections.map(s => this.unmatchedBank[s.idx]);
            const totalBankAmount = bankItems.reduce((sum, item) =>
                sum + Math.abs(item.amount || item.amountCredit || item.amountDebit || 0), 0);

            // Remove bank items (in reverse order to preserve indices)
            sortedSelections.forEach(s => {
                this.unmatchedBank.splice(s.idx, 1);
            });

            // Remove GL item
            this.unmatchedGL.splice(source.idx, 1);

            // Create a combined match entry
            this.matchedTransactions.push({
                bankTransaction: {
                    transactionNumber: bankItems.map(b => b.transactionNumber || b.checkNumber).filter(n => n).join(', '),
                    date: bankItems[0].date, // Use first item's date
                    description: bankItems.length > 1
                        ? `[${bankItems.length} items combined] ` + bankItems.map(b => b.description).filter(d => d).join('; ')
                        : bankItems[0].description,
                    amount: totalBankAmount,
                    amountCredit: totalBankAmount,
                    combinedItems: bankItems // Store original items for reference
                },
                glEntry: glItem,
                matchScore: 1.0,
                matchType: `Multi-Match (${bankItems.length} Bank → 1 GL)`,
                isManual: true,
                isMultiMatch: true,
                matchedCount: bankItems.length
            });

            console.log(`[MULTI-MATCH] Matched ${bankItems.length} Bank items to 1 GL item`);
        }

        this.closeManualMatchModal();
        this.displayResults();
    }

    createCustomMatch(customData) {
        const source = this.manualMatchSource;
        if (!source) {
            console.error('[CUSTOM] No source item set');
            return;
        }

        let bankItem, glItem;

        if (source.type === 'bank') {
            // Source is bank, create custom GL entry
            bankItem = this.unmatchedBank[source.idx];
            glItem = {
                accountNumber: customData.accountNumber || 'CUSTOM',
                description: customData.description,
                type: customData.type,
                beginBalance: 0,
                endingBalance: 0,
                debit: customData.amount,
                amount: customData.amount,
                notes: customData.notes,
                isCustom: true,
                customDate: customData.date
            };

            // Remove source from unmatched
            this.unmatchedBank.splice(source.idx, 1);
        } else {
            // Source is GL, create custom bank entry
            glItem = this.unmatchedGL[source.idx];
            bankItem = {
                transactionNumber: customData.accountNumber || 'CUSTOM',
                date: customData.date,
                description: customData.description,
                memo: customData.notes || '',
                amountCredit: customData.amount,
                amountDebit: 0,
                balance: 0,
                checkNumber: customData.accountNumber || '',
                amount: customData.amount,
                isCustom: true
            };

            // Remove source from unmatched
            this.unmatchedGL.splice(source.idx, 1);
        }

        // Add to matched
        this.matchedTransactions.push({
            bankTransaction: bankItem,
            glEntry: glItem,
            matchScore: 1.0,
            matchType: `Custom ${customData.type.charAt(0).toUpperCase() + customData.type.slice(1)}`,
            isManual: true,
            isCustom: true,
            customNotes: customData.notes
        });

        console.log('[CUSTOM] Custom match created:', customData);

        this.displayResults();
    }

    closeManualMatchModal() {
        document.getElementById('manualMatchModal').style.display = 'none';
        // Reset selection state
        this.selectedMatches = [];
        this.manualMatchSource = null;
        // Hide selection summary
        const selectionSummary = document.getElementById('selectionSummary');
        if (selectionSummary) {
            selectionSummary.style.display = 'none';
        }
    }

    showDebugInfo() {
        const modal = document.getElementById('debugModal');
        const content = document.getElementById('debugModalContent');

        const status = this.getSystemStatus();

        let html = '<div class="debug-info">';

        // Overall Status
        html += `<div class="debug-section ${status.canReconcile ? 'status-good' : 'status-bad'}">`;
        html += `<h3>${status.canReconcile ? '[READY]' : '[NOT READY]'} Ready to Reconcile: ${status.canReconcile ? 'YES' : 'NO'}</h3>`;
        html += '</div>';

        // Bank Data Status
        html += '<div class="debug-section">';
        html += '<h4>Bank Statement Data</h4>';
        html += `<p><strong>Status:</strong> ${status.bankStatus}</p>`;
        html += `<p><strong>Rows Loaded:</strong> ${this.bankData.length}</p>`;
        if (this.bankData.length > 0) {
            html += '<p><strong>Sample Transaction:</strong></p>';
            html += '<pre>' + JSON.stringify(this.bankData[0], null, 2) + '</pre>';
        } else {
            html += '<p class="warning">WARNING: No bank transactions loaded. Please upload a CSV file.</p>';
        }
        html += '</div>';

        // GL Data Status
        html += '<div class="debug-section">';
        html += '<h4>General Ledger Data</h4>';
        html += `<p><strong>Status:</strong> ${status.glStatus}</p>`;
        html += `<p><strong>Rows Loaded:</strong> ${this.glData.length}</p>`;
        if (this.glData.length > 0) {
            html += '<p><strong>Sample Entry:</strong></p>';
            html += '<pre>' + JSON.stringify(this.glData[0], null, 2) + '</pre>';
        } else {
            html += '<p class="warning">WARNING: No GL entries loaded. Please upload an Excel or CSV file.</p>';
        }
        html += '</div>';

        // Button Status
        html += '<div class="debug-section">';
        html += '<h4>Reconcile Button Status</h4>';
        const btn = document.getElementById('reconcileBtn');
        html += `<p><strong>Disabled:</strong> ${btn.disabled}</p>`;
        html += `<p><strong>Should be enabled:</strong> ${this.bankData.length > 0 && this.glData.length > 0}</p>`;
        html += '</div>';

        // Settings
        html += '<div class="debug-section">';
        html += '<h4>Current Settings</h4>';
        html += `<p><strong>Date Range:</strong> ±${this.settings.dateRange} days</p>`;
        html += `<p><strong>Amount Tolerance:</strong> $${this.settings.amountTolerance}</p>`;
        html += '</div>';

        // Errors/Warnings
        if (status.errors.length > 0) {
            html += '<div class="debug-section status-bad">';
            html += '<h4>ERRORS</h4>';
            html += '<ul>';
            status.errors.forEach(err => {
                html += `<li>${err}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        }

        if (status.warnings.length > 0) {
            html += '<div class="debug-section status-warning">';
            html += '<h4>WARNINGS</h4>';
            html += '<ul>';
            status.warnings.forEach(warn => {
                html += `<li>${warn}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        }

        // Action Items
        if (!status.canReconcile) {
            html += '<div class="debug-section status-warning">';
            html += '<h4>Action Items</h4>';
            html += '<ul>';
            if (this.bankData.length === 0) {
                html += '<li>Upload a bank statement CSV file</li>';
            }
            if (this.glData.length === 0) {
                html += '<li>Upload a general ledger Excel or CSV file</li>';
            }
            html += '</ul>';
            html += '</div>';
        }

        html += '</div>';

        content.innerHTML = html;
        modal.style.display = 'flex';
    }

    getSystemStatus() {
        const status = {
            canReconcile: false,
            bankStatus: 'Not loaded',
            glStatus: 'Not loaded',
            errors: [],
            warnings: []
        };

        // Check bank data
        if (this.bankData.length === 0) {
            status.errors.push('No bank statement data loaded');
            status.bankStatus = '[ERROR] No data';
        } else {
            status.bankStatus = `[OK] ${this.bankData.length} transactions loaded`;

            // Validate bank data structure
            const sample = this.bankData[0];
            if (!sample.amount && sample.amount !== 0) {
                status.warnings.push('Bank transactions may have invalid amounts');
            }
            if (!sample.date) {
                status.warnings.push('Bank transactions may be missing dates');
            }
        }

        // Check GL data
        if (this.glData.length === 0) {
            status.errors.push('No general ledger data loaded');
            status.glStatus = '[ERROR] No data';
        } else {
            status.glStatus = `[OK] ${this.glData.length} entries loaded`;

            // Validate GL data structure
            const sample = this.glData[0];
            if (!sample.amount && sample.amount !== 0) {
                status.warnings.push('GL entries may have invalid amounts');
            }
            if (!sample.accountNumber) {
                status.warnings.push('GL entries may be missing account numbers');
            }
        }

        // Overall status
        status.canReconcile = this.bankData.length > 0 && this.glData.length > 0;

        return status;
    }

    closeDebugModal() {
        document.getElementById('debugModal').style.display = 'none';
    }

    applyFilters() {
        // This will filter the currently displayed data
        this.switchTab(this.currentTab);
    }

    clearFilters() {
        this.filters = {
            dateFrom: null,
            dateTo: null,
            amountMin: null,
            amountMax: null,
            searchText: ''
        };

        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        document.getElementById('amountMin').value = '';
        document.getElementById('amountMax').value = '';
        document.getElementById('searchText').value = '';

        this.applyFilters();
    }

    printReport() {
        window.print();
    }

    exportToExcel() {
        const wb = XLSX.utils.book_new();

        // Matched transactions sheet
        const matchedData = this.matchedTransactions.map(match => ({
            'Bank Date': this.formatDate(match.bankTransaction.date),
            'Description': match.bankTransaction.description,
            'Check Number': match.bankTransaction.checkNumber,
            'Bank Amount': match.bankTransaction.amount,
            'GL Account': match.glEntry.accountNumber,
            'GL Description': match.glEntry.description,
            'GL Amount': match.glEntry.amount,
            'Match Type': match.matchType,
            'Manual': match.isManual ? 'Yes' : 'No'
        }));
        const wsMatched = XLSX.utils.json_to_sheet(matchedData);
        XLSX.utils.book_append_sheet(wb, wsMatched, 'Matched');

        // Unmatched bank sheet
        const unmatchedBankData = this.unmatchedBank.map(tx => ({
            'Date': this.formatDate(tx.date),
            'Description': tx.description,
            'Memo': tx.memo,
            'Check Number': tx.checkNumber,
            'Debit': tx.amountDebit,
            'Credit': tx.amountCredit,
            'Balance': tx.balance
        }));
        const wsUnmatchedBank = XLSX.utils.json_to_sheet(unmatchedBankData);
        XLSX.utils.book_append_sheet(wb, wsUnmatchedBank, 'Unmatched Bank');

        // Unmatched GL sheet
        const unmatchedGLData = this.unmatchedGL.map(entry => ({
            'Account Number': entry.accountNumber,
            'Description': entry.description,
            'Type': entry.type,
            'Begin Balance': entry.beginBalance,
            'Ending Balance': entry.endingBalance,
            'Adjustment': entry.adjustment
        }));
        const wsUnmatchedGL = XLSX.utils.json_to_sheet(unmatchedGLData);
        XLSX.utils.book_append_sheet(wb, wsUnmatchedGL, 'Unmatched GL');

        // Save file
        XLSX.writeFile(wb, `Reconciliation_${this.formatDateFilename(new Date())}.xlsx`);
    }

    exportToCSV() {
        let csv = '';

        switch(this.currentTab) {
            case 'matched':
                csv = this.generateMatchedCSV();
                break;
            case 'unmatched-bank':
                csv = this.generateUnmatchedBankCSV();
                break;
            case 'unmatched-gl':
                csv = this.generateUnmatchedGLCSV();
                break;
        }

        this.downloadCSV(csv, `${this.currentTab}_${this.formatDateFilename(new Date())}.csv`);
    }

    generateMatchedCSV() {
        const headers = ['Bank Date', 'Description', 'Check Number', 'Bank Amount', 'GL Account', 'GL Description', 'GL Amount', 'Match Type', 'Manual'];
        const rows = this.matchedTransactions.map(match => [
            this.formatDate(match.bankTransaction.date),
            match.bankTransaction.description,
            match.bankTransaction.checkNumber,
            match.bankTransaction.amount,
            match.glEntry.accountNumber,
            match.glEntry.description,
            match.glEntry.amount,
            match.matchType,
            match.isManual ? 'Yes' : 'No'
        ]);

        return Papa.unparse({ fields: headers, data: rows });
    }

    generateUnmatchedBankCSV() {
        const headers = ['Date', 'Description', 'Memo', 'Check Number', 'Debit', 'Credit', 'Balance'];
        const rows = this.unmatchedBank.map(tx => [
            this.formatDate(tx.date),
            tx.description,
            tx.memo,
            tx.checkNumber,
            tx.amountDebit,
            tx.amountCredit,
            tx.balance
        ]);

        return Papa.unparse({ fields: headers, data: rows });
    }

    generateUnmatchedGLCSV() {
        const headers = ['Account Number', 'Description', 'Type', 'Begin Balance', 'Ending Balance', 'Adjustment'];
        const rows = this.unmatchedGL.map(entry => [
            entry.accountNumber,
            entry.description,
            entry.type,
            entry.beginBalance,
            entry.endingBalance,
            entry.adjustment
        ]);

        return Papa.unparse({ fields: headers, data: rows });
    }

    downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    formatCurrency(value) {
        if (value === 0 || value === null || value === undefined) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    }

    formatDate(date) {
        if (!date) return '';
        if (!(date instanceof Date)) date = new Date(date);
        return date.toLocaleDateString('en-US');
    }

    formatDateFilename(date) {
        return date.toISOString().split('T')[0];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    reset() {
        if (!confirm('Are you sure you want to reset? All data and matches will be cleared.')) return;

        this.bankData = [];
        this.glData = [];
        this.matchedTransactions = [];
        this.unmatchedBank = [];
        this.unmatchedGL = [];
        this.manualMatches = [];
        this.smartMatchSuggestions = [];
        this.pageSize = 15;
        this.currentPage = 1;
        this.bankFileName = '';
        this.glFileName = '';

        document.getElementById('bankFile').value = '';
        document.getElementById('glFile').value = '';
        document.getElementById('bankFileName').textContent = 'No file selected';
        document.getElementById('glFileName').textContent = 'No file selected';
        document.getElementById('bankFileName').style.color = '';
        document.getElementById('glFileName').style.color = '';
        document.getElementById('reconcileBtn').disabled = true;

        document.getElementById('progressSection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'none';

        // Reset status indicator
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        if (statusIndicator) {
            statusIndicator.style.display = 'block';
            statusIndicator.style.background = '#fee2e2';
            statusIndicator.style.borderColor = '#dc2626';
        }
        if (statusText) {
            statusText.textContent = 'Waiting for both files to be uploaded';
        }

        this.clearFilters();

        console.log('[RESET] Application reset');
    }
}

// Initialize the application when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new BankReconciliation();
});
