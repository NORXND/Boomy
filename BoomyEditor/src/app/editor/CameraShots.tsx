import { CameraPredefinedPositions } from '@/components/CameraPredefinedPositions';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { TimelineRoot } from './timeline/TimelineRoot';
import { TimelineProvider } from '../contexts/TimelineContext';
import { SharedMovePreview } from '@/components/SharedMovePreview';

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
						<TimelineRoot type="cameras" />
					</ResizablePanel>
				</ResizablePanelGroup>
			</div>
		</TimelineProvider>
	);
}
