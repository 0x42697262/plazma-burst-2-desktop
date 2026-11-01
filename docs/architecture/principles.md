# Architecture and design principles

How this codebase is structured, and why. It's written for humans and
coding agents. Rules marked **(hard rule)** are non-negotiable; the rest is
strong guidance. Stack-specific examples are in section 10. Section 11 holds the
rules specific to this repository; where it is stricter than the sections before
it, it wins.

## 1. Core idea

The application is a set of plain business rules surrounded by thin
layers that talk to the outside world (HTTP, database, queues, third-party
APIs, the browser). Keep the business rules independent of frameworks and
I/O, keep the boundaries thin and explicit, and let data flow one way:

    request/event -> entry (route/controller/listener/job) -> service
                  -> domain rules (pure) -> adapters (DB, APIs, mail, queue)

- Entry points receive input and validate it.
- Services orchestrate a use case and own transactions.
- Domain rules decide.
- Adapters talk to the outside world.

## 2. Layers

Each module or class has one job. Keep these layers apart.

| Layer | Job | May depend on | Must not |
|---|---|---|---|
| Entry (routes, controllers, CLI commands, queue listeners, cron jobs, webhooks) | Parse and validate input, call one service method, shape the response | Services, DTOs, validation | Contain business rules, query the DB directly |
| Services / use cases | Run one use case end to end: load data, call rules, persist, emit events, own the transaction | Domain rules, repositories, gateways | Know about HTTP, request objects or views |
| Domain rules | Pure logic: pricing, eligibility, state transitions, schedules, calculations | Other domain rules, value objects, settings | Do I/O, read the clock or env, import framework code |
| Adapters (repositories, gateways, clients) | Talk to the DB, payment providers, email, storage, external APIs. Translate to and from plain domain objects | DB/ORM, SDKs, HTTP clients | Make business decisions |
| Config | Typed, validated settings loaded once at boot | Environment | Be read ad hoc with `env()` / `process.env` deep in the code |
| Text / i18n | Every user-facing string, email copy, error message and log message | Nothing | Be inlined in logic |
| Frontend | Presentation and interaction | The API contract | Be the authority on prices, permissions or state |

Rules of thumb:

- **Thin entry points.** A controller is about 5 to 15 lines: validate,
  call a service, return a resource or DTO.
- **Pure domain rules.** Pass `now`, IDs and settings in as arguments. Pure
  rules are trivial to unit test and to reason about.
- **Adapters hide vendors.** Code depends on `PaymentGateway`, not on the
  Stripe SDK. Swapping a vendor touches one adapter.
- **One wiring place.** Dependency injection (a Laravel service container,
  or a composition root in Node) builds the object graph. Nothing else
  `new`s up infrastructure.

## 3. Hard rules

### 3.1 No explanatory comments in code (hard rule)

Code explains *what* it does through names, small functions and small
types. The *why* (business reasons, regulatory constraints, rejected
alternatives, third-party quirks) goes in `docs/`, one file per topic, or
in an ADR. Comments rot; docs get reviewed.

Allowed exceptions: annotations that tools need (type hints for static
analysis such as PHPDoc generics or JSDoc types where TypeScript isn't
used, lint/disable directives with a reason in the docs, license headers).

### 3.2 No magic values (hard rule)

Every number, duration, limit, status, role, route name, queue name, cache
key and string lives in exactly one named place:

| Kind | Where |
|---|---|
| Values an operator may tune per environment (limits, timeouts, rates, feature flags) | Typed config (`config/*.php`, `src/config/index.ts`), sourced from env, with defaults |
| Fixed internal constants (page sizes, retry counts, cache TTLs) | A `Constants` / `Tuning` module per area |
| Statuses, roles, types | Enums (PHP 8.1 enums, TypeScript union types/enums) |
| User-facing text and emails | i18n / lang files (`lang/en/*.php`, `locales/en.json`) |
| Error codes and messages returned by the API | An error catalog (`ErrorCode` enum + messages) |
| Log messages and event names | A log/event catalog module |
| Cache keys, queue names, channel names | One keys module per area |

Plain `0`, `1`, `null`, `true` and empty string are fine where obvious.

### 3.3 Config is validated at boot (hard rule)

- Read env vars in one place, validate them with a schema (Zod/Joi/envalid
  in Node, typed config with validation in Laravel), and fail fast on
  startup if anything is missing or invalid.
- The rest of the app reads a typed, immutable settings object, never raw
  env.
- Derived settings (percent to ratio, "feature A forces feature B")
  resolve there once.
- A cap or interval of 0 conventionally means "off" or "no limit";
  document it.

### 3.4 Everything that persists is versioned (hard rule)

- **Database:** schema changes only through migrations. Never edit an
  applied migration. Use expand-and-contract for breaking changes (add the
  new column, backfill, switch reads, then drop the old one).
- **API:** additive changes are fine. Breaking changes get a new version or
  a new field, with a deprecation window.
- **Stored JSON, settings blobs, cached payloads:** carry a version
  number. Readers accept old versions or migrate them on read.
- **Defaults** that are persisted per user or tenant: changing a default
  needs a migration or backfill, or old records keep the old value
  forever.

## 4. DDIA principles, applied

Based on *Designing Data-Intensive Applications* (Kleppmann):
reliability, scalability, maintainability, and one source of truth.

### 4.1 Reliability: fail safe and recover

- **Validate at every boundary** (request, webhook, queue message, external
  response). Trust nothing from the client or a third party.
- **Timeouts on every outbound call.** No call waits forever.
- **Retries with exponential backoff, jitter and a cap**, only for safe or
  idempotent operations. Never hot-loop.
- **Idempotency:** writes that can be retried (payments, webhooks, job
  handlers) take an idempotency key, or check-then-act inside a
  transaction or unique constraint. Running a job twice must be safe.
- **Transactions around multi-step writes.** Use the outbox pattern (write
  the event in the same transaction, publish it afterwards) when a DB write
  and a message must both happen.
- **Graceful degradation:** if a non-critical dependency is down (search,
  recommendations, analytics), serve the core feature and log the failure.
- **Every side effect has an undo path** or a compensating action
  (refund, release lock, revert flag). Feature flags can be turned off
  without a deploy.
- **Clean shutdown:** finish in-flight requests and jobs, release locks.

### 4.2 Scalability: bounded work

- **Bound every query:** pagination on every list endpoint, a hard max
  page size, no unbounded `find()` / `all()`.
- **No N+1 queries:** eager-load (`with()` in Eloquent, `populate()` /
  aggregation in Mongoose) and watch query counts in development.
- **Index for your access patterns.** Every frequent filter or sort has an
  index. Review slow-query logs.
- **Move slow work off the request path:** emails, exports, image
  processing and webhooks to third parties go to a queue (Laravel Queues
  with Horizon, BullMQ in Node).
- **Cache derived or read-heavy data** with explicit keys, TTLs and
  invalidation on write. Never cache the only copy of anything.
- **Stateless app servers:** sessions and state go in a DB or Redis, so you
  can run N instances.
- **Rate limit and throttle** public endpoints and expensive operations.
  Scale limits by plan or tenant, not by guesswork.
- **Throttle periodic work** (cron, polling, reconciliation) to fixed
  intervals with locks so only one instance runs it.

### 4.3 Maintainability (the main focus)

**Operability**
- Structured logs (JSON) with a request/correlation ID, user or tenant ID
  and an event name from the log catalog.
- Log decisions with their inputs ("order 812 priced: subtotal=40.00
  discount=0.10 tax=3.24"), so one line explains a result after the fact.
- Throttle or dedupe noisy errors, and send them to an error tracker
  (Sentry or similar).
- Health and readiness endpoints, plus metrics for latency, error rate,
  queue depth and job failures.
- Admin or CLI commands for safe operational actions (re-run a job,
  resync a record), behind permissions. Debug tools are off in production
  by default.

**Simplicity**
- The smallest design that works. No speculative abstraction, no interface
  with one implementation "for later" (except at true vendor boundaries).
- One module, one job. Small functions with intention-revealing names.
- Prefer **reconciliation** for state that mirrors something external: a
  scheduled job compares desired state with actual state and fixes the
  difference (subscription status vs the payment provider, files vs DB
  rows). This self-heals after missed webhooks and partial failures.

**Evolvability**
- New variants (plans, roles, discount types, notification channels) are
  added through data, config, enums and strategy maps, not new `if`
  chains in control flow.
- Domain rules take settings objects, so new knobs don't change call
  sites.
- Reuse small value objects (`Money`, `DateRange`, `Percentage`,
  `Cadence`) across features.

### 4.4 One source of truth

- The database (or the system of record for that data) is the record.
  Don't keep a second copy that can drift. Derive, or read when needed.
- Denormalized copies and caches are derived. Each has one documented way
  to rebuild it.
- External systems are the source of truth for their own data (the payment
  provider for payment status). Mirror it with webhooks plus
  reconciliation, never by guessing.

## 5. Client/server contract (frontend vs backend mismatches)

- **The server is authoritative.** Prices, totals, permissions, limits,
  stock and state transitions are computed and enforced on the server. The
  client may display a preview, but the server recomputes and wins.
- **Same rules, one implementation:** if the client must show a computed
  value (a price preview, "uses left"), either fetch it from the server or
  share the exact rule (a shared TypeScript package; for PHP backends,
  return computed fields in the API resource). Never re-implement business
  rules in the frontend by hand. The two drift.
- **Typed contract:** define request/response schemas once (OpenAPI, Zod
  schemas shared in a monorepo, Laravel API Resources plus generated TS
  types). Validate on the server; generate or share types for the client.
- **Optimistic UI must reconcile** with the server's response and roll
  back on error.
- **Audit for mismatches:** for each value the UI shows, know whether it
  comes from the server or is computed locally, and from which inputs.
  Anything local that drives a decision is a bug waiting to happen.
- **Remove features the server can't back.** Don't ship client-only
  behavior that pretends to be real (a client-only "discount applied").

## 6. Request, job and lifecycle model

- **Request lifecycle:** middleware (auth, tenant, rate limit, request ID)
  -> validation (Form Requests / Zod) -> controller -> service ->
  resource/DTO.
- **Jobs and events:** a service emits domain events (`OrderPlaced`);
  listeners and jobs handle side effects (email, analytics, webhooks).
  Features communicate through events or services, not by reaching into
  each other's tables or models.
- **Every background job is idempotent, has a timeout, a retry policy and
  a dead-letter or failed-jobs path.**
- **Feature flags** wrap risky changes. Each flag has an owner and a
  removal date.

## 7. Testing strategy

- **Domain rules:** fast unit tests, many cases, no mocks needed (they're
  pure).
- **Services:** tests with fake adapters (in-memory repositories, fake
  gateways).
- **Adapters:** integration tests against real dependencies in containers
  (DB, Redis) or the vendor's sandbox.
- **API:** contract/feature tests per endpoint (Laravel feature tests,
  Supertest/Vitest in Node), including auth and validation failures.
- **Frontend:** component tests for logic, and a few end-to-end tests
  (Playwright/Cypress) for critical flows (signup, checkout).
- A bug fix starts with a failing test that reproduces it.

## 8. Documentation as the design record

- `README.md`: what it is, setup, run, test, deploy.
- `docs/README.md`: table of contents, one line per topic.
- `docs/<area>/<topic>.md`: how a feature actually works: the flow, the
  numbers, the edge cases, the log/event names to look for, and the
  rejected alternatives.
- `docs/adr/NNNN-title.md`: one short Architecture Decision Record per
  significant decision (context, decision, consequences).
- `AGENTS.md` / `CONTRIBUTING.md`:
  - Conventions and working rules.
  - **Confirmed facts** about third parties and the framework (webhook
    retry behavior, rate limits, API quirks), with where they were
    verified.
  - **Verification checklist:** one concrete check per behavior change
    (what to do, and the response, log line or UI result to expect).
- Docs, ADRs and checklist entries are updated in the same PR as the code.

## 9. Working rules

- CI must be green: lint, type check, static analysis (PHPStan/Larastan,
  `tsc --noEmit`), tests. Zero warnings policy.
- Review every diff for explanatory comments and stray literals.
- Schema change = migration. Persisted default change = migration or
  backfill. Breaking API change = new version or field.
- Check the actual source or docs of a library or vendor before relying on
  a behavior, and record it under "confirmed facts".
- Secrets only in env or a secret manager, never in the repo. `.env` is
  gitignored; `.env.example` lists every key.
- Local-only scripts stay out of version control or live under a clearly
  marked `scripts/local/` folder that's gitignored.
- Use one language variant consistently (for example American English) in
  code, UI copy and docs.
- Small PRs, one concern each.

## 10. Stack mappings

### 10.1 MERN (MongoDB, Express, React, Node) with TypeScript

    server/
      src/
        app.ts                   composition root: build deps, mount routes
        config/                  env schema (Zod), typed settings, constants
        http/
          routes/                route definitions only
          controllers/           thin: validate -> service -> respond
          middleware/            auth, requestId, rateLimit, errorHandler
          schemas/               Zod request/response schemas (shared)
        services/                use cases, transactions (Mongo sessions)
        domain/                  pure rules, value objects, enums
        adapters/
          db/                    Mongoose models + repositories
          payments/              gateway interface + Stripe implementation
          mail/                  mailer interface + provider implementation
          queue/                 BullMQ producers
        jobs/                    BullMQ workers (idempotent)
        events/                  domain events + listeners
        text/                    error catalog, log events, email copy keys
        observability/           logger (pino), metrics, tracing
      test/                      unit (domain), service, integration, api
    client/
      src/
        api/                     typed client generated from shared schemas
        features/<feature>/      components, hooks, state per feature
        components/              shared presentational components
        i18n/                    locale files
        config/                  public runtime config
    packages/shared/             shared Zod schemas, types, pure rules
    docs/, docs/adr/, README.md, AGENTS.md

Notes:
- MongoDB has no enforced schema. Mongoose schemas plus migrations
  (migrate-mongo) are the schema. Version embedded documents.
- Use multi-document transactions (sessions) for multi-step writes.
  Create unique indexes for idempotency keys.
- React holds UI state only. Server state goes through a query cache
  (TanStack Query) keyed by API resource, invalidated on mutation.

### 10.2 PHP / Laravel

    app/
      Http/
        Controllers/             thin: FormRequest -> Action/Service -> Resource
        Requests/                validation (Form Requests)
        Resources/               API Resources (the response contract)
        Middleware/
      Actions/ or Services/      use cases, DB::transaction()
      Domain/<Area>/             pure rules, value objects, enums (no Eloquent)
      Models/                    Eloquent models (persistence only, thin)
      Repositories/              optional: only where queries get complex
      Gateways/                  interfaces + vendor implementations
      Jobs/                      queued jobs (ShouldBeUnique, idempotent)
      Events/ Listeners/         domain events and side effects
      Console/Commands/          operational commands
      Enums/                     statuses, roles, types
      Support/                   constants, cache keys, small helpers
    config/                      typed config files reading env() ONLY here
    database/migrations/         every schema change
    lang/en/                     user-facing text, validation messages
    routes/api.php, web.php      route definitions only
    tests/Unit (domain), tests/Feature (HTTP), tests/Integration (gateways)
    docs/, docs/adr/, README.md, AGENTS.md

Notes:
- Call `env()` only inside `config/*.php`, and use `config()` everywhere
  else, so `config:cache` works.
- Keep Eloquent models thin: relationships, casts, scopes. Business rules
  live in `Domain/` and Actions.
- Prevent N+1 queries with `Model::preventLazyLoading()` in non-production.
- Use queues with Horizon, `ShouldBeUnique` / `WithoutOverlapping` for
  idempotency, `tries` / `backoff` / `timeout` on every job, and a
  monitored `failed_jobs` table.
- If the frontend is Inertia/Vue/React, generate TS types from API
  Resources or Data objects (spatie/laravel-data + typescript-transformer)
  so client and server share one contract.

### 10.3 Other stacks

The same mapping applies: entry (controllers, handlers) -> services/use
cases -> pure domain -> adapters, with typed config, migrations, an i18n
catalog and a docs/ADR folder. For example, Django: views -> services ->
domain -> repositories/ORM. Rails: controllers -> service objects ->
POROs -> models/clients. NestJS: controllers -> providers -> domain ->
repositories.

## 11. Rules specific to this repository

- **Every feature is behind a feature flag (hard rule).** That covers each dev console
  command group, hooks, Sad Burst 2 support, remote play, the p2p host, the server
  list, and anything added later. See [feature-flags.md](feature-flags.md).
- **No single-letter identifiers (hard rule).** `value`, not `v`; `index`, not `i`;
  `error`, not `e`. The only exception is `_` for an unused parameter.
- **No comments (hard rule).** This is stricter than §3.1: only the tool annotations it
  lists are allowed. A comment's *why* moves to `docs/` before the comment is deleted.
- **Explaining variables.** A condition or expression that would need a comment gets a
  name instead: `const isFingerprinterTask = …`.
- **Separation of concerns.** Inside a feature: `entry/` → `services/` → `domain/`
  (pure) → `adapters/`.
- **One source of truth.** Each fact (a route name, a file path, a default, a flag) is
  defined in exactly one module.
- **No magic strings or values (hard rule).** Each feature has its own `constants.ts`,
  `text.ts`, `events.ts` and `keys.ts`.
- **Test first.** A move starts with a characterization test, a fix with a failing
  test.
- **One docs directory.** All documentation lives under `docs/`. The root holds only
  `README.md` and `AGENTS.md`.
- **Modular.** One folder per feature under `src/features/<id>/`, wired in through one
  list per side (wrapper, console). See [layers.md](layers.md).
- **Language variant.** American English in code, UI text and docs.
