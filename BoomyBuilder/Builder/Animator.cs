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
                    float frame = (float)tempoConverter.MeasureToFrame(beat - 1, beatOffset: -1);
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
                    float frame = (float)tempoConverter.MeasureToFrame(beat - 1, beatOffset: -1);
                    Move move = track[beat];

                    if (move.HamMoveName == "Rest.move" || move.HamMoveName == "rest.move")
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
                    float time = (float)tempoConverter.MeasureToFrame(beat - 1);
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
                    float time = (float)tempoConverter.MeasureToFrame(beat - 1);
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
                for (int i = 0; i < section.Count; i++)
                {
                    for (int j = 0; j < section[i].AllSteps.Count; j++)
                    {
                        string mStart = section[i].AllSteps[j];
                        int foundBeat = -1;
                        Move? foundMove = null;
                        foreach (var kv in track)
                        {
                            if (kv.Value.HamMoveName == mStart + "_" + section[i].SongNameMap[mStart] + ".move")
                            {
                                foundBeat = kv.Key;
                                foundMove = kv.Value;
                                break;
                            }
                        }
                        if (foundBeat != -1 && foundMove != null)
                        {
                            float time = (float)tempoConverter.MeasureToFrame(foundBeat - 1);

                            key.keys.Add(new AnimEventSymbol()
                            {
                                Text = (Symbol)foundMove.HamMoveName.Replace(".move", "").Replace("_" + foundMove.SongName, ""),
                                Pos = time
                            });
                        }

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