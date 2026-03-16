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

## Developer Notes (Prisma 7)
We are using Prisma 7. Note that the database `url` is managed via `backend/mongez/prisma.config.ts`, not directly in the `.prisma` file.
