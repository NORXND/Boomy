using BoomyBuilder.Builder;

namespace BoomyBuilder
{
    public class Program
    {
        public static async Task<int> Main(string[] args)
        {
            try
            {
                string inputJson;
                if (args.Length > 0 && File.Exists(args[0]))
                {
                    inputJson = await File.ReadAllTextAsync(args[0]);
                }
                else
                {
                    // Read from stdin
                    using var reader = new StreamReader(Console.OpenStandardInput());
                    inputJson = await reader.ReadToEndAsync();
                }

                BuildOperator buildOperator = new(inputJson);
                var result = buildOperator.Build();
                var output = new { success = true, result };
                Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(output));
                return 0;
            }
            catch (Exception ex)
            {
                var output = new { success = false, error = ex is BoomyException ? ex.Message : ex.ToString() };
                Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(output));
                return 1;
            }
        }
    }
}
