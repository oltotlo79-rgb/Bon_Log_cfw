 
import { createSeedPrismaClient } from '../shared/create-client'

const prisma = createSeedPrismaClient();

type Action = "none" | "light" | "moderate" | "heavy";
type Level = "high" | "balanced" | "low" | "none";

interface MonthPlan {
  month: number;
  action: Action;
  nitrogenLevel: Level | null;
  phosphorusLevel: Level | null;
  potassiumLevel: Level | null;
  recommendedType: string | null;
  description: string;
  cautionNote: string | null;
}

/** 施肥不要月のヘルパー */
function nonePlan(month: number, desc: string, caution?: string): MonthPlan {
  return {
    month,
    action: "none",
    nitrogenLevel: null,
    phosphorusLevel: null,
    potassiumLevel: null,
    recommendedType: null,
    description: desc,
    cautionNote: caution ?? null,
  };
}

/** 施肥月のヘルパー */
function plan(
  month: number,
  action: Action,
  n: Level,
  p: Level,
  k: Level,
  desc: string,
  caution?: string,
  recType?: string,
): MonthPlan {
  return {
    month,
    action,
    nitrogenLevel: n,
    phosphorusLevel: p,
    potassiumLevel: k,
    recommendedType: recType ?? null,
    description: desc,
    cautionNote: caution ?? null,
  };
}

const nutrients = [
  // -- primary --
  {
    name: "窒素",
    nameEn: "Nitrogen",
    symbol: "N",
    category: "primary" as const,
    description: "植物の生長に最も多く必要とされる元素。アミノ酸・タンパク質・核酸・葉緑素の構成成分であり、葉や茎の細胞分裂・伸長を促進する。「葉肥（はごえ）」とも呼ばれ、施肥量のコントロールが盆栽管理の要となる。",
    bonsaiRole: "盆栽では新芽の展開・葉色の維持に不可欠だが、過剰に与えると徒長（節間が伸びすぎる）を招き、小さく締まった樹形を崩す。特に五葉松や真柏など繊細な樹種では春の窒素を極力抑え、秋に集中して与えるのが定石。紅葉樹（楓・銀杏）は夏以降の窒素カットが美しい紅葉・黄葉の条件となる。",
    deficiencySymptoms: "下位葉（古い葉）から黄化が始まり、全体の生育が停滞する。葉が小さくなり、新梢の伸びが悪くなる。ひどい場合は下葉が落葉し、樹勢が著しく衰える。",
    excessSymptoms: "徒長して節間が間延びし、盆栽としての樹形が崩れる。葉が大きく軟弱になり、病害虫への抵抗力が低下する。花物では花付きが悪くなり、紅葉樹では紅葉が鈍くなる。",
    foodSources: "油粕類、魚粉類、骨粉入り油粕、草木灰以外のほぼ全ての有機肥料に含まれる。化成肥料では硫安、尿素、硝酸アンモニウム等。",
    slug: "nitrogen",
    sortOrder: 1,
  },
  {
    name: "リン酸",
    nameEn: "Phosphorus",
    symbol: "P",
    category: "primary" as const,
    description: "エネルギー代謝（ATP）・核酸・細胞膜の構成に不可欠な元素。花芽分化・開花・結実・種子形成を促進することから「花肥（はなごえ）」「実肥（みごえ）」と呼ばれる。根の発達にも深く関与する。",
    bonsaiRole: "花物盆栽（梅・皐月・長寿梅等）では花芽分化期にリン酸を重点的に施すことで花付きを向上させる。実物盆栽（柿・姫リンゴ等）でも結実を促す重要な要素。松柏類でも根の充実に寄与するため、秋肥でバランスよく配合する。",
    deficiencySymptoms: "葉が暗緑色〜紫色を帯びる。花付き・実付きが著しく悪化し、根の発育も不良になる。全体的に生育が緩慢になる。",
    excessSymptoms: "鉄や亜鉛など微量要素の吸収を阻害し、二次的な欠乏症状を引き起こす。土壌のリン酸過剰は改善が難しいため、施肥量の管理が重要。",
    foodSources: "骨粉類、魚粉類、米ぬか、鶏糞。化成肥料では過リン酸石灰、熔成リン肥等。",
    slug: "phosphorus",
    sortOrder: 2,
  },
  {
    name: "カリウム",
    nameEn: "Potassium",
    symbol: "K",
    category: "primary" as const,
    description: "植物体内の浸透圧調整、酵素の活性化、光合成産物の転流に関与する元素。根の発達を促すことから「根肥（ねごえ）」と呼ばれ、耐寒性・耐病性・耐乾燥性を高める働きがある。",
    bonsaiRole: "盆栽の秋肥ではカリウムを多めに配合するのが基本。冬越しに備えて根を充実させ、耐寒性を向上させる。松柏類の秋肥では特に重要で、翌春の力強い芽出しの基盤となる。紅葉樹では窒素に代わる秋の主要栄養素として、カリウム主体の施肥が推奨される。",
    deficiencySymptoms: "葉の縁が枯れる（縁焼け）症状が特徴的。根の発育不良、茎が軟弱になる。耐寒性・耐病性が低下し、霜害や病害虫の被害を受けやすくなる。",
    excessSymptoms: "カルシウムやマグネシウムの吸収を拮抗阻害する。過剰になると土壌の塩類濃度が上がり、根傷みの原因となる。",
    foodSources: "草木灰、海藻類、木質系堆肥。化成肥料では塩化カリ、硫酸カリ等。",
    slug: "potassium",
    sortOrder: 3,
  },
  // -- secondary --
  {
    name: "カルシウム",
    nameEn: "Calcium",
    symbol: "Ca",
    category: "secondary" as const,
    description: "細胞壁の構造を強化するペクチン酸カルシウムの主成分。細胞分裂時に必要であり、根端の正常な生長に不可欠。土壌のpH調整にも関わる。",
    bonsaiRole: "盆栽用土は赤玉土主体で比較的カルシウムが少ないため、長期間植え替えをしないと不足することがある。根の健全な発達と細胞壁の強化に寄与し、樹全体の構造的な強さを保つ。苦土石灰の少量施用や、カルシウムを含む有機肥料（骨粉等）で補給する。",
    deficiencySymptoms: "新芽の生育不良、新葉が奇形になる。根端が壊死し、根の伸長が止まる。果実のしりぐされ症（カルシウム欠乏の典型）。",
    excessSymptoms: "カルシウム過剰は土壌pHの上昇（アルカリ化）を招き、その結果として鉄やマンガンが不溶化し吸収が阻害される（二次的な微量要素欠乏）。皐月など酸性土壌を好む樹種では特に注意が必要。",
    foodSources: "骨粉類、卵殻、貝殻粉末、苦土石灰。化成肥料では過リン酸石灰に含まれる。",
    slug: "calcium",
    sortOrder: 4,
  },
  {
    name: "マグネシウム",
    nameEn: "Magnesium",
    symbol: "Mg",
    category: "secondary" as const,
    description: "葉緑素（クロロフィル）分子の中心原子であり、光合成の根幹を担う元素。リン酸の吸収・転流にも関与し、多くの酵素反応に必要。",
    bonsaiRole: "葉色の美しさに直結する重要な要素。マグネシウムが不足すると光合成効率が低下し、樹勢が衰える。盆栽の限られた用土量では不足しやすいため、苦土石灰やマグネシウム含有の肥料で定期的に補う。特に松柏類の濃い緑の維持に重要。",
    deficiencySymptoms: "下位葉（古い葉）の葉脈間が黄化する（葉脈は緑色のまま残る）。症状が進むと上位葉にも広がり、早期落葉を招く。",
    excessSymptoms: "カルシウムやカリウムの吸収を阻害する。通常の施肥では過剰になりにくいが、苦土石灰の過剰施用に注意。",
    foodSources: "苦土石灰、海藻類、米ぬか。化成肥料では硫酸マグネシウム（エプソムソルト）等。",
    slug: "magnesium",
    sortOrder: 5,
  },
  {
    name: "硫黄",
    nameEn: "Sulfur",
    symbol: "S",
    category: "secondary" as const,
    description: "含硫アミノ酸（システイン・メチオニン）やタンパク質の合成に不可欠。ビタミンB1やCoA等の補酵素の構成成分でもある。",
    bonsaiRole: "盆栽栽培では単独で意識されることは少ないが、硫酸系肥料（硫安、硫酸カリ等）に含まれるため通常は不足しにくい。有機肥料主体の管理でも油粕や魚粉に含まれる。皐月など酸性を好む樹種には硫黄華による土壌酸性化が有効な場合がある。",
    deficiencySymptoms: "新葉の黄化（窒素欠乏に似るが、硫黄欠乏は新葉から症状が出る点が異なる）。全体的に生育が緩慢になる。",
    excessSymptoms: "土壌が過度に酸性化し、アルミニウム毒性を誘発する可能性がある。通常の盆栽管理では過剰になりにくい。",
    foodSources: "油粕類、魚粉類に含まれる。化成肥料では硫安、硫酸カリ等の硫酸系肥料。硫黄華は土壌酸性化に使用。",
    slug: "sulfur",
    sortOrder: 6,
  },
  // -- trace --
  {
    name: "鉄",
    nameEn: "Iron",
    symbol: "Fe",
    category: "trace" as const,
    description: "葉緑素の合成に不可欠な元素（葉緑素そのものには含まれないが合成過程で必要）。呼吸鎖の電子伝達や窒素固定にも関与する。",
    bonsaiRole: "鉄欠乏は盆栽で最もよく見られる微量要素の問題の一つ。特にアルカリ性に傾いた用土や、石灰過多の場合に発生しやすい。皐月・ツツジ類など酸性土壌を好む樹種で顕著に現れる。葉面散布による速効的な補給が効果的。",
    deficiencySymptoms: "新葉が葉脈を残して黄白化する（クロロシス）。進行すると葉全体が白化し、生育が著しく停滞する。アルカリ土壌で発生しやすい。",
    excessSymptoms: "葉に褐色の斑点が出る。通常の盆栽管理では過剰になりにくい。",
    foodSources: "赤玉土自体に含まれる。有機肥料では魚粉、油粕に微量含有。鉄力あぐり等のキレート鉄資材、硫酸第一鉄。",
    slug: "iron",
    sortOrder: 7,
  },
  {
    name: "マンガン",
    nameEn: "Manganese",
    symbol: "Mn",
    category: "trace" as const,
    description: "光合成の水分解反応（酸素発生）に必須の元素。複数の酵素の活性化因子として働き、葉緑素の合成にも関与する。",
    bonsaiRole: "盆栽用土の赤玉土にある程度含まれるため、通常は不足しにくい。ただし、石灰の過剰施用でpHが上がると不溶化して吸収できなくなる。鉄欠乏と同時に発生することが多い。",
    deficiencySymptoms: "葉脈間の黄化（鉄欠乏に似るが、マンガン欠乏では斑状に現れることが多い）。光合成効率の低下。",
    excessSymptoms: "酸性土壌で過剰吸収されやすく、葉に褐色の小斑点が多数現れる。根の発育阻害。",
    foodSources: "赤玉土、腐葉土に含まれる。化成肥料では硫酸マンガン等。",
    slug: "manganese",
    sortOrder: 8,
  },
  {
    name: "ホウ素",
    nameEn: "Boron",
    symbol: "B",
    category: "trace" as const,
    description: "細胞壁の構造維持、糖の転流、花粉管の伸長に関与する元素。カルシウムと協調して細胞壁の強度を保つ。",
    bonsaiRole: "花物盆栽（梅・皐月等）では花粉の正常な発芽と結実に不可欠。実物盆栽でも果実の品質に影響する。盆栽用土では不足しやすい要素の一つで、微量要素入りの肥料で補給するとよい。",
    deficiencySymptoms: "新芽が奇形になる。花粉の発芽不良で結実が悪化。茎の内部が空洞化する。根の伸長停止。",
    excessSymptoms: "葉先・葉縁が褐変して枯れる。過剰害が出やすい要素なので施用量に注意が必要。",
    foodSources: "堆肥、腐葉土に含まれる。ホウ砂（微量で使用）。微量要素配合肥料。",
    slug: "boron",
    sortOrder: 9,
  },
  {
    name: "亜鉛",
    nameEn: "Zinc",
    symbol: "Zn",
    category: "trace" as const,
    description: "オーキシン（植物ホルモン）の合成前駆体であるトリプトファンの生成に関与。多数の酵素の構成成分または活性化因子として働く。",
    bonsaiRole: "盆栽では亜鉛欠乏による小葉化が問題となることがある。特にリン酸の過剰施肥で亜鉛の吸収が阻害されるケースに注意。微量要素入りの有機肥料を定期的に施すことで予防できる。",
    deficiencySymptoms: "葉が極端に小さくなる（小葉症）。節間が短縮してロゼット状になる。葉脈間の黄白化。",
    excessSymptoms: "根の発育阻害、鉄欠乏症状の誘発。通常の盆栽管理では過剰になりにくい。",
    foodSources: "堆肥、家畜糞に含まれる。化成肥料では硫酸亜鉛等。微量要素配合肥料。",
    slug: "zinc",
    sortOrder: 10,
  },
  {
    name: "銅",
    nameEn: "Copper",
    symbol: "Cu",
    category: "trace" as const,
    description: "光合成の電子伝達系、呼吸鎖、リグニン合成に関与する元素。ポリフェノールオキシダーゼ等の酵素の構成成分。",
    bonsaiRole: "リグニン合成に関与するため、枝の木質化と強度に影響する。銅欠乏は盆栽では稀だが、有機質に富む用土で長期間植え替えをしないと不足する可能性がある。銅を含む殺菌剤（ボルドー液等）の使用で間接的に補給されることもある。",
    deficiencySymptoms: "新葉の萎れ・白化。枝の木質化が遅延し、先端が枯死する。",
    excessSymptoms: "根の発育を著しく阻害する。銅は過剰害が出やすいため、施用には注意が必要。",
    foodSources: "堆肥に微量含有。化成肥料では硫酸銅等。ボルドー液（殺菌剤）にも銅が含まれる。",
    slug: "copper",
    sortOrder: 11,
  },
  {
    name: "モリブデン",
    nameEn: "Molybdenum",
    symbol: "Mo",
    category: "trace" as const,
    description: "硝酸還元酵素の構成成分で、硝酸態窒素をアンモニア態窒素に変換する過程に不可欠。窒素固定にも関与する。",
    bonsaiRole: "盆栽では窒素代謝に間接的に関わるため、不足すると窒素肥料を与えても効果が出にくくなる。酸性土壌で不溶化しやすいため、皐月など酸性土壌管理の樹種では注意が必要。必要量は極めて微量。",
    deficiencySymptoms: "葉縁が上向きに巻き込む。古い葉の葉脈間が黄化する。窒素欠乏に似た症状が出る。",
    excessSymptoms: "通常の盆栽管理では過剰になることはほぼない。",
    foodSources: "豆類の種子に多い。堆肥に微量含有。化成肥料ではモリブデン酸ナトリウム等。",
    slug: "molybdenum",
    sortOrder: 12,
  },
  {
    name: "塩素",
    nameEn: "Chlorine",
    symbol: "Cl",
    category: "trace" as const,
    description: "光合成の水分解反応に関与し、気孔の開閉にも関わる。浸透圧の調整に寄与する必須微量元素。",
    bonsaiRole: "水道水や雨水に十分な量が含まれるため、盆栽栽培で塩素欠乏が問題になることはほぼない。むしろ塩化カリなどによる過剰に注意する必要がある。塩素に敏感な樹種（皐月等）では塩化物系肥料を避け、硫酸カリを使用する。",
    deficiencySymptoms: "葉先の萎れ、葉の青銅色化。通常は欠乏しにくい。",
    excessSymptoms: "葉先・葉縁の枯れ（塩害）。塩素に敏感な樹種では落葉することもある。",
    foodSources: "水道水、雨水に含まれる。塩化カリ、塩化アンモニウム等。通常は意識的な補給は不要。",
    slug: "chlorine",
    sortOrder: 13,
  },
  {
    name: "ニッケル",
    nameEn: "Nickel",
    symbol: "Ni",
    category: "trace" as const,
    description: "ウレアーゼの構成成分で、尿素の分解に不可欠。植物の窒素代謝において重要な役割を果たす。1987年にBrownらの研究でウレアーゼの必須補因子として確立され、高等植物の必須微量要素として広く認められるようになった。",
    bonsaiRole: "尿素を含む肥料を使用する際にニッケルが不足すると、尿素が植物体内に蓄積して毒性を示す。盆栽では有機肥料（油粕等）の分解過程で生成される尿素の代謝にも関与する。通常は用土や有機肥料から十分に供給される。",
    deficiencySymptoms: "尿素が蓄積し、葉先が壊死する。種子の発芽率が低下する。極めて稀な欠乏症。",
    excessSymptoms: "葉の黄化、根の発育阻害。通常の栽培条件では過剰になりにくい。",
    foodSources: "堆肥、用土中に微量含有。通常は意識的な補給は不要。",
    slug: "nickel",
    sortOrder: 14,
  },
  {
    name: "ケイ素",
    nameEn: "Silicon",
    symbol: "Si",
    category: "trace" as const,
    description: "**分類: 有用元素 (Beneficial Element)** — 高等植物の17必須元素には通常含まれない (USDA / Ohio State University Extension の植物栄養分類)。ただし細胞壁にケイ酸として沈着し物理的強度・病害虫抵抗性を高めるため、Texas A&M AgriLife Extension や日本の肥料取締法でも有用成分として扱う。schema 上は `trace` enum で表現しているが、本来は beneficial / conditional 分類が正しい。",
    bonsaiRole: "盆栽では茎・葉の物理的強度を高め、病害虫（特にうどんこ病等の糸状菌）への抵抗力を向上させる効果が期待できる。赤玉土や鹿沼土にはケイ酸が含まれるため、通常の盆栽用土で不足することは少ない。ケイ酸カリ肥料として補給することもある。",
    deficiencySymptoms: "茎が軟弱になり倒伏しやすくなる。病害虫への抵抗力が低下する。必須元素ではないため欠乏症は定義しにくい。",
    excessSymptoms: "通常は過剰害なし。ケイ酸は土壌中で不溶化しやすく、過剰吸収されにくい。",
    foodSources: "赤玉土、鹿沼土に含まれる。ケイ酸カリ、ケイ酸カルシウム（珪石）。稲わら堆肥。",
    slug: "silicon",
    sortOrder: 15,
  },
  {
    name: "コバルト",
    nameEn: "Cobalt",
    symbol: "Co",
    category: "trace" as const,
    description: "**分類: 条件付き有用元素 (Conditional / Beneficial Element)** — 高等植物自体の必須元素ではないが、根粒菌のニトロゲナーゼ補因子であるビタミンB12の構成元素として共生微生物に必須 (Texas A&M AgriLife Extension / Ohio State Extension の分類)。マメ科植物の窒素固定で間接的に重要。schema 上は `trace` enum で表現しているが、本来は conditional/beneficial 分類が正しい。",
    bonsaiRole: "盆栽樹種にマメ科は少ないため、コバルトが直接問題になることは稀。ただし、土壌微生物の活動に間接的に関与するため、有機肥料主体の管理では堆肥を通じて自然に供給される。意識的な補給は通常不要。",
    deficiencySymptoms: "マメ科植物での窒素固定能の低下。盆栽の一般的な樹種では明確な欠乏症状は確認されにくい。",
    excessSymptoms: "葉の黄化、生育阻害。通常の栽培条件では問題にならない。",
    foodSources: "堆肥、動物性有機肥料に微量含有。通常は意識的な補給は不要。",
    slug: "cobalt",
    sortOrder: 16,
  },
];

const fertilizerCategories = [
  {
    code: "organic_solid",
    name: "有機固形肥料",
    description: "油粕類、骨粉類、魚粉類などの天然有機物を原料とする固形肥料の総称。土壌微生物によってゆっくりと分解され、1〜2ヶ月かけて効果が持続する緩効性が特徴。",
    merit: "土壌微生物を活性化し、土壌の物理性・化学性を長期的に改善する。肥料焼けのリスクが化成肥料より低く、穏やかに効く。盆栽の伝統的な施肥法（置き肥）との相性が極めてよい。",
    demerit: "分解に時間がかかるため即効性がない。梅雨時に臭いやカビが発生しやすい。虫（コバエ等）が寄ることがある。成分比率が製品によってばらつきがある。",
    bonsaiUsage: "盆栽の主要な施肥方法である「置き肥」に最も適した肥料分類。鉢土の表面に置き、水やりのたびに少しずつ溶け出して効果を発揮する。春と秋の生長期に月1回程度交換するのが一般的。梅雨期・真夏は外す。",
    slug: "organic-solid",
    sortOrder: 1,
  },
  {
    code: "organic_liquid",
    name: "有機液体肥料",
    description: "魚のアラ、海藻、油粕などを水で抽出・発酵させた液状の有機肥料。希釈して水やりと同時に施すことができる。",
    merit: "有機質でありながら比較的速やかに吸収される。土壌微生物の活性化効果がある。固形肥料の補助として使い分けができる。",
    demerit: "希釈倍率を間違えると濃度障害を起こす。有機物由来の臭いがある。保存中に発酵が進み、品質が変化することがある。",
    bonsaiUsage: "置き肥を施していない時期の補助的な施肥や、草物・山野草など繊細な樹種への穏やかな養分補給に適する。水やり代わりに希釈液を与える方法が一般的。真夏の夕方に薄めに施すのも有効。",
    slug: "organic-liquid",
    sortOrder: 2,
  },
  {
    code: "chemical_solid",
    name: "化成固形肥料",
    description: "化学的に合成された無機塩を原料とする固形肥料。N-P-Kの成分比率が明確で、速効性がある。粒状・粉状・錠剤状など様々な形態がある。",
    merit: "成分比率が正確で、狙った栄養素を的確に補給できる。速効性があり、欠乏症状の迅速な改善に適する。臭いが少なく、室内での管理にも向く。",
    demerit: "効きが強いため、施肥量を間違えると肥料焼けを起こしやすい。土壌微生物への恩恵がなく、長期使用で用土の物理性が悪化する場合がある。",
    bonsaiUsage: "有機肥料を基本とし、特定の栄養素を補いたい場合の補助として使用するのが盆栽での一般的な位置づけ。春先の速やかな立ち上がりや、微量要素の補給に活用する。置き肥として使う場合は少量を心がける。",
    slug: "chemical-solid",
    sortOrder: 3,
  },
  {
    code: "chemical_liquid",
    name: "化成液体肥料",
    description: "無機塩を水に溶解させた液状の肥料。希釈して使用し、即効性が高い。N-P-Kの比率を自由に設計でき、微量要素入りの製品も多い。",
    merit: "即効性があり、肥料切れや欠乏症の迅速な対応に適する。希釈倍率で濃度を自在に調整できる。葉面散布にも使用可能。",
    demerit: "効果の持続期間が短い（1〜2週間）。頻繁な施用が必要。過濃度で肥料焼けのリスクが高い。土壌改善効果はない。",
    bonsaiUsage: "置き肥の補助として、生長期に週1回〜月2回程度の頻度で施用する。栄養素の欠乏症状が出た場合の応急処置としても有効。真夏の夕方に規定より薄めに希釈して使うとよい。",
    slug: "chemical-liquid",
    sortOrder: 4,
  },
  {
    code: "slow_release",
    name: "緩効性肥料",
    description: "肥料成分がゆっくりと溶出するよう加工された肥料の総称。有機肥料も広義の緩効性だが、ここでは化学的にコーティングや造粒された製品を指す。",
    merit: "1回の施肥で1〜3ヶ月効果が持続し、施肥の手間が減る。肥料焼けのリスクが低い。成分の溶出が安定しており、過不足が生じにくい。",
    demerit: "初期の効きが遅い。細かな施肥量の調整がしにくい。有機肥料のような土壌改良効果は期待できない。",
    bonsaiUsage: "長期間家を空ける場合や、こまめな施肥管理が難しい場合に便利。ただし、盆栽の伝統的な管理では月ごとの置き肥交換が基本であり、季節に応じた細やかな施肥調整には向かない。初心者の失敗防止には有効。",
    slug: "slow-release",
    sortOrder: 5,
  },
  {
    code: "controlled_release",
    name: "溶出制御型肥料",
    description: "樹脂コーティング等により、温度に応じて肥料成分の溶出速度を制御した肥料。緩効性肥料の発展形で、より精密な溶出パターンを実現する。",
    merit: "温度依存型の溶出により、植物の生長速度と肥料の効き方が自然に同期する。春〜秋の生長期に多く溶出し、冬は溶出が止まる。1回の施肥で半年以上持続するものもある。",
    demerit: "高価。コーティング樹脂が用土に残り、見た目が悪い場合がある。梅雨時に一気に溶出が進むリスクがある。",
    bonsaiUsage: "盆栽ではあまり一般的ではないが、管理の省力化を重視する場合に選択肢となる。展示前の仕上げ期には使わず、養成段階の樹で活用するのが現実的。溶出パターンを理解した上で使う必要がある。",
    slug: "controlled-release",
    sortOrder: 6,
  },
  {
    code: "foliar",
    name: "葉面散布材",
    description: "葉の表面から直接栄養素を吸収させるための液状資材。微量要素の補給や、根からの吸収が困難な状況での緊急的な栄養補給に用いる。",
    merit: "根の状態に関わらず速やかに栄養素を補給できる。微量要素（鉄・マンガン等）の欠乏症に即効性がある。根へのストレスがない。",
    demerit: "効果の持続時間が短い（数日）。大量の栄養素補給には向かない。高温時や強日照下での散布は薬害のリスクがある。",
    bonsaiUsage: "植え替え直後で根が十分に機能していない時期や、微量要素欠乏の応急処置に有効。曇天日の早朝か夕方に散布する。鉄欠乏によるクロロシスの改善に特に効果的。通常の施肥の代替にはならず、あくまで補助手段として位置づける。",
    slug: "foliar",
    sortOrder: 7,
  },
];

const treeSpecies = [
  // -- conifer (7) --
  {
    name: "黒松",
    nameEn: "Japanese Black Pine",
    category: "conifer" as const,
    description: "松柏盆栽の代表格。力強い幹と荒々しい樹皮が魅力。肥料を好む松で、特に芽切り後の追肥と秋肥が重要。",
    examples: "黒松（クロマツ）",
    fertilizingPolicy: "松柏類の中では最も肥料を好む樹種。春は新芽（ミドリ）の伸長を抑えるため控えめに始め、5月に通常量。6月の芽切り前に肥料を外し、芽切り後2〜3週間で二番芽が動いたら再開する。秋（9〜11月）はたっぷりと与え、翌春の芽出しに備える。冬と梅雨は無施肥。",
    slug: "kuromatsu",
    sortOrder: 1,
  },
  {
    name: "赤松",
    nameEn: "Japanese Red Pine",
    category: "conifer" as const,
    description: "黒松より繊細で優美な樹姿が特徴。赤みを帯びた樹皮が美しい。黒松より肥料を控えめにし、繊細な枝葉を維持する。",
    examples: "赤松（アカマツ）",
    fertilizingPolicy: "黒松と基本パターンは同じだが、全体的に施肥量を控えめにする。肥料過多は葉が長くなり赤松の優美さを損なう。春は最小限、芽切り後は黒松同様に再開。秋肥は黒松の7〜8割程度を目安とし、樹勢を見ながら加減する。",
    slug: "akamatsu",
    sortOrder: 2,
  },
  {
    name: "五葉松",
    nameEn: "Japanese White Pine",
    category: "conifer" as const,
    description: "短い五本束の葉が密につき、優雅で品格のある姿が魅力。松の中で最も肥料を嫌い、春は完全無施肥が鉄則。",
    examples: "五葉松（ゴヨウマツ）、那須五葉、四国五葉",
    fertilizingPolicy: "松柏類の中で最も肥料を控える樹種。春〜夏は一切施肥しない。春に肥料を与えると芽が徒長して間延びし、盆栽としての価値が大きく下がる。施肥は秋（9〜11月）のみに限定し、それも控えめに。カリウム重視で根の充実を図る。",
    slug: "goyomatsu",
    sortOrder: 3,
  },
  {
    name: "真柏",
    nameEn: "Chinese Juniper / Shimpaku",
    category: "conifer" as const,
    description: "ジン・シャリの白い枯れ木と緑の葉のコントラストが美しい。比較的肥料を好む樹種で、適切な施肥で葉色と樹勢が向上する。",
    examples: "真柏（シンパク）、糸魚川真柏、紀州真柏",
    fertilizingPolicy: "松柏類の中では比較的肥料を好む樹種。春から通常量で施肥を始め、成長期はしっかり与える。ただし窒素過多は杉葉（先祖返り）の原因となるため、バランス型〜カリウムやや多めの配合が向く。梅雨・真夏は無施肥とし、秋はカリウム重視で根の充実を図る。",
    slug: "shinpaku",
    sortOrder: 4,
  },
  {
    name: "杜松",
    nameEn: "Needle Juniper",
    category: "conifer" as const,
    description: "鋭い針葉と独特の幹模様が特徴的な松柏盆栽。比較的肥料を好み、適度な施肥で短く締まった葉を維持できる。",
    examples: "杜松（トショウ）、這い性杜松",
    fertilizingPolicy: "真柏と同様に比較的肥料を好む樹種。春から通常量で施肥し、成長期はしっかり与える。極端な過肥は葉が長く間延びする原因となるため、樹勢を見ながら調整する。秋はカリウムやや多めに根の充実を図る。梅雨・真夏は無施肥。",
    slug: "tosho",
    sortOrder: 5,
  },
  {
    name: "檜・椹・檜葉",
    nameEn: "Hinoki Cypress and related",
    category: "conifer" as const,
    description: "緻密な鱗葉と赤褐色の幹が美しい松柏盆栽。松柏類の中では比較的肥料を好む方で、適度な施肥で葉色がよくなる。",
    examples: "檜（ヒノキ）、椹（サワラ）、檜葉（ヒバ）、翌檜（アスナロ）",
    fertilizingPolicy: "松柏類の中では比較的肥料を好み、適度に施すことで葉の密度と色つやが向上する。春から秋まで定期的に施肥し、梅雨と真夏は休止。秋肥はしっかりと。極端な肥料切れは葉枯れの原因になるため注意。",
    slug: "hinoki",
    sortOrder: 6,
  },
  {
    name: "杉・槙・その他針葉樹",
    nameEn: "Cedar, Podocarpus and other conifers",
    category: "conifer" as const,
    description: "杉や槙など、松・真柏・檜以外の針葉樹をまとめた分類。比較的肥料を好む樹種が多い。",
    examples: "杉（スギ）、槙（マキ）、羅漢槙（ラカンマキ）、金松（コウヤマキ）",
    fertilizingPolicy: "比較的肥料を好む樹種が多く、春〜秋の生長期に定期的に施肥する。梅雨と真夏は休止。特に春の芽出し期と秋の充実期にしっかりと。槙は常緑で冬も活動するため、暖地では12月まで軽く施肥を続けることもある。",
    slug: "sugi-maki",
    sortOrder: 7,
  },
  // -- deciduous (5) --
  {
    name: "楓・紅葉",
    nameEn: "Japanese Maple",
    category: "deciduous" as const,
    description: "秋の紅葉が最大の見どころ。美しい紅葉のためには夏以降の窒素管理が決定的に重要。",
    examples: "楓（カエデ）、いろはもみじ、山もみじ、出猩々",
    fertilizingPolicy: "春は芽出し後にバランスよく施肥し、5月の葉刈り前に体力をつける。最大のポイントは7月以降の窒素完全カット。窒素が残ると紅葉が鈍くなる。9月以降はカリウム主体で施肥を再開し、紅葉の発色を促す。梅雨・真夏は無施肥。",
    slug: "kaede-momiji",
    sortOrder: 8,
  },
  {
    name: "欅",
    nameEn: "Japanese Zelkova",
    category: "deciduous" as const,
    description: "箒立ちの美しい樹形が魅力。肥料を好み、春〜秋に定期的な施肥で旺盛に生長する。",
    examples: "欅（ケヤキ）",
    fertilizingPolicy: "肥料を好む樹種で、春の芽出しから秋まで定期的に施肥する。バランス型の有機固形肥料を基本に、月1回交換。梅雨と真夏は休止。秋肥はカリウムやや多めで冬越しに備える。肥料切れは枝先の枯れ込みの原因となるため注意。",
    slug: "keyaki",
    sortOrder: 9,
  },
  {
    name: "ブナ・コナラ・クヌギ",
    nameEn: "Beech, Konara Oak, Sawtooth Oak",
    category: "deciduous" as const,
    description: "雑木盆栽の代表格。自然樹形の素朴な美しさが魅力。バランス型の標準的な施肥で管理する。",
    examples: "ブナ、コナラ、クヌギ、イヌブナ",
    fertilizingPolicy: "バランス型の標準的な施肥を行う。春の芽出し後から施肥を開始し、梅雨前に一旦外す。秋は9月から再開し、11月まで。特に偏った施肥は必要なく、N-P-Kバランスの取れた有機固形肥料が適する。",
    slug: "buna-konara",
    sortOrder: 10,
  },
  {
    name: "銀杏",
    nameEn: "Ginkgo",
    category: "deciduous" as const,
    description: "秋の黄葉が美しい古代からの樹種。比較的肥料に強く、やや多めでも問題ないが、美しい黄葉のために夏以降は窒素を控える。",
    examples: "銀杏（イチョウ）",
    fertilizingPolicy: "比較的肥料を好み、多少多めに施しても徒長しにくい丈夫な樹種。春〜初夏はバランスよく施肥する。ただし美しい黄葉のためには楓と同様に夏以降は窒素を控え、カリウム主体に切り替える。梅雨・真夏は無施肥。",
    slug: "ichou",
    sortOrder: 11,
  },
  {
    name: "楡欅・榎",
    nameEn: "Chinese Elm, Hackberry",
    category: "deciduous" as const,
    description: "小葉で枝が密になりやすく、盆栽向きの雑木。欅に近いバランス型の施肥管理が適する。",
    examples: "楡欅（ニレケヤキ）、榎（エノキ）、アキニレ",
    fertilizingPolicy: "欅に準じたバランス型の施肥が基本。春の芽出し後から秋まで定期的に施肥する。樹勢が強いため、やや控えめでも十分育つ。梅雨と真夏は休止。秋はカリウム多めで根を充実させ、冬越しに備える。",
    slug: "nirekeyaki-enoki",
    sortOrder: 12,
  },
  // -- flowering (4) --
  {
    name: "梅",
    nameEn: "Japanese Apricot",
    category: "flowering" as const,
    description: "早春の花と香りが魅力の花物盆栽の代表。花後のお礼肥と花芽分化期のリン酸施肥が最重要。",
    examples: "梅（ウメ）、野梅、紅梅、白梅、枝垂れ梅",
    fertilizingPolicy: "1〜2月の開花期は施肥しない。花後（3月）にお礼肥としてリン酸多めの肥料を速やかに与え、消耗した体力を回復させる。4〜5月は通常施肥。7月は花芽分化期にあたるため、窒素を抑えリン酸を多めに。9〜10月は秋肥でリン酸・カリウム重視。",
    slug: "ume",
    sortOrder: 13,
  },
  {
    name: "皐月",
    nameEn: "Satsuki Azalea",
    category: "flowering" as const,
    description: "5〜6月の華やかな花が魅力。開花前〜開花中は絶対に施肥せず、花後のお礼肥から秋にかけて集中的に施肥する。",
    examples: "皐月（サツキ）、各種園芸品種",
    fertilizingPolicy: "3〜5月は蕾の膨らみから開花までの期間で施肥厳禁。肥料を与えると蕾が落ちたり花が貧弱になる。6月の花がら摘み後すぐにお礼肥を開始し、秋（10〜11月）まで継続する。酸性土壌を好むため石灰系肥料は避ける。",
    slug: "satsuki",
    sortOrder: 14,
  },
  {
    name: "椿・山茶花",
    nameEn: "Camellia, Sasanqua",
    category: "flowering" as const,
    description: "秋〜冬に花を咲かせる常緑花物。花後の春にお礼肥を与え、秋の開花に備える。",
    examples: "椿（ツバキ）、山茶花（サザンカ）、寒椿",
    fertilizingPolicy: "秋〜冬の開花期は施肥しない。花後の3〜4月にお礼肥をしっかり与え、消耗した樹勢を回復させる。5月まで継続し、梅雨と真夏は休止。9月に軽く施肥して開花を支えるが、花蕾が色づき始めたら停止。",
    slug: "tsubaki-sazanka",
    sortOrder: 15,
  },
  {
    name: "長寿梅・木瓜・その他花物",
    nameEn: "Chojubai, Quince and other flowering",
    category: "flowering" as const,
    description: "四季咲き性のある花物や木瓜など。花後ごとのお礼肥を基本に管理する。",
    examples: "長寿梅（チョウジュバイ）、木瓜（ボケ）、満天星（ドウダンツツジ）、藤",
    fertilizingPolicy: "花後のお礼肥を基本とする。長寿梅は四季咲き性があるため、主要な開花後（春・秋）に重点的に施肥する。木瓜は花後の4月から施肥開始。梅雨と真夏は休止。秋はリン酸・カリウム多めで翌春の花芽を充実させる。",
    slug: "chojubai-boke",
    sortOrder: 16,
  },
  // -- fruiting (2) --
  {
    name: "柿・姫リンゴ・海棠",
    nameEn: "Persimmon, Crabapple, Malus",
    category: "fruiting" as const,
    description: "秋の果実が魅力の実物盆栽。開花期にリン酸を重視し、結実中は施肥を控える。",
    examples: "老鴉柿（ロウヤガキ）、姫リンゴ、海棠（カイドウ）、姫柿",
    fertilizingPolicy: "春の開花期はリン酸多めで結実を促す。結実後〜果実肥大中は施肥を控えめにし、果実が色づき始めたら無施肥。収穫後（落果後）にお礼肥として秋にしっかり施肥し、翌年の花芽形成に備える。窒素過多は落果の原因。",
    slug: "kaki-ringo",
    sortOrder: 17,
  },
  {
    name: "ピラカンサ・梅擬・その他実物",
    nameEn: "Pyracantha, Ilex and other fruiting",
    category: "fruiting" as const,
    description: "秋〜冬の赤い実が美しい実物盆栽。春〜初夏のリン酸施肥で結実を促し、実がなったら施肥を控える。",
    examples: "ピラカンサ、梅擬（ウメモドキ）、紫式部、真弓、南天",
    fertilizingPolicy: "春〜初夏にリン酸多めの施肥で花付き・結実を促進する。実が着いたら施肥を控え、実が色づいたら無施肥。落果後（冬〜早春）にお礼肥兼寒肥を施す。常緑種（ピラカンサ等）は冬も軽く施肥を継続できる。",
    slug: "pyracantha-umemodoki",
    sortOrder: 18,
  },
  // -- grass (1) --
  {
    name: "草物・山野草・苔",
    nameEn: "Kusamono, Alpine plants, Moss",
    category: "grass" as const,
    description: "小さな鉢で楽しむ草物盆栽。肥料は極力控えめで、薄い液肥を月に1〜2回与える程度。",
    examples: "各種山野草、ヤマモミジの実生、苔、シダ類",
    fertilizingPolicy: "肥料は極力控えめが基本。置き肥は肥料焼けのリスクがあるため使わず、規定の2〜3倍に薄めた液肥を月1〜2回与える程度にとどめる。生長期（春・秋）のみ施肥し、梅雨・真夏・冬は完全に無施肥。苔は基本的に無肥料で管理する。",
    slug: "kusamono",
    sortOrder: 19,
  },
  // -- evergreen (1) --
  {
    name: "沈丁花・黄楊・柊・その他常緑広葉樹",
    nameEn: "Daphne, Boxwood, Holly and other broadleaf evergreens",
    category: "evergreen" as const,
    description: "年間を通じて緑の葉を保つ常緑広葉樹。春と秋にバランス型の施肥を行い、寒肥も有効。",
    examples: "沈丁花（ジンチョウゲ）、黄楊（ツゲ）、柊（ヒイラギ）、月桂樹",
    fertilizingPolicy: "春（3〜5月）と秋（9〜11月）にバランス型の有機固形肥料を施すのが基本。常緑で冬も完全には休眠しないため、1〜2月に寒肥として緩効性有機肥料を施すと春の芽出しがよくなる。梅雨と真夏は休止。",
    slug: "chinchoge-tsuge",
    sortOrder: 20,
  },
];

type SpeciesPlans = { slug: string; plans: MonthPlan[] };

const allSpeciesPlans: SpeciesPlans[] = [
  // ---- 黒松 ----
  {
    slug: "kuromatsu",
    plans: [
      nonePlan(1, "休眠期。施肥不要。"),
      nonePlan(2, "休眠期。植え替え準備の時期。"),
      nonePlan(3, "植え替え適期。植え替え後は最低1ヶ月間施肥しない。", "植え替えた場合は4月も施肥を控える"),
      plan(4, "light", "low", "balanced", "balanced", "新芽（ミドリ）が伸び始める。徒長防止のため控えめに。", "ミドリの伸びが強い樹は施肥を遅らせる"),
      plan(5, "moderate", "balanced", "balanced", "balanced", "成長期に入り通常の施肥。ミドリ摘み後の回復を支援する。"),
      nonePlan(6, "梅雨期。施肥停止。芽切り2週間前には必ず肥料を外す。", "芽切りを行う場合、肥料が残っていると二番芽が強く出すぎる"),
      plan(7, "light", "balanced", "balanced", "balanced", "芽切り後2〜3週間で二番芽が動き出したら施肥再開。", "二番芽が動くまでは施肥しない"),
      plan(8, "light", "balanced", "balanced", "balanced", "二番芽の成長を支援。猛暑日が続く場合は一時的に外す。", "猛暑日（35℃超）は肥料焼けに注意"),
      plan(9, "moderate", "balanced", "balanced", "high", "秋肥開始。カリウム多めで根の充実を図る。"),
      plan(10, "heavy", "balanced", "balanced", "high", "秋肥の最盛期。たっぷりと施肥し、冬越しと翌春の芽出しに備える。"),
      plan(11, "moderate", "low", "balanced", "high", "施肥終盤。窒素をやや控え、カリウム中心に。"),
      nonePlan(12, "休眠期に入る。施肥停止。"),
    ],
  },
  // ---- 赤松 ----
  {
    slug: "akamatsu",
    plans: [
      nonePlan(1, "休眠期。施肥不要。"),
      nonePlan(2, "休眠期。"),
      nonePlan(3, "植え替え適期。植え替え後は1ヶ月施肥しない。"),
      plan(4, "light", "low", "balanced", "balanced", "新芽が動き始める。黒松より控えめに。", "赤松は肥料過多で葉が長くなるため注意"),
      plan(5, "light", "balanced", "balanced", "balanced", "成長期だが黒松の7〜8割程度の量に抑える。"),
      nonePlan(6, "梅雨期。施肥停止。"),
      plan(7, "light", "low", "balanced", "balanced", "芽切り後、二番芽が動いたら軽く再開。黒松より控えめに。"),
      plan(8, "light", "low", "balanced", "balanced", "控えめに継続。猛暑日は外す。"),
      plan(9, "moderate", "low", "balanced", "high", "秋肥開始。カリウム多めで根の充実。窒素は控えめ。"),
      plan(10, "moderate", "balanced", "balanced", "high", "秋肥。黒松よりやや控えめに。"),
      plan(11, "light", "low", "balanced", "high", "施肥終盤。"),
      nonePlan(12, "休眠期。施肥停止。"),
    ],
  },
  // ---- 五葉松 ----
  {
    slug: "goyomatsu",
    plans: [
      nonePlan(1, "休眠期。施肥不要。"),
      nonePlan(2, "休眠期。"),
      nonePlan(3, "春は施肥しない。芽が伸びすぎて樹形を崩す。", "五葉松の春の無施肥は鉄則"),
      nonePlan(4, "無施肥。芽摘みで樹形を作る時期。肥料は厳禁。", "肥料を与えると徒長して盆栽としての価値が下がる"),
      nonePlan(5, "引き続き無施肥。"),
      nonePlan(6, "梅雨期。無施肥。"),
      nonePlan(7, "真夏。無施肥。"),
      nonePlan(8, "猛暑期。無施肥。"),
      plan(9, "light", "low", "balanced", "high", "秋肥のみ。控えめに開始。カリウム重視で根を充実させる。", "五葉松は秋のみの施肥が基本"),
      plan(10, "moderate", "low", "balanced", "high", "五葉松の主要な施肥時期。カリウム主体でしっかりと。"),
      plan(11, "light", "low", "balanced", "high", "施肥終盤。控えめに。"),
      nonePlan(12, "休眠期。施肥停止。"),
    ],
  },
  // ---- 真柏 ----
  {
    slug: "shinpaku",
    plans: [
      nonePlan(1, "休眠期。施肥不要。"),
      nonePlan(2, "休眠期。"),
      nonePlan(3, "植え替え適期。植え替え後は施肥しない。"),
      plan(4, "moderate", "balanced", "balanced", "balanced", "芽が動き始める。通常量で施肥開始。", "窒素過多は杉葉（先祖返り）の原因になるため配合に注意"),
      plan(5, "moderate", "balanced", "balanced", "balanced", "成長期。通常量の施肥を継続。"),
      nonePlan(6, "梅雨期。施肥停止。"),
      nonePlan(7, "真夏は施肥しない。"),
      nonePlan(8, "猛暑期は無施肥。"),
      plan(9, "moderate", "balanced", "balanced", "high", "秋肥開始。カリウムやや多めに。"),
      plan(10, "heavy", "balanced", "balanced", "high", "秋肥の最盛期。しっかり与える。"),
      plan(11, "moderate", "low", "balanced", "high", "施肥終盤。やや控えめに。"),
      nonePlan(12, "休眠期。施肥停止。"),
    ],
  },
  // ---- 杜松 ----
  {
    slug: "tosho",
    plans: [
      nonePlan(1, "休眠期。施肥不要。"),
      nonePlan(2, "休眠期。"),
      nonePlan(3, "植え替え適期。植え替え後は施肥しない。"),
      plan(4, "moderate", "balanced", "balanced", "balanced", "芽動き。通常量で施肥開始。", "極端な過肥は葉の間延びの原因となる"),
      plan(5, "moderate", "balanced", "balanced", "balanced", "成長期。通常量の施肥を継続。"),
      nonePlan(6, "梅雨期。施肥停止。"),
      nonePlan(7, "真夏は無施肥。"),
      nonePlan(8, "猛暑期は無施肥。"),
      plan(9, "moderate", "balanced", "balanced", "high", "秋肥開始。カリウムやや多めに。"),
      plan(10, "heavy", "balanced", "balanced", "high", "秋肥の最盛期。しっかり与える。"),
      plan(11, "moderate", "low", "balanced", "high", "施肥終盤。やや控えめに。"),
      nonePlan(12, "休眠期。施肥停止。"),
    ],
  },
  // ---- 檜・椹・檜葉 ----
  {
    slug: "hinoki",
    plans: [
      nonePlan(1, "休眠期。施肥不要。"),
      nonePlan(2, "休眠期。"),
      plan(3, "light", "balanced", "balanced", "balanced", "芽動き。植え替え後でなければ軽く施肥開始。"),
      plan(4, "moderate", "balanced", "balanced", "balanced", "成長期。通常量の施肥。"),
      plan(5, "moderate", "balanced", "balanced", "balanced", "成長期の施肥を継続。"),
      nonePlan(6, "梅雨期。施肥停止。"),
      plan(7, "light", "balanced", "balanced", "balanced", "梅雨明け後、軽く再開。"),
      plan(8, "light", "balanced", "balanced", "balanced", "猛暑日は外す。控えめに継続。"),
      plan(9, "moderate", "balanced", "balanced", "high", "秋肥開始。カリウム多めに。"),
      plan(10, "heavy", "balanced", "balanced", "high", "秋肥の最盛期。しっかりと。"),
      plan(11, "moderate", "low", "balanced", "high", "施肥終盤。"),
      nonePlan(12, "休眠期。施肥停止。"),
    ],
  },
  // ---- 杉・槙 ----
  {
    slug: "sugi-maki",
    plans: [
      nonePlan(1, "休眠期。施肥不要。"),
      nonePlan(2, "休眠期。暖地の槙は軽い寒肥も可。"),
      plan(3, "light", "balanced", "balanced", "balanced", "芽動き。施肥開始。"),
      plan(4, "moderate", "balanced", "balanced", "balanced", "成長期。通常量。"),
      plan(5, "moderate", "balanced", "balanced", "balanced", "成長期の施肥を継続。"),
      nonePlan(6, "梅雨期。施肥停止。"),
      plan(7, "light", "balanced", "balanced", "balanced", "梅雨明け後に再開。"),
      plan(8, "light", "balanced", "balanced", "balanced", "猛暑日は外す。"),
      plan(9, "moderate", "balanced", "balanced", "high", "秋肥開始。"),
      plan(10, "heavy", "balanced", "balanced", "high", "秋肥の最盛期。"),
      plan(11, "moderate", "low", "balanced", "high", "施肥終盤。"),
      nonePlan(12, "休眠期。施肥停止。暖地の槙は12月上旬まで軽く継続可。"),
    ],
  },
  // ---- 楓・紅葉 ----
  {
    slug: "kaede-momiji",
    plans: [
      nonePlan(1, "休眠期。施肥不要。"),
      nonePlan(2, "休眠期。植え替え準備。"),
      plan(3, "light", "balanced", "balanced", "balanced", "芽動き。植え替え後は1ヶ月空ける。"),
      plan(4, "moderate", "balanced", "balanced", "balanced", "新芽展開後に施肥開始。通常量。"),
      plan(5, "moderate", "balanced", "balanced", "balanced", "葉刈り前の体力づくり。しっかりと。"),
      plan(6, "light", "low", "balanced", "balanced", "梅雨入り前に外す。梅雨の合間に軽く。", "梅雨入り後は速やかに施肥停止"),
      nonePlan(7, "窒素厳禁。施肥停止。紅葉のための最重要管理。", "7月以降に窒素を与えると紅葉が著しく悪くなる"),
      nonePlan(8, "施肥停止。紅葉準備のため窒素厳禁。"),
      plan(9, "light", "none", "balanced", "high", "窒素なし。カリウムのみで紅葉を美しく。", "窒素を含まない肥料を選ぶこと"),
      plan(10, "moderate", "low", "balanced", "high", "秋肥。窒素は最小限に。カリウム重視。"),
      plan(11, "light", "low", "balanced", "high", "落葉前の最後の施肥。"),
      nonePlan(12, "休眠期。施肥停止。"),
    ],
  },
  // ---- 欅 ----
  {
    slug: "keyaki",
    plans: [
      nonePlan(1, "休眠期。施肥不要。"),
      nonePlan(2, "休眠期。植え替え準備。"),
      plan(3, "light", "balanced", "balanced", "balanced", "芽動き。植え替え後は1ヶ月空ける。"),
      plan(4, "moderate", "balanced", "balanced", "balanced", "成長期。バランスよく施肥。"),
      plan(5, "moderate", "balanced", "balanced", "balanced", "成長期の施肥を継続。"),
      nonePlan(6, "梅雨期。施肥停止。"),
      plan(7, "light", "balanced", "balanced", "balanced", "梅雨明け後に軽く再開。"),
      plan(8, "light", "balanced", "balanced", "balanced", "猛暑日は外す。控えめに。"),
      plan(9, "moderate", "balanced", "balanced", "high", "秋肥開始。カリウムやや多め。"),
      plan(10, "moderate", "balanced", "balanced", "high", "秋肥。冬越しに備える。"),
      plan(11, "light", "low", "balanced", "high", "施肥終盤。", "肥料切れは枝先の枯れ込みの原因"),
      nonePlan(12, "休眠期。施肥停止。"),
    ],
  },
  // ---- ブナ・コナラ ----
  {
    slug: "buna-konara",
    plans: [
      nonePlan(1, "休眠期。施肥不要。"),
      nonePlan(2, "休眠期。"),
      plan(3, "light", "balanced", "balanced", "balanced", "芽動き。植え替え後は1ヶ月空ける。"),
      plan(4, "moderate", "balanced", "balanced", "balanced", "新芽展開後に施肥開始。バランス型。"),
      plan(5, "moderate", "balanced", "balanced", "balanced", "成長期の施肥を継続。"),
      nonePlan(6, "梅雨期。施肥停止。"),
      plan(7, "light", "balanced", "balanced", "balanced", "梅雨明け後に軽く再開。"),
      nonePlan(8, "猛暑期は無施肥。"),
      plan(9, "moderate", "balanced", "balanced", "high", "秋肥開始。バランス型でカリウムやや多め。"),
      plan(10, "moderate", "balanced", "balanced", "high", "秋肥。しっかりと。"),
      plan(11, "light", "low", "balanced", "high", "施肥終盤。"),
      nonePlan(12, "休眠期。施肥停止。"),
    ],
  },
  // ---- 銀杏 ----
  {
    slug: "ichou",
    plans: [
      nonePlan(1, "休眠期。施肥不要。"),
      nonePlan(2, "休眠期。"),
      plan(3, "light", "balanced", "balanced", "balanced", "芽動き。植え替え後は1ヶ月空ける。"),
      plan(4, "moderate", "balanced", "balanced", "balanced", "成長期。丈夫な樹種なのでしっかりと。"),
      plan(5, "moderate", "balanced", "balanced", "balanced", "成長期の施肥を継続。"),
      nonePlan(6, "梅雨期。施肥停止。"),
      plan(7, "light", "low", "balanced", "balanced", "梅雨明け後。黄葉のため窒素を控えめに。", "黄葉を美しくするため夏以降は窒素控えめ"),
      nonePlan(8, "猛暑期は無施肥。"),
      plan(9, "moderate", "low", "balanced", "high", "秋肥開始。窒素控えめ・カリウム多め。"),
      plan(10, "moderate", "low", "balanced", "high", "秋肥。カリウム重視。"),
      plan(11, "light", "low", "balanced", "high", "施肥終盤。"),
      nonePlan(12, "休眠期。施肥停止。"),
    ],
  },
  // ---- 楡欅・榎 ----
  {
    slug: "nirekeyaki-enoki",
    plans: [
      nonePlan(1, "休眠期。施肥不要。"),
      nonePlan(2, "休眠期。"),
      plan(3, "light", "balanced", "balanced", "balanced", "芽動き。植え替え後は1ヶ月空ける。"),
      plan(4, "moderate", "balanced", "balanced", "balanced", "成長期。欅に準じた施肥。"),
      plan(5, "moderate", "balanced", "balanced", "balanced", "成長期の施肥を継続。"),
      nonePlan(6, "梅雨期。施肥停止。"),
      plan(7, "light", "balanced", "balanced", "balanced", "梅雨明け後に軽く再開。"),
      plan(8, "light", "balanced", "balanced", "balanced", "猛暑日は外す。控えめに。"),
      plan(9, "moderate", "balanced", "balanced", "high", "秋肥開始。カリウムやや多め。"),
      plan(10, "moderate", "balanced", "balanced", "high", "秋肥。しっかりと。"),
      plan(11, "light", "low", "balanced", "high", "施肥終盤。"),
      nonePlan(12, "休眠期。施肥停止。"),
    ],
  },
  // ---- 梅 ----
  {
    slug: "ume",
    plans: [
      nonePlan(1, "開花期。施肥しない。花を楽しむ時期。"),
      nonePlan(2, "開花〜花後。花が終わるまで待つ。"),
      plan(3, "moderate", "balanced", "high", "balanced", "花後のお礼肥。リン酸多めで消耗した体力を回復。", "お礼肥は花後すぐに与えることが重要"),
      plan(4, "moderate", "balanced", "balanced", "balanced", "新芽の成長を支援。バランスよく。"),
      plan(5, "moderate", "balanced", "balanced", "balanced", "成長期。通常の施肥を継続。"),
      plan(6, "light", "low", "balanced", "balanced", "梅雨前に減らす。"),
      plan(7, "light", "low", "high", "balanced", "花芽分化期。窒素を抑え、リン酸多めに。", "この時期のリン酸施肥が翌年の花付きを左右する"),
      nonePlan(8, "猛暑期。施肥停止。"),
      plan(9, "moderate", "low", "high", "high", "花芽充実期。リン酸・カリウム重視。"),
      plan(10, "moderate", "balanced", "balanced", "high", "秋肥。冬越しに備える。"),
      plan(11, "light", "low", "balanced", "high", "施肥終盤。"),
      nonePlan(12, "蕾がふくらみ始める。施肥停止。"),
    ],
  },
  // ---- 皐月 ----
  {
    slug: "satsuki",
    plans: [
      nonePlan(1, "休眠期。施肥不要。"),
      nonePlan(2, "休眠期。"),
      nonePlan(3, "蕾が膨らむ時期。施肥しない。", "施肥すると蕾が落ちるリスクがある"),
      nonePlan(4, "開花準備。施肥しない。", "蕾が色づき始めたら絶対に施肥しない"),
      nonePlan(5, "開花期。施肥厳禁。花を楽しむ時期。", "開花中の施肥は花を傷め、早期に散らす原因"),
      plan(6, "moderate", "balanced", "high", "balanced", "花後のお礼肥。花がら摘み後すぐに開始。リン酸多め。", "花がら摘みと同時にお礼肥を施す"),
      plan(7, "moderate", "balanced", "balanced", "balanced", "新芽の成長期。バランスよく施肥。"),
      plan(8, "light", "low", "balanced", "balanced", "猛暑で弱るため控えめに。", "皐月は暑さに弱いため無理をしない"),
      plan(9, "moderate", "balanced", "balanced", "high", "秋肥。カリウム多めで根を充実。"),
      plan(10, "moderate", "balanced", "balanced", "high", "秋肥の最盛期。来年の花芽のために。"),
      plan(11, "light", "low", "balanced", "high", "施肥終盤。"),
      nonePlan(12, "休眠期。施肥停止。"),
    ],
  },
  // ---- 椿・山茶花 ----
  {
    slug: "tsubaki-sazanka",
    plans: [
      nonePlan(1, "開花期（山茶花〜椿）。施肥しない。"),
      nonePlan(2, "開花期〜花後。花が終わるまで待つ。"),
      plan(3, "moderate", "balanced", "high", "balanced", "花後のお礼肥。リン酸多めで体力回復。"),
      plan(4, "moderate", "balanced", "balanced", "balanced", "新芽の成長を支援。しっかりと。"),
      plan(5, "moderate", "balanced", "balanced", "balanced", "成長期の施肥を継続。"),
      nonePlan(6, "梅雨期。施肥停止。"),
      plan(7, "light", "balanced", "balanced", "balanced", "梅雨明け後に軽く再開。"),
      nonePlan(8, "猛暑期。施肥停止。"),
      plan(9, "light", "low", "balanced", "high", "秋の施肥は軽めに。花蕾が色づき始めたら停止。", "開花を控えた蕾に強い肥料は禁物"),
      plan(10, "light", "low", "balanced", "high", "蕾の状態を見ながら軽く。山茶花は開花が始まる。"),
      nonePlan(11, "開花期に入るため施肥停止。"),
      nonePlan(12, "開花期。施肥不要。"),
    ],
  },
  // ---- 長寿梅・木瓜 ----
  {
    slug: "chojubai-boke",
    plans: [
      nonePlan(1, "休眠期。施肥不要。"),
      nonePlan(2, "休眠期〜芽動き。木瓜は早咲き品種が開花。"),
      plan(3, "moderate", "balanced", "high", "balanced", "花後のお礼肥（早咲き品種）。リン酸多め。"),
      plan(4, "moderate", "balanced", "balanced", "balanced", "花後〜成長期。バランスよく。"),
      plan(5, "moderate", "balanced", "balanced", "balanced", "成長期の施肥を継続。"),
      nonePlan(6, "梅雨期。施肥停止。"),
      plan(7, "light", "low", "high", "balanced", "花芽分化を促すためリン酸やや多め。"),
      nonePlan(8, "猛暑期。施肥停止。"),
      plan(9, "moderate", "balanced", "high", "high", "秋肥。リン酸・カリウム重視で花芽充実。"),
      plan(10, "moderate", "balanced", "balanced", "high", "秋肥。しっかりと。長寿梅は秋にも開花あり。"),
      plan(11, "light", "low", "balanced", "high", "施肥終盤。"),
      nonePlan(12, "休眠期。施肥停止。"),
    ],
  },
  // ---- 柿・姫リンゴ ----
  {
    slug: "kaki-ringo",
    plans: [
      nonePlan(1, "休眠期。施肥不要。"),
      nonePlan(2, "休眠期。"),
      plan(3, "light", "balanced", "high", "balanced", "花芽が膨らむ。リン酸多めで開花・結実を促す。"),
      plan(4, "moderate", "balanced", "high", "balanced", "開花期。リン酸重視で結実率を上げる。", "窒素過多は落花・落果の原因"),
      plan(5, "light", "low", "balanced", "balanced", "結実後は控えめに。"),
      nonePlan(6, "梅雨期。施肥停止。"),
      nonePlan(7, "果実肥大期。施肥を控える。", "この時期の施肥は落果リスクを高める"),
      nonePlan(8, "猛暑期。果実が色づき始めたら無施肥。"),
      plan(9, "moderate", "balanced", "balanced", "high", "収穫後（早生品種）のお礼肥。秋肥開始。"),
      plan(10, "moderate", "balanced", "balanced", "high", "秋肥。翌年の花芽形成に備える。"),
      plan(11, "light", "low", "balanced", "high", "施肥終盤。落果後の体力回復。"),
      nonePlan(12, "休眠期。施肥停止。"),
    ],
  },
  // ---- ピラカンサ・梅擬 ----
  {
    slug: "pyracantha-umemodoki",
    plans: [
      nonePlan(1, "休眠期。施肥不要。常緑種は寒肥として軽い有機肥料も可。"),
      plan(2, "light", "balanced", "balanced", "balanced", "寒肥（常緑種）。落葉種は無施肥。", "常緑種のみ"),
      plan(3, "light", "balanced", "high", "balanced", "芽動き。花芽のためリン酸やや多め。"),
      plan(4, "moderate", "balanced", "high", "balanced", "開花期。リン酸重視で結実を促す。"),
      plan(5, "moderate", "low", "high", "balanced", "開花〜結実。窒素控えめ、リン酸多め。", "窒素過多は落花の原因"),
      nonePlan(6, "梅雨期。施肥停止。実が着き始める。"),
      nonePlan(7, "果実肥大期。施肥を控える。"),
      nonePlan(8, "猛暑期。施肥停止。"),
      plan(9, "light", "balanced", "balanced", "high", "実が色づく。軽めの施肥。"),
      plan(10, "moderate", "balanced", "balanced", "high", "落果後の秋肥。翌年に備える。"),
      plan(11, "light", "low", "balanced", "high", "施肥終盤。"),
      nonePlan(12, "休眠期。施肥停止。常緑種は観賞期。"),
    ],
  },
  // ---- 草物・山野草 ----
  {
    slug: "kusamono",
    plans: [
      nonePlan(1, "休眠期。施肥不要。"),
      nonePlan(2, "休眠期。施肥不要。"),
      plan(3, "light", "balanced", "balanced", "balanced", "芽動き。薄い液肥を月1回程度。", "置き肥は肥料焼けのリスクが高い。液肥のみ", "有機液体肥料"),
      plan(4, "light", "balanced", "balanced", "balanced", "薄い液肥を月1〜2回。規定の2〜3倍に希釈。", undefined, "有機液体肥料"),
      plan(5, "light", "balanced", "balanced", "balanced", "生長期。薄い液肥を継続。", undefined, "有機液体肥料"),
      nonePlan(6, "梅雨期。施肥停止。"),
      nonePlan(7, "真夏は無施肥。"),
      nonePlan(8, "猛暑期は無施肥。"),
      plan(9, "light", "balanced", "balanced", "balanced", "秋の生長期。薄い液肥を月1回。", undefined, "有機液体肥料"),
      plan(10, "light", "balanced", "balanced", "balanced", "薄い液肥を継続。", undefined, "有機液体肥料"),
      nonePlan(11, "施肥終了。冬支度。"),
      nonePlan(12, "休眠期。施肥不要。"),
    ],
  },
  // ---- 沈丁花・黄楊・柊 ----
  {
    slug: "chinchoge-tsuge",
    plans: [
      plan(1, "light", "balanced", "balanced", "balanced", "寒肥。緩効性有機肥料を施す。常緑で冬も活動するため有効。", undefined, "有機固形肥料"),
      plan(2, "light", "balanced", "balanced", "balanced", "寒肥の継続。春の芽出しに備える。", undefined, "有機固形肥料"),
      plan(3, "moderate", "balanced", "balanced", "balanced", "芽動き。春肥開始。沈丁花は3月開花、花後にお礼肥。"),
      plan(4, "moderate", "balanced", "balanced", "balanced", "成長期。バランスよく施肥。"),
      plan(5, "moderate", "balanced", "balanced", "balanced", "成長期の施肥を継続。"),
      nonePlan(6, "梅雨期。施肥停止。"),
      plan(7, "light", "balanced", "balanced", "balanced", "梅雨明け後に軽く再開。"),
      nonePlan(8, "猛暑期。施肥停止。"),
      plan(9, "moderate", "balanced", "balanced", "high", "秋肥開始。カリウムやや多め。"),
      plan(10, "moderate", "balanced", "balanced", "high", "秋肥。しっかりと。"),
      plan(11, "light", "low", "balanced", "high", "施肥終盤。"),
      nonePlan(12, "休眠期（浅い休眠）。施肥停止。"),
    ],
  },
];

const columns = [
  {
    slug: "npk-basics",
    title: "肥料の三大要素を理解しよう — N・P・Kの基礎知識",
    category: "basics",
    content: `植物の生長に最も多く必要とされる三大要素は、窒素（N）・リン酸（P）・カリウム（K）です。この三つの栄養素のバランスを理解することが、盆栽の施肥管理の出発点となります。

窒素（N）は「葉肥」と呼ばれ、葉や茎の生長を促進します。盆栽では徒長を防ぐため、時期に応じた窒素量のコントロールが特に重要です。春先の芽出し期には適度に必要ですが、紅葉樹では夏以降に窒素を断つことで美しい紅葉が実現します。

リン酸（P）は「花肥」「実肥」と呼ばれ、花芽分化・開花・結実を促します。花物盆栽（梅・皐月等）では花芽分化期にリン酸を重視した施肥が重要です。また根の発達にも関与するため、植え替え後の根の回復にも寄与します。

カリウム（K）は「根肥」と呼ばれ、根の発達と耐寒性・耐病性の向上に寄与します。秋肥ではカリウムを多めに配合するのが盆栽の定石で、冬越しの体力と翌春の力強い芽出しの基盤を作ります。

三大要素以外にも、カルシウム・マグネシウム・硫黄の二次要素、鉄・マンガン・ホウ素などの微量要素があり、植物の健全な生育にはこれらすべてが必要です。有機肥料を主体に使うことで、微量要素も自然に補給されるのが盆栽管理の利点です。`,
    sortOrder: 1,
  },
  {
    slug: "organic-vs-chemical",
    title: "有機肥料と化成肥料の違い — 盆栽にはどちらが向いているか",
    category: "basics",
    content: `盆栽の施肥では、有機肥料と化成肥料それぞれの特性を理解し、適切に使い分けることが重要です。

有機肥料は油粕類・骨粉類・魚粉類など天然素材を原料とし、土壌微生物の分解を経てゆっくりと効果を発揮します（緩効性）。土壌微生物を活性化し、用土の物理性を改善する副次効果もあります。盆栽の伝統的な施肥法である「置き肥」との相性が極めてよく、多くの盆栽愛好家が主力として使用しています。

一方、化成肥料は無機塩を原料とし、水に溶ければすぐに植物が吸収できる速効性が特徴です。成分比率が正確で、狙った栄養素をピンポイントで補給できる利点があります。欠乏症状の改善や、特定の栄養素を強化したい場合に有用です。

盆栽管理では、有機固形肥料を基本とし、必要に応じて化成液肥で補助するのが一般的な考え方です。有機肥料の穏やかな効き方が盆栽の繊細な管理に適しており、微量要素も自然に供給されます。ただし、有機肥料は梅雨時にカビや臭いが発生しやすいため、この時期は施肥自体を休止するのが無難です。

どちらか一方に固執する必要はなく、樹の状態や季節に応じて柔軟に使い分けることが、良い盆栽を育てるコツです。`,
    sortOrder: 2,
  },
  {
    slug: "okihi-howto",
    title: "置き肥の正しい置き方 — 量と位置の考え方",
    category: "basics",
    content: `「置き肥」は盆栽で最も基本的な施肥方法です。固形の有機肥料を鉢土の表面に置き、水やりのたびに少しずつ栄養分が溶け出して根に届く仕組みです。

置き肥の量は鉢のサイズによって調整します。一般的な目安として、小品盆栽（〜15cm鉢）は1〜2個、中品盆栽（15〜30cm鉢）は2〜4個、大品盆栽（30cm鉢〜）は4〜6個程度です。ただし樹種や生育状態によって加減が必要です。五葉松のように肥料を嫌う樹種は少なめに、欅のように肥料を好む樹種はやや多めに設定します。

置く位置は幹から離し、鉢縁に近い場所が基本です。幹のすぐ近くに置くと、濃い肥料成分が幹を傷める原因になります。また、鉢の前後左右に均等に配置し、偏りがないようにします。小さな鉢受け皿や専用のカゴに入れて置くと、崩れた肥料が用土の表面を汚すのを防げます。

交換の頻度は月1回が目安です。古い肥料は形が崩れて効果が薄れているため、きれいに取り除いてから新しい肥料を置きます。梅雨入り前と真夏は肥料を完全に取り除き、施肥を休止します。秋（9月頃）から再開し、11月まで続けるのが一般的です。

植え替え直後の樹には施肥しないでください。根が傷んでいる状態で肥料を与えると、浸透圧の関係で根がさらにダメージを受けます。最低1ヶ月は空けてから施肥を開始します。`,
    sortOrder: 3,
  },
  {
    slug: "motohi-tsuihi",
    title: "元肥と追肥の違い — 植え替え時と成長期の施肥",
    category: "basics",
    content: `盆栽の施肥には「元肥」と「追肥」の二つの考え方があります。それぞれの目的と使い方を理解しましょう。

元肥（もとひ・もとごえ）とは、植え替え時にあらかじめ用土に混ぜ込む肥料のことです。盆栽の場合、元肥は「入れない」か「ごく少量」が基本です。理由は、植え替え直後は根が傷んでおり、肥料成分が根にダメージを与えるリスクがあるためです。一般園芸では元肥が当たり前ですが、盆栽では植え替え後1ヶ月の無施肥期間を設け、その後の追肥で栄養を補給する方法が安全です。

もし元肥を入れる場合は、完全に発酵済みの有機肥料をごく少量、根から離れた位置に混ぜます。未熟な有機物は用土内で発酵して高温になり、根を傷める原因となるため絶対に避けてください。

追肥（ついひ・おいごえ）とは、生長期間中に定期的に与える肥料のことです。盆栽の施肥の主役はこの追肥であり、置き肥や液肥がこれにあたります。樹の生長段階や季節に応じてN-P-Kのバランスと量を調整し、春の芽出し支援、花芽分化の促進、秋の根の充実など、目的に合った施肥を行います。

盆栽では「元肥に頼らず、追肥で管理する」のが安全で確実な施肥法です。植え替え後は焦らず、根が活着してから施肥を始めましょう。`,
    sortOrder: 4,
  },
  {
    slug: "spring-fertilizing",
    title: "春肥のコツ — 芽出しを支える施肥の考え方",
    category: "seasonal",
    content: `春は盆栽が休眠から覚め、新芽を展開する大切な季節です。この時期の施肥は樹種によって大きく方針が異なります。

まず、春に施肥を「しない」樹種を確認しましょう。五葉松は春の施肥が厳禁です。春に肥料を与えると芽が徒長して間延びし、盆栽としての価値が大きく下がります。五葉松の施肥は秋（9〜11月）のみです。皐月も3〜5月は蕾の膨らみから開花までの期間で施肥厳禁です。梅は1〜2月の開花期に施肥しませんが、花後の3月にお礼肥を速やかに施します。

松柏類（黒松・赤松等）は4月頃から控えめに始めます。新芽（ミドリ）が伸び始める時期に強い肥料を与えると徒長するため、「控えめに始めて徐々に増やす」のが基本です。

雑木類（楓・欅等）は新芽が展開した後（4月中旬〜）から通常量の施肥を開始します。植え替えをした樹は、最低1ヶ月は施肥を待ちます。

花物のお礼肥は春の最重要施肥です。梅の花後（3月）、椿の花後（3〜4月）にリン酸多めの肥料を速やかに与え、開花で消耗した体力を回復させます。

春肥の共通ポイントは「焦らない」ことです。芽が動き始めたのを確認してから施肥を開始し、樹の反応を見ながら量を調整します。`,
    sortOrder: 5,
  },
  {
    slug: "autumn-fertilizing",
    title: "秋肥が盆栽の生命線 — 冬越しと来春の芽出しのために",
    category: "seasonal",
    content: `盆栽の施肥において、秋肥（9〜11月）は一年で最も重要な施肥期間です。「秋肥を制する者は盆栽を制する」と言われるほど、その重要性は大きいものです。

秋肥の目的は大きく三つあります。第一に、冬越しのための体力づくり。カリウムを多めに施すことで根を充実させ、耐寒性を高めます。第二に、翌春の芽出しの準備。秋に蓄えた養分が、春の力強い芽吹きの原動力となります。第三に、花物・実物では翌年の花芽・果実の充実。

秋肥では一般にカリウム（K）を多めに配合します。松柏類は9月から開始し、10月に最も多く、11月に減らして終了するのが標準的なパターンです。五葉松は秋（9〜11月）のみが施肥期間であり、この時期に年間の施肥を集中させます。

紅葉樹（楓・銀杏等）は秋肥に注意が必要です。窒素を与えると紅葉が悪くなるため、カリウム主体・窒素ゼロ〜最小限の肥料を選びます。9月に窒素なし・カリウム重視で再開し、10月以降も窒素控えめを貫きます。

秋肥は「思い切ってたっぷり」が基本ですが、12月に入ったら速やかに施肥を終了します。休眠期に肥料が残ると根を傷める原因になります。`,
    sortOrder: 6,
  },
  {
    slug: "rainy-summer-stop",
    title: "梅雨期・真夏に施肥してはいけない理由",
    category: "seasonal",
    content: `盆栽の施肥カレンダーでは、6月の梅雨期と8月の猛暑期に施肥を停止するのが鉄則です。この理由を正しく理解しておきましょう。

梅雨期（6月）に施肥を停止する理由は、過湿と有機物の腐敗です。長雨で用土が常に湿った状態が続くと、有機肥料がカビたり腐敗し、雑菌の温床となります。根腐れのリスクも高まります。また、雨で肥料成分が一気に溶け出し、予想以上の高濃度になって肥料焼けを起こす危険があります。梅雨入り前（5月末〜6月上旬）に置き肥を取り除くのが安全です。

真夏の猛暑期（8月）に施肥を控える理由は、高温による根のストレスです。気温が35℃を超えると植物の根は大きなストレスを受け、肥料を吸収する余力がありません。この状態で肥料を与えると、用土中の肥料成分が濃縮されて根を傷める「肥料焼け」を引き起こします。

ただし7月と8月は樹種によって対応が異なります。黒松は芽切り後の二番芽が動き出したら軽く施肥を再開しますし、皐月は花後のお礼肥として7月にも施肥します。猛暑日が続く時期は一時的に外すなど、柔軟に対応しましょう。

再開のタイミングは9月上旬が目安です。残暑が厳しい年は9月中旬まで待つこともあります。`,
    sortOrder: 7,
  },
  {
    slug: "kanpi-winter",
    title: "寒肥とは — 休眠期の施肥の意味",
    category: "seasonal",
    content: `寒肥（かんぴ・かんごえ）とは、冬の休眠期（12〜2月頃）に施す肥料のことです。一般園芸では広く行われますが、盆栽では樹種と状況を選んで慎重に判断する必要があります。

寒肥の原理は、冬の間にゆっくりと分解される有機肥料を施し、春の芽出し時期にちょうど効き始めるようにするというものです。完全に発酵済みの有機固形肥料を使い、根から離れた位置に置くか、表土に軽く混ぜ込みます。

盆栽で寒肥が有効な樹種は限られます。常緑広葉樹（黄楊、柊等）は冬も完全には休眠しないため、1〜2月に緩効性の有機肥料を施す寒肥が効果的です。春の芽出しが格段によくなります。常緑の実物（ピラカンサ等）も同様です。

一方、落葉樹や松柏類の多くは冬に深い休眠に入るため、寒肥は基本的に不要です。休眠中の根は肥料を吸収できず、用土に残った肥料成分が春先に一気に溶け出して根を傷めるリスクがあります。

寒肥を施す場合の注意点として、速効性の化成肥料は使わないこと、施肥量は通常の半分以下にすること、必ず完熟有機質を使うことが挙げられます。盆栽の寒肥は「やらなくても問題ない」ことが多いので、迷ったら施さないという判断も正解です。`,
    sortOrder: 8,
  },
  {
    slug: "liquid-fertilizer",
    title: "液肥の正しい希釈と散布の考え方",
    category: "technique",
    content: `液体肥料（液肥）は、置き肥の補助として盆栽管理に活用できる便利な施肥方法です。正しい使い方を理解しましょう。

液肥の最大のメリットは速効性です。水に溶けた状態で根に届くため、施肥後数日で効果が現れます。欠乏症状の改善や、生長期の追加的な栄養補給に適しています。

希釈倍率は必ず守るか、盆栽ではむしろ「薄め」に調整します。規定倍率の1.5〜2倍に薄めて使うのが安全です。草物・山野草では規定の2〜3倍に薄めます。「薄くて回数多め」が盆栽の液肥使用の基本原則です。

施肥のタイミングは、朝の水やり後（根が十分に水を吸った状態）か、夕方が適しています。日中の高温時に施すと、用土表面で液が濃縮されて根を傷める危険があります。真夏に使う場合は必ず夕方に。

液肥の頻度は生長期に月2〜4回が目安です。置き肥と併用する場合は月1〜2回程度に減らし、肥料過多にならないよう注意します。置き肥なしで液肥のみの管理も可能ですが、効果の持続が短いため施肥頻度を上げる必要があり、手間は増えます。

注意点として、液肥は根を傷めるリスクがあるため、植え替え直後の樹には使用しないでください。根が活着し、新しい白根が出てから開始します。`,
    sortOrder: 9,
  },
  {
    slug: "after-repotting",
    title: "植え替え後いつから肥料を与えるか",
    category: "technique",
    content: `植え替えは盆栽管理の重要な作業ですが、その後の施肥開始タイミングを間違えると、せっかくの植え替えが台無しになります。

基本ルールとして、植え替え後は最低1ヶ月間は施肥しないでください。この期間は根が回復し、新しい用土に活着する大切な時期です。根の先端が切られた状態で肥料を与えると、肥料成分の浸透圧で根がさらにダメージを受け、最悪の場合は根腐れを起こして樹が枯れることもあります。

施肥再開の目安は「新しい白根が動き出してから」です。鉢底の穴から白い根が見え始めたり、新芽がしっかりと展開して樹に勢いが出てきたら、活着が進んでいるサインです。

再開時は最初から通常量を与えず、通常の半量程度から始めて2〜3週間かけて通常量に戻していきます。液肥で再開する場合は、通常の2倍以上に薄めたものを使います。

特に注意が必要なのは春の植え替えです。松柏類は3月、雑木類は2〜3月が植え替え適期ですが、ちょうど施肥開始時期と重なります。植え替えた樹は焦らず1ヶ月待ち、4〜5月から施肥を始めればまったく問題ありません。

秋に植え替えた場合は、翌春まで施肥を待つのが安全です。冬の休眠期に入る前に根を十分に活着させることが優先です。`,
    sortOrder: 10,
  },
  {
    slug: "foliar-feeding",
    title: "葉面散布の効果的な使い方",
    category: "technique",
    content: `葉面散布とは、栄養素を溶かした液を葉の表面に霧状に吹きかけ、葉から直接吸収させる施肥方法です。根からの通常の施肥を補完する手段として、特定の場面で効果を発揮します。

葉面散布が特に有効な場面は以下の通りです。第一に、植え替え直後など根が十分に機能していない時期。根からの吸収が制限される状況で、葉から栄養を補給できます。第二に、微量要素（特に鉄）の欠乏症の応急処置。鉄欠乏によるクロロシス（黄白化）には、キレート鉄の葉面散布が速効的です。第三に、樹勢が弱って根の吸収力が落ちている場合の栄養補給。

散布のタイミングは曇天日の早朝か夕方が最適です。気孔が開いている時間帯で、かつ直射日光による薬害（葉焼け）のリスクが低い条件を選びます。高温・強日照下での散布は厳禁です。

散布液の濃度は根への施肥よりも薄くします。葉は根に比べて浸透圧への耐性が低いため、濃すぎると葉焼けを起こします。葉の裏面（気孔が多い）にもしっかり散布すると吸収効率が上がります。

注意点として、葉面散布はあくまで補助的な手段であり、通常の施肥（置き肥・液肥）の代替にはなりません。大量の栄養素を補給する能力はないため、根からの施肥を基本としつつ、必要な場面で活用するのが正しい位置づけです。`,
    sortOrder: 11,
  },
  {
    slug: "fertilizer-burn",
    title: "肥料焼けの原因と対処法",
    category: "troubleshooting",
    content: `肥料焼けは、盆栽管理で最も注意すべきトラブルの一つです。用土中の肥料成分が高濃度になり、浸透圧の逆転によって根から水分が奪われる現象で、最悪の場合は樹を枯らす原因となります。

肥料焼けの主な原因は以下の通りです。第一に、施肥量が多すぎる場合。特に小さな鉢に大量の肥料を置くと起こりやすくなります。第二に、植え替え直後の施肥。根が傷んだ状態で肥料を与えるのは極めて危険です。第三に、真夏の高温時の施肥。高温で用土の水分が蒸発し、肥料成分が濃縮されます。第四に、液肥の希釈不足。規定より濃い液肥は直接的な根のダメージを引き起こします。

肥料焼けの症状は、葉先や葉縁が褐色に枯れ込む（葉焼け）、葉がしおれる、新芽が出ない、根が黒く変色する、などです。

対処法として、まず肥料を完全に取り除きます。次に、鉢底から水が十分に流れ出るまで大量の水で用土を洗い流します（灌水による肥料成分の希釈）。これを1日2〜3回、数日間続けます。半日陰の風通しのよい場所で養生し、樹勢の回復を待ちます。重症の場合は鉢から抜いて根の状態を確認し、黒く傷んだ根を切除して新しい用土に植え替えることも必要です。

予防が最善の対策です。「少なめに・様子を見ながら」の原則を守り、迷ったら施肥しないという判断をしましょう。`,
    sortOrder: 12,
  },
  {
    slug: "yellowing-leaves",
    title: "葉が黄色くなった — 微量要素欠乏の見分け方と対策",
    category: "troubleshooting",
    content: `葉の黄化は盆栽で最も多い症状の一つですが、原因は一つではありません。窒素欠乏から微量要素欠乏まで、黄化のパターンを正しく見分けることが適切な対処につながります。

まず、黄化が「古い葉（下位葉）から始まるか」「新しい葉（上位葉）から始まるか」を観察します。これが最初の判断ポイントです。

古い葉から黄化する場合は、窒素（N）欠乏が最も疑われます。窒素は植物体内で移動性が高く、不足すると古い葉から新しい葉へ転流されるためです。全体的に均一に黄化し、葉が小さくなります。マグネシウム（Mg）欠乏も下位葉から始まりますが、こちらは「葉脈は緑のまま、葉脈間のみ黄化する」のが特徴です。

新しい葉から黄化する場合は、鉄（Fe）欠乏が最も多い原因です。新葉が葉脈を残して黄白化する「クロロシス」が典型的な症状で、アルカリ性に傾いた用土で発生しやすくなります。硫黄（S）欠乏も新葉から黄化しますが、盆栽では稀です。

対策としては、まず原因を特定します。N欠乏なら通常の施肥の見直しで改善します。Mg欠乏には苦土石灰の少量施用やエプソムソルト（硫酸マグネシウム）の希釈液が有効です。Fe欠乏にはキレート鉄の葉面散布が速効的で、同時に用土のpHを確認して酸性側に調整することも重要です。

黄化の原因が肥料不足とは限りません。過湿による根腐れ、根詰まり、病害虫なども黄化の原因となるため、根の状態も含めた総合的な診断が大切です。`,
    sortOrder: 13,
  },
  // ── 製品ガイド (product_guide) ────────────────────────────────
  {
    slug: "biogold-original",
    title: "バイオゴールドオリジナル",
    category: "product_guide",
    content: `バイオゴールドオリジナルは、盆栽愛好家に最も広く支持されている有機肥料の一つです。

━━━ 基本データ ━━━
N-P-K：5.5-6.5-3.5（天然有機質）
タイプ：固形・緩効性（置き肥用）
原料：鶏糞、魚粕、なたね油粕、骨粉等を高温発酵処理

━━━ 特徴と使い方 ━━━
完全発酵済みの有機肥料で、施肥直後から穏やかに効き始めます。未発酵の有機肥料にありがちな悪臭やカビの問題が少なく、室内展示前の盆栽にも安心して使えます。粒が硬く崩れにくいため、水やりで用土表面が汚れにくいのも利点です。

鉢の直径1cmあたり約1粒が施肥量の目安です（例：15cm鉢なら3〜5粒）。幹から離して鉢縁に近い位置に均等に配置します。月1回の交換が基本で、春（4〜6月）と秋（9〜11月）が主な施肥期間です。

松柏類・雑木類・花物・実物のいずれにも使える汎用性の高さが人気の理由です。`,
    sortOrder: 20,
  },
  {
    slug: "tamahi-aburakasu",
    title: "玉肥（油粕）",
    category: "product_guide",
    content: `玉肥は、なたね油粕を主原料とした伝統的な盆栽用有機肥料です。手で丸めて成形したボール状の肥料を鉢土の上に置いて使います。

━━━ 基本データ ━━━
N-P-K：約5-2-1（天然有機質・窒素主体）
タイプ：固形・緩効性（置き肥用）
原料：なたね油粕を主原料に骨粉等を混合し、練り上げて成形

━━━ 特徴と使い方 ━━━
窒素成分が多いため、春の芽出し期の成長促進に特に効果的です。安価で入手しやすく、盆栽の入門者にも勧められる定番肥料です。自作も可能で、油粕に骨粉や魚粉を混ぜて自分好みの配合にする愛好家も多くいます。

欠点として、梅雨時にカビが生えやすく臭いも出やすいことが挙げられます。梅雨入り前に取り除き、秋に再開するのが基本です。夏場と冬場は施肥を避けます。

窒素が多いため、五葉松や紅葉樹への使用は時期を限定する必要があります。花物盆栽には花芽分化期の使用を避け、リン酸の多い肥料と使い分けましょう。`,
    sortOrder: 21,
  },
  {
    slug: "magamp-k",
    title: "マグァンプK",
    category: "product_guide",
    content: `マグァンプKは、ハイポネックスジャパンが製造するリン酸主体の化成肥料です。長期間にわたりゆっくり効く緩効性が特徴で、植え替え時の元肥として広く使われています。

━━━ 基本データ ━━━
N-P-K-Mg：6-40-6-15
タイプ：顆粒・緩効性（元肥用）
原料：化成肥料（熔成リン肥ベース）

━━━ 特徴と使い方 ━━━
リン酸含有量が40%と極めて高く、花芽形成や根の充実を強力に促進します。花物盆栽（梅・皐月・長寿梅等）や実物盆栽（柿・姫リンゴ等）に特に効果的です。マグネシウムも15%含有し、葉緑素の生成を助けて葉色を良くする効果もあります。

使い方は植え替え時に新しい用土に混ぜ込むのが基本です。鉢底の用土に少量を混合し、根に直接触れないように注意します。効果は大粒タイプで約1年、中粒で約半年持続します。

盆栽では元肥を入れすぎないのが鉄則です。一般園芸の規定量の半分以下を目安にし、追肥（置き肥・液肥）で補う方が安全です。化成肥料のため、有機肥料と併用して微量要素を補完するのが望ましいです。`,
    sortOrder: 22,
  },
  {
    slug: "hyponex-liquid",
    title: "ハイポネックス原液",
    category: "product_guide",
    content: `ハイポネックス原液は、最も普及している液体肥料（液肥）の一つです。速効性で即座に効果が現れるため、追肥の補助として盆栽管理に活用できます。

━━━ 基本データ ━━━
N-P-K：6-10-5
タイプ：液体・速効性
原料：化成肥料

━━━ 特徴と使い方 ━━━
水に希釈して灌水と同時に施す液肥です。盆栽では規定の1000倍希釈よりもさらに薄め、1500〜2000倍で使うのが安全です。「薄くて回数多め」が盆栽における液肥の基本です。

主な用途は、置き肥の補助的な栄養補給です。生長期（4〜6月・9〜10月）に月2〜4回、朝の灌水後に施します。欠乏症状が見られる場合の応急処置にも有効で、根からの吸収が速いため数日で効果が現れます。

注意点として、液肥だけの管理は肥効の持続が短く頻繁な施肥が必要になります。有機置き肥を主体とし、液肥は補助として使う方が管理が楽です。植え替え直後や猛暑期は使用を避けてください。`,
    sortOrder: 23,
  },
  {
    slug: "green-king",
    title: "グリーンキング",
    category: "product_guide",
    content: `グリーンキングは、有機質主体のペレット型肥料で、バイオゴールドと並んで盆栽愛好家に人気の製品です。バランスの良い成分比率と扱いやすさが評価されています。

━━━ 基本データ ━━━
N-P-K：6-10-5（有機質主体）
タイプ：ペレット・緩効性（置き肥用）
原料：有機質原料を発酵処理後にペレット成形

━━━ 特徴と使い方 ━━━
リン酸がやや多めのバランス型で、松柏類から雑木類、花物・実物まで幅広い樹種に使えます。臭いが比較的少なく、ベランダ栽培や室内管理時にも使いやすいのが利点です。

ペレット形状で大きさが均一なため、施肥量の管理がしやすく初心者にも扱いやすい肥料です。置き肥として鉢土の表面に配置し、月1回の交換で管理します。

バイオゴールドより若干リン酸が多いため、花物・実物盆栽への使用にも適しています。春と秋の施肥期間に継続的に使用し、梅雨時と猛暑期は外します。`,
    sortOrder: 24,
  },
  // ── トラブル (trouble) ───────────────────────────────────────
  {
    slug: "fertilizer-burn-trouble",
    title: "肥料焼け ─ 原因と対処法",
    category: "trouble",
    content: `肥料焼けは、用土中の肥料成分が過剰に濃縮され、浸透圧の逆転によって根から水分が奪われる現象です。盆栽では鉢が小さく用土量が限られるため、一般の園芸植物よりも発生リスクが高くなります。

━━━ 主な原因 ━━━
・施肥量の過多（小さな鉢に対して肥料が多すぎる）
・植え替え直後の施肥（傷んだ根に肥料が直接作用）
・猛暑期の施肥（高温で用土の水分が蒸発し、肥料成分が濃縮）
・液肥の希釈不足（規定より濃い液肥は根を直接傷める）
・化成肥料の過剰施用（有機肥料より即座に高濃度になりやすい）

━━━ 症状 ━━━
葉先・葉縁の褐変（枯れ込み）、葉のしおれ、新芽の停止、根の黒変が典型的な症状です。重症の場合は全体が急速に萎れ、回復が困難になります。

━━━ 対処法 ━━━
1. 肥料を直ちに全て取り除く
2. 鉢底から十分に流れるまで大量の水で用土を洗い流す（1日2〜3回、数日間継続）
3. 半日陰の風通しのよい場所で養生
4. 重症の場合は鉢から抜いて根を確認し、傷んだ根を切除して新しい用土に植え替え
5. 回復まで最低1ヶ月は施肥しない`,
    sortOrder: 30,
  },
  {
    slug: "moss-fertilizer-damage",
    title: "苔と施肥の両立",
    category: "trouble",
    content: `盆栽の化粧苔（コケ）は美観を高める重要な要素ですが、施肥との両立が課題になることがあります。肥料が苔に与える影響と、両立のための工夫を解説します。

━━━ 苔が傷む原因 ━━━
・有機肥料の溶出液が苔の上を流れ、成分が直接付着して褐変する
・液肥を苔の上から灌水すると、濃度が高い場合に苔を傷める
・置き肥の周囲は肥料成分が濃くなり、その部分の苔だけ枯れる
・肥料によるアルゲ（藻類）の繁殖で苔が覆われ、光合成を阻害される

━━━ 両立のための工夫 ━━━
・置き肥を肥料カゴ（専用のプラスチック製カゴ）に入れて設置し、肥料が苔に直接触れないようにする
・液肥は苔を避けて用土に直接注ぐか、極端に薄めた液を使う
・施肥量を控えめにし、少量頻回で管理する
・展示前は肥料を外して苔を美しく整え、展示後に施肥を再開する
・苔の張り替え直後は1ヶ月ほど施肥を控え、苔の活着を優先する

苔を重視する場合は、施肥量をやや控えめにする代わりに、苔のない部分にピンポイントで液肥を施す方法も有効です。`,
    sortOrder: 31,
  },
  {
    slug: "root-rot-overfertilization",
    title: "根腐れと過剰施肥",
    category: "trouble",
    content: `根腐れは盆栽の致命的なトラブルの一つであり、過剰施肥は根腐れを引き起こす主要因の一つです。排水不良と施肥の組み合わせが最も危険なパターンです。

━━━ なぜ過剰施肥が根腐れにつながるのか ━━━
過剰な肥料は用土中の塩類濃度を上昇させ、根の浸透圧バランスを崩します。ダメージを受けた根は水分の吸排出機能が低下し、用土中の水分が停滞します。この過湿状態で嫌気性菌（Pythium, Phytophthora等）が繁殖し、根の組織が腐敗していきます。

排水性の悪い用土では肥料成分の停滞と過湿が同時に起こるため、根腐れのリスクが飛躍的に高まります。特に以下の条件が重なると危険です：
・古くなった赤玉土（粒が崩れて排水性が低下）
・鉢底穴が詰まっている
・梅雨時の長雨＋置き肥の放置
・植え替え直後の施肥

━━━ 予防策 ━━━
・排水性の良い用土配合を使い、定期的に植え替える
・施肥量は「迷ったら少なめ」を原則とする
・梅雨入り前に置き肥を取り除く
・植え替え後は最低1ヶ月間施肥しない
・鉢底穴の詰まりを定期的にチェック

━━━ 根腐れの初期症状 ━━━
葉に元気がない、新芽の伸びが止まる、葉色がくすむ、用土の乾きが極端に遅い——これらは根腐れの初期サインです。鉢から抜いて根を確認し、黒く軟化した根があれば切除して新しい用土に植え替えます。`,
    sortOrder: 32,
  },
  // ── 基礎知識 追加 (basics) ──────────────────────────────────
  {
    slug: "seasonal-fertilizing-basics",
    title: "季節ごとの施肥の基本",
    category: "basics",
    content: `盆栽の施肥は季節に合わせたメリハリが重要です。植物の生理サイクルに合わせて施肥量と成分を調整することで、樹の健康と美しい樹姿を両立できます。

━━━ 春（3〜5月）：成長期の始まり ━━━
芽出し後に施肥を開始します。雑木類は新芽の展開を確認してから窒素多めの肥料を与えます。松柏類は控えめに始め、徐々に量を増やします。花物のお礼肥（花後の施肥）はこの時期の最重要施肥です。植え替え後の樹は1ヶ月待ってから開始します。

━━━ 夏（6〜8月）：休止期間 ━━━
梅雨入り（6月）で施肥を一時停止します。高温多湿で有機肥料がカビやすく、根も高温ストレスを受けます。7月は一部の樹種（黒松の芽切り後等）で軽い施肥を再開しますが、8月の猛暑期は原則休止します。

━━━ 秋（9〜11月）：最重要の施肥期間 ━━━
9月に施肥を本格再開します。カリウムを多めに配合し、冬越しと翌春の芽出しに備えます。10月が施肥のピークで、11月は徐々に減らして終了します。紅葉樹は窒素を控えて美しい紅葉を促します。

━━━ 冬（12〜2月）：休眠期 ━━━
落葉樹・松柏類は施肥不要です。常緑広葉樹のみ、1〜2月に寒肥として少量の緩効性有機肥料を施す場合があります。2月下旬の寒肥は春の芽出しを助けますが、必須ではありません。`,
    sortOrder: 10,
  },
  {
    slug: "organic-vs-chemical-guide",
    title: "有機肥料と化成肥料の使い分け",
    category: "basics",
    content: `盆栽の施肥では、有機肥料と化成肥料それぞれの長所を理解し、状況に応じて使い分けることが効果的な管理につながります。

━━━ 有機肥料の特性 ━━━
油粕・骨粉・魚粕・鶏糞等の天然素材が原料。土壌微生物による分解を経て徐々に効果を発揮する緩効性が特徴です。微量要素も同時に供給され、土壌の物理性改善効果もあります。盆栽の伝統的な施肥法「置き肥」との相性が非常によく、多くの盆栽園でも主力として使用しています。

デメリットとして、梅雨時のカビや臭い、成分比率が不安定（ロットにより変動）、効果発現まで時間がかかるといった点があります。

━━━ 化成肥料の特性 ━━━
無機塩を原料とし、水に溶ければすぐに吸収される速効性が特徴。成分比率が正確で、特定の栄養素をピンポイントで補給できます。液肥タイプは希釈濃度で施肥量を細かく調整できる利点があります。

デメリットとして、効果の持続が短い、微量要素の補給ができない、過剰施肥による肥料焼けのリスクが有機肥料より高い、といった点があります。

━━━ 使い分けの基本方針 ━━━
・基本：有機固形肥料（置き肥）を年間の主力とする
・補助：化成液肥で生長期に補助的な栄養補給を行う
・応急：欠乏症状には化成液肥か葉面散布で速やかに対処する
・元肥：マグァンプK等の緩効性化成肥料を植え替え時に少量使用

どちらか一方に偏るのではなく、有機主体・化成補助の組み合わせが盆栽管理には最も実用的です。`,
    sortOrder: 11,
  },
];

export async function main() {
  console.log("既存の肥料データを削除中...");
  try {
    await prisma.fertilizationPlan.deleteMany();
    await prisma.treeSpecies.deleteMany();
    await prisma.fertilizerNutrient.deleteMany();
    await prisma.fertilizerCategory.deleteMany();
    await prisma.fertilizerColumn.deleteMany();
  } catch (e) {
    console.warn("一部のテーブル削除に失敗しました（初回実行時など）：", e instanceof Error ? e.message : String(e));
  }
  console.log("削除完了（またはスキップ）");

  // -- 1. Nutrients --
  console.log("栄養素データを投入中...");
  await prisma.fertilizerNutrient.createMany({
    data: nutrients,
    skipDuplicates: true,
  });
  console.log(`  栄養素: ${nutrients.length}件`);

  // -- 2. Fertilizer Categories --
  console.log("肥料分類データを投入中...");
  await prisma.fertilizerCategory.createMany({
    data: fertilizerCategories,
    skipDuplicates: true,
  });
  console.log(`  肥料分類: ${fertilizerCategories.length}件`);

  // -- 3. Tree Species --
  console.log("樹種データを投入中...");
  await prisma.treeSpecies.createMany({
    data: treeSpecies,
    skipDuplicates: true,
  });
  console.log(`  樹種: ${treeSpecies.length}件`);

  // -- 4. Fertilization Plans (per species) --
  console.log("施肥計画データを投入中...");
  // Need to look up treeSpeciesId by slug
  const speciesRecords = await prisma.treeSpecies.findMany({
    select: { id: true, slug: true },
  });
  const slugToId = new Map(speciesRecords.map((s) => [s.slug, s.id]));

  let totalPlans = 0;
  for (const sp of allSpeciesPlans) {
    const treeSpeciesId = slugToId.get(sp.slug);
    if (!treeSpeciesId) {
      console.warn(`  WARNING: TreeSpecies slug="${sp.slug}" not found. Skipping.`);
      continue;
    }
    await prisma.fertilizationPlan.createMany({
      data: sp.plans.map((p) => ({
        treeSpeciesId,
        month: p.month,
        action: p.action,
        nitrogenLevel: p.nitrogenLevel,
        phosphorusLevel: p.phosphorusLevel,
        potassiumLevel: p.potassiumLevel,
        recommendedType: p.recommendedType,
        description: p.description,
        cautionNote: p.cautionNote,
      })),
      skipDuplicates: true,
    });
    totalPlans += sp.plans.length;
  }
  console.log(`  施肥計画: ${totalPlans}件 (${allSpeciesPlans.length}樹種 × 12ヶ月)`);

  // -- 5. Columns --
  console.log("コラムデータを投入中...");
  await prisma.fertilizerColumn.createMany({
    data: columns.map((c) => ({
      ...c,
      publishedAt: new Date(),
    })),
    skipDuplicates: true,
  });
  console.log(`  コラム: ${columns.length}件`);

  console.log("肥料シードデータの投入が完了しました。");
}

// CLI 実行判定: npx tsx 等でフルパスになる場合も考慮
const isCliEntry =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("seed-fertilizer-data.ts") ||
    process.argv[1].includes("seed-fertilizer-data"));

if (isCliEntry) {
  if (process.env.CONFIRM_FULL_RESET !== "1") {
    console.error(
      "Safety: set CONFIRM_FULL_RESET=1 to run full reset (deleteAll + seed). Example: CONFIRM_FULL_RESET=1 npx tsx prisma/seed-fertilizer-data.ts",
    );
    process.exit(1);
  }
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
