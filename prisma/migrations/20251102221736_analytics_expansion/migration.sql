-- CreateTable
CREATE TABLE "MultiAgentConfig" (
    "id" SERIAL NOT NULL,
    "agentKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "maxRetries" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MultiAgentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rootPath" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectState" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelemetryEvent" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "payload" JSONB NOT NULL,
    "correlationId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelemetryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborationSession" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "CollaborationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborationParticipant" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "color" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'editor',

    CONSTRAINT "CollaborationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertSubscription" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER,
    "channel" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnomalyEvent" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "payload" JSONB NOT NULL,
    "correlationId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnomalyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityScoreObservation" (
    "id" SERIAL NOT NULL,
    "agentStage" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "drivers" JSONB NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityScoreObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPerformanceMetric" (
    "id" SERIAL NOT NULL,
    "agentStage" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "tasksProcessed" INTEGER NOT NULL,
    "avgLatencyMs" INTEGER NOT NULL,
    "successRate" DOUBLE PRECISION NOT NULL,
    "fallbackRate" DOUBLE PRECISION NOT NULL,
    "humanHandOffRate" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPerformanceMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEngagementMetric" (
    "id" SERIAL NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "activeUsers" INTEGER NOT NULL,
    "collaborationSessions" INTEGER NOT NULL,
    "avgSessionDurationSec" INTEGER NOT NULL,
    "featureUsage" JSONB NOT NULL,
    "retentionCohorts" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEngagementMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryAnalyticsMetric" (
    "id" SERIAL NOT NULL,
    "repository" TEXT NOT NULL,
    "branch" TEXT,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "commitVelocity" INTEGER NOT NULL,
    "refactorHotspots" JSONB NOT NULL,
    "coverageDrift" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepositoryAnalyticsMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsAnomalyEvent" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsAnomalyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MultiAgentConfig_agentKey_key" ON "MultiAgentConfig"("agentKey");

-- CreateIndex
CREATE UNIQUE INDEX "Project_externalId_key" ON "Project"("externalId");

-- CreateIndex
CREATE INDEX "ProjectState_projectId_userId_idx" ON "ProjectState"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TelemetryEvent_correlationId_key" ON "TelemetryEvent"("correlationId");

-- CreateIndex
CREATE INDEX "TelemetryEvent_projectId_idx" ON "TelemetryEvent"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CollaborationSession_sessionId_key" ON "CollaborationSession"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CollaborationParticipant_sessionId_userId_key" ON "CollaborationParticipant"("sessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AnomalyEvent_correlationId_key" ON "AnomalyEvent"("correlationId");

-- CreateIndex
CREATE INDEX "AnomalyEvent_projectId_idx" ON "AnomalyEvent"("projectId");

-- CreateIndex
CREATE INDEX "QualityScoreObservation_agentStage_occurredAt_idx" ON "QualityScoreObservation"("agentStage", "occurredAt");

-- CreateIndex
CREATE INDEX "AgentPerformanceMetric_agentStage_windowStart_windowEnd_idx" ON "AgentPerformanceMetric"("agentStage", "windowStart", "windowEnd");

-- CreateIndex
CREATE INDEX "UserEngagementMetric_windowStart_windowEnd_idx" ON "UserEngagementMetric"("windowStart", "windowEnd");

-- CreateIndex
CREATE INDEX "RepositoryAnalyticsMetric_repository_branch_windowStart_win_idx" ON "RepositoryAnalyticsMetric"("repository", "branch", "windowStart", "windowEnd");

-- CreateIndex
CREATE INDEX "AnalyticsAnomalyEvent_source_severity_occurredAt_idx" ON "AnalyticsAnomalyEvent"("source", "severity", "occurredAt");

-- AddForeignKey
ALTER TABLE "ProjectState" ADD CONSTRAINT "ProjectState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetryEvent" ADD CONSTRAINT "TelemetryEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborationSession" ADD CONSTRAINT "CollaborationSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborationParticipant" ADD CONSTRAINT "CollaborationParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CollaborationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertSubscription" ADD CONSTRAINT "AlertSubscription_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalyEvent" ADD CONSTRAINT "AnomalyEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
