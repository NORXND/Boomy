import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Trash, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MidiBanks } from "../../components/MidiBanks";
import { useSongStore } from "../../store/songStore";
import { DrumsEvent } from "../../types/song";
import type { TimelineData } from "./NewTimelineRoot";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";

const TRACK_COLORS = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-orange-500"];

const STEP_WIDTH = 40; // px

export interface DrumsTimelineProps {
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

export const DrumsTimeline = React.memo(
  function DrumsTimeline({ timelineData, currentTime, calculateCursorPosition, timelineScrollRef, addUndoAction, handleSeek }: DrumsTimelineProps) {
    const { currentSong, updateDrums } = useSongStore();
    const drumsEvents = useMemo(() => currentSong?.drums || [], [currentSong?.drums]);
    const [selectedTrackIndex, setSelectedTrackIndex] = useState<number | null>(null);
    const [showMidiBanks, setShowMidiBanks] = useState(false);

    // State for selected events: [{trackIndex, beatIndex}]
    const [selectedEvents, setSelectedEvents] = useState<{ trackIndex: number; beatIndex: number }[]>([]);

    const addBankAsTrack = useCallback(
      (bankName: string) => {
        if (drumsEvents.some((track) => track.sound === bankName)) {
          toast.error("Track already exists", {
            description: `A track named "${bankName}" is already in the timeline.`,
          });
          return;
        }
        const newTrack: DrumsEvent = { sound: bankName, events: [] };
        const newDrumsEvents = [...drumsEvents, newTrack];
        updateDrums(newDrumsEvents);
        setSelectedTrackIndex(newDrumsEvents.length - 1);
        setShowMidiBanks(false);
        addUndoAction({
          type: "drums:trackadd",
          data: { event: { index: newDrumsEvents.length - 1 } },
        });
      },
      [drumsEvents, updateDrums],
    );

    const deleteTrack = useCallback(
      (index: number) => {
        const oldTrack = drumsEvents[index];
        const newDrumsEvents = drumsEvents.filter((_, i) => i !== index);
        updateDrums(newDrumsEvents);
        if (selectedTrackIndex === index) {
          setSelectedTrackIndex(null);
        } else if (selectedTrackIndex !== null && selectedTrackIndex > index) {
          setSelectedTrackIndex(selectedTrackIndex - 1);
        }
        addUndoAction({
          type: "drums:trackremove",
          data: { event: oldTrack },
        });
      },
      [drumsEvents, updateDrums, selectedTrackIndex],
    );

    const toggleEvent = useCallback(
      (trackIndex: number, beatIndex: number) => {
        const newDrumsEvents = JSON.parse(JSON.stringify(drumsEvents));
        const track = newDrumsEvents[trackIndex];
        const eventPos = track.events.indexOf(beatIndex);

        if (eventPos === -1) {
          track.events.push(beatIndex);
          track.events.sort((a: number, b: number) => a - b);

          addUndoAction({
            type: "drums:drumadd",
            data: {
              track: track.sound,
              event: { beatIndex },
            },
          });
        } else {
          track.events.splice(eventPos, 1);
          addUndoAction({
            type: "drums:drumremove",
            data: {
              track: track.sound,
              event: { beatIndex },
            },
          });
        }
        updateDrums(newDrumsEvents);
      },
      [drumsEvents, updateDrums],
    );

    // Copy selected drum events to clipboard
    const handleCopy = useCallback(() => {
      if (selectedEvents.length === 0 || !currentSong) return;

      // Only include selected cells that actually have an event
      const filledSelections = selectedEvents.filter(({ trackIndex, beatIndex }) => drumsEvents[trackIndex]?.events.includes(beatIndex));

      if (filledSelections.length === 0) return;

      // Use the beatIndex of the first selected cell as the offset base
      const offsetBase = selectedEvents[0].beatIndex;

      // Group by track, only include filled events, and store offset from offsetBase
      const grouped: Record<string, { track: string; events: { offset: number; beat: number }[] }> = {};

      for (const { trackIndex, beatIndex } of filledSelections) {
        const track = drumsEvents[trackIndex];
        if (!grouped[track.sound]) grouped[track.sound] = { track: track.sound, events: [] };
        grouped[track.sound].events.push({
          beat: beatIndex,
          offset: beatIndex - offsetBase,
        });
      }

      const clipboardPayload = {
        boomy: "copypaste1",
        type: "drums",
        data: Object.values(grouped),
      };

      try {
        navigator.clipboard.writeText(JSON.stringify(clipboardPayload));
      } catch (err) {
        console.error("Failed to write to clipboard:", err);
      }
    }, [selectedEvents, drumsEvents, currentSong]);

    // Paste drum events from clipboard at target beat (respects track)
    const handlePaste = useCallback(
      async (targetBeat: number) => {
        let clipboardPayload = null;
        try {
          const text = await navigator.clipboard.readText();
          clipboardPayload = JSON.parse(text);
        } catch {
          return;
        }

        if (!clipboardPayload || clipboardPayload.boomy !== "copypaste1" || clipboardPayload.type !== "drums" || !Array.isArray(clipboardPayload.data)) {
          return;
        }

        const newDrumsEvents = JSON.parse(JSON.stringify(drumsEvents));

        for (const group of clipboardPayload.data) {
          const trackIdx = newDrumsEvents.findIndex((t: { sound: string }) => t.sound === group.track);
          if (trackIdx === -1) continue; // skip if track not found

          for (const event of group.events) {
            const newBeat = targetBeat + (event.offset ?? 0);
            if (!newDrumsEvents[trackIdx].events.includes(newBeat)) {
              newDrumsEvents[trackIdx].events.push(newBeat);
            }
          }
          // Sort events in track
          newDrumsEvents[trackIdx].events.sort((a: number, b: number) => a - b);
        }
        updateDrums(newDrumsEvents);
      },
      [drumsEvents, updateDrums],
    );

    const totalWidth = timelineData.measures.length * 8 * STEP_WIDTH;

    if (!currentSong) {
      return <div className="p-4 text-center text-muted-foreground">Loading song...</div>;
    }

    // Add this helper to check if a cell is selected
    const isCellSelected = (trackIndex: number, beatIndex: number) => selectedEvents.some((sel) => sel.trackIndex === trackIndex && sel.beatIndex === beatIndex);

    // Add this handler for selecting cells
    const handleCellSelect = useCallback(
      (trackIndex: number, beatIndex: number, e: React.MouseEvent) => {
        if (e.shiftKey && selectedEvents.length > 0) {
          // Allow rectangular selection across tracks and beats
          const last = selectedEvents[selectedEvents.length - 1];
          const trackStart = Math.min(last.trackIndex, trackIndex);
          const trackEnd = Math.max(last.trackIndex, trackIndex);
          const beatStart = Math.min(last.beatIndex, beatIndex);
          const beatEnd = Math.max(last.beatIndex, beatIndex);
          const range: { trackIndex: number; beatIndex: number }[] = [];
          for (let t = trackStart; t <= trackEnd; t++) {
            for (let b = beatStart; b <= beatEnd; b++) {
              range.push({ trackIndex: t, beatIndex: b });
            }
          }
          setSelectedEvents(range);
        } else if (e.ctrlKey || e.metaKey) {
          // Multi-select (add/remove individual cells)
          setSelectedEvents((prev) => {
            const exists = prev.some((sel) => sel.trackIndex === trackIndex && sel.beatIndex === beatIndex);
            if (exists) {
              return prev.filter((sel) => !(sel.trackIndex === trackIndex && sel.beatIndex === beatIndex));
            } else {
              return [...prev, { trackIndex, beatIndex }];
            }
          });
        } else {
          // Single select
          setSelectedEvents([{ trackIndex, beatIndex }]);
        }
      },
      [selectedEvents],
    );

    return (
      <div className="h-full flex flex-col bg-background text-white">
        {/* Toolbar */}
        <div className="flex-shrink-0 p-2 border-b bg-background flex items-center justify-between">
          <Button size="sm" onClick={() => setShowMidiBanks(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Track
          </Button>
          <div className="text-sm text-muted-foreground">{drumsEvents.length} tracks</div>
        </div>

        {/* Timeline Content */}
        <div className="flex-1 relative overflow-hidden">
          {drumsEvents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
              <Music className="h-12 w-12 mb-4 opacity-20" />
              <h3 className="text-lg font-medium mb-2">No Drum Tracks</h3>
              <p className="text-sm text-center mb-4">Add a track from MIDI banks to get started.</p>
              <Button onClick={() => setShowMidiBanks(true)}>
                <Music className="h-4 w-4 mr-1" /> Browse MIDI Banks
              </Button>
            </div>
          ) : (
            <div className="h-full w-full overflow-auto" ref={timelineScrollRef}>
              <div className="relative" style={{ width: totalWidth }}>
                {/* Header */}
                <div className="sticky top-0 z-20 flex bg-background">
                  <div className="sticky left-0 z-30 w-48 flex-shrink-0 bg-background border-r border-b flex items-center p-2">
                    <span className="text-xs font-bold uppercase text-muted-foreground">Drum Tracks</span>
                  </div>
                  {timelineData.measures.map((measure, measureIndex) => {
                    return (
                      <div
                        key={measure.number}
                        className="flex flex-col border-r cursor-pointer hover:bg-muted/20"
                        style={{
                          width: 8 * STEP_WIDTH,
                          minWidth: 8 * STEP_WIDTH,
                        }}
                        onClick={() => handleSeek(measure.startTime)}
                      >
                        <div className="h-6 flex items-center justify-center border-b text-sm font-medium">Measure {measure.number}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Body */}
                <div className="flex">
                  {/* Track Info Column */}
                  <div className="sticky left-0 z-10 w-48 flex-shrink-0 bg-background">
                    {drumsEvents.map((track, trackIndex) => (
                      <div
                        key={trackIndex}
                        className={cn("h-12 border-b border-r flex items-center justify-between px-2 cursor-pointer", selectedTrackIndex === trackIndex ? "bg-accent" : "hover:bg-muted/50")}
                        onClick={() => setSelectedTrackIndex(trackIndex === selectedTrackIndex ? null : trackIndex)}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className={`w-3 h-3 rounded-full ${TRACK_COLORS[trackIndex % TRACK_COLORS.length]}`} />
                          <span className="text-sm truncate">{track.sound}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-50 hover:opacity-100 hover:bg-destructive/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTrack(trackIndex);
                          }}
                          title="Delete Track"
                        >
                          <Trash className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Grid */}
                  <div className="flex flex-col">
                    {drumsEvents.map((track, trackIndex) => (
                      <div key={trackIndex} className="flex h-12 border-b">
                        {timelineData.measures.map((_, measureIndex) => (
                          <React.Fragment key={measureIndex}>
                            {Array.from({
                              length: 8,
                            }).map((__, beatPosition) => {
                              const beatIndex = measureIndex * 8 + beatPosition;
                              const hasEvent = track.events.includes(beatIndex);
                              const isQuarter = beatPosition % 2 === 0;
                              return (
                                <ContextMenu key={beatIndex}>
                                  <ContextMenuTrigger asChild>
                                    <div
                                      key={beatIndex}
                                      className={cn(
                                        "w-10 h-full flex items-center justify-center border-r cursor-pointer",
                                        isQuarter ? "bg-muted/10" : "bg-transparent",
                                        "hover:bg-muted/30",
                                        isCellSelected(trackIndex, beatIndex) && "ring-2 ring-primary",
                                      )}
                                      onClick={(e) => {
                                        handleCellSelect(trackIndex, beatIndex, e);
                                        if (!(e.shiftKey || e.ctrlKey || e.metaKey)) {
                                          // Only toggle event if not multi-selecting
                                          toggleEvent(trackIndex, beatIndex);
                                        }
                                      }}
                                      onMouseDown={(e) => {
                                        // Only handle right-click (button 2)
                                        if (e.button === 2) {
                                          e.preventDefault();
                                          const alreadySelected = isCellSelected(trackIndex, beatIndex);
                                          if (!alreadySelected) {
                                            setSelectedEvents([
                                              {
                                                trackIndex,
                                                beatIndex,
                                              },
                                            ]);
                                          }
                                        }
                                      }}
                                    >
                                      {hasEvent && <div className={`w-5 h-5 rounded-full ${TRACK_COLORS[trackIndex % TRACK_COLORS.length]}`} />}
                                    </div>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent>
                                    <ContextMenuItem onClick={() => handleCopy()} disabled={selectedEvents.length === 0}>
                                      Copy
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={() => handlePaste(beatIndex)}>Paste</ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-40 pointer-events-none"
                  style={{
                    left: `${calculateCursorPosition(currentTime)}px`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* MIDI Banks Dialog */}
        <Dialog open={showMidiBanks} onOpenChange={setShowMidiBanks}>
          <DialogContent className="max-w-3xl h-[80vh]">
            <DialogHeader>
              <DialogTitle>Add Track from MIDI Bank</DialogTitle>
              <DialogDescription>Click on a bank name to add it as a new drum track.</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              <MidiBanks onAddBankAsDrumTrack={addBankAsTrack} className="h-[calc(80vh-100px)]" />
            </div>
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
      // Deep comparison of timelineData would be expensive, so compare just measures length
      prevProps.timelineData.measures.length === nextProps.timelineData.measures.length
    );
  },
);
