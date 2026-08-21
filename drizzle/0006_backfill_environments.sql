-- Seed Production/Dev/QA environments for every existing project, then
-- backfill environment_variables/deployments to point at each project's
-- Production environment before enforcing NOT NULL.

INSERT INTO environments (id, project_id, name, slug, is_default)
SELECT gen_random_uuid(), id, 'Production', 'production', true FROM projects
UNION ALL
SELECT gen_random_uuid(), id, 'Dev', 'dev', false FROM projects
UNION ALL
SELECT gen_random_uuid(), id, 'QA', 'qa', false FROM projects;
--> statement-breakpoint

UPDATE environment_variables ev SET environment_id = (
  SELECT e.id FROM environments e
  JOIN services s ON s.project_id = e.project_id
  WHERE s.id = ev.service_id AND e.is_default = true
);
--> statement-breakpoint

UPDATE deployments d SET environment_id = (
  SELECT e.id FROM environments e
  JOIN services s ON s.project_id = e.project_id
  WHERE s.id = d.service_id AND e.is_default = true
);
--> statement-breakpoint

ALTER TABLE environment_variables ALTER COLUMN environment_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE deployments ALTER COLUMN environment_id SET NOT NULL;
