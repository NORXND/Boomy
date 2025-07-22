using BoomyBuilder.Builder.Models;
using BoomyBuilder.Builder.Models.Move;
using MiloLib.Assets;
using MiloLib.Assets.Ham;
using static BoomyBuilder.Builder.PracticeSectioner.PracticeSectioner;
using static MiloLib.Assets.Ham.DancerSequence;

namespace BoomyBuilder.Builder.Sequentioner
{
    public class Sequentioner
    {
        public static void CreateSequences(BuildOperator op, DirectoryMeta MovesDir, DirectoryMeta MoveDataDir, Dictionary<Difficulty, Dictionary<int, Move>> choreography, Dictionary<Difficulty, List<PracticeStepResult>> practiceSections)
        {
            DancerSequence easySecq = (DancerSequence)(MovesDir.entries.First(static d => d.name == "performance_easy.seq").obj ?? throw new Exception("performance_easy.seq obj not found"));
            DancerSequence mediumSecq = (DancerSequence)(MovesDir.entries.First(static d => d.name == "performance_medium.seq").obj ?? throw new Exception("performance_medium.seq obj not found"));
            DancerSequence expertSecq = (DancerSequence)(MovesDir.entries.First(static d => d.name == "performance_expert.seq").obj ?? throw new Exception("performance_expert.seq obj not found"));

            PracticeSection easySect = (PracticeSection)(MovesDir.entries.First(static d => d.name == "Easy_01_Play_All.sect").obj ?? throw new Exception("Easy_01_Play_All.sect obj not found"));
            PracticeSection mediumSect = (PracticeSection)(MovesDir.entries.First(static d => d.name == "Medium_01_Play_All.sect").obj ?? throw new Exception("Medium_01_Play_All.sect obj not found"));
            PracticeSection expertSect = (PracticeSection)(MovesDir.entries.First(static d => d.name == "Expert_01_Play_All.sect").obj ?? throw new Exception("Expert_01_Play_All.sect obj not found"));

            void AddFrames(DancerSequence sequence, Dictionary<int, Move> track, List<PracticeStepResult> sections, PracticeSection section)
            {
                // For each PracticeStepResult (section)
                foreach (var sectionResult in sections)
                {
                    var stepToFrames = new List<List<DancerFrame>>();
                    for (int i = 0; i < sectionResult.Steps.Count; i++)
                    {
                        var step = sectionResult.Steps[i];
                        if (step.mType.ToString() == "learn")
                        {
                            // Compose full move name using SongNameMap
                            string moveName = step.mStart.ToString();
                            string songName = sectionResult.SongNameMap.ContainsKey(moveName) ? sectionResult.SongNameMap[moveName] : string.Empty;
                            if (string.IsNullOrEmpty(songName))
                                continue;
                            string fullMoveName = moveName + "_" + songName;
                            // Find the Move in track and its beat
                            var moveEntry = track.FirstOrDefault(kvp => kvp.Value.HamMoveName.Replace(".move", "") == fullMoveName);
                            if (moveEntry.Value == null)
                                continue;
                            int moveBeat = moveEntry.Key;
                            var move = moveEntry.Value;
                            string miloName = move.MiloName + ".seq";
                            var entry = MoveDataDir.entries.FirstOrDefault(d => d.name == miloName);
                            if (entry?.obj is DancerSequence seq)
                            {
                                // Copy frames, set unk0 to beat
                                List<DancerFrame> newFrames = new List<DancerFrame>();
                                foreach (var frame in seq.mDancerFrames)
                                {
                                    DancerFrame frameNew = new()
                                    {
                                        unk0 = (short)(moveBeat),
                                        unk2 = frame.unk2,
                                        mSkeleton = frame.mSkeleton
                                    };
                                    newFrames.Add(frameNew);
                                }
                                // Create DancerSequence and add to section.mSeqs
                                DancerSequence newSeq = new DancerSequence();
                                newSeq.revision = seq.revision;
                                newSeq.altRevision = seq.altRevision;
                                newSeq.rndAnimatable = seq.rndAnimatable;
                                newSeq.mDancerFrames = newFrames;
                                section.mSeqs.Add(newSeq);
                                stepToFrames.Add(newFrames);
                            }
                        }
                        else if (step.mType.ToString() == "review")
                        {
                            // Collect all frames from previous steps in this section (since last review or from start)
                            List<DancerFrame> reviewFrames = new List<DancerFrame>();
                            int lastReviewIdx = stepToFrames.Count - 1;
                            // Find last review step index
                            for (int j = i - 1; j >= 0; j--)
                            {
                                if (sectionResult.Steps[j].mType.ToString() == "review")
                                {
                                    lastReviewIdx = j;
                                    break;
                                }
                            }
                            // Add all frames from steps after last review (or from start)
                            for (int j = lastReviewIdx == stepToFrames.Count - 1 ? 0 : lastReviewIdx + 1; j < stepToFrames.Count; j++)
                            {
                                reviewFrames.AddRange(stepToFrames[j]);
                            }
                            // Create DancerSequence and add to section.mSeqs
                            DancerSequence reviewSeq = new DancerSequence();
                            if (section.mSeqs.Count > 0)
                            {
                                var refSeq = section.mSeqs.Last();
                                reviewSeq.revision = refSeq.revision;
                                reviewSeq.altRevision = refSeq.altRevision;
                                reviewSeq.rndAnimatable = refSeq.rndAnimatable;
                            }
                            reviewSeq.mDancerFrames = reviewFrames;
                            section.mSeqs.Add(reviewSeq);
                            stepToFrames.Add(reviewFrames);
                        }
                    }
                }
            }

            AddFrames(easySecq, choreography[Difficulty.Easy], practiceSections[Difficulty.Easy], easySect);
            AddFrames(mediumSecq, choreography[Difficulty.Medium], practiceSections[Difficulty.Medium], mediumSect);
            AddFrames(expertSecq, choreography[Difficulty.Expert], practiceSections[Difficulty.Expert], expertSect);
        }
    }
}