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
import { createSong } from './loaders/songLoader';

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
		try {
			const songData = await createSong(rootDir, songName, moveLibPath);
			await loadSong(
				songData.songData,
				songData.songPath,
				songData.songName
			);
			setOpen(false);
			navigate('/editor');
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
								onChange={(e) => setRootDir(e.target.value)}
								value={rootDir}
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
					<>
						<div className="flex items-center gap-2">
							<div className="flex flex-1 gap-2 flex-row">
								<Label htmlFor="songname" className="sr-only">
									Song Name
								</Label>
								<Input
									id="songname"
									placeholder="Song name"
									value={songName}
									onChange={(e) => {
										// Only allow lowercase ASCII letters and numbers
										const cleaned = e.target.value
											.replace(/[^a-zA-Z0-9]/g, '')
											.toLowerCase();
										setSongName(cleaned);
									}}
								/>
							</div>
						</div>
						<div className="text-xs text-muted-foreground mt-1">
							Song name must be lowercase ASCII letters and
							numbers only.
						</div>
					</>
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
