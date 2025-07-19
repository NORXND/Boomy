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
        }

        public static Dictionary<Difficulty, List<PracticeStepResult>> CreatePracticeSection(BuildOperator op, DirectoryMeta MovesDir, DirectoryMeta MoveDataDir, Dictionary<Difficulty, Dictionary<int, Move>> choreography_all)
        {
            PracticeSection easySect = (PracticeSection)(MovesDir.entries.First(static d => d.name == "Easy_01_Play_All.sect").obj ?? throw new Exception("Easy_01_Play_All.sect obj not found"));
            PracticeSection mediumSect = (PracticeSection)(MovesDir.entries.First(static d => d.name == "Medium_01_Play_All.sect").obj ?? throw new Exception("Medium_01_Play_All.sect obj not found"));
            PracticeSection expertSect = (PracticeSection)(MovesDir.entries.First(static d => d.name == "Expert_01_Play_All.sect").obj ?? throw new Exception("Expert_01_Play_All.sect obj not found"));

            PracticeStepResult CreatePracticeStep(List<List<MoveEvent>> allSections, int sectionIdx, Dictionary<int, Move> choreography)
            {
                var section = allSections[sectionIdx];

                string GetHamMoveName(Move move)
                {
                    return move.HamMoveName.Replace(".move", "").Replace("_" + move.SongName, "");
                }

                List<PracticeSection.PracticeStep> steps = [];
                Dictionary<int, string> AllSteps = [];
                Dictionary<string, string> SongNameMap = [];

                string lastName = "";
                for (int i = 0; i < section.Count; i++)
                {
                    string startName = "";
                    string endName = "";
                    string endSong = "";

                    Move sectionMove = new(section[i], op);
                    startName = GetHamMoveName(sectionMove);
                    // Find next move in section

                    // Only add 'learn' step if not the last step of the last section
                    bool isLastSection = sectionIdx == allSections.Count - 1;
                    bool isLastStep = i == section.Count - 1;
                    if (!(isLastSection && isLastStep))
                    {
                        Move? nextMove = i + 1 < section.Count ? new Move(section[i + 1], op) : null;
                        if (nextMove != null)
                        {
                            endName = GetHamMoveName(nextMove);
                            endSong = nextMove.SongName;
                        }
                        else
                        {
                            // Look for the first move in the next section(s)
                            bool found = false;
                            for (int s = sectionIdx + 1; s < allSections.Count && !found; s++)
                            {
                                var nextSection = allSections[s];
                                if (nextSection.Count > 0)
                                {
                                    Move lookaheadMove = new Move(nextSection[0], op);
                                    endName = GetHamMoveName(lookaheadMove);
                                    endSong = lookaheadMove.SongName;
                                    found = true;
                                }
                            }
                            if (!found)
                            {
                                throw new BoomyException($"No next move found for section move: {sectionMove.HamMoveName} in song: {sectionMove.SongName}");
                            }
                        }
                        lastName = endName;
                        steps.Add(new PracticeSection.PracticeStep()
                        {
                            mType = (Symbol)"learn",
                            mStart = (Symbol)startName,
                            mEnd = (Symbol)endName,
                            mBoundary = false,
                            mNameOverride = (Symbol)""
                        });
                    }

                    AllSteps.Add(i, startName);
                    SongNameMap[startName] = sectionMove.SongName;
                    SongNameMap[endName] = endSong;
                }

                Symbol firstStartName = steps[0].mStart;

                steps.Add(new PracticeSection.PracticeStep()
                {
                    mType = (Symbol)"review",
                    mStart = firstStartName,
                    mEnd = (Symbol)lastName,
                    mBoundary = true,
                    mNameOverride = (Symbol)""
                });

                return new PracticeStepResult()
                {
                    Steps = steps,
                    AllSteps = AllSteps,
                    SongNameMap = SongNameMap
                };
            }

            List<PracticeStepResult> CreatePracticeSections(PracticeSection sectionsOutput, List<List<MoveEvent>> sectionsInput, Dictionary<int, Move> choreography)
            {
                List<PracticeStepResult> results = [];
                for (int i = 0; i < sectionsInput.Count; i++)
                {
                    var newSteps = CreatePracticeStep(sectionsInput, i, choreography);
                    for (int j = 0; j < newSteps.Steps.Count; j++)
                    {
                        sectionsOutput.mSteps.Add(newSteps.Steps[j]);
                    }
                    results.Add(newSteps);
                }

                // foreach (var stepResult in results)
                // {
                //     foreach (string moveName in usedMoveNames)
                //     {
                //         if (!choreography.Values.Any(m => m.HamMoveName == moveName))
                //             continue;
                //         Move move = choreography.Values.First(m => m.HamMoveName == moveName);
                //         HamMove hamMove = (HamMove)(MoveDataDir.entries.First(d => d.name == move.HamMoveName).obj ?? throw new Exception($"{move.HamMoveName} obj not found"));
                //         string seqName = hamMove.mDancerSeq.value;
                //         try
                //         {
                //             DancerSequence sequence = (DancerSequence)(MoveDataDir.entries.First(d => d.name == seqName).obj ?? throw new Exception($"{seqName} obj not found"));
                //             sectionsOutput.mSeqs.Add(sequence);
                //         }
                //         catch (Exception) { }
                //     }

                // }
                // Return both PracticeSection and map
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