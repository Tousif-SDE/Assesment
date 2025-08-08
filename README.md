# Live Coding Classroom

A real-time collaborative coding platform for teachers and students. Teachers can create virtual classrooms, share code in real-time, create test cases, and evaluate student submissions. Students can join rooms, view teacher's code, solve test cases, and submit solutions.

## Features

### For Teachers
- Create virtual classrooms with unique room codes
- Share code in real-time with students
- Create test cases for students to solve
- View student submissions and progress

### For Students
- Join classrooms using room codes
- View teacher's code in real-time
- Solve test cases
- Submit solutions for evaluation

## Tech Stack

### Frontend
- React.js with Vite
- Redux Toolkit for state management
- RTK Query for API calls
- Socket.IO Client for real-time communication
- Monaco Editor for code editing
- React Bootstrap for UI components
- React Router for navigation

### Backend
- Node.js with Express
- Prisma ORM with PostgreSQL
- Redis for caching
- Socket.IO for real-time communication
- JWT for authentication
- Judge0 API for code execution

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- PostgreSQL
- Redis

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/live-coding-classroom.git
cd live-coding-classroom
```

2. Install dependencies for both client and server
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

3. Set up environment variables
   - Create a `.env` file in the server directory with the following variables:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/live_coding_classroom"
   JWT_SECRET="your_jwt_secret"
   PORT=5000
   REDIS_URL="redis://localhost:6379"
   JUDGE0_API_URL="https://judge0-ce.p.rapidapi.com"
   JUDGE0_API_KEY="your_judge0_api_key"
   ```

4. Set up the database
```bash
cd server
npx prisma migrate dev
```

5. Start the development servers
```bash
# Start the server (in server directory)
npm start

# Start the client (in client directory)
npm run dev
```

6. Open your browser and navigate to `http://localhost:5173`

## Usage

### Teacher Flow
1. Register as a teacher
2. Create a new classroom
3. Share the room code with students
4. Enter the room and start coding
5. Create test cases for students

### Student Flow
1. Register as a student
2. Join a classroom using the room code
3. View the teacher's code in real-time
4. Select a test case to solve
5. Submit your solution

## License

This project is licensed under the MIT License - see the LICENSE file for details.