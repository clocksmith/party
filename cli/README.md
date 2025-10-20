# CLI Tools

Command-line interface tools for interacting with the DMX laser control system.

## What's Here

This directory contains the command-line applications that provide user interaction with the DMX laser control framework:

- **dmx-cli.js** - Main CLI application with interactive wizards and control panels
- **pattern-editor-cli.js** - Interactive pattern editor with real-time visualization

## Why It's Here

These CLI tools are separated from the core library (`laser/`) to maintain a clean separation between:
- Core library logic (pure functions, DMX control)
- User interface and interaction (CLI, blessed widgets)

This makes the core library reusable in different contexts (web apps, GUIs, scripts) without CLI dependencies.

## How It Works

### DMX CLI (dmx-cli.js)

The main CLI application provides several commands:

```bash
node cli/dmx-cli.js <command> [options]
```

**Commands:**
- `setup` - Interactive setup wizard with device detection
- `discover` - Pattern discovery mode for mapping DMX channels
- `control` - Launch blessed-based control panel
- `test` - Run automated test sequences
- `pattern` - Launch pattern editor or demo

**Architecture:**
- Uses `commander` for CLI argument parsing
- Uses `blessed` and `blessed-contrib` for terminal UI
- Imports core functionality from `../laser/`
- Maintains application state (connection, profiles, patterns)

**Key Features:**
- Non-interactive mode support for CI/CD
- Configuration saving/loading
- Real-time DMX monitoring
- Keyboard shortcuts for quick control

### Pattern Editor CLI (pattern-editor-cli.js)

Interactive terminal-based pattern editor:

```bash
node cli/pattern-editor-cli.js
```

**Features:**
- Visual canvas for pattern preview
- Parameter sliders (speed, size, color)
- Timeline visualization
- Pattern library management
- Save/load pattern configurations

**Architecture:**
- Built with `blessed` terminal UI framework
- Uses `PatternAnimator` from `../laser/`
- Real-time rendering loop (~30fps)
- Event-driven keyboard controls

## Dependencies

**UI Libraries:**
- `blessed` - Terminal UI framework
- `blessed-contrib` - Charts and widgets
- `chalk` - Terminal colors
- `ora` - Spinners
- `cli-table3` - Tables
- `commander` - CLI parsing
- `readline` - Interactive prompts

**Core Libraries:**
- `../laser/*` - DMX control framework

## Usage Examples

### Basic Setup

```bash
# Interactive setup
node cli/dmx-cli.js setup

# Non-interactive with saved config
node cli/dmx-cli.js setup --non-interactive --config ./dmx-config.json
```

### Pattern Discovery

```bash
# Discover patterns on channels 2-4
node cli/dmx-cli.js discover --channels 2,3,4 --step 10 --output discovered.json
```

### Control Panel

```bash
# Launch with specific profile
node cli/dmx-cli.js control --profile ehaho-l2400.json --port /dev/ttyUSB0
```

### Pattern Editor

```bash
# Launch pattern editor
node cli/pattern-editor-cli.js

# Run pattern demo
node cli/dmx-cli.js pattern --demo
```

## Entry Points

Both CLI tools are:
1. **Directly executable** via `node cli/<file>.js`
2. **Accessible via npm scripts** in `../package.json`
3. **Optionally installed globally** via `npm link`

The main CLI is also exposed as a bin command `dmx` when installed.

## Development

### Adding New Commands

To add a new command to dmx-cli.js:

1. Add command definition using `commander`:
```javascript
program
    .command('mycommand')
    .description('What it does')
    .option('-f, --flag', 'Option description')
    .action(async (options) => {
        // Implementation
    });
```

2. Update help text and documentation
3. Add corresponding npm script in package.json
4. Write tests in `../test/`

### UI Guidelines

- Use `chalk` for colored output
- Use `ora` for long-running operations
- Use `blessed` for interactive interfaces
- Keep CLI responsive (show progress, handle Ctrl+C)
- Provide `--help` for all commands

## Testing

CLI tools can be tested with:
- Mock DMX hardware (`../laser/dmx-mock.js`)
- Automated test scenarios
- Manual integration testing with real hardware

```bash
# Test with mock device
node cli/dmx-cli.js test --mock

# Test setup wizard (requires interaction)
node cli/dmx-cli.js setup
```

## Future Enhancements

Planned improvements for CLI tools:
- Web-based control panel (alternative to terminal UI)
- Remote control via WebSocket
- Multi-device orchestration UI
- Pattern synchronization interface
- Visual feedback integration (for PARTY project)
