using BoomyBuilder.Builder.Models;
using BoomyBuilder.Builder.Models.Move;
using BoomyBuilder.Builder.Models.Timeline;

namespace BoomyBuilder.Builder.ChoreoMaker
{
    class ChoreoMaker
    {
        public static Dictionary<Difficulty, Dictionary<int, Move>> ParseChoreography(BuildOperator buildOperator)
        {
            Dictionary<int, Move> easyTrack = [];
            Dictionary<int, Move> mediumTrack = [];
            Dictionary<int, Move> expertTrack = [];

            void ParseDifficulty(List<MoveEvent> events, Dictionary<int, Move> track)
            {
                foreach (var e in events)
                {
                    track[e.Beat] = new Move(e, buildOperator);
                }

                int totalBeats = track.Keys.Max();

                for (int i = 1; i <= totalBeats; i++)
                {
                    if (i == 1 && !track.ContainsKey(i))
                    {
                        throw new BoomyException("No move found at beat 1!");
                    }

                    if (i > 1 && !track.ContainsKey(i))
                    {
                        track[i] = track[i - 1];
                    }
                }
            }

            ParseDifficulty(buildOperator.Request.Timeline.Easy.Moves, easyTrack);
            ParseDifficulty(buildOperator.Request.Timeline.Medium.Moves, mediumTrack);
            ParseDifficulty(buildOperator.Request.Timeline.Expert.Moves, expertTrack);

            return new Dictionary<Difficulty, Dictionary<int, Move>>
            {
                {Difficulty.Easy, easyTrack },
                {Difficulty.Medium, mediumTrack },
                {Difficulty.Expert, expertTrack }
            };
        }
    }
}