# Future Development Plans

This document outlines advanced development plans and experimental features for the DMX Laser Control System. The primary focus is **Project PARTY** (Perception-Action Reconstruction & Tooling Yard), an ambitious AI-driven research initiative that will autonomously reverse-engineer unknown DMX laser hardware using computer vision feedback.

**What This Document Contains:**

- **Project PARTY:** A complete architectural plan for an autonomous system where an AI agent discovers, calibrates, and generates a high-level programming library for unknown DMX laser devices
- **Detailed technical specifications** for distributed AI architecture (Host strategist + Jetson tactician)
- **9-stage discovery curriculum** from initial hardware probing through validated API generation
- **Complete implementation roadmap** including hardware requirements, software architecture, security considerations, and instrumentation strategy
- **Real-world example** showing a 347-step learning trajectory that takes ~4 hours to fully characterize a laser device

**Target Audience:** AI researchers, robotics engineers, DMX lighting developers, and anyone interested in autonomous hardware discovery systems.

**Current Status:** Proposed architecture only. No implementation has begun.

---

## Table of Contents

1. [Primary Goal](#primary-goal) - The core objectives and vision
2. [System Architecture](#system-architecture) - Distributed AI design (Host + Jetson)
3. [Communication Protocol](#communication-protocol-considerations) - WebSocket vs REST analysis
4. [Code Execution Architecture](#code-execution-architecture-why-strategist-generated-code-runs-on-the-tactical-layer) - Why and how code runs on Jetson
5. [Phase 0: Foundation](#phase-0-foundation---system-infrastructure--start-context) - Hardware and software infrastructure setup
6. [Phase 1: Automated Discovery](#phase-1-the-automated-self-discovery-process) - The 9-stage learning curriculum
   - [Discovery Substages](#discovery-substages) (1.1 through 1.9)
   - [API Contracts](#2-detailed-data-models--api-contracts) (REST and WebSocket)
   - [Learning Feedback Loop](#3-the-primary-learning-feedback-loop)
   - [Knowledge Base Schema](#4-knowledge-base-schema)
   - [HITL Intervention](#5-human-in-the-loop-hitl-intervention)
   - [Example Learning Trajectory](#6-example-learning-trajectory)
7. [Phase 2: Interactive Application](#phase-2-interactive--creative-application) - Creative canvas mode
8. [Instrumentation & Measurement](#instrumentation--measurement-plan) - MLflow/wandb tracking
9. [Expected Outcomes](#expected-outcomes)
10. [Risks & Mitigations](#technical-risks--mitigation-strategies)
11. [Dependencies & Prerequisites](#dependencies--prerequisites)
12. [Success Criteria](#success-criteria)
13. [Future Extensions](#future-extensions)

---

## Project PARTY: Perception-Action Reconstruction & Tooling Yard

### **Overview**

An ambitious research initiative to create a system where an AI agent, using visual feedback, autonomously reverse-engineers an unknown DMX laser system, generates a high-level programming library for it, and then enables its use as a real-time creative tool.

This represents a transition from manual hardware characterization to autonomous system learning through perception-action loops.

---

### **Primary Goal**

The primary goal of Project PARTY is to create an autonomous system where an AI agent can fully reverse-engineer an unknown DMX laser device using only visual feedback. By systematically probing the hardware and analyzing the visual results, the agent will discover, document, and validate its own high-level programming library from scratch—transforming initially opaque hardware into a fully understood and controllable creative instrument.

**Key Objectives:**

1. **Autonomous Hardware Discovery:** The agent must identify which DMX channels control which functions (position, color, intensity, pattern selection, rotation, etc.) without any prior device knowledge
2. **Calibration & Characterization:** Build precise mathematical models of channel behavior, including non-linear responses, value ranges, and inter-channel dependencies
3. **API Generation:** Automatically write a clean, high-level Python library (e.g., `laser_canvas.py`) with intuitive functions like `draw_line()`, `draw_circle()`, `set_color()` that abstract away the low-level DMX channel details
4. **Validation & Refinement:** Continuously test and improve the generated API through visual feedback until it meets strict quality thresholds (>95% accuracy for geometric primitives)
5. **Creative Enablement:** Transform the system into a real-time creative tool where developers and AI agents can generate complex laser graphics using simple, high-level commands
6. **Scientific Measurement:** Instrument the entire discovery process to serve as a rigorous, repeatable experiment for measuring and comparing the problem-solving, code generation, and error-correction capabilities of different large language models in real-world robotics tasks

**Ultimate Vision:**

A developer (or another AI agent) can say "draw a spinning rainbow spiral" and the system—having autonomously learned the hardware—instantly translates this into precise DMX commands that produce the desired visual effect. This same framework can then be applied to any DMX-compatible device, creating a universal, self-learning creative canvas for laser art, stage lighting, and beyond.

---

### **System Architecture**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            HOST PC (Strategist)                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      Experiment Engine                            │  │
│  │  - Goal planning & sequencing                                     │  │
│  │  - Prompt construction with context                               │  │
│  │  - Success/failure evaluation                                     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    ↓ ↑                                  │
│  ┌──────────────────────┐    ┌────────────────────┐    ┌─────────────┐ │
│  │   State Manager      │←→  │  Coder Agent (LLM) │←→  │  Knowledge  │ │
│  │  - Current phase     │    │  - Code generation │    │    Base     │ │
│  │  - Goal tracking     │    │  - Error analysis  │    │  - Channels │ │
│  │  - Attempt counts    │    │  - Refinement      │    │  - Curves   │ │
│  │  - HITL triggers     │    └────────────────────┘    │  - API code │ │
│  └──────────────────────┘                              └─────────────┘ │
│                                    ↓ ↑                                  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Instrumentation Layer                          │  │
│  │        (MLflow / Weights & Biases)                                │  │
│  │  - Metrics, latencies, token usage, vision reports                │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓ ↑
                         [REST API over local network]
                                    ↓ ↑
┌─────────────────────────────────────────────────────────────────────────┐
│                        JETSON AGX ORIN (Tactical)                       │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      FastAPI Server                               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│           ↓                      ↓                       ↓               │
│  ┌───────────────┐    ┌──────────────────┐    ┌──────────────────────┐ │
│  │ DMX Service   │    │ Execution Sandbox│    │   Vision Service     │ │
│  │ - pyserial    │    │ - AST validation │    │ - Camera capture     │ │
│  │ - Break/MAB   │    │ - Timeout mgmt   │    │ - Blob detection     │ │
│  │ - 512 ch buf  │    │ - Sandboxed exec │    │ - Line analysis      │ │
│  └───────────────┘    └──────────────────┘    │ - Shape classification│ │
│         ↓                      ↓               │ - Quality scoring    │ │
│         ↓              ┌──────────────────┐    └──────────────────────┘ │
│         ↓              │  Generated Code  │             ↓                │
│         ↓              │  (sandboxed)     │             ↓                │
│         ↓              └──────────────────┘             ↓                │
│         ↓                      ↓                        ↓                │
└─────────┼──────────────────────┼────────────────────────┼────────────────┘
          ↓                      ↓                        ↑
    [USB Serial]         [DMX Channels]              [Camera]
          ↓                      ↓                        ↑
┌─────────────────────────────────────────────────────────────────────────┐
│                             HARDWARE LAYER                              │
│  ┌──────────────┐       ┌────────────────┐       ┌──────────────────┐  │
│  │ USB-to-DMX   │  ───→ │  Laser Device  │  ───→ │  Projection      │  │
│  │ Controller   │       │  (Unknown Cfg) │       │  Surface         │  │
│  └──────────────┘       └────────────────┘       └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Data Flows:**

1. **Learning Loop:** Host → Code Generation → Jetson Execution → Laser Projection → Camera Capture → Vision Analysis → Host Evaluation → Knowledge Update
2. **State Persistence:** Every state change is written to `session.json` for crash recovery and reproducibility
3. **Instrumentation:** All requests, responses, metrics, and decisions are logged to MLflow/wandb with unique `run_id` and `step_id` tags
4. **HITL Intervention:** When stuck, system pauses and presents diagnostic dashboard for human hints

**Communication Protocol Considerations:**

While the initial design specifies REST API for simplicity, **WebSockets** should be strongly considered for the Host ↔ Jetson communication layer due to significant performance advantages:

**WebSocket Benefits:**
- **Lower Latency:** Eliminates HTTP overhead (~20-50ms per request/response cycle)
- **Bidirectional Streaming:** Jetson can push vision updates immediately when available, rather than waiting for polling
- **Real-time Feedback:** During code execution, Jetson can stream live logs and intermediate vision frames for debugging
- **Connection Efficiency:** Single persistent connection vs. repeated TCP handshakes for REST
- **Frame Streaming:** For advanced HITL debugging, live video feed can be streamed to the Host dashboard

**Recommended Hybrid Approach:**
- **REST endpoints** for simple, idempotent operations: `/health`, `/status`, `/reset`
- **WebSocket channels** for performance-critical learning loop:
  - Channel `execution`: Bidirectional code execution and logging
  - Channel `vision`: Real-time vision analysis streaming
  - Channel `telemetry`: Continuous performance metrics (DMX frame rate, camera FPS, buffer states)

**Implementation:**
- Use FastAPI's native WebSocket support: `@app.websocket("/ws/execution")`
- Implement message framing with JSON or MessagePack for structured data
- Add reconnection logic with exponential backoff for network resilience
- Include heartbeat pings (every 5s) to detect disconnections

**Latency Targets:**
- REST: 30-80ms per request/response (acceptable for Phase 0 prototyping)
- WebSocket: 5-15ms per message (required for real-time learning loop optimization)

For Phase 0, REST is acceptable to quickly validate the architecture. **For Phase 1 production learning loops, WebSockets should be implemented** to minimize iteration time and enable real-time debugging capabilities.

**Code Execution Architecture: Why Strategist-Generated Code Runs on the Tactical Layer**

This architecture implements a **distributed embodied cognition** pattern where the strategist (Host LLM) generates code that executes on the tactical layer (Jetson). This design is crucial for several reasons:

**Why This Architecture:**

1. **Hardware Proximity:** The Jetson has direct physical connections to both the DMX controller (via USB serial) and the camera (via CSI/USB). Running code on the Jetson eliminates network latency for time-critical operations like precise DMX timing and synchronized vision capture.

2. **Real-time Control Requirements:** DMX Break/MAB timing requires microsecond precision. The Jetson's real-time capabilities and direct serial port access enable this, whereas sending individual channel updates over the network from the Host would introduce unacceptable jitter (30-80ms REST or 5-15ms WebSocket vs. <1ms local serial).

3. **Perception-Action Closure:** The generated code often needs to perform rapid perception-action loops (e.g., "set channel 7 to value X, wait 100ms, capture frame, analyze brightness, adjust"). These tight loops must run locally to avoid network round-trip delays.

4. **Bandwidth Efficiency:** Rather than streaming individual DMX channel updates (512 bytes × 30 fps = 15KB/s), the Host sends compact Python code once, which then executes hundreds of DMX frames locally on the Jetson.

5. **Autonomy & Resilience:** If the network connection is temporarily disrupted, the Jetson can continue executing the current code sequence and buffer vision results until reconnection.

**When Code is Transferred (Step-by-Step):**

```
┌─────────────────────────────────────────────────────────────────────┐
│ LEARNING LOOP ITERATION                                             │
└─────────────────────────────────────────────────────────────────────┘

[HOST] Step 1: ExperimentEngine queries StateManager for current goal
       → Current goal: "Discover X-axis position channel"

[HOST] Step 2: ExperimentEngine constructs context-rich prompt:
       "You have discovered that CH1 controls mode (set to 50 for DMX mode).
        Your task: Write Python code to test if CH7 controls X position.
        Sweep CH7 from 0 to 255 in steps of 32, holding for 100ms each.
        Available API: dmx.set_channel(ch, val), time.sleep(seconds)"

[HOST] Step 3: CoderAgent (LLM) generates Python code:
       ```
       for val in range(0, 256, 32):
           dmx.set_channel(1, 50)  # Ensure DMX mode
           dmx.set_channel(7, val) # Test X position hypothesis
           time.sleep(0.1)         # Hold for capture
       ```

[HOST → JETSON] Step 4: Host transmits code via REST/WebSocket
       POST /execute
       {
         "request_id": "step_089",
         "code": "for val in range(0, 256, 32):\n    dmx.set_channel(1, 50)\n...",
         "timeout_ms": 5000
       }

[JETSON] Step 5: ExecutionService receives code
       → AST validation (check for forbidden operations)
       → Create sandboxed execution environment with limited globals
       → Spawn isolated process with timeout watchdog

[JETSON] Step 6: Code executes on Jetson
       → Sets DMX channels via DMXService (local pyserial, <1ms latency)
       → DMX controller sends signals to laser
       → Laser beam moves through positions

[JETSON → HOST] Step 7: Execution completes, return status
       Response: {"status": "success", "logs": "Swept 9 positions", "duration_ms": 967}

[HOST → JETSON] Step 8: Host requests vision analysis
       GET /vision/analyze?request_id=step_089

[JETSON] Step 9: VisionService captures frame and analyzes
       → Capture from camera (local CSI interface, <20ms)
       → Run blob detection
       → Track centroid positions during sweep
       → Calculate correlation between CH7 value and X position

[JETSON → HOST] Step 10: Vision report returned
       {
         "analysis": {
           "correlation_x": 0.97,  # Strong X-axis correlation!
           "correlation_y": 0.02,  # No Y movement
           "confidence": 0.96
         }
       }

[HOST] Step 11: CoderAgent analyzes results
       "The correlation of 0.97 confirms CH7 controls X position!"

[HOST] Step 12: ExperimentEngine updates knowledge
       channel_map['x_pos'] = {channel: 7, confidence: 0.96}
       StateManager advances to next goal: "Discover Y-axis position channel"

[LOOP REPEATS]
```

**What the Generated Code Looks Like:**

Early in discovery (simple channel testing):
```python
# Generated by CoderAgent - Step 47
dmx.set_channel(1, 50)  # Enable DMX mode
for intensity in [0, 64, 128, 192, 255]:
    dmx.set_channel(6, intensity)
    time.sleep(0.2)  # Hold for vision capture
dmx.set_channel(6, 0)  # Turn off
```

Later in discovery (calibration):
```python
# Generated by CoderAgent - Step 134
# Calibrate X-axis non-linearity
import json
results = []
for val in range(0, 256, 13):  # 20 sample points
    dmx.set_channel(1, 50)
    dmx.set_channel(7, val)
    time.sleep(0.15)
    # Vision system will capture centroid after this run
results.append(val)
log(json.dumps({"sampled_values": results}))
```

During primitive synthesis (drawing functions):
```python
# Generated by CoderAgent - Step 192
# Draw line from (20, 20) to (100, 100)
def apply_calibration_x(raw_val):
    # Apply discovered polynomial correction
    return int(0.002 * raw_val**2 + 0.48 * raw_val + 10)

p1, p2 = (20, 20), (100, 100)
for i in range(50):  # 50 interpolation points
    t = i / 50.0
    x = p1[0] + t * (p2[0] - p1[0])
    y = p1[1] + t * (p2[1] - p1[1])
    dmx.set_channel(7, apply_calibration_x(int(x)))
    dmx.set_channel(8, int(y * 0.498 + 1.2))  # Linear Y calibration
    time.sleep(0.01)  # 10ms per point = 500ms total line
```

**Security Considerations:**

The generated code runs in a **heavily restricted sandbox**:
- AST analysis rejects any imports, file I/O, network access, subprocess calls
- Execution timeout (default 5s, max 60s for calibration)
- Limited global scope: only `dmx`, `time`, `log`, and basic math modules
- Isolated process that can be killed without affecting the Jetson server
- All code is logged to MLflow for audit trail

This architecture enables the strategist to **think** on powerful Host hardware while the tactician **acts** with low-latency access to physical hardware, creating an efficient embodied AI system.

---

### **Phase 0: Foundation - System Infrastructure & Start Context**

This is the manual engineering phase to create the stable, predictable environment upon which the AI will operate.

#### **1. Hardware & Network Infrastructure**

**Laser & Surface:**
- The laser must be in a fixed position
- The projection surface must be static, with consistent ambient lighting to ensure the vision system has a stable baseline

##### **Camera System (Critical Component)**

The camera system is crucial for Project PARTY's perception-action loop. Two professional-grade approaches are recommended:

**Option A: Basler dart BCON for MIPI - The Integrated Industrial System ($630)**
- **Philosophy:** Complete, polished ecosystem designed for industrial reliability
- **Components:**
  - Camera Module: Basler daA1920-160uc (1920×1200, AR0234 Color Global Shutter) - ~$450
  - Adapter Board: BCON for MIPI to Jetson Adapter Kit - ~$100
  - Lens: 16mm C-Mount Machine Vision Lens - ~$80
- **Key Advantages:**
  - **Pylon Software Suite:** Professional SDK with GUI-based pylon Viewer for manual parameter control before coding
  - **Stable V4L2 Driver:** Appears as standard `/dev/videoX` device, instantly compatible with OpenCV
  - **PGI Feature Set:** Hardware-accelerated 5×5 Debayering, Color Anti-Aliasing, and Improved Sharpness
  - **Industrial Reliability:** Built for continuous operation, critical for long learning sessions
- **Best For:** Users who value ease of setup, polished software experience, and guaranteed reliability

**Option B: FRAMOS Sensor Module Ecosystem - The Modular, Sensor-First Approach ($530)**
- **Philosophy:** Direct access to elite imaging sensors (especially Sony Pregius) in modular packages
- **Components:**
  - Sensor Module: FRAMOS FSM-IMX273C (1.58MP, Sony Pregius IMX273 Color Global Shutter) - ~$350
  - Adapter: FRAMOS FSA-FTX1 Adapter for Jetson AGX Orin - ~$150
  - Lens: 8mm S-Mount (M12) Lens - ~$30
- **Key Advantages:**
  - **Sony Pregius Sensor:** Industry-leading low noise, high dynamic range, superior global shutter efficiency
  - **Maximum Data Fidelity:** Near-perfect clarity for calibration phase where mathematical models are built
  - **Modularity:** Swap sensor modules without changing entire system
  - **Cost-Effective Performance:** Best possible image quality for the money
- **Best For:** Users who want absolute best raw sensor data and are comfortable with hands-on integration

**Recommendation for Project PARTY:**
The **FRAMOS with Sony Pregius sensor** is recommended because the experiment's success fundamentally depends on visual data quality. The AI agent must learn from the cleanest, most unambiguous data possible. While Basler's ease of use is compelling, providing top-tier sensor data will lead to more successful and repeatable experiments. The slightly higher integration effort is a one-time cost that pays dividends in data fidelity for every step of the learning loop.

##### **Tactical Edge Computer**

**Primary Recommendation: NVIDIA Jetson AGX Orin (64GB)**
- 2048-core Ampere GPU with 64GB unified memory
- 275 TOPS AI performance
- 8-channel DMX512 support via USB
- Flashed with latest NVIDIA JetPack
- Static IP address assigned for reliable network communication
- Estimated cost: $2,000

**Alternative Options:**

**High-End Alternative: NVIDIA Jetson Thor (T5000)**
- **Performance:** Up to 2070 FP4 TFLOPS, 128GB memory
- **AI Performance:** 7.5× faster than AGX Orin
- **Power:** Configurable 40W-130W
- **Availability:** Generally available (2025)
- **Best For:** Maximum performance, future-proofing
- **Estimated cost:** $3,500+

**Mid-Range Alternative: Qualcomm Robotics RB5**
- **Performance:** 15 TOPS (QRB5165 SoC with 5th-gen AI Engine)
- **Camera Support:** Up to 7 concurrent cameras (excellent for multi-angle vision)
- **Best For:** Multi-camera setups, cost-sensitive projects
- **Estimated cost:** $600-800

**Budget-Friendly Alternative: Rockchip RK3588 + Hailo-8**
- **Performance:** 6 TOPS (RK3588 NPU) + 26 TOPS (Hailo-8) = 32 TOPS combined
- **Efficiency:** Hailo-8 achieves ~10 TOPS/W (class-leading efficiency)
- **Best For:** Cost-effective deployments, excellent TOPS/$
- **Estimated cost:** $300-500

**Specialized Alternative: AMD Kria K26**
- **Performance:** 1.4 TOPS (Xilinx Zynq UltraScale+ MPSoC)
- **Best For:** Industrial computer vision, programmable hardware acceleration (FPGA)
- **Estimated cost:** $800-1,000

##### **Host PC (Strategist Domain)**

**Primary Recommendation: AMD Ryzen Threadripper PRO 7995WX**
- 96 cores / 192 threads (Zen 4 architecture)
- 8-channel DDR5-5200 memory support (up to 2TB)
- PCIe 5.0 support for high-end GPUs
- Estimated cost: $10,000 (CPU only)
- Full system with 128GB RAM, GPU: $18,000-25,000

**2025 Next-Gen Recommendation: AMD Ryzen Threadripper PRO 9995WX (Zen 5)**
- **Launch:** July 2025 (available via Dell, HP, Lenovo, Supermicro)
- **Performance:** 49% more tokens/sec than Intel Xeon W9-3595X for LLM inference (DeepSeek-R1 32B)
- **Cores:** Up to 96 Zen 5 cores with enhanced AVX-512
- **Memory:** 8-channel DDR5-6400 (significantly faster than previous gen)
- **AI Benchmark:** Up to 25% faster in SPECworkstation 4.0 AI and ML benchmark
- **Best For:** On-device generative AI, offline LLM training and inference
- **Estimated cost:** $11,000-12,000 (CPU only)

**Intel Alternative: Intel Xeon W9-3495X**
- **Cores:** 56 cores / 112 threads
- **Performance:** Excellent per-core computing power, 307 GB/s memory bandwidth
- **Features:** Intel Deep Learning Boost for AI/ML tasks, PCIe 5.0 support
- **TDP:** 350W (requires top-tier cooling)
- **Best For:** Data-intensive tasks, mixed CPU+GPU workloads
- **Estimated cost:** $5,889 (CPU only, MSRP)
- **Note:** Outperformed by AMD Threadripper PRO 9995WX in LLM inference benchmarks

**Budget Alternative: AMD Ryzen 9 7950X3D**
- 16 cores / 32 threads with 3D V-Cache
- Excellent for LLM inference on smaller models
- PCIe 5.0 support
- Estimated cost: $5,000-8,000 (full system)

**GPU Recommendation (for Host PC):**
- NVIDIA RTX 6000 Ada (48GB VRAM) for Claude/GPT-level models
- NVIDIA A6000 (48GB VRAM) for production inference
- NVIDIA RTX 4090 (24GB VRAM) for smaller models (budget option)

##### **Network Infrastructure**

**Network:**
- A dedicated local network switch is recommended to minimize latency and packet loss between the Host and Jetson
- Minimum: 1 Gbps Ethernet
- Recommended: 10 Gbps Ethernet for real-time video streaming in HITL dashboard
- Network latency should be measured and factored into timeouts

#### **2. Core Software Scaffolding**

##### **2.1. Jetson (Tactical Domain) Services**

The Jetson will run a single master server application (e.g., using FastAPI for simplicity and robustness) that exposes a REST API.

**DMX Service (`dmx_service.py`):**
- A singleton class that directly controls the `pyserial` interface
- It will implement the critical baud-rate switching for DMX Break/MAB signals
- Exposes internal methods: `_set_channel(ch, val)`, `_render_frame()`
- It maintains a 512-element `bytearray` as its internal state buffer

**Vision Service (`vision_service.py`):**
- A stateful class initialized with the camera correction matrix
- **Key Method:** `set_mode(mode: str, params: dict)`: Switches the analysis pipeline. Modes include:
  - `'blob_detection'`: Uses `cv2.SimpleBlobDetector` with configurable thresholds
  - `'line_analysis'`: Uses `cv2.HoughLinesP` and calculates straightness (e.g., via standard deviation from a best-fit line) and completeness (ratio of detected pixels to expected pixels)
  - `'shape_classifier'`: Loads a pre-trained, lightweight CNN (e.g., MobileNetV2) to classify simple shapes
- **Key Method:** `analyze(request_id: str)`: Captures a frame, applies corrections, runs the current analysis pipeline, and returns a detailed JSON report

**Execution Service & Security Sandbox (`execution_service.py`):**
- This is the most critical security component. It will **not** use a raw `exec()` call
- It will use Python's `ast` (Abstract Syntax Tree) module to parse incoming code strings *before* execution
- An `ast.NodeVisitor` subclass will traverse the code tree and check against a strict allow-list of nodes (e.g., `For`, `BinOp`, `Call`, `Name`, `Constant`)
- It will explicitly reject code containing `Import`, `Attribute` access to `__` methods, `open()`, or any other potentially harmful operations
- The code is executed within a function that has a strictly limited `globals` dictionary, exposing only a `dmx` object and a `log` function
- A `multiprocessing.Process` will be used to run the code, allowing for a hard timeout to kill runaway scripts

##### **2.2. Host PC (Strategist Domain) Services**

**State Manager (`state_manager.py`):**
- The central nervous system of the learning process
- It persists its state to a file (`session.json`) after every major action
- Tracks: `current_phase` (DISCOVERY, CALIBRATION, etc.), `current_goal` (e.g., "Find Y-axis"), `attempt_count`, `historical_metrics`
- If `attempt_count` for a single goal exceeds a threshold (e.g., 15), it will enter a `PAUSED_FOR_REVIEW` state, flagging for human intervention

**Knowledge Base (`knowledge_base.py`):**
- A class that manages the `knowledge.json` file
- This file will have a well-defined schema, including keys for `channel_map`, `calibration_curves`, `api_source_code`, and `validation_scores`

**Experiment Engine (`experiment_engine.py`):**
- The "teacher" that directs the learning process
- It queries the `state_manager` to determine the next goal and constructs a detailed, context-rich prompt for the Coder Agent
- **Example Prompt Construction:** "We are in the 'Primitive Synthesis' phase. We have successfully mapped intensity to channel 6 and position to channels 7 (X) and 8 (Y). We have calibrated these channels. Your goal is to write a Python function `draw_line(p1, p2)` that draws a solid, straight line. Here is the last vision report from your previous attempt, which shows the line was incomplete: `{...}`. Refine your code to fix this."

---

### **Phase 1: The Automated Self-Discovery Process**

This is the core, automated runtime loop. The discovery process follows a structured curriculum, progressing from basic channel discovery through calibration to high-level API generation.

#### **Discovery Substages**

The learning process is divided into sequential substages, each with specific goals and success criteria:

**Substage 1.1: Initial Response Detection (15-30 minutes)**
- **Goal:** Determine if the device is responsive and identify any visible output
- **Strategy:**
  - Sweep through channels 1-32 with maximum value (255)
  - Use blob detection to identify any visual changes
  - Establish baseline "off" state for comparison
- **Success Criteria:** At least one channel produces visible laser output
- **Knowledge Gained:** Responsive channel range, baseline state

**Substage 1.2: Mode & Intensity Discovery (20-40 minutes)**
- **Goal:** Find the primary control channels (mode, on/off, master intensity)
- **Strategy:**
  - Binary search through channels to find "master enable" (often CH1)
  - Test each channel individually while holding mode channel constant
  - Measure brightness changes in vision reports
- **Success Criteria:** Identify mode channel and at least one intensity/brightness control
- **Knowledge Gained:** `channel_map['mode']`, `channel_map['intensity']`

**Substage 1.3: Spatial Control Discovery (30-60 minutes)**
- **Goal:** Identify X and Y position channels
- **Strategy:**
  - For each candidate channel, sweep values from 0-255 in steps of 32
  - Track blob centroid movement in camera frame
  - Calculate correlation between channel value and X/Y position
  - Channels with correlation >0.85 are position controls
- **Success Criteria:** Identify both X and Y channels with >90% position accuracy
- **Knowledge Gained:** `channel_map['x_pos']`, `channel_map['y_pos']`
- **Vision Mode:** Blob detection with centroid tracking

**Substage 1.4: Color Discovery (20-40 minutes)**
- **Goal:** Map color control channels (RGB or forced color palette)
- **Strategy:**
  - Test channels for HSV color changes in camera feed
  - Distinguish between RGB channels (continuous) vs. palette selection (discrete)
  - Build color mapping table
- **Success Criteria:** Successfully produce at least 3 distinct colors (red, green, blue)
- **Knowledge Gained:** `channel_map['color_r']`, `channel_map['color_g']`, `channel_map['color_b']` or `channel_map['color_palette']`
- **Vision Mode:** HSV color analysis

**Substage 1.5: Calibration & Non-linearity Characterization (40-80 minutes)**
- **Goal:** Build precise mathematical models of channel responses
- **Strategy:**
  - For position channels: Sample 20 evenly-spaced values, measure actual position, fit curve (linear, polynomial, or piecewise)
  - For intensity: Measure brightness at 10 levels, build gamma correction curve if needed
  - For color: Verify RGB linearity or map palette indices
  - Calculate confidence intervals and error bounds
- **Success Criteria:** Position prediction error <5 pixels, intensity prediction error <10%
- **Knowledge Gained:** `calibration_curves['x_pos'] = {type: 'polynomial', coeffs: [...]}`, etc.
- **Vision Mode:** High-precision blob centroid + brightness analysis

**Substage 1.6: Advanced Feature Discovery (Optional, 30-60 minutes)**
- **Goal:** Identify additional features like rotation, zoom, pattern selection, size
- **Strategy:**
  - Test remaining unmapped channels for geometric transformations
  - Use shape classifier to detect rotation, scaling, pattern changes
  - Document value ranges and effects
- **Success Criteria:** Document at least 2 additional features beyond position and color
- **Knowledge Gained:** `channel_map['rotation']`, `channel_map['size']`, `channel_map['pattern']`, etc.

**Substage 1.7: Primitive Synthesis (60-120 minutes)**
- **Goal:** Write and validate basic drawing functions
- **Strategy:**
  - Agent writes `draw_point(x, y, color)` using discovered channels
  - Agent writes `draw_line(p1, p2, color)` with interpolation
  - Agent writes `draw_circle(center, radius, color)` using parametric equations
  - Each function is tested with vision feedback for straightness, completeness, stability
  - Refine code based on vision report diagnostics
- **Success Criteria:**
  - Lines: straightness >0.95, completeness >0.90
  - Circles: circularity >0.93, radius error <5%
- **Knowledge Gained:** `api_source_code['draw_point']`, `api_source_code['draw_line']`, etc.
- **Vision Mode:** Line analysis for lines, shape classifier + circularity metrics for circles

**Substage 1.8: Complex Primitive Library (60-120 minutes)**
- **Goal:** Expand API to include rectangles, polygons, bezier curves, text (if supported)
- **Strategy:**
  - Build on validated primitives
  - Compose complex shapes from simpler ones
  - Test edge cases (overlapping shapes, rapid transitions, color changes)
- **Success Criteria:** Successfully render at least 5 different geometric primitives with quality scores >0.90
- **Knowledge Gained:** Complete `laser_canvas.py` library

**Substage 1.9: Final Validation Suite (20-40 minutes)**
- **Goal:** Comprehensive testing of the generated API
- **Strategy:**
  - Run standardized test suite: grid pattern, concentric circles, star burst, gradient test
  - Measure average quality scores across all tests
  - Identify any remaining failure modes
- **Success Criteria:** Average quality score >0.92 across all validation tests
- **Outcome:** System graduates to Phase 2 or triggers HITL for final refinement

#### **2. Detailed Data Models & API Contracts**

These APIs can be implemented via either REST (Phase 0) or WebSockets (Phase 1+). The data structures remain consistent.

**REST API Endpoints:**

**Endpoint: `POST /execute`**
- **Request Body:** `{"request_id": "...", "code": "...", "timeout_ms": 5000}`
- **Response Body:** `{"request_id": "...", "status": "success/error/timeout", "logs": "...", "error_message": "..."}`

**Endpoint: `POST /vision/set_mode`**
- **Request Body:** `{"mode": "line_analysis", "params": {"threshold1": 50, "threshold2": 150}}`
- **Response Body:** `{"status": "mode_set"}`

**Endpoint: `GET /vision/analyze?request_id=...`**
- **Response Body (Vision Report JSON):**

**WebSocket API Messages (Recommended for Phase 1):**

**Message Format:**
```json
{
  "type": "request|response|event",
  "channel": "execution|vision|telemetry",
  "message_id": "unique-id",
  "timestamp": "ISO-8601",
  "payload": { /* ... */ }
}
```

**Execution Channel:**
- **Request:** `{"type": "request", "channel": "execution", "payload": {"code": "...", "timeout_ms": 5000}}`
- **Response:** `{"type": "response", "channel": "execution", "payload": {"status": "success", "logs": "..."}}`
- **Live Log Stream:** `{"type": "event", "channel": "execution", "payload": {"log_line": "...", "level": "info"}}`

**Vision Channel:**
- **Request:** `{"type": "request", "channel": "vision", "payload": {"action": "analyze", "request_id": "..."}}`
- **Response:** Vision Report (same structure as REST)
- **Live Frame Event:** `{"type": "event", "channel": "vision", "payload": {"frame_jpeg_base64": "...", "preview": true}}`

**Vision Report JSON Structure:**
```json
{
  "request_id": "...",
  "timestamp": "...",
  "vision_mode": "line_analysis",
  "raw_metrics": { /* ... */ },
  "analysis": {
    "elements_detected": 1,
    "best_fit_shape": "line",
    "confidence": 0.98,
    "quality_scores": {
      "straightness": 0.991,
      "completeness": 0.85,
      "stability": 0.95
    },
    "diagnostics": ["gaps_detected_in_midsection"]
  }
}
```

#### **3. The Primary Learning Feedback Loop**

1. **Goal Setting:** `ExperimentEngine` gets the current goal from the `StateManager`
2. **Prompt & Generation:** `ExperimentEngine` builds the prompt. `CoderAgent` generates Python code
3. **Execution Request:** Host sends a `POST /execute` request to the Jetson
4. **Tactical Execution:** Jetson's `ExecutionService` validates and runs the code via its sandboxed process. The laser projects a pattern
5. **Perception Request:** Immediately after the execution response is received, the Host sends a `GET /vision/analyze` request
6. **Tactical Perception:** Jetson's `VisionService` captures and analyzes the projection, returning the detailed Vision Report
7. **Analysis & Learning:** `CoderAgent` receives the original goal, its own code, and the Vision Report. It analyzes the result
8. **Update State:** The `ExperimentEngine` processes the agent's conclusion. If the goal was met, it advances the state in the `StateManager` and updates the `KnowledgeBase`. If not, it increments the attempt counter and the loop repeats, using the failure as context for the next prompt
9. **Persistence:** The `StateManager` saves the new state to disk

#### **4. Knowledge Base Schema**

The `knowledge.json` file maintains all discovered information in a structured, versioned format:

```json
{
  "schema_version": "1.0",
  "device_info": {
    "discovery_date": "2025-10-20T14:30:00Z",
    "learning_duration_minutes": 240,
    "llm_model": "claude-sonnet-4",
    "total_steps": 347,
    "final_validation_score": 0.94
  },
  "channel_map": {
    "mode": {
      "channel": 1,
      "type": "enum",
      "discovery_step": 23,
      "confidence": 0.99,
      "values": {
        "off": 0,
        "dmx_manual": {"min": 1, "max": 99},
        "sound_activated": {"min": 100, "max": 199},
        "auto": {"min": 200, "max": 255}
      }
    },
    "x_pos": {
      "channel": 7,
      "type": "continuous",
      "discovery_step": 45,
      "confidence": 0.97,
      "range": {"min": 0, "max": 255},
      "mapped_range": {"min": 0, "max": 127}
    },
    "y_pos": {
      "channel": 8,
      "type": "continuous",
      "discovery_step": 47,
      "confidence": 0.96,
      "range": {"min": 0, "max": 255},
      "mapped_range": {"min": 0, "max": 127}
    },
    "color_r": {"channel": 11, "type": "palette_index"},
    "intensity": {"channel": 6, "type": "continuous"}
  },
  "calibration_curves": {
    "x_pos": {
      "type": "polynomial",
      "degree": 2,
      "coefficients": [0.002, 0.5, -1.2],
      "r_squared": 0.983,
      "mean_error_pixels": 2.1,
      "sample_points": 20
    },
    "y_pos": {
      "type": "linear",
      "slope": 0.498,
      "intercept": 0.1,
      "r_squared": 0.991,
      "mean_error_pixels": 1.4
    },
    "intensity": {
      "type": "gamma",
      "gamma": 2.2,
      "r_squared": 0.967
    }
  },
  "api_source_code": {
    "draw_point": "def draw_point(x, y, color):\n    ...",
    "draw_line": "def draw_line(p1, p2, color, steps=50):\n    ...",
    "draw_circle": "def draw_circle(center, radius, color, steps=64):\n    ..."
  },
  "validation_scores": {
    "draw_line": {
      "straightness": 0.96,
      "completeness": 0.93,
      "stability": 0.97,
      "test_count": 15
    },
    "draw_circle": {
      "circularity": 0.94,
      "radius_accuracy": 0.96,
      "stability": 0.95,
      "test_count": 12
    }
  },
  "discovery_timeline": [
    {"step": 1, "substage": "1.1", "time": "2025-10-20T14:30:00Z", "event": "Started initial response detection"},
    {"step": 23, "substage": "1.2", "time": "2025-10-20T14:52:00Z", "event": "Discovered mode channel (CH1)"},
    {"step": 45, "substage": "1.3", "time": "2025-10-20T15:18:00Z", "event": "Mapped X position to CH7"}
  ]
}
```

This schema enables:
- **Reproducibility:** Complete record of discovery process
- **Debugging:** Trace failures back to specific learning steps
- **Transfer Learning:** Use partial knowledge from similar devices to accelerate future discoveries
- **Confidence Tracking:** Identify weak mappings that may need recalibration

#### **5. Human-in-the-Loop (HITL) Intervention**

- If the system enters the `PAUSED_FOR_REVIEW` state, it stops all automated actions
- A simple command-line interface or web page will display the current state, the goal, the last 5 code attempts, and the corresponding vision reports
- The human operator can then provide a hint (e.g., "Try using more interpolation points" or "The relationship might be logarithmic, not linear") which is added to the context for the next prompt before resuming the automated process

#### **6. Example Learning Trajectory**

This example shows what a typical discovery session might look like for an Ehaho L2400 laser (though the agent doesn't know the device model):

**Session: run_2025_10_20_001**
**LLM: Claude Sonnet 4**
**Start Time: 14:30:00**

---

**Step 1-15 (Substage 1.1: Initial Response, 18 minutes)**
- Steps 1-10: Agent sweeps channels 1-32 with value 255, vision reports "no change"
- Step 11: Agent sets CH1=50, vision reports "blob detected, centroid: (640, 480), brightness: 127"
- **Discovery:** Device responds, likely beam mode active
- Step 12-15: Agent confirms CH1 controls on/off mode
- **Knowledge Update:** `channel_map['mode'] = {channel: 1, type: 'enum', confidence: 0.85}`

---

**Step 16-45 (Substage 1.2: Mode & Intensity, 22 minutes)**
- Step 18: Agent tests CH2, vision reports "no position change, brightness increase"
- Step 22: Agent tests CH6, vision reports "brightness scales linearly"
- **Discovery:** CH6 is master intensity
- Step 30-40: Agent tests CH3, discovers pattern gallery switching
- Step 44: Agent sets CH1=50, CH6=200, CH3=0 for consistent baseline
- **Knowledge Update:** `channel_map['intensity'] = {channel: 6}`, `channel_map['gallery'] = {channel: 3}`

---

**Step 46-89 (Substage 1.3: Spatial Control, 38 minutes)**
- Step 46-60: Agent sweeps CH7 from 0→255, vision tracks centroid movement
- Vision reports: "centroid X: 200→1080, Y: stable at 540"
- **Discovery:** CH7 controls horizontal position
- Agent calculates correlation: r=0.97, confirms X-axis
- Step 65: Agent generates code: `for val in range(0, 256, 16): dmx.set_channel(7, val); time.sleep(0.1)`
- Vision analysis: "Blob moved horizontally, correlation=0.98"
- Step 70-85: Agent sweeps CH8, discovers vertical control
- Vision reports: "centroid Y: 200→880, X: stable"
- **Discovery:** CH8 controls vertical position
- **Knowledge Update:** `channel_map['x_pos'] = {channel: 7}`, `channel_map['y_pos'] = {channel: 8}`

---

**Step 90-134 (Substage 1.5: Calibration, 52 minutes)**
- Step 90: Agent generates calibration code to sample 20 positions for X-axis
- Code executes, vision reports 20 centroid measurements
- Step 95: Agent analyzes data, detects slight non-linearity (edges compressed)
- Agent fits polynomial: `x_screen = 0.002*val^2 + 0.48*val + 10`
- R²=0.983, mean error: 2.1 pixels
- **Knowledge Update:** `calibration_curves['x_pos'] = {type: 'polynomial', coeffs: [0.002, 0.48, 10]}`
- Step 110-130: Agent calibrates Y-axis, finds it's nearly linear
- **Knowledge Update:** `calibration_curves['y_pos'] = {type: 'linear', slope: 0.498, intercept: 1.2}`

---

**Step 135-178 (Substage 1.4: Color Discovery, 41 minutes)**
- Step 135: Agent tests CH11, vision reports HSV change: "hue shifted to red"
- Step 145: Agent discovers CH11 is a color palette, not RGB
- Agent maps values: 1-31=red, 32-63=green, 64-95=blue, etc.
- **Discovery:** Discrete color palette (not continuous RGB)
- **Knowledge Update:** `channel_map['color_palette'] = {channel: 11, type: 'enum', values: {...}}`

---

**Step 179-245 (Substage 1.7: Primitive Synthesis - Lines, 78 minutes)**
- Step 179: Agent writes first `draw_line` function:
```python
def draw_line(p1, p2):
    for t in range(10):
        x = p1[0] + t * (p2[0] - p1[0]) / 10
        y = p1[1] + t * (p2[1] - p1[1]) / 10
        dmx.set_channel(7, int(x))
        dmx.set_channel(8, int(y))
        time.sleep(0.05)
```
- Execution: Line drawn from (20, 20) to (100, 100)
- Vision Report: `{straightness: 0.82, completeness: 0.65, diagnostics: ['large_gaps', 'too_few_points']}`
- **Status:** FAILED (straightness < 0.95)

- Step 185: Agent refines code (50 interpolation points instead of 10, shorter delays)
- Vision Report: `{straightness: 0.94, completeness: 0.88, diagnostics: ['minor_gaps']}`
- **Status:** IMPROVED but still FAILED

- Step 192: Agent adds calibration curve correction to X calculation
- Vision Report: `{straightness: 0.97, completeness: 0.91}`
- **Status:** SUCCESS
- **Knowledge Update:** `api_source_code['draw_line'] = "..."`

---

**Step 246-298 (Substage 1.7: Primitive Synthesis - Circles, 64 minutes)**
- Step 246: Agent writes `draw_circle` using parametric equations
- First attempt: Circle is oval (aspect ratio error)
- Step 255: Agent realizes Y-axis has different scale, adds correction
- Vision Report: `{circularity: 0.89, radius_error: 0.12}`
- **Status:** IMPROVED

- Step 270: Agent pauses - stuck at circularity=0.89 after 8 attempts
- **HITL TRIGGER:** Attempt count exceeded (max 15 not reached, but progress stalled)
- Human hint: "The camera might have lens distortion at the edges. Try drawing circles in the center region."
- Step 275: Agent modifies test to use center coordinates (64, 64) instead of (90, 90)
- Vision Report: `{circularity: 0.95, radius_error: 0.04}`
- **Status:** SUCCESS
- **Knowledge Update:** `api_source_code['draw_circle'] = "...", notes: 'center region more accurate'`

---

**Step 299-347 (Substage 1.9: Final Validation, 28 minutes)**
- Step 300: Agent runs grid test pattern (5×5 grid of dots)
- Vision: All 25 points detected, position accuracy: 96%
- Step 315: Agent runs concentric circles test
- Vision: 4 circles rendered, avg circularity: 0.94
- Step 330: Agent runs star burst (lines radiating from center)
- Vision: 12 lines, avg straightness: 0.96
- **Average Score Across All Tests: 0.94** (exceeds 0.92 threshold)

**GRADUATION: System advances to Phase 2**

---

**Session Summary:**
- **Total Time:** 4 hours 17 minutes
- **Total Steps:** 347
- **HITL Interventions:** 1
- **Channels Mapped:** 6 (mode, intensity, gallery, x_pos, y_pos, color_palette)
- **Primitives Generated:** 3 (draw_point, draw_line, draw_circle)
- **Final Validation Score:** 0.94
- **API Lines of Code:** 127

**Instrumentation Data Logged:**
- 347 LLM generations (avg 892 tokens/prompt, 156 tokens/completion)
- 289 code executions (avg 2.3s execution time)
- 289 vision analyses (avg 180ms analysis time)
- Network latency: avg 12ms (WebSocket), max 45ms
- Total LLM cost: $18.47 (at current Claude Sonnet pricing)

---

### **Phase 2: Interactive & Creative Application**

#### **1. Graduation**

- Upon successful completion of all learning phases, the `ExperimentEngine` performs a final validation suite, commanding the generated `laser_canvas.py` to draw a complex test pattern
- If the final validation score is above a threshold, the system "graduates," creating a `LATEST_STABLE` version of the library and knowledge base

#### **2. The Interactive Runtime Loop**

- The system is now launched in a different mode (`--mode=interactive`)
- The `CoderAgent` is replaced by a `CreativeAgent`. Its system prompt is entirely different: *"You are a creative visual artist who controls a laser system using a Python library called `laser_canvas`. You will receive user requests and must generate a Python script that uses the available functions (`canvas.line`, `canvas.circle`, etc.) to create the described visual."*
- The feedback loop is simpler: User Prompt → Agent generates script → Jetson executes script → User sees the result
- The vision system can be used for verification or for more advanced interactions (e.g., projecting a circle around a detected face)

---

### **Instrumentation & Measurement Plan**

This is not just about logging; it's about structured data collection for scientific analysis. We will use a dedicated tool like Weights & Biases (`wandb`) or MLflow.

#### **1. Logged at Every Step of the Learning Loop**

- **`run_id`:** A unique ID for the entire end-to-end learning session
- **`step_id`:** A unique ID for each attempt within the run
- **Configuration:** The full configuration of the system (LLM model name, safety thresholds, vision parameters)
- **Inputs:** The exact prompt sent to the Coder Agent
- **Outputs:** The raw code generated by the agent
- **Metrics:**
  - The full JSON Vision Report from the Jetson
  - Latency metrics: `llm_generation_time_ms`, `network_roundtrip_ms`, `jetson_execution_time_ms`
  - LLM usage stats: `prompt_tokens`, `completion_tokens`
- **State:** A snapshot of the `StateManager`'s current status

#### **2. Key Performance Indicators (KPIs) to Analyze**

- **Time-to-API:** Total time and number of steps required to generate a fully validated `laser_canvas.py`
- **First-Shot Accuracy:** How often does the agent succeed on its first attempt for a given goal?
- **Refinement Efficiency:** For goals requiring multiple attempts, what is the average improvement in the key vision metric (e.g., `straightness`) per attempt?
- **Problem-Solving Capability:** When a HITL pause is triggered, what was the nature of the problem the agent couldn't solve? (This helps improve the prompting strategy)
- **Comparative Analysis:** By running the entire experiment with different LLMs (e.g., GPT-4o vs. a fine-tuned Code Llama vs. Qwen Coder), we can use these KPIs to quantitatively compare their reasoning, code generation, and error-correction capabilities in a real-world robotics task

---

### **Expected Outcomes**

1. **Autonomous Hardware Characterization:** The system will automatically discover channel mappings, calibration curves, and hardware capabilities without manual intervention
2. **Generative API Creation:** A high-level Python library tailored to the specific laser hardware will be automatically generated
3. **Real-time Creative Control:** Once trained, the system becomes an interactive creative tool where natural language requests are instantly translated to laser projections
4. **Research Insights:** Quantitative comparison of LLM capabilities in perception-action loops, providing valuable data for AI reasoning research

---

### **Technical Risks & Mitigation Strategies**

**Risk 1: Vision System Accuracy**
- **Mitigation:** Use multiple vision modes (blob detection, line analysis, shape classification) and cross-validate results. Implement confidence thresholds that trigger HITL intervention.

**Risk 2: LLM Code Generation Failures**
- **Mitigation:** Implement the AST-based security sandbox with clear error messages. Use few-shot learning with known-good examples in prompts. Track failure patterns to refine prompts.

**Risk 3: Hardware Variability**
- **Mitigation:** Build calibration curves for non-linear channel responses. Implement tolerance bands for acceptable performance. Use statistical analysis of multiple samples.

**Risk 4: Network Latency**
- **Mitigation:** Measure and log all network latencies. Implement exponential backoff for retries. Consider moving time-critical vision processing to the Host if latency becomes a bottleneck.

**Risk 5: Infinite Learning Loops**
- **Mitigation:** Hard limits on attempt counts per goal (max 15). Automatic HITL intervention triggers. Watchdog timers on all operations.

---

### **Dependencies & Prerequisites**

**Hardware (See Phase 0 Section 1 for detailed recommendations):**

**Tactical Edge Computer:**
- Primary: NVIDIA Jetson AGX Orin 64GB (~$2,000)
- Alternatives: Jetson Thor T5000 (~$3,500+), Qualcomm RB5 (~$600-800), Rockchip RK3588+Hailo-8 (~$300-500)

**Professional Camera System:**
- Recommended: FRAMOS FSM-IMX273C + FSA-FTX1 Adapter (~$530 total)
- Alternative: Basler daA1920-160uc + BCON Adapter (~$630 total)
- Global shutter sensor is mandatory (no rolling shutter cameras)

**Host PC (Strategist):**
- Primary: AMD Threadripper PRO 7995WX (96 cores) + 128GB+ RAM + RTX 6000 Ada (~$20,000-25,000)
- 2025 Next-Gen: AMD Threadripper PRO 9995WX (Zen 5, 96 cores) + 128GB+ DDR5-6400 (~$22,000-28,000)
- Intel Alternative: Xeon W9-3495X (56 cores) + 128GB+ RAM + RTX 6000 Ada (~$18,000-22,000)
- Budget: AMD Ryzen 9 7950X3D + 64GB RAM + RTX 4090 (~$5,000-8,000)

**Other Hardware:**
- DMX-compatible laser projector (e.g., Ehaho L2400)
- USB-to-DMX interface (ENTTEC DMX USB Pro or compatible)
- Stable, non-reflective projection surface
- Network switch (minimum 1 Gbps, recommended 10 Gbps)

**Software:**
- Python 3.10+
- OpenCV (with CUDA support on Jetson)
- FastAPI (WebSocket support)
- PySerial
- LLM API access (Anthropic Claude, OpenAI) or local LLM deployment
- MLflow or Weights & Biases for experiment tracking
- Pylon SDK (if using Basler camera) or FRAMOS drivers (if using FRAMOS)

**Existing Codebase:**
- Current DMX control system (`dmx.js`, `dmx-canvas.js`)
- Device profiles system
- DMX protocol implementation

**Estimated Total System Cost:**
- **High-End Configuration:** $30,000-40,000 (Threadripper PRO 9995WX + Jetson Thor + FRAMOS camera)
- **Recommended Configuration:** $22,000-27,000 (Threadripper PRO 7995WX + Jetson AGX Orin + FRAMOS camera)
- **Budget Configuration:** $8,000-12,000 (Ryzen 9 7950X3D + Rockchip RK3588+Hailo-8 + Basler camera)

---

### **Success Criteria**

1. The system successfully maps at least 8 channels (mode, intensity, X, Y, color R/G/B, pattern) with >90% accuracy
2. Generated API functions produce visually correct outputs (straightness >0.95, completeness >0.90)
3. Time-to-API is under 2 hours for a typical 16-channel laser
4. Interactive mode responds to natural language requests within 5 seconds
5. System can handle at least 3 different laser models without code changes

---

### **Future Extensions**

- **Multi-Device Orchestration:** Coordinate multiple lasers for complex projections
- **Audio-Reactive Systems:** Integrate FFT analysis for music visualization
- **Reinforcement Learning:** Replace supervised learning with RL for more robust adaptation
- **Edge Deployment:** Run the entire system (including LLM) on Jetson for standalone operation
- **Community Model Sharing:** Create a repository of learned device profiles and APIs

---

## Other Future Development Areas

*(Additional future development plans can be added here)*

---

**Status:** Proposed Architecture - Not Yet Implemented
**Last Updated:** 2025-10-20
**Prerequisites:** See Dependencies & Prerequisites section for detailed hardware/software requirements
**Estimated System Cost:** $8,000-40,000 depending on configuration
