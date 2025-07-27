import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { MoveFileExplorer } from "../components/MoveFileExplorer";
import { MovePreview } from "../components/MovePreview";
import { ImportedMoves } from "../components/ImportedMoves";
import { useState } from "react";

export function MovesLibrary() {
  const [selectedMove, setSelectedMove] = useState<{
    path: string;
    category: string;
    song: string;
    move: string;
  } | null>(null);

  const handleMoveSelect = (path: string, category: string, song: string, move: string) => {
    setSelectedMove({ path, category, song, move });
  };

  return (
    <div className="p-4 max-h-full h-full">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel>
          <MoveFileExplorer onMoveSelect={handleMoveSelect} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={40}>
              {selectedMove ? (
                <MovePreview movePath={selectedMove.path} category={selectedMove.category} song={selectedMove.song} move={selectedMove.move} />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <div className="text-sm">Select a move to preview</div>
                  </div>
                </div>
              )}
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={60}>
              <ImportedMoves />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
