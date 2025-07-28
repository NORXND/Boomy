using System;
using System.Collections.Generic;
using MiloLib.Classes;
using MiloLib.Utils;

namespace MiloLib.Assets.Ham
{
    public class Visemes
    {
        [Name("Viseme Count"), Description("Number of visemes")]
        public uint visemeCount;

        [Name("Viseme Symbols"), Description("Array of viseme symbols")]
        public List<Symbol> visemes = new List<Symbol>();

        public Visemes Read(EndianReader reader)
        {
            visemeCount = reader.ReadUInt32();
            visemes = new List<Symbol>((int)visemeCount);

            for (int i = 0; i < visemeCount; i++)
            {
                visemes.Add(Symbol.Read(reader));
            }

            return this;
        }

        public void Write(EndianWriter writer)
        {
            writer.WriteUInt32((uint)visemes.Count);
            foreach (var viseme in visemes)
            {
                Symbol.Write(writer, viseme);
            }
        }

        public override string ToString()
        {
            return $"Visemes: {visemeCount} visemes";
        }
    }



    public class VisemeChange
    {
        [Name("Viseme Index"), Description("Index of the viseme")]
        public byte visemeIndex;

        [Name("Weight"), Description("Weight of the viseme change")]
        public byte weight;

        public VisemeChange Read(EndianReader reader)
        {
            visemeIndex = reader.ReadByte();
            weight = reader.ReadByte();
            return this;
        }

        public void Write(EndianWriter writer)
        {
            writer.WriteByte(visemeIndex);
            writer.WriteByte(weight);
        }

        public override string ToString()
        {
            return $"VisemeChange: Index={visemeIndex}, Weight={weight}";
        }
    }

    public class KeyFrame
    {
        [Name("Change Count"), Description("Number of viseme changes in this keyframe")]
        public byte changeCount;

        [Name("Changes"), Description("Array of viseme changes")]
        public List<VisemeChange> changes = new List<VisemeChange>();

        public KeyFrame Read(EndianReader reader)
        {
            changeCount = reader.ReadByte();
            changes = new List<VisemeChange>(changeCount);

            if (changeCount > 0)
            {
                for (int i = 0; i < changeCount; i++)
                {
                    var change = new VisemeChange();
                    change.Read(reader);
                    changes.Add(change);
                }
            }

            return this;
        }

        public void Write(EndianWriter writer)
        {
            writer.WriteByte((byte)changes.Count);
            foreach (var change in changes)
            {
                change.Write(writer);
            }
        }

        public override string ToString()
        {
            return $"KeyFrame: {changeCount} changes";
        }
    }

    public class KeyFrames
    {
        [Name("KeyFrame Count"), Description("Number of keyframes")]
        public uint keyFrameCount;

        [Name("Byte Count"), Description("Total byte count of keyframe data")]
        public uint byteCount;

        [Name("Frames"), Description("Array of keyframes")]
        public List<KeyFrame> frames = new List<KeyFrame>();

        public KeyFrames Read(EndianReader reader)
        {
            keyFrameCount = reader.ReadUInt32();
            byteCount = reader.ReadUInt32();
            frames = new List<KeyFrame>((int)keyFrameCount);

            for (int i = 0; i < keyFrameCount; i++)
            {
                var frame = new KeyFrame();
                frame.Read(reader);
                frames.Add(frame);
            }

            return this;
        }

        public void Write(EndianWriter writer)
        {
            writer.WriteUInt32((uint)frames.Count);

            // Calculate byte count
            uint calculatedByteCount = 0;
            foreach (var frame in frames)
            {
                calculatedByteCount += 1; // changeCount byte
                calculatedByteCount += (uint)(frame.changes.Count * 2); // each change is 2 bytes
            }

            writer.WriteUInt32(calculatedByteCount);

            foreach (var frame in frames)
            {
                frame.Write(writer);
            }
        }

        public override string ToString()
        {
            return $"KeyFrames: {keyFrameCount} frames, {byteCount} bytes";
        }
    }



    [Name("CharLipSync"), Description("Lip synchronization data for character animation")]
    public class CharLipSync : Object
    {
        private Dictionary<Game.MiloGame, uint> gameRevisions = new Dictionary<Game.MiloGame, uint>
        {
            { Game.MiloGame.DanceCentral, 1 },
        };

        [Name("Revision"), Description("The revision of the LipSync data")]
        public ushort revision;

        [Name("Alt Revision"), Description("The alternate revision of the LipSync data")]
        public ushort altRevision;

        [Name("Visemes"), Description("Viseme configuration data")]
        public Visemes visemes = new Visemes();

        [Name("KeyFrames"), Description("Keyframe animation data")]
        public KeyFrames keyFrames = new KeyFrames();

        public new CharLipSync Read(EndianReader reader, bool standalone, DirectoryMeta parent, DirectoryMeta.Entry entry)
        {
            // Read viseme data revisions
            uint combinedRevision = reader.ReadUInt32();
            if (BitConverter.IsLittleEndian)
                (revision, altRevision) = ((ushort)(combinedRevision & 0xFFFF), (ushort)((combinedRevision >> 16) & 0xFFFF));
            else
                (altRevision, revision) = ((ushort)(combinedRevision & 0xFFFF), (ushort)((combinedRevision >> 16) & 0xFFFF));

            // Read base object data
            base.Read(reader, false, parent, entry);

            // Read viseme and keyframe data
            visemes.Read(reader);
            keyFrames.Read(reader);

            if (standalone)
                if ((reader.Endianness == Endian.BigEndian ? 0xADDEADDE : 0xDEADDEAD) != reader.ReadUInt32())
                    throw new Exception("Got to end of standalone asset but didn't find the expected end bytes, read likely did not succeed");

            return this;
        }

        public override void Write(EndianWriter writer, bool standalone, DirectoryMeta parent, DirectoryMeta.Entry? entry)
        {
            // Write viseme data revisions
            writer.WriteUInt32(BitConverter.IsLittleEndian ?
                (uint)((altRevision << 16) | revision) :
                (uint)((revision << 16) | altRevision));

            // Write base object data
            base.Write(writer, false, parent, entry);

            // Write viseme and keyframe data
            visemes.Write(writer);
            keyFrames.Write(writer);

            if (standalone)
            {
                writer.WriteBlock(new byte[4] { 0xAD, 0xDE, 0xAD, 0xDE });
            }
        }

        public override string ToString()
        {
            return $"CharLipSync: revs({revision}, {altRevision}) {visemes.visemeCount} visemes, {keyFrames.keyFrameCount} keyframes";
        }
    }
}