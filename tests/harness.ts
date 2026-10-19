// ═══════════════════════════════════════════════════════════════
// Minimal test harness — no external dependency.
//
// The project has no network access to install a test framework, so
// this provides the few primitives the suite needs: describe/it,
// assertions, and a summary with a non-zero exit code on failure.
// ═══════════════════════════════════════════════════════════════

interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
}

const suites: { name: string; tests: TestCase[] }[] = [];
let current: { name: string; tests: TestCase[] } | null = null;

export function describe(name: string, fn: () => void): void {
  current = { name, tests: [] };
  suites.push(current);
  fn();
  current = null;
}

export function it(name: string, fn: () => void | Promise<void>): void {
  if (!current) throw new Error('it() must be called inside describe()');
  current.tests.push({ name, fn });
}

export class AssertionError extends Error {}

export function assert(condition: unknown, message: string): void {
  if (!condition) throw new AssertionError(message);
}

export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new AssertionError(
      message ?? `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

export function assertClose(actual: number, expected: number, tolerance = 0.001, message?: string): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new AssertionError(
      message ?? `expected ${expected} (±${tolerance}), got ${actual}`
    );
  }
}

export function assertThrows(fn: () => unknown, message?: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) throw new AssertionError(message ?? 'expected the function to throw');
}

export async function run(): Promise<void> {
  let passed = 0;
  const failures: { suite: string; test: string; error: Error }[] = [];

  for (const suite of suites) {
    console.log(`\n  ${suite.name}`);
    for (const test of suite.tests) {
      try {
        await test.fn();
        passed++;
        console.log(`    ✓ ${test.name}`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        failures.push({ suite: suite.name, test: test.name, error: err });
        console.log(`    ✗ ${test.name}`);
      }
    }
  }

  const total = passed + failures.length;
  console.log(`\n  ${passed}/${total} tests passed`);

  if (failures.length > 0) {
    console.log('\n  Failures:');
    for (const f of failures) {
      console.log(`\n  ${f.suite} › ${f.test}`);
      console.log(`    ${f.error.message}`);
    }
    process.exitCode = 1;
  }
}
