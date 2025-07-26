import { SongState } from '@/store/songStore';
import type { TestingUtils, TestResult } from '.';
import { TestResultType } from '@/types/song';
import path from 'path-browserify';

export async function checkDrumsTracks(
	song: SongState,
	utils: TestingUtils
): Promise<TestResult> {
	const drums = song.currentSong?.drums ?? [];
	if (!drums.length) {
		return {
			status: TestResultType.warning,
			output: 'No drums tracks are present - you will hear nothing in practice slow mode.',
		};
	}
	const emptyEvents = drums.filter(
		(track) => !track.events || track.events.length === 0
	);
	if (emptyEvents.length > 0) {
		return {
			status: TestResultType.warning,
			output: 'Some drums tracks have no keys - you will hear nothing in practice slow mode.',
		};
	}
	return {
		status: TestResultType.success,
		output: 'All drums tracks have keys.',
	};
}

export async function checkSongMetaImageSize(
	song: SongState,
	utils: TestingUtils
): Promise<TestResult> {
	const imagePath = path.join(
		song.songPath,
		song.currentSong?.meta?.cover_image_path
	);
	if (!imagePath) {
		return {
			status: TestResultType.warning,
			output: 'No Album Cover found.',
		};
	}

	try {
		// Use Electron API to read the image file as a buffer
		const buffer = await window.electronAPI.readFileBuffer(imagePath);
		const blob = new Blob([buffer]);
		const url = URL.createObjectURL(blob);

		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const image = new window.Image();
			image.onload = () => resolve(image);
			image.onerror = reject;
			image.src = url;
		});

		URL.revokeObjectURL(url);

		if (img.width !== 512 || img.height !== 512) {
			return {
				status: TestResultType.error,
				output: `Album Cover is ${img.width}x${img.height}, but must be 512x512.`,
			};
		}
		return {
			status: TestResultType.success,
			output: 'Album Cover is 512x512.',
		};
	} catch (e) {
		console.log(e);
		return {
			status: TestResultType.error,
			output: 'Could not load Album Cover.',
		};
	}
}

export async function checkBamPhraseCount(
	song: SongState,
	utils: TestingUtils
): Promise<TestResult> {
	const bam = song.currentSong?.bamPhrases ?? [];
	const phraseCount = bam.length;

	if (phraseCount < 4) {
		return {
			status: TestResultType.error,
			output: `Bust a Move must contain at least 4 phrases (found ${phraseCount}).`,
		};
	}
	return {
		status: TestResultType.success,
		output: `Bust a Move contains ${phraseCount} phrases.`,
	};
}
