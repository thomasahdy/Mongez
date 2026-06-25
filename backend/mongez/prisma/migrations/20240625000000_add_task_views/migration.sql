-- CreateTaskView
-- Migration: add_task_views
-- Description: Add task_views table for task read receipts tracking

-- Create the task_views table
CREATE TABLE "task_views" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,

    PRIMARY KEY ("taskId", "userId")
);

-- Create index on userId for efficient user-centric queries
CREATE INDEX "task_views_userId_idx" ON "task_views"("userId");
