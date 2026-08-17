ALTER TABLE "projects" ADD COLUMN "is_private" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;