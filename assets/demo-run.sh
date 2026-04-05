#!/usr/bin/env bash
set +e

cd /Users/bennyxavier/dev/25CR2025/zodrift

echo '$ npx zodrift check --pattern examples/broken.ts --semantics both'
node dist/cli.js check --pattern examples/broken.ts --semantics both
code=$?
echo "drift gate: FAIL (exit $code)"

echo
echo '$ npx zodrift check --pattern examples/fixed.ts --semantics both'
node dist/cli.js check --pattern examples/fixed.ts --semantics both
code=$?
echo "drift gate: PASS (exit $code)"
