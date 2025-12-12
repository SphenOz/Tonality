#!/bin/bash
# Backend Setup and Run Script for Tonality

set -e  # Exit on error

echo "🎵 Tonality Backend Setup"
echo "========================"

# Check Python version
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed"
    exit 1
fi

echo "✅ Python found: $(python3 --version)"

# Check MySQL
if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL is required but not installed"
    echo "Install MySQL: brew install mysql (macOS) or apt-get install mysql-server (Linux)"
    exit 1
fi

echo "✅ MySQL found: $(mysql --version)"

# Install Python dependencies
echo ""
echo "📦 Installing Python dependencies..."
pip3 install -r requirements.txt

# Check for .env file
if [ ! -f "backendScripts/.env" ]; then
    echo ""
    echo "⚠️  No .env file found in backendScripts/"
    echo "Creating from .env.example..."
    if [ -f "backendScripts/.env.example" ]; then
        cp backendScripts/.env.example backendScripts/.env
        echo "✅ Created .env file - please update with your credentials"
    else
        echo "❌ No .env.example found"
    fi
fi

# Setup database
echo ""
echo "🗄️  Setting up database..."
read -p "Enter MySQL username [root]: " db_user
db_user=${db_user:-root}

read -sp "Enter MySQL password: " db_pass
echo ""

read -p "Enter database name [tonality]: " db_name
db_name=${db_name:-tonality}

# Create database if it doesn't exist
mysql -u "$db_user" -p"$db_pass" -e "CREATE DATABASE IF NOT EXISTS $db_name;" 2>/dev/null && echo "✅ Database '$db_name' ready" || echo "❌ Failed to create database"

# Update .env with database URL
db_url="mysql+pymysql://$db_user:$db_pass@localhost:3306/$db_name"
if [ -f "backendScripts/.env" ]; then
    if grep -q "DATABASE_URL=" backendScripts/.env; then
        sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=$db_url|" backendScripts/.env
        rm backendScripts/.env.bak 2>/dev/null || true
    else
        echo "DATABASE_URL=$db_url" >> backendScripts/.env
    fi
    echo "✅ Updated DATABASE_URL in .env"
fi

# Run database migrations and seed
echo ""
echo "🌱 Seeding database with sample data..."
python3 -m backendScripts.seed_data

echo ""
echo "✅ Backend setup complete!"
echo ""
echo "🚀 To start the backend server, run:"
echo "   uvicorn backendScripts.main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "📱 Make sure to update Tonality/.env with:"
echo "   EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:8000"
