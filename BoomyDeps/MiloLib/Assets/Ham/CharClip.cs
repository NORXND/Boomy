using System;
using System.Numerics;
using System.Collections.Generic;
using MiloLib.Classes;
using MiloLib.Utils;

namespace MiloLib.Assets.Ham
{
    public class CharClip : Object
    {
        private Dictionary<Game.MiloGame, uint> gameRevisions = new Dictionary<Game.MiloGame, uint>
        {
            { Game.MiloGame.DanceCentral, 28 },
        };

        public List<byte> binaryData = new List<byte>();
        private ushort revision;
        private ushort altRevision;

        public CharClip Read(EndianReader reader, bool standalone, DirectoryMeta parent, DirectoryMeta.Entry entry)
        {
            if (standalone)
            {
                while (reader.BaseStream.Position < reader.BaseStream.Length - 4)
                {
                    uint potentialMarker = reader.ReadUInt32();
                    uint endMarker = reader.Endianness == Endian.BigEndian ? 0xADDEADDE : 0xDEADDEAD;

                    if (potentialMarker == endMarker)
                    {
                        // Found the marker, go back 4 bytes so we can read it again in the check below
                        reader.BaseStream.Position -= 4;
                        break;
                    }
                    else
                    {
                        // Go back 3 bytes to continue searching (overlapping check)
                        reader.BaseStream.Position -= 3;

                        // Add only the first byte we read
                        binaryData.Add((byte)(potentialMarker >> 24));
                    }
                }

                // Check for the end marker
                if ((reader.Endianness == Endian.BigEndian ? 0xADDEADDE : 0xDEADDEAD) != reader.ReadUInt32())
                    throw new Exception("Got to end of standalone asset but didn't find the expected end bytes, read likely did not succeed");

                return this;
            }
            else
            {
                while (reader.BaseStream.Position < reader.BaseStream.Length)
                {
                    try
                    {
                        binaryData.Add(reader.ReadByte());
                    }
                    catch (EndOfStreamException)
                    {
                        break;
                    }
                }

                return this;
            }
        }

        public override void Write(EndianWriter writer, bool standalone, DirectoryMeta parent, DirectoryMeta.Entry? entry)
        {
            // Write the binary data
            foreach (byte b in binaryData)
            {
                writer.WriteByte(b);
            }

            if (standalone)
                writer.WriteBlock(new byte[4] { 0xAD, 0xDE, 0xAD, 0xDE });
        }
    }
}