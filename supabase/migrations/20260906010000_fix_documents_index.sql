-- 20260906010000_fix_documents_index.sql
-- Fix the incorrect index on public.documents that referenced a non‑existent column uploaded_at.
-- We drop the faulty index (if it exists) and create a proper index on the created_at timestamp.

-- Drop the broken index (no error if it does not exist)
DROP INDEX IF EXISTS idx_documents_uploaded_at;

-- Create a new index on the created_at column for ordering documents by creation time.
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);
