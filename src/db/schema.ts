import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── USERS ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id:        uuid('id').primaryKey().defaultRandom(),
  email:     text('email').notNull().unique(),
  name:      text('name'),
  avatarUrl: text('avatar_url'),
  githubId:  text('github_id').unique(),
  gitlabId:  text('gitlab_id').unique(),
  plan:      text('plan').notNull().default('free'), // free | pro | enterprise
  stripeId:  text('stripe_id').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const usersRelations = relations(users, ({ many }) => ({
  orgMemberships:      many(orgMembers),
  projects:            many(projects),
  deployments:         many(deployments),
  githubInstallations: many(githubInstallations),
}))

// ─── GITHUB APP INSTALLATIONS ─────────────────────────────────────────────────

export const githubInstallations = pgTable('github_installations', {
  id:             uuid('id').primaryKey().defaultRandom(),
  userId:         uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  installationId: text('installation_id').notNull().unique(), // GitHub App installation ID
  accountLogin:   text('account_login').notNull(),            // org or user the app was installed on
  accountType:    text('account_type').notNull(),              // User | Organization
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const githubInstallationsRelations = relations(githubInstallations, ({ one }) => ({
  user: one(users, { fields: [githubInstallations.userId], references: [users.id] }),
}))

// ─── ORGANIZATIONS ────────────────────────────────────────────────────────────

export const organizations = pgTable('organizations', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      text('name').notNull(),
  slug:      text('slug').notNull().unique(),
  ownerId:   uuid('owner_id').notNull().references(() => users.id),
  plan:      text('plan').notNull().default('free'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner:   one(users, { fields: [organizations.ownerId], references: [users.id] }),
  members: many(orgMembers),
  projects: many(projects),
}))

// ─── ORG MEMBERS ─────────────────────────────────────────────────────────────

export const orgMembers = pgTable('org_members', {
  orgId:     uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:      text('role').notNull().default('member'), // owner | admin | member
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.orgId, t.userId] }),
}))

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  org:  one(organizations, { fields: [orgMembers.orgId], references: [organizations.id] }),
  user: one(users,         { fields: [orgMembers.userId], references: [users.id] }),
}))

// ─── PROJECTS ─────────────────────────────────────────────────────────────────

// A project is a pure grouping — a folder for related services. It doesn't
// own a repo: each service picks its own source, since one logical project
// often spans multiple repos (or none, for manually-configured services).
export const projects = pgTable('projects', {
  id:            uuid('id').primaryKey().defaultRandom(),
  name:          text('name').notNull(),
  slug:          text('slug').notNull(),
  ownerId:       uuid('owner_id').references(() => users.id),
  orgId:         uuid('org_id').references(() => organizations.id),
  region:        text('region').notNull().default('us-east-1'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  slugOrgUniq: uniqueIndex('projects_slug_org_idx').on(t.slug, t.orgId),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner:     one(users,         { fields: [projects.ownerId], references: [users.id] }),
  org:       one(organizations, { fields: [projects.orgId],   references: [organizations.id] }),
  services:  many(services),
  databases: many(databases),
}))

// ─── SERVICES ─────────────────────────────────────────────────────────────────

export const services = pgTable('services', {
  id:             uuid('id').primaryKey().defaultRandom(),
  projectId:      uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name:           text('name').notNull(),
  type:           text('type').notNull(), // web | worker | cron | static
  port:           integer('port'),
  cpu:            integer('cpu').notNull().default(256),    // Fargate vCPU units
  memory:         integer('memory').notNull().default(512), // MB
  minReplicas:    integer('min_replicas').notNull().default(1),
  maxReplicas:    integer('max_replicas').notNull().default(3),
  healthCheck:    text('health_check').default('/healthz'),
  dockerfilePath: text('dockerfile_path').default('Dockerfile'),
  // Source — each service picks its own repo, independent of its siblings
  repoUrl:       text('repo_url'),
  repoProvider:  text('repo_provider'), // github | gitlab | bitbucket
  defaultBranch: text('default_branch').notNull().default('main'),
  buildCommand:  text('build_command'),
  startCommand:  text('start_command'),
  outputDir:     text('output_dir'),
  runtime:       text('runtime'), // node | python | static | docker
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const servicesRelations = relations(services, ({ one, many }) => ({
  project:     one(projects, { fields: [services.projectId], references: [projects.id] }),
  deployments: many(deployments),
  envVars:     many(environmentVariables),
  domains:     many(domains),
  logStreams:  many(logStreams),
}))

// ─── DEPLOYMENTS ──────────────────────────────────────────────────────────────

export const deployments = pgTable('deployments', {
  id:            uuid('id').primaryKey().defaultRandom(),
  serviceId:     uuid('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  // queued | building | pushing | provisioning | live | failed | cancelled
  status:        text('status').notNull().default('queued'),
  commitSha:     text('commit_sha'),
  commitMessage: text('commit_message'),
  imageUri:      text('image_uri'),       // full ECR URI with tag
  tfWorkspaceId: text('tf_workspace_id'), // Terraform Cloud workspace ID
  tfRunId:       text('tf_run_id'),       // Terraform Cloud run ID
  errorMessage:  text('error_message'),
  deployUrl:     text('deploy_url'),
  triggeredBy:   uuid('triggered_by').references(() => users.id),
  startedAt:     timestamp('started_at',  { withTimezone: true }),
  finishedAt:    timestamp('finished_at', { withTimezone: true }),
  createdAt:     timestamp('created_at',  { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  serviceCreatedIdx: index('idx_deployments_service').on(t.serviceId, t.createdAt),
}))

export const deploymentsRelations = relations(deployments, ({ one, many }) => ({
  service:    one(services, { fields: [deployments.serviceId],   references: [services.id] }),
  triggeredBy: one(users,  { fields: [deployments.triggeredBy], references: [users.id] }),
  logStreams:  many(logStreams),
}))

// ─── ENVIRONMENT VARIABLES ────────────────────────────────────────────────────

export const environmentVariables = pgTable('environment_variables', {
  id:        uuid('id').primaryKey().defaultRandom(),
  serviceId: uuid('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  key:       text('key').notNull(),
  value:     text('value').notNull(), // AES-256-GCM encrypted at rest
  isSecret:  boolean('is_secret').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  serviceKeyUniq: uniqueIndex('env_vars_service_key_idx').on(t.serviceId, t.key),
}))

export const environmentVariablesRelations = relations(environmentVariables, ({ one }) => ({
  service: one(services, { fields: [environmentVariables.serviceId], references: [services.id] }),
}))

// ─── DOMAINS ──────────────────────────────────────────────────────────────────

export const domains = pgTable('domains', {
  id:         uuid('id').primaryKey().defaultRandom(),
  serviceId:  uuid('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  hostname:   text('hostname').notNull().unique(),
  isCustom:   boolean('is_custom').notNull().default(false),
  sslStatus:  text('ssl_status').default('pending'), // pending | issued | failed
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt:  timestamp('created_at',  { withTimezone: true }).notNull().defaultNow(),
})

export const domainsRelations = relations(domains, ({ one }) => ({
  service: one(services, { fields: [domains.serviceId], references: [services.id] }),
}))

// ─── DATABASES ────────────────────────────────────────────────────────────────

export const databases = pgTable('databases', {
  id:            uuid('id').primaryKey().defaultRandom(),
  projectId:     uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name:          text('name').notNull(),
  engine:        text('engine').notNull(), // postgres | mysql | redis
  version:       text('version').notNull(),
  status:        text('status').notNull().default('provisioning'),
  connectionUrl: text('connection_url'),    // encrypted
  awsResourceId: text('aws_resource_id'),  // RDS cluster ARN or ElastiCache ID
  storageGb:     integer('storage_gb').notNull().default(20),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const databasesRelations = relations(databases, ({ one }) => ({
  project: one(projects, { fields: [databases.projectId], references: [projects.id] }),
}))

// ─── LOG STREAMS ──────────────────────────────────────────────────────────────

export const logStreams = pgTable('log_streams', {
  id:           uuid('id').primaryKey().defaultRandom(),
  deploymentId: uuid('deployment_id').references(() => deployments.id, { onDelete: 'cascade' }),
  serviceId:    uuid('service_id').references(() => services.id, { onDelete: 'cascade' }),
  streamType:   text('stream_type').notNull(), // build | deploy | runtime
  provider:     text('provider').notNull(),    // cloudwatch | loki
  streamName:   text('stream_name').notNull(),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const logStreamsRelations = relations(logStreams, ({ one }) => ({
  deployment: one(deployments, { fields: [logStreams.deploymentId], references: [deployments.id] }),
  service:    one(services,    { fields: [logStreams.serviceId],    references: [services.id] }),
}))

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type User         = typeof users.$inferSelect
export type NewUser      = typeof users.$inferInsert
export type Organization = typeof organizations.$inferSelect
export type NewOrg       = typeof organizations.$inferInsert
export type Project      = typeof projects.$inferSelect
export type NewProject   = typeof projects.$inferInsert
export type Service      = typeof services.$inferSelect
export type NewService   = typeof services.$inferInsert
export type Deployment   = typeof deployments.$inferSelect
export type NewDeployment = typeof deployments.$inferInsert
export type EnvVar       = typeof environmentVariables.$inferSelect
export type NewEnvVar    = typeof environmentVariables.$inferInsert
export type Domain       = typeof domains.$inferSelect
export type Database     = typeof databases.$inferSelect
export type LogStream    = typeof logStreams.$inferSelect
export type GithubInstallation    = typeof githubInstallations.$inferSelect
export type NewGithubInstallation = typeof githubInstallations.$inferInsert
