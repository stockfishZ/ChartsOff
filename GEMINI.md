# Project Rules & Agent Execution Policy

## Subagent Delegation Guidelines
- **Subagent-First Default**: Always prefer delegating codebase exploration, research, and parallel implementation tasks to subagents instead of executing them sequentially in the main thread.
- **Research Subagents (`research`)**:
  - Use for broad codebase reconnaissance, multi-file searches, documentation queries, and reading extensive logs/reports.
  - Keep exploratory file-reading and grep outputs out of the main thread context.
- **Worker / Parallel Subagents (`self`)**:
  - Use when executing independent sub-tasks (e.g., frontend vs. backend changes, unit testing, validation scripts, parallel refactoring).
- **Main Thread Role**:
  - Focus the main conversation thread on synthesis, high-level planning, architectural decisions, and clear direct interactions with the user.
