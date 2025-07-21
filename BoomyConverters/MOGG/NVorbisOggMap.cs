using System;
using System.Collections.Generic;
using System.IO;
using NVorbis;

namespace BoomyConverters.Mogg
{
    public class NVorbisOggMap
    {
        public int Version { get; set; } = 0x10;
        public int ChunkSize { get; set; } = 20000;
        public int NumEntries { get; set; }
        public List<OggMapEntry> Entries { get; set; } = new List<OggMapEntry>();

        public static OggMapResult CreateFromVorbisFile(string oggFilePath)
        {
            try
            {
                using var fileStream = new FileStream(oggFilePath, FileMode.Open, FileAccess.Read);
                return CreateFromVorbisStream(fileStream);
            }
            catch (Exception ex)
            {
                return new OggMapResult
                {
                    Success = false,
                    ErrorMessage = $"Error opening file: {ex.Message}"
                };
            }
        }

        public static OggMapResult CreateFromVorbisStream(Stream oggStream)
        {
            try
            {
                using var vorbisReader = new VorbisReader(oggStream, false);

                var map = new NVorbisOggMap();
                ComputeMapFromVorbis(vorbisReader, map, oggStream);

                return new OggMapResult
                {
                    Success = true,
                    Map = ConvertToOggMap(map)
                };
            }
            catch (Exception ex)
            {
                return new OggMapResult
                {
                    Success = false,
                    ErrorMessage = $"Error processing Vorbis stream: {ex.Message}"
                };
            }
        }

        private static void ComputeMapFromVorbis(VorbisReader vorbisReader, NVorbisOggMap map, Stream oggStream)
        {
            const uint SEEK_INCREMENT = 0x8000;
            var seekTable = new List<SeekPoint>();

            long totalSamples = vorbisReader.TotalSamples;
            int sampleRate = vorbisReader.SampleRate;

            // Build seek table by sampling positions throughout the file
            uint currentOffset = 0;
            long currentSample = 0;

            while (currentSample < totalSamples)
            {
                // Try to seek to this sample position
                try
                {
                    vorbisReader.SamplePosition = currentSample;
                    long actualPosition = vorbisReader.SamplePosition;

                    // Get the byte position (approximation)
                    double progress = (double)actualPosition / totalSamples;
                    long estimatedBytePos = (long)(progress * oggStream.Length);

                    seekTable.Add(new SeekPoint
                    {
                        ByteOffset = (uint)Math.Min(estimatedBytePos, uint.MaxValue),
                        SampleOffset = actualPosition
                    });

                    currentOffset += SEEK_INCREMENT;
                    currentSample = Math.Min(totalSamples, currentSample + SEEK_INCREMENT);
                }
                catch
                {
                    // If seeking fails, increment and try next position
                    currentSample += SEEK_INCREMENT;
                }
            }

            // Create map entries for every chunk_size samples
            long moggEntries = (totalSamples + (map.ChunkSize - 1)) / map.ChunkSize;

            for (long i = 0; i < moggEntries; i++)
            {
                long desiredSample = i * map.ChunkSize;
                uint closestBytes = 0;
                uint closestSamples = 0;

                // Find the closest seek point
                foreach (var seekPoint in seekTable)
                {
                    if (seekPoint.SampleOffset <= desiredSample)
                    {
                        closestBytes = seekPoint.ByteOffset;
                        closestSamples = (uint)seekPoint.SampleOffset;
                    }
                    else
                    {
                        break;
                    }
                }

                map.Entries.Add(new OggMapEntry(closestBytes, closestSamples));
            }

            map.NumEntries = map.Entries.Count;
        }

        private static OggMap ConvertToOggMap(NVorbisOggMap nvMap)
        {
            return new OggMap
            {
                Version = nvMap.Version,
                ChunkSize = nvMap.ChunkSize,
                NumEntries = nvMap.NumEntries,
                Entries = new List<OggMapEntry>(nvMap.Entries)
            };
        }

        public int GetLength()
        {
            return 12 + (Entries.Count * 8);
        }

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

        private struct SeekPoint
        {
            public uint ByteOffset { get; set; }
            public long SampleOffset { get; set; }
        }
    }
}
