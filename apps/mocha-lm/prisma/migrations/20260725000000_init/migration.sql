-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'STREAMING', 'COMPLETE', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('PDF', 'SRT', 'WEB');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'FAILED', 'DELETING');

-- CreateEnum
CREATE TYPE "SourceStage" AS ENUM ('QUEUED', 'FETCHING', 'EXTRACTING', 'CHUNKING', 'EMBEDDING', 'INDEXING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notebook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled notebook',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastOpenedAt" TIMESTAMP(3),

    CONSTRAINT "Notebook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "model" TEXT,
    "systemPrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3),

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'COMPLETE',
    "content" TEXT,
    "parts" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "originalUrl" TEXT,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "checksum" TEXT,
    "storageKey" TEXT,
    "extractedKey" TEXT,
    "status" "SourceStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" "SourceStage" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "jobId" TEXT,
    "indexVersion" INTEGER NOT NULL DEFAULT 1,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "chunkCount" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "indexedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Notebook_userId_updatedAt_idx" ON "Notebook"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Notebook_userId_lastOpenedAt_idx" ON "Notebook"("userId", "lastOpenedAt" DESC);

-- CreateIndex
CREATE INDEX "Conversation_notebookId_lastMessageAt_idx" ON "Conversation"("notebookId", "lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "Conversation_userId_lastMessageAt_idx" ON "Conversation"("userId", "lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Source_notebookId_createdAt_idx" ON "Source"("notebookId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Source_notebookId_status_idx" ON "Source"("notebookId", "status");

-- CreateIndex
CREATE INDEX "Source_userId_idx" ON "Source"("userId");

-- CreateIndex
CREATE INDEX "Source_jobId_idx" ON "Source"("jobId");

-- CreateIndex
CREATE INDEX "Source_checksum_idx" ON "Source"("checksum");

-- AddForeignKey
ALTER TABLE "Notebook" ADD CONSTRAINT "Notebook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
