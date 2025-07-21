using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.IO;
using System.Threading;

namespace XContent
{
    public class SvodContentPackage
    {
        public EndianIO IO { get; set; }
        private XContentPackage Package;
        public SvodDeviceDescriptor DeviceDescriptor;

        public SvodContentPackage(EndianIO IO, XContentPackage Package)
        {
            this.IO = IO;
            this.Package = Package;
            this.DeviceDescriptor = Package.Header.Metadata.SvodDeviceDescriptor;
        }
        public void ExtractPackage(string DataDirectory, string oufilename)
        {
            SvodWorker worker = new SvodWorker(DataDirectory);

            FileStream fs = new FileStream(oufilename, FileMode.Create);
            fs.SetLength(((long)this.DeviceDescriptor.NumberOfDataBlocks * (long)0x1000));
            EndianWriter ew = new EndianWriter(fs, EndianType.BigEndian);
            ew.BaseStream.Position = 0;
            for (var x = 0; x < this.Package.Header.Metadata.DataFiles; x++)
            {
                EndianReader er = worker.IOs[x].In;
                SvodLevel1HashBlock lv1 = new SvodLevel1HashBlock(er);
                uint count = lv1.LoadedBlockCount();

                for (var j = 0; j < count; j++)
                {
                    SvodLevel0HashBlock lv0 = new SvodLevel0HashBlock(er);
                    uint count2 = lv0.LoadedBlockCount();

                    for (var i = 0; i < count2; i++)
                    {
                        ew.Write(er.ReadBytes(0x1000));
                    }
                }
            }
            ew.Close();
        }

    }
    public class SvodWorker
    {
        public string DataFile;
        public List<EndianIO> IOs;
        public EndianIO IO;

        public SvodWorker(string DataFileDirectory)
        {
            IOs = new List<EndianIO>();
            string[] Files = Directory.GetFiles(DataFileDirectory);
            Array.Sort(Files);
            foreach (var io in Files.Select(file => new EndianIO(file, EndianType.BigEndian)))
            {
                io.Open();
                IOs.Add(io);
            }
        }
        public void Seek(object Position)
        {
            Seek(Convert.ToInt64(Position));
        }
        private string FormatDataFilename(int Index)
        {
            return string.Format("\\Data{0}", Index.ToString("0000"));
        }
    }
}