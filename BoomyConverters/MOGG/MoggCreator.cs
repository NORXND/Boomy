using System;

using System;
using System.IO;

namespace BoomyConverters.Mogg
{
    public static class MoggCreator
    {
        private const int COPY_BUFFER_SIZE = 8192;
        private const int OGG_VERSION = 0xA;

        public static int CreateMoggFile(string inputOggPath, string outputMoggPath)
        {
            try
            {
                // Open input file
                if (!File.Exists(inputOggPath))
                {
                    return Fail("Could not open input file");
                }

                using var infile = new FileStream(inputOggPath, FileMode.Open, FileAccess.Read);
                using var outfile = new FileStream(outputMoggPath, FileMode.Create, FileAccess.Write);

                // Create OggMap using NVorbis implementation
                var result = NVorbisOggMap.CreateFromVorbisStream(infile);
                if (!result.Success || result.Map == null)
                {
                    Console.WriteLine($"Error creating OggMap\n{result.ErrorMessage}");
                    return 1;
                }

                var map = result.Map;
                var mapData = map.Serialize();

                // Write MOGG header
                int fileOffset = 8 + mapData.Length;

                // Move BinaryWriter into a using to ensure it's disposed *before* stream is reused
                using (var writer = new BinaryWriter(outfile, System.Text.Encoding.UTF8, leaveOpen: true))
                {
                    writer.Write(OGG_VERSION);
                    writer.Write(fileOffset);
                    writer.Write(mapData);
                    writer.Flush();
                }

                // Seek outfile to fileOffset before writing audio data
                outfile.Seek(fileOffset, SeekOrigin.Begin);
                infile.Seek(0, SeekOrigin.Begin);
                CopyStreamData(infile, outfile);

                return 0;
            }
            catch (Exception ex)
            {
                return Fail($"Error creating MOGG file: {ex.Message}");
            }

        }

        public static int CreateMoggFileFromStreams(Stream inputOggStream, Stream outputMoggStream)
        {
            try
            {
                // Create OggMap
                var result = NVorbisOggMap.CreateFromVorbisStream(inputOggStream);
                if (!result.Success || result.Map == null)
                {
                    Console.WriteLine($"Error creating OggMap\n{result.ErrorMessage}");
                    return 1;
                }

                var map = result.Map;
                var mapData = map.Serialize();

                // Write MOGG header
                int fileOffset = 8 + mapData.Length;

                var writer = new BinaryWriter(outputMoggStream, System.Text.Encoding.UTF8, leaveOpen: true);
                writer.Write(OGG_VERSION);
                writer.Write(fileOffset);
                writer.Write(mapData);
                writer.Flush();

                // Seek outputMoggStream to fileOffset before writing audio data
                outputMoggStream.Seek(fileOffset, SeekOrigin.Begin);
                inputOggStream.Seek(0, SeekOrigin.Begin);
                CopyStreamData(inputOggStream, outputMoggStream);

                return 0;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error creating MOGG file: {ex.Message}");
                return 1;
            }
        }

        public static int ExtractOggFromMogg(string inputMoggPath, string outputOggPath)
        {
            try
            {
                if (!File.Exists(inputMoggPath))
                {
                    return Fail("Could not open input file");
                }

                using var infile = new FileStream(inputMoggPath, FileMode.Open, FileAccess.Read);
                using var reader = new BinaryReader(infile);

                // Read header: OGG_VERSION (int32), fileOffset (int32)
                int version = reader.ReadInt32();
                int fileOffset = reader.ReadInt32();

                if (version != OGG_VERSION)
                {
                    return Fail($"Invalid MOGG version: {version}");
                }

                // Seek to the start of the OGG data
                infile.Seek(fileOffset, SeekOrigin.Begin);

                using var outfile = new FileStream(outputOggPath, FileMode.Create, FileAccess.Write);
                CopyStreamData(infile, outfile);

                Console.WriteLine($"Successfully extracted OGG file: {outputOggPath}");
                return 0;
            }
            catch (Exception ex)
            {
                return Fail($"Error extracting OGG from MOGG: {ex.Message}");
            }
        }

        private static void CopyStreamData(Stream input, Stream output)
        {
            var buffer = new byte[COPY_BUFFER_SIZE];
            int bytesRead;

            do
            {
                bytesRead = input.Read(buffer, 0, COPY_BUFFER_SIZE);
                if (bytesRead > 0)
                {
                    output.Write(buffer, 0, bytesRead);
                }
            } while (bytesRead > 0);
        }

        private static int Fail(string message)
        {
            Console.WriteLine($"Error: {message}");
            return 1;
        }
    }
}
