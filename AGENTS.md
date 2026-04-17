# AGENTS.md

## Project Overview

@dnspresso/connect is a TypeScript SDK that simplifies DNS record setup for applications. It provides a unified API for managing DNS records across multiple providers, with built-in validation, error handling, and best practices. The goal is to abstract away the complexities of different DNS provider APIs and offer a consistent developer experience.

---

## TypeScript standards

Follow these patterns in all code. This section is prescriptive.

### Core principles

- **Zero or near-zero dependencies.** Use native APIs. Prefer cross-runtime APIs in portable core code: `fetch`, `URL`, `AbortController`, Web Crypto via `globalThis.crypto`. Use Node-only modules such as `node:fs` only in Node-specific tooling, build scripts, or adapters. Only add a dependency if it cannot be done in <50 lines with built-in APIs.
- **Headless by default.** Return typed data, never render UI. No framework imports in core packages.
- **Framework-agnostic core.** Pure TypeScript. Runs in Node, Bun, Deno, and browsers.
- **Types are constraints, not documentation.** If a type allows an invalid state, the type is wrong.

### Type patterns

**Branded types** — structurally identical but semantically different values must not be interchangeable:

```typescript
type UserId = string & { readonly __brand: "UserId" };
type Email = string & { readonly __brand: "Email" };
```

Brand via factory functions that validate at the boundary.

**Discriminated unions** — never use optional fields for different states:

```typescript
type Result =
  | { status: "pending" }
  | { status: "success"; data: User }
  | { status: "error"; error: AppError };
```

Use for all results, state machines, and API responses.

**`as const satisfies`** — for registries and config maps:

```typescript
const plugins = {
  auth: { name: "Authentication", enabled: true },
  cache: { name: "Cache Layer", enabled: false },
} as const satisfies Record<string, PluginConfig>;

type PluginId = keyof typeof plugins; // auto-extends when entries are added
```

**Inference over annotation** — do not annotate what the compiler can infer. Annotate return types on public API functions as contracts only.

**Typed error handling** — return typed result unions for expected runtime failures. Throw only for programmer mistakes.

**Function overloads** — when return type depends on input:

```typescript
function parse(options: { input: string; strict: true }): Data
function parse(options: { input: string; strict: false }): Data | null
function parse(options: { input: string; strict: boolean }): Data | null { ... }
```

**Type predicates** — `function isUser(value: unknown): value is User`. Use `is` prefix.

**Assertion functions** — `function assertDefined<T>(value: T | undefined, msg: string): asserts value is T`. Use for preconditions.

**Exhaustive checking** — use `const _exhaustive: never = value` in default switch branches to catch unhandled variants at compile time.

**Derive types from runtime** — define runtime values, derive types with `typeof`:

```typescript
const ROLES = ["admin", "editor", "viewer"] as const;
type Role = (typeof ROLES)[number];
```

**Template literal types** — string manipulation at the type level for event names, key remapping, and dynamic property types.

**Conditional types with `infer`** — `type ElementOf<T> = T extends (infer E)[] ? E : never`

**Mapped types** — `type Nullable<T> = { [K in keyof T]: T[K] | null }`

**`keyof` and indexed access** — `function getProperty<T, K extends keyof T>(obj: T, key: K): T[K]`

**`NoInfer<T>`** — prevent inference from specific positions.

**`declare global`** — for typing `process.env`, `Window`, and global types.

**`using` keyword (TS 5.2+)** — implement `Symbol.dispose` for automatic resource cleanup.

**Extracting types from libraries** — `Parameters<>`, `ReturnType<>`, `Awaited<>`, module augmentation.

### Code architecture

- **Classes** for stateful things (lifecycle, subscriptions, mutable state). **Functions** for stateless things (transformations, lookups, validation). Do not use classes as namespaces.
- **Subscribable base class** for all observable classes. `subscribe()` returns an unsubscribe function:

```typescript
class Subscribable<TArgs extends unknown[]> {
  #listeners: Set<(...args: TArgs) => void>;
  constructor() {
    this.#listeners = new Set();
  }
  subscribe(listener: (...args: TArgs) => void): () => void {
    const wasEmpty = this.#listeners.size === 0;
    this.#listeners.add(listener);
    if (wasEmpty) this.onSubscribe();
    return () => {
      const deleted = this.#listeners.delete(listener);
      if (deleted && this.#listeners.size === 0) this.onUnsubscribe();
    };
  }
  hasListeners(): boolean {
    return this.#listeners.size > 0;
  }
  protected onSubscribe(): void {}
  protected onUnsubscribe(): void {}
  protected notify(...args: TArgs): void {
    this.#listeners.forEach((listener) => listener(...args));
  }
}
```

Listeners are unique by function identity. Subscribing the same function twice is a no-op.

- **`#` private fields**, not TypeScript's `private` keyword. `#` is enforced at runtime.
- **Options pattern** — every public function takes a single options object. If one input is conceptually required, make it a required property on that object. Destructure with defaults: `const { timeout = 30_000 } = options`
- **Builder pattern** — for complex multi-step config. Each method returns a new typed context.

### File structure

Feature-based. Group related files by feature, not by type (no `controllers/`, `services/`, `types/` top-level folders). Shared code used across multiple features lives at root `src/`. Colocate tests with the code they test.

`index.ts` is the API boundary. If it's not exported from `index.ts`, it's not public. Use `export type` for types with no runtime representation.

### Error handling

One base error class per library with a typed `code` field:

```typescript
class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AppError";
  }
}
```

Throw for programmer mistakes. Return typed results for runtime failures.

### Naming

- **Files:** lowercase, hyphen-separated (`query-client.ts`)
- **Types:** PascalCase. Use semantic suffixes when they add meaning: `Result`, `Options`, `Error`, `Listener`, `Handler`, `Id`
- **Functions:** camelCase with verb prefixes: `create`, `get`, `is`/`has`/`can`, `to`, `parse`, `validate`, `match`
- **Constants:** `UPPER_SNAKE_CASE` for compile-time constants, `camelCase` for config defaults

### TypeScript configuration

Keep `tsconfig.json` strict and aligned with the current build setup. The current baseline is:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true
  }
}
```

Do not relax strictness flags to make code compile. Fix the types instead.

### Testing

- Test behavior, not implementation. Refactoring internals should break zero tests.
- Test every variant of discriminated unions.
- Mock external boundaries (network, fs, timers), not internal modules.
- Colocate tests with the code they cover using `*.test.ts` files.
- Prefer small, explicit test cases over large table-driven tests unless the table materially improves coverage or readability.

### Code style

- `const` by default, `let` only for reassignment, never `var`
- Arrow functions for callbacks, function declarations for top-level exports
- `===` exclusively, never `==`
- Early returns, no `else` after `return`
- `?.` and `??` over manual null checks
- `_` prefix for unused parameters
- `unknown` over `any`, then narrow
- `as const` objects over `enum`
- ES modules over `namespace`
- Named exports over default exports in library source. Use a default export in config files only when the tool expects it.
- Numeric separators: `30_000` not `30000`

---

## Tooling

- **Node 20+** for local development and CI.
- **pnpm** for package management. Exact versions are pinned; `.npmrc` enforces `save-exact=true`.
- **Vitest** for testing.
- **oxlint** for linting.
- **oxfmt** for formatting.
- **tsup** for builds with dual ESM + CJS output, declaration files, and sourcemaps.
- **Release Please** for automated versioning, changelogs, and releases via CI.
- **GitHub Actions** for CI.
- **`pnpm run check`** is the local pre-PR gate: format check, lint, typecheck, and test.
- Use the latest stable versions of all packages. Pin exact versions in `package.json` — no `^`, `~`, or `latest`.

---

## Git workflow

Feature branch for every change. Never commit to `main` directly.

Branch names: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`

**Conventional commits** — format: `type(scope): description`

```
feat(detect): add OVH nameserver pattern
fix(watcher): handle DNS timeout on Quad9
refactor(registry): extract pattern matching
```

- One concern per commit. Do not mix unrelated changes (e.g., a bug fix + an unrelated refactor).
- Tests ship with the code they test, in the same commit.
- Single line message, under 72 characters. No multi-line bodies unless breaking change.
- Breaking changes: `feat(detect)!: description` with `BREAKING CHANGE:` body.
- PR workflow: branch → commits → push → CI → squash merge. Release Please handles versioning and changelogs automatically from conventional commits.
