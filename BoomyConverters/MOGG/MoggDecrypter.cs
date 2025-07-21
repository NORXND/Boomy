using System;
using System.IO;
using System.Security.Cryptography;

namespace BoomyConverters.MOGG
{
    public static class MoggDecrypter
    {
        public static bool DecryptMogg(bool red, Stream fin, Stream fout, TextWriter flog)
        {
            // Read the entire file into memory
            byte[] moggData = ReadAllBytes(fin);
            byte[] decMoggData = new byte[moggData.Length];
            Array.Copy(moggData, decMoggData, moggData.Length);

            int version = moggData[0];
            int oggOffset = BitConverter.ToInt32(moggData, 4);

            if (version == 10)
            {
                Console.WriteLine("version 10 mogg, nothing to do");
                fout.Close();
                return true;
            }

            // --- FULL KEY ARRAYS AND LOGIC PORTED FROM PYTHON ---
            // All public keys and hidden keys
            byte[] masher = new byte[] { 0x39, 0xa2, 0xbf, 0x53, 0x7d, 0x88, 0x1d, 0x03, 0x35, 0x38, 0xa3, 0x80, 0x45, 0x24, 0xee, 0xca, 0x25, 0x6d, 0xa5, 0xc2, 0x65, 0xa9, 0x94, 0x73, 0xe5, 0x74, 0xeb, 0x54, 0xe5, 0x95, 0x3f, 0x1c };
            byte[] ctrkey_11 = new byte[] { 0x37, 0xb2, 0xe2, 0xb9, 0x1c, 0x74, 0xfa, 0x9e, 0x38, 0x81, 0x08, 0xea, 0x36, 0x23, 0xdb, 0xe4 };
            byte[] hvkey_12 = new byte[] { 0x01, 0x22, 0x00, 0x38, 0xd2, 0x01, 0x78, 0x8b, 0xdd, 0xcd, 0xd0, 0xf0, 0xfe, 0x3e, 0x24, 0x7f };
            byte[] hvkey_12_r = new byte[] { 0xf7, 0xb6, 0xc2, 0x22, 0xb6, 0x66, 0x5b, 0xd5, 0x6c, 0xe0, 0x7d, 0x6c, 0x8a, 0x46, 0xdb, 0x18 };
            byte[] hvkey_14 = new byte[] { 0x51, 0x73, 0xad, 0xe5, 0xb3, 0x99, 0xb8, 0x61, 0x58, 0x1a, 0xf9, 0xb8, 0x1e, 0xa7, 0xbe, 0xbf };
            byte[] hvkey_14_r = new byte[] { 0x60, 0xad, 0x83, 0x0b, 0xc2, 0x2f, 0x82, 0xc5, 0xcb, 0xbf, 0xf4, 0x3d, 0x60, 0x52, 0x7e, 0x33 };
            byte[] hvkey_15 = new byte[] { 0xc6, 0x22, 0x94, 0x30, 0xd8, 0x3c, 0x84, 0x14, 0x08, 0x73, 0x7c, 0xf2, 0x23, 0xf6, 0xeb, 0x5a };
            byte[] hvkey_15_r = new byte[] { 0x6c, 0x68, 0x55, 0x98, 0x5b, 0x12, 0x21, 0x41, 0xe7, 0x85, 0x35, 0xca, 0x19, 0xe1, 0x9a, 0xf3 };
            byte[] hvkey_16 = new byte[] { 0x02, 0x1a, 0x83, 0xf3, 0x97, 0xe9, 0xd4, 0xb8, 0x06, 0x74, 0x14, 0x6b, 0x30, 0x4c, 0x00, 0x91 };
            byte[] hvkey_16_r = new byte[] { 0xa4, 0x2f, 0xf3, 0xe4, 0xe8, 0xfb, 0xa5, 0x9e, 0xac, 0x79, 0x01, 0x9e, 0xd5, 0x89, 0x66, 0xec };
            byte[] hvkey_17 = new byte[] { 0x42, 0x66, 0x37, 0xb3, 0x68, 0x05, 0x9f, 0x85, 0x6e, 0x96, 0xbd, 0x1e, 0xf9, 0x0e, 0x7f, 0xbd };
            byte[] hvkey_17_r = new byte[] { 0x0b, 0x9c, 0x96, 0xce, 0xb6, 0xf0, 0xbc, 0xde, 0x4e, 0x9c, 0xd1, 0xc4, 0x1d, 0xeb, 0x7f, 0xe6 };
            // Hidden keys (public, as requested)
            byte[][] hidden_keys = new byte[][] {
                new byte[] { 0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6, 0xab, 0xf7, 0x8e, 0x8d, 0x2b, 0x7e, 0x15, 0x16 },
                new byte[] { 0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6, 0xab, 0xf7, 0x8e, 0x8d, 0x2b, 0x7e, 0x15, 0x16 },
                new byte[] { 0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6, 0xab, 0xf7, 0x8e, 0x8d, 0x2b, 0x7e, 0x15, 0x16 },
                new byte[] { 0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6, 0xab, 0xf7, 0x8e, 0x8d, 0x2b, 0x7e, 0x15, 0x16 },
                new byte[] { 0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6, 0xab, 0xf7, 0x8e, 0x8d, 0x2b, 0x7e, 0x15, 0x16 },
                new byte[] { 0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6, 0xab, 0xf7, 0x8e, 0x8d, 0x2b, 0x7e, 0x15, 0x16 },
                new byte[] { 0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6, 0xab, 0xf7, 0x8e, 0x8d, 0x2b, 0x7e, 0x15, 0x16 },
                new byte[] { 0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6, 0xab, 0xf7, 0x8e, 0x8d, 0x2b, 0x7e, 0x15, 0x16 },
            };

            // Helper: XOR two byte arrays
            byte[] Xor(byte[] a, byte[] b)
            {
                byte[] result = new byte[a.Length];
                for (int i = 0; i < a.Length; i++)
                    result[i] = (byte)(a[i] ^ b[i]);
                return result;
            }

            // Helper: Generate key (Python's gen_key)
            byte[] GenKey(byte[] key, byte[] masher)
            {
                byte[] outkey = new byte[key.Length];
                for (int i = 0; i < key.Length; i++)
                    outkey[i] = (byte)(key[i] ^ masher[i]);
                return outkey;
            }

            // Helper: AES-CTR decrypt
            void DoCrypt(byte[] key, byte[] data, int offset, int length, byte[] iv)
            {
                using (Aes aes = Aes.Create())
                {
                    aes.Mode = CipherMode.ECB;
                    aes.Padding = PaddingMode.None;
                    aes.Key = key;
                    int blockSize = 16;
                    byte[] counter = new byte[blockSize];
                    Array.Copy(iv, counter, blockSize);
                    int numBlocks = (length + blockSize - 1) / blockSize;
                    for (int block = 0; block < numBlocks; block++)
                    {
                        byte[] keystream = new byte[blockSize];
                        using (ICryptoTransform encryptor = aes.CreateEncryptor())
                        {
                            encryptor.TransformBlock(counter, 0, blockSize, keystream, 0);
                        }
                        int blockOffset = offset + block * blockSize;
                        int blockLen = Math.Min(blockSize, length - block * blockSize);
                        for (int i = 0; i < blockLen; i++)
                        {
                            data[blockOffset + i] ^= keystream[i];
                        }
                        // increment counter
                        for (int i = blockSize - 1; i >= 0; i--)
                        {
                            if (++counter[i] != 0)
                                break;
                        }
                    }
                }
            }

            // Key selection logic (Python's choose_key)
            byte[] key = null;
            byte[] iv = new byte[16];
            int cryptOffset = 0;
            int cryptLength = 0;
            if (version == 11)
            {
                key = ctrkey_11;
                cryptOffset = oggOffset;
                cryptLength = moggData.Length - oggOffset;
                Array.Copy(moggData, 8, iv, 0, 8); // IV is at offset 8, 8 bytes, rest zero
            }
            else if (version == 12)
            {
                key = red ? hvkey_12_r : hvkey_12;
                cryptOffset = oggOffset;
                cryptLength = moggData.Length - oggOffset;
                Array.Copy(moggData, 8, iv, 0, 8);
            }
            else if (version == 14)
            {
                key = red ? hvkey_14_r : hvkey_14;
                cryptOffset = oggOffset;
                cryptLength = moggData.Length - oggOffset;
                Array.Copy(moggData, 8, iv, 0, 8);
            }
            else if (version == 15)
            {
                key = red ? hvkey_15_r : hvkey_15;
                cryptOffset = oggOffset;
                cryptLength = moggData.Length - oggOffset;
                Array.Copy(moggData, 8, iv, 0, 8);
            }
            else if (version == 16)
            {
                key = red ? hvkey_16_r : hvkey_16;
                cryptOffset = oggOffset;
                cryptLength = moggData.Length - oggOffset;
                Array.Copy(moggData, 8, iv, 0, 8);
            }
            else if (version == 17)
            {
                key = red ? hvkey_17_r : hvkey_17;
                cryptOffset = oggOffset;
                cryptLength = moggData.Length - oggOffset;
                Array.Copy(moggData, 8, iv, 0, 8);
            }
            else if (version == 21)
            {
                // RB4 moggs: key is generated from masher and hidden_keys
                int keyIndex = moggData[8] & 7;
                key = GenKey(hidden_keys[keyIndex], masher);
                cryptOffset = oggOffset;
                cryptLength = moggData.Length - oggOffset;
                Array.Copy(moggData, 12, iv, 0, 4); // IV is at offset 12, 4 bytes, rest zero
            }
            else
            {
                flog.WriteLine($"Unknown MOGG version: {version}");
                return false;
            }

            // Decrypt in-place
            DoCrypt(key, decMoggData, cryptOffset, cryptLength, iv);

            // Write decrypted data to output
            fout.Write(decMoggData, 0, decMoggData.Length);
            fout.Flush();
            fout.Close();
            return true;
        }

        private static byte[] ReadAllBytes(Stream input)
        {
            if (input is MemoryStream ms)
                return ms.ToArray();
            using (var mem = new MemoryStream())
            {
                input.CopyTo(mem);
                return mem.ToArray();
            }
        }
    }
}
