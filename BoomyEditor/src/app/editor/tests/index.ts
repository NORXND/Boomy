import { SongState } from "@/store/songStore";
import { Song, TestResult, TestResultType } from "../../types/song";
import { areRestsOnlyAtBeginningOrAfterFinishing, hasFinishingMove, isDifficultyHierarchyRespected, isFirstMeasureNotEmpty, noScoredMovesAfterFinishing } from "./choreographyChecks";
import { arePracticeMovesUsedAtMostTwice, arePracticeSectionsConsecutive, arePracticeSectionsProgressing, isLastPracticeSectionFinishing, isPracticeDifficultyHierarchyRespected } from "./practiceChecks";
import { checkSongEvents } from "./eventsChecks";
import { isAnyCameraAtMeasureZero } from "./cameraChecks";
import { checkDrumsTracks, checkSongMetaImageSize } from "./otherEvents";

const utils = {
  checkMove: async (state: SongState, move: string, song: string, category: string) => {
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
  decodeFlags: (flags: number) => {
    const flagNames: string[] = [];
    if (flags & 2) flagNames.push("scored");
    if (flags & 8) flagNames.push("final_pose");
    if (flags & 0x10) flagNames.push("suppress_guide_gesture");
    if (flags & 0x20) flagNames.push("omit_minigame");
    if (flags & 0x40) flagNames.push("useful");
    if (flags & 0x80) flagNames.push("suppress_practice_options");
    return flagNames;
  },
};

export type TestingUtils = typeof utils;

// Test registry - all tests are stored here
export const TESTS: Record<string, (song: SongState, utils: TestingUtils) => Promise<TestResult>> = {
  "Is first measure not empty?": isFirstMeasureNotEmpty,
  "Has finishing move?": hasFinishingMove,
  "Are rest moves at the beginning or finish?": areRestsOnlyAtBeginningOrAfterFinishing,
  "No scored moves after finishing": noScoredMovesAfterFinishing,
  "Is difficulty hierarchy respected?": isDifficultyHierarchyRespected,
  "Practice: moves used at most twice": arePracticeMovesUsedAtMostTwice,
  "Practice: sections consecutive": arePracticeSectionsConsecutive,
  "Practice: sections progressing": arePracticeSectionsProgressing,
  "Practice: last section finishing": isLastPracticeSectionFinishing,
  "Practice: difficulty hierarchy respected": isPracticeDifficultyHierarchyRespected,
  "Events: song events": checkSongEvents,
  "Camera: no camera at measure 0": isAnyCameraAtMeasureZero,
  "Drums: tracks have keys": checkDrumsTracks,
  "Cover: image is 512x512": checkSongMetaImageSize,
};

export type { TestResult };

// Function to run all tests
export async function runAllTests(song: SongState): Promise<Record<string, TestResult>> {
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
export function getTestIcon(status: TestResult["status"]): string {
  switch (status) {
    case TestResultType.success:
      return "✅";
    case TestResultType.warning:
      return "⚠️";
    case TestResultType.error:
      return "❌";
    case TestResultType.skipped:
      return "❔";
  }
}

// Helper function to check if tests passed (no errors)
export function allTestsPassed(results: Record<string, TestResult>): boolean {
  return !Object.values(results).some((result) => result.status === TestResultType.error);
}
