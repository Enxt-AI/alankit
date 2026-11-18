-- Allow one Branch Manager email to be shared by several branches.
-- The non-unique "Branch_email_idx" index is kept for login lookups.
DROP INDEX IF EXISTS "Branch_email_key";

