import { ImportedMoves } from '@/components/ImportedMoves';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';

export function PracticeSections() {
	return (
		<div className="p-4 max-h-full h-full">
			<ResizablePanelGroup direction="horizontal">
				<ResizablePanel>{/* <SectionEditor /> */}</ResizablePanel>
				<ResizableHandle />
				<ResizablePanel>
					<ImportedMoves />
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}
