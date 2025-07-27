import React, { useState, useEffect, useMemo } from "react";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSongStore } from "../store/songStore";

interface MoveClip {
  avg_beats_per_second: number;
  genre: string;
  era: string;
  flags: number;
  linked_to: string;
  linked_from: string;
}

interface MoveData {
  name: string;
  difficulty: number;
  display_name: string;
  song_name: string;
  clips: Record<string, MoveClip>;
}

const DIFFICULTY_LABELS = {
  0: "Easy",
  1: "Medium",
  2: "Expert",
};

interface ImportedMovesProps {
  className?: string;
  title?: string;
  filterByDifficulty?: "easy" | "medium" | "expert";
  filterByChoreography?: boolean;
  showRemoveButtons?: boolean;
  showSearch?: boolean;
  maxHeight?: string;
  filterScoredOnly?: boolean;
}

export function ImportedMoves({ className, title = "Imported Moves", filterByDifficulty, filterByChoreography = false, showRemoveButtons = true, showSearch = true, maxHeight, filterScoredOnly = false }: ImportedMovesProps = {}) {
  const { currentSong, removeClipFromLibrary, removeMoveFromLibrary } = useSongStore();
  const [moveDataCache, setMoveDataCache] = useState<Record<string, MoveData>>({});
  const [imageCache, setImageCache] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const moveLibPath = currentSong?.move_lib;

  // Load move data for each imported move
  useEffect(() => {
    if (!moveLibPath || !currentSong?.moveLibrary) return;

    const moveLibrary = currentSong.moveLibrary;
    const moveKeys = Object.keys(moveLibrary);

    // If no moves, clear cache
    if (moveKeys.length === 0) {
      setMoveDataCache({});
      setImageCache({});
      return;
    }

    const loadMoveData = async () => {
      const newMoveDataCache: Record<string, MoveData> = {};
      const newImageCache: Record<string, string> = {};

      for (const [moveKey, clips] of Object.entries(moveLibrary)) {
        try {
          const [category, song, move] = moveKey.split("/");
          const movePath = `${moveLibPath}/${category}/${song}/${move}`;

          // Load move.json
          const jsonPath = `${movePath}/move.json`;
          const jsonExists = await window.electronAPI.pathExists(jsonPath);

          if (jsonExists) {
            const jsonData = await window.electronAPI.readJsonFile(jsonPath);
            newMoveDataCache[moveKey] = jsonData;
          }

          // Load move.png
          const imagePath = `${movePath}/move.png`;
          const imageExists = await window.electronAPI.pathExists(imagePath);

          if (imageExists) {
            try {
              const imageBuffer = await window.electronAPI.readFileBuffer(imagePath);
              const blob = new Blob([imageBuffer], {
                type: "image/png",
              });
              const url = URL.createObjectURL(blob);
              newImageCache[moveKey] = url;
            } catch (err) {
              console.warn("Failed to load move.png for", moveKey, err);
            }
          }
        } catch (err) {
          console.warn("Failed to load move data for", moveKey, err);
        }
      }

      setMoveDataCache(newMoveDataCache);
      setImageCache(newImageCache);
    };

    loadMoveData();
  }, [currentSong?.moveLibrary, moveLibPath]);

  const handleClipRemove = (moveKey: string, clipPath: string) => {
    const [category, song, move, clip] = clipPath.split("/");
    removeClipFromLibrary(category, song, move, clip);
  };

  const handleMoveRemove = (moveKey: string) => {
    const [category, song, move] = moveKey.split("/");
    removeMoveFromLibrary(category, song, move);
  };

  // Decode flags based on bit values
  const decodeFlags = (flags: number): string[] => {
    const flagNames: string[] = [];
    if (flags & 2) flagNames.push("scored");
    if (flags & 8) flagNames.push("final_pose");
    if (flags & 0x10) flagNames.push("suppress_guide_gesture");
    if (flags & 0x20) flagNames.push("omit_minigame");
    if (flags & 0x40) flagNames.push("useful");
    if (flags & 0x80) flagNames.push("suppress_practice_options");
    return flagNames;
  };

  // Filter moves based on search query and props
  const filteredMoves = useMemo(() => {
    let movesToFilter = currentSong?.moveLibrary || {};

    // First, apply choreography filtering if requested
    if (filterByChoreography && currentSong?.timeline && filterByDifficulty) {
      const choreographyMoves = currentSong.timeline[filterByDifficulty]?.moves || [];
      const choreographyMoveKeys = new Set(choreographyMoves.map((move) => `${move.move_origin}/${move.move_song}/${move.move}`));

      // Filter to only include moves that are in the choreography
      movesToFilter = Object.fromEntries(Object.entries(movesToFilter).filter(([moveKey]) => choreographyMoveKeys.has(moveKey)));
    }

    // Apply difficulty filtering if requested
    if (filterByDifficulty && !filterByChoreography) {
      const difficultyMap = { easy: 0, medium: 1, expert: 2 };
      const targetDifficulty = difficultyMap[filterByDifficulty];

      movesToFilter = Object.fromEntries(
        Object.entries(movesToFilter).filter(([moveKey]) => {
          const moveData = moveDataCache[moveKey];
          return moveData?.difficulty === targetDifficulty;
        }),
      );
    }

    // Apply scored-only filtering if requested
    if (filterScoredOnly) {
      movesToFilter = Object.fromEntries(
        Object.entries(movesToFilter)
          .map(([moveKey, clips]) => {
            const moveData = moveDataCache[moveKey];
            if (!moveData) return [moveKey, clips];

            // Filter clips to only include scored ones
            const scoredClips = clips.filter((clipPath) => {
              const clipName = clipPath.split("/").pop() || "";
              const clip = moveData.clips[clipName];
              return clip && (clip.flags & 2) !== 0; // Check for scored flag
            });

            return [moveKey, scoredClips];
          })
          .filter(([_, clips]) => clips.length > 0), // Remove moves with no scored clips
      );
    }

    // Apply search filtering if there's a search query
    if (!searchQuery.trim()) {
      return movesToFilter;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered: Record<string, string[]> = {};

    Object.entries(movesToFilter).forEach(([moveKey, clips]) => {
      const moveData = moveDataCache[moveKey];
      const [category, song, move] = moveKey.split("/");

      // Search in move metadata
      const searchableText = [moveData?.display_name || "", moveData?.name || "", moveData?.song_name || "", DIFFICULTY_LABELS[moveData?.difficulty as keyof typeof DIFFICULTY_LABELS] || "", category, song, move].join(" ").toLowerCase();

      // Search in clip data
      const clipMatches = clips.some((clipPath) => {
        const clipName = clipPath.split("/").pop() || "";
        const clip = moveData?.clips[clipName];

        const clipSearchableText = [clipName, clip?.genre || "", clip?.era || "", ...(clip ? decodeFlags(clip.flags) : [])].join(" ").toLowerCase();

        return clipSearchableText.includes(query);
      });

      if (searchableText.includes(query) || clipMatches) {
        filtered[moveKey] = clips;
      }
    });

    return filtered;
  }, [currentSong?.moveLibrary, moveDataCache, searchQuery, filterByDifficulty, filterByChoreography, currentSong?.timeline, filterScoredOnly]);

  // NEW: Build timelineMoves for choreography mode
  const timelineMoves = useMemo(() => {
    if (filterByChoreography && currentSong?.timeline && filterByDifficulty) {
      const moves = currentSong.timeline[filterByDifficulty]?.moves || [];
      return moves
        .map((moveEvent, idx) => {
          const moveKey = `${moveEvent.move_origin}/${moveEvent.move_song}/${moveEvent.move}`;
          const moveData = moveDataCache[moveKey];
          const allClips = currentSong.moveLibrary?.[moveKey] || [];
          const usedClip = allClips.find((clipPath) => {
            const clipName = clipPath.split("/").pop() || "";
            return clipName === moveEvent.clip;
          });
          return {
            id: `${moveKey}-${moveEvent.measure}-${idx}`,
            moveKey,
            clipPath: usedClip,
            clipName: moveEvent.clip,
            moveData,
            imageUrl: imageCache[moveKey],
            measure: moveEvent.measure,
            moveEvent,
          };
        })
        .filter((entry) => entry.clipPath); // Only show if the clip exists
    }
    return null;
  }, [filterByChoreography, currentSong?.timeline, filterByDifficulty, currentSong?.moveLibrary, moveDataCache, imageCache]);

  if (!currentSong?.moveLibrary || Object.keys(currentSong.moveLibrary).length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="text-sm">No imported moves</div>
          <div className="text-xs mt-1">Find your moves in the Move Library and import them into your song.</div>
        </div>
      </div>
    );
  }

  const hasFilteredResults = filterByChoreography ? timelineMoves && timelineMoves.length > 0 : Object.keys(filteredMoves).length > 0;

  return (
    <div className={cn("h-full flex flex-col overflow-hidden", className)} style={maxHeight ? { maxHeight } : undefined}>
      {/* Header with search */}
      <div className="flex-shrink-0 p-4 border-b space-y-3">
        <h2 className="text-lg font-semibold">{title}</h2>

        {/* Search input */}
        {showSearch && !filterByChoreography && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search moves, clips, genres, eras, flags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors" title="Clear search">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Results count */}
        <div className="text-xs text-muted-foreground">
          {filterByChoreography && filterByDifficulty
            ? `${timelineMoves?.length || 0} moves in ${filterByDifficulty} choreography`
            : searchQuery
              ? hasFilteredResults
                ? `${Object.keys(filteredMoves).length} of ${Object.keys(currentSong.moveLibrary).length} moves found`
                : `No moves found for "${searchQuery}"`
              : filterByDifficulty
                ? `${Object.keys(filteredMoves).length} ${filterByDifficulty} moves`
                : `${Object.keys(currentSong.moveLibrary).length} moves total`}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-4">
        {filterByChoreography && filterByDifficulty ? (
          !timelineMoves || timelineMoves.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <div className="text-sm">No moves found</div>
                <div className="text-xs mt-1">No moves in this choreography.</div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {timelineMoves.map((entry, idx) => {
                const { moveKey, clipPath, clipName, moveData, imageUrl, measure } = entry;
                if (!moveData) {
                  return (
                    <div key={entry.id} className="border rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Loading {moveKey}...</div>
                    </div>
                  );
                }
                const clip = moveData.clips[clipName];
                if (!clip) {
                  return (
                    <div key={entry.id} className="border rounded-lg p-3">
                      <div className="text-xs text-muted-foreground">Unknown clip: {clipName}</div>
                    </div>
                  );
                }
                const difficultyLabel = DIFFICULTY_LABELS[moveData.difficulty as keyof typeof DIFFICULTY_LABELS] || "Unknown";
                return (
                  <div
                    key={entry.id}
                    className="border rounded-lg p-3 flex gap-3 items-center"
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "application/json",
                        JSON.stringify({
                          type: "practice-measure",
                          measure: measure,
                        }),
                      );
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onDragEnd={() => {}}
                  >
                    {imageUrl ? (
                      <div className="flex-shrink-0">
                        <img src={imageUrl} alt={`${moveData.display_name} preview`} className="w-32 h-16 object-cover rounded border" />
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-32 h-16 bg-muted rounded border flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">No Image</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold truncate">
                        {moveData.display_name} ({moveData.name})
                      </h3>
                      <div className="text-xs text-muted-foreground">
                        {difficultyLabel} • {moveData.song_name} • Measure: {measure}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Clip: <span className="font-mono">{clipName}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-xs text-muted-foreground">
                        {clip.genre} • {clip.era}
                        {decodeFlags(clip.flags).length > 0 && <span className="ml-2 text-primary">({decodeFlags(clip.flags).join(", ")})</span>}
                      </div>
                      {showRemoveButtons && (
                        <button onClick={() => handleClipRemove(moveKey, clipPath)} className="flex-shrink-0 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors" title="Remove this clip">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="space-y-4">
            {Object.entries(filteredMoves).map(([moveKey, clips]) => {
              const moveData = moveDataCache[moveKey];
              const imageUrl = imageCache[moveKey];
              const [category, song, move] = moveKey.split("/");

              if (!moveData) {
                return (
                  <div key={moveKey} className="border rounded-lg p-3">
                    <div className="text-sm text-muted-foreground">Loading {moveKey}...</div>
                  </div>
                );
              }

              const difficultyLabel = DIFFICULTY_LABELS[moveData.difficulty as keyof typeof DIFFICULTY_LABELS] || "Unknown";

              return (
                <div key={moveKey} className="border rounded-lg p-3">
                  {/* Move header */}
                  <div className="flex gap-3 items-start mb-3">
                    {imageUrl ? (
                      <div className="flex-shrink-0">
                        <img src={imageUrl} alt={`${moveData.display_name} preview`} className="w-32 h-16 object-cover rounded border" />
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-32 h-16 bg-muted rounded border flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">No Image</span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold truncate">
                        {moveData.display_name} ({moveData.name})
                      </h3>
                      <div className="text-xs text-muted-foreground">
                        {difficultyLabel} • {moveData.song_name}
                      </div>
                    </div>

                    {showRemoveButtons && (
                      <button onClick={() => handleMoveRemove(moveKey)} className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors" title="Remove all clips from this move">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Clips list */}
                  <div className="space-y-2">
                    {clips.map((clipPath) => {
                      const clipName = clipPath.split("/").pop() || "";
                      const clip = moveData.clips[clipName];

                      if (!clip) {
                        return (
                          <div key={clipPath} className="text-xs text-muted-foreground">
                            Unknown clip: {clipName}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={clipPath}
                          className="flex items-center justify-between p-2 bg-muted/30 rounded border"
                          draggable={true}
                          onDragStart={(e) => {
                            // Store drag data
                            const dragData = {
                              type: "move-clip",
                              moveKey,
                              clipPath,
                              clipName,
                              moveData: {
                                display_name: moveData.display_name,
                                name: moveData.name,
                                song_name: moveData.song_name,
                                difficulty: moveData.difficulty,
                              },
                            };
                            e.dataTransfer.setData("application/json", JSON.stringify(dragData));
                            e.dataTransfer.effectAllowed = "copy";
                          }}
                          onDragEnd={(e) => {
                            // Reset any drag styling if needed
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{clipName}</div>
                            <div className="text-xs text-muted-foreground">
                              {clip.genre} • {clip.era}
                              {decodeFlags(clip.flags).length > 0 && <span className="ml-2 text-primary">({decodeFlags(clip.flags).join(", ")})</span>}
                            </div>
                          </div>
                          {showRemoveButtons && (
                            <button onClick={() => handleClipRemove(moveKey, clipPath)} className="flex-shrink-0 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors" title="Remove this clip">
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
