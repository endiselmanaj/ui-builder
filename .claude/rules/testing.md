# Testing Philosophy

These rules apply to all test-related work in this project, regardless of stack.

1. **Test behavior, not implementation.** Tests should assert on observable outputs (HTTP response body, rendered DOM, database state, return values), not on internal method calls or private state.

2. **Mock at system boundaries only.** Mock external HTTP services, time, randomness, and third-party APIs. Never mock your own database, internal services, mappers, or domain entities. If mocking a collaborator makes the test trivially green, you are testing the wrong thing.

3. **Coverage is a floor, never a target.** Use coverage to catch untested areas, not as a metric to maximize. A codebase with 95% coverage that only tests happy paths is worse than 70% coverage that tests edge cases and error paths.

4. **Tests are documentation.** Name tests as behavior specifications that a new team member can read to understand what the system does. Reject vague names like `Test1`, `ShouldWork`, `HappyPath`.

5. **Never modify a human-written test to make an implementation pass.** If the test seems wrong, say so and ask. The test is the contract — the implementation must satisfy it, not the other way around.

6. **Favor integration tests over heavily-mocked unit tests.** When tooling makes integration tests fast (Testcontainers, MSW, in-memory databases), prefer them. A single integration test that exercises real collaborators catches more bugs than ten unit tests with mocked internals.

7. **One assertion concept per test.** Multiple assertion calls are fine if they verify a single logical outcome. But a test that verifies login, navigation, and data display is three tests pretending to be one.

8. **Tests must fail when code breaks.** Apply the deletion test: if you delete the function body, does the test fail? If not, the test is useless. Ban weak assertions like `toBeDefined()`, `toBeTruthy()`, or `Should().NotBeNull()` as the sole assertion — they prove existence, not correctness.

9. **Verify AI-generated test assertions for logical correctness.** AI routinely writes tests that cement bugs as "expected behavior." Review that expected values reflect *correct* behavior, not just *current* behavior. A test asserting `divide(10, 0) == 0` is worse than no test.

10. **No hardcoded lookup-table implementations to pass tests.** Never implement business logic by hardcoding return values that match test cases (e.g., `if amount == 1000 then return 100`). The implementation must compute the result, not memorize it.
