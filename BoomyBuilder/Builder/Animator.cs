using BoomyBuilder.Builder.Models;
using BoomyBuilder.Builder.Models.Move;
using BoomyBuilder.Builder.Utils;
using MiloLib.Assets.Ham;
using MiloLib.Assets.Rnd;
using static BoomyBuilder.Builder.PracticeSectioner.PracticeSectioner;
using static MiloLib.Assets.Rnd.RndPropAnim.PropKey;

namespace BoomyBuilder.Builder.Animator
{
    public class Animator
    {
        public static void BuildSongAnim(RndPropAnim easy, RndPropAnim medium, RndPropAnim expert, Dictionary<Difficulty, Dictionary<int, Move>> choreography, Dictionary<Difficulty, Dictionary<int, CameraPosition>> camPositions, Dictionary<Difficulty, List<PracticeStepResult>> practiceSections, TempoMapConverter tempoConverter)
        {
            Dictionary<float, Symbol> easyMovePoints = new Dictionary<float, Symbol>();
            Dictionary<float, Symbol> mediumMovePoints = new Dictionary<float, Symbol>();
            Dictionary<float, Symbol> expertMovePoints = new Dictionary<float, Symbol>();

            void CreateExpertClips(RndPropAnim.PropKey key, Dictionary<int, Move> track)
            {
                foreach (var beat in track.Keys)
                {
                    float frame = (float)tempoConverter.MeasureToFrame(beat, beatOffset: -1);
                    Move move = track[beat];

                    key.keys.Add(new AnimEventSymbol()
                    {
                        Text = (Symbol)move.Clip,
                        Pos = frame
                    });
                }
            }

            void CreateClips(RndPropAnim.PropKey key, Dictionary<int, Move> track)
            {
                foreach (var beat in track.Keys)
                {
                    float frame = (float)tempoConverter.MeasureToFrame(beat, beatOffset: -1);
                    Move move = track[beat];

                    if (move.HamMoveName == "Rest.move" || move.HamMoveName == "rest.move" || move.HamMoveName == "rest")
                    {
                        // Rest or groove moves are not added to the graph
                        continue;
                    }
                    {
                        move.HamMoveName = "groove";
                    }

                    key.keys.Add(new AnimEventSymbol()
                    {
                        Text = (Symbol)move.HamMoveName.Replace(".move", ""),
                        Pos = frame
                    });
                }
            }

            void CreateMoves(RndPropAnim.PropKey key, Dictionary<int, Move> track)
            {
                foreach (var beat in track.Keys)
                {
                    float time = (float)tempoConverter.MeasureToFrame(beat);
                    Move move = track[beat];

                    key.keys.Add(new AnimEventSymbol()
                    {
                        Text = (Symbol)move.HamMoveName.Replace("_" + move.SongName, ""),
                        Pos = time
                    });
                }
            }

            void CreateCameras(RndPropAnim.PropKey key, Dictionary<int, CameraPosition> track)
            {
                foreach (var beat in track.Keys)
                {
                    float time = (float)tempoConverter.MeasureToFrame(beat);
                    CameraPosition position = track[beat];


                    key.keys.Add(new AnimEventSymbol()
                    {
                        Text = (Symbol)Extensions.EnumExtensions.GetEnumMemberValue(position),
                        Pos = time
                    });
                }
            }

            void CreatePractice(RndPropAnim.PropKey key, Dictionary<int, Move> track, List<PracticeStepResult> section)
            {
                // Collect all beats used in previous sections for each section
                List<HashSet<int>> usedBeatsBeforeSections = new();
                HashSet<int> usedSoFar = new();
                foreach (var sect in section)
                {
                    HashSet<int> copy = new(usedSoFar);
                    usedBeatsBeforeSections.Add(copy);
                    foreach (var step in sect.AllSteps)
                        usedSoFar.Add(step.Key);
                }

                // Find the last beat in the choreography for this difficulty
                int lastChoreoBeat = track.Keys.Max();

                // Build a flat list of all choreography beats in order
                var allChoreoBeats = track.Keys.OrderBy(b => b).ToList();
                HashSet<int> usedBeatsBefore = new();
                HashSet<string> usedMoveNamesBefore = new();
                for (int sbIdx = 0; sbIdx < allChoreoBeats.Count; sbIdx++)
                {
                    int beat = allChoreoBeats[sbIdx];
                    if (beat == lastChoreoBeat)
                        continue;

                    // Only process if this beat/move hasn't been used before
                    if (usedBeatsBefore.Contains(beat) || usedMoveNamesBefore.Contains(track[beat].HamMoveName.Replace(".move", "").Replace("_" + track[beat].SongName, "")))
                        continue;

                    if (!track.TryGetValue(beat, out var move))
                        throw new BoomyException($"Could not find move for beat {beat} in choreography for song");
                    string startName = move.HamMoveName.Replace(".move", "").Replace("_" + move.SongName, "");

                    // Find the next unused choreography beat
                    int nextIdx = sbIdx + 1;
                    int nextBeat = -1;
                    string nextName = "";
                    string endSong = "";
                    while (nextIdx < allChoreoBeats.Count)
                    {
                        int candidate = allChoreoBeats[nextIdx];
                        var candidateMove = track[candidate];
                        string candidateName = candidateMove.HamMoveName.Replace(".move", "").Replace("_" + candidateMove.SongName, "");
                        if (!usedBeatsBefore.Contains(candidate) && !usedMoveNamesBefore.Contains(candidateName))
                        {
                            nextBeat = candidate;
                            nextName = candidateName;
                            endSong = candidateMove.SongName;
                            break;
                        }
                        nextIdx++;
                    }

                    string animStart = startName;
                    string animEnd = "";

                    // Handle consecutive duplicate moves (run)
                    bool didRun = false;
                    if (sbIdx + 1 < allChoreoBeats.Count)
                    {
                        int nextChoreoBeat = allChoreoBeats[sbIdx + 1];
                        var nextChoreoMove = track[nextChoreoBeat];
                        string nextChoreoName = nextChoreoMove.HamMoveName.Replace(".move", "").Replace("_" + nextChoreoMove.SongName, "");
                        if (startName == nextChoreoName)
                        {
                            // Only process the first in a run
                            bool isFirstInRun = (sbIdx == 0) || (track[allChoreoBeats[sbIdx - 1]].HamMoveName.Replace(".move", "").Replace("_" + track[allChoreoBeats[sbIdx - 1]].SongName, "") != startName);
                            if (!isFirstInRun)
                                continue;
                            // Find the end of the run
                            int runEnd = sbIdx + 1;
                            while (runEnd + 1 < allChoreoBeats.Count && track[allChoreoBeats[runEnd + 1]].HamMoveName.Replace(".move", "").Replace("_" + track[allChoreoBeats[runEnd + 1]].SongName, "") == startName)
                                runEnd++;
                            animStart = startName + "*";
                            animEnd = startName + "_loop_end";
                            endSong = track[allChoreoBeats[runEnd]].SongName;
                            // Mark all beats in the run as used
                            for (int k = sbIdx; k <= runEnd; k++)
                            {
                                usedBeatsBefore.Add(allChoreoBeats[k]);
                                usedMoveNamesBefore.Add(track[allChoreoBeats[k]].HamMoveName.Replace(".move", "").Replace("_" + track[allChoreoBeats[k]].SongName, ""));
                            }
                            didRun = true;
                        }
                    }
                    if (!didRun)
                    {
                        // Not a run, handle normal or skip/end
                        if (string.IsNullOrEmpty(nextName) || usedBeatsBefore.Contains(nextBeat) || usedMoveNamesBefore.Contains(nextName))
                        {
                            animEnd = startName + "_end";
                            endSong = move.SongName;
                        }
                        else
                        {
                            animEnd = nextName;
                        }
                        // If animStart and animEnd are the same, always add _end to animEnd
                        if (animStart == animEnd)
                        {
                            animEnd = animStart + "_end";
                            endSong = move.SongName;
                        }
                        // Mark this move as used
                        usedBeatsBefore.Add(beat);
                        usedMoveNamesBefore.Add(startName);
                    }

                    float startPos = (float)tempoConverter.MeasureToFrame(beat, beatOffset: -4);
                    float endPos = startPos;
                    if (animEnd == startName + "_loop_end" || animEnd == startName + "_end")
                        endPos = (float)tempoConverter.MeasureToFrame(beat + 1, beatOffset: -4);
                    else if (!string.IsNullOrEmpty(nextName))
                        endPos = (float)tempoConverter.MeasureToFrame(nextBeat, beatOffset: -4);

                    key.keys.Add(new AnimEventSymbol()
                    {
                        Text = (Symbol)animStart,
                        Pos = startPos
                    });

                    if ((animEnd.EndsWith("_end") || animEnd.EndsWith("_loop_end")) && animEnd != animStart)
                    {
                        key.keys.Add(new AnimEventSymbol()
                        {
                            Text = (Symbol)animEnd,
                            Pos = endPos
                        });
                    }
                }
            }

            CreateClips(easy.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "clip").First(), choreography[Difficulty.Easy]);
            CreateClips(medium.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "clip").First(), choreography[Difficulty.Medium]);
            CreateExpertClips(expert.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "clip").First(), choreography[Difficulty.Expert]);
            CreatePractice(easy.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "practice").First(), choreography[Difficulty.Easy], practiceSections[Difficulty.Easy]);

            CreateMoves(easy.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "move").First(), choreography[Difficulty.Easy]);
            CreateMoves(medium.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "move").First(), choreography[Difficulty.Medium]);
            CreateMoves(expert.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "move").First(), choreography[Difficulty.Expert]);
            CreatePractice(medium.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "practice").First(), choreography[Difficulty.Medium], practiceSections[Difficulty.Medium]);

            CreateCameras(easy.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "shot").First(), camPositions[Difficulty.Easy]);
            CreateCameras(medium.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "shot").First(), camPositions[Difficulty.Medium]);
            CreateCameras(expert.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "shot").First(), camPositions[Difficulty.Expert]);
            CreatePractice(expert.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "practice").First(), choreography[Difficulty.Expert], practiceSections[Difficulty.Expert]);
        }
    }
}