using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.IO;
using System.Security.Cryptography;

namespace XContent
{
    public class XContentPackage
    {
        public EndianIO IO { get; set; }
        public string PackageFilePath;

        public StfsDevice StfsContentPackage;

        public XContentHeader Header;
        public bool IsLoaded = false;
        public bool IsHeaderSigned = false;

        public void CreatePackage(string Filename, XContentMetadata MetaData)
        {
            this.IO = new EndianIO(Filename, EndianType.BigEndian);
            this.IO.Open();

            this.IO.Stream.SetLength(0xA000);
            this.Header.SignatureType = XContentSignatureType.LIVE_SIGNED;

            this.Header.LicenseDescriptors = new XContentLicense[0x10];

            this.Header.LicenseDescriptors[0].LicenseId.AsULONG = 0xffffffffffffffff;
            this.Header.LicenseDescriptors[0].LicenseBits = 0;
            this.Header.LicenseDescriptors[0].LicenseFlags = 0;

            this.Header.ContentId = new byte[0x14];
            this.Header.SizeOfHeaders = 0x0000971A;

            this.Header.Metadata = MetaData;
            this.Header.Metadata.StfsVolumeDescriptor = new StfsVolumeDescriptor();

            this.IO.Out.Write(this.Header.ToArray());

            StfsCreatePacket CreatePacket = new StfsCreatePacket();

            CreatePacket.BackingFileOffset = 0xA000;
            CreatePacket.BackingMaximumVolumeSize = 0x0000000100000000;
            CreatePacket.DeviceExtensionSize = 0xA19A;
            CreatePacket.BlockCacheElementCount = 0x10;
            CreatePacket.VolumeDescriptor = this.Header.Metadata.StfsVolumeDescriptor;

            CreatePacket.DeviceCharacteristics = 0x01;

            this.StfsContentPackage = new StfsDevice(this.IO);

            this.StfsContentPackage.StfsCreateDevice(CreatePacket);

            this.Flush();

            this.Save();
        }
        public void RebuildPackage(XContentPackage OldPackage, string NewFileName)
        {
            this.CreatePackage(NewFileName, OldPackage.Header.Metadata);

            StfsDevice stfsDevice = OldPackage.StfsContentPackage;
            for (var x = 0; x < stfsDevice.DirectoryEntries.Count; x++)
            {
                StfsDirectoryEntry dirEnt = stfsDevice.DirectoryEntries[x];
                if (!dirEnt.IsDirectory && dirEnt.IsEntryBound)
                {
                    StringBuilder FileName = new StringBuilder();
                    do
                    {
                        FileName.Insert(0, "\\" + dirEnt.FileName);
                        if (dirEnt.DirectoryIndex != 0xffff)
                        {
                            dirEnt = stfsDevice.DirectoryEntries[dirEnt.DirectoryIndex];
                        }
                        else
                        {
                            break;
                        }
                    } while (true);

                    string Filename = FileName.Remove(0, 1).ToString();

                    this.StfsContentPackage.CreateFileFromArray(Filename, stfsDevice.ExtractFileToArray(Filename));

                    this.Flush();
                }
            }

            this.Flush();
            this.Save();
        }

        public bool LoadPackage(string Filename) { return LoadPackage(Filename, true); }
        public bool LoadPackage(string Filename, bool ShowErrors)
        {
            try
            {
                this.PackageFilePath = Filename;
                return Init(new EndianIO(new FileStream(Filename, FileMode.Open, FileAccess.ReadWrite, FileShare.ReadWrite), EndianType.BigEndian), ShowErrors);
            }
            catch (Exception e)
            {
                CloseIO(true);
                Console.WriteLine("Error loading package: " + e.Message);
                return false;
            }
        }

        public bool LoadPackage(EndianIO IO) { return LoadPackage(IO, true); }
        public bool LoadPackage(EndianIO IO, bool ShowErrors)
        {
            return Init(IO, ShowErrors);
        }

        public bool CloseIO(bool close)
        {
            try
            {
                if (this.IO != null)
                {
                    if (this.IO.Opened && close)
                    {
                        this.IO.Close();
                        IsLoaded = false;
                    }
                    else if (!this.IO.Opened && !close)
                        this.IO.Open();
                }
            }
            catch { }
            return close;
        }

        private bool Init(EndianIO IO, bool ShowErrors)
        {
            try
            {
                this.IO = IO;
                if (!this.IO.Opened)
                    this.IO.Open();

                this.IO.In.SeekTo(0);

                this.Header.SignatureType = (XContentSignatureType)this.IO.In.ReadInt32();

                if (this.Header.SignatureType != XContentSignatureType.CONSOLE_SIGNED &&
                    this.Header.SignatureType != XContentSignatureType.PIRS_SIGNED &&
                    this.Header.SignatureType != XContentSignatureType.LIVE_SIGNED)
                {
                    throw new Exception("Invalid signature type detected for the loaded package. Halting reading." +
                    "Please make sure the file is a valid Xbox 360 XContent Package ('LIVE', 'PIRS', 'CON ')");
                }

                this.Header.Signature = new XContentSignatureHeader(this.IO, this.Header.SignatureType);

                this.Header.LicenseDescriptors = new XContentLicense[0x10];
                for (int x = 0; x < 0x10; x++)
                {
                    this.Header.LicenseDescriptors[x].LicenseId.AsULONG = this.IO.In.ReadUInt64();
                    this.Header.LicenseDescriptors[x].LicenseId.Bits.Type = (this.Header.LicenseDescriptors[x].LicenseId.AsULONG >> 48) & 0xffff;
                    this.Header.LicenseDescriptors[x].LicenseId.Bits.Data = ((this.Header.LicenseDescriptors[x].LicenseId.AsULONG) & 0xFFFFFFFFFFFF);
                    this.Header.LicenseDescriptors[x].LicenseBits = this.IO.In.ReadUInt32();
                    this.Header.LicenseDescriptors[x].LicenseFlags = this.IO.In.ReadUInt32();
                }
                this.Header.ContentId = this.IO.In.ReadBytes(0x14); // also the highest level hash
                this.Header.SizeOfHeaders = this.IO.In.ReadInt32();

                this.Header.Metadata = new XContentMetadata(this.IO);

                this.IO.In.SeekTo(0x22C);

                if (this.Header.SignatureType == XContentSignatureType.CONSOLE_SIGNED)
                {
                    this.IsHeaderSigned = this.Header.Signature.ConsoleSignature.Verify(this.IO.In.ReadBytes(0x118));
                }

                this.LoadPackage();

                return true;
            }
            catch (Exception e)
            {
                IO.Close();
                if (ShowErrors)
                    Console.WriteLine("Error loading package: " + e.Message);
            }
            return false;
        }

        internal void ReloadPackage()
        {
            if (IO != null)
                LoadPackage();
        }

        private void LoadPackage()
        {
            if (this.Header.Metadata.VolumeType == XContentVolumeType.STFS_Volume)
            {
                this.StfsContentPackage = new StfsDevice(this.IO);

                this.CreateDevice();

                this.StfsContentPackage.Read();

            }
            else
            {
                throw new NotImplementedException("Only STFS volumes are currently supported.");
            }
            this.IsLoaded = true;
        }
        public void CreateDevice()
        {
            if (this.Header.Metadata.VolumeType == XContentVolumeType.STFS_Volume)
            {
                var CreatePacket = new StfsCreatePacket();

                CreatePacket.BackingMaximumVolumeSize = ((this.Header.Metadata.ContentSize + 0x100000) - 1) & 0xFFFFFFFFFFF00000;
                if (CreatePacket.BackingMaximumVolumeSize == 0)
                {
                    CreatePacket.BackingMaximumVolumeSize = 0x0000000100000000;
                }
                CreatePacket.BackingFileOffset = (this.Header.SizeOfHeaders + 0xFFF) & 0xFFFFF000;
                CreatePacket.BackingFilePresized = (byte)((this.Header.Metadata.ContentSize) == 0 ? 0 : 1);
                CreatePacket.DeviceExtensionSize = (uint)CreatePacket.BackingFileOffset + 0x19A;
                CreatePacket.VolumeDescriptor = this.Header.Metadata.StfsVolumeDescriptor;
                CreatePacket.BlockCacheElementCount = 0x10;

                if (this.Header.Signature.Signed)
                {
                    switch (this.Header.SignatureType)
                    {
                        // Mostly unknowns that I need to figure out
                        case XContentSignatureType.LIVE_SIGNED:
                            CreatePacket.DeviceCharacteristics = 3;
                            break;
                        case XContentSignatureType.PIRS_SIGNED:
                            CreatePacket.DeviceCharacteristics = 4;
                            break;
                        case XContentSignatureType.CONSOLE_SIGNED:
                            // Assuming no relation (is 2 if Cert belongs to the console accessing the package) 
                            // most likely used for installed packages 
                            CreatePacket.DeviceCharacteristics = 1;
                            break;
                    }
                }

                this.StfsContentPackage.StfsCreateDevice(CreatePacket);
            }
            else if (this.Header.Metadata.VolumeType == XContentVolumeType.SVOD_Volume)
            {
#if INT2
                var CreatePacket = new SvodCreatePacket();

                CreatePacket.Descriptor = this.Header.Metadata.SvodDeviceDescriptor;
                CreatePacket.FSCache = new byte[(CreatePacket.Descriptor.BlockCacheElementCount << 0xC) & 0x000FF000];
                CreatePacket.DataFileDirectory = this.PackageFilePath + ".data\\";

                // if the directory we assumed does not exist, allow the user to select the correct directory
                if (!Directory.Exists(CreatePacket.DataFileDirectory))
                {
                    var ofd = new System.Windows.Forms.FolderBrowserDialog();
                    ofd.Description = "Open the data file directory...";
                    if (ofd.ShowDialog() == System.Windows.Forms.DialogResult.OK)
                    {
                        CreatePacket.DataFileDirectory = ofd.SelectedPath;
                    }
                }

                this.SvodContentPackage.SvodCreateDevice(CreatePacket);

                var odfxDevice = new ODFX.OdfxDevice(this.SvodContentPackage, ODFX.OdfxType.SVOD);
                odfxDevice.OdfxMountVolume();
#endif
            }
        }
        public void Flush()
        {
            this.StfsContentPackage.StfsControlDevice(StfsControlCode.StfsFlushDirtyBuffers, null);
            this.StfsContentPackage.StfsControlDevice(StfsControlCode.StfsBuildVolumeDescriptor, this.Header.Metadata.StfsVolumeDescriptor);
            this.StfsContentPackage.StfsControlDevice(StfsControlCode.StfsResetWriteState, null);
        }
        public void Save()
        {
            this.Save(true);
        }
        public void Save(bool Sign) // save all data, fill header, and sign - Call this function to resign header
        {
            if (this.Header.Metadata.VolumeType == XContentVolumeType.STFS_Volume)
            {
                this.SetContentSize();
                this.SaveContentHeader();
                if (Sign && this.Header.SignatureType == XContentSignatureType.CONSOLE_SIGNED)
                {
                    this.ConsolePrivateKeySign();
                }
                this.IO.Stream.Flush();
            }
        }
        private void SetContentSize()
        {
            if (this.Header.Metadata.ContentSize != 0)
            {
                this.Header.Metadata.ContentSize = (this.StfsContentPackage.VolumeExtension.NumberOfExtendedBlocks * 0x1000);
            }
        }
        private void SaveContentHeader() // only write the values prone to changing without ruining the package
        {
            this.IO.Out.SeekTo(0);
            this.IO.Out.Write(this.Header.ToArray());

            this.IO.In.SeekTo(0x344);
            byte[] Hash = HorizonCrypt.SHA1(this.IO.In.ReadBytes(this.StfsContentPackage.VolumeExtension.BackingFileOffset - 0x344));

            this.IO.Out.SeekTo(0x32c);
            this.IO.Out.Write(Hash);
        }
        public void ConsolePrivateKeySign()
        {
            throw new NotImplementedException("Console private key signing is not implemented yet.");
        }
    }
}
