# Documentation

Project documentation, architecture specs, and technical references.

## What's Here

Comprehensive documentation for Project PARTY and the laser control framework:

- **FUTURE-DEVELOPMENT.md** - Project PARTY architecture and roadmap
- **DMX-CHANNEL-REFERENCE.md** - DMX512 protocol and channel mapping reference
- **DMX-CANVAS-README.md** - Canvas drawing API documentation
- **dmx-orchestrator-README.md** - Multi-device orchestration guide
- **QUICK-REFERENCE.md** - Quick command and API reference

## Why It's Here

Documentation is separated into its own directory to:
- Keep the root directory clean
- Make docs easy to find and navigate
- Allow documentation versioning
- Support automated doc generation
- Enable collaborative doc editing

## How It Works

### Documentation Structure

**Architecture & Vision:**
- `FUTURE-DEVELOPMENT.md` - The complete Project PARTY vision, including hardware requirements, discovery stages, and implementation plan

**Technical References:**
- `DMX-CHANNEL-REFERENCE.md` - Deep dive into DMX512 protocol, typical laser channel mappings, and hardware specifics
- `DMX-CANVAS-README.md` - Canvas abstraction layer for drawing primitives on lasers
- `dmx-orchestrator-README.md` - Coordinating multiple fixtures and priority management

**Quick Guides:**
- `QUICK-REFERENCE.md` - Cheat sheet for common commands and patterns

## Documentation by Audience

### For Researchers (Project PARTY)

Start with:
1. `../README.md` - Project overview and goals
2. `FUTURE-DEVELOPMENT.md` - Detailed architecture
3. Explore the laser control foundation in `../laser/`

### For Developers (Laser Control)

Start with:
1. `../laser/README.md` - Library overview
2. `QUICK-REFERENCE.md` - Common tasks
3. `DMX-CHANNEL-REFERENCE.md` - Understanding DMX
4. `../examples/` - Working code samples

### For Hardware Makers

Start with:
1. `DMX-CHANNEL-REFERENCE.md` - DMX protocol details
2. `../device-profiles/` - Profile format
3. CLI discovery tools in `../cli/`

## Contributing Documentation

### Adding New Docs

1. Create well-structured markdown files
2. Use clear headings and sections
3. Include code examples where relevant
4. Add diagrams for complex concepts
5. Update this README's table of contents

### Documentation Standards

**Formatting:**
- Use GitHub-flavored markdown
- Include code blocks with language hints
- Add mermaid diagrams for architecture
- Use tables for reference information

**Style:**
- Write in present tense
- Use active voice
- Keep sentences concise
- Define acronyms on first use

**Structure:**
- Start with a brief overview
- Organize with clear headings
- Include practical examples
- End with next steps or references

### Updating Existing Docs

When code changes:
1. Review affected documentation
2. Update examples and APIs
3. Verify links still work
4. Update version references
5. Note breaking changes

## Building Documentation

### Viewing Locally

All docs are markdown and can be viewed in any text editor or markdown previewer:

```bash
# Preview in VS Code
code docs/

# Convert to HTML (if pandoc installed)
pandoc FUTURE-DEVELOPMENT.md -o FUTURE-DEVELOPMENT.html

# View in terminal
cat docs/QUICK-REFERENCE.md | less
```

### Generating API Docs

For automated API documentation from code comments:

```bash
# Using JSDoc (if configured)
npm run docs:generate

# Output to docs/api/
```

## Documentation Roadmap

Planned documentation additions:

- [ ] API reference (generated from JSDoc)
- [ ] Tutorial series (beginner to advanced)
- [ ] Troubleshooting guide
- [ ] Hardware compatibility matrix
- [ ] Video tutorials and demos
- [ ] Research paper (for PARTY project)

## External Resources

Related documentation:
- [DMX512 Standard](https://www.esta.org/tsp/documents/docs/ANSI-ESTA_E1-11_2008R2018.pdf)
- [ANSI E1.11 DMX512-A](https://tsp.esta.org/tsp/documents/published_docs.php)
- [Node.js SerialPort](https://serialport.io/docs/)

## License

All documentation is licensed under MIT, same as the code.
