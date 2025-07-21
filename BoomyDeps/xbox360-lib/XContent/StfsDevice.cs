using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.IO;
using System.Security.Cryptography;
using WinFile;

namespace XContent
{
    public class StfsDevice : IDisposable
    {
        private static uint Block = 0x1000; // STFS block length

        public EndianIO IO { get; set; }

        public bool Debug = false;
        private bool disposed = false;
        public StfsVolumeExtension VolumeExtension { get; set; }
        public List<StfsDirectoryEntry> DirectoryEntries { get; set; }

        public StfsFcb DirectoryFcb;
        private List<StfsFcb> Fcbs;

        private StfsVolumeDescriptor StfsVolumeDescriptor;

        public StfsDevice(EndianIO IO)
        {
            this.IO = IO;
#if INT2
            this.Debug = true;
#endif
        }
        ~StfsDevice()
        {
            Dispose(false);
        }
        private void Dispose(bool disposing)
        {
            if (disposing)
            {
                if (!disposed)
                {
                    this.DirectoryEntries.Clear();
                    this.Fcbs.Clear();
                    this.VolumeExtension.Dispose();
                }
                this.IO.Close();
            }
            disposed = true;
        }
        public void Dispose()
        {
            this.Dispose(true);

            GC.SuppressFinalize(this);
        }

        public void StfsCreateDevice(StfsCreatePacket CreatePacket)
        {
            this.VolumeExtension = new StfsVolumeExtension(CreatePacket);

            this.StfsVolumeDescriptor = CreatePacket.VolumeDescriptor;

            this.DirectoryFcb = new StfsFcb();
            this.DirectoryFcb.FirstBlockNumber = this.StfsVolumeDescriptor.DirectoryFirstBlockNumber;
            this.DirectoryFcb.Filesize = 0xfffe;
            this.DirectoryFcb.BlockPosition = 0xfffffff;
            this.DirectoryFcb.ContiguousBytesRead = 0x0000;
            this.DirectoryFcb.LastUnContiguousBlockNum = this.StfsVolumeDescriptor.DirectoryFirstBlockNumber;
            this.DirectoryFcb.AllocationBlocks = (uint)this.StfsVolumeDescriptor.DirectoryAllocationBlocks * 0x1000;
            this.DirectoryFcb.ValidAllocBlocks = this.DirectoryFcb.AllocationBlocks;
            this.DirectoryFcb.LastBlockNumber = 0xffffffff;
            this.DirectoryFcb.DirectoryEntryIndex = 0xffff;
            this.DirectoryFcb.State = 6;

            this.VolumeExtension.DirectoryAllocationBlockCount = this.StfsVolumeDescriptor.DirectoryAllocationBlocks;
            this.VolumeExtension.NumberOfFreeBlocks = this.StfsVolumeDescriptor.NumberOfFreeBlocks;
            this.VolumeExtension.NumberOfTotalBlocks = this.StfsVolumeDescriptor.NumberOfTotalBlocks;

            this.Fcbs = new List<StfsFcb>();

            // Create new directory listing
            this.DirectoryEntries = new List<StfsDirectoryEntry>();

            this.StfsResetBlockCache();
        }
        public void Read()
        {
            this.StfsParseDirectoryListing();
        }

        public void Rehash()
        {
            if (this.VolumeExtension.NumberOfTotalBlocks > 0)
            {
                this.StfsFlushBlockCache(0, 0xffffffff);

                uint CurrentBlockIndex = 0x00;

                do
                {
                    int hashBlockCacheIndex = -1;

                    StfsHashBlock hashBlock = this.StfsMapWriteableHashBlock(CurrentBlockIndex, 0, false, ref hashBlockCacheIndex);

                    for (uint x = 0; x < 0xAA; x++)
                    {
                        if (hashBlock.RetrieveHashEntry(x).Level0.State != StfsHashEntryLevel0State.Unallocated)
                        {
                            hashBlock.SetHashForEntry(x, HorizonCrypt.XeCryptSha(this.StfsSynchronousReadFile(this.StfsComputeBackingDataBlockNumber(x + CurrentBlockIndex), 0x1000, 0), null, null));
                        }
                    }

                    hashBlock.Save();

                    this.StfsDereferenceBlock(hashBlockCacheIndex);

                    this.StfsFlushBlockCache(0, 0xffffffff);
                }
                while ((CurrentBlockIndex += 0xAA) < this.VolumeExtension.NumberOfTotalBlocks);
            }
        }

        public byte[] ExtractFileToArray(string Filename)
        {
            return this.GetFileStream(Filename).ToArray();
        }
        public byte[] ExtractFileToArray(int DirIndex)
        {
            return new StfsFileStream(this, DirIndex).ToArray();
        }
        public void InjectFileFromArray(string Filename, byte[] Data)
        {
            InjectFileFromArray(Filename, Data, false);
        }
        public void InjectFileFromArray(string Filename, byte[] Data, bool Contains)
        {
            var StfsFileStream = new StfsFileStream(this, Filename, FileMode.Open, Contains);

            this.StfsOverwriteExistingFile(StfsFileStream.Fcb, 0);

            var ew = new EndianWriter(StfsFileStream, EndianType.BigEndian);

            ew.Write(Data);

            ew.Close();
        }
        public void CreateFileFromArray(string Filename, byte[] Data)
        {
            EndianWriter ew = new EndianWriter(new StfsFileStream(this, Filename, FileMode.CreateNew), EndianType.BigEndian);

            ew.Write(Data);

            ew.Close();
        }

        public void DeleteFile(string Filename)
        {
            StfsFileStream fs = new StfsFileStream(this, Filename, FileMode.Open);

            var fdi = new WinFile.FileDispositionInformation();

            fdi.DeleteFile = true;

            fs.SetInformation(WinFile.FileInformationClass.FileDispositionInformation, fdi);

            fs.Close();
        }
        public void RenameFile(string ExistingFileName, string NewFileName)
        {
            StfsFileStream fs = new StfsFileStream(this, ExistingFileName, FileMode.Open);

            var RenameInfo = new WinFile.FileRenameInformation();

            RenameInfo.FileName = NewFileName;
            RenameInfo.FileNameLength = (ushort)NewFileName.Length;

            fs.SetInformation(WinFile.FileInformationClass.FileRenameInformation, RenameInfo);

            fs.Close();
        }
        public bool FileExists(string Filename)
        {
            if (string.IsNullOrEmpty(Filename))
                return false;

            var Name = BreakStringByPath(Filename);
            StfsFcb parentFcb = this.DirectoryFcb, fcb = null;
            var directoryEntry = new StfsDirectoryEntry();

            this.StfsReferenceFcb(parentFcb);

            if (Filename.Contains("*"))
            {
                for (int x = 0; x < Name.Length; x++)
                {
                    string name;
                    if (Name[x][0x00] != '*')
                    {
                        name = (x == (Name.Length - 1)) ? Name[x].Split("*")[0] : Name[x];
                    }
                    else
                    {
                        name = (x == (Name.Length - 1)) ? Name[x].Split("*")[1] : Name[x];
                    }

                    uint dwReturn = this.StfsFindNextDirectoryEntry(parentFcb, 0x00, name, ref directoryEntry);

                    if (dwReturn != 0 || ((x == (Name.Length - 1)) && directoryEntry.IsDirectory))
                    {
                        this.StfsDereferenceFcb(parentFcb);
                        return false;
                    }

                    fcb = this.StfsCreateFcb(directoryEntry, parentFcb);

                    this.StfsReferenceFcb(fcb);

                    parentFcb = (x != (Name.Length - 1)) ? fcb : parentFcb;

                }
            }
            else
            {
                for (int x = 0; x < Name.Length; x++)
                {
                    if (StfsDevice.StfsIsValidFileName(Name[x]))
                    {
                        uint dwReturn = this.StfsLookupElementNameInDirectory(Name[x], parentFcb, ref directoryEntry);

                        if (dwReturn != 0 || ((x == (Name.Length - 1)) && directoryEntry.IsDirectory))
                        {
                            this.StfsDereferenceFcb(parentFcb);
                            return false;
                        }

                        fcb = this.StfsCreateFcb(directoryEntry, parentFcb);

                        this.StfsReferenceFcb(fcb);

                        parentFcb = (x != (Name.Length - 1)) ? fcb : parentFcb;
                    }
                    else
                    {
                        throw new Exception(string.Format("Invalid filename detected while opening {0}. [0xC0000033].", Filename));
                    }
                }
            }
            if (fcb != null)
            {
                this.StfsDereferenceFcb(fcb);
            }
            else
            {
                return false;
            }
            return true;
        }

        public EndianIO GetEndianIO(string Filename)
        {
            return GetEndianIO(Filename, false);
        }
        public EndianIO GetEndianIO(string Filename, bool OpenIO)
        {
            return new EndianIO(GetFileStream(Filename), EndianType.BigEndian, OpenIO);
        }
        public EndianIO GetEndianIO(int DirectoryEntryIndex)
        {
            return new EndianIO(new StfsFileStream(this, DirectoryEntryIndex), EndianType.BigEndian);
        }
        public EndianIO GetEndianIO(string Filename, bool IfContains, bool OpenIO)
        {
            return new EndianIO(new StfsFileStream(this, Filename, FileMode.Open, IfContains), EndianType.BigEndian, OpenIO);
        }
        public StfsFileStream GetFileStream(string Filename)
        {
            return new StfsFileStream(this, Filename, FileMode.Open);
        }

        public int GetDirectoryEntryIndex(string Filename)
        {
            return this.DirectoryEntries.FindIndex(delegate (StfsDirectoryEntry entry)
            {
                return entry.FileName == Filename;
            });
        }
        public int GetDirectoryEntryIndex(string Filename, ushort DirIndex)
        {
            return this.DirectoryEntries.FindIndex(delegate (StfsDirectoryEntry entry)
            {
                return (entry.FileName == Filename) && (entry.DirectoryIndex == DirIndex);
            });
        }

        /// <summary>
        /// Reads all exisiting directory entries from the directory into a listed structure.
        /// </summary>
        public void StfsParseDirectoryListing()
        {
            uint ByteOffset = 0, ReturnedFileRunLength = 0, dirByteOffset = 0;
            int BlockCacheIndex = 0;

            // Loop through the count of directory blocks
            for (var x = 0; x < this.DirectoryFcb.AllocationBlocks / 0x1000; x++)
            {
                // Open the read block in an Endian Reader
                var reader = new EndianReader(new MemoryStream(this.StfsMapReadableDataBlock(this.StfsByteOffsetToBlockNumber(this.DirectoryFcb, ByteOffset, ref ReturnedFileRunLength), ref BlockCacheIndex), false), EndianType.BigEndian);

                for (int i = 0; i < 0x40; i++) // one block can only hold 64 entries
                {
                    // parse the binary data and create a new directory structure 
                    var stfsDirEnt = new StfsDirectoryEntry(reader);

                    // if an empty directory is detected, exit out of the loop
                    if (stfsDirEnt.FileName == string.Empty)
                    {
                        break;
                    }

                    // Specify the offset of the directory entry in the listing
                    stfsDirEnt.DirectoryEntryByteOffset = dirByteOffset;
                    // add the newly-parsed and valid directory structure to the listing
                    this.DirectoryEntries.Add(stfsDirEnt);
                    // advance the offset for the next directory entry 
                    dirByteOffset += 0x40;
                }

                reader.Close();
                // dereference the data block
                this.StfsDereferenceBlock(BlockCacheIndex);
                //advance the byte offset to the next block
                ByteOffset += 0x1000;
            }
        }

        /// <summary>
        /// Calculate the position of the requested block inside the STFS file.
        /// </summary>
        /// <param name="BlockNum">The requested, 0-based index block number.</param>
        /// <param name="ActiveIndex">For hash blocks only. Specifies currently active index. Set to 0 for data blocks.</param>
        /// <returns>The position of the requested block inside the STFS file. </returns>
        public static long GetBlockOffset(uint BlockNum, int ActiveIndex)
        {
            return (BlockNum + ActiveIndex) << 12;
        }

        /*
         *  [New] STFS System functions
         */

        public void StfsControlDevice(StfsControlCode ControlCode, object ControlBuffer)
        {
            switch (ControlCode)
            {
                case StfsControlCode.StfsBuildVolumeDescriptor:

                    StfsVolumeDescriptor VolumeDescriptor = (StfsVolumeDescriptor)ControlBuffer;
                    this.StfsBuildVolumeDescriptor(ref VolumeDescriptor);

                    break;
                case StfsControlCode.StfsFlushDirtyBuffers:

                    if ((this.VolumeExtension.RootHashEntry.LevelAsUINT & 0x80000000) != 0)
                    {
                        if (!this.VolumeExtension.CannotExpand)
                        {
                            this.StfsExtendBackingFileSize(this.VolumeExtension.NumberOfExtendedBlocks);
                        }

                        this.StfsFlushUpdateDirectoryEntries();
                        this.StfsFlushBlockCache(0, 0xffffffff);
                    }
                    break;
                case StfsControlCode.StfsResetWriteState:

                    this.VolumeExtension.RootHashEntry.LevelAsUINT &= 0x7FFFFFFF;
                    this.VolumeExtension.NumberOfFreeBlocks += this.VolumeExtension.NumberOfFreePendingBlocks;
                    this.VolumeExtension.NumberOfFreePendingBlocks = 0;
                    this.VolumeExtension.DirectoryAllocationBlockCount = (ushort)(this.DirectoryFcb.AllocationBlocks / 0x1000);

                    this.DirectoryFcb.State &= 0xDF;

                    this.StfsResetWriteableBlockCache();

                    break;
                default:

                    break;
            }
        }

        private void StfsBuildVolumeDescriptor(ref StfsVolumeDescriptor VolumeDescriptor)
        {
            VolumeDescriptor.DescriptorLength = 0x24;

            VolumeExtension.ReadOnly = false;

            VolumeDescriptor.RootActiveIndex = (byte)(((this.VolumeExtension.RootHashEntry.LevelAsUINT >> 30) & 1));

            VolumeDescriptor.DirectoryFirstBlockNumber = this.DirectoryFcb.FirstBlockNumber;
            VolumeDescriptor.DirectoryAllocationBlocks = (ushort)(this.DirectoryFcb.AllocationBlocks / 0x1000);

            VolumeDescriptor.RootHash = this.VolumeExtension.RootHashEntry.Hash;

            VolumeDescriptor.NumberOfTotalBlocks = this.VolumeExtension.NumberOfTotalBlocks;
            VolumeDescriptor.NumberOfFreeBlocks = this.VolumeExtension.NumberOfFreePendingBlocks + this.VolumeExtension.NumberOfFreeBlocks;
        }

        public StfsFcb StfsCreateNewFile(StfsFcb DirectoryFcb, string ElementName, int CreateOptions, uint AllocationSize, ref StfsDirectoryEntry DirectoryLookup)
        {
            if (this.VolumeExtension.ReadOnly)
            {
                throw new Exception("Attempted to create a new file on a read-only device [0xC000009A].");
            }

            uint ByteOffset = DirectoryLookup.DirectoryEndOfListing;
            if (ByteOffset == 0xffffffff)
            {
                ByteOffset = this.DirectoryFcb.ValidAllocBlocks;
                if ((ByteOffset & 0xFFF) != 0)
                {
                    throw new Exception(string.Format("Detected an invalid amount of allocation blocks for the directory while creating {0}.", ElementName));
                }
                this.StfsSetAllocationSize(this.DirectoryFcb, this.DirectoryFcb.ValidAllocBlocks + 0x1000, false);
            }
            else if (ByteOffset > 0x3FFF80)
            {
                throw new Exception("cannot make new directory entry [0xC00002EA].");
            }

            DirectoryLookup.DirectoryEntryByteOffset = ByteOffset;

            DirectoryLookup.FileName = ElementName;
            DirectoryLookup.FileNameLength = (byte)ElementName.Length;

            DirectoryLookup.IsDirectory = Convert.ToBoolean(CreateOptions);
            DirectoryLookup.CreationTimeStamp = StfsDateTimeToTimeStamp(DateTime.Now);
            DirectoryLookup.LastWriteTimeStamp = DirectoryLookup.CreationTimeStamp;

            StfsFcb fcb = this.StfsCreateFcb(DirectoryLookup, DirectoryFcb);

            if (!fcb.IsDirectory)
            {
                this.StfsSetAllocationSize(fcb, 0x00, false);
            }

            this.StfsUpdateDirectoryEntry(fcb, false);

            return fcb;
        }

        public void StfsOverwriteExistingFile(StfsFcb FileFcb, uint AllocationSize)
        {
            FileFcb.CreationTimeStamp = StfsDateTimeToTimeStamp(DateTime.Now);
            FileFcb.LastWriteTimeStamp = FileFcb.CreationTimeStamp;

            this.StfsSetAllocationSize(FileFcb, AllocationSize, false);

            this.StfsUpdateDirectoryEntry(FileFcb, false);
        }

        public StfsFcb StfsCreateFcb(StfsDirectoryEntry dirEnt, StfsFcb ParentFcb)
        {
            StfsFcb fcb = Fcbs.Find(delegate (StfsFcb FCB)
            {
                return FCB.FileName == dirEnt.FileName && dirEnt.FileBounds.Filesize == FCB.Filesize && dirEnt.DirectoryIndex == FCB.ParentDirectoryIndex;
            });
            if (fcb != null)
            {
                return fcb;
            }
            else
            {
                fcb = new StfsFcb(dirEnt, ParentFcb);
                this.Fcbs.Add(fcb);
                return fcb;
            }
        }

        public StfsFcb StfsCreateCloneFcb(StfsFcb Fcb)
        {
            return null;
        }

        public void StfsFindOpenChildFcb()
        {

        }

        public void StfsReferenceFcb(StfsFcb Fcb)
        {
            Fcb.Referenced++;
        }

        public void StfsDereferenceFcb(StfsFcb Fcb)
        {
            if (Fcb.Referenced <= 0)
            {
                throw new Exception("Attempted to de-reference an FCB with zero references.");
            }

            StfsFcb parentFcb = null;

            do
            {
                Fcb.Referenced--;

                if (Fcb.Referenced == 0)
                {
                    if (Fcb.ParentFcb != null)
                    {

                    }

                    if (Fcb.CloneFcb != null)
                    {
                        Fcb.CloneFcb = null;
                    }

                    parentFcb = Fcb.ParentFcb;

                    this.Fcbs.Remove(Fcb);

                    Fcb = parentFcb;
                }
                else
                {
                    break;
                }

            } while (Fcb != null);
        }

        private void StfsOpenTargetDirectory(StfsFcb DirectoryFcb)
        {

        }

        public static bool StfsIsValidFileName(string FileName)
        {
            if (FileName.Length == 0 || FileName.Length > 40)
                return false;

            for (int x = 0; x < 2; x++)
            {
                if (FileName.Length == (x + 1) && FileName[x] == '.')
                    return false;
            }

            uint[] invalidTable = new uint[4] { 0xFFFFFFFF, 0xFC009C04, 0x10000000, 0x10000000 };

            for (int x = 0; x < FileName.Length; x++)
            {
                char fchar = FileName[x];
                if (((1 << (fchar & 0x1f)) & invalidTable[((fchar >> 3) & 0x1FFFFFFC) / 4]) != 0)
                    return false;
            }

            return true;
        }

        // INCOMPLETE but basically functional
        public void StfsSetRenameInformation(StfsFcb Fcb, WinFile.FileRenameInformation RenameInformation)
        {
            if (RenameInformation.FileNameLength != 0)
            {
                if (StfsIsValidFileName(RenameInformation.FileName))
                {


                    Fcb.FileName = RenameInformation.FileName;

                    this.StfsUpdateDirectoryEntry(Fcb, false);
                }
            }
        }
        public uint StfsLookupElementNameInDirectory(string Name, StfsFcb DirectoryFcb, ref StfsDirectoryEntry DirectoryLookup)
        {
            return StfsLookupElementNameInDirectory(Name, DirectoryFcb, ref DirectoryLookup, false);
        }
        /// <summary>
        /// Looks up a directory entry in the directory listing.
        /// </summary>
        /// <param name="Name">The name of the entry to search for.</param>
        /// <param name="DirectoryFcb">The FCB of root/folder of the entry being searched for.</param>
        /// <param name="DirectoryLookup">The directory structure to be filled with information about the entry.</param>
        /// <returns>Error code for determining wether the file was found or not.</returns>
        public uint StfsLookupElementNameInDirectory(string Name, StfsFcb DirectoryFcb, ref StfsDirectoryEntry DirectoryLookup, bool IfContains)
        {
            uint DirAllocBlocks = 0, ReturnedFileRunLength = 0, ByteOffset = 0,
                DirBlockPosition = 0, DirBlockEndPosition = 0, EndOfListing = 0xffffffff, dwReturn = 0;

            int BlockCacheIndex = -1;

            EndianReader reader = null;
            StfsDirectoryEntry dirEnt = null;

            if (Convert.ToBoolean(this.StfsVolumeDescriptor.DirectoryIndexBoundsValid))
            {
                if (!this.VolumeExtension.ReadOnly)
                {
                    DirAllocBlocks = ((DirectoryFcb.Filesize & 0xffff) + 1) * 0x40;
                    ByteOffset = ((DirectoryFcb.Filesize & 0xffff0000) * 0x40);
                }
                else
                {
                    throw new Exception("Function is not available for this package type. [ Read-only format].");
                }
            }
            else
            {
                DirAllocBlocks = this.DirectoryFcb.AllocationBlocks;
                DirBlockPosition = 0;
            }

            do
            {
                if (DirBlockPosition == DirBlockEndPosition)
                {
                    if (BlockCacheIndex != -1)
                    {
                        this.StfsDereferenceBlock(BlockCacheIndex);
                        BlockCacheIndex = -1;
                    }

                    if (ByteOffset < DirAllocBlocks)
                    {
                        byte[] dirBlock = this.StfsMapReadableDataBlock(this.StfsByteOffsetToBlockNumber(this.DirectoryFcb, ByteOffset, ref ReturnedFileRunLength), ref BlockCacheIndex);

                        DirBlockEndPosition += 0x1000;

                        reader = new EndianReader(new MemoryStream(dirBlock, false), EndianType.BigEndian);
                        reader.BaseStream.Position = (ByteOffset & 0xFFF);
                    }
                    else
                    {
                        dwReturn = 0xC0000034;
                        break;
                    }
                }

                dirEnt = new StfsDirectoryEntry(reader);

                if (dirEnt.FileNameLength == 0)
                {
                    if (EndOfListing == 0xffffffff)
                    {
                        EndOfListing = ByteOffset;
                    }
                }
                else
                {
                    if (dirEnt.DirectoryIndex == DirectoryFcb.DirectoryEntryIndex)
                    {
                        if (!IfContains ? dirEnt.FileName == Name : dirEnt.FileName.ToLower() == Name.ToLower())
                        {
                            if (ByteOffset > 0x3FFF80)
                            {
                                throw new Exception(string.Format("The current directory's [ {0} ] index is out of range.", dirEnt.FileName));
                            }

                            dirEnt.DirectoryEntryByteOffset = ByteOffset;

                            DirectoryLookup = dirEnt;

                            break;
                        }
                    }
                }

                DirBlockPosition += 0x40;
                ByteOffset += 0x40;

            } while (true);

            if (BlockCacheIndex != -1)
            {
                this.StfsDereferenceBlock(BlockCacheIndex);
            }

            if (reader != null)
            {
                reader.Close();
            }

            DirectoryLookup.DirectoryEndOfListing = EndOfListing;

            return dwReturn;
        }

        public string StfsFindNextDirectoryName(StfsFcb Fcb, uint SearchOffset)
        {
            if (!Fcb.IsDirectory)
            {
                throw new Exception("attempted to determine if a non-directory was empty.");
            }

            var dirEnt = new StfsDirectoryEntry();

            uint dwReturn = this.StfsFindNextDirectoryEntry(Fcb, SearchOffset, null, ref dirEnt);

            if (dwReturn != 0x00)
            {
                throw new Exception(string.Format("failed to find a directory entry in the folder '{0}'", Fcb.FileName));
            }

            return dirEnt.FileName;
        }

        public uint StfsFindNextDirectoryEntry(StfsFcb DirectoryFcb, uint SearchStartOffset, string Name, ref StfsDirectoryEntry DirectoryLookup)
        {
            uint DirAllocBlocks = 0, ReturnedFileRunLength = 0, ByteOffset = SearchStartOffset,
                DirBlockPosition = 0, DirBlockEndPosition = 0, EndOfListing = 0xffffffff, dwReturn = 0;

            int BlockCacheIndex = -1;

            EndianReader reader = null;
            StfsDirectoryEntry dirEnt = null;

            if (Convert.ToBoolean(this.StfsVolumeDescriptor.DirectoryIndexBoundsValid))
            {
                if (!this.VolumeExtension.ReadOnly)
                {
                    DirAllocBlocks = ((DirectoryFcb.Filesize & 0xffff) + 1) * 0x40;
                    ByteOffset = ((DirectoryFcb.Filesize & 0xffff0000) * 0x40);
                }
                else
                {
                    throw new Exception("Function is not available for this package type. [ Read-only format].");
                }
            }
            else
            {
                DirAllocBlocks = this.DirectoryFcb.AllocationBlocks;
                DirBlockPosition = 0;
            }

            do
            {
                if (DirBlockPosition == DirBlockEndPosition)
                {
                    if (BlockCacheIndex != -1)
                    {
                        this.StfsDereferenceBlock(BlockCacheIndex);
                        BlockCacheIndex = -1;
                    }

                    if (ByteOffset < DirAllocBlocks)
                    {
                        byte[] dirBlock = this.StfsMapReadableDataBlock(this.StfsByteOffsetToBlockNumber(this.DirectoryFcb, ByteOffset, ref ReturnedFileRunLength), ref BlockCacheIndex);

                        reader = new EndianReader(new MemoryStream(dirBlock, false), EndianType.BigEndian);
                        reader.BaseStream.Position = (ByteOffset & 0xFFF);
                        DirBlockPosition = (ByteOffset & 0xFFF) + DirBlockEndPosition;
                        DirBlockEndPosition += 0x1000;
                    }
                    else
                    {
                        dwReturn = 0xC0000034;
                        break;
                    }
                }

                dirEnt = new StfsDirectoryEntry(reader);

                if (dirEnt.FileNameLength == 0)
                {
                    if (EndOfListing == 0xffffffff)
                    {
                        EndOfListing = ByteOffset;
                    }
                }
                else
                {
                    if (dirEnt.DirectoryIndex == DirectoryFcb.DirectoryEntryIndex)
                    {
                        if (ByteOffset > 0x3FFF80)
                        {
                            throw new Exception(string.Format("The current directory's [ {0} ] index is out of range.", dirEnt.FileName));
                        }

                        else if (Name == null || dirEnt.FileName.ToLower().Contains(Name.ToLower()))
                        {
                            dirEnt.DirectoryEntryByteOffset = ByteOffset;

                            DirectoryLookup = dirEnt;

                            break;
                        }
                    }
                }

                DirBlockPosition += 0x40;
                ByteOffset += 0x40;

            } while (true);

            if (BlockCacheIndex != -1)
            {
                this.StfsDereferenceBlock(BlockCacheIndex);
            }

            if (reader != null)
            {
                reader.Close();
            }

            DirectoryLookup.DirectoryEndOfListing = EndOfListing;

            return dwReturn;
        }

        public int StfsEnsureWriteableDirectoryEntry(StfsFcb Fcb)
        {
            if (!this.VolumeExtension.ReadOnly)
            {
                if ((Fcb.State & 4) == 0)
                {
                    if ((Fcb.State & 0x20) == 0)
                    {
                        byte[] DataBlock = new byte[0x1000];
                        StfsHashBlock hashBlock = null;
                        StfsDirectoryEntry dirEnt = null;
                        int dataCacheIndex = -1, hashCacheIndex = -1;
                        uint blockNumer = 0xffffffff;

                        this.StfsBeginDirectoryEntryUpdate(Fcb.DirectoryEntryIndex * 0x40, ref dirEnt, ref blockNumer, ref DataBlock, ref dataCacheIndex, ref hashBlock, ref hashCacheIndex);

                        Fcb.State |= 0x20;

                        this.StfsEndDataBlockUpdate(DataBlock, dataCacheIndex, blockNumer, ref hashBlock, hashCacheIndex);
                    }
                }
                else
                {
                    throw new Exception(string.Format("Detected an invalid FCB state while attempting to ensure a writeable directory entry for {0}.", Fcb.FileName));
                }
            }
            else
            {
                throw new Exception("Attempted to write with a read-only device.");
            }

            return 0x00;
        }

        public void StfsUpdateDirectoryEntry(StfsFcb Fcb, bool ApplyDeleteOnClose)
        {
            int hashBlockCacheIndex = -1, dataBlockCacheIndex = -1;

            byte[] DataBlock = new byte[0x1000];
            StfsHashBlock hashBlock = null;
            StfsDirectoryEntry dirEntry = null;
            uint retBlockNum = 0xffffffff;

            this.StfsBeginDirectoryEntryUpdate(Fcb.DirectoryEntryIndex * 0x40, ref dirEntry, ref retBlockNum, ref DataBlock, ref dataBlockCacheIndex, ref hashBlock, ref hashBlockCacheIndex);

            this.StfsFillDirectoryEntryFromFcb(Fcb, ref dirEntry, ApplyDeleteOnClose);

            Array.Copy(dirEntry.ToArray(), 0, DataBlock, (Fcb.DirectoryEntryIndex * 0x40) & 0xFFF, 0x40);

            this.StfsEndDataBlockUpdate(DataBlock, dataBlockCacheIndex, retBlockNum, ref hashBlock, hashBlockCacheIndex);

            Fcb.State = (byte)((Fcb.State & 0xCF) | 0x20);

            if (this.GetDirectoryEntryIndex(dirEntry.FileName, Fcb.ParentDirectoryIndex) == -1)
            {
                this.DirectoryEntries.Add(dirEntry);
            }
            else
            {
                int Index = this.GetDirectoryEntryIndex(dirEntry.FileName, Fcb.ParentDirectoryIndex);
                this.DirectoryEntries.RemoveAt(Index);
                this.DirectoryEntries.Insert(Index, dirEntry);
            }
        }

        private void StfsBeginDirectoryEntryUpdate(object FileByteOffset, ref StfsDirectoryEntry ReturnedDirectoryEntry, ref uint ReturnedBlockNumber, ref byte[] ReturnedDataBlock, ref int dataBlockCacheIndex, ref StfsHashBlock ReturnedHashBlock, ref int HashBlockCacheIndex)
        {
            uint Offset = Convert.ToUInt32(FileByteOffset);

            this.StfsBeginDataBlockUpdate(this.DirectoryFcb, ref ReturnedHashBlock, ref HashBlockCacheIndex, Offset, ref ReturnedDataBlock, ref dataBlockCacheIndex, false, ref ReturnedBlockNumber);

            EndianReader reader = new EndianReader(new MemoryStream(ReturnedDataBlock), EndianType.BigEndian);
            reader.BaseStream.Position = Offset & 0xfff;

            ReturnedDirectoryEntry = new StfsDirectoryEntry(reader);

            reader.Close();

            if (Offset == this.DirectoryFcb.ValidAllocBlocks)
            {
                this.DirectoryFcb.ValidAllocBlocks += 0x1000;

                if (this.DirectoryFcb.ValidAllocBlocks != this.DirectoryFcb.AllocationBlocks)
                {
                    throw new Exception("The directory listing's allocation state was found to be invalid.");
                }
            }
        }

        private void StfsFillDirectoryEntryFromFcb(StfsFcb fcb, ref StfsDirectoryEntry DirectoryEntry, bool ApplyDeleteOnClose)
        {
            uint AllocBlocks = fcb.AllocationBlocks / 0x1000;
            bool Contiguous = false;

            if (fcb.BlockPosition != 0)
            {
                if (AllocBlocks == 2)
                {
                    if ((fcb.FirstBlockNumber + 1) == fcb.LastBlockNumber)
                    {
                        Contiguous = true;
                    }
                }
            }
            else
            {
                if (AllocBlocks == 0)
                {
                    throw new Exception("Invalid allocation block count detected while filling directory entry from the FCB.");
                }
                if (fcb.ContiguousBytesRead == fcb.AllocationBlocks || ((fcb.ContiguousBytesRead + 0x1000) == fcb.AllocationBlocks && (fcb.LastBlockNumber == (AllocBlocks + fcb.FirstBlockNumber - 1))))
                {
                    Contiguous = true;
                }
            }

            DirectoryEntry.FileName = fcb.FileName;
            DirectoryEntry.Contiguous = Contiguous;
            DirectoryEntry.IsDirectory = fcb.IsDirectory;
            DirectoryEntry.DirectoryIndex = fcb.ParentFcb.DirectoryEntryIndex;

            if (ApplyDeleteOnClose && (fcb.State & 8) != 0)
            {
                DirectoryEntry.FileNameLength = 0;
            }
            else
            {
                DirectoryEntry.FileNameLength = (byte)fcb.FileName.Length;
            }

            DirectoryEntry.ValidDataBlocks = fcb.ValidAllocBlocks / 0x1000;
            DirectoryEntry.AllocationBlocks = fcb.AllocationBlocks / 0x1000;
            DirectoryEntry.FirstBlockNumber = fcb.FirstBlockNumber;

            DirectoryEntry.FileBounds.Filesize = fcb.Filesize;
            DirectoryEntry.CreationTimeStamp = fcb.CreationTimeStamp;
            DirectoryEntry.LastWriteTimeStamp = fcb.LastWriteTimeStamp;
        }

        private void StfsResetWriteableDirectoryBlock(uint FileByteOffset, byte[] DataBlock)
        {
            EndianIO IO = new EndianIO(new MemoryStream(DataBlock), EndianType.BigEndian, true);

            if ((FileByteOffset & 0xFFF) != 0)
            {
                throw new Exception("Invalid byte offset found while resetting a writeable directory block.");
            }

            IO.Stream.Position = 0;

            do
            {
                StfsDirectoryEntry dirEnt = new StfsDirectoryEntry(IO.In);

                if (!dirEnt.IsDirectory)
                {
                    uint dataBlocks = ((dirEnt.FileBounds.Filesize + 0xFFF) >> 12);
                    if (dirEnt.ValidDataBlocks > dataBlocks)
                    {
                        dirEnt.ValidDataBlocks = dataBlocks;

                        IO.Stream.Position -= 0x40;
                        IO.Out.Write(dirEnt.ToArray());
                    }
                }

            } while (IO.Stream.Position < 0x1000);

            IO.Close();

            uint EntryIndex = (FileByteOffset >> 6), NextEntryIndex = EntryIndex + 0x40;

            for (int x = 0; x < this.Fcbs.Count; x++)
            {
                StfsFcb fcb = this.Fcbs[x];
                if (!fcb.IsDirectory)
                {
                    if (fcb.DirectoryEntryIndex >= EntryIndex && fcb.DirectoryEntryIndex < NextEntryIndex)
                    {
                        uint NewFilesize = RoundToBlock(fcb.Filesize);
                        if (fcb.ValidAllocBlocks > NewFilesize)
                        {
                            fcb.Filesize = NewFilesize;
                        }
                    }
                }
            }
        }

        public void StfsFreeBlocks(uint BlockNumber, bool MarkFirstAsLast, ref StfHashEntry FreeSingleHashEntry)
        {
            uint NumberOfFreeBlocks = 0, NumberOfFreePendingBlocks = 0, NexBlockNumber = 0xffffff;

            StfsFreeBlockState FreeBlockState = new StfsFreeBlockState();
            FreeBlockState.MarkFirstAsLast = MarkFirstAsLast;
            FreeBlockState.hashEntry = FreeSingleHashEntry;

            this.StfsSetInAllocationSupport(true);

            if (this.VolumeExtension.RootHashHierarchy > 0)
            {
                this.StfsFreeBlocksFromLevelNHashBlock(BlockNumber, this.VolumeExtension.RootHashHierarchy,
                                                       ref NumberOfFreePendingBlocks, ref NumberOfFreeBlocks,
                                                       ref NexBlockNumber, ref FreeBlockState);
            }
            else
            {
                this.StfsFreeBlocksFromLevel0HashBlock(BlockNumber, ref NumberOfFreeBlocks,
                                                       ref NumberOfFreePendingBlocks, ref NexBlockNumber,
                                                       ref FreeBlockState);
            }

            this.StfsSetInAllocationSupport(false);

            if (FreeSingleHashEntry != null)
            {
                FreeSingleHashEntry = FreeBlockState.hashEntry;
            }

            this.VolumeExtension.NumberOfFreePendingBlocks += NumberOfFreePendingBlocks;
            this.VolumeExtension.NumberOfFreeBlocks += NumberOfFreeBlocks;
        }

        internal uint StfsFreeBlocksFromLevel0HashBlock(uint blockNumber, ref uint numberOfFreeBlocks,
                                                       ref uint numberOfFreePendingBlocks, ref uint nextBlockNumber,
                                                       ref StfsFreeBlockState freeBlockState)
        {
            int cacheIndex = -1;
            nextBlockNumber = numberOfFreeBlocks = numberOfFreePendingBlocks = 0x00;
            const uint endLink = 0xffffff;
            uint hashBlockIndex = blockNumber / 0xAA;

            if (blockNumber < this.VolumeExtension.NumberOfTotalBlocks)
            {
                StfsHashBlock hashBlock = this.StfsMapWriteableHashBlock(blockNumber, 0, false, ref cacheIndex);
                do
                {
                    StfHashEntry hashEntry = hashBlock.RetrieveHashEntry(blockNumber);
                    nextBlockNumber = hashEntry.Level0.NextBlockNumber;
                    if (!freeBlockState.MarkFirstAsLast)
                    {
                        switch (hashEntry.Level0.State)
                        {
                            case StfsHashEntryLevel0State.Allocated:
                                hashEntry.LevelAsUINT &= 0x3FFFFFFF;
                                hashEntry.LevelAsUINT |= 0x40000000;
                                //hashEntry.Level0.State = StfsHashEntryLevel0State.FreedPending;
                                numberOfFreePendingBlocks++;
                                break;
                            case StfsHashEntryLevel0State.Pending:
                                hashEntry.LevelAsUINT &= 0x3FFFFFFF;
                                //hashEntry.Level0.State = StfsHashEntryLevel0State.Unallocated;
                                numberOfFreeBlocks++;
                                break;
                            default:
                                throw new Exception(string.Format("free of unallocated block number 0x{0:x}.",
                                                                      blockNumber));
                        }
                    }
                    else
                    {
                        freeBlockState.MarkFirstAsLast = false;
                        if (hashEntry.Level0.State != StfsHashEntryLevel0State.Allocated &&
                            hashEntry.Level0.State != StfsHashEntryLevel0State.Pending)
                        {
                            throw new Exception(string.Format("reference of unallocated block number 0x{0:x}.",
                                                                  blockNumber));
                        }
                    }
                    hashEntry.SetNextBlockNumber(endLink);
                    if (freeBlockState.hashEntry != null)
                    {
                        freeBlockState.hashEntry = hashEntry;
                        nextBlockNumber = endLink;
                    }

                    if (nextBlockNumber == endLink)
                        break;

                    blockNumber = nextBlockNumber;
                } while ((nextBlockNumber / 0xAA) == hashBlockIndex);

                hashBlock.Save();

                StfsDereferenceBlock(cacheIndex);
            }
            else
            {
                throw new Exception(string.Format("trying to free invalid block number 0x{0:x}. [0xC0000032]",
                                                      blockNumber));
            }
            return 0;
        }

        internal void StfsFreeBlocksFromLevelNHashBlock(uint BlockNumber, int CurrentLevel,
                                                       ref uint ReturnedNumberOfFreePendingBlocks,
                                                       ref uint ReturnedNumberOfFreeBlocks,
                                                       ref uint ReturnedNextBlockNumber,
                                                       ref StfsFreeBlockState FreeBlockState)
        {
            if (BlockNumber >= this.VolumeExtension.NumberOfTotalBlocks)
            {
                throw new Exception(string.Format("trying to free invalid block number {0:0x} [0xC0000032].",
                                                      BlockNumber));
            }

            uint blocksPerCurrLevel = this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[CurrentLevel];
            uint blocksPerPrevLevel = this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[CurrentLevel - 1];

            int hashBlockCacheIndex = -1;
            StfsHashBlock hashBlock = StfsMapWriteableHashBlock(BlockNumber, CurrentLevel, false,
                                                                     ref hashBlockCacheIndex);

            uint blockIndex = BlockNumber / blocksPerCurrLevel, freeBlockCount = 0, freePendingBlockCount = 0;
            uint numberOfFreeBlocks = 0, numberOfFreePendingBlocks = 0, nextBlockNumber = 0;
            do
            {
                var prevBlockIndex = (BlockNumber / blocksPerPrevLevel) % 0xAA;
                if (CurrentLevel != 1)
                {
                    StfsFreeBlocksFromLevelNHashBlock(BlockNumber, CurrentLevel - 1, ref numberOfFreePendingBlocks,
                                                           ref numberOfFreeBlocks, ref nextBlockNumber,
                                                           ref FreeBlockState);
                }
                else
                {
                    StfsFreeBlocksFromLevel0HashBlock(BlockNumber, ref numberOfFreeBlocks,
                                                           ref numberOfFreePendingBlocks, ref nextBlockNumber,
                                                           ref FreeBlockState);
                }

                hashBlock = new StfsHashBlock(this.VolumeExtension.BlockCache.Data[hashBlockCacheIndex]);
                StfHashEntry hashEntry = hashBlock.RetrieveHashEntry(prevBlockIndex);
                if (hashEntry.LevelN.Writeable != 1)
                {
                    throw new Exception(
                        string.Format("Detected a non-writeable entry while freeing blocks at level {0:d}", CurrentLevel));
                }
                hashEntry.SetNumberOfFreePendingBlocks(hashEntry.LevelN.NumberOfFreePendingBlocks +
                                                       numberOfFreePendingBlocks);
                hashEntry.SetNumberOfFreeBlocks(hashEntry.LevelN.NumberOfFreeBlocks + numberOfFreeBlocks);

                if (hashEntry.LevelN.NumberOfFreePendingBlocks > blocksPerPrevLevel)
                {
                    throw new Exception(
                        string.Format("Detected an invalid amount of free-pending blocks for level {0:d}.", CurrentLevel));
                }
                if (hashEntry.LevelN.NumberOfFreeBlocks > blocksPerPrevLevel)
                {
                    throw new Exception(string.Format("Detected an invalid amount of free blocks for level {0:d}.",
                                                          CurrentLevel));
                }

                hashBlock.Save();

                uint num1 = BlockNumber % blocksPerPrevLevel;
                uint blockNumToDiscard = BlockNumber - num1;
                num1 = this.VolumeExtension.NumberOfTotalBlocks - blockNumToDiscard;

                if (num1 > blocksPerPrevLevel)
                {
                    num1 = blocksPerPrevLevel;
                }

                if (num1 == hashEntry.LevelN.NumberOfFreePendingBlocks && num1 == blocksPerPrevLevel)
                {
                    this.StfsDiscardBlock(blockNumToDiscard, CurrentLevel);
                }
                else if (num1 == hashEntry.LevelN.NumberOfFreeBlocks)
                {
                    this.StfsDiscardBlock(blockNumToDiscard, CurrentLevel);
                }

                freeBlockCount += numberOfFreeBlocks;
                freePendingBlockCount += numberOfFreePendingBlocks;

                BlockNumber = nextBlockNumber;
                if (nextBlockNumber == 0xFFFFFF)
                    break;

            } while ((BlockNumber / blocksPerCurrLevel) == blockIndex);

            ReturnedNextBlockNumber = nextBlockNumber;
            ReturnedNumberOfFreeBlocks = freeBlockCount;
            ReturnedNumberOfFreePendingBlocks = freePendingBlockCount;

            this.StfsDereferenceBlock(hashBlockCacheIndex);
        }


        private int StfsAllocateBlocks(uint NumberOfNeededBlocks, uint AllocateBlocksType, uint StartingLinkBlockNumber, uint EndingLinkBlockNumber, ref uint ReturnedFirstAllocatedBlockNumber, ref uint ReturnedLastAllocatedBlockNumber)
        {
            if (this.VolumeExtension.ReadOnly)
            {
                throw new Exception("Attempted to allocate blocks on a read-only device.");
            }
            else if (NumberOfNeededBlocks == 0)
            {
                throw new Exception("Requested an invalid amount of blocks [zero] to be to be allocated.");
            }

            if (EndingLinkBlockNumber != 0xffffffff)
            {
                if (EndingLinkBlockNumber != 0xffffff)
                {
                    if (EndingLinkBlockNumber >= this.VolumeExtension.NumberOfTotalBlocks)
                    {
                        throw new Exception("The ending link block number was greatr than the allocated number of blocks.");
                    }
                }
            }
            else
            {
                EndingLinkBlockNumber = 0xffffff;
            }

            uint TotalBlockCount = 0;
            switch (AllocateBlocksType)
            {
                case 0:
                    TotalBlockCount = this.VolumeExtension.DirectoryAllocationBlockCount + NumberOfNeededBlocks;

                    break;
                case 1:
                    if (NumberOfNeededBlocks != 1)
                    {
                        throw new Exception("Attempted to allocate an invalid amount of blocks for allocation type-1 blocks.");
                    }
                    TotalBlockCount = this.VolumeExtension.DirectoryAllocationBlockCount + NumberOfNeededBlocks + 1;

                    break;
                case 2:
                    if (NumberOfNeededBlocks != 1)
                    {
                        throw new Exception("Attempted to allocate an invalid amount of blocks for allocation type-2 blocks.");
                    }
                    if (this.VolumeExtension.DirectoryAllocationBlockCount == 0)
                    {
                        throw new Exception("There are no blocks allocated for the directory listing.");
                    }
                    TotalBlockCount = this.VolumeExtension.DirectoryAllocationBlockCount + NumberOfNeededBlocks - 1;

                    break;
                case 3:
                    TotalBlockCount = this.VolumeExtension.DirectoryAllocationBlockCount + NumberOfNeededBlocks;

                    break;
                default:
                    throw new Exception("Invalid allocation block type requested for allocation.");
            }

            if (this.VolumeExtension.NumberOfFreeBlocks < TotalBlockCount)
            {
                this.StfsExtendBackingAllocationSize(TotalBlockCount - this.VolumeExtension.NumberOfFreeBlocks);

                if (this.VolumeExtension.NumberOfFreeBlocks != TotalBlockCount)
                {
                    throw new Exception("Invalid number of free blocks detected while allocating blocks.");
                }
            }

            if (AllocateBlocksType != 3)
            {
                StfsAllocateBlockState AllocateBlockState = new StfsAllocateBlockState();

                AllocateBlockState.NumberOfNeededBlocks = NumberOfNeededBlocks;
                AllocateBlockState.FirstAllocatedBlockNumber = 0xffffffff;
                AllocateBlockState.LastAllocatedBlockNumber = 0;
                AllocateBlockState.Block = -1;
                AllocateBlockState.hashEntry = null;

                this.StfsSetInAllocationSupport(true);

                bool MapEmptyHashBlock = (this.VolumeExtension.NumberOfFreeBlocks - this.VolumeExtension.NumberOfTotalBlocks) == 0 ? true : false;

                if (this.VolumeExtension.RootHashHierarchy != 0)
                {
                    this.StfsAllocateBlocksFromLevelNHashBlock(0, this.VolumeExtension.RootHashHierarchy, MapEmptyHashBlock, ref AllocateBlockState);
                }
                else
                {
                    this.StfsAllocateBlocksFromLevel0HashBlock(0, MapEmptyHashBlock, ref AllocateBlockState);
                }

                this.StfsSetInAllocationSupport(false);

                if (AllocateBlockState.hashEntry != null)
                {
                    StfsHashBlock hashBlock = new StfsHashBlock(this.VolumeExtension.BlockCache.Data[AllocateBlockState.Block]);
                    hashBlock.RetrieveHashEntry(AllocateBlockState.LastAllocatedBlockNumber).SetNextBlockNumber(EndingLinkBlockNumber);
                    hashBlock.Save();

                    this.StfsDereferenceBlock(AllocateBlockState.Block);
                }
                if (StartingLinkBlockNumber != 0xffffffff)
                {
                    if (StartingLinkBlockNumber < this.VolumeExtension.NumberOfTotalBlocks)
                    {
                        int cacheIndex = -1;

                        StfsHashBlock hashBlock = this.StfsMapWriteableHashBlock(StartingLinkBlockNumber, 0, false, ref cacheIndex);

                        StfHashEntry hashEntry = hashBlock.RetrieveHashEntry(StartingLinkBlockNumber);
                        hashEntry.SetNextBlockNumber(AllocateBlockState.FirstAllocatedBlockNumber);

                        hashBlock.Save();

                        this.StfsDereferenceBlock(cacheIndex);
                    }
                    else
                    {
                        throw new Exception("The starting link block number was greater than the number of total blocks.");
                    }
                }

                ReturnedFirstAllocatedBlockNumber = AllocateBlockState.FirstAllocatedBlockNumber;
                ReturnedLastAllocatedBlockNumber = AllocateBlockState.LastAllocatedBlockNumber;
            }
            return 0;
        }
        private void StfsAllocateBlocksFromLevel0HashBlock(uint CurrentBlockNumber, bool MapEmptyHashBlock, ref StfsAllocateBlockState AllocateBlockState)
        {
            if ((CurrentBlockNumber % 0xAA) != 0)
            {
                throw new Exception("Invalid block number supplied for level 0 allocation.");
            }

            int blockCacheIndex = -1;

            StfsHashBlock hashBlock = this.StfsMapWriteableHashBlock(CurrentBlockNumber, 0, MapEmptyHashBlock, ref blockCacheIndex);

            uint EndingBlockNumber = this.VolumeExtension.NumberOfTotalBlocks - CurrentBlockNumber;
            uint FirstAllocBlockNum = 0xffffffff;

            if (EndingBlockNumber > 0xAA)
            {
                EndingBlockNumber = 0xAA;
            }

            uint FreeBlockCount = this.VolumeExtension.NumberOfFreeBlocks;
            if (AllocateBlockState.NumberOfNeededBlocks == 0 || FreeBlockCount < AllocateBlockState.NumberOfNeededBlocks)
            {
                throw new Exception("Requested an invalid amount of level 0 hash blocks to be allocated.");
            }

            EndingBlockNumber += CurrentBlockNumber;

            uint idx = 0, uIdx = CurrentBlockNumber, actualIdx = 0;
            StfHashEntry hashEntry = null, usedHashEntry = AllocateBlockState.hashEntry;

            while (uIdx < EndingBlockNumber)
            {
                hashEntry = hashBlock.RetrieveHashEntry(idx);

                if (hashEntry.Level0.State == StfsHashEntryLevel0State.Unallocated)
                {
                    if (usedHashEntry != null)
                    {
                        usedHashEntry.SetNextBlockNumber(uIdx);

                        if (AllocateBlockState.Block != -1)
                        {
                            StfsHashBlock HashBlock = new StfsHashBlock(this.VolumeExtension.BlockCache.Data[AllocateBlockState.Block]);
                            HashBlock.SetEntry(AllocateBlockState.HashEntryIndex, usedHashEntry);
                            HashBlock.Save();

                            this.StfsDereferenceBlock(AllocateBlockState.Block);
                            AllocateBlockState.Block = -1;
                        }
                    }
                    if (FirstAllocBlockNum > uIdx)
                    {
                        FirstAllocBlockNum = uIdx;
                    }

                    hashEntry.LevelAsUINT |= 0xC0000000;
                    //hashEntry.Level0.State = StfsHashEntryLevel0State.Pending;

                    usedHashEntry = hashBlock.RetrieveHashEntry(idx);

                    AllocateBlockState.HashEntryIndex = idx;

                    AllocateBlockState.NumberOfNeededBlocks--;

                    FreeBlockCount--;

                    actualIdx = uIdx;

                    if (AllocateBlockState.NumberOfNeededBlocks == 0)
                        break;
                }
                uIdx++;
                idx++;
            }

            hashBlock.Save();

            if (AllocateBlockState.FirstAllocatedBlockNumber > FirstAllocBlockNum)
            {
                AllocateBlockState.FirstAllocatedBlockNumber = FirstAllocBlockNum;
            }

            AllocateBlockState.LastAllocatedBlockNumber = actualIdx;

            if (usedHashEntry != null)
            {
                AllocateBlockState.hashEntry = usedHashEntry;
            }
            else
            {
                throw new Exception("Detected an invalid hash entry while allocating level 0 hash blocks.");
            }

            AllocateBlockState.Block = blockCacheIndex;

            this.VolumeExtension.NumberOfFreeBlocks = FreeBlockCount;
        }
        private void StfsAllocateBlocksFromLevelNHashBlock(uint CurrentBlockNumber, int CurrentLevel, bool MapEmptyHashBlock, ref StfsAllocateBlockState AllocateBlockState)
        {
            if (CurrentLevel > this.VolumeExtension.RootHashHierarchy)
            {
                throw new Exception(string.Format("Attempted to allocate blocks for an invalid level [{0}].", CurrentLevel));
            }
            uint LevelBlockCount = this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[CurrentLevel];
            uint PrevLevelBlockCount = this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[CurrentLevel - 1];
            int hashBlockCacheIndex = -1;

            StfsHashBlock hashBlock = this.StfsMapWriteableHashBlock(CurrentBlockNumber, CurrentLevel, MapEmptyHashBlock, ref hashBlockCacheIndex);

            uint remainderCount = this.VolumeExtension.NumberOfTotalBlocks - CurrentBlockNumber;
            uint CommittedBlockCount = hashBlock.NumberOfCommittedBlocks;

            if (CommittedBlockCount > LevelBlockCount)
            {
                throw new Exception("Found a hash block with more blocks committed than the maximum.");
            }

            if (remainderCount > LevelBlockCount)
            {
                remainderCount = LevelBlockCount;
            }
            uint hashBlockRemainder = remainderCount - CommittedBlockCount;
            if (hashBlockRemainder != 0)
            {
                uint blocklevelIndex = CommittedBlockCount % PrevLevelBlockCount;
                uint blockIndex = CommittedBlockCount / PrevLevelBlockCount;
                uint bIdx = blockIndex;

                StfHashEntry hashEntry = hashBlock.RetrieveHashEntry(bIdx);

                if (blocklevelIndex != 0)
                {
                    uint lowLevelBlock = PrevLevelBlockCount - blocklevelIndex;
                    if (lowLevelBlock != 0)
                    {
                        if (lowLevelBlock > hashBlockRemainder)
                        {
                            lowLevelBlock = hashBlockRemainder;
                        }

                        if (hashEntry.LevelN.NumberOfFreeBlocks > PrevLevelBlockCount)
                        {
                            throw new Exception("Detected an invalid amount of free blocks while allocating blocks.");
                        }

                        hashEntry.SetNumberOfFreeBlocks(hashEntry.LevelN.NumberOfFreeBlocks + lowLevelBlock);

                        if (hashEntry.LevelN.NumberOfFreeBlocks > PrevLevelBlockCount)
                        {
                            throw new Exception("Detected an invalid amount of new free blocks while allocating blocks.");
                        }

                        hashBlockRemainder -= lowLevelBlock;
                        hashEntry = hashBlock.RetrieveHashEntry(++bIdx);
                    }
                }

                if (hashBlockRemainder != 0)
                {
                    do
                    {
                        uint PerBlockLevel = PrevLevelBlockCount;
                        if (PrevLevelBlockCount > hashBlockRemainder)
                        {
                            PerBlockLevel = hashBlockRemainder;
                        }

                        if (hashEntry.LevelN.ActiveIndex != 0 || hashEntry.LevelN.Writeable != 0 || hashEntry.LevelN.NumberOfFreePendingBlocks != 0)
                        {
                            throw new Exception(string.Format("Found an invalid hash entry while allocating [Index: {0}, Level: {1}.", bIdx, CurrentLevel));
                        }
                        hashBlockRemainder -= PerBlockLevel;
                        hashEntry.SetNumberOfFreeBlocks(PerBlockLevel);

                        hashEntry = hashBlock.RetrieveHashEntry(++bIdx);

                    } while (hashBlockRemainder != 0);
                }

                if (bIdx > 0xA9)
                {
                    throw new Exception("Detected an invalid hash-block entry index.");
                }

                hashBlock.NumberOfCommittedBlocks = remainderCount;
                CommittedBlockCount = remainderCount;

                hashBlock.Save();
            }

            uint committedTotal = CommittedBlockCount + CurrentBlockNumber, idx = 0;
            uint NumberOfNeededBlocks = AllocateBlockState.NumberOfNeededBlocks;

            if (CurrentBlockNumber < committedTotal)
            {
                do
                {
                    StfHashEntry hashEntry = hashBlock.RetrieveHashEntry(idx);

                    uint FreeBlocks = hashEntry.LevelN.NumberOfFreeBlocks;

                    if (FreeBlocks == 0)
                    {
                        idx++;
                        continue;
                    }

                    bool NewMapEmptyHashBlock = false;

                    if (FreeBlocks == PrevLevelBlockCount || (committedTotal - CurrentBlockNumber) == FreeBlocks)
                    {
                        NewMapEmptyHashBlock = true;
                    }

                    if (CurrentLevel != 1)
                    {
                        this.StfsAllocateBlocksFromLevelNHashBlock(CurrentBlockNumber, CurrentLevel - 1, NewMapEmptyHashBlock, ref AllocateBlockState);
                    }
                    else
                    {
                        this.StfsAllocateBlocksFromLevel0HashBlock(CurrentBlockNumber, NewMapEmptyHashBlock, ref AllocateBlockState);
                    }

                    hashBlock = new StfsHashBlock(this.VolumeExtension.BlockCache.Data[hashBlockCacheIndex]);
                    hashEntry = hashBlock.RetrieveHashEntry(idx);

                    uint NewFreeBlocks = FreeBlocks;
                    if (FreeBlocks > NumberOfNeededBlocks)
                    {
                        NewFreeBlocks = NumberOfNeededBlocks;
                    }

                    NumberOfNeededBlocks -= NewFreeBlocks;
                    hashEntry.SetNumberOfFreeBlocks(hashEntry.LevelN.NumberOfFreeBlocks - NewFreeBlocks);
                    hashBlock.Save();

                    if (AllocateBlockState.NumberOfNeededBlocks != NumberOfNeededBlocks)
                    {
                        throw new Exception("Detected an invalid amount of requested blocks to be allocated.");
                    }
                    idx++;

                } while (((CurrentBlockNumber += PrevLevelBlockCount) < committedTotal) && (NumberOfNeededBlocks != 0));
            }

            AllocateBlockState.NumberOfNeededBlocks = NumberOfNeededBlocks;

            this.StfsDereferenceBlock(hashBlockCacheIndex);
        }

        /// <summary>
        /// Sets the end of file for the file specified by the FCB. 
        /// </summary>
        /// <param name="Fcb">The FCB for the file.</param>
        /// <param name="FileSize">The new end-of-file.</param>
        public void StfsSetEndOfFileInformation(StfsFcb Fcb, uint EndOfFile)
        {
            // Make sure the new end-of-file is not equal to the current file size
            if (Fcb.Filesize != EndOfFile)
            {
                // Ensure that the FCB is writeable
                if (this.StfsEnsureWriteableDirectoryEntry(Fcb) == 0)
                {
                    // if the end-of-file is greater than the current file size, expand the file
                    if (EndOfFile > Fcb.Filesize)
                    {
                        this.StfsSetAllocationSize(Fcb, EndOfFile, true);
                    }

                    // Set the file's new size
                    Fcb.Filesize = EndOfFile;

                    // If the FCB is not modifiable, throw an error
                    if ((Fcb.State & 0x20) == 0)
                    {
                        throw new Exception(string.Format("Detected an invalid FCB state while setting end-of-file information for {0}.", Fcb.FileName));
                    }

                    // FCB has been modified
                    Fcb.State |= 0x10;
                }
            }
        }

        private void StfsExtendBackingFileSize(uint NumberOfExtendedBlocks)
        {
            if (this.VolumeExtension.CannotExpand)
            {
                throw new Exception("Attempted to expand on an non-expandable device.");
            }

            if (NumberOfExtendedBlocks > this.VolumeExtension.NumberOfExtendedBlocks)
            {
                throw new Exception("The requested extension block count is greater than the volume's allowed number of extended blocks.");
            }

            if (NumberOfExtendedBlocks > this.VolumeExtension.CurrentlyExtendedBlocks)
            {
                this.IO.Stream.SetLength(this.VolumeExtension.BackingFileOffset + (this.VolumeExtension.NumberOfExtendedBlocks << 12));

                this.VolumeExtension.CurrentlyExtendedBlocks = this.VolumeExtension.NumberOfExtendedBlocks;
            }
        }

        /// <summary>
        /// Expand the physical file on the drive by the amount of requested blocks.
        /// </summary>
        /// <param name="AllocationBlocks">Number of blocks (0x1000 bytes) to expand the file by.</param>
        private uint StfsExtendBackingAllocationSize(uint AllocationBlocks)
        {
            if (AllocationBlocks == 0)
            {
                throw new Exception("Attempted to extend the device's backing allocation size by zero.");
            }
            uint TotalAllocBlocks = this.VolumeExtension.NumberOfTotalBlocks + AllocationBlocks;

            if (AllocationBlocks > this.VolumeExtension.DataBlockCount || TotalAllocBlocks > this.VolumeExtension.DataBlockCount)
            {
                return 0xC000007F;
            }

            uint blockIndex = TotalAllocBlocks + 0xA9, blocksPerLevel = 0xAA;
            uint blocksPerLevelIndex = blockIndex / blocksPerLevel;
            uint RootHierarchy = 0;

            if (blocksPerLevelIndex > 1)
            {
                blockIndex = (blocksPerLevelIndex + 0xA9) / blocksPerLevel;
                RootHierarchy = 1;
            }
            else
            {
                blockIndex = 0x00;
            }

            if (blockIndex > 1)
            {
                RootHierarchy = 2;
                blocksPerLevel = (blockIndex + 0xA9) / blocksPerLevel;
            }
            else
            {
                blocksPerLevel = 0x00;
            }

            if (!this.VolumeExtension.ReadOnly)
            {
                // expand file on disk
                uint BlockExpansion = (((blockIndex + blocksPerLevel) + blocksPerLevelIndex) << 1) + TotalAllocBlocks;
                this.IO.Stream.SetLength(this.VolumeExtension.BackingFileOffset + (BlockExpansion * Block));

                this.VolumeExtension.NumberOfExtendedBlocks = BlockExpansion;
            }

            if (this.VolumeExtension.NumberOfTotalBlocks != 0)
            {
                if (this.VolumeExtension.RootHashHierarchy < RootHierarchy)
                {
                    this.StfsFlushBlockCache(0, 0xffffffff);
                }

                int NewLevel = this.VolumeExtension.RootHashHierarchy + 1;

                while (NewLevel <= RootHierarchy)
                {
                    StfHashEntry hashEntry = null;
                    StfsHashBlock hashBlock = null;
                    int hashBlockCacheIndex = -1;

                    this.StfsMapEmptyHashBlock(0, NewLevel, ref hashEntry, ref hashBlock, ref hashBlockCacheIndex);

                    hashBlock.SetHashForEntry(0, this.VolumeExtension.RootHashEntry.Hash);
                    StfHashEntry newHashEntry = hashBlock.RetrieveHashEntry(0);
                    newHashEntry.SetNumberOfFreeBlocks(this.VolumeExtension.NumberOfFreeBlocks);
                    newHashEntry.SetNumberOfFreePendingBlocks(this.VolumeExtension.NumberOfFreePendingBlocks);
                    newHashEntry.LevelAsUINT = (newHashEntry.LevelAsUINT & 0x7FFFFFFF) | (this.VolumeExtension.RootHashEntry.LevelAsUINT & 0x80000000);
                    newHashEntry.LevelAsUINT = (this.VolumeExtension.RootHashEntry.LevelAsUINT & 0x40000000) | (newHashEntry.LevelAsUINT & 0xFFFFFFFF);

                    hashBlock.NumberOfCommittedBlocks = this.VolumeExtension.NumberOfTotalBlocks;
                    hashBlock.Save();

                    this.VolumeExtension.RootHashEntry.Hash = HorizonCrypt.SHA1(this.VolumeExtension.BlockCache.Data[hashBlockCacheIndex]);

                    this.StfsDereferenceBlock(hashBlockCacheIndex);

                    this.VolumeExtension.RootHashEntry.LevelAsUINT &= 0x3FFFFFFF;
                    this.VolumeExtension.RootHashEntry.LevelAsUINT |= 0x80000000;
                    //this.VolumeExtension.RootHashEntry.Level0.State = StfsHashEntryLevel0State.Allocated;

                    NewLevel++;
                }
            }

            // increment the block count in the volume descriptor
            this.VolumeExtension.NumberOfTotalBlocks = TotalAllocBlocks;
            this.VolumeExtension.NumberOfFreeBlocks += AllocationBlocks;

            this.VolumeExtension.RootHashHierarchy = (int)RootHierarchy;

            return 0x000000000;
        }

        public void StfsEnsureWriteableBlocksAvailable(StfsFcb Fcb, uint Length, uint FileByteOffset)
        {
            if (this.VolumeExtension.ReadOnly)
            {
                throw new Exception("Called a write function on a read-only device [Function: To ensure writeable blocks].");
            }

            if (Length == 0)
            {
                throw new Exception("Detected an invalid length to ensure writeable blocks for.");
            }

            uint TotalBlocks = RoundToBlock(FileByteOffset + Length), BlockOffset = FileByteOffset & 0xFFFFF000;

            uint BlocksToAllocate = 0;

            if (TotalBlocks <= BlockOffset)
            {
                throw new Exception("The file offset was farther than the file's length.");
            }

            if (TotalBlocks > Fcb.AllocationBlocks)
            {
                BlocksToAllocate = (TotalBlocks - Fcb.AllocationBlocks) / 0x1000;
                TotalBlocks = Fcb.AllocationBlocks;
            }

            if (TotalBlocks > Fcb.ValidAllocBlocks)
            {
                TotalBlocks = Fcb.ValidAllocBlocks;
            }

            if (BlockOffset > TotalBlocks)
            {
                BlockOffset = TotalBlocks;
            }

            if (BlocksToAllocate != 0 || (TotalBlocks - BlockOffset) != 0x1000)
            {
                if ((((TotalBlocks - BlockOffset) >> 12) + this.VolumeExtension.DirectoryAllocationBlockCount) + BlocksToAllocate > this.VolumeExtension.NumberOfTotalBlocks)
                {
                    uint BlockPosition = Fcb.BlockPosition, BytesRead = Fcb.ContiguousBytesRead, LastUnContigBlockNum = Fcb.LastUnContiguousBlockNum;
                    uint BlockNumber = 0, returnedRunFileLength = 0;
                    uint NewOffset = BlockOffset;
                    do
                    {
                        if (TotalBlocks < BlockOffset)
                        {
                            int hashBlockCacheIndex = -1;

                            BlockNumber = this.StfsByteOffsetToBlockNumber(Fcb, BlockOffset, ref returnedRunFileLength);

                            var State = new StfsHashEntryLevel0State();
                            using (var hashBlock = this.StfsMapReadableHashBlock(BlockNumber, 0, ref hashBlockCacheIndex))
                            {
                                State = hashBlock.RetrieveHashEntry(BlockNumber).Level0.State;

                                if ((this.StfsBlockCacheElementFromBlock(hashBlockCacheIndex).State & 4) == 0 && State == StfsHashEntryLevel0State.Pending)
                                {
                                    State = StfsHashEntryLevel0State.Allocated;
                                }
                            }

                            if (State != StfsHashEntryLevel0State.Allocated)
                            {
                                if (State != StfsHashEntryLevel0State.Pending)
                                {
                                    throw new Exception(string.Format("trying to update unallocated block 0x{0:x8}.", BlockNumber));
                                }
                                else if (BlockOffset == NewOffset)
                                {
                                    LastUnContigBlockNum = Fcb.LastUnContiguousBlockNum;
                                    BytesRead = Fcb.ContiguousBytesRead;
                                    BlockPosition = Fcb.BlockPosition;
                                }
                            }
                            else
                            {
                                TotalBlocks++;
                                if (BlockOffset == NewOffset)
                                {
                                    if (NewOffset < BlockPosition)
                                    {
                                        BlockPosition = Fcb.BlockPosition;
                                        BytesRead = Fcb.ContiguousBytesRead;
                                        LastUnContigBlockNum = Fcb.LastUnContiguousBlockNum;
                                    }
                                }
                            }
                            this.StfsDereferenceBlock(hashBlockCacheIndex);
                            BlockOffset += 0x1000;
                        }
                        else
                        {
                            if (Fcb.BlockPosition != BlockPosition)
                            {
                                Fcb.BlockPosition = BlockPosition;
                                Fcb.ContiguousBytesRead = BytesRead;
                                Fcb.LastUnContiguousBlockNum = LastUnContigBlockNum;
                            }

                            if (BlocksToAllocate != 0)
                            {
                                uint FirstAlloc = 0xffffff, LastAlloc = 0xffffff;
                                this.StfsAllocateBlocks(BlocksToAllocate, 3, 0, 0, ref FirstAlloc, ref LastAlloc);
                            }

                            break;
                        }
                    } while (true);
                }
            }
        }

        public uint StfsSetAllocationSize(StfsFcb Fcb, object AllocationSize, bool DisableTruncaction)
        {
            uint AllocationLength = Convert.ToUInt32(AllocationSize);

            if (this.VolumeExtension.ReadOnly)
            {
                throw new Exception("Attempted to extend allocation for a file using a read-only device.");
            }

            if ((Fcb.State & 2) == 0)
            {
                if (Fcb.Filesize > Fcb.AllocationBlocks)
                {
                    throw new Exception("The FCB's filesize was greater than it's allocated blocks.");
                }
            }
            if (AllocationLength > 0xFFFFF000)
            {
                return 0xC000007F;
            }

            uint roundedSize = (AllocationLength + 0xFFF) & 0xFFFFF000;
            if (roundedSize != Fcb.AllocationBlocks)
            {
                if ((Fcb.State & 0x24) == 0)
                {
                    this.StfsEnsureWriteableDirectoryEntry(Fcb);
                }
            }

            if (roundedSize != Fcb.AllocationBlocks)
            {
                if (roundedSize != 0)
                {
                    if (Fcb.AllocationBlocks >= roundedSize)
                    {
                        if (!DisableTruncaction && Fcb.AllocationBlocks > roundedSize)
                        {
                            this.StfsTruncateFileAllocation(Fcb, roundedSize);
                        }
                    }
                    else
                    {
                        this.StfsExtendFileAllocation(Fcb, roundedSize);
                    }
                }
                else
                {
                    this.StfsDeleteFileAllocation(Fcb);
                }
            }
            return 0x00000000;
        }

        private void StfsDeleteFileAllocation(StfsFcb Fcb)
        {
            if (this.VolumeExtension.ReadOnly)
            {
                throw new Exception(string.Format("Attempted to delete a file's [{0}] allocation on a read-only device.", Fcb.FileName));
            }

            if ((Fcb.State & 2) != 0)
            {
                throw new Exception(string.Format("Attempted to delete a folder's [{0}] allocation.", Fcb.FileName));
            }

            if (Fcb.AllocationBlocks == 0)
            {
                throw new Exception(string.Format("Attempted to delete a file's [{0}] allocation with zero allocation blocks.", Fcb.FileName));
            }

            StfHashEntry hashEntry = null;

            this.StfsFreeBlocks(Fcb.FirstBlockNumber, false, ref hashEntry);

            Fcb.FirstBlockNumber = 0;
            Fcb.LastBlockNumber = 0xffffffff;
            Fcb.AllocationBlocks = 0;
            Fcb.Filesize = 0;
            Fcb.ValidAllocBlocks = 0;
            Fcb.BlockPosition = 0xffffffff;

            if ((Fcb.State & 0x20) == 0)
            {
                throw new Exception(string.Format("Detected an invalid FCB state while deleting a file's [{0}] allocation.", Fcb.FileName));
            }

            Fcb.State |= 0x10;
        }
        private void StfsExtendFileAllocation(StfsFcb Fcb, uint AllocationSize)
        {
            if (this.VolumeExtension.ReadOnly)
            {
                throw new Exception("Attempted to extend a file's size with a read-only device.");
            }

            if (AllocationSize == 0 || (AllocationSize & 0xfff) != 0)
            {
                throw new Exception(string.Format("Attempted to extend a file's length by an invalid number of bytes [Count: 0x{0:0X}].", (AllocationSize & 0xfff)));
            }

            if (Fcb.AllocationBlocks >= AllocationSize)
            {
                throw new Exception("The allocation size supplied for a file extension is less than, or equal to, the file's current allocation size.");
            }

            uint blockNumber = Fcb.LastBlockNumber, retFileLength = 0, oldAllocBlocks = Fcb.AllocationBlocks;
            if (Fcb.AllocationBlocks != 0 && Fcb.LastBlockNumber == 0xffffffff)
            {
                blockNumber = this.StfsByteOffsetToBlockNumber(Fcb, Fcb.AllocationBlocks - 1, ref retFileLength);
                Fcb.LastBlockNumber = blockNumber;
            }
            uint allocBlocks = (AllocationSize - Fcb.AllocationBlocks) / 0x1000, firsAllocBlockNum = 0, lastAllocBlockNum = 0;
            uint allocBlockType = 0xff;

            if ((Fcb.State & 4) == 0)
            {
                if ((Fcb.State & 2) != 0)
                {
                    throw new Exception(string.Format("Invalid FCB state detected while extending a file's [{0}] allocation size.", Fcb.FileName));
                }
                allocBlockType = 0;
            }
            else
            {
                if (allocBlocks != 1)
                {
                    throw new Exception(string.Format("Invalid allocation block count detected for {0} with state 0x{1:0x}.", Fcb.FileName, Fcb.State));
                }
                allocBlockType = 1;
            }

            this.StfsAllocateBlocks(allocBlocks, allocBlockType, blockNumber, 0xffffffff, ref firsAllocBlockNum, ref lastAllocBlockNum);

            Fcb.LastBlockNumber = lastAllocBlockNum;
            Fcb.AllocationBlocks = AllocationSize;

            if (oldAllocBlocks == 0)
            {
                Fcb.FirstBlockNumber = firsAllocBlockNum;

                if ((lastAllocBlockNum - firsAllocBlockNum) + 1 == allocBlocks)
                {
                    Fcb.ContiguousBytesRead = AllocationSize;
                    Fcb.LastUnContiguousBlockNum = firsAllocBlockNum;
                    Fcb.BlockPosition = 0;
                }
            }
            if ((Fcb.State & 4) != 0)
            {
                this.VolumeExtension.DirectoryAllocationBlockCount++;
            }
            else
            {
                if ((Fcb.State & 0x20) == 0)
                {
                    throw new Exception(string.Format("Invalid FCB state found while extending {0}'s allocation size.", Fcb.FileName));
                }
                Fcb.State |= 0x10;
            }
        }
        private void StfsTruncateFileAllocation(StfsFcb Fcb, uint AllocationSize)
        {
            if (this.VolumeExtension.ReadOnly)
            {
                throw new Exception("Attempted to truncate a file with a read-only device.");
            }

            if (AllocationSize == 0)
            {
                throw new Exception("Attempted to truncate a file to zero bytes.");
            }
            else if ((AllocationSize & 0xfff) != 0)
            {
                throw new Exception("Detected an invalid allocation size supplied for truncation.");
            }

            if (Fcb.IsDirectory)
            {
                throw new Exception("Attempted to truncate a directory.");
            }

            uint retFileLength = 0xffffffff;
            StfHashEntry hashEntry = null;

            uint blockNum = this.StfsByteOffsetToBlockNumber(Fcb, AllocationSize - 1, ref retFileLength);

            this.StfsFreeBlocks(blockNum, true, ref hashEntry);

            Fcb.LastBlockNumber = blockNum;
            Fcb.AllocationBlocks = AllocationSize;
            Fcb.BlockPosition = 0xffffffff;

            if (Fcb.Filesize > AllocationSize)
            {
                Fcb.Filesize = AllocationSize;
            }
            if (Fcb.ValidAllocBlocks > AllocationSize)
            {
                Fcb.ValidAllocBlocks = AllocationSize;
            }

            if ((Fcb.State & 0x20) == 0)
            {
                throw new Exception("Invalid FCB state detected while truncating file.");
            }
            Fcb.State |= 0x10;
        }

        public void StfsSetDispositionInformation(StfsFcb Fcb, WinFile.FileDispositionInformation DispositionInformation)
        {
            if (DispositionInformation.DeleteFile)
            {
                if (this.StfsEnsureWriteableDirectoryEntry(Fcb) == 0)
                {
                    Fcb.State |= 0x08;
                }
            }
            else
            {
                Fcb.State &= 0xF7;
            }
        }

        private void StfsSetInAllocationSupport(bool InAllocationSupport)
        {
            this.VolumeExtension.InAllocationSupport = InAllocationSupport;
            if (InAllocationSupport == false && this.VolumeExtension.BlockCacheElementCount != 0)
            {
                for (var x = 0; x < this.VolumeExtension.BlockCacheElementCount; x++)
                {
                    this.VolumeExtension.ElementCache.RetrieveElement(x).State &= 0xF7;
                }
            }
        }

        /// <summary>
        /// Returns the block number from the offset/position in the file supplied.
        /// </summary>
        /// <param name="Fcb">The file of which to calculate the block number for.</param>
        /// <param name="Offset">Byte offset to retrieve the block number of.</param>
        /// <returns>The block number for the byte offset of the specified file.</returns>
        private uint StfsByteOffsetToBlockNumber(StfsFcb Fcb, long Offset, ref uint ReturnedFileRunLength)
        {
            uint BlockOffset = (uint)Offset & 0xFFF;
            Offset &= 0xFFFFF000;

            if (Offset > Fcb.AllocationBlocks)
            {
                throw new Exception("Attempted to seek beyond valid, allocated blocks. [0xC0000011].");
            }

            uint BlockNum = 0xFFFFFF, OldBlockNum = 0, NewBlockNum = 0, ContiguousBytesRead = Fcb.ContiguousBytesRead,
                LastUnContiguousBlockNum = Fcb.LastUnContiguousBlockNum,
                RecBlockNum = 0, OtherBlockNum = 0;

            int CacheIndex = 0;
            uint BlockPosition = Fcb.BlockPosition, AllocBlocksRead = 0;

            BlockNum = Fcb.FirstBlockNumber;

            StfsHashBlock hashBlock = null;
            StfHashEntry hashEntry = null;

            if (Offset >= Fcb.BlockPosition)
            {
                if (Offset < (Fcb.ContiguousBytesRead + Fcb.BlockPosition))
                {
                    ReturnedFileRunLength = (uint)((Fcb.ContiguousBytesRead - (Offset - Fcb.BlockPosition)) - BlockOffset);
                    return Convert.ToUInt32(((Offset - Fcb.BlockPosition) / 0x1000) + Fcb.LastUnContiguousBlockNum);
                }
            }
            if (Offset == 0)
            {
                ReturnedFileRunLength = 0x1000 - BlockOffset;
                return Fcb.FirstBlockNumber;
            }
            else
            {
                if ((Offset + 0x1000) == Fcb.AllocationBlocks)
                {
                    if (Fcb.LastBlockNumber != 0xffffffff)
                    {
                        ReturnedFileRunLength = 0x1000 - BlockOffset;
                        return Fcb.LastBlockNumber;
                    }
                }

                if (Offset <= Fcb.BlockPosition)
                {
                    AllocBlocksRead = 0;
                    BlockPosition = 0;
                    ContiguousBytesRead = 0x1000;
                    BlockNum = Fcb.FirstBlockNumber;
                    LastUnContiguousBlockNum = Fcb.FirstBlockNumber;
                }
                else
                {
                    AllocBlocksRead = (uint)((Fcb.ContiguousBytesRead + Fcb.BlockPosition) - 0x1000);
                    BlockNum = ((Fcb.ContiguousBytesRead / 0x1000) + Fcb.LastUnContiguousBlockNum) - 1;
                }
                do
                {
                    OldBlockNum = BlockNum % 0xAA;
                    NewBlockNum = BlockNum - OldBlockNum;

                    if (hashBlock == null)
                    {
                        hashBlock = this.StfsMapReadableHashBlock(NewBlockNum, 0, ref CacheIndex);

                        RecBlockNum = NewBlockNum;
                    }

                    else if (RecBlockNum != NewBlockNum)
                    {
                        this.StfsDereferenceBlock(CacheIndex);

                        hashBlock.Dispose();

                        hashBlock = this.StfsMapReadableHashBlock(NewBlockNum, 0, ref CacheIndex);

                        RecBlockNum = NewBlockNum;
                    }

                    hashEntry = hashBlock.RetrieveHashEntry(OldBlockNum);

                    if (hashEntry.Level0.NextBlockNumber > this.VolumeExtension.NumberOfTotalBlocks)
                    {
                        throw new Exception(string.Format("reference to illegal block number 0x{0} [0xC0000032].", hashEntry.Level0.NextBlockNumber.ToString("X")));
                    }

                    AllocBlocksRead += 0x1000;

                    if ((BlockNum + 1) != hashEntry.Level0.NextBlockNumber)
                    {
                        BlockPosition = AllocBlocksRead;
                        ContiguousBytesRead = 0x1000;
                        LastUnContiguousBlockNum = hashEntry.Level0.NextBlockNumber;
                    }
                    else
                    {
                        ContiguousBytesRead += 0x1000;
                    }

                    BlockNum = hashEntry.Level0.NextBlockNumber;

                } while (Offset != AllocBlocksRead);
            }

            uint TotalBlocks = AllocBlocksRead + 0x1000, PreviousBlockNumber = BlockNum;

            do
            {
                if (TotalBlocks != Fcb.AllocationBlocks)
                {
                    OtherBlockNum = PreviousBlockNumber - NewBlockNum;
                    if (OtherBlockNum < 0xA9)
                    {
                        var CurrentBlockNumber = hashBlock.RetrieveHashEntry(OtherBlockNum).Level0.NextBlockNumber;

                        if (CurrentBlockNumber >= this.VolumeExtension.NumberOfTotalBlocks)
                        {
                            throw new Exception(string.Format("reference to illegal block number 0x{0:0x} [0xC0000032].", hashEntry.Level0.NextBlockNumber.ToString("X")));
                        }

                        if ((PreviousBlockNumber + 1) == CurrentBlockNumber)
                        {
                            TotalBlocks += 0x1000;
                            ContiguousBytesRead += 0x1000;
                            PreviousBlockNumber = CurrentBlockNumber;
                        }
                        else break;
                    }
                    else break;
                }
                else
                {
                    Fcb.LastBlockNumber = PreviousBlockNumber;
                    break;
                }

            } while (true);

            if (hashBlock != null)
            {
                hashBlock.Dispose();

                this.StfsDereferenceBlock(CacheIndex);
            }

            if (BlockNum == 0xffffff)
            {
                throw new Exception("Invalid block number was to be returned from StfsByteOffsetToBlockNumber.");
            }

            ReturnedFileRunLength = (uint)((TotalBlocks - BlockOffset) - Offset);

            Fcb.BlockPosition = BlockPosition;
            Fcb.ContiguousBytesRead = ContiguousBytesRead;
            Fcb.LastUnContiguousBlockNum = LastUnContiguousBlockNum;

            return BlockNum;
        }

        public void StfsFullyCachedRead(StfsFcb Fcb, object ByteOffset, object Count, EndianWriter writer)
        {
            uint FileByteOffset = Convert.ToUInt32(ByteOffset), Length = Convert.ToUInt32(Count);
            if (Length == 0)
                throw new Exception("Requested a cached read with an invalid length of bytes.");

            else if (FileByteOffset > Fcb.AllocationBlocks)
                throw new Exception("Requested a cached read at an invalid starting position.");

            else if ((FileByteOffset + Length) > Fcb.Filesize)
                throw new Exception(string.Format("Requested a cached read larger than available from the file {0}.", Fcb.FileName));

            uint num2 = 0, ReturnedFileRunLength = 0;
            int BlockCache = -1;
            do
            {
                uint num = FileByteOffset & 0xfff;
                num2 = ~num + 0x1000 + 1;

                if (num2 > Length)
                    num2 = Length;

                writer.Write(this.StfsMapReadableDataBlock(this.StfsByteOffsetToBlockNumber(Fcb, FileByteOffset, ref ReturnedFileRunLength), ref BlockCache), FileByteOffset % 0x1000, num2);

                this.StfsDereferenceBlock(BlockCache);

                FileByteOffset += num2;

            } while ((Length -= num2) != 0);
        }

        public void StfsPartiallyCachedRead(StfsFcb Fcb, uint FileByteOffset, uint Length, EndianWriter writer)
        {
            uint fullCacheLength = 0, remainder = (FileByteOffset & 0xfff);
            uint ReturnedFileRunLength = 0;

            if (remainder != 0)
            {
                fullCacheLength = ~remainder + 0x1000 + 1;
                if (fullCacheLength < Length)
                {
                    this.StfsFullyCachedRead(Fcb, FileByteOffset, fullCacheLength, writer);
                }
                else
                {
                    throw new Exception("Invalid partial cache read request [Remainder larger than length].");
                }
                Length -= fullCacheLength;
                FileByteOffset += fullCacheLength;
            }

            if (Length < 0x1000)
            {
                throw new Exception("Invalid partial cache read request [Invalid read-remainder size].");
            }
            do
            {
                if (FileByteOffset >= Fcb.Filesize || FileByteOffset >= Fcb.ValidAllocBlocks ||
                   (FileByteOffset + Length) > Fcb.Filesize || (FileByteOffset + Length) > Fcb.ValidAllocBlocks)
                {
                    throw new Exception("Attempted to read beyond end-of-file.");
                }

                uint blockNum = this.StfsByteOffsetToBlockNumber(Fcb, FileByteOffset, ref ReturnedFileRunLength);
                int BlockCacheIndex = -1;
                if (!this.StfsMapExistingDataBlock(blockNum, ref BlockCacheIndex))
                {
                    if (Length >= 0x1000)
                    {
                        uint nonCacheRemainder = (Length & 0xFFFFF000);
                        if (nonCacheRemainder < 0x1000)
                        {
                            throw new Exception("Invalid partial cache read request [Invalid read-remainder block length].");
                        }
                        this.StfsNonCachedRead(Fcb, FileByteOffset, nonCacheRemainder, writer);

                        Length -= nonCacheRemainder;
                        FileByteOffset += nonCacheRemainder;
                    }
                    break;
                }

                writer.Write(this.VolumeExtension.BlockCache.Data[BlockCacheIndex], 0x1000);

                this.StfsDereferenceBlock(BlockCacheIndex);

                FileByteOffset += 0x1000;

            } while ((Length -= 0x1000) >= 0x1000);

            if (Length != 0)
            {
                this.StfsFullyCachedRead(Fcb, FileByteOffset, Length, writer);
            }
        }

        private void StfsNonCachedRead(StfsFcb Fcb, uint FileByteOffset, uint Length, EndianWriter writer)
        {
            int CacheIndex = -1;
            uint ReturnedFileRunLength = 0;
            do
            {
                uint BlockNum = this.StfsByteOffsetToBlockNumber(Fcb, FileByteOffset, ref ReturnedFileRunLength);

                uint NewBlockNum = (~(BlockNum % 0xAA) + 0xAA + 1) << 12;

                if (ReturnedFileRunLength > NewBlockNum)
                {
                    ReturnedFileRunLength = NewBlockNum;
                }
                if (ReturnedFileRunLength > Length)
                {
                    ReturnedFileRunLength = Length;
                }
                if (ReturnedFileRunLength > 0x1000)
                {
                    ReturnedFileRunLength = 0x1000;
                }

                if (!this.VolumeExtension.ReadOnly)
                {
                    this.StfsFlushBlockCache(BlockNum, (ReturnedFileRunLength / 0x1000) + BlockNum - 1);
                }

                var hashBlock = this.StfsMapReadableHashBlock(BlockNum, 0, ref CacheIndex);

                byte[] Data = this.StfsSynchronousReadFile(this.StfsComputeBackingDataBlockNumber(BlockNum), ReturnedFileRunLength, 0);

                writer.Write(Data);

                int TempCopyIndex = 0;
                byte[] TempBlock = new byte[Block];

                Length -= (uint)ReturnedFileRunLength;
                FileByteOffset += (uint)ReturnedFileRunLength;

                do
                {
                    Array.Copy(Data, TempCopyIndex, TempBlock, 0, 0x1000);

                    if (this.Debug)
                    {
                        if (!HorizonCrypt.ArrayEquals(HorizonCrypt.SHA1(TempBlock), hashBlock.RetrieveHashEntry(BlockNum).Hash))
                        {
                            throw new Exception(string.Format("hash mismatch for block number 0x{0:x8} [0xC0000032].", BlockNum));
                        }
                    }

                    TempCopyIndex += 0x1000;
                    BlockNum++;

                } while ((ReturnedFileRunLength -= 0x1000) != 0);

                this.StfsDereferenceBlock(CacheIndex);

                hashBlock.Dispose();

            } while (Length != 0);
        }

        public bool StfsTestForFullyCachedIo(StfsFcb Fcb, long FileByteOffset, long Length)
        {
            if (Length == 0)
            {
                throw new Exception("Detected an invalid amount of bytes for reading/writing.");
            }

            if (Length >= 0x1000)
            {
                if ((((FileByteOffset + Length) ^ (FileByteOffset + 0xFFF)) & 0xFFFFF000) != 0)
                {
                    return false;
                }
            }

            return true;
        }

        public void StfsFullyCachedWrite(StfsFcb Fcb, object ByteOffset, object Count, byte[] DataBuffer)
        {
            uint FileByteOffset = Convert.ToUInt32(ByteOffset), Length = Convert.ToUInt32(Count);

            if (Length == 0)
            {
                throw new Exception("Attempted to write an invalid amount of bytes.");
            }
            uint num = 0, blockLength = 0, returnedBlockNumber = 0xffffffff, bufferIndex = 0;

            StfsHashBlock hashBlock = null;

            byte[] DataBlock = new byte[0x1000];

            int dataBlockCacheIndex = -1, hashBlockCacheIndex = -1;

            do
            {
                num = FileByteOffset & 0xfff;
                blockLength = ~num + 0x1000 + 1;

                if (blockLength > Length)
                    blockLength = Length;

                this.StfsBeginDataBlockUpdate(Fcb, ref hashBlock, ref hashBlockCacheIndex, FileByteOffset, ref DataBlock, ref dataBlockCacheIndex, (blockLength - 0x1000) == 0 ? true : false, ref returnedBlockNumber);

                Array.Copy(DataBuffer, bufferIndex, DataBlock, num, blockLength);

                this.StfsEndDataBlockUpdate(DataBlock, dataBlockCacheIndex, returnedBlockNumber, ref hashBlock, hashBlockCacheIndex);

                if (Fcb.ValidAllocBlocks <= FileByteOffset)
                {
                    Fcb.ValidAllocBlocks += 0x1000;
                }

                FileByteOffset += blockLength;
                bufferIndex += blockLength;

            } while ((Length -= blockLength) != 0);
        }

        public void StfsPartiallyCachedWrite(StfsFcb Fcb, uint FileByteOffset, uint Length, byte[] Buffer)
        {
            EndianReader reader = new EndianReader(new MemoryStream(Buffer), EndianType.BigEndian);

            uint remainder = (FileByteOffset & 0xfff);
            if (remainder != 0)
            {
                remainder = 0x1000 - remainder;

                this.StfsFullyCachedWrite(Fcb, FileByteOffset, remainder, reader.ReadBytes(remainder));

                Length -= remainder;
                FileByteOffset += remainder;
            }
            uint nonCacheRemainder = (Length & 0xFFFFF000);

            this.StfsNonCachedWrite(Fcb, FileByteOffset, reader.ReadBytes(nonCacheRemainder), nonCacheRemainder);

            FileByteOffset += (Length & 0xFFFFF000);

            remainder = Length - nonCacheRemainder;

            if (remainder != 0)
            {
                this.StfsFullyCachedWrite(Fcb, FileByteOffset, remainder, reader.ReadBytes(remainder));
            }

            reader.Close();
        }

        private void StfsNonCachedWrite(StfsFcb Fcb, uint FileByteOffset, byte[] Buffer, uint Length)
        {
            EndianReader reader = new EndianReader(new MemoryStream(Buffer, false), EndianType.BigEndian);

            if (Length == 0)
            {
                throw new Exception("Attempted to write a zero bytes [Non-cached write].");
            }

            uint BlockIndex = 0, finalBlock = 0xffffffff;

            MemoryStream ms = new MemoryStream();

            EndianWriter writer = new EndianWriter(ms, EndianType.BigEndian);

            do
            {
                StfsHashBlock hashBlock = null;
                byte[] DataBlock = null;
                int hashBlockCacheIndex = -1, dataBlockCacheIndex = -1;
                uint retBlockNum = 0xffffffff;

                this.StfsBeginDataBlockUpdate(Fcb, ref hashBlock, ref hashBlockCacheIndex, FileByteOffset, ref DataBlock, ref dataBlockCacheIndex, true, ref retBlockNum);

                byte[] data = reader.ReadBytes(0x1000);
                hashBlock.SetHashForEntry(retBlockNum, HorizonCrypt.SHA1(data));

                hashBlock.Save();
                this.StfsDereferenceBlock(hashBlockCacheIndex);

                this.StfsDiscardBlock(retBlockNum, 0);

                uint BlockNum = this.StfsComputeBackingDataBlockNumber(retBlockNum);


                if (BlockIndex != 0)
                {
                    if ((finalBlock + BlockIndex) != BlockNum)
                    {
                        this.StfsSynchronousWriteFile(finalBlock, 0, ms.ToArray(), BlockIndex * 0x1000);

                        writer.BaseStream.SetLength(0);

                        BlockIndex = 1;
                        finalBlock = BlockNum;
                    }
                    else
                    {
                        BlockIndex++;
                    }
                }
                else
                {
                    BlockIndex = 1;
                    finalBlock = BlockNum;
                }

                writer.Write(data);
                writer.Flush();


                if (Fcb.ValidAllocBlocks <= FileByteOffset)
                {
                    Fcb.ValidAllocBlocks += 0x1000;
                }

                FileByteOffset += 0x1000;

            } while ((Length -= 0x1000) != 0);

            if (finalBlock != 0xffffffff && BlockIndex != 0)
            {
                this.StfsSynchronousWriteFile(finalBlock, 0, ms.ToArray(), BlockIndex * 0x1000);
            }

            writer.Close();
            reader.Close();
        }

        public void StfsBeginDataBlockUpdate(StfsFcb Fcb, ref StfsHashBlock HashBlock, ref int hashBlockCacheIndex, uint FileByteOffset, ref byte[] ReturnedDataBlock, ref int DataBlockCacheIndex, bool MapEmptyDataBlock, ref uint ReturnedBlockNumber)
        {
            uint ByteOffset = FileByteOffset & 0xFFFFF000, BlockNumber = 0xffffffff, ReturnedFileRunLength = 0;
            uint StartLinkBlockNum = 0xffffffff;

            if (ByteOffset < Fcb.AllocationBlocks)
            {
                BlockNumber = this.StfsByteOffsetToBlockNumber(Fcb, ByteOffset, ref ReturnedFileRunLength);

                if (BlockNumber > this.VolumeExtension.NumberOfTotalBlocks)
                {
                    throw new Exception(string.Format("Could not calculate a block number for file '{0}' at offset 0x{1:x8}.", Fcb.FileName, ByteOffset));
                }

                HashBlock = this.StfsMapWriteableHashBlock(BlockNumber, 0, false, ref hashBlockCacheIndex);
                StfHashEntry hashEntry = HashBlock.RetrieveHashEntry(BlockNumber);
                if (ByteOffset != Fcb.ValidAllocBlocks)
                {
                    if (hashEntry.Level0.State != StfsHashEntryLevel0State.Pending)
                    {
                        this.StfsDereferenceBlock(hashBlockCacheIndex);

                        if (hashEntry.Level0.State == StfsHashEntryLevel0State.Allocated)
                        {
                            if (ByteOffset != 0)
                            {
                                uint prevBlock = ByteOffset - 0x1000;
                                if (prevBlock < Fcb.BlockPosition || prevBlock >= (Fcb.BlockPosition + Fcb.ContiguousBytesRead))
                                {
                                    StartLinkBlockNum = this.StfsByteOffsetToBlockNumber(Fcb, prevBlock, ref ReturnedFileRunLength);
                                }
                                else
                                {
                                    StartLinkBlockNum = ((prevBlock - Fcb.BlockPosition) / 0x1000) + Fcb.LastUnContiguousBlockNum;
                                }
                            }
                            uint AllocBlocksType = 0, ReturnedFirstAllocatedBlockNumber = 0, ReturnedLastAllocatedBlockNumber = 0;
                            if ((Fcb.State & 4) != 0)
                            {
                                if (this.StfsVolumeDescriptor.DirectoryAllocationBlocks != 0)
                                {
                                    AllocBlocksType = 2;
                                }
                                else
                                {
                                    throw new Exception("Invalid directory allocation block count detected.");
                                }
                            }

                            this.StfsAllocateBlocks(1, AllocBlocksType, StartLinkBlockNum, hashEntry.Level0.NextBlockNumber, ref ReturnedFirstAllocatedBlockNumber, ref ReturnedLastAllocatedBlockNumber);

                            if (BlockNumber == Fcb.FirstBlockNumber)
                            {
                                Fcb.FirstBlockNumber = ReturnedFirstAllocatedBlockNumber;
                            }

                            if (BlockNumber == Fcb.LastBlockNumber)
                            {
                                Fcb.LastBlockNumber = ReturnedLastAllocatedBlockNumber;
                            }

                            if ((Fcb.BlockPosition + Fcb.ContiguousBytesRead) != ByteOffset || ((Fcb.ContiguousBytesRead / 0x1000) + Fcb.LastUnContiguousBlockNum) != ReturnedFirstAllocatedBlockNumber)
                            {
                                Fcb.BlockPosition = ByteOffset;
                                Fcb.LastUnContiguousBlockNum = ReturnedFirstAllocatedBlockNumber;
                                Fcb.ContiguousBytesRead = 0x1000;
                            }
                            else
                            {
                                Fcb.ContiguousBytesRead += 0x1000;
                            }

                            if ((Fcb.State & 4) == 0)
                            {
                                if ((Fcb.State & 0x20) != 0)
                                {
                                    Fcb.State |= 0x10;
                                }
                                else
                                {
                                    throw new Exception("Invalid Fcb state detected while beginning data block update.");
                                }
                            }
                            else
                            {
                                this.VolumeExtension.DirectoryAllocationBlockCount += 0xFFFF;
                            }

                            StfHashEntry FreeSingleHashEntry = new StfHashEntry();
                            this.StfsFreeBlocks(BlockNumber, false, ref FreeSingleHashEntry);

                            if (ReturnedDataBlock != null)
                            {
                                if (MapEmptyDataBlock)
                                {
                                    this.StfsMapEmptyDataBlock(ReturnedFirstAllocatedBlockNumber, ref ReturnedDataBlock, ref DataBlockCacheIndex);
                                }
                                else
                                {
                                    ReturnedDataBlock = this.StfsMapWriteableCopyOfDataBlock(ReturnedFirstAllocatedBlockNumber, BlockNumber, ref FreeSingleHashEntry, ref DataBlockCacheIndex);
                                }
                            }
                            if (!MapEmptyDataBlock)
                            {
                                if ((Fcb.State & 4) != 0)
                                {
                                    this.StfsResetWriteableDirectoryBlock(ByteOffset, ReturnedDataBlock);
                                }
                            }

                            if (ReturnedFirstAllocatedBlockNumber > this.VolumeExtension.NumberOfTotalBlocks)
                            {
                                throw new Exception(string.Format("Failed to allocate a new block while updating {0}.", Fcb.FileName));
                            }

                            HashBlock = this.StfsMapWriteableHashBlock(ReturnedFirstAllocatedBlockNumber, 0, false, ref hashBlockCacheIndex);
                            ReturnedBlockNumber = ReturnedFirstAllocatedBlockNumber;
                        }
                        else
                        {
                            throw new Exception(string.Format("trying to update unallocated block 0x{0:x8} [0xC0000032].", BlockNumber));
                        }
                    }
                    else
                    {
                        if (ReturnedDataBlock != null)
                        {
                            if (MapEmptyDataBlock)
                            {
                                this.StfsMapEmptyDataBlock(BlockNumber, ref ReturnedDataBlock, ref DataBlockCacheIndex);
                            }
                            else
                            {
                                ReturnedDataBlock = this.StfsMapWriteableDataBlock(BlockNumber, hashEntry, ref DataBlockCacheIndex);
                            }
                        }
                        ReturnedBlockNumber = BlockNumber;
                    }
                }
                else
                {
                    if (hashEntry.Level0.State == StfsHashEntryLevel0State.Allocated || hashEntry.Level0.State == StfsHashEntryLevel0State.Pending)
                    {
                        if (ReturnedDataBlock != null)
                        {
                            int ret = this.StfsMapEmptyDataBlock(BlockNumber, ref ReturnedDataBlock, ref DataBlockCacheIndex);
                        }

                        hashEntry.LevelAsUINT |= 0xC0000000;
                        //hashEntry.Level0.State = StfsHashEntryLevel0State.Pending;
                        ReturnedBlockNumber = BlockNumber;
                    }
                    else
                    {
                        throw new Exception(string.Format("trying to update unallocated block 0x{0:x8} [0xC0000032].", BlockNumber));
                    }
                }
            }
            else
            {
                throw new Exception(string.Format("The byte offset supplied for a block update was farther than the file's [{0}] allocated block length.", Fcb.FileName));
            }
        }
        public void StfsEndDataBlockUpdate(byte[] DataBlock, int DataBlockCacheIndex, uint BlockNumber, ref StfsHashBlock HashBlock, int hashBockCacheIndex)
        {
            if (DataBlock.Length != Block) // data blocks in STFS must be 0x1000 in size
                throw new Exception("Invalid data block buffer length found.");

            // check to make sure the block numbe is not greater than the allocated block count
            if (BlockNumber > this.VolumeExtension.NumberOfTotalBlocks)
                throw new Exception("Invalid block number found before attempting to update it.");

            // hash the data block we are writing
            HashBlock.SetHashForEntry(BlockNumber, HorizonCrypt.SHA1(DataBlock));

            HashBlock.Save();

            this.StfsDereferenceBlock(DataBlockCacheIndex);
            this.StfsDereferenceBlock(hashBockCacheIndex);
        }

        private StfsHashBlock StfsMapReadableHashBlock(uint BlockNum, int RequestedLevel, ref int CacheIndex)
        {
            int CurrentLevel = 0, NewLevel = 0;
            StfCacheElement element = null;
            StfHashEntry hashEntry = null;

            bool ShouldMapNewHashBlock = false;

            if (BlockNum <= this.VolumeExtension.NumberOfTotalBlocks)
            {
                if (RequestedLevel <= this.VolumeExtension.RootHashHierarchy)
                {
                    CurrentLevel = RequestedLevel + 1;
                    NewLevel = RequestedLevel;
                    if (!this.StfsMapExistingBlock(BlockNum, CurrentLevel, ref CacheIndex, ref element))
                    {
                        do
                        {
                            if (NewLevel == this.VolumeExtension.RootHashHierarchy)
                            {
                                ShouldMapNewHashBlock = true;
                                break;
                            }
                            NewLevel = CurrentLevel;
                            CurrentLevel = NewLevel + 1;

                        } while (!this.StfsMapExistingBlock(BlockNum, CurrentLevel, ref CacheIndex, ref element));

                        if (!ShouldMapNewHashBlock && NewLevel == RequestedLevel)
                        {
                            goto STFS_RETURN_HASHBLOCK;
                        }

                        hashEntry = this.VolumeExtension.RootHashEntry;

                        do
                        {
                            if (!ShouldMapNewHashBlock)
                            {
                                if (NewLevel != RequestedLevel)
                                {
                                    using (var hashBlock = new StfsHashBlock(this.VolumeExtension.BlockCache.Data[CacheIndex]))
                                    {
                                        hashEntry = hashBlock.RetrieveHashEntry(BlockNum / this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[((NewLevel - 1))]);
                                    }

                                    if ((element.State & 4) == 0)
                                    {
                                        hashEntry.LevelAsUINT &= 0x7FFFFFFF;
                                    }

                                    this.StfsDereferenceBlock(CacheIndex);

                                    NewLevel--;
                                }
                            }

                            this.StfsMapNewBlock(BlockNum, NewLevel + 1, hashEntry, ref CacheIndex, ref element);

                            if ((hashEntry.LevelAsUINT & 0x80000000) != 0)
                                element.State |= 4;

                            ShouldMapNewHashBlock = false;

                        } while (NewLevel != RequestedLevel);
                    }
                }
            }
        STFS_RETURN_HASHBLOCK:
            return new StfsHashBlock(new EndianIO(new MemoryStream(this.VolumeExtension.BlockCache.Data[CacheIndex]), EndianType.BigEndian, true));
        }
        private StfsHashBlock StfsMapWriteableHashBlock(uint BlockNumber, int RequestedLevel, bool MapEmptyHashBlock, ref int BlockCacheIndex)
        {
            int CurrentLevel = this.VolumeExtension.RootHashHierarchy, CacheBlockIndex = -1, oldCacheIndex = -1;

            StfHashEntry hashEntry = this.VolumeExtension.RootHashEntry;
            StfsHashBlock hashBlock = null, oldHashBlock = null;
            StfCacheElement element = null;
            uint blockNum = 0xffffffff;
            do
            {
                if (MapEmptyHashBlock && (CurrentLevel == RequestedLevel))
                {
                    byte[] DataBlock = null;

                    this.StfsMapNewEmptyBlock(CurrentLevel + 1, BlockNumber, ref element, ref DataBlock, ref CacheBlockIndex);

                    hashEntry.LevelAsUINT = (hashEntry.LevelAsUINT & 0x3FFFFFFF) | 0x80000000;
                }
                else if (!this.StfsMapExistingBlock(BlockNumber, CurrentLevel + 1, ref CacheBlockIndex, ref element))
                {
                    if (!this.StfsMapNewBlock(BlockNumber, CurrentLevel + 1, hashEntry, ref CacheBlockIndex, ref element))
                    {
                        throw new Exception("Failed to map writeable hash block.");
                    }
                }
                hashBlock = new StfsHashBlock(new EndianIO(new MemoryStream(this.VolumeExtension.BlockCache.Data[CacheBlockIndex]), EndianType.BigEndian, true));

                if (((hashEntry.LevelAsUINT >> 25 ^ element.State) & 0x20) != 0)
                {
                    throw new Exception("You went on the wrong Paper Trail.");
                }

                if ((hashEntry.LevelAsUINT & 0x80000000) == 0)
                {
                    if ((element.State & 0x40) != 0)
                    {
                        throw new Exception("Detected an invalid cache element state while mapping a write-able hash block.");
                    }

                    uint notState = (~hashEntry.LevelAsUINT >> 30) & 1;
                    uint NewState = (uint)(0x80000000 | ((notState << 30) & 0x40000000));
                    int elementState = element.State;
                    uint temp = ((uint)(element.State & 0xDF) | (uint)(notState << 5));
                    element.State = (byte)(temp & 0xff);
                    hashEntry.LevelAsUINT = (hashEntry.LevelAsUINT & 0x3FFFFFFF) | NewState;

                    if (CurrentLevel == 0)
                    {
                        for (int x = 0; x < 0xaa; x++)
                        {
                            StfHashEntry Level0HashEntry = hashBlock.RetrieveHashEntry(x);
                            switch (Level0HashEntry.Level0.State)
                            {
                                case StfsHashEntryLevel0State.FreedPending:
                                    Level0HashEntry.LevelAsUINT &= 0x3FFFFFFF;
                                    //hashEntry.Level0.State = StfsHashEntryLevel0State.Unallocated;
                                    break;
                                case StfsHashEntryLevel0State.Pending:
                                    Level0HashEntry.LevelAsUINT &= 0x3FFFFFFF;
                                    Level0HashEntry.LevelAsUINT |= 0x80000000;
                                    //hashEntry.Level0.State = StfsHashEntryLevel0State.Allocated;
                                    break;
                                default:
                                    break;
                            }
                        }
                    }
                    else
                    {
                        // Convert free-pending blocks to free blocks
                        for (int x = 0; x < 0xAA; x++)
                        {
                            StfHashEntry LevelNashEntry = hashBlock.RetrieveHashEntry(x);
                            uint level = LevelNashEntry.LevelAsUINT;
                            level &= 0x7FFFFFFF;
                            uint pendingBlocks = level >> 15;
                            uint allocState = level & 0xC0000000;
                            level += pendingBlocks;
                            level &= 0x7FFF;
                            level |= allocState;
                            LevelNashEntry.LevelAsUINT = level;
                        }
                    }

                    hashBlock.Save();
                }

                if (oldHashBlock != null)
                {
                    oldHashBlock = new StfsHashBlock(new EndianIO(new MemoryStream(this.VolumeExtension.BlockCache.Data[oldCacheIndex]), EndianType.BigEndian, true));
                    oldHashBlock.SetLevelForEntry(blockNum, hashEntry.LevelAsUINT);
                    oldHashBlock.Save();
                }

                element.State |= 0x44;

                element.State = (byte)(((element.State & ~8) | (((Convert.ToInt32(this.VolumeExtension.InAllocationSupport) << 3) & 8))) & 0xFF);

                if ((element.State & 0x10) == 0)
                {
                    element.State |= 0x10;
                    if (oldCacheIndex != -1)
                    {
                        this.StfsReferenceBlock(oldCacheIndex);
                    }
                }

                if (oldCacheIndex != -1)
                {
                    this.StfsDereferenceBlock(oldCacheIndex);
                }

                if (RequestedLevel != CurrentLevel)
                {
                    oldHashBlock = hashBlock;

                    oldCacheIndex = CacheBlockIndex;

                    blockNum = BlockNumber / this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[CurrentLevel - 1];

                    hashEntry = oldHashBlock.RetrieveHashEntry(blockNum);

                    CurrentLevel--;
                }
                else
                {
                    break;
                }

            } while (true);

            if (this.VolumeExtension.BlockCache.Data[CacheBlockIndex] == null || this.VolumeExtension.BlockCache.Data[CacheBlockIndex].Length == 0)
                throw new Exception("Could not map a valid writeable hash block.");

            BlockCacheIndex = CacheBlockIndex;

            return new StfsHashBlock(new EndianIO(new MemoryStream(this.VolumeExtension.BlockCache.Data[CacheBlockIndex]), EndianType.BigEndian, true));
        }

        public byte[] StfsMapReadableDataBlock(uint BlockNumber, ref int BlockCacheIndex)
        {
            if (BlockNumber > this.VolumeExtension.NumberOfTotalBlocks)
                throw new Exception("Requested block number was outside of range.");

            int CacheIndex = 0;
            StfCacheElement element = null;
            if (!this.StfsMapExistingBlock(BlockNumber, 0, ref BlockCacheIndex, ref element))
            {
                using (var hashBlock = this.StfsMapReadableHashBlock(BlockNumber, 0, ref CacheIndex))
                {
                    if (!this.StfsMapNewBlock(BlockNumber, 0, hashBlock.RetrieveHashEntry(BlockNumber), ref BlockCacheIndex, ref element))
                    {
                        throw new Exception("Failed to map a readable data block.");
                    }
                }

                this.StfsDereferenceBlock(CacheIndex);
            }

            if (this.VolumeExtension.BlockCache.Data[BlockCacheIndex].Length == 0 || this.VolumeExtension.BlockCache.Data[CacheIndex] == null)
            {
                throw new Exception("Could not map a valid read-able data block.");
            }

            return this.VolumeExtension.BlockCache.Data[BlockCacheIndex];
        }
        public byte[] StfsMapWriteableDataBlock(uint BlockNumber, StfHashEntry hashEntry, ref int DataBlockCacheIndex)
        {
            if (BlockNumber > this.VolumeExtension.NumberOfTotalBlocks)
                throw new Exception("Requested block number was outside of range.");

            StfCacheElement element = null;

            if (!this.StfsMapExistingBlock(BlockNumber, 0, ref DataBlockCacheIndex, ref element))
            {
                if (!this.StfsMapNewBlock(BlockNumber, 0, hashEntry, ref DataBlockCacheIndex, ref element))
                {
                    throw new Exception("Failed to map a writeable data block.");
                }
            }
            if (element.BlockNumber != BlockNumber && element.Referenced != 1)
            {
                throw new Exception("Invalid cache element returned for a mapped block.");
            }
            element.State |= 0x40;

            if (this.VolumeExtension.BlockCache.Data[DataBlockCacheIndex].Length == 0 || this.VolumeExtension.BlockCache.Data[DataBlockCacheIndex] == null)
            {
                throw new Exception("Could not map a valid write-able data block.");
            }

            return this.VolumeExtension.BlockCache.Data[DataBlockCacheIndex];
        }

        private byte[] StfsMapWriteableCopyOfDataBlock(uint BlockNumber, uint SourceBlockNumber, ref StfHashEntry SourceHashEntry, ref int DataBlockCacheIndex)
        {
            if (this.VolumeExtension.ReadOnly)
            {
                throw new Exception("Attempted to map a writeable data block on a read-only device.");
            }
            else if (BlockNumber >= this.VolumeExtension.NumberOfTotalBlocks)
            {
                throw new Exception("Attempted to map a writeable data block with a block number greater than the total allocated for this device.");
            }

            this.StfsDiscardBlock(BlockNumber, 0);

            int blockCacheIndex = -1;
            StfCacheElement element = null;
            if (!this.StfsMapExistingBlock(SourceBlockNumber, 0, ref blockCacheIndex, ref element))
            {
                if (!this.StfsMapNewBlock(SourceBlockNumber, 0, SourceHashEntry, ref blockCacheIndex, ref element))
                {
                    throw new Exception("Failed to map a new block [Writeable copy].");
                }
            }
            if (element.BlockNumber != SourceBlockNumber)
            {
                throw new Exception("Mapped a cache element with a mismatched block number.");
            }
            else if (element.Referenced != 1)
            {
                throw new Exception("Mapped a cache element with an invalid amount of references.");
            }
            else if ((element.State & 0x40) != 0)
            {
                throw new Exception("Detected a cache element with an invalid state.");
            }
            element.BlockNumber = BlockNumber;
            element.State |= 0x40;
            DataBlockCacheIndex = blockCacheIndex;
            return this.VolumeExtension.BlockCache.Data[blockCacheIndex];
        }

        private StfCacheElement StfsBlockCacheElementFromBlock(int BlockCaheIndex)
        {
            return this.VolumeExtension.ElementCache.RetrieveElement(BlockCaheIndex);
        }

        private bool StfsMapExistingDataBlock(uint BlockNum, ref int BlockCacheIndex)
        {
            StfCacheElement element = null;
            return this.StfsMapExistingBlock(BlockNum, 0, ref BlockCacheIndex, ref element);
        }
        private bool StfsMapExistingBlock(uint BlockNum, int ElementType, ref int BlockCacheIndex, ref StfCacheElement Element)
        {
            if (!this.StfsLookupBlockCacheEntry(BlockNum, ElementType, ref Element, ref BlockCacheIndex))
            {
                return false;
            }
            if (Element != null)
            {
                this.StfsMoveBlockCacheEntry(BlockCacheIndex, true);

                if (Element.Referenced == 0xff)
                {
                    throw new Exception("Invalid cache element detected with a bad reference count.");
                }

                Element.Referenced++;

                return true; // success
            }
            else
            {
                BlockCacheIndex = -1;
                return false; // failure
            }
        }
        private bool StfsMapNewBlock(uint BlockNumber, int ElementType, StfHashEntry HashEntry, ref int BlockCacheIndex, ref StfCacheElement Element)
        {
            uint NewBlockNum, ActiveIndex = 0;

            if (ElementType != 0)
            {
                BlockNumber = (BlockNumber - (BlockNumber % this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[ElementType - 1]));
                NewBlockNum = StfsComputeLevelNBackingHashBlockNumber(BlockNumber, ElementType - 1);
                ActiveIndex = (HashEntry.LevelAsUINT >> 30) & 1;
            }
            else
            {
                NewBlockNum = StfsComputeBackingDataBlockNumber(BlockNumber);
            }

            this.StfsAllocateBlockCacheEntry(ref BlockCacheIndex, ref Element);

            this.VolumeExtension.BlockCache.Data[BlockCacheIndex] = this.StfsSynchronousReadFile(NewBlockNum, 0x1000, ActiveIndex);

            byte[] Hash = HorizonCrypt.SHA1(this.VolumeExtension.BlockCache.Data[BlockCacheIndex]);

            if (this.Debug)
            {
                if (!HorizonCrypt.ArrayEquals(Hash, HashEntry.Hash))
                {
                    throw new Exception(string.Format("hash mismatch for block number 0x{0:x8}:{1:d}.", BlockNumber, ElementType));
                }
            }

            this.StfsMoveBlockCacheEntry(BlockCacheIndex, true);

            Element.BlockNumber = BlockNumber;

            Element.State = (byte)((((Element.State & 0xDC) | ((int)((0x1F80 | (ActiveIndex << 5) & 0x20)))) | (ElementType & 3)) & 0xFF);

            Element.Referenced = 1;

            if (this.VolumeExtension.BlockCache.Data[BlockCacheIndex] != null || this.VolumeExtension.BlockCache.Data[BlockCacheIndex].Length > 0)
            {
                return true; // success
            }
            else
            {
                return false; // failure
            }
        }

        private int StfsMapEmptyHashBlock(uint BlockNumber, object RequestedLevel, ref StfHashEntry hashEntry, ref StfsHashBlock ReturnedHashBlock, ref int BlockCacheIndex)
        {
            StfCacheElement cacheElement = null;
            byte[] DataBlock = null;

            int errorCode = this.StfsMapNewEmptyBlock(Convert.ToInt32(RequestedLevel) + 1, BlockNumber, ref cacheElement, ref DataBlock, ref BlockCacheIndex);
            if (errorCode < 0)
            {
                return errorCode;
            }

            ReturnedHashBlock = new StfsHashBlock(DataBlock);

            if (hashEntry != null)
            {
                hashEntry.LevelAsUINT &= 0x3FFFFFFF;
                hashEntry.LevelAsUINT |= 0x80000000;
                cacheElement.State |= 0x04;
            }

            return 0;
        }
        private int StfsMapEmptyDataBlock(uint BlockNumber, ref byte[] DataBlock, ref int BlockCacheIndex)
        {
            if (DataBlock != null && DataBlock.Length != 0x1000)
                throw new Exception("Invalid data block supplied for new data block mapping.");

            StfCacheElement element = null;

            return this.StfsMapNewEmptyBlock(0, BlockNumber, ref element, ref DataBlock, ref BlockCacheIndex);
        }
        private int StfsMapNewEmptyBlock(int ElementType, uint BlockNumber, ref StfCacheElement element, ref byte[] DataBlock, ref int BlockCacheIndex)
        {
            if (!this.StfsLookupBlockCacheEntry(BlockNumber, ElementType, ref element, ref BlockCacheIndex))
            {
                int ret = this.StfsAllocateBlockCacheEntry(ref BlockCacheIndex, ref element);
                if (ret < 0)
                    return ret;
            }

            if (ElementType > 0)
            {
                BlockNumber = BlockNumber - (BlockNumber % this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[ElementType - 1]);
            }

            element.BlockNumber = BlockNumber;

            Array.Clear(this.VolumeExtension.BlockCache.Data[BlockCacheIndex], 0, 0x1000);

            DataBlock = this.VolumeExtension.BlockCache.Data[BlockCacheIndex];

            this.StfsMoveBlockCacheEntry(BlockCacheIndex, true);

            element.BlockNumber = BlockNumber;

            int State = (element.State & ~3) | (ElementType & 3);

            State = (int)((State & ~0xFFFFFFE0) | ((3 << 6) & 0xFFFFFFE0));

            element.State = (byte)State;

            if (element.Referenced == 0xff)
            {
                throw new Exception("Invalid cache element detected while mapping a new empty block.");
            }
            element.Referenced++;

            return 0;
        }

        private void StfsReferenceBlock(int BlockCacheIndex)
        {
            if (BlockCacheIndex < this.VolumeExtension.ElementCache.CacheElementCount)
            {
                StfCacheElement cacheElement = this.VolumeExtension.ElementCache.RetrieveElement(BlockCacheIndex);

                if (cacheElement.Referenced != 0 && cacheElement.Referenced != 0xff)
                {
                    cacheElement.Referenced++;
                }
                else
                {
                    throw new Exception("Attempted to reference an invalid cache element.");
                }
            }
        }
        private void StfsDereferenceBlock(int BlockCacheIndex)
        {
            if (BlockCacheIndex < this.VolumeExtension.ElementCache.CacheElementCount)
            {
                StfCacheElement cacheElement = this.VolumeExtension.ElementCache.RetrieveElement(BlockCacheIndex);

                if (cacheElement.Referenced == 0)
                {
                    throw new Exception("Attempted to dereference an invalid cache element.");
                }
                else
                {
                    cacheElement.Referenced += 0xff;
                }
            }
        }

        private void StfsDiscardBlock(uint BlockNumber, int ElementType)
        {
            StfCacheElement element = null;
            int BlockCacheIndex = -1;

            if (this.StfsLookupBlockCacheEntry(BlockNumber, ElementType, ref element, ref BlockCacheIndex))
            {
                if (element.Referenced != 0)
                {
                    throw new Exception("Invalid cache element found while discarding block.");
                }

                if ((element.State & 0x10) != 0x0)
                {
                    if (ElementType != (this.VolumeExtension.RootHashHierarchy + 1))
                    {
                        StfCacheElement elementTwo = null;
                        int secondBlockCacheIndex = -1;

                        this.StfsLookupBlockCacheEntry(BlockNumber, ElementType + 1, ref elementTwo, ref secondBlockCacheIndex);

                        if (elementTwo.Referenced == 0 || (elementTwo.State & 0x40) == 0)
                        {
                            throw new Exception("Invalid cache element found while discarding block.");
                        }
                        this.StfsDereferenceBlock(secondBlockCacheIndex);
                    }
                }

                element.State = 0;

                this.StfsMoveBlockCacheEntry(BlockCacheIndex, false);
            }
        }

        private void StfsMoveBlockCacheEntry(int BlockCacheIndex, bool MoveToHead)
        {
            if (BlockCacheIndex != this.VolumeExtension.CacheHeadIndex)
            {
                var element = this.VolumeExtension.ElementCache.RetrieveElement(this.VolumeExtension.CacheHeadIndex);
                if (element.BlockCacheIndex != BlockCacheIndex)
                {
                    element = this.VolumeExtension.ElementCache.RetrieveElement(BlockCacheIndex);

                    this.VolumeExtension.ElementCache.RetrieveElement(element.BlockCacheIndex).Index = element.Index;
                    this.VolumeExtension.ElementCache.RetrieveElement(element.Index).BlockCacheIndex = element.BlockCacheIndex;

                    element.Index = this.VolumeExtension.CacheHeadIndex;

                    var headElement = this.VolumeExtension.ElementCache.RetrieveElement(this.VolumeExtension.CacheHeadIndex);

                    element.BlockCacheIndex = headElement.BlockCacheIndex;
                    this.VolumeExtension.ElementCache.RetrieveElement(headElement.BlockCacheIndex).Index = BlockCacheIndex;

                    headElement.BlockCacheIndex = BlockCacheIndex;
                }

                if (MoveToHead)
                {
                    this.VolumeExtension.CacheHeadIndex = BlockCacheIndex;
                }
            }
            else
            {
                if (!MoveToHead)
                {
                    this.VolumeExtension.CacheHeadIndex = this.VolumeExtension.ElementCache.RetrieveElement(this.VolumeExtension.CacheHeadIndex).Index;
                }
            }
        }
        private bool StfsLookupBlockCacheEntry(uint BlockNumber, int ElementType, ref StfCacheElement element, ref int BlockCacheIndex)
        {
            if (ElementType != 0)
            {
                BlockNumber = (BlockNumber - (BlockNumber % this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[ElementType - 1]));
            }

            int idx = this.VolumeExtension.CacheHeadIndex;

            do
            {
                element = this.VolumeExtension.ElementCache.RetrieveElement(idx);

                if ((element.State & 0x80) != 0)
                {
                    if (element.BlockNumber == BlockNumber && element.ElementType == ElementType)
                    {
                        BlockCacheIndex = idx;
                        return true;

                    }
                    if (element.Index == this.VolumeExtension.CacheHeadIndex)
                        return false;

                    idx = element.Index;
                }
                else
                {
                    return false;
                }

            } while (true);
        }
        private int StfsAllocateBlockCacheEntry(ref int BlockCacheIndex, ref StfCacheElement Element)
        {
            int idx = this.VolumeExtension.ElementCache.RetrieveElement(this.VolumeExtension.CacheHeadIndex).BlockCacheIndex;
            int elementIndex = idx;
            do
            {
                var element = this.VolumeExtension.ElementCache.RetrieveElement(elementIndex);

                if (element.Referenced != 0)
                {
                    if (element.BlockCacheIndex == idx)
                    {
                        throw new Exception("block cache overcommitted. [0xC00000E5]");
                    }
                    elementIndex = element.BlockCacheIndex;
                }
                else
                {
                    if ((element.State & 0x40) != 0)
                    {
                        if ((element.State & 8) != 0)
                        {
                            this.StfsFlushInAllocationSupportBlocks();
                        }
                        else
                        {
                            this.StfsFlushBlockCacheEntry(elementIndex, ref element);
                        }
                        if ((element.State & 0x40) != 0)
                        {
                            throw new Exception("Invalid cache element detected.");
                        }
                    }

                    element.State = 0x00;

                    this.StfsMoveBlockCacheEntry(elementIndex, false);

                    if (element.Referenced != 0)
                    {
                        throw new Exception("Invalid cache element detected.");
                    }

                    BlockCacheIndex = elementIndex;
                    Element = element;

                    return 0;
                }
            } while (true);
        }

        private void StfsResetBlockCache()
        {
            uint CacheElementCount = this.VolumeExtension.BlockCacheElementCount;
            this.VolumeExtension.ElementCache = new StfsCacheElement(CacheElementCount);
            this.VolumeExtension.BlockCache = new StfsCacheBlock(CacheElementCount);

            this.VolumeExtension.ElementCache.Cache[0].BlockCacheIndex = ((byte)CacheElementCount + 0xFF) & 0xff;
            this.VolumeExtension.ElementCache.Cache[(int)CacheElementCount - 1].Index = 0;
            this.VolumeExtension.CacheHeadIndex = 0;
        }
        private void StfsResetWriteableBlockCache()
        {
            for (var x = 0; x < this.VolumeExtension.BlockCacheElementCount; x++)
            {
                this.VolumeExtension.ElementCache.Cache[x].State &= 0xFB;
            }
        }

        private void StfsFlushBlockCacheEntry(int BlockCacheIndex, ref StfCacheElement BlockCacheElement)
        {
            uint BlockNumber = BlockCacheElement.BlockNumber, NewBlockNum = 0;
            int ElementType = BlockCacheElement.ElementType, CacheIndex = -1;
            if (ElementType != 0)
            {
                NewBlockNum = StfsComputeLevelNBackingHashBlockNumber(BlockNumber, ElementType - 1);
            }
            else
            {
                NewBlockNum = StfsComputeBackingDataBlockNumber(BlockNumber);
            }
            if ((BlockCacheElement.State & 0x10) != 0x0)
            {
                byte[] Hash = HorizonCrypt.SHA1(this.VolumeExtension.BlockCache.Data[BlockCacheIndex]);

                if (this.VolumeExtension.RootHashHierarchy + 1 != ElementType)
                {
                    StfCacheElement element = null;
                    if (!this.StfsLookupBlockCacheEntry(BlockNumber, ElementType + 1, ref element, ref CacheIndex))
                    {
                        throw new Exception("Could the not find requested cache entry to flush.");
                    }

                    if (element.Referenced == 0)
                    {
                        throw new Exception("Illegal reference count detected while flushing cache entry.");
                    }

                    if ((element.State & 0x40) == 0)
                    {
                        throw new Exception("Invalid element state detected while flushing cache entry.");
                    }

                    StfsHashBlock hashBlock = new StfsHashBlock(new EndianIO(this.VolumeExtension.BlockCache.Data[CacheIndex], EndianType.BigEndian, true));
                    BlockNumber = BlockNumber / this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[ElementType - 1];
                    hashBlock.SetHashForEntry(BlockNumber, Hash);
                    hashBlock.Save();

                    this.StfsDereferenceBlock(CacheIndex);
                }
                else
                {
                    this.VolumeExtension.RootHashEntry.Hash = Hash;
                }
                BlockCacheElement.State &= 0xEF;
            }
            this.StfsSynchronousWriteFile(NewBlockNum, (BlockCacheElement.State >> 5) & 1, this.VolumeExtension.BlockCache.Data[BlockCacheIndex], 0x1000);

            BlockCacheElement.State &= 0xBF;
        }
        public void StfsFlushBlockCache(uint StartingBlockNumber, uint EndingBlockNumber)
        {
            int Hierarchy = EndingBlockNumber == 0xffffffff ? this.VolumeExtension.RootHashHierarchy + 1 : 0, i = 0;
            do
            {
                for (int x = 0; x < this.VolumeExtension.BlockCacheElementCount; x++)
                {
                    StfCacheElement element = this.VolumeExtension.ElementCache.RetrieveElement(x);

                    if (element.ElementType == i)
                    {
                        if (element.Referenced == 0 && (element.State & 0x40) != 0
                            && element.BlockNumber >= StartingBlockNumber && element.BlockNumber <= EndingBlockNumber)
                        {
                            this.StfsFlushBlockCacheEntry(x, ref element);
                        }
                    }
                }

            } while (++i <= Hierarchy);
        }
        private void StfsFlushInAllocationSupportBlocks()
        {
            if (!this.VolumeExtension.InAllocationSupport)
            {
                throw new Exception("Attempted to flush blocks without in-allocation support.");
            }

            int idx = this.VolumeExtension.CacheHeadIndex, idx2 = this.VolumeExtension.ElementCache.RetrieveElement(idx).BlockCacheIndex;
            StfCacheElement element = null;
            do
            {
                element = this.VolumeExtension.ElementCache.RetrieveElement(idx2);

                if (element.Referenced == 0)
                {
                    if ((element.State & 0x48) != 0)
                    {
                        this.StfsFlushBlockCacheEntry(idx2, ref element);
                    }
                }
                if (idx2 == idx)
                {
                    break;
                }
                idx2 = element.BlockCacheIndex;

            } while (true);
        }
        private void StfsFlushUpdateDirectoryEntries()
        {
            for (int x = 0; x < this.Fcbs.Count; x++)
            {
                StfsFcb fcb = Fcbs[x];
                if ((fcb.State & 0x10) != 0)
                {
                    this.StfsUpdateDirectoryEntry(fcb, false);
                }
                if ((fcb.State & 0x10) != 0)
                {
                    throw new Exception(string.Format("Detected an invalid state after updating the directory entry for file {0}.", Fcbs[x].FileName));
                }
            }
        }

        private byte[] StfsSynchronousReadFile(uint BlockNumber, uint Length, object ActiveIndex)
        {
            this.IO.In.BaseStream.Position = this.VolumeExtension.BackingFileOffset + GetBlockOffset(BlockNumber, Convert.ToInt32(ActiveIndex));

            return this.IO.In.ReadBytes(Length);
        }
        private void StfsSynchronousWriteFile(uint BlockNumber, object ActiveIndex, byte[] DataBlock, uint DataLength)
        {
            if (!this.VolumeExtension.CannotExpand)
            {
                this.StfsExtendBackingFileSize((uint)((DataBlock.Length >> 12) + (BlockNumber + Convert.ToUInt32(ActiveIndex))));
            }

            this.IO.Out.BaseStream.Position = this.VolumeExtension.BackingFileOffset + GetBlockOffset(BlockNumber, Convert.ToInt32(ActiveIndex));

            this.IO.Out.Write(DataBlock, DataLength);

            this.IO.Stream.Flush();
        }
        public uint StfsComputeBackingDataBlockNumber(uint BlockNum)
        {
            uint num1 = (((BlockNum + this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[0]) / this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[0])
                << this.VolumeExtension.FormatShift) + BlockNum;
            if (BlockNum < this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[0])
                return num1;
            num1 = (((BlockNum + this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[1]) / this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[1])
                    << this.VolumeExtension.FormatShift) + num1;
            if (BlockNum < this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[1])
                return num1;
            return (uint)(num1 + (1 << this.VolumeExtension.FormatShift));
        }
        public uint StfsComputeLevelNBackingHashBlockNumber(uint BlockNum, int RequestedLevel)
        {
            uint num1, num2, num3 = (uint)(1 << this.VolumeExtension.FormatShift);
            switch (RequestedLevel)
            {
                case 0:
                    num1 = (BlockNum / this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[0]);
                    num2 = num1 * this.VolumeExtension.BlockValues[0];
                    if (num1 == 0)
                        return num2;
                    num1 = (BlockNum / this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[1]);
                    num2 += (num1 + 1) << this.VolumeExtension.FormatShift;
                    if (num1 == 0)
                        return num2;
                    return num2 + num3;
                case 1:
                    num1 = (BlockNum / this.VolumeExtension.StfsDataBlocksPerHashTreeLevel[1]);
                    num2 = num1 * this.VolumeExtension.BlockValues[1];

                    if (num1 == 0)
                        return num2 + this.VolumeExtension.BlockValues[0];

                    return num2 + num3;
                case 2:
                    return this.VolumeExtension.BlockValues[1];
            }
            return 0xffffff;
        }

        public static uint StfsComputeNumberOfDataBlocks(ulong NumberOfBackingBlocks)
        {
            ulong num1 = NumberOfBackingBlocks, num3, num4;
            if (num1 > 0x4BDA85)
                return 0x4AF768;

            ulong num2 = 0xAC;
            if (num1 < 0x723A)
            {
                if (num1 >= 0xAC)
                {
                    num1 -= 2;
                    if (num1 <= 0xB0)
                    {
                        num1 = num2;
                    }
                }
            }
            else if (num1 > 0x723A)
            {
                num1 -= 2;
                num4 = 0x723a;
                if (num1 + 2 <= 0x7240)
                {
                    num1 = num4;
                }
                num3 = num1 / num4;
                num3 = num3 * 0x723a;
                num3 = num1 - num3;
                if (num3 <= 4)
                {
                    num1 = num1 - num3;
                }
                num3 = num1 + 0x7239;
                num3 = num3 / num4;
                num3 = num3 << 1;
                num1 = num1 - num3;
            }
            num3 = num1 / num2;
            num3 = num3 * 0xAC;
            num3 = num1 - num3;
            if (num3 <= 2)
            {
                num1 = num1 - num3;
            }
            num3 = num1 + 0xAB;
            num3 = num3 / num2;
            num3 = num3 << 1;

            return (uint)(num1 - num3);
        }

        public static DateTime StfsTimeStampToDatetime(StfsTimeStamp Timestamp)
        {
            return new DateTime(Timestamp.Year, Timestamp.Month, Timestamp.Day, Timestamp.Hour, Timestamp.Minute, Timestamp.DoubleSeconds / 2);
        }
        public static StfsTimeStamp StfsDateTimeToTimeStamp(DateTime Time)
        {
            StfsTimeStamp timestamp = new StfsTimeStamp();
            timestamp.Year = Time.Year;
            timestamp.Month = Time.Month;
            timestamp.Day = Time.Day;
            timestamp.Hour = Time.Hour;
            timestamp.Minute = Time.Minute;
            timestamp.DoubleSeconds = Time.Second * 2;
            return timestamp;
        }

        /// <summary>
        /// Seperates a string by the path, '\\', seperator.
        /// </summary>
        /// <param name="String">The string to be seperated.</param>
        /// <returns>A string array containing all the seperated strings.</returns>
        public static string[] BreakStringByPath(string String)
        {
            return String.Split('\\');
        }
        /// <summary>
        /// Rounds a value to the nearest STFS block size ( = 0x1000 )
        /// </summary>
        /// <param name="value">The value to round</param>
        /// <returns>The value rounded to 4096.</returns>
        public static uint RoundToBlock(uint value)
        {
            return (value + 0xFFF) & 0xFFFFF000;
        }
    }

    public class StfsFileStream : Stream
    {
        public StfsDirectoryEntry DirectoryEntry;
        public StfsFcb Fcb;
        public StfsDevice Device;

        public override bool CanSeek { get { return true; } }
        public override bool CanRead { get { return true; } }
        public override bool CanWrite { get { return true; } }
        public override long Length { get { return this.Fcb.Filesize; } }

        private uint _position;

        public override long Position
        {
            get { return _position; }
            set
            {
                Seek(value, SeekOrigin.Begin);
            }
        }
        public StfsFileStream(StfsDevice stfsDevice, string Filename, FileMode fileMode) : this(stfsDevice, Filename, fileMode, false) { }
        public StfsFileStream(StfsDevice stfsDevice, string Filename, FileMode fileMode, bool IfContains)
        {
            this.Device = stfsDevice;
            this.DirectoryEntry = new StfsDirectoryEntry();

            var Name = StfsDevice.BreakStringByPath(Filename);
            StfsFcb parentFcb = this.Device.DirectoryFcb;

            this.Device.StfsReferenceFcb(parentFcb);

            switch (fileMode)
            {
                case FileMode.CreateNew:

                    for (var i = 0; i < Name.Length; i++)
                    {
                        if (StfsDevice.StfsIsValidFileName(Name[i]))
                        {
                            uint dwRet = this.Device.StfsLookupElementNameInDirectory(Name[i], parentFcb, ref this.DirectoryEntry);
                            if (dwRet == 0)
                            {
                                this.Fcb = this.Device.StfsCreateFcb(this.DirectoryEntry, parentFcb);
                            }
                            else
                            {
                                this.Fcb = this.Device.StfsCreateNewFile(parentFcb, Name[i], i != (Name.Length - 1) ? 1 : 0, 0, ref this.DirectoryEntry);
                            }

                            this.Device.StfsReferenceFcb(this.Fcb);

                            parentFcb = (i != (Name.Length - 1)) ? this.Fcb : parentFcb;
                        }
                        else
                        {
                            throw new Exception(string.Format("Invalid filename detected while creating {0}. [0xC0000033].", Filename));
                        }
                    }

                    break;
                case FileMode.Create:

                    break;
                case FileMode.Open:

                    if (!Filename.Contains("*"))
                    {
                        for (int x = 0; x < Name.Length; x++)
                        {
                            if (StfsDevice.StfsIsValidFileName(Name[x]))
                            {
                                uint dwReturn = this.Device.StfsLookupElementNameInDirectory(Name[x], parentFcb, ref this.DirectoryEntry, IfContains);

                                if (dwReturn != 0)
                                {
                                    throw new Exception(string.Format("Could not find {0} in directory.", Name[x]));
                                }

                                this.Fcb = this.Device.StfsCreateFcb(this.DirectoryEntry, parentFcb);

                                this.Device.StfsReferenceFcb(this.Fcb);

                                parentFcb = (x != (Name.Length - 1)) ? this.Fcb : parentFcb;
                            }
                            else
                            {
                                throw new Exception(string.Format("Invalid filename detected while opening {0}. [0xC0000033].", Filename));
                            }
                        }
                    }
                    else
                    {
                        for (int x = 0; x < Name.Length; x++)
                        {
                            if (StfsDevice.StfsIsValidFileName((x == (Name.Length - 1)) ? Name[x].Split("*")[0] : Name[x]))
                            {
                                uint dwReturn = 0;
                                if (x != (Name.Length - 1))
                                {
                                    dwReturn = this.Device.StfsLookupElementNameInDirectory(Name[x], parentFcb, ref this.DirectoryEntry);
                                }
                                else
                                {
                                    dwReturn = this.Device.StfsFindNextDirectoryEntry(parentFcb, 0x00, Name[x].Split("*")[0], ref DirectoryEntry);
                                }
                                if (dwReturn != 0)
                                {
                                    throw new Exception(string.Format("Could not find {0} in directory.", Name[x]));
                                }
                                this.Fcb = this.Device.StfsCreateFcb(this.DirectoryEntry, parentFcb);

                                this.Device.StfsReferenceFcb(this.Fcb);

                                parentFcb = (x != (Name.Length - 1)) ? this.Fcb : parentFcb;
                            }
                            else
                            {
                                throw new Exception(string.Format("Invalid filename detected while opening {0}. [0xC0000033].", Filename));
                            }
                        }
                    }

                    break;
                case FileMode.OpenOrCreate:
                    break;
                case FileMode.Truncate:
                    break;
                case FileMode.Append:
                    break;
                default:
                    break;
            }

        }
        public StfsFileStream(StfsDevice stfsDevice, int FileEntryIndex)
        {
            this.Device = stfsDevice;
            this.DirectoryEntry = new StfsDirectoryEntry();
            var FileName = new StringBuilder();

            int DirectoryIndex = FileEntryIndex;

            do
            {
                var Filename = this.Device.DirectoryEntries[DirectoryIndex].FileName;
                DirectoryIndex = this.Device.DirectoryEntries[DirectoryIndex].DirectoryIndex;
                FileName.Insert(0, DirectoryIndex != 0xFFFF ? "\\" + Filename : "" + Filename);
            } while (DirectoryIndex != 0xFFFF);

            var Name = StfsDevice.BreakStringByPath(FileName.ToString());
            StfsFcb parentFcb = this.Device.DirectoryFcb;

            this.Device.StfsReferenceFcb(parentFcb);

            for (int x = 0; x < Name.Length; x++)
            {
                if (StfsDevice.StfsIsValidFileName(Name[x]))
                {
                    uint dwReturn = this.Device.StfsLookupElementNameInDirectory(Name[x], parentFcb, ref this.DirectoryEntry);

                    if (dwReturn != 0)
                    {
                        throw new Exception(string.Format("Could not find {0} in directory.", Name[x]));
                    }

                    this.Fcb = this.Device.StfsCreateFcb(this.DirectoryEntry, parentFcb);

                    this.Device.StfsReferenceFcb(this.Fcb);

                    parentFcb = (x != (Name.Length - 1)) ? this.Fcb : parentFcb;
                }
                else
                {
                    throw new Exception(string.Format("Invalid filename detected while opening {0}. [0xC0000033].", FileName.ToString()));
                }
            }
        }

        public override long Seek(long offset, SeekOrigin origin)
        {
            switch (origin)
            {
                case SeekOrigin.Begin:
                    _position = (uint)offset;
                    break;
                case SeekOrigin.Current:
                    _position += (uint)offset;
                    break;
                case SeekOrigin.End:
                    _position = this.Fcb.Filesize - (uint)offset;
                    break;
            }

            return _position;
        }
        public override int Read(byte[] buffer, int offset, int count)
        {
            uint Remainder = (uint)this.Length - _position;
            if (Remainder == 0) return 0x00;

            if (count > 0 && !this.Fcb.IsDirectory)
            {
                var writer = new EndianWriter(buffer, EndianType.BigEndian);

                uint FullSize = (uint)(_position + count);

                if (count > Remainder)
                {
                    count = (int)Remainder;
                }

                if (FullSize > Fcb.ValidAllocBlocks)
                {
                    this.Device.StfsFullyCachedRead(this.Fcb, _position, count, writer);
                }
                else
                {
                    bool FullyCachedRead = this.Device.StfsTestForFullyCachedIo(this.Fcb, _position, count);

                    if (FullyCachedRead)
                    {
                        this.Device.StfsFullyCachedRead(this.Fcb, _position, count, writer);
                    }
                    else
                    {
                        this.Device.StfsPartiallyCachedRead(this.Fcb, _position, (uint)count, writer);
                    }
                }

                _position += (uint)count;

                writer.Close();
            }

            return count;
        }
        public override void Write(byte[] buffer, int offset, int count)
        {
            if (count > 0)
            {
                if (this.Device.StfsEnsureWriteableDirectoryEntry(this.Fcb) == 0)
                {
                    uint length = (uint)(_position + count);
                    uint roundedLength = (length + 0xFFF) & 0xFFFFF000;

                    if (roundedLength > _position)
                    {
                        this.Device.StfsEnsureWriteableBlocksAvailable(this.Fcb, (uint)count, _position);
                    }

                    if (length > Fcb.AllocationBlocks)
                    {
                        this.Device.StfsSetAllocationSize(this.Fcb, roundedLength, false);
                    }

                    uint blockOffset = _position & 0xFFFFF000;

                    while (Fcb.ValidAllocBlocks < blockOffset)
                    {
                        int hashBlockCacheIndex = -1, datablockCacheIndex = -1;
                        StfsHashBlock hashBlock = null;
                        byte[] DataBlock = new byte[0x1000];
                        uint returnedBlockNum = 0xffffffff;

                        this.Device.StfsBeginDataBlockUpdate(this.Fcb, ref hashBlock, ref hashBlockCacheIndex, Fcb.ValidAllocBlocks, ref DataBlock, ref datablockCacheIndex, true, ref returnedBlockNum);

                        this.Device.StfsEndDataBlockUpdate(DataBlock, datablockCacheIndex, returnedBlockNum, ref hashBlock, hashBlockCacheIndex);

                        Fcb.ValidAllocBlocks += 0x1000;
                    }

                    bool FullyCachedWrite = this.Device.StfsTestForFullyCachedIo(this.Fcb, _position, count);

                    if (FullyCachedWrite)
                    {
                        this.Device.StfsFullyCachedWrite(this.Fcb, _position, count, buffer);
                    }
                    else
                    {
                        this.Device.StfsPartiallyCachedWrite(this.Fcb, _position, (uint)count, buffer);
                    }

                    _position += (uint)count;

                    if (Fcb.Filesize < length)
                    {
                        Fcb.Filesize = length;
                    }

                    this.Fcb.LastWriteTimeStamp = StfsDevice.StfsDateTimeToTimeStamp(DateTime.Now);

                    this.Fcb.State |= 0x10;
                }
                else
                {
                    throw new Exception("Could not ensure that the directory entry is writable.");
                }
            }
        }
        public override void Flush()
        {
            this.Device.StfsFlushBlockCache(0, 0xffffffff);
            if ((this.Fcb.State & 0x10) != 0)
            {
                this.Device.StfsUpdateDirectoryEntry(this.Fcb, false);
            }
        }
        public override void SetLength(long value)
        {
            uint NewLength = (uint)(value);
            this.Device.StfsSetAllocationSize(this.Fcb, NewLength, false);
            this.Device.StfsSetEndOfFileInformation(this.Fcb, NewLength);
        }
        public override void Close()
        {
            if ((this.Fcb.State & 0x08) != 0)
            {
                this.Device.StfsUpdateDirectoryEntry(this.Fcb, true);

                if (!this.Fcb.IsDirectory)
                {
                    StfHashEntry hashEntry = null;
                    this.Device.StfsFreeBlocks(this.Fcb.FirstBlockNumber, false, ref hashEntry);
                }
            }
            else
            {
                if ((this.Fcb.State & 0x10) != 0)
                {
                    this.Device.StfsUpdateDirectoryEntry(this.Fcb, false);
                }
            }

            if (this.Fcb.Referenced != 0x00)
            {
                this.Device.StfsDereferenceFcb(this.Fcb);
            }
        }

        public uint SetInformation(WinFile.FileInformationClass _FileInformationClass, object FileInformation)
        {
            uint dwReturn = 0x00000000;
            switch (_FileInformationClass)
            {
                case WinFile.FileInformationClass.FileBasicInformation:
                    break;
                case WinFile.FileInformationClass.FileRenameInformation:
                    if ((this.Fcb.State & 0x04) == 0)
                    {
                        var RenameInformation = (WinFile.FileRenameInformation)FileInformation;
                        this.Device.StfsSetRenameInformation(this.Fcb, RenameInformation);
                    }
                    else
                    {
                        dwReturn = 0xC000000D;
                    }
                    break;
                case WinFile.FileInformationClass.FileDispositionInformation:
                    if ((this.Fcb.State & 0x04) == 0)
                    {
                        var DispositionInfo = (WinFile.FileDispositionInformation)FileInformation;
                        this.Device.StfsSetDispositionInformation(this.Fcb, DispositionInfo);
                    }
                    else
                    {
                        dwReturn = 0xC000000D;
                    }
                    break;
                //case FileInformationClass.FilePositionInformation: // Seek
                //case FileInformationClass.FileAllocationInformation: // Set Length
                case WinFile.FileInformationClass.FileEndOfFileInformation:
                    if (!this.Fcb.IsDirectory)
                    {
                        var EofInfo = (WinFile.FileEndOfFileInfo)FileInformation;
                        if (EofInfo.EndOfFile.HighPart == 0)
                        {
                            this.Device.StfsSetEndOfFileInformation(this.Fcb, EofInfo.EndOfFile.LowPart);
                        }
                        else
                        {
                            dwReturn = 0xC000007F;
                        }
                    }
                    else
                    {
                        dwReturn = 0xC000000D;
                    }
                    break;
                default:
                    dwReturn = 0xC000000D;
                    break;
            }

            return dwReturn;
        }

        /// <summary>
        /// Write the file to a byte array.
        /// </summary>
        /// <returns>The entire file as a byte array.</returns>
        public byte[] ToArray()
        {
            // create a byte array to hold the file
            Position = 0x00;
            byte[] _buffer = new byte[Fcb.Filesize];
            // read the file's data into a buffer
            Read(_buffer, 0, _buffer.Length);
            // return a buffer containing the file
            return _buffer;
        }
    }
}