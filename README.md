# Boomy | Legacy

The first Song Editor for Dance Central 3.

As of now, this project will not receive any feature updates (eventually some bug fixes). Thanks to the ongoing [decompilation project](https://github.com/rjkiv/dc3-decomp), soon we will be able to make a more feature-rich and stable editor which will replace this legacy version in the future.

---

All in one tool allowing to create full fledged Dance Central 3 songs from scratch with custom move selection.

## Modules

**Boomy Editor** - Electron-based interactive editor for creating choreographies.
**Boomy Builder** - Song builder backend API, builds the song milo.
**Boomy Deps** - Dependencies including modified `MiloLib` and stripped `xbox360-lib`.
**Boomy Exporter** - Exporter of DC stock songs. (currently only exports for move library)
**Boomy Converters** - Various converters for use with Boomy.

## Supported Features

-   [x] Song Metadata
-   [x] Moves Editor
-   [x] Camera Shots Editor
-   [x] Practice Sections Editor
-   [x] MIDI Editing
-   [x] Creating MOGG files
-   [x] Packaging into Xbox Packages
-   [ ] Exporting moves from DC3 songs
-   [ ] Exporting moves from DC1 / DC2 songs
-   [x] Dancer Faces editing / EXPERIMENTAL
-   [x] Automatic routine generation / EXPERIMENTAL
-   [x] Automatic practice sections generation / EXPERIMENTAL
-   [x] Automatic camera shots generation / EXPERIMENTAL
-   [x] Automatic events generation / EXPERIMENTAL
-   [ ] Importing existing DC3 songs / WON'T ADD
-   [ ] Importing existing DC1 / DC2 songs / WON'T ADD
-   [ ] Flipping moves / WON'T ADD
-   [ ] Advanced Transitions between moves / WON'T ADD

## Song Compatibility

-   [x] Performance Mode
-   [x] Rehearse (Break It Down)
-   [x] Battle
-   [x] Party
-   [x] Keep The Beat
-   [x] Strike A Pose
-   [x] Make Your Move

### Tutorial

~~Soon™~~

Well... Laura223 made an awesome video tutorial on making DC3 customs featuring Boomy, go watch it here:
https://www.youtube.com/watch?v=Hp3kjwQYVCQ


## Support

Report an issue duh. You can also talk to me on MiloHax or DCU Discord servers.

### Cotributing

Boomy Builder building:

Windows: `dotnet publish -c Release -r win-x64 --self-contained`
Linux: `dotnet publish -c Release -r linux-x64 --self-contained`
macOS: `dotnet publish -c Release -r osx-x64 --self-contained`

## Credits

NORXND - Tool creator and maintainer.
MiloHax Team - For MiloLib and generally research on DC, Milo and other Harmonix stuff.

This software uses MiloLib being a part of [MiloEditor](https://github.com/ihatecompvir/MiloEditor) by ihatecompvir

Boomy also uses parts, snippets based on many awesome open source projects like:
[xbox360-lib](https://github.com/unknownv2/xbox360-lib/)
[makemogg](https://github.com/maxton/makemogg)
[moggulator](https://github.com/LocalH/moggulator)
[nautilus](https://github.com/trojannemo/Nautilus)

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND - please respect the authors and don't hate on them for bugs.