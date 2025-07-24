using BoomyBuilder.Builder.Models.Move;
using MiloLib.Assets.Ham;
using static MiloLib.Assets.Ham.HamSupereasyData;

namespace BoomyBuilder.Builder
{
    class Superez
    {
        public static void CreateSuperez(HamSupereasyData data, Dictionary<int, Move> track)
        {
            if (track.Count == 0)
                return;

            int minMeasure = track.Keys.Min();
            int maxMeasure = track.Keys.Max();

            for (int i = minMeasure; i <= maxMeasure; i++)
            {
                if (track.TryGetValue(i, out Move move))
                {
                    HamSupereasyMeasure measure = new()
                    {
                        first = (Symbol)move.Clip,
                        second = (Symbol)move.Clip,
                        preferred = (Symbol)""
                    };

                    data.mRoutine.Add(measure);
                }
            }
        }
    }
}