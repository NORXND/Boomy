import { ImportedMoves } from "@/components/ImportedMoves";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { TimelineProvider } from "../contexts/TimelineContext";
import { SharedMovePreview } from "../components/SharedMovePreview";
import { NewTimelineRoot } from "./timeline_new/NewTimelineRoot";

export function MoveChoreography() {
  return (
    <TimelineProvider>
      <div className="p-4 h-full max-w-[calc(100vw-260px)]">
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel>
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel>
                <ImportedMoves />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel>
                <SharedMovePreview />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={55}>
            <NewTimelineRoot mode="choreography"></NewTimelineRoot>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TimelineProvider>
  );
}
