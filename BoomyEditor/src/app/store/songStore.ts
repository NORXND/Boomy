import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Song, MoveEvent, CameraEvent, TimelineForSave, CameraEventForSave, PracticeSection, TempoChange, DrumsEvent, SongEvent, PartyJumpEvent, BamPhrase, BattleEvent, DancerFaceEvent } from "../types/song";
import { toast } from "sonner";

import { SongMeta } from "../types/song";
import path from "path-browserify";

export interface SongState {
  // Current song data
  currentSong: Song | null;
  songPath: string | null;
  isLoaded: boolean;

  // Song metadata
  songName: string | null;
  songVersion: string | null;
  songMeta: SongMeta | null;

  // Audio paths
  audioPath: string | null;

  // Move library - imported clips grouped by move
  moveLibrary: Record<string, string[]>; // moveKey -> clipPaths[]

  // Total measures
  totalMeasures: number;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Actions
  loadSong: (song: Song, path: string, name: string, audioPath?: string) => Promise<void>;
  updateSong: (song: Partial<Song>) => void;
  extractTempoChanges: () => Promise<void>;
  addMoveEvent: (difficulty: "supereasy" | "easy" | "medium" | "expert", moveEvent: MoveEvent) => void;
  removeMoveEvent: (difficulty: "supereasy" | "easy" | "medium" | "expert", index: number) => void;
  updateMoveEvent: (difficulty: "supereasy" | "easy" | "medium" | "expert", index: number, moveEvent: Partial<MoveEvent>) => void;
  addCameraEvent: (difficulty: "easy" | "medium" | "expert", cameraEvent: CameraEvent) => void;
  removeCameraEvent: (difficulty: "easy" | "medium" | "expert", index: number) => void;
  updateCameraEvent: (difficulty: "easy" | "medium" | "expert", index: number, cameraEvent: Partial<CameraEvent>) => void;

  // Song Event actions
  addEvent: (event: SongEvent) => void;
  removeEvent: (index: number) => void;
  updateEvent: (index: number, eventUpdate: Partial<SongEvent>) => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearSong: () => void;
  saveSong: () => Promise<void>;
  updateSongMeta: (metaUpdate: SongMeta) => void;
  buildAndSave: (compression: boolean) => Promise<void>;
  // Move library actions
  addClipToLibrary: (category: string, song: string, move: string, clip: string) => void;
  removeClipFromLibrary: (category: string, song: string, move: string, clip: string) => void;
  removeMoveFromLibrary: (category: string, song: string, move: string) => void;

  // Total measures
  setTotalMeasures: (measures: number) => void;

  // Tempo Change actions
  addTempoChange: (tempoChange: TempoChange) => void;
  removeTempoChange: (index: number) => void;
  updateTempoChange: (index: number, tempoChangeUpdate: Partial<TempoChange>) => void;

  // Drums actions
  updateDrums: (drums: DrumsEvent[]) => void;

  // Practice section actions
  addPracticeSection: (difficulty: "easy" | "medium" | "expert", name: string) => void;
  removePracticeSection: (difficulty: "easy" | "medium" | "expert", index: number) => void;
  updatePracticeSection: (difficulty: "easy" | "medium" | "expert", index: number, section: Partial<PracticeSection>) => void;
  addMoveToPracticeSection: (difficulty: "easy" | "medium" | "expert", sectionIndex: number, beat: number) => boolean;
  removeMoveFromPracticeSection: (difficulty: "easy" | "medium" | "expert", sectionIndex: number, moveIndex: number) => void;

  // BattleSteps actions
  addBattleStep: (battleStep: BattleEvent) => void;
  removeBattleStep: (index: number) => void;
  updateBattleStep: (index: number, battleStepUpdate: Partial<BattleEvent>) => void;

  // BamPhrases actions
  addBamPhrase: (bamPhrase: BamPhrase) => void;
  removeBamPhrase: (index: number) => void;
  updateBamPhrase: (index: number, bamPhraseUpdate: Partial<BamPhrase>) => void;

  // DancerFaces actions
  addDancerFaceEvent: (track: "easy" | "medium" | "expert", dancerFaceEvent: DancerFaceEvent) => void;
  removeDancerFaceEvent: (track: "easy" | "medium" | "expert", index: number) => void;
  updateDancerFaceEvent: (track: "easy" | "medium" | "expert", index: number, dancerFaceEventUpdate: Partial<DancerFaceEvent>) => void;

  // PartyJumps actions
  addPartyJump: (partyJump: PartyJumpEvent) => void;
  removePartyJump: (index: number) => void;
  updatePartyJump: (index: number, partyJumpUpdate: Partial<PartyJumpEvent>) => void;

  addpartyBattleSteps: (data: BattleEvent) => void;
  removepartyBattleSteps: (index: number) => void;
  updatepartyBattleSteps: (index: number, dataUpdate: Partial<BattleEvent>) => void;
}

export const useSongStore = create<SongState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentSong: null as Song | null,
      songPath: null as string | null,
      isLoaded: false,
      songName: null as string | null,
      songVersion: null as string | null,
      songMeta: null as SongMeta | null,
      audioPath: null as string | null,
      moveLibrary: {} as Record<string, string[]>,
      totalMeasures: 0,
      isLoading: false,
      error: null as string | null,

      // Actions
      loadSong: async (song, songPath, name) => {
        console.log("Loading song:", name, songPath);

        // Convert camera events from saved format to runtime format
        const convertedSong = { ...song };
        if (convertedSong.timeline) {
          Object.keys(convertedSong.timeline).forEach((difficulty) => {
            const difficultyTimeline = convertedSong.timeline[difficulty as keyof typeof convertedSong.timeline];
            if (difficultyTimeline.cameras) {
              difficultyTimeline.cameras = difficultyTimeline.cameras.map((cameraEvent: any) => {
                // If it has 'position' field (saved format), convert to 'camera' field (runtime format)
                if (cameraEvent.position && !cameraEvent.camera) {
                  return {
                    ...cameraEvent,
                    camera: cameraEvent.position,
                  };
                }
                return cameraEvent;
              });
            }
          });
        }

        const lastEvent = convertedSong.events.filter((e) => e.type === "end");

        let totalMeasures = 0;
        if (lastEvent.length > 0) {
          totalMeasures = Math.ceil((lastEvent[0].beat + 1) / 4);
        }

        // Update the song state with metadata
        set({
          currentSong: {
            ...convertedSong,
            practice: convertedSong.practice || {
              easy: [],
              medium: [],
              expert: [],
            },
            tempoChanges: convertedSong.tempoChanges || [],
          },
          songPath: songPath,
          songName: name,
          moveLibrary: song.moveLibrary || {},
          songMeta: convertedSong.meta || null,
          totalMeasures: totalMeasures,
          isLoaded: true,
          isLoading: false,
          error: null,
          audioPath: path.join(songPath, `${name}.ogg`),
        });
      },

      updateSong: (songUpdate) => {
        const { currentSong } = get();
        if (currentSong) {
          set({
            currentSong: { ...currentSong, ...songUpdate },
          });
        }
      },

      addMoveEvent: (difficulty, moveEvent) => {
        const { currentSong } = get();
        if (currentSong) {
          const updatedSong = { ...currentSong };

          if (difficulty === "supereasy") {
            // Supereasy moves are stored directly in the array
            updatedSong.supereasy.push(moveEvent);
            updatedSong.supereasy.sort((a: MoveEvent, b: MoveEvent) => a.measure - b.measure);
          } else {
            updatedSong.timeline[difficulty].moves.push(moveEvent);
            // Sort by beat
            updatedSong.timeline[difficulty].moves.sort((a: MoveEvent, b: MoveEvent) => a.measure - b.measure);
          }

          set({ currentSong: updatedSong });
        }
      },

      removeMoveEvent: (difficulty, index) => {
        const { currentSong } = get();
        if (currentSong) {
          const updatedSong = { ...currentSong };

          if (difficulty === "supereasy") {
            // Supereasy moves are stored directly in the array
            updatedSong.supereasy.splice(index, 1);
          } else {
            // Remove from timeline based on difficulty
            updatedSong.timeline[difficulty].moves.splice(index, 1);
          }

          set({ currentSong: updatedSong });
        }
      },

      updateMoveEvent: (difficulty, index, moveEventUpdate) => {
        const { currentSong } = get();
        if (currentSong) {
          const updatedSong = { ...currentSong };

          if (difficulty === "supereasy") {
            // Supereasy moves are stored directly in the array
            updatedSong.supereasy[index] = {
              ...updatedSong.supereasy[index],
              ...moveEventUpdate,
            };

            if (moveEventUpdate.measure !== undefined) {
              updatedSong.supereasy.sort((a: MoveEvent, b: MoveEvent) => a.measure - b.measure);
            }
          } else {
            updatedSong.timeline[difficulty].moves[index] = {
              ...updatedSong.timeline[difficulty].moves[index],
              ...moveEventUpdate,
            };
            // Re-sort if beat was changed
            if (moveEventUpdate.measure !== undefined) {
              updatedSong.timeline[difficulty].moves.sort((a: MoveEvent, b: MoveEvent) => a.measure - b.measure);
            }
          }
          set({ currentSong: updatedSong });
        }
      },

      addCameraEvent: (difficulty, cameraEvent) => {
        const { currentSong } = get();
        if (currentSong) {
          const updatedSong = { ...currentSong };
          updatedSong.timeline[difficulty].cameras.push(cameraEvent);
          // Sort by beat
          updatedSong.timeline[difficulty].cameras.sort((a: CameraEvent, b: CameraEvent) => a.beat - b.beat);
          set({ currentSong: updatedSong });
        }
      },

      removeCameraEvent: (difficulty, index) => {
        const { currentSong } = get();
        if (currentSong) {
          const updatedSong = { ...currentSong };
          updatedSong.timeline[difficulty].cameras.splice(index, 1);
          set({ currentSong: updatedSong });
        }
      },

      updateCameraEvent: (difficulty, index, cameraEventUpdate) => {
        const { currentSong } = get();
        if (currentSong) {
          const updatedSong = { ...currentSong };
          updatedSong.timeline[difficulty].cameras[index] = {
            ...updatedSong.timeline[difficulty].cameras[index],
            ...cameraEventUpdate,
          };
          // Re-sort if beat was changed
          if (cameraEventUpdate.beat !== undefined) {
            updatedSong.timeline[difficulty].cameras.sort((a: CameraEvent, b: CameraEvent) => a.beat - b.beat);
          }
          set({ currentSong: updatedSong });
        }
      },

      // Song Event actions
      addEvent: (event) => {
        set((state) => {
          if (!state.currentSong) return {};
          const newEvents = [...(state.currentSong.events || []), event];
          newEvents.sort((a, b) => a.beat - b.beat);
          return {
            currentSong: {
              ...state.currentSong,
              events: newEvents,
            },
          };
        });
      },

      removeEvent: (index) => {
        set((state) => {
          if (!state.currentSong?.events) return {};
          const newEvents = [...state.currentSong.events];
          newEvents.splice(index, 1);
          return {
            currentSong: {
              ...state.currentSong,
              events: newEvents,
            },
          };
        });
      },

      updateEvent: (index, eventUpdate) => {
        set((state) => {
          if (!state.currentSong?.events?.[index]) return {};
          const newEvents = [...state.currentSong.events];
          newEvents[index] = {
            ...newEvents[index],
            ...eventUpdate,
          };
          if (eventUpdate.beat !== undefined) {
            newEvents.sort((a, b) => a.beat - b.beat);
          }
          return {
            currentSong: {
              ...state.currentSong,
              events: newEvents,
            },
          };
        });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setError: (error) => {
        set({ error });
      },

      clearSong: () => {
        set({
          currentSong: null,
          songPath: null,
          songName: null,
          songVersion: null,
          songMeta: null,
          totalMeasures: 0,
          audioPath: null,
          isLoaded: false,
          isLoading: false,
          error: null,
        });
      },

      updateSongMeta: (metaUpdate: Partial<SongMeta>) => {
        const { currentSong } = get();
        if (currentSong) {
          const updatedMeta = currentSong.meta ? { ...currentSong.meta, ...metaUpdate } : (metaUpdate as SongMeta);
          set({
            currentSong: { ...currentSong, meta: updatedMeta },
            songMeta: updatedMeta,
          });
        }
      },

      saveSong: async () => {
        const { currentSong, songPath } = get();

        try {
          set({ isLoading: true, error: null });
          toast.loading("Saving song...", { id: "save-song" });

          // Convert timeline data to match C# model format
          const convertCameraEvents = (events: CameraEvent[]): CameraEventForSave[] => {
            return events.map((event) => ({
              beat: event.beat,
              position: event.camera, // Convert "camera" field to "position"
            }));
          };

          const timelineForSave: TimelineForSave = {
            easy: {
              moves: currentSong.timeline.easy.moves,
              cameras: convertCameraEvents(currentSong.timeline.easy.cameras),
            },
            medium: {
              moves: currentSong.timeline.medium.moves,
              cameras: convertCameraEvents(currentSong.timeline.medium.cameras),
            },
            expert: {
              moves: currentSong.timeline.expert.moves,
              cameras: convertCameraEvents(currentSong.timeline.expert.cameras),
            },
          };

          // Update song with current audio paths, tempo changes, and metadata
          const songToSave = {
            ...currentSong,
            timeline: timelineForSave,
            meta: get().songMeta,
          };

          // Save version info
          await window.electronAPI.writeFile(`${songPath}/.boomy`, "song3");

          // Save song data
          await window.electronAPI.writeFile(`${songPath}/song.json`, JSON.stringify(songToSave));

          console.log(`${songPath}/song.json`);

          toast.success("Song saved successfully!", {
            id: "save-song",
            description: "Song data and timeline files have been saved.",
          });

          set({ isLoading: false, error: null });
        } catch (error) {
          const errorMsg = `Failed to save song: ${error}`;
          set({
            isLoading: false,
            error: errorMsg,
          });
          toast.error(errorMsg, { id: "save-song" });
        }
      },

      buildAndSave: async (compression: boolean) => {
        const { currentSong, songPath, audioPath } = get();

        if (!currentSong || !songPath) {
          toast.error("No song loaded to build");
          return;
        }

        try {
          const result = await window.electronAPI.convertToMogg(audioPath);
          toast.success(`Converted successfully`, {
            description: `Output: ${result.outputPath}`,
          });
        } catch (error) {
          toast.error(`Error converting to MOGG. Build will fail you did not build it manually!`, {
            description: error.toString(),
          });
        }

        try {
          set({ isLoading: true, error: null });
          toast.loading("Building and saving...", {
            id: "build-save",
          });

          // First save the song normally
          await get().saveSong();

          // Convert timeline data to match C# model format
          const convertCameraEvents = (events: CameraEvent[]): CameraEventForSave[] => {
            return events.map((event) => ({
              beat: event.beat,
              position: event.camera, // Convert "camera" field to "position"
            }));
          };

          const timelineForBuild: TimelineForSave = {
            easy: {
              moves: currentSong.timeline.easy.moves,
              cameras: convertCameraEvents(currentSong.timeline.easy.cameras),
            },
            medium: {
              moves: currentSong.timeline.medium.moves,
              cameras: convertCameraEvents(currentSong.timeline.medium.cameras),
            },
            expert: {
              moves: currentSong.timeline.expert.moves,
              cameras: convertCameraEvents(currentSong.timeline.expert.cameras),
            },
          };

          // Create BuildRequest format
          const buildRequest = {
            path: songPath,
            moves_path: currentSong.move_lib, // Default moves path
            out_path: `${songPath}/build`, // Output to build subfolder
            timeline: timelineForBuild,
            practice: currentSong.practice,
            tempo_change: currentSong.tempoChanges,
            compress: compression,
          };

          // Call BoomyBuilder via Edge.js instead of saving build-request.json
          toast.loading("Calling BoomyBuilder...", {
            id: "build-save",
          });

          const buildResult = await window.electronAPI.callBoomyBuilder(buildRequest);

          console.log("BoomyBuilder result:", buildResult);

          set({ isLoading: false });

          if (buildResult.success) {
            toast.success("Build completed successfully!", {
              id: "build-save",
              description: "Song has been built and output generated.",
            });
          } else {
            throw new Error(buildResult.error || "Unknown build error");
          }
        } catch (error) {
          const errorMsg = `Failed to build song: ${error}`;
          set({
            isLoading: false,
            error: errorMsg,
          });
          toast.error(errorMsg, { id: "build-save" });
        }
      },

      // Move library actions
      addClipToLibrary: (category, song, move, clip) => {
        set((state) => {
          const moveKey = `${category}/${song}/${move}`;
          const newLibrary = { ...state.moveLibrary };

          if (!newLibrary[moveKey]) {
            newLibrary[moveKey] = [];
          }

          const clipPath = `${category}/${song}/${move}/${clip}`;
          if (!newLibrary[moveKey].includes(clipPath)) {
            newLibrary[moveKey].push(clipPath);
          }

          // Also update currentSong if it exists
          const updatedSong = state.currentSong
            ? {
                ...state.currentSong,
                moveLibrary: newLibrary,
              }
            : null;

          return {
            moveLibrary: newLibrary,
            currentSong: updatedSong,
          };
        });
      },

      removeClipFromLibrary: (category, song, move, clip) => {
        set((state) => {
          const moveKey = `${category}/${song}/${move}`;
          const newLibrary = { ...state.moveLibrary };

          if (newLibrary[moveKey]) {
            const clipPath = `${category}/${song}/${move}/${clip}`;
            const index = newLibrary[moveKey].indexOf(clipPath);
            if (index !== -1) {
              newLibrary[moveKey].splice(index, 1);
            }

            // Remove move key if no clips left
            if (newLibrary[moveKey].length === 0) {
              delete newLibrary[moveKey];
            }
          }

          // Also update currentSong if it exists
          const updatedSong = state.currentSong
            ? {
                ...state.currentSong,
                moveLibrary: newLibrary,
              }
            : null;

          return {
            moveLibrary: newLibrary,
            currentSong: updatedSong,
          };
        });
      },

      removeMoveFromLibrary: (category, song, move) => {
        set((state) => {
          const moveKey = `${category}/${song}/${move}`;
          const newLibrary = { ...state.moveLibrary };
          delete newLibrary[moveKey];

          // Also update currentSong if it exists
          const updatedSong = state.currentSong
            ? {
                ...state.currentSong,
                moveLibrary: newLibrary,
              }
            : null;

          return {
            moveLibrary: newLibrary,
            currentSong: updatedSong,
          };
        });
      },

      // Set total measures
      setTotalMeasures: (measures: number) => {
        set((state) => {
          const { currentSong } = state;
          if (!currentSong) return {};

          const totalMeasures = Math.max(1, Math.floor(measures));

          // 1. Calculate the last beat in the last measure (assuming 4/4, adjust if needed)
          const beatCount = 4;
          const lastBeat = totalMeasures * beatCount - 1;

          // 2. Ensure the end event is at the last beat
          let events = [...(currentSong.events || [])];
          const endIdx = events.findIndex((e) => e.type === "end");
          if (endIdx !== -1) {
            events[endIdx] = { ...events[endIdx], beat: lastBeat };
          } else {
            events.push({
              type: "end",
              beat: lastBeat,
            });
          }

          // 3. Cleanup helpers
          const isValidMeasure = (measure: number) => measure < totalMeasures;
          const isValidBeat = (beat: number) => beat <= lastBeat;

          // Timeline moves cleanup
          const cleanMoves = (moves: MoveEvent[]) => (moves || []).filter((ev) => isValidMeasure(ev.measure));

          // Practice cleanup (array of arrays of beats or MoveEvents)
          const cleanPractice = (practice: any[][]) =>
            (practice || []).map((section) =>
              (section || []).filter((move) => (typeof move === "number" && isValidBeat(move)) || (typeof move === "object" && isValidMeasure(move.measure) && isValidBeat(move.beat ?? move.measure * beatCount))),
            );

          // Timeline cleanup
          const cleanTimeline = (timeline: any) => ({
            ...timeline,
            moves: cleanMoves(timeline.moves),
            cameras: (timeline.cameras || []).filter((ev: CameraEvent) => isValidBeat(ev.beat)),
          });

          // Drums cleanup
          const cleanDrums = (drums: any[]) =>
            (drums || [])
              .map((drum) => ({
                ...drum,
                Events: (drum.Events || []).filter((beat: number) => isValidBeat(beat)),
              }))
              .filter((drum) => drum.Events && drum.Events.length > 0);

          // 4. Apply cleanup to all relevant arrays
          return {
            totalMeasures,
            currentSong: {
              ...currentSong,
              events: events.filter((ev) => isValidBeat(ev.beat)),
              timeline: {
                ...currentSong.timeline,
                easy: cleanTimeline(currentSong.timeline.easy),
                medium: cleanTimeline(currentSong.timeline.medium),
                expert: cleanTimeline(currentSong.timeline.expert),
              },
              practice: {
                easy: cleanPractice(currentSong.practice?.easy),
                medium: cleanPractice(currentSong.practice?.medium),
                expert: cleanPractice(currentSong.practice?.expert),
              },
              battleSteps: (currentSong.battleSteps || []).filter((ev) => isValidMeasure(ev.measure)),
              partyJumps: (currentSong.partyJumps || []).filter((ev) => isValidMeasure(ev.measure)),
              partyBattleSteps: (currentSong.partyBattleSteps || []).filter((ev) => isValidMeasure(ev.measure)),
              tempoChanges: (currentSong.tempoChanges || []).filter((tc) => isValidMeasure(tc.measure)),
              cleanDrums: cleanDrums(currentSong.drums),
            },
          };
        });
      },

      // Tempo Change actions
      addTempoChange: (tempoChange) => {
        set((state) => {
          if (!state.currentSong) return {};
          const newTempoChanges = [...(state.currentSong.tempoChanges || []), tempoChange];
          newTempoChanges.sort((a, b) => a.measure - b.measure);
          return {
            currentSong: {
              ...state.currentSong,
              tempoChanges: newTempoChanges,
            },
          };
        });
      },

      removeTempoChange: (index) => {
        set((state) => {
          if (!state.currentSong?.tempoChanges) return {};
          const newTempoChanges = [...state.currentSong.tempoChanges];
          newTempoChanges.splice(index, 1);
          return {
            currentSong: {
              ...state.currentSong,
              tempoChanges: newTempoChanges,
            },
          };
        });
      },

      updateTempoChange: (index, tempoChangeUpdate) => {
        set((state) => {
          if (!state.currentSong?.tempoChanges?.[index]) return {};
          const newTempoChanges = [...state.currentSong.tempoChanges];
          newTempoChanges[index] = {
            ...newTempoChanges[index],
            ...tempoChangeUpdate,
          };
          if (tempoChangeUpdate.measure !== undefined) {
            newTempoChanges.sort((a, b) => a.measure - b.measure);
          }
          return {
            currentSong: {
              ...state.currentSong,
              tempoChanges: newTempoChanges,
            },
          };
        });
      },

      // Drums actions
      updateDrums: (drums) => {
        set((state) => {
          if (!state.currentSong) return {};
          const updatedSong = { ...state.currentSong };
          updatedSong.drums = drums;

          return {
            currentSong: {
              ...updatedSong,
            },
          };
        });
      },

      // Practice section actions
      addPracticeSection: (difficulty, _name) => {
        const { currentSong } = get();
        if (currentSong) {
          const updatedSong = { ...currentSong };

          // Initialize practice property if it doesn't exist
          if (!updatedSong.practice) {
            updatedSong.practice = {
              easy: [],
              medium: [],
              expert: [],
            };
          }

          // Auto-generate section name based on index (sections are auto-numbered)
          const sectionCount = updatedSong.practice[difficulty].length + 1;

          // Add the new section
          const newSection: PracticeSection = [];

          updatedSong.practice[difficulty].push(newSection);
          set({ currentSong: updatedSong });
          toast.success(`Added practice section ${sectionCount}`);
        }
      },

      removePracticeSection: (difficulty, index) => {
        const { currentSong } = get();
        if (currentSong?.practice?.[difficulty]) {
          const updatedSong = { ...currentSong };
          const sectionNumber = index + 1;
          updatedSong.practice[difficulty].splice(index, 1);
          set({ currentSong: updatedSong });
          toast.success(`Removed Section ${sectionNumber}`);
        }
      },

      updatePracticeSection: (difficulty, index, sectionUpdate) => {
        const { currentSong } = get();
        if (currentSong?.practice?.[difficulty]?.[index]) {
          const updatedSong = { ...currentSong };

          // Since PracticeSection is now an array of MoveEvents,
          // we need to handle this differently based on what's in sectionUpdate
          if (Array.isArray(sectionUpdate)) {
            // If sectionUpdate is an array, replace the entire section
            updatedSong.practice[difficulty][index] = sectionUpdate;
          } else {
            // Otherwise, log a warning as this doesn't match our data model
            console.warn("Attempted to update a practice section with non-array data:", sectionUpdate);
          }
          set({ currentSong: updatedSong });
        }
      },

      addMoveToPracticeSection: (difficulty, sectionIndex, beat) => {
        const { currentSong } = get();
        if (currentSong?.practice?.[difficulty]?.[sectionIndex]) {
          // Check if this move already exists in any section of this difficulty
          const isDuplicate = currentSong.practice[difficulty].find((section) => Array.isArray(section) && section.some((move) => move === beat));

          if (isDuplicate) {
            toast.error("This move already exists in a practice section");
            return false;
          }

          const updatedSong = { ...currentSong };

          // Ensure the section is an array
          if (!Array.isArray(updatedSong.practice[difficulty][sectionIndex])) {
            updatedSong.practice[difficulty][sectionIndex] = [];
          }

          updatedSong.practice[difficulty][sectionIndex].push(beat);
          set({ currentSong: updatedSong });
          return true;
        }
        return false;
      },

      removeMoveFromPracticeSection: (difficulty, sectionIndex, moveIndex) => {
        const { currentSong } = get();
        if (currentSong?.practice?.[difficulty]?.[sectionIndex] && Array.isArray(currentSong.practice[difficulty][sectionIndex]) && currentSong.practice[difficulty][sectionIndex][moveIndex]) {
          const updatedSong = { ...currentSong };
          updatedSong.practice[difficulty][sectionIndex].splice(moveIndex, 1);
          set({ currentSong: updatedSong });
          toast.success("Move removed from practice section");
        }
      },

      // BattleSteps actions
      addBattleStep: (battleStep) => {
        const { currentSong } = get();
        if (currentSong) {
          const updatedSong = { ...currentSong };
          updatedSong.battleSteps = [...(updatedSong.battleSteps || []), battleStep];
          set({ currentSong: updatedSong });
        }
      },

      removeBattleStep: (index) => {
        const { currentSong } = get();
        if (currentSong?.battleSteps?.[index] !== undefined) {
          const updatedSong = { ...currentSong };
          updatedSong.battleSteps = [...updatedSong.battleSteps];
          updatedSong.battleSteps.splice(index, 1);
          set({ currentSong: updatedSong });
        }
      },

      updateBattleStep: (index, battleStepUpdate) => {
        const { currentSong } = get();
        if (currentSong?.battleSteps?.[index] !== undefined) {
          const updatedSong = { ...currentSong };
          updatedSong.battleSteps = [...updatedSong.battleSteps];
          updatedSong.battleSteps[index] = {
            ...updatedSong.battleSteps[index],
            ...battleStepUpdate,
          };
          set({ currentSong: updatedSong });
        }
      },

      // BamPhrases actions
      addBamPhrase: (bamPhrase) => {
        const { currentSong } = get();
        if (currentSong) {
          const updatedSong = { ...currentSong };
          updatedSong.bamPhrases = [...(updatedSong.bamPhrases || []), bamPhrase];
          set({ currentSong: updatedSong });
        }
      },

      removeBamPhrase: (index) => {
        const { currentSong } = get();
        if (currentSong?.bamPhrases?.[index] !== undefined) {
          const updatedSong = { ...currentSong };
          updatedSong.bamPhrases = [...updatedSong.bamPhrases];
          updatedSong.bamPhrases.splice(index, 1);
          set({ currentSong: updatedSong });
          toast.success("Bam phrase removed");
        }
      },

      updateBamPhrase: (index, bamPhraseUpdate) => {
        const { currentSong } = get();
        if (currentSong?.bamPhrases?.[index] !== undefined) {
          const updatedSong = { ...currentSong };
          updatedSong.bamPhrases = [...updatedSong.bamPhrases];
          updatedSong.bamPhrases[index] = {
            ...updatedSong.bamPhrases[index],
            ...bamPhraseUpdate,
          };
          set({ currentSong: updatedSong });
        }
      },

      // PartyJumps actions
      addPartyJump: (partyJump) => {
        const { currentSong } = get();
        if (currentSong) {
          const updatedSong = { ...currentSong };
          updatedSong.partyJumps = [...(updatedSong.partyJumps || []), partyJump];
          set({ currentSong: updatedSong });
        }
      },

      removePartyJump: (index) => {
        const { currentSong } = get();
        if (currentSong?.partyJumps?.[index] !== undefined) {
          const updatedSong = { ...currentSong };
          updatedSong.partyJumps = [...updatedSong.partyJumps];
          updatedSong.partyJumps.splice(index, 1);
          set({ currentSong: updatedSong });
        }
      },

      updatePartyJump: (index, partyJumpUpdate) => {
        const { currentSong } = get();
        if (currentSong?.partyJumps?.[index] !== undefined) {
          const updatedSong = { ...currentSong };
          updatedSong.partyJumps = [...updatedSong.partyJumps];
          updatedSong.partyJumps[index] = {
            ...updatedSong.partyJumps[index],
            ...partyJumpUpdate,
          };
          set({ currentSong: updatedSong });
        }
      },

      // partyBattleSteps actions
      addpartyBattleSteps: (data) => {
        const { currentSong } = get();
        if (currentSong) {
          const updatedSong = { ...currentSong };
          updatedSong.partyBattleSteps = [...(updatedSong.partyBattleSteps || []), data];
          set({ currentSong: updatedSong });
        }
      },

      removepartyBattleSteps: (index) => {
        const { currentSong } = get();
        if (currentSong?.partyBattleSteps?.[index] !== undefined) {
          const updatedSong = { ...currentSong };
          updatedSong.partyBattleSteps = [...updatedSong.partyBattleSteps];
          updatedSong.partyBattleSteps.splice(index, 1);
          set({ currentSong: updatedSong });
        }
      },

      updatepartyBattleSteps: (index, dataUpdate) => {
        const { currentSong } = get();
        if (currentSong?.partyBattleSteps?.[index] !== undefined) {
          const updatedSong = { ...currentSong };
          updatedSong.partyBattleSteps = [...updatedSong.partyBattleSteps];
          updatedSong.partyBattleSteps[index] = {
            ...updatedSong.partyBattleSteps[index],
            ...dataUpdate,
          };
          set({ currentSong: updatedSong });
        }
      },

      addDancerFaceEvent: (track, dancerFaceEvent) => {
        const { currentSong } = get();
        if (currentSong) {
          const updatedSong = { ...currentSong };
          if (!updatedSong.dancerFaces) {
            updatedSong.dancerFaces = {
              easy: [],
              medium: [],
              expert: [],
            };
          }
          updatedSong.dancerFaces[track] = [...(updatedSong.dancerFaces[track] || []), dancerFaceEvent];
          set({ currentSong: updatedSong });
        }
      },

      removeDancerFaceEvent: (track, index) => {
        const { currentSong } = get();
        if (currentSong?.dancerFaces?.[track]?.[index] !== undefined) {
          const updatedSong = { ...currentSong };
          updatedSong.dancerFaces = { ...updatedSong.dancerFaces };
          updatedSong.dancerFaces[track] = [...updatedSong.dancerFaces[track]];
          updatedSong.dancerFaces[track].splice(index, 1);
          set({ currentSong: updatedSong });
        }
      },

      updateDancerFaceEvent: (track, index, dancerFaceEventUpdate) => {
        const { currentSong } = get();
        if (currentSong?.dancerFaces?.[track]?.[index] !== undefined) {
          const updatedSong = { ...currentSong };
          updatedSong.dancerFaces = { ...updatedSong.dancerFaces };
          updatedSong.dancerFaces[track] = [...updatedSong.dancerFaces[track]];
          updatedSong.dancerFaces[track][index] = {
            ...updatedSong.dancerFaces[track][index],
            ...dancerFaceEventUpdate,
          };
          set({ currentSong: updatedSong });
        }
      },
    }),
    {
      name: "song-store", // unique name for devtools
    },
  ),
);

// Selectors for common use cases
export const useSongData = () => useSongStore((state) => state.currentSong);
export const useSongMeta = () => useSongStore((state) => state.songMeta);
export const useSongPath = () => useSongStore((state) => state.songPath);
export const useSongName = () => useSongStore((state) => state.songName);
export const useAudioPath = () => useSongStore((state) => state.audioPath);
export const useIsLoaded = () => useSongStore((state) => state.isLoaded);
export const useIsLoading = () => useSongStore((state) => state.isLoading);
export const useSongError = () => useSongStore((state) => state.error);
export const useMoveLibrary = () => useSongStore((state) => state.moveLibrary);
export const useTempoChanges = () => useSongStore((state) => state.currentSong.tempoChanges);
export const usePartyJumps = () => useSongStore((state) => state.currentSong.partyJumps);
export const useBattleSteps = () => useSongStore((state) => state.currentSong.battleSteps);
export const useBamPhrases = () => useSongStore((state) => state.currentSong.bamPhrases);
export const usePartyBattleSteps = () => useSongStore((state) => state.currentSong.partyBattleSteps);
