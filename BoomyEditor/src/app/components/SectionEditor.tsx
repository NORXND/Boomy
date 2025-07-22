import React, { useState } from 'react';
import { Plus, X, Trash2, MoveIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSongStore } from '../store/songStore';
import { MoveEvent } from '../types/song';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

interface SectionEditorProps {
	className?: string;
	selectedDifficulty?: 'easy' | 'medium' | 'expert';
	onDifficultyChange?: (difficulty: 'easy' | 'medium' | 'expert') => void;
}

const DIFFICULTY_LABELS = {
	easy: 'Easy',
	medium: 'Medium',
	expert: 'Expert',
};

export function SectionEditor({
	className,
	selectedDifficulty: externalSelectedDifficulty,
	onDifficultyChange,
}: SectionEditorProps) {
	const {
		currentSong,
		addPracticeSection,
		removePracticeSection,
		addMoveToPracticeSection,
		removeMoveFromPracticeSection,
	} = useSongStore();

	const [dragOverSection, setDragOverSection] = useState<{
		difficulty: 'easy' | 'medium' | 'expert';
		sectionIndex: number;
	} | null>(null);

	const [internalSelectedDifficulty, setInternalSelectedDifficulty] =
		useState<'easy' | 'medium' | 'expert'>('easy');

	// Use external state if provided, otherwise use internal state
	const selectedDifficulty =
		externalSelectedDifficulty || internalSelectedDifficulty;
	const setSelectedDifficulty =
		onDifficultyChange || setInternalSelectedDifficulty;

	// Collect all used moves across all sections for the selected difficulty
	const getUsedMoves = (difficulty: 'easy' | 'medium' | 'expert') => {
		const sections = currentSong.practice?.[difficulty] || [];
		const timelineMoves = currentSong.timeline?.[difficulty]?.moves || [];
		const usedMoveNames = new Set<string>();
		sections.forEach((section) => {
			section.forEach((beat) => {
				const move = timelineMoves.find((m) => m.beat === beat);
				if (move) usedMoveNames.add(move.move);
			});
		});
		return usedMoveNames;
	};

	const handleDragOver = (
		e: React.DragEvent,
		difficulty: 'easy' | 'medium' | 'expert',
		sectionIndex: number
	) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
		setDragOverSection({ difficulty, sectionIndex });
	};

	const handleDragLeave = () => {
		setDragOverSection(null);
	};

	const handleDrop = (
		e: React.DragEvent,
		difficulty: 'easy' | 'medium' | 'expert',
		sectionIndex: number
	) => {
		e.preventDefault();
		setDragOverSection(null);

		try {
			const dragData = JSON.parse(
				e.dataTransfer.getData('application/json')
			);

			if (dragData.type === 'practice-beat') {
				const timelineMoves =
					currentSong.timeline?.[difficulty]?.moves || [];
				const move = timelineMoves.find(
					(m) => m.beat === dragData.beat
				);
				const usedMoveNames = getUsedMoves(difficulty);
				if (move && usedMoveNames.has(move.move)) {
					// Prevent adding if move name is already used (regardless of clip)
					return;
				}
				addMoveToPracticeSection(
					difficulty,
					sectionIndex,
					dragData.beat
				);
			}
		} catch (error) {
			console.error('Failed to parse drag data:', error);
		}
	};

	const handleAddSection = (difficulty: 'easy' | 'medium' | 'expert') => {
		addPracticeSection(difficulty, '');
	};

	const handleRemoveSection = (
		difficulty: 'easy' | 'medium' | 'expert',
		sectionIndex: number
	) => {
		removePracticeSection(difficulty, sectionIndex);
	};

	const handleRemoveMove = (
		difficulty: 'easy' | 'medium' | 'expert',
		sectionIndex: number,
		moveIndex: number
	) => {
		removeMoveFromPracticeSection(difficulty, sectionIndex, moveIndex);
	};

	if (!currentSong) {
		return (
			<div
				className={cn(
					'h-full flex items-center justify-center',
					className
				)}
			>
				<div className="text-center text-muted-foreground">
					<div className="text-sm">No song loaded</div>
					<div className="text-xs mt-1">
						Load a song to create practice sections
					</div>
				</div>
			</div>
		);
	}

	const renderSection = (
		difficulty: 'easy' | 'medium' | 'expert',
		sectionIndex: number,
		beats: number[]
	) => {
		const isDropTarget =
			dragOverSection?.difficulty === difficulty &&
			dragOverSection?.sectionIndex === sectionIndex;

		const timelineMoves = currentSong.timeline?.[difficulty]?.moves || [];
		const usedMoveNames = getUsedMoves(difficulty);

		return (
			<div
				key={sectionIndex}
				className={cn(
					'border-2 border-dashed rounded-lg p-4 transition-colors',
					isDropTarget
						? 'border-primary bg-primary/10'
						: 'border-muted bg-background',
					beats.length === 0 &&
						'min-h-[120px] flex flex-col justify-center'
				)}
				onDragOver={(e) => {
					// Only allow drag over if the move is not already used
					try {
						const dragData = JSON.parse(
							e.dataTransfer.getData('application/json')
						);
						if (dragData.type === 'practice-beat') {
							const move = timelineMoves.find(
								(m) => m.beat === dragData.beat
							);
							if (move && usedMoveNames.has(move.move)) {
								e.dataTransfer.dropEffect = 'none';
								return;
							}
						}
					} catch {}
					e.preventDefault();
					e.dataTransfer.dropEffect = 'copy';
					setDragOverSection({ difficulty, sectionIndex });
				}}
				onDragLeave={handleDragLeave}
				onDrop={(e) => handleDrop(e, difficulty, sectionIndex)}
			>
				{/* Section Header */}
				<div className="flex items-center justify-between mb-3">
					<h4 className="text-sm font-medium text-muted-foreground">
						Section {sectionIndex + 1}
					</h4>
					<Button
						variant="ghost"
						size="sm"
						onClick={() =>
							handleRemoveSection(difficulty, sectionIndex)
						}
						className="text-destructive hover:text-destructive/90 h-6 w-6 p-0"
					>
						<Trash2 className="h-3 w-3" />
					</Button>
				</div>

				{/* Section Content */}
				{beats.length === 0 ? (
					<div className="text-center text-muted-foreground">
						<MoveIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
						<div className="text-sm">Drop moves here</div>
						<div className="text-xs mt-1">
							Drag moves from the right panel to add them to this
							section
						</div>
					</div>
				) : (
					<div className="space-y-2">
						{beats.map((beat, moveIndex) => {
							const move = timelineMoves.find(
								(m) => m.beat === beat
							);
							return (
								<div
									key={moveIndex}
									className="flex items-center justify-between p-2 bg-muted/50 rounded border"
								>
									<div className="flex-1 min-w-0">
										<div className="text-sm font-medium truncate">
											{move
												? `${move.move} - ${move.clip}`
												: `Unknown move at beat ${beat}`}
										</div>
										<div className="text-xs text-muted-foreground">
											{move
												? `${move.move_origin}/${move.move_song}`
												: ''}
										</div>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() =>
											handleRemoveMove(
												difficulty,
												sectionIndex,
												moveIndex
											)
										}
										className="text-destructive hover:text-destructive/90 h-6 w-6 p-0 ml-2"
									>
										<X className="h-3 w-3" />
									</Button>
								</div>
							);
						})}
					</div>
				)}
			</div>
		);
	};

	const renderDifficultyContent = (
		difficulty: 'easy' | 'medium' | 'expert'
	) => {
		const sections = currentSong.practice?.[difficulty] || [];

		return (
			<div className="space-y-4">
				{/* Add Section Button */}
				<Button
					onClick={() => handleAddSection(difficulty)}
					variant="outline"
					className="w-full"
				>
					<Plus className="h-4 w-4 mr-2" />
					Add Section
				</Button>

				{/* Sections List */}
				{sections.length === 0 ? (
					<div className="text-center text-muted-foreground py-8">
						<div className="text-sm">No sections created yet</div>
						<div className="text-xs mt-1">
							Create your first section to start organizing moves
						</div>
					</div>
				) : (
					<div className="space-y-4">
						{sections.map(
							(section: number[], sectionIndex: number) =>
								renderSection(difficulty, sectionIndex, section)
						)}
					</div>
				)}
			</div>
		);
	};

	return (
		<div className={cn('h-full overflow-hidden', className)}>
			<Tabs
				value={selectedDifficulty}
				onValueChange={(value) =>
					setSelectedDifficulty(value as 'easy' | 'medium' | 'expert')
				}
				className="h-full flex flex-col"
			>
				{/* Header */}
				<div className="flex-shrink-0 p-4 border-b">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-semibold">
							Practice Sections
						</h2>
					</div>

					{/* Difficulty Tabs */}
					<TabsList className="grid w-full grid-cols-3">
						{Object.entries(DIFFICULTY_LABELS).map(
							([key, label]) => (
								<TabsTrigger
									key={key}
									value={key}
									className="capitalize"
								>
									{label}
								</TabsTrigger>
							)
						)}
					</TabsList>
				</div>

				{/* Content Area */}
				<div className="flex-1 overflow-auto p-4">
					{(
						Object.keys(DIFFICULTY_LABELS) as (
							| 'easy'
							| 'medium'
							| 'expert'
						)[]
					).map((difficulty) => (
						<TabsContent
							key={difficulty}
							value={difficulty}
							className="h-full mt-0"
						>
							{renderDifficultyContent(difficulty)}
						</TabsContent>
					))}
				</div>
			</Tabs>
		</div>
	);
}
