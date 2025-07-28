using BoomyBuilder.Builder.Extensions;
using BoomyBuilder.Builder.Models;
using BoomyBuilder.Builder.Models.Visemes;
using MiloLib.Assets.Ham;
using static MiloLib.Assets.ObjectFields;

namespace BoomyBuilder.Builder
{
    public class DancerFaceMaker
    {
        public static void MakeDancerFace(BuildOperator op, CharLipSync easy, CharLipSync medium, CharLipSync expert)
        {
            void CreateDifficulty(List<VisemesEvent> events, CharLipSync lipSync)
            {
                lipSync.objFields.root.hasTree = true;

                List<VisemesType> used = [];

                foreach (var viseme in events)
                {
                    if (used.Contains(viseme.Viseme))
                    {
                        continue;
                    }

                    lipSync.objFields.root.children.Add(new DTBNode
                    {
                        type = NodeType.Symbol,
                        value = (Symbol)EnumExtensions.GetEnumMemberValue(viseme.Viseme),
                    });

                    lipSync.objFields.root.children.Add(new DTBNode
                    {
                        type = NodeType.Float,
                        value = (float)0,
                    });

                    used.Add(viseme.Viseme);
                }
            }

            CreateDifficulty(op.Request.Visemes.Easy, easy);
            CreateDifficulty(op.Request.Visemes.Medium, medium);
            CreateDifficulty(op.Request.Visemes.Expert, expert);
        }
    }
}