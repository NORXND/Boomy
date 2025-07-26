import React, {
	useState,
	useCallback,
	useRef,
	useEffect,
	useMemo,
} from 'react';
import {
	PersonStanding,
	Copy,
	Clipboard,
	Trash,
	X,
	ScissorsLineDashed,
} from 'lucide-react';
import { useSongStore } from '../../store/songStore';
import type { TimelineData, Measure } from './NewTimelineRoot';
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from '@/components/ui/context-menu';

export interface ChoreographyTimelineProps {
	timelineData: TimelineData;
	currentTime: number;
	isPlaying: boolean;
	autoScroll: boolean;
	calculateCursorPosition: (time?: number) => number;
	handleSeek: (time: number) => void;
	timeToBeat: (time: number) => number;
	timelineScrollRef: React.RefObject<HTMLDivElement>;
	pixelsPerBeat: number;
	trackHeaderWidth: number;
	addUndoAction: (action: any) => void; // <-- Add this prop
}

// Type for selected cells
interface SelectedCell {
	difficulty: 'supereasy' | 'easy' | 'medium' | 'expert';
	measure: number;
}

// Use React.memo to prevent unnecessary re-renders
export const ChoreographyTimeline = React.memo(
	function ChoreographyTimeline({
		timelineData,
		currentTime,
		isPlaying,
		autoScroll,
		calculateCursorPosition,
		handleSeek,
		timeToBeat,
		timelineScrollRef,
		pixelsPerBeat,
		trackHeaderWidth,
		addUndoAction,
	}: ChoreographyTimelineProps) {
		// Use selective state from the store to prevent re-renders when unrelated state changes
		const currentSong = useSongStore((state) => state.currentSong);
		const addMoveEvent = useSongStore((state) => state.addMoveEvent);
		const removeMoveEvent = useSongStore((state) => state.removeMoveEvent);
		const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);
		const [dragOverCell, setDragOverCell] = useState<string | null>(null);
		const [clipboardData, setClipboardData] = useState<any[]>([]);
		const selectionStartRef = useRef<SelectedCell | null>(null);
		const isShiftKeyPressed = useRef(false);
		const isCtrlKeyPressed = useRef(false);

		// Track keyboard modifiers
		React.useEffect(() => {
			const handleKeyDown = (e: KeyboardEvent) => {
				if (e.key === 'Shift') isShiftKeyPressed.current = true;
				if (e.key === 'Control') isCtrlKeyPressed.current = true;
			};

			const handleKeyUp = (e: KeyboardEvent) => {
				if (e.key === 'Shift') isShiftKeyPressed.current = false;
				if (e.key === 'Control') isCtrlKeyPressed.current = false;
			};

			window.addEventListener('keydown', handleKeyDown);
			window.addEventListener('keyup', handleKeyUp);

			return () => {
				window.removeEventListener('keydown', handleKeyDown);
				window.removeEventListener('keyup', handleKeyUp);
			};
		}, []);

		// Get move events for a specific measure and difficulty
		const getMoveEventsForMeasure = useCallback(
			(
				difficulty: 'supereasy' | 'easy' | 'medium' | 'expert',
				measure: number
			) => {
				if (!currentSong) return [];

				// Map our difficulty to the song store's difficulty format
				const difficultyMap: Record<
					string,
					'supereasy' | 'easy' | 'medium' | 'expert'
				> = {
					supereasy: 'supereasy',
					easy: 'easy',
					medium: 'medium',
					expert: 'expert',
				};

				const mappedDifficulty = difficultyMap[difficulty];

				let events = [];
				if (difficulty === 'supereasy') {
					events = currentSong.supereasy;
				} else {
					events =
						currentSong.timeline[
							mappedDifficulty as 'easy' | 'medium' | 'expert'
						].moves;
				}

				// Filter events that match this measure
				return events
					.map((event, index) => ({ ...event, originalIndex: index }))
					.filter((event) => event.measure === measure);
			},
			[currentSong]
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
				difficulty: 'supereasy' | 'easy' | 'medium' | 'expert',
				measure: Measure
			) => {
				e.preventDefault();
				setDragOverCell(null);

				try {
					const dragData = JSON.parse(
						e.dataTransfer.getData('application/json')
					);

					const difficultyMap: Record<
						string,
						'supereasy' | 'easy' | 'medium' | 'expert'
					> = {
						supereasy: 'supereasy',
						easy: 'easy',
						medium: 'medium',
						expert: 'expert',
					};

					const mappedDifficulty = difficultyMap[difficulty];

					if (dragData.type === 'move-clip') {
						const { moveKey, clipPath, clipName, moveData } =
							dragData;
						const [category, song, move] = moveKey.split('/');

						// Remove any existing move in this cell (measure) for this difficulty
						if (currentSong) {
							let events = [];
							if (mappedDifficulty == 'supereasy') {
								events = currentSong.supereasy;
							} else {
								events =
									currentSong.timeline[mappedDifficulty]
										.moves;
							}

							const eventIndex = events.findIndex(
								(event) => event.measure === measure.number
							);
							if (eventIndex !== -1) {
								// Add to undo stack: move:remove
								addUndoAction({
									type: 'move:remove',
									data: {
										track: mappedDifficulty,
										event: events[eventIndex],
									},
								});
								removeMoveEvent(mappedDifficulty, eventIndex);
							}
						}

						// Create new move event
						const moveEvent = {
							measure: measure.number,
							clip: clipName,
							move_origin: category,
							move_song: song,
							move: move,
						};

						addMoveEvent(mappedDifficulty, moveEvent);

						// Add to undo stack: move:add
						addUndoAction({
							type: 'move:add',
							data: {
								track: mappedDifficulty,
								event: moveEvent,
							},
						});
					}
				} catch (err) {
					console.error('Failed to handle drop:', err);
				}
			},
			[addMoveEvent, removeMoveEvent, currentSong, addUndoAction]
		);

		// Handle cell selection
		const handleCellClick = useCallback(
			(
				difficulty: 'supereasy' | 'easy' | 'medium' | 'expert',
				measure: number,
				e: React.MouseEvent
			) => {
				e.stopPropagation();

				const cell = { difficulty, measure };

				// If shift key is pressed, extend selection from last selected cell
				if (isShiftKeyPressed.current && selectedCells.length > 0) {
					const lastCell = selectedCells[selectedCells.length - 1];
					const startMeasure = Math.min(lastCell.measure, measure);
					const endMeasure = Math.max(lastCell.measure, measure);

					// If the tracks are the same, select all measures between
					if (lastCell.difficulty === difficulty) {
						const newSelection = [];
						for (let m = startMeasure; m <= endMeasure; m++) {
							newSelection.push({ difficulty, measure: m });
						}
						setSelectedCells(newSelection);
					} else {
						// If different tracks, just add the new cell
						setSelectedCells([...selectedCells, cell]);
					}
				}
				// If ctrl key is pressed, toggle this cell in selection
				else if (isCtrlKeyPressed.current) {
					const index = selectedCells.findIndex(
						(c) =>
							c.difficulty === difficulty && c.measure === measure
					);

					if (index >= 0) {
						// Remove from selection
						const newSelection = [...selectedCells];
						newSelection.splice(index, 1);
						setSelectedCells(newSelection);
					} else {
						// Add to selection
						setSelectedCells([...selectedCells, cell]);
					}
				}
				// Regular click - just select this cell
				else {
					setSelectedCells([cell]);
				}

				// Set this as the start of a potential selection
				selectionStartRef.current = cell;
			},
			[selectedCells]
		);

		// Copy selected moves to clipboard
		const handleCopy = useCallback(() => {
			if (selectedCells.length === 0 || !currentSong) return;

			const copied = [];
			const sortedCells = [...selectedCells].sort(
				(a, b) => a.measure - b.measure
			);
			const firstMeasure = sortedCells[0].measure;

			for (const cell of sortedCells) {
				const difficultyMap: Record<
					string,
					'supereasy' | 'easy' | 'medium' | 'expert'
				> = {
					supereasy: 'supereasy',
					easy: 'easy',
					medium: 'medium',
					expert: 'expert',
				};
				const mappedDifficulty = difficultyMap[cell.difficulty];

				let events = [];
				if (mappedDifficulty === 'supereasy') {
					events = currentSong.supereasy;
				} else {
					events = currentSong.timeline[mappedDifficulty].moves;
				}

				const moveEvent = events.find(
					(event) => event.measure === cell.measure
				);
				if (moveEvent) {
					copied.push({
						offset: cell.measure - firstMeasure,
						move: { ...moveEvent },
					});
				}
			}

			const clipboardPayload = {
				boomy: 'copypaste1',
				type: 'move',
				data: copied,
			};

			try {
				navigator.clipboard.writeText(JSON.stringify(clipboardPayload));
				setClipboardData(copied); // still keep for legacy paste
			} catch (err) {
				console.error('Failed to write to clipboard:', err);
			}
		}, [selectedCells, currentSong]);

		// Paste moves from clipboard at target track/measure
		const handlePaste = useCallback(
			async (
				targetDifficulty: 'supereasy' | 'easy' | 'medium' | 'expert',
				targetMeasure: number
			) => {
				let clipboardPayload = null;
				try {
					const text = await navigator.clipboard.readText();
					clipboardPayload = JSON.parse(text);
				} catch {
					// fallback to legacy
					if (clipboardData.length === 0 || !currentSong) return;
					clipboardPayload = {
						boomy: 'copypaste1',
						type: 'move',
						data: clipboardData,
					};
				}

				if (
					!clipboardPayload ||
					clipboardPayload.boomy !== 'copypaste1' ||
					clipboardPayload.type !== 'move' ||
					!Array.isArray(clipboardPayload.data)
				) {
					return;
				}

				const addedEvents: any[] = [];
				const removedEvents: any[] = [];

				for (const item of clipboardPayload.data) {
					const difficultyMap: Record<
						string,
						'supereasy' | 'easy' | 'medium' | 'expert'
					> = {
						supereasy: 'supereasy',
						easy: 'easy',
						medium: 'medium',
						expert: 'expert',
					};
					const mappedDifficulty = difficultyMap[targetDifficulty];
					const newMeasure = targetMeasure + (item.offset ?? 0);

					// Remove any existing event at this measure
					let existingEventIndex;
					let existingEvent;
					if (mappedDifficulty === 'supereasy') {
						existingEventIndex = currentSong.supereasy.findIndex(
							(event) => event.measure === newMeasure
						);
						existingEvent =
							currentSong.supereasy[existingEventIndex];
					} else {
						existingEventIndex = currentSong.timeline[
							mappedDifficulty
						].moves.findIndex(
							(event) => event.measure === newMeasure
						);
						existingEvent =
							currentSong.timeline[mappedDifficulty].moves[
								existingEventIndex
							];
					}
					if (existingEventIndex !== -1 && existingEvent) {
						removeMoveEvent(mappedDifficulty, existingEventIndex);
						removedEvents.push(existingEvent);
					}

					// Add the new event
					const newEvent = {
						...item.move,
						measure: newMeasure,
					};
					addMoveEvent(mappedDifficulty, newEvent);
					addedEvents.push(newEvent);
				}

				// Add to undo stack as bulk operation
				if (addedEvents.length > 0) {
					addUndoAction({
						type: 'move:bulkadd',
						data: {
							track: targetDifficulty,
							events: addedEvents,
						},
					});
				}
				if (removedEvents.length > 0) {
					addUndoAction({
						type: 'move:bulkremove',
						data: {
							track: targetDifficulty,
							events: removedEvents,
						},
					});
				}
			},
			[
				clipboardData,
				currentSong,
				addMoveEvent,
				removeMoveEvent,
				addUndoAction,
			]
		);

		// Delete selected moves
		const handleDelete = useCallback(() => {
			if (selectedCells.length === 0 || !currentSong) return;

			const toDelete = selectedCells
				.map((cell) => {
					const difficultyMap: Record<
						string,
						'supereasy' | 'easy' | 'medium' | 'expert'
					> = {
						supereasy: 'supereasy',
						easy: 'easy',
						medium: 'medium',
						expert: 'expert',
					};

					const mappedDifficulty = difficultyMap[cell.difficulty];

					let events;
					if (mappedDifficulty === 'supereasy') {
						events = currentSong.supereasy;
					} else {
						events = currentSong.timeline[mappedDifficulty].moves;
					}

					const eventIndex = events.findIndex(
						(event) => event.measure === cell.measure
					);
					if (eventIndex !== -1) {
						return {
							difficulty: mappedDifficulty,
							index: eventIndex,
							event: events[eventIndex],
						};
					}
					return null;
				})
				.filter(Boolean)
				.sort((a, b) => b!.index - a!.index);

			// Remove each event and add to undo stack
			for (const item of toDelete) {
				if (item) {
					removeMoveEvent(item.difficulty, item.index);
					addUndoAction({
						type: 'move:remove',
						data: {
							track: item.difficulty,
							event: item.event,
						},
					});
				}
			}

			setSelectedCells([]);
		}, [selectedCells, currentSong, removeMoveEvent, addUndoAction]);

		// Handle move event click
		const handleMoveEventClick = useCallback(
			(
				difficulty: 'supereasy' | 'easy' | 'medium' | 'expert',
				eventIndex: number,
				e: React.MouseEvent
			) => {
				// Don't propagate to cell click handler
				e.stopPropagation();

				// Map our difficulty to the song store's difficulty format
				const difficultyMap: Record<
					string,
					'supereasy' | 'easy' | 'medium' | 'expert'
				> = {
					supereasy: 'supereasy',
					easy: 'easy',
					medium: 'medium',
					expert: 'expert',
				};

				const mappedDifficulty = difficultyMap[difficulty];

				// If it's a direct delete action, remove the event
				if (
					e.target instanceof HTMLElement &&
					e.target.closest('[data-delete-button]')
				) {
					removeMoveEvent(mappedDifficulty, eventIndex);
					return;
				}

				// Otherwise, select this cell for potential operations
				let event;
				if (mappedDifficulty === 'supereasy') {
					event = currentSong.supereasy[eventIndex];
				} else {
					event =
						currentSong.timeline[mappedDifficulty].moves[
							eventIndex
						];
				}

				if (event) {
					handleCellClick(difficulty, event.measure, e);
				}
			},
			[currentSong, removeMoveEvent, handleCellClick]
		);

		// Move image and data cache logic using Electron APIs
		const useMoveImageAndDataCache = (moveLibPath: string) => {
			const imageCache = useRef<{ [key: string]: string }>({});
			const dataCache = useRef<{ [key: string]: any }>({});
			const createdUrls = useRef<string[]>([]);

			const getMoveImageAndData = useCallback(
				async (moveKey: string) => {
					if (
						imageCache.current[moveKey] &&
						dataCache.current[moveKey]
					) {
						return {
							image: imageCache.current[moveKey],
							data: dataCache.current[moveKey],
						};
					}

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
						dataCache.current[moveKey] = jsonData;
					}

					// Load move.png
					const imagePath = `${movePath}/move.png`;
					const imageExists = await window.electronAPI.pathExists(
						imagePath
					);
					if (imageExists) {
						const imageBuffer =
							await window.electronAPI.readFileBuffer(imagePath);
						const blob = new Blob([imageBuffer], {
							type: 'image/png',
						});
						const url = URL.createObjectURL(blob);
						imageCache.current[moveKey] = url;
						createdUrls.current.push(url);
					}

					return {
						image: imageCache.current[moveKey] || null,
						data: dataCache.current[moveKey] || null,
					};
				},
				[moveLibPath]
			);

			// Cleanup created URLs on unmount
			useEffect(() => {
				return () => {
					createdUrls.current.forEach((url) =>
						URL.revokeObjectURL(url)
					);
				};
			}, []);

			return getMoveImageAndData;
		};

		const moveLibPath = useSongStore((state) => state.currentSong.move_lib);
		const getMoveImageAndData = useMoveImageAndDataCache(moveLibPath);

		const [moveImages, setMoveImages] = useState<{
			[key: string]: string | null;
		}>({});
		const [moveData, setMoveData] = useState<{ [key: string]: any }>({});

		// Preload images and data for visible events
		useEffect(() => {
			const preload = async () => {
				const images: { [key: string]: string | null } = {};
				const data: { [key: string]: any } = {};
				for (const track of [
					'supereasy',
					'easy',
					'medium',
					'expert',
				] as const) {
					for (const measure of timelineData.measures) {
						const events = getMoveEventsForMeasure(
							track,
							measure.number
						);
						for (const event of events) {
							const moveKey = `${event.move_origin}/${event.move_song}/${event.move}`;
							if (!(moveKey in images)) {
								const result = await getMoveImageAndData(
									moveKey
								);
								images[moveKey] = result.image;
								data[moveKey] = result.data;
							}
						}
					}
				}
				setMoveImages(images);
				setMoveData(data);
			};
			if (moveLibPath) preload();
		}, [
			timelineData,
			getMoveEventsForMeasure,
			moveLibPath,
			getMoveImageAndData,
		]);

		// Debug render only in development
		if (process.env.NODE_ENV === 'development') {
			console.log('Rerendering ChoreographyTimeline');
		}

		return (
			<div className="flex h-full">
				<div className="flex-1 overflow-hidden flex flex-col">
					<div
						ref={timelineScrollRef}
						className="overflow-auto relative flex-1"
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
							<div
								className="flex-shrink-0 border-r bg-background flex items-center px-3"
								style={{ width: trackHeaderWidth }}
							>
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
										width: `${
											measure.beatCount * pixelsPerBeat
										}px`,
									}}
									onClick={() =>
										handleSeek(measure.startTime)
									}
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
						{(
							['supereasy', 'easy', 'medium', 'expert'] as const
						).map((track) => (
							<div key={track} className="h-[90px] border-b flex">
								{/* Track Label */}
								<div
									className="flex-shrink-0 bg-muted/30 flex items-center px-3 border-r"
									style={{ width: trackHeaderWidth }}
								>
									<span className="text-sm font-medium capitalize">
										{track}
									</span>
								</div>

								{/* Track Cells */}
								{timelineData.measures.map((measure) => {
									const events = getMoveEventsForMeasure(
										track,
										measure.number
									);
									const cellKey = `${track}-${measure.number}`;
									const isHighlighted =
										dragOverCell === cellKey;
									const isSelected = selectedCells.some(
										(cell) =>
											cell.difficulty === track &&
											cell.measure === measure.number
									);

									return (
										<ContextMenu key={cellKey}>
											<ContextMenuTrigger>
												<div
													className={`flex flex-shrink-0 border-r transition-colors cursor-pointer relative items-center justify-center group min-h-full ${
														isSelected
															? 'bg-primary/30 border-primary'
															: isHighlighted
															? 'bg-primary/20 border-primary'
															: 'hover:bg-muted/20'
													}`}
													style={{
														width: `${
															measure.beatCount *
															pixelsPerBeat
														}px`,
													}}
													onClick={(e) =>
														handleCellClick(
															track,
															measure.number,
															e
														)
													}
													onDragOver={(e) =>
														handleCellDragOver(
															e,
															cellKey
														)
													}
													onDragLeave={
														handleDragLeave
													}
													onDrop={(e) =>
														handleDrop(
															e,
															track,
															measure
														)
													}
												>
													{/* Events */}
													{events.length > 0 ? (
														<div className="w-full h-full p-1 flex flex-col gap-1 overflow-hidden">
															{events
																.slice(0, 1)
																.map(
																	(
																		event,
																		idx
																	) => {
																		const moveEvent =
																			event as any;
																		const moveKey = `${moveEvent.move_origin}/${moveEvent.move_song}/${moveEvent.move}`;

																		return (
																			<div
																				key={`${moveEvent.originalIndex}-${idx}`}
																				className={`flex-1 border rounded p-1 flex flex-col items-center justify-center transition-colors min-h-0 ${
																					isSelected
																						? 'bg-primary/40 border-primary'
																						: 'bg-primary/20 border-primary/40 hover:bg-primary/30'
																				}`}
																				onClick={(
																					e
																				) =>
																					handleMoveEventClick(
																						track,
																						moveEvent.originalIndex,
																						e
																					)
																				}
																			>
																				<div className="w-16 h-8 bg-muted rounded mb-1 flex items-center justify-center flex-shrink-0 overflow-hidden">
																					{(() => {
																						const moveKey = `${moveEvent.move_origin}/${moveEvent.move_song}/${moveEvent.move}`;
																						const imgSrc =
																							moveImages[
																								moveKey
																							];
																						if (
																							imgSrc
																						) {
																							return (
																								<img
																									src={
																										imgSrc
																									}
																									alt={
																										moveEvent.move
																									}
																									className="object-contain w-full h-full"
																									draggable={
																										false
																									}
																								/>
																							);
																						}
																						return (
																							<PersonStanding className="h-4 w-4 text-muted-foreground" />
																						);
																					})()}
																				</div>
																				<div className="text-xs font-medium truncate w-full leading-tight">
																					{
																						moveEvent.move
																					}
																				</div>
																				<div className="text-xs text-muted-foreground truncate w-full leading-tight">
																					{
																						moveEvent.clip
																					}
																				</div>

																				{/* Delete button */}
																				<button
																					data-delete-button
																					className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 p-1 rounded-full"
																					onClick={(
																						e
																					) => {
																						e.stopPropagation();
																						removeMoveEvent(
																							track,
																							moveEvent.originalIndex
																						);
																					}}
																				>
																					<X className="h-3 w-3 text-destructive" />
																				</button>
																			</div>
																		);
																	}
																)}
														</div>
													) : (
														/* Empty drop zone */
														<div className="w-full h-full flex items-center justify-center">
															<div
																className={`w-3 h-3 rounded-full ${
																	isSelected
																		? 'bg-primary/50'
																		: 'bg-muted/30 group-hover:bg-primary/50'
																} transition-colors`}
															/>
														</div>
													)}
												</div>
											</ContextMenuTrigger>

											<ContextMenuContent>
												<ContextMenuItem
													onClick={() => handleCopy()}
													disabled={
														selectedCells.length ===
														0
													}
												>
													<Copy className="mr-2 h-4 w-4" />
													Copy
												</ContextMenuItem>
												<ContextMenuItem
													onClick={() =>
														handlePaste(
															track,
															measure.number
														)
													}
													disabled={
														clipboardData.length ===
														0
													}
												>
													<Clipboard className="mr-2 h-4 w-4" />
													Paste
												</ContextMenuItem>
												<ContextMenuItem
													onClick={() =>
														handleDelete()
													}
													disabled={
														selectedCells.length ===
														0
													}
													className="text-destructive"
												>
													<Trash className="mr-2 h-4 w-4" />
													Delete
												</ContextMenuItem>
												<ContextMenuItem
													onClick={() => {
														/* Cut operation = copy + delete */
														handleCopy();
														handleDelete();
													}}
													disabled={
														selectedCells.length ===
														0
													}
												>
													<ScissorsLineDashed className="mr-2 h-4 w-4" />
													Cut
												</ContextMenuItem>
											</ContextMenuContent>
										</ContextMenu>
									);
								})}
							</div>
						))}
					</div>
				</div>
			</div>
		);
	},
	(prevProps, nextProps) => {
		// Custom comparison function to prevent unnecessary re-renders
		// Only re-render when these specific props change
		return (
			prevProps.currentTime === nextProps.currentTime &&
			prevProps.isPlaying === nextProps.isPlaying &&
			prevProps.autoScroll === nextProps.autoScroll &&
			// Deep comparison of timelineData would be expensive, so compare just measures length
			prevProps.timelineData.measures.length ===
				nextProps.timelineData.measures.length
		);
	}
);
