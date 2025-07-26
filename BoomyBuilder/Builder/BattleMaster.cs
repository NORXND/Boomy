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

            if (sorted.Count == 0)
                throw new BoomyException("No events provided.");

            // Must start with BattleReset at the lowest measure
            int firstMeasure = sorted.Min(e => e.Measure);
            bool hasBattleResetAtFirst = sorted.Any(e => e.Type == BattleEventType.BattleReset && e.Measure == firstMeasure);
            if (!hasBattleResetAtFirst)
                throw new BoomyException("First event (lowest measure) must be 'BattleReset'.");

            int count = sorted.Count;
            int i = 0;
            while (i < count)
            {
                var ev = sorted[i];
                int start = ev.Measure;
                int end = (i + 1 < count) ? sorted[i + 1].Measure - 1 : totalMeasures - 1;

                switch (ev.Type)
                {
                    case BattleEventType.BattleReset:
                        bool isFirstBattleReset = (i == 0);
                        int musicRangeStart = isFirstBattleReset ? firstMeasure : start;
                        data.mBattleSteps.Add(new HamBattleData.BattleStep
                        {
                            mPlayers = PlayerFlags.kHamPlayerBoth,
                            mMusicRange = new HamBattleData.BattleStep.Range() { start = musicRangeStart, end = end },
                            mPlayRange = new HamBattleData.BattleStep.Range() { start = start, end = end },
                            mCam = (Symbol)"",
                            mNonplayAction = (Symbol)"idle",
                            mState = (Symbol)"normal",
                        });
                        i++;
                        break;

                    case BattleEventType.Player1Solo:
                        data.mBattleSteps.Add(new HamBattleData.BattleStep
                        {
                            mPlayers = PlayerFlags.kHamPlayer0,
                            mMusicRange = new HamBattleData.BattleStep.Range() { start = start, end = end },
                            mPlayRange = new HamBattleData.BattleStep.Range() { start = start, end = end },
                            mCam = (Symbol)"",
                            mNonplayAction = (Symbol)"idle",
                            mState = (Symbol)"normal",
                        });
                        i++;
                        break;

                    case BattleEventType.Player2Solo:
                        data.mBattleSteps.Add(new HamBattleData.BattleStep
                        {
                            mPlayers = PlayerFlags.kHamPlayer1,
                            mMusicRange = new HamBattleData.BattleStep.Range() { start = start, end = end },
                            mPlayRange = new HamBattleData.BattleStep.Range() { start = start, end = end },
                            mCam = (Symbol)"",
                            mNonplayAction = (Symbol)"idle",
                            mState = (Symbol)"normal",
                        });
                        i++;
                        break;

                    case BattleEventType.MinigameStart:
                        // Find matching MinigameEnd and possible MinigameIdle
                        int minigameStart = ev.Measure;
                        int minigameEnd = -1;
                        int minigameIdle = -1;
                        int j = i + 1;
                        while (j < count)
                        {
                            if (sorted[j].Type == BattleEventType.MinigameIdle && minigameIdle == -1)
                                minigameIdle = sorted[j].Measure;
                            if (sorted[j].Type == BattleEventType.MinigameEnd)
                            {
                                minigameEnd = sorted[j].Measure;
                                break;
                            }
                            j++;
                        }
                        if (minigameEnd == -1)
                            throw new BoomyException($"Unmatched MinigameStart at measure {minigameStart}");

                        // Minigame step
                        data.mBattleSteps.Add(new HamBattleData.BattleStep
                        {
                            mPlayers = PlayerFlags.kHamPlayerBoth,
                            mMusicRange = new HamBattleData.BattleStep.Range() { start = minigameStart, end = minigameEnd - 1 },
                            mPlayRange = new HamBattleData.BattleStep.Range()
                            {
                                start = minigameStart + 2,
                                end = (minigameIdle != -1 && minigameIdle < minigameEnd) ? minigameIdle - 1 : minigameEnd - 1
                            },
                            mCam = (Symbol)"",
                            mNonplayAction = (Symbol)"idle",
                            mState = (Symbol)"minigame",
                        });

                        // After minigame, add reset step starting 2 measures before minigame start
                        // int resetStart = Math.Max(0, minigameStart - 2);
                        // int resetEnd = (j + 1 < count) ? sorted[j + 1].Measure - 1 : totalMeasures - 1;
                        // data.mBattleSteps.Add(new HamBattleData.BattleStep
                        // {
                        //     mPlayers = PlayerFlags.kHamPlayerBoth,
                        //     mMusicRange = new HamBattleData.BattleStep.Range() { start = resetStart, end = resetEnd },
                        //     mPlayRange = new HamBattleData.BattleStep.Range() { start = resetStart, end = resetEnd },
                        //     mCam = (Symbol)"",
                        //     mNonplayAction = (Symbol)"idle",
                        //     mState = (Symbol)"normal",
                        // });

                        i = j + 1; // Skip to after MinigameEnd
                        break;

                    default:
                        throw new BoomyException($"Unknown or unsupported event type: {ev.Type} at measure {ev.Measure}");
                }
            }
        }
    }
}