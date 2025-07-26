import React, { useState, useEffect, useMemo } from 'react';
import {
	ChevronRightIcon,
	GamepadIcon,
	DiscIcon,
	PersonStandingIcon,
	Search,
	X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSongStore } from '../store/songStore';
import { SearchIndex } from '@/types/song';
import Fuse from 'fuse.js';
import { Button } from '@/components/ui/button'; // If you use a Button component

interface FileSystemItem {
	name: string;
	path: string;
	isDirectory: boolean;
	children?: FileSystemItem[];
	isExpanded?: boolean;
	isLoaded?: boolean;
}

interface MoveFileExplorerProps {
	onMoveSelect?: (
		movePath: string,
		category: string,
		song: string,
		move: string
	) => void;
}

const GAME_CATEGORIES = [
	'dc1',
	'dc2',
	'dc3',
	'dc1_dlc',
	'dc2_dlc',
	'dc3_dlc',
	'dcs',
];

const CATEGORY_LABELS = {
	dc1: 'Dance Central 1',
	dc2: 'Dance Central 2',
	dc3: 'Dance Central 3',
	dc1_dlc: 'Dance Central 1 DLCs',
	dc2_dlc: 'Dance Central 2 DLCs',
	dc3_dlc: 'Dance Central 3 DLCs',
	dcs: 'Dance Central Spotlight',
};

export function MoveFileExplorer({ onMoveSelect }: MoveFileExplorerProps) {
	const { currentSong } = useSongStore();
	const [categories, setCategories] = useState<FileSystemItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [pendingQuery, setPendingQuery] = useState('');
	const [searchIndex, setSearchIndex] = useState<SearchIndex | null>(null);
	const [searchMode, setSearchMode] = useState<'move' | 'song'>('move');

	const moveLibraryPath = currentSong?.move_lib;

	// Initialize categories
	useEffect(() => {
		if (!moveLibraryPath) {
			setCategories([]);
			return;
		}

		const initCategories: FileSystemItem[] = GAME_CATEGORIES.map(
			(category) => ({
				name: category,
				path: `${moveLibraryPath}/${category}`,
				isDirectory: true,
				isExpanded: false,
				isLoaded: false,
				children: [] as FileSystemItem[],
			})
		);

		setCategories(initCategories);
	}, [moveLibraryPath]);

	useEffect(() => {
		const loadSearchIndex = async () => {
			if (!currentSong?.move_lib) return;

			const indexPath = `${currentSong.move_lib}/indexes/search_index.min.json`;

			try {
				// Load the index from the file system
				const index = await window.electronAPI.readJsonFile(indexPath);

				setSearchIndex(index as SearchIndex);
			} catch (error) {
				console.error('Failed to load search index:', error);
			}
		};

		loadSearchIndex();
	}, [currentSong?.move_lib]);

	const loadDirectoryContents = async (
		item: FileSystemItem
	): Promise<FileSystemItem[]> => {
		try {
			const exists = await window.electronAPI.pathExists(item.path);
			if (!exists) {
				return [];
			}

			const contents = await window.electronAPI.readDirectory(item.path);
			return contents
				.filter((entry) => entry.isDirectory) // Only show directories for this explorer
				.map((entry) => ({
					name: entry.name,
					path: `${item.path}/${entry.name}`,
					isDirectory: entry.isDirectory,
					isExpanded: false,
					isLoaded: false,
					children: [] as FileSystemItem[],
				}))
				.sort((a, b) => a.name.localeCompare(b.name));
		} catch (err) {
			console.error('Failed to load directory:', err);
			throw err;
		}
	};

	const toggleExpansion = async (targetPath: string) => {
		if (!moveLibraryPath) return;

		setLoading(true);
		setError(null);

		try {
			setCategories((prevCategories) => {
				return prevCategories.map((category) => {
					if (category.path === targetPath) {
						return {
							...category,
							isExpanded: !category.isExpanded,
						};
					}
					return updateItemInTree(category, targetPath, (item) => ({
						...item,
						isExpanded: !item.isExpanded,
					}));
				});
			});

			// Load children if expanding and not loaded yet
			const targetItem = findItemInTree(categories, targetPath);
			if (targetItem && !targetItem.isExpanded && !targetItem.isLoaded) {
				const children = await loadDirectoryContents(targetItem);

				setCategories((prevCategories) => {
					return prevCategories.map((category) => {
						if (category.path === targetPath) {
							return {
								...category,
								children,
								isLoaded: true,
							};
						}
						return updateItemInTree(
							category,
							targetPath,
							(item) => ({
								...item,
								children,
								isLoaded: true,
							})
						);
					});
				});
			}
		} catch (err) {
			setError(`Failed to load directory: ${err}`);
		} finally {
			setLoading(false);
		}
	};

	const findItemInTree = (
		items: FileSystemItem[],
		targetPath: string
	): FileSystemItem | null => {
		for (const item of items) {
			if (item.path === targetPath) {
				return item;
			}
			if (item.children) {
				const found = findItemInTree(item.children, targetPath);
				if (found) return found;
			}
		}
		return null;
	};

	const updateItemInTree = (
		item: FileSystemItem,
		targetPath: string,
		updater: (item: FileSystemItem) => FileSystemItem
	): FileSystemItem => {
		if (item.path === targetPath) {
			return updater(item);
		}

		if (item.children) {
			return {
				...item,
				children: item.children.map((child) =>
					updateItemInTree(child, targetPath, updater)
				),
			};
		}

		return item;
	};

	const handleMoveClick = (item: FileSystemItem) => {
		if (!onMoveSelect) return;

		// Parse the path to extract category, song, and move
		const pathParts = item.path
			.replace(moveLibraryPath + '/', '')
			.split('/');

		if (pathParts.length >= 3) {
			const category = pathParts[0];
			const song = pathParts[1];
			const move = pathParts[2];

			onMoveSelect(item.path, category, song, move);
		}
	};

	// Memoize Fuse indexes so they are only recreated when the index changes
	const songFuse = useMemo(() => {
		if (!searchIndex) return null;
		const songList = Object.entries(searchIndex.songs_by_name || {}).map(
			([songKey, songData]) => {
				const [categoryKey, songName] = songKey.split(':');
				return { songKey, songName, categoryKey, name: songName };
			}
		);

		return new Fuse(songList, {
			keys: ['name', 'songName'],
			threshold: 0.2, // More forgiving for partial matches
			ignoreLocation: true,
			minMatchCharLength: 1,
		});
	}, [searchIndex]);

	const moveFuse = useMemo(() => {
		if (!searchIndex) return null;
		const moveList = Object.entries(searchIndex.moves_by_name || {}).map(
			([moveKey, moveData]) => {
				const [categoryKey, songName, moveName] = moveKey.split(':');
				return {
					moveKey,
					moveName,
					songName,
					categoryKey,
					name: moveName, // Only search by move name!
				};
			}
		);
		return new Fuse(moveList, {
			keys: ['name'],
			threshold: 0.2,
			ignoreLocation: true,
			minMatchCharLength: 2,
		});
	}, [searchIndex]);

	// Filter and flatten the tree structure when searching
	const filteredCategories = useMemo(() => {
		if (!searchQuery.trim() || !searchIndex || !songFuse || !moveFuse) {
			return categories;
		}

		const query = searchQuery.trim();
		const grouped: Record<string, FileSystemItem> = {};

		if (searchMode === 'song') {
			const songResults = songFuse.search(query);
			songResults.forEach(({ item }) => {
				const { categoryKey, songName } = item;
				if (!grouped[categoryKey]) {
					const matchingCategory = categories.find(
						(c) => c.name === categoryKey
					);
					if (matchingCategory) {
						grouped[categoryKey] = {
							...matchingCategory,
							children: [],
							isExpanded: true,
							isLoaded: true,
						};
					}
				}
				const category = grouped[categoryKey];
				if (
					category &&
					!category.children?.find((s) => s.name === songName)
				) {
					// Find all moves for this song
					const moves: FileSystemItem[] = [];
					if (searchIndex && searchIndex.moves_by_name) {
						Object.entries(searchIndex.moves_by_name).forEach(
							([moveKey]) => {
								const [cat, song, move] = moveKey.split(':');
								if (cat === categoryKey && song === songName) {
									moves.push({
										name: move,
										path: `${category.path}/${songName}/${move}`,
										isDirectory: false,
									});
								}
							}
						);
					}
					const song: FileSystemItem = {
						name: songName,
						path: `${category.path}/${songName}`,
						isDirectory: true,
						isExpanded: true,
						isLoaded: true,
						children: moves.sort((a, b) =>
							a.name.localeCompare(b.name)
						),
					};
					category.children?.push(song);
				}
			});
		} else {
			// Moves: show move in its song/category, expand all
			const moveResults = moveFuse.search(query);
			moveResults.forEach(({ item }) => {
				const { categoryKey, songName, moveName } = item;
				if (!grouped[categoryKey]) {
					const matchingCategory = categories.find(
						(c) => c.name === categoryKey
					);
					if (matchingCategory) {
						grouped[categoryKey] = {
							...matchingCategory,
							children: [],
							isExpanded: true,
							isLoaded: true,
						};
					}
				}
				const category = grouped[categoryKey];
				if (category) {
					let song = category.children?.find(
						(s) => s.name === songName
					);
					if (!song) {
						song = {
							name: songName,
							path: `${category.path}/${songName}`,
							isDirectory: true,
							isExpanded: true,
							isLoaded: true,
							children: [],
						};
						category.children?.push(song);
					}
					if (!song.children?.find((m) => m.name === moveName)) {
						const move: FileSystemItem = {
							name: moveName,
							path: `${song.path}/${moveName}`,
							isDirectory: false,
						};
						song.children?.push(move);
					}
				}
			});
		}

		return Object.values(grouped);
	}, [categories, searchQuery, searchIndex, songFuse, moveFuse, searchMode]);

	// Count total moves in filtered results
	const countMovesInTree = (items: FileSystemItem[]): number => {
		let count = 0;
		for (const item of items) {
			const pathParts = item.path
				.replace(moveLibraryPath + '/', '')
				.split('/');
			const isMove = pathParts.length >= 3;

			if (isMove) {
				count++;
			}

			if (item.children) {
				count += countMovesInTree(item.children);
			}
		}
		return count;
	};

	const filteredMoveCount = useMemo(() => {
		return countMovesInTree(filteredCategories);
	}, [filteredCategories, moveLibraryPath]);

	const totalMoveCount = useMemo(() => {
		return countMovesInTree(categories);
	}, [categories, moveLibraryPath]);

	const renderItem = (item: FileSystemItem, level: number = 0) => {
		const pathParts = item.path
			.replace(moveLibraryPath + '/', '')
			.split('/');
		const isCategory = level === 0;
		const isSong = level === 1;
		const isMove = level === 2;

		const displayName = isCategory
			? CATEGORY_LABELS[item.name as keyof typeof CATEGORY_LABELS] ||
			  item.name
			: item.name;

		return (
			<div key={`${item.path}`} className="max-h-full">
				<div
					className={cn(
						'flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-muted/50 select-none',
						level > 0 && 'ml-4',
						isMove && 'hover:bg-primary/10'
					)}
					style={{ paddingLeft: `${level * 16 + 8}px` }}
					onClick={() => {
						if (isMove) {
							handleMoveClick(item);
						} else {
							toggleExpansion(item.path);
						}
					}}
				>
					{item.isDirectory && !isMove && (
						<ChevronRightIcon
							className={cn(
								'h-4 w-4 transition-transform text-muted-foreground',
								item.isExpanded && 'rotate-90'
							)}
						/>
					)}
					{!item.isDirectory || isMove ? (
						<PersonStandingIcon className="h-4 w-4 text-muted-foreground" />
					) : isSong ? (
						<DiscIcon
							className={cn(
								'h-4 w-4',
								item.isExpanded
									? 'text-primary'
									: 'text-muted-foreground'
							)}
						/>
					) : (
						<GamepadIcon
							className={cn(
								'h-4 w-4',
								item.isExpanded
									? 'text-primary'
									: 'text-muted-foreground'
							)}
						/>
					)}
					<span
						className={cn(
							'text-sm',
							isCategory && 'font-medium',
							isSong && 'font-normal text-muted-foreground',
							isMove && 'font-light hover:text-primary'
						)}
					>
						{displayName}
					</span>
				</div>

				{item.isExpanded && item.children && (
					<div>
						{item.children.map((child) =>
							renderItem(child, level + 1)
						)}
					</div>
				)}
			</div>
		);
	};

	if (!moveLibraryPath) {
		return (
			<div className="p-4 text-center text-muted-foreground">
				<p>No move library loaded</p>
				<p className="text-xs mt-1">
					Load a song with a move library to browse moves
				</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-4 text-center text-destructive">
				<p>Error loading move library</p>
				<p className="text-xs mt-1">{error}</p>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col overflow-hidden">
			{/* Header with search */}
			<div className="flex-shrink-0 p-4 border-b space-y-3">
				<h3 className="text-sm font-semibold text-muted-foreground">
					Move Library
				</h3>

				{/* Search mode selector */}
				<div className="flex gap-2 mb-2">
					<Button
						type="button"
						variant={
							searchMode === 'move' ? 'default' : 'secondary'
						}
						onClick={() => setSearchMode('move')}
					>
						Search by Move
					</Button>
					<Button
						type="button"
						variant={
							searchMode === 'song' ? 'default' : 'secondary'
						}
						onClick={() => setSearchMode('song')}
					>
						Search by Song
					</Button>
				</div>

				{/* Search input */}
				<div className="relative">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<input
						type="text"
						placeholder={
							searchMode === 'move'
								? 'Search moves...'
								: 'Search songs...'
						}
						value={pendingQuery}
						onChange={(e) => setPendingQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') setSearchQuery(pendingQuery);
						}}
						className="w-full pl-10 pr-4 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
					/>
					<button
						onClick={() => setSearchQuery(pendingQuery)}
						className="absolute right-8 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
						title="Search"
					>
						<Search className="h-4 w-4" />
					</button>
					{searchQuery && (
						<button
							onClick={() => {
								setSearchQuery('');
								setPendingQuery('');
							}}
							className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
							title="Clear search"
						>
							<X className="h-3 w-3" />
						</button>
					)}
				</div>

				{/* Results count and loading */}
				<div className="text-xs text-muted-foreground">
					{loading && 'Loading...'}
					{!loading &&
						(searchQuery
							? filteredMoveCount > 0
								? `${filteredMoveCount} of ${totalMoveCount} moves found`
								: `No results found for "${searchQuery}"`
							: `${totalMoveCount} moves total`)}
				</div>
			</div>

			{/* Content area */}
			<div className="flex-1 overflow-auto p-2">
				{searchQuery && filteredMoveCount === 0 ? (
					<div className="h-full flex items-center justify-center">
						<div className="text-center text-muted-foreground">
							<div className="text-sm">No results found</div>
							<div className="text-xs mt-1">
								Try searching for{' '}
								{searchMode === 'move'
									? 'move names'
									: 'song names'}{' '}
								or switch search mode.
							</div>
						</div>
					</div>
				) : (
					<div className="space-y-1">
						{filteredCategories.map((category) =>
							renderItem(category, 0)
						)}
					</div>
				)}
			</div>
		</div>
	);
}
