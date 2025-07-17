namespace BoomyBuilder.Builder
{

    public class BoomyException : Exception
    {
        public BoomyException(string message) : base(message)
        {
        }

        public BoomyException(string message, Exception innerException) : base(message, innerException)
        {
        }
    }
}