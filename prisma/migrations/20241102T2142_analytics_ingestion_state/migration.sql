
-- CreateTable
CREATE TABLE "AnalyticsIngestionState" (
    "id" SERIAL NOT NULL,
    "pipeline" TEXT NOT NULL,
    "lastProcessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsIngestionState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsIngestionState_pipeline_key" ON "AnalyticsIngestionState"("pipeline");

