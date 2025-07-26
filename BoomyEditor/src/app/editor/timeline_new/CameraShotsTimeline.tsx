import React, { useState, useCallback, useRef } from 'react';
import {
	Copy,
	Clipboard,
	Trash,
	X,
	ScissorsLineDashed,
	Camera,
} from 'lucide-react';
import { useSongStore } from '../../store/songStore';
import { TimelineData, Measure } from './NewTimelineRoot';
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from '@/components/ui/context-menu';

export interface CameraShotsTimelineProps {
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
	addUndoAction: (action: any) => void;
}

// Type for selected cells
interface SelectedCell {
	difficulty: 'easy' | 'medium' | 'expert';
	beat: number;
}

// Use React.memo to prevent unnecessary re-renders
export const CameraShotsTimeline = React.memo(
	function CameraShotsTimeline({
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
	}: CameraShotsTimelineProps) {
		// Use selective state from the store to prevent re-renders when unrelated state changes
		const currentSong = useSongStore((state) => state.currentSong);
		const addCameraEvent = useSongStore((state) => state.addCameraEvent);
		const removeCameraEvent = useSongStore(
			(state) => state.removeCameraEvent
		);

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

		// Get camera events for a specific beat and difficulty
		const getCameraEventsForBeat = useCallback(
			(difficulty: 'easy' | 'medium' | 'expert', beat: number) => {
				if (!currentSong) return [];

				const events = currentSong.timeline[difficulty].cameras;

				// Filter events that match this beat
				return events
					.map((event, index) => ({ ...event, originalIndex: index }))
					.filter((event) => event.beat === beat);
			},
			[currentSong]
		);

		if (!timelineData) {
			return <div>Loading timeline...</div>;
		}

		const getBeatsForMeasure = useCallback((measure: Measure) => {
			const beats = [];
			for (let i = 0; i < measure.beatCount; i++) {
				beats.push(measure.startBeat + i);
			}
			return beats;
		}, []);

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
				beat: number
			) => {
				e.preventDefault();
				setDragOverCell(null);

				try {
					const dragData = JSON.parse(
						e.dataTransfer.getData('application/json')
					);

					if (dragData.type === 'camera-position') {
						const { position } = dragData;

						// Remove any existing camera at this beat for this difficulty
						if (currentSong) {
							const events =
								currentSong.timeline[difficulty].cameras;
							const eventIndex = events.findIndex(
								(event) => event.beat === beat
							);
							if (eventIndex !== -1) {
								removeCameraEvent(difficulty, eventIndex);
								addUndoAction({
									type: 'camera:remove',
									data: {
										track: difficulty,
										index: eventIndex,
										event: events[eventIndex],
									},
								});
							}
						}

						// Create new camera event
						const cameraEvent = {
							beat,
							camera: position,
						};

						addCameraEvent(difficulty, cameraEvent);
						addUndoAction({
							type: 'camera:add',
							data: {
								track: difficulty,
								event: cameraEvent,
							},
						});
					}
				} catch (err) {
					console.error('Failed to handle drop:', err);
				}
			},
			[addCameraEvent, removeCameraEvent, currentSong]
		);

		// Handle cell selection
		const handleCellClick = useCallback(
			(
				difficulty: 'easy' | 'medium' | 'expert',
				beat: number,
				e: React.MouseEvent
			) => {
				e.stopPropagation();

				const cell = { difficulty, beat };

				// If shift key is pressed, extend selection from last selected cell
				if (isShiftKeyPressed.current && selectedCells.length > 0) {
					const lastCell = selectedCells[selectedCells.length - 1];
					const startBeat = Math.min(lastCell.beat, beat);
					const endBeat = Math.max(lastCell.beat, beat);

					// If the tracks are the same, select all beats between
					if (lastCell.difficulty === difficulty) {
						const newSelection = [];
						for (let b = startBeat; b <= endBeat; b++) {
							newSelection.push({ difficulty, beat: b });
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
						(c) => c.difficulty === difficulty && c.beat === beat
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

		// Copy selected camera shots to clipboard (no difficulty)
		const handleCopy = useCallback(() => {
			if (selectedCells.length === 0 || !currentSong) return;

			const copied = [];
			const sortedCells = [...selectedCells].sort(
				(a, b) => a.beat - b.beat
			);
			const firstBeat = sortedCells[0].beat;

			for (const cell of sortedCells) {
				const events = currentSong.timeline[cell.difficulty].cameras;
				const cameraEvent = events.find(
					(event) => event.beat === cell.beat
				);
				if (cameraEvent) {
					copied.push({
						offset: cell.beat - firstBeat,
						event: { ...cameraEvent },
					});
				}
			}

			const clipboardPayload = {
				boomy: 'copypaste1',
				type: 'camera',
				data: copied,
			};

			try {
				navigator.clipboard.writeText(JSON.stringify(clipboardPayload));
				setClipboardData(copied); // fallback for legacy paste
			} catch (err) {
				console.error('Failed to write to clipboard:', err);
			}
		}, [selectedCells, currentSong]);

		// Paste camera shots from clipboard at target track/beat (no difficulty in data)
		const handlePaste = useCallback(
			async (
				targetDifficulty: 'easy' | 'medium' | 'expert',
				targetBeat: number
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
						type: 'camera',
						data: clipboardData,
					};
				}

				if (
					!clipboardPayload ||
					clipboardPayload.boomy !== 'copypaste1' ||
					clipboardPayload.type !== 'camera' ||
					!Array.isArray(clipboardPayload.data)
				) {
					return;
				}

				const clipboardEvents = [];
				const clipboardRemoveEvents: any[] = [];
				for (const item of clipboardPayload.data) {
					const newBeat = targetBeat + (item.offset ?? 0);

					// Remove any existing camera at the target beat
					const existingEventIndex = currentSong.timeline[
						targetDifficulty
					].cameras.findIndex((event) => event.beat === newBeat);

					if (existingEventIndex !== -1) {
						removeCameraEvent(targetDifficulty, existingEventIndex);
					}

					// Add the new camera event
					const newEvent = {
						...item.event,
						beat: newBeat,
					};

					addCameraEvent(targetDifficulty, newEvent);
					clipboardEvents.push(newEvent);
				}

				addUndoAction({
					type: 'camera:bulkremove',
					data: {
						track: targetDifficulty,
						events: clipboardRemoveEvents,
					},
				});
				addUndoAction({
					type: 'camera:bulkadd',
					data: {
						track: targetDifficulty,
						event: clipboardEvents,
					},
				});
			},
			[clipboardData, currentSong, addCameraEvent, removeCameraEvent]
		);

		// Delete selected camera shots
		const handleDelete = useCallback(() => {
			if (selectedCells.length === 0 || !currentSong) return;

			// Sort in reverse order by index to avoid index shifting issues
			const toDelete = selectedCells
				.map((cell) => {
					const events =
						currentSong.timeline[cell.difficulty].cameras;

					const eventIndex = events.findIndex(
						(event) => event.beat === cell.beat
					);
					if (eventIndex !== -1) {
						return {
							difficulty: cell.difficulty,
							index: eventIndex,
						};
					}
					return null;
				})
				.filter(Boolean)
				.sort((a, b) => b!.index - a!.index);

			// Remove each event
			for (const item of toDelete) {
				if (item) {
					removeCameraEvent(item.difficulty, item.index);
				}
			}

			// Clear selection after deleting
			setSelectedCells([]);
		}, [selectedCells, currentSong, removeCameraEvent]);

		// Handle move event click
		const handleCameraEventClick = useCallback(
			(
				difficulty: 'easy' | 'medium' | 'expert',
				eventIndex: number,
				e: React.MouseEvent
			) => {
				// Don't propagate to cell click handler
				e.stopPropagation();

				// If it's a direct delete action, remove the event
				if (
					e.target instanceof HTMLElement &&
					e.target.closest('[data-delete-button]')
				) {
					removeCameraEvent(difficulty, eventIndex);
					return;
				}

				// Otherwise, select this cell for potential operations
				const event =
					currentSong?.timeline[difficulty].cameras[eventIndex];
				if (event) {
					const cell = { difficulty, beat: event.beat };
					handleCellClick(difficulty, event.beat, e);
				}
			},
			[currentSong, removeCameraEvent, handleCellClick]
		);

		// Debug render only in development
		if (process.env.NODE_ENV === 'development') {
			console.log('Rerendering CameraShotsTimeline');
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

						{/* Timeline Header */}
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

							{/* Measure Headers with Beat Markers */}
							{timelineData.measures.map((measure) => (
								<div
									key={measure.number}
									className="flex-shrink-0 border-r relative"
									style={{
										width: `${
											measure.beatCount * pixelsPerBeat
										}px`,
									}}
								>
									{/* Measure label */}
									<div
										className="h-8 px-2 flex items-center justify-center bg-muted/50 cursor-pointer hover:bg-muted/70"
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

									{/* Beat markers (overlay) */}
									<div className="absolute left-0 right-0 top-8 h-1 flex">
										{Array.from({
											length: measure.beatCount,
										}).map((_, idx) => (
											<div
												key={idx}
												style={{
													width: `${pixelsPerBeat}px`,
												}}
												className="border-r border-muted-foreground/20 last:border-r-0"
											/>
										))}
									</div>
								</div>
							))}
						</div>

						{/* Track Rows with Labels */}
						{(['easy', 'medium', 'expert'] as const).map(
							(track) => (
								<div
									key={track}
									className="h-[90px] border-b flex"
								>
									{/* Track Label */}
									<div
										className="flex-shrink-0 border-r bg-muted/30 flex items-center px-3"
										style={{ width: trackHeaderWidth }}
									>
										<span className="text-sm font-medium capitalize">
											{track}
										</span>
									</div>

									{/* Track Cells */}
									{timelineData.measures.map((measure) => {
										const beatsForMeasure =
											getBeatsForMeasure(measure);

										return (
											<div
												key={measure.number}
												className="flex-shrink-0 border-r relative"
												style={{
													width: `${
														measure.beatCount *
														pixelsPerBeat
													}px`,
												}}
											>
												{/* Beat cells */}
												<div className="flex h-full">
													{beatsForMeasure.map(
														(beat, beatIdx) => {
															const events =
																getCameraEventsForBeat(
																	track,
																	beat
																);
															const cellKey = `${track}-${beat}`;
															const isHighlighted =
																dragOverCell ===
																cellKey;
															const isSelected =
																selectedCells.some(
																	(cell) =>
																		cell.difficulty ===
																			track &&
																		cell.beat ===
																			beat
																);

															return (
																<ContextMenu
																	key={`${measure.number}-${beatIdx}`}
																>
																	<ContextMenuTrigger>
																		<div
																			className={`flex justify-center items-center border-r transition-colors cursor-pointer relative group min-h-full ${
																				isSelected
																					? 'bg-blue-500/30 border-blue-500'
																					: isHighlighted
																					? 'bg-blue-500/20 border-blue-500'
																					: 'hover:bg-muted/20'
																			}`}
																			style={{
																				width: `${pixelsPerBeat}px`,
																			}}
																			onClick={(
																				e
																			) =>
																				handleCellClick(
																					track,
																					beat,
																					e
																				)
																			}
																			onDragOver={(
																				e
																			) =>
																				handleCellDragOver(
																					e,
																					cellKey
																				)
																			}
																			onDragLeave={
																				handleDragLeave
																			}
																			onDrop={(
																				e
																			) =>
																				handleDrop(
																					e,
																					track,
																					beat
																				)
																			}
																		>
																			{/* Events */}
																			{events.length >
																			0 ? (
																				<div className="w-full h-full p-1 flex flex-col gap-1 overflow-hidden">
																					{events
																						.slice(
																							0,
																							1
																						)
																						.map(
																							(
																								event,
																								idx
																							) => {
																								const cameraEvent =
																									event as any;

																								return (
																									<div
																										key={`${cameraEvent.originalIndex}-${idx}`}
																										className={`flex-1 border rounded p-1 flex flex-col items-center justify-center transition-colors min-h-0 ${
																											isSelected
																												? 'bg-blue-500/40 border-blue-500'
																												: 'bg-blue-500/20 border-blue-500/40 hover:bg-blue-500/30'
																										}`}
																										onClick={(
																											e
																										) =>
																											handleCameraEventClick(
																												track,
																												cameraEvent.originalIndex,
																												e
																											)
																										}
																									>
																										<div className="w-6 h-6 bg-blue-500/10 rounded mb-1 flex items-center justify-center flex-shrink-0">
																											<Camera className="h-3 w-3 text-blue-500" />
																										</div>
																										<div className="text-xs font-medium truncate w-full leading-tight text-center">
																											{
																												cameraEvent.camera
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
																												removeCameraEvent(
																													track,
																													cameraEvent.originalIndex
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
																						className={`w-2 h-2 rounded-full ${
																							isSelected
																								? 'bg-blue-500/50'
																								: 'bg-muted/30 group-hover:bg-blue-500/50'
																						} transition-colors`}
																					/>
																				</div>
																			)}
																		</div>
																	</ContextMenuTrigger>

																	<ContextMenuContent>
																		<ContextMenuItem
																			onClick={() =>
																				handleCopy()
																			}
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
																					beat
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
														}
													)}
												</div>
											</div>
										);
									})}
								</div>
							)
						)}

						{/* Timeline Info Footer */}
						<div className="flex-shrink-0 p-2 border-t bg-muted/30 text-xs text-muted-foreground">
							<div className="flex items-center gap-4">
								<span>
									Total: {timelineData.totalBeats} beats
								</span>
							</div>
						</div>
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
			prevProps.timelineData.measures.length ===
				nextProps.timelineData.measures.length
		);
	}
);
