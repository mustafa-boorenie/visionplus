#!/bin/bash

# Setup development environment

echo "🚀 Setting up development environment..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOL
# OpenAI Configuration
OPENAI_API_KEY=${OPENAI_API_KEY:-your_openai_api_key_here}

# Database Configuration (using SQLite for development)
DATABASE_URL="file:./dev.db"

# Server Configuration
PORT=3002
NODE_ENV=development

# Browser Configuration
HEADLESS_MODE=true
DEFAULT_TIMEOUT=30000
NAVIGATION_TIMEOUT=60000

# Logging
LOG_LEVEL=info
EOL
    echo "✅ .env file created"
else
    echo "ℹ️  .env file already exists"
fi

# Update Prisma schema to use SQLite for development
echo "📝 Updating Prisma schema for SQLite..."
sed -i.bak 's/provider = "postgresql"/provider = "sqlite"/' prisma/schema.prisma

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run migrations
echo "🗄️  Running database migrations..."
npx prisma migrate dev --name init

echo "✅ Development environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Make sure Docker is running"
echo "2. Start the server: npm run dev"
echo "3. Test the Docker sessions: npx tsx test-docker-session.ts" 