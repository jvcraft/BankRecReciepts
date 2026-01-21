# Municipal Bank Reconciliation System

A browser-based bank reconciliation tool designed for municipal accounting. Compare bank statements with general ledger entries and automatically match transactions.

## Features

- **File Support**: Upload CSV (.csv) or Excel (xlsx) files to be analyzed
- **Smart Parsing**: Automatically handles:
  - Relevant numbers (i.e. text formatted or numericals)
  - Multiple currency formats ($, €, £, etc.)
  - Accounting notation (parentheses for negatives)
  - Various date formats
  - Different file structures (Excel or Comma-Separated supported)
- **Smart Matching**: Automatically matches bank credits to GL debits by:
  - Exact amount matching
  - Date proximity (configurable range)
  - Amount tolerance
- **Enhanced Manual Matching**: Intuitive modal interface with:
  - Candidates sorted by amount similarity
  - Visual indicators for exact and close matches
  - Clear source and target information
- **Visual Dashboard**: See matched and unmatched transactions at a glance
- **Export Options**: Export results to Excel or CSV
- **Municipal-Focused**: Clean, professional interface designed for government accounting

## How to Use

### Step 1: Open the Application
Run the program in any web browser (Firefox, Chrome, Edge, etc.)

### Step 2: Upload Files
1. **Bank Statement**: Upload your CSV or Excel file (.xlsx, .xls, .csv)
2. **General Ledger**: Upload your Excel or CSV file (.xlsx, .xls, .csv)

**Note**: The system automatically detects file formats and handles:
- Text-formatted numbers (no need to convert to numeric format)
- Various decimal separators (commas or periods)
- Currency symbols and formatting
- Different header row positions

### Step 3: Configure Settings
- **Date Range**: Set how many days before/after to look for matches (default: ±3 days)
- **Amount Tolerance**: Allow small differences in amounts (default: $0.00 for exact match)

### Step 4: Reconcile
Click "Start Reconciliation" to begin the matching process.

### Step 5: Review Results
The dashboard shows:
- **Matched Transactions**: Bank credits matched with GL debits
  - Shows both bank and GL information side-by-side
  - Displays match type and any amount differences
  - Manual matches are clearly labeled
- **Unmatched Bank Items**: Bank credits not yet matched with GL
  - Click "Find Match" to manually select a GL debit
- **Unmatched GL Items**: GL debits not yet matched with bank
  - Click "Find Match" to manually select a bank credit
- **Total Matched Amount**: Sum of all successfully matched transactions

### Step 6: Manual Matching
When you click "Find Match" on an unmatched item:
1. A modal opens showing the source item details
2. Available matches are displayed, sorted by amount similarity
3. Exact matches are highlighted in green
4. Close matches (within 1%) are highlighted in yellow
5. Select the correct match and click "Confirm Match"

### Step 7: Export
- Click "Export to Excel" for a comprehensive workbook with all three sheets
- Click "Export to CSV" to export the currently viewed tab
- Click "Print" for a print-friendly report

## File Format Requirements

### Bank Statement CSV
Expected columns:
- Transaction Number
- Date (MM/DD/YYYY format)
- Description
- Memo
- Amount Debit
- Amount Credit
- Balance
- Check Number
- Fees

### General Ledger Excel/CSV
Expected columns:
- Account Number
- Description
- Type
- Begin Balance
- Ending Balance
- ADJUSTMENT (the amount to reconcile)

## Matching Logic

The system uses a weighted scoring algorithm:

1. **Amount Matching (50% weight)**
   - Exact amount match gets full points
   - Within 1% gets 80% of points
   - Respects amount tolerance setting

2. **Check Number (30% weight)**
   - Matches check numbers from bank against account numbers in GL

3. **Date Proximity (20% weight)**
   - Transactions within the date range get points
   - Configurable from 0-30 days

Transactions with a match score above 50% are considered matched.

## Tips for Best Results

- Ensure dates are in MM/DD/YYYY format in CSV files
- Use a date range of 3-5 days for most municipal reconciliations
- Start with $0.00 amount tolerance, increase only if needed
- Review unmatched items carefully - they may need manual investigation
- Export results before starting a new reconciliation

## Technical Details

- **Client-Side Only**: All processing happens in your browser, files never uploaded to a server
- **Libraries Used**:
  - PapaParse: CSV parsing
  - SheetJS (xlsx): Excel file reading and writing
- **Browser Compatibility**: Works on all modern browsers (Chrome, Firefox, Edge, Safari)
- **No Dependencies**: No Node.js or server installation required

## Privacy & Security

- All data processing occurs locally in your browser
- Files are never uploaded to any server
- No data is stored or transmitted over the internet
- Safe for confidential municipal financial data

## Support

For issues or questions, please contact your IT department or the developer.

## Version

Version 1.0 - January 2026
