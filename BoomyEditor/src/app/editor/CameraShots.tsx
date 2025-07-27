import { CameraPredefinedPositions } from "@/components/CameraPredefinedPositions";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { TimelineProvider } from "../contexts/TimelineContext";
import { SharedMovePreview } from "@/components/SharedMovePreview";
import { NewTimelineRoot } from "./timeline_new/NewTimelineRoot";

export function CameraShots() {
  return (
    <TimelineProvider>
      <div className="p-4 h-full max-w-[calc(100vw-260px)]">
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel>
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel>
                <CameraPredefinedPositions />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel>
                <SharedMovePreview />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel>
            <NewTimelineRoot mode="cameras"></NewTimelineRoot>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TimelineProvider>
  );
}
