# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is OpenScreen

OpenScreen is a free, open-source desktop screen recording and video editing app (alternative to Screen Studio). It records screens/windows, adds zoom effects, annotations, cropping, speed control, and exports to MP4/GIF. Built as an Electron app with a React renderer.

## Commands

```bash
npm run dev          # Start Vite dev server + Electron (hot-reload)
npm run build        # Full build: tsc → vite build → electron-builder (all platforms)
npm run build:mac    # Build macOS DMG (x64 + arm64)
npm run build:win    # Build Windows NSIS installer
npm run build:linux  # Build Linux AppImage
npm run build-vite   # Build only the Vite bundle (no Electron packaging)
npm run lint         # Check with Biome (no auto-fix)
npm run lint:fix     # Fix lint + format issues
npm run format       # Format only (Biome)
npm test             # Run unit tests once (vitest --run)
npm run test:watch   # Run unit tests in watch mode
npm run test:e2e     # Run Playwright e2e tests
```

## Architecture

### Process Model (Electron)

The app uses Electron's standard two-process architecture with context isolation (`contextIsolation: true`, `nodeIntegration: false`).

- **Main process** (`electron/main.ts`): App lifecycle, tray, menus, cursor telemetry capture during recording. Delegates IPC to `electron/ipc/handlers.ts`.
- **Preload** (`electron/preload.ts`): Exposes `window.electronAPI` via `contextBridge`. All renderer↔main communication goes through this typed API.
- **Windows** (`electron/windows.ts`): Three window types, all using the same Vite entry point with `?windowType=` query param:
  - `hud-overlay` — Compact always-on-top recording control bar (transparent, frameless)
  - `source-selector` — Screen/window picker popup
  - `editor` — Main video editor (maximized, macOS hidden titlebar)

### Renderer (React + Vite)

`src/App.tsx` reads `windowType` from URL params and renders the matching view. Key areas:

- **`src/components/launch/`** — HUD overlay (recording controls) and source selector UI
- **`src/components/video-editor/`** — The main editor:
  - `VideoEditor.tsx` — Root editor component, orchestrates all editor state
  - `VideoPlayback.tsx` + `videoPlayback/` — PixiJS-based video canvas with zoom/pan transforms
  - `timeline/` — Timeline editor using `dnd-timeline` for drag-and-drop zoom/trim/speed/annotation regions
  - `SettingsPanel.tsx` — Right sidebar (wallpaper, shadow, blur, border radius, padding, aspect ratio)
  - `ExportDialog.tsx` — Export configuration and progress
  - `AnnotationOverlay.tsx` + `AnnotationSettingsPanel.tsx` — Draggable text/image/arrow annotations
  - `CropControl.tsx` — Interactive crop region control
  - `projectPersistence.ts` — Save/load `.openscreen` project files
  - `types.ts` — Core domain types: `ZoomRegion`, `TrimRegion`, `SpeedRegion`, `AnnotationRegion`, `CropRegion`

### State Management

- **`useEditorHistory`** (`src/hooks/useEditorHistory.ts`) — Custom undo/redo hook (max 80 levels). Three mutation modes:
  - `pushState` — Immediate checkpoint (discrete actions like add/delete)
  - `updateState` — Live update during drags (first call creates checkpoint, subsequent calls mutate in place)
  - `commitState` — Ends a live-update series
- **`ShortcutsContext`** (`src/contexts/ShortcutsContext.tsx`) — Configurable keyboard shortcuts, persisted via IPC to `shortcuts.json`

### Video Processing Pipeline

All in `src/lib/exporter/`:
- `videoDecoder.ts` / `streamingDecoder.ts` — WebCodecs-based video frame decoding
- `frameRenderer.ts` — PixiJS offscreen canvas rendering with zoom/pan/crop/annotations
- `audioEncoder.ts` — Audio track encoding
- `muxer.ts` — MP4 muxing via `mp4box`
- `videoExporter.ts` — Orchestrates decode → render → encode → mux pipeline
- `gifExporter.ts` — GIF export using `gif.js`

### Recording Flow

1. User picks source in HUD overlay → `useScreenRecorder` hook captures via `navigator.mediaDevices.getUserMedia` with `desktopCapturer` source ID
2. Main process captures cursor telemetry at 10Hz during recording (`electron/ipc/handlers.ts`)
3. Recording saved as WebM to `{userData}/recordings/` with `.session.json` manifest and `.cursor.json` telemetry
4. App transitions to editor window with recorded video loaded

### Key Libraries

- **PixiJS** (`pixi.js` + `pixi-filters`) — Hardware-accelerated video preview and frame rendering
- **dnd-timeline** — Drag-and-drop timeline for zoom/trim/speed/annotation regions
- **mediabunny** — Media processing utilities
- **mp4box** — MP4 muxing for export
- **gif.js** — GIF encoding
- **gsap** — Smooth animation easing for zoom transitions
- **react-resizable-panels** — Resizable editor layout panels
- **react-rnd** — Draggable/resizable annotation overlays

## Code Style

- **Linter/Formatter**: Biome (not ESLint/Prettier). Tabs, double quotes, LF line endings, 100 char line width.
- **Pre-commit hook**: `lint-staged` runs `biome check` on staged files via Husky.
- **Path alias**: `@/` maps to `src/` (configured in tsconfig + vite).
- **UI components**: shadcn/ui (new-york style, stone base color, CSS variables) in `src/components/ui/`. Some custom UI components like `audio-level-meter`, `content-clamp`, `item-content`.
- **Strict TypeScript**: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` all enabled.

## Forked From

Original repo: `siddharthvaddem/openscreen` (upstream remote configured).
Sync with upstream: `git fetch upstream && git merge upstream/main`.
