#!/bin/bash

# Create data directory structure for Phase 2 persistence
# Run this from the backend directory

echo "Setting up Phase 2 data persistence directories..."

# Create data directory if it doesn't exist
mkdir -p backend/data

# Create empty filters.json file if it doesn't exist
if [ ! -f backend/data/filters.json ]; then
    echo "{}" > backend/data/filters.json
    echo "Created filters.json file"
fi

# Set appropriate permissions
chmod 755 backend/data
chmod 644 backend/data/filters.json

# Add data directory to .gitignore if not already there
if [ -f backend/.gitignore ]; then
    if ! grep -q "data/" backend/.gitignore; then
        echo "data/" >> backend/.gitignore
        echo "Added data/ to .gitignore"
    fi
else
    echo "data/" > backend/.gitignore
    echo "Created .gitignore with data/ entry"
fi

echo "Setup complete! Data directory structure created."
echo "Location: backend/data/"
echo "Filters will be persisted in: backend/data/filters.json"