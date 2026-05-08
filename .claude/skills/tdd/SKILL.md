---
name: tdd
description: "Use for test-driven development, writing tests, or test refactoring on any stack. Enforces RED-GREEN-REFACTOR with isolated subagents to prevent test-implementation contamination. Auto-detects the project stack and loads stack-specific guidance."
---

# TDD Skill — Universal

This skill is loaded for any test-related task. It implements a test-first workflow: the human writes the test (or delegates to the test-writer agent), the AI implements, the test is the contract.

## Why subagents

Delegation to subagents is load-bearing, not ceremonial. If the same context that will write the implementation also writes the test, the test gets shaped around anticipated implementation details rather than the required behavior. Each phase runs in an isolated subagent:

- **RED** sees only the requirement — not the current or planned implementation
- **GREEN** sees only the failing test — not the refactoring it might enable later
- **REFACTOR** sees only the passing implementation — not the next feature

Do NOT short-circuit this by doing any phase inline. If you catch yourself reasoning "I already know how this should be implemented, I'll just write the test here," that is exactly the contamination the subagents exist to prevent — delegate anyway.

## Stack detection

Before starting any TDD work, detect the project's stack and load the appropriate guide:

1. Check for marker files in priority order:
   - `.csproj` or `.sln` → read `.claude/skills/tdd/stacks/dotnet.md`
   - `package.json` with `react` dependency → read `.claude/skills/tdd/stacks/react-typescript.md`
   - `pyproject.toml` or `setup.py` → read `.claude/skills/tdd/stacks/python.md` (if available)
   - `go.mod` → read `.claude/skills/tdd/stacks/go.md` (if available)
2. In a monorepo with multiple stacks, determine which stack applies to the file being tested and load that one.
3. If no stack file exists for the detected stack, proceed with universal principles only and note that stack-specific guidance is unavailable.
4. Load the stack file using the `Read` tool before proceeding to the RED phase.

## The workflow

You (Claude) participate in a Red-Green-Refactor loop using dedicated subagents.

### Red (failing test)

🔴 RED PHASE: Delegating to `test-writer` subagent...

- **Do not write the test yourself.** If the user asks "add tests for feature X", ask: "should I write the test first, or do you want to write it?" Wait for the answer.
- If the user wants AI to write the test, delegate to the `test-writer` subagent with the feature requirement and the detected stack.
- The subagent returns: test file path, failure output, summary of what the test verifies.

**Do NOT proceed to Green phase until test failure is confirmed.**

### Green (minimal implementation)

🟢 GREEN PHASE: Delegating to `implementer` subagent...

- Delegate to the `implementer` subagent with the test file path and feature requirement.
- The subagent reads the failing test, implements the minimum to make it pass, and confirms green.
- Do not add features the test does not exercise.

**Do NOT proceed to Refactor phase until test passes.**

### Refactor (improvements with the test as safety net)

🔵 REFACTOR PHASE: Delegating to `refactorer` subagent...

- Delegate to the `refactorer` subagent with the test file and implementation files.
- The subagent evaluates against its checklist and either applies improvements or returns "no refactoring needed."
- Never refactor by changing behaviour the test asserts.

**Cycle complete when refactor phase returns.**

## Multiple features

Complete the full cycle for EACH feature before starting the next:

```
Feature 1: 🔴 → 🟢 → 🔵 ✓
Feature 2: 🔴 → 🟢 → 🔵 ✓
Feature 3: 🔴 → 🟢 → 🔵 ✓
```

## Phase violations

Never:
- Write implementation before the test
- Proceed to Green without seeing Red fail
- Skip Refactor evaluation
- Start a new feature before completing the current cycle

## Universal testing principles

### Test structure

Arrange / Act / Assert (or Given / When / Then), separated by blank lines. No comments labeling the sections — the structure is visible from the whitespace.

One assertion concept per test. Multiple `expect` / `Should()` calls are fine if they verify a single logical outcome.

### Test naming

Test names describe behavior, not methods. Use the convention appropriate to the stack:
- .NET: `Method_Scenario_ExpectedResult` (e.g., `GetSummary_NoOrders_ReturnsZerosAndNullDates`)
- JS/TS: natural language in `test('describes the behavior', ...)` or `describe`/`it` blocks

Reject vague names like `Test1`, `ShouldWork`, `HappyPath`.

### Mocking discipline

This is the most violated rule in AI-generated tests. Read it twice.

| Collaborator type | Mock? | Why |
|----|----|----|
| External HTTP / payment / email / SMS | Yes | Slow, flaky, costs money |
| Time / random / GUIDs | Yes | Need determinism |
| Your own database | Prefer not | Use Testcontainers / in-memory DB / test instance. DB behavior is part of correctness |
| Internal services / mappers / utilities | No | You are testing the collaboration; mocking removes the test |
| Domain entities / value objects | Never | They have no behavior worth mocking |

**Rule of thumb:** if mocking a collaborator makes the test trivially green, you are testing the wrong thing.

### The over-mocking anti-pattern

If every collaborator is mocked, the test asserts only that mock setup returns what you told it to return. This is the most common failure mode of AI-generated tests. When you find yourself creating more than two mocks for a single test, stop and switch to an integration test that exercises the real collaborators.

See the stack-specific guide for concrete code examples of this anti-pattern and the correct alternative.

### Integration over mocking

Favor integration tests with real infrastructure over heavily-mocked unit tests. The "testing diamond" (broad integration base, narrow unit top) produces better defect detection than the "testing pyramid" when the cost of integration tests is low — which modern tooling like Testcontainers, MSW, and in-memory databases makes possible.

## What to test, what not to test

### Always test

- Business rules and domain logic
- Branching logic (error vs success paths)
- Boundary conditions (empty, max, negative, null/undefined)
- Integrations critical to correctness (DB queries, external API calls)
- Bug fixes (write the regression test before fixing)

### Rarely test

- Framework behavior (don't test that the framework binds JSON, routes requests, etc.)
- Trivial getters, setters, data classes
- Generated code (mappings, DTOs, serialization boilerplate)
- Implementation details (private methods, internal state)

## When to skip TDD

- One-off scripts and prototypes
- UI-only changes (use Playwright at the right level instead)
- Spike work where the spec is unclear
- Configuration changes

For production code that will live a year, TDD is the default.

## When asked to "write tests for existing code"

This is the hardest case to handle well, because the temptation is to write tests that confirm the current implementation rather than the intended behaviour.

Your response:
1. Read the code carefully.
2. Identify the *behaviours* the code seems to implement.
3. Write tests for those behaviours, not for the code structure.
4. If a test fails when you run it, the implementation has a bug. Surface this — don't modify the test to make it green.
5. If you cannot tell what the intended behaviour is, ask the user.

## Stack-specific guides

| Stack | File | Detected by |
|-------|------|-------------|
| .NET / C# | `tdd/stacks/dotnet.md` | `.csproj`, `.sln` |
| React / TypeScript | `tdd/stacks/react-typescript.md` | `package.json` with `react` |

These files define: test runner and assertion library, test commands, integration test patterns, code examples, stack-specific naming conventions, and project layout conventions.
