using System;
using System.IO;
using System.Runtime.InteropServices;

public static class MakemoggNative
{
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate int MakemoggProcessDelegate(string inputPath, string outputPath);

    public static int makemogg_create_unencrypted(string inputPath, string outputPath)
    {
        string libName;
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            libName = "libmakemogg.dll";
        else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            libName = "libmakemogg.so";
        else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            libName = "libmakemogg.dylib";
        else
            throw new PlatformNotSupportedException();

        string exeDir = AppContext.BaseDirectory;
        string dllAbsolutePath = Path.Combine(exeDir, libName);

        IntPtr libHandle = NativeLibrary.Load(dllAbsolutePath);
        try
        {
            IntPtr procAddress = NativeLibrary.GetExport(libHandle, "makemogg_process");
            var makemogg = Marshal.GetDelegateForFunctionPointer<MakemoggProcessDelegate>(procAddress);
            return makemogg(inputPath, outputPath);
        }
        finally
        {
            NativeLibrary.Free(libHandle);
        }
    }
}