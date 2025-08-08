#!/bin/bash

echo "Starting Live Coding Classroom Application..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js and try again."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "npm is not installed. Please install npm and try again."
    exit 1
fi

# Install concurrently if not already installed
if [ ! -d "node_modules/concurrently" ]; then
    echo "Installing concurrently..."
    npm install
fi

# Start the application
echo "Starting server and client..."
npm start