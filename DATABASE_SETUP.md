# Database Setup Guide

This project now uses PostgreSQL with Prisma ORM for persistent session management, command history, and screenshot storage.

## Prerequisites

- Docker and Docker Compose (for local PostgreSQL)
- OR a PostgreSQL database instance

## Quick Start

### 1. Set up PostgreSQL

#### Option A: Using Docker (Recommended for local development)
```bash
# Start PostgreSQL container
docker-compose up -d

# Verify it's running
docker ps
```

#### Option B: Using existing PostgreSQL
Update your `.env.local` file with your database connection string:
```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
```

### 2. Set up the database schema

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view your data
npm run prisma:studio
```

## Features Implemented

### Session Management
- ✅ Persistent sessions stored in database
- ✅ Automatic session creation for sequence execution
- ✅ Session history with commands and screenshots
- ✅ Real-time status updates

### Command History
- ✅ All commands are persisted with execution details
- ✅ Command steps are tracked individually
- ✅ Success/failure status and execution time
- ✅ Error messages are stored for debugging

### Screenshot Management
- ✅ Screenshots are linked to sessions and commands
- ✅ Metadata includes page URL and capture time
- ✅ Screenshots persist across session restarts
- ✅ Available in session details view

### Sequence Execution
- ✅ Sequences can be executed without existing session
- ✅ New session is automatically created for each execution
- ✅ Execution history is tracked in database

## API Changes

### New Endpoint
- `POST /api/sequences/:name/execute` - Execute sequence with auto-session creation

### Enhanced Endpoints
- `GET /api/sessions/:id` - Now includes commands and screenshots
- `GET /api/sessions` - Shows all sessions from database

## Frontend Updates

### SequenceManager Component
- Execute button no longer requires active session
- Automatically creates new session for sequence execution
- Refreshes session list after execution

### InteractiveMode Component
- Displays previous commands when entering a session
- Shows all screenshots from session history
- Command history persists across page refreshes

## Database Schema

The database includes the following tables:
- `Session` - Browser sessions with status and metadata
- `Command` - Executed commands with results
- `CommandStep` - Individual steps within commands
- `Screenshot` - Screenshot files with metadata
- `Sequence` - Automation sequences (future migration)
- `SequenceExecution` - Execution history for sequences
- `Feedback` - User feedback for improving automation

## Troubleshooting

### Database Connection Issues
1. Ensure PostgreSQL is running: `docker ps`
2. Check `.env.local` has correct `DATABASE_URL`
3. Verify database exists: `docker exec -it ai-playwright-db psql -U postgres -c '\l'`

### Migration Issues
1. Reset database: `npm run prisma:migrate reset`
2. Regenerate client: `npm run prisma:generate`
3. Check migration status: `npx prisma migrate status`

## Next Steps

1. The system is now ready for persistent session management
2. All automation data is stored in PostgreSQL
3. Sessions and their data persist across server restarts
4. You can execute sequences directly from the UI without creating sessions first 