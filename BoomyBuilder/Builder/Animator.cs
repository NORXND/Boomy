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
                foreach (var measure in track.Keys)
                {
                    float frame = (float)tempoConverter.MeasureToFrame(measure, beatOffset: -1);
                    Move move = track[measure];

                    key.keys.Add(new AnimEventSymbol()
                    {
                        Text = (Symbol)move.Clip,
                        Pos = frame
                    });
                }
            }

            void CreateClips(RndPropAnim.PropKey key, Dictionary<int, Move> track)
            {
                foreach (var measure in track.Keys)
                {
                    float frame = (float)tempoConverter.MeasureToFrame(measure, beatOffset: -1);
                    Move move = track[measure];

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
                foreach (var measure in track.Keys)
                {
                    float time = (float)tempoConverter.MeasureToFrame(measure);
                    Move move = track[measure];

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
                    float time = (float)tempoConverter.BeatToFrame(beat);
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
                // Collect all starting measure of all sections
                var sectionStartMeasures = section.Select(s => s.AllStartSteps.Keys.FirstOrDefault()).ToHashSet();

                // Gather all measures in order
                var allMeasures = track.Keys.OrderBy(b => b).ToList();

                bool reachedSectionStart = false;
                foreach (var measure in allMeasures)
                {
                    if (sectionStartMeasures.Contains(measure))
                    {
                        reachedSectionStart = true;
                        break;
                    }
                    if (!track.TryGetValue(measure, out var move))
                        continue;
                    // Only add if this is a rest move
                    if (move.HamMoveName == "Rest.move" || move.HamMoveName == "rest.move" || move.HamMoveName == "rest")
                    {
                        string moveName = move.HamMoveName.Replace(".move", "").Replace("_" + move.SongName, "");
                        float startPos = (float)tempoConverter.MeasureToFrame(measure);
                        key.keys.Add(new AnimEventSymbol()
                        {
                            Text = (Symbol)moveName,
                            Pos = startPos
                        });
                    }
                }

                // Now proceed with the existing logic for section steps
                foreach (var sect in section)
                {
                    foreach (var pair in sect.AllStartSteps)
                    {
                        int measure = pair.Key;
                        string moveName = pair.Value;
                        string endMoveName = sect.AllEndSteps[measure + 1];
                        float startPos = (float)tempoConverter.MeasureToFrame(measure);
                        float endPos = (float)tempoConverter.MeasureToFrame(measure + 1);
                        key.keys.Add(new AnimEventSymbol()
                        {
                            Text = (Symbol)moveName,
                            Pos = startPos
                        });
                        key.keys.Add(new AnimEventSymbol()
                        {
                            Text = (Symbol)endMoveName,
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