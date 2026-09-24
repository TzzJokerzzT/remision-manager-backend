# Skill Registry — remisiones-backend

Last updated: 2026-09-24

## Sources scanned

- /home/alex_buelvas/.pi/agent/skills
- /home/alex_buelvas/.agents/skills

## Contract

**Delegator use only.** This registry is an index, not a summary. Any agent that launches subagents reads it to select relevant skills, then passes exact `SKILL.md` paths for the subagent to read before work.

`SKILL.md` remains the source of truth. Do not inject generated summaries or compact rules by default; pass paths so subagents load the full runtime contract and preserve author intent.

## Skills

### SDD Pipeline

| Skill | Trigger / description | Scope | Path |
| --- | --- | --- | --- |
| `sdd-init` | Trigger: sdd init, iniciar sdd, openspec init. Initialize SDD context, testing capabilities, registry, and persistence. | delegate_only | `/home/alex_buelvas/.agents/skills/sdd-init/SKILL.md` |
| `sdd-explore` | Trigger: sdd explore, explorar. Explore codebase to understand current state before proposing changes. | delegate_only | `/home/alex_buelvas/.agents/skills/sdd-explore/SKILL.md` |
| `sdd-research` | Trigger: sdd research, investigar. Research external sources, documentation, and best practices. | delegate_only | `/home/alex_buelvas/.agents/skills/sdd-research/SKILL.md` |
| `sdd-propose` | Trigger: sdd propose, proponer. Create change proposals with scope, rationale, and rollback plan. | delegate_only | `/home/alex_buelvas/.agents/skills/sdd-propose/SKILL.md` |
| `sdd-spec` | Trigger: sdd spec, especificar. Write delta specifications using Given/When/Then scenarios. | delegate_only | `/home/alex_buelvas/.agents/skills/sdd-spec/SKILL.md` |
| `sdd-design` | Trigger: sdd design, diseñar. Create technical design with architecture decisions. | delegate_only | `/home/alex_buelvas/.agents/skills/sdd-design/SKILL.md` |
| `sdd-tasks` | Trigger: sdd tasks, tareas. Break down design into implementable tasks. | delegate_only | `/home/alex_buelvas/.agents/skills/sdd-tasks/SKILL.md` |
| `sdd-apply` | Trigger: sdd apply, aplicar. Implement tasks following TDD and code conventions. | delegate_only | `/home/alex_buelvas/.agents/skills/sdd-apply/SKILL.md` |
| `sdd-verify` | Trigger: sdd verify, verificar. Run tests, type checks, and verify implementation. | delegate_only | `/home/alex_buelvas/.agents/skills/sdd-verify/SKILL.md` |
| `sdd-archive` | Trigger: sdd archive, archivar. Archive completed changes and merge delta specs. | delegate_only | `/home/alex_buelvas/.agents/skills/sdd-archive/SKILL.md` |
| `sdd-onboard` | Trigger: sdd onboard, incorporar. Onboard new contributors to the project. | delegate_only | `/home/alex_buelvas/.agents/skills/sdd-onboard/SKILL.md` |

### Development Workflow

| Skill | Trigger / description | Scope | Path |
| --- | --- | --- | --- |
| `branch-pr` | Create Gentle AI pull requests with issue-first checks. Trigger: creating, opening, or preparing PRs for review. | user | `/home/alex_buelvas/.agents/skills/branch-pr/SKILL.md` |
| `chained-pr` | Trigger: PRs over 400 lines, stacked PRs, review slices. Split oversized changes into chained PRs. | user | `/home/alex_buelvas/.agents/skills/chained-pr/SKILL.md` |
| `work-unit-commits` | Plan commits as reviewable work units. Trigger: implementation, commit splitting, chained PRs. | user | `/home/alex_buelvas/.agents/skills/work-unit-commits/SKILL.md` |
| `issue-creation` | Trigger: issue creation, bug reports, feature requests, or issue approval. | user | `/home/alex_buelvas/.agents/skills/issue-creation/SKILL.md` |

### Code Quality

| Skill | Trigger / description | Scope | Path |
| --- | --- | --- | --- |
| `judgment-day` | Trigger: judgment day, dual review, adversarial review, juzgar. | user | `/home/alex_buelvas/.agents/skills/judgment-day/SKILL.md` |
| `rdd-defect-workflow` | Trigger: RDD, receipt-driven development, review authority. | user | `/home/alex_buelvas/.agents/skills/rdd-defect-workflow/SKILL.md` |
| `systemic-issue-triage` | Trigger: new issue, bug report, triage, backlog. | user | `/home/alex_buelvas/.agents/skills/systemic-issue-triage/SKILL.md` |

### Documentation & Communication

| Skill | Trigger / description | Scope | Path |
| --- | --- | --- | --- |
| `cognitive-doc-design` | Design docs that reduce cognitive load. Trigger: writing guides, READMEs, RFCs. | user | `/home/alex_buelvas/.agents/skills/cognitive-doc-design/SKILL.md` |
| `comment-writer` | Write warm, direct collaboration comments. Trigger: PR feedback, issue replies. | user | `/home/alex_buelvas/.agents/skills/comment-writer/SKILL.md` |

### Skill Management

| Skill | Trigger / description | Scope | Path |
| --- | --- | --- | --- |
| `skill-creator` | Trigger: new skills, agent instructions, documenting AI usage patterns. | user | `/home/alex_buelvas/.agents/skills/skill-creator/SKILL.md` |
| `skill-improver` | Trigger: improve skills, audit skills, refactor skills. | user | `/home/alex_buelvas/.agents/skills/skill-improver/SKILL.md` |
| `skill-registry` | Trigger: update skills, skill registry, after skill changes. | user | `/home/alex_buelvas/.agents/skills/skill-registry/SKILL.md` |
| `find-skills` | Helps users discover and install agent skills. | user | `/home/alex_buelvas/.agents/skills/find-skills/SKILL.md` |

### Domain-Specific

| Skill | Trigger / description | Scope | Path |
| --- | --- | --- | --- |
| `go-testing` | Trigger: Go tests, go test coverage, Bubbletea teatest, golden files. | user | `/home/alex_buelvas/.agents/skills/go-testing/SKILL.md` |
| `heroui-react` | HeroUI v3 React component library. Use when building UIs with HeroUI. | user | `/home/alex_buelvas/.agents/skills/heroui-react/SKILL.md` |
| `gentle-ai-bench` | Trigger: bench, journey, journeys, driven mode. | user | `/home/alex_buelvas/.agents/skills/gentle-ai-bench/SKILL.md` |
| `diagnose-crash` | Diagnose why a program crashed. Triggers: crash, segfault, core dump. | user | `/home/alex_buelvas/.pi/agent/skills/diagnose-crash/SKILL.md` |
| `omarchy` | REQUIRED for Linux desktop customization. Triggers: Hyprland, window rules, themes. | user | `/home/alex_buelvas/.pi/agent/skills/omarchy/SKILL.md` |

## Loading protocol

1. Match task context and target files against the `Trigger / description` column.
2. Pass only the matching `Path` values to the subagent under `## Skills to load before work`.
3. Instruct the subagent to read those exact `SKILL.md` files before reading, writing, reviewing, testing, or creating artifacts.
4. If no matching skill exists, proceed without project skill injection and report `skill_resolution: none`.
