import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	useSongMeta,
	useSongPath,
	useSongName,
	useSongStore,
} from '@/store/songStore';
import { SongMeta, GameOrigin, Gender, Venue, Character } from '@/types/song';
import { toast } from 'sonner';
import { join } from 'path-browserify';

function hashString(str: string): number {
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 33) ^ str.charCodeAt(i);
	}
	return Math.abs(hash >>> 0);
}

// Display name mappings for enums from song.ts
const displayNames = {
	GameOrigin: {
		DanceCentral3: 'Dance Central 3',
		DanceCentral3DLC: 'Dance Central 3 DLC',
		DanceCentral2: 'Dance Central 2',
		DanceCentral2DLC: 'Dance Central 2 DLC',
		DanceCentral1: 'Dance Central 1',
		DanceCentral1DLC: 'Dance Central 1 DLC',
	} as Record<string, string>,
	Gender: {
		Male: 'Male',
		Female: 'Female',
	} as Record<string, string>,
	Venue: {
		FreeSkate: 'Free Skate',
		ToprockAve: 'Toprock Avenue',
		Studio675: 'Studio 675',
		DCIHQ: 'DCI HQ',
		CrowsNest: "Crow's Nest",
	} as Record<string, string>,
	Character: {
		// Angel
		AngelCrewLook: 'Angel - Crew Look',
		AngelStreetStyle: 'Angel - Street Style',
		AngelDCClassic: 'Angel - DC Classic',
		AngelRetroFitted: 'Angel - Retro Fitted',
		AngelDCIAgent: 'Angel - DCI Agent',
		// Emilia
		EmiliaCrewLook: 'Emilia - Crew Look',
		EmiliaStreetStyle: 'Emilia - Street Style',
		EmiliaDCClassic: 'Emilia - DC Classic',
		EmiliaRetroFitted: 'Emilia - Retro Fitted',
		EmiliaDCIAgent: 'Emilia - DCI Agent',
		// Mo
		MoCrewLook: 'Mo - Crew Look',
		MoStreetStyle: 'Mo - Street Style',
		MoDCClassic: 'Mo - DC Classic',
		MoRetroFitted: 'Mo - Retro Fitted',
		MoDCIAgent: 'Mo - DCI Agent',
		// Taye
		TayeCrewLook: 'Taye - Crew Look',
		TayeStreetStyle: 'Taye - Street Style',
		TayeDCClassic: 'Taye - DC Classic',
		TayeRetroFitted: 'Taye - Retro Fitted',
		TayeDCIAgent: 'Taye - DCI Agent',
		// Aubrey
		AubreyCrewLook: 'Aubrey - Crew Look',
		AubreyStreetStyle: 'Aubrey - Street Style',
		AubreyDCClassic: 'Aubrey - DC Classic',
		AubreyRetroFitted: 'Aubrey - Retro Fitted',
		AubreyDCIAgent: 'Aubrey - DCI Agent',
		// Bodie
		BodieCrewLook: 'Bodie - Crew Look',
		BodieStreetStyle: 'Bodie - Street Style',
		BodieRetroFitted: 'Bodie - Retro Fitted',
		BodieDCIAgent: 'Bodie - DCI Agent',
		// Glitch
		GlitchCrewLook: 'Glitch - Crew Look',
		GlitchStreetStyle: 'Glitch - Street Style',
		GlitchRetroFitted: 'Glitch - Retro Fitted',
		GlitchDCIAgent: 'Glitch - DCI Agent',
		// Lilt
		LiltCrewLook: 'Lilt - Crew Look',
		LiltStreetStyle: 'Lilt - Street Style',
		LiltRetroFitted: 'Lilt - Retro Fitted',
		LiltDCIAgent: 'Lilt - DCI Agent',
		// Dare
		DareDCClassic: 'Dare - DC Classic',
		DareUnderControl: 'Dare - Under Control',
		// Maccoy
		MaccoyDCClassic: 'Maccoy - DC Classic',
		MaccoyUnderControl: 'Maccoy - Under Control',
		// Oblio
		OblioCrewLook: 'Oblio - Crew Look',
		OblioUnderControl: 'Oblio - Under Control',
		// Tan
		TanLikeABoss: 'Tan - Like A Boss',
		TanCrewLook: 'Tan - Crew Look',
		// Ninjaman
		NinjamanCrewLook: 'Ninjaman - Crew Look',
		// Ninjawoman
		NinjawomanCrewLook: 'Ninjawoman - Crew Look',
		// Iconmanblue
		IconmanblueCrewLook: 'Iconman Blue - Crew Look',
		// Iconmanpink
		IconmanpinkCrewLook: 'Iconman Pink - Crew Look',
		// Robota
		RobotaCrewLook: 'Robota - Crew Look',
		RobotaDamaged: 'Robota - Damaged',
		// Robotb
		RobotbCrewLook: 'Robotb - Crew Look',
		RobotbDamaged: 'Robotb - Damaged',
		// Jaryn
		JarynCrewLook: 'Jaryn - Crew Look',
		JarynStreetStyle: 'Jaryn - Street Style',
		JarynHauteBlooded: 'Jaryn - Haute Blooded',
		// Kerith
		KerithCrewLook: 'Kerith - Crew Look',
		KerithStreetStyle: 'Kerith - Street Style',
		KerithHauteBlooded: 'Kerith - Haute Blooded',
		// Lima
		LimaDCIAgent: 'Lima - DCI Agent',
		LimaUnderControl: 'Lima - Under Control',
		// Rasa
		RasaDCIAgent: 'Rasa - DCI Agent',
		RasaUnderControl: 'Rasa - Under Control',
	} as Record<string, string>,
};

export function MetadataEditor() {
	const songMeta = useSongMeta();
	const songPath = useSongPath();
	const songName = useSongName();
	const { updateSongMeta } = useSongStore();
	const [meta, setMeta] = useState<SongMeta | null>(
		songMeta ? { ...songMeta } : null
	);
	const [imageUrl, setImageUrl] = useState<string | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Load image on component mount
	useEffect(() => {
		const loadCoverImage = async () => {
			if (!songPath || !songName) return;

			// First check if there's a path stored in metadata
			let imagePath = meta?.cover_image_path;

			// If no path in metadata, try the default naming convention
			if (!imagePath) {
				imagePath = join(songPath, `${songName}_keep.png`);
			}

			// Make sure the path is absolute
			if (imagePath && !imagePath.includes(':')) {
				imagePath = join(songPath, imagePath);
			}

			try {
				const exists = await window.electronAPI.pathExists(imagePath);
				if (exists) {
					setImageUrl(imagePath);
					// Read the image file as buffer and convert to data URL for preview
					const buffer = await window.electronAPI.readFileBuffer(
						imagePath
					);
					const blob = new Blob([buffer], { type: 'image/png' });
					const dataUrl = URL.createObjectURL(blob);
					setImagePreview(dataUrl);
				}
			} catch (error) {
				console.error('Failed to check for image:', error);
			}
		};

		loadCoverImage();
	}, [songPath, songName, meta?.cover_image_path]);

	// Cleanup object URLs on unmount
	useEffect(() => {
		return () => {
			if (imagePreview && imagePreview.startsWith('blob:')) {
				URL.revokeObjectURL(imagePreview);
			}
		};
	}, [imagePreview]);

	if (!meta) return <div className="p-4">No metadata loaded.</div>;

	// Enum options
	const gameOriginOptions = Object.entries(GameOrigin);
	const genderOptions = Object.entries(Gender);
	const venueOptions = Object.entries(Venue);
	const characterOptions = Object.entries(Character);

	const handleChange = (field: keyof SongMeta, value: any) => {
		setMeta((prev) => (prev ? { ...prev, [field]: value } : prev));
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		// Check for empty fields
		if (!meta?.name?.trim()) {
			toast.error('Song name cannot be empty');
			return;
		}
		if (!meta.artist?.trim()) {
			toast.error('Artist name cannot be empty');
			return;
		}
		if (!meta.album_name?.trim()) {
			toast.error('Album name cannot be empty');
			return;
		}

		// Check DJ intensity rank range
		if (meta.dj_intensity_rank < 1 || meta.dj_intensity_rank > 4) {
			toast.error('DJ Intensity Rank must be between 1 and 4');
			return;
		}

		updateSongMeta(meta);
		toast.success('Metadata updated!');
	};

	const handleRandomId = () => {
		const base = `${meta.name}-${meta.artist}-${Date.now()}`;
		const newId = hashString(base);
		setMeta((prev) => (prev ? { ...prev, songid: newId } : prev));
	};

	const handleImageClick = () => {
		if (fileInputRef.current) {
			fileInputRef.current.click();
		}
	};

	const handleImageChange = async (
		e: React.ChangeEvent<HTMLInputElement>
	) => {
		const file = e.target.files?.[0];
		if (!file || !songPath || !songName) return;

		// Validate file type
		if (!file.type.startsWith('image/png')) {
			toast.error('Please select a PNG image file');
			return;
		}

		try {
			toast.loading('Processing image...', { id: 'image-upload' });

			// Create image element to check dimensions
			const img = new Image();
			const imageUrl = URL.createObjectURL(file);

			img.onload = async () => {
				// Check if image is square (1:1 aspect ratio)
				if (img.width !== img.height) {
					toast.error('Image must have a 1:1 aspect ratio (square)', {
						id: 'image-upload',
					});
					URL.revokeObjectURL(imageUrl);
					return;
				}

				try {
					// Read file as buffer
					const buffer = await file.arrayBuffer();
					const uint8Array = new Uint8Array(buffer);

					// Save to disk
					const imagePath = join(songPath, `${songName}_keep.png`);
					await window.electronAPI.writeFileBuffer(
						imagePath,
						uint8Array
					);

					// Clean up previous preview URL if it exists
					if (imagePreview && imagePreview.startsWith('blob:')) {
						URL.revokeObjectURL(imagePreview);
					}

					// Update state
					setImageUrl(imagePath);
					setImagePreview(imageUrl); // Keep the blob URL for the new image

					// Update metadata with relative path for portability
					const relativePath = `${songName}_keep.png`;
					setMeta((prev) =>
						prev
							? { ...prev, cover_image_path: relativePath }
							: prev
					);

					toast.success('Image uploaded successfully', {
						id: 'image-upload',
					});
				} catch (error) {
					toast.error('Failed to save image', { id: 'image-upload' });
					console.error('Error saving image:', error);
					URL.revokeObjectURL(imageUrl);
				}
			};

			img.onerror = () => {
				toast.error('Failed to load image', { id: 'image-upload' });
				URL.revokeObjectURL(imageUrl);
			};

			img.src = imageUrl;
		} catch (error) {
			toast.error('Failed to process image', { id: 'image-upload' });
			console.error('Error processing image:', error);
		}
	};

	return (
		<div className="h-full flex flex-col">
			<div className="p-4 bg-muted/20">
				<h2 className="text-2xl font-bold">Song Metadata</h2>
			</div>

			<form onSubmit={handleSubmit} className="flex-1 overflow-hidden">
				<ResizablePanelGroup direction="horizontal" className="h-full">
					{/* Left panel - Form inputs */}
					<ResizablePanel defaultSize={50} minSize={30}>
						<div className="p-6 h-full overflow-y-auto">
							<Tabs defaultValue="basic">
								<TabsList className="mb-4">
									<TabsTrigger value="basic">
										Basic Info
									</TabsTrigger>
									<TabsTrigger value="characters">
										Characters & Venue
									</TabsTrigger>
								</TabsList>

								<TabsContent
									value="basic"
									className="space-y-4"
								>
									<div className="space-y-2">
										<Label htmlFor="name">Song Name</Label>
										<Input
											id="name"
											value={meta.name}
											onChange={(e) =>
												handleChange(
													'name',
													e.target.value
												)
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="artist">Artist</Label>
										<Input
											id="artist"
											value={meta.artist}
											onChange={(e) =>
												handleChange(
													'artist',
													e.target.value
												)
											}
										/>
									</div>
									<div className="flex gap-2 items-end">
										<div className="flex-1">
											<Label htmlFor="songid">
												Song ID
											</Label>
											<Input
												id="songid"
												type="number"
												value={meta.songid}
												onChange={(e) =>
													handleChange(
														'songid',
														Number(e.target.value)
													)
												}
											/>
										</div>
										<Button
											type="button"
											variant="outline"
											onClick={handleRandomId}
										>
											Random
										</Button>
									</div>
									<div className="space-y-2">
										<Label>Game Origin</Label>
										<Select
											value={meta.game_origin}
											onValueChange={(v: string) =>
												handleChange('game_origin', v)
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select game origin" />
											</SelectTrigger>
											<SelectContent>
												{gameOriginOptions.map(
													([key, value]) => (
														<SelectItem
															key={value}
															value={value}
														>
															{displayNames
																.GameOrigin[
																key
															] || key}
														</SelectItem>
													)
												)}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label>Gender</Label>
										<Select
											value={meta.gender}
											onValueChange={(v: string) =>
												handleChange('gender', v)
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select gender" />
											</SelectTrigger>
											<SelectContent>
												{genderOptions.map(
													([key, value]) => (
														<SelectItem
															key={value}
															value={value}
														>
															{displayNames
																.Gender[key] ||
																key}
														</SelectItem>
													)
												)}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label htmlFor="album">
											Album Name
										</Label>
										<Input
											id="album"
											value={meta.album_name}
											onChange={(e) =>
												handleChange(
													'album_name',
													e.target.value
												)
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="bpm">BPM</Label>
										<Input
											id="bpm"
											type="number"
											value={meta.bpm}
											onChange={(e) =>
												handleChange(
													'bpm',
													Number(e.target.value)
												)
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="year">
											Year Released
										</Label>
										<Input
											id="year"
											type="number"
											value={meta.year_released}
											onChange={(e) =>
												handleChange(
													'year_released',
													Number(e.target.value)
												)
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="rank">Song Rank</Label>
										<Input
											id="rank"
											type="number"
											value={meta.rank}
											onChange={(e) =>
												handleChange(
													'rank',
													Number(e.target.value)
												)
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="intensity">
											DJ Intensity Rank (1-4)
										</Label>
										<Input
											id="intensity"
											type="number"
											min="1"
											max="4"
											value={meta.dj_intensity_rank}
											onChange={(e) => {
												const value = Number(
													e.target.value
												);
												if (value >= 1 && value <= 4) {
													handleChange(
														'dj_intensity_rank',
														value
													);
												}
											}}
										/>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label htmlFor="preview_start">
												Preview Start (ms)
											</Label>
											<Input
												id="preview_start"
												type="number"
												value={meta.preview.start}
												onChange={(e) =>
													setMeta((prev) =>
														prev
															? {
																	...prev,
																	preview: {
																		...prev.preview,
																		start: Number(
																			e
																				.target
																				.value
																		),
																	},
															  }
															: prev
													)
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="preview_end">
												Preview End (ms)
											</Label>
											<Input
												id="preview_end"
												type="number"
												value={meta.preview.end}
												onChange={(e) =>
													setMeta((prev) =>
														prev
															? {
																	...prev,
																	preview: {
																		...prev.preview,
																		end: Number(
																			e
																				.target
																				.value
																		),
																	},
															  }
															: prev
													)
												}
											/>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label htmlFor="pans_val1">
												Pans Val1 (Left)
											</Label>
											<Input
												id="pans_val1"
												type="number"
												step="0.01"
												value={meta.song.pans.val1}
												onChange={(e) =>
													setMeta((prev) =>
														prev
															? {
																	...prev,
																	song: {
																		...prev.song,
																		pans: {
																			...prev
																				.song
																				.pans,
																			val1: Number(
																				e
																					.target
																					.value
																			),
																		},
																	},
															  }
															: prev
													)
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="pans_val2">
												Pans Val2 (Right)
											</Label>
											<Input
												id="pans_val2"
												type="number"
												step="0.01"
												value={meta.song.pans.val2}
												onChange={(e) =>
													setMeta((prev) =>
														prev
															? {
																	...prev,
																	song: {
																		...prev.song,
																		pans: {
																			...prev
																				.song
																				.pans,
																			val2: Number(
																				e
																					.target
																					.value
																			),
																		},
																	},
															  }
															: prev
													)
												}
											/>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label htmlFor="vols_val1">
												Volumes Val1 (Left)
											</Label>
											<Input
												id="vols_val1"
												type="number"
												step="0.01"
												value={meta.song.vols.val1}
												onChange={(e) =>
													setMeta((prev) =>
														prev
															? {
																	...prev,
																	song: {
																		...prev.song,
																		vols: {
																			...prev
																				.song
																				.vols,
																			val1: Number(
																				e
																					.target
																					.value
																			),
																		},
																	},
															  }
															: prev
													)
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="vols_val2">
												Volumes Val2 (Right)
											</Label>
											<Input
												id="vols_val2"
												type="number"
												step="0.01"
												value={meta.song.vols.val2}
												onChange={(e) =>
													setMeta((prev) =>
														prev
															? {
																	...prev,
																	song: {
																		...prev.song,
																		vols: {
																			...prev
																				.song
																				.vols,
																			val2: Number(
																				e
																					.target
																					.value
																			),
																		},
																	},
															  }
															: prev
													)
												}
											/>
										</div>
									</div>
								</TabsContent>

								<TabsContent
									value="characters"
									className="space-y-4"
								>
									<div className="space-y-2">
										<Label>Default Character</Label>
										<Select
											value={meta.default_character}
											onValueChange={(v: string) =>
												handleChange(
													'default_character',
													v
												)
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select character" />
											</SelectTrigger>
											<SelectContent>
												{characterOptions.map(
													([key, value]) => (
														<SelectItem
															key={value}
															value={value}
														>
															{displayNames
																.Character[
																key
															] || key}
														</SelectItem>
													)
												)}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label>Default Character Alt</Label>
										<Select
											value={meta.default_character_alt}
											onValueChange={(v: string) =>
												handleChange(
													'default_character_alt',
													v
												)
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select character" />
											</SelectTrigger>
											<SelectContent>
												{characterOptions.map(
													([key, value]) => (
														<SelectItem
															key={value}
															value={value}
														>
															{displayNames
																.Character[
																key
															] || key}
														</SelectItem>
													)
												)}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label>Backup Character</Label>
										<Select
											value={meta.backup_character}
											onValueChange={(v: string) =>
												handleChange(
													'backup_character',
													v
												)
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select character" />
											</SelectTrigger>
											<SelectContent>
												{characterOptions.map(
													([key, value]) => (
														<SelectItem
															key={value}
															value={value}
														>
															{displayNames
																.Character[
																key
															] || key}
														</SelectItem>
													)
												)}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label>Backup Character Alt</Label>
										<Select
											value={meta.backup_character_alt}
											onValueChange={(v: string) =>
												handleChange(
													'backup_character_alt',
													v
												)
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select character" />
											</SelectTrigger>
											<SelectContent>
												{characterOptions.map(
													([key, value]) => (
														<SelectItem
															key={value}
															value={value}
														>
															{displayNames
																.Character[
																key
															] || key}
														</SelectItem>
													)
												)}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label>Default Venue</Label>
										<Select
											value={meta.default_venue}
											onValueChange={(v: string) =>
												handleChange('default_venue', v)
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select venue" />
											</SelectTrigger>
											<SelectContent>
												{venueOptions.map(
													([key, value]) => (
														<SelectItem
															key={value}
															value={value}
														>
															{displayNames.Venue[
																key
															] || key}
														</SelectItem>
													)
												)}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label>Backup Venue</Label>
										<Select
											value={meta.backup_venue}
											onValueChange={(v: string) =>
												handleChange('backup_venue', v)
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select venue" />
											</SelectTrigger>
											<SelectContent>
												{venueOptions.map(
													([key, value]) => (
														<SelectItem
															key={value}
															value={value}
														>
															{displayNames.Venue[
																key
															] || key}
														</SelectItem>
													)
												)}
											</SelectContent>
										</Select>
									</div>
								</TabsContent>
							</Tabs>
						</div>
					</ResizablePanel>

					<ResizableHandle />

					{/* Right panel - Image preview */}
					<ResizablePanel defaultSize={50}>
						<div className="p-6 h-full flex flex-col">
							<h3 className="text-xl font-semibold mb-4">
								Cover Image
							</h3>
							<div
								className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/20"
								onClick={handleImageClick}
							>
								{imagePreview ? (
									<div className="text-center p-4 w-full h-full flex flex-col items-center justify-center">
										<div className="max-w-64 max-h-64 mb-4">
											<img
												src={imagePreview}
												alt="Cover preview"
												className="w-full h-full object-contain rounded-lg border"
											/>
										</div>
										<p className="text-sm text-muted-foreground">
											Click to replace
										</p>
									</div>
								) : (
									<div className="text-center p-4">
										<p>Click to upload cover image</p>
										<p className="text-sm text-muted-foreground mt-2">
											PNG format required (1:1 aspect
											ratio)
										</p>
									</div>
								)}
								<input
									type="file"
									ref={fileInputRef}
									className="hidden"
									accept="image/png"
									onChange={handleImageChange}
								/>
							</div>

							<div className="mt-6">
								<Button type="submit" className="w-full">
									Save Metadata
								</Button>
							</div>
						</div>
					</ResizablePanel>
				</ResizablePanelGroup>
			</form>
		</div>
	);
}

export default MetadataEditor;
