using BoomyBuilder.Builder.Models;
using BoomyBuilder.Builder.Models.Move;
using BoomyBuilder.Builder.Models.Timeline;
using MiloLib.Assets.Ham;
using MiloLib.Classes;
using static MiloLib.Assets.Ham.MoveVariant;
using static MiloLib.Assets.ObjectFields;

namespace BoomyBuilder.Builder.MoveGrapher
{
    class MoveGrapher
    {
        public static void BuildMoveGraph(MoveGraph graph, Dictionary<Difficulty, Dictionary<int, Move>> choreography)
        {
            // Move Variants (shared across difficulties)
            Dictionary<string, MoveVariant> variantCandidates = [];
            Dictionary<string, List<object>> variantsEvents = [];

            // Find all move parents
            void IdentifyMoveVariant(Dictionary<int, Move> track)
            {
                foreach (var beat in track.Keys)
                {
                    Move move = track[beat];

                    Dictionary<string, MoveCandidate> previousCandidates = [];
                    Dictionary<string, MoveCandidate> nextCandidates = [];

                    if (beat != 1)
                    {
                        Move previousMove = track[beat - 1];
                        if (!previousCandidates.ContainsKey(previousMove.Clip))
                        {
                            MoveCandidate previousCandidate = new()
                            {
                                revision = 1,
                                variantName = (Symbol)previousMove.Clip,
                                clipName = (Symbol)previousMove.Clip,
                                unk = (Symbol)"",
                                mAdjacencyFlag = 4,
                            };
                            previousCandidates[previousMove.Clip] = previousCandidate;
                        }
                    }

                    if (beat != track.Count)
                    {
                        Move nextMove = track[beat + 1];
                        if (!nextCandidates.ContainsKey(nextMove.Clip))
                        {
                            MoveCandidate nextCandidate = new()
                            {
                                revision = 1,
                                variantName = (Symbol)nextMove.Clip,
                                clipName = (Symbol)nextMove.Clip,
                                unk = (Symbol)"",
                                mAdjacencyFlag = 4,
                            };
                            nextCandidates[nextMove.Clip] = nextCandidate;
                        }
                    }

                    if (variantCandidates.TryGetValue(move.Clip, out MoveVariant? variant))
                    {
                        // Add new candidates to existing variant (from any difficulty)
                        foreach (var prevCandidate in previousCandidates)
                        {
                            if (!variant.prevCandidates.Any(c => c.variantName.value == prevCandidate.Value.variantName.value))
                            {
                                variant.prevCandidates.Add(prevCandidate.Value);
                            }
                        }

                        foreach (var nextCandidate in nextCandidates)
                        {
                            if (!variant.nextCandidates.Any(c => c.variantName.value == nextCandidate.Value.variantName.value))
                            {
                                variant.nextCandidates.Add(nextCandidate.Value);
                            }
                        }
                    }
                    else
                    {
                        MoveVariant newVariant = new()
                        {
                            revision = 1,
                            index = (Symbol)move.Clip,
                            positionOffset = new Vector3(0, 0, 0),
                            hamMoveName = (Symbol)move.HamMoveName,
                            hamMoveMiloname = (Symbol)move.MiloName,
                            linkedFrom = (Symbol)move.LinkedFrom,
                            linkedTo = (Symbol)move.LinkedTo,
                            genre = (Symbol)move.Genre,
                            era = (Symbol)move.Era,
                            songName = (Symbol)move.SongName,
                            avgBeatsPerSecond = move.AvgBeatsPerSecond,
                            flags = move.Flags,
                            nextCandidates = [.. nextCandidates.Values],
                            prevCandidates = [.. previousCandidates.Values],
                        };

                        variantCandidates[move.Clip] = newVariant;
                        variantsEvents[move.Clip] = [beat, move];
                    }
                }
            }

            // Process all difficulties to collect all candidates
            IdentifyMoveVariant(choreography[Difficulty.Easy]);
            IdentifyMoveVariant(choreography[Difficulty.Medium]);
            IdentifyMoveVariant(choreography[Difficulty.Expert]);

            // Move Parents (shared across difficulties)
            Dictionary<Symbol, MoveParent> moveParents = [];

            foreach (var eventName in variantsEvents.Keys)
            {
                int beat = (int)variantsEvents[eventName][0];
                Move move = (Move)variantsEvents[eventName][1];

                MoveVariant variant = variantCandidates[eventName];

                if (moveParents.Any(parent => parent.Key.value == move.MiloName))
                {
                    MoveParent moveParent = moveParents.First(parent => parent.Key.value == move.MiloName).Value;

                    // Only add variant if not already present
                    if (!moveParent.moveVariants.Any(v => v.index.value == variant.index.value))
                    {
                        moveParent.moveVariants.Add(variant);
                    }

                    if (!moveParent.genreFlags.Any(flag => flag.value == variant.genre.value))
                    {
                        moveParent.genreFlags.Add(variant.genre);
                    }

                    if (!moveParent.eraFlags.Any(flag => flag.value == variant.era.value))
                    {
                        moveParent.eraFlags.Add(variant.era);
                    }
                }
                else
                {
                    MoveParent newMoveParent = new()
                    {
                        revision = 0,
                        name = (Symbol)move.MiloName,
                        difficulty = (MoveParent.Difficulty)move.difficulty,
                        genreFlags = [variant.genre],
                        eraFlags = [variant.era],
                        unkc = false,
                        displayName = (Symbol)move.DisplayName,
                        moveVariants = [variant]
                    };

                    moveParents[(Symbol)move.MiloName] = newMoveParent;
                }
            }

            graph.moveParents = moveParents;

            DTBArrayParent easyArray = (DTBArrayParent)((DTBArrayParent)graph.moveArray.children.Where(child => ((Symbol)((DTBArrayParent)child.value).children[0].value).value == "easy").First().value).children[1].value;
            DTBArrayParent mediumArray = (DTBArrayParent)((DTBArrayParent)graph.moveArray.children.Where(child => ((Symbol)((DTBArrayParent)child.value).children[0].value).value == "medium").First().value).children[1].value;
            DTBArrayParent expertArray = (DTBArrayParent)((DTBArrayParent)graph.moveArray.children.Where(child => ((Symbol)((DTBArrayParent)child.value).children[0].value).value == "expert").First().value).children[1].value;

            void CreateMoveArray(DTBArrayParent array, Dictionary<int, Move> track)
            {
                for (var i = 1; i <= track.Count; i++)
                {
                    Move move = track[i];
                    array.children.Add(new DTBNode() { type = NodeType.Symbol, value = (Symbol)move.Clip });
                }
            }

            CreateMoveArray(easyArray, choreography[Difficulty.Easy]);
            CreateMoveArray(mediumArray, choreography[Difficulty.Medium]);
            CreateMoveArray(expertArray, choreography[Difficulty.Expert]);
        }
    }
}