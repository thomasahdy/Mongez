-- CreateEnum
CREATE TYPE "CalendarType" AS ENUM ('GREGORIAN', 'HIJRI');

-- CreateEnum
CREATE TYPE "CalendarEventSource" AS ENUM ('MONGEZ', 'GOOGLE', 'HOLIDAY', 'MEETING', 'APPROVAL', 'ESCALATION');

-- CreateEnum
CREATE TYPE "CalendarEventVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'TEAM');

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "calendarType" TEXT NOT NULL DEFAULT 'GREGORIAN',
ADD COLUMN     "holidayCountry" TEXT NOT NULL DEFAULT 'EG';

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "calendarType" "CalendarType" NOT NULL DEFAULT 'GREGORIAN',
    "hijriDate" TEXT,
    "source" "CalendarEventSource" NOT NULL DEFAULT 'MONGEZ',
    "visibility" "CalendarEventVisibility" NOT NULL DEFAULT 'PUBLIC',
    "googleEventId" TEXT,
    "color" TEXT,
    "location" TEXT,
    "recurrence" JSONB,
    "reminders" JSONB,
    "metadata" JSONB,
    "taskId" TEXT,
    "isTaskGenerated" BOOLEAN NOT NULL DEFAULT false,
    "entityType" TEXT,
    "entityId" TEXT,
    "createdById" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_participants" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_calendar_syncs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "syncToken" TEXT,
    "channelId" TEXT,
    "resourceId" TEXT,
    "channelExpiry" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_calendar_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_cache" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "holidays" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holiday_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "audioUrl" TEXT,
    "transcriptUrl" TEXT,
    "summary" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposed_tasks" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposed_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_events_spaceId_startDate_endDate_idx" ON "calendar_events"("spaceId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "calendar_events_googleEventId_idx" ON "calendar_events"("googleEventId");

-- CreateIndex
CREATE INDEX "calendar_events_taskId_idx" ON "calendar_events"("taskId");

-- CreateIndex
CREATE INDEX "calendar_events_source_idx" ON "calendar_events"("source");

-- CreateIndex
CREATE INDEX "calendar_events_createdById_idx" ON "calendar_events"("createdById");

-- CreateIndex
CREATE INDEX "calendar_events_visibility_idx" ON "calendar_events"("visibility");

-- CreateIndex
CREATE INDEX "calendar_events_entityType_entityId_idx" ON "calendar_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "calendar_event_participants_userId_idx" ON "calendar_event_participants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_participants_eventId_email_key" ON "calendar_event_participants"("eventId", "email");

-- CreateIndex
CREATE INDEX "google_calendar_syncs_channelId_idx" ON "google_calendar_syncs"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "google_calendar_syncs_userId_spaceId_calendarId_key" ON "google_calendar_syncs"("userId", "spaceId", "calendarId");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_cache_country_year_key" ON "holiday_cache"("country", "year");

-- CreateIndex
CREATE INDEX "meetings_spaceId_idx" ON "meetings"("spaceId");

-- CreateIndex
CREATE INDEX "proposed_tasks_meetingId_idx" ON "proposed_tasks"("meetingId");

-- CreateIndex
CREATE INDEX "proposed_tasks_spaceId_idx" ON "proposed_tasks"("spaceId");

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_participants" ADD CONSTRAINT "calendar_event_participants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_participants" ADD CONSTRAINT "calendar_event_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_calendar_syncs" ADD CONSTRAINT "google_calendar_syncs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposed_tasks" ADD CONSTRAINT "proposed_tasks_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
