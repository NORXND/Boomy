import React, { useState, useCallback } from 'react';
import {
	Clock,
	Flag,
	Music,
	Play,
	X,
	Plus,
	Settings,
	Edit,
	ArrowRight,
} from 'lucide-react';
import { useSongStore } from '../../store/songStore';
import { TimelineData, Measure } from './NewTimelineRoot';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogDescription,
	DialogFooter,
} from '@/components/ui/dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Import the exported functions from songStore
import { TempoChange } from '@/types/song';

export interface EventsTimelineProps {
	timelineData: TimelineData;
	currentTime: number;
	isPlaying: boolean;
	autoScroll: boolean;
	calculateCursorPosition: (time?: number) => number;
	handleSeek: (time: number) => void;
	timeToBeat: (time: number) => number;
	timelineScrollRef: React.RefObject<HTMLDivElement>;
	tempoChanges: TempoChange[];
	pixelsPerBeat: number;
	trackHeaderWidth: number;
}

// Event types
type EventType =
	| 'music_start'
	| 'preview'
	| 'freestyle_start'
	| 'freestyle_end'
	| 'music_end'
	| 'end';

let renderCount = 0;
// Use React.memo to prevent unnecessary re-renders
export const EventsTimeline = React.memo(
	function EventsTimeline({
		timelineData,
		currentTime,
		isPlaying,
		autoScroll,
		calculateCursorPosition,
		handleSeek,
		timelineScrollRef,
		tempoChanges,
		pixelsPerBeat,
		trackHeaderWidth,
	}: EventsTimelineProps) {
		renderCount++;
		// Debug: log every render and key props, but only in development
		if (process.env.NODE_ENV === 'development') {
			console.debug('[EventsTimeline] Render', renderCount, {
				currentTime,
				isPlaying,
				autoScroll,
				tempoChanges: tempoChanges.length,
				timelineDataHash: timelineData
					? JSON.stringify(timelineData).length
					: 0,
			});
		}
		// Use selective state from the store to prevent re-renders when unrelated state changes
		const {
			addEvent,
			removeEvent,
			currentSong,
			addTempoChange,
			removeTempoChange,
			updateTempoChange,
		} = useSongStore();

		const [dragOverCell, setDragOverCell] = useState<string | null>(null);
		const [showAddEventDialog, setShowAddEventDialog] = useState(false);
		const [selectedEventType, setSelectedEventType] =
			useState<EventType>('music_start');
		const [selectedBeat, setSelectedBeat] = useState<number | null>(null);
		const [openBpmDialog, setOpenBpmDialog] = useState(false);
		const [bpmDialogMeasure, setBpmDialogMeasure] =
			useState<Measure | null>(null);
		const [bpmDialogValue, setBpmDialogValue] = useState<number>(120);

		// Get all events for a specific beat
		const getEventsForBeat = useCallback(
			(beat: number) => {
				if (!currentSong) return [];

				return (currentSong.events || [])
					.map((event, index) => ({ ...event, originalIndex: index }))
					.filter((event) => event.beat === beat);
			},
			[currentSong]
		);

		// Handle click to add event (opens dialog)
		const handleAddEventClick = useCallback((beat: number) => {
			setSelectedBeat(beat);
			setShowAddEventDialog(true);
		}, []);

		// Handle adding a new event - use addEvent function from songStore
		const handleAddEvent = useCallback(() => {
			if (selectedBeat === null || !selectedEventType || !currentSong)
				return;

			// Remove any existing event at this beat
			const events = currentSong.events || [];
			const existingIdx = events.findIndex(
				(e) => e.beat === selectedBeat
			);
			if (existingIdx !== -1) {
				removeEvent(existingIdx);
			}

			// Add the new event
			addEvent({
				type: selectedEventType,
				beat: selectedBeat,
			});

			setShowAddEventDialog(false);
		}, [selectedBeat, selectedEventType, currentSong]);

		// Handle click to delete event - use removeEvent function from songStore
		const handleEventClick = useCallback(
			(eventIndex: number, e: React.MouseEvent) => {
				e.stopPropagation();
				removeEvent(eventIndex);
			},
			[]
		);

		// Get the icon for an event type
		const getEventIcon = (type: EventType) => {
			switch (type) {
				case 'music_start':
					return <Play className="h-4 w-4 text-green-500" />;
				case 'preview':
					return <Clock className="h-4 w-4 text-yellow-500" />;
				case 'freestyle_start':
					return <Music className="h-4 w-4 text-blue-500" />;
				case 'freestyle_end':
					return <Music className="h-4 w-4 text-blue-500" />;
				case 'music_end':
					return <Flag className="h-4 w-4 text-red-500" />;
				case 'end':
					return <Flag className="h-4 w-4 text-red-500" />;
				default:
					return <Settings className="h-4 w-4" />;
			}
		};

		// Calculate last visible beat based on timelineData
		const lastBeat = timelineData.measures.reduce(
			(total, measure) => total + measure.beatCount,
			0
		);

		// Check if an event is a system event (end)
		const isSystemEvent = (type: EventType) => type === 'end';

		// Get all beats for a specific measure
		const getBeatsForMeasure = (measure: Measure) => {
			const beats = [];
			for (let i = 0; i < measure.beatCount; i++) {
				beats.push(measure.startBeat + i);
			}
			return beats;
		};

		// Color and label for event types
		const eventStyles: Record<
			EventType,
			{ bg: string; border: string; text: string; label: string }
		> = {
			music_start: {
				bg: 'bg-green-500/20',
				border: 'border-green-500',
				text: 'text-green-500',
				label: 'Music Start',
			},
			preview: {
				bg: 'bg-yellow-500/20',
				border: 'border-yellow-500',
				text: 'text-yellow-500',
				label: 'Preview',
			},
			freestyle_start: {
				bg: 'bg-blue-500/20',
				border: 'border-blue-500',
				text: 'text-blue-500',
				label: 'Freestyle Start',
			},
			freestyle_end: {
				bg: 'bg-blue-500/20',
				border: 'border-blue-500',
				text: 'text-blue-500',
				label: 'Freestyle End',
			},
			music_end: {
				bg: 'bg-red-500/20',
				border: 'border-red-500',
				text: 'text-red-500',
				label: 'Music End',
			},
			end: {
				bg: 'bg-purple-500/20',
				border: 'border-purple-500',
				text: 'text-purple-500',
				label: 'End',
			},
		};

		// Open the BPM dialog for a measure
		const openBpmChangeDialog = useCallback((measure: Measure) => {
			setBpmDialogMeasure(measure);
			setBpmDialogValue(measure.bpm);
			setOpenBpmDialog(true);
		}, []);

		// Save the BPM change
		const handleBpmDialogSave = useCallback(() => {
			if (bpmDialogMeasure) {
				// Find if a tempo change already exists at this measure's start time
				const existingIndex = tempoChanges.findIndex(
					(tc) => tc.tick === bpmDialogMeasure.startTime
				);

				if (existingIndex !== -1) {
					// Update existing tempo change
					updateTempoChange(existingIndex, { bpm: bpmDialogValue });
				} else {
					// Add a new tempo change
					addTempoChange({
						bpm: bpmDialogValue,
						tick: bpmDialogMeasure.startTime, // Assuming tick is time
					});
				}
			}
			setOpenBpmDialog(false);
		}, [
			bpmDialogMeasure,
			bpmDialogValue,
			tempoChanges,
			addTempoChange,
			updateTempoChange,
		]);

		// Debug render only in development
		if (process.env.NODE_ENV === 'development') {
			console.log('Rerendering EventsTimeline');
		}

		// Calculate total width for the scrollable container
		const totalWidth =
			trackHeaderWidth + timelineData.totalBeats * pixelsPerBeat;

		return (
			<div className="flex h-full flex-col">
				{/* Events info panel */}
				<div className="p-4 border-b">
					<h3 className="text-sm font-medium mb-2">Song Events</h3>
					<div className="flex flex-wrap gap-2 text-xs">
						{Object.entries(eventStyles).map(([type, style]) => (
							<div
								key={type}
								className={`px-2 py-1 rounded-full ${style.bg} ${style.border} ${style.text} flex items-center gap-1`}
							>
								{getEventIcon(type as EventType)}
								<span>{style.label}</span>
							</div>
						))}
					</div>
					<p className="text-xs text-muted-foreground mt-2">
						Click on a beat to add an event. The 'end' event is
						automatically placed at the last beat.
					</p>
				</div>

				{/* Timeline */}
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
								Events
							</span>
						</div>
						{/* Measure Headers */}
						{timelineData.measures.map((measure) => {
							// Find if a tempo change exists at this measure's start time
							const tempoChangeIdx = tempoChanges.findIndex(
								(tc) => tc.tick === measure.startTime
							);
							const hasTempoChange = tempoChangeIdx !== -1;

							return (
								<div
									key={measure.number}
									className="flex-shrink-0 border-r relative"
									style={{
										width: `${
											measure.beatCount * pixelsPerBeat
										}px`,
									}}
								>
									{/* Measure label and BPM change */}
									<div className="h-8 px-2 flex items-center justify-center bg-muted/50 cursor-pointer hover:bg-muted/70 gap-2">
										<div
											className="text-xs font-medium text-center"
											onClick={() =>
												handleSeek(measure.startTime)
											}
											title={`Jump to measure ${measure.number}`}
										>
											<div>{measure.number}</div>
											<div className="text-muted-foreground">
												{measure.bpm.toFixed(0)}
											</div>
										</div>
										<Button
											variant="ghost"
											size="icon"
											title="Change BPM for this measure"
											onClick={(e) => {
												e.stopPropagation();
												openBpmChangeDialog(measure);
											}}
										>
											<Edit className="w-3 h-3" />
										</Button>
										{hasTempoChange && (
											<Button
												variant="ghost"
												size="icon"
												title="Remove BPM change"
												className="hover:bg-destructive/20"
												onClick={(e) => {
													e.stopPropagation();
													removeTempoChange(
														tempoChangeIdx
													);
												}}
											>
												<X className="w-3 h-3 text-destructive" />
											</Button>
										)}
									</div>

									{/* Beat markers */}
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
							);
						})}
					</div>

					{/* Events Track */}
					<div className="h-[90px] border-b flex">
						{/* Track Label */}
						<div
							className="flex-shrink-0 border-r bg-muted/30 flex items-center px-3"
							style={{ width: trackHeaderWidth }}
						>
							<span className="text-sm font-medium">Events</span>
						</div>

						{/* Track Cells */}
						{timelineData.measures.map((measure) => {
							const beatsForMeasure = getBeatsForMeasure(measure);
							return (
								<div
									key={measure.number}
									className="flex-shrink-0 border-r relative"
									style={{
										width: `${
											measure.beatCount * pixelsPerBeat
										}px`,
									}}
								>
									{/* Beat cells */}
									<div className="flex h-full">
										{beatsForMeasure.map(
											(beat, beatIdx) => {
												const events =
													getEventsForBeat(beat);
												const cellKey = `events-${beat}`;
												const isHighlighted =
													dragOverCell === cellKey;
												const isLastBeat =
													beat === lastBeat - 1;

												return (
													<div
														key={`${measure.number}-${beatIdx}`}
														className={`border-r transition-colors cursor-pointer relative group min-h-full ${
															isHighlighted
																? 'bg-primary/20 border-primary'
																: isLastBeat
																? 'bg-purple-500/10'
																: 'hover:bg-muted/20'
														}`}
														style={{
															width: `${pixelsPerBeat}px`,
														}}
														onClick={() =>
															handleAddEventClick(
																beat
															)
														}
													>
														{/* Only one event per beat */}
														{events.length > 0 ? (
															<div className="w-full h-full p-1 flex flex-col gap-1 overflow-hidden">
																{events
																	.slice(0, 1)
																	.map(
																		(
																			event,
																			idx
																		) => {
																			const eventType =
																				event.type as EventType;
																			const style =
																				eventStyles[
																					eventType
																				] ?? {
																					bg: 'bg-gray-200',
																					border: 'border-gray-400',
																					text: 'text-gray-700',
																					label: eventType,
																				};

																			return (
																				<div
																					key={`${event.originalIndex}-${idx}`}
																					className={`flex-1 border rounded p-1 flex flex-col items-center justify-center transition-colors ${style.bg} ${style.border}`}
																					onClick={(
																						e
																					) =>
																						e.stopPropagation()
																					}
																				>
																					<div
																						className={`rounded-full p-1 ${style.bg} flex items-center justify-center`}
																					>
																						{getEventIcon(
																							eventType
																						)}
																					</div>
																					<div
																						className={`text-xs font-medium ${style.text} text-center mt-1`}
																					>
																						{
																							style.label
																						}
																					</div>

																					{/* Delete button (only for non-system events) */}
																					{!isSystemEvent(
																						eventType
																					) && (
																						<button
																							className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 p-1 rounded-full"
																							onClick={(
																								e
																							) => {
																								if (
																									event.originalIndex !==
																									undefined
																								) {
																									handleEventClick(
																										event.originalIndex,
																										e
																									);
																								}
																							}}
																						>
																							<X className="h-3 w-3 text-destructive" />
																						</button>
																					)}
																				</div>
																			);
																		}
																	)}
															</div>
														) : (
															/* Empty cell - show plus button on hover */
															<div className="w-full h-full flex items-center justify-center">
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-6 w-6 rounded-full p-0 opacity-100" // Always visible
																	onClick={(
																		e
																	) => {
																		e.stopPropagation();
																		handleAddEventClick(
																			beat
																		);
																	}}
																>
																	<Plus className="h-3 w-3" />
																</Button>
															</div>
														)}

														{/* Beat number tooltip */}
														<div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
															Beat {beat + 1}
														</div>
													</div>
												);
											}
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* Add Event Dialog */}
				<Dialog
					open={showAddEventDialog}
					onOpenChange={setShowAddEventDialog}
				>
					<DialogContent className="sm:max-w-[425px]">
						<DialogHeader>
							<DialogTitle>
								Add Event at Beat{' '}
								{selectedBeat !== null ? selectedBeat + 1 : ''}
							</DialogTitle>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<label className="text-sm font-medium">
									Event Type
								</label>
								<Select
									value={selectedEventType}
									onValueChange={(value) =>
										setSelectedEventType(value as EventType)
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select event type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="music_start">
											Music Start
										</SelectItem>
										<SelectItem value="preview">
											Preview
										</SelectItem>
										<SelectItem value="freestyle_start">
											Freestyle Start
										</SelectItem>
										<SelectItem value="freestyle_end">
											Freestyle End
										</SelectItem>
										<SelectItem value="music_end">
											Music End
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								onClick={() => setShowAddEventDialog(false)}
							>
								Cancel
							</Button>
							<Button onClick={handleAddEvent}>Add Event</Button>
						</div>
					</DialogContent>
				</Dialog>

				{/* BPM Change Dialog */}
				<Dialog open={openBpmDialog} onOpenChange={setOpenBpmDialog}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								Change BPM for Measure{' '}
								{bpmDialogMeasure?.number ?? ''}
							</DialogTitle>
						</DialogHeader>
						<div className="py-4">
							<label className="text-sm font-medium mb-2 block">
								BPM (Beats Per Minute)
							</label>
							<Input
								type="number"
								min="20"
								max="300"
								value={bpmDialogValue}
								onChange={(e) =>
									setBpmDialogValue(Number(e.target.value))
								}
							/>
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setOpenBpmDialog(false)}
							>
								Cancel
							</Button>
							<Button onClick={handleBpmDialogSave}>Save</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
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
			// Compare tempo changes by length
			prevProps.tempoChanges.length === nextProps.tempoChanges.length &&
			// Deep comparison of timelineData would be expensive, so compare just measures length
			prevProps.timelineData.measures.length ===
				nextProps.timelineData.measures.length
		);
	}
);
