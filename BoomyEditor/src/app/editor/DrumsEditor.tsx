import { ImportedMoves } from '@/components/ImportedMoves';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { TimelineProvider } from '../contexts/TimelineContext';
import { SharedMovePreview } from '../components/SharedMovePreview';
import { NewTimelineRoot } from './timeline_new/NewTimelineRoot';

export function DrumsEditor() {
	return (
		<TimelineProvider>
			<div className="p-4 h-full max-w-[calc(100vw-260px)]">
				<ResizablePanelGroup direction="vertical">
					<ResizablePanel>
						<SharedMovePreview />
					</ResizablePanel>
					<ResizableHandle />
					<ResizablePanel>
						<NewTimelineRoot mode="drums"></NewTimelineRoot>
					</ResizablePanel>
				</ResizablePanelGroup>
			</div>
		</TimelineProvider>
	);
}
