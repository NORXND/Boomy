using System;
using CommandLine;

namespace BoomyExporter
{
    class Options
    {
        [Value(0, MetaName = "path", Required = true, HelpText = "The path to process.")]
        public string Path { get; set; }

        [Value(1, MetaName = "export", Required = true, HelpText = "Path to use for export.")]
        public string ExportPath { get; set; }

        [Option("name", Required = true, HelpText = "The name to use.")]
        public string Name { get; set; }

        [Option("origin", Required = true, HelpText = "The origin value.")]
        public string Origin { get; set; }

        [Option("barks", Required = false, HelpText = "Export Barks")]
        public bool Barks { get; set; }

        [Option("moves", Required = false, HelpText = "Export Moves")]
        public bool Moves { get; set; }

        [Option("midi", Required = false, HelpText = "Export MIDI Bank")]
        public bool Midi { get; set; }

        [Option("boomy", Required = false, HelpText = "Export Boomy Project")]
        public bool Boomy { get; set; }

        [Option('v', "verbose", Required = false, HelpText = "Enable verbose output.")]
        public bool Verbose { get; set; }
    }

    class Program
    {
        static void Main(string[] args)
        {
            Parser.Default.ParseArguments<Options>(args)
                .WithParsed(opts =>
                {
                    ExportOperator exportOperator = new(opts.Path, opts.ExportPath, opts.Name, opts.Origin, opts.Verbose, opts.Barks, opts.Moves, opts.Midi, opts.Boomy);
                    exportOperator.Export();
                });
        }
    }
}