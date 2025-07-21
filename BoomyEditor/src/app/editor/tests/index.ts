import { SongState } from '@/store/songStore';
import { Song, TestResult, TestResultType } from '../../types/song';
import {
	hasFinishingMove,
	measureCheck,
	measureFilledCheck,
} from './movesCheck';

const utils = {
	checkMove: async (
		state: SongState,
		move: string,
		song: string,
		category: string
	) => {
		const movePath = `${state.currentSong.move_lib}/${category}/${song}/${move}`;

		// Load move.json
		const jsonPath = `${movePath}/move.json`;
		const jsonExists = await window.electronAPI.pathExists(jsonPath);
		if (jsonExists) {
			const jsonData = await window.electronAPI.readJsonFile(jsonPath);
			return jsonData;
		} else {
			return null;
		}
	},
};

export type TestingUtils = typeof utils;

// Test registry - all tests are stored here
export const TESTS: Record<
	string,
	(song: SongState, utils: TestingUtils) => Promise<TestResult>
> = {
	'First measure has move?': measureCheck,
	'Equal number of moves?': measureFilledCheck,
	'Has finishing move?': hasFinishingMove,
};

export type { TestResult };

// Function to run all tests
export async function runAllTests(
	song: SongState
): Promise<Record<string, TestResult>> {
	const results: Record<string, TestResult> = {};

	for (const [testName, testFunction] of Object.entries(TESTS)) {
		try {
			results[testName] = await testFunction(song, utils);
		} catch (error) {
			results[testName] = {
				status: TestResultType.error,
				output: `Test execution failed: ${error}`,
			};
		}
	}

	return results;
}

// Helper function to get icon for test status
export function getTestIcon(status: TestResult['status']): string {
	switch (status) {
		case TestResultType.success:
			return '✅';
		case TestResultType.warning:
			return '⚠️';
		case TestResultType.error:
			return '❌';
		case TestResultType.skipped:
			return '❔';
	}
}

// Helper function to check if tests passed (no errors)
export function allTestsPassed(results: Record<string, TestResult>): boolean {
	return !Object.values(results).some(
		(result) => result.status === TestResultType.error
	);
}
