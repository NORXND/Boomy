import { useState, useEffect, useMemo } from "react";
import { X, Search, Plus, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSongStore } from "../store/songStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import path from "path-browserify";
import { toast } from "sonner";

interface VisemesBanksProps {
  onSelect?: (viseme: string) => void;
  onAddVisemeTrack?: (bankName: string) => void;
  className?: string;
}

const VISEMES = [
  "Angry",
  "Concentrate",
  "Excited",
  "Grin",
  "Mouth_Open",
  "O_Face",
  "Open_Smile",
  "Open_Smile_02",
  "Pursed",
  "Sexy",
  "Smile",
  "Smirk",
  "Squash_High",
  "Squash_Low",
  "brow_angry_left",
  "brow_angry_right",
  "brow_down_left",
  "brow_down_right",
  "brow_sad_left",
  "brow_sad_right",
  "brow_up_left",
  "brow_up_right",
  "eye_squint_left",
  "eye_squint_right",
  "eye_wide_left",
  "eye_wide_right",
  "talkBlinkLeft",
  "talkBlinkRight",
  "talkCockedLeft",
  "talkCkockedRight",
  "talkEyesWide",
  "talkFurrowed",
  "talkPleading",
  "talkRaised",
  "talkSquintLeft",
  "talkSquintRight",
];

export function VisemesBanks({ onSelect, onAddVisemeTrack, className }: VisemesBanksProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedViseme, setSelectedViseme] = useState<string | null>(null);

  const filteredVisemes = useMemo(() => {
    if (!searchQuery.trim()) return VISEMES;
    const query = searchQuery.toLowerCase();
    return VISEMES.filter((viseme) => viseme.toLowerCase().includes(query));
  }, [searchQuery]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header with search */}
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold mb-2">Dancer Faces Expressions (Visemes)</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="text" placeholder="Search visemes..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-full overflow-y-auto">
          <ScrollArea className="h-full">
            <div className="p-2">
              {filteredVisemes.map((viseme) => (
                <Button
                  key={viseme}
                  variant={selectedViseme === viseme ? "default" : "ghost"}
                  className="w-full justify-start mb-1"
                  onClick={() => {
                    setSelectedViseme(viseme);
                    onSelect?.(viseme);
                  }}
                >
                  <Music className="h-4 w-4 mr-2" />
                  <span className="truncate">{viseme}</span>
                  {onAddVisemeTrack && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 p-1 ml-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddVisemeTrack(viseme);
                        toast("Track Added", {
                          description: `Added ${viseme} as expression track`,
                        });
                      }}
                      title="Add as Expression Track"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
