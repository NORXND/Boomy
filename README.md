# Boomy

Song Editor for Dance Central 3

---

All in one tool allowing to create full fledged Dance Central 3 songs from scratch with custom move selection.

## Modules

**Boomy Editor** - React Native interactive editor for creating choreographies.
**Boomy Builder** - Song builder backend API, builds the song milo.
**Boomy Deps** - Dependencies including modified `MiloLib` and `makemogg`.

## Supported Features

-   [x] Song Metadata
-   [x] Moves Editor
-   [x] Camera Shots Editor
-   [x] Practice Sections Editor
-   [ ] Importing existing DC3 songs
-   [ ] Importing existing DC1 / DC2 songs
-   [ ] Exporting moves from DC3 songs
-   [ ] Exporting moves from DC1 / DC2 songs

## Song Compatibility

-   [x] Performance Mode
-   [ ] Rehearse (Break It Down)
-   [ ] Keep The Beat
-   [ ] Strike A Pose
-   [ ] Make Your Move

### Cotributing

Boomy Builder building:

Windows: `dotnet publish -c Release -r win-x64`
Linux: `dotnet publish -c Release -r linux-x64`
macOS: `dotnet publish -c Release -r osx-x64`

## Credits

NORXND - Tool creator and maintainer.
MiloHax Team - For MiloLib and generally research on DC, Milo and other Harmonix stuff.

This software uses MiloLib being a part of [MiloEditor](https://github.com/ihatecompvir/MiloEditor) by ihatecompvir

Boomy also uses parts, snippets based on many awesome open source projects like:
[xbox360-lib](https://github.com/unknownv2/xbox360-lib/)
[makemogg](https://github.com/maxton/makemogg)
[moggulator](https://github.com/LocalH/moggulator)
[nautilus](https://github.com/trojannemo/Nautilus)
