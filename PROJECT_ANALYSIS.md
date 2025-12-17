# Lifecycle Analysis Platform - Project Analysis

## Overview
Enterprise hardware inventory lifecycle analysis system that processes inventory files, enhances data through multiple phases, and uses AI research to determine product lifecycle dates.

## Architecture

### Tech Stack
- **Frontend**: React 19 + Vite 5 + TailwindCSS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (Cloud SQL)
- **AI Research**: Google Custom Search API
- **Deployment**: Google Cloud Run
- **Build**: Cloud Build

### Project Structure

```
lifecycle-analysis/
├── src/                          # Frontend React application
│   ├── App.jsx                   # Main app (renders LifecyclePage)
│   ├── main.jsx                  # React entry point
│   ├── components/
│   │   ├── LifecyclePage.jsx    # Main UI component with phase management
│   │   ├── Phase2Results.jsx    # Phase 2 enhanced inventory display
│   │   ├── Phase3Results.jsx    # Phase 3 AI research interface
│   │   ├── LifecycleReportView.jsx  # Final report viewer
│   │   └── Phase1filterpanel.jsx    # Filter selection UI
│   └── config.js                 # Frontend configuration
│
├── backend/
│   ├── src/
│   │   ├── server.js            # Express server entry point (port 8080/3001)
│   │   ├── app.js               # Express app setup & routes
│   │   ├── config/
│   │   │   ├── database.js      # PostgreSQL connection pool
│   │   │   └── logger.js        # Winston logger
│   │   ├── routes/
│   │   │   ├── upload.routes.js    # Phase 1 routes
│   │   │   ├── phase2.routes.js    # Phase 2 routes
│   │   │   └── phase3.routes.js    # Phase 3 routes
│   │   ├── controllers/
│   │   │   ├── uploadController.js      # Phase 1 file upload & processing
│   │   │   ├── phase2Controller.js      # Phase 2 enhanced inventory
│   │   │   ├── phase3Controller.js      # Phase 3 AI research orchestration
│   │   │   └── lifecycleReportController.js  # Report generation
│   │   ├── services/
│   │   │   ├── googleAIResearchService.js    # Google CSE API integration
│   │   │   ├── phase3DataProcessor.js        # Phase 3 data transformation
│   │   │   ├── enhancedDateEstimation.js     # Date estimation logic
│   │   │   ├── lifecycleExcelBuilder.js      # Excel report generation
│   │   │   ├── phase1FilterService.js        # Filter management
│   │   │   └── dataProcessor.js              # General data processing
│   │   ├── utils/
│   │   │   ├── jobStorage.js     # In-memory job storage (phase 1 & 2)
│   │   │   └── columnMapper.js   # CSV column normalization
│   │   └── database/
│   │       ├── dbConnection.js   # DB connection helper
│   │       ├── init.sql          # Initial schema
│   │       └── phase3Schema.sql  # Phase 3 tables
│   └── data/
│       ├── filters.json          # Phase 1 filter definitions
│       ├── exclusions.json       # Exclusion patterns
│       └── manufacturers.json    # Manufacturer mappings
│
├── Dockerfile                    # Container build config
├── cloudbuild.yaml               # Cloud Build pipeline
└── nginx.conf                    # Nginx config (if needed)
```

## Workflow: Three-Phase Analysis Process

### Phase 1: Inventory Upload & Initial Analysis
**Purpose**: Parse and normalize inventory files, apply filters, calculate initial analytics

**Flow**:
1. User uploads CSV/XLSX/XLSB file via `LifecyclePage`
2. File parsed by `uploadController.js`
   - CSV: Uses PapaParse
   - Excel: Uses ExcelJS
3. Data normalization via `columnMapper.js` or built-in processor
   - Maps various column names to standard fields
   - Normalizes support coverage to "Active" or "Expired"
   - Handles quantity, dates, and product identifiers
4. Filter application (if selected)
   - Loads filter set from `phase1FilterService`
   - Excludes items matching patterns (PWR, CAB, FAN, etc.)
   - Applies description and type exclusions
5. Analytics calculation
   - Category/manufacturer breakdowns
   - Data completeness scores
   - Lifecycle status by category
   - Support coverage distribution
6. Job storage
   - Stores in-memory via `jobStorage.js`
   - Returns job ID to frontend
   - Job data includes: normalized items, summary, analytics

**Key Functions**:
- `uploadFile()` - Main upload handler
- `processData()` - Column mapping & normalization
- `normalizeSupport()` - Support coverage standardization
- `parseExcel()` - Excel file parsing
- `getJobStatus()` - Status polling
- `getResults()` - Retrieve processed data

**API Endpoints**:
- `POST /api/phase1/upload` - Upload file
- `GET /api/phase1/status/:jobId` - Check status
- `GET /api/phase1/results/:jobId` - Get results
- `GET /api/phase1/filters` - List filter sets

### Phase 2: Enhanced Inventory Analysis
**Purpose**: Add risk scoring, data completeness analysis, prepare for Phase 3

**Flow**:
1. User clicks "Phase 2" button
2. Frontend calls `POST /api/phase2/analyze` with Phase 1 job ID
3. `phase2Controller.processPhase2Analysis()`:
   - Retrieves Phase 1 data from job storage
   - Enhances each item with:
     - Risk score calculation
     - Risk level (high/medium/low)
     - Additional fields (end_of_sw_support, end_of_sw_vulnerability)
   - Calculates summary statistics
4. Creates Phase 2 job in memory storage
5. User can filter, sort, and edit items in UI
6. User saves data for Phase 3 via `POST /api/phase2/save-for-phase3/:jobId`

**Key Functions**:
- `processPhase2Analysis()` - Main Phase 2 handler
- `calculateRiskScore()` - Risk assessment logic
- `calculateDataCompleteness()` - Completeness scoring
- `updateInventoryItem()` - Single item updates
- `saveForPhase3()` - Prepare data for Phase 3

**API Endpoints**:
- `POST /api/phase2/analyze` - Start Phase 2
- `GET /api/phase2/results/:jobId` - Get Phase 2 data
- `PUT /api/phase2/item/:jobId/:itemId` - Update item
- `POST /api/phase2/save-for-phase3/:jobId` - Prepare for Phase 3

### Phase 3: AI-Powered Lifecycle Research
**Purpose**: Research missing lifecycle dates using Google Custom Search API

**Flow**:
1. User clicks "Phase 3" button (requires Phase 2 completion)
2. Frontend calls `POST /api/phase3/initialize` with Phase 2 job ID
3. `phase3Controller.initializePhase3()`:
   - Retrieves Phase 2 data
   - Inserts products into PostgreSQL `phase3_analysis` table
   - Creates Phase 3 job record
   - Returns Phase 3 job ID
4. User triggers research via `POST /api/phase3/run-research`
5. `phase3Controller.runAIResearch()`:
   - Processes products sequentially
   - For each product, calls `googleAIResearchService.performResearch()`:
     - Builds search queries (product ID + manufacturer + "end of life")
     - Uses Google Custom Search API
     - Extracts dates from search results
     - Validates and estimates missing dates
   - Stores results in database
   - Sends progress updates
6. Frontend polls `GET /api/phase3/research-progress/:jobId` for status
7. When complete, user can generate lifecycle report

**Key Functions**:
- `initializePhase3()` - Setup Phase 3 job
- `runAIResearch()` - Orchestrate research process
- `performResearch()` - Google CSE API calls
- `extractLifecycleDates()` - Date extraction from web content
- `estimateMissingDates()` - Date estimation logic
- `storePhase3Result()` - Save to database

**Database Tables**:
- `phase3_analysis` - Main research results
- `phase3_jobs` - Job tracking
- `raw_inventory` - Year distribution data

**API Endpoints**:
- `POST /api/phase3/initialize` - Initialize Phase 3
- `POST /api/phase3/run-research` - Start research
- `GET /api/phase3/research-progress/:jobId` - Check progress
- `GET /api/phase3/results/:jobId` - Get results

### Phase 4: Lifecycle Report Generation
**Purpose**: Generate comprehensive Excel reports with year-by-year analysis

**Flow**:
1. User clicks "Lifecycle Report" button (requires Phase 3 completion)
2. Frontend calls `POST /api/phase3/reports/export/lifecycle-report-excel`
3. `lifecycleReportController.exportLifecycleReportExcel()`:
   - Retrieves Phase 3 data from database
   - Uses `lifecycleExcelBuilder.js` to create Excel workbook:
     - Summary sheet
     - Year-by-year analysis (inventory by EOL year)
     - Product details
     - Charts and visualizations
   - Returns Excel file as download

**Key Functions**:
- `exportLifecycleReportExcel()` - Main report handler
- `buildLifecycleWorkbook()` - Excel generation
- `calculateYearlyDistribution()` - Year-by-year calculations

## Data Flow

```
User Upload → Phase 1 (Memory) → Phase 2 (Memory) → Phase 3 (Database) → Report (Excel)
```

**Storage Strategy**:
- **Phase 1 & 2**: In-memory (`jobStorage.js`) - temporary, session-based
- **Phase 3**: PostgreSQL - persistent, queryable
- **Final Reports**: Generated on-demand, not stored

## Key Business Logic

### Support Coverage Normalization
- Only "ACTIVE" or "COVERED" → "Active"
- Everything else → "Expired"
- Default if missing → "Expired"

### Filtering Logic
- Product ID patterns: PWR, CAB, FAN, MEM-, etc.
- Description keywords: POWER SUPPLY, CABLE, FAN MODULE, etc.
- Product types: SERVICE, SOFTWARE, LICENSE, ACCESSORY

### Risk Scoring (Phase 2)
Based on:
- Support coverage status
- End of sale dates
- End of support dates
- Data completeness

### Date Estimation (Phase 3)
If dates missing, estimates based on:
- Industry standards (Cisco, HP, etc.)
- Typical lifecycle patterns
- Similar products

### AI Research Strategy
- Searches manufacturer websites first
- Looks for lifecycle documentation
- Extracts dates from HTML/text
- Validates date formats
- Falls back to estimation if no results

## Configuration

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `GOOGLE_CSE_API_KEY` - Google Custom Search API key
- `GOOGLE_CSE_CX` - Custom Search Engine ID
- `NODE_ENV` - Environment (production/development)
- `PORT` - Server port (8080 for production, 3001 for dev)

### Database Connection
- Uses connection pooling (max 20 connections)
- Cloud SQL via Unix socket in production
- Local connection in development

## Deployment

### Cloud Build Pipeline (`cloudbuild.yaml`)
1. Build Docker image
2. Push to Container Registry
3. Deploy to Cloud Run
4. Configure Cloud SQL connection
5. Set secrets (database URL, API keys)

### Dockerfile
- Multi-stage build
- Installs frontend and backend dependencies
- Builds frontend with Vite
- Copies built files to backend/public
- Runs Express server

## Known Issues / Areas for Fix

Based on the codebase structure, potential issues to investigate:

1. **Job Storage**: Phase 1 & 2 use in-memory storage - may not persist across restarts
2. **Error Handling**: Need to verify comprehensive error handling in all phases
3. **API Rate Limiting**: Google CSE API may have rate limits
4. **Database Migrations**: Need to verify schema migrations are handled
5. **File Upload Limits**: 10MB limit may be restrictive
6. **Filter Logic**: Hard-coded exclusion patterns may need flexibility
7. **Date Parsing**: Various date formats in source files may cause issues
8. **Progress Tracking**: Phase 3 research may timeout on large datasets

## Dependencies

### Frontend
- React 19.1.1
- Vite 5.4.21
- TailwindCSS 3.4.18
- Chart.js 4.5.1
- ExcelJS 4.4.0
- date-fns 4.1.0

### Backend
- Express 4.21.2
- PostgreSQL (pg) 8.16.3
- Multer 1.4.5 (file uploads)
- PapaParse 5.4.1 (CSV parsing)
- ExcelJS 4.4.0 (Excel parsing)
- Winston 3.18.3 (logging)
- Axios 1.12.2 (HTTP requests)
- Cheerio 1.1.2 (HTML parsing)

---

**Last Updated**: Analysis generated from codebase review
**Next Steps**: Identify specific issues and create fix plan



