namespace WinFile
{
    public enum FileInformationClass
    {
        FileBasicInformation,
        FileRenameInformation,
        FileDispositionInformation,
        FileEndOfFileInformation
    }

    public class FileDispositionInformation
    {
        public bool DeleteFile { get; set; }
    }

    public class FileRenameInformation
    {
        public string? NewName { get; set; }
        public string? FileName { get; set; }
        public int FileNameLength { get; set; }
    }

    public class FileEndOfFileInfo
    {
        public LargeInteger? EndOfFile { get; set; }
    }

    public class LargeInteger
    {
        public uint HighPart { get; set; }
        public uint LowPart { get; set; }
        public long QuadPart
        {
            get { return ((long)HighPart << 32) | (uint)LowPart; }
            set
            {
                HighPart = (uint)(value >> 32);
                LowPart = (uint)(value & 0xFFFFFFFF);
            }
        }
    }
}
