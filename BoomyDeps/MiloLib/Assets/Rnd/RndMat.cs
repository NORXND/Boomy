using MiloLib.Classes;
using MiloLib.Utils;
using System;
using System.Drawing;

namespace MiloLib.Assets.Rnd
{

    [Name("Mat"), Description("Material perObjs determine texturing, blending, and the effect of lighting on drawn polys.")]
    public class RndMat : Object
    {
        public enum Blend : byte
        {
            kBlendDest = 0,
            kBlendSrc = 1,
            kBlendAdd = 2,
            kBlendSrcAlpha = 3,
            kBlendSrcAlphaAdd = 4,
            kBlendSubtract = 5,
            kBlendMultiply = 6,
            kPreMultAlpha = 7,
        }

        public enum ZMode : byte
        {
            kZModeDisable = 0,
            kZModeNormal = 1,
            kZModeTransparent = 2,
            kZModeForce = 3,
            kZModeDecal = 4,
        }

        public enum StencilMode : byte
        {
            kStencilIgnore = 0,
            kStencilWrite = 1,
            kStencilTest = 2,
        }

        public enum TexGen : byte
        {
            kTexGenNone = 0,
            kTexGenXfm = 1,
            kTexGenSphere = 2,
            kTexGenProjected = 3,
            kTexGenXfmOrigin = 4,
            kTexGenEnviron = 5,
        }

        public enum TexWrap : byte
        {
            kTexWrapClamp = 0,
            kTexWrapRepeat = 1,
            kTexBorderBlack = 2,
            kTexBorderWhite = 3,
            kTexWrapMirror = 4
        }
        public enum ShaderVariation : byte
        {
            kShaderVariationNone = 0,
            kShaderVariationSkin = 1,
            kShaderVariationHair = 2
        }
        public struct MatPerfSettings
        {
            [Name("Receive Projected Lights"), Description("Check this option to allow the material to receive projected lighting")]
            public bool recvProjLights;

            [Name("Receive Point Cube Textures"), Description("Check this option to allow the material to receive projected cube maps from a point light")]
            public bool recvPointCubeTex;

            [Name("Force Trilinear Filtering (PS3)"), Description("Force trilinear filtering of diffuse map (PS3 only)")]
            public bool ps3ForceTrilinear;

            public void Read(EndianReader reader, uint revision)
            {
                recvProjLights = reader.ReadBoolean();
                ps3ForceTrilinear = reader.ReadBoolean();
                if (revision > 0x41)
                    recvPointCubeTex = reader.ReadBoolean();
            }
            public void Write(EndianWriter writer, uint revision)
            {
                writer.WriteBoolean(recvProjLights);
                writer.WriteBoolean(ps3ForceTrilinear);
                if (revision > 0x41)
                    writer.WriteBoolean(recvPointCubeTex);
            }
        }


        public class TextureEntry
        {
            public int unk;
            public int unk2;
            public Matrix texXfm = new Matrix();
            public int texWrap;
            public Symbol name = new Symbol(0, "");

            public TextureEntry Read(EndianReader reader)
            {
                unk = reader.ReadInt32();
                unk2 = reader.ReadInt32();
                texXfm = new Matrix().Read(reader);
                texWrap = reader.ReadInt32();
                name = Symbol.Read(reader);
                return this;
            }

            public void Write(EndianWriter writer)
            {
                writer.WriteInt32(unk);
                writer.WriteInt32(unk2);
                texXfm.Write(writer);
                writer.WriteInt32(texWrap);
                Symbol.Write(writer, name);
            }
        }
        private ushort altRevision;
        private ushort revision;

        [Name("Blend Mode"), Description("How to blend poly into screen")]
        public Blend blend;

        [Name("Base Color"), Description("Base material color")]
        public HmxColor4 color = new HmxColor4(1f, 1f, 1f, 1f);

        [Name("Pre-Lit"), Description("Use vertex color and alpha for base or ambient")]
        public bool preLit;

        [Name("Use Environment"), Description("Modulate with environment ambient and lightsReal")]
        public bool useEnviron;

        [Name("Z-Buffer Mode"), Description("How to read and write z-buffer")]
        public ZMode zMode;

        [Name("Alpha Cut"), Description("Cut zero alpha pixels from z-buffer")]
        public bool alphaCut;

        [Name("Alpha Threshold"), Description("Alpha level below which gets cut. Ranges from 0 to 255.")]
        public int alphaThreshold;

        [Name("Alpha Write"), Description("Write pixel alpha to screen")]
        public bool alphaWrite;

        [Name("Texture Coordinate Generation"), Description("How to generate texture coordinates")]
        public TexGen texGen;

        [Name("Texture Mapping Mode"), Description("Texture mapping mode")]
        public TexWrap texWrap;

        [Name("Texture Transform"), Description("Transform for coordinate generation")]
        public Matrix texXfm = new Matrix();

        [Name("Diffuse Texture"), Description("Base texture map, modulated with color and alpha")]
        public Symbol diffuseTex = new(0, "");

        [Name("Next Pass"), Description("Next material for object")]
        public Symbol nextPass = new(0, "");

        [Name("Intensify"), Description("Double the intensity of base map")]
        public bool intensify;

        [Name("Cull"), Description("Cull backface polygons")]
        public bool cull;

        [Name("Emissive Multiplier"), Description("Multiplier to apply to emission")]
        public float emissiveMultiplier;

        [Name("Specular RGB"), Description("Color to use when not driven by texture")]
        public HmxColor3 specularRGB = new HmxColor3();

        [Name("Specular Power"), Description("Power to use when not driven by texture")]
        public float specularPower;

        [Name("Normal Map"), Description("Texture map to define lighting normals")]
        public Symbol normalMap = new Symbol(0, "");

        [Name("Emissive Map"), Description("Map for self illumination")]
        public Symbol emissiveMap = new(0, "");

        [Name("Specular Map"), Description("Texture map for specular color and power")]
        public Symbol specularMap = new Symbol(0, "");

        public Symbol unkSymbol2 = new Symbol(0, "");

        [Name("Environment Map"), Description("Cube texture for reflections. Does not apply to particles")]
        public Symbol environMap = new Symbol(0, "");

        public ushort unkShort;

        [Name("Per Pixel Lit"), Description("Use per-pixel lighting")]
        public bool perPixelLit;

        public bool unkBool1;

        [Name("Stencil Mode"), Description("How to read and write the stencil buffer")]
        public StencilMode stencilMode;

        [Name("Fur"), Description("Use fur shader")]
        public Symbol fur = new Symbol(0, "");

        [Name("De-Normal"), Description("Amount to diminish normal map bumpiness, 0 is neutral, 1 is no bumps, -1 exaggerates")]
        public float deNormal;

        [Name("Anisotropy"), Description("Specular power in downward (strand) direction, 0 to disable")]
        public float anisotropy;

        [Name("Normal Detail Tiling"), Description("Texture tiling scale for the detail map")]
        public float normalDetailTiling;

        [Name("Normal Detail Strength"), Description("Strength of the detail map bumpiness")]
        public float normalDetailStrength;

        [Name("Normal Detail Map"), Description("Detail map texture")]
        public Symbol normalDetailMap = new Symbol(0, "");

        [Name("Point Lights Enabled"), Description("Is the Mat lit with point lightsReal?")]
        public bool pointLights;

        [Name("Projected Lights"), Description("Is the Mat lit with projected lights?")]
        public bool projLights;

        [Name("Fog Enabled"), Description("Is the Mat affected by fog?")]
        public bool fog;

        [Name("Fadeout Enabled"), Description("Is the Mat affected its Environment's fade_out?")]
        public bool fadeout;

        [Name("Color Adjust Enabled"), Description("Is the Mat affected its Environment's color adjust?")]
        public bool colorAdjust;

        [Name("Rim RGB"), Description("Rim lighting color. If a rim texture is present, this color is multiplied by the rim texture RGB color.")]
        public HmxColor3 rimRGB = new HmxColor3();

        [Name("Rim Power"), Description("Rim lighting power. This is the sharpness of the wrap-around effect; higher numbers result in a sharper rim lighting effect. If a rim texture is present, this value is multiplied by the rim texture alpha channel.")]
        public float rimPower;

        [Name("Rim Map"), Description("Texture map that defines the rim lighting color (in the RGB channels) and power (in the Alpha channel).")]
        public Symbol rimMap = new Symbol(0, "");

        [Name("Rim Always Show"), Description("When enabled, this causes the rim effect to highlight the undersides of meshes")]
        public bool rimAlwaysShow;

        [Name("Screen Aligned"), Description("Projected material from camera's POV")]
        public bool screenAligned;

        [Name("Shader Variation"), Description("Select a variation on the shader to enable a new range of rendering features.")]
        public ShaderVariation shaderVariation;

        public HmxColor3 specular2RGB = new HmxColor3();

        public float specular2Power;

        public float unkFloat;

        public float unkFloat2;

        public Symbol alphaMask = new Symbol(0, "");

        public MatPerfSettings perfSettings = new MatPerfSettings();

        [Name("Refract Enabled"), Description("When enabled, this material will refract the screen under the material")]
        public bool refractEnabled;

        [Name("Refract Strength"), Description("The scale of the refraction of the screen under the material. Ranges from 0 to 100.")]
        public float refractStrength;

        [Name("Refract Normal Map"), Description("This is a normal map used to distort the screen under the material. If none is specified, the regular normal map will be used.")]
        public Symbol refractNormalMap = new Symbol(0, "");

        public byte unkbool;

        [Name("Dirty Flags"), Description("Dirty flags that denote changes to the material")]
        public byte dirty;

        public HmxColor4 unkColor = new HmxColor4(1f, 1f, 1f, 1f);

        public bool unkBool;

        public Symbol unkSym = new Symbol(0, "");

        public Symbol unkSym1 = new Symbol(0, "");

        public Symbol unkSym2 = new Symbol(0, "");

        public HmxColor4 unkColor2 = new HmxColor4();

        private uint colorsCount;
        public List<HmxColor4> colors = new();

        private uint textureCount;
        public List<TextureEntry> textures = new();

        public int unkInt1;
        public int unkInt2;
        public int unkInt3;

        public bool unkBool2;
        public HmxColor3 unkColor3 = new();
        public float unkFloat3;

        public Symbol unkSym3 = new Symbol(0, "");


        public List<byte> binaryData = new List<byte>();


        public RndMat Read(EndianReader reader, bool standalone, DirectoryMeta parent, DirectoryMeta.Entry entry)
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

        public static RndMat New(ushort revision, ushort altRevision)
        {
            RndMat rndMat = new RndMat();
            rndMat.revision = revision;
            rndMat.altRevision = altRevision;
            return rndMat;
        }

    }
}