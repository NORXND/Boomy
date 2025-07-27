import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Plus, Trash, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useSongStore } from "../../store/songStore";
import type { TimelineData } from "./NewTimelineRoot";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Slider } from "@/components/ui/slider"; // Make sure you have a slider component
import { VisemesBanks } from "../../components/Visemes"; // Import your Visemes component

const TRACK_COLORS = [
  "bg-red-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-orange-500",
];

const STEP_WIDTH = 80; // px
const BEATS_PER_MEASURE = 4; // <-- Only 4 cells per measure

export interface DancerFacesTimelineProps {
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
  difficulty: "easy" | "medium" | "expert";
}

export const DancerFacesTimeline = React.memo(
  function DancerFacesTimeline({
    timelineData,
    currentTime,
    calculateCursorPosition,
    timelineScrollRef,
    addUndoAction,
    handleSeek,
    difficulty,
  }: DancerFacesTimelineProps) {
    const {
      currentSong,
      addDancerFaceEvent,
      updateDancerFaceEvent,
      removeDancerFaceEvent,
    } = useSongStore();
    const dancerFaces = useMemo(
      () => currentSong?.dancerFaces?.[difficulty] || [],
      [currentSong, difficulty]
    );

    // Viseme tracks are imported from Visemes component
    const [visemeTracks, setVisemeTracks] = useState<string[]>([]);
    const [showVisemeImport, setShowVisemeImport] = useState(false);

    // Sync visemeTracks with state
    useEffect(() => {
      const uniqueVisemes = Array.from(
        new Set(dancerFaces.map((ev) => ev.viseme))
      );
      setVisemeTracks((prev) => {
        const merged = [...prev];
        uniqueVisemes.forEach((v) => {
          if (!merged.includes(v)) merged.push(v);
        });
        return merged.filter((v) => uniqueVisemes.includes(v));
      });
    }, [dancerFaces]);

    const [selectedTrackIndex, setSelectedTrackIndex] = useState<number | null>(
      null
    );

    // State for selected events: [{trackIndex, beatIndex}]
    const [selectedEvents, setSelectedEvents] = useState<
      { trackIndex: number; beatIndex: number }[]
    >([]);

    const [editDialog, setEditDialog] = useState<{
      open: boolean;
      trackIndex: number | null;
      beat: number | null;
      eventIndex: number | null;
      value: number;
    }>({
      open: false,
      trackIndex: null,
      beat: null,
      eventIndex: null,
      value: 1,
    });

    // Add viseme as a track (from Visemes component)
    const addVisemeAsTrack = useCallback(
      (visemeName: string) => {
        if (visemeTracks.includes(visemeName)) {
          toast.error("Track already exists", {
            description: `A viseme named "${visemeName}" is already in the timeline.`,
          });
          return;
        }
        setVisemeTracks((prev) => [...prev, visemeName]);
        setSelectedTrackIndex(visemeTracks.length);
        setShowVisemeImport(false);
      },
      [visemeTracks]
    );

    // Remove viseme track
    const deleteTrack = useCallback(
      (index: number) => {
        const name = visemeTracks[index];
        setVisemeTracks((prev) => prev.filter((_, i) => i !== index));
        // Remove all events for this viseme from the timeline
        const eventsToRemove = dancerFaces
          .map((ev, i) => ({ ...ev, i }))
          .filter((ev) => ev.viseme === name);
        eventsToRemove.forEach((ev) => {
          removeDancerFaceEvent(difficulty, ev.i);
          addUndoAction({
            type: "visemes:remove",
            data: { track: difficulty, event: ev },
          });
        });
        if (selectedTrackIndex === index) {
          setSelectedTrackIndex(null);
        } else if (selectedTrackIndex !== null && selectedTrackIndex > index) {
          setSelectedTrackIndex(selectedTrackIndex - 1);
        }
      },
      [
        visemeTracks,
        dancerFaces,
        removeDancerFaceEvent,
        addUndoAction,
        selectedTrackIndex,
        difficulty,
      ]
    );

    // Open dialog to add/edit event
    const openEditDialog = useCallback(
      (trackIndex: number, beat: number) => {
        const visemeName = visemeTracks[trackIndex];
        const idx = dancerFaces.findIndex(
          (ev) => ev.beat === beat && ev.viseme === visemeName
        );
        if (idx !== -1) {
          const ev = dancerFaces[idx];
          setEditDialog({
            open: true,
            trackIndex,
            beat,
            eventIndex: idx,
            value: ev.value,
          });
        } else {
          setEditDialog({
            open: true,
            trackIndex,
            beat,
            eventIndex: null,
            value: 1,
          });
        }
      },
      [dancerFaces, visemeTracks]
    );

    const handleSave = useCallback(() => {
      if (
        editDialog.trackIndex === null ||
        editDialog.beat === null ||
        !visemeTracks[editDialog.trackIndex]
      )
        return;
      const event = {
        beat: editDialog.beat,
        value: editDialog.value,
        viseme: visemeTracks[editDialog.trackIndex],
      };
      if (editDialog.eventIndex !== null) {
        updateDancerFaceEvent(difficulty, editDialog.eventIndex, event);
        addUndoAction({
          type: "visemes:add",
          data: {
            track: difficulty,
            event,
          },
        });
      } else {
        addDancerFaceEvent(difficulty, event);
        addUndoAction({
          type: "visemes:add",
          data: {
            track: difficulty,
            event,
          },
        });
      }
      setEditDialog({ ...editDialog, open: false });
    }, [
      editDialog,
      addDancerFaceEvent,
      updateDancerFaceEvent,
      addUndoAction,
      visemeTracks,
      difficulty,
    ]);

    const handleDelete = useCallback(() => {
      if (
        editDialog.trackIndex !== null &&
        editDialog.eventIndex !== null &&
        editDialog.beat !== null &&
        visemeTracks[editDialog.trackIndex]
      ) {
        removeDancerFaceEvent(difficulty, editDialog.eventIndex);
        addUndoAction({
          type: "visemes:remove",
          data: {
            track: difficulty,
            event: {
              beat: editDialog.beat,
              value: editDialog.value,
              viseme: visemeTracks[editDialog.trackIndex],
            },
          },
        });
      }
      setEditDialog({ ...editDialog, open: false });
    }, [
      editDialog,
      removeDancerFaceEvent,
      addUndoAction,
      visemeTracks,
      difficulty,
    ]);

    // Clipboard for copy/paste
    const [clipboard, setClipboard] = useState<
      { value: number; offset: number }[]
    >([]);
    const [clipboardSourceTrack, setClipboardSourceTrack] = useState<
      number | null
    >(null);

    // Copy: only from the currently selected track, copy values and offsets
    const handleCopy = useCallback(() => {
      if (selectedEvents.length === 0) return;
      const sorted = [...selectedEvents].sort(
        (a, b) => a.beatIndex - b.beatIndex
      );
      const trackIndex = sorted[0].trackIndex;
      // Only allow copying if all selected cells are from the same track
      if (!sorted.every((ev) => ev.trackIndex === trackIndex)) {
        toast.error("Copy from one track at a time");
        return;
      }
      const minBeat = sorted[0].beatIndex;
      const copied = sorted.map(({ beatIndex }) => {
        const viseme = visemeTracks[trackIndex];
        const event = dancerFaces.find(
          (ev) => ev.beat === beatIndex && ev.viseme === viseme
        );
        return {
          value: event ? event.value : null,
          offset: beatIndex - minBeat,
        };
      });
      setClipboard(copied);
      setClipboardSourceTrack(trackIndex);
      toast.success("Copied viseme values");
    }, [selectedEvents, visemeTracks, dancerFaces]);

    // Paste: paste clipboard to any track, respect offsets, skip nulls
    const handlePaste = useCallback(
      (targetTrackIndex: number, targetBeatIndex: number) => {
        if (clipboard.length === 0) return;
        const viseme = visemeTracks[targetTrackIndex];
        clipboard.forEach((clip, i) => {
          if (clip.value === null) return; // skip empty
          const beat = targetBeatIndex + clip.offset;
          if (beat < 0) return;
          const eventIdx = dancerFaces.findIndex(
            (ev) => ev.beat === beat && ev.viseme === viseme
          );
          const event = {
            beat,
            value: clip.value,
            viseme,
          };
          if (eventIdx !== -1) {
            updateDancerFaceEvent(difficulty, eventIdx, event);
          } else {
            addDancerFaceEvent(difficulty, event);
          }
        });
        toast.success("Pasted viseme values");
      },
      [
        clipboard,
        visemeTracks,
        dancerFaces,
        addDancerFaceEvent,
        updateDancerFaceEvent,
        difficulty,
      ]
    );

    const totalWidth =
      timelineData.measures.length * BEATS_PER_MEASURE * STEP_WIDTH;

    // Helper to check if a cell is selected
    const isCellSelected = (trackIndex: number, beatIndex: number) =>
      selectedEvents.some(
        (sel) => sel.trackIndex === trackIndex && sel.beatIndex === beatIndex
      );

    // Handler for selecting cells
    const handleCellSelect = useCallback(
      (trackIndex: number, beatIndex: number, e: React.MouseEvent) => {
        if (e.shiftKey && selectedEvents.length > 0) {
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
          // Prevent dialog from opening if shift is held
          return;
        } else if (e.ctrlKey || e.metaKey) {
          setSelectedEvents((prev) => {
            const exists = prev.some(
              (sel) =>
                sel.trackIndex === trackIndex && sel.beatIndex === beatIndex
            );
            if (exists) {
              return prev.filter(
                (sel) =>
                  !(
                    sel.trackIndex === trackIndex && sel.beatIndex === beatIndex
                  )
              );
            } else {
              return [...prev, { trackIndex, beatIndex }];
            }
          });
          // Prevent dialog from opening if ctrl/cmd is held
          return;
        } else {
          setSelectedEvents([{ trackIndex, beatIndex }]);
          openEditDialog(trackIndex, beatIndex);
        }
      },
      [selectedEvents, openEditDialog]
    );

    return (
      <div className="h-full flex flex-col bg-background text-white">
        {/* Toolbar */}
        <div className="flex-shrink-0 p-2 border-b bg-background flex items-center justify-between">
          <Button size="sm" onClick={() => setShowVisemeImport(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Viseme Track
          </Button>
          <div className="text-sm text-muted-foreground">
            {visemeTracks.length} viseme tracks
          </div>
        </div>

        {/* Timeline Content */}
        <div className="flex-1 relative overflow-hidden">
          {visemeTracks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
              <Smile className="h-12 w-12 mb-4 opacity-20" />
              <h3 className="text-lg font-medium mb-2">No Viseme Tracks</h3>
              <p className="text-sm text-center mb-4">
                Add a viseme from the Visemes list to get started.
              </p>
              <Button onClick={() => setShowVisemeImport(true)}>
                <Smile className="h-4 w-4 mr-1" /> Browse Visemes
              </Button>
            </div>
          ) : (
            <div
              className="h-full w-full overflow-auto"
              ref={timelineScrollRef}
            >
              <div className="relative" style={{ width: totalWidth }}>
                {/* Header */}
                <div className="sticky top-0 z-20 flex bg-background">
                  <div className="sticky left-0 z-30 w-48 flex-shrink-0 bg-background border-r border-b flex items-center p-2">
                    <span className="text-xs font-bold uppercase text-muted-foreground">
                      Viseme Tracks ({difficulty})
                    </span>
                  </div>
                  {timelineData.measures.map((measure, measureIndex) => (
                    <div
                      key={measure.number}
                      className="flex flex-col border-r cursor-pointer hover:bg-muted/20"
                      style={{
                        width: BEATS_PER_MEASURE * STEP_WIDTH,
                        minWidth: BEATS_PER_MEASURE * STEP_WIDTH,
                      }}
                      onClick={() => handleSeek(measure.startTime)}
                    >
                      <div className="h-6 flex items-center justify-center border-b text-sm font-medium">
                        Measure {measure.number}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Body */}
                <div className="flex">
                  {/* Track Info Column */}
                  <div className="sticky left-0 z-10 w-48 flex-shrink-0 bg-background">
                    {visemeTracks.map((viseme, trackIndex) => (
                      <div
                        key={trackIndex}
                        className={cn(
                          "h-12 border-b border-r flex items-center justify-between px-2 cursor-pointer",
                          selectedTrackIndex === trackIndex
                            ? "bg-accent"
                            : "hover:bg-muted/50"
                        )}
                        onClick={() =>
                          setSelectedTrackIndex(
                            trackIndex === selectedTrackIndex
                              ? null
                              : trackIndex
                          )
                        }
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              TRACK_COLORS[trackIndex % TRACK_COLORS.length]
                            }`}
                          />
                          <span className="text-sm truncate">{viseme}</span>
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
                    {visemeTracks.map((viseme, trackIndex) => (
                      <div key={trackIndex} className="flex h-12 border-b">
                        {timelineData.measures.map((_, measureIndex) => (
                          <React.Fragment key={measureIndex}>
                            {Array.from({
                              length: BEATS_PER_MEASURE,
                            }).map((__, beatPosition) => {
                              const beatIndex =
                                measureIndex * BEATS_PER_MEASURE + beatPosition;
                              const eventIdx = dancerFaces.findIndex(
                                (ev) =>
                                  ev.beat === beatIndex && ev.viseme === viseme
                              );
                              const hasEvent = eventIdx !== -1;
                              const isQuarter = true; // All beats are now quarter notes
                              const event = hasEvent
                                ? dancerFaces[eventIdx]
                                : null;
                              return (
                                <ContextMenu key={beatIndex}>
                                  <ContextMenuTrigger asChild>
                                    <div
                                      className={cn(
                                        "w-[80px] h-full flex flex-col items-center justify-center border-r cursor-pointer relative",
                                        isQuarter
                                          ? "bg-muted/10"
                                          : "bg-transparent",
                                        "hover:bg-muted/30",
                                        isCellSelected(trackIndex, beatIndex) &&
                                          "ring-2 ring-primary"
                                      )}
                                      onClick={(e) => {
                                        handleCellSelect(
                                          trackIndex,
                                          beatIndex,
                                          e
                                        );
                                        // Prevent dialog popup if shift, ctrl, or meta is held
                                        if (
                                          e.shiftKey ||
                                          e.ctrlKey ||
                                          e.metaKey
                                        )
                                          return;
                                        openEditDialog(trackIndex, beatIndex);
                                      }}
                                    >
                                      {/* Visual representation for existing event */}
                                      {hasEvent && (
                                        <>
                                          <div
                                            className={`w-5 h-5 rounded-full flex items-center justify-center`}
                                            title={`${Math.round(
                                              (event?.value ?? 1) * 100
                                            )}%`}
                                          >
                                            <span className="text-xs font-bold">
                                              {Math.round(
                                                (event?.value ?? 1) * 100
                                              )}
                                              %
                                            </span>
                                          </div>
                                          {/* Add a bar below to show intensity */}
                                          <div
                                            className={cn(
                                              "h-1 rounded",
                                              TRACK_COLORS[
                                                trackIndex % TRACK_COLORS.length
                                              ]
                                            )}
                                            style={{
                                              width: `${Math.max(
                                                8,
                                                Math.round(
                                                  (event?.value ?? 1) * 100
                                                )
                                              )}%`,
                                              maxWidth: "70px",
                                            }}
                                          />
                                        </>
                                      )}
                                    </div>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent>
                                    <ContextMenuItem
                                      onClick={() =>
                                        openEditDialog(trackIndex, beatIndex)
                                      }
                                    >
                                      {hasEvent ? "Edit" : "Add"} Viseme
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      onClick={() => {
                                        setSelectedEvents([
                                          { trackIndex, beatIndex },
                                        ]);
                                        handleCopy();
                                      }}
                                    >
                                      Copy
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      onClick={() => {
                                        setSelectedEvents([
                                          { trackIndex, beatIndex },
                                        ]);
                                        handlePaste(trackIndex, beatIndex);
                                      }}
                                      disabled={clipboard.length === 0}
                                    >
                                      Paste
                                    </ContextMenuItem>
                                    {hasEvent && (
                                      <ContextMenuItem
                                        onClick={() => {
                                          removeDancerFaceEvent(
                                            difficulty,
                                            eventIdx
                                          );
                                          addUndoAction({
                                            type: "visemes:remove",
                                            data: {
                                              track: difficulty,
                                              event,
                                            },
                                          });
                                        }}
                                      >
                                        Delete
                                      </ContextMenuItem>
                                    )}
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

        {/* Viseme Import Dialog */}
        <Dialog open={showVisemeImport} onOpenChange={setShowVisemeImport}>
          <DialogContent className="max-w-3xl h-[80vh]">
            <DialogHeader>
              <DialogTitle>Add Viseme Track</DialogTitle>
              <DialogDescription>
                Click on a viseme name to add it as a new track.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              <VisemesBanks
                onAddVisemeTrack={addVisemeAsTrack}
                className="h-[calc(80vh-100px)]"
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit/Add Dialog */}
        <Dialog
          open={editDialog.open}
          onOpenChange={(open) => setEditDialog((d) => ({ ...d, open }))}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editDialog.eventIndex !== null
                  ? "Edit Viseme Event"
                  : "Add Viseme Event"}
              </DialogTitle>
              <DialogDescription>
                Set the viseme value for this beat (0% = off, 100% = full).
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span>Value: {Math.round(editDialog.value * 100)}%</span>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[Math.round(editDialog.value * 100)]}
                  onValueChange={([val]) =>
                    setEditDialog((d) => ({
                      ...d,
                      value: Math.max(0, Math.min(1, val / 100)),
                    }))
                  }
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(editDialog.value * 100)}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setEditDialog((d) => ({
                      ...d,
                      value: Math.max(0, Math.min(1, val / 100)),
                    }));
                  }}
                  className="border rounded px-2 py-1 w-20"
                />
              </label>
              <div className="flex gap-2 justify-end">
                {editDialog.eventIndex !== null && (
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    type="button"
                  >
                    Delete
                  </Button>
                )}
                <Button onClick={handleSave} type="button">
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.currentTime === nextProps.currentTime &&
      prevProps.isPlaying === nextProps.isPlaying &&
      prevProps.autoScroll === nextProps.autoScroll &&
      prevProps.timelineData.measures.length ===
        nextProps.timelineData.measures.length &&
      prevProps.difficulty === nextProps.difficulty
    );
  }
);
