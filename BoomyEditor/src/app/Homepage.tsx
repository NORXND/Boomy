import { useState } from 'react';
import { Button } from './components/ui/button';
import { OpenSong } from './OpenSong';
import { RandomIdGenerator } from './RandomIdGenerator';
import { toast } from 'sonner';

export function Homepage() {
	const [idGeneratorOpen, setIdGeneratorOpen] = useState(false);

	const handleGenerateAudio = async () => {
		try {
			// Let user select an OGG file
			const filePath = await window.electronAPI.selectFilePath({
				fileTypes: [
					{
						name: 'OGG Audio Files',
						extensions: ['ogg'],
					},
				],
				title: 'Select OGG file to convert to MOGG',
			});

			if (filePath && typeof filePath === 'string') {
				// Convert to MOGG
				const result = await window.electronAPI.convertToMogg(filePath);
				toast.success(`Converted successfully`, {
					description: `Output: ${result.outputPath}`,
				});
			}
		} catch (error) {
			toast.error(`Error converting to MOGG`, {
				description: error,
			});
		}
	};

	return (
		<div className="max-w-7xl mx-auto p-16">
			<div className="flex flex-row gap-4">
				<img src="Boombox.svg" alt="Boombox" className="h-24" />
				<h1 className="text-8xl font-bold">Boomy</h1>
			</div>
			<h2 className="text-4xl">v0.1.3</h2>
			<div className="h-8"></div>
			<div className="flex gap-4">
				<RandomIdGenerator
					open={idGeneratorOpen}
					setOpen={setIdGeneratorOpen}
				/>
				<OpenSong></OpenSong>
				<Button
					variant="secondary"
					onClick={() => setIdGeneratorOpen(true)}
				>
					Random ID Generator
				</Button>
				<Button
					variant="secondary"
					onClick={() =>
						window.electronAPI.openExternal(
							'https://signal.vercel.app/edit'
						)
					}
				>
					Launch Signal MIDI Editor
				</Button>
				<Button variant="secondary" onClick={handleGenerateAudio}>
					Make MOGG file
				</Button>
			</div>
			<div className="h-8"></div>
			<div className="text-gray-300">
				<h1>Boomy, created by NORXND licensed under MIT.</h1>
				<h2>
					This software uses MiloLib created by ihatecompvir licensed
					under MIT.
				</h2>
				<Button
					className="mt-4"
					variant="outline"
					onClick={() =>
						window.electronAPI.openExternal(
							'https://github.com/NORXND/Boomy/'
						)
					}
				>
					GitHub (Issues, Contribution)
				</Button>
			</div>
		</div>
	);
}
