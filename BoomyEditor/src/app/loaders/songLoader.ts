import { toast } from 'sonner';
import path from 'path-browserify';
import { Character, GameOrigin, Gender, Song, Venue } from '@/types/song';
import { hashRandomId } from '@/RandomIdGenerator';
import loadSong3 from './song3loader';

function cleanAsciiAlphanumericLower(str: string): string {
	// Remove everything except ASCII letters and numbers, then lowercase
	return str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export async function openSong(songPath: string, imported: boolean = false) {
	const dotBoomyExists = await window.electronAPI.pathExists(
		path.join(songPath, '.boomy')
	);

	if (!dotBoomyExists) {
		toast.error('No .boomy file found in the song directory.');
		return null;
	}

	const dotBoomyContent = await window.electronAPI.readFile(
		path.join(songPath, '.boomy')
	);

	switch (dotBoomyContent) {
		case 'song3':
			return loadSong3(songPath, imported);
		case 'song2':
			toast.error('Songs in 2nd revision are not longer supported.', {
				description:
					'Converting is not supported yet. Please downgrade your Boomy version if you need to open that song.',
			});
			break;
		case 'song1':
			toast.error('Songs in 1st revision are not longer supported.', {
				description:
					'Converting is not supported yet. Please downgrade your Boomy version if you need to open that song.',
			});
			break;
		default:
			toast.error('Unsupported .boomy version found.');
	}
}

export async function createSong(
	rootDir: string,
	songName: string,
	moveLibPath: string
) {
	songName = cleanAsciiAlphanumericLower(songName);

	if (songName.length == 0) {
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
			path.join(moveLibPath, '.boomy')
		);

		if (moveVersionExists) {
			const dotBoomyContent = await window.electronAPI.readFile(
				path.join(moveLibPath, '.boomy')
			);

			if (dotBoomyContent != 'mlib2') {
				toast.error('Invalid Move Library Version!', {
					description: 'Only version 2 is supported.',
				});
				return;
			}
		}

		// Create song directory
		const songDir = path.join(rootDir, songName);
		await window.electronAPI.createDirectory(songDir);

		// Check if song directory already has .boomy
		const songVersionExist = await window.electronAPI.pathExists(
			path.join(songDir, '.boomy')
		);

		if (songVersionExist) {
			toast.error('Conflict!', {
				description: 'A .boomy file already exists in this directory.',
			});
			return;
		}

		// Copy template files from public folder (available as web resources)
		// Read template files from the renderer's public folder
		const templateOggResponse = await fetch('template.ogg');
		const templateCoverResponse = await fetch('Cover.png');

		const templateOgg = new Uint8Array(
			await templateOggResponse.arrayBuffer()
		);
		const templateCover = new Uint8Array(
			await templateCoverResponse.arrayBuffer()
		);

		// Write with song name
		await window.electronAPI.writeFileBuffer(
			path.join(songDir, `${songName}.ogg`),
			templateOgg
		);
		await window.electronAPI.writeFileBuffer(
			path.join(songDir, `${songName}_keep.png`),
			templateCover
		);

		// Create song data
		const songData: Song = {
			move_lib: moveLibPath,
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
			supereasy: [],
			drums: [],
			partyJumps: [],
			battleSteps: [
				{
					type: 'battle_reset',
					measure: 0,
				},
			],
			partyBattleSteps: [
				{
					type: 'battle_reset',
					measure: 0,
				},
			],
			bamPhrases: [],
			events: [
				{
					type: 'music_start',
					beat: 0,
				},
				{
					type: 'music_end',
					beat: 259,
				},
				{
					type: 'end',
					beat: 260,
				},
			],
			tempoChanges: [
				{
					measure: 0,
					bpm: 120,
				},
			],
			meta: {
				name: songName,
				artist: 'Unknown Artist',
				songid: hashRandomId('BOOMYTEMPLATE'),
				game_origin: GameOrigin.DanceCentral3DLC,
				song: {
					tracks: [],
					pans: { val1: -1, val2: 1 },
					vols: { val1: 0, val2: 0 },
				},
				preview: { start: 0, end: 15000 },
				rank: 1,
				album_name: 'Boomy',
				gender: Gender.Male,
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
			path.join(songDir, 'song.json'),
			JSON.stringify(songData, null, 2)
		);

		await window.electronAPI.writeFile(
			path.join(songDir, '.boomy'),
			'song3'
		);

		toast.success('New song created successfully!', {
			description: `Song created at ${songDir}`,
		});

		return {
			songPath: songDir,
			songData: songData,
			songName: songName,
		};
	} catch (error) {
		toast.error('Failed to create new song', {
			description: error.toString(),
		});

		return null;
	}
}
