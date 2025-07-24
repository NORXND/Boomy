using BoomyBuilder.Builder.Models;
using BoomyBuilder.Builder.Models.Move;
using BoomyBuilder.Builder.Models.Practice;
using BoomyBuilder.Builder.Models.Timeline;
using MiloLib.Assets;
using MiloLib.Assets.Ham;

namespace BoomyBuilder.Builder.PracticeSectioner
{
    public class PracticeSectioner
    {

        public class PracticeStepResult
        {
            public List<PracticeSection.PracticeStep> Steps { get; set; } = new();
            public Dictionary<int, string> AllSteps { get; set; } = [];

            public Dictionary<string, string> SongNameMap { get; set; } = [];

            public Dictionary<int, string> AllStartSteps { get; set; } = [];
            public Dictionary<int, string> AllEndSteps { get; set; } = [];
        }

        public static Dictionary<Difficulty, List<PracticeStepResult>> CreatePracticeSection(BuildOperator op, DirectoryMeta MovesDir, DirectoryMeta MoveDataDir, Dictionary<Difficulty, Dictionary<int, Move>> choreography_all)
        {
            PracticeSection easySect = (PracticeSection)(MovesDir.entries.First(static d => d.name == "Easy_01_Play_All.sect").obj ?? throw new Exception("Easy_01_Play_All.sect obj not found"));
            PracticeSection mediumSect = (PracticeSection)(MovesDir.entries.First(static d => d.name == "Medium_01_Play_All.sect").obj ?? throw new Exception("Medium_01_Play_All.sect obj not found"));
            PracticeSection expertSect = (PracticeSection)(MovesDir.entries.First(static d => d.name == "Expert_01_Play_All.sect").obj ?? throw new Exception("Expert_01_Play_All.sect obj not found"));

            PracticeStepResult CreatePracticeStep(
                List<List<int>> allSections,
                int sectionIdx,
                Dictionary<int, Move> choreography,
                HashSet<int> usedBeatsBefore,
                HashSet<string> usedMoveNamesBefore
            )
            {

                var section = allSections[sectionIdx];
                // Precompute all choreography beats in order for correct transition logic
                var allChoreoBeats = choreography.Keys.OrderBy(b => b).ToList();

                string GetHamMoveName(Move move)
                {
                    return move.HamMoveName.Replace(".move", "").Replace("_" + move.SongName, "");
                }

                List<PracticeSection.PracticeStep> steps = [];
                Dictionary<int, string> AllSteps = [];
                Dictionary<string, string> SongNameMap = [];
                Dictionary<int, string> AllStartSteps = [];
                Dictionary<int, string> AllEndSteps = [];

                // Collect all beats used in previous sections
                for (int s = 0; s < sectionIdx; s++)
                    foreach (var b in allSections[s])
                        usedBeatsBefore.Add(b - 1); // always convert to 0-based

                var sectionBeats = section.Select(b => b - 1).Where(b => choreography.ContainsKey(b)).OrderBy(b => b).ToList();

                // Find the last beat in the choreography
                int lastChoreoBeat = choreography.Keys.Max();


                for (int sbIdx = 0; sbIdx < sectionBeats.Count; sbIdx++)
                {
                    int beat = sectionBeats[sbIdx];
                    // Special scenario: In the last section, skip the last move (regardless of beat), but use its move name as mEnd in the previous one
                    bool isLastSection = sectionIdx == allSections.Count - 1;
                    bool isLastMoveInSection = sbIdx == sectionBeats.Count - 1;
                    if (isLastSection && isLastMoveInSection)
                    {
                        Console.WriteLine($"[PracticeSectioner] Skipping last move in section {sectionIdx + 1} (beat {beat + 1})");
                        // If there is a previous step, set its mEnd to this move's name
                        if (steps.Count > 0 && choreography.TryGetValue(beat, out var lastMove))
                        {
                            Console.WriteLine($"[PracticeSectioner] Setting mEnd for previous step in section {sectionIdx + 1} (beat {beat})");
                            string lastMoveName = GetHamMoveName(lastMove);
                            steps[steps.Count - 1].mEnd = (Symbol)lastMoveName;
                        }
                        // Skip adding this last move as a step
                        continue;
                    }

                    // Only process if this beat/move hasn't been used before
                    if (usedBeatsBefore.Contains(beat) || usedMoveNamesBefore.Contains(GetHamMoveName(choreography[beat])))
                        continue;

                    int idxInChoreo = allChoreoBeats.IndexOf(beat);
                    if (idxInChoreo == -1)
                        continue;

                    if (!choreography.TryGetValue(beat, out var move))
                        throw new Exception($"No move found in choreography for beat {beat}");
                    string startName = GetHamMoveName(move);

                    // Find the next unused choreography beat
                    int nextIdx = idxInChoreo + 1;
                    int nextBeat = -1;
                    string nextName = "";
                    string endSong = "";


                    int candidate = allChoreoBeats[nextIdx];
                    var candidateMove = choreography[candidate];
                    string candidateName = GetHamMoveName(candidateMove);
                    if (!usedBeatsBefore.Contains(candidate) && !usedMoveNamesBefore.Contains(candidateName))
                    {
                        nextBeat = candidate;
                        nextName = candidateName;
                        endSong = candidateMove.SongName;
                    }

                    string mStart = startName;
                    string mEnd = "";

                    // Handle consecutive duplicate moves (run)
                    bool didRun = false;
                    if (idxInChoreo + 1 < allChoreoBeats.Count)
                    {
                        int nextChoreoBeat = allChoreoBeats[idxInChoreo + 1];
                        var nextChoreoMove = choreography[nextChoreoBeat];
                        string nextChoreoName = GetHamMoveName(nextChoreoMove);
                        if (startName == nextChoreoName)
                        {
                            // Only process the first in a run
                            bool isFirstInRun = (idxInChoreo == 0) || (GetHamMoveName(choreography[allChoreoBeats[idxInChoreo - 1]]) != startName);
                            if (!isFirstInRun)
                                continue;
                            // Find the end of the run
                            int runEnd = idxInChoreo + 1;
                            while (runEnd + 1 < allChoreoBeats.Count && GetHamMoveName(choreography[allChoreoBeats[runEnd + 1]]) == startName)
                                runEnd++;
                            mStart = startName + "*";
                            mEnd = startName + "_loop_end";
                            // Set endSong to the last move in the run
                            endSong = choreography[allChoreoBeats[runEnd]].SongName;
                            // Mark all beats in the run as used
                            for (int k = idxInChoreo; k <= runEnd; k++)
                            {
                                usedBeatsBefore.Add(allChoreoBeats[k]);
                                usedMoveNamesBefore.Add(GetHamMoveName(choreography[allChoreoBeats[k]]));
                            }
                            didRun = true;
                        }
                    }
                    if (!didRun)
                    {
                        // Not a run, handle normal or skip/end
                        if (string.IsNullOrEmpty(nextName) || usedBeatsBefore.Contains(nextBeat) || usedMoveNamesBefore.Contains(nextName))
                        {
                            mEnd = startName + "_end";
                            endSong = move.SongName;
                        }
                        else
                        {
                            mEnd = nextName;
                        }
                        // If mStart and mEnd are the same, always add _end to mEnd
                        if (mStart == mEnd)
                        {
                            mEnd = mStart + "_end";
                            endSong = move.SongName;
                        }
                        // Mark this move as used
                        usedBeatsBefore.Add(beat);
                        usedMoveNamesBefore.Add(startName);
                    }

                    steps.Add(new PracticeSection.PracticeStep()
                    {
                        mType = (Symbol)"learn",
                        mStart = (Symbol)mStart,
                        mEnd = (Symbol)mEnd,
                        mBoundary = false,
                        mNameOverride = (Symbol)""
                    });

                    // Use the actual beat as the key!
                    AllSteps.Add(beat, startName); // always 0-based
                    AllStartSteps.Add(beat, mStart);
                    AllEndSteps.Add(beat + 1, mEnd);
                    SongNameMap[startName] = move.SongName;
                    SongNameMap[mEnd] = endSong;
                }

                // Add review step using the last move as mEnd
                if (steps.Count > 0)
                {
                    int lastBeat = section[section.Count - 1] - 1;
                    string lastMoveName = "";
                    if (choreography.TryGetValue(lastBeat, out var lastMove))
                        lastMoveName = GetHamMoveName(lastMove);

                    // Use the last used mEnd (from the last step) as the review's mEnd
                    Symbol lastEndName = steps[steps.Count - 1].mEnd;
                    Symbol firstStartName = steps[0].mStart;
                    steps.Add(new PracticeSection.PracticeStep()
                    {
                        mType = (Symbol)"review",
                        mStart = firstStartName,
                        mEnd = lastEndName,
                        mBoundary = true,
                        mNameOverride = (Symbol)""
                    });
                }

                return new PracticeStepResult()
                {
                    Steps = steps,
                    AllSteps = AllSteps,
                    SongNameMap = SongNameMap,
                    AllStartSteps = AllStartSteps,
                    AllEndSteps = AllEndSteps
                };
            }

            List<PracticeStepResult> CreatePracticeSections(PracticeSection sectionsOutput, List<List<int>> sectionsInput, Dictionary<int, Move> choreography)
            {
                HashSet<int> usedBeatsBefore = new();
                HashSet<string> usedMoveNamesBefore = new();
                List<PracticeStepResult> results = [];
                for (int i = 0; i < sectionsInput.Count; i++)
                {
                    // Pass a copy so each section gets the correct "used before" set
                    var newSteps = CreatePracticeStep(
                        sectionsInput, i, choreography,
                        new HashSet<int>(usedBeatsBefore),
                        new HashSet<string>(usedMoveNamesBefore)
                    );
                    for (int j = 0; j < newSteps.Steps.Count; j++)
                    {
                        sectionsOutput.mSteps.Add(newSteps.Steps[j]);
                    }
                    // After processing, add all beats and move names from this section to the global set
                    foreach (var b in sectionsInput[i])
                        usedBeatsBefore.Add(b - 1); // always 0-based
                    foreach (var step in newSteps.AllSteps)
                        usedMoveNamesBefore.Add(step.Value);
                    results.Add(newSteps);
                }
                return results;
            }

            List<PracticeStepResult> easyResult = CreatePracticeSections(easySect, op.Request.Practice.Easy, choreography_all[Difficulty.Easy]);
            List<PracticeStepResult> mediumResult = CreatePracticeSections(mediumSect, op.Request.Practice.Medium, choreography_all[Difficulty.Medium]);
            List<PracticeStepResult> expertResult = CreatePracticeSections(expertSect, op.Request.Practice.Expert, choreography_all[Difficulty.Expert]);

            return new Dictionary<Difficulty, List<PracticeStepResult>>
            {
                { Difficulty.Easy, easyResult },
                { Difficulty.Medium, mediumResult },
                { Difficulty.Expert, expertResult }
            };
        }
    }
}
