import path from 'path-browserify';
import { toast } from 'sonner';

function getLastPathSegment(path: string): string {
	return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || '';
}

export default async function loadSong3(songPath: string) {
	const songJSONExist = await window.electronAPI.pathExists(
		path.join(songPath, 'song.json')
	);

	if (!songJSONExist) {
		toast.error('Song corrupted!', {
			description: 'song.json is missing in the directory.',
		});
	}

	const songJSON = await window.electronAPI.readFile(
		path.join(songPath, 'song.json')
	);

	const song = JSON.parse(songJSON);

	const reportCorrupted = () => {
		toast.error('Song Corrupted!', {
			description: "Your song's data is corrupted or invalid!",
		});
	};

	// Checks
	if (!song.move_lib) {
		reportCorrupted();
		return;
	}

	if (!song.timeline) {
		reportCorrupted();
		return;
	}

	if (!song.timeline.easy) {
		reportCorrupted();
		return;
	}

	if (!song.timeline.easy.moves) {
		reportCorrupted();
		return;
	}

	if (!song.timeline.easy.cameras) {
		reportCorrupted();
		return;
	}

	if (!song.timeline.medium) {
		reportCorrupted();
		return;
	}

	if (!song.timeline.medium.moves) {
		reportCorrupted();
		return;
	}

	if (!song.timeline.medium.cameras) {
		reportCorrupted();
		return;
	}

	if (!song.timeline.expert) {
		reportCorrupted();
		return;
	}

	if (!song.timeline.expert.moves) {
		reportCorrupted();
		return;
	}

	if (!song.timeline.expert.cameras) {
		reportCorrupted();
		return;
	}

	if (!song.practice) {
		reportCorrupted();
		return;
	}

	if (!song.practice.easy) {
		reportCorrupted();
		return;
	}

	if (!song.practice.medium) {
		reportCorrupted();
		return;
	}

	if (!song.practice.expert) {
		reportCorrupted();
		return;
	}

	if (!song.moveLibrary) {
		reportCorrupted();
		return;
	}

	if (!song.supereasy) {
		reportCorrupted();
		return;
	}

	if (!song.practice.expert) {
		reportCorrupted();
		return;
	}

	if (!song.moveLibrary) {
		reportCorrupted();
		return;
	}

	if (!song.supereasy) {
		reportCorrupted();
		return;
	}

	if (!song.drums) {
		reportCorrupted();
		return;
	}

	if (!song.events) {
		reportCorrupted();
		return;
	}

	if (!song.tempoChanges) {
		reportCorrupted();
		return;
	}

	if (!song.meta) {
		reportCorrupted();
		return;
	}

	if (!song.moveLibRev) {
		reportCorrupted();
		return;
	}

	if (song.moveLibRev !== 'mlib2') {
		reportCorrupted();
		return;
	}

	const dirName = getLastPathSegment(songPath);
	const oggPath = path.join(songPath, `${dirName}.ogg`);

	const oggExists = await window.electronAPI.pathExists(oggPath);

	if (!oggExists) {
		toast.error('Song Corrupted!', {
			description: 'Sounds file (.ogg) is missing.',
		});
		return;
	}

	return {
		songData: song,
		songPath: songPath,
		songName: dirName,
		audioPath: oggPath,
	};
}
