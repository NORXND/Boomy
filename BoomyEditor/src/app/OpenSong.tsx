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
import { join as pathJoin } from 'path-browserify';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSongStore } from './store/songStore';
import { redirect, useNavigate } from 'react-router';
import { Song } from './types/song';

// Manual function to get the last part of a path
function getLastPathSegment(path: string): string {
	return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || '';
}

function OpenSongDialog({
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

			if (dotBoomyContent != 'mlib1') {
				toast.error('Invalid Move Library Version!', {
					description: 'Only version 1 is supported.',
				});
			}
		}

		const songVersionExist = await window.electronAPI.pathExists(
			pathJoin(songPath, '.boomy')
		);

		if (songVersionExist) {
			toast.error('Conflict!', {
				description: 'A .boomy file already exists in this directory.',
			});
			return;
		}

		const songData: Song = {
			move_lib: filePath,
			audioPath: pathJoin(
				songPath,
				`${getLastPathSegment(songPath)}.ogg`
			),
			midiPath: pathJoin(songPath, `${getLastPathSegment(songPath)}.mid`),
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
			moveLibrary: {},
		};

		await window.electronAPI.writeFile(
			pathJoin(songPath, 'song.json'),
			JSON.stringify(songData)
		);

		await window.electronAPI.writeFile(
			pathJoin(songPath, '.boomy'),
			'song1'
		);

		toast.success('Song created successfully!', {
			description: `Song created at ${songPath}`,
		});

		loadSong(
			songData,
			songPath,
			getLastPathSegment(songPath),
			songData.audioPath,
			songData.midiPath
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

			// Search for files
			const dotBoomyExists = await window.electronAPI.pathExists(
				pathJoin(path, '.boomy')
			);

			if (dotBoomyExists) {
				const dotBoomyContent = await window.electronAPI.readFile(
					pathJoin(path, '.boomy')
				);

				if (dotBoomyContent == 'song1') {
					const songJSONExist = await window.electronAPI.pathExists(
						pathJoin(path, 'song.json')
					);

					if (!songJSONExist) {
						toast.error('Song corrupted!', {
							description:
								'song.json is missing in the directory.',
						});
					}

					const songJSON = await window.electronAPI.readFile(
						pathJoin(path, 'song.json')
					);

					// Process the song data
					try {
						const song = JSON.parse(songJSON);

						// Check for audio and MIDI files
						const dirName = getLastPathSegment(path);
						const oggPath = pathJoin(path, `${dirName}.ogg`);
						const midPath = pathJoin(path, `${dirName}.mid`);

						const oggExists = await window.electronAPI.pathExists(
							oggPath
						);
						const midExists = await window.electronAPI.pathExists(
							midPath
						);

						if (!oggExists || !midExists) {
							toast.error('Song Corrupted!', {
								description:
									'Sounds file (.ogg) or MIDI file (.mid) is missing.',
							});
							return;
						}

						loadSong(
							song,
							path,
							getLastPathSegment(path),
							oggPath,
							midPath
						);
						navigate('/editor');
					} catch (error) {
						toast.error('Failed to parse song data!', {
							description:
								'The song data is corrupted or invalid.',
						});
						return;
					}
				} else {
					toast.error('Invalid Song Version!', {
						description: 'Only version 1 is supported.',
					});
				}
			} else {
				// Create new song
				const dirName = getLastPathSegment(path);

				const oggFile = await window.electronAPI.pathExists(
					pathJoin(path, `${dirName}.ogg`)
				);
				const midFile = await window.electronAPI.pathExists(
					pathJoin(path, `${dirName}.mid`)
				);

				if (oggFile && midFile) {
					setOpen(true);
				} else {
					toast.error('Missing OGG or MIDI file!', {
						description:
							'Please ensure both files are present. (In addition to .mogg file, for editing purposes, Boomy needs an original .ogg file)',
					});
				}
			}
		}
	};

	return (
		<>
			<OpenSongDialog open={open} setOpen={setOpen} songPath={songPath} />
			<Button onClick={handleOpenSong}>Open Song</Button>
		</>
	);
}
