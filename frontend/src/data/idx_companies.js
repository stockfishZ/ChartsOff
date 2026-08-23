export const ALIAS_MAP = {
  "BCA": "BBCA",
  "BRI": "BBRI",
  "MANDIRI": "BMRI",
  "BNI": "BBNI",
  "BSI": "BRIS",
  "BTN": "BBTN",
  "JAGO": "ARTO",
  "DANAMON": "BDMN",
  "TELKOM": "TLKM",
  "INDOSAT": "ISAT",
  "XL": "EXCL",
  "GOJEK": "GOTO",
  "TOKOPEDIA": "GOTO",
  "BUKALAPAK": "BUKA",
  "EMTEK": "EMTK",
  "ADARO": "ADRO",
  "BUKIT ASAM": "PTBA",
  "ANTAM": "ANTM",
  "VALE": "INCO",
  "MEDCO": "MEDC",
  "PGN": "PGAS",
  "BUMI": "BUMI",
  "BARITO": "BRPT",
  "CHANDRA ASRI": "TPIA",
  "INDOFOOD": "ICBP",
  "INDF": "INDF",
  "UNILEVER": "UNVR",
  "MAYORA": "MYOR",
  "KALBE": "KLBF",
  "SIDO": "SIDO",
  "SIDO MUNCUL": "SIDO",
  "ALFAMART": "AMRT",
  "ALFAMIDI": "MIDI",
  "MAP": "MAPI",
  "ACE": "ACES",
  "ACE HARDWARE": "ACES",
  "ASTRA": "ASII",
  "UNITED TRACTORS": "UNTR",
  "SEMEN INDONESIA": "SMGR",
  "INDOCEMENT": "INTP",
  "BSD": "BSDE",
  "CIPUTRA": "CTRA",
  "PAKUWON": "PWON",
  "SUMMARECON": "SMRA",
  "JASA MARGA": "JSMR",
  "HERMINA": "HEAL",
  "SILOAM": "SILO",
  "CIMORY": "CMRY",
  "ULTRAJAYA": "ULTJ"
};

export const IDX_COMPANIES = [
  // Perbankan & Finansial
  { ticker: "BBCA", name: "Bank Central Asia Tbk", sector: "Perbankan", aliases: ["bca"] },
  { ticker: "BBRI", name: "Bank Rakyat Indonesia (Persero) Tbk", sector: "Perbankan", aliases: ["bri"] },
  { ticker: "BMRI", name: "Bank Mandiri (Persero) Tbk", sector: "Perbankan", aliases: ["mandiri"] },
  { ticker: "BBNI", name: "Bank Negara Indonesia (Persero) Tbk", sector: "Perbankan", aliases: ["bni"] },
  { ticker: "BRIS", name: "Bank Syariah Indonesia Tbk", sector: "Perbankan", aliases: ["bsi"] },
  { ticker: "BBTN", name: "Bank Tabungan Negara (Persero) Tbk", sector: "Perbankan", aliases: ["btn"] },
  { ticker: "BDMN", name: "Bank Danamon Indonesia Tbk", sector: "Perbankan", aliases: ["danamon"] },
  { ticker: "ARTO", name: "Bank Jago Tbk", sector: "Bank Digital", aliases: ["jago"] },
  { ticker: "BTPS", name: "Bank BTPN Syariah Tbk", sector: "Perbankan", aliases: ["btpn"] },

  // Telekomunikasi & Teknologi
  { ticker: "TLKM", name: "Telkom Indonesia (Persero) Tbk", sector: "Telekomunikasi", aliases: ["telkom"] },
  { ticker: "ISAT", name: "Indosat Ooredoo Hutchison Tbk", sector: "Telekomunikasi", aliases: ["indosat", "ooredoo"] },
  { ticker: "EXCL", name: "XL Axiata Tbk", sector: "Telekomunikasi", aliases: ["xl", "axiata"] },
  { ticker: "GOTO", name: "GoTo Gojek Tokopedia Tbk", sector: "Teknologi", aliases: ["gojek", "tokopedia"] },
  { ticker: "BUKA", name: "Bukalapak.com Tbk", sector: "E-Commerce", aliases: ["bukalapak"] },
  { ticker: "EMTK", name: "Elang Mahkota Teknologi Tbk", sector: "Media & Teknologi", aliases: ["emtek"] },
  { ticker: "MTDL", name: "Metrodata Electronics Tbk", sector: "Teknologi Informasi", aliases: ["metrodata"] },

  // Energi, Batu Bara & Minyak Bumi
  { ticker: "ADRO", name: "Adaro Energy Indonesia Tbk", sector: "Batu Bara & Energi", aliases: ["adaro"] },
  { ticker: "PTBA", name: "Bukit Asam Tbk", sector: "Batu Bara BUMN", aliases: ["bukit asam"] },
  { ticker: "ITMG", name: "Indo Tambangraya Megah Tbk", sector: "Batu Bara", aliases: ["itmg", "indo tambangraya"] },
  { ticker: "BUMI", name: "Bumi Resources Tbk", sector: "Batu Bara", aliases: ["bumi"] },
  { ticker: "MEDC", name: "Medco Energi Internasional Tbk", sector: "Minyak & Gas", aliases: ["medco"] },
  { ticker: "PGAS", name: "Perusahaan Gas Negara (PGN) Tbk", sector: "Gas Bumi", aliases: ["pgn"] },
  { ticker: "AKRA", name: "AKR Corporindo Tbk", sector: "Distribusi BBM & Logistik", aliases: ["akr"] },

  // Tambang Mineral, Logam & Petrokimia
  { ticker: "ANTM", name: "Aneka Tambang (Antam) Tbk", sector: "Emas & Nikel", aliases: ["antam"] },
  { ticker: "INCO", name: "Vale Indonesia Tbk", sector: "Nikel", aliases: ["vale"] },
  { ticker: "MDKA", name: "Merdeka Copper Gold Tbk", sector: "Emas & Tembaga", aliases: ["merdeka"] },
  { ticker: "AMMN", name: "Amman Mineral Internasional Tbk", sector: "Tembaga & Emas", aliases: ["amman"] },
  { ticker: "BRPT", name: "Barito Pacific Tbk", sector: "Petrokimia & Energi", aliases: ["barito"] },
  { ticker: "TPIA", name: "Chandra Asri Petrochemical Tbk", sector: "Petrokimia", aliases: ["chandra asri"] },
  { ticker: "CUAN", name: "Petrindo Jaya Kreasi Tbk", sector: "Pertambangan", aliases: ["petrindo"] },

  // Konsumsi, Makanan & Farmasi
  { ticker: "ICBP", name: "Indofood CBP Sukses Makmur Tbk", sector: "Makanan Kemasan", aliases: ["indofood cbp", "indomie"] },
  { ticker: "INDF", name: "Indofood Sukses Makmur Tbk", sector: "Holding Makanan", aliases: ["indofood"] },
  { ticker: "UNVR", name: "Unilever Indonesia Tbk", sector: "Barang Konsumen", aliases: ["unilever"] },
  { ticker: "MYOR", name: "Mayora Indah Tbk", sector: "Biskuit & Minuman", aliases: ["mayora"] },
  { ticker: "KLBF", name: "Kalbe Farma Tbk", sector: "Farmasi & Kesehatan", aliases: ["kalbe"] },
  { ticker: "SIDO", name: "Industri Jamu Sido Muncul Tbk", sector: "Herbal & Farmasi", aliases: ["sido muncul", "tolak angin"] },
  { ticker: "CPIN", name: "Charoen Pokphand Indonesia Tbk", sector: "Pakan & Unggas", aliases: ["charoen"] },
  { ticker: "JPFA", name: "Japfa Comfeed Indonesia Tbk", sector: "Peternakan", aliases: ["japfa"] },
  { ticker: "GGRM", name: "Gudang Garam Tbk", sector: "Rokok", aliases: ["gudang garam"] },
  { ticker: "HMSP", name: "H.M. Sampoerna Tbk", sector: "Rokok", aliases: ["sampoerna"] },
  { ticker: "CMRY", name: "Cisarua Mountain Dairy (Cimory) Tbk", sector: "Susu & Makanan", aliases: ["cimory"] },
  { ticker: "ULTJ", name: "Ultra Jaya Milk Industry Tbk", sector: "Minuman Susu", aliases: ["ultrajaya", "ultra milk"] },

  // Ritel & Perdagangan
  { ticker: "AMRT", name: "Sumber Alfaria Trijaya (Alfamart) Tbk", sector: "Minimarket", aliases: ["alfamart"] },
  { ticker: "MIDI", name: "Midi Utama Indonesia (Alfamidi) Tbk", sector: "Minimarket", aliases: ["alfamidi"] },
  { ticker: "MAPI", name: "Mitra Adiperkasa Tbk", sector: "Ritel Fashion & F&B", aliases: ["map", "starbucks"] },
  { ticker: "ACES", name: "Aspirasi Hidup Indonesia (Ace Hardware) Tbk", sector: "Perkakas & Rumah Tangga", aliases: ["ace hardware", "ace"] },

  // Otomotif, Alat Berat & Semen
  { ticker: "ASII", name: "Astra International Tbk", sector: "Konglomerasi Otomotif", aliases: ["astra"] },
  { ticker: "UNTR", name: "United Tractors Tbk", sector: "Alat Berat & Kontraktor", aliases: ["united tractors"] },
  { ticker: "SMGR", name: "Semen Indonesia (SIG) Tbk", sector: "Semen BUMN", aliases: ["semen indonesia", "sig"] },
  { ticker: "INTP", name: "Indocement Tunggal Prakarsa Tbk", sector: "Semen", aliases: ["indocement", "tiga roda"] },

  // Properti & Konstruksi
  { ticker: "CTRA", name: "Ciputra Development Tbk", sector: "Properti & Real Estate", aliases: ["ciputra"] },
  { ticker: "BSDE", name: "Bumi Serpong Damai (BSD) Tbk", sector: "Kota Mandiri Properti", aliases: ["bsd"] },
  { ticker: "PWON", name: "Pakuwon Jati Tbk", sector: "Mall & Properti", aliases: ["pakuwon"] },
  { ticker: "SMRA", name: "Summarecon Agung Tbk", sector: "Properti & Hunian", aliases: ["summarecon"] },
  { ticker: "JSMR", name: "Jasa Marga (Persero) Tbk", sector: "Jalan Tol BUMN", aliases: ["jasa marga"] },

  // Rumah Sakit
  { ticker: "MIKA", name: "Mitra Keluarga Karyasehat Tbk", sector: "Rumah Sakit", aliases: ["mitra keluarga"] },
  { ticker: "HEAL", name: "Medikaloka Hermina (RS Hermina) Tbk", sector: "Rumah Sakit", aliases: ["hermina"] },
  { ticker: "SILO", name: "Siloam International Hospitals Tbk", sector: "Rumah Sakit", aliases: ["siloam"] }
];

export function resolveTicker(query) {
  if (!query) return "";
  const q = query.toUpperCase().trim();
  if (ALIAS_MAP[q]) return ALIAS_MAP[q];
  
  // Find in company aliases or names
  const qLower = query.toLowerCase().trim();
  const match = IDX_COMPANIES.find(c => 
    c.ticker.toLowerCase() === qLower ||
    c.name.toLowerCase().includes(qLower) ||
    (c.aliases && c.aliases.some(a => a.includes(qLower)))
  );
  if (match) return match.ticker;

  return q.replace(".JK", "");
}
