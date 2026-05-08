# React / TypeScript — TDD Stack Guide

## Test stack

- **Vitest** (preferred) or **Jest** for the runner.
- **React Testing Library** for component tests (`render`, `screen`, `userEvent`).
- **MSW** (Mock Service Worker) for API mocking at the network level.
- **@testing-library/jest-dom** for extended DOM matchers.

## Test structure example

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import { OrderSummary } from './OrderSummary';

test('shows zero totals when no orders exist', async () => {
  server.use(
    http.get('/api/orders', () => HttpResponse.json([]))
  );

  render(<OrderSummary customerId={42} />);

  expect(await screen.findByText('0 orders')).toBeInTheDocument();
  expect(screen.getByText('$0.00')).toBeInTheDocument();
});
```

## The over-mocking anti-pattern (refuse to write this)

```typescript
// REFUSE — mocking every hook and service removes the test
vi.mock('../hooks/useOrders', () => ({
  useOrders: () => ({ data: [], isLoading: false })
}));
vi.mock('../services/orderService', () => ({
  getTotal: () => 0
}));

render(<OrderSummary customerId={42} />);
// The component renders "correctly" because you told it to.
// This proves nothing about real behavior.
```

If you find yourself using `vi.mock` on internal modules, switch to rendering with real providers and mocking at the network boundary with MSW instead.

## The integration test pattern (use this instead)

```typescript
import { render, screen } from '../test-utils'; // custom render with providers
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import { OrderSummary } from './OrderSummary';

test('aggregates order totals from real API response', async () => {
  server.use(
    http.get('/api/customers/:id/orders', () =>
      HttpResponse.json([
        { category: 'TYRES', total: 200 },
        { category: 'TYRES', total: 150 },
        { category: 'BATTERY', total: 800 },
      ])
    )
  );

  render(<OrderSummary customerId={42} />);

  expect(await screen.findByText('$1,150.00')).toBeInTheDocument();
  expect(screen.getByText('TYRES')).toBeInTheDocument();
});
```

## Test naming

Use natural language in `test()` or `describe`/`it` blocks:

```typescript
test('shows empty state when customer has no orders', ...)       // ✓
test('disables submit button while form is validating', ...)     // ✓
test('test 1', ...)                                              // ✗
test('should work', ...)                                         // ✗
```

## Useful commands

```bash
npm test
npx vitest run
npx vitest run --coverage
npx vitest run path/to/specific.test.tsx
```

## Project layout conventions

- Test files colocated with source: `Component.test.tsx` next to `Component.tsx`
- Or in a `__tests__/` directory alongside components
- Test utilities in `src/test-utils/` (custom render with providers wrapper)
- MSW handlers in `src/mocks/handlers.ts`, server setup in `src/mocks/server.ts`

## Stack-specific hard rules

- Use `screen` queries, never destructure from `render()` result
- Prefer `userEvent` over `fireEvent` for realistic interaction simulation
- Query by role, label, or text — never by CSS class, tag, or position
- Do not `vi.mock` internal modules (hooks, stores, services) — render with real implementations and mock at the network boundary with MSW
- Use `findBy` (async) for content that appears after effects or fetches; `getBy` for content already in the DOM
- `data-testid` is a last resort for unit/component tests; reserve it primarily for E2E (Playwright)
- Custom render wrapper should include all providers the app uses (router, store, theme, etc.)
