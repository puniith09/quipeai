# PostgreSQL + Prisma Setup Guide

This branch (`feat/postgres-prisma`) replaces the in-memory user store with a production-ready PostgreSQL database using Prisma ORM.

## What Changed

### Before (in-memory):
```typescript
// Lost on server restart
const users = new Map();
```

### After (PostgreSQL):
```typescript
// Persistent, scalable, production-ready
const user = await prisma.user.create({ data: { ... } });
```

## Setup Instructions

### 1. Install PostgreSQL

**Option A: Local PostgreSQL (Development)**
```bash
# macOS (Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database
createdb quipeai
```

**Option B: Use Docker (Easiest for local dev)**
```bash
docker run --name quipeai-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=quipeai \
  -p 5432:5432 \
  -d postgres:15

# Check it's running
docker ps
```

**Option C: Managed Services (Production)**
- **Supabase**: Free tier, great DX → https://supabase.com
- **Neon**: Serverless Postgres → https://neon.tech
- **Railway**: Simple deployment → https://railway.app
- **AWS RDS**: Enterprise-grade → https://aws.amazon.com/rds/

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Update `DATABASE_URL` in `.env`:
```bash
# Local Postgres
DATABASE_URL="postgresql://postgres:password@localhost:5432/quipeai"

# Or use your managed service connection string
# Example (Supabase):
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
```

### 3. Run Database Migration

Create the users table:
```bash
npx prisma migrate dev --name init
```

This will:
- ✅ Create `prisma/migrations/` folder with SQL migration
- ✅ Apply schema to your database
- ✅ Generate Prisma Client types

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. View Your Database (Optional)

Prisma Studio provides a GUI to browse your data:
```bash
npx prisma studio
```

Opens at http://localhost:5555

## Database Schema

```prisma
model User {
  id            String   @id @default(cuid())
  phoneNumber   String   @unique
  sessionCount  Int      @default(0)
  lastLogin     DateTime @default(now())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([phoneNumber])
  @@index([lastLogin])
  @@map("users")
}
```

## New Features

### User Analytics
```typescript
import { getUserCount, getActiveUsers } from '@/lib/auth/user-store';

// Total registered users
const total = await getUserCount();

// Active users in last 7 days
const active = await getActiveUsers(7);
```

### Query Users
```typescript
// Find by phone
const user = await getUserByPhone('+1234567890');

// Get all users
const users = await getAllUsers();
```

## Migration from In-Memory Store

The API signatures remain the same, so your existing code (verify-OTP endpoint, auth context) works without changes:

```typescript
// Still works exactly the same way
const user = await createOrUpdateUser(userId, phoneNumber, verificationId);
```

**Difference**: Data now persists across restarts! 🎉

## Deployment Checklist

- [ ] Set `DATABASE_URL` in production environment variables
- [ ] Run `npx prisma migrate deploy` in CI/CD pipeline
- [ ] Use connection pooling (PgBouncer or `?pgbouncer=true` in connection string)
- [ ] Set up database backups
- [ ] Monitor database metrics (connections, query time, cache hit rate)
- [ ] Consider read replicas for high traffic

## Troubleshooting

**Error: Can't reach database server**
```bash
# Check Postgres is running
pg_isready -h localhost -p 5432

# Or for Docker:
docker logs quipeai-postgres
```

**Error: Invalid `prisma.user.xxx()` invocation**
```bash
# Regenerate Prisma Client
npx prisma generate
```

**Reset database (⚠️ deletes all data)**
```bash
npx prisma migrate reset
```

## Production Optimization

### Connection Pooling
```bash
# Add to DATABASE_URL
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20"
```

### Prisma Accelerate (Global caching)
```bash
npm install @prisma/extension-accelerate
```

See: https://www.prisma.io/docs/accelerate

## Next Steps

1. ✅ Test auth flow with persistent database
2. Move auth tokens from localStorage to secure HttpOnly cookies
3. Add rate limiting with Redis
4. Implement refresh token rotation
5. Set up automated backups

---

**Questions?** Check Prisma docs: https://www.prisma.io/docs
