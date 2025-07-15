using MiloLib.Assets.Rnd;
using MiloLib.Classes;
using MiloLib.Utils;

namespace MiloLib.Assets.Ham
{

    [Name("UILabelDir"), Description("Top-level resource object for UILabels")]
    public class UILabelDir : RndDir
    {
        private ushort altRevision;
        private ushort revision;

        [Name("Text Object")]
        public Symbol textObject = new(0, "");

        [Name("Font Reference"), MinVersion(3), MaxVersion(8)]
        public Symbol fontReference = new(0, "");

        [Name("Focus Anim"), MinVersion(1)]
        public Symbol focusAnim = new(0, "");
        [Name("Pulse Anim"), MinVersion(2)]
        public Symbol pulseAnim = new(0, "");

        [Name("Highlight Mesh Group"), MinVersion(4)]
        public Symbol highlightMeshGroup = new(0, "");
        [Name("Top Left Highlight Bone"), MinVersion(4)]
        public Symbol topLeftHighlightBone = new(0, "");
        [Name("Top Right Highlight Bone"), MinVersion(4)]
        public Symbol topRightHighlightBone = new(0, "");
        [Name("Bottom Left Highlight Bone"), MinVersion(5)]
        public Symbol bottomLeftHighlightBone = new(0, "");
        [Name("Bottom Right Highlight Bone"), MinVersion(5)]
        public Symbol bottomRightHighlightBone = new(0, "");

        [Name("Focused Background Group"), MinVersion(6)]
        public Symbol focusedBackgroundGroup = new(0, "");
        [Name("Unfocused Background Group"), MinVersion(6)]
        public Symbol unfocusedBackgroundGroup = new(0, "");

        [Name("Allow Edit Text"), Description("allow non-localized text with this resource?"), MinVersion(7)]
        public bool allowEditText;

        [Name("Default Color"), Description("color to use when no other color is defined for a state")]
        public Symbol defaultColor = new(0, "");
        [Name("Normal Color"), Description("color when label is normal")]
        public Symbol normalColor = new(0, "");
        [Name("Focused Color"), Description("color when label is focused")]
        public Symbol focusedColor = new(0, "");
        [Name("Disabled Color"), Description("color when label is disabled")]
        public Symbol disabledColor = new(0, "");
        [Name("Selecting Color"), Description("color when label is selecting")]
        public Symbol selectingColor = new(0, "");
        [Name("Selected Color"), Description("color when label is selected")]
        public Symbol selectedColor = new(0, "");

        [Name("Font Importer"), MinVersion(8)]
        public UIFontImporter fontImporter = new UIFontImporter();

        public UILabelDir(ushort revision, ushort altRevision = 0) : base(revision, altRevision)
        {
            revision = revision;
            altRevision = altRevision;
            return;
        }

        public List<byte> binaryData = new List<byte>();

        public UILabelDir Read(EndianReader reader, bool standalone, DirectoryMeta parent, DirectoryMeta.Entry entry)
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

        public override bool IsDirectory()
        {
            return true;
        }


    }
}
