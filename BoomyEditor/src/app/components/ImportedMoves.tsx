import React, { useState, useEffect, useMemo } from 'react';
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

export function ImportedMoves() {
	const { currentSong, removeClipFromLibrary, removeMoveFromLibrary } =
		useSongStore();
	const [moveDataCache, setMoveDataCache] = useState<
		Record<string, MoveData>
	>({});
	const [imageCache, setImageCache] = useState<Record<string, string>>({});
	const [searchQuery, setSearchQuery] = useState('');

	const moveLibPath = currentSong?.move_lib;

	// Load move data for each imported move
	useEffect(() => {
		if (!moveLibPath || !currentSong?.moveLibrary) return;

		const moveLibrary = currentSong.moveLibrary;
		const moveKeys = Object.keys(moveLibrary);

		// If no moves, clear cache
		if (moveKeys.length === 0) {
			setMoveDataCache({});
			setImageCache({});
			return;
		}

		const loadMoveData = async () => {
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

			setMoveDataCache(newMoveDataCache);
			setImageCache(newImageCache);
		};

		loadMoveData();
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

	// Filter moves based on search query
	const filteredMoves = useMemo(() => {
		if (!currentSong?.moveLibrary || !searchQuery.trim()) {
			return currentSong?.moveLibrary || {};
		}

		const query = searchQuery.toLowerCase().trim();
		const filtered: Record<string, string[]> = {};

		Object.entries(currentSong.moveLibrary).forEach(([moveKey, clips]) => {
			const moveData = moveDataCache[moveKey];
			const [category, song, move] = moveKey.split('/');

			// Search in move metadata
			const searchableText = [
				moveData?.display_name || '',
				moveData?.name || '',
				moveData?.song_name || '',
				DIFFICULTY_LABELS[
					moveData?.difficulty as keyof typeof DIFFICULTY_LABELS
				] || '',
				category,
				song,
				move,
			]
				.join(' ')
				.toLowerCase();

			// Search in clip data
			const clipMatches = clips.some((clipPath) => {
				const clipName = clipPath.split('/').pop() || '';
				const clip = moveData?.clips[clipName];

				const clipSearchableText = [
					clipName,
					clip?.genre || '',
					clip?.era || '',
					...(clip ? decodeFlags(clip.flags) : []),
				]
					.join(' ')
					.toLowerCase();

				return clipSearchableText.includes(query);
			});

			if (searchableText.includes(query) || clipMatches) {
				filtered[moveKey] = clips;
			}
		});

		return filtered;
	}, [currentSong?.moveLibrary, moveDataCache, searchQuery]);

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
		<div className="h-full flex flex-col overflow-hidden">
			{/* Header with search */}
			<div className="flex-shrink-0 p-4 border-b space-y-3">
				<h2 className="text-lg font-semibold">Imported Moves</h2>

				{/* Search input */}
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

				{/* Results count */}
				<div className="text-xs text-muted-foreground">
					{searchQuery
						? hasFilteredResults
							? `${Object.keys(filteredMoves).length} of ${
									Object.keys(currentSong.moveLibrary).length
							  } moves found`
							: `No moves found for "${searchQuery}"`
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

											<button
												onClick={() =>
													handleMoveRemove(moveKey)
												}
												className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors"
												title="Remove all clips from this move"
											>
												<X className="h-4 w-4" />
											</button>
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
