using System.Runtime.Serialization;
using System.Reflection;

namespace BoomyBuilder.Builder.Extensions
{
    public static class EnumExtensions
    {
        public static string GetEnumMemberValue<T>(this T enumValue) where T : Enum
        {
            var type = typeof(T);
            var memberInfo = type.GetMember(enumValue.ToString());
            var attributes = memberInfo[0].GetCustomAttributes(typeof(EnumMemberAttribute), false);

            if (attributes.Length > 0)
            {
                var enumMemberAttribute = (EnumMemberAttribute)attributes[0];
                return enumMemberAttribute.Value ?? enumValue.ToString();
            }

            return enumValue.ToString();
        }
    }
}