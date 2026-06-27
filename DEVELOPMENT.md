# Mongez Developer Guide

## Project Architecture

Mongez is a modern agentic AI operating system composed of four main layers:

### 1. External Infrastructure Services (Docker)
- **Database**: PostgreSQL (v15) - scopes user accounts, boards, tasks, and historical records.
- **Cache / Message Broker**: Redis (v7) - caching, pub/sub notifications, and LLM rate limit controls.
- **Vector DB / Semantic Search**: Qdrant - semantic search for task logs, meetings transcript chunks, and decisions.

### 2. AI LangGraph Service (`/ai-service`)
- **Framework**: Python 3.11+ with FastAPI & LangGraph
- **Key Files**:
  - `app/main.py`: Entry point for FastAPI endpoints.
  - `app/agents/graph.py`: LangGraph state machine routing.
  - `app/agents/scheduler.py`: Dependency-aware tool execution scheduler.
  - `app/agents/tools/schemas.py`: Pydantic input schemas and ToolResult contracts.

### 3. Backend APIs (`/backend/mongez`)
- **Framework**: NestJS (Node.js)
- **Database Access**: PostgreSQL with Prisma ORM
- **Key Directories**:
  - `src/app.module.ts`: Root module of the application.
  - `src/modules/`: Feature-specific modules (AI, Auth, Users, Tasks, Workflow approvals, messaging).
  - `prisma/`: Database schema definitions.

### 4. Frontend Client (`/frontend`)
- **Framework**: React with Vite
- **Styling**: Tailwind CSS
- **Key Directories**:
  - `src/pages/aiChat/`: AI assistant chat interface (supporting Markdown rendering, JSON fallback recovery, and RTL layout flow).
  - `src/hooks/`: React Query custom hooks for AI backend integrations.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.11+)
- Docker & Docker Compose
- PostgreSQL (optional, if running bare-metal)

### Installation

1. **Docker Services**:
   Make sure Docker is running on your machine.

2. **AI Service**:
   ```bash
   cd ai-service
   python -m venv .venv
   # Windows:
   .venv\Scripts\pip install -e .[dev]
   # Linux/macOS:
   # .venv/bin/pip install -e .[dev]
   ```

3. **Backend**:
   ```bash
   cd backend/mongez
   npm install
   npx prisma generate
   ```

4. **Frontend**:
   ```bash
   cd frontend
   npm install
   ```

---

## Running the Whole Application

Follow these steps in separate terminal tabs to run the complete environment locally:

### Step 1: Start Databases & Infrastructure (Docker)
Spins up PostgreSQL, Redis, and Qdrant containers:
```bash
cd docker
docker compose up postgres redis qdrant -d
```

### Step 2: Start the AI Service (Python)
Ensure you have created your `.env` file in `/ai-service` (copy `.env.example`) and populated your `GROQ_API_KEY`:
```bash
cd ai-service
# Windows:
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
# Linux/macOS:
# .venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

### Step 3: Run Database Migrations & Start NestJS Backend
Generate/deploy schemas and start the server:
```bash
cd backend/mongez
# Deploy database migrations:
npx prisma migrate dev
# Start backend service (running on port 3000):
npm run start:dev
```

### Step 4: Start React Frontend Client
Run Vite local development server:
```bash
cd frontend
# Start client UI (running on port 5173):
npm run dev
```

---

## Where to Start Implementing?

### Adding a New Feature
1. **Database**: Define your models in `backend/mongez/prisma/schema.prisma`.
2. **Backend Module**: Create a new folder in `backend/mongez/src/modules/` using Nest CLI:
   ```bash
   nest generate module modules/your-feature
   nest generate controller modules/your-feature
   nest generate service modules/your-feature
   ```
3. **Frontend Feature**: Create a new folder in `frontend/src/features/your-feature/`.
   - Put logic, hooks, and specific components there.
4. **UI/Routes**: Register new pages in `frontend/src/pages/` and add routes in `frontend/src/app/router.tsx`.

### Common Patterns
- **Database access**: Use the `PrismaService` found in `infrastructure/database`.
- **API Calls**: Use the pre-configured Axios instance in `frontend/src/lib/axios.ts`.
- **State Management**: Check `frontend/src/store/` for global state patterns (likely Zustand or similar).

---

## Git & GitHub Workflow

To maintain a clean codebase and avoid conflicts, follow these principles:

### 1. Branching Strategy
- **Never commit directly to `main`.**
- Always create a new branch for your feature or fix:
  ```bash
  git checkout -b feature/your-feature-name
  ```

### 2. Standard Workflow
1. **Sync**: Pull the latest changes from `main` before starting:
   ```bash
   git checkout main
   git pull origin main
   ```
2. **Code**: Work on your feature branch.
3. **Stage**: Add your changes. **Crucial**: Use `git status` to check for untracked files!
   ```bash
   git add .
   ```
4. **Commit**: Use descriptive commit messages:
   ```bash
   git commit -m "feat: add user authentication module"
   ```
5. **Push**: Push your branch to GitHub:
   ```bash
   git push origin feature/your-feature-name
   ```

### 3. Pull Requests (PRs)
- Once pushed, go to GitHub and create a **Pull Request**.
- Request a review from at least one teammate.
- Once approved and tests pass, merge the PR into `main`.

### 4. Avoiding "Untracked" Files
Before every commit, run:
```bash
git status
```
If you see files under "Untracked files", they are NOT included in your commit. Always `git add <file>` or `git add .` to include them.
