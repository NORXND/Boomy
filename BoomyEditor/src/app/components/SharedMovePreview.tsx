import React, { useEffect, useState, useMemo, useCallback } from "react";
import { PersonStanding } from "lucide-react";
import { useSongStore } from "../store/songStore";
import { useTimelineContext } from "../contexts/TimelineContext";

interface MoveData {
  name: string;
  difficulty: number;
  display_name: string;
  song_name: string;
  clips: Record<string, any>;
}

interface TimelineMove {
  measure: number;
  clip: string;
  move_origin: string;
  move_song: string;
  move: string;
  originalIndex: number;
  time: number; // calculated time in seconds
  difficulty: string;
}

interface SharedMovePreviewProps {
  onDifficultyChange?: (difficulty: "easy" | "medium" | "expert") => void;
}

export function SharedMovePreview({ onDifficultyChange }: SharedMovePreviewProps) {
  const { currentSong } = useSongStore();
  const { currentTime, timelineData } = useTimelineContext();
  const [selectedTrack, setSelectedTrack] = useState<"easy" | "medium" | "expert">("medium");
  const [moveImageCache, setMoveImageCache] = useState<Record<string, string>>({});
  const [moveDataCache, setMoveDataCache] = useState<Record<string, MoveData>>({});
  const [createdUrls, setCreatedUrls] = useState<string[]>([]);

  // Convert beat number to time using timeline data
  const beatToTime = useCallback(
    (beat: number): number => {
      if (!timelineData) return 0;

      // Find the measure that contains this beat
      for (const measure of timelineData.measures) {
        if (beat >= measure.number && beat < measure.number + 1) {
          // Beat is within this measure
          // For simplicity, we'll assume beats align with measure boundaries
          return measure.startTime;
        }
      }

      // If beat is beyond all measures, calculate based on last measure
      const lastMeasure = timelineData.measures[timelineData.measures.length - 1];
      if (lastMeasure && beat >= lastMeasure.number) {
        // Calculate based on BPM of last measure
        const beatDuration = 60 / lastMeasure.bpm; // seconds per beat
        const extraBeats = beat - lastMeasure.number;
        return lastMeasure.startTime + extraBeats * beatDuration;
      }

      return 0;
    },
    [timelineData],
  );

  // Load move images and data
  useEffect(() => {
    let isMounted = true;
    const urls: string[] = [];
    if (!currentSong || !currentSong.move_lib) return;

    const loadMoveData = async () => {
      const newImageCache: Record<string, string> = {};
      const newDataCache: Record<string, MoveData> = {};
      const moveLibPath = currentSong.move_lib;

      // Get all unique move keys from timeline
      const allMoveKeys = new Set<string>();
      ["easy", "medium", "expert"].forEach((difficulty) => {
        const moves = currentSong.timeline[difficulty as keyof typeof currentSong.timeline]?.moves || [];
        moves.forEach((move) => {
          const moveKey = `${move.move_origin}/${move.move_song}/${move.move}`;
          allMoveKeys.add(moveKey);
        });
      });

      // Load images and data for each unique move
      for (const moveKey of allMoveKeys) {
        try {
          const [category, song, move] = moveKey.split("/");
          const movePath = `${moveLibPath}/${category}/${song}/${move}`;

          // Load move.json for display name
          const jsonPath = `${movePath}/move.json`;
          const jsonExists = await window.electronAPI.pathExists(jsonPath);
          if (jsonExists) {
            const jsonData = await window.electronAPI.readJsonFile(jsonPath);
            newDataCache[moveKey] = jsonData;
          }

          // Load move.png
          const imagePath = `${movePath}/move.png`;
          const imageExists = await window.electronAPI.pathExists(imagePath);
          if (imageExists) {
            const imageBuffer = await window.electronAPI.readFileBuffer(imagePath);
            const blob = new Blob([imageBuffer], {
              type: "image/png",
            });
            const url = URL.createObjectURL(blob);
            newImageCache[moveKey] = url;
            urls.push(url);
          }
        } catch (err) {
          console.warn("Failed to load move data for", moveKey, err);
        }
      }

      if (isMounted) {
        setMoveImageCache(newImageCache);
        setMoveDataCache(newDataCache);
        setCreatedUrls(urls);
      }
    };

    loadMoveData();

    return () => {
      isMounted = false;
      // Clean up created object URLs
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [currentSong]);

  // Convert timeline moves to time-based moves and find current/adjacent moves
  const { previousMove, currentMove, nextMove } = useMemo(() => {
    if (!currentSong || !timelineData) {
      return { previousMove: null, currentMove: null, nextMove: null };
    }

    // Get moves only from selected track
    const moves = currentSong.timeline[selectedTrack]?.moves || [];
    const allMoves: TimelineMove[] = [];

    moves.forEach((move, index) => {
      const time = beatToTime(move.measure);

      allMoves.push({
        ...move,
        originalIndex: index,
        time: time,
        difficulty: selectedTrack,
      });
    });

    // Sort moves by time
    allMoves.sort((a, b) => a.time - b.time);

    // Find the current move (last move that has started)
    let currentIndex = -1;
    for (let i = allMoves.length - 1; i >= 0; i--) {
      if (allMoves[i].time <= currentTime) {
        currentIndex = i;
        break;
      }
    }

    const currentMove = currentIndex >= 0 ? allMoves[currentIndex] : null;
    const previousMove = currentIndex > 0 ? allMoves[currentIndex - 1] : null;
    const nextMove = currentIndex < allMoves.length - 1 ? allMoves[currentIndex + 1] : null;

    return { previousMove, currentMove, nextMove };
  }, [currentSong, currentTime, timelineData, beatToTime, selectedTrack]);

  const renderMoveCard = (move: TimelineMove | null, size: "small" | "large", position: "left" | "center" | "right") => {
    if (!move) {
      return (
        <div className={`flex flex-col items-center justify-center bg-muted/30 rounded-lg border-2 border-dashed border-muted/50 transition-all duration-500 ${size === "large" ? "w-60 h-48" : "w-32 h-24"}`}>
          <PersonStanding className={`text-muted-foreground ${size === "large" ? "h-8 w-8" : "h-6 w-6"}`} />
          <span className="text-xs text-muted-foreground mt-1">No move</span>
        </div>
      );
    }

    const moveKey = `${move.move_origin}/${move.move_song}/${move.move}`;
    const imageUrl = moveImageCache[moveKey];
    const moveData = moveDataCache[moveKey];
    const displayName = moveData?.display_name || move.move;

    // Calculate opacity and scale based on position and timing
    const timeDiff = move.time - currentTime;
    const isActive = timeDiff <= 0 && timeDiff > -2; // Active for 2 seconds after start
    const opacity = size === "large" ? 1 : isActive ? 0.8 : 0.6;

    return (
      <div
        className={`flex flex-col items-center justify-center bg-background rounded-lg border transition-all duration-500 transform ${size === "large" ? "w-60 h-48 border-primary scale-110 shadow-lg" : "w-32 h-24 border-muted scale-95"} ${
          position === "left" ? "-translate-x-3 opacity-75" : position === "right" ? "translate-x-3 opacity-75" : ""
        }`}
        style={{ opacity }}
        title={`${displayName} - ${move.clip} (${move.difficulty})\nMeasure: ${move.measure}, Time: ${move.time.toFixed(1)}s`}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={displayName} className={`object-cover rounded transition-all duration-500 ${size === "large" ? "w-36 h-16" : "w-24 h-12"}`} draggable={false} />
        ) : (
          <div className={`bg-muted/50 rounded flex items-center justify-center transition-all duration-500 ${size === "large" ? "w-36 h-16" : "w-24 h-12"}`}>
            <PersonStanding className={`text-muted-foreground ${size === "large" ? "h-6 w-6" : "h-4 w-4"}`} />
          </div>
        )}
        <div className={`text-center mt-1 px-1 ${size === "large" ? "text-xs" : "text-xs"}`}>
          <div className="font-medium truncate max-w-full">{displayName}</div>
          <div className="text-muted-foreground text-xs truncate">{move.clip}</div>
          <div className="text-muted-foreground text-xs capitalize">{move.difficulty}</div>
        </div>
      </div>
    );
  };

  if (!currentSong) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="text-sm">No song loaded</div>
          <div className="text-xs mt-1">Load a song to see move preview</div>
        </div>
      </div>
    );
  }

  // Track selection handler
  const handleTrackChange = (track: "easy" | "medium" | "expert") => {
    setSelectedTrack(track);
    if (onDifficultyChange) onDifficultyChange(track);
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b bg-background/80 backdrop-blur-sm">
        <h3 className="text-lg font-semibold">Move Preview</h3>
        <div className="text-sm text-muted-foreground">
          Timeline: {currentTime.toFixed(2)}s{timelineData && <span className="ml-2">• {timelineData.measures.length} measures</span>}
        </div>

        {/* Track Selection Tabs */}
        <div className="flex gap-1 mt-3 p-1 bg-muted/30 rounded-lg">
          {(["easy", "medium", "expert"] as const).map((track) => (
            <button
              key={track}
              onClick={() => handleTrackChange(track)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 capitalize ${
                selectedTrack === track ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {track}
            </button>
          ))}
        </div>
      </div>

      {/* Move Cards */}
      <div className="flex-1 flex items-center justify-center gap-8 p-8">
        {/* Previous Move */}
        <div className="flex flex-col items-center transition-all duration-500">
          <div className="text-xs text-muted-foreground mb-3 font-medium">Previous</div>
          {renderMoveCard(previousMove, "small", "left")}
        </div>

        {/* Current Move */}
        <div className="flex flex-col items-center transition-all duration-500">
          <div className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
            Current
          </div>
          {renderMoveCard(currentMove, "large", "center")}
        </div>

        {/* Next Move */}
        <div className="flex flex-col items-center transition-all duration-500">
          <div className="text-xs text-muted-foreground mb-3 font-medium">Next</div>
          {renderMoveCard(nextMove, "small", "right")}
        </div>
      </div>
    </div>
  );
}
