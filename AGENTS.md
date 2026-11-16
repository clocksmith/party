## Code Agent

**Prime Directive:** Write Node.js code for DMX laser control and autonomous hardware discovery.

## Build boldly

Understand → inspect → build → run → diagnose → improve → deliver.

- Start from the requested outcome and the existing implementation. Read the
  relevant code, and compare with working alternatives, before guessing.
- Make the most direct substantive change. Large refactors, replacement
  implementations, aggressive prototypes and speculative ideas are allowed when
  they serve the goal.
- Run the changed system early. Fix the failures you cause; don't stop at a
  plan, scaffold or failing test.
- If the result misses the goal, find the reason in the code and behavior,
  change it and repeat. Sweep parameters only to answer a real question. When a
  strategy is clearly failing, try a materially different one.
- Make routine design and implementation choices yourself. Ask only for a
  consequential product choice, access you lack, or a blocker you can't
  resolve safely.
- Commit coherent, tested progress often, and keep going while the requested
  outcome is unfinished.
- Done means the requested behavior works and was exercised against a
  real-world or competitive baseline. A passing unit test, receipt, report,
  scaffold or milestone is not completion.
- GOALS, INTENT, CATSCAN and charters are references to look up, not reading
  required before editing.
- Report results: what changed, the evidence, what remains, and blockers only
  when they need the owner or unavailable access. No completion percentages.

## Git workflow: direct to main

- Commit on the owning repo's `main` and push to `origin/main`. No feature
  branches, branch-backed worktrees, or PRs unless the user asks for them.
- On another branch, preserve its work and move the task to `main` safely;
  never discard changes to switch. Never force-push `main`.
- Stage only task-related changes; integrate remote updates without
  overwriting unrelated work.
- Report the pushed commit or the concrete blocker. A local commit is not a push.

### Before Starting
- Read `README.md` (vision, architecture) and `laser/README.md` (DMX framework)
- Roadmap: `docs/FUTURE-DEVELOPMENT.md`

### Key Paths
- `laser/` - DMX512 control framework
- `cli/` - Command-line tools
- `device-profiles/` - Device configuration files
- `patterns/` - Pattern library
- `test/` - Test suites

### Guardrails
- Enforce `EMOJI.md`; use only approved Unicode symbols, no emojis
- Never exceed amplitude limits from `device-profiles/*.json`
- Follow laser safety regulations
- Test with mock hardware before real devices

### Development
```bash
npm install
npm test                        # Run tests
node test/system/test-run.js    # Mock hardware tests
```

## Development verification

- During development, choose checks for the changed behavior: syntax/type checks,
  existing focused tests, or a local visual check. A command list is not a requirement
  to run every suite before each commit, push, or ordinary application deployment.
- Do not automatically run full repository suites, broad browser/device matrices,
  GPU/model campaigns, benchmarks, or full release qualification. Run them when
  explicitly requested or when a named correctness question cannot be answered by
  focused checks; state that reason before starting.
- Config-contract, mirror, drift, and freshness checks run only when the change
  edits what they check. Don't add tests that just restate another file or pin
  config literals. Time-box long processes.
- Once relevant checks pass, continue. Repeat or broaden verification only after
  another relevant change, a failure, or a concrete unresolved concern.
- For documentation-only edits, inspect the diff and changed links. Do not run
  application, GPU, browser, or benchmark suites for prose changes.
- For ordinary deployments, build the changed artifact where needed and check the
  affected route after deployment. Deployment alone does not require a new release
  qualification campaign.
- Keep existing acceptance thresholds and release-qualification requirements.
  Report exactly what was checked; focused development checks do not establish
  numerical qualification, performance, multi-device support, or full acceptance.

## Intent-First Operations

- Treat Party intent as hardware-safe laser/DMX control, not visual show copy.
- If the user asks what a pattern/device/control does, map the device profile, amplitude limits, fixture channels, and test path before recommending changes.
- Do not infer show direction, intensity, or hardware risk tolerance; the user sets creative intent, implementation enforces safety.
- Mock hardware tests prove command logic only. Real hardware claims require the real device path and safety constraints.
- If a fixture behaves incorrectly, inspect the device profile and generated DMX frames before changing UI labels.
- The repository skill only validates a prepared change against mock and explicitly
  authorized hardware; feature and show design follow these instructions.

## No speculative engineering timelines

- Never predict how long engineering work will take ("1-2 weeks", "a quick
  fix"). Describe concrete deltas, dependencies, risks, and validation instead.
- For an already-running process, report measured elapsed time, progress, or a
  grounded ETA only when the process exposes one; otherwise report its phase,
  latest output, and whether it is still progressing.

## Pick the real fix

- Fix correctness bugs; don't relabel them. Effort or scope framing
  ("non-trivial", "worth its own thread", "later") is no reason for a lesser fix.
- "Mark experimental", "add a TODO", or "reword the misleading comment" does not
  substitute for fixing wrong behavior.
- Take the stronger path and do it. Stop to ask only when the choice changes
  product direction; don't pre-decide a smaller version.
