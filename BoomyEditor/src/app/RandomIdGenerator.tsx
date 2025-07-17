import { useState } from 'react';
import { Button } from './components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';

export function hashRandomId(str: string): number {
	// Include current timestamp for better uniqueness
	const timestamp = Date.now();
	const combinedString = `${str}-${timestamp}`;

	let hash = 0;
	for (let i = 0; i < combinedString.length; i++) {
		hash = (hash * 31 + combinedString.charCodeAt(i)) | 0; // 32-bit signed int
	}

	// Ensure positive signed integer (0 to 2,147,483,647)
	return Math.abs(hash);
}

export function RandomIdGenerator({
	open,
	setOpen,
}: {
	open: boolean;
	setOpen: (open: boolean) => void;
}) {
	const [name, setName] = useState('');
	const [artist, setArtist] = useState('');
	const [randomHash, setRandomHash] = useState('');

	return (
		<Dialog
			open={open}
			onOpenChange={(open) => {
				setName('');
				setArtist('');
				setRandomHash('');
				setOpen(open);
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Generate Random ID for your song.</DialogTitle>
					<DialogDescription>
						Using special hashing algorithm, this tool will create a
						unique ID for your song based on Title and Artist.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col items-center gap-2">
					<div className="flex items-center w-full gap-2 flex-row">
						<Label htmlFor="name" className="sr-only">
							Song Title
						</Label>
						<Input
							id="name"
							placeholder="Enter song title"
							onChange={(e) => setName(e.target.value)}
							value={name}
						/>
					</div>
					<div className="flex items-center w-full gap-2">
						<Label htmlFor="artist" className="sr-only">
							Artist Name
						</Label>
						<Input
							id="artist"
							placeholder="Enter artist name"
							onChange={(e) => setArtist(e.target.value)}
							value={artist}
						/>
					</div>
				</div>
				<DialogFooter className="sm:justify-start">
					<Button
						onClick={() => {
							if (name && artist) {
								const id = hashRandomId(`${name}-${artist}`);
								setRandomHash(id.toString());
							}
						}}
					>
						Generate Random ID
					</Button>
					<Input readOnly value={randomHash} />
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
