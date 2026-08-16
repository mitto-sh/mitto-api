ALTER TABLE "services" ADD COLUMN "repo_url" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "repo_provider" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "default_branch" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "build_command" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "start_command" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "output_dir" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "runtime" text;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "repo_url";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "repo_provider";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "default_branch";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "build_command";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "output_dir";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "runtime";