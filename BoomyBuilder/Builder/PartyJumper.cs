using MiloLib.Assets.Ham;

namespace BoomyBuilder.Builder
{
    public class PartyJumper
    {
        public static void CreatePartyJumps(BuildOperator op, HamPartyJumpData data)
        {
            List<Models.PartyJump.PartyJump> jumps = op.Request.PartyJumps;

            // Sort jumps by measure
            var sorted = jumps.OrderBy(j => j.Measure).ToList();

            var result = new Dictionary<int, (Models.PartyJump.PartyJump start, Models.PartyJump.PartyJump end)>();
            Models.PartyJump.PartyJump? currentStart = null;
            int groupIndex = 0;

            foreach (var jump in sorted)
            {
                if (jump.Type == Models.PartyJumpType.Start)
                {
                    if (currentStart != null)
                        throw new BoomyException($"Unmatched PartyJump: found 'start' at measure {jump.Measure} before previous 'start' was closed with 'end'.");

                    currentStart = jump;
                }
                else if (jump.Type == Models.PartyJumpType.End)
                {
                    if (currentStart == null)
                        throw new BoomyException($"Unmatched PartyJump: found 'end' at measure {jump.Measure} without a preceding 'start'.");

                    result.Add(groupIndex++, (currentStart, jump));
                    currentStart = null;
                }
                else
                {
                    throw new BoomyException($"Unknown PartyJump type: {jump.Type} at measure {jump.Measure}");
                }
            }

            if (currentStart != null)
                throw new BoomyException($"Unmatched PartyJump: found 'start' at measure {currentStart.Measure} without a closing 'end'.");

            foreach ((Models.PartyJump.PartyJump start, Models.PartyJump.PartyJump end) group in result.Values)
            {
                Tuple<int, int> tuple = new Tuple<int, int>(group.start.Measure, group.end.Measure);
                data.mJumps.Add(tuple);
            }
        }
    }
}