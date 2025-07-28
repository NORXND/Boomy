using BoomyBuilder.Builder.Extensions;
using BoomyBuilder.Builder.Models;
using BoomyBuilder.Builder.Models.Move;
using BoomyBuilder.Builder.Models.Visemes;
using BoomyBuilder.Builder.Utils;
using MiloLib.Assets.Ham;
using MiloLib.Assets.Rnd;
using static BoomyBuilder.Builder.PracticeSectioner.PracticeSectioner;
using static MiloLib.Assets.ObjectFields;
using static MiloLib.Assets.Rnd.RndPropAnim.PropKey;

namespace BoomyBuilder.Builder.Animator
{
    public class Animator
    {
        public static void BuildSongAnim(RndPropAnim easy, RndPropAnim medium, RndPropAnim expert, Dictionary<Difficulty, Dictionary<int, Move>> choreography, Dictionary<Difficulty, Dictionary<int, CameraPosition>> camPositions, Dictionary<Difficulty, List<PracticeStepResult>> practiceSections, TempoMapConverter tempoConverter, RndPropAnim visEasy, RndPropAnim visMedium, RndPropAnim visExpert, List<Models.Visemes.VisemesEvent> visEasyEvents, List<Models.Visemes.VisemesEvent> visMediumEvents, List<Models.Visemes.VisemesEvent> visExpertEvents)
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
                    float frame = (float)tempoConverter.MeasureToFrame(measure, beatOffset: 0);
                    Move move = track[measure];

                    string moveName = move.HamMoveName.Replace(".move", "").Replace("_" + move.SongName, "");
                    if (move.HamMoveName == "Rest.move" || move.HamMoveName == "rest.move" || move.HamMoveName == "rest")
                    {
                        moveName = "groove";
                    }


                    key.keys.Add(new AnimEventSymbol()
                    {
                        Text = (Symbol)moveName,
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
                for (int i = 0; i < section.Count; i++)
                {
                    PracticeStepResult? sect = section[i];
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

                        if (sect.AllStartSteps.ContainsKey(measure + 1))
                        {
                            if (sect.AllStartSteps[measure + 1] == endMoveName)
                            {
                                // If the next start step is the same as the end step, we don't need to add it
                                continue;
                            }
                        }

                        if (i != section.Count - 1)
                        {
                            if (section[i + 1].AllStartSteps.ContainsKey(measure + 1))
                            {
                                if (section[i + 1].AllStartSteps[measure + 1] == endMoveName)
                                {
                                    // If the next section's start step is the same as the end step, we don't need to add it
                                    continue;
                                }
                            }
                        }

                        key.keys.Add(new AnimEventSymbol()
                        {
                            Text = (Symbol)endMoveName,
                            Pos = endPos
                        });
                    }
                }
            }


            void CreateFaces(RndPropAnim anim, List<VisemesEvent> events)
            {
                Dictionary<VisemesType, List<(int, float)>> visemeKeys = new Dictionary<VisemesType, List<(int, float)>>();

                foreach (var viseme in events)
                {
                    if (!visemeKeys.ContainsKey(viseme.Viseme))
                    {
                        visemeKeys[viseme.Viseme] = new List<(int, float)>();
                    }
                    visemeKeys[viseme.Viseme].Add((viseme.Beat, viseme.Value));
                }

                foreach (var viseme in visemeKeys.Keys)
                {
                    List<(int, float)> evt = visemeKeys[viseme];
                    if (evt.Count == 0)
                        continue;

                    RndPropAnim.PropKey key = new RndPropAnim.PropKey()
                    {
                        dtb = new DTBParent()
                        {
                            hasTree = true,
                            children = new List<DTBNode>()
                            {
                                new DTBNode()
                                {
                                    type = NodeType.Symbol,
                                    value = (Symbol)EnumExtensions.GetEnumMemberValue(viseme),
                                }
                            }
                        },
                        type1 = PropType.kPropFloat,
                        type2 = PropType.kPropFloat,
                        target = (Symbol)"dancer_face.lipsync",
                        interpolation = Interpolation.kLinear,
                        exceptionType = ExceptionID.kNoException,
                    };

                    foreach (var (beat, value) in evt)
                    {
                        float time = (float)tempoConverter.BeatToFrame(beat);
                        key.keys.Add(new AnimEventFloat()
                        {
                            Pos = time,
                            Value = value
                        });
                    }

                    anim.propKeys.Add(key);
                }
            }

            CreateClips(easy.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "clip").First(), choreography[Difficulty.Easy]);
            CreateClips(medium.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "clip").First(), choreography[Difficulty.Medium]);
            CreateExpertClips(expert.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "clip").First(), choreography[Difficulty.Expert]);

            CreateMoves(easy.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "move").First(), choreography[Difficulty.Easy]);
            CreateMoves(medium.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "move").First(), choreography[Difficulty.Medium]);
            CreateMoves(expert.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "move").First(), choreography[Difficulty.Expert]);

            CreateCameras(easy.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "shot").First(), camPositions[Difficulty.Easy]);
            CreateCameras(medium.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "shot").First(), camPositions[Difficulty.Medium]);
            CreateCameras(expert.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "shot").First(), camPositions[Difficulty.Expert]);

            CreatePractice(easy.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "practice").First(), choreography[Difficulty.Easy], practiceSections[Difficulty.Easy]);
            CreatePractice(medium.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "practice").First(), choreography[Difficulty.Medium], practiceSections[Difficulty.Medium]);
            CreatePractice(expert.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "practice").First(), choreography[Difficulty.Expert], practiceSections[Difficulty.Expert]);

            CreateFaces(visEasy, visEasyEvents);
            CreateFaces(visMedium, visMediumEvents);
            CreateFaces(visExpert, visExpertEvents);
        }
    }
}