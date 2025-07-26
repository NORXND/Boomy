import React, {
	useState,
	useEffect,
	useCallback,
	useRef,
	memo,
	useMemo,
} from 'react';
import * as Tone from 'tone';
import {
	Play,
	Pause,
	Square,
	SkipBack,
	SkipForward,
	Lock,
	Unlock,
	Layers,
	Undo2,
	Redo2,
} from 'lucide-react';
import { useSongStore } from '../../store/songStore';
import { useTimelineContext } from '../../contexts/TimelineContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChoreographyTimeline } from './ChoreographyTimeline';
import { CameraShotsTimeline } from './CameraShotsTimeline';
import { EventsTimeline } from './EventsTimeline';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DrumsTimeline } from './DrumsTimeline';
import { useTempoChanges } from '../../store/songStore';
import { TempoChange } from '@/types/song';

export interface TimeSignature {
	numerator: number;
	denominator: number;
	ticks: number;
}

export interface Measure {
	number: number;
	startTime: number; // in seconds
	duration: number; // in seconds
	startBeat: number;
	beatCount: number;
	bpm: number;
}

export interface TimelineData {
	measures: Measure[];
	totalDuration: number;
	totalBeats: number;
	tempoChanges: TempoChange[];
	timeSignatures: TimeSignature[];
	beatMap: number[]; // beatMap[beat] = time in seconds
}

type TimelineMode = 'choreography' | 'cameras' | 'events' | 'drums';

export interface NewTimelineRootProps {
	mode?: TimelineMode;
}

// --- Layout Constants ---
const CELL_WIDTH = 150; // Fixed width for Event and Camera cells
const DRUM_CELL_WIDTH = 40; // Width for a single drum step (1/8th note)
const TRACK_HEADER_WIDTH = 192; // w-48

// Track mounted instances to handle StrictMode double mounting
const mountedRef = { current: new Set<string>() };

export function NewTimelineRoot({
	mode = 'choreography',
}: NewTimelineRootProps) {
	// Create a unique ID for this component instance
	const instanceId = useRef(
		`timeline-${Math.random().toString(36).slice(2)}`
	).current;

	useEffect(() => {
		mountedRef.current.add(instanceId);
		return () => {
			mountedRef.current.delete(instanceId);
		};
	}, [instanceId]);

	// Local state for user-controlled measure count
	const {
		audioPath,
		currentSong,
		saveSong,
		isLoading: isSaving,
		totalMeasures,
		setTotalMeasures,
	} = useSongStore();

	// Use shared timeline context
	const {
		currentTime,
		setCurrentTime: setSharedCurrentTime,
		isPlaying,
		setIsPlaying: setSharedIsPlaying,
		duration,
		setDuration: setSharedDuration,
		setTimelineData: setSharedTimelineData,
	} = useTimelineContext();

	const tempoChanges = useTempoChanges(); // <-- Get tempo changes from currentSong
	const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Audio playback state - keep local state but sync with context
	const [autoScroll, setAutoScroll] = useState(true);
	const [audioReady, setAudioReady] = useState(false);
	const playerRef = useRef<Tone.Player | null>(null);
	const animationFrameRef = useRef<number | null>(null);
	const timelineScrollRef = useRef<HTMLDivElement | null>(null);
	const audioElementRef = useRef<HTMLAudioElement | null>(null);

	// Calculate pixelsPerBeat based on the current mode to control cursor speed
	const pixelsPerBeat = useMemo(() => {
		switch (mode) {
			case 'events':
				return CELL_WIDTH; // A cell is a 4-beat measure
			case 'cameras':
				return CELL_WIDTH; // A cell is one beat
			case 'drums':
				return DRUM_CELL_WIDTH * 2; // A beat contains two drum steps
			case 'choreography':
			default:
				return CELL_WIDTH / 4; // Default for choreography or other modes
		}
	}, [mode]);

	// Helper functions to sync local state with context
	const setCurrentTime = useCallback(
		(time: number) => {
			setSharedCurrentTime(time);
		},
		[setSharedCurrentTime]
	);

	const setIsPlaying = useCallback(
		(playing: boolean) => {
			setSharedIsPlaying(playing);
		},
		[setSharedIsPlaying]
	);

	const setDuration = useCallback(
		(dur: number) => {
			setSharedDuration(dur);
		},
		[setSharedDuration]
	);

	// Update timeline data in context whenever local timeline data changes
	useEffect(() => {
		setSharedTimelineData(timelineData);
	}, [timelineData, setSharedTimelineData]);

	const loadAudioFile = useCallback(async () => {
		if (!audioPath) {
			console.log('No audio path provided');
			return;
		}

		console.log('Loading audio from:', audioPath);

		let audioUrl: string | null = null;
		// Store a local copy of the instance ID to check during async operations
		const currentInstanceId = instanceId;
		let isMounted = true;
		// For cleanup: store previous audioUrl
		let prevAudioUrl = audioElementRef.current?.src || null;

		try {
			// Dispose of existing player
			if (playerRef.current) {
				playerRef.current.dispose();
				playerRef.current = null;
			}
			if (audioElementRef.current) {
				audioElementRef.current.pause();
				audioElementRef.current = null;
			}

			setAudioReady(false);

			// Read audio file and create blob URL
			console.log('Reading audio buffer...');
			const audioBuffer = await window.electronAPI.readFileBuffer(
				audioPath
			);
			const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
			audioUrl = URL.createObjectURL(blob);

			console.log('Created blob URL:', audioUrl);

			// Create HTML5 Audio element for better time tracking
			const audioElement = new Audio(audioUrl);
			audioElementRef.current = audioElement;

			// Wait for audio to load
			console.log('Waiting for audio to load...');
			await new Promise((resolve, reject) => {
				audioElement.onloadedmetadata = () => {
					console.log(
						'Audio metadata loaded, duration:',
						audioElement.duration
					);
					resolve(void 0);
				};
				audioElement.onerror = () =>
					reject(new Error('Failed to load audio'));
				audioElement.load();
			});

			// Also create Tone.js player for effects processing if needed
			const player = new Tone.Player();
			await player.load(audioUrl);

			playerRef.current = player;
			player.toDestination();

			// Set up event listeners
			audioElement.onended = () => {
				setIsPlaying(false);
				if (animationFrameRef.current) {
					cancelAnimationFrame(animationFrameRef.current);
				}
			};

			if (isMounted) {
				setDuration(audioElement.duration);
				setAudioReady(true);
			}
			console.log(
				'Audio loaded successfully, duration:',
				audioElement.duration
			);

			// Cleanup previous blob URL if any
			if (prevAudioUrl && prevAudioUrl.startsWith('blob:')) {
				URL.revokeObjectURL(prevAudioUrl);
			}
		} catch (err) {
			console.error('Audio loading error:', err);
			if (isMounted) setError(`Failed to load audio: ${err}`);
			// Cleanup new blob URL if error
			if (audioUrl) URL.revokeObjectURL(audioUrl);
		}

		// Cleanup function for Strict Mode double-invoke
		return () => {
			isMounted = false;
			if (audioElementRef.current) {
				audioElementRef.current.pause();
				audioElementRef.current = null;
			}
			if (playerRef.current) {
				playerRef.current.dispose();
				playerRef.current = null;
			}
			if (audioUrl) {
				URL.revokeObjectURL(audioUrl);
			}
		};
	}, [audioPath, instanceId]);

	const calculateCursorPosition = useCallback(
		(time?: number): number => {
			if (!timelineData || !timelineData.beatMap)
				return TRACK_HEADER_WIDTH;

			const targetTime = time !== undefined ? time : currentTime;
			const { beatMap } = timelineData;

			// Find the beat index corresponding to the target time
			let beat = 0;
			for (let i = 0; i < beatMap.length; i++) {
				if (beatMap[i] > targetTime) {
					// We are between beat i-1 and i
					const prevBeatTime = beatMap[i - 1];
					const nextBeatTime = beatMap[i];
					const segmentDuration = nextBeatTime - prevBeatTime;
					const progress =
						(targetTime - prevBeatTime) / segmentDuration;
					beat = i - 1 + progress;
					break;
				}
				if (i === beatMap.length - 1) {
					// Time is beyond the last calculated beat
					beat = i;
				}
			}

			return TRACK_HEADER_WIDTH + beat * pixelsPerBeat;
		},
		[timelineData, currentTime, pixelsPerBeat]
	);

	const updatePlaybackPosition = useCallback(() => {
		if (!isPlaying || !audioElementRef.current) {
			return;
		}

		const currentTime = audioElementRef.current.currentTime;
		setCurrentTime(currentTime);

		// Auto-scroll timeline
		if (autoScroll && timelineScrollRef.current && timelineData) {
			const cursorPosition = calculateCursorPosition(currentTime);
			const container = timelineScrollRef.current;
			const containerWidth = container.clientWidth;

			// Calculate ideal scroll position (keep cursor in center of visible area)
			const idealScrollLeft = cursorPosition - containerWidth / 2;

			// Get total timeline width including track labels
			const totalTimelineWidth =
				TRACK_HEADER_WIDTH +
				timelineData.measures.reduce(
					(total, measure) =>
						total + measure.beatCount * pixelsPerBeat,
					0
				);

			// Constrain to valid scroll range
			const maxScrollLeft = Math.max(
				0,
				totalTimelineWidth - containerWidth
			);
			const newScrollLeft = Math.max(
				0,
				Math.min(idealScrollLeft, maxScrollLeft)
			);

			container.scrollLeft = newScrollLeft;
		}

		if (isPlaying) {
			animationFrameRef.current = requestAnimationFrame(
				updatePlaybackPosition
			);
		}
	}, [isPlaying, timelineData, autoScroll, calculateCursorPosition]);

	const startPlaybackLoop = useCallback(() => {
		// Check if we're the current mounted instance
		if (
			!audioElementRef.current ||
			(mountedRef.current.size > 1 &&
				Array.from(mountedRef.current).pop() !== instanceId)
		) {
			return;
		}

		// Store local refs to prevent issues with closure and re-renders
		const localAudioRef = audioElementRef;
		const localTimelineScrollRef = timelineScrollRef;
		// Current instance ID for checking in async operations
		const currentInstanceId = instanceId;

		const updateLoop = () => {
			// Only continue if we're still the active instance
			if (
				!localAudioRef.current ||
				localAudioRef.current.paused ||
				(mountedRef.current.size > 1 &&
					Array.from(mountedRef.current).pop() !== currentInstanceId)
			) {
				return;
			}

			const currentTime = localAudioRef.current.currentTime;
			setCurrentTime(currentTime);

			// Auto-scroll timeline
			if (autoScroll && localTimelineScrollRef.current && timelineData) {
				const cursorPosition = calculateCursorPosition(currentTime);
				const container = localTimelineScrollRef.current;
				const containerWidth = container.clientWidth;
				const idealScrollLeft = cursorPosition - containerWidth / 2;
				const totalTimelineWidth =
					TRACK_HEADER_WIDTH +
					timelineData.measures.reduce(
						(total, measure) =>
							total + measure.beatCount * pixelsPerBeat,
						0
					);
				const maxScrollLeft = Math.max(
					0,
					totalTimelineWidth - containerWidth
				);
				const newScrollLeft = Math.max(
					0,
					Math.min(idealScrollLeft, maxScrollLeft)
				);

				container.scrollLeft = newScrollLeft;
			}

			// Continue the loop
			animationFrameRef.current = requestAnimationFrame(updateLoop);
		};

		// Start the loop
		animationFrameRef.current = requestAnimationFrame(updateLoop);
	}, [timelineData, autoScroll, calculateCursorPosition, instanceId]);

	const handlePlay = useCallback(async () => {
		// Check if we're the active instance in StrictMode
		if (
			mountedRef.current.size > 1 &&
			Array.from(mountedRef.current).pop() !== instanceId
		) {
			return;
		}

		if (!audioElementRef.current) {
			console.error('No audio element available');
			return;
		}

		if (!audioReady) {
			console.error('Audio not ready yet');
			return;
		}

		try {
			// Store a local reference to prevent closure issues
			const audio = audioElementRef.current;
			// Store our instance ID to verify during async operations
			const currentInstanceId = instanceId;

			// Ensure audio is loaded and ready
			if (audio.readyState < 2) {
				await new Promise((resolve, reject) => {
					const onCanPlay = () => {
						audio.removeEventListener('canplay', onCanPlay);
						// Check if we're still the active component
						if (
							mountedRef.current.size <= 1 ||
							Array.from(mountedRef.current).pop() ===
								currentInstanceId
						) {
							resolve(void 0);
						} else {
							reject(
								new Error('Component instance no longer active')
							);
						}
					};
					audio.addEventListener('canplay', onCanPlay);
				});
			}

			// Check again if we're still the active component after async operation
			if (
				mountedRef.current.size > 1 &&
				Array.from(mountedRef.current).pop() !== currentInstanceId
			) {
				return;
			}

			// Set the current time and play
			audio.currentTime = currentTime;

			// Try to play with better error handling
			const playPromise = audio.play();
			if (playPromise !== undefined) {
				await playPromise;
			}

			// One final check before completing the operation
			if (
				mountedRef.current.size <= 1 ||
				Array.from(mountedRef.current).pop() === currentInstanceId
			) {
				setIsPlaying(true);
				startPlaybackLoop();
			}
		} catch (err) {
			console.error('Playback error:', err);
		}
	}, [currentTime, audioReady, startPlaybackLoop, instanceId]);

	const handlePause = useCallback(() => {
		if (audioElementRef.current) {
			audioElementRef.current.pause();
			setIsPlaying(false);
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		}
	}, []);

	const handleStop = useCallback(() => {
		if (audioElementRef.current) {
			audioElementRef.current.pause();
			audioElementRef.current.currentTime = 0;
			setIsPlaying(false);
			setCurrentTime(0);
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		}
	}, []);

	const scrollToTime = useCallback(
		(time: number) => {
			if (timelineScrollRef.current && timelineData) {
				const cursorPosition = calculateCursorPosition(time);
				const scrollContainer = timelineScrollRef.current;
				const containerWidth = scrollContainer.clientWidth;

				// Center the cursor in the viewport
				const targetScrollLeft = cursorPosition - containerWidth / 2;
				scrollContainer.scrollLeft = Math.max(0, targetScrollLeft);
			}
		},
		[timelineData, calculateCursorPosition]
	);

	const handleSeek = useCallback(
		(time: number) => {
			if (audioElementRef.current) {
				const wasPlaying = isPlaying;

				// Pause if playing
				if (wasPlaying) {
					audioElementRef.current.pause();
					setIsPlaying(false);
					if (animationFrameRef.current) {
						cancelAnimationFrame(animationFrameRef.current);
					}
				}

				// Update current time and audio position
				setCurrentTime(time);
				audioElementRef.current.currentTime = time;

				// Scroll timeline to the new position
				scrollToTime(time);

				// Resume playback from new position if was playing
				if (wasPlaying) {
					setTimeout(async () => {
						try {
							await audioElementRef.current!.play();
							setIsPlaying(true);
							startPlaybackLoop();
						} catch (err) {
							console.error('Seek playback error:', err);
						}
					}, 10); // Small delay to ensure pause completes
				}
			}
		},
		[isPlaying, startPlaybackLoop, scrollToTime]
	);

	const getCurrentMeasure = useCallback(() => {
		if (!timelineData) return null;
		return timelineData.measures.find(
			(measure) =>
				currentTime >= measure.startTime &&
				currentTime < measure.startTime + measure.duration
		);
	}, [timelineData, currentTime]);

	// Convert time to beat using tempo changes
	const timeToBeat = useCallback(
		(time: number): number => {
			if (!timelineData) return 0;

			let totalBeats = 0;
			let lastTime = 0;

			for (const tempoChange of timelineData.tempoChanges) {
				if (time <= tempoChange.measure) {
					// Time is before this tempo change
					const duration = time - lastTime;
					const beatsPerSecond = tempoChange.bpm / 60;
					totalBeats += duration * beatsPerSecond;
					break;
				} else {
					// Add beats from this tempo section
					const duration = tempoChange.measure - lastTime;
					const beatsPerSecond = tempoChange.bpm / 60;
					totalBeats += duration * beatsPerSecond;
					lastTime = tempoChange.measure;
				}
			}

			// Handle time after last tempo change
			if (time > lastTime && timelineData.tempoChanges.length > 0) {
				const lastTempo =
					timelineData.tempoChanges[
						timelineData.tempoChanges.length - 1
					];
				const duration = time - lastTime;
				const beatsPerSecond = lastTempo.bpm / 60;
				totalBeats += duration * beatsPerSecond;
			}

			return Math.max(0, totalBeats);
		},
		[timelineData]
	);

	// Calculate timeline data from tempoChanges
	const calculateTimelineData = useCallback((): TimelineData | null => {
		if (!currentSong) return null;

		const sortedTempoChanges = [...tempoChanges].sort(
			(a, b) => a.measure - b.measure
		);

		const tempoList: TempoChange[] =
			sortedTempoChanges.length > 0 && sortedTempoChanges[0].measure === 0
				? sortedTempoChanges
				: [{ measure: 0, bpm: 120 }, ...sortedTempoChanges];

		const timeSignatures: TimeSignature[] = [
			{ numerator: 4, denominator: 4, ticks: 0 },
		];
		const beatsPerMeasure = timeSignatures[0].numerator;

		const events = currentSong?.events || [];
		const maxMeasures = totalMeasures;
		const totalBeats = maxMeasures * beatsPerMeasure;

		// --- Robust Timeline Calculation ---

		// 1. Create a precise map of every beat's start time
		const beatMap: number[] = [0]; // beatMap[beatIndex] = time in seconds
		let currentTime = 0;
		let tempoIndex = 0;

		for (let beat = 0; beat < totalBeats; beat++) {
			// Find the correct BPM for the current time
			while (
				tempoIndex + 1 < tempoList.length &&
				currentTime >= tempoList[tempoIndex + 1].measure
			) {
				tempoIndex++;
			}
			const bpm = tempoList[tempoIndex].bpm;
			const beatDuration = 60 / bpm;
			currentTime += beatDuration;
			beatMap.push(currentTime);
		}

		// 2. Generate measures from the beat map
		const measures: Measure[] = [];
		for (let i = 0; i < maxMeasures; i++) {
			const startBeat = i * beatsPerMeasure;
			const endBeat = startBeat + beatsPerMeasure;

			if (
				beatMap[startBeat] === undefined ||
				beatMap[endBeat] === undefined
			) {
				console.warn(
					`Could not generate measure ${
						i + 1
					} due to missing beat map data.`
				);
				continue;
			}

			const startTime = beatMap[startBeat];
			const endTime = beatMap[endBeat];
			const duration = endTime - startTime;

			// Find BPM at the start of the measure
			let measureBpm = tempoList[0].bpm;
			for (const tempo of tempoList) {
				if (tempo.measure <= startTime) {
					measureBpm = tempo.bpm;
				} else {
					break;
				}
			}

			measures.push({
				number: i + 1,
				startTime,
				duration,
				startBeat,
				beatCount: beatsPerMeasure,
				bpm: measureBpm,
			});
		}

		const totalDuration = beatMap[beatMap.length - 1] || 0;

		return {
			measures,
			totalDuration,
			totalBeats,
			tempoChanges: tempoList,
			timeSignatures,
			beatMap,
		};
	}, [tempoChanges, currentSong, totalMeasures]);

	// Recalculate timeline data when tempoChanges change
	useEffect(() => {
		setTimelineData(calculateTimelineData());
	}, [calculateTimelineData]);

	// Audio loading effect - StrictMode optimized
	useEffect(() => {
		// Track if this effect instance is still mounted
		let isMounted = true;
		let cleanup: (() => void) | undefined;

		// We use an IIFE with explicit cleanup handling
		(async () => {
			// Only proceed if this is the latest mounted instance
			if (
				mountedRef.current.size <= 1 ||
				Array.from(mountedRef.current).pop() === instanceId
			) {
				const maybeCleanup = await loadAudioFile();
				// Only set cleanup if still mounted
				if (isMounted && typeof maybeCleanup === 'function') {
					cleanup = maybeCleanup;
				}
			}
		})();

		return () => {
			isMounted = false;
			if (cleanup) cleanup();
		};
	}, [loadAudioFile, instanceId]);

	// Cleanup on unmount - StrictMode optimized
	useEffect(() => {
		// Store the instance-specific refs to ensure proper cleanup
		const playerRefForCleanup = playerRef;
		const animationFrameRefForCleanup = animationFrameRef;
		const audioElementRefForCleanup = audioElementRef;

		return () => {
			// Only clean up if we still have the refs
			if (playerRefForCleanup.current) {
				playerRefForCleanup.current.dispose();
				playerRefForCleanup.current = null;
			}

			if (animationFrameRefForCleanup.current) {
				cancelAnimationFrame(animationFrameRefForCleanup.current);
				animationFrameRefForCleanup.current = null;
			}

			if (audioElementRefForCleanup.current) {
				audioElementRefForCleanup.current.pause();
				if (
					audioElementRefForCleanup.current.src &&
					audioElementRefForCleanup.current.src.startsWith('blob:')
				) {
					URL.revokeObjectURL(audioElementRefForCleanup.current.src);
				}
				audioElementRefForCleanup.current = null;
			}
		};
	}, []);

	// Add keyboard shortcut for saving
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.key === 's') {
				e.preventDefault();
				if (currentSong && !isSaving) {
					saveSong();
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [currentSong, isSaving, saveSong]);

	// --- Undo/Redo Types ---
	type TimelineAction =
		| {
				type: 'move:add';
				data: {
					track: 'supereasy' | 'easy' | 'medium' | 'expert';
					event: any;
				};
		  }
		| {
				type: 'move:remove';
				data: {
					track: 'supereasy' | 'easy' | 'medium' | 'expert';
					event: any;
				};
		  }
		| {
				type: 'move:bulkadd';
				data: {
					track: 'supereasy' | 'easy' | 'medium' | 'expert';
					events: any[];
				};
		  }
		| {
				type: 'move:bulkremove';
				data: {
					track: 'supereasy' | 'easy' | 'medium' | 'expert';
					events: any[];
				};
		  }
		| {
				type: 'camera:add';
				data: {
					track: 'easy' | 'medium' | 'expert';
					event: any;
				};
		  }
		| {
				type: 'camera:remove';
				data: {
					track: 'easy' | 'medium' | 'expert';
					event: any;
				};
		  }
		| {
				type: 'camera:bulkadd';
				data: {
					track: 'easy' | 'medium' | 'expert';
					events: any[];
				};
		  }
		| {
				type: 'camera:bulkremove';
				data: {
					track: 'easy' | 'medium' | 'expert';
					events: any[];
				};
		  }
		| { type: 'drums:trackadd'; data: { track: string; event: any } }
		| { type: 'drums:trackremove'; data: { track: string; event: any } }
		| { type: 'drums:drumadd'; data: { track: string; event: any } }
		| { type: 'drums:drumremove'; data: { track: string; event: any } }
		| {
				type: 'events:add';
				data: {
					track: 'song' | 'battle' | 'party' | 'partybattle';
					event: any;
				};
		  }
		| {
				type: 'events:remove';
				data: {
					track: 'song' | 'battle' | 'party' | 'partybattle';
					event: any;
				};
		  };

	// --- Undo/Redo State ---
	const [undoStack, setUndoStack] = useState<TimelineAction[]>([]);
	const [redoStack, setRedoStack] = useState<TimelineAction[]>([]);

	// --- Undo/Redo Handlers ---
	const addUndoAction = (action: TimelineAction) => {
		setUndoStack((stack) => [...stack, action]);
		setRedoStack([]); // Clear redo on new action
	};

	const undo = useCallback(() => {
		if (undoStack.length === 0) return;
		const last = undoStack[undoStack.length - 1];
		setUndoStack((stack) => stack.slice(0, -1));
		setRedoStack((stack) => [...stack, last]);

		switch (last.type) {
			case 'move:add': {
				// Find the event index by measure
				let idx;
				if (last.data.track === 'supereasy') {
					idx = useSongStore
						.getState()
						.currentSong?.supereasy.findIndex(
							(ev: any) => ev.measure === last.data.event.measure
						);
				} else {
					idx = useSongStore
						.getState()
						.currentSong?.timeline?.[
							last.data.track
						]?.moves.findIndex(
							(ev: any) => ev.measure === last.data.event.measure
						);
				}

				if (idx) {
					useSongStore
						.getState()
						.removeMoveEvent(last.data.track, idx);
				}

				break;
			}
			case 'move:remove': {
				useSongStore
					.getState()
					.addMoveEvent(last.data.track, last.data.event);
				break;
			}
			case 'move:bulkadd': {
				let moves;
				if (last.data.track === 'supereasy') {
					moves =
						useSongStore.getState().currentSong?.supereasy || [];
				} else {
					moves =
						useSongStore.getState().currentSong?.timeline?.[
							last.data.track
						].moves || [];
				}

				last.data.events.forEach((ev: any) => {
					const idx = moves.findIndex(
						(move: any) => move.measure === ev.measure
					);
					if (idx !== -1) {
						useSongStore
							.getState()
							.removeMoveEvent(last.data.track, idx);
					}
				});
				break;
			}
			case 'move:bulkremove': {
				last.data.events.forEach((ev: any) => {
					useSongStore.getState().addMoveEvent(last.data.track, ev);
				});
				break;
			}
			case 'camera:add':
				const idx = useSongStore
					.getState()
					.currentSong?.timeline?.[
						last.data.track
					]?.cameras.findIndex(
						(ev: any) => ev.beat === last.data.event.beat
					);

				useSongStore.getState().removeCameraEvent(last.data.track, idx);
				break;
			case 'camera:remove':
				useSongStore
					.getState()
					.addCameraEvent(last.data.track, last.data.event);
				break;
			case 'camera:bulkadd':
				last.data.events.forEach((ev) => {
					const idx = useSongStore
						.getState()
						.currentSong?.timeline?.[
							last.data.track
						]?.cameras.findIndex(
							(cam: any) => cam.beat === ev.beat
						);

					useSongStore
						.getState()
						.removeCameraEvent(last.data.track, idx);
				});
				break;
			case 'camera:bulkremove':
				last.data.events.forEach((ev) =>
					useSongStore.getState().addCameraEvent(last.data.track, ev)
				);
				break;
			case 'drums:trackadd': {
				const currDrums = useSongStore.getState().currentSong?.drums;
				if (!currDrums) return;

				const newDrumsEvents = currDrums.filter(
					(_, i) => i !== last.data.event.index
				);
				console.log('Removing drum event:', last.data.event);

				useSongStore.getState().updateDrums(newDrumsEvents);

				break;
			}
			case 'drums:trackremove': {
				const currDrums = useSongStore.getState().currentSong?.drums;
				if (!currDrums) return;

				const newDrumsEvents = [...currDrums, last.data.event];
				useSongStore.getState().updateDrums(newDrumsEvents);
				break;
			}
			case 'drums:drumadd': {
				const currDrums = useSongStore.getState().currentSong?.drums;
				if (!currDrums) return;

				const newDrumsEvents = currDrums.map((drum) => {
					if (drum.sound === last.data.track) {
						return {
							...drum,
							events: drum.events.filter(
								(ev) => ev !== last.data.event.beatIndex
							),
						};
					}
					return drum;
				});

				useSongStore.getState().updateDrums(newDrumsEvents);
				break;
			}
			case 'drums:drumremove': {
				const currDrums = useSongStore.getState().currentSong?.drums;
				if (!currDrums) return;

				const newDrumsEvents = currDrums.map((drum) => {
					if (drum.sound === last.data.track) {
						return {
							...drum,
							events: [...drum.events, last.data.event.beatIndex],
						};
					}
					return drum;
				});

				useSongStore.getState().updateDrums(newDrumsEvents);
				break;
			}
			case 'events:add': {
				switch (last.data.track) {
					case 'song':
						const songIdx = useSongStore
							.getState()
							.currentSong?.events.findIndex(
								(ev) =>
									ev.beat === last.data.event.beat &&
									ev.type === last.data.event.type
							);
						useSongStore.getState().removeEvent(songIdx);
					case 'battle':
						const battleIdx = useSongStore
							.getState()
							.currentSong?.battleSteps.findIndex(
								(step) =>
									step.measure === last.data.event.measure
							);
						useSongStore.getState().removeBattleStep(battleIdx);
						break;
					case 'partybattle':
						const partyBattleIdx = useSongStore
							.getState()
							.currentSong?.partyBattleSteps.findIndex(
								(step) =>
									step.measure === last.data.event.measure
							);
						useSongStore
							.getState()
							.removepartyBattleSteps(partyBattleIdx);
						break;
					case 'party':
						const partyIdx = useSongStore
							.getState()
							.currentSong?.partyJumps.findIndex(
								(ev) => ev.measure === last.data.event.measure
							);
						useSongStore.getState().removePartyJump(partyIdx);
				}
			}
		}
	}, [undoStack]);

	const redo = useCallback(() => {
		if (redoStack.length === 0) return;
		const last = redoStack[redoStack.length - 1];
		setRedoStack((stack) => stack.slice(0, -1));
		setUndoStack((stack) => [...stack, last]);

		switch (last.type) {
			case 'move:add': {
				// Redo add: add the move event back
				useSongStore
					.getState()
					.addMoveEvent(last.data.track, last.data.event);
				break;
			}
			case 'move:remove': {
				// Redo remove: remove the move event by measure
				let idx;
				if (last.data.track === 'supereasy') {
					idx = useSongStore
						.getState()
						.currentSong?.supereasy.findIndex(
							(ev: any) => ev.measure === last.data.event.measure
						);
				} else {
					idx = useSongStore
						.getState()
						.currentSong?.timeline?.[
							last.data.track
						]?.moves.findIndex(
							(ev: any) => ev.measure === last.data.event.measure
						);
				}
				if (idx !== undefined && idx !== -1) {
					useSongStore
						.getState()
						.removeMoveEvent(last.data.track, idx);
				}
				break;
			}
			case 'move:bulkadd': {
				// Redo bulk add: add all move events back
				last.data.events.forEach((ev: any) => {
					useSongStore.getState().addMoveEvent(last.data.track, ev);
				});
				break;
			}
			case 'move:bulkremove': {
				// Redo bulk remove: remove all move events by measure
				let moves;
				if (last.data.track === 'supereasy') {
					moves =
						useSongStore.getState().currentSong?.supereasy || [];
				} else {
					moves =
						useSongStore.getState().currentSong?.timeline?.[
							last.data.track
						].moves || [];
				}
				last.data.events.forEach((ev: any) => {
					const idx = moves.findIndex(
						(move: any) => move.measure === ev.measure
					);
					if (idx !== -1) {
						useSongStore
							.getState()
							.removeMoveEvent(last.data.track, idx);
					}
				});
				break;
			}
			case 'camera:add': {
				// Redo add: add the camera event back
				useSongStore
					.getState()
					.addCameraEvent(last.data.track, last.data.event);
				break;
			}
			case 'camera:remove': {
				// Redo remove: remove the camera event by beat
				const idx = useSongStore
					.getState()
					.currentSong?.timeline?.[
						last.data.track
					]?.cameras.findIndex(
						(ev: any) => ev.beat === last.data.event.beat
					);
				if (idx !== undefined && idx !== -1) {
					useSongStore
						.getState()
						.removeCameraEvent(last.data.track, idx);
				}
				break;
			}
			case 'camera:bulkadd': {
				// Redo bulk add: add all camera events back
				last.data.events.forEach((ev: any) => {
					useSongStore.getState().addCameraEvent(last.data.track, ev);
				});
				break;
			}
			case 'camera:bulkremove': {
				// Redo bulk remove: remove all camera events by beat
				const cameras =
					useSongStore.getState().currentSong?.timeline?.[
						last.data.track
					]?.cameras || [];
				last.data.events.forEach((ev: any) => {
					const idx = cameras.findIndex(
						(cam: any) => cam.beat === ev.beat
					);
					if (idx !== -1) {
						useSongStore
							.getState()
							.removeCameraEvent(last.data.track, idx);
					}
				});
				break;
			}
			case 'drums:trackadd': {
				const currDrums = useSongStore.getState().currentSong?.drums;
				if (!currDrums) return;
				const newDrumsEvents = [...currDrums, last.data.event];
				useSongStore.getState().updateDrums(newDrumsEvents);
				break;
			}
			case 'drums:trackremove': {
				const currDrums = useSongStore.getState().currentSong?.drums;
				if (!currDrums) return;
				const newDrumsEvents = currDrums.filter(
					(_, i) => i !== last.data.event.index
				);
				useSongStore.getState().updateDrums(newDrumsEvents);
				break;
			}
			case 'drums:drumadd': {
				const currDrums = useSongStore.getState().currentSong?.drums;
				if (!currDrums) return;
				const newDrumsEvents = currDrums.map((drum) => {
					if (drum.sound === last.data.track) {
						return {
							...drum,
							events: [...drum.events, last.data.event.beatIndex],
						};
					}
					return drum;
				});
				useSongStore.getState().updateDrums(newDrumsEvents);
				break;
			}
			case 'drums:drumremove': {
				const currDrums = useSongStore.getState().currentSong?.drums;
				if (!currDrums) return;
				const newDrumsEvents = currDrums.map((drum) => {
					if (drum.sound === last.data.track) {
						return {
							...drum,
							events: drum.events.filter(
								(ev) => ev !== last.data.event.beatIndex
							),
						};
					}
					return drum;
				});
				useSongStore.getState().updateDrums(newDrumsEvents);
				break;
			}
			case 'events:add': {
				switch (last.data.track) {
					case 'song':
						useSongStore.getState().addEvent(last.data.event);
						break;
					case 'battle':
						useSongStore.getState().addBattleStep(last.data.event);
						break;
					case 'partybattle':
						useSongStore
							.getState()
							.addpartyBattleSteps(last.data.event);
						break;
					case 'party':
						useSongStore.getState().addPartyJump(last.data.event);
						break;
				}
				break;
			}
			case 'events:remove': {
				switch (last.data.track) {
					case 'song': {
						const songIdx = useSongStore
							.getState()
							.currentSong?.events.findIndex(
								(ev) =>
									ev.beat === last.data.event.beat &&
									ev.type === last.data.event.type
							);
						useSongStore.getState().removeEvent(songIdx);
						break;
					}
					case 'battle': {
						const battleIdx = useSongStore
							.getState()
							.currentSong?.battleSteps.findIndex(
								(step) =>
									step.measure === last.data.event.measure
							);
						useSongStore.getState().removeBattleStep(battleIdx);
						break;
					}
					case 'partybattle': {
						const partyBattleIdx = useSongStore
							.getState()
							.currentSong?.partyBattleSteps.findIndex(
								(step) =>
									step.measure === last.data.event.measure
							);
						useSongStore
							.getState()
							.removepartyBattleSteps(partyBattleIdx);
						break;
					}
					case 'party': {
						const partyIdx = useSongStore
							.getState()
							.currentSong?.partyJumps.findIndex(
								(ev) => ev.measure === last.data.event.measure
							);
						useSongStore.getState().removePartyJump(partyIdx);
						break;
					}
				}
				break;
			}
		}
	}, [redoStack]);

	// Memoize stable callback functions to prevent recreation on each render
	const calculateCursorPositionMemo = useCallback(calculateCursorPosition, [
		calculateCursorPosition,
	]);
	const handleSeekMemo = useCallback(handleSeek, [handleSeek]);
	const timeToBeatMemo = useCallback(timeToBeat, [timeToBeat]);

	// Memoize the timeline props to prevent recreation on each render
	// The important part is to ensure that our props object is stable across renders
	// This is critical for preventing unnecessary child re-renders in StrictMode
	const timelineProps = useMemo(
		() => ({
			timelineData,
			currentTime,
			isPlaying,
			autoScroll,
			calculateCursorPosition: calculateCursorPositionMemo,
			handleSeek: handleSeekMemo,
			timeToBeat: timeToBeatMemo,
			timelineScrollRef,
			_instanceId: instanceId,
			addUndoAction, // Pass to all timelines
		}),
		[
			timelineData,
			currentTime,
			isPlaying,
			autoScroll,
			calculateCursorPositionMemo,
			handleSeekMemo,
			timeToBeatMemo,
			timelineScrollRef,
			instanceId,
			addUndoAction,
		]
	);

	return (
		<div className="h-full flex flex-col overflow-hidden max-w-full">
			{loading ? (
				<div className="h-full flex items-center justify-center">
					<div className="text-center">
						<div className="text-sm text-muted-foreground">
							Loading MIDI data...
						</div>
					</div>
				</div>
			) : error || !timelineData ? (
				<div className="h-full flex items-center justify-center">
					<div className="text-center text-destructive">
						<div className="text-sm font-medium">
							Error loading MIDI
						</div>
						<div className="text-xs mt-1">{error}</div>
					</div>
				</div>
			) : (
				<>
					{/* Timeline Header */}
					<div className="flex-shrink-0 p-4 border-b bg-background">
						<div className="flex items-center justify-between mb-4">
							<div>
								<h2 className="text-lg font-semibold">
									Timeline Editor
								</h2>
								<div className="text-sm text-muted-foreground flex items-center gap-2">
									{mode === 'events' && (
										<div className="flex items-center gap-2">
											<button
												className="px-2 py-1 rounded bg-muted border hover:bg-muted/70"
												onClick={() =>
													setTotalMeasures(
														Math.max(
															1,
															timelineData
																.measures
																.length - 1
														)
													)
												}
												title="Decrease measures"
											>
												-
											</button>
											<span>
												{timelineData.measures.length}{' '}
												measures
											</span>
											<button
												className="px-2 py-1 rounded bg-muted border hover:bg-muted/70"
												onClick={() =>
													setTotalMeasures(
														timelineData.measures
															.length + 1
													)
												}
												title="Increase measures"
											>
												+
											</button>
										</div>
									)}
									<span className="ml-2">
										{timelineData.totalDuration.toFixed(2)}s
										duration
									</span>
								</div>
							</div>

							{/* Playback Controls & Global Undo/Redo */}
							<div className="flex items-center gap-2">
								{/* Undo/Redo Buttons */}
								<button
									onClick={undo}
									className="p-2 rounded hover:bg-muted transition-colors"
									title="Undo"
									disabled={undoStack.length === 0}
								>
									<Undo2 className="w-4 h-4" />
								</button>
								<button
									onClick={redo}
									className="p-2 rounded hover:bg-muted transition-colors"
									title="Redo"
									disabled={redoStack.length === 0}
								>
									<Redo2 className="w-4 h-4" />
								</button>

								<div className="w-px h-6 bg-border mx-2" />

								<button
									onClick={() => handleSeek(0)}
									className="p-2 rounded hover:bg-muted transition-colors"
									title="Skip to beginning"
								>
									<SkipBack className="w-4 h-4" />
								</button>

								{isPlaying ? (
									<button
										onClick={handlePause}
										className="p-2 rounded hover:bg-muted transition-colors"
										title="Pause"
									>
										<Pause className="w-4 h-4" />
									</button>
								) : (
									<button
										onClick={handlePlay}
										className="p-2 rounded hover:bg-muted transition-colors"
										title="Play"
										disabled={!audioReady}
									>
										<Play className="w-4 h-4" />
									</button>
								)}

								<button
									onClick={handleStop}
									className="p-2 rounded hover:bg-muted transition-colors"
									title="Stop"
								>
									<Square className="w-4 h-4" />
								</button>

								<div className="w-px h-6 bg-border mx-2" />

								<button
									onClick={() => setAutoScroll(!autoScroll)}
									className={`p-2 rounded transition-colors ${
										autoScroll
											? 'bg-primary text-primary-foreground hover:bg-primary/90'
											: 'hover:bg-muted'
									}`}
									title={
										autoScroll
											? 'Disable auto-scroll'
											: 'Enable auto-scroll'
									}
								>
									{autoScroll ? (
										<Lock className="w-4 h-4" />
									) : (
										<Unlock className="w-4 h-4" />
									)}
								</button>

								<div className="w-px h-6 bg-border mx-2" />

								<div className="ml-4 flex items-center gap-2 text-sm">
									<span className="font-mono">
										{Math.floor(currentTime / 60)}:
										{Math.floor(currentTime % 60)
											.toString()
											.padStart(2, '0')}
									</span>
									<span className="text-muted-foreground">
										/
									</span>
									<span className="text-muted-foreground font-mono">
										{Math.floor(duration / 60)}:
										{Math.floor(duration % 60)
											.toString()
											.padStart(2, '0')}
									</span>
								</div>

								{getCurrentMeasure() && (
									<div className="ml-4 text-sm text-muted-foreground">
										Measure {getCurrentMeasure()?.number}
									</div>
								)}
							</div>
						</div>

						{/* Progress Bar */}
						<div
							className="w-full bg-muted rounded-full h-2 cursor-pointer"
							onClick={(e) => {
								const rect =
									e.currentTarget.getBoundingClientRect();
								const x = e.clientX - rect.left;
								const percentage = x / rect.width;
								const seekTime = percentage * duration;
								handleSeek(seekTime);
							}}
						>
							<div
								className="bg-primary h-2 rounded-full transition-all duration-100"
								style={{
									width:
										duration > 0
											? `${
													(currentTime / duration) *
													100
											  }%`
											: '0%',
								}}
							/>
						</div>
					</div>

					{/* Timeline Content */}
					{mode === 'choreography' && (
						<ChoreographyTimeline
							{...timelineProps}
							trackHeaderWidth={TRACK_HEADER_WIDTH}
							pixelsPerBeat={pixelsPerBeat}
						/>
					)}
					{mode === 'cameras' && (
						<CameraShotsTimeline
							{...timelineProps}
							trackHeaderWidth={TRACK_HEADER_WIDTH}
							pixelsPerBeat={pixelsPerBeat}
						/>
					)}
					{mode === 'events' && (
						<EventsTimeline
							{...timelineProps}
							tempoChanges={timelineData.tempoChanges}
							trackHeaderWidth={TRACK_HEADER_WIDTH}
							pixelsPerBeat={pixelsPerBeat}
						/>
					)}
					{mode === 'drums' && (
						<DrumsTimeline
							{...timelineProps}
							trackHeaderWidth={TRACK_HEADER_WIDTH}
							pixelsPerBeat={pixelsPerBeat}
						/>
					)}
				</>
			)}
		</div>
	);
}
