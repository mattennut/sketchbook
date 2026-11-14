-- Row-level security ON with no policies: blocks Supabase's auto-generated Data API
-- (anon / authenticated roles) from every table. The app connects directly as the
-- database owner, which bypasses RLS, so app behaviour is unchanged. Harmless on
-- Neon and the local PGlite database.
ALTER TABLE "guest_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assessments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "portfolio_estimates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "skill_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "topics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subtopics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "generated_content" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subtopic_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_calls" ENABLE ROW LEVEL SECURITY;
