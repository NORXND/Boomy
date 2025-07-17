# Boomy Editor - Dance Central 3 Song Editor

## Project Overview

A comprehensive Electron-based editor for Dance Central 3 song files with timeline editing, move choreography, and camera shot management.

## Architecture Summary

### Core Technologies

-   **Electron + React + TypeScript**: Main application framework
-   **Zustand**: State management for songs and timeline
-   **Tone.js**: Audio processing and MIDI handling
-   **shadcn/ui**: UI component library
-   **Vite**: Build tooling with automatic JSX runtime

### Key Features Implemented

#### 1. Secure IPC Architecture

-   **Preload Script** (`src/preload.ts`): Secure bridge between main and renderer
-   **IPC Handlers** (`src/main/ipcHandlers.ts`): File system operations in main process
-   **APIs Available**: File read/write, directory operations, JSON parsing, external URLs

#### 2. State Management

-   **Song Store** (`src/store/songStore.ts`):
    -   Song CRUD operations
    -   Move library management
    -   Timeline data for easy/medium/expert difficulties
    -   Auto-save functionality
-   **Timeline Store** (`src/store/timelineStore.ts`):
    -   Audio/MIDI integration with Tone.js
    -   Playback controls and timeline navigation
    -   Measure-based editing with BPM sync

#### 3. Type System

-   **Song Types** (`src/types/song.d.ts`):
    -   Move, MoveEvent, CameraEvent interfaces
    -   Timeline structure for all difficulty levels
    -   Move library integration types
-   **Timeline Types** (`src/types/timeline.d.ts`):
    -   Audio/MIDI data structures
    -   Track and event management
    -   Playback and viewport state

#### 4. Move Library System

-   **Move Library Browser** (`src/app/MoveLibrary.tsx`):
    -   CAT > SONG > MOVE folder structure navigation
    -   JSON move file parsing and preview
    -   Search and filter functionality
    -   Import moves to timeline

#### 5. Timeline Editor

-   **Main Timeline** (`src/app/timeline/TimelineEditor.tsx`):
    -   Professional DAW-style interface
    -   Transport controls (play/pause/stop/seek)
    -   Difficulty selection (Easy/Medium/Expert)
    -   Track type switching (Moves/Cameras)
    -   Zoom controls and time display
-   **Timeline Ruler** (`src/app/timeline/TimelineRuler.tsx`):
    -   Measure and beat markers
    -   Time scale display
    -   Click-to-seek functionality
-   **Timeline Tracks** (`src/app/timeline/TimelineTracks.tsx`):
    -   Visual event representation
    -   Beat-based event positioning
    -   Move and camera event rendering
-   **Track List** (`src/app/timeline/TrackList.tsx`):
    -   Track properties and statistics
    -   Event count and range display
    -   Track visibility controls

#### 6. Editor Workspace

-   **Main Workspace** (`src/app/EditorWorkspace.tsx`):
    -   Tabbed interface with sidebar
    -   Move Library, Choreography, and Camera tabs
    -   Song information header
    -   Integrated timeline editor

## File Structure

```
src/
├── app/
│   ├── timeline/
│   │   ├── TimelineEditor.tsx      # Main timeline interface
│   │   ├── TimelineRuler.tsx       # Measure/beat ruler
│   │   ├── TimelineTracks.tsx      # Track event rendering
│   │   └── TrackList.tsx           # Track sidebar
│   ├── store/
│   │   ├── songStore.ts            # Song state management
│   │   └── timelineStore.ts        # Timeline state with Tone.js
│   ├── types/
│   │   ├── song.d.ts              # Song data structures
│   │   ├── timeline.d.ts          # Timeline types
│   │   └── electron.d.ts          # Electron API types
│   ├── EditorWorkspace.tsx         # Main editor interface
│   ├── MoveLibrary.tsx            # Move library browser
│   └── App.tsx                    # Application root
├── main/
│   └── ipcHandlers.ts             # Main process IPC handlers
├── preload.ts                     # Secure IPC bridge
└── types/
    └── electron.d.ts              # Electron type definitions
```

## Data Flow

1. **Song Loading**: User selects song folder → IPC reads files → Song store populated
2. **Move Library**: User browses CAT/SONG/MOVE structure → JSON files parsed → Moves imported
3. **Timeline Editing**: Audio/MIDI loaded via Tone.js → Playback controls → Visual timeline
4. **Event Management**: Click timeline → Add move/camera events → Auto-save to disk

## Key Accomplishments

✅ **Complete Electron Setup**: Security-focused IPC architecture
✅ **Professional Timeline**: DAW-style editor with transport controls
✅ **Move Library Integration**: Full CAT > SONG > MOVE navigation
✅ **Multi-Difficulty Support**: Easy/Medium/Expert timeline editing
✅ **Audio/MIDI Integration**: Tone.js-powered playback and sync
✅ **Type Safety**: Comprehensive TypeScript definitions
✅ **State Management**: Zustand stores with proper immutability
✅ **Component Architecture**: Modular, reusable UI components

## Next Steps for Production

1. **Drag & Drop**: Implement move dragging from library to timeline
2. **Undo/Redo**: Add command pattern for timeline operations
3. **Export System**: Generate Dance Central 3 compatible files
4. **Performance**: Optimize large timeline rendering
5. **Testing**: Add unit tests for core functionality
6. **Packaging**: Electron Forge distribution setup

## Development Commands

```bash
# Start development
npm start

# Build for production
npm run make

# Run linting
npm run lint
```

The editor provides a comprehensive foundation for Dance Central 3 song editing with professional-grade timeline editing capabilities, move library management, and secure file operations.
