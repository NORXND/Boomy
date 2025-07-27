import React, { useState } from "react";
import { Plus, X, Trash2, MoveIcon, WandSparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SongState, useSongStore } from "../store/songStore";
import { MoveEvent } from "../types/song";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

interface SectionEditorProps {
  className?: string;
  selectedDifficulty?: "easy" | "medium" | "expert";
  onDifficultyChange?: (difficulty: "easy" | "medium" | "expert") => void;
}

const DIFFICULTY_LABELS = {
  easy: "Easy",
  medium: "Medium",
  expert: "Expert",
};

export function SectionEditor({ className, selectedDifficulty: externalSelectedDifficulty, onDifficultyChange }: SectionEditorProps) {
  const { currentSong, addPracticeSection, removePracticeSection, addMoveToPracticeSection, removeMoveFromPracticeSection } = useSongStore();
  const songState = useSongStore();

  const [dragOverSection, setDragOverSection] = useState<{
    difficulty: "easy" | "medium" | "expert";
    sectionIndex: number;
  } | null>(null);

  const [internalSelectedDifficulty, setInternalSelectedDifficulty] = useState<"easy" | "medium" | "expert">("easy");

  // Use external state if provided, otherwise use internal state
  const selectedDifficulty = externalSelectedDifficulty || internalSelectedDifficulty;
  const setSelectedDifficulty = onDifficultyChange || setInternalSelectedDifficulty;

  // Collect all used moves across all sections for the selected difficulty
  const getUsedMoves = (difficulty: "easy" | "medium" | "expert") => {
    const sections = currentSong.practice?.[difficulty] || [];
    const timelineMoves = currentSong.timeline?.[difficulty]?.moves || [];
    const usedMoveNames = new Set<string>();
    sections.forEach((section) => {
      section.forEach((measure) => {
        const move = timelineMoves.find((m) => m.measure === measure);
        if (move) usedMoveNames.add(move.move);
      });
    });
    return usedMoveNames;
  };

  const handleDragOver = (e: React.DragEvent, difficulty: "easy" | "medium" | "expert", sectionIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverSection({ difficulty, sectionIndex });
  };

  const handleDragLeave = () => {
    setDragOverSection(null);
  };

  const handleDrop = (e: React.DragEvent, difficulty: "easy" | "medium" | "expert", sectionIndex: number) => {
    e.preventDefault();
    setDragOverSection(null);

    try {
      const dragData = JSON.parse(e.dataTransfer.getData("application/json"));

      if (dragData.type === "practice-measure") {
        const timelineMoves = currentSong.timeline?.[difficulty]?.moves || [];
        const move = timelineMoves.find((m) => m.measure === dragData.measure);
        const usedMoveNames = getUsedMoves(difficulty);
        if (move && usedMoveNames.has(move.move)) {
          // Prevent adding if move name is already used (regardless of clip)
          return;
        }
        addMoveToPracticeSection(difficulty, sectionIndex, dragData.measure);
      }
    } catch (error) {
      console.error("Failed to parse drag data:", error);
    }
  };

  const handleAddSection = (difficulty: "easy" | "medium" | "expert") => {
    addPracticeSection(difficulty, "");
  };

  const handleRemoveSection = (difficulty: "easy" | "medium" | "expert", sectionIndex: number) => {
    removePracticeSection(difficulty, sectionIndex);
  };

  const handleRemoveMove = (difficulty: "easy" | "medium" | "expert", sectionIndex: number, moveIndex: number) => {
    removeMoveFromPracticeSection(difficulty, sectionIndex, moveIndex);
  };

  const checkMove = async (state: SongState, move: string, song: string, category: string) => {
    const movePath = `${state.currentSong.move_lib}/${category}/${song}/${move}`;

    // Load move.json
    const jsonPath = `${movePath}/move.json`;
    const jsonExists = await window.electronAPI.pathExists(jsonPath);
    if (jsonExists) {
      const jsonData = await window.electronAPI.readJsonFile(jsonPath);
      return jsonData;
    } else {
      return null;
    }
  };

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

  const handleGenerateSection = async (difficulty: "easy" | "medium" | "expert") => {
    if (!currentSong) return;

    const timelineMoves = currentSong.timeline?.[difficulty]?.moves || [];
    if (!timelineMoves.length) return;

    // 1. Strip all rest moves (keep only scored)
    const scoredMoves: MoveEvent[] = [];
    for (const move of timelineMoves) {
      const moveData = await checkMove(songState, move.move, move.move_song, move.move_origin);
      if (!moveData) continue;
      const flags = decodeFlags(moveData.clips?.[move.clip]?.flags || 0);
      if (flags.includes("Scored")) {
        scoredMoves.push(move);
      }
    }

    // Track first occurrence of each move
    const firstOccurrence = new Map<string, number>();
    scoredMoves.forEach((move, idx) => {
      if (!firstOccurrence.has(move.move)) {
        firstOccurrence.set(move.move, idx);
      }
    });

    const sections: number[][] = [];
    let usedMoves = new Set<string>();
    let currentSection: number[] = [];

    for (let i = 0; i < scoredMoves.length; i++) {
      const move = scoredMoves[i];
      const moveKey = move.move;

      // If this is NOT the first occurrence of this move, skip it and start new section at next original move
      if (firstOccurrence.get(moveKey) !== i) {
        if (currentSection.length > 0) sections.push([...currentSection]);
        currentSection = [];
        continue;
      }

      // Check for duplicate in current section or previously used
      const isDuplicateInSection = currentSection.some((measure) => {
        const m = scoredMoves.find((sm) => sm.measure === measure);
        return m && m.move === moveKey;
      });
      const isUsedBefore = usedMoves.has(moveKey);

      if (isDuplicateInSection || isUsedBefore) {
        if (currentSection.length > 0) sections.push([...currentSection]);
        currentSection = [];
      }

      currentSection.push(move.measure);
      usedMoves.add(moveKey);
    }

    if (currentSection.length > 0) sections.push(currentSection);

    // Save generated sections
    // Clear previous sections first if needed
    while ((currentSong.practice?.[difficulty]?.length || 0) > 0) {
      removePracticeSection(difficulty, 0);
    }
    for (const section of sections) {
      addPracticeSection(difficulty, "");
      const sectionIdx = (currentSong.practice?.[difficulty]?.length || 0) - 1;
      section.forEach((measure) => {
        addMoveToPracticeSection(difficulty, sectionIdx, measure);
      });
    }
  };

  if (!currentSong) {
    return (
      <div className={cn("h-full flex items-center justify-center", className)}>
        <div className="text-center text-muted-foreground">
          <div className="text-sm">No song loaded</div>
          <div className="text-xs mt-1">Load a song to create practice sections</div>
        </div>
      </div>
    );
  }

  const renderSection = (difficulty: "easy" | "medium" | "expert", sectionIndex: number, measures: number[]) => {
    const isDropTarget = dragOverSection?.difficulty === difficulty && dragOverSection?.sectionIndex === sectionIndex;

    const timelineMoves = currentSong.timeline?.[difficulty]?.moves || [];
    const usedMoveNames = getUsedMoves(difficulty);

    return (
      <div
        key={sectionIndex}
        className={cn("border-2 border-dashed rounded-lg p-4 transition-colors", isDropTarget ? "border-primary bg-primary/10" : "border-muted bg-background", measures.length === 0 && "min-h-[120px] flex flex-col justify-center")}
        onDragOver={(e) => {
          // Only allow drag over if the move is not already used
          try {
            const dragData = JSON.parse(e.dataTransfer.getData("application/json"));
            if (dragData.type === "practice-measure") {
              const move = timelineMoves.find((m) => m.measure === dragData.measure);
              if (move && usedMoveNames.has(move.move)) {
                e.dataTransfer.dropEffect = "none";
                return;
              }
            }
          } catch {}
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDragOverSection({ difficulty, sectionIndex });
        }}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, difficulty, sectionIndex)}
      >
        {/* Section Header */}
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-muted-foreground">Section {sectionIndex + 1}</h4>
          <Button variant="ghost" size="sm" onClick={() => handleRemoveSection(difficulty, sectionIndex)} className="text-destructive hover:text-destructive/90 h-6 w-6 p-0">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {/* Section Content */}
        {measures.length === 0 ? (
          <div className="text-center text-muted-foreground">
            <MoveIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <div className="text-sm">Drop moves here</div>
            <div className="text-xs mt-1">Drag moves from the right panel to add them to this section</div>
          </div>
        ) : (
          <div className="space-y-2">
            {measures.map((measure, moveIndex) => {
              const move = timelineMoves.find((m) => m.measure === measure);
              return (
                <div key={moveIndex} className="flex items-center justify-between p-2 bg-muted/50 rounded border">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{move ? `${move.move} - ${move.clip}` : `Unknown move at measure ${measure}`}</div>
                    <div className="text-xs text-muted-foreground">
                      {move ? `${move.move_origin}/${move.move_song}` : ""}
                      {` • Measure: ${measure}`}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveMove(difficulty, sectionIndex, moveIndex)} className="text-destructive hover:text-destructive/90 h-6 w-6 p-0 ml-2">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderDifficultyContent = (difficulty: "easy" | "medium" | "expert") => {
    const sections = currentSong.practice?.[difficulty] || [];

    return (
      <div className="space-y-4">
        {/* Add Section Button */}
        <div className="flex flex-row gap-4">
          <Button onClick={() => handleAddSection(difficulty)} variant="outline" className="flex-1">
            <Plus className="h-4 w-4 mr-2" />
            Add Section
          </Button>
          <Button variant="outline" onClick={() => handleGenerateSection(difficulty)}>
            <WandSparkles width={16} height={16}></WandSparkles>
          </Button>
        </div>

        {/* Sections List */}
        {sections.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <div className="text-sm">No sections created yet</div>
            <div className="text-xs mt-1">Create your first section to start organizing moves</div>
          </div>
        ) : (
          <div className="space-y-4">{sections.map((section: number[], sectionIndex: number) => renderSection(difficulty, sectionIndex, section))}</div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("h-full overflow-hidden", className)}>
      <Tabs value={selectedDifficulty} onValueChange={(value) => setSelectedDifficulty(value as "easy" | "medium" | "expert")} className="h-full flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Practice Sections</h2>
          </div>

          {/* Difficulty Tabs */}
          <TabsList className="grid w-full grid-cols-3">
            {Object.entries(DIFFICULTY_LABELS).map(([key, label]) => (
              <TabsTrigger key={key} value={key} className="capitalize">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4">
          {(Object.keys(DIFFICULTY_LABELS) as ("easy" | "medium" | "expert")[]).map((difficulty) => (
            <TabsContent key={difficulty} value={difficulty} className="h-full mt-0">
              {renderDifficultyContent(difficulty)}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
