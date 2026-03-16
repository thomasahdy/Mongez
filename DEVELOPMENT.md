# Mongez Developer Guide

## Project Architecture

Mongez is a full-stack application composed of two main parts:

### 1. Backend (`/backend/mongez`)
- **Framework**: [NestJS](https://nestjs.com/) (Node.js)
- **Database**: PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Key Directories**:
  - `src/app.module.ts`: Root module of the application.
  - `src/modules/`: Feature-specific modules (AI, Auth, Users, Tasks, etc.).
  - `src/infrastructure/`: Infrastructure concerns like database services.
  - `prisma/`: Database schema definitions.

### 2. Frontend (`/frontend`)
- **Framework**: [React](https://reactjs.org/) with [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Key Directories**:
  - `src/app/`: Core application setup, routing, and providers.
  - `src/features/`: Feature-based decomposition (modular logic).
  - `src/components/`: Shared UI components.
  - `src/lib/`: External library configurations (e.g., Axios).

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL (for backend)

### Installation

1.  **Backend**:
    ```bash
    cd backend/mongez
    npm install
    npx prisma generate
    ```

2.  **Frontend**:
    ```bash
    cd frontend
    npm install
    ```

### Running the App

- **Backend**: `npm start` (or `npm run start:dev` for watch mode)
- **Frontend**: `npm run dev`

---

## Where to Start Implementing?

### Adding a New Feature
1.  **Database**: Defined your models in `backend/mongez/prisma/schema.prisma`.
2.  **Backend Module**: Create a new folder in `backend/mongez/src/modules/` using Nest CLI:
    ```bash
    nest generate module modules/your-feature
    nest generate controller modules/your-feature
    nest generate service modules/your-feature
    ```
3.  **Frontend Feature**: Create a new folder in `frontend/src/features/your-feature/`.
    - Put logic, hooks, and specific components there.
4.  **UI/Routes**: Register new pages in `frontend/src/pages/` and add routes in `frontend/src/app/router.tsx`.

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
1.  **Sync**: Pull the latest changes from `main` before starting:
    ```bash
    git checkout main
    git pull origin main
    ```
2.  **Code**: Work on your feature branch.
3.  **Stage**: Add your changes. **Crucial**: Use `git status` to check for untracked files!
    ```bash
    git add .
    ```
4.  **Commit**: Use descriptive commit messages:
    ```bash
    git commit -m "feat: add user authentication module"
    ```
5.  **Push**: Push your branch to GitHub:
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


