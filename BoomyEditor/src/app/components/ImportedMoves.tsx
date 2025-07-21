import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSongStore } from '../store/songStore';

interface MoveClip {
	avg_beats_per_second: number;
	genre: string;
	era: string;
	flags: number;
	linked_to: string;
	linked_from: string;
}

interface MoveData {
	name: string;
	difficulty: number;
	display_name: string;
	song_name: string;
	clips: Record<string, MoveClip>;
}

const DIFFICULTY_LABELS = {
	0: 'Easy',
	1: 'Medium',
	2: 'Expert',
};

// Extend window type for caching
declare global {
	interface Window {
		__searchIndexCache?: Record<string, any>;
	}
}

// Helper to load and cache search index
async function loadSearchIndex(indexPath: string): Promise<any> {
	if (window.__searchIndexCache && window.__searchIndexCache[indexPath]) {
		return window.__searchIndexCache[indexPath];
	}
	const exists = await window.electronAPI.pathExists(indexPath);
	if (!exists) return null;
	const index = await window.electronAPI.readJsonFile(indexPath);
	if (!window.__searchIndexCache) window.__searchIndexCache = {};
	window.__searchIndexCache[indexPath] = index;
	return index;
}

interface ImportedMovesProps {
	className?: string;
	title?: string;
	filterByDifficulty?: 'easy' | 'medium' | 'expert';
	filterByChoreography?: boolean;
	showRemoveButtons?: boolean;
	showSearch?: boolean;
	maxHeight?: string;
	filterScoredOnly?: boolean;
}

export function ImportedMoves({
	className,
	title = 'Imported Moves',
	filterByDifficulty,
	filterByChoreography = false,
	showRemoveButtons = true,
	showSearch = true,
	maxHeight,
	filterScoredOnly = false,
}: ImportedMovesProps = {}) {
	const { currentSong, removeClipFromLibrary, removeMoveFromLibrary } =
		useSongStore();
	const [moveDataCache, setMoveDataCache] = useState<
		Record<string, MoveData>
	>({});
	const [imageCache, setImageCache] = useState<Record<string, string>>({});
	const [searchQuery, setSearchQuery] = useState('');
	const [searchIndex, setSearchIndex] = useState<any | null>(null);

	const moveLibPath = currentSong?.move_lib;

	// Load move data for each imported move and search index
	useEffect(() => {
		if (!moveLibPath || !currentSong?.moveLibrary) return;

		const moveLibrary = currentSong.moveLibrary;
		const moveKeys = Object.keys(moveLibrary);

		// If no moves, clear cache
		if (moveKeys.length === 0) {
			setMoveDataCache({});
			setImageCache({});
			setSearchIndex(null);
			return;
		}

		const loadMoveDataAndIndex = async () => {
			const newMoveDataCache: Record<string, MoveData> = {};
			const newImageCache: Record<string, string> = {};

			for (const [moveKey, clips] of Object.entries(moveLibrary)) {
				try {
					const [category, song, move] = moveKey.split('/');
					const movePath = `${moveLibPath}/${category}/${song}/${move}`;

					// Load move.json
					const jsonPath = `${movePath}/move.json`;
					const jsonExists = await window.electronAPI.pathExists(
						jsonPath
					);
					if (jsonExists) {
						const jsonData = await window.electronAPI.readJsonFile(
							jsonPath
						);
						newMoveDataCache[moveKey] = jsonData;
					}

					// Load move.png
					const imagePath = `${movePath}/move.png`;
					const imageExists = await window.electronAPI.pathExists(
						imagePath
					);
					if (imageExists) {
						try {
							const imageBuffer =
								await window.electronAPI.readFileBuffer(
									imagePath
								);
							const blob = new Blob([imageBuffer], {
								type: 'image/png',
							});
							const url = URL.createObjectURL(blob);
							newImageCache[moveKey] = url;
						} catch (err) {
							console.warn(
								'Failed to load move.png for',
								moveKey,
								err
							);
						}
					}
				} catch (err) {
					console.warn('Failed to load move data for', moveKey, err);
				}
			}

			// Load and cache search index
			const indexPath = `${moveLibPath}/indexes/search_index.min.json`;
			const index = await loadSearchIndex(indexPath);
			setSearchIndex(index);

			setMoveDataCache(newMoveDataCache);
			setImageCache(newImageCache);
		};

		loadMoveDataAndIndex();
	}, [currentSong?.moveLibrary, moveLibPath]);

	const handleClipRemove = (moveKey: string, clipPath: string) => {
		const [category, song, move, clip] = clipPath.split('/');
		removeClipFromLibrary(category, song, move, clip);
	};

	const handleMoveRemove = (moveKey: string) => {
		const [category, song, move] = moveKey.split('/');
		removeMoveFromLibrary(category, song, move);
	};

	// Decode flags based on bit values
	const decodeFlags = (flags: number): string[] => {
		const flagNames: string[] = [];
		if (flags & 2) flagNames.push('scored');
		if (flags & 8) flagNames.push('final_pose');
		if (flags & 0x10) flagNames.push('suppress_guide_gesture');
		if (flags & 0x20) flagNames.push('omit_minigame');
		if (flags & 0x40) flagNames.push('useful');
		if (flags & 0x80) flagNames.push('suppress_practice_options');
		return flagNames;
	};

	// Filter moves using search index
	const filteredMoves = useMemo(() => {
		let movesToFilter = currentSong?.moveLibrary || {};

		// Choreography filtering
		if (
			filterByChoreography &&
			currentSong?.timeline &&
			filterByDifficulty
		) {
			const choreographyMoves =
				currentSong.timeline[filterByDifficulty]?.moves || [];
			const choreographyMoveKeys = new Set(
				choreographyMoves.map(
					(move) =>
						`${move.move_origin}/${move.move_song}/${move.move}`
				)
			);
			movesToFilter = Object.fromEntries(
				Object.entries(movesToFilter).filter(([moveKey]) =>
					choreographyMoveKeys.has(moveKey)
				)
			);
		}

		// Difficulty filtering
		if (filterByDifficulty && !filterByChoreography) {
			const difficultyMap = { easy: 0, medium: 1, expert: 2 };
			const targetDifficulty = difficultyMap[filterByDifficulty];
			movesToFilter = Object.fromEntries(
				Object.entries(movesToFilter).filter(([moveKey]) => {
					const moveData = moveDataCache[moveKey];
					return moveData?.difficulty === targetDifficulty;
				})
			);
		}

		// Scored-only filtering
		if (filterScoredOnly) {
			movesToFilter = Object.fromEntries(
				Object.entries(movesToFilter)
					.map(([moveKey, clips]) => {
						const moveData = moveDataCache[moveKey];
						if (!moveData) return [moveKey, clips];
						const scoredClips = clips.filter((clipPath) => {
							const clipName = clipPath.split('/').pop() || '';
							const clip = moveData.clips[clipName];
							return clip && (clip.flags & 2) !== 0;
						});
						return [moveKey, scoredClips];
					})
					.filter(([_, clips]) => clips.length > 0)
			);
		}

		// Use search index for filtering
		if (!searchQuery.trim() || !searchIndex) {
			return movesToFilter;
		}

		const query = searchQuery.toLowerCase().trim();
		const filtered: Record<string, string[]> = {};

		// Assume searchIndex has a structure: { moves: { moveKey: { text: string, clips: { clipName: string } } } }
		Object.entries(movesToFilter).forEach(([moveKey, clips]) => {
			const moveIndex = searchIndex.moves?.[moveKey];
			if (!moveIndex) return;

			// Search in move text
			if (
				moveIndex.text &&
				moveIndex.text.toLowerCase().includes(query)
			) {
				filtered[moveKey] = clips;
				return;
			}

			// Search in clips
			const matchedClips = clips.filter((clipPath) => {
				const clipName = clipPath.split('/').pop() || '';
				const clipIndex = moveIndex.clips?.[clipName];
				if (!clipIndex) return false;
				return clipIndex.toLowerCase().includes(query);
			});
			if (matchedClips.length > 0) {
				filtered[moveKey] = matchedClips;
			}
		});

		return filtered;
	}, [
		currentSong?.moveLibrary,
		moveDataCache,
		searchQuery,
		filterByDifficulty,
		filterByChoreography,
		currentSong?.timeline,
		filterScoredOnly,
		searchIndex,
	]);

	if (
		!currentSong?.moveLibrary ||
		Object.keys(currentSong.moveLibrary).length === 0
	) {
		return (
			<div className="h-full flex items-center justify-center">
				<div className="text-center text-muted-foreground">
					<div className="text-sm">No imported moves</div>
					<div className="text-xs mt-1">
						Find your moves in the Move Library and import them into
						your song.
					</div>
				</div>
			</div>
		);
	}

	const hasFilteredResults = Object.keys(filteredMoves).length > 0;

	return (
		<div
			className={cn('h-full flex flex-col overflow-hidden', className)}
			style={maxHeight ? { maxHeight } : undefined}
		>
			{/* Header with search */}
			<div className="flex-shrink-0 p-4 border-b space-y-3">
				<h2 className="text-lg font-semibold">{title}</h2>

				{/* Search input */}
				{showSearch && (
					<div className="relative">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<input
							type="text"
							placeholder="Search moves, clips, genres, eras, flags..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full pl-10 pr-4 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
						/>
						{searchQuery && (
							<button
								onClick={() => setSearchQuery('')}
								className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
								title="Clear search"
							>
								<X className="h-3 w-3" />
							</button>
						)}
					</div>
				)}

				{/* Results count */}
				<div className="text-xs text-muted-foreground">
					{searchQuery
						? hasFilteredResults
							? `${Object.keys(filteredMoves).length} of ${
									Object.keys(currentSong.moveLibrary).length
							  } moves found`
							: `No moves found for "${searchQuery}"`
						: filterByChoreography && filterByDifficulty
						? `${
								Object.keys(filteredMoves).length
						  } moves in ${filterByDifficulty} choreography`
						: filterByDifficulty
						? `${
								Object.keys(filteredMoves).length
						  } ${filterByDifficulty} moves`
						: `${
								Object.keys(currentSong.moveLibrary).length
						  } moves total`}
				</div>
			</div>

			{/* Content area */}
			<div className="flex-1 overflow-auto p-4">
				{!hasFilteredResults && searchQuery ? (
					<div className="h-full flex items-center justify-center">
						<div className="text-center text-muted-foreground">
							<div className="text-sm">No moves found</div>
							<div className="text-xs mt-1">
								Try searching for move names, difficulties,
								genres, eras, or flags
							</div>
						</div>
					</div>
				) : (
					<div className="space-y-4">
						{Object.entries(filteredMoves).map(
							([moveKey, clips]) => {
								const moveData = moveDataCache[moveKey];
								const imageUrl = imageCache[moveKey];
								const [category, song, move] =
									moveKey.split('/');

								if (!moveData) {
									return (
										<div
											key={moveKey}
											className="border rounded-lg p-3"
										>
											<div className="text-sm text-muted-foreground">
												Loading {moveKey}...
											</div>
										</div>
									);
								}

								const difficultyLabel =
									DIFFICULTY_LABELS[
										moveData.difficulty as keyof typeof DIFFICULTY_LABELS
									] || 'Unknown';

								return (
									<div
										key={moveKey}
										className="border rounded-lg p-3"
									>
										{/* Move header */}
										<div className="flex gap-3 items-start mb-3">
											{imageUrl ? (
												<div className="flex-shrink-0">
													<img
														src={imageUrl}
														alt={`${moveData.display_name} preview`}
														className="w-32 h-16 object-cover rounded border"
													/>
												</div>
											) : (
												<div className="flex-shrink-0 w-32 h-16 bg-muted rounded border flex items-center justify-center">
													<span className="text-xs text-muted-foreground">
														No Image
													</span>
												</div>
											)}

											<div className="flex-1 min-w-0">
												<h3 className="text-sm font-semibold truncate">
													{moveData.display_name} (
													{moveData.name})
												</h3>
												<div className="text-xs text-muted-foreground">
													{difficultyLabel} •{' '}
													{moveData.song_name}
												</div>
											</div>

											{showRemoveButtons && (
												<button
													onClick={() =>
														handleMoveRemove(
															moveKey
														)
													}
													className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors"
													title="Remove all clips from this move"
												>
													<X className="h-4 w-4" />
												</button>
											)}
										</div>

										{/* Clips list */}
										<div className="space-y-2">
											{clips.map((clipPath) => {
												const clipName =
													clipPath.split('/').pop() ||
													'';
												const clip =
													moveData.clips[clipName];

												if (!clip) {
													return (
														<div
															key={clipPath}
															className="text-xs text-muted-foreground"
														>
															Unknown clip:{' '}
															{clipName}
														</div>
													);
												}

												return (
													<div
														key={clipPath}
														className="flex items-center justify-between p-2 bg-muted/30 rounded border"
														draggable={true}
														onDragStart={(e) => {
															// Store drag data
															const dragData = {
																type: 'move-clip',
																moveKey,
																clipPath,
																clipName,
																moveData: {
																	display_name:
																		moveData.display_name,
																	name: moveData.name,
																	song_name:
																		moveData.song_name,
																	difficulty:
																		moveData.difficulty,
																},
															};
															e.dataTransfer.setData(
																'application/json',
																JSON.stringify(
																	dragData
																)
															);
															e.dataTransfer.effectAllowed =
																'copy';
														}}
														onDragEnd={(e) => {
															// Reset any drag styling if needed
														}}
													>
														<div className="flex-1 min-w-0">
															<div className="text-sm font-medium truncate">
																{clipName}
															</div>
															<div className="text-xs text-muted-foreground">
																{clip.genre} •{' '}
																{clip.era}
																{decodeFlags(
																	clip.flags
																).length >
																	0 && (
																	<span className="ml-2 text-primary">
																		(
																		{decodeFlags(
																			clip.flags
																		).join(
																			', '
																		)}
																		)
																	</span>
																)}
															</div>
														</div>
														{showRemoveButtons && (
															<button
																onClick={() =>
																	handleClipRemove(
																		moveKey,
																		clipPath
																	)
																}
																className="flex-shrink-0 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
																title="Remove this clip"
															>
																<X className="h-3 w-3" />
															</button>
														)}
													</div>
												);
											})}
										</div>
									</div>
								);
							}
						)}
					</div>
				)}
			</div>
		</div>
	);
}
