# Project PARTY

**Perception-Action Reconstruction & Tooling Yard**

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](package.json)

---

## Vision

An autonomous AI system that can reverse-engineer unknown DMX laser hardware using only visual feedback—transforming opaque devices into fully understood, programmable creative instruments without human intervention.

### What Project PARTY Does

An AI agent equipped with a camera watches a laser projector as it systematically tests different control commands. By analyzing what it sees, the agent autonomously:

• **Discovers** which DMX channels control position, color, intensity, patterns, and other features
• **Calibrates** the hardware by building mathematical models of non-linear responses
• **Generates** a clean, high-level Python API (e.g., `laser_canvas.draw_line()`, `draw_circle()`)
• **Validates** its own code through visual feedback until geometric primitives meet strict quality thresholds (>95% accuracy)
• **Enables** creative use where a developer can say "draw a spinning rainbow spiral" and the system instantly translates this into precise DMX commands

### Why This Matters

Most DMX laser hardware ships with incomplete documentation, proprietary software, or cryptic control schemes. Manual reverse-engineering is tedious, error-prone, and time-consuming. Project PARTY automates this process, making any laser device instantly programmable and accessible to creative developers.

---

## Key Objectives

1. **Autonomous Hardware Discovery** → Identify channel functions without prior device knowledge
2. **Calibration & Characterization** → Build precise mathematical models of channel behavior including non-linearities
3. **API Generation** → Automatically write intuitive libraries that abstract low-level DMX details
4. **Validation & Refinement** → Continuously improve through visual feedback loops
5. **Creative Enablement** → Transform the system into a real-time creative tool for laser art
6. **Scientific Measurement** → Instrument the process to measure and compare LLM capabilities in real-world robotics tasks

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   HOST PC (Strategist)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Experiment   │←→│ Coder Agent  │←→│  Knowledge Base  │  │
│  │   Engine     │  │    (LLM)     │  │  • Channels      │  │
│  │ • Planning   │  │ • Generation │  │  • Curves        │  │
│  │ • Evaluation │  │ • Refinement │  │  • API Code      │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓ ↑
                    [WebSocket / REST]
                           ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│               JETSON AGX ORIN (Tactical)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ DMX Service  │  │  Execution   │  │ Vision Service  │   │
│  │ • pyserial   │  │   Sandbox    │  │ • Camera        │   │
│  │ • Break/MAB  │  │ • AST valid. │  │ • Blob detect   │   │
│  │ • 512 ch buf │  │ • Timeouts   │  │ • Line analysis │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         ↓                  ↓                    ↑
   [USB Serial]       [Generated Code]      [Camera]
         ↓                  ↓                    ↑
┌─────────────────────────────────────────────────────────────┐
│                      HARDWARE LAYER                         │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────────┐  │
│  │ USB-to-DMX  │→  │ Laser Device │→  │   Projection    │  │
│  │ Controller  │   │ (Unknown Cfg)│   │    Surface      │  │
│  └─────────────┘   └──────────────┘   └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Learning Loop:** Host generates code → Jetson executes → Laser projects → Camera captures → Vision analyzes → Host evaluates → Knowledge updates → Repeat

---

## Discovery Process (9 Stages)

| Stage | Task                           | Duration    | Outcome                                  |
|-------|--------------------------------|-------------|------------------------------------------|
| 1.1   | Initial Response Detection     | 15-30 min   | Identify responsive channels             |
| 1.2   | Mode & Intensity Discovery     | 20-40 min   | Map control channels (mode, brightness)  |
| 1.3   | Spatial Control Discovery      | 30-60 min   | Identify X/Y position channels           |
| 1.4   | Color Discovery                | 20-40 min   | Map RGB or palette controls              |
| 1.5   | Calibration & Non-linearity    | 40-80 min   | Build mathematical correction models     |
| 1.6   | Advanced Feature Discovery     | 30-60 min   | Find rotation, zoom, pattern channels    |
| 1.7   | Primitive Synthesis            | 60-120 min  | Generate draw_line(), draw_circle()      |
| 1.8   | Complex Primitive Library      | 60-120 min  | Rectangles, polygons, bezier curves      |
| 1.9   | Final Validation Suite         | 20-40 min   | Comprehensive testing (>92% quality)     |

**Total Time:** ~4-7 hours for complete autonomous discovery and API generation

---

## Hardware Requirements

### Tactical Edge Computer (Options)

• **Primary:** NVIDIA Jetson AGX Orin 64GB (~$2,000) – 275 TOPS AI performance
• **High-End:** NVIDIA Jetson Thor T5000 (~$3,500+) – 7.5× faster than AGX Orin
• **Mid-Range:** Qualcomm Robotics RB5 (~$600-800) – 15 TOPS, 7 concurrent cameras
• **Budget:** Rockchip RK3588 + Hailo-8 (~$300-500) – 32 TOPS combined

### Camera System (Critical)

• **Recommended:** FRAMOS FSM-IMX273C + FSA-FTX1 Adapter (~$530) – Sony Pregius sensor, maximum data fidelity
• **Alternative:** Basler daA1920-160uc + BCON Adapter (~$630) – Industrial reliability, Pylon SDK
• **Requirement:** Global shutter sensor (no rolling shutter artifacts)

### Host PC (Strategist)

• **Primary:** AMD Threadripper PRO 7995WX (96 cores Zen 4) + 128GB RAM + RTX 6000 Ada (~$20,000-25,000)
• **2025 Next-Gen:** AMD Threadripper PRO 9995WX (Zen 5) + 128GB DDR5-6400 (~$22,000-28,000) – 49% faster LLM inference
• **Intel Alternative:** Xeon W9-3495X (56 cores) + 128GB RAM + RTX 6000 Ada (~$18,000-22,000)
• **Budget:** AMD Ryzen 9 7950X3D + 64GB RAM + RTX 4090 (~$5,000-8,000)

### Total System Cost Estimates

• **High-End:** $30,000-40,000 (Threadripper PRO 9995WX + Jetson Thor + FRAMOS)
• **Recommended:** $22,000-27,000 (Threadripper PRO 7995WX + Jetson AGX Orin + FRAMOS)
• **Budget:** $8,000-12,000 (Ryzen 9 7950X3D + RK3588+Hailo-8 + Basler)

---

## Implementation Status

**Current:** Proposed architecture only. No implementation has begun.

**Foundation:** The existing DMX512 control framework (in `laser/`) provides the starting point for Project PARTY's tactical layer. This is a fully functional, production-ready system for manual DMX laser control.

For complete architectural details, see **[docs/FUTURE-DEVELOPMENT.md](docs/FUTURE-DEVELOPMENT.md)**

---

## Project Structure

```
party/
├── laser/              # DMX512 control framework (foundation layer)
│   └── README.md       # Laser library documentation
├── cli/                # Command-line tools
├── examples/           # Example scripts and demos
├── docs/               # Project documentation
├── test/               # Test suites
├── device-profiles/    # Device configuration files
└── patterns/           # Pattern library
```

---

## Getting Started

### Prerequisites

• Node.js v16.0.0 or higher
• DMX interface (ENTTEC DMX USB Pro or compatible)
• Linux, macOS, or Windows

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/party.git
cd party

# Install dependencies
npm install

# Test the DMX framework
npm test
```

### Quick Test (No Hardware Required)

```bash
# Run mock hardware tests
node test/system/test-run.js
```

### Using the DMX Control Framework

The laser control framework is ready to use now. See **[laser/README.md](laser/README.md)** for complete documentation on:

• Setting up DMX interfaces
• Discovering device patterns
• Creating device profiles
• Real-time control interfaces
• Pattern animation

---

## Roadmap

### Phase 1: Foundation (Current)
- [x] DMX512 control framework
- [x] Device profile system
- [x] Pattern discovery tools
- [x] Mock hardware environment

### Phase 2: Vision & Feedback (Q1 2025)
- [ ] Camera integration
- [ ] Blob detection algorithms
- [ ] Line/shape recognition
- [ ] Visual feedback metrics

### Phase 3: Agent Intelligence (Q2 2025)
- [ ] LLM integration for code generation
- [ ] Experiment planning engine
- [ ] Knowledge base persistence
- [ ] Multi-stage discovery pipeline

### Phase 4: Calibration & API (Q3 2025)
- [ ] Non-linearity modeling
- [ ] High-level API generation
- [ ] Validation framework
- [ ] Performance benchmarking

### Phase 5: Production & Scale (Q4 2025)
- [ ] Multi-device support
- [ ] Cloud orchestration
- [ ] Web interface
- [ ] Public dataset release

---

## Contributing

We welcome contributions! Areas of interest:

• Computer vision algorithms for laser pattern recognition
• LLM prompt engineering for hardware discovery
• DMX device profile creation
• Test scenarios and benchmarks

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## Research Applications

Project PARTY is designed as a platform for studying:

• **Embodied AI:** How LLMs interact with physical systems through sensing and actuation
• **Active Learning:** Optimal experiment design for hardware characterization
• **Code Generation:** LLM capabilities in generating domain-specific APIs
• **Vision-Language Integration:** Closing the loop between visual feedback and code generation
• **Robotic Calibration:** Automated parameter identification for complex systems

We encourage researchers to use this platform for experiments and welcome academic collaborations.

---

## License

MIT License – see [LICENSE](LICENSE).

---

## Citation

If you use Project PARTY in your research, please cite:

```bibtex
@software{party2024,
  title = {Project PARTY: Perception-Action Reconstruction \& Tooling Yard},
  author = {Your Name},
  year = {2024},
  url = {https://github.com/yourusername/party}
}
```

---

## Contact

• Issues: [GitHub Issues](https://github.com/yourusername/party/issues)
• Discussions: [GitHub Discussions](https://github.com/yourusername/party/discussions)
• Email: research@example.com

---

**⚠ Safety Warning:** This project involves laser equipment and autonomous systems. Always follow laser safety regulations, wear appropriate protective equipment, and maintain human oversight during experiments.
