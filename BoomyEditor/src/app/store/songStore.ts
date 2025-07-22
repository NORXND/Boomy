import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
	Song,
	MoveEvent,
	CameraEvent,
	TimelineForSave,
	CameraEventForSave,
	PracticeSection,
	TempoChange,
} from '../types/song';
import { toast } from 'sonner';
import { extractTempoChangesFromMidi } from '../utils/midiUtils';

import { SongMeta } from '../types/song';

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
	midiPath: string | null;

	// Move library - imported clips grouped by move
	moveLibrary: Record<string, string[]>; // moveKey -> clipPaths[]

	tempoChanges: TempoChange[];

	// Loading state
	isLoading: boolean;
	error: string | null;

	// Actions
	loadSong: (
		song: Song,
		path: string,
		name: string,
		audioPath?: string,
		midiPath?: string
	) => void;
	updateSong: (song: Partial<Song>) => void;
	extractTempoChanges: () => Promise<void>;
	addMoveEvent: (
		difficulty: 'easy' | 'medium' | 'expert',
		moveEvent: MoveEvent
	) => void;
	removeMoveEvent: (
		difficulty: 'easy' | 'medium' | 'expert',
		index: number
	) => void;
	updateMoveEvent: (
		difficulty: 'easy' | 'medium' | 'expert',
		index: number,
		moveEvent: Partial<MoveEvent>
	) => void;
	addCameraEvent: (
		difficulty: 'easy' | 'medium' | 'expert',
		cameraEvent: CameraEvent
	) => void;
	removeCameraEvent: (
		difficulty: 'easy' | 'medium' | 'expert',
		index: number
	) => void;
	updateCameraEvent: (
		difficulty: 'easy' | 'medium' | 'expert',
		index: number,
		cameraEvent: Partial<CameraEvent>
	) => void;
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	clearSong: () => void;
	saveSong: () => Promise<void>;
	updateSongMeta: (metaUpdate: SongMeta) => void;
	buildAndSave: (compression: boolean) => Promise<void>;
	// Move library actions
	addClipToLibrary: (
		category: string,
		song: string,
		move: string,
		clip: string
	) => void;
	removeClipFromLibrary: (
		category: string,
		song: string,
		move: string,
		clip: string
	) => void;
	removeMoveFromLibrary: (
		category: string,
		song: string,
		move: string
	) => void;

	// Practice section actions
	addPracticeSection: (
		difficulty: 'easy' | 'medium' | 'expert',
		name: string
	) => void;
	removePracticeSection: (
		difficulty: 'easy' | 'medium' | 'expert',
		index: number
	) => void;
	updatePracticeSection: (
		difficulty: 'easy' | 'medium' | 'expert',
		index: number,
		section: Partial<PracticeSection>
	) => void;
	addMoveToPracticeSection: (
		difficulty: 'easy' | 'medium' | 'expert',
		sectionIndex: number,
		beat: number
	) => boolean;
	removeMoveFromPracticeSection: (
		difficulty: 'easy' | 'medium' | 'expert',
		sectionIndex: number,
		moveIndex: number
	) => void;
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
			midiPath: null as string | null,
			moveLibrary: {} as Record<string, string[]>,
			isLoading: false,
			error: null as string | null,
			tempoChanges: [] as TempoChange[],

			// Actions
			loadSong: async (song, path, name, audioPath, midiPath) => {
				console.log('Loading song:', name, path);

				// Convert camera events from saved format to runtime format
				const convertedSong = { ...song };
				if (convertedSong.timeline) {
					Object.keys(convertedSong.timeline).forEach(
						(difficulty) => {
							const difficultyTimeline =
								convertedSong.timeline[
									difficulty as keyof typeof convertedSong.timeline
								];
							if (difficultyTimeline.cameras) {
								difficultyTimeline.cameras =
									difficultyTimeline.cameras.map(
										(cameraEvent: any) => {
											// If it has 'position' field (saved format), convert to 'camera' field (runtime format)
											if (
												cameraEvent.position &&
												!cameraEvent.camera
											) {
												return {
													...cameraEvent,
													camera: cameraEvent.position,
												};
											}
											return cameraEvent;
										}
									);
							}
						}
					);
				}

				let tempoChanges: TempoChange[] = [];
				if (midiPath) {
					tempoChanges = await extractTempoChangesFromMidi(midiPath);
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
					},
					songPath: path,
					songName: name,
					audioPath: audioPath || null,
					midiPath: midiPath || null,
					moveLibrary: song.moveLibrary || {},
					songMeta: convertedSong.meta || null,
					isLoaded: true,
					isLoading: false,
					error: null,
					tempoChanges: tempoChanges,
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
					updatedSong.timeline[difficulty].moves.push(moveEvent);
					// Sort by beat
					updatedSong.timeline[difficulty].moves.sort(
						(a: MoveEvent, b: MoveEvent) => a.beat - b.beat
					);
					set({ currentSong: updatedSong });
				}
			},

			removeMoveEvent: (difficulty, index) => {
				const { currentSong } = get();
				if (currentSong) {
					const updatedSong = { ...currentSong };
					updatedSong.timeline[difficulty].moves.splice(index, 1);
					set({ currentSong: updatedSong });
				}
			},

			updateMoveEvent: (difficulty, index, moveEventUpdate) => {
				const { currentSong } = get();
				if (currentSong) {
					const updatedSong = { ...currentSong };
					updatedSong.timeline[difficulty].moves[index] = {
						...updatedSong.timeline[difficulty].moves[index],
						...moveEventUpdate,
					};
					// Re-sort if beat was changed
					if (moveEventUpdate.beat !== undefined) {
						updatedSong.timeline[difficulty].moves.sort(
							(a: MoveEvent, b: MoveEvent) => a.beat - b.beat
						);
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
					updatedSong.timeline[difficulty].cameras.sort(
						(a: CameraEvent, b: CameraEvent) => a.beat - b.beat
					);
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
						updatedSong.timeline[difficulty].cameras.sort(
							(a: CameraEvent, b: CameraEvent) => a.beat - b.beat
						);
					}
					set({ currentSong: updatedSong });
				}
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
					audioPath: null,
					midiPath: null,
					isLoaded: false,
					isLoading: false,
					error: null,
				});
			},

			updateSongMeta: (metaUpdate: Partial<SongMeta>) => {
				const { currentSong } = get();
				if (currentSong) {
					const updatedMeta = currentSong.meta
						? { ...currentSong.meta, ...metaUpdate }
						: (metaUpdate as SongMeta);
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
					toast.loading('Saving song...', { id: 'save-song' });

					// Convert timeline data to match C# model format
					const convertCameraEvents = (
						events: CameraEvent[]
					): CameraEventForSave[] => {
						return events.map((event) => ({
							beat: event.beat,
							position: event.camera, // Convert "camera" field to "position"
						}));
					};

					const timelineForSave: TimelineForSave = {
						easy: {
							moves: currentSong.timeline.easy.moves,
							cameras: convertCameraEvents(
								currentSong.timeline.easy.cameras
							),
						},
						medium: {
							moves: currentSong.timeline.medium.moves,
							cameras: convertCameraEvents(
								currentSong.timeline.medium.cameras
							),
						},
						expert: {
							moves: currentSong.timeline.expert.moves,
							cameras: convertCameraEvents(
								currentSong.timeline.expert.cameras
							),
						},
					};

					// Update song with current audio paths, tempo changes, and metadata
					const songToSave = {
						...currentSong,
						timeline: timelineForSave,
						meta: get().songMeta,
					};

					// Save version info
					await window.electronAPI.writeFile(
						`${songPath}/.boomy`,
						'song2'
					);

					// Save song data
					await window.electronAPI.writeFile(
						`${songPath}/song.json`,
						JSON.stringify(songToSave)
					);

					console.log(`${songPath}/song.json`);

					toast.success('Song saved successfully!', {
						id: 'save-song',
						description:
							'Song data and timeline files have been saved.',
					});

					set({ isLoading: false, error: null });
				} catch (error) {
					const errorMsg = `Failed to save song: ${error}`;
					set({
						isLoading: false,
						error: errorMsg,
					});
					toast.error(errorMsg, { id: 'save-song' });
				}
			},

			extractTempoChanges: async () => {
				const { currentSong, midiPath } = get();

				if (!currentSong || !midiPath) {
					toast.error('No song or MIDI file loaded');
					return;
				}

				try {
					// Extract tempo changes using our utility function
					const tempoChanges = await extractTempoChangesFromMidi(
						midiPath
					);

					// Update the song with the tempo changes
					const updatedSong = { ...currentSong, tempoChanges };
					set({ currentSong: updatedSong });

					return tempoChanges;
				} catch (error) {
					const errorMsg = `Failed to extract tempo changes: ${error}`;
					toast.error(errorMsg, { id: 'extract-tempo' });
				}
			},

			buildAndSave: async (compression: boolean) => {
				const { currentSong, songPath, audioPath, tempoChanges } =
					get();

				if (!currentSong || !songPath) {
					toast.error('No song loaded to build');
					return;
				}

				try {
					const result = await window.electronAPI.convertToMogg(
						audioPath
					);
					toast.success(`Converted successfully`, {
						description: `Output: ${result.outputPath}`,
					});
				} catch (error) {
					toast.error(
						`Error converting to MOGG. Build will fail you did not build it manually!`,
						{
							description: error.toString(),
						}
					);
				}

				try {
					set({ isLoading: true, error: null });
					toast.loading('Building and saving...', {
						id: 'build-save',
					});

					// First save the song normally
					await get().saveSong();

					// Convert timeline data to match C# model format
					const convertCameraEvents = (
						events: CameraEvent[]
					): CameraEventForSave[] => {
						return events.map((event) => ({
							beat: event.beat,
							position: event.camera, // Convert "camera" field to "position"
						}));
					};

					const timelineForBuild: TimelineForSave = {
						easy: {
							moves: currentSong.timeline.easy.moves,
							cameras: convertCameraEvents(
								currentSong.timeline.easy.cameras
							),
						},
						medium: {
							moves: currentSong.timeline.medium.moves,
							cameras: convertCameraEvents(
								currentSong.timeline.medium.cameras
							),
						},
						expert: {
							moves: currentSong.timeline.expert.moves,
							cameras: convertCameraEvents(
								currentSong.timeline.expert.cameras
							),
						},
					};

					// Create BuildRequest format
					const buildRequest = {
						path: songPath,
						moves_path: currentSong.move_lib, // Default moves path
						out_path: `${songPath}/build`, // Output to build subfolder
						timeline: timelineForBuild,
						practice: currentSong.practice,
						tempo_change: tempoChanges,
						compress: compression,
					};

					// Call BoomyBuilder via Edge.js instead of saving build-request.json
					toast.loading('Calling BoomyBuilder...', {
						id: 'build-save',
					});

					const buildResult =
						await window.electronAPI.callBoomyBuilder(buildRequest);

					console.log('BoomyBuilder result:', buildResult);

					set({ isLoading: false });

					if (buildResult.success) {
						toast.success('Build completed successfully!', {
							id: 'build-save',
							description:
								'Song has been built and output generated.',
						});
					} else {
						throw new Error(
							buildResult.error || 'Unknown build error'
						);
					}
				} catch (error) {
					const errorMsg = `Failed to build song: ${error}`;
					set({
						isLoading: false,
						error: errorMsg,
					});
					toast.error(errorMsg, { id: 'build-save' });
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
					const sectionCount =
						updatedSong.practice[difficulty].length + 1;

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
						console.warn(
							'Attempted to update a practice section with non-array data:',
							sectionUpdate
						);
					}
					set({ currentSong: updatedSong });
				}
			},

			addMoveToPracticeSection: (difficulty, sectionIndex, beat) => {
				const { currentSong } = get();
				if (currentSong?.practice?.[difficulty]?.[sectionIndex]) {
					// Check if this move already exists in any section of this difficulty
					const isDuplicate = currentSong.practice[difficulty].find(
						(section) =>
							Array.isArray(section) &&
							section.some((move) => move === beat)
					);

					if (isDuplicate) {
						toast.error(
							'This move already exists in a practice section'
						);
						return false;
					}

					const updatedSong = { ...currentSong };

					// Ensure the section is an array
					if (
						!Array.isArray(
							updatedSong.practice[difficulty][sectionIndex]
						)
					) {
						updatedSong.practice[difficulty][sectionIndex] = [];
					}

					updatedSong.practice[difficulty][sectionIndex].push(beat);
					set({ currentSong: updatedSong });
					return true;
				}
				return false;
			},

			removeMoveFromPracticeSection: (
				difficulty,
				sectionIndex,
				moveIndex
			) => {
				const { currentSong } = get();
				if (
					currentSong?.practice?.[difficulty]?.[sectionIndex] &&
					Array.isArray(
						currentSong.practice[difficulty][sectionIndex]
					) &&
					currentSong.practice[difficulty][sectionIndex][moveIndex]
				) {
					const updatedSong = { ...currentSong };
					updatedSong.practice[difficulty][sectionIndex].splice(
						moveIndex,
						1
					);
					set({ currentSong: updatedSong });
					toast.success('Move removed from practice section');
				}
			},
		}),
		{
			name: 'song-store', // unique name for devtools
		}
	)
);

// Selectors for common use cases
export const useSongData = () => useSongStore((state) => state.currentSong);
export const useSongMeta = () => useSongStore((state) => state.songMeta);
export const useSongPath = () => useSongStore((state) => state.songPath);
export const useSongName = () => useSongStore((state) => state.songName);
export const useAudioPath = () => useSongStore((state) => state.audioPath);
export const useMidiPath = () => useSongStore((state) => state.midiPath);
export const useIsLoaded = () => useSongStore((state) => state.isLoaded);
export const useIsLoading = () => useSongStore((state) => state.isLoading);
export const useSongError = () => useSongStore((state) => state.error);
export const useMoveLibrary = () => useSongStore((state) => state.moveLibrary);

// Difficulty-specific selectors
export const useMoves = (difficulty: 'easy' | 'medium' | 'expert') =>
	useSongStore(
		(state) => state.currentSong?.timeline[difficulty].moves || []
	);

export const useCameras = (difficulty: 'easy' | 'medium' | 'expert') =>
	useSongStore(
		(state) => state.currentSong?.timeline[difficulty].cameras || []
	);

// Practice section selectors
export const usePracticeSections = (difficulty: 'easy' | 'medium' | 'expert') =>
	useSongStore((state) => {
		// Get the practice sections
		const sections = state.currentSong?.practice?.[difficulty] || [];

		// Filter out any sections that aren't arrays
		return sections.filter((section) => Array.isArray(section));
	});
