# Boomy

Song Editor for Dance Central 3

---

All in one tool allowing to create full fledged Dance Central 3 songs from scratch with custom move selection.

## Modules

**Boomy Editor** - React Native interactive editor for creating choreographies.
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
-   [x] Exporting moves from DC3 songs
-   [x] Exporting moves from DC1 / DC2 songs
-   [ ] Dancer Faces editing
-   [ ] Automatic routine generation
-   [ ] Automatic practice sections generation
-   [ ] Automatic camera shots generation
-   [ ] Automatic events generation
-   [ ] Importing existing DC3 songs
-   [ ] Importing existing DC1 / DC2 songs
-   [ ] Flipping moves
-   [ ] Advanced Transitions between moves

## Song Compatibility

-   [x] Performance Mode
-   [x] Rehearse (Break It Down)
-   [x] Battle
-   [x] Party
-   [x] Keep The Beat
-   [x] Strike A Pose
-   [x] Make Your Move

### Tutorial

Soon™

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
