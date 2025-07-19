using BoomyBuilder.Builder.Models;
using BoomyBuilder.Builder.Models.Timeline;

namespace BoomyBuilder.Builder.Camerator
{
    public class Camerator
    {
        public static Dictionary<Difficulty, Dictionary<int, CameraPosition>> ParseCameraEvents(Timeline timeline)
        {
            Dictionary<int, CameraPosition> easyTrack = new Dictionary<int, CameraPosition>();
            Dictionary<int, CameraPosition> mediumTrack = new Dictionary<int, CameraPosition>();
            Dictionary<int, CameraPosition> expertTrack = new Dictionary<int, CameraPosition>();

            void ParseDifficulty(List<CameraEvent> events, Dictionary<int, CameraPosition> track)
            {
                foreach (var e in events)
                {
                    track[e.Beat] = e.Position;
                }

                if (track.Count == 0) return;

                int totalBeats = track.Keys.Max();

                for (int i = 1; i <= totalBeats; i++)
                {
                    if (i == 1 && !track.ContainsKey(i))
                    {
                        throw new BoomyException("No camera found at beat 1!");
                    }
                }
            }

            ParseDifficulty(timeline.Easy.Cameras, easyTrack);
            ParseDifficulty(timeline.Medium.Cameras, mediumTrack);
            ParseDifficulty(timeline.Expert.Cameras, expertTrack);

            return new Dictionary<Difficulty, Dictionary<int, CameraPosition>>
            {
                {Difficulty.Easy, easyTrack },
                {Difficulty.Medium, mediumTrack },
                {Difficulty.Expert, expertTrack }
            };
        }
    }
}