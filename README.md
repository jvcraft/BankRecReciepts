# Municipal Bank Reconciliation System

A full-stack bank reconciliation tool designed for municipal accounting. Compare bank statements with general ledger entries, automatically match transactions, and maintain history of reconciliations.

## Features

- **User Authentication**: Firebase Authentication with email/password
- **Persistent History**: Save and load reconciliation sessions via Firestore
- **File Support**: Upload CSV, Excel, PDF, OFX, and QIF files
- **Smart Parsing**: Automatically handles:
  - Text-formatted numbers and numericals
  - Multiple currency formats ($, €, £, etc.)
  - Accounting notation (parentheses for negatives)
  - Various date formats including Excel serial dates
  - Bank export formats with timestamps
- **Smart Matching**: Automatically matches bank credits to GL debits by:
  - Exact amount matching
  - Date proximity (configurable range)
  - Amount tolerance
  - Check number matching
- **Manual & Custom Matching**: Create custom entries or match existing items
- **Dark Mode**: Full dark theme support with system preference detection
- **Export Options**: Export results to Excel or CSV

## Quick Start

### Prerequisites

- Node.js 18 or higher
- Firebase project with Firestore and Authentication enabled

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/jvcraft/BankRecReciepts.git
   cd BankRecReciepts
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Firebase credentials (see Configuration section below).

4. Configure client-side Firebase:
   - Edit `public/js/auth.js` and `public/login.html`
   - Replace `YOUR_API_KEY`, `YOUR_PROJECT_ID`, etc. with your Firebase Web App credentials

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open http://localhost:3000 in your browser

## Configuration

### Server-Side (`.env` file)

```env
# Server
PORT=3000
NODE_ENV=development

# Production URL
APP_URL=https://yourdomain.com

# CORS (comma-separated origins for production)
ALLOWED_ORIGINS=https://yourdomain.com

# Firebase Admin SDK (from Firebase Console > Project Settings > Service Accounts)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Client-Side (`public/js/auth.js` and `public/login.html`)

Get these from Firebase Console > Project Settings > General > Your apps > Web app:

```javascript
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.firebasestorage.app",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef",
    measurementId: "G-XXXXXXX"
};
```

## Production Deployment

### Option 1: Docker

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t bank-reconciliation .
docker run -p 3000:3000 --env-file .env bank-reconciliation
```

### Option 2: Render.com

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Set environment variables in the Render dashboard
4. Deploy automatically on push

### Option 3: Railway

1. Connect GitHub repository
2. Railway will auto-detect the configuration from `railway.json`
3. Add environment variables in the Railway dashboard

### Option 4: Fly.io

```bash
# Install Fly CLI and authenticate
fly auth login

# Launch the app (first time)
fly launch

# Deploy updates
fly deploy

# Set secrets
fly secrets set FIREBASE_PROJECT_ID=your-project-id
fly secrets set FIREBASE_CLIENT_EMAIL=your-email
fly secrets set FIREBASE_PRIVATE_KEY="your-key"
```

### Option 5: Traditional VPS

1. Clone the repository on your server
2. Install Node.js 18+
3. Install PM2: `npm install -g pm2`
4. Configure environment variables
5. Start with PM2:
   ```bash
   pm2 start npm --name "bank-rec" -- run start:prod
   pm2 save
   pm2 startup
   ```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/ready` | GET | Readiness check (tests DB connection) |
| `/api/auth/profile` | GET/POST/DELETE | User profile management |
| `/api/reconciliation/save` | POST | Save reconciliation |
| `/api/reconciliation/:id` | GET/PUT | Load/update reconciliation |
| `/api/reconciliation/parse` | POST | Parse uploaded file (PDF/OFX/QIF) |
| `/api/history` | GET | Get reconciliation history |
| `/api/history/:id` | DELETE | Delete reconciliation |
| `/api/settings` | GET/PUT | User settings |

## File Format Support

### Bank Statements
- CSV with standard columns
- Excel (.xlsx, .xls)
- PDF (parsed server-side)
- OFX/QFX (Open Financial Exchange)
- QIF (Quicken Interchange Format)

### General Ledger
- CSV or Excel with account number, description, type, and amounts

## Security Features

- Helmet.js for HTTP security headers
- Rate limiting on API endpoints
- CORS protection for production
- Firebase Authentication
- Environment-based configuration
- Non-root Docker user

## Development

```bash
# Start development server with auto-reload
npm run dev

# Run tests
npm test

# Check health endpoint
curl http://localhost:3000/api/health
```

## Version

Version 2.0 - January 2026

## License

MIT License
