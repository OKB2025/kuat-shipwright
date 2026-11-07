// BEGIN GENERATED CRAFT PRICES — scripts/update-craft-costs.cjs
const CRAFT_PRICE_CATALOG={
 "modelVersion": 16,
 "modelSignature": "g1w0fx",
 "entries": {
  "arc170": {
   "reference": "craft_arc170",
   "signature": "1937axe",
   "build": 230835,
   "crew": 3000,
   "total": 233835,
   "by": {
    "hull": 20,
    "armor": 29,
    "power": 59286,
    "drive": 67790,
    "defense": 16503,
    "command": 32505,
    "weapons": 34201,
    "systems": 20501,
    "crew": 3000
   },
   "detailed": true,
   "systems": {
    "v": 1,
    "managed": true,
    "power": 27516841700000000,
    "crew": 3,
    "suitSeats": 0,
    "lifeSupportCapacity": 4,
    "lifeSupportHours": 12.597120000000002,
    "ejectionSeats": 3,
    "ejectionCoverage": 1,
    "ejectionSurvival": 0.9,
    "navCapacity": 2.331,
    "navReady": true,
    "targetDemand": 5,
    "targetCapacity": 6.097249999999999,
    "targetRatio": 1,
    "fireK": 1,
    "maneuverSupport": 48.668000000000006,
    "maneuverRatio": 1,
    "turnK": 1,
    "laserUnits": 5.333333333333334,
    "laserGunShare": 1,
    "laserAaShare": 1,
    "laserGasSeconds": 667.33875,
    "landingSupport": 45.5877,
    "landingRatio": 1,
    "landingReady": true
   },
   "heat": {
    "up": 4.22e-7,
    "upS": 4.22e-7,
    "down": 0.0304,
    "T": 0
   },
   "powerProfile": {
    "name": "ARC-170",
    "modules": [
     {
      "k": "weapon",
      "fit": 39,
      "name": "重レーザー",
      "w": 2.16,
      "hits": 1,
      "crew": 0,
      "size": 0.500000002,
      "weaponPowerW": 46488888888888.9,
      "stock": 0,
      "at": 0.688,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.75,
      "z": 0.93,
      "r": 0.142,
      "share": 0.19999999984000003,
      "domain": "main",
      "port": "f39",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 40,
      "name": "重レーザー",
      "w": 2.16,
      "hits": 1,
      "crew": 0,
      "size": 0.500000002,
      "weaponPowerW": 46488888888888.9,
      "stock": 0,
      "at": 0.688,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.75,
      "z": -0.93,
      "r": 0.142,
      "share": 0.19999999984000003,
      "domain": "main",
      "port": "f40",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 41,
      "name": "旋回砲塔",
      "w": 2.028,
      "hits": 1,
      "crew": 0,
      "size": 0.750000004,
      "weaponPowerW": 139466666666666.69,
      "stock": 0,
      "at": 0.152,
      "pd": false,
      "dualPurpose": true,
      "band": "close",
      "y": 0.71,
      "z": 0,
      "r": 0.051,
      "share": 0.30000000016,
      "domain": "main",
      "port": "f41",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 42,
      "name": "旋回砲塔",
      "w": 2.028,
      "hits": 1,
      "crew": 0,
      "size": 0.750000004,
      "weaponPowerW": 139466666666666.69,
      "stock": 0,
      "at": 0.152,
      "pd": false,
      "dualPurpose": true,
      "band": "close",
      "y": -0.14,
      "z": 0,
      "r": 0.051,
      "share": 0.30000000016,
      "domain": "main",
      "port": "f42",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 43,
      "name": "魚雷発射管",
      "w": 0.84,
      "hits": 1,
      "crew": 0,
      "size": 0,
      "weaponPowerW": 1000000000000000,
      "stock": 0,
      "at": 0.767,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.66,
      "z": 0,
      "r": 0.055,
      "share": 0,
      "domain": "main",
      "port": "f43",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "操縦士席（前席）",
      "w": 0.8591350335259493,
      "hits": 1,
      "crew": 0,
      "size": 0.7963282878380625,
      "at": 0.622,
      "part": 24,
      "y": 0.29,
      "z": 0,
      "r": 0.036,
      "share": 0.23995132144268713,
      "domain": "main",
      "port": "p24",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "副操縦士・前方射手席（中席）",
      "w": 0.9354665015329808,
      "hits": 1,
      "crew": 0,
      "size": 0.9047786842338602,
      "at": 0.433,
      "part": 25,
      "y": 0.58,
      "z": 0,
      "r": 0.038,
      "share": 0.27262982391910145,
      "domain": "main",
      "port": "p25",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "後部射手席（後席）",
      "w": 0.7860517130936855,
      "hits": 1,
      "crew": 0,
      "size": 0.696909970321336,
      "at": 0.212,
      "part": 26,
      "y": 0.6,
      "z": 0,
      "r": 0.035,
      "share": 0.20999438404879872,
      "domain": "main",
      "port": "p26",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "アストロメク・ソケット",
      "w": 0.21281387009229719,
      "hits": 1,
      "crew": 0,
      "size": 0.09817477042468103,
      "at": 0.307,
      "part": 27,
      "y": 0.86,
      "z": 0,
      "r": 0.018,
      "share": 0.029582229157888617,
      "domain": "main",
      "port": "p27",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "右舷反応炉",
      "w": 1.877429298215496,
      "hits": 1,
      "crew": 0.0012862203922572209,
      "size": 2.5724407845144417,
      "at": 0.551,
      "part": 28,
      "y": 0.02,
      "z": 0.21,
      "r": 0.054,
      "share": 0.5,
      "domain": "main",
      "port": "p28",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "左舷反応炉",
      "w": 1.877429298215496,
      "hits": 1,
      "crew": 0.0012862203922572209,
      "size": 2.5724407845144417,
      "at": 0.551,
      "part": 29,
      "y": 0.02,
      "z": -0.21,
      "r": 0.054,
      "share": 0.5,
      "domain": "main",
      "port": "p29",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "右舷IGP-440a イオン・タービン",
      "w": 2.320250794710102,
      "hits": 1,
      "crew": 0.0014137166941154068,
      "size": 3.5342917352885173,
      "at": 0.303,
      "part": 30,
      "y": 0.02,
      "z": 0.21,
      "r": 0.06,
      "share": 0.48732609930588305,
      "domain": "main",
      "port": "p30",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "左舷IGP-440a イオン・タービン",
      "w": 2.320250794710102,
      "hits": 1,
      "crew": 0.0014137166941154068,
      "size": 3.5342917352885173,
      "at": 0.303,
      "part": 31,
      "y": 0.02,
      "z": -0.21,
      "r": 0.06,
      "share": 0.48732609930588305,
      "domain": "main",
      "port": "p31",
      "powerConnected": true
     },
     {
      "k": "shield",
      "name": "偏向シールド発生器",
      "w": 0.649629514953459,
      "hits": 1,
      "crew": 0.00020943951023931953,
      "size": 0.5235987755982988,
      "at": 0.315,
      "part": 32,
      "y": 0.06,
      "z": 0,
      "r": 0.032,
      "share": 1,
      "domain": "main",
      "port": "p32",
      "powerConnected": true
     },
     {
      "k": "hyper",
      "name": "ハイパードライブ",
      "w": 0.30862107659456256,
      "hits": 1,
      "crew": 0.000051435104628031273,
      "size": 0.17145034876010426,
      "at": 0.441,
      "part": 33,
      "y": 0.06,
      "z": 0.07,
      "r": 0.022,
      "share": 1,
      "domain": "main",
      "port": "p33",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "前部リパルサーリフト",
      "w": 0.18339743369871353,
      "hits": 1,
      "crew": 0.000015707963267948967,
      "size": 0.07853981633974483,
      "at": 0.755,
      "part": 34,
      "y": -0.46,
      "z": 0,
      "r": 0.017,
      "share": 0.023665783326310894,
      "domain": "main",
      "port": "p34",
      "powerConnected": true
     },
     {
      "k": "fuel",
      "name": "右舷反応物タンク",
      "w": 0.2508841602456276,
      "hits": 1,
      "crew": 0.00002513274122871835,
      "size": 0.12566370614359174,
      "at": 0.268,
      "part": 35,
      "y": 0.06,
      "z": 0.08,
      "r": 0.02,
      "share": 0.5,
      "domain": "main",
      "port": "p35",
      "powerConnected": true
     },
     {
      "k": "fuel",
      "name": "左舷反応物タンク",
      "w": 0.2508841602456276,
      "hits": 1,
      "crew": 0.00002513274122871835,
      "size": 0.12566370614359174,
      "at": 0.268,
      "part": 36,
      "y": 0.06,
      "z": -0.08,
      "r": 0.02,
      "share": 0.5,
      "domain": "main",
      "port": "p36",
      "powerConnected": true
     },
     {
      "k": "battery",
      "name": "パワーセル",
      "w": 0.16000000000000003,
      "hits": 1,
      "crew": 0.000012800000000000005,
      "size": 0.06400000000000002,
      "at": 0.488,
      "part": 37,
      "y": 0.03,
      "z": 0.08,
      "r": 0.016,
      "share": 1,
      "domain": "main",
      "port": "p37",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "慣性補償装置",
      "w": 0.2935462967926265,
      "hits": 1,
      "crew": 0.00003180862561759666,
      "size": 0.1590431280879833,
      "at": 0.724,
      "part": 38,
      "y": -0.1,
      "z": 0,
      "r": 0.021,
      "share": 0.04792321123577956,
      "domain": "main",
      "port": "p38",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "生命維持装置",
      "w": 0.2916,
      "hits": 1,
      "crew": 0,
      "size": 0.15746400000000002,
      "at": 0.551,
      "part": 44,
      "y": -0.36,
      "z": 0,
      "r": 0.021,
      "share": 0.04744738502537637,
      "domain": "main",
      "port": "p44",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "射出座席機構 1",
      "w": 0.08410000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.024388999999999997,
      "at": 0.622,
      "part": 45,
      "y": -0.13,
      "z": 0,
      "r": 0.011,
      "share": 0.007348944986688411,
      "domain": "main",
      "port": "p45",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "射出座席機構 2",
      "w": 0.08410000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.024388999999999997,
      "at": 0.433,
      "part": 46,
      "y": 0.14,
      "z": 0,
      "r": 0.011,
      "share": 0.007348944986688411,
      "domain": "main",
      "port": "p46",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "射出座席機構 3",
      "w": 0.08410000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.024388999999999997,
      "at": 0.212,
      "part": 47,
      "y": 0.2,
      "z": 0,
      "r": 0.011,
      "share": 0.007348944986688411,
      "domain": "main",
      "port": "p47",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "航法コンピューター",
      "w": 0.048400000000000006,
      "hits": 1,
      "crew": 0,
      "size": 0.010648,
      "at": 0.527,
      "part": 48,
      "y": -0.36,
      "z": 0,
      "r": 0.009,
      "share": 0.0032084778473187997,
      "domain": "main",
      "port": "p48",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "照準コンピューター",
      "w": 0.08410000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.024388999999999997,
      "at": 0.551,
      "part": 49,
      "y": -0.57,
      "z": 0,
      "r": 0.011,
      "share": 0.007348944986688411,
      "domain": "main",
      "port": "p49",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 1",
      "w": 0.05290000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.012167,
      "at": 0.551,
      "part": 50,
      "y": -0.36,
      "z": -0.03,
      "r": 0.009,
      "share": 0.003666186135267453,
      "domain": "main",
      "port": "p50",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 2",
      "w": 0.05290000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.012167,
      "at": 0.551,
      "part": 51,
      "y": -0.36,
      "z": 0.03,
      "r": 0.009,
      "share": 0.003666186135267453,
      "domain": "main",
      "port": "p51",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 3",
      "w": 0.05290000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.012167,
      "at": 0.551,
      "part": 52,
      "y": -0.19,
      "z": 0,
      "r": 0.009,
      "share": 0.003666186135267453,
      "domain": "main",
      "port": "p52",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 4",
      "w": 0.05290000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.012167,
      "at": 0.576,
      "part": 53,
      "y": -0.36,
      "z": 0,
      "r": 0.009,
      "share": 0.003666186135267453,
      "domain": "main",
      "port": "p53",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 1",
      "w": 0.1521,
      "hits": 1,
      "crew": 0,
      "size": 0.059319000000000004,
      "at": 0.508,
      "part": 54,
      "y": -0.36,
      "z": 0,
      "r": 0.015,
      "share": 0.017874126354724258,
      "domain": "main",
      "port": "p54",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 2",
      "w": 0.1521,
      "hits": 1,
      "crew": 0,
      "size": 0.059319000000000004,
      "at": 0.551,
      "part": 55,
      "y": -0.07,
      "z": 0,
      "r": 0.015,
      "share": 0.017874126354724258,
      "domain": "main",
      "port": "p55",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 1",
      "w": 0.13690000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.050653,
      "at": 0.592,
      "part": 56,
      "y": -0.49,
      "z": 0,
      "r": 0.015,
      "share": 0.015262868933155444,
      "domain": "main",
      "port": "p56",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 2",
      "w": 0.13690000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.050653,
      "at": 0.592,
      "part": 57,
      "y": -0.22,
      "z": 0,
      "r": 0.015,
      "share": 0.015262868933155444,
      "domain": "main",
      "port": "p57",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 3",
      "w": 0.13690000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.050653,
      "at": 0.51,
      "part": 58,
      "y": -0.09,
      "z": 0,
      "r": 0.015,
      "share": 0.015262868933155444,
      "domain": "main",
      "port": "p58",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 1",
      "w": 0.18566360999173018,
      "hits": 1,
      "crew": 0.0000040000018306411445,
      "size": 0.0800000366128229,
      "at": 0.463,
      "part": 59,
      "y": -0.36,
      "z": 0,
      "r": 0.017,
      "share": 0.018899136038624764,
      "domain": "main",
      "port": "p59",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 2",
      "w": 0.18566360999173018,
      "hits": 1,
      "crew": 0.0000040000018306411445,
      "size": 0.0800000366128229,
      "at": 0.639,
      "part": 60,
      "y": -0.36,
      "z": 0,
      "r": 0.017,
      "share": 0.018899136038624764,
      "domain": "main",
      "port": "p60",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 3",
      "w": 0.18566360143077285,
      "hits": 1,
      "crew": 0.000004000001553980755,
      "size": 0.08000003107961509,
      "at": 0.507,
      "part": 61,
      "y": 0.08,
      "z": -0.05,
      "r": 0.017,
      "share": 0.018899134731464776,
      "domain": "main",
      "port": "p61",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 4",
      "w": 0.18566360143077287,
      "hits": 1,
      "crew": 0.0000040000015539807556,
      "size": 0.0800000310796151,
      "at": 0.507,
      "part": 62,
      "y": 0.08,
      "z": 0.05,
      "r": 0.017,
      "share": 0.01889913473146478,
      "domain": "main",
      "port": "p62",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 5",
      "w": 0.18566364423556203,
      "hits": 1,
      "crew": 0.000004000002937282854,
      "size": 0.08000005874565708,
      "at": 0.529,
      "part": 63,
      "y": 0.23,
      "z": 0,
      "r": 0.017,
      "share": 0.018899141267265423,
      "domain": "main",
      "port": "p63",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 6",
      "w": 0.1856636099917301,
      "hits": 1,
      "crew": 0.000004000001830641143,
      "size": 0.08000003661282286,
      "at": 0.463,
      "part": 64,
      "y": -0.07,
      "z": 0,
      "r": 0.017,
      "share": 0.018899136038624757,
      "domain": "main",
      "port": "p64",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 7",
      "w": 0.18566364423556203,
      "hits": 1,
      "crew": 0.000004000002937282854,
      "size": 0.08000005874565708,
      "at": 0.485,
      "part": 65,
      "y": 0.23,
      "z": 0,
      "r": 0.017,
      "share": 0.018899141267265423,
      "domain": "main",
      "port": "p65",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 8",
      "w": 0.18566360143077287,
      "hits": 1,
      "crew": 0.0000040000015539807556,
      "size": 0.0800000310796151,
      "at": 0.463,
      "part": 66,
      "y": 0.08,
      "z": -0.05,
      "r": 0.017,
      "share": 0.01889913473146478,
      "domain": "main",
      "port": "p66",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 9",
      "w": 0.185663644235562,
      "hits": 1,
      "crew": 0.000004000002937282854,
      "size": 0.08000005874565706,
      "at": 0.842,
      "part": 67,
      "y": -0.25,
      "z": 0,
      "r": 0.017,
      "share": 0.01889914126726542,
      "domain": "main",
      "port": "p67",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 10",
      "w": 0.07446800954130982,
      "hits": 1,
      "crew": 0.0000010160723258764199,
      "size": 0.020321446517528395,
      "at": 0.509,
      "part": 68,
      "y": -0.54,
      "z": 0,
      "r": 0.011,
      "share": 0.0048007200808561565,
      "domain": "main",
      "port": "p68",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.20367075935777398,
      "hits": 1,
      "crew": 0.000018383280739892952,
      "size": 0.09191640369946476,
      "at": 0.492,
      "part": -30,
      "machineryOwner": 30,
      "y": 0.02,
      "z": 0.21,
      "r": 0.018,
      "share": 0.012673900694116967,
      "domain": "main",
      "port": "p30",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.20367075935777398,
      "hits": 1,
      "crew": 0.000018383280739892952,
      "size": 0.09191640369946476,
      "at": 0.492,
      "part": -31,
      "machineryOwner": 31,
      "y": 0.02,
      "z": -0.21,
      "r": 0.018,
      "share": 0.012673900694116967,
      "domain": "main",
      "port": "p31",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p28 → p30",
      "w": 0.002508368683098277,
      "hits": 1,
      "crew": 2.5125635240222844e-8,
      "size": 0.00012562817620111422,
      "at": 0.488,
      "part": -6000000,
      "routeId": "p28>p30",
      "capacityW": 1285944977618893300,
      "y": 0.02,
      "z": 0.21,
      "r": 0.002,
      "share": 0.5,
      "domain": "main",
      "port": "p-6000000",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p29 → p31",
      "w": 0.002508368683098277,
      "hits": 1,
      "crew": 2.5125635240222844e-8,
      "size": 0.00012562817620111422,
      "at": 0.488,
      "part": -6000001,
      "routeId": "p29>p31",
      "capacityW": 1285944977618893300,
      "y": 0.02,
      "z": -0.21,
      "r": 0.002,
      "share": 0.5,
      "domain": "main",
      "port": "p-6000001",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "右舷主翼（内翼）",
      "w": 2.2662585444497383,
      "hits": 1,
      "crew": 0,
      "size": 0.9108812842340624,
      "at": 0.407,
      "part": 9,
      "ext": 1,
      "y": -0.08,
      "z": 0.47,
      "r": 0.038,
      "share": 0.2151857678402296,
      "domain": "main",
      "port": "p9",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "左舷主翼（内翼）",
      "w": 2.2969661635217924,
      "hits": 1,
      "crew": 0,
      "size": 0.9108809919985327,
      "at": 0.407,
      "part": 10,
      "ext": 1,
      "y": -0.08,
      "z": -0.47,
      "r": 0.038,
      "share": 0.2151856988027733,
      "domain": "main",
      "port": "p10",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "右舷主翼（翼端・赤）",
      "w": 1.3632280774043888,
      "hits": 1,
      "crew": 0,
      "size": 0.315989584344352,
      "at": 0.471,
      "part": 11,
      "ext": 1,
      "y": -0.2,
      "z": 0.85,
      "r": 0.027,
      "share": 0.07464909260247994,
      "domain": "main",
      "port": "p11",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "左舷主翼（翼端・赤）",
      "w": 1.3632280578359433,
      "hits": 1,
      "crew": 0,
      "size": 0.3159895775405474,
      "at": 0.471,
      "part": 12,
      "ext": 1,
      "y": -0.2,
      "z": -0.85,
      "r": 0.027,
      "share": 0.07464909099515532,
      "domain": "main",
      "port": "p12",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "右舷上部Sフォイル（放熱板）",
      "w": 1.190912065328697,
      "hits": 1,
      "crew": 0,
      "size": 0.26724687481262693,
      "at": 0.449,
      "part": 13,
      "ext": 1,
      "y": 0.36,
      "z": 0.51,
      "r": 0.025,
      "share": 0.06313415914326714,
      "domain": "main",
      "port": "p13",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "左舷上部Sフォイル（放熱板）",
      "w": 1.1360309066103496,
      "hits": 1,
      "crew": 0,
      "size": 0.2672467271790622,
      "at": 0.449,
      "part": 14,
      "ext": 1,
      "y": 0.36,
      "z": -0.51,
      "r": 0.025,
      "share": 0.06313412426644781,
      "domain": "main",
      "port": "p14",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "右舷下部Sフォイル（放熱板）",
      "w": 1.112050506027025,
      "hits": 1,
      "crew": 0,
      "size": 0.25222138784736126,
      "at": 0.449,
      "part": 15,
      "ext": 1,
      "y": -0.53,
      "z": 0.5,
      "r": 0.025,
      "share": 0.059584551740242235,
      "domain": "main",
      "port": "p15",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "左舷下部Sフォイル（放熱板）",
      "w": 1.149689224417812,
      "hits": 1,
      "crew": 0,
      "size": 0.2522214161078879,
      "at": 0.449,
      "part": 16,
      "ext": 1,
      "y": -0.53,
      "z": -0.5,
      "r": 0.025,
      "share": 0.0595845584164834,
      "domain": "main",
      "port": "p16",
      "powerConnected": true
     },
     {
      "k": "quarters",
      "name": "居住空間（後部）",
      "w": 0.3963481137182923,
      "hits": 1,
      "crew": 0,
      "size": 4.29514969895023,
      "at": 0.168,
      "y": 0.16,
      "z": 0,
      "r": 0.064,
      "share": 0.10772833723653397,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央後部）",
      "w": 1.0149527179325275,
      "hits": 1,
      "crew": 0,
      "size": 17.6007764837417,
      "at": 0.393,
      "y": 0,
      "z": 0,
      "r": 0.102,
      "share": 0.4414519906323185,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央前部）",
      "w": 0.8432486459356084,
      "hits": 1,
      "crew": 0,
      "size": 13.32896998967707,
      "at": 0.595,
      "y": -0.15,
      "z": 0,
      "r": 0.093,
      "share": 0.33430913348946134,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（前部）",
      "w": 0.4176062257590606,
      "hits": 1,
      "crew": 0,
      "size": 4.6452977722342155,
      "at": 0.849,
      "y": -0.37,
      "z": 0,
      "r": 0.066,
      "share": 0.11651053864168619,
      "domain": "main"
     },
     {
      "k": "hull",
      "name": "船体構造",
      "w": 24.48780481689913,
      "hits": null,
      "crew": 0,
      "size": 1,
      "share": 1,
      "domain": "main"
     }
    ],
    "energyModel": {
     "version": 0,
     "eta": 0.75
    },
    "D": 0.003082228580376122,
    "shieldBuffer": 0.0731817485234382,
    "wCap": 0,
    "crewNeed": 3,
    "crewMax": 3,
    "hp": 1,
    "len": 12.710000038146973,
    "width": 20.430400848388672,
    "height": 3.8475,
    "grid": {
     "P": 26943763873255174000,
     "fixed": 159399691793162700,
     "cooling": 121591342012507120,
     "De": 2571889955237786600,
     "Ds": 12896044380293693000,
     "Dw": 1371911111111111.2,
     "domains": [
      {
       "id": "main",
       "P": 26943763873255174000,
       "reactors": [
        9,
        10
       ],
       "sources": [
        {
         "moduleIndex": 9,
         "P": 13471881936627587000
        },
        {
         "moduleIndex": 10,
         "P": 13471881936627587000
        }
       ],
       "modules": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36,
        37,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        46,
        47,
        48,
        49,
        50,
        51,
        52,
        53,
        54,
        55,
        56,
        57,
        58,
        59,
        60,
        61
       ],
       "protection": 1
      }
     ],
     "powerPaths": [
      {
       "kind": "power",
       "from": "p28",
       "to": "hotel",
       "cap": 159399691793162700,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p9",
       "cap": 926246744578151.9,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "p10",
       "cap": 947687641443386.9,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p11",
       "cap": 563021081397991.6,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "p12",
       "cap": 563021081397991.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p13",
       "cap": 583469449519152.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "p14",
       "cap": 542205697785125.06,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p15",
       "cap": 561986469407343.94,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "p16",
       "cap": 591659354992051.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p24",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p25",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p26",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p27",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p33",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p34",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p35",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "p36",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p37",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p38",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p44",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p45",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p46",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p47",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p48",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p49",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "p50",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p51",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p52",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p53",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p54",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p55",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p56",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p57",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p58",
       "cap": 4554276908376077,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p32",
       "cap": 306192435822065400000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "f39",
       "cap": 69733333333333.34,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "f40",
       "cap": 69733333333333.34,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "f41",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "f42",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "f43",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "p32",
       "cap": 306192435822065400000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "f39",
       "cap": 69733333333333.34,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "f40",
       "cap": 69733333333333.34,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "f41",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "f42",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "f43",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p59",
       "cap": 12568814660321880,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p60",
       "cap": 12568814660321880,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p61",
       "cap": 12568813790998986,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p62",
       "cap": 12568813790998988,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p63",
       "cap": 12568818137613922,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p64",
       "cap": 12568814660321872,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p65",
       "cap": 12568818137613922,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p66",
       "cap": 12568813790998988,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p67",
       "cap": 12568818137613920,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p68",
       "cap": 3192704725181565.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "p59",
       "cap": 12568814660321880,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "p60",
       "cap": 12568814660321880,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "p61",
       "cap": 12568813790998986,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "p62",
       "cap": 12568813790998988,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "p63",
       "cap": 12568818137613922,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "p64",
       "cap": 12568814660321872,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "p65",
       "cap": 12568818137613922,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "p66",
       "cap": 12568813790998988,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "p67",
       "cap": 12568818137613920,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "p68",
       "cap": 3192704725181565.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p28",
       "to": "p-6000000",
       "cap": 1285944977618893300,
       "auto": false,
       "ok": true,
       "capacityGroup": "p28>p30",
       "groupCap": 1285944977618893300,
       "physical": true,
       "routeId": "p28>p30",
       "efficiency": 0.9999990230677283
      },
      {
       "kind": "power",
       "from": "p-6000000",
       "to": "p30",
       "cap": 1285944977618893300,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p28>p30",
       "efficiency": 1
      },
      {
       "kind": "power",
       "from": "p29",
       "to": "p-6000001",
       "cap": 1285944977618893300,
       "auto": false,
       "ok": true,
       "capacityGroup": "p29>p31",
       "groupCap": 1285944977618893300,
       "physical": true,
       "routeId": "p29>p31",
       "efficiency": 0.9999990230677283
      },
      {
       "kind": "power",
       "from": "p-6000001",
       "to": "p31",
       "cap": 1285944977618893300,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p29>p31",
       "efficiency": 1
      }
     ],
     "trunks": [
      {
       "port": "p-6000000",
       "moduleIndex": 47
      },
      {
       "port": "p-6000001",
       "moduleIndex": 48
      }
     ],
     "fixedLoads": [
      {
       "id": "hotel",
       "port": "hotel",
       "weight": 159399691793162700,
       "domain": "main"
      }
     ],
     "coolingLoads": [
      {
       "id": "p59",
       "port": "p59",
       "weight": 12568814660321880,
       "domain": "main"
      },
      {
       "id": "p60",
       "port": "p60",
       "weight": 12568814660321880,
       "domain": "main"
      },
      {
       "id": "p61",
       "port": "p61",
       "weight": 12568813790998986,
       "domain": "main"
      },
      {
       "id": "p62",
       "port": "p62",
       "weight": 12568813790998988,
       "domain": "main"
      },
      {
       "id": "p63",
       "port": "p63",
       "weight": 12568818137613922,
       "domain": "main"
      },
      {
       "id": "p64",
       "port": "p64",
       "weight": 12568814660321872,
       "domain": "main"
      },
      {
       "id": "p65",
       "port": "p65",
       "weight": 12568818137613922,
       "domain": "main"
      },
      {
       "id": "p66",
       "port": "p66",
       "weight": 12568813790998988,
       "domain": "main"
      },
      {
       "id": "p67",
       "port": "p67",
       "weight": 12568818137613920,
       "domain": "main"
      },
      {
       "id": "p68",
       "port": "p68",
       "weight": 3192704725181565.5,
       "domain": "main"
      },
      {
       "id": "p9",
       "port": "p9",
       "weight": 926246744578151.9,
       "domain": "main"
      },
      {
       "id": "p10",
       "port": "p10",
       "weight": 947687641443386.9,
       "domain": "main"
      },
      {
       "id": "p11",
       "port": "p11",
       "weight": 563021081397991.6,
       "domain": "main"
      },
      {
       "id": "p12",
       "port": "p12",
       "weight": 563021081397991.8,
       "domain": "main"
      },
      {
       "id": "p13",
       "port": "p13",
       "weight": 583469449519152.8,
       "domain": "main"
      },
      {
       "id": "p14",
       "port": "p14",
       "weight": 542205697785125.06,
       "domain": "main"
      },
      {
       "id": "p15",
       "port": "p15",
       "weight": 561986469407343.94,
       "domain": "main"
      },
      {
       "id": "p16",
       "port": "p16",
       "weight": 591659354992051.8,
       "domain": "main"
      }
     ]
    },
    "propulsion": {
     "version": 1,
     "architectureVersion": 2,
     "cores": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 31251577257818028,
       "densityFactor": 41.14816244345542,
       "efficiency": 0.31588662443115656,
       "wasteFraction": 0.6841133755688434,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 6014816244.345543,
       "ratedShaftPowerW": 406212818184231360,
       "ratedWasteHeatW": 879732159434661900,
       "thermalStoreJ": 93754731773454100,
       "version": 1,
       "id": 30,
       "machineryId": 30,
       "coreId": 30,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 1285944977618893300,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 213796220.09696388,
       "effectiveMachineryVolumeM3": 0.09191640369946479,
       "machineryVolumeM3": 0.09191640369946479,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.35,
       "machineryDiameterM": 0.7,
       "machineryOffsetM": 2.25,
       "maxInputW": 3125157725781802500,
       "maxRatedInputW": 3125157725781802500,
       "inputDensityWPerM3": 13990375230774843000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 10380.044002519662,
       "powerNode": "p30",
       "heatNode": "p30",
       "reactorId": 28,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 11,
       "machineryModuleIndex": 45,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 1285943721337745000,
       "transmissionRouteIds": [
        "p28>p30"
       ]
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 31251577257818028,
       "densityFactor": 41.14816244345542,
       "efficiency": 0.31588662443115656,
       "wasteFraction": 0.6841133755688434,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 6014816244.345543,
       "ratedShaftPowerW": 406212818184231360,
       "ratedWasteHeatW": 879732159434661900,
       "thermalStoreJ": 93754731773454100,
       "version": 1,
       "id": 31,
       "machineryId": 31,
       "coreId": 31,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 1285944977618893300,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 213796220.09696388,
       "effectiveMachineryVolumeM3": 0.09191640369946479,
       "machineryVolumeM3": 0.09191640369946479,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.35,
       "machineryDiameterM": 0.7,
       "machineryOffsetM": 2.25,
       "maxInputW": 3125157725781802500,
       "maxRatedInputW": 3125157725781802500,
       "inputDensityWPerM3": 13990375230774843000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 10380.044002519662,
       "powerNode": "p31",
       "heatNode": "p31",
       "reactorId": 29,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 12,
       "machineryModuleIndex": 46,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 1285943721337745000,
       "transmissionRouteIds": [
        "p29>p31"
       ]
      }
     ],
     "engines": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 31251577257818028,
       "densityFactor": 41.14816244345542,
       "efficiency": 0.31588662443115656,
       "wasteFraction": 0.6841133755688434,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 6014816244.345543,
       "ratedShaftPowerW": 406212818184231360,
       "ratedWasteHeatW": 879732159434661900,
       "thermalStoreJ": 93754731773454100,
       "version": 1,
       "id": 30,
       "machineryId": 30,
       "coreId": 30,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 1285944977618893300,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 213796220.09696388,
       "effectiveMachineryVolumeM3": 0.09191640369946479,
       "machineryVolumeM3": 0.09191640369946479,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.35,
       "machineryDiameterM": 0.7,
       "machineryOffsetM": 2.25,
       "maxInputW": 3125157725781802500,
       "maxRatedInputW": 3125157725781802500,
       "inputDensityWPerM3": 13990375230774843000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 10380.044002519662,
       "powerNode": "p30",
       "heatNode": "p30",
       "reactorId": 28,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 11,
       "coreModuleIndex": 11,
       "machineryModuleIndex": 45,
       "shaftModuleIndices": [],
       "shaftCapacityW": 406212818184231360,
       "ratedShaftCapacityW": 406212818184231360,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 1285943721337745000
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 31251577257818028,
       "densityFactor": 41.14816244345542,
       "efficiency": 0.31588662443115656,
       "wasteFraction": 0.6841133755688434,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 6014816244.345543,
       "ratedShaftPowerW": 406212818184231360,
       "ratedWasteHeatW": 879732159434661900,
       "thermalStoreJ": 93754731773454100,
       "version": 1,
       "id": 31,
       "machineryId": 31,
       "coreId": 31,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 1285944977618893300,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 213796220.09696388,
       "effectiveMachineryVolumeM3": 0.09191640369946479,
       "machineryVolumeM3": 0.09191640369946479,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.35,
       "machineryDiameterM": 0.7,
       "machineryOffsetM": 2.25,
       "maxInputW": 3125157725781802500,
       "maxRatedInputW": 3125157725781802500,
       "inputDensityWPerM3": 13990375230774843000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 10380.044002519662,
       "powerNode": "p31",
       "heatNode": "p31",
       "reactorId": 29,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 12,
       "coreModuleIndex": 12,
       "machineryModuleIndex": 46,
       "shaftModuleIndices": [],
       "shaftCapacityW": 406212818184231360,
       "ratedShaftCapacityW": 406212818184231360,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 1285943721337745000
      }
     ],
     "massKg": 36927.62927587152,
     "ratedThrustN": 427592440.19392776,
     "ratedAccelMps2": 11579.200955456847,
     "structuralAccelerationLimitMps2": 263214.93345963437,
     "inertialFactor": 1,
     "accelerationLimitMps2": 11579.200955456847
    },
    "profileVersion": 18,
    "heat": {
     "v": 3,
     "mode": "strict",
     "src": [
      {
       "k": "reactor",
       "id": "p28",
       "n": "右舷反応炉 #28",
       "g": "high",
       "sh": 0.808825,
       "st": 38799019977487460000,
       "m": [
        9
       ],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "reactor",
       "id": "p29",
       "n": "左舷反応炉 #29",
       "g": "high",
       "sh": 0.191175,
       "st": 9170577608319136000,
       "m": [
        10
       ],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "shield",
       "id": "p32",
       "n": "シールド（艦尾区画）",
       "g": "high",
       "sh": 1,
       "st": 348193198267929700000,
       "m": [
        13
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p30",
       "n": "右舷IGP-440a イオン・タービン #30",
       "g": "high",
       "sh": 0.375,
       "st": 93754731773454100,
       "m": [
        11,
        45
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p31",
       "n": "左舷IGP-440a イオン・タービン #31",
       "g": "high",
       "sh": 0.625,
       "st": 93754731773454100,
       "m": [
        12,
        46
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "feed",
       "id": "p-6000000",
       "n": "推進配電路 1",
       "g": "high",
       "sh": 0.375,
       "st": 45226165516800,
       "m": [
        47
       ],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1,
       "routeId": "p28>p30"
      },
      {
       "k": "feed",
       "id": "p-6000001",
       "n": "推進配電路 2",
       "g": "high",
       "sh": 0.625,
       "st": 75376868889600,
       "m": [
        48
       ],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1,
       "routeId": "p29>p31"
      },
      {
       "k": "weapon",
       "id": "f39",
       "n": "武装（艦首区画）",
       "g": "high",
       "sh": 0.796683,
       "st": 20493333333333332,
       "m": [
        0,
        1,
        4
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "weapon",
       "id": "f41",
       "n": "武装（艦尾区画）",
       "g": "high",
       "sh": 0.203317,
       "st": 5230000000000001,
       "m": [
        2,
        3
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "hotel",
       "id": "hotel",
       "n": "生活・電子設備",
       "g": "low",
       "sh": 1,
       "st": 9563981507589761000,
       "m": [],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1
      }
     ],
     "dis": [
      {
       "id": "p59",
       "n": "機体内高エネルギー散逸装置 1 #59",
       "k": "hdis",
       "g": "high",
       "cap": 837920977354792100,
       "m": 35,
       "sec": 3,
       "src": -1,
       "power": 12568814660321880
      },
      {
       "id": "p60",
       "n": "機体内高エネルギー散逸装置 2 #60",
       "k": "hdis",
       "g": "high",
       "cap": 837920977354792100,
       "m": 36,
       "sec": 4,
       "src": -1,
       "power": 12568814660321880
      },
      {
       "id": "p61",
       "n": "機体内高エネルギー散逸装置 3 #61",
       "k": "hdis",
       "g": "high",
       "cap": 837920919399932400,
       "m": 37,
       "sec": 3,
       "src": -1,
       "power": 12568813790998986
      },
      {
       "id": "p62",
       "n": "機体内高エネルギー散逸装置 4 #62",
       "k": "hdis",
       "g": "high",
       "cap": 837920919399932500,
       "m": 38,
       "sec": 3,
       "src": -1,
       "power": 12568813790998988
      },
      {
       "id": "p63",
       "n": "機体内高エネルギー散逸装置 5 #63",
       "k": "hdis",
       "g": "high",
       "cap": 837921209174261500,
       "m": 39,
       "sec": 3,
       "src": -1,
       "power": 12568818137613922
      },
      {
       "id": "p64",
       "n": "機体内高エネルギー散逸装置 6 #64",
       "k": "hdis",
       "g": "high",
       "cap": 837920977354791600,
       "m": 40,
       "sec": 3,
       "src": -1,
       "power": 12568814660321872
      },
      {
       "id": "p65",
       "n": "機体内高エネルギー散逸装置 7 #65",
       "k": "hdis",
       "g": "high",
       "cap": 837921209174261500,
       "m": 41,
       "sec": 3,
       "src": -1,
       "power": 12568818137613922
      },
      {
       "id": "p66",
       "n": "機体内高エネルギー散逸装置 8 #66",
       "k": "hdis",
       "g": "high",
       "cap": 837920919399932500,
       "m": 42,
       "sec": 3,
       "src": -1,
       "power": 12568813790998988
      },
      {
       "id": "p67",
       "n": "機体内高エネルギー散逸装置 9 #67",
       "k": "hdis",
       "g": "high",
       "cap": 837921209174261400,
       "m": 43,
       "sec": 4,
       "src": -1,
       "power": 12568818137613920
      },
      {
       "id": "p68",
       "n": "機体内高エネルギー散逸装置 10 #68",
       "k": "hdis",
       "g": "high",
       "cap": 212846981678771040,
       "m": 44,
       "sec": 3,
       "src": -1,
       "power": 3192704725181565.5
      },
      {
       "id": "p9",
       "n": "右舷主翼（内翼） #9",
       "k": "wing",
       "g": "high",
       "cap": 92624674457815180,
       "m": 49,
       "sec": 3,
       "src": -1,
       "power": 926246744578151.9
      },
      {
       "id": "p10",
       "n": "左舷主翼（内翼） #10",
       "k": "wing",
       "g": "high",
       "cap": 94768764144338690,
       "m": 50,
       "sec": 3,
       "src": -1,
       "power": 947687641443386.9
      },
      {
       "id": "p11",
       "n": "右舷主翼（翼端・赤） #11",
       "k": "wing",
       "g": "high",
       "cap": 56302108139799160,
       "m": 51,
       "sec": 3,
       "src": -1,
       "power": 563021081397991.6
      },
      {
       "id": "p12",
       "n": "左舷主翼（翼端・赤） #12",
       "k": "wing",
       "g": "high",
       "cap": 56302108139799170,
       "m": 52,
       "sec": 3,
       "src": -1,
       "power": 563021081397991.8
      },
      {
       "id": "p13",
       "n": "右舷上部Sフォイル（放熱板） #13",
       "k": "wing",
       "g": "high",
       "cap": 58346944951915280,
       "m": 53,
       "sec": 3,
       "src": -1,
       "power": 583469449519152.8
      },
      {
       "id": "p14",
       "n": "左舷上部Sフォイル（放熱板） #14",
       "k": "wing",
       "g": "high",
       "cap": 54220569778512504,
       "m": 54,
       "sec": 3,
       "src": -1,
       "power": 542205697785125.06
      },
      {
       "id": "p15",
       "n": "右舷下部Sフォイル（放熱板） #15",
       "k": "wing",
       "g": "high",
       "cap": 56198646940734390,
       "m": 55,
       "sec": 3,
       "src": -1,
       "power": 561986469407343.94
      },
      {
       "id": "p16",
       "n": "左舷下部Sフォイル（放熱板） #16",
       "k": "wing",
       "g": "high",
       "cap": 59165935499205170,
       "m": 56,
       "sec": 3,
       "src": -1,
       "power": 591659354992051.8
      },
      {
       "id": "skin",
       "n": "外殻からの放熱",
       "k": "skin",
       "g": "low",
       "cap": 967203328522026900000,
       "m": -1,
       "sec": -1,
       "src": -1
      }
     ],
     "ln": [
      {
       "s": 0,
       "d": 0,
       "cap": 91592922089733630,
       "sec": 3
      },
      {
       "s": 0,
       "d": 1,
       "cap": 91592922089733630,
       "sec": 4
      },
      {
       "s": 0,
       "d": 2,
       "cap": 91592915754703140,
       "sec": 3
      },
      {
       "s": 0,
       "d": 3,
       "cap": 91592915754703150,
       "sec": 3
      },
      {
       "s": 0,
       "d": 4,
       "cap": 91592947429858990,
       "sec": 3
      },
      {
       "s": 0,
       "d": 5,
       "cap": 91592922089733580,
       "sec": 3
      },
      {
       "s": 0,
       "d": 6,
       "cap": 91592947429858990,
       "sec": 3
      },
      {
       "s": 0,
       "d": 7,
       "cap": 91592915754703150,
       "sec": 3
      },
      {
       "s": 0,
       "d": 8,
       "cap": 91592947429858980,
       "sec": 4
      },
      {
       "s": 0,
       "d": 9,
       "cap": 23266247697345760,
       "sec": 3
      },
      {
       "s": 0,
       "d": 10,
       "cap": 10124778852038952,
       "sec": 3
      },
      {
       "s": 0,
       "d": 11,
       "cap": 10359148732873186,
       "sec": 3
      },
      {
       "s": 0,
       "d": 12,
       "cap": 6154368662085495,
       "sec": 3
      },
      {
       "s": 0,
       "d": 13,
       "cap": 6154368662085496,
       "sec": 3
      },
      {
       "s": 0,
       "d": 14,
       "cap": 6377889237271033,
       "sec": 3
      },
      {
       "s": 0,
       "d": 15,
       "cap": 5926836250193874,
       "sec": 3
      },
      {
       "s": 0,
       "d": 16,
       "cap": 6143059345573138,
       "sec": 3
      },
      {
       "s": 0,
       "d": 17,
       "cap": 6467412879019399,
       "sec": 3
      },
      {
       "s": 1,
       "d": 0,
       "cap": 18556284376252710,
       "sec": 3
      },
      {
       "s": 1,
       "d": 1,
       "cap": 18556284376252710,
       "sec": 4
      },
      {
       "s": 1,
       "d": 2,
       "cap": 18556283092806080,
       "sec": 3
      },
      {
       "s": 1,
       "d": 3,
       "cap": 18556283092806084,
       "sec": 3
      },
      {
       "s": 1,
       "d": 4,
       "cap": 18556289510039924,
       "sec": 3
      },
      {
       "s": 1,
       "d": 5,
       "cap": 18556284376252700,
       "sec": 3
      },
      {
       "s": 1,
       "d": 6,
       "cap": 18556289510039924,
       "sec": 3
      },
      {
       "s": 1,
       "d": 7,
       "cap": 18556283092806084,
       "sec": 3
      },
      {
       "s": 1,
       "d": 8,
       "cap": 18556289510039924,
       "sec": 4
      },
      {
       "s": 1,
       "d": 9,
       "cap": 4713629599209769,
       "sec": 3
      },
      {
       "s": 1,
       "d": 10,
       "cap": 2051231376165069,
       "sec": 3
      },
      {
       "s": 1,
       "d": 11,
       "cap": 2098713583946667.8,
       "sec": 3
      },
      {
       "s": 1,
       "d": 12,
       "cap": 1246845416047240.2,
       "sec": 3
      },
      {
       "s": 1,
       "d": 13,
       "cap": 1246845416047240.2,
       "sec": 3
      },
      {
       "s": 1,
       "d": 14,
       "cap": 1292129606817165.5,
       "sec": 3
      },
      {
       "s": 1,
       "d": 15,
       "cap": 1200748446504777.8,
       "sec": 3
      },
      {
       "s": 1,
       "d": 16,
       "cap": 1244554203052651.2,
       "sec": 3
      },
      {
       "s": 1,
       "d": 17,
       "cap": 1310266664973831.2,
       "sec": 3
      },
      {
       "s": 2,
       "d": 0,
       "cap": 704554595884885800,
       "sec": 2
      },
      {
       "s": 2,
       "d": 1,
       "cap": 704554595884885800,
       "sec": 3
      },
      {
       "s": 2,
       "d": 2,
       "cap": 704554547154320600,
       "sec": 3
      },
      {
       "s": 2,
       "d": 3,
       "cap": 704554547154320800,
       "sec": 3
      },
      {
       "s": 2,
       "d": 4,
       "cap": 704554790807172000,
       "sec": 3
      },
      {
       "s": 2,
       "d": 5,
       "cap": 704554595884885400,
       "sec": 2
      },
      {
       "s": 2,
       "d": 6,
       "cap": 704554790807172000,
       "sec": 3
      },
      {
       "s": 2,
       "d": 7,
       "cap": 704554547154320800,
       "sec": 2
      },
      {
       "s": 2,
       "d": 8,
       "cap": 704554790807171800,
       "sec": 4
      },
      {
       "s": 2,
       "d": 9,
       "cap": 178969524829675230,
       "sec": 3
      },
      {
       "s": 2,
       "d": 10,
       "cap": 77882213054994420,
       "sec": 1
      },
      {
       "s": 2,
       "d": 11,
       "cap": 79685042060897070,
       "sec": 1
      },
      {
       "s": 2,
       "d": 12,
       "cap": 47340871179916970,
       "sec": 2
      },
      {
       "s": 2,
       "d": 13,
       "cap": 47340871179916980,
       "sec": 2
      },
      {
       "s": 2,
       "d": 14,
       "cap": 49060244739890504,
       "sec": 2
      },
      {
       "s": 2,
       "d": 15,
       "cap": 45590637615428650,
       "sec": 2
      },
      {
       "s": 2,
       "d": 16,
       "cap": 47253877220740820,
       "sec": 2
      },
      {
       "s": 2,
       "d": 17,
       "cap": 49748881937995930,
       "sec": 2
      },
      {
       "s": 3,
       "d": 0,
       "cap": 64083664499435224,
       "sec": 2
      },
      {
       "s": 3,
       "d": 1,
       "cap": 64083664499435224,
       "sec": 3
      },
      {
       "s": 3,
       "d": 2,
       "cap": 64083660067084344,
       "sec": 3
      },
      {
       "s": 3,
       "d": 3,
       "cap": 64083660067084350,
       "sec": 3
      },
      {
       "s": 3,
       "d": 4,
       "cap": 64083682228841100,
       "sec": 3
      },
      {
       "s": 3,
       "d": 5,
       "cap": 64083664499435180,
       "sec": 2
      },
      {
       "s": 3,
       "d": 6,
       "cap": 64083682228841100,
       "sec": 3
      },
      {
       "s": 3,
       "d": 7,
       "cap": 64083660067084350,
       "sec": 2
      },
      {
       "s": 3,
       "d": 8,
       "cap": 64083682228841096,
       "sec": 4
      },
      {
       "s": 3,
       "d": 9,
       "cap": 16278402059678178,
       "sec": 3
      },
      {
       "s": 3,
       "d": 10,
       "cap": 7083876311418246,
       "sec": 1
      },
      {
       "s": 3,
       "d": 11,
       "cap": 7247854929738112,
       "sec": 1
      },
      {
       "s": 3,
       "d": 12,
       "cap": 4305949494225508,
       "sec": 2
      },
      {
       "s": 3,
       "d": 13,
       "cap": 4305949494225508.5,
       "sec": 2
      },
      {
       "s": 3,
       "d": 14,
       "cap": 4462337315708892.5,
       "sec": 2
      },
      {
       "s": 3,
       "d": 15,
       "cap": 4146754761556920,
       "sec": 2
      },
      {
       "s": 3,
       "d": 16,
       "cap": 4298036847390354,
       "sec": 2
      },
      {
       "s": 3,
       "d": 17,
       "cap": 4524973192932564,
       "sec": 2
      },
      {
       "s": 4,
       "d": 0,
       "cap": 106806027549231120,
       "sec": 2
      },
      {
       "s": 4,
       "d": 1,
       "cap": 106806027549231120,
       "sec": 3
      },
      {
       "s": 4,
       "d": 2,
       "cap": 106806020161985200,
       "sec": 3
      },
      {
       "s": 4,
       "d": 3,
       "cap": 106806020161985220,
       "sec": 3
      },
      {
       "s": 4,
       "d": 4,
       "cap": 106806057098218800,
       "sec": 3
      },
      {
       "s": 4,
       "d": 5,
       "cap": 106806027549231060,
       "sec": 2
      },
      {
       "s": 4,
       "d": 6,
       "cap": 106806057098218800,
       "sec": 3
      },
      {
       "s": 4,
       "d": 7,
       "cap": 106806020161985220,
       "sec": 2
      },
      {
       "s": 4,
       "d": 8,
       "cap": 106806057098218780,
       "sec": 4
      },
      {
       "s": 4,
       "d": 9,
       "cap": 27130649790771108,
       "sec": 3
      },
      {
       "s": 4,
       "d": 10,
       "cap": 11806451681291586,
       "sec": 1
      },
      {
       "s": 4,
       "d": 11,
       "cap": 12079749173914076,
       "sec": 1
      },
      {
       "s": 4,
       "d": 12,
       "cap": 7176577118337242,
       "sec": 2
      },
      {
       "s": 4,
       "d": 13,
       "cap": 7176577118337243,
       "sec": 2
      },
      {
       "s": 4,
       "d": 14,
       "cap": 7437223292369094,
       "sec": 2
      },
      {
       "s": 4,
       "d": 15,
       "cap": 6911252762498578,
       "sec": 2
      },
      {
       "s": 4,
       "d": 16,
       "cap": 7163389383483685,
       "sec": 2
      },
      {
       "s": 4,
       "d": 17,
       "cap": 7541616342931624,
       "sec": 2
      },
      {
       "s": 5,
       "d": 0,
       "cap": 70119857578.73518,
       "sec": 3
      },
      {
       "s": 5,
       "d": 1,
       "cap": 70119857578.73518,
       "sec": 4
      },
      {
       "s": 5,
       "d": 2,
       "cap": 70119852728.89062,
       "sec": 3
      },
      {
       "s": 5,
       "d": 3,
       "cap": 70119852728.89062,
       "sec": 3
      },
      {
       "s": 5,
       "d": 4,
       "cap": 70119876978.11607,
       "sec": 3
      },
      {
       "s": 5,
       "d": 5,
       "cap": 70119857578.73515,
       "sec": 3
      },
      {
       "s": 5,
       "d": 6,
       "cap": 70119876978.11607,
       "sec": 3
      },
      {
       "s": 5,
       "d": 7,
       "cap": 70119852728.89062,
       "sec": 3
      },
      {
       "s": 5,
       "d": 8,
       "cap": 70119876978.11606,
       "sec": 4
      },
      {
       "s": 5,
       "d": 9,
       "cap": 17811703543.32785,
       "sec": 3
      },
      {
       "s": 5,
       "d": 10,
       "cap": 7751123503.032524,
       "sec": 3
      },
      {
       "s": 5,
       "d": 11,
       "cap": 7930547658.195314,
       "sec": 3
      },
      {
       "s": 5,
       "d": 12,
       "cap": 4711537138.750554,
       "sec": 3
      },
      {
       "s": 5,
       "d": 13,
       "cap": 4711537138.750554,
       "sec": 3
      },
      {
       "s": 5,
       "d": 14,
       "cap": 4882655501.832931,
       "sec": 3
      },
      {
       "s": 5,
       "d": 15,
       "cap": 4537347474.829187,
       "sec": 3
      },
      {
       "s": 5,
       "d": 16,
       "cap": 4702879180.853081,
       "sec": 3
      },
      {
       "s": 5,
       "d": 17,
       "cap": 4951191201.602124,
       "sec": 3
      },
      {
       "s": 6,
       "d": 0,
       "cap": 116866341811.95047,
       "sec": 3
      },
      {
       "s": 6,
       "d": 1,
       "cap": 116866341811.95047,
       "sec": 4
      },
      {
       "s": 6,
       "d": 2,
       "cap": 116866333728.88223,
       "sec": 3
      },
      {
       "s": 6,
       "d": 3,
       "cap": 116866333728.88225,
       "sec": 3
      },
      {
       "s": 6,
       "d": 4,
       "cap": 116866374144.22772,
       "sec": 3
      },
      {
       "s": 6,
       "d": 5,
       "cap": 116866341811.9504,
       "sec": 3
      },
      {
       "s": 6,
       "d": 6,
       "cap": 116866374144.22772,
       "sec": 3
      },
      {
       "s": 6,
       "d": 7,
       "cap": 116866333728.88225,
       "sec": 3
      },
      {
       "s": 6,
       "d": 8,
       "cap": 116866374144.2277,
       "sec": 4
      },
      {
       "s": 6,
       "d": 9,
       "cap": 29686150349.21223,
       "sec": 3
      },
      {
       "s": 6,
       "d": 10,
       "cap": 12918529500.932014,
       "sec": 3
      },
      {
       "s": 6,
       "d": 11,
       "cap": 13217569535.675812,
       "sec": 3
      },
      {
       "s": 6,
       "d": 12,
       "cap": 7852556019.507723,
       "sec": 3
      },
      {
       "s": 6,
       "d": 13,
       "cap": 7852556019.507724,
       "sec": 3
      },
      {
       "s": 6,
       "d": 14,
       "cap": 8137753077.81366,
       "sec": 3
      },
      {
       "s": 6,
       "d": 15,
       "cap": 7562240130.302086,
       "sec": 3
      },
      {
       "s": 6,
       "d": 16,
       "cap": 7838126100.480815,
       "sec": 3
      },
      {
       "s": 6,
       "d": 17,
       "cap": 8251979158.586203,
       "sec": 3
      },
      {
       "s": 7,
       "d": 0,
       "cap": 41467415954204.17,
       "sec": 4
      },
      {
       "s": 7,
       "d": 1,
       "cap": 41467415954204.17,
       "sec": 4
      },
      {
       "s": 7,
       "d": 2,
       "cap": 41467413086107.62,
       "sec": 4
      },
      {
       "s": 7,
       "d": 3,
       "cap": 41467413086107.62,
       "sec": 4
      },
      {
       "s": 7,
       "d": 4,
       "cap": 41467427426591.94,
       "sec": 4
      },
      {
       "s": 7,
       "d": 5,
       "cap": 41467415954204.14,
       "sec": 4
      },
      {
       "s": 7,
       "d": 6,
       "cap": 41467427426591.94,
       "sec": 4
      },
      {
       "s": 7,
       "d": 7,
       "cap": 41467413086107.62,
       "sec": 4
      },
      {
       "s": 7,
       "d": 8,
       "cap": 41467427426591.93,
       "sec": 4
      },
      {
       "s": 7,
       "d": 9,
       "cap": 10533468623418.031,
       "sec": 4
      },
      {
       "s": 7,
       "d": 10,
       "cap": 4583852185548.827,
       "sec": 3
      },
      {
       "s": 7,
       "d": 11,
       "cap": 4689959875029.124,
       "sec": 3
      },
      {
       "s": 7,
       "d": 12,
       "cap": 2786304437325.332,
       "sec": 4
      },
      {
       "s": 7,
       "d": 13,
       "cap": 2786304437325.3325,
       "sec": 4
      },
      {
       "s": 7,
       "d": 14,
       "cap": 2887500255234.2856,
       "sec": 4
      },
      {
       "s": 7,
       "d": 15,
       "cap": 2683292316391.6914,
       "sec": 4
      },
      {
       "s": 7,
       "d": 16,
       "cap": 2781184302261.6616,
       "sec": 4
      },
      {
       "s": 7,
       "d": 17,
       "cap": 2928030833421.077,
       "sec": 4
      },
      {
       "s": 8,
       "d": 0,
       "cap": 10582689595339.354,
       "sec": 0
      },
      {
       "s": 8,
       "d": 1,
       "cap": 10582689595339.354,
       "sec": 3
      },
      {
       "s": 8,
       "d": 2,
       "cap": 10582688863386.932,
       "sec": 0
      },
      {
       "s": 8,
       "d": 3,
       "cap": 10582688863386.934,
       "sec": 0
      },
      {
       "s": 8,
       "d": 4,
       "cap": 10582692523149.44,
       "sec": 0
      },
      {
       "s": 8,
       "d": 5,
       "cap": 10582689595339.35,
       "sec": 0
      },
      {
       "s": 8,
       "d": 6,
       "cap": 10582692523149.44,
       "sec": 0
      },
      {
       "s": 8,
       "d": 7,
       "cap": 10582688863386.934,
       "sec": 0
      },
      {
       "s": 8,
       "d": 8,
       "cap": 10582692523149.438,
       "sec": 3
      },
      {
       "s": 8,
       "d": 9,
       "cap": 2688193277511.8564,
       "sec": 0
      },
      {
       "s": 8,
       "d": 10,
       "cap": 1169821743514.3318,
       "sec": 0
      },
      {
       "s": 8,
       "d": 11,
       "cap": 1196900950540.1265,
       "sec": 0
      },
      {
       "s": 8,
       "d": 12,
       "cap": 711078669837.906,
       "sec": 0
      },
      {
       "s": 8,
       "d": 13,
       "cap": 711078669837.9062,
       "sec": 0
      },
      {
       "s": 8,
       "d": 14,
       "cap": 736904342950.9751,
       "sec": 0
      },
      {
       "s": 8,
       "d": 15,
       "cap": 684789467211.8679,
       "sec": 0
      },
      {
       "s": 8,
       "d": 16,
       "cap": 709771986052.1385,
       "sec": 0
      },
      {
       "s": 8,
       "d": 17,
       "cap": 747247946915.6914,
       "sec": 0
      },
      {
       "s": 9,
       "d": 9,
       "cap": 239099537689744030,
       "sec": 3
      },
      {
       "s": 9,
       "d": 0,
       "cap": 239099537689744030,
       "sec": 3
      },
      {
       "s": 9,
       "d": 5,
       "cap": 239099537689744030,
       "sec": 3
      },
      {
       "s": 9,
       "d": 2,
       "cap": 239099537689744030,
       "sec": 3
      },
      {
       "s": 9,
       "d": 3,
       "cap": 239099537689744030,
       "sec": 3
      },
      {
       "s": 9,
       "d": 1,
       "cap": 239099537689744030,
       "sec": 4
      },
      {
       "s": 9,
       "d": 7,
       "cap": 239099537689744030,
       "sec": 3
      },
      {
       "s": 9,
       "d": 6,
       "cap": 239099537689744030,
       "sec": 3
      },
      {
       "s": 9,
       "d": 4,
       "cap": 239099537689744030,
       "sec": 3
      },
      {
       "s": 9,
       "d": 8,
       "cap": 239099537689744030,
       "sec": 4
      },
      {
       "s": 9,
       "d": 16,
       "cap": 239099537689744030,
       "sec": 3
      },
      {
       "s": 9,
       "d": 17,
       "cap": 239099537689744030,
       "sec": 3
      },
      {
       "s": 9,
       "d": 10,
       "cap": 239099537689744030,
       "sec": 3
      },
      {
       "s": 9,
       "d": 11,
       "cap": 239099537689744030,
       "sec": 3
      },
      {
       "s": 9,
       "d": 14,
       "cap": 239099537689744030,
       "sec": 3
      },
      {
       "s": 9,
       "d": 15,
       "cap": 239099537689744030,
       "sec": 3
      },
      {
       "s": 9,
       "d": 12,
       "cap": 239099537689744030,
       "sec": 3
      },
      {
       "s": 9,
       "d": 13,
       "cap": 239099537689744030,
       "sec": 3
      },
      {
       "s": 9,
       "d": 18,
       "cap": 967203328522026900000,
       "sec": -1
      }
     ]
    },
    "speedReference": {
     "version": 1,
     "key": "arc170",
     "status": "published",
     "mglt": 100,
     "model": "Aggressive ReConnaissance-170 starfighter",
     "scope": "class",
     "continuity": "canon",
     "source": "https://starwars.fandom.com/wiki/Megalight_per_hour"
    },
    "mglt": 100,
    "maxSpeed": 2000
   },
   "fireArcs": [
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      -1,
      0
     ],
     "pos": [
      10.55,
      0.16249999999999998,
      9.5355
     ],
     "k": "claserH",
     "gun": 0.19999999991999998,
     "aa": 0.2,
     "cycle": 0.18
    },
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      -1,
      0
     ],
     "pos": [
      10.55,
      0.16249999999999998,
      -9.5355
     ],
     "k": "claserH",
     "gun": 0.19999999991999998,
     "aa": 0.2,
     "cycle": 0.18
    },
    {
     "fixed": false,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      1,
      0
     ],
     "pos": [
      2.5875,
      3.635,
      0
     ],
     "k": "cturret",
     "gun": 0.30000000008,
     "aa": 0.3,
     "cycle": 0.12
    },
    {
     "fixed": false,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      -1,
      0
     ],
     "pos": [
      2.5875,
      1.24,
      0
     ],
     "k": "cturret",
     "gun": 0.30000000008,
     "aa": 0.3,
     "cycle": 0.12
    }
   ]
  },
  "awing": {
   "reference": "craft_awing",
   "signature": "768hwc",
   "build": 159914,
   "crew": 1000,
   "total": 160914,
   "by": {
    "hull": 9,
    "armor": 3,
    "power": 22512,
    "drive": 51588,
    "defense": 25501,
    "command": 14501,
    "weapons": 21800,
    "systems": 24000,
    "crew": 1000
   },
   "detailed": true,
   "systems": {
    "v": 1,
    "managed": true,
    "power": 14072043900000000,
    "crew": 1,
    "suitSeats": 0,
    "lifeSupportCapacity": 1,
    "lifeSupportHours": 12.15672,
    "ejectionSeats": 1,
    "ejectionCoverage": 1,
    "ejectionSurvival": 0.9,
    "navCapacity": 1.331,
    "navReady": true,
    "targetDemand": 4,
    "targetCapacity": 4.920750000000001,
    "targetRatio": 1,
    "fireK": 1,
    "maneuverSupport": 23.328,
    "maneuverRatio": 1,
    "turnK": 1,
    "laserUnits": 2,
    "laserGunShare": 1,
    "laserAaShare": 1,
    "laserGasSeconds": 658.5600000000002,
    "landingSupport": 14.0625,
    "landingRatio": 1,
    "landingReady": true
   },
   "heat": {
    "up": 2.11e-7,
    "upS": 2.11e-7,
    "down": 0.0404,
    "T": 0
   },
   "powerProfile": {
    "name": "RZ-1 Aウイング",
    "modules": [
     {
      "k": "weapon",
      "fit": 25,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.434,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": 0.02,
      "z": 0.9,
      "r": 0.189,
      "share": 0.5,
      "domain": "main",
      "port": "f25",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 26,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.434,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": 0.02,
      "z": -0.9,
      "r": 0.189,
      "share": 0.5,
      "domain": "main",
      "port": "f26",
      "powerConnected": true
     },
     {
      "k": "launcher",
      "fit": 27,
      "name": "ミサイル発射管",
      "w": 1.0368000000000002,
      "hits": 1,
      "crew": 0,
      "size": 1,
      "stock": 6,
      "mount": "ext",
      "missileKind": "cmsl",
      "launcherCells": 1,
      "ammoPerCell": 6,
      "missileRange": 10000,
      "launchMuzzles": [
       [
        1.906999952428043,
        -0.7796452211129877,
        0.7989999999999999
       ],
       [
        1.906999952428043,
        -0.7796452211129877,
        0.601
       ]
      ],
      "launchBlocked": false,
      "salvo": 1,
      "cycle": 1.2,
      "tt": 25,
      "ammo0": 6,
      "muzzle": [
       1.906999952428043,
       -0.7796452211129877,
       0.7
      ],
      "launchDir": [
       1,
       0,
       0
      ],
      "launchPowerW": 1000000000000000,
      "at": 0.688,
      "pd": false,
      "dualPurpose": false,
      "y": -0.46,
      "z": 0.28,
      "r": 0.087,
      "share": 0.5,
      "domain": "main",
      "port": "f27",
      "powerConnected": true
     },
     {
      "k": "launcher",
      "fit": 28,
      "name": "ミサイル発射管",
      "w": 1.0368000000000002,
      "hits": 1,
      "crew": 0,
      "size": 1,
      "stock": 6,
      "mount": "ext",
      "missileKind": "cmsl",
      "launcherCells": 1,
      "ammoPerCell": 6,
      "missileRange": 10000,
      "launchMuzzles": [
       [
        1.906999952428043,
        -0.7796452211129877,
        -0.601
       ],
       [
        1.906999952428043,
        -0.7796452211129877,
        -0.7989999999999999
       ]
      ],
      "launchBlocked": false,
      "salvo": 1,
      "cycle": 1.2,
      "tt": 25,
      "ammo0": 6,
      "muzzle": [
       1.906999952428043,
       -0.7796452211129877,
       -0.7
      ],
      "launchDir": [
       1,
       0,
       0
      ],
      "launchPowerW": 1000000000000000,
      "at": 0.688,
      "pd": false,
      "dualPurpose": false,
      "y": -0.46,
      "z": -0.28,
      "r": 0.087,
      "share": 0.5,
      "domain": "main",
      "port": "f28",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "核融合炉",
      "w": 1.2192896366161472,
      "hits": 1,
      "crew": 0.0006731786412155064,
      "size": 1.3463572824310128,
      "at": 0.289,
      "part": 14,
      "y": -0.03,
      "z": 0,
      "r": 0.08,
      "share": 1,
      "domain": "main",
      "port": "p14",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "右舷主推進機関",
      "w": 1.3127013700754067,
      "hits": 1,
      "crew": 0.000601601484314035,
      "size": 1.5040037107850872,
      "at": 0.272,
      "part": 15,
      "y": -0.13,
      "z": 0.48,
      "r": 0.083,
      "share": 0.47789380376116397,
      "domain": "main",
      "port": "p15",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "右舷主推進機関",
      "w": 1.3127013700754067,
      "hits": 1,
      "crew": 0.000601601484314035,
      "size": 1.5040037107850872,
      "at": 0.272,
      "part": 16,
      "y": -0.13,
      "z": -0.48,
      "r": 0.083,
      "share": 0.47789380376116397,
      "domain": "main",
      "port": "p16",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "操縦席",
      "w": 0.5498464214566077,
      "hits": 1,
      "crew": 0,
      "size": 0.4077200833730881,
      "at": 0.514,
      "part": 17,
      "y": 0.04,
      "z": 0,
      "r": 0.054,
      "share": 0.5842216798061506,
      "domain": "main",
      "port": "p17",
      "powerConnected": true
     },
     {
      "k": "shield",
      "name": "偏向シールド発生器",
      "w": 0.13746160536415195,
      "hits": 1,
      "crew": 0.00002038600416865441,
      "size": 0.050965010421636016,
      "at": 0.623,
      "part": 18,
      "y": -0.12,
      "z": 0.42,
      "r": 0.027,
      "share": 0.5,
      "domain": "main",
      "port": "p18",
      "powerConnected": true
     },
     {
      "k": "shield",
      "name": "偏向シールド発生器",
      "w": 0.13746160536415195,
      "hits": 1,
      "crew": 0.00002038600416865441,
      "size": 0.050965010421636016,
      "at": 0.623,
      "part": 19,
      "y": -0.12,
      "z": -0.42,
      "r": 0.027,
      "share": 0.5,
      "domain": "main",
      "port": "p19",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "右舷慣性補償装置",
      "w": 0.10769650179907586,
      "hits": 1,
      "crew": 0.000007068583470577035,
      "size": 0.035342917352885174,
      "at": 0.666,
      "part": 20,
      "y": -0.13,
      "z": 0.22,
      "r": 0.024,
      "share": 0.05064282920362862,
      "domain": "main",
      "port": "p20",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "左舷慣性補償装置",
      "w": 0.10769650179907586,
      "hits": 1,
      "crew": 0.000007068583470577035,
      "size": 0.035342917352885174,
      "at": 0.666,
      "part": 21,
      "y": -0.13,
      "z": -0.22,
      "r": 0.024,
      "share": 0.05064282920362862,
      "domain": "main",
      "port": "p21",
      "powerConnected": true
     },
     {
      "k": "fuel",
      "name": "反応物タンク",
      "w": 0.13560434437211016,
      "hits": 1,
      "crew": 0.000009987123045761957,
      "size": 0.04993561522880978,
      "at": 0.666,
      "part": 22,
      "y": -0.13,
      "z": 0,
      "r": 0.027,
      "share": 1,
      "domain": "main",
      "port": "p22",
      "powerConnected": true
     },
     {
      "k": "hyper",
      "name": "ハイパードライブ",
      "w": 0.18118016807540183,
      "hits": 1,
      "crew": 0.000023135944938096667,
      "size": 0.07711981646032223,
      "at": 0.775,
      "part": 23,
      "y": -0.13,
      "z": 0,
      "r": 0.031,
      "share": 1,
      "domain": "main",
      "port": "p23",
      "powerConnected": true
     },
     {
      "k": "battery",
      "name": "パワーセル",
      "w": 0.06760000000000001,
      "hits": 1,
      "crew": 0.0000035152000000000002,
      "size": 0.017576,
      "at": 0.862,
      "part": 24,
      "y": -0.13,
      "z": 0,
      "r": 0.019,
      "share": 1,
      "domain": "main",
      "port": "p24",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "生命維持装置",
      "w": 0.13690000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.050653,
      "at": 0.695,
      "part": 29,
      "y": -0.13,
      "z": -0.1,
      "r": 0.027,
      "share": 0.07258063056987549,
      "domain": "main",
      "port": "p29",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "射出座席機構 1",
      "w": 0.08410000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.024388999999999997,
      "at": 0.455,
      "part": 30,
      "y": -0.33,
      "z": -0.16,
      "r": 0.021,
      "share": 0.03494697251828506,
      "domain": "main",
      "port": "p30",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "航法コンピューター",
      "w": 0.048400000000000006,
      "hits": 1,
      "crew": 0,
      "size": 0.010648,
      "at": 0.695,
      "part": 31,
      "y": 0.09,
      "z": 0,
      "r": 0.016,
      "share": 0.015257508031272267,
      "domain": "main",
      "port": "p31",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "照準コンピューター",
      "w": 0.07290000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.019683000000000003,
      "at": 0.668,
      "part": 32,
      "y": 0.09,
      "z": 0,
      "r": 0.02,
      "share": 0.02820375005442638,
      "domain": "main",
      "port": "p32",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 1",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.695,
      "part": 33,
      "y": 0.09,
      "z": -0.05,
      "r": 0.013,
      "share": 0.008356666682793,
      "domain": "main",
      "port": "p33",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 2",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.695,
      "part": 34,
      "y": 0.09,
      "z": 0.05,
      "r": 0.013,
      "share": 0.008356666682793,
      "domain": "main",
      "port": "p34",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 3",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.713,
      "part": 35,
      "y": 0.09,
      "z": 0,
      "r": 0.013,
      "share": 0.008356666682793,
      "domain": "main",
      "port": "p35",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 4",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.677,
      "part": 36,
      "y": 0.09,
      "z": -0.05,
      "r": 0.013,
      "share": 0.008356666682793,
      "domain": "main",
      "port": "p36",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 1",
      "w": 0.07840000000000003,
      "hits": 1,
      "crew": 0,
      "size": 0.021952000000000006,
      "at": 0.638,
      "part": 37,
      "y": 0.09,
      "z": 0,
      "r": 0.02,
      "share": 0.03145499777446365,
      "domain": "main",
      "port": "p37",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 2",
      "w": 0.07840000000000003,
      "hits": 1,
      "crew": 0,
      "size": 0.021952000000000006,
      "at": 0.638,
      "part": 38,
      "y": 0.09,
      "z": -0.08,
      "r": 0.02,
      "share": 0.03145499777446365,
      "domain": "main",
      "port": "p38",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 1",
      "w": 0.06250000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.015625,
      "at": 0.67,
      "part": 39,
      "y": 0.09,
      "z": 0.07,
      "r": 0.018,
      "share": 0.022389046110878025,
      "domain": "main",
      "port": "p39",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 2",
      "w": 0.06250000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.015625,
      "at": 0.721,
      "part": 40,
      "y": -0.06,
      "z": 0,
      "r": 0.018,
      "share": 0.022389046110878025,
      "domain": "main",
      "port": "p40",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 3",
      "w": 0.06250000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.015625,
      "at": 0.721,
      "part": 41,
      "y": -0.06,
      "z": 0.07,
      "r": 0.018,
      "share": 0.022389046110878025,
      "domain": "main",
      "port": "p41",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 1",
      "w": 0.1856634815774367,
      "hits": 1,
      "crew": 0.000003999997680738102,
      "size": 0.07999995361476203,
      "at": 0.736,
      "part": 42,
      "y": -0.15,
      "z": 0.23,
      "r": 0.031,
      "share": 0.4565697400073992,
      "domain": "main",
      "port": "p42",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 2",
      "w": 0.18566348157743673,
      "hits": 1,
      "crew": 0.000003999997680738102,
      "size": 0.07999995361476205,
      "at": 0.777,
      "part": 43,
      "y": -0.15,
      "z": -0.23,
      "r": 0.031,
      "share": 0.45656974000739925,
      "domain": "main",
      "port": "p43",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 3",
      "w": 0.061414373200031167,
      "hits": 1,
      "crew": 7.609831489990585e-7,
      "size": 0.015219662979981168,
      "at": 0.602,
      "part": 44,
      "y": -0.18,
      "z": 0,
      "r": 0.018,
      "share": 0.08686051998520161,
      "domain": "main",
      "port": "p44",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.1691561087386909,
      "hits": 1,
      "crew": 0.000013914305192024975,
      "size": 0.06957152596012486,
      "at": 0.478,
      "part": -15,
      "machineryOwner": 15,
      "y": -0.13,
      "z": 0.48,
      "r": 0.03,
      "share": 0.02210619623883597,
      "domain": "main",
      "port": "p15",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.1691561087386909,
      "hits": 1,
      "crew": 0.000013914305192024975,
      "size": 0.06957152596012486,
      "at": 0.478,
      "part": -16,
      "machineryOwner": 16,
      "y": -0.13,
      "z": -0.48,
      "r": 0.03,
      "share": 0.02210619623883597,
      "domain": "main",
      "port": "p16",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p14 → p15",
      "w": 0.00814997927355753,
      "hits": 1,
      "crew": 1.4715151985679635e-7,
      "size": 0.0007357575992839817,
      "at": 0.386,
      "part": -6000000,
      "routeId": "p14>p15",
      "capacityW": 535931956912702000,
      "y": -0.11,
      "z": 0.38,
      "r": 0.007,
      "share": 0.5,
      "domain": "main",
      "port": "p-6000000",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p14 → p16",
      "w": 0.00814997927355753,
      "hits": 1,
      "crew": 1.4715151985679635e-7,
      "size": 0.0007357575992839817,
      "at": 0.386,
      "part": -6000001,
      "routeId": "p14>p16",
      "capacityW": 535931956912702000,
      "y": -0.11,
      "z": -0.38,
      "r": 0.007,
      "share": 0.5,
      "domain": "main",
      "port": "p-6000001",
      "powerConnected": true
     },
     {
      "k": "quarters",
      "name": "居住空間（後部）",
      "w": 0.20132583787004057,
      "hits": 1,
      "crew": 0,
      "size": 1.554935519221231,
      "at": 0.177,
      "y": -0.05,
      "z": 0,
      "r": 0.084,
      "share": 0.15987590486039296,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央後部）",
      "w": 0.35317021857384995,
      "hits": 1,
      "crew": 0,
      "size": 3.6127609217611005,
      "at": 0.396,
      "y": -0.07,
      "z": 0,
      "r": 0.111,
      "share": 0.3714581178903826,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央前部）",
      "w": 0.3508065473727578,
      "hits": 1,
      "crew": 0,
      "size": 3.5765528501621593,
      "at": 0.602,
      "y": -0.14,
      "z": 0,
      "r": 0.111,
      "share": 0.3677352637021717,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（前部）",
      "w": 0.14815844137447812,
      "hits": 1,
      "crew": 0,
      "size": 0.9816410522379828,
      "at": 0.837,
      "y": -0.12,
      "z": 0.02,
      "r": 0.072,
      "share": 0.10093071354705273,
      "domain": "main"
     },
     {
      "k": "hull",
      "name": "船体構造",
      "w": 7.197992449540841,
      "hits": null,
      "crew": 0,
      "size": 1,
      "share": 1,
      "domain": "main"
     }
    ],
    "energyModel": {
     "version": 0,
     "eta": 0.75
    },
    "D": 0.0006145326660321643,
    "shieldBuffer": 0.014246437348554762,
    "wCap": 0,
    "crewNeed": 1,
    "crewMax": 1,
    "hp": 1,
    "len": 6.890000095590949,
    "width": 4.957405736643938,
    "height": 2.3886074314359576,
    "grid": {
     "P": 7050878085363967000,
     "fixed": 45909029962639230,
     "cooling": 27528766186483590,
     "De": 1071863913825404000,
     "Ds": 2571204674678575600,
     "Dw": 139466666666666.69,
     "domains": [
      {
       "id": "main",
       "P": 7050878085363967000,
       "reactors": [
        4
       ],
       "sources": [
        {
         "moduleIndex": 4,
         "P": 7050878085363967000
        }
       ],
       "modules": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36,
        37,
        38,
        39
       ],
       "protection": 1
      }
     ],
     "powerPaths": [
      {
       "kind": "power",
       "from": "p14",
       "to": "hotel",
       "cap": 45909029962639230,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p17",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p20",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p21",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p22",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p23",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p24",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p29",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p30",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p31",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p32",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p33",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p34",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p35",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p36",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p37",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p38",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p39",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p40",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p41",
       "cap": 2086774089210874.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p18",
       "cap": 29803546933176560000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p19",
       "cap": 29803546933176560000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "f25",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "f26",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "f27",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "f28",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p42",
       "cap": 12568801620487296,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p43",
       "cap": 12568801620487298,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p44",
       "cap": 2391162945509000.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p-6000000",
       "cap": 535931956912702000,
       "auto": false,
       "ok": true,
       "capacityGroup": "p14>p15",
       "groupCap": 535931956912702000,
       "physical": true,
       "routeId": "p14>p15",
       "efficiency": 0.9999862715305671
      },
      {
       "kind": "power",
       "from": "p-6000000",
       "to": "p15",
       "cap": 535931956912702000,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p14>p15",
       "efficiency": 1
      },
      {
       "kind": "power",
       "from": "p14",
       "to": "p-6000001",
       "cap": 535931956912702000,
       "auto": false,
       "ok": true,
       "capacityGroup": "p14>p16",
       "groupCap": 535931956912702000,
       "physical": true,
       "routeId": "p14>p16",
       "efficiency": 0.9999862715305671
      },
      {
       "kind": "power",
       "from": "p-6000001",
       "to": "p16",
       "cap": 535931956912702000,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p14>p16",
       "efficiency": 1
      }
     ],
     "trunks": [
      {
       "port": "p-6000000",
       "moduleIndex": 33
      },
      {
       "port": "p-6000001",
       "moduleIndex": 34
      }
     ],
     "fixedLoads": [
      {
       "id": "hotel",
       "port": "hotel",
       "weight": 16380263776155640,
       "domain": "main"
      },
      {
       "id": "f27",
       "port": "f27",
       "domain": "main",
       "weight": 1000000000000000
      },
      {
       "id": "f28",
       "port": "f28",
       "domain": "main",
       "weight": 1000000000000000
      }
     ],
     "coolingLoads": [
      {
       "id": "p42",
       "port": "p42",
       "weight": 12568801620487296,
       "domain": "main"
      },
      {
       "id": "p43",
       "port": "p43",
       "weight": 12568801620487298,
       "domain": "main"
      },
      {
       "id": "p44",
       "port": "p44",
       "weight": 2391162945509000.5,
       "domain": "main"
      }
     ]
    },
    "propulsion": {
     "version": 1,
     "architectureVersion": 2,
     "cores": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 23654318826442468,
       "densityFactor": 22.656833233920878,
       "efficiency": 0.4561076424918548,
       "wasteFraction": 0.5438923575081451,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 4165683323.392088,
       "ratedShaftPowerW": 244442661403498800,
       "ratedWasteHeatW": 291489295509203140,
       "thermalStoreJ": 70962956479327410,
       "version": 1,
       "id": 15,
       "machineryId": 15,
       "coreId": 15,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 535931956912702000,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 128654032.31763096,
       "effectiveMachineryVolumeM3": 0.0695715259601249,
       "machineryVolumeM3": 0.0695715259601249,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.3045,
       "machineryDiameterM": 0.609,
       "machineryOffsetM": 1.265,
       "maxInputW": 2365431882644246500,
       "maxRatedInputW": 2365431882644246500,
       "inputDensityWPerM3": 7703323299533099000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 2287.874454360359,
       "powerNode": "p15",
       "heatNode": "p15",
       "reactorId": 14,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 5,
       "machineryModuleIndex": 31,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 535924599387213440,
       "transmissionRouteIds": [
        "p14>p15"
       ]
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 23654318826442468,
       "densityFactor": 22.656833233920878,
       "efficiency": 0.4561076424918548,
       "wasteFraction": 0.5438923575081451,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 4165683323.392088,
       "ratedShaftPowerW": 244442661403498800,
       "ratedWasteHeatW": 291489295509203140,
       "thermalStoreJ": 70962956479327410,
       "version": 1,
       "id": 16,
       "machineryId": 16,
       "coreId": 16,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 535931956912702000,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 128654032.31763096,
       "effectiveMachineryVolumeM3": 0.0695715259601249,
       "machineryVolumeM3": 0.0695715259601249,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.3045,
       "machineryDiameterM": 0.609,
       "machineryOffsetM": 1.265,
       "maxInputW": 2365431882644246500,
       "maxRatedInputW": 2365431882644246500,
       "inputDensityWPerM3": 7703323299533099000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 2287.874454360359,
       "powerNode": "p16",
       "heatNode": "p16",
       "reactorId": 14,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 6,
       "machineryModuleIndex": 32,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 535924599387213440,
       "transmissionRouteIds": [
        "p14>p16"
       ]
      }
     ],
     "engines": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 23654318826442468,
       "densityFactor": 22.656833233920878,
       "efficiency": 0.4561076424918548,
       "wasteFraction": 0.5438923575081451,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 4165683323.392088,
       "ratedShaftPowerW": 244442661403498800,
       "ratedWasteHeatW": 291489295509203140,
       "thermalStoreJ": 70962956479327410,
       "version": 1,
       "id": 15,
       "machineryId": 15,
       "coreId": 15,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 535931956912702000,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 128654032.31763096,
       "effectiveMachineryVolumeM3": 0.0695715259601249,
       "machineryVolumeM3": 0.0695715259601249,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.3045,
       "machineryDiameterM": 0.609,
       "machineryOffsetM": 1.265,
       "maxInputW": 2365431882644246500,
       "maxRatedInputW": 2365431882644246500,
       "inputDensityWPerM3": 7703323299533099000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 2287.874454360359,
       "powerNode": "p15",
       "heatNode": "p15",
       "reactorId": 14,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 5,
       "coreModuleIndex": 5,
       "machineryModuleIndex": 31,
       "shaftModuleIndices": [],
       "shaftCapacityW": 244442661403498800,
       "ratedShaftCapacityW": 244442661403498800,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 535924599387213440
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 23654318826442468,
       "densityFactor": 22.656833233920878,
       "efficiency": 0.4561076424918548,
       "wasteFraction": 0.5438923575081451,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 4165683323.392088,
       "ratedShaftPowerW": 244442661403498800,
       "ratedWasteHeatW": 291489295509203140,
       "thermalStoreJ": 70962956479327410,
       "version": 1,
       "id": 16,
       "machineryId": 16,
       "coreId": 16,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 535931956912702000,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 128654032.31763096,
       "effectiveMachineryVolumeM3": 0.0695715259601249,
       "machineryVolumeM3": 0.0695715259601249,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.3045,
       "machineryDiameterM": 0.609,
       "machineryOffsetM": 1.265,
       "maxInputW": 2365431882644246500,
       "maxRatedInputW": 2365431882644246500,
       "inputDensityWPerM3": 7703323299533099000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 2287.874454360359,
       "powerNode": "p16",
       "heatNode": "p16",
       "reactorId": 14,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 6,
       "coreModuleIndex": 6,
       "machineryModuleIndex": 32,
       "shaftModuleIndices": [],
       "shaftCapacityW": 244442661403498800,
       "ratedShaftCapacityW": 244442661403498800,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 535924599387213440
      }
     ],
     "massKg": 10715.661375621272,
     "ratedThrustN": 257308064.63526192,
     "ratedAccelMps2": 24012.336300646093,
     "structuralAccelerationLimitMps2": 452325.1607968794,
     "inertialFactor": 1,
     "accelerationLimitMps2": 24012.336300646093
    },
    "profileVersion": 18,
    "heat": {
     "v": 3,
     "mode": "strict",
     "src": [
      {
       "k": "reactor",
       "id": "p14",
       "n": "核融合炉 #14",
       "g": "high",
       "sh": 1,
       "st": 10267231269179062000,
       "m": [
        4
       ],
       "pc": [],
       "sec": 1,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "shield",
       "id": "p18",
       "n": "シールド（艦首区画）",
       "g": "high",
       "sh": 1,
       "st": 69422526216321550000,
       "m": [
        8,
        9
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p15",
       "n": "右舷主推進機関 #15",
       "g": "high",
       "sh": 0.5,
       "st": 70962956479327410,
       "m": [
        5,
        31
       ],
       "pc": [],
       "sec": 1,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p16",
       "n": "右舷主推進機関 #16",
       "g": "high",
       "sh": 0.5,
       "st": 70962956479327410,
       "m": [
        6,
        32
       ],
       "pc": [],
       "sec": 1,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "feed",
       "id": "p-6000000",
       "n": "推進配電路 1",
       "g": "high",
       "sh": 0.5,
       "st": 441451529318400,
       "m": [
        33
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1,
       "routeId": "p14>p15"
      },
      {
       "k": "feed",
       "id": "p-6000001",
       "n": "推進配電路 2",
       "g": "high",
       "sh": 0.5,
       "st": 441451529318400,
       "m": [
        34
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1,
       "routeId": "p14>p16"
      },
      {
       "k": "weapon",
       "id": "f25",
       "n": "武装（中央区画）",
       "g": "high",
       "sh": 0.0651876,
       "st": 170465536582325.88,
       "m": [
        0,
        1
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "weapon",
       "id": "f27",
       "n": "武装（艦首区画）",
       "g": "high",
       "sh": 0.934812,
       "st": 2444534463417674.5,
       "m": [
        2,
        3
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "hotel",
       "id": "hotel",
       "n": "生活・電子設備",
       "g": "low",
       "sh": 1,
       "st": 2754541797758354000,
       "m": [],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1
      }
     ],
     "dis": [
      {
       "id": "p42",
       "n": "機体内高エネルギー散逸装置 1 #42",
       "k": "hdis",
       "g": "high",
       "cap": 837920108032486400,
       "m": 28,
       "sec": 4,
       "src": -1,
       "power": 12568801620487296
      },
      {
       "id": "p43",
       "n": "機体内高エネルギー散逸装置 2 #43",
       "k": "hdis",
       "g": "high",
       "cap": 837920108032486500,
       "m": 29,
       "sec": 4,
       "src": -1,
       "power": 12568801620487298
      },
      {
       "id": "p44",
       "n": "機体内高エネルギー散逸装置 3 #44",
       "k": "hdis",
       "g": "high",
       "cap": 159410863033933380,
       "m": 30,
       "sec": 4,
       "src": -1,
       "power": 2391162945509000.5
      },
      {
       "id": "skin",
       "n": "外殻からの放熱",
       "k": "skin",
       "g": "low",
       "cap": 192840350600893170000,
       "m": -1,
       "sec": -1,
       "src": -1
      }
     ],
     "ln": [
      {
       "s": 0,
       "d": 0,
       "cap": 93754906338415360,
       "sec": 3
      },
      {
       "s": 0,
       "d": 1,
       "cap": 93754906338415380,
       "sec": 3
      },
      {
       "s": 0,
       "d": 2,
       "cap": 17836486306750548,
       "sec": 2
      },
      {
       "s": 1,
       "d": 0,
       "cap": 633924494904855700,
       "sec": 4
      },
      {
       "s": 1,
       "d": 1,
       "cap": 633924494904855800,
       "sec": 4
      },
      {
       "s": 1,
       "d": 2,
       "cap": 120601534516719630,
       "sec": 4
      },
      {
       "s": 2,
       "d": 0,
       "cap": 159700037771506020,
       "sec": 3
      },
      {
       "s": 2,
       "d": 1,
       "cap": 159700037771506020,
       "sec": 3
      },
      {
       "s": 2,
       "d": 2,
       "cap": 30382277025771670,
       "sec": 2
      },
      {
       "s": 3,
       "d": 0,
       "cap": 159700037771506020,
       "sec": 3
      },
      {
       "s": 3,
       "d": 1,
       "cap": 159700037771506020,
       "sec": 3
      },
      {
       "s": 3,
       "d": 2,
       "cap": 30382277025771670,
       "sec": 2
      },
      {
       "s": 4,
       "d": 0,
       "cap": 4031068199335.413,
       "sec": 3
      },
      {
       "s": 4,
       "d": 1,
       "cap": 4031068199335.4136,
       "sec": 3
      },
      {
       "s": 4,
       "d": 2,
       "cap": 766894187697.1741,
       "sec": 3
      },
      {
       "s": 5,
       "d": 0,
       "cap": 4031068199335.413,
       "sec": 3
      },
      {
       "s": 5,
       "d": 1,
       "cap": 4031068199335.4136,
       "sec": 3
      },
      {
       "s": 5,
       "d": 2,
       "cap": 766894187697.1741,
       "sec": 3
      },
      {
       "s": 6,
       "d": 0,
       "cap": 1556588114352.2866,
       "sec": 3
      },
      {
       "s": 6,
       "d": 1,
       "cap": 1556588114352.2869,
       "sec": 4
      },
      {
       "s": 6,
       "d": 2,
       "cap": 296134502941.9447,
       "sec": 3
      },
      {
       "s": 7,
       "d": 0,
       "cap": 22322009288034.695,
       "sec": 4
      },
      {
       "s": 7,
       "d": 1,
       "cap": 22322009288034.703,
       "sec": 4
      },
      {
       "s": 7,
       "d": 2,
       "cap": 4246670692284.1006,
       "sec": 4
      },
      {
       "s": 8,
       "d": 2,
       "cap": 68863544943958850,
       "sec": 3
      },
      {
       "s": 8,
       "d": 0,
       "cap": 68863544943958850,
       "sec": 4
      },
      {
       "s": 8,
       "d": 1,
       "cap": 68863544943958850,
       "sec": 4
      },
      {
       "s": 8,
       "d": 3,
       "cap": 192840350600893170000,
       "sec": -1
      }
     ]
    },
    "speedReference": {
     "version": 1,
     "key": "awing",
     "status": "published",
     "mglt": 120,
     "model": "RZ-1 A-wing interceptor",
     "scope": "class",
     "continuity": "canon",
     "source": "https://starwars.fandom.com/wiki/Megalight_per_hour"
    },
    "mglt": 120,
    "maxSpeed": 2400
   },
   "fireArcs": [
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      0.9510565162951535,
      0.30901699437494745
     ],
     "pos": [
      4.3,
      1.3884726735840445,
      2.286979650434751
     ],
     "k": "claser",
     "gun": 0.5,
     "aa": 0.5,
     "cycle": 0.12
    },
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      0.9510565162951535,
      -0.30901699437494745
     ],
     "pos": [
      4.3,
      1.3884726735840445,
      -2.286979650434751
     ],
     "k": "claser",
     "gun": 0.5,
     "aa": 0.5,
     "cycle": 0.12
    }
   ]
  },
  "btlb": {
   "reference": "craft_btlb",
   "signature": "18637kd",
   "build": 205192,
   "crew": 2000,
   "total": 207192,
   "by": {
    "hull": 60,
    "armor": 21,
    "power": 63454,
    "drive": 52449,
    "defense": 15004,
    "command": 20503,
    "weapons": 36700,
    "systems": 17001,
    "crew": 2000
   },
   "detailed": true,
   "systems": {
    "v": 1,
    "managed": true,
    "power": 38694697800000000,
    "crew": 2,
    "suitSeats": 0,
    "lifeSupportCapacity": 2,
    "lifeSupportHours": 12.458759999999998,
    "ejectionSeats": 2,
    "ejectionCoverage": 1,
    "ejectionSurvival": 0.9,
    "navCapacity": 2.331,
    "navReady": true,
    "targetDemand": 6,
    "targetCapacity": 7.44775,
    "targetRatio": 1,
    "fireK": 1,
    "maneuverSupport": 70.304,
    "maneuverRatio": 1,
    "turnK": 1,
    "laserUnits": 4,
    "laserGunShare": 1,
    "laserAaShare": 1,
    "laserGasSeconds": 643.1249999999999,
    "landingSupport": 66.6792,
    "landingRatio": 1,
    "landingReady": true
   },
   "heat": {
    "up": 9.34e-7,
    "upS": 9.34e-7,
    "down": 0.0321,
    "T": 0
   },
   "powerProfile": {
    "name": "BTL-B Yウイング・スターファイター",
    "modules": [
     {
      "k": "weapon",
      "fit": 21,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.941,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": 0.13,
      "z": 0.1,
      "r": 0.055,
      "share": 0.36363636330578514,
      "domain": "main",
      "port": "f21",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 22,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.941,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": 0.13,
      "z": -0.1,
      "r": 0.055,
      "share": 0.36363636330578514,
      "domain": "main",
      "port": "f22",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 23,
      "name": "旋回砲塔",
      "w": 2.028,
      "hits": 1,
      "crew": 0,
      "size": 0.750000004,
      "weaponPowerW": 139466666666666.69,
      "stock": 0,
      "at": 0.756,
      "pd": false,
      "dualPurpose": true,
      "band": "close",
      "y": 0.66,
      "z": 0,
      "r": 0.028,
      "share": 0.2727272733884298,
      "domain": "main",
      "port": "f23",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 24,
      "name": "魚雷発射管",
      "w": 0.84,
      "hits": 1,
      "crew": 0,
      "size": 0,
      "weaponPowerW": 1000000000000000,
      "stock": 0,
      "at": 0.725,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.47,
      "z": 0.05,
      "r": 0.03,
      "share": 0,
      "domain": "main",
      "port": "f24",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 25,
      "name": "魚雷発射管",
      "w": 0.84,
      "hits": 1,
      "crew": 0,
      "size": 0,
      "weaponPowerW": 1000000000000000,
      "stock": 0,
      "at": 0.725,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.47,
      "z": -0.05,
      "r": 0.03,
      "share": 0,
      "domain": "main",
      "port": "f25",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 26,
      "name": "爆弾倉",
      "w": 3.456,
      "hits": 1,
      "crew": 0,
      "size": 0,
      "weaponPowerW": 1000000000000000,
      "stock": 0,
      "at": 0.469,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.57,
      "z": 0,
      "r": 0.051,
      "share": 0,
      "domain": "main",
      "port": "f26",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "操縦席（操縦士・後部銃手）",
      "w": 1.0150461171147795,
      "hits": 1,
      "crew": 0,
      "size": 1.0226538585904275,
      "at": 0.81,
      "part": 9,
      "y": 0.22,
      "z": 0,
      "r": 0.021,
      "share": 0.5208917288102506,
      "domain": "main",
      "port": "p9",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "アストロメク・ソケット",
      "w": 0.3486891415710139,
      "hits": 1,
      "crew": 0,
      "size": 0.2059006108348058,
      "at": 0.702,
      "part": 10,
      "y": 0.47,
      "z": 0,
      "r": 0.013,
      "share": 0.10487607731579779,
      "domain": "main",
      "port": "p10",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "ナセル反応炉",
      "w": 1.1828407888641992,
      "hits": 1,
      "crew": 0.0006441246687563324,
      "size": 1.2882493375126647,
      "at": 0.141,
      "part": 11,
      "y": -0.05,
      "z": 0.8,
      "r": 0.023,
      "share": 0.2965825874694874,
      "domain": "main",
      "port": "p11",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "ナセル反応炉",
      "w": 1.1828407888641992,
      "hits": 1,
      "crew": 0.0006441246687563324,
      "size": 1.2882493375126647,
      "at": 0.141,
      "part": 12,
      "y": -0.05,
      "z": -0.8,
      "r": 0.023,
      "share": 0.2965825874694874,
      "domain": "main",
      "port": "p12",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "イオン・ジェット・エンジン",
      "w": 2.694645787168439,
      "hits": 1,
      "crew": 0.001769344982501772,
      "size": 4.42336245625443,
      "at": 0.06,
      "part": 13,
      "y": -0.05,
      "z": 0.8,
      "r": 0.035,
      "share": 0.459579512799636,
      "domain": "main",
      "port": "p13",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "イオン・ジェット・エンジン",
      "w": 2.694645787168439,
      "hits": 1,
      "crew": 0.001769344982501772,
      "size": 4.42336245625443,
      "at": 0.06,
      "part": 14,
      "y": -0.05,
      "z": -0.8,
      "r": 0.035,
      "share": 0.459579512799636,
      "domain": "main",
      "port": "p14",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "主反応炉",
      "w": 1.4602972702027148,
      "hits": 1,
      "crew": 0.0008835729338221292,
      "size": 1.7671458676442584,
      "at": 0.469,
      "part": 15,
      "y": 0.06,
      "z": 0,
      "r": 0.026,
      "share": 0.40683482506102514,
      "domain": "main",
      "port": "p15",
      "powerConnected": true
     },
     {
      "k": "shield",
      "name": "チェンパット偏向シールド発生器",
      "w": 0.7155456623993303,
      "hits": 1,
      "crew": 0.0002424524130407923,
      "size": 0.6061310326019808,
      "at": 0.567,
      "part": 16,
      "y": -0.03,
      "z": 0,
      "r": 0.018,
      "share": 1,
      "domain": "main",
      "port": "p16",
      "powerConnected": true
     },
     {
      "k": "hyper",
      "name": "ハイパードライブ",
      "w": 0.5386086025389181,
      "hits": 1,
      "crew": 0.00011875220230569416,
      "size": 0.3958406743523139,
      "at": 0.397,
      "part": 17,
      "y": 0.06,
      "z": 0,
      "r": 0.016,
      "share": 1,
      "domain": "main",
      "port": "p17",
      "powerConnected": true
     },
     {
      "k": "fuel",
      "name": "反応物タンク",
      "w": 0.5285876126535948,
      "hits": 1,
      "crew": 0.00007696902001294993,
      "size": 0.38484510006474965,
      "at": 0.661,
      "part": 18,
      "y": 0.09,
      "z": 0,
      "r": 0.016,
      "share": 1,
      "domain": "main",
      "port": "p18",
      "powerConnected": true
     },
     {
      "k": "battery",
      "name": "パワーセル",
      "w": 0.24976582576666095,
      "hits": 1,
      "crew": 0.000025,
      "size": 0.125,
      "at": 0.751,
      "part": 19,
      "y": 0.13,
      "z": 0,
      "r": 0.011,
      "share": 1,
      "domain": "main",
      "port": "p19",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "慣性補償装置",
      "w": 0.2988377635417063,
      "hits": 1,
      "crew": 0.00003267256359733386,
      "size": 0.16336281798666927,
      "at": 0.618,
      "part": 20,
      "y": 0.06,
      "z": 0,
      "r": 0.012,
      "share": 0.08320932832706468,
      "domain": "main",
      "port": "p20",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "生命維持装置",
      "w": 0.22089999999999999,
      "hits": 1,
      "crew": 0,
      "size": 0.10382299999999998,
      "at": 0.866,
      "part": 27,
      "y": 0.19,
      "z": 0,
      "r": 0.01,
      "share": 0.05288254819163195,
      "domain": "main",
      "port": "p27",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "射出座席機構 1",
      "w": 0.08410000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.024388999999999997,
      "at": 0.784,
      "part": 28,
      "y": -0.32,
      "z": 0.01,
      "r": 0.006,
      "share": 0.012422608360822858,
      "domain": "main",
      "port": "p28",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "射出座席機構 2",
      "w": 0.08410000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.024388999999999997,
      "at": 0.784,
      "part": 29,
      "y": -0.19,
      "z": -0.01,
      "r": 0.006,
      "share": 0.012422608360822858,
      "domain": "main",
      "port": "p29",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "航法コンピューター",
      "w": 0.048400000000000006,
      "hits": 1,
      "crew": 0,
      "size": 0.010648,
      "at": 0.853,
      "part": 30,
      "y": 0.19,
      "z": 0,
      "r": 0.005,
      "share": 0.005423589889952101,
      "domain": "main",
      "port": "p30",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "照準コンピューター",
      "w": 0.09610000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.029791,
      "at": 0.866,
      "part": 31,
      "y": -0.08,
      "z": 0,
      "r": 0.007,
      "share": 0.015174132833542736,
      "domain": "main",
      "port": "p31",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 1",
      "w": 0.06760000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.017576,
      "at": 0.866,
      "part": 32,
      "y": 0.19,
      "z": -0.07,
      "r": 0.006,
      "share": 0.008952386918275558,
      "domain": "main",
      "port": "p32",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 2",
      "w": 0.06760000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.017576,
      "at": 0.866,
      "part": 33,
      "y": 0.19,
      "z": 0.07,
      "r": 0.006,
      "share": 0.008952386918275558,
      "domain": "main",
      "port": "p33",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 3",
      "w": 0.06760000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.017576,
      "at": 0.881,
      "part": 34,
      "y": 0.19,
      "z": 0,
      "r": 0.006,
      "share": 0.008952386918275558,
      "domain": "main",
      "port": "p34",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 4",
      "w": 0.06760000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.017576,
      "at": 0.85,
      "part": 35,
      "y": 0.08,
      "z": 0,
      "r": 0.006,
      "share": 0.008952386918275558,
      "domain": "main",
      "port": "p35",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 1",
      "w": 0.1225,
      "hits": 1,
      "crew": 0,
      "size": 0.04287499999999999,
      "at": 0.845,
      "part": 36,
      "y": 0.19,
      "z": -0.05,
      "r": 0.007,
      "share": 0.02183850643610972,
      "domain": "main",
      "port": "p36",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 2",
      "w": 0.1225,
      "hits": 1,
      "crew": 0,
      "size": 0.04287499999999999,
      "at": 0.845,
      "part": 37,
      "y": 0.19,
      "z": 0.05,
      "r": 0.007,
      "share": 0.02183850643610972,
      "domain": "main",
      "port": "p37",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 1",
      "w": 0.1764,
      "hits": 1,
      "crew": 0,
      "size": 0.07408799999999999,
      "at": 0.866,
      "part": 38,
      "y": 0.01,
      "z": -0.12,
      "r": 0.009,
      "share": 0.0377369391215976,
      "domain": "main",
      "port": "p38",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 2",
      "w": 0.1764,
      "hits": 1,
      "crew": 0,
      "size": 0.07408799999999999,
      "at": 0.866,
      "part": 39,
      "y": 0.01,
      "z": 0.12,
      "r": 0.009,
      "share": 0.0377369391215976,
      "domain": "main",
      "port": "p39",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 3",
      "w": 0.1764,
      "hits": 1,
      "crew": 0,
      "size": 0.07408799999999999,
      "at": 0.891,
      "part": 40,
      "y": 0.01,
      "z": 0,
      "r": 0.009,
      "share": 0.0377369391215976,
      "domain": "main",
      "port": "p40",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 1",
      "w": 0.18566364423556203,
      "hits": 1,
      "crew": 0.000004000002937282854,
      "size": 0.08000005874565708,
      "at": 0.842,
      "part": 41,
      "y": 0.02,
      "z": -0.17,
      "r": 0.009,
      "share": 0.008486824763838278,
      "domain": "main",
      "port": "p41",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 2",
      "w": 0.18566364423556203,
      "hits": 1,
      "crew": 0.000004000002937282854,
      "size": 0.08000005874565708,
      "at": 0.842,
      "part": 42,
      "y": 0.02,
      "z": 0.17,
      "r": 0.009,
      "share": 0.008486824763838278,
      "domain": "main",
      "port": "p42",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 3",
      "w": 0.18566364423556203,
      "hits": 1,
      "crew": 0.000004000002937282854,
      "size": 0.08000005874565708,
      "at": 0.818,
      "part": 43,
      "y": 0.02,
      "z": -0.17,
      "r": 0.009,
      "share": 0.008486824763838278,
      "domain": "main",
      "port": "p43",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 4",
      "w": 0.18566364423556203,
      "hits": 1,
      "crew": 0.000004000002937282854,
      "size": 0.08000005874565708,
      "at": 0.818,
      "part": 44,
      "y": 0.02,
      "z": 0.17,
      "r": 0.009,
      "share": 0.008486824763838278,
      "domain": "main",
      "port": "p44",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 5",
      "w": 0.18566360999173018,
      "hits": 1,
      "crew": 0.0000040000018306411445,
      "size": 0.0800000366128229,
      "at": 0.512,
      "part": 45,
      "y": 0.06,
      "z": 0,
      "r": 0.009,
      "share": 0.008486822415871436,
      "domain": "main",
      "port": "p45",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 6",
      "w": 0.18566363567460437,
      "hits": 1,
      "crew": 0.0000040000026606224275,
      "size": 0.08000005321244855,
      "at": 0.512,
      "part": 46,
      "y": -0.28,
      "z": 0,
      "r": 0.009,
      "share": 0.008486824176846569,
      "domain": "main",
      "port": "p46",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 7",
      "w": 0.18566360143077287,
      "hits": 1,
      "crew": 0.0000040000015539807556,
      "size": 0.0800000310796151,
      "at": 0.512,
      "part": 47,
      "y": 0.06,
      "z": -0.11,
      "r": 0.009,
      "share": 0.008486821828879805,
      "domain": "main",
      "port": "p47",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 8",
      "w": 0.18566360143077287,
      "hits": 1,
      "crew": 0.0000040000015539807556,
      "size": 0.0800000310796151,
      "at": 0.512,
      "part": 48,
      "y": 0.06,
      "z": 0.11,
      "r": 0.009,
      "share": 0.008486821828879805,
      "domain": "main",
      "port": "p48",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 9",
      "w": 0.18566360999173007,
      "hits": 1,
      "crew": 0.000004000001830641142,
      "size": 0.08000003661282284,
      "at": 0.512,
      "part": 49,
      "y": 0.41,
      "z": 0,
      "r": 0.009,
      "share": 0.00848682241587143,
      "domain": "main",
      "port": "p49",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 10",
      "w": 0.17444294421148224,
      "hits": 1,
      "crew": 0.000003642924045297903,
      "size": 0.07285848090595806,
      "at": 0.889,
      "part": 50,
      "y": 0.02,
      "z": -0.11,
      "r": 0.009,
      "share": 0.007729208824385901,
      "domain": "main",
      "port": "p50",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.5329203126266264,
      "hits": 1,
      "crew": 0.00007780784850762161,
      "size": 0.389039242538108,
      "at": 0.117,
      "part": -13,
      "machineryOwner": 13,
      "y": -0.05,
      "z": 0.8,
      "r": 0.016,
      "share": 0.040420487200364064,
      "domain": "main",
      "port": "p13",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.5329203126266264,
      "hits": 1,
      "crew": 0.00007780784850762161,
      "size": 0.389039242538108,
      "at": 0.117,
      "part": -14,
      "machineryOwner": 14,
      "y": -0.05,
      "z": -0.8,
      "r": 0.016,
      "share": 0.040420487200364064,
      "domain": "main",
      "port": "p14",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p11 → p13",
      "w": 0.0031427726202907574,
      "hits": 1,
      "crew": 3.5237041429664784e-8,
      "size": 0.0001761852071483239,
      "at": 0.115,
      "part": -6000000,
      "routeId": "p11>p13",
      "capacityW": 1448195387543154400,
      "y": -0.05,
      "z": 0.8,
      "r": 0.002,
      "share": 0.5,
      "domain": "main",
      "port": "p-6000000",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p12 → p14",
      "w": 0.0031427726202907574,
      "hits": 1,
      "crew": 3.5237041429664784e-8,
      "size": 0.0001761852071483239,
      "at": 0.115,
      "part": -6000001,
      "routeId": "p12>p14",
      "capacityW": 1448195387543154400,
      "y": -0.05,
      "z": -0.8,
      "r": 0.002,
      "share": 0.5,
      "domain": "main",
      "port": "p-6000001",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "主翼（ナセル支持）",
      "w": 6.277787174254002,
      "hits": 1,
      "crew": 0,
      "size": 4.316761933923713,
      "at": 0.373,
      "part": 3,
      "ext": 1,
      "y": 0.03,
      "z": 0.51,
      "r": 0.035,
      "share": 0.45794468972695596,
      "domain": "main",
      "port": "p3",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "主翼（ナセル支持）",
      "w": 6.277787174254003,
      "hits": 1,
      "crew": 0,
      "size": 4.316761933923714,
      "at": 0.373,
      "part": 4,
      "ext": 1,
      "y": 0.03,
      "z": -0.51,
      "r": 0.035,
      "share": 0.45794468972695607,
      "domain": "main",
      "port": "p4",
      "powerConnected": true
     },
     {
      "k": "quarters",
      "name": "居住空間（後部）",
      "w": 1.3064595752833337,
      "hits": 1,
      "crew": 0,
      "size": 25.7043766157211,
      "at": 0.152,
      "y": -0.06,
      "z": 0,
      "r": 0.063,
      "share": 0.18482983345401882,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央後部）",
      "w": 2.282337936868003,
      "hits": 1,
      "crew": 0,
      "size": 59.351682538259055,
      "at": 0.393,
      "y": -0.03,
      "z": 0,
      "r": 0.083,
      "share": 0.42677407675597395,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央前部）",
      "w": 1.906956993060673,
      "hits": 1,
      "crew": 0,
      "size": 45.32882477630346,
      "at": 0.595,
      "y": 0,
      "z": 0,
      "r": 0.076,
      "share": 0.32594134685010856,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（前部）",
      "w": 0.633808722356382,
      "hits": 1,
      "crew": 0,
      "size": 8.685612078769617,
      "at": 0.819,
      "y": 0.12,
      "z": 0,
      "r": 0.044,
      "share": 0.06245474293989862,
      "domain": "main"
     },
     {
      "k": "hull",
      "name": "船体構造",
      "w": 27.151218284458533,
      "hits": null,
      "crew": 0,
      "size": 1,
      "share": 1,
      "domain": "main"
     }
    ],
    "energyModel": {
     "version": 0,
     "eta": 0.75
    },
    "D": 0.0033263739609844566,
    "shieldBuffer": 0.08471702163444517,
    "wCap": 0,
    "crewNeed": 2,
    "crewMax": 2,
    "hp": 1,
    "len": 23.448,
    "width": 10.015999794006348,
    "height": 3.2699700689315803,
    "grid": {
     "P": 22747682592261005000,
     "fixed": 183428991956743600,
     "cooling": 126737108510730200,
     "De": 2896390775086309000,
     "Ds": 13917548652758966000,
     "Dw": 3278933333333333.5,
     "domains": [
      {
       "id": "main",
       "P": 22747682592261005000,
       "reactors": [
        8,
        9,
        12
       ],
       "sources": [
        {
         "moduleIndex": 8,
         "P": 6746566562147386000
        },
        {
         "moduleIndex": 9,
         "P": 6746566562147386000
        },
        {
         "moduleIndex": 12,
         "P": 9254549467966235000
        }
       ],
       "modules": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36,
        37,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        46,
        47,
        48,
        49,
        50,
        51,
        52
       ],
       "protection": 1
      }
     ],
     "powerPaths": [
      {
       "kind": "power",
       "from": "p15",
       "to": "hotel",
       "cap": 183428991956743600,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p3",
       "cap": 1085478870672318,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p4",
       "cap": 1085478870672318,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p9",
       "cap": 6248094098724805,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p10",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p17",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p18",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p19",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p20",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p27",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p28",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p29",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p30",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p31",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p32",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p33",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p34",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p35",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p36",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p37",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p38",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p39",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p40",
       "cap": 6109686133035131,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "p16",
       "cap": 354456018518518600000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "f21",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "f22",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "f23",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "f24",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "f25",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "f26",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "p16",
       "cap": 354456018518518600000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "f21",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "f22",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "f23",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "f24",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "f25",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "f26",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p16",
       "cap": 354456018518518600000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "f21",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "f22",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "f23",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "f24",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "f25",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "f26",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "p41",
       "cap": 12568818137613922,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "p42",
       "cap": 12568818137613922,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "p43",
       "cap": 12568818137613922,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "p44",
       "cap": 12568818137613922,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "p45",
       "cap": 12568814660321880,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "p46",
       "cap": 12568817268290914,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "p47",
       "cap": 12568813790998988,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "p48",
       "cap": 12568813790998988,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "p49",
       "cap": 12568814660321870,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "p50",
       "cap": 11446804047997226,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "p41",
       "cap": 12568818137613922,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "p42",
       "cap": 12568818137613922,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "p43",
       "cap": 12568818137613922,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "p44",
       "cap": 12568818137613922,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "p45",
       "cap": 12568814660321880,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "p46",
       "cap": 12568817268290914,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "p47",
       "cap": 12568813790998988,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "p48",
       "cap": 12568813790998988,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "p49",
       "cap": 12568814660321870,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "p50",
       "cap": 11446804047997226,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p41",
       "cap": 12568818137613922,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p42",
       "cap": 12568818137613922,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p43",
       "cap": 12568818137613922,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p44",
       "cap": 12568818137613922,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p45",
       "cap": 12568814660321880,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p46",
       "cap": 12568817268290914,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p47",
       "cap": 12568813790998988,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p48",
       "cap": 12568813790998988,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p49",
       "cap": 12568814660321870,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p50",
       "cap": 11446804047997226,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "p-6000000",
       "cap": 1448195387543154400,
       "auto": false,
       "ok": true,
       "capacityGroup": "p11>p13",
       "groupCap": 1448195387543154400,
       "physical": true,
       "routeId": "p11>p13",
       "efficiency": 0.9999987834162332
      },
      {
       "kind": "power",
       "from": "p-6000000",
       "to": "p13",
       "cap": 1448195387543154400,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p11>p13",
       "efficiency": 1
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "p-6000001",
       "cap": 1448195387543154400,
       "auto": false,
       "ok": true,
       "capacityGroup": "p12>p14",
       "groupCap": 1448195387543154400,
       "physical": true,
       "routeId": "p12>p14",
       "efficiency": 0.9999987834162332
      },
      {
       "kind": "power",
       "from": "p-6000001",
       "to": "p14",
       "cap": 1448195387543154400,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p12>p14",
       "efficiency": 1
      }
     ],
     "trunks": [
      {
       "port": "p-6000000",
       "moduleIndex": 44
      },
      {
       "port": "p-6000001",
       "moduleIndex": 45
      }
     ],
     "fixedLoads": [
      {
       "id": "hotel",
       "port": "hotel",
       "weight": 183428991956743600,
       "domain": "main"
      }
     ],
     "coolingLoads": [
      {
       "id": "p41",
       "port": "p41",
       "weight": 12568818137613922,
       "domain": "main"
      },
      {
       "id": "p42",
       "port": "p42",
       "weight": 12568818137613922,
       "domain": "main"
      },
      {
       "id": "p43",
       "port": "p43",
       "weight": 12568818137613922,
       "domain": "main"
      },
      {
       "id": "p44",
       "port": "p44",
       "weight": 12568818137613922,
       "domain": "main"
      },
      {
       "id": "p45",
       "port": "p45",
       "weight": 12568814660321880,
       "domain": "main"
      },
      {
       "id": "p46",
       "port": "p46",
       "weight": 12568817268290914,
       "domain": "main"
      },
      {
       "id": "p47",
       "port": "p47",
       "weight": 12568813790998988,
       "domain": "main"
      },
      {
       "id": "p48",
       "port": "p48",
       "weight": 12568813790998988,
       "domain": "main"
      },
      {
       "id": "p49",
       "port": "p49",
       "weight": 12568814660321870,
       "domain": "main"
      },
      {
       "id": "p50",
       "port": "p50",
       "weight": 11446804047997226,
       "domain": "main"
      },
      {
       "id": "p3",
       "port": "p3",
       "weight": 1085478870672318,
       "domain": "main"
      },
      {
       "id": "p4",
       "port": "p4",
       "weight": 1085478870672318,
       "domain": "main"
      }
     ]
    },
    "propulsion": {
     "version": 1,
     "architectureVersion": 2,
     "cores": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 132273342462956690,
       "densityFactor": 10.948505273832657,
       "efficiency": 0.6344223134435075,
       "wasteFraction": 0.3655776865564925,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 2994850527.3832655,
       "ratedShaftPowerW": 918767468083345000,
       "ratedWasteHeatW": 529427919459809500,
       "thermalStoreJ": 396820027388870100,
       "version": 1,
       "id": 13,
       "machineryId": 13,
       "coreId": 13,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 1448195387543154400,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 483561825.3070237,
       "effectiveMachineryVolumeM3": 0.3890392425381079,
       "machineryVolumeM3": 0.3890392425381079,
       "machineryShape": "frustum",
       "machineryLengthM": 0.4959999999999999,
       "machineryRadiusM": 0.5599999999999999,
       "machineryDiameterM": 1.1199999999999999,
       "machineryOffsetM": 1.1,
       "maxInputW": 13227334246295669000,
       "maxRatedInputW": 13227334246295669000,
       "inputDensityWPerM3": 3722491793103103500,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 2705.437421772538,
       "powerNode": "p13",
       "heatNode": "p13",
       "reactorId": 11,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 10,
       "machineryModuleIndex": 42,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 1448193625692154600,
       "transmissionRouteIds": [
        "p11>p13"
       ]
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 132273342462956690,
       "densityFactor": 10.948505273832657,
       "efficiency": 0.6344223134435075,
       "wasteFraction": 0.3655776865564925,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 2994850527.3832655,
       "ratedShaftPowerW": 918767468083345000,
       "ratedWasteHeatW": 529427919459809500,
       "thermalStoreJ": 396820027388870100,
       "version": 1,
       "id": 14,
       "machineryId": 14,
       "coreId": 14,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 1448195387543154400,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 483561825.3070237,
       "effectiveMachineryVolumeM3": 0.3890392425381079,
       "machineryVolumeM3": 0.3890392425381079,
       "machineryShape": "frustum",
       "machineryLengthM": 0.4959999999999999,
       "machineryRadiusM": 0.5599999999999999,
       "machineryDiameterM": 1.1199999999999999,
       "machineryOffsetM": 1.1,
       "maxInputW": 13227334246295669000,
       "maxRatedInputW": 13227334246295669000,
       "inputDensityWPerM3": 3722491793103103500,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 2705.437421772538,
       "powerNode": "p14",
       "heatNode": "p14",
       "reactorId": 12,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 11,
       "machineryModuleIndex": 43,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 1448193625692154600,
       "transmissionRouteIds": [
        "p12>p14"
       ]
      }
     ],
     "engines": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 132273342462956690,
       "densityFactor": 10.948505273832657,
       "efficiency": 0.6344223134435075,
       "wasteFraction": 0.3655776865564925,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 2994850527.3832655,
       "ratedShaftPowerW": 918767468083345000,
       "ratedWasteHeatW": 529427919459809500,
       "thermalStoreJ": 396820027388870100,
       "version": 1,
       "id": 13,
       "machineryId": 13,
       "coreId": 13,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 1448195387543154400,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 483561825.3070237,
       "effectiveMachineryVolumeM3": 0.3890392425381079,
       "machineryVolumeM3": 0.3890392425381079,
       "machineryShape": "frustum",
       "machineryLengthM": 0.4959999999999999,
       "machineryRadiusM": 0.5599999999999999,
       "machineryDiameterM": 1.1199999999999999,
       "machineryOffsetM": 1.1,
       "maxInputW": 13227334246295669000,
       "maxRatedInputW": 13227334246295669000,
       "inputDensityWPerM3": 3722491793103103500,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 2705.437421772538,
       "powerNode": "p13",
       "heatNode": "p13",
       "reactorId": 11,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 10,
       "coreModuleIndex": 10,
       "machineryModuleIndex": 42,
       "shaftModuleIndices": [],
       "shaftCapacityW": 918767468083345000,
       "ratedShaftCapacityW": 918767468083345000,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 1448193625692154600
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 132273342462956690,
       "densityFactor": 10.948505273832657,
       "efficiency": 0.6344223134435075,
       "wasteFraction": 0.3655776865564925,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 2994850527.3832655,
       "ratedShaftPowerW": 918767468083345000,
       "ratedWasteHeatW": 529427919459809500,
       "thermalStoreJ": 396820027388870100,
       "version": 1,
       "id": 14,
       "machineryId": 14,
       "coreId": 14,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 1448195387543154400,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 483561825.3070237,
       "effectiveMachineryVolumeM3": 0.3890392425381079,
       "machineryVolumeM3": 0.3890392425381079,
       "machineryShape": "frustum",
       "machineryLengthM": 0.4959999999999999,
       "machineryRadiusM": 0.5599999999999999,
       "machineryDiameterM": 1.1199999999999999,
       "machineryOffsetM": 1.1,
       "maxInputW": 13227334246295669000,
       "maxRatedInputW": 13227334246295669000,
       "inputDensityWPerM3": 3722491793103103500,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 2705.437421772538,
       "powerNode": "p14",
       "heatNode": "p14",
       "reactorId": 12,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 11,
       "coreModuleIndex": 11,
       "machineryModuleIndex": 43,
       "shaftModuleIndices": [],
       "shaftCapacityW": 918767468083345000,
       "ratedShaftCapacityW": 918767468083345000,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 1448193625692154600
      }
     ],
     "massKg": 49224.98316991177,
     "ratedThrustN": 967123650.6140474,
     "ratedAccelMps2": 19647.00825342671,
     "structuralAccelerationLimitMps2": 184308.36109363998,
     "inertialFactor": 1,
     "accelerationLimitMps2": 19647.00825342671
    },
    "profileVersion": 18,
    "heat": {
     "v": 3,
     "mode": "strict",
     "src": [
      {
       "k": "reactor",
       "id": "p11",
       "n": "ナセル反応炉 #11",
       "g": "high",
       "sh": 0.381233,
       "st": 19430111698984470000,
       "m": [
        8
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "reactor",
       "id": "p12",
       "n": "ナセル反応炉 #12",
       "g": "high",
       "sh": 0.381233,
       "st": 19430111698984470000,
       "m": [
        9
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "reactor",
       "id": "p15",
       "n": "主反応炉 #15",
       "g": "high",
       "sh": 0.237535,
       "st": 12106338538933078000,
       "m": [
        12
       ],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "shield",
       "id": "p16",
       "n": "シールド（艦首区画）",
       "g": "high",
       "sh": 1,
       "st": 375773813624492060000,
       "m": [
        13
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p13",
       "n": "イオン・ジェット・エンジン #13",
       "g": "high",
       "sh": 0.5,
       "st": 396820027388870100,
       "m": [
        10,
        42
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p14",
       "n": "イオン・ジェット・エンジン #14",
       "g": "high",
       "sh": 0.5,
       "st": 396820027388870100,
       "m": [
        11,
        43
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "feed",
       "id": "p-6000000",
       "n": "推進配電路 1",
       "g": "high",
       "sh": 0.5,
       "st": 63426713157120,
       "m": [
        44
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1,
       "routeId": "p11>p13"
      },
      {
       "k": "feed",
       "id": "p-6000001",
       "n": "推進配電路 2",
       "g": "high",
       "sh": 0.5,
       "st": 63426713157120,
       "m": [
        45
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1,
       "routeId": "p12>p14"
      },
      {
       "k": "weapon",
       "id": "f21",
       "n": "武装（艦首区画）",
       "g": "high",
       "sh": 0.695023,
       "st": 42730000000000000,
       "m": [
        0,
        1,
        2,
        3,
        4
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "weapon",
       "id": "f26",
       "n": "武装（前部区画）",
       "g": "high",
       "sh": 0.304977,
       "st": 18750000000000000,
       "m": [
        5
       ],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "hotel",
       "id": "hotel",
       "n": "生活・電子設備",
       "g": "low",
       "sh": 1,
       "st": 11005739517404617000,
       "m": [],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1
      }
     ],
     "dis": [
      {
       "id": "p41",
       "n": "機体内高エネルギー散逸装置 1 #41",
       "k": "hdis",
       "g": "high",
       "cap": 837921209174261500,
       "m": 32,
       "sec": 4,
       "src": -1,
       "power": 12568818137613922
      },
      {
       "id": "p42",
       "n": "機体内高エネルギー散逸装置 2 #42",
       "k": "hdis",
       "g": "high",
       "cap": 837921209174261500,
       "m": 33,
       "sec": 4,
       "src": -1,
       "power": 12568818137613922
      },
      {
       "id": "p43",
       "n": "機体内高エネルギー散逸装置 3 #43",
       "k": "hdis",
       "g": "high",
       "cap": 837921209174261500,
       "m": 34,
       "sec": 4,
       "src": -1,
       "power": 12568818137613922
      },
      {
       "id": "p44",
       "n": "機体内高エネルギー散逸装置 4 #44",
       "k": "hdis",
       "g": "high",
       "cap": 837921209174261500,
       "m": 35,
       "sec": 4,
       "src": -1,
       "power": 12568818137613922
      },
      {
       "id": "p45",
       "n": "機体内高エネルギー散逸装置 5 #45",
       "k": "hdis",
       "g": "high",
       "cap": 837920977354792100,
       "m": 36,
       "sec": 3,
       "src": -1,
       "power": 12568814660321880
      },
      {
       "id": "p46",
       "n": "機体内高エネルギー散逸装置 6 #46",
       "k": "hdis",
       "g": "high",
       "cap": 837921151219394300,
       "m": 37,
       "sec": 3,
       "src": -1,
       "power": 12568817268290914
      },
      {
       "id": "p47",
       "n": "機体内高エネルギー散逸装置 7 #47",
       "k": "hdis",
       "g": "high",
       "cap": 837920919399932500,
       "m": 38,
       "sec": 3,
       "src": -1,
       "power": 12568813790998988
      },
      {
       "id": "p48",
       "n": "機体内高エネルギー散逸装置 8 #48",
       "k": "hdis",
       "g": "high",
       "cap": 837920919399932500,
       "m": 39,
       "sec": 3,
       "src": -1,
       "power": 12568813790998988
      },
      {
       "id": "p49",
       "n": "機体内高エネルギー散逸装置 9 #49",
       "k": "hdis",
       "g": "high",
       "cap": 837920977354791400,
       "m": 40,
       "sec": 3,
       "src": -1,
       "power": 12568814660321870
      },
      {
       "id": "p50",
       "n": "機体内高エネルギー散逸装置 10 #50",
       "k": "hdis",
       "g": "high",
       "cap": 763120269866481800,
       "m": 41,
       "sec": 4,
       "src": -1,
       "power": 11446804047997226
      },
      {
       "id": "p3",
       "n": "主翼（ナセル支持） #3",
       "k": "wing",
       "g": "high",
       "cap": 108547887067231790,
       "m": 46,
       "sec": 3,
       "src": -1,
       "power": 1085478870672318
      },
      {
       "id": "p4",
       "n": "主翼（ナセル支持） #4",
       "k": "wing",
       "g": "high",
       "cap": 108547887067231790,
       "m": 47,
       "sec": 3,
       "src": -1,
       "power": 1085478870672318
      },
      {
       "id": "skin",
       "n": "外殻からの放熱",
       "k": "skin",
       "g": "low",
       "cap": 1.0438161489569224e+21,
       "m": -1,
       "sec": -1,
       "src": -1
      }
     ],
     "ln": [
      {
       "s": 0,
       "d": 0,
       "cap": 44579882616665630,
       "sec": 3
      },
      {
       "s": 0,
       "d": 1,
       "cap": 44579882616665630,
       "sec": 3
      },
      {
       "s": 0,
       "d": 2,
       "cap": 44579882616665630,
       "sec": 3
      },
      {
       "s": 0,
       "d": 3,
       "cap": 44579882616665630,
       "sec": 3
      },
      {
       "s": 0,
       "d": 4,
       "cap": 44579870283185330,
       "sec": 2
      },
      {
       "s": 0,
       "d": 5,
       "cap": 44579879533295576,
       "sec": 2
      },
      {
       "s": 0,
       "d": 6,
       "cap": 44579867199815670,
       "sec": 2
      },
      {
       "s": 0,
       "d": 7,
       "cap": 44579867199815670,
       "sec": 2
      },
      {
       "s": 0,
       "d": 8,
       "cap": 44579870283185290,
       "sec": 2
      },
      {
       "s": 0,
       "d": 9,
       "cap": 40600251766596470,
       "sec": 3
      },
      {
       "s": 0,
       "d": 10,
       "cap": 5775068121873855,
       "sec": 0
      },
      {
       "s": 0,
       "d": 11,
       "cap": 5775068121873855,
       "sec": 0
      },
      {
       "s": 1,
       "d": 0,
       "cap": 44579882616665630,
       "sec": 3
      },
      {
       "s": 1,
       "d": 1,
       "cap": 44579882616665630,
       "sec": 3
      },
      {
       "s": 1,
       "d": 2,
       "cap": 44579882616665630,
       "sec": 3
      },
      {
       "s": 1,
       "d": 3,
       "cap": 44579882616665630,
       "sec": 3
      },
      {
       "s": 1,
       "d": 4,
       "cap": 44579870283185330,
       "sec": 2
      },
      {
       "s": 1,
       "d": 5,
       "cap": 44579879533295576,
       "sec": 2
      },
      {
       "s": 1,
       "d": 6,
       "cap": 44579867199815670,
       "sec": 2
      },
      {
       "s": 1,
       "d": 7,
       "cap": 44579867199815670,
       "sec": 2
      },
      {
       "s": 1,
       "d": 8,
       "cap": 44579870283185290,
       "sec": 2
      },
      {
       "s": 1,
       "d": 9,
       "cap": 40600251766596470,
       "sec": 3
      },
      {
       "s": 1,
       "d": 10,
       "cap": 5775068121873855,
       "sec": 0
      },
      {
       "s": 1,
       "d": 11,
       "cap": 5775068121873855,
       "sec": 0
      },
      {
       "s": 2,
       "d": 0,
       "cap": 23808367187153220,
       "sec": 4
      },
      {
       "s": 2,
       "d": 1,
       "cap": 23808367187153220,
       "sec": 4
      },
      {
       "s": 2,
       "d": 2,
       "cap": 23808367187153220,
       "sec": 4
      },
      {
       "s": 2,
       "d": 3,
       "cap": 23808367187153220,
       "sec": 4
      },
      {
       "s": 2,
       "d": 4,
       "cap": 23808360600325020,
       "sec": 3
      },
      {
       "s": 2,
       "d": 5,
       "cap": 23808365540446176,
       "sec": 3
      },
      {
       "s": 2,
       "d": 6,
       "cap": 23808358953618190,
       "sec": 3
      },
      {
       "s": 2,
       "d": 7,
       "cap": 23808358953618190,
       "sec": 3
      },
      {
       "s": 2,
       "d": 8,
       "cap": 23808360600325000,
       "sec": 3
      },
      {
       "s": 2,
       "d": 9,
       "cap": 21683002404062724,
       "sec": 4
      },
      {
       "s": 2,
       "d": 10,
       "cap": 3084237425178757,
       "sec": 3
      },
      {
       "s": 2,
       "d": 11,
       "cap": 3084237425178757,
       "sec": 3
      },
      {
       "s": 3,
       "d": 0,
       "cap": 738998141264513900,
       "sec": 4
      },
      {
       "s": 3,
       "d": 1,
       "cap": 738998141264513900,
       "sec": 4
      },
      {
       "s": 3,
       "d": 2,
       "cap": 738998141264513900,
       "sec": 4
      },
      {
       "s": 3,
       "d": 3,
       "cap": 738998141264513900,
       "sec": 4
      },
      {
       "s": 3,
       "d": 4,
       "cap": 738997936813122600,
       "sec": 3
      },
      {
       "s": 3,
       "d": 5,
       "cap": 738998090151666300,
       "sec": 3
      },
      {
       "s": 3,
       "d": 6,
       "cap": 738997885700281700,
       "sec": 3
      },
      {
       "s": 3,
       "d": 7,
       "cap": 738997885700281700,
       "sec": 3
      },
      {
       "s": 3,
       "d": 8,
       "cap": 738997936813122000,
       "sec": 3
      },
      {
       "s": 3,
       "d": 9,
       "cap": 673028030342315100,
       "sec": 4
      },
      {
       "s": 3,
       "d": 10,
       "cap": 95732970955497200,
       "sec": 3
      },
      {
       "s": 3,
       "d": 11,
       "cap": 95732970955497200,
       "sec": 3
      },
      {
       "s": 4,
       "d": 0,
       "cap": 37482295019607370,
       "sec": 3
      },
      {
       "s": 4,
       "d": 1,
       "cap": 37482295019607370,
       "sec": 3
      },
      {
       "s": 4,
       "d": 2,
       "cap": 37482295019607370,
       "sec": 3
      },
      {
       "s": 4,
       "d": 3,
       "cap": 37482295019607370,
       "sec": 3
      },
      {
       "s": 4,
       "d": 4,
       "cap": 37482284649747224,
       "sec": 0
      },
      {
       "s": 4,
       "d": 5,
       "cap": 37482292427142340,
       "sec": 0
      },
      {
       "s": 4,
       "d": 6,
       "cap": 37482282057282540,
       "sec": 0
      },
      {
       "s": 4,
       "d": 7,
       "cap": 37482282057282540,
       "sec": 0
      },
      {
       "s": 4,
       "d": 8,
       "cap": 37482284649747200,
       "sec": 0
      },
      {
       "s": 4,
       "d": 9,
       "cap": 34136263383004092,
       "sec": 3
      },
      {
       "s": 4,
       "d": 10,
       "cap": 4855616354213631,
       "sec": 0
      },
      {
       "s": 4,
       "d": 11,
       "cap": 4855616354213631,
       "sec": 0
      },
      {
       "s": 5,
       "d": 0,
       "cap": 37482295019607370,
       "sec": 3
      },
      {
       "s": 5,
       "d": 1,
       "cap": 37482295019607370,
       "sec": 3
      },
      {
       "s": 5,
       "d": 2,
       "cap": 37482295019607370,
       "sec": 3
      },
      {
       "s": 5,
       "d": 3,
       "cap": 37482295019607370,
       "sec": 3
      },
      {
       "s": 5,
       "d": 4,
       "cap": 37482284649747224,
       "sec": 0
      },
      {
       "s": 5,
       "d": 5,
       "cap": 37482292427142340,
       "sec": 0
      },
      {
       "s": 5,
       "d": 6,
       "cap": 37482282057282540,
       "sec": 0
      },
      {
       "s": 5,
       "d": 7,
       "cap": 37482282057282540,
       "sec": 0
      },
      {
       "s": 5,
       "d": 8,
       "cap": 37482284649747200,
       "sec": 0
      },
      {
       "s": 5,
       "d": 9,
       "cap": 34136263383004092,
       "sec": 3
      },
      {
       "s": 5,
       "d": 10,
       "cap": 4855616354213631,
       "sec": 0
      },
      {
       "s": 5,
       "d": 11,
       "cap": 4855616354213631,
       "sec": 0
      },
      {
       "s": 6,
       "d": 0,
       "cap": 99996195669.51091,
       "sec": 3
      },
      {
       "s": 6,
       "d": 1,
       "cap": 99996195669.51091,
       "sec": 3
      },
      {
       "s": 6,
       "d": 2,
       "cap": 99996195669.51091,
       "sec": 3
      },
      {
       "s": 6,
       "d": 3,
       "cap": 99996195669.51091,
       "sec": 3
      },
      {
       "s": 6,
       "d": 4,
       "cap": 99996168004.54102,
       "sec": 1
      },
      {
       "s": 6,
       "d": 5,
       "cap": 99996188753.26845,
       "sec": 1
      },
      {
       "s": 6,
       "d": 6,
       "cap": 99996161088.29947,
       "sec": 1
      },
      {
       "s": 6,
       "d": 7,
       "cap": 99996161088.29947,
       "sec": 1
      },
      {
       "s": 6,
       "d": 8,
       "cap": 99996168004.54092,
       "sec": 1
      },
      {
       "s": 6,
       "d": 9,
       "cap": 91069569536.42256,
       "sec": 3
      },
      {
       "s": 6,
       "d": 10,
       "cap": 12953933658.49212,
       "sec": 0
      },
      {
       "s": 6,
       "d": 11,
       "cap": 12953933658.49212,
       "sec": 0
      },
      {
       "s": 7,
       "d": 0,
       "cap": 99996195669.51091,
       "sec": 3
      },
      {
       "s": 7,
       "d": 1,
       "cap": 99996195669.51091,
       "sec": 3
      },
      {
       "s": 7,
       "d": 2,
       "cap": 99996195669.51091,
       "sec": 3
      },
      {
       "s": 7,
       "d": 3,
       "cap": 99996195669.51091,
       "sec": 3
      },
      {
       "s": 7,
       "d": 4,
       "cap": 99996168004.54102,
       "sec": 1
      },
      {
       "s": 7,
       "d": 5,
       "cap": 99996188753.26845,
       "sec": 1
      },
      {
       "s": 7,
       "d": 6,
       "cap": 99996161088.29947,
       "sec": 1
      },
      {
       "s": 7,
       "d": 7,
       "cap": 99996161088.29947,
       "sec": 1
      },
      {
       "s": 7,
       "d": 8,
       "cap": 99996168004.54092,
       "sec": 1
      },
      {
       "s": 7,
       "d": 9,
       "cap": 91069569536.42256,
       "sec": 3
      },
      {
       "s": 7,
       "d": 10,
       "cap": 12953933658.49212,
       "sec": 0
      },
      {
       "s": 7,
       "d": 11,
       "cap": 12953933658.49212,
       "sec": 0
      },
      {
       "s": 8,
       "d": 0,
       "cap": 84032972579051.86,
       "sec": 4
      },
      {
       "s": 8,
       "d": 1,
       "cap": 84032972579051.86,
       "sec": 4
      },
      {
       "s": 8,
       "d": 2,
       "cap": 84032972579051.86,
       "sec": 4
      },
      {
       "s": 8,
       "d": 3,
       "cap": 84032972579051.86,
       "sec": 4
      },
      {
       "s": 8,
       "d": 4,
       "cap": 84032949330470.84,
       "sec": 4
      },
      {
       "s": 8,
       "d": 5,
       "cap": 84032966766906.61,
       "sec": 4
      },
      {
       "s": 8,
       "d": 6,
       "cap": 84032943518326.38,
       "sec": 4
      },
      {
       "s": 8,
       "d": 7,
       "cap": 84032943518326.38,
       "sec": 4
      },
      {
       "s": 8,
       "d": 8,
       "cap": 84032949330470.77,
       "sec": 4
      },
      {
       "s": 8,
       "d": 9,
       "cap": 76531377902945.81,
       "sec": 4
      },
      {
       "s": 8,
       "d": 10,
       "cap": 10885989658172.86,
       "sec": 4
      },
      {
       "s": 8,
       "d": 11,
       "cap": 10885989658172.86,
       "sec": 4
      },
      {
       "s": 9,
       "d": 0,
       "cap": 36873817829562.89,
       "sec": 4
      },
      {
       "s": 9,
       "d": 1,
       "cap": 36873817829562.89,
       "sec": 4
      },
      {
       "s": 9,
       "d": 2,
       "cap": 36873817829562.89,
       "sec": 4
      },
      {
       "s": 9,
       "d": 3,
       "cap": 36873817829562.89,
       "sec": 4
      },
      {
       "s": 9,
       "d": 4,
       "cap": 36873807628044.19,
       "sec": 3
      },
      {
       "s": 9,
       "d": 5,
       "cap": 36873815279183.22,
       "sec": 3
      },
      {
       "s": 9,
       "d": 6,
       "cap": 36873805077664.86,
       "sec": 3
      },
      {
       "s": 9,
       "d": 7,
       "cap": 36873805077664.86,
       "sec": 3
      },
      {
       "s": 9,
       "d": 8,
       "cap": 36873807628044.16,
       "sec": 3
      },
      {
       "s": 9,
       "d": 9,
       "cap": 33582104743277.18,
       "sec": 4
      },
      {
       "s": 9,
       "d": 10,
       "cap": 4776791623934.966,
       "sec": 3
      },
      {
       "s": 9,
       "d": 11,
       "cap": 4776791623934.966,
       "sec": 3
      },
      {
       "s": 10,
       "d": 5,
       "cap": 275143487935115420,
       "sec": 3
      },
      {
       "s": 10,
       "d": 4,
       "cap": 275143487935115420,
       "sec": 3
      },
      {
       "s": 10,
       "d": 6,
       "cap": 275143487935115420,
       "sec": 3
      },
      {
       "s": 10,
       "d": 7,
       "cap": 275143487935115420,
       "sec": 3
      },
      {
       "s": 10,
       "d": 8,
       "cap": 275143487935115420,
       "sec": 3
      },
      {
       "s": 10,
       "d": 10,
       "cap": 275143487935115420,
       "sec": 3
      },
      {
       "s": 10,
       "d": 11,
       "cap": 275143487935115420,
       "sec": 3
      },
      {
       "s": 10,
       "d": 2,
       "cap": 275143487935115420,
       "sec": 4
      },
      {
       "s": 10,
       "d": 3,
       "cap": 275143487935115420,
       "sec": 4
      },
      {
       "s": 10,
       "d": 0,
       "cap": 275143487935115420,
       "sec": 4
      },
      {
       "s": 10,
       "d": 1,
       "cap": 275143487935115420,
       "sec": 4
      },
      {
       "s": 10,
       "d": 9,
       "cap": 275143487935115420,
       "sec": 4
      },
      {
       "s": 10,
       "d": 12,
       "cap": 1.0438161489569224e+21,
       "sec": -1
      }
     ]
    },
    "speedReference": {
     "version": 1,
     "key": "btlb",
     "status": "published",
     "mglt": 100,
     "model": "BTL-B Y-wing starfighter/bomber",
     "scope": "class",
     "continuity": "canon",
     "source": "https://starwars.fandom.com/wiki/Megalight_per_hour"
    },
    "mglt": 100,
    "maxSpeed": 2000
   },
   "fireArcs": [
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      1,
      0
     ],
     "pos": [
      23.37,
      1.4859999418402619,
      0.51
     ],
     "k": "claser",
     "gun": 0.36363636347107436,
     "aa": 0.36363636363636365,
     "cycle": 0.12
    },
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      1,
      0
     ],
     "pos": [
      23.37,
      1.4859999418402619,
      -0.51
     ],
     "k": "claser",
     "gun": 0.36363636347107436,
     "aa": 0.36363636363636365,
     "cycle": 0.12
    },
    {
     "fixed": false,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      1,
      0
     ],
     "pos": [
      18.369999999999997,
      2.555000076293945,
      0
     ],
     "k": "cturret",
     "gun": 0.2727272730578512,
     "aa": 0.2727272727272727,
     "cycle": 0.12
    }
   ]
  },
  "hyena": {
   "reference": "craft_hyena",
   "signature": "1o3a13a",
   "build": 186072,
   "crew": 0,
   "total": 186072,
   "by": {
    "hull": 20,
    "armor": 11,
    "power": 61974,
    "drive": 44465,
    "command": 13501,
    "weapons": 49100,
    "systems": 17001
   },
   "detailed": true,
   "systems": {
    "v": 1,
    "managed": true,
    "power": 22807701999999996,
    "crew": 0,
    "suitSeats": 0,
    "lifeSupportCapacity": 0,
    "lifeSupportHours": null,
    "ejectionSeats": 0,
    "ejectionCoverage": 0,
    "ejectionSurvival": 0,
    "navCapacity": 2.331,
    "navReady": true,
    "targetDemand": 9,
    "targetCapacity": 10.718749999999998,
    "targetRatio": 1,
    "fireK": 1,
    "maneuverSupport": 37.044,
    "maneuverRatio": 1,
    "turnK": 1,
    "laserUnits": 4,
    "laserGunShare": 1,
    "laserAaShare": 1,
    "laserGasSeconds": 643.1249999999999,
    "landingSupport": 39.321600000000004,
    "landingRatio": 1,
    "landingReady": true
   },
   "heat": {
    "up": 0.0000741,
    "upS": 0.0000741,
    "down": 0.447,
    "T": 0
   },
   "powerProfile": {
    "name": "ハイエナ級ボマー",
    "modules": [
     {
      "k": "weapon",
      "fit": 25,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.754,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": 0.41,
      "z": 0.93,
      "r": 0.105,
      "share": 0.25,
      "domain": "main",
      "port": "f25",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 26,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.754,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": 0.41,
      "z": -0.93,
      "r": 0.105,
      "share": 0.25,
      "domain": "main",
      "port": "f26",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 27,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.754,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.29,
      "z": 0.93,
      "r": 0.105,
      "share": 0.25,
      "domain": "main",
      "port": "f27",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 28,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.754,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.29,
      "z": -0.93,
      "r": 0.105,
      "share": 0.25,
      "domain": "main",
      "port": "f28",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 29,
      "name": "魚雷発射管",
      "w": 0.84,
      "hits": 1,
      "crew": 0,
      "size": 0,
      "weaponPowerW": 1000000000000000,
      "stock": 0,
      "at": 0.644,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": 0.17,
      "z": 0.56,
      "r": 0.056,
      "share": 0,
      "domain": "main",
      "port": "f29",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 30,
      "name": "魚雷発射管",
      "w": 0.84,
      "hits": 1,
      "crew": 0,
      "size": 0,
      "weaponPowerW": 1000000000000000,
      "stock": 0,
      "at": 0.644,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": 0.17,
      "z": -0.56,
      "r": 0.056,
      "share": 0,
      "domain": "main",
      "port": "f30",
      "powerConnected": true
     },
     {
      "k": "launcher",
      "fit": 31,
      "name": "ミサイル発射管",
      "w": 1.0368000000000002,
      "hits": 1,
      "crew": 0,
      "size": 1,
      "stock": 6,
      "mount": "ext",
      "missileKind": "cmsl",
      "launcherCells": 1,
      "ammoPerCell": 6,
      "missileRange": 10000,
      "launchMuzzles": [
       [
        4.301999961853028,
        0.4486473159793487,
        0.351
       ],
       [
        4.301999961853028,
        0.4486473159793487,
        0.549
       ]
      ],
      "launchBlocked": false,
      "salvo": 1,
      "cycle": 1.2,
      "tt": 25,
      "ammo0": 6,
      "muzzle": [
       4.301999961853028,
       0.4486473159793487,
       0.45
      ],
      "launchDir": [
       1,
       0,
       0
      ],
      "launchPowerW": 1000000000000000,
      "at": 0.797,
      "pd": false,
      "dualPurpose": false,
      "y": 0.13,
      "z": 0.1,
      "r": 0.048,
      "share": 0.5,
      "domain": "main",
      "port": "f31",
      "powerConnected": true
     },
     {
      "k": "launcher",
      "fit": 32,
      "name": "ミサイル発射管",
      "w": 1.0368000000000002,
      "hits": 1,
      "crew": 0,
      "size": 1,
      "stock": 6,
      "mount": "ext",
      "missileKind": "cmsl",
      "launcherCells": 1,
      "ammoPerCell": 6,
      "missileRange": 10000,
      "launchMuzzles": [
       [
        4.301999961853028,
        0.4486473159793487,
        -0.549
       ],
       [
        4.301999961853028,
        0.4486473159793487,
        -0.351
       ]
      ],
      "launchBlocked": false,
      "salvo": 1,
      "cycle": 1.2,
      "tt": 25,
      "ammo0": 6,
      "muzzle": [
       4.301999961853028,
       0.4486473159793487,
       -0.45
      ],
      "launchDir": [
       1,
       0,
       0
      ],
      "launchPowerW": 1000000000000000,
      "at": 0.797,
      "pd": false,
      "dualPurpose": false,
      "y": 0.13,
      "z": -0.1,
      "r": 0.048,
      "share": 0.5,
      "domain": "main",
      "port": "f32",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 33,
      "name": "爆弾倉",
      "w": 3.456,
      "hits": 1,
      "crew": 0,
      "size": 0,
      "weaponPowerW": 1000000000000000,
      "stock": 0,
      "at": 0.475,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.36,
      "z": -0.23,
      "r": 0.097,
      "share": 0,
      "domain": "main",
      "port": "f33",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "ドロイド・ブレイン（中央処理装置）",
      "w": 0.25,
      "hits": 1,
      "crew": 0,
      "size": 0.125,
      "at": 0.604,
      "part": 13,
      "y": 0.32,
      "z": 0.23,
      "r": 0.02,
      "share": 0.243753204070736,
      "domain": "main",
      "port": "p13",
      "powerConnected": true
     },
     {
      "k": "battery",
      "name": "パワーセル",
      "w": 0.16000000000000003,
      "hits": 1,
      "crew": 0.000012800000000000005,
      "size": 0.06400000000000002,
      "at": 0.475,
      "part": 14,
      "y": 0.66,
      "z": 0.23,
      "r": 0.016,
      "share": 1,
      "domain": "main",
      "port": "p14",
      "powerConnected": true
     },
     {
      "k": "fuel",
      "name": "燃料",
      "w": 0.18492257922385902,
      "hits": 1,
      "crew": 0.00001590431280879833,
      "size": 0.07952156404399165,
      "at": 0.604,
      "part": 15,
      "y": 0.09,
      "z": -0.23,
      "r": 0.017,
      "share": 1,
      "domain": "main",
      "port": "p15",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "慣性補償装置",
      "w": 0.18632017867622785,
      "hits": 1,
      "crew": 0.000016084954386379744,
      "size": 0.08042477193189872,
      "at": 0.612,
      "part": 16,
      "y": 0.06,
      "z": 0,
      "r": 0.017,
      "share": 0.15683036676046808,
      "domain": "main",
      "port": "p16",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "反応炉",
      "w": 0.8990553869898257,
      "hits": 1,
      "crew": 0.00009280529989562574,
      "size": 0.46402649947812863,
      "at": 0.743,
      "part": 17,
      "y": 0.06,
      "z": 0.84,
      "r": 0.031,
      "share": 0.3939608448776635,
      "domain": "main",
      "port": "p17",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "反応炉",
      "w": 0.899339258842706,
      "hits": 1,
      "crew": 0.00009284925751870687,
      "size": 0.4642462875935343,
      "at": 0.743,
      "part": 18,
      "y": 0.06,
      "z": -0.84,
      "r": 0.031,
      "share": 0.3941474460992245,
      "domain": "main",
      "port": "p18",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "推進機関",
      "w": 0.7764947053007195,
      "hits": 1,
      "crew": 0.00027369555198074287,
      "size": 0.6842388799518571,
      "at": 0.597,
      "part": 19,
      "y": 0.06,
      "z": 0.84,
      "r": 0.035,
      "share": 0.16819782283494744,
      "domain": "main",
      "port": "p19",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "推進機関",
      "w": 0.7764947053007195,
      "hits": 1,
      "crew": 0.00027369555198074287,
      "size": 0.6842388799518571,
      "at": 0.597,
      "part": 20,
      "y": 0.06,
      "z": -0.84,
      "r": 0.035,
      "share": 0.16819782283494744,
      "domain": "main",
      "port": "p20",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "主推進機関",
      "w": 1.1347120516098514,
      "hits": 1,
      "crew": 0.0004834911093874692,
      "size": 1.208727773468673,
      "at": 0.453,
      "part": 21,
      "y": 0.26,
      "z": 0.23,
      "r": 0.043,
      "share": 0.29712631926421496,
      "domain": "main",
      "port": "p21",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "主推進機関",
      "w": 1.1347120516098514,
      "hits": 1,
      "crew": 0.0004834911093874692,
      "size": 1.208727773468673,
      "at": 0.453,
      "part": 22,
      "y": 0.09,
      "z": -0.23,
      "r": 0.043,
      "share": 0.29712631926421496,
      "domain": "main",
      "port": "p22",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "主反応炉",
      "w": 0.24971758554810963,
      "hits": 1,
      "crew": 0.00006239412449539568,
      "size": 0.12478824899079136,
      "at": 0.556,
      "part": 23,
      "y": 0.26,
      "z": 0.23,
      "r": 0.02,
      "share": 0.10594585451155593,
      "domain": "main",
      "port": "p23",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "主反応炉",
      "w": 0.24971758554810963,
      "hits": 1,
      "crew": 0.00006239412449539568,
      "size": 0.12478824899079136,
      "at": 0.556,
      "part": 24,
      "y": 0.09,
      "z": -0.23,
      "r": 0.02,
      "share": 0.10594585451155593,
      "domain": "main",
      "port": "p24",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "航法コンピューター",
      "w": 0.048400000000000006,
      "hits": 1,
      "crew": 0,
      "size": 0.010648,
      "at": 0.639,
      "part": 34,
      "y": 0.19,
      "z": 0.23,
      "r": 0.009,
      "share": 0.020763872935561575,
      "domain": "main",
      "port": "p34",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "照準コンピューター",
      "w": 0.1225,
      "hits": 1,
      "crew": 0,
      "size": 0.04287499999999999,
      "at": 0.617,
      "part": 35,
      "y": 0.08,
      "z": 0.23,
      "r": 0.014,
      "share": 0.08360734899626243,
      "domain": "main",
      "port": "p35",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 1",
      "w": 0.0441,
      "hits": 1,
      "crew": 0,
      "size": 0.009260999999999998,
      "at": 0.629,
      "part": 36,
      "y": 0.38,
      "z": 0.23,
      "r": 0.008,
      "share": 0.018059187383192687,
      "domain": "main",
      "port": "p36",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 2",
      "w": 0.0441,
      "hits": 1,
      "crew": 0,
      "size": 0.009260999999999998,
      "at": 0.629,
      "part": 37,
      "y": 0.29,
      "z": 0.23,
      "r": 0.008,
      "share": 0.018059187383192687,
      "domain": "main",
      "port": "p37",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 3",
      "w": 0.0441,
      "hits": 1,
      "crew": 0,
      "size": 0.009260999999999998,
      "at": 0.629,
      "part": 38,
      "y": 0.29,
      "z": 0.2,
      "r": 0.008,
      "share": 0.018059187383192687,
      "domain": "main",
      "port": "p38",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 4",
      "w": 0.0441,
      "hits": 1,
      "crew": 0,
      "size": 0.009260999999999998,
      "at": 0.629,
      "part": 39,
      "y": 0.29,
      "z": 0.27,
      "r": 0.008,
      "share": 0.018059187383192687,
      "domain": "main",
      "port": "p39",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 1",
      "w": 0.1225,
      "hits": 1,
      "crew": 0,
      "size": 0.04287499999999999,
      "at": 0.543,
      "part": 40,
      "y": 0.08,
      "z": -0.34,
      "r": 0.014,
      "share": 0.08360734899626243,
      "domain": "main",
      "port": "p40",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 2",
      "w": 0.1225,
      "hits": 1,
      "crew": 0,
      "size": 0.04287499999999999,
      "at": 0.543,
      "part": 41,
      "y": 0.08,
      "z": -0.13,
      "r": 0.014,
      "share": 0.08360734899626243,
      "domain": "main",
      "port": "p41",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "歩行脚支持機構 1",
      "w": 0.10240000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.032768000000000005,
      "at": 0.541,
      "part": 42,
      "y": -0.16,
      "z": -0.23,
      "r": 0.013,
      "share": 0.06389843992791903,
      "domain": "main",
      "port": "p42",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "歩行脚支持機構 2",
      "w": 0.10240000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.032768000000000005,
      "at": 0.559,
      "part": 43,
      "y": -0.16,
      "z": -0.23,
      "r": 0.013,
      "share": 0.06389843992791903,
      "domain": "main",
      "port": "p43",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "歩行脚支持機構 3",
      "w": 0.10240000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.032768000000000005,
      "at": 0.362,
      "part": 44,
      "y": 0.44,
      "z": 0.23,
      "r": 0.013,
      "share": 0.06389843992791903,
      "domain": "main",
      "port": "p44",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "歩行脚支持機構 4",
      "w": 0.10240000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.032768000000000005,
      "at": 0.344,
      "part": 45,
      "y": 0.44,
      "z": 0.23,
      "r": 0.013,
      "share": 0.06389843992791903,
      "domain": "main",
      "port": "p45",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 1",
      "w": 0.10233757106175251,
      "hits": 1,
      "crew": 0.000001636901933866929,
      "size": 0.03273803867733858,
      "at": 0.362,
      "part": 46,
      "y": 0.19,
      "z": 0.23,
      "r": 0.013,
      "share": 0.0030981333575870883,
      "domain": "main",
      "port": "p46",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.16432291863915185,
      "hits": 1,
      "crew": 0.000013322238545891404,
      "size": 0.06661119272945702,
      "at": 0.698,
      "part": -19,
      "machineryOwner": 19,
      "y": 0.06,
      "z": 0.84,
      "r": 0.016,
      "share": 0.0163741902452577,
      "domain": "main",
      "port": "p19",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.16432291863915185,
      "hits": 1,
      "crew": 0.000013322238545891404,
      "size": 0.06661119272945702,
      "at": 0.698,
      "part": -20,
      "machineryOwner": 20,
      "y": 0.06,
      "z": -0.84,
      "r": 0.016,
      "share": 0.0163741902452577,
      "domain": "main",
      "port": "p20",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.17697776050304867,
      "hits": 1,
      "crew": 0.000014890457399313293,
      "size": 0.07445228699656646,
      "at": 0.542,
      "part": -21,
      "machineryOwner": 21,
      "y": 0.26,
      "z": 0.23,
      "r": 0.017,
      "share": 0.018301667655579938,
      "domain": "main",
      "port": "p21",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.17697776050304867,
      "hits": 1,
      "crew": 0.000014890457399313293,
      "size": 0.07445228699656646,
      "at": 0.542,
      "part": -22,
      "machineryOwner": 22,
      "y": 0.09,
      "z": -0.23,
      "r": 0.017,
      "share": 0.018301667655579938,
      "domain": "main",
      "port": "p22",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p17 → p19",
      "w": 0.00140893917572576,
      "hits": 1,
      "crew": 1.0577142685640555e-8,
      "size": 0.00005288571342820277,
      "at": 0.688,
      "part": -6000000,
      "routeId": "p17>p19",
      "capacityW": 217183730695201760,
      "y": 0.06,
      "z": 0.84,
      "r": 0.002,
      "share": 0.25847730378092154,
      "domain": "main",
      "port": "p-6000000",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p18 → p20",
      "w": 0.00140893917572576,
      "hits": 1,
      "crew": 1.0577142685640555e-8,
      "size": 0.00005288571342820277,
      "at": 0.688,
      "part": -6000001,
      "routeId": "p18>p20",
      "capacityW": 217183730695201760,
      "y": 0.06,
      "z": -0.84,
      "r": 0.002,
      "share": 0.25847730378092154,
      "domain": "main",
      "port": "p-6000001",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p23 → p21",
      "w": 0.0013466330443159004,
      "hits": 1,
      "crew": 9.883343652853324e-9,
      "size": 0.000049416718264266616,
      "at": 0.537,
      "part": -6000002,
      "routeId": "p23>p21",
      "capacityW": 383661342447102200,
      "y": 0.26,
      "z": 0.23,
      "r": 0.002,
      "share": 0.24152269621907843,
      "domain": "main",
      "port": "p-6000002",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p24 → p22",
      "w": 0.0013466330443159004,
      "hits": 1,
      "crew": 9.883343652853324e-9,
      "size": 0.000049416718264266616,
      "at": 0.537,
      "part": -6000003,
      "routeId": "p24>p22",
      "capacityW": 383661342447102200,
      "y": 0.09,
      "z": -0.23,
      "r": 0.002,
      "share": 0.24152269621907843,
      "domain": "main",
      "port": "p-6000003",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "上翼",
      "w": 4.906219462469175,
      "hits": 1,
      "crew": 0,
      "size": 2.273458685302641,
      "at": 0.566,
      "part": 3,
      "ext": 1,
      "y": 0.64,
      "z": 0.84,
      "r": 0.053,
      "share": 0.21514661459874584,
      "domain": "main",
      "port": "p3",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "上翼",
      "w": 4.906219462469175,
      "hits": 1,
      "crew": 0,
      "size": 2.273458685302641,
      "at": 0.566,
      "part": 4,
      "ext": 1,
      "y": 0.64,
      "z": -0.84,
      "r": 0.053,
      "share": 0.21514661459874584,
      "domain": "main",
      "port": "p4",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "下翼",
      "w": 5.973953440790414,
      "hits": 1,
      "crew": 0,
      "size": 2.9936825414824826,
      "at": 0.5,
      "part": 5,
      "ext": 1,
      "y": -0.58,
      "z": 0.84,
      "r": 0.058,
      "share": 0.2833043187224606,
      "domain": "main",
      "port": "p5",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "下翼",
      "w": 5.973953440790414,
      "hits": 1,
      "crew": 0,
      "size": 2.9936825414824826,
      "at": 0.5,
      "part": 6,
      "ext": 1,
      "y": -0.58,
      "z": -0.84,
      "r": 0.058,
      "share": 0.2833043187224606,
      "domain": "main",
      "port": "p6",
      "powerConnected": true
     },
     {
      "k": "quarters",
      "name": "居住空間（後部）",
      "w": 0.17517704521480412,
      "hits": 1,
      "crew": 0,
      "size": 1.2620568151546032,
      "at": 0.162,
      "y": -0.23,
      "z": 0,
      "r": 0.044,
      "share": 0.047042052744119746,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央後部）",
      "w": 0.6828998979218736,
      "hits": 1,
      "crew": 0,
      "size": 9.714013062099067,
      "at": 0.405,
      "y": 0.1,
      "z": 0.02,
      "r": 0.086,
      "share": 0.3620812544547399,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央前部）",
      "w": 0.7786477666151463,
      "hits": 1,
      "crew": 0,
      "size": 11.827002123835182,
      "at": 0.602,
      "y": 0.11,
      "z": 0.01,
      "r": 0.092,
      "share": 0.4408410548823949,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（前部）",
      "w": 0.37956192427793384,
      "hits": 1,
      "crew": 0,
      "size": 4.0251963574249086,
      "at": 0.827,
      "y": 0.03,
      "z": 0,
      "r": 0.064,
      "share": 0.15003563791874555,
      "domain": "main"
     },
     {
      "k": "hull",
      "name": "船体構造",
      "w": 26.204201161791087,
      "hits": null,
      "crew": 0,
      "size": 1,
      "share": 1,
      "domain": "main"
     }
    ],
    "energyModel": {
     "version": 0,
     "eta": 0.75
    },
    "D": 0,
    "shieldBuffer": 0,
    "wCap": 0,
    "crewNeed": 0,
    "crewMax": 0,
    "hp": 1,
    "len": 12.420000076293945,
    "width": 9.32800026702881,
    "height": 3.3390000800136477,
    "grid": {
     "P": 6168401077645663000,
     "fixed": 36719714777178024,
     "cooling": 8146084597507982,
     "De": 1201690146284608000,
     "Ds": 0,
     "Dw": 3278933333333333.5,
     "domains": [
      {
       "id": "main",
       "P": 6168401077645663000,
       "reactors": [
        13,
        14,
        19,
        20
       ],
       "sources": [
        {
         "moduleIndex": 13,
         "P": 2430108500093576000
        },
        {
         "moduleIndex": 14,
         "P": 2431259531269742600
        },
        {
         "moduleIndex": 19,
         "P": 653516523141172400
        },
        {
         "moduleIndex": 20,
         "P": 653516523141172400
        }
       ],
       "modules": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36,
        37,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        46,
        47,
        48,
        49,
        50
       ],
       "protection": 1
      }
     ],
     "powerPaths": [
      {
       "kind": "power",
       "from": "p24",
       "to": "hotel",
       "cap": 36719714777178024,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p3",
       "cap": 689527598969072.1,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p4",
       "cap": 689527598969072.1,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p5",
       "cap": 811776248780487.9,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p24",
       "to": "p6",
       "cap": 811776248780487.9,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "p13",
       "cap": 2159983222186942.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "p14",
       "cap": 2159983222186942.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p24",
       "to": "p15",
       "cap": 2159983222186942.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p24",
       "to": "p16",
       "cap": 2159983222186942.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "p34",
       "cap": 2159983222186942.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "p35",
       "cap": 2159983222186942.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "p36",
       "cap": 2159983222186942.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "p37",
       "cap": 2159983222186942.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "p38",
       "cap": 2159983222186942.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "p39",
       "cap": 2159983222186942.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p24",
       "to": "p40",
       "cap": 2159983222186942.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p24",
       "to": "p41",
       "cap": 2159983222186942.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p24",
       "to": "p42",
       "cap": 2159983222186942.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p24",
       "to": "p43",
       "cap": 2159983222186942.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "p44",
       "cap": 2159983222186942.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "p45",
       "cap": 2159983222186942.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "f25",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "f26",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "f27",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "f28",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "f29",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "f30",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "f31",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "f32",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "f33",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "f25",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "f26",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "f27",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "f28",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "f29",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "f30",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "f31",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "f32",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "f33",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "f25",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "f26",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "f27",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "f28",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "f29",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "f30",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "f31",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "f32",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "f33",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p24",
       "to": "f25",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p24",
       "to": "f26",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p24",
       "to": "f27",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p24",
       "to": "f28",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p24",
       "to": "f29",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p24",
       "to": "f30",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p24",
       "to": "f31",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p24",
       "to": "f32",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p24",
       "to": "f33",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p46",
       "cap": 5143476902008862,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p46",
       "cap": 5143476902008862,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "p46",
       "cap": 5143476902008862,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p24",
       "to": "p46",
       "cap": 5143476902008862,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p-6000000",
       "cap": 217183730695201760,
       "auto": false,
       "ok": true,
       "capacityGroup": "p17>p19",
       "groupCap": 217183730695201760,
       "physical": true,
       "routeId": "p17>p19",
       "efficiency": 0.9999975649350498
      },
      {
       "kind": "power",
       "from": "p-6000000",
       "to": "p19",
       "cap": 217183730695201760,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p17>p19",
       "efficiency": 1
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p-6000001",
       "cap": 217183730695201760,
       "auto": false,
       "ok": true,
       "capacityGroup": "p18>p20",
       "groupCap": 217183730695201760,
       "physical": true,
       "routeId": "p18>p20",
       "efficiency": 0.9999975649350498
      },
      {
       "kind": "power",
       "from": "p-6000001",
       "to": "p20",
       "cap": 217183730695201760,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p18>p20",
       "efficiency": 1
      },
      {
       "kind": "power",
       "from": "p23",
       "to": "p-6000002",
       "cap": 383661342447102200,
       "auto": false,
       "ok": true,
       "capacityGroup": "p23>p21",
       "groupCap": 383661342447102200,
       "physical": true,
       "routeId": "p23>p21",
       "efficiency": 0.9999987119711847
      },
      {
       "kind": "power",
       "from": "p-6000002",
       "to": "p21",
       "cap": 383661342447102200,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p23>p21",
       "efficiency": 1
      },
      {
       "kind": "power",
       "from": "p24",
       "to": "p-6000003",
       "cap": 383661342447102200,
       "auto": false,
       "ok": true,
       "capacityGroup": "p24>p22",
       "groupCap": 383661342447102200,
       "physical": true,
       "routeId": "p24>p22",
       "efficiency": 0.9999987119711847
      },
      {
       "kind": "power",
       "from": "p-6000003",
       "to": "p22",
       "cap": 383661342447102200,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p24>p22",
       "efficiency": 1
      }
     ],
     "trunks": [
      {
       "port": "p-6000000",
       "moduleIndex": 38
      },
      {
       "port": "p-6000001",
       "moduleIndex": 39
      },
      {
       "port": "p-6000002",
       "moduleIndex": 40
      },
      {
       "port": "p-6000003",
       "moduleIndex": 41
      }
     ],
     "fixedLoads": [
      {
       "id": "hotel",
       "port": "hotel",
       "weight": 26573630179670040,
       "domain": "main"
      },
      {
       "id": "f31",
       "port": "f31",
       "domain": "main",
       "weight": 1000000000000000
      },
      {
       "id": "f32",
       "port": "f32",
       "domain": "main",
       "weight": 1000000000000000
      }
     ],
     "coolingLoads": [
      {
       "id": "p46",
       "port": "p46",
       "weight": 5143476902008862,
       "domain": "main"
      },
      {
       "id": "p3",
       "port": "p3",
       "weight": 689527598969072.1,
       "domain": "main"
      },
      {
       "id": "p4",
       "port": "p4",
       "weight": 689527598969072.1,
       "domain": "main"
      },
      {
       "id": "p5",
       "port": "p5",
       "weight": 811776248780487.9,
       "domain": "main"
      },
      {
       "id": "p6",
       "port": "p6",
       "weight": 811776248780487.9,
       "domain": "main"
      }
     ]
    },
    "propulsion": {
     "version": 1,
     "architectureVersion": 2,
     "cores": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 22647805528015364,
       "densityFactor": 9.589614783054596,
       "efficiency": 0.6645769851807001,
       "wasteFraction": 0.3354230148192999,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 2858961478.30546,
       "ratedShaftPowerW": 144335308975714270,
       "ratedWasteHeatW": 72848421719487500,
       "thermalStoreJ": 67943416584046100,
       "version": 1,
       "id": 19,
       "machineryId": 19,
       "coreId": 19,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 217183730695201760,
       "driveProfileId": "standard",
       "machineryGradeId": "dense",
       "ratedThrustN": 75965952.09248118,
       "effectiveMachineryVolumeM3": 0.06661119272945695,
       "machineryVolumeM3": 0.06661119272945695,
       "machineryShape": "frustum",
       "machineryLengthM": 0.4990999999999998,
       "machineryRadiusM": 0.23099999999999998,
       "machineryDiameterM": 0.46199999999999997,
       "machineryOffsetM": 1,
       "maxInputW": 226478055280153630,
       "maxRatedInputW": 226478055280153630,
       "inputDensityWPerM3": 3260469026238563000,
       "allowedInputDensityWPerM3": 3400000000000000000,
       "cost": 177.7100723465192,
       "powerNode": "p19",
       "heatNode": "p19",
       "reactorId": 17,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 15,
       "machineryModuleIndex": 34,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 217183201838711400,
       "transmissionRouteIds": [
        "p17>p19"
       ]
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 22647805528015364,
       "densityFactor": 9.589614783054596,
       "efficiency": 0.6645769851807001,
       "wasteFraction": 0.3354230148192999,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 2858961478.30546,
       "ratedShaftPowerW": 144335308975714270,
       "ratedWasteHeatW": 72848421719487500,
       "thermalStoreJ": 67943416584046100,
       "version": 1,
       "id": 20,
       "machineryId": 20,
       "coreId": 20,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 217183730695201760,
       "driveProfileId": "standard",
       "machineryGradeId": "dense",
       "ratedThrustN": 75965952.09248118,
       "effectiveMachineryVolumeM3": 0.06661119272945695,
       "machineryVolumeM3": 0.06661119272945695,
       "machineryShape": "frustum",
       "machineryLengthM": 0.4990999999999998,
       "machineryRadiusM": 0.23099999999999998,
       "machineryDiameterM": 0.46199999999999997,
       "machineryOffsetM": 1,
       "maxInputW": 226478055280153630,
       "maxRatedInputW": 226478055280153630,
       "inputDensityWPerM3": 3260469026238563000,
       "allowedInputDensityWPerM3": 3400000000000000000,
       "cost": 177.7100723465192,
       "powerNode": "p20",
       "heatNode": "p20",
       "reactorId": 18,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 16,
       "machineryModuleIndex": 35,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 217183201838711400,
       "transmissionRouteIds": [
        "p18>p20"
       ]
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 25313777578832610,
       "densityFactor": 15.156226337704728,
       "efficiency": 0.5562675399836569,
       "wasteFraction": 0.44373246001634314,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 3415622633.770473,
       "ratedShaftPowerW": 213418351149876900,
       "ratedWasteHeatW": 170242991297225300,
       "thermalStoreJ": 75941332736497820,
       "version": 1,
       "id": 21,
       "machineryId": 21,
       "coreId": 21,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 383661342447102200,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 112325447.97361942,
       "effectiveMachineryVolumeM3": 0.07445228699656649,
       "machineryVolumeM3": 0.07445228699656649,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.315,
       "machineryDiameterM": 0.63,
       "machineryOffsetM": 0.95,
       "maxInputW": 2531377757883260400,
       "maxRatedInputW": 2531377757883260400,
       "inputDensityWPerM3": 5153116954819609000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 1047.0957661878315,
       "powerNode": "p21",
       "heatNode": "p21",
       "reactorId": 23,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 17,
       "machineryModuleIndex": 36,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 383660848280237800,
       "transmissionRouteIds": [
        "p23>p21"
       ]
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 25313777578832610,
       "densityFactor": 15.156226337704728,
       "efficiency": 0.5562675399836569,
       "wasteFraction": 0.44373246001634314,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 3415622633.770473,
       "ratedShaftPowerW": 213418351149876900,
       "ratedWasteHeatW": 170242991297225300,
       "thermalStoreJ": 75941332736497820,
       "version": 1,
       "id": 22,
       "machineryId": 22,
       "coreId": 22,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 383661342447102200,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 112325447.97361942,
       "effectiveMachineryVolumeM3": 0.07445228699656649,
       "machineryVolumeM3": 0.07445228699656649,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.315,
       "machineryDiameterM": 0.63,
       "machineryOffsetM": 0.95,
       "maxInputW": 2531377757883260400,
       "maxRatedInputW": 2531377757883260400,
       "inputDensityWPerM3": 5153116954819609000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 1047.0957661878315,
       "powerNode": "p22",
       "heatNode": "p22",
       "reactorId": 24,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 18,
       "machineryModuleIndex": 37,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 383660848280237800,
       "transmissionRouteIds": [
        "p24>p22"
       ]
      }
     ],
     "engines": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 22647805528015364,
       "densityFactor": 9.589614783054596,
       "efficiency": 0.6645769851807001,
       "wasteFraction": 0.3354230148192999,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 2858961478.30546,
       "ratedShaftPowerW": 144335308975714270,
       "ratedWasteHeatW": 72848421719487500,
       "thermalStoreJ": 67943416584046100,
       "version": 1,
       "id": 19,
       "machineryId": 19,
       "coreId": 19,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 217183730695201760,
       "driveProfileId": "standard",
       "machineryGradeId": "dense",
       "ratedThrustN": 75965952.09248118,
       "effectiveMachineryVolumeM3": 0.06661119272945695,
       "machineryVolumeM3": 0.06661119272945695,
       "machineryShape": "frustum",
       "machineryLengthM": 0.4990999999999998,
       "machineryRadiusM": 0.23099999999999998,
       "machineryDiameterM": 0.46199999999999997,
       "machineryOffsetM": 1,
       "maxInputW": 226478055280153630,
       "maxRatedInputW": 226478055280153630,
       "inputDensityWPerM3": 3260469026238563000,
       "allowedInputDensityWPerM3": 3400000000000000000,
       "cost": 177.7100723465192,
       "powerNode": "p19",
       "heatNode": "p19",
       "reactorId": 17,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 15,
       "coreModuleIndex": 15,
       "machineryModuleIndex": 34,
       "shaftModuleIndices": [],
       "shaftCapacityW": 144335308975714270,
       "ratedShaftCapacityW": 144335308975714270,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 217183201838711400
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 22647805528015364,
       "densityFactor": 9.589614783054596,
       "efficiency": 0.6645769851807001,
       "wasteFraction": 0.3354230148192999,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 2858961478.30546,
       "ratedShaftPowerW": 144335308975714270,
       "ratedWasteHeatW": 72848421719487500,
       "thermalStoreJ": 67943416584046100,
       "version": 1,
       "id": 20,
       "machineryId": 20,
       "coreId": 20,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 217183730695201760,
       "driveProfileId": "standard",
       "machineryGradeId": "dense",
       "ratedThrustN": 75965952.09248118,
       "effectiveMachineryVolumeM3": 0.06661119272945695,
       "machineryVolumeM3": 0.06661119272945695,
       "machineryShape": "frustum",
       "machineryLengthM": 0.4990999999999998,
       "machineryRadiusM": 0.23099999999999998,
       "machineryDiameterM": 0.46199999999999997,
       "machineryOffsetM": 1,
       "maxInputW": 226478055280153630,
       "maxRatedInputW": 226478055280153630,
       "inputDensityWPerM3": 3260469026238563000,
       "allowedInputDensityWPerM3": 3400000000000000000,
       "cost": 177.7100723465192,
       "powerNode": "p20",
       "heatNode": "p20",
       "reactorId": 18,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 16,
       "coreModuleIndex": 16,
       "machineryModuleIndex": 35,
       "shaftModuleIndices": [],
       "shaftCapacityW": 144335308975714270,
       "ratedShaftCapacityW": 144335308975714270,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 217183201838711400
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 25313777578832610,
       "densityFactor": 15.156226337704728,
       "efficiency": 0.5562675399836569,
       "wasteFraction": 0.44373246001634314,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 3415622633.770473,
       "ratedShaftPowerW": 213418351149876900,
       "ratedWasteHeatW": 170242991297225300,
       "thermalStoreJ": 75941332736497820,
       "version": 1,
       "id": 21,
       "machineryId": 21,
       "coreId": 21,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 383661342447102200,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 112325447.97361942,
       "effectiveMachineryVolumeM3": 0.07445228699656649,
       "machineryVolumeM3": 0.07445228699656649,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.315,
       "machineryDiameterM": 0.63,
       "machineryOffsetM": 0.95,
       "maxInputW": 2531377757883260400,
       "maxRatedInputW": 2531377757883260400,
       "inputDensityWPerM3": 5153116954819609000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 1047.0957661878315,
       "powerNode": "p21",
       "heatNode": "p21",
       "reactorId": 23,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 17,
       "coreModuleIndex": 17,
       "machineryModuleIndex": 36,
       "shaftModuleIndices": [],
       "shaftCapacityW": 213418351149876900,
       "ratedShaftCapacityW": 213418351149876900,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 383660848280237800
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 25313777578832610,
       "densityFactor": 15.156226337704728,
       "efficiency": 0.5562675399836569,
       "wasteFraction": 0.44373246001634314,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 3415622633.770473,
       "ratedShaftPowerW": 213418351149876900,
       "ratedWasteHeatW": 170242991297225300,
       "thermalStoreJ": 75941332736497820,
       "version": 1,
       "id": 22,
       "machineryId": 22,
       "coreId": 22,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 383661342447102200,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 112325447.97361942,
       "effectiveMachineryVolumeM3": 0.07445228699656649,
       "machineryVolumeM3": 0.07445228699656649,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.315,
       "machineryDiameterM": 0.63,
       "machineryOffsetM": 0.95,
       "maxInputW": 2531377757883260400,
       "maxRatedInputW": 2531377757883260400,
       "inputDensityWPerM3": 5153116954819609000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 1047.0957661878315,
       "powerNode": "p22",
       "heatNode": "p22",
       "reactorId": 24,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 18,
       "coreModuleIndex": 18,
       "machineryModuleIndex": 37,
       "shaftModuleIndices": [],
       "shaftCapacityW": 213418351149876900,
       "ratedShaftCapacityW": 213418351149876900,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 383660848280237800
      }
     ],
     "massKg": 27230.740327084455,
     "ratedThrustN": 376582800.1322012,
     "ratedAccelMps2": 13829.326548189416,
     "structuralAccelerationLimitMps2": 1895672.0138799879,
     "inertialFactor": 1,
     "accelerationLimitMps2": 13829.326548189416
    },
    "profileVersion": 18,
    "heat": {
     "v": 3,
     "mode": "strict",
     "src": [
      {
       "k": "reactor",
       "id": "p17",
       "n": "反応炉 #17",
       "g": "high",
       "sh": 0.182902,
       "st": 545057867467904500,
       "m": [
        13
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "reactor",
       "id": "p18",
       "n": "反応炉 #18",
       "g": "high",
       "sh": 0.175465,
       "st": 522895819906010050,
       "m": [
        14
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "reactor",
       "id": "p23",
       "n": "主反応炉 #23",
       "g": "high",
       "sh": 0.308983,
       "st": 920787221873045200,
       "m": [
        19
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "reactor",
       "id": "p24",
       "n": "主反応炉 #24",
       "g": "high",
       "sh": 0.332649,
       "st": 991312197301326700,
       "m": [
        20
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p19",
       "n": "推進機関 #19",
       "g": "high",
       "sh": 0.149837,
       "st": 67943416584046100,
       "m": [
        15,
        34
       ],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p20",
       "n": "推進機関 #20",
       "g": "high",
       "sh": 0.149837,
       "st": 67943416584046100,
       "m": [
        16,
        35
       ],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p21",
       "n": "主推進機関 #21",
       "g": "high",
       "sh": 0.350163,
       "st": 75941332736497820,
       "m": [
        17,
        36
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p22",
       "n": "主推進機関 #22",
       "g": "high",
       "sh": 0.350163,
       "st": 75941332736497820,
       "m": [
        18,
        37
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "feed",
       "id": "p-6000000",
       "n": "推進配電路 1",
       "g": "high",
       "sh": 0.258477,
       "st": 31731389424000,
       "m": [
        38
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1,
       "routeId": "p17>p19"
      },
      {
       "k": "feed",
       "id": "p-6000001",
       "n": "推進配電路 2",
       "g": "high",
       "sh": 0.258477,
       "st": 31731389424000,
       "m": [
        39
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1,
       "routeId": "p18>p20"
      },
      {
       "k": "feed",
       "id": "p-6000002",
       "n": "推進配電路 3",
       "g": "high",
       "sh": 0.241523,
       "st": 29650011863040,
       "m": [
        40
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1,
       "routeId": "p23>p21"
      },
      {
       "k": "feed",
       "id": "p-6000003",
       "n": "推進配電路 4",
       "g": "high",
       "sh": 0.241523,
       "st": 29650011863040,
       "m": [
        41
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1,
       "routeId": "p24>p22"
      },
      {
       "k": "weapon",
       "id": "f25",
       "n": "武装（艦首区画）",
       "g": "high",
       "sh": 0.810568,
       "st": 49833707819761560,
       "m": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "weapon",
       "id": "f33",
       "n": "武装（艦尾区画）",
       "g": "high",
       "sh": 0.189432,
       "st": 11646292180238430,
       "m": [
        8
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "hotel",
       "id": "hotel",
       "n": "生活・電子設備",
       "g": "low",
       "sh": 1,
       "st": 2203182886630681300,
       "m": [],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      }
     ],
     "dis": [
      {
       "id": "p46",
       "n": "機体内高エネルギー散逸装置 1 #46",
       "k": "hdis",
       "g": "high",
       "cap": 342898460133924160,
       "m": 33,
       "sec": 0,
       "src": -1,
       "power": 5143476902008862
      },
      {
       "id": "p3",
       "n": "上翼 #3",
       "k": "wing",
       "g": "high",
       "cap": 68952759896907220,
       "m": 42,
       "sec": 3,
       "src": -1,
       "power": 689527598969072.1
      },
      {
       "id": "p4",
       "n": "上翼 #4",
       "k": "wing",
       "g": "high",
       "cap": 68952759896907220,
       "m": 43,
       "sec": 3,
       "src": -1,
       "power": 689527598969072.1
      },
      {
       "id": "p5",
       "n": "下翼 #5",
       "k": "wing",
       "g": "high",
       "cap": 81177624878048780,
       "m": 44,
       "sec": 1,
       "src": -1,
       "power": 811776248780487.9
      },
      {
       "id": "p6",
       "n": "下翼 #6",
       "k": "wing",
       "g": "high",
       "cap": 81177624878048780,
       "m": 45,
       "sec": 1,
       "src": -1,
       "power": 811776248780487.9
      },
      {
       "id": "skin",
       "n": "外殻からの放熱",
       "k": "skin",
       "g": "low",
       "cap": 720198405320013600000,
       "m": -1,
       "sec": -1,
       "src": -1
      }
     ],
     "ln": [
      {
       "s": 0,
       "d": 0,
       "cap": 5811920122191231,
       "sec": 2
      },
      {
       "s": 0,
       "d": 1,
       "cap": 1168707297690801.8,
       "sec": 4
      },
      {
       "s": 0,
       "d": 2,
       "cap": 1168707297690801.8,
       "sec": 4
      },
      {
       "s": 0,
       "d": 3,
       "cap": 1375911315892627.5,
       "sec": 4
      },
      {
       "s": 0,
       "d": 4,
       "cap": 1375911315892627.5,
       "sec": 4
      },
      {
       "s": 1,
       "d": 0,
       "cap": 5575607506849488,
       "sec": 2
      },
      {
       "s": 1,
       "d": 1,
       "cap": 1121187670393830.5,
       "sec": 4
      },
      {
       "s": 1,
       "d": 2,
       "cap": 1121187670393830.5,
       "sec": 4
      },
      {
       "s": 1,
       "d": 3,
       "cap": 1319966775241525.2,
       "sec": 4
      },
      {
       "s": 1,
       "d": 4,
       "cap": 1319966775241525.2,
       "sec": 4
      },
      {
       "s": 2,
       "d": 0,
       "cap": 9818300225481356,
       "sec": 0
      },
      {
       "s": 2,
       "d": 1,
       "cap": 1974342193834739.8,
       "sec": 2
      },
      {
       "s": 2,
       "d": 2,
       "cap": 1974342193834739.8,
       "sec": 2
      },
      {
       "s": 2,
       "d": 3,
       "cap": 2324379912155034.5,
       "sec": 2
      },
      {
       "s": 2,
       "d": 4,
       "cap": 2324379912155034.5,
       "sec": 2
      },
      {
       "s": 3,
       "d": 0,
       "cap": 10570303908526636,
       "sec": 0
      },
      {
       "s": 3,
       "d": 1,
       "cap": 2125561098050172.5,
       "sec": 2
      },
      {
       "s": 3,
       "d": 2,
       "cap": 2125561098050172.5,
       "sec": 2
      },
      {
       "s": 3,
       "d": 3,
       "cap": 2502408920699775.5,
       "sec": 2
      },
      {
       "s": 3,
       "d": 4,
       "cap": 2502408920699775.5,
       "sec": 2
      },
      {
       "s": 4,
       "d": 0,
       "cap": 46606599050064970,
       "sec": 0
      },
      {
       "s": 4,
       "d": 1,
       "cap": 9372027021222006,
       "sec": 3
      },
      {
       "s": 4,
       "d": 2,
       "cap": 9372027021222006,
       "sec": 3
      },
      {
       "s": 4,
       "d": 3,
       "cap": 11033624977639532,
       "sec": 2
      },
      {
       "s": 4,
       "d": 4,
       "cap": 11033624977639532,
       "sec": 2
      },
      {
       "s": 5,
       "d": 0,
       "cap": 46606599050064970,
       "sec": 0
      },
      {
       "s": 5,
       "d": 1,
       "cap": 9372027021222006,
       "sec": 3
      },
      {
       "s": 5,
       "d": 2,
       "cap": 9372027021222006,
       "sec": 3
      },
      {
       "s": 5,
       "d": 3,
       "cap": 11033624977639532,
       "sec": 2
      },
      {
       "s": 5,
       "d": 4,
       "cap": 11033624977639532,
       "sec": 2
      },
      {
       "s": 6,
       "d": 0,
       "cap": 108917337606264980,
       "sec": 0
      },
      {
       "s": 6,
       "d": 1,
       "cap": 21901967788487496,
       "sec": 2
      },
      {
       "s": 6,
       "d": 2,
       "cap": 21901967788487496,
       "sec": 2
      },
      {
       "s": 6,
       "d": 3,
       "cap": 25785040771148210,
       "sec": 0
      },
      {
       "s": 6,
       "d": 4,
       "cap": 25785040771148210,
       "sec": 0
      },
      {
       "s": 7,
       "d": 0,
       "cap": 108917337606264980,
       "sec": 0
      },
      {
       "s": 7,
       "d": 1,
       "cap": 21901967788487496,
       "sec": 2
      },
      {
       "s": 7,
       "d": 2,
       "cap": 21901967788487496,
       "sec": 2
      },
      {
       "s": 7,
       "d": 3,
       "cap": 25785040771148210,
       "sec": 0
      },
      {
       "s": 7,
       "d": 4,
       "cap": 25785040771148210,
       "sec": 0
      },
      {
       "s": 8,
       "d": 0,
       "cap": 322688564287.5491,
       "sec": 2
      },
      {
       "s": 8,
       "d": 1,
       "cap": 64888792694.21888,
       "sec": 4
      },
      {
       "s": 8,
       "d": 2,
       "cap": 64888792694.21888,
       "sec": 4
      },
      {
       "s": 8,
       "d": 3,
       "cap": 76393143363.60655,
       "sec": 3
      },
      {
       "s": 8,
       "d": 4,
       "cap": 76393143363.60655,
       "sec": 3
      },
      {
       "s": 9,
       "d": 0,
       "cap": 322688564287.5491,
       "sec": 2
      },
      {
       "s": 9,
       "d": 1,
       "cap": 64888792694.21888,
       "sec": 4
      },
      {
       "s": 9,
       "d": 2,
       "cap": 64888792694.21888,
       "sec": 4
      },
      {
       "s": 9,
       "d": 3,
       "cap": 76393143363.60655,
       "sec": 3
      },
      {
       "s": 9,
       "d": 4,
       "cap": 76393143363.60655,
       "sec": 3
      },
      {
       "s": 10,
       "d": 0,
       "cap": 282150941776.44995,
       "sec": 0
      },
      {
       "s": 10,
       "d": 1,
       "cap": 56737163927.185104,
       "sec": 2
      },
      {
       "s": 10,
       "d": 2,
       "cap": 56737163927.185104,
       "sec": 2
      },
      {
       "s": 10,
       "d": 3,
       "cap": 66796285120.58993,
       "sec": 2
      },
      {
       "s": 10,
       "d": 4,
       "cap": 66796285120.58993,
       "sec": 2
      },
      {
       "s": 11,
       "d": 0,
       "cap": 282150941776.44995,
       "sec": 0
      },
      {
       "s": 11,
       "d": 1,
       "cap": 56737163927.185104,
       "sec": 2
      },
      {
       "s": 11,
       "d": 2,
       "cap": 56737163927.185104,
       "sec": 2
      },
      {
       "s": 11,
       "d": 3,
       "cap": 66796285120.58993,
       "sec": 2
      },
      {
       "s": 11,
       "d": 4,
       "cap": 66796285120.58993,
       "sec": 2
      },
      {
       "s": 12,
       "d": 0,
       "cap": 531373908217415.94,
       "sec": 2
      },
      {
       "s": 12,
       "d": 1,
       "cap": 106852907693101.05,
       "sec": 4
      },
      {
       "s": 12,
       "d": 2,
       "cap": 106852907693101.05,
       "sec": 4
      },
      {
       "s": 12,
       "d": 3,
       "cap": 125797216395806.58,
       "sec": 4
      },
      {
       "s": 12,
       "d": 4,
       "cap": 125797216395806.58,
       "sec": 4
      },
      {
       "s": 13,
       "d": 0,
       "cap": 124183731510364.55,
       "sec": 0
      },
      {
       "s": 13,
       "d": 1,
       "cap": 24971856154127.44,
       "sec": 2
      },
      {
       "s": 13,
       "d": 2,
       "cap": 24971856154127.44,
       "sec": 2
      },
      {
       "s": 13,
       "d": 3,
       "cap": 29399199893074.58,
       "sec": 1
      },
      {
       "s": 13,
       "d": 4,
       "cap": 29399199893074.58,
       "sec": 1
      },
      {
       "s": 14,
       "d": 0,
       "cap": 55079572165767040,
       "sec": 0
      },
      {
       "s": 14,
       "d": 3,
       "cap": 55079572165767040,
       "sec": 0
      },
      {
       "s": 14,
       "d": 4,
       "cap": 55079572165767040,
       "sec": 0
      },
      {
       "s": 14,
       "d": 1,
       "cap": 55079572165767040,
       "sec": 2
      },
      {
       "s": 14,
       "d": 2,
       "cap": 55079572165767040,
       "sec": 2
      },
      {
       "s": 14,
       "d": 5,
       "cap": 720198405320013600000,
       "sec": -1
      }
     ]
    },
    "speedReference": {
     "version": 1,
     "key": "hyena",
     "status": "published",
     "mglt": 110,
     "model": "Hyena-class Droid Fighter/Bomber",
     "scope": "class",
     "continuity": "canon",
     "source": "https://starwars.fandom.com/wiki/Megalight_per_hour"
    },
    "mglt": 110,
    "maxSpeed": 2200
   },
   "fireArcs": [
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      0,
      1
     ],
     "pos": [
      10.67,
      2.35,
      4.5360001335144045
     ],
     "k": "claser",
     "gun": 0.25,
     "aa": 0.25,
     "cycle": 0.12
    },
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      0,
      -1
     ],
     "pos": [
      10.67,
      2.35,
      -4.5360001335144045
     ],
     "k": "claser",
     "gun": 0.25,
     "aa": 0.25,
     "cycle": 0.12
    },
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      0,
      1
     ],
     "pos": [
      10.67,
      1.18,
      4.5360001335144045
     ],
     "k": "claser",
     "gun": 0.25,
     "aa": 0.25,
     "cycle": 0.12
    },
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      0,
      -1
     ],
     "pos": [
      10.67,
      1.18,
      -4.5360001335144045
     ],
     "k": "claser",
     "gun": 0.25,
     "aa": 0.25,
     "cycle": 0.12
    }
   ]
  },
  "tie_in": {
   "reference": "craft_tie_in",
   "signature": "8rgzjt",
   "build": 99333,
   "crew": 1000,
   "total": 100333,
   "by": {
    "hull": 16,
    "armor": 8,
    "power": 21468,
    "drive": 30239,
    "defense": 1500,
    "command": 14502,
    "weapons": 19600,
    "systems": 12000,
    "crew": 1000
   },
   "detailed": true,
   "systems": {
    "v": 1,
    "managed": true,
    "power": 14044316900000000,
    "crew": 1,
    "suitSeats": 1,
    "lifeSupportCapacity": 0,
    "lifeSupportHours": 4,
    "ejectionSeats": 1,
    "ejectionCoverage": 1,
    "ejectionSurvival": 0.9,
    "navCapacity": 1.331,
    "navReady": true,
    "targetDemand": 4,
    "targetCapacity": 4.920750000000001,
    "targetRatio": 1,
    "fireK": 1,
    "maneuverSupport": 23.328,
    "maneuverRatio": 1,
    "turnK": 1,
    "laserUnits": 4,
    "laserGunShare": 1,
    "laserAaShare": 1,
    "laserGasSeconds": 643.1249999999999,
    "landingSupport": 23.582400000000007,
    "landingRatio": 1,
    "landingReady": true
   },
   "heat": {
    "up": 0.00000596,
    "upS": 0.00000596,
    "down": 0.39,
    "T": 0
   },
   "powerProfile": {
    "name": "TIE/in インターセプター",
    "modules": [
     {
      "k": "weapon",
      "fit": 37,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.857,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": 0.34,
      "z": 0.93,
      "r": 0.135,
      "share": 0.25,
      "domain": "main",
      "port": "f37",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 38,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.857,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.34,
      "z": 0.93,
      "r": 0.135,
      "share": 0.25,
      "domain": "main",
      "port": "f38",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 39,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.857,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": 0.34,
      "z": -0.93,
      "r": 0.135,
      "share": 0.25,
      "domain": "main",
      "port": "f39",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 40,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.857,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.34,
      "z": -0.93,
      "r": 0.135,
      "share": 0.25,
      "domain": "main",
      "port": "f40",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "操縦席",
      "w": 0.8741414753213742,
      "hits": 1,
      "crew": 0,
      "size": 0.817283234436282,
      "at": 0.295,
      "part": 31,
      "y": 0.28,
      "z": 0,
      "r": 0.048,
      "share": 0.7332166204610195,
      "domain": "main",
      "port": "p31",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "I-a3a 太陽イオン化反応炉",
      "w": 1.8613816988364742,
      "hits": 1,
      "crew": 0.00027646888847813566,
      "size": 1.3823444423906783,
      "at": 0.448,
      "part": 32,
      "y": -0.04,
      "z": 0,
      "r": 0.058,
      "share": 1,
      "domain": "main",
      "port": "p32",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "P-s5.6 イオン・エンジン",
      "w": 1.6677111065966115,
      "hits": 1,
      "crew": 0.0008614721122474642,
      "size": 2.1536802806186603,
      "at": 0.282,
      "part": 33,
      "y": -0.03,
      "z": 0.16,
      "r": 0.067,
      "share": 0.46291848654995243,
      "domain": "main",
      "port": "p33",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "P-s5.6 イオン・エンジン",
      "w": 1.6677111065966115,
      "hits": 1,
      "crew": 0.0008614721122474642,
      "size": 2.1536802806186603,
      "at": 0.282,
      "part": 34,
      "y": -0.03,
      "z": -0.16,
      "r": 0.067,
      "share": 0.46291848654995243,
      "domain": "main",
      "port": "p34",
      "powerConnected": true
     },
     {
      "k": "fuel",
      "name": "燃料タンク",
      "w": 0.15620841248566977,
      "hits": 1,
      "crew": 0.000012347715765669329,
      "size": 0.06173857882834664,
      "at": 0.322,
      "part": 35,
      "y": -0.35,
      "z": 0,
      "r": 0.02,
      "share": 1,
      "domain": "main",
      "port": "p35",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "慣性補償器",
      "w": 0.14456364674440614,
      "hits": 1,
      "crew": 0.000010993061013441406,
      "size": 0.054965305067207024,
      "at": 0.246,
      "part": 36,
      "y": -0.3,
      "z": 0,
      "r": 0.02,
      "share": 0.04931151591747049,
      "domain": "main",
      "port": "p36",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "射出座席機構 1",
      "w": 0.08410000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.024388999999999997,
      "at": 0.295,
      "part": 41,
      "y": -0.18,
      "z": 0,
      "r": 0.015,
      "share": 0.021880321781907266,
      "domain": "main",
      "port": "p41",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "航法コンピューター",
      "w": 0.048400000000000006,
      "hits": 1,
      "crew": 0,
      "size": 0.010648,
      "at": 0.318,
      "part": 42,
      "y": 0.24,
      "z": 0.14,
      "r": 0.011,
      "share": 0.00955273550919466,
      "domain": "main",
      "port": "p42",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "照準コンピューター",
      "w": 0.07290000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.019683000000000003,
      "at": 0.318,
      "part": 43,
      "y": 0.24,
      "z": 0.18,
      "r": 0.014,
      "share": 0.017658385896645243,
      "domain": "main",
      "port": "p43",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 1",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.305,
      "part": 44,
      "y": 0.24,
      "z": 0.14,
      "r": 0.009,
      "share": 0.005232114339746737,
      "domain": "main",
      "port": "p44",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 2",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.318,
      "part": 45,
      "y": 0.2,
      "z": 0.14,
      "r": 0.009,
      "share": 0.005232114339746737,
      "domain": "main",
      "port": "p45",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 3",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.318,
      "part": 46,
      "y": 0.28,
      "z": 0.14,
      "r": 0.009,
      "share": 0.005232114339746737,
      "domain": "main",
      "port": "p46",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 4",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.331,
      "part": 47,
      "y": 0.24,
      "z": 0.14,
      "r": 0.009,
      "share": 0.005232114339746737,
      "domain": "main",
      "port": "p47",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 1",
      "w": 0.1225,
      "hits": 1,
      "crew": 0,
      "size": 0.04287499999999999,
      "at": 0.293,
      "part": 48,
      "y": 0.24,
      "z": 0.19,
      "r": 0.018,
      "share": 0.038464832358820526,
      "domain": "main",
      "port": "p48",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 2",
      "w": 0.1225,
      "hits": 1,
      "crew": 0,
      "size": 0.04287499999999999,
      "at": 0.369,
      "part": 49,
      "y": 0.24,
      "z": 0.14,
      "r": 0.018,
      "share": 0.038464832358820526,
      "domain": "main",
      "port": "p49",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "翼端着陸支持機構 1",
      "w": 0.11560000000000004,
      "hits": 1,
      "crew": 0,
      "size": 0.03930400000000001,
      "at": 0.343,
      "part": 50,
      "y": 0.24,
      "z": 0.19,
      "r": 0.018,
      "share": 0.03526114917856753,
      "domain": "main",
      "port": "p50",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "翼端着陸支持機構 2",
      "w": 0.11560000000000004,
      "hits": 1,
      "crew": 0,
      "size": 0.03930400000000001,
      "at": 0.368,
      "part": 51,
      "y": 0.24,
      "z": 0.03,
      "r": 0.018,
      "share": 0.03526114917856753,
      "domain": "main",
      "port": "p51",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 1",
      "w": 0.14133486102032894,
      "hits": 1,
      "crew": 0.000002656708765173096,
      "size": 0.05313417530346192,
      "at": 0.293,
      "part": 52,
      "y": 0.03,
      "z": 0.35,
      "r": 0.019,
      "share": 0.003773675910954863,
      "domain": "main",
      "port": "p52",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.30990085336483386,
      "hits": 1,
      "crew": 0.00003450357962070508,
      "size": 0.1725178981035254,
      "at": 0.374,
      "part": -33,
      "machineryOwner": 33,
      "y": -0.03,
      "z": 0.16,
      "r": 0.029,
      "share": 0.03708151345004748,
      "domain": "main",
      "port": "p33",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.30990085336483386,
      "hits": 1,
      "crew": 0.00003450357962070508,
      "size": 0.1725178981035254,
      "at": 0.374,
      "part": -34,
      "machineryOwner": 34,
      "y": -0.03,
      "z": -0.16,
      "r": 0.029,
      "share": 0.03708151345004748,
      "domain": "main",
      "port": "p34",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p32 → p33",
      "w": 0.0032213925433638713,
      "hits": 1,
      "crew": 3.656751677376645e-8,
      "size": 0.00018283758386883223,
      "at": 0.387,
      "part": -6000000,
      "routeId": "p32>p33",
      "capacityW": 734990308592912000,
      "y": -0.03,
      "z": 0.15,
      "r": 0.003,
      "share": 0.5,
      "domain": "main",
      "port": "p-6000000",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p32 → p34",
      "w": 0.0032213925433638713,
      "hits": 1,
      "crew": 3.656751677376645e-8,
      "size": 0.00018283758386883223,
      "at": 0.387,
      "part": -6000001,
      "routeId": "p32>p34",
      "capacityW": 734990308592912000,
      "y": -0.03,
      "z": -0.15,
      "r": 0.003,
      "share": 0.5,
      "domain": "main",
      "port": "p-6000001",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "翼中央パネル",
      "w": 2.106778814353525,
      "hits": 1,
      "crew": 0,
      "size": 1.4212002960205246,
      "at": 0.119,
      "part": 3,
      "ext": 1,
      "y": 0,
      "z": 0.88,
      "r": 0.058,
      "share": 0.10093596618568655,
      "domain": "main",
      "port": "p3",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "翼中央パネル",
      "w": 2.106778814353525,
      "hits": 1,
      "crew": 0,
      "size": 1.4212002960205246,
      "at": 0.119,
      "part": 4,
      "ext": 1,
      "y": 0,
      "z": -0.88,
      "r": 0.058,
      "share": 0.10093596618568655,
      "domain": "main",
      "port": "p4",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "上翼板",
      "w": 5.292707162799864,
      "hits": 1,
      "crew": 0,
      "size": 2.7961708270315655,
      "at": 0.462,
      "part": 7,
      "ext": 1,
      "y": 0.69,
      "z": 0.66,
      "r": 0.073,
      "share": 0.19858861895606117,
      "domain": "main",
      "port": "p7",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "上翼板",
      "w": 5.29270719640971,
      "hits": 1,
      "crew": 0,
      "size": 2.796170853666008,
      "at": 0.462,
      "part": 8,
      "ext": 1,
      "y": 0.69,
      "z": -0.66,
      "r": 0.073,
      "share": 0.1985886208476828,
      "domain": "main",
      "port": "p8",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "下翼板",
      "w": 4.300323945400555,
      "hits": 1,
      "crew": 0,
      "size": 2.7961702180575654,
      "at": 0.462,
      "part": 17,
      "ext": 1,
      "y": -0.69,
      "z": 0.66,
      "r": 0.073,
      "share": 0.1985885757057331,
      "domain": "main",
      "port": "p17",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "下翼板",
      "w": 4.631118102858414,
      "hits": 1,
      "crew": 0,
      "size": 2.796170225132339,
      "at": 0.462,
      "part": 18,
      "ext": 1,
      "y": -0.69,
      "z": -0.66,
      "r": 0.073,
      "share": 0.19858857620819506,
      "domain": "main",
      "port": "p18",
      "powerConnected": true
     },
     {
      "k": "quarters",
      "name": "居住空間（後部）",
      "w": 0.875034984133114,
      "hits": 1,
      "crew": 0,
      "size": 14.089683458773807,
      "at": 0.155,
      "y": 0,
      "z": 0,
      "r": 0.125,
      "share": 0.3262942779291554,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央後部）",
      "w": 1.1619953516181811,
      "hits": 1,
      "crew": 0,
      "size": 21.56103961436576,
      "at": 0.35,
      "y": 0,
      "z": 0,
      "r": 0.144,
      "share": 0.4993188010899183,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央前部）",
      "w": 0.43863271692074474,
      "hits": 1,
      "crew": 0,
      "size": 5.000513962404065,
      "at": 0.616,
      "y": 0,
      "z": 0,
      "r": 0.089,
      "share": 0.11580381471389646,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（前部）",
      "w": 0.27848429507193045,
      "hits": 1,
      "crew": 0,
      "size": 2.529671769216174,
      "at": 0.831,
      "y": 0,
      "z": 0,
      "r": 0.071,
      "share": 0.05858310626702998,
      "domain": "main"
     },
     {
      "k": "hull",
      "name": "船体構造",
      "w": 23.05719491000247,
      "hits": null,
      "crew": 0,
      "size": 1,
      "share": 1,
      "domain": "main"
     }
    ],
    "energyModel": {
     "version": 0,
     "eta": 0.75
    },
    "D": 0,
    "shieldBuffer": 0,
    "wCap": 0,
    "crewNeed": 1,
    "crewMax": 1,
    "hp": 1,
    "len": 9.64800000476837,
    "width": 8.887999732971192,
    "height": 7.078812837600708,
    "grid": {
     "P": 7276773006109312000,
     "fixed": 31629672298734356,
     "cooling": 10494456243968028,
     "De": 1469980617185824000,
     "Ds": 0,
     "Dw": 278933333333333.38,
     "domains": [
      {
       "id": "main",
       "P": 7276773006109312000,
       "reactors": [
        5
       ],
       "sources": [
        {
         "moduleIndex": 26,
         "P": 1938000000000000
        },
        {
         "moduleIndex": 27,
         "P": 1938000000000000
        },
        {
         "moduleIndex": 28,
         "P": 8388507615769092
        },
        {
         "moduleIndex": 29,
         "P": 8388507615769092
        },
        {
         "moduleIndex": 30,
         "P": 8388507615769092
        },
        {
         "moduleIndex": 31,
         "P": 8388507615769092
        },
        {
         "moduleIndex": 5,
         "P": 7239342975646236000
        }
       ],
       "modules": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36
       ],
       "protection": 1
      }
     ],
     "powerPaths": [
      {
       "kind": "power",
       "from": "p32",
       "to": "hotel",
       "cap": 31629672298734356,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p3",
       "to": "p3",
       "cap": 53833333333333.33,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p4",
       "to": "p4",
       "cap": 53833333333333.33,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p7",
       "to": "p7",
       "cap": 582535251095075.9,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p8",
       "to": "p8",
       "cap": 582535251095075.9,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p17",
       "cap": 407774675766553.1,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p18",
       "cap": 466028200876060.6,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p31",
       "cap": 2108644819915623.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p35",
       "cap": 2108644819915623.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p36",
       "cap": 2108644819915623.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p41",
       "cap": 2108644819915623.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p42",
       "cap": 2108644819915623.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p43",
       "cap": 2108644819915623.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p44",
       "cap": 2108644819915623.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p45",
       "cap": 2108644819915623.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p46",
       "cap": 2108644819915623.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p47",
       "cap": 2108644819915623.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p48",
       "cap": 2108644819915623.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p49",
       "cap": 2108644819915623.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p50",
       "cap": 2108644819915623.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p51",
       "cap": 2108644819915623.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "f37",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "f38",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "f39",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "f40",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p52",
       "cap": 8347916198468596,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p-6000000",
       "cap": 734990308592912000,
       "auto": false,
       "ok": true,
       "capacityGroup": "p32>p33",
       "groupCap": 734990308592912000,
       "physical": true,
       "routeId": "p32>p33",
       "efficiency": 0.9999975123841183
      },
      {
       "kind": "power",
       "from": "p-6000000",
       "to": "p33",
       "cap": 734990308592912000,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p32>p33",
       "efficiency": 1
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p-6000001",
       "cap": 734990308592912000,
       "auto": false,
       "ok": true,
       "capacityGroup": "p32>p34",
       "groupCap": 734990308592912000,
       "physical": true,
       "routeId": "p32>p34",
       "efficiency": 0.9999975123841183
      },
      {
       "kind": "power",
       "from": "p-6000001",
       "to": "p34",
       "cap": 734990308592912000,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p32>p34",
       "efficiency": 1
      }
     ],
     "trunks": [
      {
       "port": "p-6000000",
       "moduleIndex": 24
      },
      {
       "port": "p-6000001",
       "moduleIndex": 25
      }
     ],
     "fixedLoads": [
      {
       "id": "hotel",
       "port": "hotel",
       "weight": 31629672298734356,
       "domain": "main"
      }
     ],
     "coolingLoads": [
      {
       "id": "p52",
       "port": "p52",
       "weight": 8347916198468596,
       "domain": "main"
      },
      {
       "id": "p3",
       "port": "p3",
       "weight": 53833333333333.33,
       "domain": "main"
      },
      {
       "id": "p4",
       "port": "p4",
       "weight": 53833333333333.33,
       "domain": "main"
      },
      {
       "id": "p7",
       "port": "p7",
       "weight": 582535251095075.9,
       "domain": "main"
      },
      {
       "id": "p8",
       "port": "p8",
       "weight": 582535251095075.9,
       "domain": "main"
      },
      {
       "id": "p17",
       "port": "p17",
       "weight": 407774675766553.1,
       "domain": "main"
      },
      {
       "id": "p18",
       "port": "p18",
       "weight": 466028200876060.6,
       "domain": "main"
      }
     ]
    },
    "propulsion": {
     "version": 1,
     "architectureVersion": 2,
     "cores": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 58656085355198650,
       "densityFactor": 12.530503939055835,
       "efficiency": 0.6025910666294585,
       "wasteFraction": 0.3974089333705415,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 3153050393.905584,
       "ratedShaftPowerW": 442898594017317700,
       "ratedWasteHeatW": 292091714575594300,
       "thermalStoreJ": 175968256065595940,
       "version": 1,
       "id": 33,
       "machineryId": 33,
       "coreId": 33,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 734990308592912000,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 233104523.16700932,
       "effectiveMachineryVolumeM3": 0.17251789810352544,
       "machineryVolumeM3": 0.17251789810352544,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.4795,
       "machineryDiameterM": 0.959,
       "machineryOffsetM": 0.7305,
       "maxInputW": 5865608535519865000,
       "maxRatedInputW": 5865608535519865000,
       "inputDensityWPerM3": 4260371339278984000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 1610.7131961638286,
       "powerNode": "p33",
       "heatNode": "p33",
       "reactorId": 32,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 6,
       "machineryModuleIndex": 22,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 734988480219347500,
       "transmissionRouteIds": [
        "p32>p33"
       ]
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 58656085355198650,
       "densityFactor": 12.530503939055835,
       "efficiency": 0.6025910666294585,
       "wasteFraction": 0.3974089333705415,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 3153050393.905584,
       "ratedShaftPowerW": 442898594017317700,
       "ratedWasteHeatW": 292091714575594300,
       "thermalStoreJ": 175968256065595940,
       "version": 1,
       "id": 34,
       "machineryId": 34,
       "coreId": 34,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 734990308592912000,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 233104523.16700932,
       "effectiveMachineryVolumeM3": 0.17251789810352544,
       "machineryVolumeM3": 0.17251789810352544,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.4795,
       "machineryDiameterM": 0.959,
       "machineryOffsetM": 0.7305,
       "maxInputW": 5865608535519865000,
       "maxRatedInputW": 5865608535519865000,
       "inputDensityWPerM3": 4260371339278984000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 1610.7131961638286,
       "powerNode": "p34",
       "heatNode": "p34",
       "reactorId": 32,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 7,
       "machineryModuleIndex": 23,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 734988480219347500,
       "transmissionRouteIds": [
        "p32>p34"
       ]
      }
     ],
     "engines": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 58656085355198650,
       "densityFactor": 12.530503939055835,
       "efficiency": 0.6025910666294585,
       "wasteFraction": 0.3974089333705415,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 3153050393.905584,
       "ratedShaftPowerW": 442898594017317700,
       "ratedWasteHeatW": 292091714575594300,
       "thermalStoreJ": 175968256065595940,
       "version": 1,
       "id": 33,
       "machineryId": 33,
       "coreId": 33,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 734990308592912000,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 233104523.16700932,
       "effectiveMachineryVolumeM3": 0.17251789810352544,
       "machineryVolumeM3": 0.17251789810352544,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.4795,
       "machineryDiameterM": 0.959,
       "machineryOffsetM": 0.7305,
       "maxInputW": 5865608535519865000,
       "maxRatedInputW": 5865608535519865000,
       "inputDensityWPerM3": 4260371339278984000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 1610.7131961638286,
       "powerNode": "p33",
       "heatNode": "p33",
       "reactorId": 32,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 6,
       "coreModuleIndex": 6,
       "machineryModuleIndex": 22,
       "shaftModuleIndices": [],
       "shaftCapacityW": 442898594017317700,
       "ratedShaftCapacityW": 442898594017317700,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 734988480219347500
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 58656085355198650,
       "densityFactor": 12.530503939055835,
       "efficiency": 0.6025910666294585,
       "wasteFraction": 0.3974089333705415,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 3153050393.905584,
       "ratedShaftPowerW": 442898594017317700,
       "ratedWasteHeatW": 292091714575594300,
       "thermalStoreJ": 175968256065595940,
       "version": 1,
       "id": 34,
       "machineryId": 34,
       "coreId": 34,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 734990308592912000,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 233104523.16700932,
       "effectiveMachineryVolumeM3": 0.17251789810352544,
       "machineryVolumeM3": 0.17251789810352544,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.4795,
       "machineryDiameterM": 0.959,
       "machineryOffsetM": 0.7305,
       "maxInputW": 5865608535519865000,
       "maxRatedInputW": 5865608535519865000,
       "inputDensityWPerM3": 4260371339278984000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 1610.7131961638286,
       "powerNode": "p34",
       "heatNode": "p34",
       "reactorId": 32,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 7,
       "coreModuleIndex": 7,
       "machineryModuleIndex": 23,
       "shaftModuleIndices": [],
       "shaftCapacityW": 442898594017317700,
       "ratedShaftCapacityW": 442898594017317700,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 734988480219347500
      }
     ],
     "massKg": 17676.451517039935,
     "ratedThrustN": 466209046.33401865,
     "ratedAccelMps2": 26374.583489485853,
     "structuralAccelerationLimitMps2": 539545.4994508824,
     "inertialFactor": 1,
     "accelerationLimitMps2": 26374.583489485853
    },
    "profileVersion": 18,
    "heat": {
     "v": 3,
     "mode": "strict",
     "src": [
      {
       "k": "reactor",
       "id": "p32",
       "n": "I-a3a 太陽イオン化反応炉 #32",
       "g": "high",
       "sh": 1,
       "st": 3599382438653741000,
       "m": [
        5
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p33",
       "n": "P-s5.6 イオン・エンジン #33",
       "g": "high",
       "sh": 0.5,
       "st": 175968256065595940,
       "m": [
        6,
        22
       ],
       "pc": [],
       "sec": 1,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p34",
       "n": "P-s5.6 イオン・エンジン #34",
       "g": "high",
       "sh": 0.5,
       "st": 175968256065595940,
       "m": [
        7,
        23
       ],
       "pc": [],
       "sec": 1,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "feed",
       "id": "p-6000000",
       "n": "推進配電路 1",
       "g": "high",
       "sh": 0.5,
       "st": 109702413872640,
       "m": [
        24
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1,
       "routeId": "p32>p33"
      },
      {
       "k": "feed",
       "id": "p-6000001",
       "n": "推進配電路 2",
       "g": "high",
       "sh": 0.5,
       "st": 109702413872640,
       "m": [
        25
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1,
       "routeId": "p32>p34"
      },
      {
       "k": "weapon",
       "id": "f37",
       "n": "武装（艦首区画）",
       "g": "high",
       "sh": 1,
       "st": 5230000000000001,
       "m": [
        0,
        1,
        2,
        3
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "hotel",
       "id": "hotel",
       "n": "生活・電子設備",
       "g": "low",
       "sh": 1,
       "st": 1897780337924061400,
       "m": [],
       "pc": [],
       "sec": 1,
       "sw": -1,
       "gen": -1
      }
     ],
     "dis": [
      {
       "id": "p52",
       "n": "機体内高エネルギー散逸装置 1 #52",
       "k": "hdis",
       "g": "high",
       "cap": 556527746564573060,
       "m": 21,
       "sec": 1,
       "src": -1,
       "power": 8347916198468596
      },
      {
       "id": "p3",
       "n": "翼中央パネル #3",
       "k": "solar",
       "g": "high",
       "cap": 5383333333333333,
       "m": 26,
       "sec": 0,
       "src": -1,
       "power": 53833333333333.33
      },
      {
       "id": "p4",
       "n": "翼中央パネル #4",
       "k": "solar",
       "g": "high",
       "cap": 5383333333333333,
       "m": 27,
       "sec": 0,
       "src": -1,
       "power": 53833333333333.33
      },
      {
       "id": "p7",
       "n": "上翼板 #7",
       "k": "solar",
       "g": "high",
       "cap": 58253525109507590,
       "m": 28,
       "sec": 3,
       "src": -1,
       "power": 582535251095075.9
      },
      {
       "id": "p8",
       "n": "上翼板 #8",
       "k": "solar",
       "g": "high",
       "cap": 58253525109507590,
       "m": 29,
       "sec": 3,
       "src": -1,
       "power": 582535251095075.9
      },
      {
       "id": "p17",
       "n": "下翼板 #17",
       "k": "solar",
       "g": "high",
       "cap": 40777467576655310,
       "m": 30,
       "sec": 3,
       "src": -1,
       "power": 407774675766553.1
      },
      {
       "id": "p18",
       "n": "下翼板 #18",
       "k": "solar",
       "g": "high",
       "cap": 46602820087606060,
       "m": 31,
       "sec": 3,
       "src": -1,
       "power": 466028200876060.6
      },
      {
       "id": "skin",
       "n": "外殻からの放熱",
       "k": "skin",
       "g": "low",
       "cap": 807404577362123300000,
       "m": -1,
       "sec": -1,
       "src": -1
      }
     ],
     "ln": [
      {
       "s": 0,
       "d": 0,
       "cap": 51950300813345010,
       "sec": 2
      },
      {
       "s": 0,
       "d": 1,
       "cap": 502519034803819.5,
       "sec": 1
      },
      {
       "s": 0,
       "d": 2,
       "cap": 502519034803819.5,
       "sec": 1
      },
      {
       "s": 0,
       "d": 3,
       "cap": 5437802825749193,
       "sec": 3
      },
      {
       "s": 0,
       "d": 4,
       "cap": 5437802825749193,
       "sec": 3
      },
      {
       "s": 0,
       "d": 5,
       "cap": 3806461978024435,
       "sec": 3
      },
      {
       "s": 0,
       "d": 6,
       "cap": 4350242260599353.5,
       "sec": 3
      },
      {
       "s": 1,
       "d": 0,
       "cap": 252946969901625920,
       "sec": 1
      },
      {
       "s": 1,
       "d": 1,
       "cap": 2446774420579748,
       "sec": 0
      },
      {
       "s": 1,
       "d": 2,
       "cap": 2446774420579748,
       "sec": 0
      },
      {
       "s": 1,
       "d": 3,
       "cap": 26476761946726300,
       "sec": 2
      },
      {
       "s": 1,
       "d": 4,
       "cap": 26476761946726300,
       "sec": 2
      },
      {
       "s": 1,
       "d": 5,
       "cap": 18533733362708410,
       "sec": 2
      },
      {
       "s": 1,
       "d": 6,
       "cap": 21181409557381036,
       "sec": 2
      },
      {
       "s": 2,
       "d": 0,
       "cap": 252946969901625920,
       "sec": 1
      },
      {
       "s": 2,
       "d": 1,
       "cap": 2446774420579748,
       "sec": 0
      },
      {
       "s": 2,
       "d": 2,
       "cap": 2446774420579748,
       "sec": 0
      },
      {
       "s": 2,
       "d": 3,
       "cap": 26476761946726300,
       "sec": 2
      },
      {
       "s": 2,
       "d": 4,
       "cap": 26476761946726300,
       "sec": 2
      },
      {
       "s": 2,
       "d": 5,
       "cap": 18533733362708410,
       "sec": 2
      },
      {
       "s": 2,
       "d": 6,
       "cap": 21181409557381036,
       "sec": 2
      },
      {
       "s": 3,
       "d": 0,
       "cap": 1583347559690.0774,
       "sec": 2
      },
      {
       "s": 3,
       "d": 1,
       "cap": 15315836000.896664,
       "sec": 0
      },
      {
       "s": 3,
       "d": 2,
       "cap": 15315836000.896664,
       "sec": 0
      },
      {
       "s": 3,
       "d": 3,
       "cap": 165734013074.55124,
       "sec": 2
      },
      {
       "s": 3,
       "d": 4,
       "cap": 165734013074.55124,
       "sec": 2
      },
      {
       "s": 3,
       "d": 5,
       "cap": 116013809152.18587,
       "sec": 2
      },
      {
       "s": 3,
       "d": 6,
       "cap": 132587210459.64096,
       "sec": 2
      },
      {
       "s": 4,
       "d": 0,
       "cap": 1583347559690.0774,
       "sec": 2
      },
      {
       "s": 4,
       "d": 1,
       "cap": 15315836000.896664,
       "sec": 0
      },
      {
       "s": 4,
       "d": 2,
       "cap": 15315836000.896664,
       "sec": 0
      },
      {
       "s": 4,
       "d": 3,
       "cap": 165734013074.55124,
       "sec": 2
      },
      {
       "s": 4,
       "d": 4,
       "cap": 165734013074.55124,
       "sec": 2
      },
      {
       "s": 4,
       "d": 5,
       "cap": 116013809152.18587,
       "sec": 2
      },
      {
       "s": 4,
       "d": 6,
       "cap": 132587210459.64096,
       "sec": 2
      },
      {
       "s": 5,
       "d": 0,
       "cap": 75485191663994.73,
       "sec": 4
      },
      {
       "s": 5,
       "d": 1,
       "cap": 730173744195.6792,
       "sec": 4
      },
      {
       "s": 5,
       "d": 2,
       "cap": 730173744195.6792,
       "sec": 4
      },
      {
       "s": 5,
       "d": 3,
       "cap": 7901274527889.691,
       "sec": 4
      },
      {
       "s": 5,
       "d": 4,
       "cap": 7901274527889.691,
       "sec": 4
      },
      {
       "s": 5,
       "d": 5,
       "cap": 5530892169522.784,
       "sec": 4
      },
      {
       "s": 5,
       "d": 6,
       "cap": 6321019622311.752,
       "sec": 4
      },
      {
       "s": 6,
       "d": 0,
       "cap": 47444508448101540,
       "sec": 1
      },
      {
       "s": 6,
       "d": 5,
       "cap": 47444508448101540,
       "sec": 2
      },
      {
       "s": 6,
       "d": 6,
       "cap": 47444508448101540,
       "sec": 2
      },
      {
       "s": 6,
       "d": 1,
       "cap": 47444508448101540,
       "sec": 0
      },
      {
       "s": 6,
       "d": 2,
       "cap": 47444508448101540,
       "sec": 0
      },
      {
       "s": 6,
       "d": 3,
       "cap": 47444508448101540,
       "sec": 2
      },
      {
       "s": 6,
       "d": 4,
       "cap": 47444508448101540,
       "sec": 2
      },
      {
       "s": 6,
       "d": 7,
       "cap": 807404577362123300000,
       "sec": -1
      }
     ]
    },
    "speedReference": {
     "version": 1,
     "key": "tie_in",
     "status": "published",
     "mglt": 110,
     "model": "TIE/in Interceptor",
     "scope": "class",
     "continuity": "canon",
     "source": "https://starwars.fandom.com/wiki/Megalight_per_hour"
    },
    "mglt": 110,
    "maxSpeed": 2200
   },
   "fireArcs": [
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      0,
      1
     ],
     "pos": [
      8.2,
      2.752,
      4.315999866485596
     ],
     "k": "claser",
     "gun": 0.25,
     "aa": 0.25,
     "cycle": 0.12
    },
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      0,
      1
     ],
     "pos": [
      8.2,
      0.3520000000000001,
      4.315999866485596
     ],
     "k": "claser",
     "gun": 0.25,
     "aa": 0.25,
     "cycle": 0.12
    },
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      0,
      -1
     ],
     "pos": [
      8.2,
      2.752,
      -4.315999866485596
     ],
     "k": "claser",
     "gun": 0.25,
     "aa": 0.25,
     "cycle": 0.12
    },
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      0,
      -1
     ],
     "pos": [
      8.2,
      0.3520000000000001,
      -4.315999866485596
     ],
     "k": "claser",
     "gun": 0.25,
     "aa": 0.25,
     "cycle": 0.12
    }
   ]
  },
  "tie_ln": {
   "reference": "craft_tie_ln",
   "signature": "jiv3bb",
   "build": 84416,
   "crew": 1000,
   "total": 85416,
   "by": {
    "hull": 8,
    "armor": 6,
    "power": 15398,
    "drive": 29203,
    "defense": 1500,
    "command": 14501,
    "weapons": 11800,
    "systems": 12000,
    "crew": 1000
   },
   "detailed": true,
   "systems": {
    "v": 1,
    "managed": true,
    "power": 13134006900000000,
    "crew": 1,
    "suitSeats": 1,
    "lifeSupportCapacity": 0,
    "lifeSupportHours": 4,
    "ejectionSeats": 1,
    "ejectionCoverage": 1,
    "ejectionSurvival": 0.9,
    "navCapacity": 1.331,
    "navReady": true,
    "targetDemand": 2,
    "targetCapacity": 2.31525,
    "targetRatio": 1,
    "fireK": 1,
    "maneuverSupport": 23.328,
    "maneuverRatio": 1,
    "turnK": 1,
    "laserUnits": 2,
    "laserGunShare": 1,
    "laserAaShare": 1,
    "laserGasSeconds": 658.5600000000002,
    "landingSupport": 13.171200000000004,
    "landingRatio": 1,
    "landingReady": true
   },
   "heat": {
    "up": 0.00000474,
    "upS": 0.00000474,
    "down": 0.446,
    "T": 0
   },
   "powerProfile": {
    "name": "TIE/ln 制宙戦闘機",
    "modules": [
     {
      "k": "weapon",
      "fit": 48,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.477,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.28,
      "z": 0.1,
      "r": 0.18,
      "share": 0.5,
      "domain": "main",
      "port": "f48",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 49,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.477,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.28,
      "z": -0.1,
      "r": 0.18,
      "share": 0.5,
      "domain": "main",
      "port": "f49",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "操縦席",
      "w": 0.6367018876058852,
      "hits": 1,
      "crew": 0,
      "size": 0.5080473683642538,
      "at": 0.509,
      "part": 42,
      "y": 0.17,
      "z": 0,
      "r": 0.055,
      "share": 0.7272592641926459,
      "domain": "main",
      "port": "p42",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "I-a2b 太陽イオン化反応炉",
      "w": 1.0410177626520942,
      "hits": 1,
      "crew": 0.00011563260691645128,
      "size": 0.5781630345822564,
      "at": 0.498,
      "part": 43,
      "y": -0.32,
      "z": 0,
      "r": 0.058,
      "share": 1,
      "domain": "main",
      "port": "p43",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "P-s4 イオン・エンジン",
      "w": 1.1279727192309104,
      "hits": 1,
      "crew": 0.00047919015343409507,
      "size": 1.1979753835852376,
      "at": 0.488,
      "part": 44,
      "y": -0.03,
      "z": 0.15,
      "r": 0.073,
      "share": 0.46749179292185766,
      "domain": "main",
      "port": "p44",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "P-s4 イオン・エンジン",
      "w": 1.1279727192309104,
      "hits": 1,
      "crew": 0.00047919015343409507,
      "size": 1.1979753835852376,
      "at": 0.488,
      "part": 45,
      "y": -0.03,
      "z": -0.15,
      "r": 0.073,
      "share": 0.46749179292185766,
      "domain": "main",
      "port": "p45",
      "powerConnected": true
     },
     {
      "k": "fuel",
      "name": "燃料タンク",
      "w": 0.12161554605285707,
      "hits": 1,
      "crew": 0.000008482300164692441,
      "size": 0.042411500823462206,
      "at": 0.388,
      "part": 46,
      "y": 0.07,
      "z": 0,
      "r": 0.024,
      "share": 1,
      "domain": "main",
      "port": "p46",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "慣性補償器",
      "w": 0.1071957287973567,
      "hits": 1,
      "crew": 0.000007019339005732015,
      "size": 0.03509669502866007,
      "at": 0.404,
      "part": 47,
      "y": -0.12,
      "z": 0,
      "r": 0.023,
      "share": 0.05024019056395709,
      "domain": "main",
      "port": "p47",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "射出座席機構 1",
      "w": 0.08410000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.024388999999999997,
      "at": 0.509,
      "part": 50,
      "y": 0.1,
      "z": -0.19,
      "r": 0.02,
      "share": 0.034912347349622494,
      "domain": "main",
      "port": "p50",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "航法コンピューター",
      "w": 0.048400000000000006,
      "hits": 1,
      "crew": 0,
      "size": 0.010648,
      "at": 0.55,
      "part": 51,
      "y": 0.11,
      "z": 0.2,
      "r": 0.015,
      "share": 0.015242391019671996,
      "domain": "main",
      "port": "p51",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "照準コンピューター",
      "w": 0.0441,
      "hits": 1,
      "crew": 0,
      "size": 0.009260999999999998,
      "at": 0.55,
      "part": 52,
      "y": 0.11,
      "z": 0.15,
      "r": 0.015,
      "share": 0.013256929304393534,
      "domain": "main",
      "port": "p52",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 1",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.533,
      "part": 53,
      "y": 0.11,
      "z": 0.15,
      "r": 0.012,
      "share": 0.00834838696719826,
      "domain": "main",
      "port": "p53",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 2",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.55,
      "part": 54,
      "y": 0.14,
      "z": 0.15,
      "r": 0.012,
      "share": 0.00834838696719826,
      "domain": "main",
      "port": "p54",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 3",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.568,
      "part": 55,
      "y": 0.11,
      "z": 0.15,
      "r": 0.012,
      "share": 0.00834838696719826,
      "domain": "main",
      "port": "p55",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 4",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.533,
      "part": 56,
      "y": 0.11,
      "z": 0.19,
      "r": 0.012,
      "share": 0.00834838696719826,
      "domain": "main",
      "port": "p56",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 1",
      "w": 0.07840000000000003,
      "hits": 1,
      "crew": 0,
      "size": 0.021952000000000006,
      "at": 0.523,
      "part": 57,
      "y": 0.16,
      "z": 0.21,
      "r": 0.019,
      "share": 0.03142383242522913,
      "domain": "main",
      "port": "p57",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 2",
      "w": 0.07840000000000003,
      "hits": 1,
      "crew": 0,
      "size": 0.021952000000000006,
      "at": 0.496,
      "part": 58,
      "y": 0.11,
      "z": 0.21,
      "r": 0.019,
      "share": 0.03142383242522913,
      "domain": "main",
      "port": "p58",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "翼端着陸支持機構 1",
      "w": 0.07840000000000003,
      "hits": 1,
      "crew": 0,
      "size": 0.021952000000000006,
      "at": 0.605,
      "part": 59,
      "y": 0.11,
      "z": 0.09,
      "r": 0.019,
      "share": 0.03142383242522913,
      "domain": "main",
      "port": "p59",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "翼端着陸支持機構 2",
      "w": 0.07840000000000003,
      "hits": 1,
      "crew": 0,
      "size": 0.021952000000000006,
      "at": 0.496,
      "part": 60,
      "y": 0.16,
      "z": 0.21,
      "r": 0.019,
      "share": 0.03142383242522913,
      "domain": "main",
      "port": "p60",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 1",
      "w": 0.10357684729274141,
      "hits": 1,
      "crew": 0.0000016667253308123142,
      "size": 0.03333450661624628,
      "at": 0.493,
      "part": 61,
      "y": 0.06,
      "z": 0.41,
      "r": 0.022,
      "share": 0.002303752462961591,
      "domain": "main",
      "port": "p61",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.19074124533461648,
      "hits": 1,
      "crew": 0.000016660840867687938,
      "size": 0.08330420433843969,
      "at": 0.625,
      "part": -44,
      "machineryOwner": 44,
      "y": -0.03,
      "z": 0.15,
      "r": 0.03,
      "share": 0.032508207078142386,
      "domain": "main",
      "port": "p44",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.19074124533461648,
      "hits": 1,
      "crew": 0.000016660840867687938,
      "size": 0.08330420433843969,
      "at": 0.625,
      "part": -45,
      "machineryOwner": 45,
      "y": -0.03,
      "z": -0.15,
      "r": 0.03,
      "share": 0.032508207078142386,
      "domain": "main",
      "port": "p45",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p43 → p44",
      "w": 0.005345470107086928,
      "hits": 1,
      "crew": 7.81643738981403e-8,
      "size": 0.00039082186949070146,
      "at": 0.604,
      "part": -6000000,
      "routeId": "p43>p44",
      "capacityW": 416208455645512260,
      "y": -0.13,
      "z": 0.13,
      "r": 0.005,
      "share": 0.4981016877849619,
      "domain": "main",
      "port": "p-6000000",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p43 → p45",
      "w": 0.005372598500246908,
      "hits": 1,
      "crew": 7.876015740737308e-8,
      "size": 0.00039380078703686534,
      "at": 0.604,
      "part": -6000001,
      "routeId": "p43>p45",
      "capacityW": 416208455645512260,
      "y": -0.13,
      "z": -0.13,
      "r": 0.005,
      "share": 0.5018983122150381,
      "domain": "main",
      "port": "p-6000001",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "太陽電池翼",
      "w": 3.734946409251041,
      "hits": 1,
      "crew": 0,
      "size": 7.218160956792428,
      "at": 0.5,
      "part": 1,
      "y": 0,
      "z": 0.91,
      "r": 0.133,
      "share": 0.4988481237685192,
      "domain": "main",
      "port": "p1",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "太陽電池翼",
      "w": 3.734946409251041,
      "hits": 1,
      "crew": 0,
      "size": 7.218160956792428,
      "at": 0.5,
      "part": 2,
      "y": 0,
      "z": -0.91,
      "r": 0.133,
      "share": 0.4988481237685192,
      "domain": "main",
      "port": "p2",
      "powerConnected": true
     },
     {
      "k": "quarters",
      "name": "居住空間（後部）",
      "w": 0.40432020565559806,
      "hits": 1,
      "crew": 0,
      "size": 4.425387243488632,
      "at": 0.157,
      "y": 0,
      "z": 0,
      "r": 0.113,
      "share": 0.1337579617834395,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央後部）",
      "w": 0.749485373871458,
      "hits": 1,
      "crew": 0,
      "size": 11.168834471661784,
      "at": 0.385,
      "y": 0.01,
      "z": 0,
      "r": 0.154,
      "share": 0.3375796178343949,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央前部）",
      "w": 0.8320965256514536,
      "hits": 1,
      "crew": 0,
      "size": 13.065429004585484,
      "at": 0.595,
      "y": 0,
      "z": 0,
      "r": 0.163,
      "share": 0.39490445859872614,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（前部）",
      "w": 0.40432020565559806,
      "hits": 1,
      "crew": 0,
      "size": 4.425387243488632,
      "at": 0.843,
      "y": 0,
      "z": 0,
      "r": 0.113,
      "share": 0.1337579617834395,
      "domain": "main"
     },
     {
      "k": "hull",
      "name": "船体構造",
      "w": 10.280981339685308,
      "hits": null,
      "crew": 0,
      "size": 1,
      "share": 1,
      "domain": "main"
     }
    ],
    "energyModel": {
     "version": 0,
     "eta": 0.75
    },
    "D": 0,
    "shieldBuffer": 0,
    "wCap": 0,
    "crewNeed": 1,
    "crewMax": 1,
    "hp": 1,
    "len": 7.240000009536743,
    "width": 6.559999942779541,
    "height": 8.345999956130981,
    "grid": {
     "P": 3088413887674337000,
     "fixed": 24170294542037316,
     "cooling": 6499103246307932,
     "De": 832416911291024500,
     "Ds": 0,
     "Dw": 139466666666666.69,
     "domains": [
      {
       "id": "main",
       "P": 3088413887674337000,
       "reactors": [
        3
       ],
       "sources": [
        {
         "moduleIndex": 24,
         "P": 30285964800000000
        },
        {
         "moduleIndex": 25,
         "P": 30285964800000000
        },
        {
         "moduleIndex": 3,
         "P": 3027841958074337000
        }
       ],
       "modules": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30
       ],
       "protection": 1
      }
     ],
     "powerPaths": [
      {
       "kind": "power",
       "from": "p43",
       "to": "hotel",
       "cap": 24170294542037316,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p1",
       "to": "p1",
       "cap": 630957600000000,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p2",
       "to": "p2",
       "cap": 630957600000000,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "p42",
       "cap": 1611352969469154.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "p46",
       "cap": 1611352969469154.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "p47",
       "cap": 1611352969469154.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "p50",
       "cap": 1611352969469154.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "p51",
       "cap": 1611352969469154.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "p52",
       "cap": 1611352969469154.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "p53",
       "cap": 1611352969469154.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "p54",
       "cap": 1611352969469154.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "p55",
       "cap": 1611352969469154.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "p56",
       "cap": 1611352969469154.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "p57",
       "cap": 1611352969469154.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "p58",
       "cap": 1611352969469154.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "p59",
       "cap": 1611352969469154.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "p60",
       "cap": 1611352969469154.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "f48",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "f49",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "p61",
       "cap": 5237188046307932,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "p-6000000",
       "cap": 416208455645512260,
       "auto": false,
       "ok": true,
       "capacityGroup": "p43>p44",
       "groupCap": 416208455645512260,
       "physical": true,
       "routeId": "p43>p44",
       "efficiency": 0.9999906099929188
      },
      {
       "kind": "power",
       "from": "p-6000000",
       "to": "p44",
       "cap": 416208455645512260,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p43>p44",
       "efficiency": 1
      },
      {
       "kind": "power",
       "from": "p43",
       "to": "p-6000001",
       "cap": 416208455645512260,
       "auto": false,
       "ok": true,
       "capacityGroup": "p43>p45",
       "groupCap": 416208455645512260,
       "physical": true,
       "routeId": "p43>p45",
       "efficiency": 0.9999905384208633
      },
      {
       "kind": "power",
       "from": "p-6000001",
       "to": "p45",
       "cap": 416208455645512260,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p43>p45",
       "efficiency": 1
      }
     ],
     "trunks": [
      {
       "port": "p-6000000",
       "moduleIndex": 22
      },
      {
       "port": "p-6000001",
       "moduleIndex": 23
      }
     ],
     "fixedLoads": [
      {
       "id": "hotel",
       "port": "hotel",
       "weight": 24170294542037316,
       "domain": "main"
      }
     ],
     "coolingLoads": [
      {
       "id": "p61",
       "port": "p61",
       "weight": 5237188046307932,
       "domain": "main"
      },
      {
       "id": "p1",
       "port": "p1",
       "weight": 630957600000000,
       "domain": "main"
      },
      {
       "id": "p2",
       "port": "p2",
       "weight": 630957600000000,
       "domain": "main"
      }
     ]
    },
    "propulsion": {
     "version": 1,
     "architectureVersion": 2,
     "cores": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 28323429475069504,
       "densityFactor": 14.694846752645617,
       "efficiency": 0.5638844461730095,
       "wasteFraction": 0.4361155538269905,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 3369484675.2645617,
       "ratedShaftPowerW": 234693474504193250,
       "ratedWasteHeatW": 181514981141319000,
       "thermalStoreJ": 84970288425208510,
       "version": 1,
       "id": 44,
       "machineryId": 44,
       "coreId": 44,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 416208455645512260,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 123522881.31799644,
       "effectiveMachineryVolumeM3": 0.08330420433843971,
       "machineryVolumeM3": 0.08330420433843971,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.33319999999999994,
       "machineryDiameterM": 0.6663999999999999,
       "machineryOffsetM": 0.8415,
       "maxInputW": 2832342947506950000,
       "maxRatedInputW": 2832342947506950000,
       "inputDensityWPerM3": 4996247895899510000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 1096.5658691116078,
       "powerNode": "p44",
       "heatNode": "p44",
       "reactorId": 43,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 4,
       "machineryModuleIndex": 20,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 416204547445166460,
       "transmissionRouteIds": [
        "p43>p44"
       ]
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 28323429475069504,
       "densityFactor": 14.694846752645617,
       "efficiency": 0.5638844461730095,
       "wasteFraction": 0.4361155538269905,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 3369484675.2645617,
       "ratedShaftPowerW": 234693474504193250,
       "ratedWasteHeatW": 181514981141319000,
       "thermalStoreJ": 84970288425208510,
       "version": 1,
       "id": 45,
       "machineryId": 45,
       "coreId": 45,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 416208455645512260,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 123522881.31799644,
       "effectiveMachineryVolumeM3": 0.08330420433843971,
       "machineryVolumeM3": 0.08330420433843971,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.33319999999999994,
       "machineryDiameterM": 0.6663999999999999,
       "machineryOffsetM": 0.8415,
       "maxInputW": 2832342947506950000,
       "maxRatedInputW": 2832342947506950000,
       "inputDensityWPerM3": 4996247895899510000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 1096.5658691116078,
       "powerNode": "p45",
       "heatNode": "p45",
       "reactorId": 43,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 5,
       "machineryModuleIndex": 21,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 416204517656271800,
       "transmissionRouteIds": [
        "p43>p45"
       ]
      }
     ],
     "engines": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 28323429475069504,
       "densityFactor": 14.694846752645617,
       "efficiency": 0.5638844461730095,
       "wasteFraction": 0.4361155538269905,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 3369484675.2645617,
       "ratedShaftPowerW": 234693474504193250,
       "ratedWasteHeatW": 181514981141319000,
       "thermalStoreJ": 84970288425208510,
       "version": 1,
       "id": 44,
       "machineryId": 44,
       "coreId": 44,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 416208455645512260,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 123522881.31799644,
       "effectiveMachineryVolumeM3": 0.08330420433843971,
       "machineryVolumeM3": 0.08330420433843971,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.33319999999999994,
       "machineryDiameterM": 0.6663999999999999,
       "machineryOffsetM": 0.8415,
       "maxInputW": 2832342947506950000,
       "maxRatedInputW": 2832342947506950000,
       "inputDensityWPerM3": 4996247895899510000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 1096.5658691116078,
       "powerNode": "p44",
       "heatNode": "p44",
       "reactorId": 43,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 4,
       "coreModuleIndex": 4,
       "machineryModuleIndex": 20,
       "shaftModuleIndices": [],
       "shaftCapacityW": 234693474504193250,
       "ratedShaftCapacityW": 234693474504193250,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 416204547445166460
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 28323429475069504,
       "densityFactor": 14.694846752645617,
       "efficiency": 0.5638844461730095,
       "wasteFraction": 0.4361155538269905,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 3369484675.2645617,
       "ratedShaftPowerW": 234693474504193250,
       "ratedWasteHeatW": 181514981141319000,
       "thermalStoreJ": 84970288425208510,
       "version": 1,
       "id": 45,
       "machineryId": 45,
       "coreId": 45,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 416208455645512260,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 123522881.31799644,
       "effectiveMachineryVolumeM3": 0.08330420433843971,
       "machineryVolumeM3": 0.08330420433843971,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.33319999999999994,
       "machineryDiameterM": 0.6663999999999999,
       "machineryOffsetM": 0.8415,
       "maxInputW": 2832342947506950000,
       "maxRatedInputW": 2832342947506950000,
       "inputDensityWPerM3": 4996247895899510000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 1096.5658691116078,
       "powerNode": "p45",
       "heatNode": "p45",
       "reactorId": 43,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 5,
       "coreModuleIndex": 5,
       "machineryModuleIndex": 21,
       "shaftModuleIndices": [],
       "shaftCapacityW": 234693474504193250,
       "ratedShaftCapacityW": 234693474504193250,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 416204517656271800
      }
     ],
     "massKg": 10351.574045810194,
     "ratedThrustN": 247045762.63599288,
     "ratedAccelMps2": 23865.526299933565,
     "structuralAccelerationLimitMps2": 2474470.29334667,
     "inertialFactor": 1,
     "accelerationLimitMps2": 23865.526299933565
    },
    "profileVersion": 18,
    "heat": {
     "v": 3,
     "mode": "strict",
     "src": [
      {
       "k": "reactor",
       "id": "p43",
       "n": "I-a2b 太陽イオン化反応炉 #43",
       "g": "high",
       "sh": 1,
       "st": 2053115417519349000,
       "m": [
        3
       ],
       "pc": [],
       "sec": 1,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p44",
       "n": "P-s4 イオン・エンジン #44",
       "g": "high",
       "sh": 0.5,
       "st": 84970288425208510,
       "m": [
        4,
        20
       ],
       "pc": [],
       "sec": 1,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p45",
       "n": "P-s4 イオン・エンジン #45",
       "g": "high",
       "sh": 0.5,
       "st": 84970288425208510,
       "m": [
        5,
        21
       ],
       "pc": [],
       "sec": 1,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "feed",
       "id": "p-6000000",
       "n": "推進配電路 1",
       "g": "high",
       "sh": 0.498102,
       "st": 234492020747520,
       "m": [
        22
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1,
       "routeId": "p43>p44"
      },
      {
       "k": "feed",
       "id": "p-6000001",
       "n": "推進配電路 2",
       "g": "high",
       "sh": 0.501898,
       "st": 236279354426880,
       "m": [
        23
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1,
       "routeId": "p43>p45"
      },
      {
       "k": "weapon",
       "id": "f48",
       "n": "武装（艦尾区画）",
       "g": "high",
       "sh": 1,
       "st": 2615000000000000.5,
       "m": [
        0,
        1
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "hotel",
       "id": "hotel",
       "n": "生活・電子設備",
       "g": "low",
       "sh": 1,
       "st": 1450217672522239000,
       "m": [],
       "pc": [],
       "sec": 1,
       "sw": -1,
       "gen": -1
      }
     ],
     "dis": [
      {
       "id": "p61",
       "n": "機体内高エネルギー散逸装置 1 #61",
       "k": "hdis",
       "g": "high",
       "cap": 349145869753862140,
       "m": 19,
       "sec": 1,
       "src": -1,
       "power": 5237188046307932
      },
      {
       "id": "p1",
       "n": "太陽電池翼 #1",
       "k": "solar",
       "g": "high",
       "cap": 63095760000000000,
       "m": 24,
       "sec": 1,
       "src": -1,
       "power": 630957600000000
      },
      {
       "id": "p2",
       "n": "太陽電池翼 #2",
       "k": "solar",
       "g": "high",
       "cap": 63095760000000000,
       "m": 25,
       "sec": 1,
       "src": -1,
       "power": 630957600000000
      },
      {
       "id": "skin",
       "n": "外殻からの放熱",
       "k": "skin",
       "g": "low",
       "cap": 812641774005751800000,
       "m": -1,
       "sec": -1,
       "src": -1
      }
     ],
     "ln": [
      {
       "s": 0,
       "d": 0,
       "cap": 30161177454441244,
       "sec": 1
      },
      {
       "s": 0,
       "d": 1,
       "cap": 5450565447972866,
       "sec": 1
      },
      {
       "s": 0,
       "d": 2,
       "cap": 5450565447972866,
       "sec": 1
      },
      {
       "s": 1,
       "d": 0,
       "cap": 159990639667017280,
       "sec": 1
      },
      {
       "s": 1,
       "d": 1,
       "cap": 28912646195107790,
       "sec": 1
      },
      {
       "s": 1,
       "d": 2,
       "cap": 28912646195107790,
       "sec": 1
      },
      {
       "s": 2,
       "d": 0,
       "cap": 159990628216050850,
       "sec": 1
      },
      {
       "s": 2,
       "d": 1,
       "cap": 28912644125750850,
       "sec": 1
      },
      {
       "s": 2,
       "d": 2,
       "cap": 28912644125750850,
       "sec": 1
      },
      {
       "s": 3,
       "d": 0,
       "cap": 3444791943534.1807,
       "sec": 4
      },
      {
       "s": 3,
       "d": 1,
       "cap": 622524235708.1096,
       "sec": 4
      },
      {
       "s": 3,
       "d": 2,
       "cap": 622524235708.1096,
       "sec": 4
      },
      {
       "s": 4,
       "d": 0,
       "cap": 3471048669197.762,
       "sec": 4
      },
      {
       "s": 4,
       "d": 1,
       "cap": 627269209669.9185,
       "sec": 4
      },
      {
       "s": 4,
       "d": 2,
       "cap": 627269209669.9185,
       "sec": 4
      },
      {
       "s": 5,
       "d": 0,
       "cap": 38415511553977.49,
       "sec": 0
      },
      {
       "s": 5,
       "d": 1,
       "cap": 6942244223011.259,
       "sec": 1
      },
      {
       "s": 5,
       "d": 2,
       "cap": 6942244223011.259,
       "sec": 1
      },
      {
       "s": 6,
       "d": 0,
       "cap": 36255441813055976,
       "sec": 1
      },
      {
       "s": 6,
       "d": 1,
       "cap": 36255441813055976,
       "sec": 1
      },
      {
       "s": 6,
       "d": 2,
       "cap": 36255441813055976,
       "sec": 1
      },
      {
       "s": 6,
       "d": 3,
       "cap": 812641774005751800000,
       "sec": -1
      }
     ]
    },
    "speedReference": {
     "version": 1,
     "key": "tie_ln",
     "status": "published",
     "mglt": 100,
     "model": "TIE/ln space superiority starfighter",
     "scope": "class",
     "continuity": "canon",
     "source": "https://starwars.fandom.com/wiki/Megalight_per_hour"
    },
    "mglt": 100,
    "maxSpeed": 2000
   },
   "fireArcs": [
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      -1,
      0
     ],
     "pos": [
      2.37,
      -0.12203815592892461,
      0.318
     ],
     "k": "claser",
     "gun": 0.5,
     "aa": 0.5,
     "cycle": 0.12
    },
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      -1,
      0
     ],
     "pos": [
      2.37,
      -0.12203815589154673,
      -0.318
     ],
     "k": "claser",
     "gun": 0.5,
     "aa": 0.5,
     "cycle": 0.12
    }
   ]
  },
  "tie_sa": {
   "reference": "craft_tie_sa",
   "signature": "11beb3q",
   "build": 134203,
   "crew": 1000,
   "total": 135203,
   "by": {
    "hull": 61,
    "armor": 29,
    "power": 52845,
    "drive": 28965,
    "defense": 1500,
    "command": 14502,
    "weapons": 24300,
    "systems": 12001,
    "crew": 1000
   },
   "detailed": true,
   "systems": {
    "v": 1,
    "managed": true,
    "power": 37633046900000010,
    "crew": 1,
    "suitSeats": 1,
    "lifeSupportCapacity": 0,
    "lifeSupportHours": 4,
    "ejectionSeats": 1,
    "ejectionCoverage": 1,
    "ejectionSurvival": 0.9,
    "navCapacity": 1.331,
    "navReady": true,
    "targetDemand": 4,
    "targetCapacity": 4.920750000000001,
    "targetRatio": 1,
    "fireK": 1,
    "maneuverSupport": 70.304,
    "maneuverRatio": 1,
    "turnK": 1,
    "laserUnits": 2,
    "laserGunShare": 1,
    "laserAaShare": 1,
    "laserGasSeconds": 658.5600000000002,
    "landingSupport": 66.3552,
    "landingRatio": 1,
    "landingReady": true
   },
   "heat": {
    "up": 0.0000265,
    "upS": 0.0000265,
    "down": 0.43,
    "T": 0
   },
   "powerProfile": {
    "name": "TIE/sa ボマー",
    "modules": [
     {
      "k": "weapon",
      "fit": 42,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.743,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.47,
      "z": 0.34,
      "r": 0.165,
      "share": 0.5,
      "domain": "main",
      "port": "f42",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 43,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.743,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.42,
      "z": 0.22,
      "r": 0.165,
      "share": 0.5,
      "domain": "main",
      "port": "f43",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 44,
      "name": "魚雷発射管",
      "w": 0.84,
      "hits": 1,
      "crew": 0,
      "size": 0,
      "weaponPowerW": 1000000000000000,
      "stock": 0,
      "at": 0.797,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.41,
      "z": -0.26,
      "r": 0.089,
      "share": 0,
      "domain": "main",
      "port": "f44",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 45,
      "name": "爆弾倉",
      "w": 3.456,
      "hits": 1,
      "crew": 0,
      "size": 0,
      "weaponPowerW": 1000000000000000,
      "stock": 0,
      "at": 0.57,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.4,
      "z": -0.2,
      "r": 0.152,
      "share": 0,
      "domain": "main",
      "port": "f45",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "操縦席",
      "w": 0.9354665015329808,
      "hits": 1,
      "crew": 0,
      "size": 0.9047786842338602,
      "at": 0.787,
      "part": 35,
      "y": 0,
      "z": 0.34,
      "r": 0.061,
      "share": 0.6273805793808002,
      "domain": "main",
      "port": "p35",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "太陽イオン化反応炉（操縦席ポッド）",
      "w": 0.7860517130936855,
      "hits": 1,
      "crew": 0.000348454985160668,
      "size": 0.696909970321336,
      "at": 0.446,
      "part": 36,
      "y": 0,
      "z": 0.34,
      "r": 0.056,
      "share": 0.5,
      "domain": "main",
      "port": "p36",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "太陽イオン化反応炉（兵装ポッド）",
      "w": 0.7860517130936855,
      "hits": 1,
      "crew": 0.000348454985160668,
      "size": 0.696909970321336,
      "at": 0.446,
      "part": 37,
      "y": 0,
      "z": -0.34,
      "r": 0.056,
      "share": 0.5,
      "domain": "main",
      "port": "p37",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "イオン・エンジン",
      "w": 2.3245455686518484,
      "hits": 1,
      "crew": 0.0014176436849323943,
      "size": 3.5441092123309854,
      "at": 0.225,
      "part": 38,
      "y": 0,
      "z": 0.34,
      "r": 0.096,
      "share": 0.4571949909570488,
      "domain": "main",
      "port": "p38",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "イオン・エンジン",
      "w": 2.3245455686518484,
      "hits": 1,
      "crew": 0.0014176436849323943,
      "size": 3.5441092123309854,
      "at": 0.225,
      "part": 39,
      "y": 0,
      "z": -0.34,
      "r": 0.096,
      "share": 0.4571949909570488,
      "domain": "main",
      "port": "p39",
      "powerConnected": true
     },
     {
      "k": "fuel",
      "name": "燃料タンク",
      "w": 0.2736349786189284,
      "hits": 1,
      "crew": 0.00002862776305583699,
      "size": 0.14313881527918496,
      "at": 0.597,
      "part": 40,
      "y": 0,
      "z": -0.34,
      "r": 0.033,
      "share": 1,
      "domain": "main",
      "port": "p40",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "慣性補償器",
      "w": 0.278865059306339,
      "hits": 1,
      "crew": 0.00002945243112740431,
      "size": 0.14726215563702155,
      "at": 0.597,
      "part": 41,
      "y": 0,
      "z": 0.34,
      "r": 0.033,
      "share": 0.10211272450859381,
      "domain": "main",
      "port": "p41",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "射出座席機構 1",
      "w": 0.08410000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.024388999999999997,
      "at": 0.787,
      "part": 46,
      "y": -0.3,
      "z": 0.34,
      "r": 0.018,
      "share": 0.016911522361377163,
      "domain": "main",
      "port": "p46",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "航法コンピューター",
      "w": 0.048400000000000006,
      "hits": 1,
      "crew": 0,
      "size": 0.010648,
      "at": 0.667,
      "part": 47,
      "y": 0.02,
      "z": 0.34,
      "r": 0.014,
      "share": 0.0073834060479701525,
      "domain": "main",
      "port": "p47",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "照準コンピューター",
      "w": 0.07290000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.019683000000000003,
      "at": 0.667,
      "part": 48,
      "y": -0.05,
      "z": 0.34,
      "r": 0.017,
      "share": 0.013648345345811094,
      "domain": "main",
      "port": "p48",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 1",
      "w": 0.06760000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.017576,
      "at": 0.667,
      "part": 49,
      "y": 0.02,
      "z": 0.3,
      "r": 0.016,
      "share": 0.012187335152058923,
      "domain": "main",
      "port": "p49",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 2",
      "w": 0.06760000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.017576,
      "at": 0.667,
      "part": 50,
      "y": 0.02,
      "z": 0.38,
      "r": 0.016,
      "share": 0.012187335152058923,
      "domain": "main",
      "port": "p50",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 3",
      "w": 0.06760000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.017576,
      "at": 0.667,
      "part": 51,
      "y": 0.09,
      "z": 0.34,
      "r": 0.016,
      "share": 0.012187335152058923,
      "domain": "main",
      "port": "p51",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 4",
      "w": 0.06760000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.017576,
      "at": 0.69,
      "part": 52,
      "y": 0.02,
      "z": 0.34,
      "r": 0.016,
      "share": 0.012187335152058923,
      "domain": "main",
      "port": "p52",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 1",
      "w": 0.07840000000000003,
      "hits": 1,
      "crew": 0,
      "size": 0.021952000000000006,
      "at": 0.667,
      "part": 53,
      "y": -0.05,
      "z": 0.3,
      "r": 0.018,
      "share": 0.015221687600022618,
      "domain": "main",
      "port": "p53",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 2",
      "w": 0.07840000000000003,
      "hits": 1,
      "crew": 0,
      "size": 0.021952000000000006,
      "at": 0.667,
      "part": 54,
      "y": -0.05,
      "z": 0.38,
      "r": 0.018,
      "share": 0.015221687600022618,
      "domain": "main",
      "port": "p54",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "翼端着陸支持機構 1",
      "w": 0.23040000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.110592,
      "at": 0.625,
      "part": 55,
      "y": 0.14,
      "z": 0.34,
      "r": 0.03,
      "share": 0.0766853532735833,
      "domain": "main",
      "port": "p55",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "翼端着陸支持機構 2",
      "w": 0.23040000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.110592,
      "at": 0.667,
      "part": 56,
      "y": -0.22,
      "z": 0.34,
      "r": 0.03,
      "share": 0.0766853532735833,
      "domain": "main",
      "port": "p56",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 1",
      "w": 0.17440168784341503,
      "hits": 1,
      "crew": 0.000003641631775243681,
      "size": 0.07283263550487362,
      "at": 0.667,
      "part": 57,
      "y": 0.12,
      "z": 0.22,
      "r": 0.026,
      "share": 0.0023021658427074486,
      "domain": "main",
      "port": "p57",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.47929196735665003,
      "hits": 1,
      "crew": 0.00006636364347101359,
      "size": 0.33181821735506795,
      "at": 0.323,
      "part": -38,
      "machineryOwner": 38,
      "y": 0,
      "z": 0.34,
      "r": 0.044,
      "share": 0.04280500904295116,
      "domain": "main",
      "port": "p38",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.47929196735665003,
      "hits": 1,
      "crew": 0.00006636364347101359,
      "size": 0.33181821735506795,
      "at": 0.323,
      "part": -39,
      "machineryOwner": 39,
      "y": 0,
      "z": -0.34,
      "r": 0.044,
      "share": 0.04280500904295116,
      "domain": "main",
      "port": "p39",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p36 → p38",
      "w": 0.006084469960122984,
      "hits": 1,
      "crew": 9.492139727924286e-8,
      "size": 0.0004746069863962143,
      "at": 0.349,
      "part": -6000000,
      "routeId": "p36>p38",
      "capacityW": 1126460068987211800,
      "y": 0,
      "z": 0.34,
      "r": 0.005,
      "share": 0.5,
      "domain": "main",
      "port": "p-6000000",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p37 → p39",
      "w": 0.006084469960122984,
      "hits": 1,
      "crew": 9.492139727924286e-8,
      "size": 0.0004746069863962143,
      "at": 0.349,
      "part": -6000001,
      "routeId": "p37>p39",
      "capacityW": 1126460068987211800,
      "y": 0,
      "z": -0.34,
      "r": 0.005,
      "share": 0.5,
      "domain": "main",
      "port": "p-6000001",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "翼中央部",
      "w": 10.854995531047145,
      "hits": 1,
      "crew": 0,
      "size": 8.67326819489074,
      "at": 0.5,
      "part": 11,
      "ext": 1,
      "y": 0,
      "z": 0.94,
      "r": 0.13,
      "share": 0.2741532232701127,
      "domain": "main",
      "port": "p11",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "翼中央部",
      "w": 10.854995531047143,
      "hits": 1,
      "crew": 0,
      "size": 8.673268194890738,
      "at": 0.5,
      "part": 12,
      "ext": 1,
      "y": 0,
      "z": -0.94,
      "r": 0.13,
      "share": 0.2741532232701126,
      "domain": "main",
      "port": "p12",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "上翼板",
      "w": 3.8816659639805944,
      "hits": 1,
      "crew": 0,
      "size": 3.5543002726601136,
      "at": 0.5,
      "part": 15,
      "ext": 1,
      "y": 0.68,
      "z": 0.78,
      "r": 0.097,
      "share": 0.11234783178890108,
      "domain": "main",
      "port": "p15",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "上翼板",
      "w": 5.046165753174774,
      "hits": 1,
      "crew": 0,
      "size": 3.554300272660115,
      "at": 0.5,
      "part": 16,
      "ext": 1,
      "y": 0.68,
      "z": -0.78,
      "r": 0.097,
      "share": 0.11234783178890112,
      "domain": "main",
      "port": "p16",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "下翼板",
      "w": 5.434333324425259,
      "hits": 1,
      "crew": 0,
      "size": 3.5543012290568283,
      "at": 0.5,
      "part": 25,
      "ext": 1,
      "y": -0.68,
      "z": 0.78,
      "r": 0.097,
      "share": 0.11234786201963258,
      "domain": "main",
      "port": "p25",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "下翼板",
      "w": 4.2698333263341315,
      "hits": 1,
      "crew": 0,
      "size": 3.5543012290568265,
      "at": 0.5,
      "part": 26,
      "ext": 1,
      "y": -0.68,
      "z": -0.78,
      "r": 0.097,
      "share": 0.11234786201963252,
      "domain": "main",
      "port": "p26",
      "powerConnected": true
     },
     {
      "k": "quarters",
      "name": "居住空間（後部）",
      "w": 0.6081778854618484,
      "hits": 1,
      "crew": 0,
      "size": 8.164113764736234,
      "at": 0.156,
      "y": 0,
      "z": 0,
      "r": 0.127,
      "share": 0.09988870339454645,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央後部）",
      "w": 1.1749489960613997,
      "hits": 1,
      "crew": 0,
      "size": 21.92257846575412,
      "at": 0.379,
      "y": 0,
      "z": 0,
      "r": 0.177,
      "share": 0.2682248191430161,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央前部）",
      "w": 1.646392204475731,
      "hits": 1,
      "crew": 0,
      "size": 36.36328108583075,
      "at": 0.62,
      "y": -0.01,
      "z": 0,
      "r": 0.2,
      "share": 0.44490818030050083,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（前部）",
      "w": 0.9237345208892407,
      "hits": 1,
      "crew": 0,
      "size": 15.282129386915738,
      "at": 0.829,
      "y": 0,
      "z": 0,
      "r": 0.157,
      "share": 0.18697829716193656,
      "domain": "main"
     },
     {
      "k": "hull",
      "name": "船体構造",
      "w": 36.56145522139413,
      "hits": null,
      "crew": 0,
      "size": 1,
      "share": 1,
      "domain": "main"
     }
    ],
    "energyModel": {
     "version": 0,
     "eta": 0.75
    },
    "D": 0,
    "shieldBuffer": 0,
    "wCap": 0,
    "crewNeed": 1,
    "crewMax": 1,
    "hp": 1,
    "len": 7.900000095367432,
    "width": 9.460000038146973,
    "height": 5.591440558433533,
    "grid": {
     "P": 7354377344558333000,
     "fixed": 63790766701159660,
     "cooling": 14227406370641222,
     "De": 2252920137974423600,
     "Ds": 0,
     "Dw": 2139466666666666.8,
     "domains": [
      {
       "id": "main",
       "P": 7354377344558333000,
       "reactors": [
        5,
        6
       ],
       "sources": [
        {
         "moduleIndex": 27,
         "P": 10407921600000002
        },
        {
         "moduleIndex": 28,
         "P": 10407921600000002
        },
        {
         "moduleIndex": 29,
         "P": 8530324693203418
        },
        {
         "moduleIndex": 30,
         "P": 8530324693203418
        },
        {
         "moduleIndex": 31,
         "P": 8530324693203418
        },
        {
         "moduleIndex": 32,
         "P": 8530324693203418
        },
        {
         "moduleIndex": 5,
         "P": 3649720101292759600
        },
        {
         "moduleIndex": 6,
         "P": 3649720101292759600
        }
       ],
       "modules": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36,
        37
       ],
       "protection": 1
      }
     ],
     "powerPaths": [
      {
       "kind": "power",
       "from": "p36",
       "to": "hotel",
       "cap": 63790766701159660,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p11",
       "to": "p11",
       "cap": 681471057142857.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p12",
       "to": "p12",
       "cap": 681471057142857.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p15",
       "cap": 236953463700094.97,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p16",
       "cap": 414668561475166.25,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p25",
       "to": "p25",
       "cap": 473906927400189.94,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p26",
       "to": "p26",
       "cap": 296191829625118.75,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "p35",
       "cap": 4252717780077311,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p37",
       "to": "p40",
       "cap": 4252717780077311,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "p41",
       "cap": 4252717780077311,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "p46",
       "cap": 4252717780077311,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "p47",
       "cap": 4252717780077311,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "p48",
       "cap": 4252717780077311,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "p49",
       "cap": 4252717780077311,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "p50",
       "cap": 4252717780077311,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "p51",
       "cap": 4252717780077311,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "p52",
       "cap": 4252717780077311,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "p53",
       "cap": 4252717780077311,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "p54",
       "cap": 4252717780077311,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "p55",
       "cap": 4252717780077311,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "p56",
       "cap": 4252717780077311,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "f42",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "f43",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "f44",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "f45",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p37",
       "to": "f42",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p37",
       "to": "f43",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p37",
       "to": "f44",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p37",
       "to": "f45",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "p57",
       "cap": 11442743474154938,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p37",
       "to": "p57",
       "cap": 11442743474154938,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p36",
       "to": "p-6000000",
       "cap": 1126460068987211800,
       "auto": false,
       "ok": true,
       "capacityGroup": "p36>p38",
       "groupCap": 1126460068987211800,
       "physical": true,
       "routeId": "p36>p38",
       "efficiency": 0.9999957867482422
      },
      {
       "kind": "power",
       "from": "p-6000000",
       "to": "p38",
       "cap": 1126460068987211800,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p36>p38",
       "efficiency": 1
      },
      {
       "kind": "power",
       "from": "p37",
       "to": "p-6000001",
       "cap": 1126460068987211800,
       "auto": false,
       "ok": true,
       "capacityGroup": "p37>p39",
       "groupCap": 1126460068987211800,
       "physical": true,
       "routeId": "p37>p39",
       "efficiency": 0.9999957867482422
      },
      {
       "kind": "power",
       "from": "p-6000001",
       "to": "p39",
       "cap": 1126460068987211800,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p37>p39",
       "efficiency": 1
      }
     ],
     "trunks": [
      {
       "port": "p-6000000",
       "moduleIndex": 25
      },
      {
       "port": "p-6000001",
       "moduleIndex": 26
      }
     ],
     "fixedLoads": [
      {
       "id": "hotel",
       "port": "hotel",
       "weight": 63790766701159660,
       "domain": "main"
      }
     ],
     "coolingLoads": [
      {
       "id": "p57",
       "port": "p57",
       "weight": 11442743474154938,
       "domain": "main"
      },
      {
       "id": "p11",
       "port": "p11",
       "weight": 681471057142857.2,
       "domain": "main"
      },
      {
       "id": "p12",
       "port": "p12",
       "weight": 681471057142857.2,
       "domain": "main"
      },
      {
       "id": "p15",
       "port": "p15",
       "weight": 236953463700094.97,
       "domain": "main"
      },
      {
       "id": "p16",
       "port": "p16",
       "weight": 414668561475166.25,
       "domain": "main"
      },
      {
       "id": "p25",
       "port": "p25",
       "weight": 473906927400189.94,
       "domain": "main"
      },
      {
       "id": "p26",
       "port": "p26",
       "weight": 296191829625118.75,
       "domain": "main"
      }
     ]
    },
    "propulsion": {
     "version": 1,
     "architectureVersion": 2,
     "cores": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 112818193900723060,
       "densityFactor": 9.984737656573957,
       "efficiency": 0.6555174045430995,
       "wasteFraction": 0.3444825954569005,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 2898473765.657396,
       "ratedShaftPowerW": 738414180743937800,
       "ratedWasteHeatW": 388045888243273900,
       "thermalStoreJ": 338454581702169150,
       "version": 1,
       "id": 38,
       "machineryId": 38,
       "coreId": 38,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 1126460068987211800,
       "driveProfileId": "standard",
       "machineryGradeId": "dense",
       "ratedThrustN": 388639042.49680936,
       "effectiveMachineryVolumeM3": 0.33181821735506783,
       "machineryVolumeM3": 0.33181821735506783,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.6649999999999999,
       "machineryDiameterM": 1.3299999999999998,
       "machineryOffsetM": 0.625,
       "maxInputW": 1128181939007230600,
       "maxRatedInputW": 1128181939007230600,
       "inputDensityWPerM3": 3394810803235145000,
       "allowedInputDensityWPerM3": 3400000000000000000,
       "cost": 968.3582789345694,
       "powerNode": "p38",
       "heatNode": "p38",
       "reactorId": 36,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 7,
       "machineryModuleIndex": 23,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 1126455322927346000,
       "transmissionRouteIds": [
        "p36>p38"
       ]
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 112818193900723060,
       "densityFactor": 9.984737656573957,
       "efficiency": 0.6555174045430995,
       "wasteFraction": 0.3444825954569005,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 2898473765.657396,
       "ratedShaftPowerW": 738414180743937800,
       "ratedWasteHeatW": 388045888243273900,
       "thermalStoreJ": 338454581702169150,
       "version": 1,
       "id": 39,
       "machineryId": 39,
       "coreId": 39,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 1126460068987211800,
       "driveProfileId": "standard",
       "machineryGradeId": "dense",
       "ratedThrustN": 388639042.49680936,
       "effectiveMachineryVolumeM3": 0.33181821735506783,
       "machineryVolumeM3": 0.33181821735506783,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.6649999999999999,
       "machineryDiameterM": 1.3299999999999998,
       "machineryOffsetM": 0.625,
       "maxInputW": 1128181939007230600,
       "maxRatedInputW": 1128181939007230600,
       "inputDensityWPerM3": 3394810803235145000,
       "allowedInputDensityWPerM3": 3400000000000000000,
       "cost": 968.3582789345694,
       "powerNode": "p39",
       "heatNode": "p39",
       "reactorId": 37,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 8,
       "machineryModuleIndex": 24,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 1126455322927346000,
       "transmissionRouteIds": [
        "p37>p39"
       ]
      }
     ],
     "engines": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 112818193900723060,
       "densityFactor": 9.984737656573957,
       "efficiency": 0.6555174045430995,
       "wasteFraction": 0.3444825954569005,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 2898473765.657396,
       "ratedShaftPowerW": 738414180743937800,
       "ratedWasteHeatW": 388045888243273900,
       "thermalStoreJ": 338454581702169150,
       "version": 1,
       "id": 38,
       "machineryId": 38,
       "coreId": 38,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 1126460068987211800,
       "driveProfileId": "standard",
       "machineryGradeId": "dense",
       "ratedThrustN": 388639042.49680936,
       "effectiveMachineryVolumeM3": 0.33181821735506783,
       "machineryVolumeM3": 0.33181821735506783,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.6649999999999999,
       "machineryDiameterM": 1.3299999999999998,
       "machineryOffsetM": 0.625,
       "maxInputW": 1128181939007230600,
       "maxRatedInputW": 1128181939007230600,
       "inputDensityWPerM3": 3394810803235145000,
       "allowedInputDensityWPerM3": 3400000000000000000,
       "cost": 968.3582789345694,
       "powerNode": "p38",
       "heatNode": "p38",
       "reactorId": 36,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 7,
       "coreModuleIndex": 7,
       "machineryModuleIndex": 23,
       "shaftModuleIndices": [],
       "shaftCapacityW": 738414180743937800,
       "ratedShaftCapacityW": 738414180743937800,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 1126455322927346000
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 112818193900723060,
       "densityFactor": 9.984737656573957,
       "efficiency": 0.6555174045430995,
       "wasteFraction": 0.3444825954569005,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 2898473765.657396,
       "ratedShaftPowerW": 738414180743937800,
       "ratedWasteHeatW": 388045888243273900,
       "thermalStoreJ": 338454581702169150,
       "version": 1,
       "id": 39,
       "machineryId": 39,
       "coreId": 39,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 1126460068987211800,
       "driveProfileId": "standard",
       "machineryGradeId": "dense",
       "ratedThrustN": 388639042.49680936,
       "effectiveMachineryVolumeM3": 0.33181821735506783,
       "machineryVolumeM3": 0.33181821735506783,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.6649999999999999,
       "machineryDiameterM": 1.3299999999999998,
       "machineryOffsetM": 0.625,
       "maxInputW": 1128181939007230600,
       "maxRatedInputW": 1128181939007230600,
       "inputDensityWPerM3": 3394810803235145000,
       "allowedInputDensityWPerM3": 3400000000000000000,
       "cost": 968.3582789345694,
       "powerNode": "p39",
       "heatNode": "p39",
       "reactorId": 37,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 8,
       "coreModuleIndex": 8,
       "machineryModuleIndex": 24,
       "shaftModuleIndices": [],
       "shaftCapacityW": 738414180743937800,
       "ratedShaftCapacityW": 738414180743937800,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 1126455322927346000
      }
     ],
     "massKg": 48263.40054492918,
     "ratedThrustN": 777278084.9936187,
     "ratedAccelMps2": 16104.917519643855,
     "structuralAccelerationLimitMps2": 1984477.2789903001,
     "inertialFactor": 1,
     "accelerationLimitMps2": 16104.917519643855
    },
    "profileVersion": 18,
    "heat": {
     "v": 3,
     "mode": "strict",
     "src": [
      {
       "k": "reactor",
       "id": "p36",
       "n": "太陽イオン化反応炉（操縦席ポッド） #36",
       "g": "high",
       "sh": 0.513632,
       "st": 2855053534700524000,
       "m": [
        5
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "reactor",
       "id": "p37",
       "n": "太陽イオン化反応炉（兵装ポッド） #37",
       "g": "high",
       "sh": 0.486368,
       "st": 2703504165569307600,
       "m": [
        6
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p38",
       "n": "イオン・エンジン #38",
       "g": "high",
       "sh": 0.5,
       "st": 338454581702169150,
       "m": [
        7,
        23
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p39",
       "n": "イオン・エンジン #39",
       "g": "high",
       "sh": 0.5,
       "st": 338454581702169150,
       "m": [
        8,
        24
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "feed",
       "id": "p-6000000",
       "n": "推進配電路 1",
       "g": "high",
       "sh": 0.5,
       "st": 284763591936000,
       "m": [
        25
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1,
       "routeId": "p36>p38"
      },
      {
       "k": "feed",
       "id": "p-6000001",
       "n": "推進配電路 2",
       "g": "high",
       "sh": 0.5,
       "st": 284763591936000,
       "m": [
        26
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1,
       "routeId": "p37>p39"
      },
      {
       "k": "weapon",
       "id": "f42",
       "n": "武装（艦首区画）",
       "g": "high",
       "sh": 1,
       "st": 40115000000000000,
       "m": [
        0,
        1,
        2,
        3
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "hotel",
       "id": "hotel",
       "n": "生活・電子設備",
       "g": "low",
       "sh": 1,
       "st": 3827446002069580000,
       "m": [],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      }
     ],
     "dis": [
      {
       "id": "p57",
       "n": "機体内高エネルギー散逸装置 1 #57",
       "k": "hdis",
       "g": "high",
       "cap": 762849564943662600,
       "m": 22,
       "sec": 4,
       "src": -1,
       "power": 11442743474154938
      },
      {
       "id": "p11",
       "n": "翼中央部 #11",
       "k": "solar",
       "g": "high",
       "cap": 68147105714285730,
       "m": 27,
       "sec": 1,
       "src": -1,
       "power": 681471057142857.2
      },
      {
       "id": "p12",
       "n": "翼中央部 #12",
       "k": "solar",
       "g": "high",
       "cap": 68147105714285730,
       "m": 28,
       "sec": 1,
       "src": -1,
       "power": 681471057142857.2
      },
      {
       "id": "p15",
       "n": "上翼板 #15",
       "k": "solar",
       "g": "high",
       "cap": 23695346370009496,
       "m": 29,
       "sec": 1,
       "src": -1,
       "power": 236953463700094.97
      },
      {
       "id": "p16",
       "n": "上翼板 #16",
       "k": "solar",
       "g": "high",
       "cap": 41466856147516620,
       "m": 30,
       "sec": 1,
       "src": -1,
       "power": 414668561475166.25
      },
      {
       "id": "p25",
       "n": "下翼板 #25",
       "k": "solar",
       "g": "high",
       "cap": 47390692740018990,
       "m": 31,
       "sec": 1,
       "src": -1,
       "power": 473906927400189.94
      },
      {
       "id": "p26",
       "n": "下翼板 #26",
       "k": "solar",
       "g": "high",
       "cap": 29619182962511870,
       "m": 32,
       "sec": 1,
       "src": -1,
       "power": 296191829625118.75
      },
      {
       "id": "skin",
       "n": "外殻からの放熱",
       "k": "skin",
       "g": "low",
       "cap": 1.0166067553859739e+21,
       "m": -1,
       "sec": -1,
       "src": -1
      }
     ],
     "ln": [
      {
       "s": 0,
       "d": 0,
       "cap": 41831233765088680,
       "sec": 4
      },
      {
       "s": 0,
       "d": 1,
       "cap": 3736880297964150.5,
       "sec": 0
      },
      {
       "s": 0,
       "d": 2,
       "cap": 3736880297964150.5,
       "sec": 0
      },
      {
       "s": 0,
       "d": 3,
       "cap": 1299346055498916.8,
       "sec": 0
      },
      {
       "s": 0,
       "d": 4,
       "cap": 2273855597123104.5,
       "sec": 0
      },
      {
       "s": 0,
       "d": 5,
       "cap": 2598692110997833.5,
       "sec": 0
      },
      {
       "s": 0,
       "d": 6,
       "cap": 1624182569373646,
       "sec": 0
      },
      {
       "s": 1,
       "d": 0,
       "cap": 39610786053678410,
       "sec": 4
      },
      {
       "s": 1,
       "d": 1,
       "cap": 3538522598260023,
       "sec": 0
      },
      {
       "s": 1,
       "d": 2,
       "cap": 3538522598260023,
       "sec": 0
      },
      {
       "s": 1,
       "d": 3,
       "cap": 1230375343531286.5,
       "sec": 0
      },
      {
       "s": 1,
       "d": 4,
       "cap": 2153156851179751.8,
       "sec": 0
      },
      {
       "s": 1,
       "d": 5,
       "cap": 2460750687062573,
       "sec": 0
      },
      {
       "s": 1,
       "d": 6,
       "cap": 1537969179414108.2,
       "sec": 0
      },
      {
       "s": 2,
       "d": 0,
       "cap": 341129148710111300,
       "sec": 0
      },
      {
       "s": 2,
       "d": 1,
       "cap": 30473851238401200,
       "sec": 0
      },
      {
       "s": 2,
       "d": 2,
       "cap": 30473851238401200,
       "sec": 0
      },
      {
       "s": 2,
       "d": 3,
       "cap": 10596025359455396,
       "sec": 0
      },
      {
       "s": 2,
       "d": 4,
       "cap": 18543044379046944,
       "sec": 0
      },
      {
       "s": 2,
       "d": 5,
       "cap": 21192050718910790,
       "sec": 0
      },
      {
       "s": 2,
       "d": 6,
       "cap": 13245031699319244,
       "sec": 0
      },
      {
       "s": 3,
       "d": 0,
       "cap": 341129140778192060,
       "sec": 0
      },
      {
       "s": 3,
       "d": 1,
       "cap": 30473850529824620,
       "sec": 0
      },
      {
       "s": 3,
       "d": 2,
       "cap": 30473850529824620,
       "sec": 0
      },
      {
       "s": 3,
       "d": 3,
       "cap": 10596025113077104,
       "sec": 0
      },
      {
       "s": 3,
       "d": 4,
       "cap": 18543043947884932,
       "sec": 0
      },
      {
       "s": 3,
       "d": 5,
       "cap": 21192050226154210,
       "sec": 0
      },
      {
       "s": 3,
       "d": 6,
       "cap": 13245031391346380,
       "sec": 0
      },
      {
       "s": 4,
       "d": 0,
       "cap": 4386248788781.0464,
       "sec": 1
      },
      {
       "s": 4,
       "d": 1,
       "cap": 391833689936.35675,
       "sec": 0
      },
      {
       "s": 4,
       "d": 2,
       "cap": 391833689936.35675,
       "sec": 0
      },
      {
       "s": 4,
       "d": 3,
       "cap": 136244010734.77332,
       "sec": 0
      },
      {
       "s": 4,
       "d": 4,
       "cap": 238427018785.85333,
       "sec": 0
      },
      {
       "s": 4,
       "d": 5,
       "cap": 272488021469.54663,
       "sec": 0
      },
      {
       "s": 4,
       "d": 6,
       "cap": 170305013418.46667,
       "sec": 0
      },
      {
       "s": 5,
       "d": 0,
       "cap": 4409274390979.666,
       "sec": 1
      },
      {
       "s": 5,
       "d": 1,
       "cap": 393890619925.273,
       "sec": 0
      },
      {
       "s": 5,
       "d": 2,
       "cap": 393890619925.273,
       "sec": 0
      },
      {
       "s": 5,
       "d": 3,
       "cap": 136959223333.09814,
       "sec": 0
      },
      {
       "s": 5,
       "d": 4,
       "cap": 239678640832.9218,
       "sec": 0
      },
      {
       "s": 5,
       "d": 5,
       "cap": 273918446666.1963,
       "sec": 0
      },
      {
       "s": 5,
       "d": 6,
       "cap": 171199029166.3727,
       "sec": 0
      },
      {
       "s": 6,
       "d": 0,
       "cap": 587750780183724.2,
       "sec": 4
      },
      {
       "s": 6,
       "d": 1,
       "cap": 52505128653763.03,
       "sec": 4
      },
      {
       "s": 6,
       "d": 2,
       "cap": 52505128653763.03,
       "sec": 4
      },
      {
       "s": 6,
       "d": 3,
       "cap": 18256493751458.297,
       "sec": 4
      },
      {
       "s": 6,
       "d": 4,
       "cap": 31948864065052.027,
       "sec": 4
      },
      {
       "s": 6,
       "d": 5,
       "cap": 36512987502916.59,
       "sec": 4
      },
      {
       "s": 6,
       "d": 6,
       "cap": 22820617189322.875,
       "sec": 4
      },
      {
       "s": 7,
       "d": 0,
       "cap": 95686150051739490,
       "sec": 4
      },
      {
       "s": 7,
       "d": 5,
       "cap": 95686150051739490,
       "sec": 4
      },
      {
       "s": 7,
       "d": 6,
       "cap": 95686150051739490,
       "sec": 4
      },
      {
       "s": 7,
       "d": 1,
       "cap": 95686150051739490,
       "sec": 4
      },
      {
       "s": 7,
       "d": 2,
       "cap": 95686150051739490,
       "sec": 4
      },
      {
       "s": 7,
       "d": 3,
       "cap": 95686150051739490,
       "sec": 4
      },
      {
       "s": 7,
       "d": 4,
       "cap": 95686150051739490,
       "sec": 4
      },
      {
       "s": 7,
       "d": 7,
       "cap": 1.0166067553859739e+21,
       "sec": -1
      }
     ]
    },
    "speedReference": {
     "version": 1,
     "key": "tie_sa",
     "status": "published",
     "mglt": 90,
     "model": "TIE/sa tactical bomber",
     "scope": "class",
     "continuity": "canon",
     "source": "https://starwars.fandom.com/wiki/Megalight_per_hour"
    },
    "mglt": 90,
    "maxSpeed": 1800
   },
   "fireArcs": [
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      -1,
      0
     ],
     "pos": [
      3.4000000000000004,
      -0.3540301815474297,
      1.62
     ],
     "k": "claser",
     "gun": 0.5,
     "aa": 0.5,
     "cycle": 0.12
    },
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      -1,
      0
     ],
     "pos": [
      3.4000000000000004,
      -0.21550863918833216,
      1.02
     ],
     "k": "claser",
     "gun": 0.5,
     "aa": 0.5,
     "cycle": 0.12
    }
   ]
  },
  "v19": {
   "reference": "craft_v19",
   "signature": "1grokw1",
   "build": 139679,
   "crew": 1000,
   "total": 140679,
   "by": {
    "hull": 4,
    "armor": 14,
    "power": 44611,
    "drive": 40248,
    "defense": 1500,
    "command": 14501,
    "weapons": 21800,
    "systems": 17001,
    "crew": 1000
   },
   "detailed": true,
   "systems": {
    "v": 1,
    "managed": true,
    "power": 14084217900000000,
    "crew": 1,
    "suitSeats": 0,
    "lifeSupportCapacity": 1,
    "lifeSupportHours": 12.15672,
    "ejectionSeats": 1,
    "ejectionCoverage": 1,
    "ejectionSurvival": 0.9,
    "navCapacity": 1.331,
    "navReady": true,
    "targetDemand": 4,
    "targetCapacity": 4.920750000000001,
    "targetRatio": 1,
    "fireK": 1,
    "maneuverSupport": 23.328,
    "maneuverRatio": 1,
    "turnK": 1,
    "laserUnits": 2,
    "laserGunShare": 1,
    "laserAaShare": 1,
    "laserGasSeconds": 658.5600000000002,
    "landingSupport": 17.7147,
    "landingRatio": 1,
    "landingReady": true
   },
   "heat": {
    "up": 0.00000364,
    "upS": 0.00000364,
    "down": 0.406,
    "T": 0
   },
   "powerProfile": {
    "name": "V-19 トレント",
    "modules": [
     {
      "k": "weapon",
      "fit": 25,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.55,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.32,
      "z": 0.95,
      "r": 0.2,
      "share": 0.5,
      "domain": "main",
      "port": "f25",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 26,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.55,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.32,
      "z": -0.95,
      "r": 0.2,
      "share": 0.5,
      "domain": "main",
      "port": "f26",
      "powerConnected": true
     },
     {
      "k": "launcher",
      "fit": 27,
      "name": "ミサイル発射管",
      "w": 1.0368000000000002,
      "hits": 1,
      "crew": 0,
      "size": 1,
      "stock": 6,
      "mount": "ext",
      "missileKind": "cmsl",
      "launcherCells": 1,
      "ammoPerCell": 6,
      "missileRange": 10000,
      "launchMuzzles": [
       [
        1.237,
        2.6626500606536867,
        0.526
       ],
       [
        1.237,
        2.6626500606536867,
        0.724
       ]
      ],
      "launchBlocked": false,
      "salvo": 1,
      "cycle": 1.2,
      "tt": 25,
      "ammo0": 6,
      "muzzle": [
       1.237,
       2.6626500606536867,
       0.625
      ],
      "launchDir": [
       1,
       0,
       0
      ],
      "launchPowerW": 1000000000000000,
      "at": 0.604,
      "pd": false,
      "dualPurpose": false,
      "y": 0.83,
      "z": 0.09,
      "r": 0.1,
      "share": 0.5,
      "domain": "main",
      "port": "f27",
      "powerConnected": true
     },
     {
      "k": "launcher",
      "fit": 28,
      "name": "ミサイル発射管",
      "w": 1.0368000000000002,
      "hits": 1,
      "crew": 0,
      "size": 1,
      "stock": 6,
      "mount": "ext",
      "missileKind": "cmsl",
      "launcherCells": 1,
      "ammoPerCell": 6,
      "missileRange": 10000,
      "launchMuzzles": [
       [
        1.237,
        2.6626500606536867,
        -0.724
       ],
       [
        1.237,
        2.6626500606536867,
        -0.526
       ]
      ],
      "launchBlocked": false,
      "salvo": 1,
      "cycle": 1.2,
      "tt": 25,
      "ammo0": 6,
      "muzzle": [
       1.237,
       2.6626500606536867,
       -0.625
      ],
      "launchDir": [
       1,
       0,
       0
      ],
      "launchPowerW": 1000000000000000,
      "at": 0.604,
      "pd": false,
      "dualPurpose": false,
      "y": 0.83,
      "z": -0.09,
      "r": 0.1,
      "share": 0.5,
      "domain": "main",
      "port": "f28",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "操縦席",
      "w": 0.649629514953459,
      "hits": 1,
      "crew": 0,
      "size": 0.5235987755982988,
      "at": 0.433,
      "part": 15,
      "y": 0.83,
      "z": 0,
      "r": 0.067,
      "share": 0.6622838705884894,
      "domain": "main",
      "port": "p15",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "右舷ナセル反応炉",
      "w": 0.6837523253910438,
      "hits": 1,
      "crew": 0.00006155188132198442,
      "size": 0.30775940660992207,
      "at": 0.658,
      "part": 16,
      "y": 0.72,
      "z": 0.28,
      "r": 0.056,
      "share": 0.4516309750335137,
      "domain": "main",
      "port": "p16",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "左舷ナセル反応炉",
      "w": 0.6844502513239777,
      "hits": 1,
      "crew": 0.00006164614706637015,
      "size": 0.30823073533185075,
      "at": 0.658,
      "part": 17,
      "y": 0.72,
      "z": -0.28,
      "r": 0.056,
      "share": 0.452322640814231,
      "domain": "main",
      "port": "p17",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "腹部ポッド反応炉",
      "w": 0.16240737873836475,
      "hits": 1,
      "crew": 0.000032724923474893676,
      "size": 0.06544984694978735,
      "at": 0.633,
      "part": 18,
      "y": -0.43,
      "z": 0,
      "r": 0.034,
      "share": 0.09604638415225526,
      "domain": "main",
      "port": "p18",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "右舷ナセル・イオンエンジン",
      "w": 1.3870820263169998,
      "hits": 1,
      "crew": 0.0006534512719466771,
      "size": 1.6336281798666925,
      "at": 0.279,
      "part": 19,
      "y": 0.72,
      "z": 0.28,
      "r": 0.098,
      "share": 0.45079620653293045,
      "domain": "main",
      "port": "p19",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "左舷ナセル・イオンエンジン",
      "w": 1.3870820263169998,
      "hits": 1,
      "crew": 0.0006534512719466771,
      "size": 1.6336281798666925,
      "at": 0.279,
      "part": 20,
      "y": 0.72,
      "z": -0.28,
      "r": 0.098,
      "share": 0.45079620653293045,
      "domain": "main",
      "port": "p20",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "腹部イオンエンジン",
      "w": 0.35998277194310346,
      "hits": 1,
      "crew": 0.00008639379797371933,
      "size": 0.2159844949342983,
      "at": 0.483,
      "part": 21,
      "y": -0.43,
      "z": 0,
      "r": 0.05,
      "share": 0.05960045999834418,
      "domain": "main",
      "port": "p21",
      "powerConnected": true
     },
     {
      "k": "fuel",
      "name": "反応物タンク",
      "w": 0.2508841602456276,
      "hits": 1,
      "crew": 0.00002513274122871835,
      "size": 0.12566370614359174,
      "at": 0.5,
      "part": 22,
      "y": 0.59,
      "z": 0,
      "r": 0.042,
      "share": 1,
      "domain": "main",
      "port": "p22",
      "powerConnected": true
     },
     {
      "k": "battery",
      "name": "パワーセル",
      "w": 0.09000000000000001,
      "hits": 1,
      "crew": 0.0000054,
      "size": 0.027,
      "at": 0.375,
      "part": 23,
      "y": 0.61,
      "z": 0,
      "r": 0.025,
      "share": 1,
      "domain": "main",
      "port": "p23",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "慣性補償装置",
      "w": 0.10769650179907586,
      "hits": 1,
      "crew": 0.000007068583470577035,
      "size": 0.035342917352885174,
      "at": 0.658,
      "part": 24,
      "y": 0.66,
      "z": 0,
      "r": 0.027,
      "share": 0.044704161264723034,
      "domain": "main",
      "port": "p24",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "生命維持装置",
      "w": 0.13690000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.050653,
      "at": 0.6,
      "part": 29,
      "y": 0.67,
      "z": 0,
      "r": 0.031,
      "share": 0.06406941051110385,
      "domain": "main",
      "port": "p29",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "射出座席機構 1",
      "w": 0.08410000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.024388999999999997,
      "at": 0.399,
      "part": 30,
      "y": 0.59,
      "z": 0,
      "r": 0.024,
      "share": 0.03084889054854227,
      "domain": "main",
      "port": "p30",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "航法コンピューター",
      "w": 0.048400000000000006,
      "hits": 1,
      "crew": 0,
      "size": 0.010648,
      "at": 0.6,
      "part": 31,
      "y": 0.74,
      "z": 0,
      "r": 0.018,
      "share": 0.013468325333588015,
      "domain": "main",
      "port": "p31",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "照準コンピューター",
      "w": 0.07290000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.019683000000000003,
      "at": 0.537,
      "part": 32,
      "y": 0.72,
      "z": 0,
      "r": 0.023,
      "share": 0.02489641693660903,
      "domain": "main",
      "port": "p32",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 1",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.558,
      "part": 33,
      "y": 0.72,
      "z": 0,
      "r": 0.015,
      "share": 0.007376716129365637,
      "domain": "main",
      "port": "p33",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 2",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.642,
      "part": 34,
      "y": 0.72,
      "z": 0,
      "r": 0.015,
      "share": 0.007376716129365637,
      "domain": "main",
      "port": "p34",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 3",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.558,
      "part": 35,
      "y": 0.72,
      "z": -0.02,
      "r": 0.015,
      "share": 0.007376716129365637,
      "domain": "main",
      "port": "p35",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 4",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.558,
      "part": 36,
      "y": 0.72,
      "z": 0.02,
      "r": 0.015,
      "share": 0.007376716129365637,
      "domain": "main",
      "port": "p36",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 1",
      "w": 0.07840000000000003,
      "hits": 1,
      "crew": 0,
      "size": 0.021952000000000006,
      "at": 0.6,
      "part": 37,
      "y": 0.78,
      "z": -0.09,
      "r": 0.023,
      "share": 0.027766404744827593,
      "domain": "main",
      "port": "p37",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 2",
      "w": 0.07840000000000003,
      "hits": 1,
      "crew": 0,
      "size": 0.021952000000000006,
      "at": 0.6,
      "part": 38,
      "y": 0.78,
      "z": 0.09,
      "r": 0.023,
      "share": 0.027766404744827593,
      "domain": "main",
      "port": "p38",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 1",
      "w": 0.07290000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.019683000000000003,
      "at": 0.537,
      "part": 39,
      "y": 0.72,
      "z": -0.03,
      "r": 0.023,
      "share": 0.02489641693660903,
      "domain": "main",
      "port": "p39",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 2",
      "w": 0.07290000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.019683000000000003,
      "at": 0.537,
      "part": 40,
      "y": 0.72,
      "z": 0.03,
      "r": 0.023,
      "share": 0.02489641693660903,
      "domain": "main",
      "port": "p40",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 3",
      "w": 0.07290000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.019683000000000003,
      "at": 0.569,
      "part": 41,
      "y": 0.78,
      "z": -0.09,
      "r": 0.023,
      "share": 0.02489641693660903,
      "domain": "main",
      "port": "p41",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 1",
      "w": 0.1463932727955029,
      "hits": 1,
      "crew": 0.0000028006038688830665,
      "size": 0.056012077377661326,
      "at": 0.292,
      "part": 42,
      "y": 0.81,
      "z": 0,
      "r": 0.032,
      "share": 0.020992509805511348,
      "domain": "main",
      "port": "p42",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.15125694757895664,
      "hits": 1,
      "crew": 0.000011765299673531487,
      "size": 0.05882649836765743,
      "at": 0.575,
      "part": -19,
      "machineryOwner": 19,
      "y": 0.72,
      "z": 0.28,
      "r": 0.032,
      "share": 0.016233046561378233,
      "domain": "main",
      "port": "p19",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.15125694757895664,
      "hits": 1,
      "crew": 0.000011765299673531487,
      "size": 0.05882649836765743,
      "at": 0.575,
      "part": -20,
      "machineryOwner": 20,
      "y": 0.72,
      "z": -0.28,
      "r": 0.032,
      "share": 0.016233046561378233,
      "domain": "main",
      "port": "p20",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.08082679441492312,
      "hits": 1,
      "crew": 0.000004595820184973238,
      "size": 0.02297910092486619,
      "at": 0.6,
      "part": -21,
      "machineryOwner": 21,
      "y": -0.43,
      "z": 0,
      "r": 0.024,
      "share": 0.006341033813038374,
      "domain": "main",
      "port": "p21",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p16 → p19",
      "w": 0.001426136728240173,
      "hits": 1,
      "crew": 1.0771389802180299e-8,
      "size": 0.000053856949010901494,
      "at": 0.567,
      "part": -6000000,
      "routeId": "p16>p19",
      "capacityW": 544804953931408500,
      "y": 0.72,
      "z": 0.28,
      "r": 0.003,
      "share": 0.48415075048737266,
      "domain": "main",
      "port": "p-6000000",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p17 → p20",
      "w": 0.001426136728240173,
      "hits": 1,
      "crew": 1.0771389802180299e-8,
      "size": 0.000053856949010901494,
      "at": 0.567,
      "part": -6000001,
      "routeId": "p17>p20",
      "capacityW": 544804953931408500,
      "y": 0.72,
      "z": -0.28,
      "r": 0.003,
      "share": 0.48415075048737266,
      "domain": "main",
      "port": "p-6000001",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p18 → p21",
      "w": 0.0002316682708847727,
      "hits": 1,
      "crew": 7.052284620055669e-10,
      "size": 0.0000035261423100278347,
      "at": 0.596,
      "part": -6000002,
      "routeId": "p18>p21",
      "capacityW": 72029501120739090,
      "y": -0.43,
      "z": 0,
      "r": 0.002,
      "share": 0.03169849902525472,
      "domain": "main",
      "port": "p-6000002",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "右舷主翼（Sフォイル・付け根）",
      "w": 1.0773357902054004,
      "hits": 1,
      "crew": 0,
      "size": 0.26122736070900443,
      "at": 0.404,
      "part": 5,
      "ext": 1,
      "y": 0.54,
      "z": 0.4,
      "r": 0.053,
      "share": 0.0979042054479964,
      "domain": "main",
      "port": "p5",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "左舷主翼（Sフォイル・付け根）",
      "w": 1.0773357117154987,
      "hits": 1,
      "crew": 0,
      "size": 0.26122733216120675,
      "at": 0.404,
      "part": 6,
      "ext": 1,
      "y": 0.54,
      "z": -0.4,
      "r": 0.053,
      "share": 0.09790419474869812,
      "domain": "main",
      "port": "p6",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "右舷主翼（Sフォイル）",
      "w": 2.215259458511551,
      "hits": 1,
      "crew": 0,
      "size": 0.6345341746585051,
      "at": 0.426,
      "part": 7,
      "ext": 1,
      "y": -0.02,
      "z": 0.74,
      "r": 0.072,
      "share": 0.23781415557286886,
      "domain": "main",
      "port": "p7",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "左舷主翼（Sフォイル）",
      "w": 2.215259365467241,
      "hits": 1,
      "crew": 0,
      "size": 0.6345341346813863,
      "at": 0.426,
      "part": 8,
      "ext": 1,
      "y": -0.02,
      "z": -0.74,
      "r": 0.072,
      "share": 0.2378141405900277,
      "domain": "main",
      "port": "p8",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "腹部Sフォイル（垂直安定板）",
      "w": 2.2571071300089995,
      "hits": 1,
      "crew": 0,
      "size": 0.8206583806794776,
      "at": 0.474,
      "part": 9,
      "ext": 1,
      "y": -0.17,
      "z": 0,
      "r": 0.078,
      "share": 0.3075707938348975,
      "domain": "main",
      "port": "p9",
      "powerConnected": true
     },
     {
      "k": "quarters",
      "name": "居住空間（後部）",
      "w": 0.07837213943860248,
      "hits": 1,
      "crew": 0,
      "size": 0.3776640665621521,
      "at": 0.178,
      "y": 0.79,
      "z": 0,
      "r": 0.06,
      "share": 0.053003533568904596,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央後部）",
      "w": 0.3580903461581324,
      "hits": 1,
      "crew": 0,
      "size": 3.6885190500903517,
      "at": 0.391,
      "y": 0.37,
      "z": 0,
      "r": 0.129,
      "share": 0.5176678445229681,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央前部）",
      "w": 0.30824173294302365,
      "hits": 1,
      "crew": 0,
      "size": 2.9457797191847863,
      "at": 0.587,
      "y": 0.23,
      "z": 0,
      "r": 0.119,
      "share": 0.4134275618374558,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（前部）",
      "w": 0.035121727767799316,
      "hits": 1,
      "crew": 0,
      "size": 0.11329921996864563,
      "at": 0.763,
      "y": 0.69,
      "z": 0,
      "r": 0.04,
      "share": 0.01590106007067138,
      "domain": "main"
     },
     {
      "k": "hull",
      "name": "船体構造",
      "w": 12.501424958004366,
      "hits": null,
      "crew": 0,
      "size": 1,
      "share": 1,
      "domain": "main"
     }
    ],
    "energyModel": {
     "version": 0,
     "eta": 0.75
    },
    "D": 0,
    "shieldBuffer": 0,
    "wCap": 0,
    "crewNeed": 1,
    "crewMax": 1,
    "hp": 1,
    "len": 6,
    "width": 13.33307933807373,
    "height": 5.850300121307373,
    "grid": {
     "P": 3568703751125112000,
     "fixed": 29664258701248292,
     "cooling": 11461726278290428,
     "De": 1161639408983556000,
     "Ds": 0,
     "Dw": 139466666666666.69,
     "domains": [
      {
       "id": "main",
       "P": 3568703751125112000,
       "reactors": [
        5,
        6,
        7
       ],
       "sources": [
        {
         "moduleIndex": 5,
         "P": 1611737154726392000
        },
        {
         "moduleIndex": 6,
         "P": 1614205504992562700
        },
        {
         "moduleIndex": 7,
         "P": 342761091406156860
        }
       ],
       "modules": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36,
        37,
        38,
        39,
        40,
        41,
        42,
        43
       ],
       "protection": 1
      }
     ],
     "powerPaths": [
      {
       "kind": "power",
       "from": "p16",
       "to": "hotel",
       "cap": 29664258701248296,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p5",
       "cap": 245563728807109.12,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p6",
       "cap": 245563728807109.12,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p7",
       "cap": 729408761587970.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p8",
       "cap": 729408761587970.2,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p9",
       "cap": 711717583697032.6,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p15",
       "cap": 1648014372291571.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p22",
       "cap": 1648014372291571.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p23",
       "cap": 1648014372291571.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p24",
       "cap": 1648014372291571.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p29",
       "cap": 1648014372291571.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p30",
       "cap": 1648014372291571.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p31",
       "cap": 1648014372291571.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p32",
       "cap": 1648014372291571.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p33",
       "cap": 1648014372291571.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p34",
       "cap": 1648014372291571.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p35",
       "cap": 1648014372291571.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p36",
       "cap": 1648014372291571.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p37",
       "cap": 1648014372291571.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p38",
       "cap": 1648014372291571.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p39",
       "cap": 1648014372291571.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p40",
       "cap": 1648014372291571.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p41",
       "cap": 1648014372291571.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "f25",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "f26",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "f27",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "f28",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "f25",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "f26",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "f27",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "f28",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "f25",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "f26",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "f27",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "f28",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p42",
       "cap": 8800063713803237,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p42",
       "cap": 8800063713803237,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p42",
       "cap": 8800063713803237,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p-6000000",
       "cap": 544804953931408500,
       "auto": false,
       "ok": true,
       "capacityGroup": "p16>p19",
       "groupCap": 544804953931408500,
       "physical": true,
       "routeId": "p16>p19",
       "efficiency": 0.9999990114458027
      },
      {
       "kind": "power",
       "from": "p-6000000",
       "to": "p19",
       "cap": 544804953931408500,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p16>p19",
       "efficiency": 1
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p-6000001",
       "cap": 544804953931408500,
       "auto": false,
       "ok": true,
       "capacityGroup": "p17>p20",
       "groupCap": 544804953931408500,
       "physical": true,
       "routeId": "p17>p20",
       "efficiency": 0.9999990114458027
      },
      {
       "kind": "power",
       "from": "p-6000001",
       "to": "p20",
       "cap": 544804953931408500,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p17>p20",
       "efficiency": 1
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p-6000002",
       "cap": 72029501120739090,
       "auto": false,
       "ok": true,
       "capacityGroup": "p18>p21",
       "groupCap": 72029501120739090,
       "physical": true,
       "routeId": "p18>p21",
       "efficiency": 0.9999995104587159
      },
      {
       "kind": "power",
       "from": "p-6000002",
       "to": "p21",
       "cap": 72029501120739090,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p18>p21",
       "efficiency": 1
      }
     ],
     "trunks": [
      {
       "port": "p-6000000",
       "moduleIndex": 31
      },
      {
       "port": "p-6000001",
       "moduleIndex": 32
      },
      {
       "port": "p-6000002",
       "moduleIndex": 33
      }
     ],
     "fixedLoads": [
      {
       "id": "hotel",
       "port": "hotel",
       "weight": 16202532422957864,
       "domain": "main"
      },
      {
       "id": "f27",
       "port": "f27",
       "domain": "main",
       "weight": 1000000000000000
      },
      {
       "id": "f28",
       "port": "f28",
       "domain": "main",
       "weight": 1000000000000000
      }
     ],
     "coolingLoads": [
      {
       "id": "p42",
       "port": "p42",
       "weight": 8800063713803237,
       "domain": "main"
      },
      {
       "id": "p5",
       "port": "p5",
       "weight": 245563728807109.12,
       "domain": "main"
      },
      {
       "id": "p6",
       "port": "p6",
       "weight": 245563728807109.12,
       "domain": "main"
      },
      {
       "id": "p7",
       "port": "p7",
       "weight": 729408761587970.2,
       "domain": "main"
      },
      {
       "id": "p8",
       "port": "p8",
       "weight": 729408761587970.2,
       "domain": "main"
      },
      {
       "id": "p9",
       "port": "p9",
       "weight": 711717583697032.6,
       "domain": "main"
      }
     ]
    },
    "propulsion": {
     "version": 1,
     "architectureVersion": 2,
     "cores": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 20001009445003536,
       "densityFactor": 27.23887288936342,
       "efficiency": 0.4109096699969664,
       "wasteFraction": 0.5890903300030337,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 4623887288.936342,
       "ratedShaftPowerW": 223865623832667550,
       "ratedWasteHeatW": 320939330098741000,
       "thermalStoreJ": 60003028335010616,
       "version": 1,
       "id": 19,
       "machineryId": 19,
       "coreId": 19,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 544804953931408500,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 117824012.54350924,
       "effectiveMachineryVolumeM3": 0.05882649836765746,
       "machineryVolumeM3": 0.05882649836765746,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.27999999999999997,
       "machineryDiameterM": 0.5599999999999999,
       "machineryOffsetM": 1.625,
       "maxInputW": 2000100944500353500,
       "maxRatedInputW": 2000100944500353500,
       "inputDensityWPerM3": 9261216782383563000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 2838.867985810085,
       "powerNode": "p19",
       "heatNode": "p19",
       "reactorId": 16,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 8,
       "machineryModuleIndex": 28,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 544804415362184600,
       "transmissionRouteIds": [
        "p16>p19"
       ]
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 20001009445003536,
       "densityFactor": 27.23887288936342,
       "efficiency": 0.4109096699969664,
       "wasteFraction": 0.5890903300030337,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 4623887288.936342,
       "ratedShaftPowerW": 223865623832667550,
       "ratedWasteHeatW": 320939330098741000,
       "thermalStoreJ": 60003028335010616,
       "version": 1,
       "id": 20,
       "machineryId": 20,
       "coreId": 20,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 544804953931408500,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 117824012.54350924,
       "effectiveMachineryVolumeM3": 0.05882649836765746,
       "machineryVolumeM3": 0.05882649836765746,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.27999999999999997,
       "machineryDiameterM": 0.5599999999999999,
       "machineryOffsetM": 1.625,
       "maxInputW": 2000100944500353500,
       "maxRatedInputW": 2000100944500353500,
       "inputDensityWPerM3": 9261216782383563000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 2838.867985810085,
       "powerNode": "p20",
       "heatNode": "p20",
       "reactorId": 17,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 9,
       "machineryModuleIndex": 29,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 544804415362184600,
       "transmissionRouteIds": [
        "p17>p20"
       ]
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 7812894314454507,
       "densityFactor": 9.219310824092231,
       "efficiency": 0.6732978037074794,
       "wasteFraction": 0.3267021962925206,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 2821931082.409223,
       "ratedShaftPowerW": 48497304906739060,
       "ratedWasteHeatW": 23532196214000036,
       "thermalStoreJ": 23438682943363524,
       "version": 1,
       "id": 21,
       "machineryId": 21,
       "coreId": 21,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 72029501120739090,
       "driveProfileId": "standard",
       "machineryGradeId": "dense",
       "ratedThrustN": 25524897.319336344,
       "effectiveMachineryVolumeM3": 0.022979100924866196,
       "machineryVolumeM3": 0.022979100924866196,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.175,
       "machineryDiameterM": 0.35,
       "machineryOffsetM": 0.55,
       "maxInputW": 78128943144545070,
       "maxRatedInputW": 78128943144545070,
       "inputDensityWPerM3": 3134565680191358500,
       "allowedInputDensityWPerM3": 3400000000000000000,
       "cost": 56.14573282385027,
       "powerNode": "p21",
       "heatNode": "p21",
       "reactorId": 18,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 10,
       "machineryModuleIndex": 30,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 72029465859324616,
       "transmissionRouteIds": [
        "p18>p21"
       ]
      }
     ],
     "engines": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 20001009445003536,
       "densityFactor": 27.23887288936342,
       "efficiency": 0.4109096699969664,
       "wasteFraction": 0.5890903300030337,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 4623887288.936342,
       "ratedShaftPowerW": 223865623832667550,
       "ratedWasteHeatW": 320939330098741000,
       "thermalStoreJ": 60003028335010616,
       "version": 1,
       "id": 19,
       "machineryId": 19,
       "coreId": 19,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 544804953931408500,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 117824012.54350924,
       "effectiveMachineryVolumeM3": 0.05882649836765746,
       "machineryVolumeM3": 0.05882649836765746,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.27999999999999997,
       "machineryDiameterM": 0.5599999999999999,
       "machineryOffsetM": 1.625,
       "maxInputW": 2000100944500353500,
       "maxRatedInputW": 2000100944500353500,
       "inputDensityWPerM3": 9261216782383563000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 2838.867985810085,
       "powerNode": "p19",
       "heatNode": "p19",
       "reactorId": 16,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 8,
       "coreModuleIndex": 8,
       "machineryModuleIndex": 28,
       "shaftModuleIndices": [],
       "shaftCapacityW": 223865623832667550,
       "ratedShaftCapacityW": 223865623832667550,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 544804415362184600
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 20001009445003536,
       "densityFactor": 27.23887288936342,
       "efficiency": 0.4109096699969664,
       "wasteFraction": 0.5890903300030337,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 4623887288.936342,
       "ratedShaftPowerW": 223865623832667550,
       "ratedWasteHeatW": 320939330098741000,
       "thermalStoreJ": 60003028335010616,
       "version": 1,
       "id": 20,
       "machineryId": 20,
       "coreId": 20,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 544804953931408500,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 117824012.54350924,
       "effectiveMachineryVolumeM3": 0.05882649836765746,
       "machineryVolumeM3": 0.05882649836765746,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.27999999999999997,
       "machineryDiameterM": 0.5599999999999999,
       "machineryOffsetM": 1.625,
       "maxInputW": 2000100944500353500,
       "maxRatedInputW": 2000100944500353500,
       "inputDensityWPerM3": 9261216782383563000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 2838.867985810085,
       "powerNode": "p20",
       "heatNode": "p20",
       "reactorId": 17,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 9,
       "coreModuleIndex": 9,
       "machineryModuleIndex": 29,
       "shaftModuleIndices": [],
       "shaftCapacityW": 223865623832667550,
       "ratedShaftCapacityW": 223865623832667550,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 544804415362184600
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 7812894314454507,
       "densityFactor": 9.219310824092231,
       "efficiency": 0.6732978037074794,
       "wasteFraction": 0.3267021962925206,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 2821931082.409223,
       "ratedShaftPowerW": 48497304906739060,
       "ratedWasteHeatW": 23532196214000036,
       "thermalStoreJ": 23438682943363524,
       "version": 1,
       "id": 21,
       "machineryId": 21,
       "coreId": 21,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 72029501120739090,
       "driveProfileId": "standard",
       "machineryGradeId": "dense",
       "ratedThrustN": 25524897.319336344,
       "effectiveMachineryVolumeM3": 0.022979100924866196,
       "machineryVolumeM3": 0.022979100924866196,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.175,
       "machineryDiameterM": 0.35,
       "machineryOffsetM": 0.55,
       "maxInputW": 78128943144545070,
       "maxRatedInputW": 78128943144545070,
       "inputDensityWPerM3": 3134565680191358500,
       "allowedInputDensityWPerM3": 3400000000000000000,
       "cost": 56.14573282385027,
       "powerNode": "p21",
       "heatNode": "p21",
       "reactorId": 18,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 10,
       "coreModuleIndex": 10,
       "machineryModuleIndex": 30,
       "shaftModuleIndices": [],
       "shaftCapacityW": 48497304906739060,
       "ratedShaftCapacityW": 48497304906739060,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 72029465859324616
      }
     ],
     "massKg": 12612.260228975192,
     "ratedThrustN": 261172922.40635484,
     "ratedAccelMps2": 20707.860261742826,
     "structuralAccelerationLimitMps2": 939881.4387339321,
     "inertialFactor": 1,
     "accelerationLimitMps2": 20707.860261742826
    },
    "profileVersion": 18,
    "heat": {
     "v": 3,
     "mode": "strict",
     "src": [
      {
       "k": "reactor",
       "id": "p16",
       "n": "右舷ナセル反応炉 #16",
       "g": "high",
       "sh": 0.480864,
       "st": 1375012774140555000,
       "m": [
        5
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "reactor",
       "id": "p17",
       "n": "左舷ナセル反応炉 #17",
       "g": "high",
       "sh": 0.458083,
       "st": 1309871823412328700,
       "m": [
        6
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "reactor",
       "id": "p18",
       "n": "腹部ポッド反応炉 #18",
       "g": "high",
       "sh": 0.061053,
       "st": 174578924890646700,
       "m": [
        7
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p19",
       "n": "右舷ナセル・イオンエンジン #19",
       "g": "high",
       "sh": 0.482318,
       "st": 60003028335010616,
       "m": [
        8,
        28
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p20",
       "n": "左舷ナセル・イオンエンジン #20",
       "g": "high",
       "sh": 0.482318,
       "st": 60003028335010616,
       "m": [
        9,
        29
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p21",
       "n": "腹部イオンエンジン #21",
       "g": "high",
       "sh": 0.0353649,
       "st": 23438682943363524,
       "m": [
        10,
        30
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "feed",
       "id": "p-6000000",
       "n": "推進配電路 1",
       "g": "high",
       "sh": 0.484151,
       "st": 32314153436160,
       "m": [
        31
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1,
       "routeId": "p16>p19"
      },
      {
       "k": "feed",
       "id": "p-6000001",
       "n": "推進配電路 2",
       "g": "high",
       "sh": 0.484151,
       "st": 32314153436160,
       "m": [
        32
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1,
       "routeId": "p17>p20"
      },
      {
       "k": "feed",
       "id": "p-6000002",
       "n": "推進配電路 3",
       "g": "high",
       "sh": 0.0316985,
       "st": 2115684868320,
       "m": [
        33
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1,
       "routeId": "p18>p21"
      },
      {
       "k": "weapon",
       "id": "f25",
       "n": "武装（艦首区画）",
       "g": "high",
       "sh": 1,
       "st": 2615000000000000,
       "m": [
        0,
        1,
        2,
        3
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "hotel",
       "id": "hotel",
       "n": "生活・電子設備",
       "g": "low",
       "sh": 1,
       "st": 1779855522074897400,
       "m": [],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      }
     ],
     "dis": [
      {
       "id": "p42",
       "n": "機体内高エネルギー散逸装置 1 #42",
       "k": "hdis",
       "g": "high",
       "cap": 586670914253549200,
       "m": 27,
       "sec": 0,
       "src": -1,
       "power": 8800063713803237
      },
      {
       "id": "p5",
       "n": "右舷主翼（Sフォイル・付け根） #5",
       "k": "wing",
       "g": "high",
       "cap": 24556372880710910,
       "m": 34,
       "sec": 2,
       "src": -1,
       "power": 245563728807109.12
      },
      {
       "id": "p6",
       "n": "左舷主翼（Sフォイル・付け根） #6",
       "k": "wing",
       "g": "high",
       "cap": 24556372880710910,
       "m": 35,
       "sec": 2,
       "src": -1,
       "power": 245563728807109.12
      },
      {
       "id": "p7",
       "n": "右舷主翼（Sフォイル） #7",
       "k": "wing",
       "g": "high",
       "cap": 72940876158797020,
       "m": 36,
       "sec": 2,
       "src": -1,
       "power": 729408761587970.2
      },
      {
       "id": "p8",
       "n": "左舷主翼（Sフォイル） #8",
       "k": "wing",
       "g": "high",
       "cap": 72940876158797020,
       "m": 37,
       "sec": 2,
       "src": -1,
       "power": 729408761587970.2
      },
      {
       "id": "p9",
       "n": "腹部Sフォイル（垂直安定板） #9",
       "k": "wing",
       "g": "high",
       "cap": 71171758369703260,
       "m": 38,
       "sec": 3,
       "src": -1,
       "power": 711717583697032.6
      },
      {
       "id": "skin",
       "n": "外殻からの放熱",
       "k": "skin",
       "g": "low",
       "cap": 349102354902465250000,
       "m": -1,
       "sec": -1,
       "src": -1
      }
     ],
     "ln": [
      {
       "s": 0,
       "d": 0,
       "cap": 18917561969094004,
       "sec": 3
      },
      {
       "s": 0,
       "d": 1,
       "cap": 791835242587565.9,
       "sec": 4
      },
      {
       "s": 0,
       "d": 2,
       "cap": 791835242587565.9,
       "sec": 4
      },
      {
       "s": 0,
       "d": 3,
       "cap": 2352023104076539.5,
       "sec": 4
      },
      {
       "s": 0,
       "d": 4,
       "cap": 2352023104076539.5,
       "sec": 4
      },
      {
       "s": 0,
       "d": 5,
       "cap": 2294976820388878,
       "sec": 4
      },
      {
       "s": 1,
       "d": 0,
       "cap": 18021346315463316,
       "sec": 3
      },
      {
       "s": 1,
       "d": 1,
       "cap": 754322208896289.6,
       "sec": 4
      },
      {
       "s": 1,
       "d": 2,
       "cap": 754322208896289.6,
       "sec": 4
      },
      {
       "s": 1,
       "d": 3,
       "cap": 2240596487527420.5,
       "sec": 4
      },
      {
       "s": 1,
       "d": 4,
       "cap": 2240596487527420.5,
       "sec": 4
      },
      {
       "s": 1,
       "d": 5,
       "cap": 2186252759935828,
       "sec": 4
      },
      {
       "s": 2,
       "d": 0,
       "cap": 2401874144173603,
       "sec": 3
      },
      {
       "s": 2,
       "d": 1,
       "cap": 100535608062162.55,
       "sec": 4
      },
      {
       "s": 2,
       "d": 2,
       "cap": 100535608062162.55,
       "sec": 4
      },
      {
       "s": 2,
       "d": 3,
       "cap": 298625345560368.4,
       "sec": 4
      },
      {
       "s": 2,
       "d": 4,
       "cap": 298625345560368.4,
       "sec": 4
      },
      {
       "s": 2,
       "d": 5,
       "cap": 291382446394268.9,
       "sec": 4
      },
      {
       "s": 3,
       "d": 0,
       "cap": 264930686491405500,
       "sec": 0
      },
      {
       "s": 3,
       "d": 1,
       "cap": 11089243674715406,
       "sec": 0
      },
      {
       "s": 3,
       "d": 2,
       "cap": 11089243674715406,
       "sec": 0
      },
      {
       "s": 3,
       "d": 3,
       "cap": 32938869005670636,
       "sec": 1
      },
      {
       "s": 3,
       "d": 4,
       "cap": 32938869005670636,
       "sec": 1
      },
      {
       "s": 3,
       "d": 5,
       "cap": 32139965260893870,
       "sec": 2
      },
      {
       "s": 4,
       "d": 0,
       "cap": 264930686491405500,
       "sec": 0
      },
      {
       "s": 4,
       "d": 1,
       "cap": 11089243674715406,
       "sec": 0
      },
      {
       "s": 4,
       "d": 2,
       "cap": 11089243674715406,
       "sec": 0
      },
      {
       "s": 4,
       "d": 3,
       "cap": 32938869005670636,
       "sec": 1
      },
      {
       "s": 4,
       "d": 4,
       "cap": 32938869005670636,
       "sec": 1
      },
      {
       "s": 4,
       "d": 5,
       "cap": 32139965260893870,
       "sec": 2
      },
      {
       "s": 5,
       "d": 0,
       "cap": 19425489205186624,
       "sec": 2
      },
      {
       "s": 5,
       "d": 1,
       "cap": 813095629463279.6,
       "sec": 3
      },
      {
       "s": 5,
       "d": 2,
       "cap": 813095629463279.6,
       "sec": 3
      },
      {
       "s": 5,
       "d": 3,
       "cap": 2415173767805370.5,
       "sec": 3
      },
      {
       "s": 5,
       "d": 4,
       "cap": 2415173767805370.5,
       "sec": 3
      },
      {
       "s": 5,
       "d": 5,
       "cap": 2356595819453406,
       "sec": 3
      },
      {
       "s": 6,
       "d": 0,
       "cap": 372515717562.51514,
       "sec": 2
      },
      {
       "s": 6,
       "d": 1,
       "cap": 15592446535.430698,
       "sec": 4
      },
      {
       "s": 6,
       "d": 2,
       "cap": 15592446535.430698,
       "sec": 4
      },
      {
       "s": 6,
       "d": 3,
       "cap": 46314930844.15928,
       "sec": 4
      },
      {
       "s": 6,
       "d": 4,
       "cap": 46314930844.15928,
       "sec": 4
      },
      {
       "s": 6,
       "d": 5,
       "cap": 45191602302.3048,
       "sec": 4
      },
      {
       "s": 7,
       "d": 0,
       "cap": 372515717562.51514,
       "sec": 2
      },
      {
       "s": 7,
       "d": 1,
       "cap": 15592446535.430698,
       "sec": 4
      },
      {
       "s": 7,
       "d": 2,
       "cap": 15592446535.430698,
       "sec": 4
      },
      {
       "s": 7,
       "d": 3,
       "cap": 46314930844.15928,
       "sec": 4
      },
      {
       "s": 7,
       "d": 4,
       "cap": 46314930844.15928,
       "sec": 4
      },
      {
       "s": 7,
       "d": 5,
       "cap": 45191602302.3048,
       "sec": 4
      },
      {
       "s": 8,
       "d": 0,
       "cap": 24504207194.765118,
       "sec": 3
      },
      {
       "s": 8,
       "d": 1,
       "cap": 1025676293.8153636,
       "sec": 4
      },
      {
       "s": 8,
       "d": 2,
       "cap": 1025676293.8153636,
       "sec": 4
      },
      {
       "s": 8,
       "d": 3,
       "cap": 3046611480.027114,
       "sec": 4
      },
      {
       "s": 8,
       "d": 4,
       "cap": 3046611480.027114,
       "sec": 4
      },
      {
       "s": 8,
       "d": 5,
       "cap": 2972718556.749921,
       "sec": 4
      },
      {
       "s": 9,
       "d": 0,
       "cap": 35977429067960.086,
       "sec": 2
      },
      {
       "s": 9,
       "d": 1,
       "cap": 1505912671000.9907,
       "sec": 3
      },
      {
       "s": 9,
       "d": 2,
       "cap": 1505912671000.9907,
       "sec": 3
      },
      {
       "s": 9,
       "d": 3,
       "cap": 4473078747217.107,
       "sec": 4
      },
      {
       "s": 9,
       "d": 4,
       "cap": 4473078747217.107,
       "sec": 4
      },
      {
       "s": 9,
       "d": 5,
       "cap": 4364588095603.7236,
       "sec": 4
      },
      {
       "s": 10,
       "d": 0,
       "cap": 44496388051872450,
       "sec": 2
      },
      {
       "s": 10,
       "d": 5,
       "cap": 44496388051872450,
       "sec": 4
      },
      {
       "s": 10,
       "d": 1,
       "cap": 44496388051872450,
       "sec": 3
      },
      {
       "s": 10,
       "d": 2,
       "cap": 44496388051872450,
       "sec": 3
      },
      {
       "s": 10,
       "d": 3,
       "cap": 44496388051872450,
       "sec": 3
      },
      {
       "s": 10,
       "d": 4,
       "cap": 44496388051872450,
       "sec": 3
      },
      {
       "s": 10,
       "d": 6,
       "cap": 349102354902465250000,
       "sec": -1
      }
     ]
    },
    "speedReference": {
     "version": 1,
     "key": "v19",
     "status": "published",
     "mglt": 100,
     "model": "V-19 Torrent starfighter",
     "scope": "class",
     "continuity": "canon",
     "source": "https://starwars.fandom.com/wiki/Megalight_per_hour"
    },
    "mglt": 100,
    "maxSpeed": 2000
   },
   "fireArcs": [
    {
     "fixed": true,
     "dir": [
      0.9999999863875016,
      -0.00013389005854993268,
      -0.00009642846315255796
     ],
     "up": [
      0.00016499998874081365,
      0.8114549446283451,
      0.5844149601209856
     ],
     "pos": [
      4.602042033081991,
      -2.1793721524960974,
      6.448814676721437
     ],
     "k": "claser",
     "gun": 0.5,
     "aa": 0.5,
     "cycle": 0.12
    },
    {
     "fixed": true,
     "dir": [
      0.9999999863875016,
      -0.00013389005854993268,
      0.00009642846315255796
     ],
     "up": [
      0.00016499998874081365,
      0.8114549446283451,
      -0.5844149601209856
     ],
     "pos": [
      4.602042075750297,
      -2.1791623136458997,
      -6.448965803982515
     ],
     "k": "claser",
     "gun": 0.5,
     "aa": 0.5,
     "cycle": 0.12
    }
   ]
  },
  "vulture": {
   "reference": "craft_vulture",
   "signature": "cvxwp8",
   "build": 121700,
   "crew": 0,
   "total": 121700,
   "by": {
    "hull": 2,
    "armor": 1,
    "power": 18324,
    "drive": 34272,
    "command": 13500,
    "weapons": 38601,
    "systems": 17000
   },
   "detailed": true,
   "systems": {
    "v": 1,
    "managed": true,
    "power": 15052662000000000,
    "crew": 0,
    "suitSeats": 0,
    "lifeSupportCapacity": 0,
    "lifeSupportHours": null,
    "ejectionSeats": 0,
    "ejectionCoverage": 0,
    "ejectionSurvival": 0,
    "navCapacity": 2.331,
    "navReady": true,
    "targetDemand": 7,
    "targetCapacity": 8.192000000000002,
    "targetRatio": 1,
    "fireK": 1,
    "maneuverSupport": 23.328,
    "maneuverRatio": 1,
    "turnK": 1,
    "laserUnits": 4,
    "laserGunShare": 1,
    "laserAaShare": 1,
    "laserGasSeconds": 643.1249999999999,
    "landingSupport": 12.7776,
    "landingRatio": 1,
    "landingReady": true
   },
   "heat": {
    "up": 0.0000842,
    "upS": 0.0000842,
    "down": 0.478,
    "T": 0
   },
   "powerProfile": {
    "name": "ヴァルチャー級ドロイド・スターファイター",
    "modules": [
     {
      "k": "weapon",
      "fit": 19,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.817,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": 0.37,
      "z": 0.85,
      "r": 0.172,
      "share": 0.25,
      "domain": "main",
      "port": "f19",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 20,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.817,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": 0.37,
      "z": -0.85,
      "r": 0.172,
      "share": 0.25,
      "domain": "main",
      "port": "f20",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 21,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.817,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.37,
      "z": 0.85,
      "r": 0.172,
      "share": 0.25,
      "domain": "main",
      "port": "f21",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 22,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.817,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.37,
      "z": -0.85,
      "r": 0.172,
      "share": 0.25,
      "domain": "main",
      "port": "f22",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 23,
      "name": "魚雷発射管",
      "w": 0.84,
      "hits": 1,
      "crew": 0,
      "size": 0,
      "weaponPowerW": 1000000000000000,
      "stock": 0,
      "at": 0.47,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": 0.15,
      "z": 0.12,
      "r": 0.093,
      "share": 0,
      "domain": "main",
      "port": "f23",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 24,
      "name": "魚雷発射管",
      "w": 0.84,
      "hits": 1,
      "crew": 0,
      "size": 0,
      "weaponPowerW": 1000000000000000,
      "stock": 0,
      "at": 0.47,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": 0.15,
      "z": -0.12,
      "r": 0.093,
      "share": 0,
      "domain": "main",
      "port": "f24",
      "powerConnected": true
     },
     {
      "k": "launcher",
      "fit": 25,
      "name": "ミサイル発射管",
      "w": 1.0368000000000002,
      "hits": 1,
      "crew": 0,
      "size": 1,
      "stock": 6,
      "mount": "ext",
      "missileKind": "cmsl",
      "launcherCells": 1,
      "ammoPerCell": 6,
      "missileRange": 10000,
      "launchMuzzles": [
       [
        -0.262,
        -0.3545038542725488,
        0.099
       ],
       [
        -0.262,
        -0.3545038542725488,
        -0.099
       ]
      ],
      "launchBlocked": false,
      "salvo": 1,
      "cycle": 1.2,
      "tt": 25,
      "ammo0": 6,
      "muzzle": [
       -0.262,
       -0.3545038542725488,
       0
      ],
      "launchDir": [
       1,
       0,
       0
      ],
      "launchPowerW": 1000000000000000,
      "at": 0.384,
      "pd": false,
      "dualPurpose": false,
      "y": -0.13,
      "z": 0,
      "r": 0.079,
      "share": 1,
      "domain": "main",
      "port": "f25",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "ドロイド・ブレイン",
      "w": 0.11560000000000004,
      "hits": 1,
      "crew": 0,
      "size": 0.03930400000000001,
      "at": 0.219,
      "part": 12,
      "y": 0.33,
      "z": 0,
      "r": 0.023,
      "share": 0.15292821872516119,
      "domain": "main",
      "port": "p12",
      "powerConnected": true
     },
     {
      "k": "battery",
      "name": "パワーセル",
      "w": 0.040000000000000015,
      "hits": 1,
      "crew": 0.0000016000000000000006,
      "size": 0.008000000000000002,
      "at": 0.192,
      "part": 13,
      "y": 0.46,
      "z": -0.1,
      "r": 0.013,
      "share": 1,
      "domain": "main",
      "port": "p13",
      "powerConnected": true
     },
     {
      "k": "fuel",
      "name": "固形燃料スラグ",
      "w": 0.0627210400614069,
      "hits": 1,
      "crew": 0.0000031415926535897938,
      "size": 0.015707963267948967,
      "at": 0.232,
      "part": 14,
      "y": 0.56,
      "z": -0.1,
      "r": 0.017,
      "share": 1,
      "domain": "main",
      "port": "p14",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "慣性補償装置",
      "w": 0.07998126082715985,
      "hits": 1,
      "crew": 0.000004523893421169302,
      "size": 0.02261946710584651,
      "at": 0.139,
      "part": 15,
      "y": 0.13,
      "z": 0,
      "r": 0.019,
      "share": 0.088010248651778,
      "domain": "main",
      "port": "p15",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "胴体内反応炉",
      "w": 1.4430080993510435,
      "hits": 1,
      "crew": 0.00018871058466082887,
      "size": 0.9435529233041443,
      "at": 0.384,
      "part": 16,
      "y": -0.24,
      "z": 0,
      "r": 0.065,
      "share": 1,
      "domain": "main",
      "port": "p16",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "推進機関",
      "w": 0.34888702616969863,
      "hits": 1,
      "crew": 0.00008243036468195043,
      "size": 0.20607591170487607,
      "at": 0.327,
      "part": 17,
      "y": 0,
      "z": 0.86,
      "r": 0.039,
      "share": 0.4568795597685419,
      "domain": "main",
      "port": "p17",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "推進機関",
      "w": 0.34888702616969863,
      "hits": 1,
      "crew": 0.00008243036468195043,
      "size": 0.20607591170487607,
      "at": 0.327,
      "part": 18,
      "y": 0,
      "z": -0.86,
      "r": 0.039,
      "share": 0.4568795597685419,
      "domain": "main",
      "port": "p18",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "航法コンピューター",
      "w": 0.048400000000000006,
      "hits": 1,
      "crew": 0,
      "size": 0.010648,
      "at": 0.192,
      "part": 26,
      "y": 0.56,
      "z": 0,
      "r": 0.015,
      "share": 0.04143038044436993,
      "domain": "main",
      "port": "p26",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "照準コンピューター",
      "w": 0.10240000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.032768000000000005,
      "at": 0.162,
      "part": 27,
      "y": 0.34,
      "z": 0,
      "r": 0.021,
      "share": 0.1274972489106982,
      "domain": "main",
      "port": "p27",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 1",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.175,
      "part": 28,
      "y": 0.56,
      "z": 0,
      "r": 0.012,
      "share": 0.022691771107397205,
      "domain": "main",
      "port": "p28",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 2",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.192,
      "part": 29,
      "y": 0.44,
      "z": 0,
      "r": 0.012,
      "share": 0.022691771107397205,
      "domain": "main",
      "port": "p29",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 3",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.209,
      "part": 30,
      "y": 0.56,
      "z": 0,
      "r": 0.012,
      "share": 0.022691771107397205,
      "domain": "main",
      "port": "p30",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 4",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.192,
      "part": 31,
      "y": 0.44,
      "z": 0.06,
      "r": 0.012,
      "share": 0.022691771107397205,
      "domain": "main",
      "port": "p31",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 1",
      "w": 0.1225,
      "hits": 1,
      "crew": 0,
      "size": 0.04287499999999999,
      "at": 0.192,
      "part": 32,
      "y": 0.07,
      "z": 0,
      "r": 0.023,
      "share": 0.1668226485304621,
      "domain": "main",
      "port": "p32",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 2",
      "w": 0.1225,
      "hits": 1,
      "crew": 0,
      "size": 0.04287499999999999,
      "at": 0.23,
      "part": 33,
      "y": 0.17,
      "z": -0.12,
      "r": 0.023,
      "share": 0.1668226485304621,
      "domain": "main",
      "port": "p33",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "歩行脚支持機構 1",
      "w": 0.048400000000000006,
      "hits": 1,
      "crew": 0,
      "size": 0.010648,
      "at": 0.233,
      "part": 34,
      "y": 0.56,
      "z": 0,
      "r": 0.015,
      "share": 0.04143038044436993,
      "domain": "main",
      "port": "p34",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "歩行脚支持機構 2",
      "w": 0.048400000000000006,
      "hits": 1,
      "crew": 0,
      "size": 0.010648,
      "at": 0.213,
      "part": 35,
      "y": 0.25,
      "z": 0.15,
      "r": 0.015,
      "share": 0.04143038044436993,
      "domain": "main",
      "port": "p35",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "歩行脚支持機構 3",
      "w": 0.048400000000000006,
      "hits": 1,
      "crew": 0,
      "size": 0.010648,
      "at": 0.253,
      "part": 36,
      "y": 0.56,
      "z": 0,
      "r": 0.015,
      "share": 0.04143038044436993,
      "domain": "main",
      "port": "p36",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "歩行脚支持機構 4",
      "w": 0.048400000000000006,
      "hits": 1,
      "crew": 0,
      "size": 0.010648,
      "at": 0.131,
      "part": 37,
      "y": 0.41,
      "z": 0,
      "r": 0.015,
      "share": 0.04143038044436993,
      "domain": "main",
      "port": "p37",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 1",
      "w": 0.05626621820612339,
      "hits": 1,
      "crew": 6.673314511340123e-7,
      "size": 0.013346629022680244,
      "at": 0.18,
      "part": 38,
      "y": 0.06,
      "z": 0.13,
      "r": 0.016,
      "share": 0.005519961648669134,
      "domain": "main",
      "port": "p38",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 2",
      "w": 0.046446738912058305,
      "hits": 1,
      "crew": 5.004985744545702e-7,
      "size": 0.010009971489091404,
      "at": 0.166,
      "part": 39,
      "y": 0.07,
      "z": -0.15,
      "r": 0.014,
      "share": 0.004139971121558894,
      "domain": "main",
      "port": "p39",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 3",
      "w": 0.03834090061105161,
      "hits": 1,
      "crew": 3.753733786913693e-7,
      "size": 0.007507467573827386,
      "at": 0.26,
      "part": 40,
      "y": 0.44,
      "z": 0.13,
      "r": 0.013,
      "share": 0.0031049737739569086,
      "domain": "main",
      "port": "p40",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 4",
      "w": 0.03164972183415077,
      "hits": 1,
      "crew": 2.8153011027853274e-7,
      "size": 0.005630602205570654,
      "at": 0.28,
      "part": 41,
      "y": 0.61,
      "z": 0,
      "r": 0.012,
      "share": 0.0023287309612671234,
      "domain": "main",
      "port": "p41",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 5",
      "w": 0.04147291569638248,
      "hits": 1,
      "crew": 4.2229589295473334e-7,
      "size": 0.008445917859094666,
      "at": 0.17,
      "part": 42,
      "y": 0.23,
      "z": -0.14,
      "r": 0.013,
      "share": 0.003493102459863675,
      "domain": "main",
      "port": "p42",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 6",
      "w": 0.04147291569638248,
      "hits": 1,
      "crew": 4.2229589295473334e-7,
      "size": 0.008445917859094666,
      "at": 0.17,
      "part": 43,
      "y": 0.23,
      "z": 0.14,
      "r": 0.013,
      "share": 0.003493102459863675,
      "domain": "main",
      "port": "p43",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.07232233813847942,
      "hits": 1,
      "crew": 0.000003889902204561349,
      "size": 0.019449511022806742,
      "at": 0.347,
      "part": -17,
      "machineryOwner": 17,
      "y": 0,
      "z": 0.86,
      "r": 0.018,
      "share": 0.04312044023145811,
      "domain": "main",
      "port": "p17",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.07232233813847942,
      "hits": 1,
      "crew": 0.000003889902204561349,
      "size": 0.019449511022806742,
      "at": 0.347,
      "part": -18,
      "machineryOwner": 18,
      "y": 0,
      "z": -0.86,
      "r": 0.018,
      "share": 0.04312044023145811,
      "domain": "main",
      "port": "p18",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p16 → p17",
      "w": 0.004282534552220696,
      "hits": 1,
      "crew": 5.60507346335665e-8,
      "size": 0.0002802536731678325,
      "at": 0.347,
      "part": -6000000,
      "routeId": "p16>p17",
      "capacityW": 348197169327595100,
      "y": 0,
      "z": 0.66,
      "r": 0.004,
      "share": 0.5,
      "domain": "main",
      "port": "p-6000000",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p16 → p18",
      "w": 0.004282534552220696,
      "hits": 1,
      "crew": 5.60507346335665e-8,
      "size": 0.0002802536731678325,
      "at": 0.347,
      "part": -6000001,
      "routeId": "p16>p18",
      "capacityW": 348197169327595100,
      "y": 0,
      "z": -0.66,
      "r": 0.004,
      "share": 0.5,
      "domain": "main",
      "port": "p-6000001",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "上翼",
      "w": 2.0935804733291814,
      "hits": 1,
      "crew": 0,
      "size": 0.5911244695841429,
      "at": 0.444,
      "part": 4,
      "ext": 1,
      "y": 0.58,
      "z": 0.88,
      "r": 0.056,
      "share": 0.24448004032699838,
      "domain": "main",
      "port": "p4",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "上翼",
      "w": 2.0935804733291814,
      "hits": 1,
      "crew": 0,
      "size": 0.5911244695841429,
      "at": 0.444,
      "part": 5,
      "ext": 1,
      "y": 0.58,
      "z": -0.88,
      "r": 0.056,
      "share": 0.24448004032699838,
      "domain": "main",
      "port": "p5",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "下翼",
      "w": 2.0935804626729633,
      "hits": 1,
      "crew": 0,
      "size": 0.5911244650709526,
      "at": 0.444,
      "part": 6,
      "ext": 1,
      "y": -0.58,
      "z": 0.88,
      "r": 0.056,
      "share": 0.2444800384604119,
      "domain": "main",
      "port": "p6",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "下翼",
      "w": 2.0935804626729633,
      "hits": 1,
      "crew": 0,
      "size": 0.5911244650709526,
      "at": 0.444,
      "part": 7,
      "ext": 1,
      "y": -0.58,
      "z": -0.88,
      "r": 0.056,
      "share": 0.2444800384604119,
      "domain": "main",
      "port": "p7",
      "powerConnected": true
     },
     {
      "k": "quarters",
      "name": "居住空間（後部）",
      "w": 0.1379426045522848,
      "hits": 1,
      "crew": 0,
      "size": 0.8818825397399466,
      "at": 0.165,
      "y": 0.1,
      "z": 0,
      "r": 0.064,
      "share": 0.20491803278688525,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央後部）",
      "w": 0.2546442527276149,
      "hits": 1,
      "crew": 0,
      "size": 2.2118920589329325,
      "at": 0.376,
      "y": 0.03,
      "z": 0,
      "r": 0.086,
      "share": 0.5139647844565878,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央前部）",
      "w": 0.14639743956833332,
      "hits": 1,
      "crew": 0,
      "size": 0.9641915767823416,
      "at": 0.606,
      "y": 0.01,
      "z": 0,
      "r": 0.065,
      "share": 0.22404371584699456,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（前部）",
      "w": 0.05883031035045631,
      "hits": 1,
      "crew": 0,
      "size": 0.24562061847571842,
      "at": 0.819,
      "y": 0,
      "z": 0,
      "r": 0.041,
      "share": 0.05707346690953248,
      "domain": "main"
     },
     {
      "k": "hull",
      "name": "船体構造",
      "w": 11.549688052871728,
      "hits": null,
      "crew": 0,
      "size": 1,
      "share": 1,
      "domain": "main"
     }
    ],
    "energyModel": {
     "version": 0,
     "eta": 0.75
    },
    "D": 0,
    "shieldBuffer": 0,
    "wCap": 0,
    "crewNeed": 0,
    "crewMax": 0,
    "hp": 1,
    "len": 7.548,
    "width": 4.008000095367432,
    "height": 1.758999959565699,
    "grid": {
     "P": 4941390161528088000,
     "fixed": 26007697956290240,
     "cooling": 9269259174487588,
     "De": 696394338655190100,
     "Ds": 0,
     "Dw": 2278933333333333.5,
     "domains": [
      {
       "id": "main",
       "P": 4941390161528088000,
       "reactors": [
        11
       ],
       "sources": [
        {
         "moduleIndex": 11,
         "P": 4941390161528088000
        }
       ],
       "modules": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36,
        37,
        38,
        39,
        40,
        41,
        42,
        43,
        44
       ],
       "protection": 1
      }
     ],
     "powerPaths": [
      {
       "kind": "power",
       "from": "p16",
       "to": "hotel",
       "cap": 26007697956290244,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p4",
       "cap": 220424817679557.97,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p5",
       "cap": 220424817679557.97,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p6",
       "cap": 220424817679557.97,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p7",
       "cap": 220424817679557.97,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p12",
       "cap": 1182168088922283.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p13",
       "cap": 1182168088922283.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p14",
       "cap": 1182168088922283.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p15",
       "cap": 1182168088922283.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p26",
       "cap": 1182168088922283.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p27",
       "cap": 1182168088922283.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p28",
       "cap": 1182168088922283.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p29",
       "cap": 1182168088922283.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p30",
       "cap": 1182168088922283.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p31",
       "cap": 1182168088922283.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p32",
       "cap": 1182168088922283.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p33",
       "cap": 1182168088922283.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p34",
       "cap": 1182168088922283.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p35",
       "cap": 1182168088922283.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p36",
       "cap": 1182168088922283.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p37",
       "cap": 1182168088922283.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "f19",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "f20",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "f21",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "f22",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "f23",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "f24",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "f25",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p38",
       "cap": 2096890371913313.8,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p39",
       "cap": 1572667735271135,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p40",
       "cap": 1179499066487779.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p41",
       "cap": 884624539490194.4,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p42",
       "cap": 1326939095303466.8,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p43",
       "cap": 1326939095303466.8,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p-6000000",
       "cap": 348197169327595100,
       "auto": false,
       "ok": true,
       "capacityGroup": "p16>p17",
       "groupCap": 348197169327595100,
       "physical": true,
       "routeId": "p16>p17",
       "efficiency": 0.9999919513261445
      },
      {
       "kind": "power",
       "from": "p-6000000",
       "to": "p17",
       "cap": 348197169327595100,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p16>p17",
       "efficiency": 1
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p-6000001",
       "cap": 348197169327595100,
       "auto": false,
       "ok": true,
       "capacityGroup": "p16>p18",
       "groupCap": 348197169327595100,
       "physical": true,
       "routeId": "p16>p18",
       "efficiency": 0.9999919513261445
      },
      {
       "kind": "power",
       "from": "p-6000001",
       "to": "p18",
       "cap": 348197169327595100,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p16>p18",
       "efficiency": 1
      }
     ],
     "trunks": [
      {
       "port": "p-6000000",
       "moduleIndex": 34
      },
      {
       "port": "p-6000001",
       "moduleIndex": 35
      }
     ],
     "fixedLoads": [
      {
       "id": "hotel",
       "port": "hotel",
       "weight": 15738438781802652,
       "domain": "main"
      },
      {
       "id": "f25",
       "port": "f25",
       "domain": "main",
       "weight": 1000000000000000
      }
     ],
     "coolingLoads": [
      {
       "id": "p38",
       "port": "p38",
       "weight": 2096890371913313.8,
       "domain": "main"
      },
      {
       "id": "p39",
       "port": "p39",
       "weight": 1572667735271135,
       "domain": "main"
      },
      {
       "id": "p40",
       "port": "p40",
       "weight": 1179499066487779.5,
       "domain": "main"
      },
      {
       "id": "p41",
       "port": "p41",
       "weight": 884624539490194.4,
       "domain": "main"
      },
      {
       "id": "p42",
       "port": "p42",
       "weight": 1326939095303466.8,
       "domain": "main"
      },
      {
       "id": "p43",
       "port": "p43",
       "weight": 1326939095303466.8,
       "domain": "main"
      },
      {
       "id": "p4",
       "port": "p4",
       "weight": 220424817679557.97,
       "domain": "main"
      },
      {
       "id": "p5",
       "port": "p5",
       "weight": 220424817679557.97,
       "domain": "main"
      },
      {
       "id": "p6",
       "port": "p6",
       "weight": 220424817679557.97,
       "domain": "main"
      },
      {
       "id": "p7",
       "port": "p7",
       "weight": 220424817679557.97,
       "domain": "main"
      }
     ]
    },
    "propulsion": {
     "version": 1,
     "architectureVersion": 2,
     "cores": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 6612833747754297,
       "densityFactor": 52.654759307360784,
       "efficiency": 0.2651603352472389,
       "wasteFraction": 0.7348396647527611,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 7165475930.736079,
       "ratedShaftPowerW": 92328078151044720,
       "ratedWasteHeatW": 255869091176550340,
       "thermalStoreJ": 19838501243262892,
       "version": 1,
       "id": 17,
       "machineryId": 17,
       "coreId": 17,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 348197169327595100,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 48593725.342655115,
       "effectiveMachineryVolumeM3": 0.019449511022806756,
       "machineryVolumeM3": 0.019449511022806756,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.161,
       "machineryDiameterM": 0.322,
       "machineryOffsetM": 0,
       "maxInputW": 661283374775429600,
       "maxRatedInputW": 661283374775429600,
       "inputDensityWPerM3": 17902618164502667000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 3635.119629090882,
       "powerNode": "p17",
       "heatNode": "p17",
       "reactorId": 16,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 12,
       "machineryModuleIndex": 32,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 348194366802141760,
       "transmissionRouteIds": [
        "p16>p17"
       ]
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 6612833747754297,
       "densityFactor": 52.654759307360784,
       "efficiency": 0.2651603352472389,
       "wasteFraction": 0.7348396647527611,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 7165475930.736079,
       "ratedShaftPowerW": 92328078151044720,
       "ratedWasteHeatW": 255869091176550340,
       "thermalStoreJ": 19838501243262892,
       "version": 1,
       "id": 18,
       "machineryId": 18,
       "coreId": 18,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 348197169327595100,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 48593725.342655115,
       "effectiveMachineryVolumeM3": 0.019449511022806756,
       "machineryVolumeM3": 0.019449511022806756,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.161,
       "machineryDiameterM": 0.322,
       "machineryOffsetM": 0,
       "maxInputW": 661283374775429600,
       "maxRatedInputW": 661283374775429600,
       "inputDensityWPerM3": 17902618164502667000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 3635.119629090882,
       "powerNode": "p18",
       "heatNode": "p18",
       "reactorId": 16,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 13,
       "machineryModuleIndex": 33,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 348194366802141760,
       "transmissionRouteIds": [
        "p16>p18"
       ]
      }
     ],
     "engines": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 6612833747754297,
       "densityFactor": 52.654759307360784,
       "efficiency": 0.2651603352472389,
       "wasteFraction": 0.7348396647527611,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 7165475930.736079,
       "ratedShaftPowerW": 92328078151044720,
       "ratedWasteHeatW": 255869091176550340,
       "thermalStoreJ": 19838501243262892,
       "version": 1,
       "id": 17,
       "machineryId": 17,
       "coreId": 17,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 348197169327595100,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 48593725.342655115,
       "effectiveMachineryVolumeM3": 0.019449511022806756,
       "machineryVolumeM3": 0.019449511022806756,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.161,
       "machineryDiameterM": 0.322,
       "machineryOffsetM": 0,
       "maxInputW": 661283374775429600,
       "maxRatedInputW": 661283374775429600,
       "inputDensityWPerM3": 17902618164502667000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 3635.119629090882,
       "powerNode": "p17",
       "heatNode": "p17",
       "reactorId": 16,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 12,
       "coreModuleIndex": 12,
       "machineryModuleIndex": 32,
       "shaftModuleIndices": [],
       "shaftCapacityW": 92328078151044720,
       "ratedShaftCapacityW": 92328078151044720,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 348194366802141760
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 6612833747754297,
       "densityFactor": 52.654759307360784,
       "efficiency": 0.2651603352472389,
       "wasteFraction": 0.7348396647527611,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 7165475930.736079,
       "ratedShaftPowerW": 92328078151044720,
       "ratedWasteHeatW": 255869091176550340,
       "thermalStoreJ": 19838501243262892,
       "version": 1,
       "id": 18,
       "machineryId": 18,
       "coreId": 18,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 348197169327595100,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 48593725.342655115,
       "effectiveMachineryVolumeM3": 0.019449511022806756,
       "machineryVolumeM3": 0.019449511022806756,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.161,
       "machineryDiameterM": 0.322,
       "machineryOffsetM": 0,
       "maxInputW": 661283374775429600,
       "maxRatedInputW": 661283374775429600,
       "inputDensityWPerM3": 17902618164502667000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 3635.119629090882,
       "powerNode": "p18",
       "heatNode": "p18",
       "reactorId": 16,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 13,
       "coreModuleIndex": 13,
       "machineryModuleIndex": 33,
       "shaftModuleIndices": [],
       "shaftCapacityW": 92328078151044720,
       "ratedShaftCapacityW": 92328078151044720,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 348194366802141760
      }
     ],
     "massKg": 9862.842164514923,
     "ratedThrustN": 97187450.68531023,
     "ratedAccelMps2": 9853.899014523075,
     "structuralAccelerationLimitMps2": 153308.60578301406,
     "inertialFactor": 1,
     "accelerationLimitMps2": 9853.899014523075
    },
    "profileVersion": 18,
    "heat": {
     "v": 3,
     "mode": "strict",
     "src": [
      {
       "k": "reactor",
       "id": "p16",
       "n": "胴体内反応炉 #16",
       "g": "high",
       "sh": 1,
       "st": 1739234327867552500,
       "m": [
        11
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p17",
       "n": "推進機関 #17",
       "g": "high",
       "sh": 0.5,
       "st": 19838501243262892,
       "m": [
        12,
        32
       ],
       "pc": [],
       "sec": 1,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p18",
       "n": "推進機関 #18",
       "g": "high",
       "sh": 0.5,
       "st": 19838501243262892,
       "m": [
        13,
        33
       ],
       "pc": [],
       "sec": 1,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "feed",
       "id": "p-6000000",
       "n": "推進配電路 1",
       "g": "high",
       "sh": 0.5,
       "st": 168151527198720,
       "m": [
        34
       ],
       "pc": [],
       "sec": 1,
       "sw": -1,
       "gen": -1,
       "routeId": "p16>p17"
      },
      {
       "k": "feed",
       "id": "p-6000001",
       "n": "推進配電路 2",
       "g": "high",
       "sh": 0.5,
       "st": 168151527198720,
       "m": [
        35
       ],
       "pc": [],
       "sec": 1,
       "sw": -1,
       "gen": -1,
       "routeId": "p16>p18"
      },
      {
       "k": "weapon",
       "id": "f19",
       "n": "武装（艦首区画）",
       "g": "high",
       "sh": 0.695023,
       "st": 29698323031880290,
       "m": [
        0,
        1,
        2,
        3,
        4,
        5
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "weapon",
       "id": "f25",
       "n": "武装（中央区画）",
       "g": "high",
       "sh": 0.304977,
       "st": 13031676968119714,
       "m": [
        6
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "hotel",
       "id": "hotel",
       "n": "生活・電子設備",
       "g": "low",
       "sh": 1,
       "st": 1560461877377414400,
       "m": [],
       "pc": [],
       "sec": 1,
       "sw": -1,
       "gen": -1
      }
     ],
     "dis": [
      {
       "id": "p38",
       "n": "機体内高エネルギー散逸装置 1 #38",
       "k": "hdis",
       "g": "high",
       "cap": 139792691460887580,
       "m": 26,
       "sec": 0,
       "src": -1,
       "power": 2096890371913313.8
      },
      {
       "id": "p39",
       "n": "機体内高エネルギー散逸装置 2 #39",
       "k": "hdis",
       "g": "high",
       "cap": 104844515684742340,
       "m": 27,
       "sec": 0,
       "src": -1,
       "power": 1572667735271135
      },
      {
       "id": "p40",
       "n": "機体内高エネルギー散逸装置 3 #40",
       "k": "hdis",
       "g": "high",
       "cap": 78633271099185300,
       "m": 28,
       "sec": 1,
       "src": -1,
       "power": 1179499066487779.5
      },
      {
       "id": "p41",
       "n": "機体内高エネルギー散逸装置 4 #41",
       "k": "hdis",
       "g": "high",
       "cap": 58974969299346296,
       "m": 29,
       "sec": 1,
       "src": -1,
       "power": 884624539490194.4
      },
      {
       "id": "p42",
       "n": "機体内高エネルギー散逸装置 5 #42",
       "k": "hdis",
       "g": "high",
       "cap": 88462606353564450,
       "m": 30,
       "sec": 0,
       "src": -1,
       "power": 1326939095303466.8
      },
      {
       "id": "p43",
       "n": "機体内高エネルギー散逸装置 6 #43",
       "k": "hdis",
       "g": "high",
       "cap": 88462606353564450,
       "m": 31,
       "sec": 0,
       "src": -1,
       "power": 1326939095303466.8
      },
      {
       "id": "p4",
       "n": "上翼 #4",
       "k": "wing",
       "g": "high",
       "cap": 22042481767955796,
       "m": 36,
       "sec": 3,
       "src": -1,
       "power": 220424817679557.97
      },
      {
       "id": "p5",
       "n": "上翼 #5",
       "k": "wing",
       "g": "high",
       "cap": 22042481767955796,
       "m": 37,
       "sec": 3,
       "src": -1,
       "power": 220424817679557.97
      },
      {
       "id": "p6",
       "n": "下翼 #6",
       "k": "wing",
       "g": "high",
       "cap": 22042481767955796,
       "m": 38,
       "sec": 3,
       "src": -1,
       "power": 220424817679557.97
      },
      {
       "id": "p7",
       "n": "下翼 #7",
       "k": "wing",
       "g": "high",
       "cap": 22042481767955796,
       "m": 39,
       "sec": 3,
       "src": -1,
       "power": 220424817679557.97
      },
      {
       "id": "skin",
       "n": "外殻からの放熱",
       "k": "skin",
       "g": "low",
       "cap": 188977673752744130000,
       "m": -1,
       "sec": -1,
       "src": -1
      }
     ],
     "ln": [
      {
       "s": 0,
       "d": 0,
       "cap": 7511725744840896,
       "sec": 1
      },
      {
       "s": 0,
       "d": 1,
       "cap": 5633794152212924,
       "sec": 1
      },
      {
       "s": 0,
       "d": 2,
       "cap": 4225339398963263,
       "sec": 1
      },
      {
       "s": 0,
       "d": 3,
       "cap": 3169005407632833.5,
       "sec": 1
      },
      {
       "s": 0,
       "d": 4,
       "cap": 4753516300869830,
       "sec": 1
      },
      {
       "s": 0,
       "d": 5,
       "cap": 4753516300869830,
       "sec": 1
      },
      {
       "s": 0,
       "d": 6,
       "cap": 1184447312990366.2,
       "sec": 2
      },
      {
       "s": 0,
       "d": 7,
       "cap": 1184447312990366.2,
       "sec": 2
      },
      {
       "s": 0,
       "d": 8,
       "cap": 1184447312990366.2,
       "sec": 2
      },
      {
       "s": 0,
       "d": 9,
       "cap": 1184447312990366.2,
       "sec": 2
      },
      {
       "s": 1,
       "d": 0,
       "cap": 66305141486837224,
       "sec": 1
      },
      {
       "s": 1,
       "d": 1,
       "cap": 49728854734446410,
       "sec": 0
      },
      {
       "s": 1,
       "d": 2,
       "cap": 37296586190008860,
       "sec": 1
      },
      {
       "s": 1,
       "d": 3,
       "cap": 27972447219596656,
       "sec": 1
      },
      {
       "s": 1,
       "d": 4,
       "cap": 41958743116471040,
       "sec": 0
      },
      {
       "s": 1,
       "d": 5,
       "cap": 41958743116471040,
       "sec": 0
      },
      {
       "s": 1,
       "d": 6,
       "cap": 10454980564947906,
       "sec": 2
      },
      {
       "s": 1,
       "d": 7,
       "cap": 10454980564947906,
       "sec": 2
      },
      {
       "s": 1,
       "d": 8,
       "cap": 10454980564947906,
       "sec": 2
      },
      {
       "s": 1,
       "d": 9,
       "cap": 10454980564947906,
       "sec": 2
      },
      {
       "s": 2,
       "d": 0,
       "cap": 66305141486837224,
       "sec": 1
      },
      {
       "s": 2,
       "d": 1,
       "cap": 49728854734446410,
       "sec": 0
      },
      {
       "s": 2,
       "d": 2,
       "cap": 37296586190008860,
       "sec": 1
      },
      {
       "s": 2,
       "d": 3,
       "cap": 27972447219596656,
       "sec": 1
      },
      {
       "s": 2,
       "d": 4,
       "cap": 41958743116471040,
       "sec": 0
      },
      {
       "s": 2,
       "d": 5,
       "cap": 41958743116471040,
       "sec": 0
      },
      {
       "s": 2,
       "d": 6,
       "cap": 10454980564947906,
       "sec": 2
      },
      {
       "s": 2,
       "d": 7,
       "cap": 10454980564947906,
       "sec": 2
      },
      {
       "s": 2,
       "d": 8,
       "cap": 10454980564947906,
       "sec": 2
      },
      {
       "s": 2,
       "d": 9,
       "cap": 10454980564947906,
       "sec": 2
      },
      {
       "s": 3,
       "d": 0,
       "cap": 726243804905.585,
       "sec": 1
      },
      {
       "s": 3,
       "d": 1,
       "cap": 544682838556.5094,
       "sec": 1
      },
      {
       "s": 3,
       "d": 2,
       "cap": 408511528023.785,
       "sec": 1
      },
      {
       "s": 3,
       "d": 3,
       "cap": 306383729010.11584,
       "sec": 1
      },
      {
       "s": 3,
       "d": 4,
       "cap": 459576385279.4319,
       "sec": 1
      },
      {
       "s": 3,
       "d": 5,
       "cap": 459576385279.4319,
       "sec": 1
      },
      {
       "s": 3,
       "d": 6,
       "cap": 114513968229.88506,
       "sec": 2
      },
      {
       "s": 3,
       "d": 7,
       "cap": 114513968229.88506,
       "sec": 2
      },
      {
       "s": 3,
       "d": 8,
       "cap": 114513968229.88506,
       "sec": 2
      },
      {
       "s": 3,
       "d": 9,
       "cap": 114513968229.88506,
       "sec": 2
      },
      {
       "s": 4,
       "d": 0,
       "cap": 726243804905.585,
       "sec": 1
      },
      {
       "s": 4,
       "d": 1,
       "cap": 544682838556.5094,
       "sec": 1
      },
      {
       "s": 4,
       "d": 2,
       "cap": 408511528023.785,
       "sec": 1
      },
      {
       "s": 4,
       "d": 3,
       "cap": 306383729010.11584,
       "sec": 1
      },
      {
       "s": 4,
       "d": 4,
       "cap": 459576385279.4319,
       "sec": 1
      },
      {
       "s": 4,
       "d": 5,
       "cap": 459576385279.4319,
       "sec": 1
      },
      {
       "s": 4,
       "d": 6,
       "cap": 114513968229.88506,
       "sec": 2
      },
      {
       "s": 4,
       "d": 7,
       "cap": 114513968229.88506,
       "sec": 2
      },
      {
       "s": 4,
       "d": 8,
       "cap": 114513968229.88506,
       "sec": 2
      },
      {
       "s": 4,
       "d": 9,
       "cap": 114513968229.88506,
       "sec": 2
      },
      {
       "s": 5,
       "d": 0,
       "cap": 128266590719088.56,
       "sec": 4
      },
      {
       "s": 5,
       "d": 1,
       "cap": 96199940368402.72,
       "sec": 4
      },
      {
       "s": 5,
       "d": 2,
       "cap": 72149849148617.97,
       "sec": 4
      },
      {
       "s": 5,
       "d": 3,
       "cap": 54112401519263.484,
       "sec": 4
      },
      {
       "s": 5,
       "d": 4,
       "cap": 81168742117474.72,
       "sec": 4
      },
      {
       "s": 5,
       "d": 5,
       "cap": 81168742117474.72,
       "sec": 4
      },
      {
       "s": 5,
       "d": 6,
       "cap": 20225048661820.836,
       "sec": 4
      },
      {
       "s": 5,
       "d": 7,
       "cap": 20225048661820.836,
       "sec": 4
      },
      {
       "s": 5,
       "d": 8,
       "cap": 20225048661820.836,
       "sec": 4
      },
      {
       "s": 5,
       "d": 9,
       "cap": 20225048661820.836,
       "sec": 4
      },
      {
       "s": 6,
       "d": 0,
       "cap": 56283608143761.07,
       "sec": 1
      },
      {
       "s": 6,
       "d": 1,
       "cap": 42212704935819.12,
       "sec": 1
      },
      {
       "s": 6,
       "d": 2,
       "cap": 31659482132847.812,
       "sec": 1
      },
      {
       "s": 6,
       "d": 3,
       "cap": 23744618031504.57,
       "sec": 1
      },
      {
       "s": 6,
       "d": 4,
       "cap": 35616988408674.26,
       "sec": 1
      },
      {
       "s": 6,
       "d": 5,
       "cap": 35616988408674.26,
       "sec": 1
      },
      {
       "s": 6,
       "d": 6,
       "cap": 8874787325278.275,
       "sec": 2
      },
      {
       "s": 6,
       "d": 7,
       "cap": 8874787325278.275,
       "sec": 2
      },
      {
       "s": 6,
       "d": 8,
       "cap": 8874787325278.275,
       "sec": 2
      },
      {
       "s": 6,
       "d": 9,
       "cap": 8874787325278.275,
       "sec": 2
      },
      {
       "s": 7,
       "d": 0,
       "cap": 39011546934435370,
       "sec": 0
      },
      {
       "s": 7,
       "d": 2,
       "cap": 39011546934435370,
       "sec": 1
      },
      {
       "s": 7,
       "d": 1,
       "cap": 39011546934435370,
       "sec": 0
      },
      {
       "s": 7,
       "d": 4,
       "cap": 39011546934435370,
       "sec": 0
      },
      {
       "s": 7,
       "d": 5,
       "cap": 39011546934435370,
       "sec": 0
      },
      {
       "s": 7,
       "d": 3,
       "cap": 39011546934435370,
       "sec": 1
      },
      {
       "s": 7,
       "d": 8,
       "cap": 39011546934435370,
       "sec": 2
      },
      {
       "s": 7,
       "d": 9,
       "cap": 39011546934435370,
       "sec": 2
      },
      {
       "s": 7,
       "d": 6,
       "cap": 39011546934435370,
       "sec": 2
      },
      {
       "s": 7,
       "d": 7,
       "cap": 39011546934435370,
       "sec": 2
      },
      {
       "s": 7,
       "d": 10,
       "cap": 188977673752744130000,
       "sec": -1
      }
     ]
    },
    "speedReference": {
     "version": 1,
     "key": "vulture",
     "status": "published",
     "mglt": 120,
     "model": "Vulture-class starfighter",
     "scope": "class",
     "continuity": "canon",
     "source": "https://starwars.fandom.com/wiki/Megalight_per_hour"
    },
    "mglt": 120,
    "maxSpeed": 2400
   },
   "fireArcs": [
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      0,
      1
     ],
     "pos": [
      7.47,
      1.26,
      1.8760000476837158
     ],
     "k": "claser",
     "gun": 0.25,
     "aa": 0.25,
     "cycle": 0.12
    },
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      0,
      -1
     ],
     "pos": [
      7.47,
      1.26,
      -1.8760000476837158
     ],
     "k": "claser",
     "gun": 0.25,
     "aa": 0.25,
     "cycle": 0.12
    },
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      0,
      1
     ],
     "pos": [
      7.47,
      0.514,
      1.876000047683716
     ],
     "k": "claser",
     "gun": 0.25,
     "aa": 0.25,
     "cycle": 0.12
    },
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      0,
      -1
     ],
     "pos": [
      7.47,
      0.514,
      -1.876000047683716
     ],
     "k": "claser",
     "gun": 0.25,
     "aa": 0.25,
     "cycle": 0.12
    }
   ]
  },
  "vwing": {
   "reference": "craft_vwing",
   "signature": "1ut71nv",
   "build": 246670,
   "crew": 1000,
   "total": 247670,
   "by": {
    "hull": 6,
    "armor": 3,
    "power": 116048,
    "drive": 33811,
    "defense": 37501,
    "command": 20501,
    "weapons": 14800,
    "systems": 24000,
    "crew": 1000
   },
   "detailed": true,
   "systems": {
    "v": 1,
    "managed": true,
    "power": 13274726900000000,
    "crew": 1,
    "suitSeats": 0,
    "lifeSupportCapacity": 1,
    "lifeSupportHours": 12.15672,
    "ejectionSeats": 1,
    "ejectionCoverage": 1,
    "ejectionSurvival": 0.9,
    "navCapacity": 2.331,
    "navReady": true,
    "targetDemand": 2,
    "targetCapacity": 2.31525,
    "targetRatio": 1,
    "fireK": 1,
    "maneuverSupport": 23.328,
    "maneuverRatio": 1,
    "turnK": 1,
    "laserUnits": 4,
    "laserGunShare": 1,
    "laserAaShare": 1,
    "laserGasSeconds": 643.1249999999999,
    "landingSupport": 12.4416,
    "landingRatio": 1,
    "landingReady": true
   },
   "heat": {
    "up": 3.42e-7,
    "upS": 3.42e-7,
    "down": 0.0305,
    "T": 0
   },
   "powerProfile": {
    "name": "Vウイング",
    "modules": [
     {
      "k": "weapon",
      "fit": 30,
      "name": "旋回砲塔",
      "w": 2.028,
      "hits": 1,
      "crew": 0,
      "size": 0.750000004,
      "weaponPowerW": 139466666666666.69,
      "stock": 0,
      "at": 0.283,
      "pd": false,
      "dualPurpose": true,
      "band": "close",
      "y": 0.05,
      "z": 0.77,
      "r": 0.082,
      "share": 0.5,
      "domain": "main",
      "port": "f30",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 31,
      "name": "旋回砲塔",
      "w": 2.028,
      "hits": 1,
      "crew": 0,
      "size": 0.750000004,
      "weaponPowerW": 139466666666666.69,
      "stock": 0,
      "at": 0.283,
      "pd": false,
      "dualPurpose": true,
      "band": "close",
      "y": 0.05,
      "z": -0.77,
      "r": 0.082,
      "share": 0.5,
      "domain": "main",
      "port": "f31",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "操縦席",
      "w": 0.5261999071123018,
      "hits": 1,
      "crew": 0,
      "size": 0.3817035074111599,
      "at": 0.437,
      "part": 13,
      "y": 0.27,
      "z": 0,
      "r": 0.046,
      "share": 0.5319852985157654,
      "domain": "main",
      "port": "p13",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "アストロメク・ソケット",
      "w": 0.15804711728933235,
      "hits": 1,
      "crew": 0,
      "size": 0.06283185307179587,
      "at": 0.279,
      "part": 14,
      "y": 0.41,
      "z": 0,
      "r": 0.025,
      "share": 0.08756959646350047,
      "domain": "main",
      "port": "p14",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "上部機関用反応炉",
      "w": 0.16240737873836475,
      "hits": 1,
      "crew": 0.000032724923474893676,
      "size": 0.06544984694978735,
      "at": 0.348,
      "part": 15,
      "y": 0.25,
      "z": 0,
      "r": 0.025,
      "share": 0.04083236058008618,
      "domain": "main",
      "port": "p15",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "下部機関用反応炉",
      "w": 0.3752260078371179,
      "hits": 1,
      "crew": 0.00011492364805851942,
      "size": 0.22984729611703883,
      "at": 0.589,
      "part": 16,
      "y": 0.06,
      "z": 0,
      "r": 0.039,
      "share": 0.1433954105440313,
      "domain": "main",
      "port": "p16",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "補助反応炉（機首）",
      "w": 0.24971758554810963,
      "hits": 1,
      "crew": 0.00006239412449539568,
      "size": 0.12478824899079136,
      "at": 0.703,
      "part": 17,
      "y": 0.07,
      "z": 0,
      "r": 0.032,
      "share": 0.07785195865864623,
      "domain": "main",
      "port": "p17",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "右舷補助反応炉",
      "w": 0.28297861671372676,
      "hits": 1,
      "crew": 0.00007526627679470427,
      "size": 0.15053255358940854,
      "at": 0.431,
      "part": 18,
      "y": 0.09,
      "z": 0.27,
      "r": 0.034,
      "share": 0.09391312269865967,
      "domain": "main",
      "port": "p18",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "左舷補助反応炉",
      "w": 0.28297861671372676,
      "hits": 1,
      "crew": 0.00007526627679470427,
      "size": 0.15053255358940854,
      "at": 0.431,
      "part": 19,
      "y": 0.09,
      "z": -0.27,
      "r": 0.034,
      "share": 0.09391312269865967,
      "domain": "main",
      "port": "p19",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "上部イオン・エンジン",
      "w": 0.9745795931196701,
      "hits": 1,
      "crew": 0.0003848451000647497,
      "size": 0.9621127501618741,
      "at": 0.158,
      "part": 20,
      "y": 0.23,
      "z": 0,
      "r": 0.062,
      "share": 0.34792527898107317,
      "domain": "main",
      "port": "p20",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "下部イオン・エンジン",
      "w": 1.4300002380159278,
      "hits": 1,
      "crew": 0.0006840126852807986,
      "size": 1.7100317132019964,
      "at": 0.266,
      "part": 21,
      "y": -0.01,
      "z": 0,
      "r": 0.076,
      "share": 0.6183924501387029,
      "domain": "main",
      "port": "p21",
      "powerConnected": true
     },
     {
      "k": "shield",
      "name": "偏向シールド投射機（機首）",
      "w": 0.1965129282734214,
      "hits": 1,
      "crew": 0.000034845498516066795,
      "size": 0.087113746290167,
      "at": 0.791,
      "part": 22,
      "y": 0.07,
      "z": 0,
      "r": 0.028,
      "share": 0.47723198278953033,
      "domain": "main",
      "port": "p22",
      "powerConnected": true
     },
     {
      "k": "shield",
      "name": "右舷偏向シールド投射機",
      "w": 0.13154997677807545,
      "hits": 1,
      "crew": 0.000019085175370557998,
      "size": 0.047712938426394985,
      "at": 0.544,
      "part": 23,
      "y": 0.05,
      "z": 0.21,
      "r": 0.023,
      "share": 0.2613840086052348,
      "domain": "main",
      "port": "p23",
      "powerConnected": true
     },
     {
      "k": "shield",
      "name": "左舷偏向シールド投射機",
      "w": 0.13154997677807545,
      "hits": 1,
      "crew": 0.000019085175370557998,
      "size": 0.047712938426394985,
      "at": 0.544,
      "part": 24,
      "y": 0.05,
      "z": -0.21,
      "r": 0.023,
      "share": 0.2613840086052348,
      "domain": "main",
      "port": "p24",
      "powerConnected": true
     },
     {
      "k": "fuel",
      "name": "右舷反応物タンク",
      "w": 0.11553314360685428,
      "hits": 1,
      "crew": 0.000007853981633974484,
      "size": 0.039269908169872414,
      "at": 0.291,
      "part": 25,
      "y": 0.15,
      "z": 0.25,
      "r": 0.022,
      "share": 0.5,
      "domain": "main",
      "port": "p25",
      "powerConnected": true
     },
     {
      "k": "fuel",
      "name": "左舷反応物タンク",
      "w": 0.11553314360685428,
      "hits": 1,
      "crew": 0.000007853981633974484,
      "size": 0.039269908169872414,
      "at": 0.291,
      "part": 26,
      "y": 0.15,
      "z": -0.25,
      "r": 0.022,
      "share": 0.5,
      "domain": "main",
      "port": "p26",
      "powerConnected": true
     },
     {
      "k": "battery",
      "name": "パワーセル",
      "w": 0.06250000000000001,
      "hits": 1,
      "crew": 0.000003125,
      "size": 0.015625,
      "at": 0.532,
      "part": 27,
      "y": 0.19,
      "z": 0,
      "r": 0.016,
      "share": 1,
      "domain": "main",
      "port": "p27",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "右舷慣性補償装置",
      "w": 0.08614710632792984,
      "hits": 1,
      "crew": 0.00000275266999074664,
      "size": 0.0137633499537332,
      "at": 0.203,
      "part": 28,
      "y": 0.12,
      "z": 0.22,
      "r": 0.015,
      "share": 0.01918216545447345,
      "domain": "main",
      "port": "p28",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "左舷慣性補償装置",
      "w": 0.08591562598932198,
      "hits": 1,
      "crew": 0.0000027415826638573215,
      "size": 0.013707913319286606,
      "at": 0.203,
      "part": 29,
      "y": 0.12,
      "z": -0.22,
      "r": 0.015,
      "share": 0.019104902673408634,
      "domain": "main",
      "port": "p29",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "翼根部の推進・兵装用反応炉",
      "w": 0.8711000161574238,
      "hits": 1,
      "crew": 0.00008851057044803751,
      "size": 0.44255285224018753,
      "at": 0.283,
      "part": 32,
      "y": 0.05,
      "z": -0.71,
      "r": 0.048,
      "share": 0.27609656065781907,
      "domain": "main",
      "port": "p32",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "翼根部の推進・兵装用反応炉",
      "w": 0.8666792250596849,
      "hits": 1,
      "crew": 0.00008783764562847766,
      "size": 0.4391882281423883,
      "at": 0.283,
      "part": 33,
      "y": 0.05,
      "z": 0.71,
      "r": 0.048,
      "share": 0.2739974641620979,
      "domain": "main",
      "port": "p33",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "生命維持装置",
      "w": 0.13690000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.050653,
      "at": 0.492,
      "part": 34,
      "y": 0.11,
      "z": -0.21,
      "r": 0.023,
      "share": 0.07059576556809816,
      "domain": "main",
      "port": "p34",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "射出座席機構 1",
      "w": 0.08410000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.024388999999999997,
      "at": 0.488,
      "part": 35,
      "y": 0.06,
      "z": 0.17,
      "r": 0.018,
      "share": 0.03399127645826202,
      "domain": "main",
      "port": "p35",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "航法コンピューター",
      "w": 0.048400000000000006,
      "hits": 1,
      "crew": 0,
      "size": 0.010648,
      "at": 0.518,
      "part": 36,
      "y": 0.18,
      "z": 0,
      "r": 0.014,
      "share": 0.014840260434112674,
      "domain": "main",
      "port": "p36",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "照準コンピューター",
      "w": 0.0441,
      "hits": 1,
      "crew": 0,
      "size": 0.009260999999999998,
      "at": 0.52,
      "part": 37,
      "y": 0.19,
      "z": -0.06,
      "r": 0.013,
      "share": 0.012907179928654906,
      "domain": "main",
      "port": "p37",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 1",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.541,
      "part": 38,
      "y": 0.16,
      "z": 0,
      "r": 0.011,
      "share": 0.008128136631456152,
      "domain": "main",
      "port": "p38",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 2",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.541,
      "part": 39,
      "y": 0.16,
      "z": -0.05,
      "r": 0.011,
      "share": 0.008128136631456152,
      "domain": "main",
      "port": "p39",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 3",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.541,
      "part": 40,
      "y": 0.16,
      "z": 0.05,
      "r": 0.011,
      "share": 0.008128136631456152,
      "domain": "main",
      "port": "p40",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 4",
      "w": 0.032400000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.0058319999999999995,
      "at": 0.509,
      "part": 41,
      "y": 0.2,
      "z": 0.05,
      "r": 0.011,
      "share": 0.008128136631456152,
      "domain": "main",
      "port": "p41",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 1",
      "w": 0.1225,
      "hits": 1,
      "crew": 0,
      "size": 0.04287499999999999,
      "at": 0.65,
      "part": 42,
      "y": 0.12,
      "z": 0,
      "r": 0.022,
      "share": 0.0597554626326616,
      "domain": "main",
      "port": "p42",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 2",
      "w": 0.1225,
      "hits": 1,
      "crew": 0,
      "size": 0.04287499999999999,
      "at": 0.357,
      "part": 43,
      "y": 0.1,
      "z": -0.2,
      "r": 0.022,
      "share": 0.0597554626326616,
      "domain": "main",
      "port": "p43",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 1",
      "w": 0.057600000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.013824,
      "at": 0.536,
      "part": 44,
      "y": 0.12,
      "z": 0,
      "r": 0.015,
      "share": 0.019266694237525694,
      "domain": "main",
      "port": "p44",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 2",
      "w": 0.057600000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.013824,
      "at": 0.536,
      "part": 45,
      "y": 0.12,
      "z": -0.07,
      "r": 0.015,
      "share": 0.019266694237525694,
      "domain": "main",
      "port": "p45",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 3",
      "w": 0.057600000000000005,
      "hits": 1,
      "crew": 0,
      "size": 0.013824,
      "at": 0.536,
      "part": 46,
      "y": 0.12,
      "z": 0.07,
      "r": 0.015,
      "share": 0.019266694237525694,
      "domain": "main",
      "port": "p46",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 1",
      "w": 0.11696072436391271,
      "hits": 1,
      "crew": 0.0000020000003805226193,
      "size": 0.04000000761045239,
      "at": 0.881,
      "part": 47,
      "y": 0.08,
      "z": 0,
      "r": 0.022,
      "share": 0.06878270218202953,
      "domain": "main",
      "port": "p47",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 2",
      "w": 0.07368067365289653,
      "hits": 1,
      "crew": 0.0000010000008892451507,
      "size": 0.020000017784903013,
      "at": 0.646,
      "part": 48,
      "y": 0.11,
      "z": -0.14,
      "r": 0.017,
      "share": 0.034391375130008874,
      "domain": "main",
      "port": "p48",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 3",
      "w": 0.07368067365289653,
      "hits": 1,
      "crew": 0.0000010000008892451507,
      "size": 0.020000017784903013,
      "at": 0.646,
      "part": 49,
      "y": 0.11,
      "z": 0.14,
      "r": 0.017,
      "share": 0.034391375130008874,
      "domain": "main",
      "port": "p49",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 4",
      "w": 0.07368058466733354,
      "hits": 1,
      "crew": 9.99999077665312e-7,
      "size": 0.01999998155330624,
      "at": 0.49,
      "part": 50,
      "y": 0.11,
      "z": 0.29,
      "r": 0.017,
      "share": 0.03439131282734247,
      "domain": "main",
      "port": "p50",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 5",
      "w": 0.07311258613996527,
      "hits": 1,
      "crew": 9.884580062041683e-7,
      "size": 0.019769160124083363,
      "at": 0.37,
      "part": 51,
      "y": 0.1,
      "z": 0.21,
      "r": 0.017,
      "share": 0.03399439986227296,
      "domain": "main",
      "port": "p51",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 6",
      "w": 0.060353104956373096,
      "hits": 1,
      "crew": 7.413434098224863e-7,
      "size": 0.014826868196449725,
      "at": 0.38,
      "part": 52,
      "y": 0.21,
      "z": -0.19,
      "r": 0.016,
      "share": 0.025495796635351512,
      "domain": "main",
      "port": "p52",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 7",
      "w": 0.07908494485282842,
      "hits": 1,
      "crew": 0.0000011120152125716155,
      "size": 0.022240304251432308,
      "at": 0.599,
      "part": 53,
      "y": 0.08,
      "z": -0.22,
      "r": 0.018,
      "share": 0.038243698317803713,
      "domain": "main",
      "port": "p53",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 8",
      "w": 0.07908494485282842,
      "hits": 1,
      "crew": 0.0000011120152125716155,
      "size": 0.022240304251432308,
      "at": 0.599,
      "part": 54,
      "y": 0.08,
      "z": 0.22,
      "r": 0.018,
      "share": 0.038243698317803713,
      "domain": "main",
      "port": "p54",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.12658805759020522,
      "hits": 1,
      "crew": 0.000009007807562547546,
      "size": 0.04503903781273773,
      "at": 0.336,
      "part": -20,
      "machineryOwner": 20,
      "y": 0.23,
      "z": 0,
      "r": 0.023,
      "share": 0.016287300831840535,
      "domain": "main",
      "port": "p20",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.1322642420369965,
      "hits": 1,
      "crew": 0.000009620411900650631,
      "size": 0.04810205950325315,
      "at": 0.551,
      "part": -21,
      "machineryOwner": 21,
      "y": -0.01,
      "z": 0,
      "r": 0.023,
      "share": 0.01739497004838335,
      "domain": "main",
      "port": "p21",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p15 → p20",
      "w": 0.0012954821918657073,
      "hits": 1,
      "crew": 9.325608230781135e-9,
      "size": 0.00004662804115390568,
      "at": 0.329,
      "part": -6000000,
      "routeId": "p15>p20",
      "capacityW": 368019134454627000,
      "y": 0.22,
      "z": 0,
      "r": 0.002,
      "share": 0.7417164986781231,
      "domain": "main",
      "port": "p-6000000",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p16 → p21",
      "w": 0.0006412153806924771,
      "hits": 1,
      "crew": 3.247400792748887e-9,
      "size": 0.000016237003963744433,
      "at": 0.55,
      "part": -6000001,
      "routeId": "p16>p21",
      "capacityW": 654106694747241200,
      "y": -0.01,
      "z": 0,
      "r": 0.002,
      "share": 0.2582835013218769,
      "domain": "main",
      "port": "p-6000001",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "右舷上部翼（放熱板）",
      "w": 0.5404707706242026,
      "hits": 1,
      "crew": 0,
      "size": 0.09268867220008098,
      "at": 0.256,
      "part": 1,
      "ext": 1,
      "y": 0.53,
      "z": 0.68,
      "r": 0.029,
      "share": 0.159384403064963,
      "domain": "main",
      "port": "p1",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "左舷上部翼（放熱板）",
      "w": 0.551849038739347,
      "hits": 1,
      "crew": 0,
      "size": 0.09268865610160332,
      "at": 0.256,
      "part": 2,
      "ext": 1,
      "y": 0.53,
      "z": -0.68,
      "r": 0.029,
      "share": 0.1593843753825484,
      "domain": "main",
      "port": "p2",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "右舷下部翼（放熱板）",
      "w": 0.6257528683883717,
      "hits": 1,
      "crew": 0,
      "size": 0.10854385277046785,
      "at": 0.268,
      "part": 3,
      "ext": 1,
      "y": -0.49,
      "z": 0.68,
      "r": 0.03,
      "share": 0.18664845195804988,
      "domain": "main",
      "port": "p3",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "左舷下部翼（放熱板）",
      "w": 0.6257527772738093,
      "hits": 1,
      "crew": 0,
      "size": 0.10854382906320469,
      "at": 0.268,
      "part": 4,
      "ext": 1,
      "y": -0.49,
      "z": -0.68,
      "r": 0.03,
      "share": 0.18664841119181708,
      "domain": "main",
      "port": "p4",
      "powerConnected": true
     },
     {
      "k": "quarters",
      "name": "居住空間（後部）",
      "w": 0.2656447785757359,
      "hits": 1,
      "crew": 0,
      "size": 2.356758257364322,
      "at": 0.161,
      "y": 0.17,
      "z": 0,
      "r": 0.084,
      "share": 0.32124681933842236,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央後部）",
      "w": 0.3261455995539633,
      "hits": 1,
      "crew": 0,
      "size": 3.206124599622355,
      "at": 0.347,
      "y": 0.12,
      "z": 0,
      "r": 0.093,
      "share": 0.43702290076335876,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央前部）",
      "w": 0.18605221264383145,
      "hits": 1,
      "crew": 0,
      "size": 1.3813870181778996,
      "at": 0.602,
      "y": 0.08,
      "z": 0,
      "r": 0.07,
      "share": 0.18829516539440203,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（前部）",
      "w": 0.0803451913267381,
      "hits": 1,
      "crew": 0,
      "size": 0.39201523488832285,
      "at": 0.827,
      "y": 0.08,
      "z": 0,
      "r": 0.046,
      "share": 0.05343511450381679,
      "domain": "main"
     },
     {
      "k": "hull",
      "name": "船体構造",
      "w": 9.668698005078431,
      "hits": null,
      "crew": 0,
      "size": 1,
      "share": 1,
      "domain": "main"
     }
    ],
    "energyModel": {
     "version": 0,
     "eta": 0.75
    },
    "D": 0.0007633881939402913,
    "shieldBuffer": 0.02551298707898365,
    "wCap": 0,
    "crewNeed": 1,
    "crewMax": 1,
    "hp": 1,
    "len": 7.902494322974235,
    "width": 4.91999993739142,
    "height": 5.881752014160156,
    "grid": {
     "P": 8394349151915561000,
     "fixed": 44222176653388330,
     "cooling": 28934322415154108,
     "De": 1022125829201868300,
     "Ds": 3194016203446179000,
     "Dw": 278933333333333.38,
     "domains": [
      {
       "id": "main",
       "P": 8394349151915561000,
       "reactors": [
        4,
        5,
        6,
        7,
        8,
        19,
        20
       ],
       "sources": [
        {
         "moduleIndex": 4,
         "P": 342761091406156860
        },
        {
         "moduleIndex": 5,
         "P": 1203711142888873000
        },
        {
         "moduleIndex": 6,
         "P": 653516523141172400
        },
        {
         "moduleIndex": 7,
         "P": 788339541879235800
        },
        {
         "moduleIndex": 8,
         "P": 788339541879235800
        },
        {
         "moduleIndex": 19,
         "P": 2317650929804767000
        },
        {
         "moduleIndex": 20,
         "P": 2300030380916121000
        }
       ],
       "modules": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36,
        37,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        46,
        47,
        48,
        49,
        50,
        51,
        52,
        53,
        54
       ],
       "protection": 1
      }
     ],
     "powerPaths": [
      {
       "kind": "power",
       "from": "p16",
       "to": "hotel",
       "cap": 44222176653388330,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p33",
       "to": "p1",
       "cap": 176172701534109.3,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p2",
       "cap": 182144657518316.47,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p33",
       "to": "p3",
       "cap": 220625409264132.6,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p4",
       "cap": 220625409264132.6,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p13",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p14",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p25",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p26",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p27",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p28",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p29",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p19",
       "to": "p34",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p35",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p36",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p37",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p38",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p39",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p40",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p41",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p42",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p19",
       "to": "p43",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p44",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p45",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p46",
       "cap": 1579363451906726,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p22",
       "cap": 50942766509896155000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p23",
       "cap": 27901785714285715000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p24",
       "cap": 27901785714285715000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "f30",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "f31",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p22",
       "cap": 50942766509896155000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p23",
       "cap": 27901785714285715000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p24",
       "cap": 27901785714285715000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "f30",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "f31",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p22",
       "cap": 50942766509896155000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p23",
       "cap": 27901785714285715000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p24",
       "cap": 27901785714285715000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "f30",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "f31",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p22",
       "cap": 50942766509896155000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p23",
       "cap": 27901785714285715000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p24",
       "cap": 27901785714285715000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "f30",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "f31",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p19",
       "to": "p22",
       "cap": 50942766509896155000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p19",
       "to": "p23",
       "cap": 27901785714285715000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p19",
       "to": "p24",
       "cap": 27901785714285715000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p19",
       "to": "f30",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p19",
       "to": "f31",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p22",
       "cap": 50942766509896155000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p23",
       "cap": 27901785714285715000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p24",
       "cap": 27901785714285715000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "f30",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "f31",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p33",
       "to": "p22",
       "cap": 50942766509896155000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p33",
       "to": "p23",
       "cap": 27901785714285715000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p33",
       "to": "p24",
       "cap": 27901785714285715000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p33",
       "to": "f30",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p33",
       "to": "f31",
       "cap": 209200000000000.03,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p47",
       "cap": 6284405649717621,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p48",
       "cap": 3142205021207392,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p49",
       "cap": 3142205021207392,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p50",
       "cap": 3142199328857188.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p51",
       "cap": 3105934948409793.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p52",
       "cap": 2329450913330297,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p53",
       "cap": 3494176677421869.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p54",
       "cap": 3494176677421869.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p47",
       "cap": 6284405649717621,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p48",
       "cap": 3142205021207392,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p49",
       "cap": 3142205021207392,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p50",
       "cap": 3142199328857188.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p51",
       "cap": 3105934948409793.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p52",
       "cap": 2329450913330297,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p53",
       "cap": 3494176677421869.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p54",
       "cap": 3494176677421869.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p47",
       "cap": 6284405649717621,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p48",
       "cap": 3142205021207392,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p49",
       "cap": 3142205021207392,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p50",
       "cap": 3142199328857188.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p51",
       "cap": 3105934948409793.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p52",
       "cap": 2329450913330297,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p53",
       "cap": 3494176677421869.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p17",
       "to": "p54",
       "cap": 3494176677421869.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p47",
       "cap": 6284405649717621,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p48",
       "cap": 3142205021207392,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p49",
       "cap": 3142205021207392,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p50",
       "cap": 3142199328857188.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p51",
       "cap": 3105934948409793.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p52",
       "cap": 2329450913330297,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p53",
       "cap": 3494176677421869.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p18",
       "to": "p54",
       "cap": 3494176677421869.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p19",
       "to": "p47",
       "cap": 6284405649717621,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p19",
       "to": "p48",
       "cap": 3142205021207392,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p19",
       "to": "p49",
       "cap": 3142205021207392,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p19",
       "to": "p50",
       "cap": 3142199328857188.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p19",
       "to": "p51",
       "cap": 3105934948409793.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p19",
       "to": "p52",
       "cap": 2329450913330297,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p19",
       "to": "p53",
       "cap": 3494176677421869.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p19",
       "to": "p54",
       "cap": 3494176677421869.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p47",
       "cap": 6284405649717621,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p48",
       "cap": 3142205021207392,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p49",
       "cap": 3142205021207392,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p50",
       "cap": 3142199328857188.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p51",
       "cap": 3105934948409793.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p52",
       "cap": 2329450913330297,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p53",
       "cap": 3494176677421869.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p32",
       "to": "p54",
       "cap": 3494176677421869.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p33",
       "to": "p47",
       "cap": 6284405649717621,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p33",
       "to": "p48",
       "cap": 3142205021207392,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p33",
       "to": "p49",
       "cap": 3142205021207392,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p33",
       "to": "p50",
       "cap": 3142199328857188.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p33",
       "to": "p51",
       "cap": 3105934948409793.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p33",
       "to": "p52",
       "cap": 2329450913330297,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p33",
       "to": "p53",
       "cap": 3494176677421869.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p33",
       "to": "p54",
       "cap": 3494176677421869.5,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p15",
       "to": "p-6000000",
       "cap": 368019134454627000,
       "auto": false,
       "ok": true,
       "capacityGroup": "p15>p20",
       "groupCap": 368019134454627000,
       "physical": true,
       "routeId": "p15>p20",
       "efficiency": 0.9999987330003457
      },
      {
       "kind": "power",
       "from": "p-6000000",
       "to": "p20",
       "cap": 368019134454627000,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p15>p20",
       "efficiency": 1
      },
      {
       "kind": "power",
       "from": "p16",
       "to": "p-6000001",
       "cap": 654106694747241200,
       "auto": false,
       "ok": true,
       "capacityGroup": "p16>p21",
       "groupCap": 654106694747241200,
       "physical": true,
       "routeId": "p16>p21",
       "efficiency": 0.9999997517682959
      },
      {
       "kind": "power",
       "from": "p-6000001",
       "to": "p21",
       "cap": 654106694747241200,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p16>p21",
       "efficiency": 1
      }
     ],
     "trunks": [
      {
       "port": "p-6000000",
       "moduleIndex": 44
      },
      {
       "port": "p-6000001",
       "moduleIndex": 45
      }
     ],
     "fixedLoads": [
      {
       "id": "hotel",
       "port": "hotel",
       "weight": 44222176653388330,
       "domain": "main"
      }
     ],
     "coolingLoads": [
      {
       "id": "p47",
       "port": "p47",
       "weight": 6284405649717621,
       "domain": "main"
      },
      {
       "id": "p48",
       "port": "p48",
       "weight": 3142205021207392,
       "domain": "main"
      },
      {
       "id": "p49",
       "port": "p49",
       "weight": 3142205021207392,
       "domain": "main"
      },
      {
       "id": "p50",
       "port": "p50",
       "weight": 3142199328857188.5,
       "domain": "main"
      },
      {
       "id": "p51",
       "port": "p51",
       "weight": 3105934948409793.5,
       "domain": "main"
      },
      {
       "id": "p52",
       "port": "p52",
       "weight": 2329450913330297,
       "domain": "main"
      },
      {
       "id": "p53",
       "port": "p53",
       "weight": 3494176677421869.5,
       "domain": "main"
      },
      {
       "id": "p54",
       "port": "p54",
       "weight": 3494176677421869.5,
       "domain": "main"
      },
      {
       "id": "p1",
       "port": "p1",
       "weight": 176172701534109.3,
       "domain": "main"
      },
      {
       "id": "p2",
       "port": "p2",
       "weight": 182144657518316.47,
       "domain": "main"
      },
      {
       "id": "p3",
       "port": "p3",
       "weight": 220625409264132.6,
       "domain": "main"
      },
      {
       "id": "p4",
       "port": "p4",
       "weight": 220625409264132.6,
       "domain": "main"
      }
     ]
    },
    "propulsion": {
     "version": 1,
     "architectureVersion": 2,
     "cores": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 15313272856330830,
       "densityFactor": 24.032689674335696,
       "efficiency": 0.4415248069267542,
       "wasteFraction": 0.5584751930732458,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 4303268967.43357,
       "ratedShaftPowerW": 162489577285430400,
       "ratedWasteHeatW": 205529557169196600,
       "thermalStoreJ": 45939818568992490,
       "version": 1,
       "id": 20,
       "machineryId": 20,
       "coreId": 20,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 368019134454627000,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 85520830.15022652,
       "effectiveMachineryVolumeM3": 0.045039037812737735,
       "machineryVolumeM3": 0.045039037812737735,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.24499999999999997,
       "machineryDiameterM": 0.48999999999999994,
       "machineryOffsetM": 1.25,
       "maxInputW": 1531327285633083000,
       "maxRatedInputW": 1531327285633083000,
       "inputDensityWPerM3": 8171114489274137000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 1675.115916164396,
       "powerNode": "p20",
       "heatNode": "p20",
       "reactorId": 15,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 9,
       "machineryModuleIndex": 42,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 368018668174510850,
       "transmissionRouteIds": [
        "p15>p20"
       ]
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 16354700231106086,
       "densityFactor": 39.99502806558034,
       "efficiency": 0.32206103841291717,
       "wasteFraction": 0.6779389615870828,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 5899502806.558035,
       "ratedShaftPowerW": 210662281343137540,
       "ratedWasteHeatW": 443444413404103600,
       "thermalStoreJ": 49064100693318264,
       "version": 1,
       "id": 21,
       "machineryId": 21,
       "coreId": 21,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 654106694747241200,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 110874884.91744082,
       "effectiveMachineryVolumeM3": 0.04810205950325319,
       "machineryVolumeM3": 0.04810205950325319,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3028495335971314,
       "machineryRadiusM": 0.252,
       "machineryDiameterM": 0.504,
       "machineryOffsetM": 2.1,
       "maxInputW": 1635470023110608600,
       "maxRatedInputW": 1635470023110608600,
       "inputDensityWPerM3": 13598309542297317000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 5124.699290253104,
       "powerNode": "p21",
       "heatNode": "p21",
       "reactorId": 16,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 10,
       "machineryModuleIndex": 43,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 654106532377221800,
       "transmissionRouteIds": [
        "p16>p21"
       ]
      }
     ],
     "engines": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 15313272856330830,
       "densityFactor": 24.032689674335696,
       "efficiency": 0.4415248069267542,
       "wasteFraction": 0.5584751930732458,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 4303268967.43357,
       "ratedShaftPowerW": 162489577285430400,
       "ratedWasteHeatW": 205529557169196600,
       "thermalStoreJ": 45939818568992490,
       "version": 1,
       "id": 20,
       "machineryId": 20,
       "coreId": 20,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 368019134454627000,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 85520830.15022652,
       "effectiveMachineryVolumeM3": 0.045039037812737735,
       "machineryVolumeM3": 0.045039037812737735,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.24499999999999997,
       "machineryDiameterM": 0.48999999999999994,
       "machineryOffsetM": 1.25,
       "maxInputW": 1531327285633083000,
       "maxRatedInputW": 1531327285633083000,
       "inputDensityWPerM3": 8171114489274137000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 1675.115916164396,
       "powerNode": "p20",
       "heatNode": "p20",
       "reactorId": 15,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 9,
       "coreModuleIndex": 9,
       "machineryModuleIndex": 42,
       "shaftModuleIndices": [],
       "shaftCapacityW": 162489577285430400,
       "ratedShaftCapacityW": 162489577285430400,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 368018668174510850
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 16354700231106086,
       "densityFactor": 39.99502806558034,
       "efficiency": 0.32206103841291717,
       "wasteFraction": 0.6779389615870828,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 5899502806.558035,
       "ratedShaftPowerW": 210662281343137540,
       "ratedWasteHeatW": 443444413404103600,
       "thermalStoreJ": 49064100693318264,
       "version": 1,
       "id": 21,
       "machineryId": 21,
       "coreId": 21,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 654106694747241200,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 110874884.91744082,
       "effectiveMachineryVolumeM3": 0.04810205950325319,
       "machineryVolumeM3": 0.04810205950325319,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3028495335971314,
       "machineryRadiusM": 0.252,
       "machineryDiameterM": 0.504,
       "machineryOffsetM": 2.1,
       "maxInputW": 1635470023110608600,
       "maxRatedInputW": 1635470023110608600,
       "inputDensityWPerM3": 13598309542297317000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 5124.699290253104,
       "powerNode": "p21",
       "heatNode": "p21",
       "reactorId": 16,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 10,
       "coreModuleIndex": 10,
       "machineryModuleIndex": 43,
       "shaftModuleIndices": [],
       "shaftCapacityW": 210662281343137540,
       "ratedShaftCapacityW": 210662281343137540,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 654106532377221800
      }
     ],
     "massKg": 10021.911438384648,
     "ratedThrustN": 196395715.06766734,
     "ratedAccelMps2": 19596.632466283576,
     "structuralAccelerationLimitMps2": 1806283.4330205964,
     "inertialFactor": 1,
     "accelerationLimitMps2": 19596.632466283576
    },
    "profileVersion": 18,
    "heat": {
     "v": 3,
     "mode": "strict",
     "src": [
      {
       "k": "reactor",
       "id": "p15",
       "n": "上部機関用反応炉 #15",
       "g": "high",
       "sh": 0.0767063,
       "st": 987151943249731600,
       "m": [
        4
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "reactor",
       "id": "p16",
       "n": "下部機関用反応炉 #16",
       "g": "high",
       "sh": 0.269378,
       "st": 3466688091519954400,
       "m": [
        5
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "reactor",
       "id": "p17",
       "n": "補助反応炉（機首） #17",
       "g": "high",
       "sh": 0.14625,
       "st": 1882127586646576600,
       "m": [
        6
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "reactor",
       "id": "p18",
       "n": "右舷補助反応炉 #18",
       "g": "high",
       "sh": 0.176422,
       "st": 2270417880612199200,
       "m": [
        7
       ],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "reactor",
       "id": "p19",
       "n": "左舷補助反応炉 #19",
       "g": "high",
       "sh": 0.176422,
       "st": 2270417880612199200,
       "m": [
        8
       ],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "shield",
       "id": "p22",
       "n": "シールド（艦首区画）",
       "g": "high",
       "sh": 1,
       "st": 86238437493046840000,
       "m": [
        11,
        12,
        13
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "reactor",
       "id": "p32",
       "n": "翼根部の推進・兵装用反応炉 #32",
       "g": "high",
       "sh": 0.154747,
       "st": 1991479640987064800,
       "m": [
        19
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "reactor",
       "id": "p33",
       "n": "翼根部の推進・兵装用反応炉 #33",
       "g": "high",
       "sh": 0.0000739994,
       "st": 952315465915780.5,
       "m": [
        20
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p20",
       "n": "上部イオン・エンジン #20",
       "g": "high",
       "sh": 0.316699,
       "st": 45939818568992490,
       "m": [
        9,
        42
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p21",
       "n": "下部イオン・エンジン #21",
       "g": "high",
       "sh": 0.683301,
       "st": 49064100693318264,
       "m": [
        10,
        43
       ],
       "pc": [],
       "sec": 1,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "feed",
       "id": "p-6000000",
       "n": "推進配電路 1",
       "g": "high",
       "sh": 0.741717,
       "st": 16786105449600,
       "m": [
        44
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1,
       "routeId": "p15>p20"
      },
      {
       "k": "feed",
       "id": "p-6000001",
       "n": "推進配電路 2",
       "g": "high",
       "sh": 0.258283,
       "st": 5845322154240,
       "m": [
        45
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1,
       "routeId": "p16>p21"
      },
      {
       "k": "weapon",
       "id": "f30",
       "n": "武装（中央区画）",
       "g": "high",
       "sh": 1,
       "st": 5230000000000001,
       "m": [
        0,
        1
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "hotel",
       "id": "hotel",
       "n": "生活・電子設備",
       "g": "low",
       "sh": 1,
       "st": 2653330599203300000,
       "m": [],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1
      }
     ],
     "dis": [
      {
       "id": "p47",
       "n": "機体内高エネルギー散逸装置 1 #47",
       "k": "hdis",
       "g": "high",
       "cap": 418960376647841400,
       "m": 34,
       "sec": 4,
       "src": -1,
       "power": 6284405649717621
      },
      {
       "id": "p48",
       "n": "機体内高エネルギー散逸装置 2 #48",
       "k": "hdis",
       "g": "high",
       "cap": 209480334747159500,
       "m": 35,
       "sec": 4,
       "src": -1,
       "power": 3142205021207392
      },
      {
       "id": "p49",
       "n": "機体内高エネルギー散逸装置 3 #49",
       "k": "hdis",
       "g": "high",
       "cap": 209480334747159500,
       "m": 36,
       "sec": 4,
       "src": -1,
       "power": 3142205021207392
      },
      {
       "id": "p50",
       "n": "機体内高エネルギー散逸装置 4 #50",
       "k": "hdis",
       "g": "high",
       "cap": 209479955257145920,
       "m": 37,
       "sec": 3,
       "src": -1,
       "power": 3142199328857188.5
      },
      {
       "id": "p51",
       "n": "機体内高エネルギー散逸装置 5 #51",
       "k": "hdis",
       "g": "high",
       "cap": 207062329893986240,
       "m": 38,
       "sec": 3,
       "src": -1,
       "power": 3105934948409793.5
      },
      {
       "id": "p52",
       "n": "機体内高エネルギー散逸装置 6 #52",
       "k": "hdis",
       "g": "high",
       "cap": 155296727555353150,
       "m": 39,
       "sec": 3,
       "src": -1,
       "power": 2329450913330297
      },
      {
       "id": "p53",
       "n": "機体内高エネルギー散逸装置 7 #53",
       "k": "hdis",
       "g": "high",
       "cap": 232945111828124640,
       "m": 40,
       "sec": 4,
       "src": -1,
       "power": 3494176677421869.5
      },
      {
       "id": "p54",
       "n": "機体内高エネルギー散逸装置 8 #54",
       "k": "hdis",
       "g": "high",
       "cap": 232945111828124640,
       "m": 41,
       "sec": 4,
       "src": -1,
       "power": 3494176677421869.5
      },
      {
       "id": "p1",
       "n": "右舷上部翼（放熱板） #1",
       "k": "wing",
       "g": "high",
       "cap": 17617270153410932,
       "m": 46,
       "sec": 1,
       "src": -1,
       "power": 176172701534109.3
      },
      {
       "id": "p2",
       "n": "左舷上部翼（放熱板） #2",
       "k": "wing",
       "g": "high",
       "cap": 18214465751831650,
       "m": 47,
       "sec": 1,
       "src": -1,
       "power": 182144657518316.47
      },
      {
       "id": "p3",
       "n": "右舷下部翼（放熱板） #3",
       "k": "wing",
       "g": "high",
       "cap": 22062540926413260,
       "m": 48,
       "sec": 1,
       "src": -1,
       "power": 220625409264132.6
      },
      {
       "id": "p4",
       "n": "左舷下部翼（放熱板） #4",
       "k": "wing",
       "g": "high",
       "cap": 22062540926413260,
       "m": 49,
       "sec": 1,
       "src": -1,
       "power": 220625409264132.6
      },
      {
       "id": "skin",
       "n": "外殻からの放熱",
       "k": "skin",
       "g": "low",
       "cap": 239551215258463400000,
       "m": -1,
       "sec": -1,
       "src": -1
      }
     ],
     "ln": [
      {
       "s": 0,
       "d": 0,
       "cap": 4934602063435281,
       "sec": 4
      },
      {
       "s": 0,
       "d": 1,
       "cap": 2467302756320864.5,
       "sec": 3
      },
      {
       "s": 0,
       "d": 2,
       "cap": 2467302756320864.5,
       "sec": 3
      },
      {
       "s": 0,
       "d": 3,
       "cap": 2467298286608910,
       "sec": 3
      },
      {
       "s": 0,
       "d": 4,
       "cap": 2438822994503449,
       "sec": 2
      },
      {
       "s": 0,
       "d": 5,
       "cap": 1829117011901895.5,
       "sec": 2
      },
      {
       "s": 0,
       "d": 6,
       "cap": 2743675759248314.5,
       "sec": 3
      },
      {
       "s": 0,
       "d": 7,
       "cap": 2743675759248314.5,
       "sec": 3
      },
      {
       "s": 0,
       "d": 8,
       "cap": 207499855587038.56,
       "sec": 2
      },
      {
       "s": 0,
       "d": 9,
       "cap": 214533748996768.78,
       "sec": 2
      },
      {
       "s": 0,
       "d": 10,
       "cap": 259857175161018.06,
       "sec": 2
      },
      {
       "s": 0,
       "d": 11,
       "cap": 259857175161018.06,
       "sec": 2
      },
      {
       "s": 1,
       "d": 0,
       "cap": 17329375003188534,
       "sec": 4
      },
      {
       "s": 1,
       "d": 1,
       "cap": 8664693558069665,
       "sec": 4
      },
      {
       "s": 1,
       "d": 2,
       "cap": 8664693558069665,
       "sec": 4
      },
      {
       "s": 1,
       "d": 3,
       "cap": 8664677861299466,
       "sec": 4
      },
      {
       "s": 1,
       "d": 4,
       "cap": 8564678102681171,
       "sec": 3
      },
      {
       "s": 1,
       "d": 5,
       "cap": 6423507755333175,
       "sec": 3
      },
      {
       "s": 1,
       "d": 6,
       "cap": 9635262480734308,
       "sec": 4
      },
      {
       "s": 1,
       "d": 7,
       "cap": 9635262480734308,
       "sec": 4
      },
      {
       "s": 1,
       "d": 8,
       "cap": 728699652849407,
       "sec": 3
      },
      {
       "s": 1,
       "d": 9,
       "cap": 753401335996844.9,
       "sec": 3
      },
      {
       "s": 1,
       "d": 10,
       "cap": 912568506587864.6,
       "sec": 3
      },
      {
       "s": 1,
       "d": 11,
       "cap": 912568506587864.6,
       "sec": 3
      },
      {
       "s": 2,
       "d": 0,
       "cap": 9408430724595230,
       "sec": 4
      },
      {
       "s": 2,
       "d": 1,
       "cap": 4704218650467512,
       "sec": 4
      },
      {
       "s": 2,
       "d": 2,
       "cap": 4704218650467512,
       "sec": 4
      },
      {
       "s": 2,
       "d": 3,
       "cap": 4704210128407426,
       "sec": 4
      },
      {
       "s": 2,
       "d": 4,
       "cap": 4649918453072144,
       "sec": 4
      },
      {
       "s": 2,
       "d": 5,
       "cap": 3487438393700439.5,
       "sec": 4
      },
      {
       "s": 2,
       "d": 6,
       "cap": 5231158050801059,
       "sec": 4
      },
      {
       "s": 2,
       "d": 7,
       "cap": 5231158050801059,
       "sec": 4
      },
      {
       "s": 2,
       "d": 8,
       "cap": 395624204658781.8,
       "sec": 3
      },
      {
       "s": 2,
       "d": 9,
       "cap": 409035194647215.25,
       "sec": 3
      },
      {
       "s": 2,
       "d": 10,
       "cap": 495449926734200.8,
       "sec": 3
      },
      {
       "s": 2,
       "d": 11,
       "cap": 495449926734200.8,
       "sec": 3
      },
      {
       "s": 3,
       "d": 0,
       "cap": 11349426838635120,
       "sec": 4
      },
      {
       "s": 3,
       "d": 1,
       "cap": 5674717385849788,
       "sec": 4
      },
      {
       "s": 3,
       "d": 2,
       "cap": 5674717385849788,
       "sec": 4
      },
      {
       "s": 3,
       "d": 3,
       "cap": 5674707105655323,
       "sec": 3
      },
      {
       "s": 3,
       "d": 4,
       "cap": 5609214845022110,
       "sec": 3
      },
      {
       "s": 3,
       "d": 5,
       "cap": 4206910595629980,
       "sec": 3
      },
      {
       "s": 3,
       "d": 6,
       "cap": 6310366448646830,
       "sec": 4
      },
      {
       "s": 3,
       "d": 7,
       "cap": 6310366448646830,
       "sec": 4
      },
      {
       "s": 3,
       "d": 8,
       "cap": 477243027854810.06,
       "sec": 2
      },
      {
       "s": 3,
       "d": 9,
       "cap": 493420757612600.4,
       "sec": 2
      },
      {
       "s": 3,
       "d": 10,
       "cap": 597663187440736.5,
       "sec": 2
      },
      {
       "s": 3,
       "d": 11,
       "cap": 597663187440736.5,
       "sec": 2
      },
      {
       "s": 4,
       "d": 0,
       "cap": 9728080147401532,
       "sec": 4
      },
      {
       "s": 4,
       "d": 1,
       "cap": 4864043473585532,
       "sec": 4
      },
      {
       "s": 4,
       "d": 2,
       "cap": 4864043473585532,
       "sec": 4
      },
      {
       "s": 4,
       "d": 3,
       "cap": 4864034661990277,
       "sec": 3
      },
      {
       "s": 4,
       "d": 4,
       "cap": 4807898438590380,
       "sec": 3
      },
      {
       "s": 4,
       "d": 5,
       "cap": 3605923367682840,
       "sec": 3
      },
      {
       "s": 4,
       "d": 6,
       "cap": 5408885527411569,
       "sec": 4
      },
      {
       "s": 4,
       "d": 7,
       "cap": 5408885527411569,
       "sec": 4
      },
      {
       "s": 4,
       "d": 8,
       "cap": 409065452446980.06,
       "sec": 2
      },
      {
       "s": 4,
       "d": 9,
       "cap": 422932077953657.5,
       "sec": 2
      },
      {
       "s": 4,
       "d": 10,
       "cap": 512282732092059.9,
       "sec": 2
      },
      {
       "s": 4,
       "d": 11,
       "cap": 512282732092059.9,
       "sec": 2
      },
      {
       "s": 5,
       "d": 0,
       "cap": 369506617650855100,
       "sec": 4
      },
      {
       "s": 5,
       "d": 1,
       "cap": 184753437964980400,
       "sec": 4
      },
      {
       "s": 5,
       "d": 2,
       "cap": 184753437964980400,
       "sec": 4
      },
      {
       "s": 5,
       "d": 3,
       "cap": 184753103269674700,
       "sec": 4
      },
      {
       "s": 5,
       "d": 4,
       "cap": 182620852535522460,
       "sec": 4
      },
      {
       "s": 5,
       "d": 5,
       "cap": 136965621881370690,
       "sec": 4
      },
      {
       "s": 5,
       "d": 6,
       "cap": 205448450897925760,
       "sec": 4
      },
      {
       "s": 5,
       "d": 7,
       "cap": 205448450897925760,
       "sec": 4
      },
      {
       "s": 5,
       "d": 8,
       "cap": 15537741202910900,
       "sec": 4
      },
      {
       "s": 5,
       "d": 9,
       "cap": 16064444294535002,
       "sec": 4
      },
      {
       "s": 5,
       "d": 10,
       "cap": 19458295650127630,
       "sec": 4
      },
      {
       "s": 5,
       "d": 11,
       "cap": 19458295650127630,
       "sec": 4
      },
      {
       "s": 6,
       "d": 0,
       "cap": 8532910404030042,
       "sec": 4
      },
      {
       "s": 6,
       "d": 1,
       "cap": 4266458184197697.5,
       "sec": 3
      },
      {
       "s": 6,
       "d": 2,
       "cap": 4266458184197697.5,
       "sec": 3
      },
      {
       "s": 6,
       "d": 3,
       "cap": 4266450455174942,
       "sec": 3
      },
      {
       "s": 6,
       "d": 4,
       "cap": 4217211000171080,
       "sec": 2
      },
      {
       "s": 6,
       "d": 5,
       "cap": 3162907845537710.5,
       "sec": 2
      },
      {
       "s": 6,
       "d": 6,
       "cap": 4744362185727444,
       "sec": 3
      },
      {
       "s": 6,
       "d": 7,
       "cap": 4744362185727444,
       "sec": 3
      },
      {
       "s": 6,
       "d": 8,
       "cap": 358808603776403.44,
       "sec": 1
      },
      {
       "s": 6,
       "d": 9,
       "cap": 370971607294247.7,
       "sec": 1
      },
      {
       "s": 6,
       "d": 10,
       "cap": 449344843816986.9,
       "sec": 1
      },
      {
       "s": 6,
       "d": 11,
       "cap": 449344843816986.9,
       "sec": 1
      },
      {
       "s": 7,
       "d": 0,
       "cap": 4080394740170.3555,
       "sec": 4
      },
      {
       "s": 7,
       "d": 1,
       "cap": 2040198796149.9006,
       "sec": 3
      },
      {
       "s": 7,
       "d": 2,
       "cap": 2040198796149.9006,
       "sec": 3
      },
      {
       "s": 7,
       "d": 3,
       "cap": 2040195100170.1812,
       "sec": 3
      },
      {
       "s": 7,
       "d": 4,
       "cap": 2016649041007.0942,
       "sec": 2
      },
      {
       "s": 7,
       "d": 5,
       "cap": 1512486587282.1353,
       "sec": 2
      },
      {
       "s": 7,
       "d": 6,
       "cap": 2268730080531.763,
       "sec": 3
      },
      {
       "s": 7,
       "d": 7,
       "cap": 2268730080531.763,
       "sec": 3
      },
      {
       "s": 7,
       "d": 8,
       "cap": 171580465544.98328,
       "sec": 1
      },
      {
       "s": 7,
       "d": 9,
       "cap": 177396752512.60986,
       "sec": 1
      },
      {
       "s": 7,
       "d": 10,
       "cap": 214874439132.4618,
       "sec": 1
      },
      {
       "s": 7,
       "d": 11,
       "cap": 214874439132.4618,
       "sec": 1
      },
      {
       "s": 8,
       "d": 0,
       "cap": 31702837080132396,
       "sec": 4
      },
      {
       "s": 8,
       "d": 1,
       "cap": 15851429619949506,
       "sec": 3
      },
      {
       "s": 8,
       "d": 2,
       "cap": 15851429619949506,
       "sec": 3
      },
      {
       "s": 8,
       "d": 3,
       "cap": 15851400903844728,
       "sec": 2
      },
      {
       "s": 8,
       "d": 4,
       "cap": 15668458584520168,
       "sec": 1
      },
      {
       "s": 8,
       "d": 5,
       "cap": 11751342435190248,
       "sec": 1
      },
      {
       "s": 8,
       "d": 6,
       "cap": 17627015203654360,
       "sec": 3
      },
      {
       "s": 8,
       "d": 7,
       "cap": 17627015203654360,
       "sec": 3
      },
      {
       "s": 8,
       "d": 8,
       "cap": 1333103263700112.5,
       "sec": 0
      },
      {
       "s": 8,
       "d": 9,
       "cap": 1378293204842489.8,
       "sec": 0
      },
      {
       "s": 8,
       "d": 10,
       "cap": 1669478021191855.5,
       "sec": 0
      },
      {
       "s": 8,
       "d": 11,
       "cap": 1669478021191855.5,
       "sec": 0
      },
      {
       "s": 9,
       "d": 0,
       "cap": 68401091239017960,
       "sec": 4
      },
      {
       "s": 9,
       "d": 1,
       "cap": 34200569525133172,
       "sec": 3
      },
      {
       "s": 9,
       "d": 2,
       "cap": 34200569525133172,
       "sec": 3
      },
      {
       "s": 9,
       "d": 3,
       "cap": 34200507568126040,
       "sec": 3
      },
      {
       "s": 9,
       "d": 4,
       "cap": 33805796702219384,
       "sec": 2
      },
      {
       "s": 9,
       "d": 5,
       "cap": 25354344283405530,
       "sec": 2
      },
      {
       "s": 9,
       "d": 6,
       "cap": 38031519771216744,
       "sec": 3
      },
      {
       "s": 9,
       "d": 7,
       "cap": 38031519771216744,
       "sec": 3
      },
      {
       "s": 9,
       "d": 8,
       "cap": 2876263652394961.5,
       "sec": 1
      },
      {
       "s": 9,
       "d": 9,
       "cap": 2973764115188012,
       "sec": 1
      },
      {
       "s": 9,
       "d": 10,
       "cap": 3602015748951462.5,
       "sec": 1
      },
      {
       "s": 9,
       "d": 11,
       "cap": 3602015748951462.5,
       "sec": 1
      },
      {
       "s": 10,
       "d": 0,
       "cap": 71175888191.22192,
       "sec": 4
      },
      {
       "s": 10,
       "d": 1,
       "cap": 35587968971.00408,
       "sec": 3
      },
      {
       "s": 10,
       "d": 2,
       "cap": 35587968971.00408,
       "sec": 3
      },
      {
       "s": 10,
       "d": 3,
       "cap": 35587904500.61433,
       "sec": 3
      },
      {
       "s": 10,
       "d": 4,
       "cap": 35177181572.79637,
       "sec": 2
      },
      {
       "s": 10,
       "d": 5,
       "cap": 26382882804.77041,
       "sec": 2
      },
      {
       "s": 10,
       "d": 6,
       "cap": 39574327689.004166,
       "sec": 3
      },
      {
       "s": 10,
       "d": 7,
       "cap": 39574327689.004166,
       "sec": 3
      },
      {
       "s": 10,
       "d": 8,
       "cap": 2992943773.6010976,
       "sec": 2
      },
      {
       "s": 10,
       "d": 9,
       "cap": 3094399494.740119,
       "sec": 2
      },
      {
       "s": 10,
       "d": 10,
       "cap": 3748137135.9196253,
       "sec": 2
      },
      {
       "s": 10,
       "d": 11,
       "cap": 3748137135.9196253,
       "sec": 2
      },
      {
       "s": 11,
       "d": 0,
       "cap": 12530560780.65045,
       "sec": 4
      },
      {
       "s": 11,
       "d": 1,
       "cap": 6265284769.654143,
       "sec": 4
      },
      {
       "s": 11,
       "d": 2,
       "cap": 6265284769.654143,
       "sec": 4
      },
      {
       "s": 11,
       "d": 3,
       "cap": 6265273419.600664,
       "sec": 4
      },
      {
       "s": 11,
       "d": 4,
       "cap": 6192965384.64924,
       "sec": 3
      },
      {
       "s": 11,
       "d": 5,
       "cap": 4644723444.346494,
       "sec": 3
      },
      {
       "s": 11,
       "d": 6,
       "cap": 6967085779.501413,
       "sec": 4
      },
      {
       "s": 11,
       "d": 7,
       "cap": 6967085779.501413,
       "sec": 4
      },
      {
       "s": 11,
       "d": 8,
       "cap": 526909671.5368158,
       "sec": 3
      },
      {
       "s": 11,
       "d": 9,
       "cap": 544771016.3346742,
       "sec": 3
      },
      {
       "s": 11,
       "d": 10,
       "cap": 659861947.4852762,
       "sec": 3
      },
      {
       "s": 11,
       "d": 11,
       "cap": 659861947.4852762,
       "sec": 3
      },
      {
       "s": 12,
       "d": 0,
       "cap": 22409028578118.504,
       "sec": 4
      },
      {
       "s": 12,
       "d": 1,
       "cap": 11204522120832.197,
       "sec": 3
      },
      {
       "s": 12,
       "d": 2,
       "cap": 11204522120832.197,
       "sec": 3
      },
      {
       "s": 12,
       "d": 3,
       "cap": 11204501822963.87,
       "sec": 3
      },
      {
       "s": 12,
       "d": 4,
       "cap": 11075189747469.514,
       "sec": 2
      },
      {
       "s": 12,
       "d": 5,
       "cap": 8306391248071.077,
       "sec": 2
      },
      {
       "s": 12,
       "d": 6,
       "cap": 12459587968332.402,
       "sec": 3
      },
      {
       "s": 12,
       "d": 7,
       "cap": 12459587968332.402,
       "sec": 3
      },
      {
       "s": 12,
       "d": 8,
       "cap": 942298919756.9353,
       "sec": 1
      },
      {
       "s": 12,
       "d": 9,
       "cap": 974241256019.8827,
       "sec": 1
      },
      {
       "s": 12,
       "d": 10,
       "cap": 1180064124635.5227,
       "sec": 1
      },
      {
       "s": 12,
       "d": 11,
       "cap": 1180064124635.5227,
       "sec": 1
      },
      {
       "s": 13,
       "d": 3,
       "cap": 66333264980082500,
       "sec": 3
      },
      {
       "s": 13,
       "d": 6,
       "cap": 66333264980082500,
       "sec": 4
      },
      {
       "s": 13,
       "d": 7,
       "cap": 66333264980082500,
       "sec": 4
      },
      {
       "s": 13,
       "d": 4,
       "cap": 66333264980082500,
       "sec": 3
      },
      {
       "s": 13,
       "d": 1,
       "cap": 66333264980082500,
       "sec": 4
      },
      {
       "s": 13,
       "d": 2,
       "cap": 66333264980082500,
       "sec": 4
      },
      {
       "s": 13,
       "d": 5,
       "cap": 66333264980082500,
       "sec": 3
      },
      {
       "s": 13,
       "d": 10,
       "cap": 66333264980082500,
       "sec": 3
      },
      {
       "s": 13,
       "d": 11,
       "cap": 66333264980082500,
       "sec": 3
      },
      {
       "s": 13,
       "d": 0,
       "cap": 66333264980082500,
       "sec": 4
      },
      {
       "s": 13,
       "d": 8,
       "cap": 66333264980082500,
       "sec": 3
      },
      {
       "s": 13,
       "d": 9,
       "cap": 66333264980082500,
       "sec": 3
      },
      {
       "s": 13,
       "d": 12,
       "cap": 239551215258463400000,
       "sec": -1
      }
     ]
    },
    "speedReference": {
     "version": 1,
     "key": "vwing",
     "status": "published",
     "mglt": 130,
     "model": "Alpha-3 Nimbus-class V-wing starfighter (2025 Encyclopedia)",
     "scope": "class",
     "continuity": "canon",
     "source": "https://starwars.fandom.com/wiki/Megalight_per_hour"
    },
    "mglt": 130,
    "maxSpeed": 2600
   },
   "fireArcs": [
    {
     "fixed": false,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      0,
      1
     ],
     "pos": [
      2.886,
      0.55,
      2.2849999686957094
     ],
     "k": "cturret",
     "gun": 0.5,
     "aa": 0.5,
     "cycle": 0.12
    },
    {
     "fixed": false,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      0,
      -1
     ],
     "pos": [
      2.886,
      0.55,
      -2.2849999686957103
     ],
     "k": "cturret",
     "gun": 0.5,
     "aa": 0.5,
     "cycle": 0.12
    }
   ]
  },
  "xwing": {
   "reference": "craft_xwing",
   "signature": "mzxhyf",
   "build": 181065,
   "crew": 1000,
   "total": 182065,
   "by": {
    "hull": 20,
    "armor": 12,
    "power": 19251,
    "drive": 77177,
    "defense": 13502,
    "command": 20502,
    "weapons": 33600,
    "systems": 17001,
    "crew": 1000
   },
   "detailed": true,
   "systems": {
    "v": 1,
    "managed": true,
    "power": 19309958900000004,
    "crew": 1,
    "suitSeats": 0,
    "lifeSupportCapacity": 1,
    "lifeSupportHours": 12.15672,
    "ejectionSeats": 1,
    "ejectionCoverage": 1,
    "ejectionSurvival": 0.9,
    "navCapacity": 2.331,
    "navReady": true,
    "targetDemand": 6,
    "targetCapacity": 7.44775,
    "targetRatio": 1,
    "fireK": 1,
    "maneuverSupport": 32.00000000000001,
    "maneuverRatio": 1,
    "turnK": 1,
    "laserUnits": 4,
    "laserGunShare": 1,
    "laserAaShare": 1,
    "laserGasSeconds": 643.1249999999999,
    "landingSupport": 29.491200000000006,
    "landingRatio": 1,
    "landingReady": true
   },
   "heat": {
    "up": 8.15e-7,
    "upS": 8.15e-7,
    "down": 0.0309,
    "T": 1
   },
   "powerProfile": {
    "name": "T-65B Xウイング",
    "modules": [
     {
      "k": "weapon",
      "fit": 42,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.574,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": 0.83,
      "z": 0.94,
      "r": 0.097,
      "share": 0.25,
      "domain": "main",
      "port": "f42",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 43,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.574,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": 0.83,
      "z": -0.94,
      "r": 0.097,
      "share": 0.25,
      "domain": "main",
      "port": "f43",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 44,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.574,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.83,
      "z": 0.94,
      "r": 0.097,
      "share": 0.25,
      "domain": "main",
      "port": "f44",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 45,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.574,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.83,
      "z": -0.94,
      "r": 0.097,
      "share": 0.25,
      "domain": "main",
      "port": "f45",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 46,
      "name": "魚雷発射管",
      "w": 0.84,
      "hits": 1,
      "crew": 0,
      "size": 0,
      "weaponPowerW": 1000000000000000,
      "stock": 0,
      "at": 0.671,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.04,
      "z": 0.1,
      "r": 0.052,
      "share": 0,
      "domain": "main",
      "port": "f46",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 47,
      "name": "魚雷発射管",
      "w": 0.84,
      "hits": 1,
      "crew": 0,
      "size": 0,
      "weaponPowerW": 1000000000000000,
      "stock": 0,
      "at": 0.671,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": -0.04,
      "z": -0.1,
      "r": 0.052,
      "share": 0,
      "domain": "main",
      "port": "f47",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "核融合炉",
      "w": 4.1743286506428,
      "hits": 1,
      "crew": 0.0009284810943450106,
      "size": 4.642405471725053,
      "at": 0.189,
      "part": 30,
      "y": -0.08,
      "z": 0,
      "r": 0.062,
      "share": 1,
      "domain": "main",
      "port": "p30",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "右舷上機関 4L4 核融合推進機関",
      "w": 1.1302838999798248,
      "hits": 1,
      "crew": 0.0004806636759992384,
      "size": 1.201659189998096,
      "at": 0.159,
      "part": 31,
      "y": 0.54,
      "z": 0.24,
      "r": 0.04,
      "share": 0.24330027746994093,
      "domain": "main",
      "port": "p31",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "右舷上機関 4L4 核融合推進機関",
      "w": 1.1302838999798248,
      "hits": 1,
      "crew": 0.0004806636759992384,
      "size": 1.201659189998096,
      "at": 0.159,
      "part": 32,
      "y": 0.54,
      "z": -0.24,
      "r": 0.04,
      "share": 0.24330027746994093,
      "domain": "main",
      "port": "p32",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "右舷下機関 4L4 核融合推進機関",
      "w": 1.1302838999798248,
      "hits": 1,
      "crew": 0.0004806636759992384,
      "size": 1.201659189998096,
      "at": 0.159,
      "part": 33,
      "y": -0.54,
      "z": 0.24,
      "r": 0.04,
      "share": 0.24330027746994093,
      "domain": "main",
      "port": "p33",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "右舷下機関 4L4 核融合推進機関",
      "w": 1.1302838999798248,
      "hits": 1,
      "crew": 0.0004806636759992384,
      "size": 1.201659189998096,
      "at": 0.159,
      "part": 34,
      "y": -0.54,
      "z": -0.24,
      "r": 0.04,
      "share": 0.24330027746994093,
      "domain": "main",
      "port": "p34",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "操縦席",
      "w": 0.7860517130936855,
      "hits": 1,
      "crew": 0,
      "size": 0.696909970321336,
      "at": 0.473,
      "part": 35,
      "y": 0.25,
      "z": 0,
      "r": 0.033,
      "share": 0.5627014247494188,
      "domain": "main",
      "port": "p35",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "アストロメク・ソケット",
      "w": 0.22677493598531082,
      "hits": 1,
      "crew": 0,
      "size": 0.10799224746714915,
      "at": 0.353,
      "part": 36,
      "y": 0.5,
      "z": 0,
      "r": 0.018,
      "share": 0.08719546871117025,
      "domain": "main",
      "port": "p36",
      "powerConnected": true
     },
     {
      "k": "fuel",
      "name": "反応物タンク",
      "w": 0.2926758844396627,
      "hits": 1,
      "crew": 0.00003166725394818512,
      "size": 0.1583362697409256,
      "at": 0.305,
      "part": 37,
      "y": -0.1,
      "z": 0,
      "r": 0.02,
      "share": 1,
      "domain": "main",
      "port": "p37",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "慣性補償装置",
      "w": 0.21840691745130233,
      "hits": 1,
      "crew": 0.000020414069063026475,
      "size": 0.10207034531513237,
      "at": 0.473,
      "part": 38,
      "y": -0.11,
      "z": 0,
      "r": 0.017,
      "share": 0.08241398628148133,
      "domain": "main",
      "port": "p38",
      "powerConnected": true
     },
     {
      "k": "shield",
      "name": "偏向シールド発生器",
      "w": 0.48046598925957823,
      "hits": 1,
      "crew": 0.00013321525712478065,
      "size": 0.33303814281195154,
      "at": 0.596,
      "part": 39,
      "y": 0.08,
      "z": 0,
      "r": 0.026,
      "share": 1,
      "domain": "main",
      "port": "p39",
      "powerConnected": true
     },
     {
      "k": "hyper",
      "name": "ハイパードライブ（GBk-585）",
      "w": 0.30550540219016253,
      "hits": 1,
      "crew": 0.000050658181539135404,
      "size": 0.16886060513045137,
      "at": 0.72,
      "part": 40,
      "y": 0.08,
      "z": 0,
      "r": 0.021,
      "share": 1,
      "domain": "main",
      "port": "p40",
      "powerConnected": true
     },
     {
      "k": "battery",
      "name": "パワーセル",
      "w": 0.1764,
      "hits": 1,
      "crew": 0.000014817599999999999,
      "size": 0.07408799999999999,
      "at": 0.802,
      "part": 41,
      "y": 0.08,
      "z": 0,
      "r": 0.016,
      "share": 1,
      "domain": "main",
      "port": "p41",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "生命維持装置",
      "w": 0.13690000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.050653,
      "at": 0.544,
      "part": 64,
      "y": 0.09,
      "z": 0,
      "r": 0.014,
      "share": 0.04089841799033263,
      "domain": "main",
      "port": "p64",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "射出座席機構 1",
      "w": 0.08410000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.024388999999999997,
      "at": 0.473,
      "part": 65,
      "y": -0.16,
      "z": -0.07,
      "r": 0.011,
      "share": 0.019692249548224634,
      "domain": "main",
      "port": "p65",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "航法コンピューター",
      "w": 0.048400000000000006,
      "hits": 1,
      "crew": 0,
      "size": 0.010648,
      "at": 0.521,
      "part": 66,
      "y": 0.09,
      "z": 0,
      "r": 0.008,
      "share": 0.008597444470437325,
      "domain": "main",
      "port": "p66",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "照準コンピューター",
      "w": 0.09610000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.029791,
      "at": 0.544,
      "part": 67,
      "y": -0.14,
      "z": 0,
      "r": 0.012,
      "share": 0.024053950809428848,
      "domain": "main",
      "port": "p67",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 1",
      "w": 0.040000000000000015,
      "hits": 1,
      "crew": 0,
      "size": 0.008000000000000002,
      "at": 0.544,
      "part": 68,
      "y": 0.09,
      "z": -0.05,
      "r": 0.007,
      "share": 0.006459387280568991,
      "domain": "main",
      "port": "p68",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 2",
      "w": 0.040000000000000015,
      "hits": 1,
      "crew": 0,
      "size": 0.008000000000000002,
      "at": 0.544,
      "part": 69,
      "y": 0.09,
      "z": 0.05,
      "r": 0.007,
      "share": 0.006459387280568991,
      "domain": "main",
      "port": "p69",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 3",
      "w": 0.040000000000000015,
      "hits": 1,
      "crew": 0,
      "size": 0.008000000000000002,
      "at": 0.544,
      "part": 70,
      "y": 0.24,
      "z": 0,
      "r": 0.007,
      "share": 0.006459387280568991,
      "domain": "main",
      "port": "p70",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 4",
      "w": 0.040000000000000015,
      "hits": 1,
      "crew": 0,
      "size": 0.008000000000000002,
      "at": 0.523,
      "part": 71,
      "y": 0.02,
      "z": 0,
      "r": 0.007,
      "share": 0.006459387280568991,
      "domain": "main",
      "port": "p71",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 1",
      "w": 0.1225,
      "hits": 1,
      "crew": 0,
      "size": 0.04287499999999999,
      "at": 0.526,
      "part": 72,
      "y": 0.35,
      "z": 0,
      "r": 0.013,
      "share": 0.03461827870679942,
      "domain": "main",
      "port": "p72",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 2",
      "w": 0.1225,
      "hits": 1,
      "crew": 0,
      "size": 0.04287499999999999,
      "at": 0.526,
      "part": 73,
      "y": -0.04,
      "z": -0.08,
      "r": 0.013,
      "share": 0.03461827870679942,
      "domain": "main",
      "port": "p73",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 1",
      "w": 0.10240000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.032768000000000005,
      "at": 0.544,
      "part": 74,
      "y": 0.09,
      "z": -0.08,
      "r": 0.012,
      "share": 0.026457650301210587,
      "domain": "main",
      "port": "p74",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 2",
      "w": 0.10240000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.032768000000000005,
      "at": 0.544,
      "part": 75,
      "y": 0.09,
      "z": 0.08,
      "r": 0.012,
      "share": 0.026457650301210587,
      "domain": "main",
      "port": "p75",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 3",
      "w": 0.10240000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.032768000000000005,
      "at": 0.544,
      "part": 76,
      "y": 0.33,
      "z": 0,
      "r": 0.012,
      "share": 0.026457650301210587,
      "domain": "main",
      "port": "p76",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 1",
      "w": 0.18566360999173018,
      "hits": 1,
      "crew": 0.0000040000018306411445,
      "size": 0.0800000366128229,
      "at": 0.649,
      "part": 77,
      "y": 0.09,
      "z": 0,
      "r": 0.016,
      "share": 0.019487934438438333,
      "domain": "main",
      "port": "p77",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 2",
      "w": 0.185663644235562,
      "hits": 1,
      "crew": 0.000004000002937282854,
      "size": 0.08000005874565706,
      "at": 0.41,
      "part": 78,
      "y": 0.04,
      "z": 0,
      "r": 0.016,
      "share": 0.01948793982997613,
      "domain": "main",
      "port": "p78",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 3",
      "w": 0.18566364423556198,
      "hits": 1,
      "crew": 0.000004000002937282853,
      "size": 0.08000005874565705,
      "at": 0.368,
      "part": 79,
      "y": 0.04,
      "z": 0,
      "r": 0.016,
      "share": 0.019487939829976125,
      "domain": "main",
      "port": "p79",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 4",
      "w": 0.185663644235562,
      "hits": 1,
      "crew": 0.000004000002937282854,
      "size": 0.08000005874565706,
      "at": 0.41,
      "part": 80,
      "y": 0.34,
      "z": 0,
      "r": 0.016,
      "share": 0.01948793982997613,
      "domain": "main",
      "port": "p80",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 5",
      "w": 0.18566364423556198,
      "hits": 1,
      "crew": 0.000004000002937282853,
      "size": 0.08000005874565705,
      "at": 0.368,
      "part": 81,
      "y": -0.26,
      "z": 0,
      "r": 0.016,
      "share": 0.019487939829976125,
      "domain": "main",
      "port": "p81",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 6",
      "w": 0.18566363567460314,
      "hits": 1,
      "crew": 0.0000040000026606223885,
      "size": 0.08000005321244776,
      "at": 0.368,
      "part": 82,
      "y": 0.04,
      "z": -0.1,
      "r": 0.016,
      "share": 0.019487938482091495,
      "domain": "main",
      "port": "p82",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 7",
      "w": 0.18566363567460317,
      "hits": 1,
      "crew": 0.0000040000026606223885,
      "size": 0.08000005321244777,
      "at": 0.368,
      "part": 83,
      "y": 0.04,
      "z": 0.1,
      "r": 0.016,
      "share": 0.0194879384820915,
      "domain": "main",
      "port": "p83",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 8",
      "w": 0.18566360999173018,
      "hits": 1,
      "crew": 0.0000040000018306411445,
      "size": 0.0800000366128229,
      "at": 0.326,
      "part": 84,
      "y": 0.19,
      "z": 0,
      "r": 0.016,
      "share": 0.019487934438438333,
      "domain": "main",
      "port": "p84",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 9",
      "w": 0.08402444348183616,
      "hits": 1,
      "crew": 0.0000012178070148878587,
      "size": 0.02435614029775717,
      "at": 0.544,
      "part": 85,
      "y": -0.11,
      "z": 0.06,
      "r": 0.011,
      "share": 0.005933133100841827,
      "domain": "main",
      "port": "p85",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.1030695428454951,
      "hits": 1,
      "crew": 0.000006617981066361463,
      "size": 0.033089905331807314,
      "at": 0.329,
      "part": -31,
      "machineryOwner": 31,
      "y": 0.54,
      "z": 0.24,
      "r": 0.012,
      "share": 0.006699722530059088,
      "domain": "main",
      "port": "p31",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.1030695428454951,
      "hits": 1,
      "crew": 0.000006617981066361463,
      "size": 0.033089905331807314,
      "at": 0.329,
      "part": -32,
      "machineryOwner": 32,
      "y": 0.54,
      "z": -0.24,
      "r": 0.012,
      "share": 0.006699722530059088,
      "domain": "main",
      "port": "p32",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.1030695428454951,
      "hits": 1,
      "crew": 0.000006617981066361463,
      "size": 0.033089905331807314,
      "at": 0.329,
      "part": -33,
      "machineryOwner": 33,
      "y": -0.54,
      "z": 0.24,
      "r": 0.012,
      "share": 0.006699722530059088,
      "domain": "main",
      "port": "p33",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.1030695428454951,
      "hits": 1,
      "crew": 0.000006617981066361463,
      "size": 0.033089905331807314,
      "at": 0.329,
      "part": -34,
      "machineryOwner": 34,
      "y": -0.54,
      "z": -0.24,
      "r": 0.012,
      "share": 0.006699722530059088,
      "domain": "main",
      "port": "p34",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p30 → p33",
      "w": 0.009324682766963951,
      "hits": 1,
      "crew": 1.8008647371188332e-7,
      "size": 0.0009004323685594165,
      "at": 0.261,
      "part": -6000000,
      "routeId": "p30>p33",
      "capacityW": 466088965633730500,
      "y": -0.45,
      "z": 0.2,
      "r": 0.004,
      "share": 0.24622535284126157,
      "domain": "main",
      "port": "p-6000000",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p30 → p34",
      "w": 0.009324682766963951,
      "hits": 1,
      "crew": 1.8008647371188332e-7,
      "size": 0.0009004323685594165,
      "at": 0.261,
      "part": -6000001,
      "routeId": "p30>p34",
      "capacityW": 466088965633730500,
      "y": -0.45,
      "z": -0.2,
      "r": 0.004,
      "share": 0.24622535284126157,
      "domain": "main",
      "port": "p-6000001",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p30 → p31",
      "w": 0.009514318998413183,
      "hits": 1,
      "crew": 1.8560794328014517e-7,
      "size": 0.0009280397164007258,
      "at": 0.261,
      "part": -6000002,
      "routeId": "p30>p31",
      "capacityW": 466088965633730500,
      "y": 0.4,
      "z": 0.19,
      "r": 0.004,
      "share": 0.25377464715873843,
      "domain": "main",
      "port": "p-6000002",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p30 → p32",
      "w": 0.009514318998413183,
      "hits": 1,
      "crew": 1.8560794328014517e-7,
      "size": 0.0009280397164007258,
      "at": 0.261,
      "part": -6000003,
      "routeId": "p30>p32",
      "capacityW": 466088965633730500,
      "y": 0.4,
      "z": -0.19,
      "r": 0.004,
      "share": 0.25377464715873843,
      "domain": "main",
      "port": "p-6000003",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "右舷上翼（Sフォイル）",
      "w": 2.590080450307613,
      "hits": 1,
      "crew": 0,
      "size": 0.8601874022640921,
      "at": 0.197,
      "part": 2,
      "ext": 1,
      "y": 0.29,
      "z": 0.53,
      "r": 0.036,
      "share": 0.20954085035263956,
      "domain": "main",
      "port": "p2",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "右舷上翼（Sフォイル）",
      "w": 2.6311928752361275,
      "hits": 1,
      "crew": 0,
      "size": 0.8601874203239543,
      "at": 0.197,
      "part": 3,
      "ext": 1,
      "y": 0.29,
      "z": -0.53,
      "r": 0.036,
      "share": 0.20954085475200518,
      "domain": "main",
      "port": "p3",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "右舷下翼（Sフォイル）",
      "w": 2.631192631652971,
      "hits": 1,
      "crew": 0,
      "size": 0.8601873008759479,
      "at": 0.197,
      "part": 16,
      "ext": 1,
      "y": -0.29,
      "z": 0.53,
      "r": 0.036,
      "share": 0.209540825654582,
      "domain": "main",
      "port": "p16",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "右舷下翼（Sフォイル）",
      "w": 2.5900802906589644,
      "hits": 1,
      "crew": 0,
      "size": 0.8601873227331139,
      "at": 0.197,
      "part": 17,
      "ext": 1,
      "y": -0.29,
      "z": -0.53,
      "r": 0.036,
      "share": 0.2095408309789673,
      "domain": "main",
      "port": "p17",
      "powerConnected": true
     },
     {
      "k": "quarters",
      "name": "居住空間（後部）",
      "w": 0.9991367801520212,
      "hits": 1,
      "crew": 0,
      "size": 17.190975886446978,
      "at": 0.18,
      "y": -0.01,
      "z": 0,
      "r": 0.096,
      "share": 0.47531847133757965,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央後部）",
      "w": 0.868704957941751,
      "hits": 1,
      "crew": 0,
      "size": 13.937072577957013,
      "at": 0.321,
      "y": 0,
      "z": 0,
      "r": 0.09,
      "share": 0.3853503184713376,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央前部）",
      "w": 0.34093639654526553,
      "hits": 1,
      "crew": 0,
      "size": 3.426676935489431,
      "at": 0.606,
      "y": 0.06,
      "z": 0,
      "r": 0.056,
      "share": 0.09474522292993631,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（前部）",
      "w": 0.20626905412286997,
      "hits": 1,
      "crew": 0,
      "size": 1.6125538519950262,
      "at": 0.843,
      "y": 0.06,
      "z": 0,
      "r": 0.044,
      "share": 0.044585987261146494,
      "domain": "main"
     },
     {
      "k": "hull",
      "name": "船体構造",
      "w": 19.68595692976132,
      "hits": null,
      "crew": 0,
      "size": 1,
      "share": 1,
      "domain": "main"
     }
    ],
    "energyModel": {
     "version": 0,
     "eta": 0.75
    },
    "D": 0.0023273845119412004,
    "shieldBuffer": 0.04654769023882401,
    "wCap": 0,
    "crewNeed": 1,
    "crewMax": 1,
    "hp": 1,
    "len": 13.382523538544774,
    "width": 11.720273971557617,
    "height": 3.731052106612937,
    "foils": [
     {
      "id": 2,
      "n": "右舷上翼（Sフォイル）",
      "T": 1,
      "sec": -1,
      "jam": 0.5
     },
     {
      "id": 3,
      "n": "右舷上翼（Sフォイル）",
      "T": 1,
      "sec": -1,
      "jam": 0.5
     },
     {
      "id": 16,
      "n": "右舷下翼（Sフォイル）",
      "T": 1,
      "sec": -1,
      "jam": 0.5
     },
     {
      "id": 17,
      "n": "右舷下翼（Sフォイル）",
      "T": 1,
      "sec": -1,
      "jam": 0.5
     }
    ],
    "grid": {
     "P": 24312294686635070000,
     "fixed": 133774761683335460,
     "cooling": 108327819140123200,
     "De": 1864355862534922000,
     "Ds": 11094812695942191000,
     "Dw": 2278933333333333.5,
     "domains": [
      {
       "id": "main",
       "P": 24312294686635070000,
       "reactors": [
        6
       ],
       "sources": [
        {
         "moduleIndex": 6,
         "P": 24312294686635070000
        }
       ],
       "modules": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36,
        37,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        46,
        47,
        48,
        49,
        50,
        51,
        52,
        53,
        54,
        55,
        56
       ],
       "protection": 1
      }
     ],
     "powerPaths": [
      {
       "kind": "power",
       "from": "p30",
       "to": "hotel",
       "cap": 133774761683335460,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p2",
       "cap": 975772045454545.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p3",
       "cap": 999571363636363.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p16",
       "cap": 999571363636363.8,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p17",
       "cap": 975772045454545.5,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p35",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p36",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p37",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p38",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p40",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p41",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p64",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p65",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p66",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p67",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p68",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p69",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p70",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p71",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p72",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p73",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p74",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p75",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p76",
       "cap": 4777670060119123,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p39",
       "cap": 194755535959239660000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "f42",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "f43",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "f44",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "f45",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "f46",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "f47",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p77",
       "cap": 12568814660321880,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p78",
       "cap": 12568818137613920,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p79",
       "cap": 12568818137613918,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p80",
       "cap": 12568818137613920,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p81",
       "cap": 12568818137613918,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p82",
       "cap": 12568817268290790,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p83",
       "cap": 12568817268290792,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p84",
       "cap": 12568814660321880,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p85",
       "cap": 3826595914260354,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p-6000000",
       "cap": 466088965633730500,
       "auto": false,
       "ok": true,
       "capacityGroup": "p30>p33",
       "groupCap": 466088965633730500,
       "physical": true,
       "routeId": "p30>p33",
       "efficiency": 0.9999806812918278
      },
      {
       "kind": "power",
       "from": "p-6000000",
       "to": "p33",
       "cap": 466088965633730500,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p30>p33",
       "efficiency": 1
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p-6000001",
       "cap": 466088965633730500,
       "auto": false,
       "ok": true,
       "capacityGroup": "p30>p34",
       "groupCap": 466088965633730500,
       "physical": true,
       "routeId": "p30>p34",
       "efficiency": 0.9999806812918278
      },
      {
       "kind": "power",
       "from": "p-6000001",
       "to": "p34",
       "cap": 466088965633730500,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p30>p34",
       "efficiency": 1
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p-6000002",
       "cap": 466088965633730500,
       "auto": false,
       "ok": true,
       "capacityGroup": "p30>p31",
       "groupCap": 466088965633730500,
       "physical": true,
       "routeId": "p30>p31",
       "efficiency": 0.9999800889841706
      },
      {
       "kind": "power",
       "from": "p-6000002",
       "to": "p31",
       "cap": 466088965633730500,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p30>p31",
       "efficiency": 1
      },
      {
       "kind": "power",
       "from": "p30",
       "to": "p-6000003",
       "cap": 466088965633730500,
       "auto": false,
       "ok": true,
       "capacityGroup": "p30>p32",
       "groupCap": 466088965633730500,
       "physical": true,
       "routeId": "p30>p32",
       "efficiency": 0.9999800889841706
      },
      {
       "kind": "power",
       "from": "p-6000003",
       "to": "p32",
       "cap": 466088965633730500,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p30>p32",
       "efficiency": 1
      }
     ],
     "trunks": [
      {
       "port": "p-6000000",
       "moduleIndex": 44
      },
      {
       "port": "p-6000001",
       "moduleIndex": 45
      },
      {
       "port": "p-6000002",
       "moduleIndex": 46
      },
      {
       "port": "p-6000003",
       "moduleIndex": 47
      }
     ],
     "fixedLoads": [
      {
       "id": "hotel",
       "port": "hotel",
       "weight": 133774761683335460,
       "domain": "main"
      }
     ],
     "coolingLoads": [
      {
       "id": "p77",
       "port": "p77",
       "weight": 12568814660321880,
       "domain": "main"
      },
      {
       "id": "p78",
       "port": "p78",
       "weight": 12568818137613920,
       "domain": "main"
      },
      {
       "id": "p79",
       "port": "p79",
       "weight": 12568818137613918,
       "domain": "main"
      },
      {
       "id": "p80",
       "port": "p80",
       "weight": 12568818137613920,
       "domain": "main"
      },
      {
       "id": "p81",
       "port": "p81",
       "weight": 12568818137613918,
       "domain": "main"
      },
      {
       "id": "p82",
       "port": "p82",
       "weight": 12568817268290790,
       "domain": "main"
      },
      {
       "id": "p83",
       "port": "p83",
       "weight": 12568817268290792,
       "domain": "main"
      },
      {
       "id": "p84",
       "port": "p84",
       "weight": 12568814660321880,
       "domain": "main"
      },
      {
       "id": "p85",
       "port": "p85",
       "weight": 3826595914260354,
       "domain": "main"
      },
      {
       "id": "p2",
       "port": "p2",
       "weight": 975772045454545.5,
       "domain": "main"
      },
      {
       "id": "p3",
       "port": "p3",
       "weight": 999571363636363.8,
       "domain": "main"
      },
      {
       "id": "p16",
       "port": "p16",
       "weight": 999571363636363.8,
       "domain": "main"
      },
      {
       "id": "p17",
       "port": "p17",
       "weight": 975772045454545.5,
       "domain": "main"
      }
     ]
    },
    "propulsion": {
     "version": 1,
     "architectureVersion": 2,
     "cores": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 11250567812814488,
       "densityFactor": 41.42803931218933,
       "efficiency": 0.3144235725048154,
       "wasteFraction": 0.6855764274951845,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 6042803931.218934,
       "ratedShaftPowerW": 146549357679631680,
       "ratedWasteHeatW": 319539607954098800,
       "thermalStoreJ": 33751703438443468,
       "version": 1,
       "id": 31,
       "machineryId": 31,
       "coreId": 31,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 466088965633730500,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 77131240.88401666,
       "effectiveMachineryVolumeM3": 0.03308990533180732,
       "machineryVolumeM3": 0.03308990533180732,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.21,
       "machineryDiameterM": 0.42,
       "machineryOffsetM": 2.125,
       "maxInputW": 1125056781281449000,
       "maxRatedInputW": 1125056781281449000,
       "inputDensityWPerM3": 14085533366144370000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 3789.0735755412134,
       "powerNode": "p31",
       "heatNode": "p31",
       "reactorId": 30,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 7,
       "machineryModuleIndex": 40,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 466079685328957800,
       "transmissionRouteIds": [
        "p30>p31"
       ]
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 11250567812814488,
       "densityFactor": 41.42803931218933,
       "efficiency": 0.3144235725048154,
       "wasteFraction": 0.6855764274951845,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 6042803931.218934,
       "ratedShaftPowerW": 146549357679631680,
       "ratedWasteHeatW": 319539607954098800,
       "thermalStoreJ": 33751703438443468,
       "version": 1,
       "id": 32,
       "machineryId": 32,
       "coreId": 32,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 466088965633730500,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 77131240.88401666,
       "effectiveMachineryVolumeM3": 0.03308990533180732,
       "machineryVolumeM3": 0.03308990533180732,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.21,
       "machineryDiameterM": 0.42,
       "machineryOffsetM": 2.125,
       "maxInputW": 1125056781281449000,
       "maxRatedInputW": 1125056781281449000,
       "inputDensityWPerM3": 14085533366144370000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 3789.0735755412134,
       "powerNode": "p32",
       "heatNode": "p32",
       "reactorId": 30,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 8,
       "machineryModuleIndex": 41,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 466079685328957800,
       "transmissionRouteIds": [
        "p30>p32"
       ]
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 11250567812814488,
       "densityFactor": 41.42803931218933,
       "efficiency": 0.3144235725048154,
       "wasteFraction": 0.6855764274951845,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 6042803931.218934,
       "ratedShaftPowerW": 146549357679631680,
       "ratedWasteHeatW": 319539607954098800,
       "thermalStoreJ": 33751703438443468,
       "version": 1,
       "id": 33,
       "machineryId": 33,
       "coreId": 33,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 466088965633730500,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 77131240.88401666,
       "effectiveMachineryVolumeM3": 0.03308990533180732,
       "machineryVolumeM3": 0.03308990533180732,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.21,
       "machineryDiameterM": 0.42,
       "machineryOffsetM": 2.125,
       "maxInputW": 1125056781281449000,
       "maxRatedInputW": 1125056781281449000,
       "inputDensityWPerM3": 14085533366144370000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 3789.0735755412134,
       "powerNode": "p33",
       "heatNode": "p33",
       "reactorId": 30,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 9,
       "machineryModuleIndex": 42,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 466079961397021100,
       "transmissionRouteIds": [
        "p30>p33"
       ]
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 11250567812814488,
       "densityFactor": 41.42803931218933,
       "efficiency": 0.3144235725048154,
       "wasteFraction": 0.6855764274951845,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 6042803931.218934,
       "ratedShaftPowerW": 146549357679631680,
       "ratedWasteHeatW": 319539607954098800,
       "thermalStoreJ": 33751703438443468,
       "version": 1,
       "id": 34,
       "machineryId": 34,
       "coreId": 34,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 466088965633730500,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 77131240.88401666,
       "effectiveMachineryVolumeM3": 0.03308990533180732,
       "machineryVolumeM3": 0.03308990533180732,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.21,
       "machineryDiameterM": 0.42,
       "machineryOffsetM": 2.125,
       "maxInputW": 1125056781281449000,
       "maxRatedInputW": 1125056781281449000,
       "inputDensityWPerM3": 14085533366144370000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 3789.0735755412134,
       "powerNode": "p34",
       "heatNode": "p34",
       "reactorId": 30,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 10,
       "machineryModuleIndex": 43,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 466079961397021100,
       "transmissionRouteIds": [
        "p30>p34"
       ]
      }
     ],
     "engines": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 11250567812814488,
       "densityFactor": 41.42803931218933,
       "efficiency": 0.3144235725048154,
       "wasteFraction": 0.6855764274951845,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 6042803931.218934,
       "ratedShaftPowerW": 146549357679631680,
       "ratedWasteHeatW": 319539607954098800,
       "thermalStoreJ": 33751703438443468,
       "version": 1,
       "id": 31,
       "machineryId": 31,
       "coreId": 31,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 466088965633730500,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 77131240.88401666,
       "effectiveMachineryVolumeM3": 0.03308990533180732,
       "machineryVolumeM3": 0.03308990533180732,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.21,
       "machineryDiameterM": 0.42,
       "machineryOffsetM": 2.125,
       "maxInputW": 1125056781281449000,
       "maxRatedInputW": 1125056781281449000,
       "inputDensityWPerM3": 14085533366144370000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 3789.0735755412134,
       "powerNode": "p31",
       "heatNode": "p31",
       "reactorId": 30,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 7,
       "coreModuleIndex": 7,
       "machineryModuleIndex": 40,
       "shaftModuleIndices": [],
       "shaftCapacityW": 146549357679631680,
       "ratedShaftCapacityW": 146549357679631680,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 466079685328957800
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 11250567812814488,
       "densityFactor": 41.42803931218933,
       "efficiency": 0.3144235725048154,
       "wasteFraction": 0.6855764274951845,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 6042803931.218934,
       "ratedShaftPowerW": 146549357679631680,
       "ratedWasteHeatW": 319539607954098800,
       "thermalStoreJ": 33751703438443468,
       "version": 1,
       "id": 32,
       "machineryId": 32,
       "coreId": 32,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 466088965633730500,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 77131240.88401666,
       "effectiveMachineryVolumeM3": 0.03308990533180732,
       "machineryVolumeM3": 0.03308990533180732,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.21,
       "machineryDiameterM": 0.42,
       "machineryOffsetM": 2.125,
       "maxInputW": 1125056781281449000,
       "maxRatedInputW": 1125056781281449000,
       "inputDensityWPerM3": 14085533366144370000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 3789.0735755412134,
       "powerNode": "p32",
       "heatNode": "p32",
       "reactorId": 30,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 8,
       "coreModuleIndex": 8,
       "machineryModuleIndex": 41,
       "shaftModuleIndices": [],
       "shaftCapacityW": 146549357679631680,
       "ratedShaftCapacityW": 146549357679631680,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 466079685328957800
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 11250567812814488,
       "densityFactor": 41.42803931218933,
       "efficiency": 0.3144235725048154,
       "wasteFraction": 0.6855764274951845,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 6042803931.218934,
       "ratedShaftPowerW": 146549357679631680,
       "ratedWasteHeatW": 319539607954098800,
       "thermalStoreJ": 33751703438443468,
       "version": 1,
       "id": 33,
       "machineryId": 33,
       "coreId": 33,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 466088965633730500,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 77131240.88401666,
       "effectiveMachineryVolumeM3": 0.03308990533180732,
       "machineryVolumeM3": 0.03308990533180732,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.21,
       "machineryDiameterM": 0.42,
       "machineryOffsetM": 2.125,
       "maxInputW": 1125056781281449000,
       "maxRatedInputW": 1125056781281449000,
       "inputDensityWPerM3": 14085533366144370000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 3789.0735755412134,
       "powerNode": "p33",
       "heatNode": "p33",
       "reactorId": 30,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 9,
       "coreModuleIndex": 9,
       "machineryModuleIndex": 42,
       "shaftModuleIndices": [],
       "shaftCapacityW": 146549357679631680,
       "ratedShaftCapacityW": 146549357679631680,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 466079961397021100
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 11250567812814488,
       "densityFactor": 41.42803931218933,
       "efficiency": 0.3144235725048154,
       "wasteFraction": 0.6855764274951845,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 6042803931.218934,
       "ratedShaftPowerW": 146549357679631680,
       "ratedWasteHeatW": 319539607954098800,
       "thermalStoreJ": 33751703438443468,
       "version": 1,
       "id": 34,
       "machineryId": 34,
       "coreId": 34,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 466088965633730500,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 77131240.88401666,
       "effectiveMachineryVolumeM3": 0.03308990533180732,
       "machineryVolumeM3": 0.03308990533180732,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.21,
       "machineryDiameterM": 0.42,
       "machineryOffsetM": 2.125,
       "maxInputW": 1125056781281449000,
       "maxRatedInputW": 1125056781281449000,
       "inputDensityWPerM3": 14085533366144370000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 3789.0735755412134,
       "powerNode": "p34",
       "heatNode": "p34",
       "reactorId": 30,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 10,
       "coreModuleIndex": 10,
       "machineryModuleIndex": 43,
       "shaftModuleIndices": [],
       "shaftCapacityW": 146549357679631680,
       "ratedShaftCapacityW": 146549357679631680,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 466079961397021100
      }
     ],
     "massKg": 25690.749366556323,
     "ratedThrustN": 308524963.53606665,
     "ratedAccelMps2": 12009.185062452789,
     "structuralAccelerationLimitMps2": 283122.5511884542,
     "inertialFactor": 1,
     "accelerationLimitMps2": 12009.185062452789
    },
    "profileVersion": 18,
    "heat": {
     "v": 3,
     "mode": "strict",
     "src": [
      {
       "k": "reactor",
       "id": "p30",
       "n": "核融合炉 #30",
       "g": "high",
       "sh": 1,
       "st": 41833944216593605000,
       "m": [
        6
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "shield",
       "id": "p39",
       "n": "シールド（艦首区画）",
       "g": "high",
       "sh": 1,
       "st": 299559942790439100000,
       "m": [
        15
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p31",
       "n": "右舷上機関 4L4 核融合推進機関 #31",
       "g": "high",
       "sh": 0.25,
       "st": 33751703438443468,
       "m": [
        7,
        40
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p32",
       "n": "右舷上機関 4L4 核融合推進機関 #32",
       "g": "high",
       "sh": 0.25,
       "st": 33751703438443468,
       "m": [
        8,
        41
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p33",
       "n": "右舷下機関 4L4 核融合推進機関 #33",
       "g": "high",
       "sh": 0.25,
       "st": 33751703438443468,
       "m": [
        9,
        42
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p34",
       "n": "右舷下機関 4L4 核融合推進機関 #34",
       "g": "high",
       "sh": 0.25,
       "st": 33751703438443468,
       "m": [
        10,
        43
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "feed",
       "id": "p-6000000",
       "n": "推進配電路 1",
       "g": "high",
       "sh": 0.246225,
       "st": 540254202562560,
       "m": [
        44
       ],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1,
       "routeId": "p30>p33"
      },
      {
       "k": "feed",
       "id": "p-6000001",
       "n": "推進配電路 2",
       "g": "high",
       "sh": 0.246225,
       "st": 540254202562560,
       "m": [
        45
       ],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1,
       "routeId": "p30>p34"
      },
      {
       "k": "feed",
       "id": "p-6000002",
       "n": "推進配電路 3",
       "g": "high",
       "sh": 0.253775,
       "st": 556818286360320,
       "m": [
        46
       ],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1,
       "routeId": "p30>p31"
      },
      {
       "k": "feed",
       "id": "p-6000003",
       "n": "推進配電路 4",
       "g": "high",
       "sh": 0.253775,
       "st": 556818286360320,
       "m": [
        47
       ],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1,
       "routeId": "p30>p32"
      },
      {
       "k": "weapon",
       "id": "f42",
       "n": "武装（艦首区画）",
       "g": "high",
       "sh": 1,
       "st": 42730000000000000,
       "m": [
        0,
        1,
        2,
        3,
        4,
        5
       ],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "hotel",
       "id": "hotel",
       "n": "生活・電子設備",
       "g": "low",
       "sh": 1,
       "st": 8026485701000127000,
       "m": [],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      }
     ],
     "dis": [
      {
       "id": "p77",
       "n": "機体内高エネルギー散逸装置 1 #77",
       "k": "hdis",
       "g": "high",
       "cap": 837920977354792100,
       "m": 31,
       "sec": 4,
       "src": -1,
       "power": 12568814660321880
      },
      {
       "id": "p78",
       "n": "機体内高エネルギー散逸装置 2 #78",
       "k": "hdis",
       "g": "high",
       "cap": 837921209174261400,
       "m": 32,
       "sec": 4,
       "src": -1,
       "power": 12568818137613920
      },
      {
       "id": "p79",
       "n": "機体内高エネルギー散逸装置 3 #79",
       "k": "hdis",
       "g": "high",
       "cap": 837921209174261200,
       "m": 33,
       "sec": 3,
       "src": -1,
       "power": 12568818137613918
      },
      {
       "id": "p80",
       "n": "機体内高エネルギー散逸装置 4 #80",
       "k": "hdis",
       "g": "high",
       "cap": 837921209174261400,
       "m": 34,
       "sec": 4,
       "src": -1,
       "power": 12568818137613920
      },
      {
       "id": "p81",
       "n": "機体内高エネルギー散逸装置 5 #81",
       "k": "hdis",
       "g": "high",
       "cap": 837921209174261200,
       "m": 35,
       "sec": 3,
       "src": -1,
       "power": 12568818137613918
      },
      {
       "id": "p82",
       "n": "機体内高エネルギー散逸装置 6 #82",
       "k": "hdis",
       "g": "high",
       "cap": 837921151219386000,
       "m": 36,
       "sec": 3,
       "src": -1,
       "power": 12568817268290790
      },
      {
       "id": "p83",
       "n": "機体内高エネルギー散逸装置 7 #83",
       "k": "hdis",
       "g": "high",
       "cap": 837921151219386100,
       "m": 37,
       "sec": 3,
       "src": -1,
       "power": 12568817268290792
      },
      {
       "id": "p84",
       "n": "機体内高エネルギー散逸装置 8 #84",
       "k": "hdis",
       "g": "high",
       "cap": 837920977354792100,
       "m": 38,
       "sec": 3,
       "src": -1,
       "power": 12568814660321880
      },
      {
       "id": "p85",
       "n": "機体内高エネルギー散逸装置 9 #85",
       "k": "hdis",
       "g": "high",
       "cap": 255106394284023600,
       "m": 39,
       "sec": 4,
       "src": -1,
       "power": 3826595914260354
      },
      {
       "id": "p2",
       "n": "右舷上翼（Sフォイル） #2",
       "k": "wing",
       "g": "high",
       "cap": 97577204545454540,
       "m": 48,
       "sec": 1,
       "src": -1,
       "fo": 0,
       "cs": 0.35,
       "sh": 0.6,
       "power": 975772045454545.5
      },
      {
       "id": "p3",
       "n": "右舷上翼（Sフォイル） #3",
       "k": "wing",
       "g": "high",
       "cap": 99957136363636370,
       "m": 49,
       "sec": 1,
       "src": -1,
       "fo": 1,
       "cs": 0.35,
       "sh": 0.6,
       "power": 999571363636363.8
      },
      {
       "id": "p16",
       "n": "右舷下翼（Sフォイル） #16",
       "k": "wing",
       "g": "high",
       "cap": 99957136363636370,
       "m": 50,
       "sec": 1,
       "src": -1,
       "fo": 2,
       "cs": 0.35,
       "sh": 0.6,
       "power": 999571363636363.8
      },
      {
       "id": "p17",
       "n": "右舷下翼（Sフォイル） #17",
       "k": "wing",
       "g": "high",
       "cap": 97577204545454540,
       "m": 51,
       "sec": 1,
       "src": -1,
       "fo": 3,
       "cs": 0.35,
       "sh": 0.6,
       "power": 975772045454545.5
      },
      {
       "id": "skin",
       "n": "外殻からの放熱",
       "k": "skin",
       "g": "low",
       "cap": 832110952195664200000,
       "m": -1,
       "sec": -1,
       "src": -1
      }
     ],
     "ln": [
      {
       "s": 0,
       "d": 0,
       "cap": 95340925012629120,
       "sec": 4
      },
      {
       "s": 0,
       "d": 1,
       "cap": 95340951389678080,
       "sec": 3
      },
      {
       "s": 0,
       "d": 2,
       "cap": 95340951389678060,
       "sec": 3
      },
      {
       "s": 0,
       "d": 3,
       "cap": 95340951389678080,
       "sec": 3
      },
      {
       "s": 0,
       "d": 4,
       "cap": 95340951389678060,
       "sec": 3
      },
      {
       "s": 0,
       "d": 5,
       "cap": 95340944795414930,
       "sec": 3
      },
      {
       "s": 0,
       "d": 6,
       "cap": 95340944795414940,
       "sec": 3
      },
      {
       "s": 0,
       "d": 7,
       "cap": 95340925012629120,
       "sec": 3
      },
      {
       "s": 0,
       "d": 8,
       "cap": 29026698537202100,
       "sec": 3
      },
      {
       "s": 0,
       "d": 9,
       "cap": 11102599401292996,
       "sec": 1
      },
      {
       "s": 0,
       "d": 10,
       "cap": 11373394508641606,
       "sec": 1
      },
      {
       "s": 0,
       "d": 11,
       "cap": 11373394508641606,
       "sec": 1
      },
      {
       "s": 0,
       "d": 12,
       "cap": 11102599401292996,
       "sec": 1
      },
      {
       "s": 1,
       "d": 0,
       "cap": 682684578315652500,
       "sec": 4
      },
      {
       "s": 1,
       "d": 1,
       "cap": 682684767187372900,
       "sec": 4
      },
      {
       "s": 1,
       "d": 2,
       "cap": 682684767187372900,
       "sec": 4
      },
      {
       "s": 1,
       "d": 3,
       "cap": 682684767187372900,
       "sec": 4
      },
      {
       "s": 1,
       "d": 4,
       "cap": 682684767187372900,
       "sec": 4
      },
      {
       "s": 1,
       "d": 5,
       "cap": 682684719969436300,
       "sec": 4
      },
      {
       "s": 1,
       "d": 6,
       "cap": 682684719969436400,
       "sec": 4
      },
      {
       "s": 1,
       "d": 7,
       "cap": 682684578315652500,
       "sec": 4
      },
      {
       "s": 1,
       "d": 8,
       "cap": 207844421985002660,
       "sec": 4
      },
      {
       "s": 1,
       "d": 9,
       "cap": 79499683787159730,
       "sec": 3
      },
      {
       "s": 1,
       "d": 10,
       "cap": 81438700464895340,
       "sec": 3
      },
      {
       "s": 1,
       "d": 11,
       "cap": 81438700464895340,
       "sec": 3
      },
      {
       "s": 1,
       "d": 12,
       "cap": 79499683787159730,
       "sec": 3
      },
      {
       "s": 2,
       "d": 0,
       "cap": 43692173992717624,
       "sec": 3
      },
      {
       "s": 2,
       "d": 1,
       "cap": 43692186080607600,
       "sec": 3
      },
      {
       "s": 2,
       "d": 2,
       "cap": 43692186080607590,
       "sec": 3
      },
      {
       "s": 2,
       "d": 3,
       "cap": 43692186080607600,
       "sec": 3
      },
      {
       "s": 2,
       "d": 4,
       "cap": 43692186080607590,
       "sec": 3
      },
      {
       "s": 2,
       "d": 5,
       "cap": 43692183058634690,
       "sec": 3
      },
      {
       "s": 2,
       "d": 6,
       "cap": 43692183058634696,
       "sec": 3
      },
      {
       "s": 2,
       "d": 7,
       "cap": 43692173992717624,
       "sec": 2
      },
      {
       "s": 2,
       "d": 8,
       "cap": 13302152908140984,
       "sec": 3
      },
      {
       "s": 2,
       "d": 9,
       "cap": 5088021799122242,
       "sec": 0
      },
      {
       "s": 2,
       "d": 10,
       "cap": 5212119891783760,
       "sec": 0
      },
      {
       "s": 2,
       "d": 11,
       "cap": 5212119891783760,
       "sec": 0
      },
      {
       "s": 2,
       "d": 12,
       "cap": 5088021799122242,
       "sec": 0
      },
      {
       "s": 3,
       "d": 0,
       "cap": 43692173992717624,
       "sec": 3
      },
      {
       "s": 3,
       "d": 1,
       "cap": 43692186080607600,
       "sec": 3
      },
      {
       "s": 3,
       "d": 2,
       "cap": 43692186080607590,
       "sec": 3
      },
      {
       "s": 3,
       "d": 3,
       "cap": 43692186080607600,
       "sec": 3
      },
      {
       "s": 3,
       "d": 4,
       "cap": 43692186080607590,
       "sec": 3
      },
      {
       "s": 3,
       "d": 5,
       "cap": 43692183058634690,
       "sec": 3
      },
      {
       "s": 3,
       "d": 6,
       "cap": 43692183058634696,
       "sec": 3
      },
      {
       "s": 3,
       "d": 7,
       "cap": 43692173992717624,
       "sec": 2
      },
      {
       "s": 3,
       "d": 8,
       "cap": 13302152908140984,
       "sec": 3
      },
      {
       "s": 3,
       "d": 9,
       "cap": 5088021799122242,
       "sec": 0
      },
      {
       "s": 3,
       "d": 10,
       "cap": 5212119891783760,
       "sec": 0
      },
      {
       "s": 3,
       "d": 11,
       "cap": 5212119891783760,
       "sec": 0
      },
      {
       "s": 3,
       "d": 12,
       "cap": 5088021799122242,
       "sec": 0
      },
      {
       "s": 4,
       "d": 0,
       "cap": 43692199872442120,
       "sec": 3
      },
      {
       "s": 4,
       "d": 1,
       "cap": 43692211960339260,
       "sec": 3
      },
      {
       "s": 4,
       "d": 2,
       "cap": 43692211960339256,
       "sec": 3
      },
      {
       "s": 4,
       "d": 3,
       "cap": 43692211960339260,
       "sec": 3
      },
      {
       "s": 4,
       "d": 4,
       "cap": 43692211960339256,
       "sec": 3
      },
      {
       "s": 4,
       "d": 5,
       "cap": 43692208938364550,
       "sec": 3
      },
      {
       "s": 4,
       "d": 6,
       "cap": 43692208938364570,
       "sec": 3
      },
      {
       "s": 4,
       "d": 7,
       "cap": 43692199872442120,
       "sec": 2
      },
      {
       "s": 4,
       "d": 8,
       "cap": 13302160787264890,
       "sec": 3
      },
      {
       "s": 4,
       "d": 9,
       "cap": 5088024812856519,
       "sec": 0
      },
      {
       "s": 4,
       "d": 10,
       "cap": 5212122979023752,
       "sec": 0
      },
      {
       "s": 4,
       "d": 11,
       "cap": 5212122979023752,
       "sec": 0
      },
      {
       "s": 4,
       "d": 12,
       "cap": 5088024812856519,
       "sec": 0
      },
      {
       "s": 5,
       "d": 0,
       "cap": 43692199872442120,
       "sec": 3
      },
      {
       "s": 5,
       "d": 1,
       "cap": 43692211960339260,
       "sec": 3
      },
      {
       "s": 5,
       "d": 2,
       "cap": 43692211960339256,
       "sec": 3
      },
      {
       "s": 5,
       "d": 3,
       "cap": 43692211960339260,
       "sec": 3
      },
      {
       "s": 5,
       "d": 4,
       "cap": 43692211960339256,
       "sec": 3
      },
      {
       "s": 5,
       "d": 5,
       "cap": 43692208938364550,
       "sec": 3
      },
      {
       "s": 5,
       "d": 6,
       "cap": 43692208938364570,
       "sec": 3
      },
      {
       "s": 5,
       "d": 7,
       "cap": 43692199872442120,
       "sec": 2
      },
      {
       "s": 5,
       "d": 8,
       "cap": 13302160787264890,
       "sec": 3
      },
      {
       "s": 5,
       "d": 9,
       "cap": 5088024812856519,
       "sec": 0
      },
      {
       "s": 5,
       "d": 10,
       "cap": 5212122979023752,
       "sec": 0
      },
      {
       "s": 5,
       "d": 11,
       "cap": 5212122979023752,
       "sec": 0
      },
      {
       "s": 5,
       "d": 12,
       "cap": 5088024812856519,
       "sec": 0
      },
      {
       "s": 6,
       "d": 0,
       "cap": 1231216727523.8638,
       "sec": 4
      },
      {
       "s": 6,
       "d": 1,
       "cap": 1231217068152.6536,
       "sec": 3
      },
      {
       "s": 6,
       "d": 2,
       "cap": 1231217068152.6533,
       "sec": 3
      },
      {
       "s": 6,
       "d": 3,
       "cap": 1231217068152.6536,
       "sec": 3
      },
      {
       "s": 6,
       "d": 4,
       "cap": 1231217068152.6533,
       "sec": 3
      },
      {
       "s": 6,
       "d": 5,
       "cap": 1231216982995.4443,
       "sec": 3
      },
      {
       "s": 6,
       "d": 6,
       "cap": 1231216982995.4446,
       "sec": 3
      },
      {
       "s": 6,
       "d": 7,
       "cap": 1231216727523.8638,
       "sec": 3
      },
      {
       "s": 6,
       "d": 8,
       "cap": 374845920354.3675,
       "sec": 3
      },
      {
       "s": 6,
       "d": 9,
       "cap": 143377107994.88934,
       "sec": 2
      },
      {
       "s": 6,
       "d": 10,
       "cap": 146874110628.91104,
       "sec": 2
      },
      {
       "s": 6,
       "d": 11,
       "cap": 146874110628.91104,
       "sec": 2
      },
      {
       "s": 6,
       "d": 12,
       "cap": 143377107994.88934,
       "sec": 2
      },
      {
       "s": 7,
       "d": 0,
       "cap": 1231216727523.8638,
       "sec": 4
      },
      {
       "s": 7,
       "d": 1,
       "cap": 1231217068152.6536,
       "sec": 3
      },
      {
       "s": 7,
       "d": 2,
       "cap": 1231217068152.6533,
       "sec": 3
      },
      {
       "s": 7,
       "d": 3,
       "cap": 1231217068152.6536,
       "sec": 3
      },
      {
       "s": 7,
       "d": 4,
       "cap": 1231217068152.6533,
       "sec": 3
      },
      {
       "s": 7,
       "d": 5,
       "cap": 1231216982995.4443,
       "sec": 3
      },
      {
       "s": 7,
       "d": 6,
       "cap": 1231216982995.4446,
       "sec": 3
      },
      {
       "s": 7,
       "d": 7,
       "cap": 1231216727523.8638,
       "sec": 3
      },
      {
       "s": 7,
       "d": 8,
       "cap": 374845920354.3675,
       "sec": 3
      },
      {
       "s": 7,
       "d": 9,
       "cap": 143377107994.88934,
       "sec": 2
      },
      {
       "s": 7,
       "d": 10,
       "cap": 146874110628.91104,
       "sec": 2
      },
      {
       "s": 7,
       "d": 11,
       "cap": 146874110628.91104,
       "sec": 2
      },
      {
       "s": 7,
       "d": 12,
       "cap": 143377107994.88934,
       "sec": 2
      },
      {
       "s": 8,
       "d": 0,
       "cap": 1268965581583.9998,
       "sec": 4
      },
      {
       "s": 8,
       "d": 1,
       "cap": 1268965932656.399,
       "sec": 3
      },
      {
       "s": 8,
       "d": 2,
       "cap": 1268965932656.3987,
       "sec": 3
      },
      {
       "s": 8,
       "d": 3,
       "cap": 1268965932656.399,
       "sec": 3
      },
      {
       "s": 8,
       "d": 4,
       "cap": 1268965932656.3987,
       "sec": 3
      },
      {
       "s": 8,
       "d": 5,
       "cap": 1268965844888.2869,
       "sec": 3
      },
      {
       "s": 8,
       "d": 6,
       "cap": 1268965844888.287,
       "sec": 3
      },
      {
       "s": 8,
       "d": 7,
       "cap": 1268965581583.9998,
       "sec": 3
      },
      {
       "s": 8,
       "d": 8,
       "cap": 386338619914.2182,
       "sec": 3
      },
      {
       "s": 8,
       "d": 9,
       "cap": 147773020919.29242,
       "sec": 2
      },
      {
       "s": 8,
       "d": 10,
       "cap": 151377240941.7142,
       "sec": 2
      },
      {
       "s": 8,
       "d": 11,
       "cap": 151377240941.7142,
       "sec": 2
      },
      {
       "s": 8,
       "d": 12,
       "cap": 147773020919.29242,
       "sec": 2
      },
      {
       "s": 9,
       "d": 0,
       "cap": 1268965581583.9998,
       "sec": 4
      },
      {
       "s": 9,
       "d": 1,
       "cap": 1268965932656.399,
       "sec": 3
      },
      {
       "s": 9,
       "d": 2,
       "cap": 1268965932656.3987,
       "sec": 3
      },
      {
       "s": 9,
       "d": 3,
       "cap": 1268965932656.399,
       "sec": 3
      },
      {
       "s": 9,
       "d": 4,
       "cap": 1268965932656.3987,
       "sec": 3
      },
      {
       "s": 9,
       "d": 5,
       "cap": 1268965844888.2869,
       "sec": 3
      },
      {
       "s": 9,
       "d": 6,
       "cap": 1268965844888.287,
       "sec": 3
      },
      {
       "s": 9,
       "d": 7,
       "cap": 1268965581583.9998,
       "sec": 3
      },
      {
       "s": 9,
       "d": 8,
       "cap": 386338619914.2182,
       "sec": 3
      },
      {
       "s": 9,
       "d": 9,
       "cap": 147773020919.29242,
       "sec": 2
      },
      {
       "s": 9,
       "d": 10,
       "cap": 151377240941.7142,
       "sec": 2
      },
      {
       "s": 9,
       "d": 11,
       "cap": 151377240941.7142,
       "sec": 2
      },
      {
       "s": 9,
       "d": 12,
       "cap": 147773020919.29242,
       "sec": 2
      },
      {
       "s": 10,
       "d": 0,
       "cap": 97379882502631,
       "sec": 4
      },
      {
       "s": 10,
       "d": 1,
       "cap": 97379909443778.56,
       "sec": 4
      },
      {
       "s": 10,
       "d": 2,
       "cap": 97379909443778.53,
       "sec": 4
      },
      {
       "s": 10,
       "d": 3,
       "cap": 97379909443778.56,
       "sec": 4
      },
      {
       "s": 10,
       "d": 4,
       "cap": 97379909443778.53,
       "sec": 4
      },
      {
       "s": 10,
       "d": 5,
       "cap": 97379902708490.75,
       "sec": 4
      },
      {
       "s": 10,
       "d": 6,
       "cap": 97379902708490.75,
       "sec": 4
      },
      {
       "s": 10,
       "d": 7,
       "cap": 97379882502631,
       "sec": 4
      },
      {
       "s": 10,
       "d": 8,
       "cap": 29647462436698.727,
       "sec": 4
      },
      {
       "s": 10,
       "d": 9,
       "cap": 11340039180745.086,
       "sec": 3
      },
      {
       "s": 10,
       "d": 10,
       "cap": 11616625502226.672,
       "sec": 3
      },
      {
       "s": 10,
       "d": 11,
       "cap": 11616625502226.672,
       "sec": 3
      },
      {
       "s": 10,
       "d": 12,
       "cap": 11340039180745.086,
       "sec": 3
      },
      {
       "s": 11,
       "d": 8,
       "cap": 200662142525003200,
       "sec": 4
      },
      {
       "s": 11,
       "d": 4,
       "cap": 200662142525003200,
       "sec": 4
      },
      {
       "s": 11,
       "d": 1,
       "cap": 200662142525003200,
       "sec": 4
      },
      {
       "s": 11,
       "d": 2,
       "cap": 200662142525003200,
       "sec": 4
      },
      {
       "s": 11,
       "d": 5,
       "cap": 200662142525003200,
       "sec": 4
      },
      {
       "s": 11,
       "d": 6,
       "cap": 200662142525003200,
       "sec": 4
      },
      {
       "s": 11,
       "d": 3,
       "cap": 200662142525003200,
       "sec": 4
      },
      {
       "s": 11,
       "d": 0,
       "cap": 200662142525003200,
       "sec": 4
      },
      {
       "s": 11,
       "d": 7,
       "cap": 200662142525003200,
       "sec": 4
      },
      {
       "s": 11,
       "d": 11,
       "cap": 200662142525003200,
       "sec": 3
      },
      {
       "s": 11,
       "d": 12,
       "cap": 200662142525003200,
       "sec": 3
      },
      {
       "s": 11,
       "d": 9,
       "cap": 200662142525003200,
       "sec": 3
      },
      {
       "s": 11,
       "d": 10,
       "cap": 200662142525003200,
       "sec": 3
      },
      {
       "s": 11,
       "d": 13,
       "cap": 832110952195664200000,
       "sec": -1
      }
     ]
    },
    "speedReference": {
     "version": 1,
     "key": "xwing",
     "status": "published",
     "mglt": 100,
     "model": "T-65B X-wing starfighter",
     "scope": "class",
     "continuity": "canon",
     "source": "https://starwars.fandom.com/wiki/Megalight_per_hour"
    },
    "mglt": 100,
    "maxSpeed": 2000
   },
   "fireArcs": [
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      0.9945218953682733,
      -0.10452846326765346
     ],
     "pos": [
      9,
      3.5535027282027682,
      5.46229943555451
     ],
     "k": "claser",
     "gun": 0.25,
     "aa": 0.25,
     "cycle": 0.12
    },
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      0.9945218953682733,
      0.10452846326765346
     ],
     "pos": [
      9,
      3.5535027281631053,
      -5.462299435558679
     ],
     "k": "claser",
     "gun": 0.25,
     "aa": 0.25,
     "cycle": 0.12
    },
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      -0.9945218953682733,
      -0.10452846326765346
     ],
     "pos": [
      9,
      0.11049733504975812,
      5.462299442202618
     ],
     "k": "claser",
     "gun": 0.25,
     "aa": 0.25,
     "cycle": 0.12
    },
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      -0.9945218953682733,
      0.10452846326765346
     ],
     "pos": [
      9,
      0.11049733507103976,
      -5.462299442204855
     ],
     "k": "claser",
     "gun": 0.25,
     "aa": 0.25,
     "cycle": 0.12
    }
   ]
  },
  "z95": {
   "reference": "craft_z95",
   "signature": "qnqhu2",
   "build": 134729,
   "crew": 1000,
   "total": 135729,
   "by": {
    "hull": 20,
    "armor": 10,
    "power": 45618,
    "drive": 34279,
    "defense": 1500,
    "command": 14501,
    "weapons": 21800,
    "systems": 17001,
    "crew": 1000
   },
   "detailed": true,
   "systems": {
    "v": 1,
    "managed": true,
    "power": 16160168900000000,
    "crew": 1,
    "suitSeats": 0,
    "lifeSupportCapacity": 1,
    "lifeSupportHours": 12.15672,
    "ejectionSeats": 1,
    "ejectionCoverage": 1,
    "ejectionSurvival": 0.9,
    "navCapacity": 1.331,
    "navReady": true,
    "targetDemand": 4,
    "targetCapacity": 4.920750000000001,
    "targetRatio": 1,
    "fireK": 1,
    "maneuverSupport": 27.436000000000003,
    "maneuverRatio": 1,
    "turnK": 1,
    "laserUnits": 2,
    "laserGunShare": 1,
    "laserAaShare": 1,
    "laserGasSeconds": 658.5600000000002,
    "landingSupport": 24.3,
    "landingRatio": 1,
    "landingReady": true
   },
   "heat": {
    "up": 0.00000334,
    "upS": 0.00000334,
    "down": 0.452,
    "T": 0
   },
   "powerProfile": {
    "name": "Z-95 ヘッドハンター",
    "modules": [
     {
      "k": "weapon",
      "fit": 29,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.31,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": 0.01,
      "z": 0.96,
      "r": 0.078,
      "share": 0.5,
      "domain": "main",
      "port": "f29",
      "powerConnected": true
     },
     {
      "k": "weapon",
      "fit": 30,
      "name": "レーザー砲",
      "w": 0.9984000000000001,
      "hits": 1,
      "crew": 0,
      "size": 1.000000002,
      "weaponPowerW": 69733333333333.34,
      "stock": 0,
      "at": 0.31,
      "pd": false,
      "dualPurpose": false,
      "band": "close",
      "y": 0.01,
      "z": -0.96,
      "r": 0.078,
      "share": 0.5,
      "domain": "main",
      "port": "f30",
      "powerConnected": true
     },
     {
      "k": "launcher",
      "fit": 31,
      "name": "ミサイル発射管",
      "w": 1.0368000000000002,
      "hits": 1,
      "crew": 0,
      "size": 1,
      "stock": 6,
      "mount": "ext",
      "missileKind": "cmsl",
      "launcherCells": 1,
      "ammoPerCell": 6,
      "missileRange": 10000,
      "launchMuzzles": [
       [
        -3.1668062194362285,
        -0.9650000184774398,
        0.699
       ],
       [
        -3.1668062194362285,
        -0.9650000184774398,
        0.501
       ]
      ],
      "launchBlocked": false,
      "salvo": 1,
      "cycle": 1.2,
      "tt": 25,
      "ammo0": 6,
      "muzzle": [
       -3.1668062194362285,
       -0.9650000184774398,
       0.6
      ],
      "launchDir": [
       1,
       0,
       0
      ],
      "launchPowerW": 1000000000000000,
      "at": 0.274,
      "pd": false,
      "dualPurpose": false,
      "y": -0.62,
      "z": 0.07,
      "r": 0.036,
      "share": 0.5,
      "domain": "main",
      "port": "f31",
      "powerConnected": true
     },
     {
      "k": "launcher",
      "fit": 32,
      "name": "ミサイル発射管",
      "w": 1.0368000000000002,
      "hits": 1,
      "crew": 0,
      "size": 1,
      "stock": 6,
      "mount": "ext",
      "missileKind": "cmsl",
      "launcherCells": 1,
      "ammoPerCell": 6,
      "missileRange": 10000,
      "launchMuzzles": [
       [
        -3.1668062194362285,
        -0.9650000184774398,
        -0.501
       ],
       [
        -3.1668062194362285,
        -0.9650000184774398,
        -0.699
       ]
      ],
      "launchBlocked": false,
      "salvo": 1,
      "cycle": 1.2,
      "tt": 25,
      "ammo0": 6,
      "muzzle": [
       -3.1668062194362285,
       -0.9650000184774398,
       -0.6
      ],
      "launchDir": [
       1,
       0,
       0
      ],
      "launchPowerW": 1000000000000000,
      "at": 0.274,
      "pd": false,
      "dualPurpose": false,
      "y": -0.62,
      "z": -0.07,
      "r": 0.036,
      "share": 0.5,
      "domain": "main",
      "port": "f32",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "右舷ナセル核融合炉",
      "w": 0.6758745473575788,
      "hits": 1,
      "crew": 0.0002778236047275598,
      "size": 0.5556472094551196,
      "at": 0.355,
      "part": 21,
      "y": -0.22,
      "z": 0.34,
      "r": 0.025,
      "share": 0.5,
      "domain": "main",
      "port": "p21",
      "powerConnected": true
     },
     {
      "k": "reactor",
      "name": "右舷ナセル核融合炉",
      "w": 0.6758745473575788,
      "hits": 1,
      "crew": 0.0002778236047275598,
      "size": 0.5556472094551196,
      "at": 0.355,
      "part": 22,
      "y": -0.22,
      "z": -0.34,
      "r": 0.025,
      "share": 0.5,
      "domain": "main",
      "port": "p22",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "右舷主推進機関",
      "w": 1.4926640711148789,
      "hits": 1,
      "crew": 0.0007294627345188127,
      "size": 1.8236568362970318,
      "at": 0.12,
      "part": 23,
      "y": -0.22,
      "z": 0.34,
      "r": 0.037,
      "share": 0.48585560719429843,
      "domain": "main",
      "port": "p23",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "右舷主推進機関",
      "w": 1.4926640711148789,
      "hits": 1,
      "crew": 0.0007294627345188127,
      "size": 1.8236568362970318,
      "at": 0.12,
      "part": 24,
      "y": -0.22,
      "z": -0.34,
      "r": 0.037,
      "share": 0.48585560719429843,
      "domain": "main",
      "port": "p24",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "操縦席",
      "w": 0.649629514953459,
      "hits": 1,
      "crew": 0,
      "size": 0.5235987755982988,
      "at": 0.45,
      "part": 25,
      "y": -0.03,
      "z": 0,
      "r": 0.024,
      "share": 0.5998240449076012,
      "domain": "main",
      "port": "p25",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "慣性補償装置",
      "w": 0.20321616979895832,
      "hits": 1,
      "crew": 0.000018321768355735675,
      "size": 0.09160884177867837,
      "at": 0.262,
      "part": 26,
      "y": -0.03,
      "z": 0,
      "r": 0.013,
      "share": 0.10494521489703393,
      "domain": "main",
      "port": "p26",
      "powerConnected": true
     },
     {
      "k": "fuel",
      "name": "反応物タンク",
      "w": 0.07661299323322698,
      "hits": 1,
      "crew": 0.000004241150082346221,
      "size": 0.021205750411731103,
      "at": 0.184,
      "part": 27,
      "y": -0.07,
      "z": 0,
      "r": 0.008,
      "share": 1,
      "domain": "main",
      "port": "p27",
      "powerConnected": true
     },
     {
      "k": "battery",
      "name": "パワーセル",
      "w": 0.16000000000000003,
      "hits": 1,
      "crew": 0.000012800000000000005,
      "size": 0.06400000000000002,
      "at": 0.609,
      "part": 28,
      "y": -0.24,
      "z": 0,
      "r": 0.012,
      "share": 1,
      "domain": "main",
      "port": "p28",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "生命維持装置",
      "w": 0.13690000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.050653,
      "at": 0.519,
      "part": 33,
      "y": -0.19,
      "z": 0,
      "r": 0.011,
      "share": 0.058027040479587094,
      "domain": "main",
      "port": "p33",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "射出座席機構 1",
      "w": 0.08410000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.024388999999999997,
      "at": 0.426,
      "part": 34,
      "y": -0.44,
      "z": -0.05,
      "r": 0.009,
      "share": 0.027939539420303822,
      "domain": "main",
      "port": "p34",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "航法コンピューター",
      "w": 0.048400000000000006,
      "hits": 1,
      "crew": 0,
      "size": 0.010648,
      "at": 0.501,
      "part": 35,
      "y": -0.19,
      "z": 0,
      "r": 0.007,
      "share": 0.012198130950321667,
      "domain": "main",
      "port": "p35",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "照準コンピューター",
      "w": 0.07290000000000002,
      "hits": 1,
      "crew": 0,
      "size": 0.019683000000000003,
      "at": 0.519,
      "part": 36,
      "y": -0.19,
      "z": -0.05,
      "r": 0.008,
      "share": 0.02254844210135062,
      "domain": "main",
      "port": "p36",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 1",
      "w": 0.03610000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.0068590000000000005,
      "at": 0.519,
      "part": 37,
      "y": -0.42,
      "z": 0,
      "r": 0.006,
      "share": 0.007857530070272007,
      "domain": "main",
      "port": "p37",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 2",
      "w": 0.03610000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.0068590000000000005,
      "at": 0.519,
      "part": 38,
      "y": -0.19,
      "z": 0.03,
      "r": 0.006,
      "share": 0.007857530070272007,
      "domain": "main",
      "port": "p38",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 3",
      "w": 0.03610000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.0068590000000000005,
      "at": 0.519,
      "part": 39,
      "y": 0.03,
      "z": 0,
      "r": 0.006,
      "share": 0.007857530070272007,
      "domain": "main",
      "port": "p39",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "姿勢制御スラスター 4",
      "w": 0.03610000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.0068590000000000005,
      "at": 0.535,
      "part": 40,
      "y": -0.19,
      "z": 0,
      "r": 0.006,
      "share": 0.007857530070272007,
      "domain": "main",
      "port": "p40",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 1",
      "w": 0.07840000000000003,
      "hits": 1,
      "crew": 0,
      "size": 0.021952000000000006,
      "at": 0.496,
      "part": 41,
      "y": -0.36,
      "z": 0,
      "r": 0.008,
      "share": 0.02514776207940095,
      "domain": "main",
      "port": "p41",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "レーザーガス供給槽 2",
      "w": 0.07840000000000003,
      "hits": 1,
      "crew": 0,
      "size": 0.021952000000000006,
      "at": 0.496,
      "part": 42,
      "y": -0.19,
      "z": -0.02,
      "r": 0.008,
      "share": 0.02514776207940095,
      "domain": "main",
      "port": "p42",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 1",
      "w": 0.09000000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.027,
      "at": 0.519,
      "part": 43,
      "y": -0.19,
      "z": 0.05,
      "r": 0.009,
      "share": 0.030930647601304,
      "domain": "main",
      "port": "p43",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 2",
      "w": 0.09000000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.027,
      "at": 0.519,
      "part": 44,
      "y": 0.16,
      "z": 0,
      "r": 0.009,
      "share": 0.030930647601304,
      "domain": "main",
      "port": "p44",
      "powerConnected": true
     },
     {
      "k": "other",
      "name": "着陸脚機構 3",
      "w": 0.09000000000000001,
      "hits": 1,
      "crew": 0,
      "size": 0.027,
      "at": 0.544,
      "part": 45,
      "y": -0.19,
      "z": 0,
      "r": 0.009,
      "share": 0.030930647601304,
      "domain": "main",
      "port": "p45",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "機体内高エネルギー散逸装置 1",
      "w": 0.16483078766550108,
      "hits": 1,
      "crew": 0.0000033460120856692135,
      "size": 0.06692024171338427,
      "at": 0.488,
      "part": 46,
      "y": -0.19,
      "z": 0.06,
      "r": 0.012,
      "share": 0.029365445029873708,
      "domain": "main",
      "port": "p46",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.1412581363829774,
      "hits": 1,
      "crew": 0.000010618182955362165,
      "size": 0.05309091477681082,
      "at": 0.25,
      "part": -23,
      "machineryOwner": 23,
      "y": -0.22,
      "z": 0.34,
      "r": 0.011,
      "share": 0.014144392805701542,
      "domain": "main",
      "port": "p23",
      "powerConnected": true
     },
     {
      "k": "engine",
      "name": "自動推進機関",
      "w": 0.1412581363829774,
      "hits": 1,
      "crew": 0.000010618182955362165,
      "size": 0.05309091477681082,
      "at": 0.25,
      "part": -24,
      "machineryOwner": 24,
      "y": -0.22,
      "z": -0.34,
      "r": 0.011,
      "share": 0.014144392805701542,
      "domain": "main",
      "port": "p24",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p21 → p23",
      "w": 0.008165132537169948,
      "hits": 1,
      "crew": 1.4756210898618561e-7,
      "size": 0.0007378105449309281,
      "at": 0.287,
      "part": -6000000,
      "routeId": "p21>p23",
      "capacityW": 582047870031369100,
      "y": -0.22,
      "z": 0.34,
      "r": 0.003,
      "share": 0.18223137911506068,
      "domain": "main",
      "port": "p-6000000",
      "powerConnected": true
     },
     {
      "k": "conduit",
      "name": "推進電力伝達路 p21 → p24",
      "w": 0.02221440874766137,
      "hits": 1,
      "crew": 6.621892615119494e-7,
      "size": 0.0033109463075597467,
      "at": 0.288,
      "part": -6000001,
      "routeId": "p21>p24",
      "capacityW": 582047870031369100,
      "y": -0.23,
      "z": -0.01,
      "r": 0.004,
      "share": 0.8177686208849393,
      "domain": "main",
      "port": "p-6000001",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "右舷主翼",
      "w": 2.272601975805852,
      "hits": 1,
      "crew": 0,
      "size": 1.1059784588604271,
      "at": 0.283,
      "part": 7,
      "ext": 1,
      "y": -0.22,
      "z": 0.53,
      "r": 0.031,
      "share": 0.48531727929181545,
      "domain": "main",
      "port": "p7",
      "powerConnected": true
     },
     {
      "k": "dissipator",
      "name": "右舷主翼",
      "w": 2.2726019645251796,
      "hits": 1,
      "crew": 0,
      "size": 1.105978450625694,
      "at": 0.283,
      "part": 8,
      "ext": 1,
      "y": -0.22,
      "z": -0.53,
      "r": 0.031,
      "share": 0.48531727567831084,
      "domain": "main",
      "port": "p8",
      "powerConnected": true
     },
     {
      "k": "quarters",
      "name": "居住空間（後部）",
      "w": 0.9045777083436533,
      "hits": 1,
      "crew": 0,
      "size": 14.809211415920084,
      "at": 0.175,
      "y": -0.1,
      "z": 0,
      "r": 0.073,
      "share": 0.35084355828220853,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央後部）",
      "w": 1.1758130558017204,
      "hits": 1,
      "crew": 0,
      "size": 21.94676577047829,
      "at": 0.345,
      "y": -0.14,
      "z": 0,
      "r": 0.084,
      "share": 0.5199386503067485,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（中央前部）",
      "w": 0.396965632867113,
      "hits": 1,
      "crew": 0,
      "size": 4.305191515447806,
      "at": 0.592,
      "y": -0.22,
      "z": 0,
      "r": 0.049,
      "share": 0.10199386503067484,
      "domain": "main"
     },
     {
      "k": "quarters",
      "name": "居住空間（前部）",
      "w": 0.16456496594989228,
      "hits": 1,
      "crew": 0,
      "size": 1.1491300661533617,
      "at": 0.828,
      "y": -0.22,
      "z": 0,
      "r": 0.031,
      "share": 0.027223926380368094,
      "domain": "main"
     },
     {
      "k": "hull",
      "name": "船体構造",
      "w": 10.845172691964152,
      "hits": null,
      "crew": 0,
      "size": 1,
      "share": 1,
      "domain": "main"
     }
    ],
    "energyModel": {
     "version": 0,
     "eta": 0.75
    },
    "D": 0,
    "shieldBuffer": 0,
    "wCap": 0,
    "crewNeed": 1,
    "crewMax": 1,
    "hp": 1,
    "len": 16.72238710336387,
    "width": 16.6200008392334,
    "height": 2.38000003695488,
    "grid": {
     "P": 5819852996623119000,
     "fixed": 37061846719279704,
     "cooling": 12847704127223294,
     "De": 1164095740062738200,
     "Ds": 0,
     "Dw": 139466666666666.69,
     "domains": [
      {
       "id": "main",
       "P": 5819852996623119000,
       "reactors": [
        4,
        5
       ],
       "sources": [
        {
         "moduleIndex": 4,
         "P": 2909926498311559700
        },
        {
         "moduleIndex": 5,
         "P": 2909926498311559700
        }
       ],
       "modules": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36
       ],
       "protection": 1
      }
     ],
     "powerPaths": [
      {
       "kind": "power",
       "from": "p21",
       "to": "hotel",
       "cap": 37061846719279704,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "p7",
       "cap": 1166928750000000,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p22",
       "to": "p8",
       "cap": 1166928750000000,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "p25",
       "cap": 2058991484404428,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "p26",
       "cap": 2058991484404428,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "p27",
       "cap": 2058991484404428,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "p28",
       "cap": 2058991484404428,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "p33",
       "cap": 2058991484404428,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p22",
       "to": "p34",
       "cap": 2058991484404428,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "p35",
       "cap": 2058991484404428,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p22",
       "to": "p36",
       "cap": 2058991484404428,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "p37",
       "cap": 2058991484404428,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "p38",
       "cap": 2058991484404428,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "p39",
       "cap": 2058991484404428,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "p40",
       "cap": 2058991484404428,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "p41",
       "cap": 2058991484404428,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p22",
       "to": "p42",
       "cap": 2058991484404428,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "p43",
       "cap": 2058991484404428,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "p44",
       "cap": 2058991484404428,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "p45",
       "cap": 2058991484404428,
       "auto": true,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "f29",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "f30",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "f31",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "f32",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p22",
       "to": "f29",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p22",
       "to": "f30",
       "cap": 104600000000000.02,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p22",
       "to": "f31",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p22",
       "to": "f32",
       "cap": 1500000000000000,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "p46",
       "cap": 10513846627223294,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p22",
       "to": "p46",
       "cap": 10513846627223294,
       "auto": false,
       "ok": true
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "p-6000000",
       "cap": 582047870031369100,
       "auto": false,
       "ok": true,
       "capacityGroup": "p21>p23",
       "groupCap": 582047870031369100,
       "physical": true,
       "routeId": "p21>p23",
       "efficiency": 0.9999873239658342
      },
      {
       "kind": "power",
       "from": "p-6000000",
       "to": "p23",
       "cap": 582047870031369100,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p21>p23",
       "efficiency": 1
      },
      {
       "kind": "power",
       "from": "p21",
       "to": "p-6000001",
       "cap": 582047870031369100,
       "auto": false,
       "ok": true,
       "capacityGroup": "p21>p24",
       "groupCap": 582047870031369100,
       "physical": true,
       "routeId": "p21>p24",
       "efficiency": 0.9999431171848715
      },
      {
       "kind": "power",
       "from": "p-6000001",
       "to": "p24",
       "cap": 582047870031369100,
       "auto": false,
       "ok": true,
       "physical": true,
       "routeId": "p21>p24",
       "efficiency": 1
      }
     ],
     "trunks": [
      {
       "port": "p-6000000",
       "moduleIndex": 28
      },
      {
       "port": "p-6000001",
       "moduleIndex": 29
      }
     ],
     "fixedLoads": [
      {
       "id": "hotel",
       "port": "hotel",
       "weight": 22214142592056410,
       "domain": "main"
      },
      {
       "id": "f31",
       "port": "f31",
       "domain": "main",
       "weight": 1000000000000000
      },
      {
       "id": "f32",
       "port": "f32",
       "domain": "main",
       "weight": 1000000000000000
      }
     ],
     "coolingLoads": [
      {
       "id": "p46",
       "port": "p46",
       "weight": 10513846627223294,
       "domain": "main"
      },
      {
       "id": "p7",
       "port": "p7",
       "weight": 1166928750000000,
       "domain": "main"
      },
      {
       "id": "p8",
       "port": "p8",
       "weight": 1166928750000000,
       "domain": "main"
      }
     ]
    },
    "propulsion": {
     "version": 1,
     "architectureVersion": 2,
     "cores": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 18050911024115684,
       "densityFactor": 32.24479192511469,
       "efficiency": 0.3707693852629001,
       "wasteFraction": 0.6292306147370998,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 5124479192.511469,
       "ratedShaftPowerW": 215805530965111100,
       "ratedWasteHeatW": 366242339066258000,
       "thermalStoreJ": 54152733072347060,
       "version": 1,
       "id": 23,
       "machineryId": 23,
       "coreId": 23,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 582047870031369100,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 113581858.40269005,
       "effectiveMachineryVolumeM3": 0.05309091477681084,
       "machineryVolumeM3": 0.05309091477681084,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.26599999999999996,
       "machineryDiameterM": 0.5319999999999999,
       "machineryOffsetM": 2.0100000000000002,
       "maxInputW": 1805091102411568600,
       "maxRatedInputW": 1805091102411568600,
       "inputDensityWPerM3": 10963229254538992000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 3632.126494327088,
       "powerNode": "p23",
       "heatNode": "p23",
       "reactorId": 21,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 6,
       "machineryModuleIndex": 26,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 582040491972682500,
       "transmissionRouteIds": [
        "p21>p23"
       ]
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 18050911024115684,
       "densityFactor": 32.24479192511469,
       "efficiency": 0.3707693852629001,
       "wasteFraction": 0.6292306147370998,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 5124479192.511469,
       "ratedShaftPowerW": 215805530965111100,
       "ratedWasteHeatW": 366242339066258000,
       "thermalStoreJ": 54152733072347060,
       "version": 1,
       "id": 24,
       "machineryId": 24,
       "coreId": 24,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 582047870031369100,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 113581858.40269005,
       "effectiveMachineryVolumeM3": 0.05309091477681084,
       "machineryVolumeM3": 0.05309091477681084,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.26599999999999996,
       "machineryDiameterM": 0.5319999999999999,
       "machineryOffsetM": 2.0100000000000002,
       "maxInputW": 1805091102411568600,
       "maxRatedInputW": 1805091102411568600,
       "inputDensityWPerM3": 10963229254538992000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 3632.126494327088,
       "powerNode": "p24",
       "heatNode": "p24",
       "reactorId": 22,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 7,
       "machineryModuleIndex": 27,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 582014761509982200,
       "transmissionRouteIds": [
        "p21>p24"
       ]
      }
     ],
     "engines": [
      {
       "thermalModelVersion": 1,
       "normalInputW": 18050911024115684,
       "densityFactor": 32.24479192511469,
       "efficiency": 0.3707693852629001,
       "wasteFraction": 0.6292306147370998,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 5124479192.511469,
       "ratedShaftPowerW": 215805530965111100,
       "ratedWasteHeatW": 366242339066258000,
       "thermalStoreJ": 54152733072347060,
       "version": 1,
       "id": 23,
       "machineryId": 23,
       "coreId": 23,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 582047870031369100,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 113581858.40269005,
       "effectiveMachineryVolumeM3": 0.05309091477681084,
       "machineryVolumeM3": 0.05309091477681084,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.26599999999999996,
       "machineryDiameterM": 0.5319999999999999,
       "machineryOffsetM": 2.0100000000000002,
       "maxInputW": 1805091102411568600,
       "maxRatedInputW": 1805091102411568600,
       "inputDensityWPerM3": 10963229254538992000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 3632.126494327088,
       "powerNode": "p23",
       "heatNode": "p23",
       "reactorId": 21,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 6,
       "coreModuleIndex": 6,
       "machineryModuleIndex": 26,
       "shaftModuleIndices": [],
       "shaftCapacityW": 215805530965111100,
       "ratedShaftCapacityW": 215805530965111100,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 582040491972682500
      },
      {
       "thermalModelVersion": 1,
       "normalInputW": 18050911024115684,
       "densityFactor": 32.24479192511469,
       "efficiency": 0.3707693852629001,
       "wasteFraction": 0.6292306147370998,
       "profileWattsPerNewton": 2000000000,
       "shaftWattsPerNewton": 1900000000,
       "wattsPerNewton": 5124479192.511469,
       "ratedShaftPowerW": 215805530965111100,
       "ratedWasteHeatW": 366242339066258000,
       "thermalStoreJ": 54152733072347060,
       "version": 1,
       "id": 24,
       "machineryId": 24,
       "coreId": 24,
       "entityKind": "engine",
       "integrated": true,
       "legacyShared": false,
       "ratedInputW": 582047870031369100,
       "driveProfileId": "standard",
       "machineryGradeId": "advanced",
       "ratedThrustN": 113581858.40269005,
       "effectiveMachineryVolumeM3": 0.05309091477681084,
       "machineryVolumeM3": 0.05309091477681084,
       "machineryShape": "frustum",
       "machineryLengthM": 0.3,
       "machineryRadiusM": 0.26599999999999996,
       "machineryDiameterM": 0.5319999999999999,
       "machineryOffsetM": 2.0100000000000002,
       "maxInputW": 1805091102411568600,
       "maxRatedInputW": 1805091102411568600,
       "inputDensityWPerM3": 10963229254538992000,
       "allowedInputDensityWPerM3": 34000000000000000000,
       "cost": 3632.126494327088,
       "powerNode": "p24",
       "heatNode": "p24",
       "reactorId": 22,
       "domain": "main",
       "direction": [
        1,
        0,
        0
       ],
       "legacyCoolingInputW": 0,
       "valid": true,
       "issues": [],
       "reasons": [],
       "moduleIndex": 7,
       "coreModuleIndex": 7,
       "machineryModuleIndex": 27,
       "shaftModuleIndices": [],
       "shaftCapacityW": 215805530965111100,
       "ratedShaftCapacityW": 215805530965111100,
       "shaftRouteId": null,
       "available": true,
       "connected": true,
       "outletAvailable": true,
       "pathCapacityW": 582014761509982200
      }
     ],
     "massKg": 17823.53748909211,
     "ratedThrustN": 227163716.8053801,
     "ratedAccelMps2": 12745.15325279299,
     "structuralAccelerationLimitMps2": 974858.6088782517,
     "inertialFactor": 1,
     "accelerationLimitMps2": 12745.15325279299
    },
    "profileVersion": 18,
    "heat": {
     "v": 3,
     "mode": "strict",
     "src": [
      {
       "k": "reactor",
       "id": "p21",
       "n": "右舷ナセル核融合炉 #21",
       "g": "high",
       "sh": 0.999029,
       "st": 2880312299276842500,
       "m": [
        4
       ],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "reactor",
       "id": "p22",
       "n": "右舷ナセル核融合炉 #22",
       "g": "high",
       "sh": 0.000971391,
       "st": 2800629000000000,
       "m": [
        5
       ],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p23",
       "n": "右舷主推進機関 #23",
       "g": "high",
       "sh": 0.500011,
       "st": 54152733072347060,
       "m": [
        6,
        26
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "engine",
       "id": "p24",
       "n": "右舷主推進機関 #24",
       "g": "high",
       "sh": 0.499989,
       "st": 54152733072347060,
       "m": [
        7,
        27
       ],
       "pc": [],
       "sec": 0,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "feed",
       "id": "p-6000000",
       "n": "推進配電路 1",
       "g": "high",
       "sh": 0.182235,
       "st": 442683521195520,
       "m": [
        28
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1,
       "routeId": "p21>p23"
      },
      {
       "k": "feed",
       "id": "p-6000001",
       "n": "推進配電路 2",
       "g": "high",
       "sh": 0.817765,
       "st": 1986511283220480,
       "m": [
        29
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1,
       "routeId": "p21>p24"
      },
      {
       "k": "weapon",
       "id": "f29",
       "n": "武装（前部区画）",
       "g": "high",
       "sh": 0.0651876,
       "st": 170465536582325.88,
       "m": [
        0,
        1
       ],
       "pc": [],
       "sec": 3,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "weapon",
       "id": "f31",
       "n": "武装（中央区画）",
       "g": "high",
       "sh": 0.934812,
       "st": 2444534463417674.5,
       "m": [
        2,
        3
       ],
       "pc": [],
       "sec": 2,
       "sw": -1,
       "gen": -1
      },
      {
       "k": "hotel",
       "id": "hotel",
       "n": "生活・電子設備",
       "g": "low",
       "sh": 1,
       "st": 2223710803156782300,
       "m": [],
       "pc": [],
       "sec": 4,
       "sw": -1,
       "gen": -1
      }
     ],
     "dis": [
      {
       "id": "p46",
       "n": "機体内高エネルギー散逸装置 1 #46",
       "k": "hdis",
       "g": "high",
       "cap": 700923108481552900,
       "m": 25,
       "sec": 4,
       "src": -1,
       "power": 10513846627223294
      },
      {
       "id": "p7",
       "n": "右舷主翼 #7",
       "k": "wing",
       "g": "high",
       "cap": 116692875000000000,
       "m": 30,
       "sec": 2,
       "src": -1,
       "power": 1166928750000000
      },
      {
       "id": "p8",
       "n": "右舷主翼 #8",
       "k": "wing",
       "g": "high",
       "cap": 116692875000000000,
       "m": 31,
       "sec": 2,
       "src": -1,
       "power": 1166928750000000
      },
      {
       "id": "skin",
       "n": "外殻からの放熱",
       "k": "skin",
       "g": "low",
       "cap": 673591481530581500000,
       "m": -1,
       "sec": -1,
       "src": -1
      }
     ],
     "ln": [
      {
       "s": 0,
       "d": 0,
       "cap": 43216489534047030,
       "sec": 4
      },
      {
       "s": 0,
       "d": 1,
       "cap": 7194878225744906,
       "sec": 3
      },
      {
       "s": 0,
       "d": 2,
       "cap": 7194878225744906,
       "sec": 3
      },
      {
       "s": 1,
       "d": 0,
       "cap": 42020913460542.58,
       "sec": 4
      },
      {
       "s": 1,
       "d": 1,
       "cap": 6995833269728.71,
       "sec": 3
      },
      {
       "s": 1,
       "d": 2,
       "cap": 6995833269728.71,
       "sec": 3
      },
      {
       "s": 2,
       "d": 0,
       "cap": 329703989069218000,
       "sec": 3
      },
      {
       "s": 2,
       "d": 1,
       "cap": 54890623404904030,
       "sec": 0
      },
      {
       "s": 2,
       "d": 2,
       "cap": 54890623404904030,
       "sec": 0
      },
      {
       "s": 3,
       "d": 0,
       "cap": 329689413732433150,
       "sec": 3
      },
      {
       "s": 3,
       "d": 1,
       "cap": 54888196836378990,
       "sec": 0
      },
      {
       "s": 3,
       "d": 2,
       "cap": 54888196836378990,
       "sec": 0
      },
      {
       "s": 4,
       "d": 0,
       "cap": 6642067169398.451,
       "sec": 3
      },
      {
       "s": 4,
       "d": 1,
       "cap": 1105801627255.9749,
       "sec": 2
      },
      {
       "s": 4,
       "d": 2,
       "cap": 1105801627255.9749,
       "sec": 2
      },
      {
       "s": 5,
       "d": 0,
       "cap": 29805811023380.53,
       "sec": 3
      },
      {
       "s": 5,
       "d": 1,
       "cap": 4962207320514.536,
       "sec": 2
      },
      {
       "s": 5,
       "d": 2,
       "cap": 4962207320514.536,
       "sec": 2
      },
      {
       "s": 6,
       "d": 0,
       "cap": 2557681706763.3276,
       "sec": 3
      },
      {
       "s": 6,
       "d": 1,
       "cap": 425814512441.59503,
       "sec": 3
      },
      {
       "s": 6,
       "d": 2,
       "cap": 425814512441.59503,
       "sec": 3
      },
      {
       "s": 7,
       "d": 0,
       "cap": 36678035947848.86,
       "sec": 3
      },
      {
       "s": 7,
       "d": 1,
       "cap": 6106326660252.317,
       "sec": 2
      },
      {
       "s": 7,
       "d": 2,
       "cap": 6106326660252.317,
       "sec": 2
      },
      {
       "s": 8,
       "d": 0,
       "cap": 55592770078919550,
       "sec": 4
      },
      {
       "s": 8,
       "d": 1,
       "cap": 55592770078919550,
       "sec": 3
      },
      {
       "s": 8,
       "d": 2,
       "cap": 55592770078919550,
       "sec": 3
      },
      {
       "s": 8,
       "d": 3,
       "cap": 673591481530581500000,
       "sec": -1
      }
     ]
    },
    "speedReference": {
     "version": 1,
     "key": "z95",
     "status": "published",
     "mglt": 100,
     "model": "Clone Z-95 starfighter (2025 Encyclopedia)",
     "scope": "class",
     "continuity": "canon",
     "source": "https://starwars.fandom.com/wiki/Megalight_per_hour"
    },
    "mglt": 100,
    "maxSpeed": 2000
   },
   "fireArcs": [
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      1,
      0
     ],
     "pos": [
      6.5,
      1.2180000098678236,
      8.01
     ],
     "k": "claser",
     "gun": 0.5,
     "aa": 0.5,
     "cycle": 0.12
    },
    {
     "fixed": true,
     "dir": [
      1,
      0,
      0
     ],
     "up": [
      0,
      1,
      0
     ],
     "pos": [
      6.5,
      1.2180000089282348,
      -8.01
     ],
     "k": "claser",
     "gun": 0.5,
     "aa": 0.5,
     "cycle": 0.12
    }
   ]
  }
 }
};
