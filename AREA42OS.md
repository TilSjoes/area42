# Area42OS — Intent-Driven AI Operating System

> Assessment and architectural vision document
> Author: Claude Opus 4.6, in collaboration with Ford (Frode Bjerk)
> Date: 2026-03-25

## Vision

Take the learnings from Arthur (Spine, NATS, Babelfish, gravity wells) and Area42 (spatial UI, glass panels, intent-driven layout) and build them into an **AI-native operating system layer** — a dynamic, context-aware desktop environment where the system understands what you're doing and arranges itself accordingly.

Not a full OS kernel — a **smart shell** that sits on a minimal Linux base and replaces the traditional desktop with an intent-driven spatial interface.

## Honest Assessment

### Is it possible? **Yes.**

Everything needed exists as open-source building blocks. The innovation is in the integration — making them work together as a coherent intent-driven experience.

### Is it practical? **Yes, with phased approach.**

Building a full OS from scratch is years of work. Building a smart shell on top of a minimal distro is weeks to months. The key insight: we're not replacing Linux, we're replacing GNOME/KDE with something that thinks.

### macOS version? **Yes, as an overlay.**

macOS doesn't allow replacing the window manager, but we can build a companion app (Swift + AppKit) that:
- Monitors window focus, app switching, clipboard
- Runs the Spine classifier locally
- Provides Area42 overlay panels (HUD mode)
- Manages window arrangement via Accessibility API
- Acts as a "smart layer" on top of macOS

This is actually easier to ship and test than the Linux version.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Area42OS Shell                   │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │            Area42 Compositor                 │ │
│  │     Wayland compositor (fork Smithay/wlroots)│ │
│  │     Glass panels as native windows           │ │
│  │     Gravity wells for window groups          │ │
│  │     Particle effects for IPC visualization   │ │
│  └──────────────────┬──────────────────────────┘ │
│                      │                            │
│  ┌──────────┐  ┌────┴─────┐  ┌────────────────┐ │
│  │  Spine   │  │   NATS   │  │    Memory       │ │
│  │  Intent  │  │  Message │  │  Local encrypted│ │
│  │ Classifier│ │   Bus    │  │  Context store  │ │
│  │ (0.8B LLM)│ │ JetStream│  │  (SQLite+FTS5) │ │
│  └──────────┘  └──────────┘  └────────────────┘ │
│                      │                            │
│  ┌──────────┐  ┌────┴─────┐  ┌────────────────┐ │
│  │  Soul    │  │ Watchdog │  │  Babelfish      │ │
│  │ Prefs +  │  │ Health   │  │  Dream/Learn    │ │
│  │ Personality│ │ Monitor  │  │  Cycle          │ │
│  └──────────┘  └──────────┘  └────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │            Minimal Linux Base                │ │
│  │     NixOS / Arch / Custom buildroot          │ │
│  │     Wayland, PipeWire, NetworkManager        │ │
│  │     No bloat — headless until shell starts   │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Core Components

### 1. Area42 Compositor (Rust + Wayland)
The window manager IS Area42. Not a separate app — the compositor itself renders with the Area42 engine.

- **Windows are panels**: Every application window is a glass panel with drag, resize, snap, collapse
- **Gravity wells**: Group related windows (IDE + terminal + docs orbit together)
- **Intent-driven layout**: Spine classifies activity → windows rearrange
- **Particle effects**: IPC between applications visualized as flowing particles
- **Workspaces as universes**: Each workspace is an Area42 scene with its own gravity

**Technology**: Rust + Smithay (Wayland compositor library) or fork of cosmic-comp (System76's compositor). Area42 renders via OpenGL/Vulkan in the compositor.

**Why Rust**: Compositors need to be fast, safe, and low-latency. Rust is the standard for modern Wayland compositors (Sway, Hyprland, cosmic-comp are all Rust/C).

### 2. Spine Daemon (Python or Rust)
The system's nervous system. Classifies user intent from OS signals.

**Inputs**:
- Active window title + class
- Keyboard activity patterns (typing speed, shortcuts used)
- Mouse movement patterns (focused reading vs scattered browsing)
- Time of day, calendar events
- Recently opened files, clipboard content (local only)
- Audio state (in call, music playing)

**Outputs**:
- Intent classification: coding, meeting, research, creative, admin, communication
- Confidence score
- Suggested layout (which windows where, which workspace)
- Focus mode (minimize distractions vs open exploration)

**Model**: Fine-tuned tiny LLM (like Arthur's Spine), running locally on GPU or even CPU (0.8B model = <1GB RAM). Classifies in <100ms.

**Learning**: Babelfish-style dream cycle runs nightly, analyzes daily patterns, updates classification weights.

### 3. NATS Message Bus
Same as Arthur — all components communicate via NATS JetStream.

**Subjects**:
```
area42.intent.classified    — Spine publishes intent changes
area42.window.focus         — Window focus changes
area42.window.arrange       — Layout commands
area42.memory.store         — Context persistence
area42.dream.insight        — Babelfish learning
area42.health.>             — Watchdog health checks
```

### 4. Memory Store
Encrypted local database (SQLite + FTS5, like Vale) storing:
- User context: what you were working on, when, with whom
- Project associations: this file belongs to this project
- Preferences: "I always want terminal on the right when coding"
- Learned patterns: "At 9am Ford opens email, at 10am switches to code"

**Privacy**: Everything local. Encrypted at rest. No cloud sync unless user opts in. The AI never phones home.

### 5. Soul
System personality configuration (like Arthur's SOUL.md):
- Aesthetic preferences (neon vs minimal, animation speed)
- Behavioral style (proactive vs reactive arrangement)
- Focus rules (DND during deep work, notifications during breaks)
- Privacy level (what the Spine is allowed to observe)

### 6. Watchdog
System health monitor:
- GPU/CPU/RAM monitoring (like Arthur's Morpheus panel)
- Application crash detection and restart
- Network health
- LLM health (is Spine responding?)
- Posts to NATS health subjects

## Privacy & Security Architecture

This is non-negotiable for a daily-driver OS.

### Privacy
- **Local-first**: All AI runs on-device. No API calls for core functionality
- **Encrypted memory**: SQLite database encrypted with user passphrase
- **Observable inputs**: User controls what Spine can see (opt-in per signal type)
- **Forget button**: Instantly purge all learned data
- **No telemetry**: Zero data collection. Open source, auditable

### Security
- **Sandboxed apps**: Flatpak/Bubblewrap for application isolation
- **Capability-based permissions**: Apps request access to signals ("can I see clipboard?")
- **Secure boot**: Verified boot chain (optional but supported)
- **Firewall by default**: All outbound blocked except explicit allowlist
- **Audit trail**: All permission grants logged (like Arthur's governance)

## macOS Companion App (Area42 Overlay)

Since macOS doesn't allow compositor replacement:

```
┌──────────────────────────────────┐
│  macOS (standard desktop)         │
│                                    │
│  ┌──────────────────────────────┐ │
│  │  Area42 Overlay (Swift app)  │ │
│  │  - Transparent fullscreen    │ │
│  │  - HUD panels on top of OS  │ │
│  │  - Spine running in menubar │ │
│  │  - Window arrangement via   │ │
│  │    Accessibility API         │ │
│  │  - NATS for IPC             │ │
│  └──────────────────────────────┘ │
│                                    │
│  System Spine (background daemon) │
│  - Monitors via Accessibility API │
│  - Classifies intent locally      │
│  - Suggests/applies layouts       │
└──────────────────────────────────┘
```

**Technology**: Swift + AppKit + Metal (for Area42 rendering). Could also use Electron for cross-platform prototype.

## Phased Implementation

### Phase 0: Proof of Concept (2-4 weeks)
- Take Trillian's existing Linux (or install NixOS on second partition)
- Install Hyprland (tiling Wayland compositor)
- Run Area42 demo in a fullscreen browser as the "shell"
- Run Spine daemon classifying window focus
- NATS for messaging
- Prove the concept: intent changes → layout changes

### Phase 1: Smart Shell (4-8 weeks)
- Custom Hyprland config driven by Spine classifications
- Area42 overlay for system monitoring (like the current demo)
- Memory store for context persistence
- Basic intent classification (coding/meeting/research)
- Dream cycle for learning patterns

### Phase 2: Custom Compositor (3-6 months)
- Fork cosmic-comp or build on Smithay
- Area42 rendering in compositor (not browser)
- Glass panel windows with gravity wells
- Particle effects for system visualization
- Full NATS integration

### Phase 3: macOS Companion (2-4 weeks parallel)
- Swift menubar app
- Accessibility API for window monitoring
- Area42 overlay via Metal
- Spine daemon for intent classification

### Phase 4: Distribution (ongoing)
- ISO image for x86_64 (Trillian) and ARM (future)
- Installer with privacy-first setup wizard
- Package manager integration
- Community themes and Soul configs

## Hardware Requirements

### Minimum (CPU-only Spine)
- 4-core CPU, 8GB RAM, any GPU
- Spine runs on CPU (~500ms classification)

### Recommended (GPU Spine)
- 6-core CPU, 16GB RAM, any discrete GPU with 4GB+ VRAM
- Spine on GPU (<100ms classification)
- Area42 compositor GPU-accelerated

### Ideal (Full local AI stack)
- 8+ cores, 32GB RAM, GPU with 8GB+ VRAM
- Spine + local LLM for chat/assistance
- Full Area42 effects (bloom, depth-of-field)

### Trillian Specifically
- RTX 5080 (16GB VRAM) — more than enough for Spine + compositor + effects
- Dual boot: Windows stays intact, Linux on separate partition
- GPU passthrough possible if running in VM (but native dual-boot is better)

## Competitive Landscape

| Project | What it does | How Area42OS differs |
|---------|-------------|---------------------|
| GNOME | Traditional desktop | No AI, no intent, no spatial reasoning |
| Hyprland | Tiling WM | Beautiful but static rules, no learning |
| System76 COSMIC | Modern desktop in Rust | Great foundation but no AI layer |
| Apple Intelligence | AI in macOS | Cloud-dependent, closed, no spatial UI |
| Microsoft Copilot+ | AI in Windows | Cloud-dependent, telemetry-heavy |
| Area42OS | Intent-driven spatial desktop | Local AI, privacy-first, learns from you |

The key differentiator: **every competitor bolts AI onto an existing desktop paradigm**. Area42OS makes AI the foundation — the desktop IS the AI.

## Open Source Strategy

- **Core compositor + Spine**: MIT license (maximize adoption)
- **Themes + Souls**: Community contributed, MIT
- **Area42 library**: Already MIT (@dontpanic/area42)
- **Revenue model**: Consulting, custom enterprise deployments, hardware bundles
- **Community**: GitHub, Discord, documentation site

## Risks

1. **Wayland compositor complexity**: Building a stable compositor takes significant effort. Mitigate by forking cosmic-comp.
2. **Daily driver stability**: People won't use an unstable OS. Mitigate with Phase 0/1 (use existing compositor, add AI layer).
3. **GPU compatibility**: Need to support Nvidia + AMD + Intel. Mitigate by using standard Wayland/Mesa stack.
4. **Intent classification accuracy**: Bad classifications = annoying desktop. Mitigate with "suggest, don't force" UX + easy override.
5. **Privacy perception**: Even local AI makes people nervous. Mitigate with transparency, open source, clear data documentation.

## Verdict

**This is worth building.** The pieces exist (Arthur's Spine, Area42's panels, NATS messaging, Wayland compositors). The gap in the market is real — no one has built an AI-native desktop that's privacy-first and spatial.

Start with Phase 0 on Trillian. Prove intent-driven layout works. Then decide if it's worth the full compositor build.

The question isn't "can we build it?" — it's "how fast can we get to Phase 0?"
