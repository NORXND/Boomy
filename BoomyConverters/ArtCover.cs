using BCnEncoder.Decoder;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using BCnEncoder.Encoder;
using BCnEncoder.ImageSharp;
using BCnEncoder.Shared;

namespace BoomyConverters.ArtCover
{
    public static class PngToXboxHmxConverter
    {
        public static async Task ConvertXboxToPngAsync(string xboxFile, string outputPngFile)
        {
            if (string.IsNullOrEmpty(xboxFile) || !File.Exists(xboxFile))
                throw new FileNotFoundException($"Xbox PNG not found: {xboxFile}");
            if (string.IsNullOrEmpty(outputPngFile))
                throw new ArgumentException("Output path must be non‐empty", nameof(outputPngFile));

            // 1) Read the input file
            byte[] fileBytes = await File.ReadAllBytesAsync(xboxFile);
            if (fileBytes.Length < 32)
                throw new InvalidDataException("File too small to be a valid HMX PNG");

            // 2) Identify header and image size
            int headerSize = 32;
            byte[] header = new byte[headerSize];
            Array.Copy(fileBytes, 0, header, 0, headerSize);

            // Heuristically determine texture size from header (matches ImageHeaders)
            int width = 0, height = 0;
            if (header[7] == 0x00 && header[8] == 0x04 && header[9] == 0x00) { width = 1024; height = 1024; }
            else if (header[7] == 0x00 && header[8] == 0x08 && header[9] == 0x00) { width = 2048; height = 2048; }
            else if (header[7] == 0x00 && header[8] == 0x01 && header[9] == 0x00) { width = 256; height = 256; }
            else if (header[7] == 0x00 && header[8] == 0x02 && header[9] == 0x00) { width = 512; height = 512; }
            else
                throw new InvalidDataException("Unknown or unsupported HMX header (cannot determine size)");

            // 3) Prepare DDS header (BC3/DXT5, mipmaps assumed)
            int ddsHeaderSize = 128;
            int ddsDataSize = fileBytes.Length - headerSize;
            byte[] ddsBytes = new byte[ddsHeaderSize + ddsDataSize];

            // Use the correct header from ImageHeaders
            var headers = new ImageHeaders();
            byte[] ddsHeader;
            if (width == 256 && height == 256)
                ddsHeader = headers.RB3_256x256_DXT5;
            else if (width == 512 && height == 512)
                ddsHeader = headers.RB3_512x512_DXT5;
            else if (width == 1024 && height == 1024)
                ddsHeader = headers.NEMO_1024x1024_DXT5;
            else if (width == 2048 && height == 2048)
                ddsHeader = headers.NEMO_2048x2048_DXT5;
            else
                throw new InvalidDataException("Unsupported texture size for DDS header");
            Array.Copy(ddsHeader, 0, ddsBytes, 0, ddsHeaderSize);

            // 4) Swap bytes back to little-endian for each 4-byte block
            for (int i = 0; i < ddsDataSize; i += 4)
            {
                if (i + 4 > ddsDataSize) break;
                ddsBytes[ddsHeaderSize + i + 0] = fileBytes[headerSize + i + 1];
                ddsBytes[ddsHeaderSize + i + 1] = fileBytes[headerSize + i + 0];
                ddsBytes[ddsHeaderSize + i + 2] = fileBytes[headerSize + i + 3];
                ddsBytes[ddsHeaderSize + i + 3] = fileBytes[headerSize + i + 2];
            }

            // 5) Decode DDS to PNG using ImageSharp + BCnEncoder
            using var ddsStream = new MemoryStream(ddsBytes);
            var decoder = new BcDecoder();
            using var image = decoder.DecodeToImageRgba32(ddsStream);
            await image.SaveAsPngAsync(outputPngFile);
        }

        public static async Task ConvertAsync(
            string pngFile,
            string outputFile)
        {
            if (string.IsNullOrEmpty(pngFile) || !File.Exists(pngFile))
                throw new FileNotFoundException($"PNG not found: {pngFile}");
            if (string.IsNullOrEmpty(outputFile))
                throw new ArgumentException("Output path must be non‐empty", nameof(outputFile));

            // 1) Load PNG
            using var image = Image.Load<Rgba32>(pngFile);

            // Get texture size from image (assuming square images)
            int textureSize = Math.Max(image.Width, image.Height);

            // 2) Encode to in‐memory DDS (always BC3/DXT5)
            var encoder = new BcEncoder();
            encoder.OutputOptions.GenerateMipMaps = true;
            encoder.OutputOptions.Format = CompressionFormat.Bc3;
            var dds = encoder.EncodeToDds(image);

            using var ddsMem = new MemoryStream();
            dds.Write(ddsMem);
            var ddsBytes = ddsMem.ToArray();

            // 3) Prepare header lookup
            var headers = new ImageHeaders();
            byte[] hmxHeader;

            // For album art/cover images, use the no-mip version for 256x256
            switch (textureSize)
            {
                case 256:
                    hmxHeader = headers.RB3_256x256_DXT5;
                    break;
                case 512:
                    hmxHeader = headers.RB3_512x512_DXT5;
                    break;
                case 1024:
                    hmxHeader = headers.NEMO_1024x1024_DXT5;
                    break;
                case 2048:
                    hmxHeader = headers.NEMO_2048x2048_DXT5;
                    break;
                default:
                    throw new ArgumentException(
                        $"Unsupported texture size: {textureSize}. " +
                        "Expected one of 256, 512, 1024, 2048.");
            }

            // 4) Strip the first 128 bytes (DDS header), then prepend HMX header and swap bytes
            const int DdsHeaderSize = 128;
            int blockCount = (ddsBytes.Length - DdsHeaderSize) / 4;

            using var input = new MemoryStream(ddsBytes, DdsHeaderSize, ddsBytes.Length - DdsHeaderSize);
            using var output = new FileStream(outputFile, FileMode.Create, FileAccess.Write);

            // Write the HMX header first
            output.Write(hmxHeader, 0, hmxHeader.Length);

            var buffer = new byte[4];
            var swapped = new byte[4];
            for (int i = 0; i < blockCount; i++)
            {
                if (input.Read(buffer, 0, 4) != 4)
                    break;

                // Xbox requires swapping each 2‐byte word
                swapped[0] = buffer[1];
                swapped[1] = buffer[0];
                swapped[2] = buffer[3];
                swapped[3] = buffer[2];

                output.Write(swapped, 0, 4);
            }
        }
    }

    public class ImageHeaders
    {
        public readonly byte[] RB3_256x256_DXT1 =
        {
            0x01, 0x04, 0x08, 0x00, 0x00, 0x00, 0x04, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        };

        public readonly byte[] RB3_256x256_DXT5 =
        {
            0x01, 0x08, 0x18, 0x00, 0x00, 0x00, 0x04, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        };

        public readonly byte[] RB3_256x256_DXT5_NOMIP =
        {
            0x01, 0x08, 0x18, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        };

        public readonly byte[] RB3_256x512_DXT5_NOMIP =
        {
            0x01, 0x08, 0x18, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x02, 0x00, 0x01, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        };

        public readonly byte[] RB3_512x512_DXT1 =
        {
            0x01, 0x04, 0x08, 0x00, 0x00, 0x00, 0x05, 0x00, 0x02, 0x00, 0x02, 0x00, 0x01, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        };

        public readonly byte[] RB3_512x512_DXT5 =
        {
            0x01, 0x08, 0x18, 0x00, 0x00, 0x00, 0x05, 0x00, 0x02, 0x00, 0x02, 0x00, 0x02, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        };

        public readonly byte[] NEMO_1024x1024_DXT1 =
        {
            0x01, 0x04, 0x08, 0x00, 0x00, 0x00, 0x05, 0x00, 0x04, 0x00, 0x04, 0x00, 0x04, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        };

        public readonly byte[] NEMO_1024x1024_DXT5 =
        {
            0x01, 0x08, 0x18, 0x00, 0x00, 0x00, 0x05, 0x00, 0x04, 0x00, 0x04, 0x00, 0x04, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        };

        public readonly byte[] NEMO_2048x2048_DXT1 =
        {
            0x01, 0x04, 0x08, 0x00, 0x00, 0x00, 0x06, 0x00, 0x08, 0x00, 0x08, 0x00, 0x08, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        };

        public readonly byte[] NEMO_2048x2048_DXT5 =
        {
            0x01, 0x08, 0x18, 0x00, 0x00, 0x00, 0x06, 0x00, 0x08, 0x00, 0x08, 0x00, 0x08, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        };
    }
}