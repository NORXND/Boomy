using System;
using System.Collections.Generic;
using System.IO;

namespace BoomyConverters.Mogg
{
    public struct OggMapEntry
    {
        public uint Bytes { get; set; }
        public uint Samples { get; set; }

        public OggMapEntry(uint bytes, uint samples)
        {
            Bytes = bytes;
            Samples = samples;
        }
    }

    public class OggMap
    {
        public int Version { get; set; } = 0x10;
        public int ChunkSize { get; set; } = 20000;
        public int NumEntries { get; set; }
        public List<OggMapEntry> Entries { get; set; } = new List<OggMapEntry>();

        public static OggMapResult Create(Stream dataSource, IOggCallbacks callbacks)
        {
            dataSource.Seek(0, SeekOrigin.Begin);

            var initResult = VorbisDecoder.Initialize(dataSource, callbacks);
            if (!initResult.Success)
            {
                return new OggMapResult { Success = false, ErrorMessage = $"Could not init vorbis: {initResult.ErrorMessage}" };
            }

            var map = new OggMap();
            ComputeMap(initResult.VorbisState, map);

            VorbisDecoder.Free(initResult.VorbisState);

            return new OggMapResult { Success = true, Map = map };
        }

        private static void ComputeMap(VorbisState vs, OggMap map)
        {
            const uint SEEK_INCREMENT = 0x8000;
            long totalSamples = 0;
            var seekTable = new List<long>();

            // Record the sample offset for every seek increment, and keep track
            // of the total number of samples in the file.
            uint currentOffset = 0;
            uint packetNum = 0;

            while (VorbisDecoder.Next(vs) == VorbisResult.OK)
            {
                totalSamples = vs.CurrentPage.GranulePos;

                if (vs.CurrentPageStart >= currentOffset &&
                    vs.CurrentPacketStart >= currentOffset &&
                    vs.CurrentPacketStart >= vs.CurrentPageStart)
                {
                    seekTable.Add(vs.NextSample);
                    currentOffset += SEEK_INCREMENT;
                }
                packetNum++;
            }

            // Create a map entry of the closest offset for every chunk_size samples in the song.
            long moggEntries = (totalSamples + (map.ChunkSize - 1)) / map.ChunkSize;

            for (long i = 0; i < moggEntries; i++)
            {
                uint desiredPosition = (uint)(i * map.ChunkSize);
                uint currentBytes = 0;
                uint currentSamples = 0;

                for (int j = 0; j < seekTable.Count && seekTable[j] < desiredPosition; j++)
                {
                    currentBytes = (uint)(j * SEEK_INCREMENT);
                    currentSamples = (uint)seekTable[j];
                }

                map.Entries.Add(new OggMapEntry(currentBytes, currentSamples));
            }

            map.NumEntries = map.Entries.Count;
        }

        public int GetLength()
        {
            return 12 + (Entries.Count * 8);
        }

        // Not endian-safe - assumes little endian
        public byte[] Serialize()
        {
            var result = new byte[GetLength()];

            using (var ms = new MemoryStream(result))
            using (var writer = new BinaryWriter(ms))
            {
                writer.Write(Version);
                writer.Write(ChunkSize);
                writer.Write(NumEntries);

                foreach (var entry in Entries)
                {
                    writer.Write(entry.Bytes);
                    writer.Write(entry.Samples);
                }
            }

            return result;
        }
    }

    public class OggMapResult
    {
        public bool Success { get; set; }
        public string ErrorMessage { get; set; } = string.Empty;
        public OggMap? Map { get; set; }
    }
}
