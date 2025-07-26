namespace BoomyBuilder.Builder.Models
{
    using System.Runtime.Serialization;
    public enum GameOrigin
    {
        [EnumMember(Value = "ham3")]
        DanceCentral3,
        [EnumMember(Value = "ham3_dlc")]
        DanceCentral3DLC,
        [EnumMember(Value = "ham2")]
        DanceCentral2,
        [EnumMember(Value = "ham2_dlc")]
        DanceCentral2DLC,
        [EnumMember(Value = "ham1")]
        DanceCentral1,
        [EnumMember(Value = "ham1_dlc")]
        DanceCentral1DLC,
    }

    public enum Gender
    {
        [EnumMember(Value = "kGenderMale")]
        Male,
        [EnumMember(Value = "kGenderFemale")]
        Female,
    }

    public enum Venue
    {
        [EnumMember(Value = "rollerrink")]
        FreeSkate,
        [EnumMember(Value = "streetside")]
        ToprockAve,
        [EnumMember(Value = "dclive")]
        Studio675,
        [EnumMember(Value = "dci")]
        DCIHQ,
        [EnumMember(Value = "throneroom")]
        CrowsNest,
    }

    public enum Character
    {
        // Angel
        [EnumMember(Value = "angel01")]
        AngelCrewLook,
        [EnumMember(Value = "angel02")]
        AngelStreetStyle,
        [EnumMember(Value = "angel03")]
        AngelDCClassic,
        [EnumMember(Value = "angel04")]
        AngelRetroFitted,
        [EnumMember(Value = "angel05")]
        AngelDCIAgent,

        // Emilia
        [EnumMember(Value = "emilia01")]
        EmiliaCrewLook,
        [EnumMember(Value = "emilia02")]
        EmiliaStreetStyle,
        [EnumMember(Value = "emilia03")]
        EmiliaDCClassic,
        [EnumMember(Value = "emilia04")]
        EmiliaRetroFitted,
        [EnumMember(Value = "emilia05")]
        EmiliaDCIAgent,

        // Mo
        [EnumMember(Value = "mo01")]
        MoCrewLook,
        [EnumMember(Value = "mo02")]
        MoStreetStyle,
        [EnumMember(Value = "mo03")]
        MoDCClassic,
        [EnumMember(Value = "mo04")]
        MoRetroFitted,
        [EnumMember(Value = "mo05")]
        MoDCIAgent,

        // Taye
        [EnumMember(Value = "taye01")]
        TayeCrewLook,
        [EnumMember(Value = "taye02")]
        TayeStreetStyle,
        [EnumMember(Value = "taye03")]
        TayeDCClassic,
        [EnumMember(Value = "taye04")]
        TayeRetroFitted,
        [EnumMember(Value = "taye05")]
        TayeDCIAgent,

        // Aubrey
        [EnumMember(Value = "aubrey01")]
        AubreyCrewLook,
        [EnumMember(Value = "aubrey02")]
        AubreyStreetStyle,
        [EnumMember(Value = "aubrey03")]
        AubreyDCClassic,
        [EnumMember(Value = "aubrey04")]
        AubreyRetroFitted,
        [EnumMember(Value = "aubrey05")]
        AubreyDCIAgent,

        // Bodie
        [EnumMember(Value = "bodie01")]
        BodieCrewLook,
        [EnumMember(Value = "bodie02")]
        BodieStreetStyle,
        [EnumMember(Value = "bodie04")]
        BodieRetroFitted,
        [EnumMember(Value = "bodie05")]
        BodieDCIAgent,

        // Glitch
        [EnumMember(Value = "glitch01")]
        GlitchCrewLook,
        [EnumMember(Value = "glitch02")]
        GlitchStreetStyle,
        [EnumMember(Value = "glitch04")]
        GlitchRetroFitted,
        [EnumMember(Value = "glitch05")]
        GlitchDCIAgent,

        // Lilt
        [EnumMember(Value = "lilt01")]
        LiltCrewLook,
        [EnumMember(Value = "lilt02")]
        LiltStreetStyle,
        [EnumMember(Value = "lilt04")]
        LiltRetroFitted,
        [EnumMember(Value = "lilt05")]
        LiltDCIAgent,

        // Dare
        [EnumMember(Value = "dare04")]
        DareDCClassic,
        [EnumMember(Value = "dare06")]
        DareUnderControl,

        // Maccoy
        [EnumMember(Value = "maccoy04")]
        MaccoyDCClassic,
        [EnumMember(Value = "maccoy06")]
        MaccoyUnderControl,

        // Oblio
        [EnumMember(Value = "oblio04")]
        OblioCrewLook,
        [EnumMember(Value = "oblio06")]
        OblioUnderControl,

        // Tan
        [EnumMember(Value = "tan01")]
        TanLikeABoss,
        [EnumMember(Value = "tan04")]
        TanCrewLook,

        // Ninjaman (Shinju)
        [EnumMember(Value = "ninjaman01")]
        NinjamanCrewLook,

        // Ninjawoman (Kichi)
        [EnumMember(Value = "ninjawoman01")]
        NinjawomanCrewLook,

        // Iconmanblue (Marcos)
        [EnumMember(Value = "iconmanblue01")]
        IconmanblueCrewLook,

        // Iconmanpink (Frenchy)
        [EnumMember(Value = "iconmanpink01")]
        IconmanpinkCrewLook,

        // Robota (CYPH-56)
        [EnumMember(Value = "robota01")]
        RobotaCrewLook,
        [EnumMember(Value = "robota02")]
        RobotaDamaged,

        // Robotb (CYPH-78)
        [EnumMember(Value = "robotb01")]
        RobotbCrewLook,
        [EnumMember(Value = "robotb02")]
        RobotbDamaged,

        // Jaryn
        [EnumMember(Value = "jaryn01")]
        JarynCrewLook,
        [EnumMember(Value = "jaryn02")]
        JarynStreetStyle,
        [EnumMember(Value = "jaryn04")]
        JarynHauteBlooded,

        // Kerith
        [EnumMember(Value = "kerith01")]
        KerithCrewLook,
        [EnumMember(Value = "kerith02")]
        KerithStreetStyle,
        [EnumMember(Value = "kerith04")]
        KerithHauteBlooded,

        // Lima
        [EnumMember(Value = "lima05")]
        LimaDCIAgent,
        [EnumMember(Value = "lima06")]
        LimaUnderControl,

        // Rasa
        [EnumMember(Value = "rasa05")]
        RasaDCIAgent,
        [EnumMember(Value = "rasa06")]
        RasaUnderControl,
    }

    public enum CameraPosition
    {
        [EnumMember(Value = "VENUE")]
        Venue,
        [EnumMember(Value = "CLOSEUP")]
        Closeup,
        [EnumMember(Value = "Area1_NEAR")]
        Area1Near,
        [EnumMember(Value = "Area1_MOVEMENT")]
        Area1Movement,
        [EnumMember(Value = "Area1_WIDE")]
        Area1Wide,
        [EnumMember(Value = "Area1_FAR")]
        Area1Far,
        [EnumMember(Value = "Area2_NEAR")]
        Area2Near,
        [EnumMember(Value = "Area2_MOVEMENT")]
        Area2Movement,
        [EnumMember(Value = "Area2_WIDE")]
        Area2Wide,
        [EnumMember(Value = "Area2_FAR")]
        Area2Far,
        [EnumMember(Value = "Area3_NEAR")]
        Area3Near,
        [EnumMember(Value = "Area3_MOVEMENT")]
        Area3Movement,
        [EnumMember(Value = "Area3_WIDE")]
        Area3Wide,
        [EnumMember(Value = "Area3_FAR")]
        Area3Far,
        [EnumMember(Value = "DC_PLAYER_FREESTYLE")]
        DCPlayerFreestyle,
    }

    public enum Difficulty
    {
        Easy,
        Medium,
        Expert,
        Beginner
    }

    public enum SongEventType
    {
        [EnumMember(Value = "music_start")]
        MusicStart,
        [EnumMember(Value = "preview")]
        Preview,
        [EnumMember(Value = "freestyle")]
        Freestyle,
        [EnumMember(Value = "music_end")]
        MusicEnd,
        [EnumMember(Value = "end")]
        End,
    }

    public enum PartyJumpType
    {
        [EnumMember(Value = "start")]
        Start,
        [EnumMember(Value = "end")]
        End,
    }

    public enum BattleEventType
    {
        [EnumMember(Value = "battle_reset")]
        BattleReset,
        [EnumMember(Value = "player1_solo")]
        Player1Solo,
        [EnumMember(Value = "player2_solo")]
        Player2Solo,
        [EnumMember(Value = "minigame_start")]
        MinigameStart,
        [EnumMember(Value = "minigame_idle")]
        MinigameIdle,
        [EnumMember(Value = "minigame_end")]
        MinigameEnd,
    }
}