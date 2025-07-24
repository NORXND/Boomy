using BoomyBuilder.Builder.Models;
using BoomyBuilder.Builder.Models.BattleEvent;
using MiloLib.Assets.Ham;

namespace BoomyBuilder.Builder
{
    public class BattleMaster
    {
        public static void CreateBattle(List<BattleEvent> evnts, HamBattleData data, int totalMeasures)
        {
            var sorted = evnts.OrderBy(e => e.Measure).ToList();

            var result = new Dictionary<int, (BattleEvent start, BattleEvent end)>();
            BattleEvent? currentP1 = null;
            BattleEvent? currentP2 = null;
            BattleEvent? currentMini = null;
            bool battleStarted = false;
            int groupIndex = 0;

            foreach (var ev in sorted)
            {
                switch (ev.Type)
                {
                    case Models.BattleEventType.BattleStart:
                        if (battleStarted)
                            throw new BoomyException($"Duplicate 'battle_start' at measure {ev.Measure}.");
                        battleStarted = true;
                        break;
                    case Models.BattleEventType.Player1SoloStart:
                        if (!battleStarted)
                            throw new BoomyException($"'player1_solo_start' at measure {ev.Measure} before 'battle_start'.");
                        if (currentP1 != null)
                            throw new BoomyException($"Unmatched: found 'player1_solo_start' at measure {ev.Measure} before previous was closed.");
                        if (currentP2 != null || currentMini != null)
                            throw new BoomyException($"Collision: 'player1_solo_start' at measure {ev.Measure} overlaps with another battle event.");
                        currentP1 = ev;
                        break;
                    case Models.BattleEventType.Player1SoloEnd:
                        if (currentP1 == null)
                            throw new BoomyException($"Unmatched: found 'player1_solo_end' at measure {ev.Measure} without a preceding 'start'.");
                        result.Add(groupIndex++, (currentP1, ev));
                        currentP1 = null;
                        break;
                    case Models.BattleEventType.Player2SoloStart:
                        if (!battleStarted)
                            throw new BoomyException($"'player2_solo_start' at measure {ev.Measure} before 'battle_start'.");
                        if (currentP2 != null)
                            throw new BoomyException($"Unmatched: found 'player2_solo_start' at measure {ev.Measure} before previous was closed.");
                        if (currentP1 != null || currentMini != null)
                            throw new BoomyException($"Collision: 'player2_solo_start' at measure {ev.Measure} overlaps with another battle event.");
                        currentP2 = ev;
                        break;
                    case Models.BattleEventType.Player2SoloEnd:
                        if (currentP2 == null)
                            throw new BoomyException($"Unmatched: found 'player2_solo_end' at measure {ev.Measure} without a preceding 'start'.");
                        result.Add(groupIndex++, (currentP2, ev));
                        currentP2 = null;
                        break;
                    case Models.BattleEventType.MinigameStart:
                        if (!battleStarted)
                            throw new BoomyException($"'minigame_start' at measure {ev.Measure} before 'battle_start'.");
                        if (currentMini != null)
                            throw new BoomyException($"Unmatched: found 'minigame_start' at measure {ev.Measure} before previous was closed.");
                        if (currentP1 != null || currentP2 != null)
                            throw new BoomyException($"Collision: 'minigame_start' at measure {ev.Measure} overlaps with another battle event.");
                        currentMini = ev;
                        break;
                    case BattleEventType.MinigameEnd:
                        if (currentMini == null)
                            throw new BoomyException($"Unmatched: found 'minigame_end' at measure {ev.Measure} without a preceding 'start'.");
                        if (ev.Measure - currentMini.Measure + 1 < 5)
                            throw new BoomyException($"Minigame too short: starts at measure {currentMini.Measure}, ends at {ev.Measure} (must last at least 5 measures).");
                        result.Add(groupIndex++, (currentMini, ev));
                        currentMini = null;
                        break;
                    default:
                        throw new BoomyException($"Unknown battle event type: {ev.Type} at measure {ev.Measure}");
                }
            }

            if (!battleStarted)
                throw new BoomyException($"No 'battle_start' event present.");

            if (currentP1 != null)
                throw new BoomyException($"Unmatched: found 'player1_solo_start' at measure {currentP1.Measure} without a closing 'end'.");
            if (currentP2 != null)
                throw new BoomyException($"Unmatched: found 'player2_solo_start' at measure {currentP2.Measure} without a closing 'end'.");
            if (currentMini != null)
                throw new BoomyException($"Unmatched: found 'minigame_start' at measure {currentMini.Measure} without a closing 'end'.");

            var battleStartEvent = sorted.FirstOrDefault(e => e.Type == BattleEventType.BattleStart);
            if (battleStartEvent == null)
                throw new BoomyException("No 'battle_start' event present.");
            int battleStartMeasure = battleStartEvent.Measure;

            var eventRanges = result.Values
                .Select(pair => (start: pair.start.Measure, end: pair.end.Measure))
                .OrderBy(r => r.start)
                .ToList();

            var bridges = new List<(int start, int end)>();
            int lastEnd = 0;

            if (eventRanges.Count == 0 || eventRanges[0].start > 0)
            {
                bridges.Add((0, eventRanges.Count > 0 ? eventRanges[0].start - 1 : totalMeasures - 1));
                lastEnd = eventRanges.Count > 0 ? eventRanges[0].end : totalMeasures - 1;
            }
            else
            {
                lastEnd = eventRanges[0].end;
            }

            for (int i = 0; i < eventRanges.Count - 1; i++)
            {
                int bridgeStart = eventRanges[i].end + 1;
                int bridgeEnd = eventRanges[i + 1].start - 1;
                if (bridgeStart <= bridgeEnd)
                    bridges.Add((bridgeStart, bridgeEnd));
                lastEnd = eventRanges[i + 1].end;
            }

            if (lastEnd < totalMeasures - 1)
            {
                bridges.Add((lastEnd + 1, totalMeasures - 1));
            }

            // Add bridge steps
            foreach (var (start, end) in bridges)
            {
                if (start > end) continue;
                int playStart = start < battleStartMeasure ? battleStartMeasure : start;
                data.mBattleSteps.Add(new HamBattleData.BattleStep
                {
                    mPlayers = PlayerFlags.kHamPlayerBoth,
                    mMusicRange = new HamBattleData.BattleStep.Range() { start = start, end = end },
                    mPlayRange = new HamBattleData.BattleStep.Range() { start = playStart, end = end },
                    mCam = (Symbol)"",
                    mNonplayAction = (Symbol)"idle",
                    mState = (Symbol)"normal",
                });
            }

            // Add solo and minigame steps
            foreach (var pair in result.Values)
            {
                var startEv = pair.start;
                var endEv = pair.end;

                BattleEventType type = startEv.Type;

                if ((type == BattleEventType.Player1SoloStart && endEv.Type != BattleEventType.Player1SoloEnd) ||
                    (type == BattleEventType.Player2SoloStart && endEv.Type != BattleEventType.Player2SoloEnd) ||
                    (type == BattleEventType.MinigameStart && endEv.Type != BattleEventType.MinigameEnd))
                {
                    throw new BoomyException($"Mismatched event types: {startEv.Type} (start) vs {endEv.Type} (end) at measure {startEv.Measure}");
                }

                switch (type)
                {
                    case BattleEventType.Player1SoloStart:
                        data.mBattleSteps.Add(new HamBattleData.BattleStep
                        {
                            mPlayers = PlayerFlags.kHamPlayer0,
                            mMusicRange = new HamBattleData.BattleStep.Range() { start = startEv.Measure, end = endEv.Measure },
                            mPlayRange = new HamBattleData.BattleStep.Range() { start = startEv.Measure, end = endEv.Measure },
                            mCam = (Symbol)"",
                            mNonplayAction = (Symbol)"idle",
                            mState = (Symbol)"normal",
                        });
                        break;
                    case BattleEventType.Player2SoloStart:
                        data.mBattleSteps.Add(new HamBattleData.BattleStep
                        {
                            mPlayers = PlayerFlags.kHamPlayer1,
                            mMusicRange = new HamBattleData.BattleStep.Range() { start = startEv.Measure, end = endEv.Measure },
                            mPlayRange = new HamBattleData.BattleStep.Range() { start = startEv.Measure, end = endEv.Measure },
                            mCam = (Symbol)"",
                            mNonplayAction = (Symbol)"idle",
                            mState = (Symbol)"normal",
                        });
                        break;
                    case BattleEventType.MinigameStart:
                        data.mBattleSteps.Add(new HamBattleData.BattleStep
                        {
                            mPlayers = PlayerFlags.kHamPlayerBoth,
                            mMusicRange = new HamBattleData.BattleStep.Range() { start = startEv.Measure, end = endEv.Measure },
                            mPlayRange = new HamBattleData.BattleStep.Range() { start = startEv.Measure + 2, end = endEv.Measure - 1 },
                            mCam = (Symbol)"",
                            mNonplayAction = (Symbol)"idle",
                            mState = (Symbol)"minigame",
                        });
                        break;
                }
            }
        }
    }
}