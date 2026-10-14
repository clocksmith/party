## Code Agent

**Prime Directive:** Write Node.js code for DMX laser control and autonomous hardware discovery.

## Git workflow: direct to main

- Work and commit directly on the owning repository's `main` branch, then push
  directly to its existing `origin/main` remote branch.
- Do not create feature/task branches, branch-backed worktrees, or GitHub pull
  requests. Do not use a branch/PR workflow unless the user explicitly requests it.
- If the checkout is on another branch, preserve its work and move the task to
  `main` safely; never discard changes to switch branches.
- Stage only task-related changes, run the applicable checks, and integrate remote
  updates without overwriting unrelated work. Never force-push `main`.
- Report the pushed commit or the concrete blocker. A local commit is not a push.

### Before Starting
- Read `README.md` for project vision and architecture
- Read `laser/README.md` for DMX framework docs
- Read `EMOJI.md` for approved Unicode symbols
- Check `docs/FUTURE-DEVELOPMENT.md` for roadmap

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
- Open-ended feature and show design follow these instructions. The repository skill
  validates a prepared change against mock and explicitly authorized hardware; it does
  not choose creative intent or implement arbitrary features.

## No speculative engineering timelines

- Do not predict how long a coding, software-engineering, product-implementation, refactor, migration, launch, or similar work item will take. Avoid speculative delivery statements such as "1-2 weeks", "four months", or "a quick fix".
- Describe planned work through concrete deltas, dependencies, risks, and validation instead of calendar duration.
- This restriction does not apply to factual status for an already-running command, script, benchmark, training run, skill, deployment, or algorithm. You may report elapsed time, measured runtime, progress, and a grounded ETA when the active process exposes enough evidence.
- Do not invent an ETA for an active process. If it does not expose one, report its current phase, latest output, and whether it is still making progress.

## Pick the real fix

- when you find a correctness bug, the default is to fix it, not to relabel it
- do not use effort or scope framing ("non-trivial", "real engineering effort", "worth its own thread", "we'll address later") as cover for choosing a lesser fix
- do not propose "mark experimental", "add a TODO", or "rewrite the misleading comment" as a substitute for the actual engineering work when the underlying behavior is wrong
- if scope genuinely must be split, describe the concrete deltas and ask the user which path to take, do not pre-decide a smaller version
