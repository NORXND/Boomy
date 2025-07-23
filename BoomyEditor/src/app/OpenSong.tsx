import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { join, join as pathJoin } from 'path-browserify';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSongStore } from './store/songStore';
import { redirect, useNavigate } from 'react-router';
import { Song } from './types/song';
import { hashRandomId } from './RandomIdGenerator';
import { openSong } from './loaders/songLoader';

// Manual function to get the last part of a path
function getLastPathSegment(path: string): string {
	return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || '';
}

export function OpenSongDialog({
	open,
	setOpen,
	songPath,
}: {
	open: boolean;
	setOpen: (open: boolean) => void;
	songPath: string;
}) {
	const { loadSong } = useSongStore();
	const [filePath, setFilePath] = useState('');
	const navigate = useNavigate();

	const handleFileSelection = async () => {
		const result = (await window.electronAPI.selectDirectoryPath({
			title: 'Milo Move Library Path',
		})) as string | null;

		if (result) {
			setFilePath(result);
		}
	};

	const handleSongCreation = async () => {
		if (!filePath) {
			toast.error('Please select a valid Milo Move Library path.');
			return;
		}

		const moveVersionExists = await window.electronAPI.pathExists(
			pathJoin(filePath, '.boomy')
		);

		if (moveVersionExists) {
			const dotBoomyContent = await window.electronAPI.readFile(
				pathJoin(filePath, '.boomy')
			);

			if (dotBoomyContent != 'mlib2') {
				toast.error('Invalid Move Library Version!', {
					description: 'Only version 2 is supported.',
				});
			}
		}

		const songJsonPath = pathJoin(songPath, 'song.json');
		const boomyPath = pathJoin(songPath, '.boomy');
		const boomyExists = await window.electronAPI.pathExists(boomyPath);

		let songData: Song;
		if (boomyExists) {
			toast.error('Project already exists!', {
				description:
					'There is a Boomy project in this directory. Try opening it instead.',
			});
		} else {
			// Create new song.json and .boomy
			songData = {
				move_lib: filePath,
				audioPath: pathJoin(
					songPath,
					`${getLastPathSegment(songPath)}.ogg`
				),
				timeline: {
					easy: {
						moves: [],
						cameras: [],
					},
					medium: {
						moves: [],
						cameras: [],
					},
					expert: {
						moves: [],
						cameras: [],
					},
				},
				practice: {
					easy: [],
					medium: [],
					expert: [],
				},
				supereasy: [],
				drums: [],
				events: [
					{
						beat: 0,
						type: 'music_start',
					},
				],
				tempoChanges: [],
				moveLibrary: {},
				moveLibRev: 'mlib2',
			};
			await window.electronAPI.writeFile(
				songJsonPath,
				JSON.stringify(songData, null, 2)
			);
			await window.electronAPI.writeFile(boomyPath, 'song2');
		}

		toast.success('Song ready!', {
			description: `Song at ${songPath}`,
		});

		loadSong(
			songData,
			songPath,
			getLastPathSegment(songPath),
			join(songPath, `${getLastPathSegment(songPath)}.ogg`)
		);
		navigate('/editor');
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(open) => {
				setFilePath('');
				setOpen(open);
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Add Move Library</DialogTitle>
					<DialogDescription>
						You can download it from{' '}
						<button
							className="underline cursor-pointer"
							onClick={() =>
								window.electronAPI.openExternal(
									'https://github.com/NORXND/milo-move-library'
								)
							}
						>
							milo-move-library
						</button>{' '}
						repository.
					</DialogDescription>
				</DialogHeader>
				<div className="flex items-center gap-2">
					<div className="flex flex-1 gap-2 flex-row">
						<Label htmlFor="file" className="sr-only">
							Path to Milo Move Library
						</Label>
						<Input
							id="file"
							placeholder="milo-move-library"
							onChange={(e) => setFilePath(e.target.value)}
							value={filePath}
						/>
						<Button
							variant="secondary"
							onClick={handleFileSelection}
						>
							Select
						</Button>
					</div>
				</div>
				<DialogFooter className="sm:justify-start">
					<Button onClick={handleSongCreation}>Create Song</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function OpenSong() {
	const [open, setOpen] = useState(false);
	const [songPath, setSongPath] = useState('');
	const { loadSong } = useSongStore();
	const navigate = useNavigate();

	const handleOpenSong = async () => {
		const path = (await window.electronAPI.selectDirectoryPath({
			title: 'Select a song directory',
		})) as string | null;

		if (path) {
			setSongPath(path);

			const songData = await openSong(path);
			await loadSong(
				songData.songData,
				songData.songPath,
				songData.songName,
				songData.audioPath
			);
			navigate('/editor');
		}
	};

	return (
		<>
			<OpenSongDialog open={open} setOpen={setOpen} songPath={songPath} />
			<Button onClick={handleOpenSong}>Open Song</Button>
		</>
	);
}
