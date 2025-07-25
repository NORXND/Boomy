using System;
using System.Runtime.InteropServices;

public static class MakemoggNative
{
    // Adjust the library name for each platform
    const string LinuxLib = "libmakemogg.so";
    const string WindowsLib = "libmakemogg.dll";
    const string MacLib = "libmakemogg.dylib";

    // Use platform-specific DllImport
    [DllImport(LinuxLib, EntryPoint = "makemogg_process", CallingConvention = CallingConvention.Cdecl)]
    public static extern int makemogg_create_unencrypted_linux(string inputPath, string outputPath);

    [DllImport(WindowsLib, EntryPoint = "makemogg_process", CallingConvention = CallingConvention.Cdecl)]
    public static extern int makemogg_create_unencrypted_windows(string inputPath, string outputPath);

    [DllImport(MacLib, EntryPoint = "makemogg_process", CallingConvention = CallingConvention.Cdecl)]
    public static extern int makemogg_create_unencrypted_mac(string inputPath, string outputPath);

    // Helper to call the right native function
    public static int makemogg_create_unencrypted(string inputPath, string outputPath)
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return makemogg_create_unencrypted_windows(inputPath, outputPath);
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            return makemogg_create_unencrypted_linux(inputPath, outputPath);
        if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            return makemogg_create_unencrypted_mac(inputPath, outputPath);
        throw new PlatformNotSupportedException();
    }
}