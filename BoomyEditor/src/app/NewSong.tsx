import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { join as pathJoin } from 'path-browserify';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSongStore } from './store/songStore';
import { useNavigate } from 'react-router';
import { Song, GameOrigin, Gender, Character, Venue } from './types/song';
import { hashRandomId } from './RandomIdGenerator';

// Manual function to get the last part of a path
function getLastPathSegment(path: string): string {
	return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || '';
}

export function NewSongDialog({
	open,
	setOpen,
}: {
	open: boolean;
	setOpen: (open: boolean) => void;
}) {
	const { loadSong } = useSongStore();
	const [songName, setSongName] = useState('');
	const [rootDir, setRootDir] = useState('');
	const [moveLibPath, setMoveLibPath] = useState('');
	const [step, setStep] = useState(1); // 1: root dir, 2: song name, 3: move lib
	const navigate = useNavigate();

	const handleRootDirSelection = async () => {
		const result = (await window.electronAPI.selectDirectoryPath({
			title: 'Select Root Directory for New Song',
		})) as string | null;

		if (result) {
			setRootDir(result);
			setStep(2);
		}
	};

	const handleMoveLibSelection = async () => {
		const result = (await window.electronAPI.selectDirectoryPath({
			title: 'Milo Move Library Path',
		})) as string | null;

		if (result) {
			setMoveLibPath(result);
		}
	};

	const handleSongCreation = async () => {
		if (!songName.trim()) {
			toast.error('Please enter a valid song name.');
			return;
		}

		if (!moveLibPath) {
			toast.error('Please select a valid Milo Move Library path.');
			return;
		}

		try {
			// Check move library version
			const moveVersionExists = await window.electronAPI.pathExists(
				pathJoin(moveLibPath, '.boomy')
			);

			if (moveVersionExists) {
				const dotBoomyContent = await window.electronAPI.readFile(
					pathJoin(moveLibPath, '.boomy')
				);

				if (dotBoomyContent != 'mlib2') {
					toast.error('Invalid Move Library Version!', {
						description: 'Only version 2 is supported.',
					});
					return;
				}
			}

			// Create song directory
			const songDir = pathJoin(rootDir, songName);
			await window.electronAPI.createDirectory(songDir);

			// Check if song directory already has .boomy
			const songVersionExist = await window.electronAPI.pathExists(
				pathJoin(songDir, '.boomy')
			);

			if (songVersionExist) {
				toast.error('Conflict!', {
					description:
						'A .boomy file already exists in this directory.',
				});
				return;
			}

			// Copy template files from public folder (available as web resources)
			// Read template files from the renderer's public folder
			const templateMidResponse = await fetch('template.mid');
			const templateOggResponse = await fetch('template.ogg');
			const templateCoverResponse = await fetch('Cover.png');

			const templateMid = new Uint8Array(
				await templateMidResponse.arrayBuffer()
			);
			const templateOgg = new Uint8Array(
				await templateOggResponse.arrayBuffer()
			);
			const templateCover = new Uint8Array(
				await templateCoverResponse.arrayBuffer()
			);

			// Write with song name
			await window.electronAPI.writeFileBuffer(
				pathJoin(songDir, `${songName}.mid`),
				templateMid
			);
			await window.electronAPI.writeFileBuffer(
				pathJoin(songDir, `${songName}.ogg`),
				templateOgg
			);
			await window.electronAPI.writeFileBuffer(
				pathJoin(songDir, `${songName}_keep.png`),
				templateCover
			);

			// Create song data
			const songData: Song = {
				move_lib: moveLibPath,
				audioPath: pathJoin(songDir, `${songName}.ogg`),
				midiPath: pathJoin(songDir, `${songName}.mid`),
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
				moveLibrary: {},
				meta: {
					name: songName,
					artist: 'Unknown Artist',
					songid: hashRandomId('BOOMYTEMPLATE'),
					game_origin: GameOrigin.DanceCentral3DLC,
					song: {
						tracks: [],
						pans: { val1: 0, val2: 0 },
						vols: { val1: 0, val2: 0 },
					},
					preview: { start: 0, end: 15000 },
					rank: 1,
					album_name: 'Boomy',
					gender: Gender.Male,
					midi_events: [],
					default_character: Character.RasaDCIAgent,
					default_character_alt: Character.RasaDCIAgent,
					backup_character: Character.RasaDCIAgent,
					backup_character_alt: Character.RasaDCIAgent,
					default_venue: Venue.DCIHQ,
					backup_venue: Venue.DCIHQ,
					dj_intensity_rank: 1,
					year_released: 2025,
					bpm: 120,
					cover_image_path: `${songName}_keep.png`,
				},
				moveLibRev: 'mlib2',
			};

			await window.electronAPI.writeFile(
				pathJoin(songDir, 'song.json'),
				JSON.stringify(songData, null, 2)
			);

			await window.electronAPI.writeFile(
				pathJoin(songDir, '.boomy'),
				'song2'
			);

			toast.success('New song created successfully!', {
				description: `Song created at ${songDir}`,
			});

			loadSong(
				songData,
				songDir,
				songName,
				songData.audioPath,
				songData.midiPath
			);
			navigate('/editor');
			setOpen(false);
		} catch (error) {
			toast.error('Failed to create new song', {
				description: error.toString(),
			});
		}
	};

	const handleNext = () => {
		if (step === 2 && songName.trim()) {
			setStep(3);
		}
	};

	const handleBack = () => {
		if (step > 1) {
			setStep(step - 1);
		}
	};

	const resetDialog = () => {
		setSongName('');
		setRootDir('');
		setMoveLibPath('');
		setStep(1);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(open) => {
				if (!open) resetDialog();
				setOpen(open);
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						{step === 1 && 'Select Root Directory'}
						{step === 2 && 'Enter Song Name'}
						{step === 3 && 'Add Move Library'}
					</DialogTitle>
					<DialogDescription>
						{step === 1 &&
							'Choose where to create your new song folder.'}
						{step === 2 && 'Enter a name for your new song.'}
						{step === 3 && (
							<>
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
							</>
						)}
					</DialogDescription>
				</DialogHeader>

				{step === 1 && (
					<div className="flex items-center gap-2">
						<div className="flex flex-1 gap-2 flex-row">
							<Input
								placeholder="Root directory"
								value={rootDir}
								readOnly
							/>
							<Button
								variant="secondary"
								onClick={handleRootDirSelection}
							>
								Select
							</Button>
						</div>
					</div>
				)}

				{step === 2 && (
					<div className="flex items-center gap-2">
						<div className="flex flex-1 gap-2 flex-row">
							<Label htmlFor="songname" className="sr-only">
								Song Name
							</Label>
							<Input
								id="songname"
								placeholder="Song name"
								value={songName}
								onChange={(e) => setSongName(e.target.value)}
							/>
						</div>
					</div>
				)}

				{step === 3 && (
					<div className="flex items-center gap-2">
						<div className="flex flex-1 gap-2 flex-row">
							<Label htmlFor="movelib" className="sr-only">
								Path to Milo Move Library
							</Label>
							<Input
								id="movelib"
								placeholder="milo-move-library"
								onChange={(e) => setMoveLibPath(e.target.value)}
								value={moveLibPath}
							/>
							<Button
								variant="secondary"
								onClick={handleMoveLibSelection}
							>
								Select
							</Button>
						</div>
					</div>
				)}

				<DialogFooter className="sm:justify-between">
					<div>
						{step > 1 && (
							<Button variant="outline" onClick={handleBack}>
								Back
							</Button>
						)}
					</div>
					<div>
						{step === 1 && rootDir && (
							<Button onClick={() => setStep(2)}>Next</Button>
						)}
						{step === 2 && (
							<Button
								onClick={handleNext}
								disabled={!songName.trim()}
							>
								Next
							</Button>
						)}
						{step === 3 && (
							<Button onClick={handleSongCreation}>
								Create Song
							</Button>
						)}
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function NewSong() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<NewSongDialog open={open} setOpen={setOpen} />
			<Button onClick={() => setOpen(true)}>New Song</Button>
		</>
	);
}
