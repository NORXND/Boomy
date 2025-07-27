import { TimelineProvider } from "../contexts/TimelineContext";
import { NewTimelineRoot } from "./timeline_new/NewTimelineRoot";

export function EventsEditor() {
  return (
    <TimelineProvider>
      <div className="p-4 h-full max-w-[calc(100vw-260px)]">
        <NewTimelineRoot mode="events"></NewTimelineRoot>
      </div>
    </TimelineProvider>
  );
}
