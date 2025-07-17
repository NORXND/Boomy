import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import {
	Play,
	Pause,
	Square,
	SkipBack,
	SkipForward,
	Lock,
	Unlock,
	PersonStanding,
	Camera,
} from 'lucide-react';
import { useSongStore } from '../../store/songStore';
import { useTimelineContext } from '../../contexts/TimelineContext';

interface TimeSignature {
	numerator: number;
	denominator: number;
	ticks: number;
}

interface TempoChange {
	time: number; // in seconds
	bpm: number;
	ticks: number;
}

interface Measure {
	number: number;
	startTime: number; // in seconds
	duration: number; // in seconds
	startBeat: number;
	beatCount: number;
	bpm: number;
}

interface TimelineData {
	measures: Measure[];
	totalDuration: number;
	totalBeats: number;
	tempoChanges: TempoChange[];
	timeSignatures: TimeSignature[];
}

interface TimelineRootProps {
	type: 'moves' | 'cameras';
}

export function TimelineRoot({ type }: TimelineRootProps) {
	const {
		midiPath,
		audioPath,
		currentSong,
		addMoveEvent,
		removeMoveEvent,
		addCameraEvent,
		removeCameraEvent,
		saveSong,
		isLoading: isSaving,
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

	const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [midiData, setMidiData] = useState<Midi | null>(null);
	const [moveImageCache, setMoveImageCache] = useState<
		Record<string, string>
	>({});
	const [moveDataCache, setMoveDataCache] = useState<Record<string, any>>({});

	// Audio playback state - keep local state but sync with context
	const [autoScroll, setAutoScroll] = useState(true);
	const [audioReady, setAudioReady] = useState(false);
	const [dragOverCell, setDragOverCell] = useState<string | null>(null);
	const playerRef = useRef<Tone.Player | null>(null);
	const audioElementRef = useRef<HTMLAudioElement | null>(null);
	const animationFrameRef = useRef<number | null>(null);
	const timelineScrollRef = useRef<HTMLDivElement | null>(null);

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

	const loadMidiFile = useCallback(async () => {
		if (!midiPath) return;

		setLoading(true);
		setError(null);

		try {
			// Read MIDI file using Electron API
			const midiBuffer = await window.electronAPI.readFileBuffer(
				midiPath
			);
			const uint8Array = new Uint8Array(midiBuffer);

			// Parse MIDI with Tone.js
			const midi = new Midi(uint8Array);
			setMidiData(midi);

			// Calculate timeline data
			const timeline = calculateTimelineData(midi);
			setTimelineData(timeline);
		} catch (err) {
			setError(`Failed to load MIDI: ${err}`);
			console.error('MIDI loading error:', err);
		} finally {
			setLoading(false);
		}
	}, [midiPath]);

	const loadAudioFile = useCallback(async () => {
		if (!audioPath) {
			console.log('No audio path provided');
			return;
		}

		console.log('Loading audio from:', audioPath);

		try {
			// Dispose of existing player
			if (playerRef.current) {
				playerRef.current.dispose();
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
			const audioUrl = URL.createObjectURL(blob);

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
				console.log('Audio playback ended');
				setIsPlaying(false);
				if (animationFrameRef.current) {
					cancelAnimationFrame(animationFrameRef.current);
				}
			};

			setDuration(audioElement.duration);
			setAudioReady(true);
			console.log(
				'Audio loaded successfully, duration:',
				audioElement.duration
			);

			// Cleanup blob URL
			URL.revokeObjectURL(audioUrl);
		} catch (err) {
			console.error('Audio loading error:', err);
			setError(`Failed to load audio: ${err}`);
		}
	}, [audioPath]);

	const calculateCursorPosition = useCallback(
		(time?: number) => {
			if (!timelineData) return 128; // Start after track labels

			const targetTime = time !== undefined ? time : currentTime;
			let position = 128; // Start after track labels (128px width)
			for (const measure of timelineData.measures) {
				if (targetTime >= measure.startTime + measure.duration) {
					// Target time is beyond this measure
					position += Math.max(160, measure.duration * 20);
				} else if (targetTime >= measure.startTime) {
					// Target time is within this measure
					const progressInMeasure =
						(targetTime - measure.startTime) / measure.duration;
					const measureWidth = Math.max(160, measure.duration * 20);
					position += progressInMeasure * measureWidth;
					break;
				} else {
					// Target time is before this measure
					break;
				}
			}

			return position;
		},
		[timelineData, currentTime]
	);

	const updatePlaybackPosition = useCallback(() => {
		if (!isPlaying || !audioElementRef.current) {
			return;
		}

		const currentTime = audioElementRef.current.currentTime;
		setCurrentTime(currentTime);

		// Auto-scroll timeline using the same calculation as startPlaybackLoop
		if (autoScroll && timelineScrollRef.current && timelineData) {
			const cursorPosition = calculateCursorPosition(currentTime);
			const container = timelineScrollRef.current;
			const containerWidth = container.clientWidth;

			// Calculate ideal scroll position (keep cursor in center of visible area)
			const idealScrollLeft = cursorPosition - containerWidth / 2;

			// Get total timeline width including track labels
			const totalTimelineWidth =
				128 +
				timelineData.measures.reduce(
					(total, measure) =>
						total + Math.max(160, measure.duration * 20),
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
	}, [
		isPlaying,
		duration,
		timelineData,
		autoScroll,
		calculateCursorPosition,
	]);

	const startPlaybackLoop = useCallback(() => {
		if (!audioElementRef.current) {
			return;
		}

		const updateLoop = () => {
			if (!audioElementRef.current || audioElementRef.current.paused) {
				return;
			}

			const currentTime = audioElementRef.current.currentTime;
			setCurrentTime(currentTime);

			// Auto-scroll timeline using inline cursor position calculation
			if (autoScroll && timelineScrollRef.current && timelineData) {
				// Calculate cursor position inline (after track labels)
				let cursorPosition = 128; // Start after track labels
				for (const measure of timelineData.measures) {
					if (currentTime >= measure.startTime + measure.duration) {
						// Current time is beyond this measure
						cursorPosition += Math.max(160, measure.duration * 20);
					} else if (currentTime >= measure.startTime) {
						// Current time is within this measure
						const progressInMeasure =
							(currentTime - measure.startTime) /
							measure.duration;
						const measureWidth = Math.max(
							160,
							measure.duration * 20
						);
						cursorPosition += progressInMeasure * measureWidth;
						break;
					} else {
						// Current time is before this measure
						break;
					}
				}

				const container = timelineScrollRef.current;
				const containerWidth = container.clientWidth;

				// Calculate ideal scroll position (keep cursor in center of visible area)
				const idealScrollLeft = cursorPosition - containerWidth / 2;

				// Get total timeline width including track labels
				const totalTimelineWidth =
					128 +
					timelineData.measures.reduce(
						(total, measure) =>
							total + Math.max(160, measure.duration * 20),
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

			// Continue the loop
			animationFrameRef.current = requestAnimationFrame(updateLoop);
		};

		// Start the loop
		animationFrameRef.current = requestAnimationFrame(updateLoop);
	}, [timelineData, autoScroll]);

	const handlePlay = useCallback(async () => {
		console.log('Play button clicked');
		console.log('Audio element exists:', !!audioElementRef.current);
		console.log('Audio ready state:', audioReady);
		console.log('Current time:', currentTime);

		if (!audioElementRef.current) {
			console.error('No audio element available');
			return;
		}

		if (!audioReady) {
			console.error('Audio not ready yet');
			return;
		}

		try {
			const audio = audioElementRef.current;
			console.log('Audio readyState:', audio.readyState);
			console.log('Audio duration:', audio.duration);
			console.log('Audio paused:', audio.paused);
			console.log('Setting current time to:', currentTime);

			// Ensure audio is loaded and ready
			if (audio.readyState < 2) {
				// HAVE_CURRENT_DATA
				console.log('Audio not ready, waiting for load...');
				await new Promise((resolve) => {
					const onCanPlay = () => {
						audio.removeEventListener('canplay', onCanPlay);
						resolve(void 0);
					};
					audio.addEventListener('canplay', onCanPlay);
				});
			}

			// Set the current time and play
			audio.currentTime = currentTime;

			console.log('Starting playback...');

			// Try to play with better error handling
			const playPromise = audio.play();
			if (playPromise !== undefined) {
				await playPromise;
			}

			console.log('Playback started successfully');
			setIsPlaying(true);
			startPlaybackLoop();
		} catch (err) {
			console.error('Playback error:', err);
			// If autoplay failed, we might need user interaction
			if (err.name === 'NotAllowedError') {
				console.log('Autoplay prevented by browser policy');
			}
		}
	}, [updatePlaybackPosition, currentTime, audioReady, startPlaybackLoop]);

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
				if (time <= tempoChange.time) {
					// Time is before this tempo change
					const duration = time - lastTime;
					const beatsPerSecond = tempoChange.bpm / 60;
					totalBeats += duration * beatsPerSecond;
					break;
				} else {
					// Add beats from this tempo section
					const duration = tempoChange.time - lastTime;
					const beatsPerSecond = tempoChange.bpm / 60;
					totalBeats += duration * beatsPerSecond;
					lastTime = tempoChange.time;
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

	// Handle drag over for drop zones
	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
	}, []);

	// Handle drag leave for drop zones
	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setDragOverCell(null);
	}, []);

	// Handle cell-specific drag over for highlighting
	const handleCellDragOver = useCallback(
		(e: React.DragEvent, cellKey: string) => {
			e.preventDefault();
			e.dataTransfer.dropEffect = 'copy';
			setDragOverCell(cellKey);
		},
		[]
	);

	// Handle drop on timeline cell
	const handleDrop = useCallback(
		(
			e: React.DragEvent,
			difficulty: 'easy' | 'medium' | 'expert',
			measure: Measure
		) => {
			e.preventDefault();
			setDragOverCell(null);

			try {
				const dragData = JSON.parse(
					e.dataTransfer.getData('application/json')
				);

				if (dragData.type === 'move-clip' && type === 'moves') {
					const { moveKey, clipPath, clipName, moveData } = dragData;
					const [category, song, move] = moveKey.split('/');

					// Remove any existing moves in this measure for this difficulty
					const measureStartBeat = timeToBeat(measure.startTime);
					const measureEndBeat = timeToBeat(
						measure.startTime + measure.duration
					);

					if (currentSong) {
						const events = currentSong.timeline[difficulty].moves;
						const eventsToRemove = events
							.map((event, index) => ({
								...event,
								originalIndex: index,
							}))
							.filter(
								(event) =>
									event.beat >= measureStartBeat &&
									event.beat < measureEndBeat
							);

						// Remove existing events in reverse order to maintain indices
						for (let i = eventsToRemove.length - 1; i >= 0; i--) {
							removeMoveEvent(
								difficulty,
								eventsToRemove[i].originalIndex
							);
						}
					}

					// Create new move event - round to the nearest quarter beat for precision
					const moveEvent = {
						beat: measure.number, // Round to quarter beats
						clip: clipName,
						move_origin: category,
						move_song: song,
						move: move,
					};

					console.log(
						`Adding move at beat ${moveEvent.beat} for measure ${measure.number} (start time: ${measure.startTime}s)`
					);
					addMoveEvent(difficulty, moveEvent);
				} else if (
					dragData.type === 'camera-position' &&
					type === 'cameras'
				) {
					const { position, displayName } = dragData;

					// Remove any existing camera events in this measure for this difficulty
					const measureStartBeat = timeToBeat(measure.startTime);
					const measureEndBeat = timeToBeat(
						measure.startTime + measure.duration
					);

					if (currentSong) {
						const events = currentSong.timeline[difficulty].cameras;
						const eventsToRemove = events
							.map((event, index) => ({
								...event,
								originalIndex: index,
							}))
							.filter(
								(event) =>
									event.beat >= measureStartBeat &&
									event.beat < measureEndBeat
							);

						// Remove existing events in reverse order to maintain indices
						for (let i = eventsToRemove.length - 1; i >= 0; i--) {
							removeCameraEvent(
								difficulty,
								eventsToRemove[i].originalIndex
							);
						}
					}

					// Create new camera event
					const cameraEvent = {
						beat: measure.number,
						camera: position,
					};

					console.log(
						`Adding camera ${position} at beat ${cameraEvent.beat} for measure ${measure.number} (start time: ${measure.startTime}s)`
					);
					addCameraEvent(difficulty, cameraEvent);
				}
			} catch (err) {
				console.error('Failed to handle drop:', err);
			}
		},
		[
			addMoveEvent,
			removeMoveEvent,
			addCameraEvent,
			removeCameraEvent,
			timeToBeat,
			currentSong,
		]
	);

	// Handle click to delete move event
	const handleMoveEventClick = useCallback(
		(
			difficulty: 'easy' | 'medium' | 'expert',
			eventIndex: number,
			e: React.MouseEvent
		) => {
			e.stopPropagation();
			removeMoveEvent(difficulty, eventIndex);
		},
		[removeMoveEvent]
	);

	// Handle click to delete camera event
	const handleCameraEventClick = useCallback(
		(
			difficulty: 'easy' | 'medium' | 'expert',
			eventIndex: number,
			e: React.MouseEvent
		) => {
			e.stopPropagation();
			removeCameraEvent(difficulty, eventIndex);
		},
		[removeCameraEvent]
	);

	// Get move events for a specific measure and difficulty
	const getMoveEventsForMeasure = useCallback(
		(difficulty: 'easy' | 'medium' | 'expert', measure: number) => {
			if (!currentSong) return [];

			const events = currentSong.timeline[difficulty].moves;

			const filteredEvents = events
				.map((event, index) => ({ ...event, originalIndex: index }))
				.filter((event) => event.beat == measure);

			return filteredEvents;
		},
		[currentSong, timeToBeat]
	);

	// Get camera events for a specific measure and difficulty
	const getCameraEventsForMeasure = useCallback(
		(difficulty: 'easy' | 'medium' | 'expert', measure: number) => {
			if (!currentSong) return [];

			const events = currentSong.timeline[difficulty].cameras;

			const filteredEvents = events
				.map((event, index) => ({ ...event, originalIndex: index }))
				.filter((event) => event.beat == measure);

			return filteredEvents;
		},
		[currentSong, timeToBeat]
	);

	// Load move images for timeline events
	const loadMoveImages = useCallback(async () => {
		if (!currentSong || !currentSong.move_lib) return;

		const newImageCache: Record<string, string> = {};
		const newDataCache: Record<string, any> = {};
		const moveLibPath = currentSong.move_lib;

		// Get all unique move keys from timeline
		const allMoveKeys = new Set<string>();
		['easy', 'medium', 'expert'].forEach((difficulty) => {
			const moves =
				currentSong.timeline[
					difficulty as keyof typeof currentSong.timeline
				].moves;
			moves.forEach((move) => {
				const moveKey = `${move.move_origin}/${move.move_song}/${move.move}`;
				allMoveKeys.add(moveKey);
			});
		});

		// Load images and data for each unique move
		for (const moveKey of allMoveKeys) {
			try {
				const [category, song, move] = moveKey.split('/');
				const movePath = `${moveLibPath}/${category}/${song}/${move}`;

				// Load move.json for display name
				const jsonPath = `${movePath}/move.json`;
				const jsonExists = await window.electronAPI.pathExists(
					jsonPath
				);
				if (jsonExists) {
					const jsonData = await window.electronAPI.readJsonFile(
						jsonPath
					);
					newDataCache[moveKey] = jsonData;
				}

				// Load move.png
				const imagePath = `${movePath}/move.png`;
				const imageExists = await window.electronAPI.pathExists(
					imagePath
				);
				if (imageExists) {
					const imageBuffer = await window.electronAPI.readFileBuffer(
						imagePath
					);
					const blob = new Blob([imageBuffer], { type: 'image/png' });
					const url = URL.createObjectURL(blob);
					newImageCache[moveKey] = url;
				}
			} catch (err) {
				console.warn('Failed to load move image for', moveKey, err);
			}
		}

		setMoveImageCache(newImageCache);
		setMoveDataCache(newDataCache);
	}, [currentSong]);

	// Load move images when song changes
	useEffect(() => {
		loadMoveImages();
	}, [loadMoveImages]);

	const calculateTimelineData = (midi: Midi): TimelineData => {
		// Extract tempo changes (BPM changes throughout the song)
		const tempoChanges: TempoChange[] = [];

		// Default tempo if none specified
		let currentBPM = 120;

		// Look for tempo changes in header track or first track
		const headerTrack = midi.header;
		if (headerTrack.tempos && headerTrack.tempos.length > 0) {
			headerTrack.tempos.forEach((tempo) => {
				tempoChanges.push({
					time: tempo.time,
					bpm: tempo.bpm,
					ticks: tempo.ticks,
				});
			});
			currentBPM = headerTrack.tempos[0].bpm;
		}

		// If no tempo changes found, use default
		if (tempoChanges.length === 0) {
			tempoChanges.push({
				time: 0,
				bpm: currentBPM,
				ticks: 0,
			});
		}

		// Extract time signatures
		const timeSignatures: TimeSignature[] = [];
		if (
			headerTrack.timeSignatures &&
			headerTrack.timeSignatures.length > 0
		) {
			headerTrack.timeSignatures.forEach((timeSig) => {
				timeSignatures.push({
					numerator: timeSig.timeSignature[0] || 4,
					denominator: timeSig.timeSignature[1] || 4,
					ticks: timeSig.ticks,
				});
			});
		} else {
			// Default to 4/4 time
			timeSignatures.push({
				numerator: 4,
				denominator: 4,
				ticks: 0,
			});
		}

		// Calculate measures based on tempo and time signature changes
		const measures: Measure[] = [];
		const ticksPerBeat = midi.header.ppq || 480; // Pulses per quarter note
		const totalDuration = midi.duration;

		let currentTime = 0;
		let currentBeat = 0;
		let measureNumber = 1;
		let currentTimeSigIndex = 0;
		let currentTempoIndex = 0;

		while (currentTime < totalDuration) {
			// Get current time signature
			const timeSig =
				timeSignatures[currentTimeSigIndex] ||
				timeSignatures[timeSignatures.length - 1];
			const beatsPerMeasure = timeSig.numerator;
			const beatUnit = timeSig.denominator;

			// Get current BPM
			let bpm = currentBPM;
			if (
				currentTempoIndex < tempoChanges.length - 1 &&
				currentTime >= tempoChanges[currentTempoIndex + 1].time
			) {
				currentTempoIndex++;
				bpm = tempoChanges[currentTempoIndex].bpm;
			}

			// Calculate duration of one beat in seconds
			const beatDuration = (60 / bpm) * (4 / beatUnit); // Adjust for beat unit

			// Calculate measure duration
			const measureDuration = beatDuration * beatsPerMeasure;

			// Don't let measure extend beyond song duration
			const actualMeasureDuration = Math.min(
				measureDuration,
				totalDuration - currentTime
			);

			measures.push({
				number: measureNumber,
				startTime: currentTime,
				duration: actualMeasureDuration,
				startBeat: currentBeat,
				beatCount: beatsPerMeasure,
				bpm: bpm,
			});

			currentTime += actualMeasureDuration;
			currentBeat += beatsPerMeasure;
			measureNumber++;

			// Check if we need to advance time signature
			if (
				currentTimeSigIndex < timeSignatures.length - 1 &&
				currentTime >=
					(timeSignatures[currentTimeSigIndex + 1].ticks /
						ticksPerBeat) *
						beatDuration
			) {
				currentTimeSigIndex++;
			}

			// Safety check to prevent infinite loop
			if (measureNumber > 1000) {
				console.warn(
					'Stopping measure calculation at 1000 measures to prevent infinite loop'
				);
				break;
			}
		}

		return {
			measures,
			totalDuration,
			totalBeats: currentBeat,
			tempoChanges,
			timeSignatures,
		};
	};

	// Load MIDI and audio when component mounts or paths change
	useEffect(() => {
		loadMidiFile();
	}, [loadMidiFile]);

	useEffect(() => {
		loadAudioFile();
	}, [loadAudioFile]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (playerRef.current) {
				playerRef.current.dispose();
			}
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
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

	if (loading) {
		return (
			<div className="h-full flex items-center justify-center">
				<div className="text-center">
					<div className="text-sm text-muted-foreground">
						Loading MIDI data...
					</div>
				</div>
			</div>
		);
	}

	if (error || !timelineData || !midiData) {
		return (
			<div className="h-full flex items-center justify-center">
				<div className="text-center text-destructive">
					<div className="text-sm font-medium">
						Error loading MIDI
					</div>
					<div className="text-xs mt-1">{error}</div>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col overflow-hidden max-w-full">
			{/* Timeline Header */}
			<div className="flex-shrink-0 p-4 border-b bg-background">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h2 className="text-lg font-semibold capitalize">
							{type} Timeline
						</h2>
						<div className="text-sm text-muted-foreground">
							{timelineData.measures.length} measures •{' '}
							{timelineData.totalDuration.toFixed(2)}s duration
						</div>
					</div>

					{/* Playback Controls */}
					<div className="flex items-center gap-2">
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
							<span className="text-muted-foreground">/</span>
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
						const rect = e.currentTarget.getBoundingClientRect();
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
									? `${(currentTime / duration) * 100}%`
									: '0%',
						}}
					/>
				</div>
			</div>

			{/* Timeline Container */}
			<div
				ref={timelineScrollRef}
				className="overflow-auto relative max-w-full"
			>
				{/* Playback Cursor */}
				{timelineData && currentTime > 0 && (
					<div
						className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none"
						style={{
							left: `${calculateCursorPosition()}px`,
						}}
					>
						<div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full" />
					</div>
				)}

				{/* Combined Header Row */}
				<div className="h-8 border-b bg-background flex sticky top-0 z-10">
					{/* Track Labels Header */}
					<div className="flex-shrink-0 w-32 border-r bg-background flex items-center px-3">
						<span className="text-xs font-medium text-muted-foreground">
							Tracks
						</span>
					</div>

					{/* Measure Headers */}
					{timelineData.measures.map((measure) => (
						<div
							key={measure.number}
							className="flex-shrink-0 border-r px-2 flex items-center justify-center bg-muted/50 cursor-pointer hover:bg-muted/70"
							style={{
								width: `${Math.max(
									160,
									measure.duration * 20
								)}px`,
							}}
							onClick={() => handleSeek(measure.startTime)}
							title={`Jump to measure ${measure.number}`}
						>
							<div className="text-xs font-medium text-center">
								<div>{measure.number}</div>
								<div className="text-muted-foreground">
									{measure.bpm.toFixed(0)}
								</div>
							</div>
						</div>
					))}
				</div>

				{/* Track Rows with Labels */}
				{(['easy', 'medium', 'expert'] as const).map((track) => (
					<div key={track} className="h-[90px] border-b flex">
						{/* Track Label */}
						<div className="flex-shrink-0 w-32 border-r bg-muted/30 flex items-center px-3">
							<span className="text-sm font-medium capitalize">
								{track}
							</span>
						</div>

						{/* Track Cells */}
						{timelineData.measures.map((measure) => {
							const events =
								type === 'moves'
									? getMoveEventsForMeasure(
											track,
											measure.number
									  )
									: getCameraEventsForMeasure(
											track,
											measure.number
									  );
							const cellKey = `${track}-${measure.number}`;
							const isHighlighted = dragOverCell === cellKey;

							return (
								<div
									key={cellKey}
									className={`flex-shrink-0 border-r transition-colors cursor-pointer relative group min-h-full ${
										isHighlighted
											? 'bg-primary/20 border-primary'
											: 'hover:bg-muted/20'
									}`}
									style={{
										width: `${Math.max(
											160,
											measure.duration * 20
										)}px`,
									}}
									onClick={() =>
										handleSeek(measure.startTime)
									}
									onDragOver={(e) =>
										handleCellDragOver(e, cellKey)
									}
									onDragLeave={handleDragLeave}
									onDrop={(e) =>
										handleDrop(e, track, measure)
									}
								>
									{/* Events */}
									{events.length > 0 ? (
										<div className="w-full h-full p-1 flex flex-col gap-1 overflow-hidden">
											{events
												.slice(0, 1)
												.map((event, idx) => {
													if (type === 'moves') {
														// Move event rendering
														const moveEvent =
															event as any;
														const moveKey = `${moveEvent.move_origin}/${moveEvent.move_song}/${moveEvent.move}`;
														const imageUrl =
															moveImageCache[
																moveKey
															];
														const moveData =
															moveDataCache[
																moveKey
															];
														const displayName =
															moveData?.display_name ||
															moveEvent.move;

														return (
															<div
																key={`${moveEvent.originalIndex}-${idx}`}
																className="flex-1 bg-primary/20 border border-primary/40 rounded p-1 flex flex-col items-center justify-center hover:bg-primary/30 transition-colors min-h-0"
																onClick={(e) =>
																	handleMoveEventClick(
																		track,
																		moveEvent.originalIndex,
																		e
																	)
																}
																title={`${displayName}\nClip: ${moveEvent.clip}\nClick to delete`}
															>
																{imageUrl ? (
																	<img
																		src={
																			imageUrl
																		}
																		alt={
																			displayName
																		}
																		className="w-16 h-8 object-cover rounded mb-1 flex-shrink-0"
																		style={{
																			minWidth:
																				'64px',
																			minHeight:
																				'32px',
																			maxWidth:
																				'64px',
																			maxHeight:
																				'32px',
																		}}
																	/>
																) : (
																	<div className="w-16 h-8 bg-muted rounded mb-1 flex items-center justify-center flex-shrink-0">
																		<PersonStanding className="h-4 w-4 text-muted-foreground" />
																	</div>
																)}
																<div className="text-xs font-medium truncate w-full leading-tight">
																	{
																		displayName
																	}
																</div>
																<div className="text-xs text-muted-foreground truncate w-full leading-tight">
																	{
																		moveEvent.clip
																	}
																</div>
															</div>
														);
													} else {
														// Camera event rendering
														const cameraEvent =
															event as any;
														const cameraDisplayNames =
															{
																VENUE: 'Venue',
																CLOSEUP:
																	'Close-up',
																Area1_NEAR:
																	'Area 1 Near',
																Area1_MOVEMENT:
																	'Area 1 Movement',
																Area1_FAR:
																	'Area 1 Far',
																Area1_WIDE:
																	'Area 1 Wide',
																Area2_NEAR:
																	'Area 2 Near',
																Area2_MOVEMENT:
																	'Area 2 Movement',
																Area2_WIDE:
																	'Area 2 Wide',
																Area2_FAR:
																	'Area 2 Far',
																Area3_NEAR:
																	'Area 3 Near',
																Area3_WIDE:
																	'Area 3 Wide',
																Area3_MOVEMENT:
																	'Area 3 Movement',
																Area3_FAR:
																	'Area 3 Far',
															};
														const displayName =
															cameraDisplayNames[
																cameraEvent.camera as keyof typeof cameraDisplayNames
															] ||
															cameraEvent.camera;

														return (
															<div
																key={`${cameraEvent.originalIndex}-${idx}`}
																className="flex-1 bg-blue-500/20 border border-blue-500/40 rounded p-1 flex flex-col items-center justify-center hover:bg-blue-500/30 transition-colors min-h-0"
																onClick={(e) =>
																	handleCameraEventClick(
																		track,
																		cameraEvent.originalIndex,
																		e
																	)
																}
																title={`${displayName}\nCamera: ${cameraEvent.camera}\nClick to delete`}
															>
																<div className="w-16 h-8 bg-blue-500/10 rounded mb-1 flex items-center justify-center flex-shrink-0">
																	<Camera className="h-4 w-4 text-blue-500" />
																</div>
																<div className="text-xs font-medium truncate w-full leading-tight">
																	{
																		displayName
																	}
																</div>
																<div className="text-xs text-muted-foreground truncate w-full leading-tight">
																	{
																		cameraEvent.camera
																	}
																</div>
															</div>
														);
													}
												})}
										</div>
									) : (
										/* Empty drop zone */
										<div className="w-full h-full flex items-center justify-center">
											<div className="w-3 h-3 rounded-full bg-muted/30 group-hover:bg-primary/50 transition-colors" />
										</div>
									)}

									{/* Tooltip on hover */}
									{/* <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
											<div>Measure {measure.number}</div>
											<div>
												{measure.startTime.toFixed(2)}s
											</div>
											<div>{track} track</div>
											{moveEvents.length === 0 ? (
												<div className="text-muted-foreground text-xs">
													Drag clips here or click to
													seek
												</div>
											) : (
												<div className="text-muted-foreground text-xs">
													{moveEvents.length} move
													{moveEvents.length !== 1
														? 's'
														: ''}
												</div>
											)}
										</div> */}
								</div>
							);
						})}
					</div>
				))}

				{/* Timeline Info Footer */}
				<div className="flex-shrink-0 p-2 border-t bg-muted/30 text-xs text-muted-foreground">
					<div className="flex items-center gap-4">
						<span>Total: {timelineData.totalBeats} beats</span>
					</div>
				</div>
			</div>
		</div>
	);
}
