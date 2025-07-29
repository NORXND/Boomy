import { SongState } from "@/store/songStore";
import { BattleEvent, CameraEvent, CameraPosition, MoveEvent } from "@/types/song";
import { toast } from "sonner";

const SUPEREASY_MOVES = [
  "amped_l",
  "back",
  "back_l",
  "bent_clap",
  "blazer",
  "blend",
  "booty_down",
  "broadway",
  "bum_a_ride",
  "chill",
  "clap_clap",
  "concert_jump_l",
  "concert_jump_r",
  "courier",
  "crook",
  "crunch_r",
  "east_r",
  "eye_spy",
  "gank",
  "get_back",
  "hammer",
  "hands_in_the_air",
  "headbanger",
  "headwrush",
  "heel_tap_l",
  "heel_tap_r",
  "hello_l",
  "hello_r",
  "hip_swing",
  "how_we_do",
  "hyper_r",
  "leave_me_alone",
  "loom",
  "make_way",
  "muscle_man",
  "no_worries",
  "open_hip_wind",
  "portrait",
  "reach_down_arms",
  "ride_it",
  "rigopulpop_l",
  "rigopulpop_r",
  "say_what",
  "select",
  "select_r",
  "silk",
  "silly_wind_winner",
  "slice_out",
  "snap_l",
  "snap_r",
  "sound_check",
  "step_center",
  "step_center_and_clap",
  "step_side",
  "step_side_and_clap",
  "striker",
  "swing_clap",
  "swirlies",
  "t_d_o_e_scratch",
  "tap_front",
  "tell_em_r",
  "ten_step",
  "this_or_that",
  "thrasher",
  "throw_it_up",
  "torch",
  "want_cha",
  "west_l",
  "woo",
  "woo_jab",
];

const checkMove = async (state: SongState, move: string, song: string, category: string) => {
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
};

const decodeFlags = (flags: number): string[] => {
  const flagNames: string[] = [];
  if (flags & 2) flagNames.push("Scored");
  if (flags & 8) flagNames.push("Final Pose");
  if (flags & 0x10) flagNames.push("Suppress Guide Gesture");
  if (flags & 0x20) flagNames.push("Omit Minigame");
  if (flags & 0x40) flagNames.push("Useful");
  if (flags & 0x80) flagNames.push("Suppress Practice Options");
  return flagNames;
};

// Helper to get random camera position (excluding VENUE and CLOSEUP)
function getRandomCameraPosition(): CameraPosition {
  const positions = Object.values(CameraPosition).filter((pos) => pos !== CameraPosition.Venue && pos !== CameraPosition.Closeup);
  return positions[Math.floor(Math.random() * positions.length)];
}

export async function generateDifficultyMoves(difficulty: "supereasy" | "easy" | "medium", state: SongState): Promise<MoveEvent[] | null> {
  // 1. Get expert moves (assume state.currentSong.moves is an array of MoveEvent sorted by measure)
  const expertMoves: MoveEvent[] = state.currentSong.timeline.expert.moves;

  // 2. For each move, check its difficulty using checkMove
  const filteredMoves: MoveEvent[] = [];
  for (const move of expertMoves) {
    const moveData = await checkMove(state, move.move, move.move_song, move.move_origin);
    if (!moveData) continue;
    const moveFlags = decodeFlags(moveData.clips[move.clip].flags);
    if (moveFlags.includes("Final Pose") || !moveFlags.includes("Scored")) {
      filteredMoves.push(move);
      continue;
    }

    console.log("Move:", move.move, "Flags:", moveFlags);

    const moveDiff = moveData.difficulty;
    if (difficulty === "medium" && moveDiff < 2) filteredMoves.push(move);
    if (difficulty === "easy" && moveDiff === 0) filteredMoves.push(move);
    if (difficulty === "supereasy") {
      if (SUPEREASY_MOVES.includes(moveData.name)) {
        filteredMoves.push(move);
      }
    }
  }

  if (filteredMoves.length === 0) {
    toast.warning(`No moves found for ${difficulty} difficulty. Generation aborted.`);
    return null;
  }

  const hasFirstMeasure = filteredMoves.some((m) => m.measure === 1);

  if (!hasFirstMeasure) {
    toast.warning(`No moves found for ${difficulty} difficulty at first measure. Generation aborted.`);
    return null;
  }

  // 5. Fill gaps by repeating previous move
  const filledMoves: MoveEvent[] = [];
  let prevMove = null;
  const maxMeasure = Math.max(...expertMoves.map((m) => m.measure));
  for (let measure = 0; measure <= maxMeasure; measure++) {
    const move = filteredMoves.find((m) => m.measure === measure);
    if (move) {
      filledMoves.push(move);
      prevMove = move;
    } else if (prevMove) {
      // Repeat previous move at this measure
      filledMoves.push({ ...prevMove, measure });
    }
  }

  return filledMoves;
}

export async function generateCamerasForDifficulty(difficulty: "easy" | "medium" | "expert", state: SongState): Promise<CameraEvent[] | void> {
  let moves: MoveEvent[] = [];
  if (difficulty === "expert") moves = state.currentSong.timeline.expert.moves;
  else if (difficulty === "medium") moves = state.currentSong.timeline.medium.moves;
  else if (difficulty === "easy") moves = state.currentSong.timeline.easy.moves;

  if (!moves || moves.length === 0) return [];

  const cameras: CameraEvent[] = [];

  // 1. First beat is always VENUE (at beat 0)
  cameras.push({ beat: 0, camera: CameraPosition.Venue });

  // 2. Find rest area (measures with non-scored moves)
  const restMeasures: number[] = [];
  for (const move of moves) {
    const moveData = await checkMove(state, move.move, move.move_song, move.move_origin);
    if (!moveData) continue;
    const moveFlags = decodeFlags(moveData.clips[move.clip].flags);
    if (!moveFlags.includes("Scored")) {
      if (!restMeasures.includes(move.measure)) {
        restMeasures.push(move.measure);
      }
    }
  }

  // 3. Find first scored move (not in restMeasures)
  const scoredMoves = moves.filter((m) => !restMeasures.includes(m.measure));
  const firstScoredMeasure = scoredMoves.length > 0 ? Math.min(...scoredMoves.map((m) => m.measure)) : null;

  // 4. Always add a random camera 2-4 beats before first scored move (even if in rest area)
  let beforeScoredBeat: number | null = null;
  if (firstScoredMeasure && firstScoredMeasure > 1) {
    const firstScoredBeat = (firstScoredMeasure - 1) * 4;
    beforeScoredBeat = firstScoredBeat - (2 + Math.floor(Math.random() * 3)); // 2-4 beats before
    if (beforeScoredBeat >= 0) {
      cameras.push({
        beat: beforeScoredBeat,
        camera: getRandomCameraPosition(),
      });
    }
  }

  // 5. If there is a rest area, randomly place CLOSEUP in the middle of it (in beats), but not if it would overwrite the beforeScoredBeat
  let restEnd = -1;
  console.log("Rest measures:", restMeasures);
  if (restMeasures.length > 0) {
    const restStart = Math.min(...restMeasures);
    restEnd = Math.max(...restMeasures);
    if (restEnd > restStart) {
      const midRestMeasure = restStart + Math.floor((restEnd - restStart) / 2);
      const midRestBeat = (midRestMeasure - 1) * 4;
      // Randomly decide to add CLOSEUP (60% chance now)
      if (
        Math.random() < 0.6 &&
        midRestBeat !== beforeScoredBeat // don't overwrite beforeScoredBeat
      ) {
        cameras.push({
          beat: midRestBeat,
          camera: CameraPosition.Closeup,
        });
      }
    }
  }

  // 6. Add random camera every 3-4 measures (randomized), but only after the end of the rest area
  const lastMoveMeasure = Math.max(...moves.map((m) => m.measure));
  const afterRestMeasure = restEnd > 0 ? restEnd + 1 : 2; // start after rest area, or after measure 1 if no rest area
  let nextCameraMeasure = afterRestMeasure + 3 + Math.floor(Math.random() * 2); // 3 or 4 after rest

  while (nextCameraMeasure <= lastMoveMeasure) {
    const beat = (nextCameraMeasure - 1) * 4;
    // Don't duplicate a camera at the same beat as beforeScoredBeat or CLOSEUP
    if (!cameras.some((c) => c.beat === beat)) {
      cameras.push({
        beat,
        camera: getRandomCameraPosition(),
      });
    }
    nextCameraMeasure += 3 + Math.floor(Math.random() * 2); // next in 3-4 measures
  }

  // Sort cameras by beat
  cameras.sort((a, b) => a.beat - b.beat);

  return cameras;
}

export async function generateBattleEvents(state: SongState, party: Array<number>[] | undefined = undefined): Promise<BattleEvent[] | void> {
  // First, find the offset from the first reset
  const existingBattleSteps: BattleEvent[] = state.currentSong.battleSteps || [];
  const firstReset = existingBattleSteps.find((e) => e.type === "battle_reset");
  if (!firstReset) {
    toast.error("No battle_reset event found in current battle events. Cannot generate battle events.");
    return null;
  }

  const offset = firstReset.measure;
  const startMeasure = offset + 4; // Leave a 4-measure gap after the first reset
  const endBuffer = 4; // Leave 4 measures at the end
  const totalMeasures = state.totalMeasures;
  const availableMeasures = totalMeasures - offset - 4 - endBuffer;

  if (availableMeasures < 1) {
    toast.error("Not enough measures to schedule events with required gaps.");
    return null;
  }

  // Check if we have jumps defined
  const hasJumps = party && party.length > 0;
  if (hasJumps) {
    console.log(`[DEBUG] Found ${party.length} jump sections, will avoid these measures`);
  }

  console.log(`[DEBUG] totalMeasures: ${totalMeasures}, offset: ${offset}, availableMeasures: ${availableMeasures}`);

  // Constants that may be adjusted in fallback attempts
  const defaultConfig = {
    soloLength: 4,
    gap: 4,
    minigameIdleLength: 16,
    idleToEndGap: 2, // FIXED: Always 2 measures between idle and end
    maxSoloPairs: 8,
    minSoloPairs: hasJumps ? 2 : 4, // Allow fewer solos with jumps
    minigames: hasJumps ? 1 : 2,
    balancedSolos: true,
    minMeasuresUsed: Math.min(52, availableMeasures * 0.8),
  };

  // Generate attempts with gradually relaxed constraints
  const attempts = [
    { ...defaultConfig }, // Try with default settings
    { ...defaultConfig, minSoloPairs: hasJumps ? 1 : 3 }, // Try with fewer solos
    { ...defaultConfig, minSoloPairs: hasJumps ? 0 : 2, minigames: hasJumps ? 1 : 1 }, // Even fewer solos
    { ...defaultConfig, minSoloPairs: 0, minigames: hasJumps ? 1 : 1 }, // Minimal solos
    { ...defaultConfig, minSoloPairs: 0, minigames: hasJumps ? 0 : 1, gap: 3 }, // No solos
    { ...defaultConfig, minSoloPairs: 0, minigames: 0, gap: 3, minMeasuresUsed: availableMeasures * 0.5 }, // Last resort
  ];

  let bestEvents: BattleEvent[] | null = null;
  let bestCoverage = 0;

  // Try each configuration until one works
  for (const config of attempts) {
    console.log(`[DEBUG] Attempting with minigames=${config.minigames}, minSoloPairs=${config.minSoloPairs}, gap=${config.gap}`);

    const events = generateWithConfig(config, startMeasure, availableMeasures);

    if (events) {
      // Calculate how much of the available space this attempt uses
      const lastEvent = events[events.length - 1];
      let lastUsedMeasure = lastEvent.measure;
      if (lastEvent.type === "minigame_end") lastUsedMeasure += 1; // End events are 1 measure long now
      else if (lastEvent.type === "battle_reset") lastUsedMeasure += 1;

      const coverage = (lastUsedMeasure - startMeasure + 1) / availableMeasures;

      // Keep the attempt with the best coverage
      if (coverage > bestCoverage) {
        bestEvents = events;
        bestCoverage = coverage;

        // If we have good coverage (>80%), no need to try more relaxed constraints
        if (coverage > 0.8) break;
      }
    }
  }

  if (!bestEvents) {
    toast.error("Unable to fit any valid battle event sequence in the available measures, even with relaxed constraints.");
    return null;
  }

  // Validate the best events
  if (!validateEvents(bestEvents, totalMeasures, startMeasure + availableMeasures - 1)) {
    return null; // Validation will show appropriate error
  }

  // Final check for 4-measure gap at the end
  const lastEvent = bestEvents[bestEvents.length - 1];
  let lastUsedMeasure = lastEvent.measure;
  if (lastEvent.type === "minigame_end") lastUsedMeasure += 1; // End events are 1 measure long
  else if (lastEvent.type === "battle_reset") lastUsedMeasure += 1;

  if (lastUsedMeasure > totalMeasures - endBuffer) {
    toast.error(`Events exceed measure limit: used ${lastUsedMeasure}, limit ${totalMeasures - endBuffer}`);
    return null;
  }

  return bestEvents;

  // Helper function to generate events with specific config
  function generateWithConfig(config: typeof defaultConfig, startMeasure: number, availableMeasures: number): BattleEvent[] | null {
    const events: BattleEvent[] = [];
    let p1 = 0,
      p2 = 0;

    // Function to check if a measure is within any jump period
    function isInJumpPeriod(measure: number): boolean {
      if (!party || party.length === 0) return false;
      return party.some(([start, end]) => measure >= start && measure <= end);
    }

    // 1. FIRST PLACE MINIGAMES at strategic positions (3/8 and 6/8 of song)
    const minigameStarts: number[] = [];

    if (config.minigames > 0) {
      // Calculate total minigame block length with fixed 2-measure gap
      const minigameBlockLength = config.minigameIdleLength + config.idleToEndGap + 1;

      // Strategic placement at 3/8 and 6/8 points (adjusted for minimum gaps)
      if (config.minigames >= 1 && availableMeasures > minigameBlockLength + config.gap * 2) {
        // Place first minigame at 3/8 of available space
        let firstMinigamePos = Math.floor(startMeasure + (availableMeasures * 3) / 8);

        // Adjust position if it falls within a jump period
        if (isInJumpPeriod(firstMinigamePos)) {
          // Try to find a position outside jump periods
          let found = false;
          for (let offset = 1; offset <= 8; offset++) {
            // Try positions before and after the original position
            if (!isInJumpPeriod(firstMinigamePos - offset)) {
              firstMinigamePos -= offset;
              found = true;
              break;
            }
            if (!isInJumpPeriod(firstMinigamePos + offset)) {
              firstMinigamePos += offset;
              found = true;
              break;
            }
          }

          if (!found) {
            console.log(`[DEBUG] Couldn't place first minigame due to jump periods`);
          } else {
            minigameStarts.push(firstMinigamePos);
          }
        } else {
          minigameStarts.push(firstMinigamePos);
        }

        // If we want two minigames and have space (and don't have jumps), place second at 6/8
        if (!hasJumps && config.minigames >= 2 && availableMeasures > minigameBlockLength * 2 + config.gap * 3) {
          let secondMinigamePos = Math.floor(startMeasure + (availableMeasures * 6) / 8);

          // Ensure minimum gap between minigames
          if (secondMinigamePos > firstMinigamePos + minigameBlockLength + config.gap) {
            // Check if this position falls within a jump period
            if (isInJumpPeriod(secondMinigamePos)) {
              // Try to find a position outside jump periods
              let found = false;
              for (let offset = 1; offset <= 8; offset++) {
                if (!isInJumpPeriod(secondMinigamePos - offset) && secondMinigamePos - offset > firstMinigamePos + minigameBlockLength + config.gap) {
                  secondMinigamePos -= offset;
                  found = true;
                  break;
                }
                if (!isInJumpPeriod(secondMinigamePos + offset)) {
                  secondMinigamePos += offset;
                  found = true;
                  break;
                }
              }

              if (!found) {
                console.log(`[DEBUG] Couldn't place second minigame due to jump periods`);
              } else {
                minigameStarts.push(secondMinigamePos);
              }
            } else {
              minigameStarts.push(secondMinigamePos);
            }
          }
        }
      }

      console.log(`[DEBUG] Placed minigames at measures: ${minigameStarts.join(", ")}`);
    }

    // 2. Create minigame events with FIXED 2-measure gap between idle and end
    const minigameBlocks: { start: number; idle: number; end: number }[] = [];
    for (const startPos of minigameStarts) {
      const idlePos = startPos + config.minigameIdleLength;
      // FIXED: Always 2 measures between idle and end
      const endPos = idlePos + config.idleToEndGap;
      minigameBlocks.push({ start: startPos, idle: idlePos, end: endPos });
    }

    // 3. NOW SCHEDULE SOLOS throughout the song, allowing overlap with minigame_idle and minigame_end
    let measureCursor = startMeasure;
    const maxSolos = config.maxSoloPairs * 2;

    // First identify and sort all jump end points to prioritize placing solos after them
    const jumpEndPoints: number[] = [];
    if (party && party.length > 0) {
      party.forEach(([_, end]) => {
        // Add 1 to end to start right after the jump
        jumpEndPoints.push(end + 1);
      });
    }
    jumpEndPoints.sort((a, b) => a - b);

    // Try to place solos first after jump end points
    for (const jumpEnd of jumpEndPoints) {
      if (p1 + p2 >= maxSolos) break;

      // Only use jump end points that are within our available range
      if (jumpEnd < startMeasure || jumpEnd >= startMeasure + availableMeasures - config.soloLength - 1) {
        continue;
      }

      // Skip if too close to a minigame start
      const isTooCloseToMinigame = minigameStarts.some((start) => jumpEnd > start - 4 && jumpEnd < start);
      if (isTooCloseToMinigame) continue;

      // Check for gap requirements after last reset
      const lastReset = [...events].reverse().find((e) => e.type === "battle_reset");
      if (lastReset && jumpEnd < lastReset.measure + config.gap) {
        continue;
      }

      // Check if the solo would overlap with any jump period
      let soloOverlapsJump = false;
      for (let m = jumpEnd; m <= jumpEnd + config.soloLength; m++) {
        if (isInJumpPeriod(m)) {
          soloOverlapsJump = true;
          break;
        }
      }
      if (soloOverlapsJump) continue;

      // Schedule a solo after this jump end
      const soloType = p1 <= p2 ? "player1_solo" : "player2_solo";
      events.push({ measure: jumpEnd, type: soloType });
      events.push({ measure: jumpEnd + config.soloLength, type: "battle_reset" });

      if (soloType === "player1_solo") p1++;
      else p2++;
    }

    // Continue with regular solo scheduling
    while (measureCursor + config.soloLength + 1 <= startMeasure + availableMeasures - 1 && p1 + p2 < maxSolos) {
      // Skip if we're exactly at a minigame start point
      if (minigameStarts.includes(measureCursor)) {
        measureCursor++;
        continue;
      }

      // Skip if this measure is within a jump period
      if (isInJumpPeriod(measureCursor)) {
        // Skip to after this jump period
        let nextMeasure = measureCursor;
        while (isInJumpPeriod(nextMeasure) || isInJumpPeriod(nextMeasure + config.soloLength)) {
          nextMeasure++;
        }
        measureCursor = nextMeasure;
        continue;
      }

      // Check if the solo or reset would overlap with a jump period
      let soloOverlapsJump = false;
      for (let m = measureCursor; m <= measureCursor + config.soloLength; m++) {
        if (isInJumpPeriod(m)) {
          soloOverlapsJump = true;
          break;
        }
      }

      if (soloOverlapsJump) {
        // Skip to after this jump period
        let nextMeasure = measureCursor;
        while (isInJumpPeriod(nextMeasure) || isInJumpPeriod(nextMeasure + config.soloLength)) {
          nextMeasure++;
        }
        measureCursor = nextMeasure;
        continue;
      }

      // Check for gap requirements after battle_reset
      const lastReset = [...events].reverse().find((e) => e.type === "battle_reset");
      if (lastReset && measureCursor < lastReset.measure + config.gap) {
        console.log(`[DEBUG] Not enough gap after last reset at measure ${lastReset.measure}, moving to ${lastReset.measure + config.gap}`);
        measureCursor = lastReset.measure + config.gap;
        continue;
      } else if (!lastReset && events.length > 0) {
        // No previous reset but we have other events, ensure gap from start
        measureCursor = Math.max(measureCursor, startMeasure + config.gap);
      }

      // Only avoid the 4 measures before a minigame_start
      const isTooCloseToMinigame = minigameStarts.some((start) => measureCursor > start - 4 && measureCursor < start);

      if (isTooCloseToMinigame) {
        // Skip to after this minigame start
        const nextMinigame = minigameStarts.find((start) => measureCursor < start);
        if (nextMinigame) {
          measureCursor = nextMinigame + 1;
          continue;
        }
      }

      // Check if we still have space for a solo
      if (measureCursor + config.soloLength + 1 > startMeasure + availableMeasures - 1) {
        console.log(`[DEBUG] Not enough space for solo at measure ${measureCursor}`);
        break;
      }

      // Determine solo type with balanced allocation
      let soloType: "player1_solo" | "player2_solo";
      if (config.balancedSolos) {
        if (p1 < p2) soloType = "player1_solo";
        else if (p2 < p1) soloType = "player2_solo";
        else soloType = Math.random() < 0.5 ? "player1_solo" : "player2_solo";
      } else {
        if (p1 < p2 - 1) soloType = "player1_solo";
        else if (p2 < p1 - 1) soloType = "player2_solo";
        else soloType = Math.random() < 0.5 ? "player1_solo" : "player2_solo";
      }

      // Schedule solo and reset
      console.log(`[DEBUG] Scheduling ${soloType} at measure ${measureCursor}`);
      events.push({ measure: measureCursor, type: soloType });

      console.log(`[DEBUG] Scheduling battle_reset at measure ${measureCursor + config.soloLength}`);
      events.push({ measure: measureCursor + config.soloLength, type: "battle_reset" });

      // Update counters
      if (soloType === "player1_solo") p1++;
      else p2++;

      // Advance cursor past this solo
      measureCursor += config.soloLength + 1;
    }

    // 4. Now add minigame events and sort everything by measure
    for (const block of minigameBlocks) {
      // Verify none of the minigame events overlap with jump periods
      if (!isInJumpPeriod(block.start) && !isInJumpPeriod(block.idle) && !isInJumpPeriod(block.end)) {
        events.push({ measure: block.start, type: "minigame_start" });
        events.push({ measure: block.idle, type: "minigame_idle" });
        events.push({ measure: block.end, type: "minigame_end" });
      } else {
        console.log(`[DEBUG] Skipping minigame that overlaps with jump periods`);
      }
    }

    // Sort events by measure
    events.sort((a, b) => a.measure - b.measure);

    // Verify requirements
    if (events.length === 0) {
      return null;
    }

    // Check if we meet minimum requirements
    const lastEvent = events[events.length - 1];
    let lastUsedMeasure = lastEvent.measure;
    if (lastEvent.type === "minigame_end") lastUsedMeasure += 1; // End events are 1 measure long
    else if (lastEvent.type === "battle_reset") lastUsedMeasure += 1;

    const measuresCovered = lastUsedMeasure - startMeasure + 1;
    const minigamesScheduled = events.filter((e) => e.type === "minigame_start").length;

    // Check if we've met the minimum requirements for this config
    if (
      // Minigames requirement
      minigamesScheduled >= config.minigames &&
      // Solo pairs requirement
      p1 + p2 >= config.minSoloPairs * 2 &&
      // Balance requirement (if enabled)
      (!config.balancedSolos || p1 === p2) &&
      // Minimum measures covered
      measuresCovered >= config.minMeasuresUsed
    ) {
      return events;
    }

    return null;
  }

  // Helper function to validate event sequence
  function validateEvents(events: BattleEvent[], totalMeasures: number, maxMeasure: number): boolean {
    // Function to check if a measure is within any jump period
    function isInJumpPeriod(measure: number): boolean {
      if (!party || party.length === 0) return false;
      return party.some(([start, end]) => measure >= start && measure <= end);
    }

    // Check for measure overlap
    for (let i = 0; i < events.length - 1; i++) {
      if (events[i].measure === events[i + 1].measure) {
        toast.error(`Measure overlap detected at measure ${events[i].measure}`);
        return false;
      }
    }

    // Check for events during jump periods
    for (const event of events) {
      if (isInJumpPeriod(event.measure)) {
        toast.error(`Event scheduled during jump period at measure ${event.measure}`);
        return false;
      }
    }

    // Count solos and minigames
    const p1 = events.filter((e) => e.type === "player1_solo").length;
    const p2 = events.filter((e) => e.type === "player2_solo").length;

    // Allow slight imbalance in relaxed attempts
    const lastAttempt = attempts[attempts.length - 1];
    if (!lastAttempt.balancedSolos && Math.abs(p1 - p2) > 1) {
      toast.error(`Solos too imbalanced: player1=${p1}, player2=${p2}`);
      return false;
    }

    // Check if last event exceeds measure limit
    const last = events[events.length - 1];
    const endOffset = last.type === "battle_reset" ? 1 : last.type === "minigame_end" ? 2 : 0;

    if (last.measure + endOffset > maxMeasure) {
      toast.error(`Events exceed measure limit: used ${last.measure + endOffset}, limit ${maxMeasure}`);
      return false;
    }

    return true;
  }
}
