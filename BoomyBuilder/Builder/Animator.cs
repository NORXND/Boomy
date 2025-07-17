using BoomyBuilder.Builder.Models;
using BoomyBuilder.Builder.Models.Move;
using MiloLib.Assets.Rnd;
using static MiloLib.Assets.Rnd.RndPropAnim.PropKey;

namespace BoomyBuilder.Builder.Animator
{
    public class Animator
    {
        public static void BuildSongAnim(RndPropAnim easy, RndPropAnim medium, RndPropAnim expert, Dictionary<Difficulty, Dictionary<int, Move>> choreography, Dictionary<Difficulty, Dictionary<int, CameraPosition>> camPositions)
        {
            Dictionary<float, Symbol> easyMovePoints = new Dictionary<float, Symbol>();
            Dictionary<float, Symbol> mediumMovePoints = new Dictionary<float, Symbol>();
            Dictionary<float, Symbol> expertMovePoints = new Dictionary<float, Symbol>();

            static void CreateClips(RndPropAnim.PropKey key, Dictionary<int, Move> track)
            {
                foreach (var beat in track.Keys)
                {
                    float time = (beat - 1) * 60;
                    Move move = track[beat];

                    key.keys.Add(new AnimEventSymbol()
                    {
                        Text = (Symbol)move.Clip,
                        Pos = time
                    });
                }
            }

            static void CreateMoves(RndPropAnim.PropKey key, Dictionary<int, Move> track)
            {
                foreach (var beat in track.Keys)
                {
                    float time = (beat - 1) * 60;
                    Move move = track[beat];

                    key.keys.Add(new AnimEventSymbol()
                    {
                        Text = (Symbol)move.HamMoveName,
                        Pos = time
                    });
                }
            }

            static void CreateCameras(RndPropAnim.PropKey key, Dictionary<int, CameraPosition> track)
            {
                foreach (var beat in track.Keys)
                {
                    float time = (beat - 1) * 60;
                    CameraPosition position = track[beat];


                    key.keys.Add(new AnimEventSymbol()
                    {
                        Text = (Symbol)Extensions.EnumExtensions.GetEnumMemberValue(position),
                        Pos = time
                    });
                }
            }

            CreateClips(easy.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "clip").First(), choreography[Difficulty.Easy]);
            CreateClips(medium.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "clip").First(), choreography[Difficulty.Medium]);
            CreateClips(expert.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "clip").First(), choreography[Difficulty.Expert]);

            CreateMoves(easy.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "move").First(), choreography[Difficulty.Easy]);
            CreateMoves(medium.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "move").First(), choreography[Difficulty.Medium]);
            CreateMoves(expert.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "move").First(), choreography[Difficulty.Expert]);

            CreateCameras(easy.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "shot").First(), camPositions[Difficulty.Easy]);
            CreateCameras(medium.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "shot").First(), camPositions[Difficulty.Medium]);
            CreateCameras(expert.propKeys.Where(key => ((Symbol)key.dtb.children[0].value).value == "shot").First(), camPositions[Difficulty.Expert]);
        }
    }
}