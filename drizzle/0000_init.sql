CREATE TABLE "ai_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"specialization" text NOT NULL,
	"answers" jsonb NOT NULL,
	"portfolio" jsonb,
	"profile" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"subtopic_id" text NOT NULL,
	"level_band" text NOT NULL,
	"variant" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"content" jsonb,
	"error" text,
	"attempts" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"specialization" text,
	"is_paid" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp with time zone,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"free_critiques_used" integer DEFAULT 0 NOT NULL,
	"email" text
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"specialization" text NOT NULL,
	"profile" jsonb NOT NULL,
	"overview" text NOT NULL,
	"weeks" jsonb NOT NULL,
	"source" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_estimates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"estimate" jsonb NOT NULL,
	"image_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"source" text NOT NULL,
	"scores" jsonb NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"subtopic_id" text NOT NULL,
	"task_id" text NOT NULL,
	"level_band" text NOT NULL,
	"image_ref" text,
	"sample_id" text,
	"status" text NOT NULL,
	"critique" jsonb,
	"overall_score" real,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subtopic_progress" (
	"session_id" uuid NOT NULL,
	"subtopic_id" text NOT NULL,
	"lesson_completed_at" timestamp with time zone,
	"practiced_at" timestamp with time zone,
	"best_score" real,
	CONSTRAINT "subtopic_progress_session_id_subtopic_id_pk" PRIMARY KEY("session_id","subtopic_id")
);
--> statement-breakpoint
CREATE TABLE "subtopics" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"skill" text NOT NULL,
	"difficulty" integer NOT NULL,
	"prerequisites" jsonb NOT NULL,
	"tracks" jsonb NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_session_id_guest_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."guest_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_content" ADD CONSTRAINT "generated_content_subtopic_id_subtopics_id_fk" FOREIGN KEY ("subtopic_id") REFERENCES "public"."subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_session_id_guest_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."guest_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_estimates" ADD CONSTRAINT "portfolio_estimates_session_id_guest_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."guest_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_snapshots" ADD CONSTRAINT "skill_snapshots_session_id_guest_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."guest_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_session_id_guest_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."guest_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_subtopic_id_subtopics_id_fk" FOREIGN KEY ("subtopic_id") REFERENCES "public"."subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtopic_progress" ADD CONSTRAINT "subtopic_progress_session_id_guest_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."guest_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtopic_progress" ADD CONSTRAINT "subtopic_progress_subtopic_id_subtopics_id_fk" FOREIGN KEY ("subtopic_id") REFERENCES "public"."subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtopics" ADD CONSTRAINT "subtopics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_calls_created_idx" ON "ai_calls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_calls_session_idx" ON "ai_calls" USING btree ("session_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "assessments_session_idx" ON "assessments" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "generated_content_key" ON "generated_content" USING btree ("kind","subtopic_id","level_band","variant");--> statement-breakpoint
CREATE INDEX "plans_session_idx" ON "plans" USING btree ("session_id","is_active");--> statement-breakpoint
CREATE INDEX "skill_snapshots_session_idx" ON "skill_snapshots" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "submissions_session_idx" ON "submissions" USING btree ("session_id","created_at");