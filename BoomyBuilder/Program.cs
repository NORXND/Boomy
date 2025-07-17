using BoomyBuilder.Builder;

namespace BoomyBuilder
{
    public class Program
    {
        public async Task<object> Build(dynamic data)
        {
            try
            {
                BuildOperator buildOperator = new(data);
                buildOperator.Build();
                return "[>>>__BUILD_SUCCESS__<<<]";
            }
            catch (Exception ex)
            {
                if (ex is BoomyException)
                {
                    // If it is BoomyException, just a return a friendly message without a stack trace
                    return ex.Message;
                }

                return ex.ToString();
            }
        }
    }
}
