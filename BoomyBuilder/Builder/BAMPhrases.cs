using BoomyBuilder.Builder.Models.BAMPhrases;
using MiloLib.Assets.Ham;

namespace BoomyBuilder.Builder
{
    public class BAMPhraser
    {
        public static void CreateBAMPhrases(BuildOperator op, BustAMoveData data)
        {
            foreach (BAMPhrase phrase in op.Request.BamPhrases)
            {
                data.mPhrases.Add(new BustAMoveData.BAMPhrase
                {
                    count = phrase.Count,
                    bars = phrase.Bars
                });
            }
        }
    }
}