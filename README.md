# 50cube Backend API - Tech Assessment

Backend API for 50cube learning platform with bite-sized interactive modules, skill-based leagues, and a points-based system.

## **Live Demo**

- **API Base:** [https://50cube-bakcend.vercel.app/api](https://your-vercel-url.vercel.app/api)
- **Health Check:** [https://50cube-bakcend.vercel.app/api/health](https://your-vercel-url.vercel.app/api/health)

## **Modules Implemented**

### ✅ M13 - Leagues (Skill-Only)

- **Entry API:** `POST /api/leagues/enter` - Join leagues
- **Submit API:** `POST /api/leagues/submit` - Submit scores
- **Leaderboard API:** `GET /api/leagues/:id/leaderboard` - View rankings
- **Features:** Accuracy-then-time scoring, tie-breaking logic, real-time leaderboard updates

### ✅ M14 - Spotlight & Global Leaderboard

- **Leaderboard API:** `GET /api/leaderboard?scope=global|subject` - Main leaderboard
- **Spotlight API:** `GET /api/leaderboard/spotlight` - Featured performers
- **Daily Job:** Automated snapshot creation with 7-day spotlight rotation
- **Features:** Sortable tables, diverse achievement highlighting, historical data

### ✅ M15 - Readers (Buy & Download)

- **Catalog API:** `GET /api/readers/catalog` - Browse readers with filtering/search
- **Purchase API:** `POST /api/readers/buy` - Credit-based purchases
- **Download API:** `GET /api/readers/download/:id` - Signed, time-limited URLs
- **Library API:** `GET /api/readers/library` - User's purchased collection
- **Features:** JWT-based download tokens, credit deduction, ownership verification

## **Tech Stack**

- Node.js + Express + TypeScript
- MongoDB + Mongoose
- JWT Authentication
- Joi Validation
- Node-cron (Daily Jobs)

## ⚡ **Quick Start**

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### Installation

```bash
# Clone repository
git clone https://github.com/sreenu926/50cube-backend.git
cd 50cube-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# Run development server
npm run dev
```

### Environment Variables

```env
MONGODB_URI=mongodb://localhost:27017/50cube
JWT_SECRET=your-super-secret-jwt-key
PORT=5001
NODE_ENV=development
BASE_URL=http://localhost:5001
```

## 📦 **Deployment**

### Vercel (Recommended)

1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push

### Scripts

```bash
npm run dev     # Development server
npm run build   # Build TypeScript
npm start       # Production server
```

## 📊 **API Documentation**

### Health Check

- `GET /api/health` - Server status and module completion

### M13 - Leagues

- `GET /api/leagues` - List all leagues
- `GET /api/leagues/:id` - Get league details
- `POST /api/leagues/enter` - Join a league
- `POST /api/leagues/submit` - Submit scores
- `GET /api/leagues/:id/leaderboard` - Get leaderboard

### M14 - Leaderboard

- `GET /api/leaderboard` - Global/subject leaderboard
- `GET /api/leaderboard/spotlight` - Spotlight carousel
- `GET /api/leaderboard/stats` - Platform statistics
- `GET /api/leaderboard/user/:id/history` - User rank history

### M15 - Readers

- `GET /api/readers/catalog` - Browse readers
- `POST /api/readers/buy` - Purchase reader
- `GET /api/readers/download/:id` - Get download URL
- `GET /api/readers/library` - User's library

## ✅ **Test Checklist**

**M13 Tests:**

- [x] Ties break by time (faster wins)
- [x] Leaderboard updates after score submission
- [x] Entry validation and participant limits

**M14 Tests:**

- [x] Daily snapshot job creates/updates data
- [x] Spotlight shows last 7 days only
- [x] Leaderboard sorting works correctly

**M15 Tests:**

- [x] Credits deducted on purchase
- [x] Download links expire (1 hour)
- [x] Items appear in user library

## 🎯 **Scoring System**

**League Ranking Logic:**

1. **Primary:** Accuracy percentage (correct/total)
2. **Tiebreaker:** Completion time (faster wins)
3. **Points:** Combined accuracy and time-based scoring

## 🔧 **Sample Data Creation**

```bash
# Create sample users and leagues
curl -X POST http://localhost:5001/api/test-user
curl -X POST http://localhost:5001/api/test-league
curl -X POST http://localhost:5001/api/admin/create-sample-readers
```

## 🚀 **Production Features**

- **Database Indexing:** Optimized queries for leaderboards
- **Background Jobs:** Automated daily leaderboard snapshots
- **JWT Tokens:** Secure, time-limited download access
- **Input Validation:** Comprehensive Joi schemas
- **Error Handling:** Structured error responses
- **CORS:** Configured for frontend integration

---

**Built for 50cube Tech Assessment**
