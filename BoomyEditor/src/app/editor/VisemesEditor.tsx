import { ImportedMoves } from "@/components/ImportedMoves";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { TimelineProvider } from "../contexts/TimelineContext";
import { SharedMovePreview } from "../components/SharedMovePreview";
import { NewTimelineRoot } from "./timeline_new/NewTimelineRoot";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

export function VisemesEditor() {
  const [diff, setDiff] = useState("medium");

  return (
    <TimelineProvider>
      <div className="p-4 h-full max-w-[calc(100vw-260px)]">
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel>
            <SharedMovePreview onDifficultyChange={(difficulty: "easy" | "medium" | "expert") => setDiff(difficulty)} />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel>
            <NewTimelineRoot
              mode="visemes"
              timelineAdditionalProps={{
                difficulty: diff,
              }}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TimelineProvider>
  );
}
