import React, { useState, useEffect } from "react";
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

interface MovePreviewProps {
  movePath: string;
  category: string;
  song: string;
  move: string;
}

const DIFFICULTY_LABELS = {
  0: "Easy",
  1: "Medium",
  2: "Expert",
};

export function MovePreview({ movePath, category, song, move }: MovePreviewProps) {
  const { addClipToLibrary } = useSongStore();
  const [moveData, setMoveData] = useState<MoveData | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!movePath) return;

    loadMoveData();
  }, [movePath]);

  const loadMoveData = async () => {
    setLoading(true);
    setError(null);
    setMoveData(null);
    setImageUrl(null);

    try {
      // Load move.json
      const jsonPath = `${movePath}/move.json`;
      const jsonExists = await window.electronAPI.pathExists(jsonPath);

      if (!jsonExists) {
        setError("move.json not found");
        return;
      }

      const jsonData = await window.electronAPI.readJsonFile(jsonPath);
      setMoveData(jsonData);

      // Load move.png
      const imagePath = `${movePath}/move.png`;
      const imageExists = await window.electronAPI.pathExists(imagePath);

      if (imageExists) {
        try {
          const imageBuffer = await window.electronAPI.readFileBuffer(imagePath);
          const blob = new Blob([imageBuffer], { type: "image/png" });
          const url = URL.createObjectURL(blob);
          setImageUrl(url);
        } catch (err) {
          console.warn("Failed to load move.png:", err);
          // Don't set error, just continue without image
        }
      }
    } catch (err) {
      setError(`Failed to load move data: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  // Extract linked move name by removing the last part (version)
  const getLinkedMoveName = (linkedName: string): string => {
    if (!linkedName) return "";
    const parts = linkedName.split("_");
    if (parts.length > 1) {
      return parts.slice(0, -1).join("_");
    }
    return linkedName;
  };

  // Get first clip's linking info
  const getFirstClipLinking = (): {
    linkedTo: string;
    linkedFrom: string;
  } => {
    if (!moveData?.clips) return { linkedTo: "", linkedFrom: "" };

    const firstClip = Object.values(moveData.clips)[0];
    if (!firstClip) return { linkedTo: "", linkedFrom: "" };

    return {
      linkedTo: getLinkedMoveName(firstClip.linked_to),
      linkedFrom: getLinkedMoveName(firstClip.linked_from),
    };
  };

  const handleClipSelect = (clipName: string) => {
    console.log("handleClipSelect called with:", {
      category,
      song,
      move,
      clipName,
    });
    addClipToLibrary(category, song, move, clipName);
    console.log("Added clip to library:", `${category}/${song}/${move}/${clipName}`);
  };

  // Decode flags based on bit values
  const decodeFlags = (flags: number): string[] => {
    const flagNames: string[] = [];
    if (flags & 2) flagNames.push("Scored");
    if (flags & 8) flagNames.push("Final Pose");
    if (flags & 0x10) flagNames.push("Suppress Guide Gesture");
    if (flags & 0x20) flagNames.push("Omit Minigame");
    if (flags & 0x40) flagNames.push("Useful");
    if (flags & 0x80) flagNames.push("Suppress Practice Options");
    return flagNames;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm text-muted-foreground">Loading move preview...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-destructive">
          <div className="text-sm font-medium">Error loading move</div>
          <div className="text-xs mt-1">{error}</div>
        </div>
      </div>
    );
  }

  if (!moveData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="text-sm">Select a move to preview</div>
        </div>
      </div>
    );
  }

  const { linkedTo, linkedFrom } = getFirstClipLinking();
  const difficultyLabel = DIFFICULTY_LABELS[moveData.difficulty as keyof typeof DIFFICULTY_LABELS] || "Unknown";

  return (
    <div className="h-full overflow-auto p-4">
      <div className="space-y-4">
        {/* Header with image and basic info */}
        <div className="flex gap-4 items-start">
          {imageUrl ? (
            <div className="flex-shrink-0">
              <img src={imageUrl} alt={`${moveData.display_name} preview`} className="w-44 h-22 object-cover rounded-lg border" onError={() => setImageUrl(null)} />
            </div>
          ) : (
            <div className="flex-shrink-0 w-44 h-22 bg-muted rounded-lg border flex items-center justify-center">
              <span className="text-xs text-muted-foreground">No Image</span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold truncate">
              {moveData.display_name} ({moveData.name})
            </h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>
                <span className="font-medium">Difficulty:</span> {difficultyLabel}
              </div>
              <div>
                <span className="font-medium">Song:</span> {moveData.song_name}
              </div>
            </div>
          </div>
        </div>

        {/* Linking information */}
        {(linkedTo || linkedFrom) && (
          <div className="bg-muted/50 rounded-lg p-3">
            <h4 className="text-sm font-medium mb-2">Move Links</h4>
            <div className="space-y-1 text-xs">
              {linkedFrom && (
                <div>
                  <span className="font-medium">Linked From:</span> {linkedFrom}
                </div>
              )}
              {linkedTo && (
                <div>
                  <span className="font-medium">Linked To:</span> {linkedTo}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Clips list */}
        <div>
          <h4 className="text-sm font-medium mb-2">Clips ({Object.keys(moveData.clips).length})</h4>
          <div className="space-y-2">
            {Object.entries(moveData.clips).map(([clipName, clip]) => (
              <div key={clipName} className={cn("p-3 border rounded-lg cursor-pointer transition-colors", "hover:bg-muted/50 hover:border-primary/50")} onClick={() => handleClipSelect(clipName)}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-sm truncate">{clipName}</div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <div>
                        Genre: {clip.genre} • Era: {clip.era}
                      </div>
                      <div>
                        Flags:
                        {decodeFlags(clip.flags).length > 0 && <span className="ml-2 text-primary">{decodeFlags(clip.flags).join(", ")}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    <div className="w-2 h-2 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
