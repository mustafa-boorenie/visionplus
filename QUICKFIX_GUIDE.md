# Quick Fix Guide - Network Error

## Issue
You're getting "AxiosError: Network Error" when trying to create sessions or load sequences.

## Root Cause
The server is failing to start because it can't find the `DATABASE_URL` environment variable from `.env.local`.

## Solutions

### Option 1: Quick Fix (No Database)
The server has been updated to work without a database. Simply restart the server:

1. Kill any existing server processes:
```bash
# Find and kill processes on port 3002
lsof -ti:3002 | xargs kill -9
```

2. Restart the server:
```bash
npm run server:v2:dev
```

### Option 2: Full Setup (With Database)

1. Ensure `.env.local` exists with DATABASE_URL:
```bash
# Create .env.local if it doesn't exist
echo 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_playwright_scripter?schema=public"' > .env.local
```

2. Start PostgreSQL (if using Docker):
```bash
docker-compose up -d
```

3. Run database migrations:
```bash
npm run prisma:migrate
```

4. Restart the server:
```bash
npm run server:v2:dev
```

### Option 3: Use Prisma Accelerate (Your Current Setup)
Based on your database URL, you're using Prisma Accelerate. Make sure:
1. Your `.env.local` contains the correct Accelerate URL
2. You have internet connectivity to reach the Accelerate endpoint

## Verification
After restarting, you should see:
- "Enhanced API Server listening on port 3002" (server started)
- "Database connected successfully" (if database is available)
- Frontend at http://localhost:3003 can connect to the API

## Current Status
- Server will now start even without database
- Sessions will work in-memory (without persistence)
- You can add database later when ready 