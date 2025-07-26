import React, { useState, useCallback, useEffect } from 'react';
import {
	Clock,
	Flag,
	Music,
	Play,
	X,
	Plus,
	Settings,
	Edit,
	PersonStanding,
} from 'lucide-react';
import { useSongStore } from '../../store/songStore';
import { useBattleSteps } from '../../store/songStore';
import { usePartyJumps } from '../../store/songStore';
import { usePartyBattleSteps } from '../../store/songStore';
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
	addUndoAction: (action: any) => void;
}

// Event types
type EventType = 'music_start' | 'preview' | 'freestyle' | 'music_end' | 'end';

// Battle event types for the Battle track
type BattleEventType =
	| 'battle_reset'
	| 'player1_solo'
	| 'player2_solo'
	| 'minigame_start'
	| 'minigame_idle'
	| 'minigame_end';

// Party Jump event types for the Party Jump track
type PartyJumpEventType = 'start' | 'end';

// Styles for party jump events
const partyJumpEventStyles: Record<
	PartyJumpEventType,
	{ bg: string; border: string; text: string; label: string }
> = {
	start: {
		bg: 'bg-yellow-500/20',
		border: 'border-yellow-500',
		text: 'text-yellow-500',
		label: 'Party Jump Start',
	},
	end: {
		bg: 'bg-purple-500/20',
		border: 'border-purple-500',
		text: 'text-purple-500',
		label: 'Party Jump End',
	},
};

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
		addUndoAction,
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
			addBattleStep,
			removeBattleStep,
			updateBattleStep,
			addPartyJump,
			removePartyJump,
			updatePartyJump,
			addpartyBattleSteps,
			removepartyBattleSteps,
			updatepartyBattleSteps,
		} = useSongStore();

		const battleSteps = useBattleSteps();
		const partyJumps = usePartyJumps();
		const partyBattleSteps = usePartyBattleSteps();

		const [dragOverCell, setDragOverCell] = useState<string | null>(null);
		const [showAddEventDialog, setShowAddEventDialog] = useState(false);
		const [selectedEventType, setSelectedEventType] =
			useState<EventType>('music_start');
		const [selectedBeat, setSelectedBeat] = useState<number | null>(null);
		const [openBpmDialog, setOpenBpmDialog] = useState(false);
		const [bpmDialogMeasure, setBpmDialogMeasure] =
			useState<Measure | null>(null);
		const [bpmDialogValue, setBpmDialogValue] = useState<number>(120);

		// Battle event dialog state
		const [showAddBattleDialog, setShowAddBattleDialog] = useState(false);
		const [selectedBattleType, setSelectedBattleType] =
			useState<BattleEventType>('battle_reset');
		const [selectedBattleBeat, setSelectedBattleBeat] = useState<
			number | null
		>(null);

		// Party Jump event dialog state
		const [showAddPartyJumpDialog, setShowAddPartyJumpDialog] =
			useState(false);
		const [selectedPartyJumpType, setSelectedPartyJumpType] =
			useState<PartyJumpEventType>('start');
		const [selectedPartyJumpBeat, setSelectedPartyJumpBeat] = useState<
			number | null
		>(null);

		// Party Battle event dialog state
		const [showAddPartyBattleDialog, setShowAddPartyBattleDialog] =
			useState(false);
		const [selectedPartyBattleType, setSelectedPartyBattleType] =
			useState<BattleEventType>('battle_reset');
		const [selectedPartyBattleBeat, setSelectedPartyBattleBeat] = useState<
			number | null
		>(null);

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

		// Fix getPartyJumpEventsForBeat to get event by measure number
		const getPartyJumpEventForMeasure = useCallback(
			(measureNumber: number) => {
				if (!partyJumps) return null;
				return (
					partyJumps.find((ev) => ev.measure === measureNumber) ||
					null
				);
			},
			[partyJumps]
		);

		// Handle click to add event (opens dialog)
		const handleAddEventClick = useCallback((beat: number) => {
			setSelectedBeat(beat);
			setShowAddEventDialog(true);
		}, []);

		// Handle adding a new event - use addEvent function from songStore
		const [freestyleWarning, setFreestyleWarning] = useState<string | null>(
			null
		);

		const handleAddEvent = useCallback(() => {
			if (selectedBeat === null || !selectedEventType || !currentSong)
				return;

			// Check for freestyle event placement
			if (selectedEventType === 'freestyle') {
				// Find music_end event beat
				const musicEndEvent = (currentSong.events || []).find(
					(e) => e.type === 'music_end'
				);
				if (musicEndEvent) {
					// Find measure index for selectedBeat
					const selectedMeasureIdx = timelineData.measures.findIndex(
						(m) =>
							selectedBeat >= m.startBeat &&
							selectedBeat < m.startBeat + m.beatCount
					);
					// Find measure index for music_end event
					const musicEndMeasureIdx = timelineData.measures.findIndex(
						(m) =>
							musicEndEvent.beat >= m.startBeat &&
							musicEndEvent.beat < m.startBeat + m.beatCount
					);
					if (
						musicEndMeasureIdx !== -1 &&
						selectedMeasureIdx !== -1 &&
						musicEndMeasureIdx - selectedMeasureIdx <= 8
					) {
						setFreestyleWarning(
							'Freestyle must be placed at least 9 measures before Music End.'
						);
						return;
					}
				}
			}

			// Remove any existing event at this beat
			const events = currentSong.events || [];
			const existingIdx = events.findIndex(
				(e) => e.beat === selectedBeat
			);
			if (existingIdx !== -1) {
				removeEvent(existingIdx);

				addUndoAction({
					type: 'events:remove',
					data: {
						track: 'song',
						event: events[existingIdx],
					},
				});
			}

			// Add the new event
			addEvent({
				type: selectedEventType,
				beat: selectedBeat,
			});

			addUndoAction({
				type: 'events:add',
				data: {
					track: 'song',
					event: {
						type: selectedEventType,
						beat: selectedBeat,
					},
				},
			});

			setShowAddEventDialog(false);
			setFreestyleWarning(null);
		}, [
			selectedBeat,
			selectedEventType,
			currentSong,
			timelineData.measures,
		]);

		// Handle click to delete event - use removeEvent function from songStore
		const handleEventClick = useCallback(
			(eventIndex: number, e: React.MouseEvent) => {
				e.stopPropagation();
				removeEvent(eventIndex);

				addUndoAction({
					type: 'events:remove',
					data: {
						track: 'song',
						event: useSongStore.getState().currentSong?.events[
							eventIndex
						],
					},
				});
			},
			[]
		);

		// Open dialog to add a battle event
		const handleAddBattleEventClick = useCallback((beat: number) => {
			setSelectedBattleBeat(beat);
			setShowAddBattleDialog(true);
		}, []);

		// Actually add the battle event
		const handleAddBattleEvent = useCallback(() => {
			if (selectedBattleBeat === null || !selectedBattleType) return;
			addBattleStep({
				measure: selectedBattleBeat,
				type: selectedBattleType,
			});

			addUndoAction({
				type: 'events:add',
				data: {
					track: 'battle',
					event: {
						measure: selectedBattleBeat,
						type: selectedBattleType,
					},
				},
			});

			setShowAddBattleDialog(false);
		}, [selectedBattleBeat, selectedBattleType, addBattleStep]);

		// Remove a battle event
		const handleRemoveBattleEvent = useCallback(
			(index: number) => {
				removeBattleStep(index);

				addUndoAction({
					type: 'events:remove',
					data: {
						track: 'battle',
						event: battleSteps[index],
					},
				});
			},
			[removeBattleStep]
		);

		// Open dialog to add a party jump event
		const handleAddPartyJumpEventClick = useCallback(
			(measureNumber: number) => {
				setSelectedPartyJumpBeat(measureNumber);
				setShowAddPartyJumpDialog(true);
			},
			[]
		);

		// Actually add the party jump event
		const handleAddPartyJumpEvent = useCallback(() => {
			if (selectedPartyJumpBeat === null || !selectedPartyJumpType)
				return;

			// Remove any existing party jump event at this measure
			const idx = partyJumps.findIndex(
				(ev) => ev.measure === selectedPartyJumpBeat
			);
			if (idx !== -1) {
				removePartyJump(idx);
			}

			addPartyJump({
				measure: selectedPartyJumpBeat,
				type: selectedPartyJumpType,
			});

			addUndoAction({
				type: 'events:add',
				data: {
					track: 'party',
					event: {
						measure: selectedPartyJumpBeat,
						type: selectedPartyJumpType,
					},
				},
			});

			setShowAddPartyJumpDialog(false);
		}, [
			selectedPartyJumpBeat,
			selectedPartyJumpType,
			addPartyJump,
			partyJumps,
			removePartyJump,
		]);

		// Remove a party jump event
		const handleRemovePartyJumpEvent = useCallback(
			(measureNumber: number) => {
				const idx = partyJumps.findIndex(
					(ev) => ev.measure === measureNumber
				);
				if (idx !== -1) {
					removePartyJump(idx);
				}
			},
			[partyJumps, removePartyJump]
		);

		// Open dialog to add a party battle event
		const handleAddPartyBattleEventClick = useCallback(
			(measureNumber: number) => {
				setSelectedPartyBattleBeat(measureNumber);
				setShowAddPartyBattleDialog(true);
			},
			[]
		);

		// Actually add the party battle event
		const handleAddPartyBattleEvent = useCallback(() => {
			if (selectedPartyBattleBeat === null || !selectedPartyBattleType)
				return;

			// Remove any existing party battle event at this measure
			const idx = partyBattleSteps.findIndex(
				(ev) => ev.measure === selectedPartyBattleBeat
			);
			if (idx !== -1) {
				removepartyBattleSteps(idx);
				addUndoAction({
					type: 'events:remove',
					data: {
						track: 'partybattle',
						event: partyBattleSteps[idx],
					},
				});
			}

			addpartyBattleSteps({
				measure: selectedPartyBattleBeat,
				type: selectedPartyBattleType,
			});

			addUndoAction({
				type: 'events:add',
				data: {
					track: 'partybattle',
					event: {
						measure: selectedPartyBattleBeat,
						type: selectedPartyBattleType,
					},
				},
			});

			setShowAddPartyBattleDialog(false);
		}, [
			selectedPartyBattleBeat,
			selectedPartyBattleType,
			addpartyBattleSteps,
			partyBattleSteps,
			removepartyBattleSteps,
		]);

		// Remove a party battle event
		const handleRemovePartyBattleEvent = useCallback(
			(index: number) => {
				removepartyBattleSteps(index);
				addUndoAction({
					type: 'events:remove',
					data: {
						track: 'partybattle',
						event: partyBattleSteps[index],
					},
				});
			},
			[removepartyBattleSteps]
		);

		// Get the icon for an event type
		const getEventIcon = (type: EventType) => {
			switch (type) {
				case 'music_start':
					return <Play className="h-4 w-4 text-green-500" />;
				case 'preview':
					return <Clock className="h-4 w-4 text-yellow-500" />;
				case 'freestyle':
					return <PersonStanding className="h-4 w-4 text-blue-500" />;
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
			freestyle: {
				bg: 'bg-blue-500/20',
				border: 'border-blue-500',
				text: 'text-blue-500',
				label: 'Freestyle (+ 8 Measures)',
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

		// Add icons and styles for battle events
		const battleEventStyles: Record<
			BattleEventType,
			{ bg: string; border: string; text: string; label: string }
		> = {
			battle_reset: {
				bg: 'bg-red-500/20',
				border: 'border-red-500',
				text: 'text-red-500',
				label: 'Battle Reset (Start / End of Solo)',
			},
			player1_solo: {
				bg: 'bg-orange-500/20',
				border: 'border-orange-500',
				text: 'text-orange-500',
				label: 'Player 1 Solo',
			},
			player2_solo: {
				bg: 'bg-lime-500/20',
				border: 'border-lime-500',
				text: 'text-lime-500',
				label: 'Player 2 Solo Start',
			},
			minigame_start: {
				bg: 'bg-pink-500/20',
				border: 'border-pink-500',
				text: 'text-pink-500',
				label: 'Minigame Start',
			},
			minigame_idle: {
				bg: 'bg-indigo-500/20',
				border: 'border-indigo-500',
				text: 'text-indigo-500',
				label: 'Minigame Idle',
			},
			minigame_end: {
				bg: 'bg-indigo-500/20',
				border: 'border-indigo-500',
				text: 'text-indigo-500',
				label: 'Minigame End',
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
					(tc) => tc.measure === bpmDialogMeasure.startTime
				);

				if (existingIndex !== -1) {
					// Update existing tempo change
					updateTempoChange(existingIndex, { bpm: bpmDialogValue });
				} else {
					// Add a new tempo change
					addTempoChange({
						bpm: bpmDialogValue,
						measure: bpmDialogMeasure.startTime, // Assuming tick is time
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

		// --- AUTOSCROLL LOGIC ---
		useEffect(() => {
			if (!autoScroll || !timelineScrollRef.current) return;

			const scrollContainer = timelineScrollRef.current;
			const cursorX = calculateCursorPosition();

			const containerScrollLeft = scrollContainer.scrollLeft;
			const containerWidth = scrollContainer.clientWidth;

			// If cursor is outside the visible area, scroll to center it
			if (
				cursorX < containerScrollLeft ||
				cursorX > containerScrollLeft + containerWidth - 40 // 40px margin
			) {
				// Scroll so that the cursor is roughly centered
				const targetScroll = Math.max(0, cursorX - containerWidth / 2);
				scrollContainer.scrollTo({
					left: targetScroll,
					behavior: 'smooth',
				});
			}
		}, [
			currentTime,
			autoScroll,
			calculateCursorPosition,
			timelineScrollRef,
		]);
		// --- END AUTOSCROLL LOGIC ---

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

				{/* Battle info panel */}
				<div className="p-4 border-b">
					<h3 className="text-sm font-medium mb-2">Battle Events</h3>
					<div className="flex flex-wrap gap-2 text-xs">
						{Object.entries(battleEventStyles).map(
							([type, style]) => (
								<div
									key={type}
									className={`px-2 py-1 rounded-full ${style.bg} ${style.border} ${style.text} flex items-center gap-1`}
								>
									<span>{style.label}</span>
								</div>
							)
						)}
					</div>
					<p className="text-xs text-muted-foreground mt-2">
						Battle events are special timeline events for solos and
						minigames. Click a beat in the Battle track to add one.
					</p>
				</div>

				{/* Party Jump info panel */}
				<div className="p-4 border-b">
					<h3 className="text-sm font-medium mb-2">
						Party Jump Events
					</h3>
					<div className="flex flex-wrap gap-2 text-xs">
						{Object.entries(partyJumpEventStyles).map(
							([type, style]) => (
								<div
									key={type}
									className={`px-2 py-1 rounded-full ${style.bg} ${style.border} ${style.text} flex items-center gap-1`}
								>
									<span>{style.label}</span>
								</div>
							)
						)}
					</div>
					<p className="text-xs text-muted-foreground mt-2">
						Party Jump events are special timeline events for party
						jump sections. Click a beat in the Party Jump track to
						add one.
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
								(tc) => tc.measure === measure.startTime
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
									<div
										className="h-8 px-2 flex items-center justify-center bg-muted/50 cursor-pointer hover:bg-muted/70 gap-2"
										onClick={() =>
											handleSeek(measure.startTime)
										}
									>
										<div className="text-xs font-medium text-center">
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
														className={`flex justify-center items-center border-r transition-colors cursor-pointer relative group min-h-full ${
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
															handleSeek(beat)
														} // <-- Always seek on click
														onDoubleClick={() =>
															handleAddEventClick(
																beat
															)
														} // Optional: double click to add event
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
																								e.stopPropagation(); // Prevent seek
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

					{/* Battle Track with merged cells (one per measure) */}
					<div className="h-[90px] border-b flex">
						{/* Track Label */}
						<div
							className="flex-shrink-0 border-r bg-muted/30 flex items-center px-3"
							style={{ width: trackHeaderWidth }}
						>
							<span className="text-sm font-medium">Battle</span>
						</div>
						{/* One cell per measure */}
						{timelineData.measures.map((measure) => {
							// Find all battle events for this measure
							const battleEvents = battleSteps
								.map((event, index) => ({
									...event,
									originalIndex: index,
								}))
								.filter(
									(event) => event.measure === measure.number
								);

							return (
								<div
									key={measure.number}
									className="flex-shrink-0 border-r relative flex items-center justify-center group"
									style={{
										width: `${
											measure.beatCount * pixelsPerBeat
										}px`,
										minHeight: '100%',
									}}
									onClick={() =>
										handleAddBattleEventClick(
											measure.number
										)
									}
								>
									{battleEvents.length > 0 ? (
										<div className="w-full h-full p-1 flex flex-col gap-1 overflow-hidden">
											{battleEvents.map((event, idx) => {
												const style =
													battleEventStyles[
														event.type as BattleEventType
													];
												return (
													<div
														key={`${event.originalIndex}-${idx}`}
														className={`flex-1 border rounded p-1 flex flex-col items-center justify-center transition-colors ${style.bg} ${style.border} w-full h-full`}
														onClick={(e) =>
															e.stopPropagation()
														}
													>
														<div
															className={`rounded-full p-1 ${style.bg} flex items-center justify-center`}
														>
															{/* Optionally add an icon */}
														</div>
														<div
															className={`text-xs font-medium ${style.text} text-center mt-1`}
														>
															{style.label}
														</div>
														<button
															className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 p-1 rounded-full"
															onClick={(e) => {
																e.stopPropagation();
																handleRemoveBattleEvent(
																	event.originalIndex
																);
															}}
														>
															<X className="h-3 w-3 text-destructive" />
														</button>
													</div>
												);
											})}
										</div>
									) : (
										<div className="w-full h-full flex items-center justify-center">
											<Button
												variant="ghost"
												size="sm"
												className="h-6 w-6 rounded-full p-0 opacity-100"
												onClick={(e) => {
													e.stopPropagation();
													handleAddBattleEventClick(
														measure.number
													);
												}}
											>
												<Plus className="h-3 w-3" />
											</Button>
										</div>
									)}
								</div>
							);
						})}
					</div>

					{/* Party Jump Track */}
					<div className="h-[90px] border-b flex">
						{/* Track Label */}
						<div
							className="flex-shrink-0 border-r bg-muted/30 flex items-center px-3"
							style={{ width: trackHeaderWidth }}
						>
							<span className="text-sm font-medium">
								Party Jump
							</span>
						</div>
						{/* One cell per measure */}
						{timelineData.measures.map((measure) => {
							const event = getPartyJumpEventForMeasure(
								measure.number
							);
							const style = event
								? partyJumpEventStyles[
										event.type as PartyJumpEventType
								  ]
								: null;
							return (
								<div
									key={measure.number}
									className="flex-shrink-0 border-r relative flex items-center justify-center group"
									style={{
										width: `${
											measure.beatCount * pixelsPerBeat
										}px`,
										minHeight: '100%',
									}}
									onClick={() =>
										handleAddPartyJumpEventClick(
											measure.number
										)
									}
								>
									{event ? (
										<div
											className={`flex-1 border rounded p-1 flex flex-col items-center justify-center transition-colors ${style?.bg} ${style?.border} w-full h-full`}
											onClick={(e) => e.stopPropagation()}
										>
											<div
												className={`rounded-full p-1 ${style?.bg} flex items-center justify-center`}
											>
												{/* Optionally add an icon */}
											</div>
											<div
												className={`text-xs font-medium ${style?.text} text-center mt-1`}
											>
												{style?.label}
											</div>
											<div className="flex gap-1 mt-1">
												<Button
													variant="ghost"
													size="icon"
													className="p-1"
													title="Remove"
													onClick={(e) => {
														e.stopPropagation();
														handleRemovePartyJumpEvent(
															measure.number
														);
													}}
												>
													<X className="h-3 w-3 text-destructive" />
												</Button>
											</div>
										</div>
									) : (
										<div className="w-full h-full flex items-center justify-center">
											<Button
												variant="ghost"
												size="sm"
												className="h-6 w-6 rounded-full p-0 opacity-100"
												onClick={(e) => {
													e.stopPropagation();
													handleAddPartyJumpEventClick(
														measure.number
													);
												}}
											>
												<Plus className="h-3 w-3" />
											</Button>
										</div>
									)}
								</div>
							);
						})}
					</div>

					{/* Party Battle Track with merged cells (one per measure) */}
					<div className="h-[90px] border-b flex">
						{/* Track Label */}
						<div
							className="flex-shrink-0 border-r bg-muted/30 flex items-center px-3"
							style={{ width: trackHeaderWidth }}
						>
							<span className="text-sm font-medium">
								Party Battle
							</span>
						</div>
						{/* One cell per measure */}
						{timelineData.measures.map((measure) => {
							// Find all party battle events for this measure
							const partyBattleEvents = partyBattleSteps
								.map((event, index) => ({
									...event,
									originalIndex: index,
								}))
								.filter(
									(event) => event.measure === measure.number
								);

							return (
								<div
									key={measure.number}
									className="flex-shrink-0 border-r relative flex items-center justify-center group"
									style={{
										width: `${
											measure.beatCount * pixelsPerBeat
										}px`,
										minHeight: '100%',
									}}
									onClick={() =>
										handleAddPartyBattleEventClick(
											measure.number
										)
									}
								>
									{partyBattleEvents.length > 0 ? (
										<div className="w-full h-full p-1 flex flex-col gap-1 overflow-hidden">
											{partyBattleEvents.map(
												(event, idx) => {
													const style =
														battleEventStyles[
															event.type as BattleEventType
														];
													return (
														<div
															key={`${event.originalIndex}-${idx}`}
															className={`flex-1 border rounded p-1 flex flex-col items-center justify-center transition-colors ${style.bg} ${style.border} w-full h-full`}
															onClick={(e) =>
																e.stopPropagation()
															}
														>
															<div
																className={`rounded-full p-1 ${style.bg} flex items-center justify-center`}
															>
																{/* Optionally add an icon */}
															</div>
															<div
																className={`text-xs font-medium ${style.text} text-center mt-1`}
															>
																{style.label}
															</div>
															<button
																className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 p-1 rounded-full"
																onClick={(
																	e
																) => {
																	e.stopPropagation();
																	handleRemovePartyBattleEvent(
																		event.originalIndex
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
										<div className="w-full h-full flex items-center justify-center">
											<Button
												variant="ghost"
												size="sm"
												className="h-6 w-6 rounded-full p-0 opacity-100"
												onClick={(e) => {
													e.stopPropagation();
													handleAddPartyBattleEventClick(
														measure.number
													);
												}}
											>
												<Plus className="h-3 w-3" />
											</Button>
										</div>
									)}
								</div>
							);
						})}
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
									{selectedBeat !== null
										? selectedBeat + 1
										: ''}
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
											setSelectedEventType(
												value as EventType
											)
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
											<SelectItem value="freestyle">
												Freestyle
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
								<Button onClick={handleAddEvent}>
									Add Event
								</Button>
							</div>
							{/* Freestyle warning message */}
							{freestyleWarning && (
								<div className="mt-4 text-sm text-red-500">
									{freestyleWarning}
								</div>
							)}
						</DialogContent>
					</Dialog>

					{/* Add Battle Event Dialog */}
					<Dialog
						open={showAddBattleDialog}
						onOpenChange={setShowAddBattleDialog}
					>
						<DialogContent className="sm:max-w-[425px]">
							<DialogHeader>
								<DialogTitle>
									Add Battle Event at Beat{' '}
									{selectedBattleBeat !== null
										? selectedBattleBeat + 1
										: ''}
								</DialogTitle>
								<DialogDescription>
									Select a battle event type to add at this
									beat.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4 py-4">
								<div className="space-y-2">
									<label className="text-sm font-medium">
										Battle Event Type
									</label>
									<Select
										value={selectedBattleType}
										onValueChange={(value) =>
											setSelectedBattleType(
												value as BattleEventType
											)
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select battle event type" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="battle_reset">
												Battle Reset
											</SelectItem>
											<SelectItem value="player1_solo">
												Player 1 Solo
											</SelectItem>
											<SelectItem value="player2_solo">
												Player 2 Solo
											</SelectItem>
											<SelectItem value="minigame_start">
												Minigame Start
											</SelectItem>
											<SelectItem value="minigame_idle">
												Minigame Idle
											</SelectItem>
											<SelectItem value="minigame_end">
												Minigame End
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
							<div className="flex justify-end gap-2">
								<Button
									variant="outline"
									onClick={() =>
										setShowAddBattleDialog(false)
									}
								>
									Cancel
								</Button>
								<Button onClick={handleAddBattleEvent}>
									Add Battle Event
								</Button>
							</div>
						</DialogContent>
					</Dialog>

					{/* Add Party Jump Event Dialog */}
					<Dialog
						open={showAddPartyJumpDialog}
						onOpenChange={setShowAddPartyJumpDialog}
					>
						<DialogContent className="sm:max-w-[425px]">
							<DialogHeader>
								<DialogTitle>
									Add Party Jump Event at Beat{' '}
									{selectedPartyJumpBeat !== null
										? selectedPartyJumpBeat + 1
										: ''}
								</DialogTitle>
								<DialogDescription>
									Select a party jump event type to add at
									this beat.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4 py-4">
								<div className="space-y-2">
									<label className="text-sm font-medium">
										Party Jump Event Type
									</label>
									<Select
										value={selectedPartyJumpType}
										onValueChange={(value) =>
											setSelectedPartyJumpType(
												value as PartyJumpEventType
											)
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select party jump event type" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="start">
												Party Jump Start
											</SelectItem>
											<SelectItem value="end">
												Party Jump End
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
							<div className="flex justify-end gap-2">
								<Button
									variant="outline"
									onClick={() =>
										setShowAddPartyJumpDialog(false)
									}
								>
									Cancel
								</Button>
								<Button
									onClick={() => {
										const existing = partyJumps.find(
											(ev) =>
												ev.measure ===
												selectedPartyJumpBeat
										);
										if (existing) {
											setShowAddPartyJumpDialog(false);
										} else {
											handleAddPartyJumpEvent();
										}
									}}
								>
									{partyJumps.find(
										(ev) =>
											ev.measure === selectedPartyJumpBeat
									)
										? 'Edit Party Jump Event'
										: 'Add Party Jump Event'}
								</Button>
							</div>
						</DialogContent>
					</Dialog>

					{/* Add Party Battle Event Dialog */}
					<Dialog
						open={showAddPartyBattleDialog}
						onOpenChange={setShowAddPartyBattleDialog}
					>
						<DialogContent className="sm:max-w-[425px]">
							<DialogHeader>
								<DialogTitle>
									Add Party Battle Event at Measure{' '}
									{selectedPartyBattleBeat !== null
										? selectedPartyBattleBeat + 1
										: ''}
								</DialogTitle>
								<DialogDescription>
									Select a party battle event type to add at
									this measure.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4 py-4">
								<div className="space-y-2">
									<label className="text-sm font-medium">
										Party Battle Event Type
									</label>
									<Select
										value={selectedPartyBattleType}
										onValueChange={(value) =>
											setSelectedPartyBattleType(
												value as BattleEventType
											)
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select party battle event type" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="battle_reset">
												Battle Reset
											</SelectItem>
											<SelectItem value="player1_solo">
												Player 1 Solo
											</SelectItem>
											<SelectItem value="player2_solo">
												Player 2 Solo
											</SelectItem>
											<SelectItem value="minigame_start">
												Minigame Start
											</SelectItem>
											<SelectItem value="minigame_idle">
												Minigame Idle
											</SelectItem>
											<SelectItem value="minigame_end">
												Minigame End
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
							<div className="flex justify-end gap-2">
								<Button
									variant="outline"
									onClick={() =>
										setShowAddPartyBattleDialog(false)
									}
								>
									Cancel
								</Button>
								<Button onClick={handleAddPartyBattleEvent}>
									Add Party Battle Event
								</Button>
							</div>
						</DialogContent>
					</Dialog>

					{/* BPM Change Dialog */}
					<Dialog
						open={openBpmDialog}
						onOpenChange={setOpenBpmDialog}
					>
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
										setBpmDialogValue(
											Number(e.target.value)
										)
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
								<Button onClick={handleBpmDialogSave}>
									Save
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
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
			// Compare tempo changes by length
			prevProps.tempoChanges.length === nextProps.tempoChanges.length &&
			// Deep comparison of timelineData would be expensive, so compare just measures length
			prevProps.timelineData.measures.length ===
				nextProps.timelineData.measures.length
		);
	}
);
