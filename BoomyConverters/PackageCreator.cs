using XContent;

namespace BoomyConverters.PackageCreator
{
    public static class PackageCreator
    {
        public static void CreatePackage(string inputFolder, string outputPackage, string name, string description)
        {
            XContent.XContentPackage package = new();
            XContent.XContentMetadata meta = new()
            {
                ContentType = ContentTypes.Marketplace,
                ContentSize = 0, // Will be updated dynamically
                ConsoleId = new byte[] { 0x00, 0x00, 0x00, 0x00, 0x00 },
                Creator = 0x0000000000000000,
                DisplayNames = new string[] { name, name, name, name, name, name, name, name, name },
                Descriptions = new string[] { description, description, description, description, description, description, description, description, description },
                Publisher = "Boomy",
                TitleName = "Dance Central 3",
                ThumbnailSize = 0,
                TitleThumbnailSize = 0,
                ExecutionId = new()
                {
                    TitleId = 0x373307D9,
                },
            };

            // Call the XContent builder to create the package
            package.CreatePackage(outputPackage, meta);

            foreach (var file in Directory.GetFiles(inputFolder, "*", SearchOption.AllDirectories))
            {
                byte[] fileData = File.ReadAllBytes(file);
                string relativePath = Path.GetRelativePath(inputFolder, file);

                // Use CreateFileFromArray to add files to the package
                package.StfsContentPackage.CreateFileFromArray(relativePath, fileData);

                meta.ContentSize += (ulong)fileData.Length;
            }

            package.Flush();
            package.Save();
        }
    }
}