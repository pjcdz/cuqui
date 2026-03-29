---
name: srs-coverage-worker
description: Generates SRS_COVERAGE_REPORT.md mapping every SRS requirement to implementation artifacts with test status
---

# SRS Coverage Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Only for the final feature: generating the SRS coverage report.

## Required Skills

None.

## Work Procedure

1. **Read SRS**: Read `./srs.md` completely.

2. **Map every requirement**: For each requirement (RF-001 through RF-019, RNF-001 through RNF-034):
   - Find the implementation file(s) that address it
   - Find any test files that verify it
   - Determine status: Implemented / Partial / Not Implemented
   - Note which validation contract assertion covers it

3. **Generate report**: Create `SRS_COVERAGE_REPORT.md` in the project root with:
   - Table of all requirements with columns: ID, Description, Status, Implementation Files, Test Files, Validation Assertion
   - Summary statistics
   - List of any unimplemented requirements

4. **Verify**: Run `npm run test`, `npm run lint`, `npm run build` to confirm everything still works.

5. **Commit**: Stage and commit the report.

## Example Handoff

```json
{
  "salientSummary": "Generated SRS_COVERAGE_REPORT.md mapping all 53 SRS requirements (19 functional + 34 non-functional) to implementation artifacts. 45/53 requirements fully implemented, 6 partial, 2 not applicable (platform-level).",
  "whatWasImplemented": "SRS_COVERAGE_REPORT.md in project root with complete traceability matrix for all RF and RNF requirements.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "npm run test", "exitCode": 0, "observation": "All tests pass" },
      { "command": "npm run build", "exitCode": 0, "observation": "Build succeeds" }
    ],
    "interactiveChecks": []
  },
  "tests": { "added": [] },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Cannot find implementation for critical SRS requirements
- Build is broken and cannot be fixed within this feature's scope
