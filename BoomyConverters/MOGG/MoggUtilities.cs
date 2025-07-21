using System;
using System.IO;

namespace BoomyConverters.Mogg
{
    public static class MoggValidator
    {
        public static bool ValidateMoggFile(string moggFilePath)
        {
            try
            {
                using var file = new FileStream(moggFilePath, FileMode.Open, FileAccess.Read);
                using var reader = new BinaryReader(file);

                if (file.Length < 8)
                {
                    Console.WriteLine("Invalid MOGG file: Too short");
                    return false;
                }

                // Read header
                int oggVersion = reader.ReadInt32();
                int fileOffset = reader.ReadInt32();

                Console.WriteLine($"MOGG Version: 0x{oggVersion:X}");
                Console.WriteLine($"Audio Offset: {fileOffset} bytes");

                if (oggVersion != 0xA)
                {
                    Console.WriteLine($"Warning: Unexpected OGG version 0x{oggVersion:X}, expected 0x{0xA:X}");
                }

                if (fileOffset < 8 || fileOffset > file.Length)
                {
                    Console.WriteLine($"Invalid file offset: {fileOffset}");
                    return false;
                }

                // Read map data
                int mapSize = fileOffset - 8;
                if (mapSize < 12)
                {
                    Console.WriteLine("Invalid map size: Too small for header");
                    return false;
                }

                var mapData = reader.ReadBytes(mapSize);
                var map = LoadMapFromBytes(mapData);

                if (map == null)
                {
                    Console.WriteLine("Failed to parse OGG map");
                    return false;
                }

                Console.WriteLine($"Map entries: {map.NumEntries}");
                Console.WriteLine($"Chunk size: {map.ChunkSize}");
                Console.WriteLine($"Map version: 0x{map.Version:X}");

                // Validate audio data exists
                long remainingBytes = file.Length - fileOffset;
                Console.WriteLine($"Audio data: {remainingBytes} bytes");

                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error validating MOGG file: {ex.Message}");
                return false;
            }
        }

        public static OggMap? LoadMapFromBytes(byte[] data)
        {
            try
            {
                if (data.Length < 12)
                    return null;

                using var ms = new MemoryStream(data);
                using var reader = new BinaryReader(ms);

                var map = new OggMap
                {
                    Version = reader.ReadInt32(),
                    ChunkSize = reader.ReadInt32(),
                    NumEntries = reader.ReadInt32()
                };

                if (data.Length < 12 + (map.NumEntries * 8))
                    return null;

                for (int i = 0; i < map.NumEntries; i++)
                {
                    var bytes = reader.ReadUInt32();
                    var samples = reader.ReadUInt32();
                    map.Entries.Add(new OggMapEntry(bytes, samples));
                }

                return map;
            }
            catch
            {
                return null;
            }
        }

        public static void PrintMoggInfo(string moggFilePath)
        {
            Console.WriteLine($"Analyzing MOGG file: {moggFilePath}");
            Console.WriteLine(new string('=', 50));

            if (ValidateMoggFile(moggFilePath))
            {
                Console.WriteLine("✓ MOGG file is valid");
            }
            else
            {
                Console.WriteLine("✗ MOGG file has issues");
            }
        }
    }

    public static class MoggExtractor
    {
        public static int ExtractAudioFromMogg(string moggFilePath, string outputOggPath)
        {
            try
            {
                using var moggFile = new FileStream(moggFilePath, FileMode.Open, FileAccess.Read);
                using var reader = new BinaryReader(moggFile);
                using var outputFile = new FileStream(outputOggPath, FileMode.Create, FileAccess.Write);

                // Read header
                int oggVersion = reader.ReadInt32();
                int fileOffset = reader.ReadInt32();

                Console.WriteLine($"Extracting audio from offset {fileOffset}...");

                // Seek to audio data
                moggFile.Seek(fileOffset, SeekOrigin.Begin);

                // Copy audio data
                var buffer = new byte[8192];
                int bytesRead;
                long totalCopied = 0;

                while ((bytesRead = moggFile.Read(buffer, 0, buffer.Length)) > 0)
                {
                    outputFile.Write(buffer, 0, bytesRead);
                    totalCopied += bytesRead;
                }

                Console.WriteLine($"Extracted {totalCopied} bytes to {outputOggPath}");
                return 0;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error extracting audio: {ex.Message}");
                return 1;
            }
        }
    }
}
