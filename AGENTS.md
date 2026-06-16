<!-- BEGIN:nextjs-agent-rules -->
# Project Instructions for AI Agent

## Framework
This project uses Next.js App Router and may use features newer than your training data.

If framework behavior is uncertain:
- Read only the specific documentation needed.
- Do NOT scan all documentation files.

## Repository Scope
Default scope:
- src/
- public/
- package.json
- next.config.mjs
- eslint.config.mjs
- postcss.config.mjs

Ignore by default:
- .next/
- node_modules/
- .git/
- database/backups/
- *.log
- dist/
- build/

Never recursively scan the entire repository unless explicitly requested.

## Working Rules
1. Read only files explicitly mentioned by the user.
2. Before changing code:
   - Explain the problem.
   - Give a short plan (3–5 bullets).
3. Prefer minimal patches.
4. Do not refactor unrelated files.
5. Do not rename files unless required.
6. Do not add dependencies unless necessary.
7. Do not modify environment variables unless requested.
8. Preserve existing project structure and coding style.

## Debugging Rules
For errors:
1. Identify the likely root cause.
2. Mention which file(s) need modification.
3. Provide the smallest possible fix.
4. Stop after solving the requested issue.

## Performance Rules
- Avoid reading large generated files.
- Avoid indexing unnecessary directories.
- Avoid repeatedly opening the same files.
- Ask for clarification if required files are missing.

## Response Format
For every task:
1. Problem summary
2. Proposed plan
3. Files to modify
4. Minimal patch
5. Verification steps

## Token Efficiency
- Never scan the whole repository for a single bug.
- Read at most 3 related files unless explicitly requested.
- Prefer searching by filename and error message first.
- For UI bugs, inspect only the affected page and directly imported components.
- Stop after producing the minimal fix.

<!-- END:nextjs-agent-rules -->