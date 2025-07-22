import React, { useState } from 'react';
import { ImportedMoves } from '@/components/ImportedMoves';
import { SectionEditor } from '@/components/SectionEditor';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';

export function PracticeSections() {
	const [selectedDifficulty, setSelectedDifficulty] = useState<
		'easy' | 'medium' | 'expert'
	>('easy');

	return (
		<div className="p-4 max-h-full h-full">
			<ResizablePanelGroup direction="horizontal">
				<ResizablePanel defaultSize={60}>
					<SectionEditor
						selectedDifficulty={selectedDifficulty}
						onDifficultyChange={setSelectedDifficulty}
					/>
				</ResizablePanel>
				<ResizableHandle />
				<ResizablePanel defaultSize={40}>
					<ImportedMoves
						filterByDifficulty={selectedDifficulty}
						filterByChoreography={true}
						showRemoveButtons={false}
						showSearch={false}
						maxHeight="100%"
						filterScoredOnly={true}
					/>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}
