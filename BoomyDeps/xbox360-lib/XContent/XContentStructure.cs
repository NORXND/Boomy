using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Collections;

namespace XContent
{
    public enum ContentTypes : int
    {
        SavedGame = 0x1,
        Marketplace = 0x2,
        Publisher = 0x3,
        IPTVDVR = 0x1000,
        IPTVPauseBuffer = 0x2000, //No longer used.
        XNACommunity = 0x3000,
        InstalledXbox360Title = 0x4000,
        XboxTitle = 0x5000,
        SocialTitle = 0x6000,
        Xbox360Title = 0x7000,
        SystemUpdateStoragePack = 0x8000,
        AvatarAsset = 0x9000,
        Profile = 0x10000,
        GamerPicture = 0x20000,
        ThematicSkin = 0x30000,
        Cache = 0x40000,
        StorageDownload = 0x50000,
        XboxSavedGame = 0x60000,
        XboxDownload = 0x70000,
        GameDemo = 0x80000,
        Video = 0x90000,
        GameTitle = 0xA0000,
        Installer = 0xB0000,
        GameTrailer = 0xC0000,
        Arcade = 0xD0000,
        XNA = 0xE0000,
        LicenseStore = 0xF0000,
        Movie = 0x100000,
        TV = 0x200000,
        MusicVideo = 0x300000,
        GameVideo = 0x400000, //Now called Promotional.
        Promotional = 0x400000,
        PodcastVideo = 0x500000,
        ViralVideo = 0x600000,
        Unknown
    }

    public struct XContentHeader
    {
        public XContentSignatureType SignatureType;
        public XContentSignatureHeader Signature;
        public XContentLicense[] LicenseDescriptors; //(16*16) = 256
        public byte[] ContentId; // 0x14, SHA-1
        public int SizeOfHeaders; //4
        public XContentMetadata Metadata;

        public byte[] ToArray()
        {
            MemoryStream ms = new MemoryStream();
            EndianWriter writer = new EndianWriter(ms, EndianType.BigEndian);

            writer.Write((uint)SignatureType);
            writer.Write(new byte[0x228]);

            for (int x = 0; x < 0x10; x++)
            {
                writer.Write(this.LicenseDescriptors[x].LicenseId.AsULONG);
                writer.Write(this.LicenseDescriptors[x].LicenseBits);
                writer.Write(this.LicenseDescriptors[x].LicenseFlags);
            }

            writer.Write(this.ContentId);
            writer.Write(this.SizeOfHeaders);

            writer.Write(this.Metadata.ToArray());

            writer.Close();

            return ms.ToArray();
        }
    }
    public class XContentSignatureHeader
    {
        public XContentSignature ContentSignature;
        public XeConsoleSignature ConsoleSignature;
        public bool Signed;
        private EndianIO IO;
        private XContentSignatureType SignatureType;

        public XContentSignatureHeader(EndianIO IO, XContentSignatureType PackageType)
        {
            this.IO = IO;
            this.SignatureType = PackageType;

            this.Read();
        }
        private void Read()
        {
            if (this.SignatureType == XContentSignatureType.CONSOLE_SIGNED)
            {
                this.ConsoleSignature = new XeConsoleSignature(this.IO);
            }
            else if (this.SignatureType == XContentSignatureType.LIVE_SIGNED || this.SignatureType == XContentSignatureType.PIRS_SIGNED)
            {
                this.ContentSignature.Signature = this.IO.In.ReadBytes(256);
                this.ContentSignature.Reserved = this.IO.In.ReadBytes(296);
            }
        }
    }
    public struct XProfileConsoleId
    {
        public byte[] Id;
    }
    public enum XContentSignatureType
    {
        CONSOLE_SIGNED = 0x434F4E20,
        LIVE_SIGNED = 0x4C495645,
        PIRS_SIGNED = 0x50495253
    }
    public struct XContentSignature
    {
        public byte[] Signature; // 256
        public byte[] Reserved; // 296
    }
    public struct ConsolePublicKey
    {
        public byte[] PublicExponent; //4
        public byte[] Modulus; //128
    }
    public struct XeConsoleCertificate
    {
        public ushort CertSize;
        public byte[] ConsoleId; // 5
        public char[] ConsolePartNumber; // 11
        public byte[] Reserved; //4
        public ushort Privileges;
        public uint ConsoleType;
        public long ManufacturingDate;
        public ConsolePublicKey ConsolePublicKey;
        public byte[] Signature; //256

        public XeConsoleCertificate(byte[] Data)
        {
            EndianReader er = new EndianReader(new MemoryStream(Data), EndianType.BigEndian);
            CertSize = er.ReadUInt16();
            ConsoleId = er.ReadBytes(5);
            ConsolePartNumber = er.ReadChars(11);
            Reserved = er.ReadBytes(4);
            Privileges = er.ReadUInt16();
            ConsoleType = er.ReadUInt32();
            ManufacturingDate = er.ReadInt64();
            ConsolePublicKey.PublicExponent = er.ReadBytes(4);
            ConsolePublicKey.Modulus = er.ReadBytes(128);
            Signature = er.ReadBytes(256);
        }
    }
    public class XeConsoleSignature
    {
        public XeConsoleCertificate Cert;
        public byte[] Signature; // 128
        public XeConsoleSignature(EndianIO IO)
        {
            this.Read(IO.In);
        }
        private void Read(EndianReader reader)
        {
            this.Cert.CertSize = reader.ReadUInt16();
            this.Cert.ConsoleId = reader.ReadBytes(5);
            this.Cert.ConsolePartNumber = reader.ReadChars(11);
            this.Cert.Reserved = reader.ReadBytes(4);
            this.Cert.Privileges = reader.ReadUInt16();
            this.Cert.ConsoleType = reader.ReadUInt32();
            this.Cert.ManufacturingDate = reader.ReadInt64();
            this.Cert.ConsolePublicKey.PublicExponent = reader.ReadBytes(4);
            this.Cert.ConsolePublicKey.Modulus = reader.ReadBytes(128);
            this.Cert.Signature = reader.ReadBytes(256);
            this.Signature = reader.ReadBytes(128);

            Array.Reverse(this.Signature);
        }
        private RSACryptoServiceProvider LoadServiceProvider()
        {
            RSAParameters RSAParams = new RSAParameters();
            RSAParams.Exponent = this.Cert.ConsolePublicKey.PublicExponent;
            RSAParams.Modulus = HorizonCrypt.ReverseQword(this.Cert.ConsolePublicKey.Modulus);

            RSACryptoServiceProvider sp = new RSACryptoServiceProvider();
            sp.ImportParameters(RSAParams);

            return sp;
        }
        public bool Verify(byte[] Data)
        {
            return HorizonCrypt.VerifyRSASignature(LoadServiceProvider(), this.Signature, Data);
        }
    }
    public struct XContentLicense
    {
        public Licensee LicenseId;
        public uint LicenseBits;
        public uint LicenseFlags;
    }
    public enum XContentVolumeType
    {
        STFS_Volume = 0x00,
        SVOD_Volume = 0x01
    }
    public struct XContentMetadataMediaData
    {
        public byte[] SeriesId; //16
        public byte[] SeasonId; //16
        public ushort SeasonNumber;
        public ushort EpisodeNumber;
    }
    public struct XContentMetadataAvatarAssetData
    {
        public uint SubCategory;
        public int Colorizable;
        public byte[] AssetId; // 16
        public byte SkeletonVersionMask;
        public byte[] Reserved; // 11
    }
    public struct XContentTransferFlags
    {
        public byte ProfileTransfer;
        public byte DeviceTransfer;
        public byte MoveOnlyTransfer;
        public byte Reserved;
        public byte bTransferFlags;
    }
    public class XContentMetadata
    {
        public ContentTypes ContentType;
        public uint ContentMetadataVersion;
        public ulong ContentSize;
        public XexExecutionId ExecutionId;
        public byte[] ConsoleId; // 5
        public ulong Creator;
        public StfsVolumeDescriptor StfsVolumeDescriptor;
        public SvodDeviceDescriptor SvodDeviceDescriptor;
        public uint DataFiles;
        public ulong DataFilesSize;
        public XContentVolumeType VolumeType;
        public byte[] Reserved2; // 44
        public XContentMetadataMediaData MediaData;
        public XContentMetadataAvatarAssetData AvatarAssetData;
        public byte[] DeviceId; // 20
        public string[] DisplayNames = new string[9]; // 2304 wide char
        public string[] Descriptions = new string[9]; // 2304
        public string Publisher; // 128
        public string TitleName; // 128
        public XContentTransferFlags TransferFlags;
        public uint ThumbnailSize;
        public uint TitleThumbnailSize;
        public byte[] Thumbnail;
        public string DisplayNameEx; // 768
        public byte[] TitleThumbnail;
        public string DescriptionEx; // 768
        private int FirstDisplayNameLanguage = -1;
        private int FirstDescriptionLanguage = -1;

        public string DisplayName
        {
            get
            {
                return this.DisplayNames[FirstDisplayNameLanguage];
            }
            set
            {
                this.DisplayNames[FirstDisplayNameLanguage] = value;
            }
        }

        public void SetAllDisplayNames(string newName)
        {
            for (int x = 0; x < this.DisplayNames.Length; x++)
                this.DisplayNames[x] = newName;
        }

        public string Description
        {
            get
            {
                return this.Descriptions[FirstDescriptionLanguage];
            }
            set
            {
                this.Descriptions[FirstDescriptionLanguage] = value;
            }
        }

        public void SetAllDescriptions(string newDescription)
        {
            for (int x = 0; x < this.Descriptions.Length; x++)
                this.Descriptions[x] = newDescription;
        }

        private EndianIO IO;
        public XContentMetadata()
        {
            this.ConsoleId = new byte[5];
            this.Reserved2 = new byte[44];
            this.DeviceId = new byte[20];
            this.Thumbnail = new byte[0x3D00];
            this.TitleThumbnail = new byte[0x3D00];
        }
        public XContentMetadata(EndianIO IO)
        {
            this.IO = IO;

            this.Read();
        }
        private void Read()
        {
            this.IO.In.SeekTo(0x3a9);
            this.VolumeType = (XContentVolumeType)this.IO.In.ReadUInt32();

            this.IO.In.SeekTo(0x344);
            this.ContentType = (ContentTypes)this.IO.In.ReadUInt32();
            this.ContentMetadataVersion = this.IO.In.ReadUInt32();
            this.ContentSize = this.IO.In.ReadUInt64();
            this.ExecutionId.MediaId = this.IO.In.ReadUInt32();
            this.ExecutionId.Version = this.IO.In.ReadUInt32();
            this.ExecutionId.BaseVersion = this.IO.In.ReadUInt32();
            this.ExecutionId.TitleId = this.IO.In.ReadUInt32();
            this.ExecutionId.Platform = this.IO.In.ReadByte();
            this.ExecutionId.ExecutableType = this.IO.In.ReadByte();
            this.ExecutionId.DiscNum = this.IO.In.ReadByte();
            this.ExecutionId.DiscsInSet = this.IO.In.ReadByte();
            this.ExecutionId.SaveGameId = this.IO.In.ReadUInt32();
            this.ConsoleId = this.IO.In.ReadBytes(5);
            this.Creator = this.IO.In.ReadUInt64();

            switch (VolumeType)
            {
                case XContentVolumeType.STFS_Volume:
                    this.StfsVolumeDescriptor = new StfsVolumeDescriptor(this.IO);
                    break;
                case XContentVolumeType.SVOD_Volume:
                    this.SvodDeviceDescriptor = new SvodDeviceDescriptor(this.IO);
                    break;
                default:
                    throw new Exception("Unknown XContent volume type detected.");
            }

            this.DataFiles = this.IO.In.ReadUInt32();
            this.DataFilesSize = this.IO.In.ReadUInt64();
            this.IO.In.BaseStream.Position += 4;    // VolumeType  

            this.Reserved2 = this.IO.In.ReadBytes(44);
            this.MediaData.SeriesId = this.IO.In.ReadBytes(16);
            this.MediaData.SeasonId = this.IO.In.ReadBytes(16);
            this.MediaData.SeasonNumber = this.IO.In.ReadUInt16();
            this.MediaData.EpisodeNumber = this.IO.In.ReadUInt16();

            this.IO.In.BaseStream.Position -= 36;

            this.AvatarAssetData.SubCategory = this.IO.In.ReadUInt32();
            this.AvatarAssetData.Colorizable = this.IO.In.ReadInt32();
            this.AvatarAssetData.AssetId = this.IO.In.ReadBytes(16);
            this.AvatarAssetData.SkeletonVersionMask = this.IO.In.ReadByte();
            this.AvatarAssetData.Reserved = this.IO.In.ReadBytes(11);

            this.DeviceId = this.IO.In.ReadBytes(20);

            for (int x = 0; x < 9; x++)
            {
                this.DisplayNames[x] = this.IO.In.ReadUnicodeString(128);
                if (FirstDisplayNameLanguage == -1 && this.DisplayNames[x].Length != 0)
                    FirstDisplayNameLanguage = x;
            }
            if (FirstDisplayNameLanguage == -1)
                FirstDisplayNameLanguage = 0;

            for (int x = 0; x < 9; x++)
            {
                this.Descriptions[x] = this.IO.In.ReadUnicodeString(128);
                if (FirstDescriptionLanguage == -1 && this.Descriptions[x].Length != 0)
                    FirstDescriptionLanguage = x;
            }
            if (FirstDescriptionLanguage == -1)
                FirstDescriptionLanguage = 0;

            this.Publisher = this.IO.In.ReadUnicodeString(64);
            this.TitleName = this.IO.In.ReadUnicodeString(64);

            this.TransferFlags.bTransferFlags = this.IO.In.ReadByte();
            this.TransferFlags.Reserved = (byte)(this.TransferFlags.bTransferFlags & 0x0F);
            this.TransferFlags.MoveOnlyTransfer = (byte)((this.TransferFlags.bTransferFlags >> 5) & 1);
            this.TransferFlags.DeviceTransfer = (byte)((this.TransferFlags.bTransferFlags >> 6) & 1);
            this.TransferFlags.ProfileTransfer = (byte)((this.TransferFlags.bTransferFlags >> 7) & 1);

            this.ThumbnailSize = this.IO.In.ReadUInt32();
            this.TitleThumbnailSize = this.IO.In.ReadUInt32();
            this.Thumbnail = this.IO.In.ReadBytes(MaxThumbnailSize);

            if (this.ContentMetadataVersion >= 2)
                this.DisplayNameEx = this.IO.In.ReadUnicodeString(384);

            this.TitleThumbnail = this.IO.In.ReadBytes(MaxThumbnailSize);

            if (this.MaxThumbnailSize >= 2)
                this.DescriptionEx = this.IO.In.ReadUnicodeString(384);
        }

        internal int MaxThumbnailSize
        {
            get { return this.ContentMetadataVersion >= 2 ? 0x3D00 : 0x4000; }
        }

        public byte[] ToArray()
        {
            MemoryStream MS = new MemoryStream();
            EndianWriter writer = new EndianWriter(MS, EndianType.BigEndian);

            writer.Write((uint)ContentType);
            writer.Write(this.ContentMetadataVersion);
            writer.Write(this.ContentSize);
            writer.Write(this.ExecutionId.MediaId);
            writer.Write(this.ExecutionId.Version);
            writer.Write(this.ExecutionId.BaseVersion);
            writer.Write(this.ExecutionId.TitleId);
            writer.Write(this.ExecutionId.Platform);
            writer.Write(this.ExecutionId.ExecutableType);
            writer.Write(this.ExecutionId.DiscNum);
            writer.Write(this.ExecutionId.DiscsInSet);
            writer.Write(this.ExecutionId.SaveGameId);
            writer.Write(this.ConsoleId);
            writer.Write(this.Creator);

            if (this.VolumeType == XContentVolumeType.STFS_Volume)
            {
                writer.Write(this.StfsVolumeDescriptor.ToArray());
            }
            else if (this.VolumeType == XContentVolumeType.SVOD_Volume)
            {
                writer.Write(this.SvodDeviceDescriptor.ToArray());
            }

            writer.Write(this.DataFiles);
            writer.Write(this.DataFilesSize);
            writer.Write((uint)this.VolumeType);
            writer.Write(this.Reserved2);

            writer.Write(new byte[36]);

            writer.Write(this.DeviceId);
            for (int x = 0; x < this.DisplayNames.Length; x++)
                writer.WriteUnicodeString(this.DisplayNames[x] ?? String.Empty, 128);
            for (int x = 0; x < this.Descriptions.Length; x++)
                writer.WriteUnicodeString(this.Descriptions[x] ?? String.Empty, 128);
            writer.WriteUnicodeString(this.Publisher, 64);
            writer.WriteUnicodeString(this.TitleName, 64);
            writer.Write(this.TransferFlags.bTransferFlags);
            writer.Write(this.ThumbnailSize);
            writer.Write(this.TitleThumbnailSize);
            writer.Write(this.Thumbnail);
            if (this.ContentMetadataVersion >= 2)
                writer.WriteUnicodeString(this.DisplayNameEx, 384);
            writer.Write(this.TitleThumbnail);
            if (this.ContentMetadataVersion >= 2)
                writer.WriteUnicodeString(this.DescriptionEx, 384);

            writer.Close();
            return MS.ToArray();
        }
        public void SetCreator(ulong Creator)
        {
            if ((Creator & Convert.ToUInt64((0xE0 << 0x38))) != 0)
            {
                this.Creator = Creator;
            }
        }
        public bool SetThumbnail(byte[] Thumbnail)
        {
            if (Thumbnail.Length <= 0x3d00)
            {
                this.ThumbnailSize = (uint)Thumbnail.Length;
                this.Thumbnail = new byte[0x3d00];
                Array.Copy(Thumbnail, 0, this.Thumbnail, 0, Thumbnail.Length);
                return true;
            }
            return false;
        }
        public bool SetTitleThumbnail(byte[] TitleThumbnail)
        {
            if (TitleThumbnail.Length <= 0x3d00)
            {
                this.TitleThumbnailSize = (uint)TitleThumbnail.Length;
                this.TitleThumbnail = new byte[0x3d00];
                Array.Copy(TitleThumbnail, 0, this.TitleThumbnail, 0, TitleThumbnail.Length);
                return true;
            }
            return false;
        }
        public void SetDeviceId(byte[] DeviceId)
        {
            if (DeviceId.Length == 0x14)
            {
                this.DeviceId = DeviceId;
            }
        }
        public void SetTransferFlags(byte TransferFlag)
        {
            this.TransferFlags.bTransferFlags = TransferFlag;
        }
    }

    public struct LicenseeBits
    {
        public ulong Type;
        public ulong Data;
    }
    public struct Licensee
    {
        public LicenseeBits Bits;
        public ulong AsULONG;
    }

    public struct XecryptRsa
    {
        public int cwq; // double word count
        public byte[] PublicExponent; // int32, byte array for our convenience
        public long Reserved;
    }
    public struct XeCryptRsaPrv1024
    {
        public XecryptRsa Rsa;
        public byte[] M;
        public byte[] P;
        public byte[] Q;
        public byte[] DP;
        public byte[] DQ;
        public byte[] CR;
    }
    public class Keyvault
    {
        public System.Security.Cryptography.RSAParameters SigningParams;
        public EndianIO IO;
        private XeCryptRsaPrv1024 PrivateKey;
        public byte[] ConsoleCertificate;
        public Keyvault(EndianIO IO)
        {
            this.IO = IO;

            this.IO.Open();
        }
        public void LoadSigningParameters()
        {

            int Position = 0;
            switch (this.IO.Stream.Length)
            {
                case 0x4000:
                    Position = 0x18;
                    break;
                case 0x3FF0:
                    Position = 0x08;
                    break;
                default:
                    throw new Exception("Invalid keyvault loaded.");
            }

            this.IO.SeekTo(Position + 0x9b0); // console certificate, key : 0x36

            this.ConsoleCertificate = this.IO.In.ReadBytes(0x1a8);

            this.IO.SeekTo(Position + 0x0280); // console private signing key, key : 0x33

            // For some reason the console signature is formatted from an RSA-1024 key instead of the standard RSA-2048

            this.PrivateKey.Rsa.cwq = this.IO.In.ReadInt32();
            this.PrivateKey.Rsa.PublicExponent = this.IO.In.ReadBytes(4);
            this.PrivateKey.Rsa.Reserved = this.IO.In.ReadInt64();
            this.PrivateKey.M = this.IO.In.ReadBytes(128);
            this.PrivateKey.P = this.IO.In.ReadBytes(64);
            this.PrivateKey.Q = this.IO.In.ReadBytes(64);
            this.PrivateKey.DP = this.IO.In.ReadBytes(64);
            this.PrivateKey.DQ = this.IO.In.ReadBytes(64);
            this.PrivateKey.CR = this.IO.In.ReadBytes(64);

            this.SigningParams = new System.Security.Cryptography.RSAParameters();
            this.SigningParams.Exponent = this.PrivateKey.Rsa.PublicExponent;
            this.SigningParams.D = new byte[128];
            this.SigningParams.Modulus = ReverseQw(this.PrivateKey.M);
            this.SigningParams.P = ReverseQw(this.PrivateKey.P);
            this.SigningParams.Q = ReverseQw(this.PrivateKey.Q);
            this.SigningParams.DP = ReverseQw(this.PrivateKey.DP);
            this.SigningParams.DQ = ReverseQw(this.PrivateKey.DQ);
            this.SigningParams.InverseQ = ReverseQw(this.PrivateKey.CR);
        }
        private byte[] ReverseQw(byte[] Input)
        {
            byte[] buffer = new byte[Input.Length];

            Array.Copy(Input, buffer, Input.Length);

            for (int x = 0; x < Input.Length; x += 8)
            {
                Array.Reverse(buffer, x, 8);
            }

            Array.Reverse(buffer);

            return buffer;
        }
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct XexExecutionId
    {
        [FieldOffset(0)]
        public uint MediaId;
        [FieldOffset(4)]
        public uint Version;
        [FieldOffset(8)]
        public uint BaseVersion;
        [FieldOffset(12)]
        public ushort PublisherId;
        [FieldOffset(14)]
        public ushort GameId;
        [FieldOffset(12)]
        public uint TitleId;
        [FieldOffset(16)]
        public byte Platform;
        [FieldOffset(17)]
        public byte ExecutableType;
        [FieldOffset(18)]
        public byte DiscNum;
        [FieldOffset(19)]
        public byte DiscsInSet;
        [FieldOffset(20)]
        public uint SaveGameId;
    }


    /*
     * SVOD: Secure Virtual Optical Drive (File System)
    */

    public struct SvodHashEntry
    {
        public byte[] Hash; // 20
        public bool IsBlockLoaded
        {
            get { return !HorizonCrypt.IsBufferNull(Hash); }
        }
    }
    public class SvodLevel0HashBlock
    {
        public SvodHashEntry[] Entries;
        public byte[] Reserved;
        public SvodLevel0HashBlock(EndianReader reader)
        {
            this.Entries = new SvodHashEntry[204];
            for (var x = 0; x < 204; x++)
            {
                this.Entries[x].Hash = reader.ReadBytes(20);
            }
            this.Reserved = reader.ReadBytes(16);
        }
        public uint LoadedBlockCount()
        {
            for (uint x = 0; x < 204; x++)
            {
                if (!this.Entries[x].IsBlockLoaded)
                    return x;
            }
            return 0x00;
        }
    }
    public class SvodLevel1HashBlock
    {
        public SvodHashEntry[] Entries;
        public byte[] NextFragmentHashEntry;
        public byte[] Reserved;
        public SvodLevel1HashBlock(EndianReader reader)
        {
            this.Entries = new SvodHashEntry[203];
            for (var x = 0; x < 203; x++)
            {
                this.Entries[x].Hash = reader.ReadBytes(20);
            }
            this.NextFragmentHashEntry = reader.ReadBytes(20);
            this.Reserved = reader.ReadBytes(16);
        }
        public uint LoadedBlockCount()
        {
            for (uint x = 0; x < 203; x++)
            {
                if (!this.Entries[x].IsBlockLoaded)
                    return x;
            }
            return 0x00;
        }
    }
    public class SvodLevel0BackingBlocks
    {
        public SvodLevel0HashBlock Level0HashBlock;
        public byte[] DataBlocks;
        public SvodLevel0BackingBlocks(EndianReader reader)
        {
            this.Level0HashBlock = new SvodLevel0HashBlock(reader);
            //this.DataBlocks = reader.ReadBytes(835584);
        }
    }
    public struct SvodDeviceFeatures
    {
        public byte MustBeZeroForFutureUsage;
        public byte HasEnhancedGDFLayout;
        public byte ShouldBeZeroForDownLevelClients;
    }
    public struct SvodFragmentHandle
    {
    }
    public class SvodDeviceDescriptor : IDisposable
    {
        public byte DescriptorLength;
        public byte BlockCacheElementCount;
        public byte WorkerThreadProcessor;
        public byte WorkerThreadPriority;
        public SvodHashEntry FirstFragmentHashEntry;
        public SvodDeviceFeatures Features;
        public uint NumberOfDataBlocks; // int24
        public uint StartingDataBlock; //int24
        public byte[] Reserved; //5
        public byte FeaturesFlags;

        private EndianIO IO;
        private bool disposed;

        public SvodDeviceDescriptor(EndianIO IO)
        {
            this.IO = IO;
            if (!IO.Opened)
                this.IO.Open();

            this.Read();
        }
        private void Read()
        {
            this.DescriptorLength = this.IO.In.ReadByte();
            this.BlockCacheElementCount = this.IO.In.ReadByte();
            this.WorkerThreadProcessor = this.IO.In.ReadByte();
            this.WorkerThreadPriority = this.IO.In.ReadByte();
            this.FirstFragmentHashEntry.Hash = this.IO.In.ReadBytes(0x14);
            this.FeaturesFlags = this.IO.In.ReadByte();
            this.Features.MustBeZeroForFutureUsage = (byte)(this.FeaturesFlags & 0x3f);
            this.Features.HasEnhancedGDFLayout = (byte)((this.FeaturesFlags >> 6) & 0x01);
            this.Features.ShouldBeZeroForDownLevelClients = (byte)((this.FeaturesFlags >> 7) & 0x01);
            this.NumberOfDataBlocks = this.IO.In.ReadUInt24();
            this.StartingDataBlock = this.IO.In.ReadUInt24(EndianType.LittleEndian);
            this.Reserved = this.IO.In.ReadBytes(5);
        }
        public byte[] ToArray()
        {
            var ms = new MemoryStream();
            var writer = new EndianWriter(ms, EndianType.BigEndian);

            writer.Write(this.DescriptorLength);
            writer.Write(this.BlockCacheElementCount);
            writer.Write(this.WorkerThreadProcessor);
            writer.Write(this.WorkerThreadPriority);
            writer.Write(this.FirstFragmentHashEntry.Hash);
            writer.Write(this.FeaturesFlags);
            writer.Write(this.NumberOfDataBlocks);
            writer.Write(this.StartingDataBlock);
            writer.Write(this.Reserved);

            writer.Close();
            return ms.ToArray();
        }
        public void Dispose()
        {
            this.Dispose(true);

            GC.SuppressFinalize(this);
        }
        protected virtual void Dispose(bool disposing)
        {
            if (!this.disposed)
            {
                this.IO.Close();
            }
            this.disposed = true;
        }
    }
    public struct SvodCreatePacket
    {
        public string DataFileDirectory;
        public byte[] FSCache;
        public SvodDeviceDescriptor Descriptor;
    }
    public struct SvodCacheElement
    {
        public uint BlockNumber;
        public byte Type;
        public byte NextIndex;
        public byte PreviousIndex;
    }


    /* 
     * STFS: Secure Transacted File System
     */

    [StructLayout(LayoutKind.Explicit)]
    public struct StfsFileBounds
    {
        [FieldOffset(0)]
        public uint Filesize;
        [FieldOffset(0)]
        public ushort FirstChildDirectoryIndex;
        [FieldOffset(2)]
        public ushort LastChildDirectoryIndex;
    }
    public struct StfsTimeStamp
    {
        public int DoubleSeconds
        {
            get { return (AsINT & 0x1F) / 2; }
            set { AsINT = AsINT | (value * 2) & 0x1F; }
        }
        public int Minute
        {
            get { return ((AsINT >> 5) & 0x3f); }
            set { AsINT = AsINT | (value & 0x3f) << 5; }
        }
        public int Hour
        {
            get { return ((AsINT >> 11) & 0x1F); }
            set { AsINT = AsINT | (value & 0x1f) << 11; }
        }
        public int Day
        {
            get { return ((AsINT >> 16) & 0x1F); }
            set { AsINT = AsINT | (value & 0x1f) << 16; }
        }
        public int Month
        {
            get { return ((AsINT >> 21) & 0x0F); }
            set { AsINT = AsINT | (value & 0x0f) << 21; }
        }
        public int Year
        {
            get { return ((AsINT >> 25) & 0x7f) + 1980; }
            set { AsINT = AsINT | ((value & 0x7f) - 1980) << 25; }
        }
        public int AsINT { get; set; }
    }
    public class StfsDirectoryEntry
    {
        public string FileName; // 40
        public byte FileNameLength;
        public bool Contiguous;
        public bool IsDirectory;
        public uint ValidDataBlocks;
        public uint AllocationBlocks;
        public uint FirstBlockNumber;
        public ushort DirectoryIndex;
        public StfsFileBounds FileBounds;
        public StfsTimeStamp CreationTimeStamp;
        public StfsTimeStamp LastWriteTimeStamp;

        public bool IsEntryBound
        {
            get { return FileNameLength != 0; }
        }

        public uint DirectoryEntryByteOffset;
        public uint DirectoryEndOfListing;

        public StfsDirectoryEntry()
        {
            this.FileName = String.Empty;
            this.FileNameLength = 0;
            this.Contiguous = false;
            this.IsDirectory = false;
            this.ValidDataBlocks = 0;
            this.AllocationBlocks = 0;
            this.DirectoryIndex = 0xffff;
            this.FileBounds.Filesize = 0;
            this.CreationTimeStamp.AsINT = 0;
            this.LastWriteTimeStamp.AsINT = 0;
        }
        public StfsDirectoryEntry(string Filename, bool IsDirectory)
            : this(Filename, IsDirectory, 0xffff)
        {
        }
        public StfsDirectoryEntry(string Filename, bool IsDirectory, ushort DirectoryIndex)
        {
            this.FileName = Filename;
            this.FileNameLength = (byte)Filename.Length;
            this.Contiguous = false;
            this.IsDirectory = IsDirectory;
            this.ValidDataBlocks = 0;
            this.AllocationBlocks = 0;
            this.DirectoryIndex = DirectoryIndex;
            this.FileBounds.Filesize = 0;
            this.CreationTimeStamp.AsINT = 0;
            this.LastWriteTimeStamp.AsINT = 0;
        }
        public StfsDirectoryEntry(EndianReader Reader)
        {
            FileName = Reader.ReadString(40);

            byte EntryFlags = Reader.ReadByte();
            FileNameLength = (byte)(EntryFlags & 0x3F);
            Contiguous = ((EntryFlags >> 6) & 1) == 1 ? true : false;
            IsDirectory = ((EntryFlags >> 7) & 1) == 1 ? true : false;

            ValidDataBlocks = Reader.ReadUInt24(EndianType.LittleEndian); // valid
            AllocationBlocks = Reader.ReadUInt24(EndianType.LittleEndian); // allocation
            FirstBlockNumber = Reader.ReadUInt24(EndianType.LittleEndian);
            DirectoryIndex = Reader.ReadUInt16();
            FileBounds.Filesize = Reader.ReadUInt32();

            CreationTimeStamp.AsINT = Reader.ReadInt32();
            LastWriteTimeStamp.AsINT = Reader.ReadInt32();

            if (FileNameLength != 0x00 && FileName.Length > FileNameLength)
            {
                FileName = FileName.Remove(FileNameLength);
            }
        }
        public byte[] ToArray()
        {
            MemoryStream ms = new MemoryStream();
            EndianWriter ew = new EndianWriter(ms, EndianType.BigEndian);

            ew.WriteAsciiString(FileName, 0x28);
            ew.Write((byte)((FileNameLength & 0x3f) | ((Convert.ToByte(Contiguous) & 0x1) << 6) | ((Convert.ToByte(IsDirectory) & 0x1) << 7)));
            ew.WriteUInt24(ValidDataBlocks, EndianType.LittleEndian);
            ew.WriteUInt24(AllocationBlocks, EndianType.LittleEndian);
            ew.WriteUInt24(FirstBlockNumber, EndianType.LittleEndian);
            ew.Write(DirectoryIndex);
            ew.Write(FileBounds.Filesize);
            ew.Write(CreationTimeStamp.AsINT);
            ew.Write(LastWriteTimeStamp.AsINT);

            ew.Close();
            return ms.ToArray();
        }
    }
    public class StfsFcb : IDisposable
    {
        public StfsFcb ParentFcb;
        public StfsFcb CloneFcb;
        public uint BlockPosition;
        public uint FirstBlockNumber;
        public uint AllocationBlocks;
        public uint ValidAllocBlocks;
        public string FileName;
        public uint Filesize;
        public uint ContiguousBytesRead;
        public uint LastUnContiguousBlockNum;
        public uint LastBlockNumber;
        public ushort DirectoryEntryIndex;
        public ushort ParentDirectoryIndex;
        public StfsTimeStamp CreationTimeStamp;
        public StfsTimeStamp LastWriteTimeStamp;
        public int Referenced;
        public byte State = 0;

        /* States
         * 0x01 - Is Title-Owned
         * 0x02 - Is Folder/Directory
         * 0x04 - Is Root Directory FCB
         * 0x08 - Mark For Deletion
         * 0x10 - Modified
         * 0x20 - Is Writeable
        */

        public bool IsDirectory
        {
            get { return (State & 2) != 0; }
            set { State = (byte)((State & ~2) | Convert.ToByte(value)); }
        }
        public StfsFcb() { }
        public StfsFcb(StfsDirectoryEntry dirEnt, StfsFcb parentFcb)
        {
            //if(TitleOwned) State = 1;

            ParentFcb = parentFcb;

            LastBlockNumber = 0xffffffff;
            BlockPosition = 0xffffffff;

            ParentDirectoryIndex = dirEnt.DirectoryIndex;
            DirectoryEntryIndex = (ushort)(dirEnt.DirectoryEntryByteOffset / 0x40);

            FileName = dirEnt.FileName;

            if (dirEnt.IsDirectory)
            {
                State |= 2;
            }

            FirstBlockNumber = dirEnt.FirstBlockNumber;

            AllocationBlocks = dirEnt.AllocationBlocks * 0x1000;
            ValidAllocBlocks = dirEnt.ValidDataBlocks * 0x1000;

            Filesize = dirEnt.FileBounds.Filesize;

            if (ValidAllocBlocks > AllocationBlocks)
            {
                throw new Exception("The number of valid allocation blocks was higher than the allocation block count.");
            }
            if (Filesize > AllocationBlocks)
            {
                throw new Exception(string.Format("The file size of the file {0} was greater than the allocated byte count.", dirEnt.FileName));
            }


            ContiguousBytesRead = 0x0000;
            LastUnContiguousBlockNum = 0;

            if (dirEnt.ValidDataBlocks == 0 || !dirEnt.Contiguous)
            {
                LastBlockNumber = 0xffffffff;
                BlockPosition = 0xffffffff;
            }
            else
            {
                LastBlockNumber = FirstBlockNumber + dirEnt.ValidDataBlocks - 1;
                BlockPosition = 0;
                ContiguousBytesRead = ValidAllocBlocks;
                LastUnContiguousBlockNum = FirstBlockNumber;
            }
            CreationTimeStamp = dirEnt.CreationTimeStamp;
            LastWriteTimeStamp = dirEnt.LastWriteTimeStamp;
        }
        public void Dispose()
        {
            this.CloneFcb = null;
            this.ParentFcb = null;
        }
    }
    public struct StfsAllocateBlockState
    {
        public uint NumberOfNeededBlocks; // 0x00
        public uint FirstAllocatedBlockNumber; // 0x04
        public uint LastAllocatedBlockNumber; // 0x08
        public StfHashEntry hashEntry; // 0x0C - ptr to hash entry
        public uint HashEntryIndex;
        public int Block; // 0x10 hashBlock, cache Index in this case
    }
    public struct StfsFreeBlockState
    {
        public bool MarkFirstAsLast; // 0x00
        public StfHashEntry hashEntry; // 0x04
    }
    public enum StfsHashEntryLevel0State
    {
        Unallocated = 0,
        FreedPending = 1,
        Allocated = 2,
        Pending = 3
    }
    public struct StfsHashEntryLevel0
    {
        public uint NextBlockNumber;
        public StfsHashEntryLevel0State State;
    }
    public struct StfsHashEntryLevelN
    {
        public uint NumberOfFreeBlocks;
        public uint NumberOfFreePendingBlocks;
        public uint ActiveIndex;
        public uint Writeable;
    }
    public class StfHashEntry
    {
        public byte[] Hash; // 20
        public StfsHashEntryLevel0 Level0;
        public StfsHashEntryLevelN LevelN;

        private uint level;

        public uint LevelAsUINT
        {
            get
            {
                //uint level0 = ((Level0.NextBlockNumber & 0xFFFFFF) | ((Convert.ToUInt32(Level0.State) << 30)));
                //uint levelN = ((LevelN.NumberOfFreeBlocks & 0x7FFF) | ((LevelN.NumberOfFreePendingBlocks & 0x7fff) << 15)
                //|((LevelN.ActiveIndex & 0x01) << 30) | ((LevelN.Writeable & 1) << 31));

                //return level0 | levelN;   
                return level;
            }
            set
            {
                Level0.NextBlockNumber = (value & 0xFFFFFF);
                Level0.State = (StfsHashEntryLevel0State)(value >> 30);

                LevelN.NumberOfFreeBlocks = value & 0x7FFF;
                LevelN.NumberOfFreePendingBlocks = (value >> 15) & 0x7FFF;
                LevelN.ActiveIndex = (value >> 30) & 1;
                LevelN.Writeable = (value >> 31) & 1;

                level = value;
            }
        }

        public bool IsBlockAllocated
        {
            get
            {
                return (Level0.State != StfsHashEntryLevel0State.FreedPending &&
                        Level0.State != StfsHashEntryLevel0State.Unallocated);
            }
        }

        public StfHashEntry()
        {
            Hash = new byte[0x14];
            LevelAsUINT = 0x00ffffff;
        }
        public StfHashEntry(int BlockNum)
        {
            Hash = new byte[0x14];
            LevelAsUINT = (uint)((0x80 << 0x18) | (BlockNum & 0xFFFFFF));
        }
        public StfHashEntry(EndianReader reader)
        {
            Hash = reader.ReadBytes(0x14);
            LevelAsUINT = reader.ReadUInt32();
        }
        public void SetNextBlockNumber(uint NextBlockNumber)
        {
            this.LevelAsUINT = (NextBlockNumber & 0xFFFFFF) | (this.LevelAsUINT & 0xFF000000);
        }
        public void SetNumberOfFreeBlocks(uint NumberOfFreeBlocks)
        {
            this.LevelAsUINT = ((this.LevelAsUINT & 0xFFFF8000) | (NumberOfFreeBlocks & 0x7FFF));
        }
        public void SetNumberOfFreePendingBlocks(uint NumberOfFreePendingBlocks)
        {
            this.LevelAsUINT = (this.LevelAsUINT & 0xC0007FFF) | ((NumberOfFreePendingBlocks & 0x7FFF) << 15);
        }
    }
    public class StfCacheElement
    {
        public byte Referenced;
        public uint BlockNumber;
        public int Index;
        public int BlockCacheIndex;

        // 0x10 - Modified
        // 0x40 - Writable data block
        // 0x80 - In Use

        public byte State;

        public int ElementType
        {
            get
            {
                return this.State & 3;
            }
            set
            {
                this.State = Convert.ToByte(((this.State & ~3) | (value)));
            }
        }
        // 0 - data block, 1 - level0 hash block, 2 - level1 hash block, 3 - level2 hash block

        public StfCacheElement(int BlockCacheIndex)
        {
            this.Index = BlockCacheIndex;
            this.BlockCacheIndex = (BlockCacheIndex + 0xFE) & 0xFF;
        }
    }
    public class StfsCacheElement : IDisposable
    {
        public uint CacheElementCount;
        public List<StfCacheElement> Cache;

        public StfsCacheElement(uint CacheCount)
        {
            this.Cache = new List<StfCacheElement>();

            this.CacheElementCount = CacheCount;
            for (var x = 0; x < CacheCount; x++)
            {
                this.Cache.Add(new StfCacheElement(x + 1));
            }
        }
        public StfCacheElement RetrieveElement(int Index)
        {
            if (Index < this.Cache.Count)
            {
                return this.Cache[Index];
            }
            return null;
        }
        public void Dispose()
        {
            this.Cache.Clear();
        }
    }
    public class StfsHashBlock : IDisposable
    {
        private bool disposed = false;

        public List<StfHashEntry> Entries;
        public uint NumberOfCommittedBlocks;

        private EndianIO IO;

        public StfsHashBlock()
        {
            this.Entries = new List<StfHashEntry>();
            for (var x = 0; x < 0xAA; x++)
            {
                this.Entries.Add(new StfHashEntry());
            }
            this.NumberOfCommittedBlocks = 0;
        }
        public StfsHashBlock(byte[] Data) : this(new EndianIO(Data, EndianType.BigEndian, true))
        {
        }

        public StfsHashBlock(EndianIO IO) : this(IO.In)
        {
            this.IO = IO;
        }
        private StfsHashBlock(EndianReader Reader)
        {
            this.Entries = new List<StfHashEntry>();
            for (var x = 0; x < 0xAA; x++)
            {
                this.Entries.Add(new StfHashEntry(Reader));
            }
            this.NumberOfCommittedBlocks = Reader.ReadUInt32();
        }
        public StfHashEntry RetrieveHashEntry(object BlockNumber)
        {
            int BlockNum = Convert.ToInt32(BlockNumber);
            if (BlockNum < 0x00)
                throw new Exception("Invalid block number detected while retrieving an entry from a hash block.");
            return this.Entries[BlockNum % 0xAA];
        }
        public void SetEntry(object BlockNumber, StfHashEntry HashEntry)
        {
            int BlockNum = Convert.ToInt32(BlockNumber);
            if (BlockNum < 0x00)
                throw new Exception("Invalid block number detected while setting an entry for a hash block.");

            var Entry = this.Entries[BlockNum % 0xAA];
            Array.Copy(Entry.Hash, HashEntry.Hash, 0x14);
            Entry.LevelAsUINT = HashEntry.LevelAsUINT;
        }
        public void SetHashForEntry(uint BlockNumber, byte[] Hash)
        {
            if (Hash.Length != 0x14)
                throw new Exception("Attempted to set hash with invalid length.");
            if (BlockNumber == 0xffffff || BlockNumber == 0xffffff)
                throw new Exception("Invalid block number supplied when replacing a hash.");

            this.Entries[(int)BlockNumber % 0xAA].Hash = Hash;
        }
        public void SetLevelForEntry(uint BlockNumber, uint Level)
        {
            this.Entries[(int)BlockNumber % 0xAA].LevelAsUINT = Level;
        }
        public void Save()
        {
            EndianWriter ew = this.IO.Out;
            ew.BaseStream.Position = 0;
            for (int x = 0; x < 0xaa; x++)
            {
                ew.Write(this.Entries[x].Hash);
                ew.Write(this.Entries[x].LevelAsUINT);
            }

            ew.Write(this.NumberOfCommittedBlocks);
            ew.Write(new byte[12]);
        }

        public void Dispose()
        {
            this.Dispose(true);

            GC.SuppressFinalize(this);
        }
        protected virtual void Dispose(bool disposing)
        {
            if (!this.disposed)
            {
                if (disposing)
                {
                    this.Entries.Clear();
                }

                this.IO.Close();
            }
            this.disposed = true;
        }
        ~StfsHashBlock()
        {
            this.Dispose(false);
        }
    }
    public class StfsCacheBlock : IDisposable
    {
        public List<byte[]> Data;

        public StfsCacheBlock(uint CacheBlockCount)
        {
            this.Data = new List<byte[]>();

            for (var x = 0; x < CacheBlockCount; x++)
            {
                Data.Add(new byte[0x1000]);
            }
        }
        public void Dispose()
        {
            this.Data.Clear();
        }
    }
    public struct StfsCreatePacket
    {
        public string DeviceName;
        public long BackingFileOffset;
        public ulong BackingMaximumVolumeSize;
        public StfsVolumeDescriptor VolumeDescriptor;
        public uint DeviceExtensionSize;
        public byte BlockCacheElementCount;
        public byte TitleOwned;
        public byte BackingFilePresized;
        public byte DeviceCharacteristics;
    }

    public class StfsVolumeExtension
    {
        public uint[] BlockValues = new uint[2]; // @ 0 is the number of backing blocks per Level0 hash tree, @1 is the number of backing blocks per Level1 hash tree
        public readonly uint[] StfsDataBlocksPerHashTreeLevel = new uint[] { 0xAA, 0x70E4, 0x4AF768 };
        public long BackingFileOffset;
        public StfHashEntry RootHashEntry;
        public ulong BackingMaximumVolumeSize;
        public uint VolumeFlags;
        public int RootHashHierarchy;
        public int FormatShift;
        public byte BlockCacheElementCount;
        public byte BackingFilePresized;
        public byte VolumeCharacteristics;
        public uint DataBlockCount; // INT24
        public uint VolumeExtensionSize;

        public bool ReadOnly = false;

        public StfsCacheBlock BlockCache;
        public StfsCacheElement ElementCache;
        public int CacheHeadIndex;
        public bool InAllocationSupport = false;
        public bool CannotExpand = false;
        private bool disposed = false;
        public ushort DirectoryAllocationBlockCount;
        public uint NumberOfFreeBlocks;
        public uint NumberOfFreePendingBlocks;
        public uint NumberOfTotalBlocks;
        public uint NumberOfExtendedBlocks;
        public uint CurrentlyExtendedBlocks;

        public StfsVolumeExtension(StfsCreatePacket CreatePacket)
        {
            this.ReadOnly = Convert.ToBoolean(CreatePacket.VolumeDescriptor.ReadOnlyFormat);

            this.VolumeFlags = (uint)(CreatePacket.VolumeDescriptor.Flags << 29) & 0x40000000;

            BlockValues = ReadOnly == true ?
                new uint[2] { 0xAB, 0x718F } : new uint[2] { 0xAC, 0x723A };

            BackingFileOffset = CreatePacket.BackingFileOffset;
            VolumeExtensionSize = CreatePacket.DeviceExtensionSize;

            uint NumberOfTotalBlocks = CreatePacket.VolumeDescriptor.NumberOfTotalBlocks;

            if (NumberOfTotalBlocks > StfsDataBlocksPerHashTreeLevel[1])
                RootHashHierarchy = 2;
            else if (NumberOfTotalBlocks > StfsDataBlocksPerHashTreeLevel[0])
                RootHashHierarchy = 1;
            else if (NumberOfTotalBlocks < StfsDataBlocksPerHashTreeLevel[0])
                RootHashHierarchy = 0;

            if (!ReadOnly)
            {
                BackingMaximumVolumeSize = CreatePacket.BackingMaximumVolumeSize;
                this.DataBlockCount = StfsDevice.StfsComputeNumberOfDataBlocks((BackingMaximumVolumeSize >> 12) & 0xFFFFFFFFFFFFF);

                if (this.DataBlockCount > 0x4AF768)
                {
                    throw new Exception(string.Format("Detected an invalid amount of data blocks [0x{0:0x} blocks].", DataBlockCount));
                }

                uint num1 = NumberOfTotalBlocks + 0xA9;
                uint num2 = num1 / 0xAA;
                if (num2 > 1)
                    num1 = (num2 + 0xA9) / 0xAA;
                else
                    num1 = 0;
                uint num3 = 0;
                if (num1 > 1)
                    num3 = (num1 + 0xA9) / 0xAA;

                NumberOfExtendedBlocks = (((num1 + num3) + num2) << 1) + NumberOfTotalBlocks;
                CurrentlyExtendedBlocks = 0;
            }

            FormatShift = ReadOnly == true ? 0 : 1;

            BlockCacheElementCount = CreatePacket.BlockCacheElementCount;

            BackingFilePresized = CreatePacket.BackingFilePresized;
            VolumeCharacteristics = CreatePacket.DeviceCharacteristics;

            RootHashEntry = new StfHashEntry();
            RootHashEntry.Hash = CreatePacket.VolumeDescriptor.RootHash;
            RootHashEntry.LevelAsUINT = this.VolumeFlags;
        }
        ~StfsVolumeExtension()
        {
            this.Dispose(false);
        }
        private void Dispose(bool disposing)
        {
            if (disposing)
            {
                if (!disposed)
                {
                    this.BlockCache.Dispose();
                    this.ElementCache.Dispose();
                }
            }
            disposed = true;
        }
        public void Dispose()
        {
            this.Dispose(true);

            GC.SuppressFinalize(this);
        }
    }
    public class StfsVolumeDescriptor
    {
        public byte DescriptorLength;
        public byte Version;
        public byte ReadOnlyFormat;
        public byte RootActiveIndex;
        public byte DirectoryOverallocated;
        public byte DirectoryIndexBoundsValid;
        public ushort DirectoryAllocationBlocks;
        public uint DirectoryFirstBlockNumber;
        public byte[] RootHash; // 20
        public uint NumberOfTotalBlocks;
        public uint NumberOfFreeBlocks;
        public byte Flags;

        public StfsVolumeDescriptor()
        {
            this.DescriptorLength = 0x24;
            this.RootHash = new byte[0x14];
        }
        public StfsVolumeDescriptor(EndianIO IO)
        {
            DescriptorLength = IO.In.ReadByte();
            Version = IO.In.ReadByte();

            Flags = IO.In.ReadByte();
            ReadOnlyFormat = (byte)(Flags & 1);
            RootActiveIndex = (byte)((Flags >> 1) & 1);
            DirectoryOverallocated = (byte)((Flags >> 2) & 1);
            DirectoryIndexBoundsValid = (byte)((Flags >> 3) & 1);

            DirectoryAllocationBlocks = IO.In.ReadUInt16(EndianType.LittleEndian);
            DirectoryFirstBlockNumber = IO.In.ReadUInt24(EndianType.LittleEndian);

            RootHash = IO.In.ReadBytes(20);
            NumberOfTotalBlocks = IO.In.ReadUInt32();
            NumberOfFreeBlocks = IO.In.ReadUInt32();
        }

        public byte[] ToArray()
        {
            MemoryStream MS = new MemoryStream();
            EndianWriter ew = new EndianWriter(MS, EndianType.BigEndian);

            ew.Write(DescriptorLength);
            ew.Write(Version);

            Flags = (byte)((Flags & 0xf0) | ((ReadOnlyFormat & 1) | ((RootActiveIndex & 1) << 1)
                | ((DirectoryOverallocated & 1) << 2) | ((DirectoryIndexBoundsValid & 1) << 3)));

            ew.Write(Flags);
            ew.Write(DirectoryAllocationBlocks, EndianType.LittleEndian);
            ew.WriteUInt24(DirectoryFirstBlockNumber, EndianType.LittleEndian);
            ew.Write(RootHash);
            ew.Write(NumberOfTotalBlocks);
            ew.Write(NumberOfFreeBlocks);

            ew.Close();
            return MS.ToArray();
        }
    }
    public enum StfsControlCode
    {
        StfsLockVolume = 0x0,
        StfsUnlockVolume = 0x1,
        StfsFlushDirtyBuffers = 0x2,
        StfsBuildVolumeDescriptor = 0x3,
        StfsResetWriteState = 0x4,
        StfsReadPersistentStatus = 0x5
    }
}