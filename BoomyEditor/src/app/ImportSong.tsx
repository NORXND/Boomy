import React, { useState } from 'react';
import JSZip from 'jszip';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { OpenSongDialog } from './OpenSong';
import { join } from 'path-browserify';
import { Button } from './components/ui/button';

export default function ImportSong() {
	const [moveDialogOpen, setMoveDialogOpen] = useState(false);
	const [songPath, setSongPath] = useState('');

	const handleImport = async () => {
		try {
			// Prompt user for zip file
			const zipPath = await window.electronAPI.selectFilePath({
				title: 'Select Exported Song ZIP',
				fileTypes: [{ name: 'ZIP', extensions: ['zip'] }],
			});
			if (!zipPath) return;
			const resolvedZipPath = Array.isArray(zipPath)
				? zipPath[0]
				: zipPath;
			const zipBuffer = await window.electronAPI.readFileBuffer(
				resolvedZipPath
			);

			// Prompt user for destination folder
			const destFolder = await window.electronAPI.selectDirectoryPath({
				title: 'Select destination folder for song',
			});
			if (!destFolder) return;
			const resolvedDest = Array.isArray(destFolder)
				? destFolder[0]
				: destFolder;

			// Load zip
			const zip = await JSZip.loadAsync(zipBuffer);

			// Find song name from .ogg or .mid file
			const oggFile = Object.keys(zip.files).find((f) =>
				f.endsWith('.ogg')
			);
			const midFile = Object.keys(zip.files).find((f) =>
				f.endsWith('.mid')
			);
			let songBase = '';
			if (oggFile) {
				songBase = oggFile.replace(/\.ogg$/, '');
			} else if (midFile) {
				songBase = midFile.replace(/\.mid$/, '');
			} else {
				throw new Error(
					'Could not determine song name from .ogg or .mid file in zip'
				);
			}

			// Create subfolder for the song
			const songFolder = join(resolvedDest, songBase);
			// Optionally create the folder (if not exists)
			await window.electronAPI.createDirectory(songFolder);

			// Extract all files to the song folder
			await Promise.all(
				Object.keys(zip.files).map(async (filename) => {
					const file = zip.files[filename];
					if (file.dir) return;
					const data =
						filename.endsWith('.json') ||
						filename.endsWith('.txt') ||
						filename.endsWith('.dta')
							? await file.async('string')
							: await file.async('uint8array');
					if (typeof data === 'string') {
						await window.electronAPI.writeFile(
							join(songFolder, filename),
							data
						);
					} else {
						await window.electronAPI.writeFileBuffer(
							join(songFolder, filename),
							data
						);
					}
				})
			);

			setSongPath(songFolder);
			setMoveDialogOpen(true);
			toast.success('Song files extracted!');
		} catch (error) {
			toast.error('Import failed', { description: error.toString() });
		}
	};

	const handleSongDialog = (open: boolean) => {
		setMoveDialogOpen(open);
		// OpenSongDialog will handle loading the song and navigation
	};

	return (
		<div className="flex flex-col items-center justify-center h-full">
			<OpenSongDialog
				open={moveDialogOpen}
				setOpen={handleSongDialog}
				songPath={songPath}
			/>
			<Button variant="secondary" onClick={handleImport}>
				Import Song
			</Button>
		</div>
	);
}
