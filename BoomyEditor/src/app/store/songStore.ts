import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
	Song,
	MoveEvent,
	CameraEvent,
	TimelineForSave,
	CameraEventForSave,
} from '../types/song';
import { toast } from 'sonner';

interface SongState {
	// Current song data
	currentSong: Song | null;
	songPath: string | null;
	isLoaded: boolean;

	// Song metadata
	songName: string | null;
	songVersion: string | null;

	// Audio paths
	audioPath: string | null;
	midiPath: string | null;

	// Move library - imported clips grouped by move
	moveLibrary: Record<string, string[]>; // moveKey -> clipPaths[]

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
	buildAndSave: () => Promise<void>;
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
			audioPath: null as string | null,
			midiPath: null as string | null,
			moveLibrary: {} as Record<string, string[]>,
			isLoading: false,
			error: null as string | null,

			// Actions
			loadSong: (song, path, name, audioPath, midiPath) => {
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

				set({
					currentSong: convertedSong,
					songPath: path,
					songName: name,
					audioPath: audioPath || null,
					midiPath: midiPath || null,
					moveLibrary: song.moveLibrary || {},
					isLoaded: true,
					isLoading: false,
					error: null,
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
					audioPath: null,
					midiPath: null,
					isLoaded: false,
					isLoading: false,
					error: null,
				});
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

					// Update song with current audio paths
					const songToSave = {
						...currentSong,
						timeline: timelineForSave,
					};

					// Save version info
					await window.electronAPI.writeFile(
						`${songPath}/.boomy`,
						'song1'
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
				} catch (error) {
					const errorMsg = `Failed to save song: ${error}`;
					set({
						isLoading: false,
						error: errorMsg,
					});
					toast.error(errorMsg, { id: 'save-song' });
				}
			},

			buildAndSave: async () => {
				const { currentSong, songPath, audioPath } = get();

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
					toast.error(`Error converting to MOGG`, {
						description: error.toString(),
					});
					return;
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
					};

					// Call BoomyBuilder via Edge.js instead of saving build-request.json
					toast.loading('Calling BoomyBuilder...', {
						id: 'build-save',
					});

					const buildResult =
						await window.electronAPI.callBoomyBuilder(buildRequest);

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
		}),
		{
			name: 'song-store', // unique name for devtools
		}
	)
);

// Selectors for common use cases
export const useSongData = () => useSongStore((state) => state.currentSong);
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
