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

export const users = pgTable('users', {
  id:        uuid('id').primaryKey().defaultRandom(),
  email:     text('email').notNull().unique(),
  name:      text('name'),
  avatarUrl: text('avatar_url'),
  githubId:  text('github_id').unique(),
  gitlabId:  text('gitlab_id').unique(),
  plan:      text('plan').notNull().default('free'),
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

export const githubInstallations = pgTable('github_installations', {
  id:             uuid('id').primaryKey().defaultRandom(),
  userId:         uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  installationId: text('installation_id').notNull().unique(),
  accountLogin:   text('account_login').notNull(),
  accountType:    text('account_type').notNull(),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const githubInstallationsRelations = relations(githubInstallations, ({ one }) => ({
  user: one(users, { fields: [githubInstallations.userId], references: [users.id] }),
}))

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

export const orgMembers = pgTable('org_members', {
  orgId:     uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:      text('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.orgId, t.userId] }),
}))

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  org:  one(organizations, { fields: [orgMembers.orgId], references: [organizations.id] }),
  user: one(users,         { fields: [orgMembers.userId], references: [users.id] }),
}))

export const projects = pgTable('projects', {
  id:            uuid('id').primaryKey().defaultRandom(),
  name:          text('name').notNull(),
  slug:          text('slug').notNull(),
  ownerId:       uuid('owner_id').references(() => users.id),
  orgId:         uuid('org_id').references(() => organizations.id),
  region:        text('region').notNull().default('us-east-1'),
  isPrivate:     boolean('is_private').notNull().default(true),
  enabled:       boolean('enabled').notNull().default(true),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  slugOrgUniq: uniqueIndex('projects_slug_org_idx').on(t.slug, t.orgId),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner:        one(users,         { fields: [projects.ownerId], references: [users.id] }),
  org:          one(organizations, { fields: [projects.orgId],   references: [organizations.id] }),
  services:     many(services),
  databases:    many(databases),
  environments: many(environments),
}))

export const services = pgTable('services', {
  id:             uuid('id').primaryKey().defaultRandom(),
  projectId:      uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name:           text('name').notNull(),
  type:           text('type').notNull(),
  port:           integer('port'),
  cpu:            integer('cpu').notNull().default(256),
  memory:         integer('memory').notNull().default(512),
  minReplicas:    integer('min_replicas').notNull().default(1),
  maxReplicas:    integer('max_replicas').notNull().default(3),
  healthCheck:    text('health_check').default('/healthz'),
  dockerfilePath: text('dockerfile_path').default('Dockerfile'),
  enabled:        boolean('enabled').notNull().default(true),
  repoUrl:       text('repo_url'),
  repoProvider:  text('repo_provider'),
  defaultBranch: text('default_branch').notNull().default('main'),
  buildCommand:  text('build_command'),
  startCommand:  text('start_command'),
  outputDir:     text('output_dir'),
  runtime:       text('runtime'),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const servicesRelations = relations(services, ({ one, many }) => ({
  project:     one(projects, { fields: [services.projectId], references: [projects.id] }),
  deployments: many(deployments),
  envVars:     many(environmentVariables),
  domains:     many(domains),
  logStreams:  many(logStreams),
}))

export const environments = pgTable('environments', {
  id:        uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  slug:      text('slug').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  projectSlugUniq: uniqueIndex('environments_project_slug_idx').on(t.projectId, t.slug),
}))

export const environmentsRelations = relations(environments, ({ one, many }) => ({
  project:     one(projects, { fields: [environments.projectId], references: [projects.id] }),
  envVars:     many(environmentVariables),
  deployments: many(deployments),
}))

export const deployments = pgTable('deployments', {
  id:            uuid('id').primaryKey().defaultRandom(),
  serviceId:     uuid('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  environmentId: uuid('environment_id').notNull().references(() => environments.id, { onDelete: 'cascade' }),
  status:        text('status').notNull().default('queued'),
  commitSha:     text('commit_sha'),
  commitMessage: text('commit_message'),
  imageUri:      text('image_uri'),
  tfWorkspaceId: text('tf_workspace_id'),
  tfRunId:       text('tf_run_id'),
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
  service:     one(services,     { fields: [deployments.serviceId],     references: [services.id] }),
  environment: one(environments, { fields: [deployments.environmentId], references: [environments.id] }),
  triggeredBy: one(users,  { fields: [deployments.triggeredBy], references: [users.id] }),
  logStreams:  many(logStreams),
}))

export const environmentVariables = pgTable('environment_variables', {
  id:            uuid('id').primaryKey().defaultRandom(),
  serviceId:     uuid('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  environmentId: uuid('environment_id').notNull().references(() => environments.id, { onDelete: 'cascade' }),
  key:           text('key').notNull(),
  value:         text('value').notNull(),
  isSecret:      boolean('is_secret').notNull().default(true),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  serviceEnvKeyUniq: uniqueIndex('env_vars_service_env_key_idx').on(t.serviceId, t.environmentId, t.key),
}))

export const environmentVariablesRelations = relations(environmentVariables, ({ one }) => ({
  service:     one(services,     { fields: [environmentVariables.serviceId],     references: [services.id] }),
  environment: one(environments, { fields: [environmentVariables.environmentId], references: [environments.id] }),
}))

export const domains = pgTable('domains', {
  id:         uuid('id').primaryKey().defaultRandom(),
  serviceId:  uuid('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  hostname:   text('hostname').notNull().unique(),
  isCustom:   boolean('is_custom').notNull().default(false),
  sslStatus:  text('ssl_status').default('pending'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt:  timestamp('created_at',  { withTimezone: true }).notNull().defaultNow(),
})

export const domainsRelations = relations(domains, ({ one }) => ({
  service: one(services, { fields: [domains.serviceId], references: [services.id] }),
}))

export const databases = pgTable('databases', {
  id:            uuid('id').primaryKey().defaultRandom(),
  projectId:     uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name:          text('name').notNull(),
  engine:        text('engine').notNull(),
  version:       text('version').notNull(),
  status:        text('status').notNull().default('provisioning'),
  connectionUrl: text('connection_url'),
  awsResourceId: text('aws_resource_id'),
  storageGb:     integer('storage_gb').notNull().default(20),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const databasesRelations = relations(databases, ({ one }) => ({
  project: one(projects, { fields: [databases.projectId], references: [projects.id] }),
}))

export const logStreams = pgTable('log_streams', {
  id:           uuid('id').primaryKey().defaultRandom(),
  deploymentId: uuid('deployment_id').references(() => deployments.id, { onDelete: 'cascade' }),
  serviceId:    uuid('service_id').references(() => services.id, { onDelete: 'cascade' }),
  streamType:   text('stream_type').notNull(),
  provider:     text('provider').notNull(),
  streamName:   text('stream_name').notNull(),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const logStreamsRelations = relations(logStreams, ({ one }) => ({
  deployment: one(deployments, { fields: [logStreams.deploymentId], references: [deployments.id] }),
  service:    one(services,    { fields: [logStreams.serviceId],    references: [services.id] }),
}))

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
export type Environment    = typeof environments.$inferSelect
export type NewEnvironment = typeof environments.$inferInsert
export type Domain       = typeof domains.$inferSelect
export type Database     = typeof databases.$inferSelect
export type LogStream    = typeof logStreams.$inferSelect
export type GithubInstallation    = typeof githubInstallations.$inferSelect
export type NewGithubInstallation = typeof githubInstallations.$inferInsert
