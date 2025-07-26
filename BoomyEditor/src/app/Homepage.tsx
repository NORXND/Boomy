import { useState } from 'react';
import { Button } from './components/ui/button';
import { OpenSong } from './OpenSong';
import { RandomIdGenerator } from './RandomIdGenerator';
import { toast } from 'sonner';
import ImportSong from './ImportSong';
import { NewSong } from './NewSong';

export function Homepage() {
	const [idGeneratorOpen, setIdGeneratorOpen] = useState(false);

	return (
		<div className="max-w-7xl mx-auto p-16">
			<div className="flex flex-row gap-4">
				<img src="Boombox.svg" alt="Boombox" className="h-24" />
				<h1 className="text-8xl font-bold">Boomy</h1>
			</div>
			<h2 className="text-4xl">v0.4.4</h2>
			<div className="h-8"></div>
			<div className="flex gap-4">
				<RandomIdGenerator
					open={idGeneratorOpen}
					setOpen={setIdGeneratorOpen}
				/>
				<NewSong></NewSong>
				<OpenSong></OpenSong>
				<ImportSong></ImportSong>
				<Button
					variant="secondary"
					onClick={() => setIdGeneratorOpen(true)}
				>
					Random ID Generator
				</Button>
			</div>
			<div className="h-8"></div>
			<div className="text-gray-300">
				<h1>Boomy, created by NORXND licensed under MIT.</h1>
				<h2>
					This software uses MiloLib created by ihatecompvir,
					xbox360-lib created by unknownv2 licensed by MIT as well as
					was based on many of other awesome open source tools. (Check
					the README!)
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
