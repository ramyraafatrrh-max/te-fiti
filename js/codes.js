// =====================================================================
//  GAME CODES
//  Codes are stored as SHA-256 hashes so players can't read them from
//  the page source. Each hash = SHA-256 of  "<SALT>|<code>"
//  See README.md -> "Changing the codes" to generate new hashes.
// =====================================================================

export const SALT = "TeFiti-Heart-2026";

export const STATIONS = [
  {
    id: "s1",
    title: "Motunui Village",
    codeIds: ["s1a", "s1b"],               // 2 codes – any order
    codes: {
      "484a410608090485aae3e7ce9ecb7c0e58ae6284cbf3b9fa38bd0a5556e93dda": "s1a", // 1516
      "ba451d5457a9f215defcad317bb066abe04254ef085cd3d1e6fd6ec86dcf04f1": "s1b"  // 210
    }
  },
  {
    id: "s2",
    title: "The Open Ocean",
    codeIds: ["s2"],
    codes: {
      "5abb9660a33dcb96b7ce17a96669fef792cc3abc8792341ac70429f6e3d61f13": "s2"   // 18
    }
  },
  {
    id: "s3",
    title: "Kakamora Waters",
    codeIds: ["s3"],
    codes: {
      "1f41fb51ccbd34007731b2f343e5d3d5b8ba377cfaf47361fca12435fd2230bc": "s3"   // 1626
    }
  },
  {
    id: "s4",
    title: "Lalotai, Realm of Monsters",
    codeIds: ["s4"],
    codes: {
      "b5a6d944271da0f8e528567e8a303672691ff664af7d1aa5f424dcf015fa6797": "s4"   // 154
    }
  },
  {
    id: "s5",
    title: "Te Fiti's Shore",
    codeIds: ["s5"],
    codes: {
      "a002f7238e6ad7e50e91baea967fdaccc4bc510610809648e6b1a72556a5488f": "s5"   // 1412
    }
  }
];

export const TOTAL_CODES = STATIONS.reduce((n, s) => n + s.codeIds.length, 0); // = 6

// One line per progress level (0 … 6)
export const STORY_LINES = [
  "Without her heart, Te Fiti has become a demon of lava and fire. Find the hidden codes and return her heart, piece by piece.",
  "The first piece glows in the spiral. Her fire flickers… she has felt it.",
  "The lava begins to cool. The flames on her shoulders grow weaker.",
  "The smoke over the ocean is thinning. She is no longer attacking — she is listening.",
  "The cracks of fire are fading. Deep inside, she starts to remember who she is.",
  "Only one piece is missing. The heart is almost whole — finish the voyage!",
  "The heart is home. Te Fiti awakens, green and alive, spreading love, happiness and peace across the islands."
];
