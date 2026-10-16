/* GENERATED FILE — do not edit by hand.
   Built by tools/build-network.mjs from the organizer dataset in `Map Data/`.
   2026-10-16 · hubs 49 · lines 3 ·
   walk links 14 · street rows 49869 (5883.5 km)

   MRT-6 ৳5/km (min ৳20, max ৳100, DTCA 08 Sep 2022); city bus ৳2.70/km (min ৳10, MoRTB gazette 23 Sep 2026).

   Layout:
     HUBS   every dataset stop, with the original ids it came from
     LINES  MRT-6 (16 stations), Bikolpo (18 stops), Uttara bus (20 stops), each
            hop carrying its real distance in km and its route geometry
     WALKS  derived pedestrian edges between dataset stops that are close
     TRANSFERS  the metro↔bus interchanges produced by the same-name / 50 m / 250 m+token rules
*/

export const DATASET = {
  "sources": {
    "transit": "Map Data/json/transit-data.json",
    "metroCsv": "Map Data/csv/Routemap-DhakaMetroRail.csv",
    "bikolpoCsv": "Map Data/csv/Routemap-BikolpoBus.csv",
    "uttaraCsv": "Map Data/csv/Routemap-UttaraBus.csv",
    "streets": "Map Data/csv/Roadmap-Dhaka.csv",
    "note": "Approximate map references, not live service or verified fares. Bus stop labels inherit the assignment's limitations."
  },
  "rates": "MRT-6 ৳5/km (min ৳20, max ৳100, DTCA 08 Sep 2022); city bus ৳2.70/km (min ৳10, MoRTB gazette 23 Sep 2026).",
  "generatedAt": "2026-10-16",
  "counts": {
    "hubs": 49,
    "lines": 3,
    "metroStations": 16,
    "bikolpoStops": 18,
    "uttaraStops": 20,
    "walkLinks": 14,
    "streetSegments": 49869,
    "streetKm": 5883.5
  },
  "metroTrack": {
    "source": "Map Data/csv/Routemap-DhakaMetroRail.csv",
    "points": 609,
    "coveredKm": 15.03,
    "stationsOnTrack": 12,
    "maxOffTrackM": 9.7
  }
};

export const HUBS = [
  {
    "id": "metro-uttara-north",
    "name": "Uttara North",
    "lat": 23.86967,
    "lng": 90.36763,
    "services": [
      "mrt6"
    ],
    "datasetIds": [
      "uttara_north"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "metro-uttara-center",
    "name": "Uttara Center",
    "lat": 23.85981,
    "lng": 90.36516,
    "services": [
      "mrt6"
    ],
    "datasetIds": [
      "uttara_center"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "metro-uttara-south",
    "name": "Uttara South",
    "lat": 23.84581,
    "lng": 90.36311,
    "services": [
      "mrt6"
    ],
    "datasetIds": [
      "uttara_south"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "metro-pallabi",
    "name": "Pallabi",
    "lat": 23.82615,
    "lng": 90.36427,
    "services": [
      "mrt6"
    ],
    "datasetIds": [
      "pallabi"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "metro-mirpur-11",
    "name": "Mirpur 11",
    "lat": 23.81924,
    "lng": 90.36527,
    "services": [
      "mrt6",
      "bikolpo"
    ],
    "datasetIds": [
      "mirpur11",
      "bikolpo-1"
    ],
    "aliases": [
      "Purobi Hall"
    ],
    "interchange": true
  },
  {
    "id": "metro-mirpur-10",
    "name": "Mirpur 10",
    "lat": 23.80813,
    "lng": 90.36833,
    "services": [
      "mrt6",
      "bikolpo"
    ],
    "datasetIds": [
      "mirpur10",
      "bikolpo-3"
    ],
    "aliases": [],
    "interchange": true
  },
  {
    "id": "metro-kazipara",
    "name": "Kazipara",
    "lat": 23.7995,
    "lng": 90.3719,
    "services": [
      "mrt6"
    ],
    "datasetIds": [
      "kazipara"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "metro-shewrapara",
    "name": "Shewrapara",
    "lat": 23.79095,
    "lng": 90.37553,
    "services": [
      "mrt6"
    ],
    "datasetIds": [
      "shewrapara"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "metro-agargaon",
    "name": "Agargaon",
    "lat": 23.77842,
    "lng": 90.38015,
    "services": [
      "mrt6"
    ],
    "datasetIds": [
      "agargaon"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "metro-bijoy-sarani",
    "name": "Bijoy Sarani",
    "lat": 23.76634,
    "lng": 90.38313,
    "services": [
      "mrt6"
    ],
    "datasetIds": [
      "bijoy_sarani"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "metro-farmgate",
    "name": "Farmgate",
    "lat": 23.75903,
    "lng": 90.38635,
    "services": [
      "mrt6"
    ],
    "datasetIds": [
      "farmgate"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "metro-karwan-bazar",
    "name": "Karwan Bazar",
    "lat": 23.75154,
    "lng": 90.39266,
    "services": [
      "mrt6",
      "uttara_bus"
    ],
    "datasetIds": [
      "karwan_bazar",
      "uttara_bus-14"
    ],
    "aliases": [],
    "interchange": true
  },
  {
    "id": "metro-shahbagh",
    "name": "Shahbagh",
    "lat": 23.73958,
    "lng": 90.39601,
    "services": [
      "mrt6",
      "uttara_bus"
    ],
    "datasetIds": [
      "shahbagh",
      "uttara_bus-17"
    ],
    "aliases": [
      "Shahbag"
    ],
    "interchange": true
  },
  {
    "id": "metro-dhaka-university",
    "name": "Dhaka University",
    "lat": 23.73142,
    "lng": 90.39702,
    "services": [
      "mrt6"
    ],
    "datasetIds": [
      "dhaka_university"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "metro-bangladesh-secretariat",
    "name": "Bangladesh Secretariat",
    "lat": 23.73001,
    "lng": 90.40787,
    "services": [
      "mrt6",
      "uttara_bus"
    ],
    "datasetIds": [
      "secretariat",
      "uttara_bus-19"
    ],
    "aliases": [
      "Secretariat"
    ],
    "interchange": true
  },
  {
    "id": "metro-motijheel",
    "name": "Motijheel",
    "lat": 23.72743,
    "lng": 90.42018,
    "services": [
      "mrt6"
    ],
    "datasetIds": [
      "motijheel"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "bikolpo-mirpur-12",
    "name": "Mirpur 12",
    "lat": 23.828335,
    "lng": 90.364255,
    "services": [
      "bikolpo"
    ],
    "datasetIds": [
      "bikolpo-0"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "bikolpo-yantai",
    "name": "Yantai",
    "lat": 23.815764,
    "lng": 90.366249,
    "services": [
      "bikolpo"
    ],
    "datasetIds": [
      "bikolpo-2"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "bikolpo-stadium",
    "name": "Stadium",
    "lat": 23.805117,
    "lng": 90.363501,
    "services": [
      "bikolpo"
    ],
    "datasetIds": [
      "bikolpo-4"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "bikolpo-mirpur-1",
    "name": "Mirpur 1",
    "lat": 23.795583,
    "lng": 90.353473,
    "services": [
      "bikolpo"
    ],
    "datasetIds": [
      "bikolpo-5"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "bikolpo-ansar-camp",
    "name": "Ansar Camp",
    "lat": 23.791107,
    "lng": 90.353829,
    "services": [
      "bikolpo"
    ],
    "datasetIds": [
      "bikolpo-6"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "bikolpo-darussalam",
    "name": "Darussalam",
    "lat": 23.781303,
    "lng": 90.352344,
    "services": [
      "bikolpo"
    ],
    "datasetIds": [
      "bikolpo-7"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "bikolpo-kalyan-pur",
    "name": "Kalyan Pur",
    "lat": 23.778616,
    "lng": 90.359892,
    "services": [
      "bikolpo"
    ],
    "datasetIds": [
      "bikolpo-8"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "bikolpo-shyamoli",
    "name": "Shyamoli",
    "lat": 23.774911,
    "lng": 90.365685,
    "services": [
      "bikolpo"
    ],
    "datasetIds": [
      "bikolpo-9"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "bikolpo-shishu-mela",
    "name": "Shishu Mela",
    "lat": 23.763633,
    "lng": 90.371105,
    "services": [
      "bikolpo"
    ],
    "datasetIds": [
      "bikolpo-10"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "bikolpo-asad-gate",
    "name": "Asad Gate",
    "lat": 23.760112,
    "lng": 90.373094,
    "services": [
      "bikolpo"
    ],
    "datasetIds": [
      "bikolpo-11"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "bikolpo-dhanmondi-27",
    "name": "Dhanmondi 27",
    "lat": 23.756477,
    "lng": 90.375289,
    "services": [
      "bikolpo"
    ],
    "datasetIds": [
      "bikolpo-12"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "bikolpo-metro-shopping",
    "name": "Metro Shopping",
    "lat": 23.752432,
    "lng": 90.377642,
    "services": [
      "bikolpo"
    ],
    "datasetIds": [
      "bikolpo-13"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "bikolpo-kalabagan",
    "name": "Kalabagan",
    "lat": 23.747599,
    "lng": 90.380444,
    "services": [
      "bikolpo"
    ],
    "datasetIds": [
      "bikolpo-14"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "bikolpo-labaid",
    "name": "Labaid",
    "lat": 23.74167,
    "lng": 90.382857,
    "services": [
      "bikolpo"
    ],
    "datasetIds": [
      "bikolpo-15"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "bikolpo-new-market",
    "name": "New Market",
    "lat": 23.732862,
    "lng": 90.385008,
    "services": [
      "bikolpo"
    ],
    "datasetIds": [
      "bikolpo-16"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "bikolpo-tsc",
    "name": "TSC",
    "lat": 23.732855,
    "lng": 90.394696,
    "services": [
      "bikolpo"
    ],
    "datasetIds": [
      "bikolpo-17"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "uttara-bus-brtc",
    "name": "BRTC",
    "lat": 23.876867,
    "lng": 90.401026,
    "services": [
      "uttara_bus"
    ],
    "datasetIds": [
      "uttara_bus-0"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "uttara-bus-rajuk",
    "name": "Rajuk",
    "lat": 23.872095,
    "lng": 90.40083,
    "services": [
      "uttara_bus"
    ],
    "datasetIds": [
      "uttara_bus-1"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "uttara-bus-azampur",
    "name": "Azampur",
    "lat": 23.867923,
    "lng": 90.400331,
    "services": [
      "uttara_bus"
    ],
    "datasetIds": [
      "uttara_bus-2"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "uttara-bus-rajlokkhi",
    "name": "Rajlokkhi",
    "lat": 23.864429,
    "lng": 90.400302,
    "services": [
      "uttara_bus"
    ],
    "datasetIds": [
      "uttara_bus-3"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "uttara-bus-jashim-uddin",
    "name": "Jashim Uddin",
    "lat": 23.860737,
    "lng": 90.400394,
    "services": [
      "uttara_bus"
    ],
    "datasetIds": [
      "uttara_bus-4"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "uttara-bus-khilkhet",
    "name": "Khilkhet",
    "lat": 23.828786,
    "lng": 90.419952,
    "services": [
      "uttara_bus"
    ],
    "datasetIds": [
      "uttara_bus-5"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "uttara-bus-kuril",
    "name": "Kuril",
    "lat": 23.821667,
    "lng": 90.419038,
    "services": [
      "uttara_bus"
    ],
    "datasetIds": [
      "uttara_bus-6"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "uttara-bus-shewra",
    "name": "Shewra",
    "lat": 23.818866,
    "lng": 90.414977,
    "services": [
      "uttara_bus"
    ],
    "datasetIds": [
      "uttara_bus-7"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "uttara-bus-mes-bus-stop",
    "name": "MES Bus Stop",
    "lat": 23.816025,
    "lng": 90.405028,
    "services": [
      "uttara_bus"
    ],
    "datasetIds": [
      "uttara_bus-8"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "uttara-bus-banani",
    "name": "Banani",
    "lat": 23.794465,
    "lng": 90.401034,
    "services": [
      "uttara_bus"
    ],
    "datasetIds": [
      "uttara_bus-9"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "uttara-bus-mohakhali",
    "name": "Mohakhali",
    "lat": 23.781108,
    "lng": 90.398782,
    "services": [
      "uttara_bus"
    ],
    "datasetIds": [
      "uttara_bus-10"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "uttara-bus-jahangir-gate",
    "name": "Jahangir Gate",
    "lat": 23.775444,
    "lng": 90.390938,
    "services": [
      "uttara_bus"
    ],
    "datasetIds": [
      "uttara_bus-11"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "uttara-bus-bijoy-sarani",
    "name": "Bijoy Sarani · Uttara bus stop",
    "lat": 23.765148,
    "lng": 90.389064,
    "services": [
      "uttara_bus"
    ],
    "datasetIds": [
      "uttara_bus-12"
    ],
    "aliases": [
      "Bijoy Sarani"
    ],
    "interchange": false
  },
  {
    "id": "uttara-bus-farmgate",
    "name": "Farmgate · Uttara bus stop",
    "lat": 23.758382,
    "lng": 90.390157,
    "services": [
      "uttara_bus"
    ],
    "datasetIds": [
      "uttara_bus-13"
    ],
    "aliases": [
      "Farmgate"
    ],
    "interchange": false
  },
  {
    "id": "uttara-bus-bangla-motor",
    "name": "Bangla Motor",
    "lat": 23.745277,
    "lng": 90.394976,
    "services": [
      "uttara_bus"
    ],
    "datasetIds": [
      "uttara_bus-15"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "uttara-bus-sheraton",
    "name": "Sheraton",
    "lat": 23.742234,
    "lng": 90.395911,
    "services": [
      "uttara_bus"
    ],
    "datasetIds": [
      "uttara_bus-16"
    ],
    "aliases": [],
    "interchange": false
  },
  {
    "id": "uttara-bus-kakrail",
    "name": "Kakrail",
    "lat": 23.733836,
    "lng": 90.403085,
    "services": [
      "uttara_bus"
    ],
    "datasetIds": [
      "uttara_bus-18"
    ],
    "aliases": [],
    "interchange": false
  }
];

export const LINES = [
  {
    "id": "mrt6",
    "name": "MRT-6",
    "service": "mrt6",
    "mode": "metro",
    "totalKm": 19.33,
    "stops": [
      "metro-uttara-north",
      "metro-uttara-center",
      "metro-uttara-south",
      "metro-pallabi",
      "metro-mirpur-11",
      "metro-mirpur-10",
      "metro-kazipara",
      "metro-shewrapara",
      "metro-agargaon",
      "metro-bijoy-sarani",
      "metro-farmgate",
      "metro-karwan-bazar",
      "metro-shahbagh",
      "metro-dhaka-university",
      "metro-bangladesh-secretariat",
      "metro-motijheel"
    ],
    "hops": [
      {
        "from": "metro-uttara-north",
        "to": "metro-uttara-center",
        "km": 1.125,
        "geometry": [
          [
            23.86967,
            90.36763
          ],
          [
            23.85981,
            90.36516
          ]
        ]
      },
      {
        "from": "metro-uttara-center",
        "to": "metro-uttara-south",
        "km": 1.571,
        "geometry": [
          [
            23.85981,
            90.36516
          ],
          [
            23.84581,
            90.36311
          ]
        ]
      },
      {
        "from": "metro-uttara-south",
        "to": "metro-pallabi",
        "km": 2.189,
        "geometry": [
          [
            23.84581,
            90.36311
          ],
          [
            23.82615,
            90.36427
          ]
        ]
      },
      {
        "from": "metro-pallabi",
        "to": "metro-mirpur-11",
        "km": 0.782,
        "geometry": [
          [
            23.82615,
            90.36427
          ],
          [
            23.82615,
            90.36428
          ],
          [
            23.825693,
            90.364282
          ],
          [
            23.825198,
            90.364286
          ],
          [
            23.82511,
            90.364286
          ],
          [
            23.824956,
            90.364287
          ],
          [
            23.824687,
            90.364304
          ],
          [
            23.82451,
            90.364315
          ],
          [
            23.823893,
            90.364354
          ],
          [
            23.823705,
            90.364366
          ],
          [
            23.82274,
            90.364417
          ],
          [
            23.822716,
            90.36442
          ],
          [
            23.822647,
            90.364431
          ],
          [
            23.822236,
            90.364492
          ],
          [
            23.822151,
            90.364516
          ],
          [
            23.821602,
            90.364663
          ],
          [
            23.821108,
            90.364795
          ],
          [
            23.820867,
            90.36486
          ],
          [
            23.820637,
            90.364921
          ],
          [
            23.820601,
            90.364931
          ],
          [
            23.820315,
            90.365007
          ],
          [
            23.820063,
            90.365075
          ],
          [
            23.819825,
            90.365139
          ],
          [
            23.819587,
            90.365202
          ],
          [
            23.819245,
            90.365294
          ],
          [
            23.81924,
            90.36527
          ]
        ]
      },
      {
        "from": "metro-mirpur-11",
        "to": "metro-mirpur-10",
        "km": 1.277,
        "geometry": [
          [
            23.81924,
            90.36527
          ],
          [
            23.819245,
            90.365294
          ],
          [
            23.819078,
            90.365339
          ],
          [
            23.819055,
            90.365345
          ],
          [
            23.818946,
            90.365374
          ],
          [
            23.818534,
            90.365488
          ],
          [
            23.818005,
            90.365634
          ],
          [
            23.817471,
            90.365781
          ],
          [
            23.817122,
            90.365877
          ],
          [
            23.816961,
            90.365921
          ],
          [
            23.816463,
            90.366058
          ],
          [
            23.816058,
            90.36617
          ],
          [
            23.815947,
            90.3662
          ],
          [
            23.815764,
            90.366249
          ],
          [
            23.81541,
            90.366345
          ],
          [
            23.815129,
            90.366421
          ],
          [
            23.814931,
            90.366474
          ],
          [
            23.814553,
            90.366576
          ],
          [
            23.814409,
            90.366615
          ],
          [
            23.813941,
            90.366742
          ],
          [
            23.813393,
            90.36689
          ],
          [
            23.813343,
            90.366904
          ],
          [
            23.813069,
            90.366978
          ],
          [
            23.812967,
            90.367005
          ],
          [
            23.812834,
            90.367041
          ],
          [
            23.812482,
            90.367136
          ],
          [
            23.81201,
            90.367263
          ],
          [
            23.811478,
            90.367406
          ],
          [
            23.811196,
            90.367482
          ],
          [
            23.810978,
            90.367541
          ],
          [
            23.810499,
            90.367669
          ],
          [
            23.81046,
            90.36768
          ],
          [
            23.809964,
            90.367821
          ],
          [
            23.809842,
            90.367855
          ],
          [
            23.809417,
            90.367976
          ],
          [
            23.809299,
            90.368009
          ],
          [
            23.808894,
            90.368123
          ],
          [
            23.808691,
            90.36818
          ],
          [
            23.808491,
            90.368237
          ],
          [
            23.808393,
            90.368265
          ],
          [
            23.808132,
            90.368339
          ],
          [
            23.80813,
            90.36833
          ]
        ]
      },
      {
        "from": "metro-mirpur-10",
        "to": "metro-kazipara",
        "km": 1.032,
        "geometry": [
          [
            23.80813,
            90.36833
          ],
          [
            23.808132,
            90.368339
          ],
          [
            23.80763,
            90.368481
          ],
          [
            23.807119,
            90.368626
          ],
          [
            23.807017,
            90.368654
          ],
          [
            23.806756,
            90.368726
          ],
          [
            23.806656,
            90.368754
          ],
          [
            23.806442,
            90.368835
          ],
          [
            23.805951,
            90.36905
          ],
          [
            23.805873,
            90.369084
          ],
          [
            23.805553,
            90.369223
          ],
          [
            23.805404,
            90.369288
          ],
          [
            23.804995,
            90.369492
          ],
          [
            23.804634,
            90.369672
          ],
          [
            23.804497,
            90.369741
          ],
          [
            23.804307,
            90.369836
          ],
          [
            23.804101,
            90.369938
          ],
          [
            23.803745,
            90.370117
          ],
          [
            23.803662,
            90.370159
          ],
          [
            23.803547,
            90.370208
          ],
          [
            23.803335,
            90.370297
          ],
          [
            23.803239,
            90.370338
          ],
          [
            23.802896,
            90.370483
          ],
          [
            23.802708,
            90.370564
          ],
          [
            23.802625,
            90.3706
          ],
          [
            23.802074,
            90.370836
          ],
          [
            23.801935,
            90.370895
          ],
          [
            23.801532,
            90.371067
          ],
          [
            23.801224,
            90.371197
          ],
          [
            23.800898,
            90.371336
          ],
          [
            23.800714,
            90.371414
          ],
          [
            23.800552,
            90.371483
          ],
          [
            23.80051,
            90.3715
          ],
          [
            23.800428,
            90.371536
          ],
          [
            23.799963,
            90.371735
          ],
          [
            23.799511,
            90.371929
          ],
          [
            23.7995,
            90.3719
          ]
        ]
      },
      {
        "from": "metro-kazipara",
        "to": "metro-shewrapara",
        "km": 1.055,
        "geometry": [
          [
            23.7995,
            90.3719
          ],
          [
            23.799511,
            90.371929
          ],
          [
            23.799425,
            90.371966
          ],
          [
            23.799184,
            90.372061
          ],
          [
            23.798902,
            90.372187
          ],
          [
            23.798357,
            90.372416
          ],
          [
            23.79744,
            90.372793
          ],
          [
            23.7973,
            90.372853
          ],
          [
            23.797256,
            90.372712
          ],
          [
            23.7973,
            90.372853
          ],
          [
            23.797086,
            90.372943
          ],
          [
            23.79652,
            90.373183
          ],
          [
            23.796461,
            90.373208
          ],
          [
            23.796252,
            90.373298
          ],
          [
            23.795677,
            90.373544
          ],
          [
            23.795438,
            90.373647
          ],
          [
            23.795194,
            90.373751
          ],
          [
            23.79502,
            90.373825
          ],
          [
            23.794949,
            90.373856
          ],
          [
            23.794596,
            90.373997
          ],
          [
            23.794119,
            90.374188
          ],
          [
            23.793924,
            90.374272
          ],
          [
            23.793544,
            90.374437
          ],
          [
            23.793453,
            90.374477
          ],
          [
            23.793232,
            90.374575
          ],
          [
            23.792706,
            90.374785
          ],
          [
            23.792615,
            90.374821
          ],
          [
            23.792558,
            90.374845
          ],
          [
            23.792273,
            90.374966
          ],
          [
            23.792114,
            90.375033
          ],
          [
            23.791618,
            90.37525
          ],
          [
            23.791588,
            90.375263
          ],
          [
            23.79138,
            90.375354
          ],
          [
            23.790954,
            90.37554
          ],
          [
            23.79095,
            90.37553
          ]
        ]
      },
      {
        "from": "metro-shewrapara",
        "to": "metro-agargaon",
        "km": 1.476,
        "geometry": [
          [
            23.79095,
            90.37553
          ],
          [
            23.790954,
            90.37554
          ],
          [
            23.790927,
            90.375552
          ],
          [
            23.790491,
            90.375743
          ],
          [
            23.790389,
            90.375786
          ],
          [
            23.790021,
            90.375948
          ],
          [
            23.789647,
            90.376115
          ],
          [
            23.789607,
            90.376133
          ],
          [
            23.789247,
            90.376294
          ],
          [
            23.788885,
            90.376443
          ],
          [
            23.788676,
            90.376537
          ],
          [
            23.788557,
            90.37659
          ],
          [
            23.788145,
            90.376772
          ],
          [
            23.788087,
            90.376798
          ],
          [
            23.787293,
            90.377143
          ],
          [
            23.787237,
            90.377166
          ],
          [
            23.786714,
            90.377392
          ],
          [
            23.786526,
            90.377471
          ],
          [
            23.786294,
            90.377568
          ],
          [
            23.785763,
            90.37779
          ],
          [
            23.785327,
            90.377973
          ],
          [
            23.785113,
            90.378069
          ],
          [
            23.784941,
            90.378136
          ],
          [
            23.784771,
            90.378203
          ],
          [
            23.784459,
            90.378302
          ],
          [
            23.783828,
            90.378502
          ],
          [
            23.783412,
            90.378656
          ],
          [
            23.783315,
            90.378692
          ],
          [
            23.782925,
            90.378826
          ],
          [
            23.782777,
            90.378877
          ],
          [
            23.781792,
            90.379181
          ],
          [
            23.781637,
            90.379228
          ],
          [
            23.780457,
            90.379583
          ],
          [
            23.780428,
            90.379592
          ],
          [
            23.779366,
            90.379894
          ],
          [
            23.778723,
            90.380077
          ],
          [
            23.778426,
            90.380171
          ],
          [
            23.77842,
            90.38015
          ]
        ]
      },
      {
        "from": "metro-agargaon",
        "to": "metro-bijoy-sarani",
        "km": 1.395,
        "geometry": [
          [
            23.77842,
            90.38015
          ],
          [
            23.778426,
            90.380171
          ],
          [
            23.777563,
            90.380444
          ],
          [
            23.776812,
            90.380682
          ],
          [
            23.776426,
            90.380805
          ],
          [
            23.774201,
            90.381452
          ],
          [
            23.773442,
            90.381673
          ],
          [
            23.77334,
            90.381704
          ],
          [
            23.772725,
            90.381892
          ],
          [
            23.771912,
            90.382157
          ],
          [
            23.77181,
            90.382191
          ],
          [
            23.770983,
            90.382466
          ],
          [
            23.770808,
            90.382499
          ],
          [
            23.77033,
            90.382573
          ],
          [
            23.769811,
            90.382659
          ],
          [
            23.769096,
            90.382862
          ],
          [
            23.76844,
            90.383073
          ],
          [
            23.766716,
            90.383185
          ],
          [
            23.766349,
            90.383225
          ],
          [
            23.76634,
            90.38313
          ]
        ]
      },
      {
        "from": "metro-bijoy-sarani",
        "to": "metro-farmgate",
        "km": 1.111,
        "geometry": [
          [
            23.76634,
            90.38313
          ],
          [
            23.766349,
            90.383225
          ],
          [
            23.766135,
            90.383248
          ],
          [
            23.765135,
            90.383391
          ],
          [
            23.763623,
            90.383479
          ],
          [
            23.762505,
            90.38354
          ],
          [
            23.762201,
            90.383556
          ],
          [
            23.761567,
            90.38359
          ],
          [
            23.761283,
            90.38361
          ],
          [
            23.759989,
            90.383698
          ],
          [
            23.758856,
            90.383775
          ],
          [
            23.758997,
            90.386337
          ],
          [
            23.758998,
            90.386352
          ],
          [
            23.75903,
            90.38635
          ]
        ]
      },
      {
        "from": "metro-farmgate",
        "to": "metro-karwan-bazar",
        "km": 1.26,
        "geometry": [
          [
            23.75903,
            90.38635
          ],
          [
            23.758998,
            90.386352
          ],
          [
            23.759054,
            90.387376
          ],
          [
            23.759095,
            90.388124
          ],
          [
            23.75912,
            90.388575
          ],
          [
            23.759175,
            90.38981
          ],
          [
            23.759079,
            90.389841
          ],
          [
            23.758538,
            90.390122
          ],
          [
            23.758382,
            90.390157
          ],
          [
            23.757687,
            90.390298
          ],
          [
            23.756672,
            90.390709
          ],
          [
            23.75533,
            90.391254
          ],
          [
            23.754312,
            90.391666
          ],
          [
            23.753886,
            90.391823
          ],
          [
            23.753352,
            90.392022
          ],
          [
            23.752799,
            90.392232
          ],
          [
            23.752245,
            90.392442
          ],
          [
            23.751738,
            90.392635
          ],
          [
            23.751558,
            90.392711
          ],
          [
            23.75154,
            90.39266
          ]
        ]
      },
      {
        "from": "metro-karwan-bazar",
        "to": "metro-shahbagh",
        "km": 1.39,
        "geometry": [
          [
            23.75154,
            90.39266
          ],
          [
            23.751558,
            90.392711
          ],
          [
            23.75022,
            90.393274
          ],
          [
            23.749833,
            90.393422
          ],
          [
            23.747052,
            90.394407
          ],
          [
            23.74593,
            90.394775
          ],
          [
            23.745277,
            90.394976
          ],
          [
            23.744603,
            90.395171
          ],
          [
            23.744029,
            90.395356
          ],
          [
            23.74373,
            90.39546
          ],
          [
            23.742772,
            90.395794
          ],
          [
            23.742628,
            90.395825
          ],
          [
            23.742234,
            90.395911
          ],
          [
            23.741405,
            90.39606
          ],
          [
            23.741201,
            90.396087
          ],
          [
            23.73958,
            90.396004
          ],
          [
            23.73958,
            90.39601
          ]
        ]
      },
      {
        "from": "metro-shahbagh",
        "to": "metro-dhaka-university",
        "km": 1.013,
        "geometry": [
          [
            23.73958,
            90.39601
          ],
          [
            23.73958,
            90.396004
          ],
          [
            23.738365,
            90.395941
          ],
          [
            23.738331,
            90.396047
          ],
          [
            23.738265,
            90.396151
          ],
          [
            23.738159,
            90.396206
          ],
          [
            23.738053,
            90.396171
          ],
          [
            23.737973,
            90.396138
          ],
          [
            23.737906,
            90.39608
          ],
          [
            23.737861,
            90.396011
          ],
          [
            23.737848,
            90.395894
          ],
          [
            23.737873,
            90.395793
          ],
          [
            23.737085,
            90.395664
          ],
          [
            23.736958,
            90.395653
          ],
          [
            23.736099,
            90.395609
          ],
          [
            23.735682,
            90.395587
          ],
          [
            23.735407,
            90.395573
          ],
          [
            23.735284,
            90.395567
          ],
          [
            23.73501,
            90.395554
          ],
          [
            23.734857,
            90.395547
          ],
          [
            23.734332,
            90.395546
          ],
          [
            23.732844,
            90.395648
          ],
          [
            23.73265,
            90.395896
          ],
          [
            23.732249,
            90.396284
          ],
          [
            23.732035,
            90.396493
          ],
          [
            23.731451,
            90.397059
          ],
          [
            23.73142,
            90.39702
          ]
        ]
      },
      {
        "from": "metro-dhaka-university",
        "to": "metro-bangladesh-secretariat",
        "km": 1.369,
        "geometry": [
          [
            23.73142,
            90.39702
          ],
          [
            23.731451,
            90.397059
          ],
          [
            23.731349,
            90.397158
          ],
          [
            23.731101,
            90.3974
          ],
          [
            23.730691,
            90.397798
          ],
          [
            23.730278,
            90.398206
          ],
          [
            23.729704,
            90.398774
          ],
          [
            23.72934,
            90.399133
          ],
          [
            23.729279,
            90.399192
          ],
          [
            23.728537,
            90.399906
          ],
          [
            23.728063,
            90.400379
          ],
          [
            23.728103,
            90.401221
          ],
          [
            23.728133,
            90.401855
          ],
          [
            23.728137,
            90.401932
          ],
          [
            23.728205,
            90.403228
          ],
          [
            23.728335,
            90.403712
          ],
          [
            23.728417,
            90.404018
          ],
          [
            23.728747,
            90.404298
          ],
          [
            23.728877,
            90.404435
          ],
          [
            23.72914,
            90.404709
          ],
          [
            23.729554,
            90.405032
          ],
          [
            23.72973,
            90.405098
          ],
          [
            23.729764,
            90.405236
          ],
          [
            23.72984,
            90.405359
          ],
          [
            23.729986,
            90.40543
          ],
          [
            23.730008,
            90.405848
          ],
          [
            23.730054,
            90.406183
          ],
          [
            23.73006,
            90.406405
          ],
          [
            23.730066,
            90.406616
          ],
          [
            23.730041,
            90.407537
          ],
          [
            23.730039,
            90.407598
          ],
          [
            23.730039,
            90.40762
          ],
          [
            23.730034,
            90.407871
          ],
          [
            23.73001,
            90.40787
          ]
        ]
      },
      {
        "from": "metro-bangladesh-secretariat",
        "to": "metro-motijheel",
        "km": 1.286,
        "geometry": [
          [
            23.73001,
            90.40787
          ],
          [
            23.72743,
            90.42018
          ]
        ]
      }
    ]
  },
  {
    "id": "bikolpo",
    "name": "Bikolpo",
    "service": "bikolpo",
    "mode": "bus",
    "totalKm": 13.7,
    "stops": [
      "bikolpo-mirpur-12",
      "metro-mirpur-11",
      "bikolpo-yantai",
      "metro-mirpur-10",
      "bikolpo-stadium",
      "bikolpo-mirpur-1",
      "bikolpo-ansar-camp",
      "bikolpo-darussalam",
      "bikolpo-kalyan-pur",
      "bikolpo-shyamoli",
      "bikolpo-shishu-mela",
      "bikolpo-asad-gate",
      "bikolpo-dhanmondi-27",
      "bikolpo-metro-shopping",
      "bikolpo-kalabagan",
      "bikolpo-labaid",
      "bikolpo-new-market",
      "bikolpo-tsc"
    ],
    "hops": [
      {
        "from": "bikolpo-mirpur-12",
        "to": "metro-mirpur-11",
        "km": 1.035,
        "geometry": [
          [
            23.828335,
            90.364255
          ],
          [
            23.819078,
            90.365339
          ]
        ]
      },
      {
        "from": "metro-mirpur-11",
        "to": "bikolpo-yantai",
        "km": 0.38,
        "geometry": [
          [
            23.819078,
            90.365339
          ],
          [
            23.819055,
            90.365345
          ],
          [
            23.819055,
            90.365345
          ],
          [
            23.818946,
            90.365374
          ],
          [
            23.818946,
            90.365374
          ],
          [
            23.818534,
            90.365488
          ],
          [
            23.818534,
            90.365488
          ],
          [
            23.818005,
            90.365634
          ],
          [
            23.818005,
            90.365634
          ],
          [
            23.817471,
            90.365781
          ],
          [
            23.817471,
            90.365781
          ],
          [
            23.817122,
            90.365877
          ],
          [
            23.817122,
            90.365877
          ],
          [
            23.816961,
            90.365921
          ],
          [
            23.816961,
            90.365921
          ],
          [
            23.816463,
            90.366058
          ],
          [
            23.816463,
            90.366058
          ],
          [
            23.816058,
            90.36617
          ],
          [
            23.816058,
            90.36617
          ],
          [
            23.815947,
            90.3662
          ],
          [
            23.815947,
            90.3662
          ],
          [
            23.815764,
            90.366249
          ]
        ]
      },
      {
        "from": "bikolpo-yantai",
        "to": "metro-mirpur-10",
        "km": 0.933,
        "geometry": [
          [
            23.815764,
            90.366249
          ],
          [
            23.80763,
            90.368481
          ]
        ]
      },
      {
        "from": "metro-mirpur-10",
        "to": "bikolpo-stadium",
        "km": 0.632,
        "geometry": [
          [
            23.80763,
            90.368481
          ],
          [
            23.807119,
            90.368626
          ],
          [
            23.807119,
            90.368626
          ],
          [
            23.807045,
            90.368349
          ],
          [
            23.807045,
            90.368349
          ],
          [
            23.806997,
            90.3681
          ],
          [
            23.806997,
            90.3681
          ],
          [
            23.806797,
            90.367048
          ],
          [
            23.806797,
            90.367048
          ],
          [
            23.80677,
            90.366941
          ],
          [
            23.80677,
            90.366941
          ],
          [
            23.806765,
            90.366918
          ],
          [
            23.806765,
            90.366918
          ],
          [
            23.806691,
            90.366617
          ],
          [
            23.806691,
            90.366617
          ],
          [
            23.806665,
            90.366537
          ],
          [
            23.806665,
            90.366537
          ],
          [
            23.806557,
            90.366205
          ],
          [
            23.806557,
            90.366205
          ],
          [
            23.806387,
            90.365781
          ],
          [
            23.806387,
            90.365781
          ],
          [
            23.806318,
            90.365607
          ],
          [
            23.806318,
            90.365607
          ],
          [
            23.805886,
            90.364818
          ],
          [
            23.805886,
            90.364818
          ],
          [
            23.805741,
            90.364568
          ],
          [
            23.805741,
            90.364568
          ],
          [
            23.805433,
            90.364041
          ],
          [
            23.805433,
            90.364041
          ],
          [
            23.805117,
            90.363501
          ]
        ]
      },
      {
        "from": "bikolpo-stadium",
        "to": "bikolpo-mirpur-1",
        "km": 1.471,
        "geometry": [
          [
            23.805117,
            90.363501
          ],
          [
            23.795583,
            90.353473
          ]
        ]
      },
      {
        "from": "bikolpo-mirpur-1",
        "to": "bikolpo-ansar-camp",
        "km": 0.499,
        "geometry": [
          [
            23.795583,
            90.353473
          ],
          [
            23.791107,
            90.353829
          ]
        ]
      },
      {
        "from": "bikolpo-ansar-camp",
        "to": "bikolpo-darussalam",
        "km": 1.101,
        "geometry": [
          [
            23.791107,
            90.353829
          ],
          [
            23.781303,
            90.352344
          ]
        ]
      },
      {
        "from": "bikolpo-darussalam",
        "to": "bikolpo-kalyan-pur",
        "km": 0.835,
        "geometry": [
          [
            23.778616,
            90.359892
          ],
          [
            23.778659,
            90.359721
          ],
          [
            23.778659,
            90.359721
          ],
          [
            23.778676,
            90.359655
          ],
          [
            23.778676,
            90.359655
          ],
          [
            23.778714,
            90.359506
          ],
          [
            23.778714,
            90.359506
          ],
          [
            23.778742,
            90.359393
          ],
          [
            23.778742,
            90.359393
          ],
          [
            23.778808,
            90.358928
          ],
          [
            23.778808,
            90.358928
          ],
          [
            23.778813,
            90.358897
          ],
          [
            23.778813,
            90.358897
          ],
          [
            23.77885,
            90.358637
          ],
          [
            23.77885,
            90.358637
          ],
          [
            23.778911,
            90.35824
          ],
          [
            23.778911,
            90.35824
          ],
          [
            23.77898,
            90.357799
          ],
          [
            23.77898,
            90.357799
          ],
          [
            23.779148,
            90.356717
          ],
          [
            23.779148,
            90.356717
          ],
          [
            23.779157,
            90.356659
          ],
          [
            23.779157,
            90.356659
          ],
          [
            23.779177,
            90.356588
          ],
          [
            23.779177,
            90.356588
          ],
          [
            23.779196,
            90.356528
          ],
          [
            23.779196,
            90.356528
          ],
          [
            23.779292,
            90.3562
          ],
          [
            23.779292,
            90.3562
          ],
          [
            23.779535,
            90.355704
          ],
          [
            23.779535,
            90.355704
          ],
          [
            23.77959,
            90.355604
          ],
          [
            23.77959,
            90.355604
          ],
          [
            23.779886,
            90.35507
          ],
          [
            23.779886,
            90.35507
          ],
          [
            23.77991,
            90.355028
          ],
          [
            23.77991,
            90.355028
          ],
          [
            23.780288,
            90.354346
          ],
          [
            23.780288,
            90.354346
          ],
          [
            23.780664,
            90.353585
          ],
          [
            23.780664,
            90.353585
          ],
          [
            23.780862,
            90.353182
          ],
          [
            23.780862,
            90.353182
          ],
          [
            23.780922,
            90.35306
          ],
          [
            23.780922,
            90.35306
          ],
          [
            23.781037,
            90.352829
          ],
          [
            23.781037,
            90.352829
          ],
          [
            23.781303,
            90.352344
          ]
        ]
      },
      {
        "from": "bikolpo-kalyan-pur",
        "to": "bikolpo-shyamoli",
        "km": 0.719,
        "geometry": [
          [
            23.778616,
            90.359892
          ],
          [
            23.774911,
            90.365685
          ]
        ]
      },
      {
        "from": "bikolpo-shyamoli",
        "to": "bikolpo-shishu-mela",
        "km": 1.37,
        "geometry": [
          [
            23.774911,
            90.365685
          ],
          [
            23.763633,
            90.371105
          ]
        ]
      },
      {
        "from": "bikolpo-shishu-mela",
        "to": "bikolpo-asad-gate",
        "km": 0.441,
        "geometry": [
          [
            23.763633,
            90.371105
          ],
          [
            23.760112,
            90.373094
          ]
        ]
      },
      {
        "from": "bikolpo-asad-gate",
        "to": "bikolpo-dhanmondi-27",
        "km": 0.462,
        "geometry": [
          [
            23.756477,
            90.375289
          ],
          [
            23.7569,
            90.375033
          ],
          [
            23.7569,
            90.375033
          ],
          [
            23.757426,
            90.374714
          ],
          [
            23.757426,
            90.374714
          ],
          [
            23.757454,
            90.374697
          ],
          [
            23.757454,
            90.374697
          ],
          [
            23.758112,
            90.374299
          ],
          [
            23.758112,
            90.374299
          ],
          [
            23.758368,
            90.374144
          ],
          [
            23.758368,
            90.374144
          ],
          [
            23.75868,
            90.373954
          ],
          [
            23.75868,
            90.373954
          ],
          [
            23.758966,
            90.373782
          ],
          [
            23.758966,
            90.373782
          ],
          [
            23.75923,
            90.373621
          ],
          [
            23.75923,
            90.373621
          ],
          [
            23.759257,
            90.373605
          ],
          [
            23.759257,
            90.373605
          ],
          [
            23.759773,
            90.373293
          ],
          [
            23.759773,
            90.373293
          ],
          [
            23.760112,
            90.373094
          ]
        ]
      },
      {
        "from": "bikolpo-dhanmondi-27",
        "to": "bikolpo-metro-shopping",
        "km": 0.51,
        "geometry": [
          [
            23.752432,
            90.377642
          ],
          [
            23.75279,
            90.377442
          ],
          [
            23.75279,
            90.377442
          ],
          [
            23.753719,
            90.376922
          ],
          [
            23.753719,
            90.376922
          ],
          [
            23.753913,
            90.376814
          ],
          [
            23.753913,
            90.376814
          ],
          [
            23.754214,
            90.376645
          ],
          [
            23.754214,
            90.376645
          ],
          [
            23.754532,
            90.376467
          ],
          [
            23.754532,
            90.376467
          ],
          [
            23.754717,
            90.376355
          ],
          [
            23.754717,
            90.376355
          ],
          [
            23.755018,
            90.376173
          ],
          [
            23.755018,
            90.376173
          ],
          [
            23.755205,
            90.376059
          ],
          [
            23.755205,
            90.376059
          ],
          [
            23.755557,
            90.375846
          ],
          [
            23.755557,
            90.375846
          ],
          [
            23.7557,
            90.37576
          ],
          [
            23.7557,
            90.37576
          ],
          [
            23.756,
            90.375578
          ],
          [
            23.756,
            90.375578
          ],
          [
            23.756477,
            90.375289
          ]
        ]
      },
      {
        "from": "bikolpo-metro-shopping",
        "to": "bikolpo-kalabagan",
        "km": 0.608,
        "geometry": [
          [
            23.747599,
            90.380444
          ],
          [
            23.747659,
            90.380409
          ],
          [
            23.747659,
            90.380409
          ],
          [
            23.748319,
            90.380024
          ],
          [
            23.748319,
            90.380024
          ],
          [
            23.748594,
            90.379863
          ],
          [
            23.748594,
            90.379863
          ],
          [
            23.749404,
            90.37939
          ],
          [
            23.749404,
            90.37939
          ],
          [
            23.749486,
            90.379342
          ],
          [
            23.749486,
            90.379342
          ],
          [
            23.750021,
            90.37903
          ],
          [
            23.750021,
            90.37903
          ],
          [
            23.750691,
            90.378639
          ],
          [
            23.750691,
            90.378639
          ],
          [
            23.751259,
            90.378308
          ],
          [
            23.751259,
            90.378308
          ],
          [
            23.751619,
            90.378098
          ],
          [
            23.751619,
            90.378098
          ],
          [
            23.751757,
            90.378021
          ],
          [
            23.751757,
            90.378021
          ],
          [
            23.752432,
            90.377642
          ]
        ]
      },
      {
        "from": "bikolpo-kalabagan",
        "to": "bikolpo-labaid",
        "km": 0.71,
        "geometry": [
          [
            23.74167,
            90.382857
          ],
          [
            23.741698,
            90.38285
          ],
          [
            23.741698,
            90.38285
          ],
          [
            23.742734,
            90.382608
          ],
          [
            23.742734,
            90.382608
          ],
          [
            23.743259,
            90.382486
          ],
          [
            23.743259,
            90.382486
          ],
          [
            23.743692,
            90.38237
          ],
          [
            23.743692,
            90.38237
          ],
          [
            23.744738,
            90.38209
          ],
          [
            23.744738,
            90.38209
          ],
          [
            23.745349,
            90.381742
          ],
          [
            23.745349,
            90.381742
          ],
          [
            23.745654,
            90.381569
          ],
          [
            23.745654,
            90.381569
          ],
          [
            23.746071,
            90.381332
          ],
          [
            23.746071,
            90.381332
          ],
          [
            23.746297,
            90.381204
          ],
          [
            23.746297,
            90.381204
          ],
          [
            23.746509,
            90.38108
          ],
          [
            23.746509,
            90.38108
          ],
          [
            23.74664,
            90.381003
          ],
          [
            23.74664,
            90.381003
          ],
          [
            23.747192,
            90.380681
          ],
          [
            23.747192,
            90.380681
          ],
          [
            23.747599,
            90.380444
          ]
        ]
      },
      {
        "from": "bikolpo-labaid",
        "to": "bikolpo-new-market",
        "km": 1.004,
        "geometry": [
          [
            23.74167,
            90.382857
          ],
          [
            23.732862,
            90.385008
          ]
        ]
      },
      {
        "from": "bikolpo-new-market",
        "to": "bikolpo-tsc",
        "km": 0.986,
        "geometry": [
          [
            23.732862,
            90.385008
          ],
          [
            23.732855,
            90.394696
          ]
        ]
      }
    ]
  },
  {
    "id": "uttara_bus",
    "name": "Uttara bus",
    "service": "uttara_bus",
    "mode": "bus",
    "totalKm": 19.41,
    "stops": [
      "uttara-bus-brtc",
      "uttara-bus-rajuk",
      "uttara-bus-azampur",
      "uttara-bus-rajlokkhi",
      "uttara-bus-jashim-uddin",
      "uttara-bus-khilkhet",
      "uttara-bus-kuril",
      "uttara-bus-shewra",
      "uttara-bus-mes-bus-stop",
      "uttara-bus-banani",
      "uttara-bus-mohakhali",
      "uttara-bus-jahangir-gate",
      "uttara-bus-bijoy-sarani",
      "uttara-bus-farmgate",
      "metro-karwan-bazar",
      "uttara-bus-bangla-motor",
      "uttara-bus-sheraton",
      "metro-shahbagh",
      "uttara-bus-kakrail",
      "metro-bangladesh-secretariat"
    ],
    "hops": [
      {
        "from": "uttara-bus-brtc",
        "to": "uttara-bus-rajuk",
        "km": 0.556,
        "geometry": [
          [
            23.872095,
            90.40083
          ],
          [
            23.872582,
            90.400869
          ],
          [
            23.872582,
            90.400869
          ],
          [
            23.873096,
            90.400902
          ],
          [
            23.873096,
            90.400902
          ],
          [
            23.873556,
            90.400907
          ],
          [
            23.873556,
            90.400907
          ],
          [
            23.874047,
            90.400857
          ],
          [
            23.874047,
            90.400857
          ],
          [
            23.874657,
            90.400785
          ],
          [
            23.874657,
            90.400785
          ],
          [
            23.874651,
            90.400591
          ],
          [
            23.874651,
            90.400591
          ],
          [
            23.87597,
            90.400781
          ],
          [
            23.87597,
            90.400781
          ],
          [
            23.876116,
            90.400821
          ],
          [
            23.876116,
            90.400821
          ],
          [
            23.876867,
            90.401026
          ]
        ]
      },
      {
        "from": "uttara-bus-rajuk",
        "to": "uttara-bus-azampur",
        "km": 0.489,
        "geometry": [
          [
            23.867923,
            90.400331
          ],
          [
            23.869504,
            90.400402
          ],
          [
            23.869504,
            90.400402
          ],
          [
            23.871021,
            90.400502
          ],
          [
            23.871021,
            90.400502
          ],
          [
            23.871418,
            90.400532
          ],
          [
            23.871418,
            90.400532
          ],
          [
            23.872096,
            90.400596
          ],
          [
            23.872096,
            90.400596
          ],
          [
            23.872095,
            90.40083
          ]
        ]
      },
      {
        "from": "uttara-bus-azampur",
        "to": "uttara-bus-rajlokkhi",
        "km": 0.408,
        "geometry": [
          [
            23.867923,
            90.400331
          ],
          [
            23.867932,
            90.400504
          ],
          [
            23.867932,
            90.400504
          ],
          [
            23.867266,
            90.40048
          ],
          [
            23.867266,
            90.40048
          ],
          [
            23.866744,
            90.40044
          ],
          [
            23.866744,
            90.40044
          ],
          [
            23.866221,
            90.400408
          ],
          [
            23.866221,
            90.400408
          ],
          [
            23.865654,
            90.400377
          ],
          [
            23.865654,
            90.400377
          ],
          [
            23.865094,
            90.400344
          ],
          [
            23.865094,
            90.400344
          ],
          [
            23.864429,
            90.400302
          ]
        ]
      },
      {
        "from": "uttara-bus-rajlokkhi",
        "to": "uttara-bus-jashim-uddin",
        "km": 0.432,
        "geometry": [
          [
            23.860737,
            90.400394
          ],
          [
            23.860757,
            90.400574
          ],
          [
            23.860757,
            90.400574
          ],
          [
            23.861232,
            90.400429
          ],
          [
            23.861232,
            90.400429
          ],
          [
            23.861691,
            90.400282
          ],
          [
            23.861691,
            90.400282
          ],
          [
            23.862175,
            90.400199
          ],
          [
            23.862175,
            90.400199
          ],
          [
            23.862663,
            90.400198
          ],
          [
            23.862663,
            90.400198
          ],
          [
            23.86315,
            90.400228
          ],
          [
            23.86315,
            90.400228
          ],
          [
            23.863624,
            90.400255
          ],
          [
            23.863624,
            90.400255
          ],
          [
            23.864429,
            90.400302
          ]
        ]
      },
      {
        "from": "uttara-bus-jashim-uddin",
        "to": "uttara-bus-khilkhet",
        "km": 4.154,
        "geometry": [
          [
            23.828786,
            90.419952
          ],
          [
            23.832955,
            90.41925
          ],
          [
            23.832955,
            90.41925
          ],
          [
            23.835634,
            90.418794
          ],
          [
            23.835634,
            90.418794
          ],
          [
            23.837227,
            90.418367
          ],
          [
            23.837227,
            90.418367
          ],
          [
            23.838712,
            90.417852
          ],
          [
            23.838712,
            90.417852
          ],
          [
            23.840885,
            90.416504
          ],
          [
            23.854769,
            90.405082
          ],
          [
            23.854769,
            90.405082
          ],
          [
            23.854894,
            90.404976
          ],
          [
            23.854894,
            90.404976
          ],
          [
            23.855136,
            90.404772
          ],
          [
            23.855136,
            90.404772
          ],
          [
            23.859635,
            90.401095
          ],
          [
            23.860737,
            90.400394
          ]
        ]
      },
      {
        "from": "uttara-bus-khilkhet",
        "to": "uttara-bus-kuril",
        "km": 0.831,
        "geometry": [
          [
            23.828786,
            90.419952
          ],
          [
            23.82683,
            90.420275
          ],
          [
            23.82683,
            90.420275
          ],
          [
            23.824999,
            90.420459
          ],
          [
            23.823607,
            90.420262
          ],
          [
            23.823607,
            90.420262
          ],
          [
            23.822765,
            90.419859
          ],
          [
            23.821667,
            90.419038
          ]
        ]
      },
      {
        "from": "uttara-bus-kuril",
        "to": "uttara-bus-shewra",
        "km": 0.518,
        "geometry": [
          [
            23.821667,
            90.419038
          ],
          [
            23.820968,
            90.41813
          ],
          [
            23.820968,
            90.41813
          ],
          [
            23.820452,
            90.417356
          ],
          [
            23.820452,
            90.417356
          ],
          [
            23.818866,
            90.414977
          ]
        ]
      },
      {
        "from": "uttara-bus-shewra",
        "to": "uttara-bus-mes-bus-stop",
        "km": 1.06,
        "geometry": [
          [
            23.818866,
            90.414977
          ],
          [
            23.816025,
            90.405028
          ]
        ]
      },
      {
        "from": "uttara-bus-mes-bus-stop",
        "to": "uttara-bus-banani",
        "km": 2.432,
        "geometry": [
          [
            23.816025,
            90.405028
          ],
          [
            23.794465,
            90.401034
          ]
        ]
      },
      {
        "from": "uttara-bus-banani",
        "to": "uttara-bus-mohakhali",
        "km": 1.503,
        "geometry": [
          [
            23.794465,
            90.401034
          ],
          [
            23.791387,
            90.400537
          ],
          [
            23.791387,
            90.400537
          ],
          [
            23.790553,
            90.400404
          ],
          [
            23.790553,
            90.400404
          ],
          [
            23.789087,
            90.400155
          ],
          [
            23.789087,
            90.400155
          ],
          [
            23.788075,
            90.39998
          ],
          [
            23.788075,
            90.39998
          ],
          [
            23.781108,
            90.398782
          ]
        ]
      },
      {
        "from": "uttara-bus-mohakhali",
        "to": "uttara-bus-jahangir-gate",
        "km": 1.157,
        "geometry": [
          [
            23.775444,
            90.390938
          ],
          [
            23.775788,
            90.392729
          ],
          [
            23.775788,
            90.392729
          ],
          [
            23.776111,
            90.393522
          ],
          [
            23.776111,
            90.393522
          ],
          [
            23.776136,
            90.393562
          ],
          [
            23.776136,
            90.393562
          ],
          [
            23.776365,
            90.393935
          ],
          [
            23.776365,
            90.393935
          ],
          [
            23.776498,
            90.394166
          ],
          [
            23.776498,
            90.394166
          ],
          [
            23.776531,
            90.394372
          ],
          [
            23.776531,
            90.394372
          ],
          [
            23.777088,
            90.395367
          ],
          [
            23.777088,
            90.395367
          ],
          [
            23.777147,
            90.395467
          ],
          [
            23.777147,
            90.395467
          ],
          [
            23.77757,
            90.396186
          ],
          [
            23.77757,
            90.396186
          ],
          [
            23.77768,
            90.396376
          ],
          [
            23.77768,
            90.396376
          ],
          [
            23.778129,
            90.397302
          ],
          [
            23.778129,
            90.397302
          ],
          [
            23.778193,
            90.397542
          ],
          [
            23.778193,
            90.397542
          ],
          [
            23.778192,
            90.39762
          ],
          [
            23.778192,
            90.39762
          ],
          [
            23.778192,
            90.397737
          ],
          [
            23.778192,
            90.397737
          ],
          [
            23.778191,
            90.397957
          ],
          [
            23.778191,
            90.397957
          ],
          [
            23.77819,
            90.398352
          ],
          [
            23.77819,
            90.398352
          ],
          [
            23.778318,
            90.398359
          ],
          [
            23.778318,
            90.398359
          ],
          [
            23.778817,
            90.398429
          ],
          [
            23.778817,
            90.398429
          ],
          [
            23.779681,
            90.398525
          ],
          [
            23.779681,
            90.398525
          ],
          [
            23.779732,
            90.39853
          ],
          [
            23.779732,
            90.39853
          ],
          [
            23.780114,
            90.398599
          ],
          [
            23.780114,
            90.398599
          ],
          [
            23.780476,
            90.398665
          ],
          [
            23.780476,
            90.398665
          ],
          [
            23.781108,
            90.398782
          ]
        ]
      },
      {
        "from": "uttara-bus-jahangir-gate",
        "to": "uttara-bus-bijoy-sarani",
        "km": 1.246,
        "geometry": [
          [
            23.775444,
            90.390938
          ],
          [
            23.775235,
            90.3898
          ],
          [
            23.775235,
            90.3898
          ],
          [
            23.773739,
            90.389965
          ],
          [
            23.773739,
            90.389965
          ],
          [
            23.772397,
            90.389864
          ],
          [
            23.772397,
            90.389864
          ],
          [
            23.768159,
            90.389269
          ],
          [
            23.768159,
            90.389269
          ],
          [
            23.767015,
            90.389116
          ],
          [
            23.767015,
            90.389116
          ],
          [
            23.76626,
            90.389108
          ],
          [
            23.76626,
            90.389108
          ],
          [
            23.765148,
            90.389064
          ]
        ]
      },
      {
        "from": "uttara-bus-bijoy-sarani",
        "to": "uttara-bus-farmgate",
        "km": 0.761,
        "geometry": [
          [
            23.765148,
            90.389064
          ],
          [
            23.758382,
            90.390157
          ]
        ]
      },
      {
        "from": "uttara-bus-farmgate",
        "to": "metro-karwan-bazar",
        "km": 0.961,
        "geometry": [
          [
            23.758382,
            90.390157
          ],
          [
            23.75022,
            90.393274
          ]
        ]
      },
      {
        "from": "metro-karwan-bazar",
        "to": "uttara-bus-bangla-motor",
        "km": 0.576,
        "geometry": [
          [
            23.75022,
            90.393274
          ],
          [
            23.749833,
            90.393422
          ],
          [
            23.749833,
            90.393422
          ],
          [
            23.747052,
            90.394407
          ],
          [
            23.747052,
            90.394407
          ],
          [
            23.74593,
            90.394775
          ],
          [
            23.74593,
            90.394775
          ],
          [
            23.745277,
            90.394976
          ]
        ]
      },
      {
        "from": "uttara-bus-bangla-motor",
        "to": "uttara-bus-sheraton",
        "km": 0.352,
        "geometry": [
          [
            23.745277,
            90.394976
          ],
          [
            23.744603,
            90.395171
          ],
          [
            23.744603,
            90.395171
          ],
          [
            23.744029,
            90.395356
          ],
          [
            23.744029,
            90.395356
          ],
          [
            23.74373,
            90.39546
          ],
          [
            23.74373,
            90.39546
          ],
          [
            23.742772,
            90.395794
          ],
          [
            23.742772,
            90.395794
          ],
          [
            23.742628,
            90.395825
          ],
          [
            23.742628,
            90.395825
          ],
          [
            23.742234,
            90.395911
          ]
        ]
      },
      {
        "from": "uttara-bus-sheraton",
        "to": "metro-shahbagh",
        "km": 0.469,
        "geometry": [
          [
            23.742234,
            90.395911
          ],
          [
            23.741405,
            90.39606
          ],
          [
            23.741405,
            90.39606
          ],
          [
            23.741201,
            90.396087
          ],
          [
            23.741201,
            90.396087
          ],
          [
            23.738365,
            90.395941
          ],
          [
            23.738365,
            90.395941
          ],
          [
            23.738331,
            90.396047
          ],
          [
            23.738331,
            90.396047
          ],
          [
            23.738265,
            90.396151
          ],
          [
            23.738265,
            90.396151
          ],
          [
            23.738159,
            90.396206
          ]
        ]
      },
      {
        "from": "metro-shahbagh",
        "to": "uttara-bus-kakrail",
        "km": 0.924,
        "geometry": [
          [
            23.733836,
            90.403085
          ],
          [
            23.733926,
            90.402489
          ],
          [
            23.733926,
            90.402489
          ],
          [
            23.734048,
            90.40213
          ],
          [
            23.734048,
            90.40213
          ],
          [
            23.734091,
            90.402004
          ],
          [
            23.734091,
            90.402004
          ],
          [
            23.734386,
            90.401364
          ],
          [
            23.734386,
            90.401364
          ],
          [
            23.734534,
            90.401044
          ],
          [
            23.734534,
            90.401044
          ],
          [
            23.734843,
            90.400825
          ],
          [
            23.734843,
            90.400825
          ],
          [
            23.735294,
            90.400573
          ],
          [
            23.735294,
            90.400573
          ],
          [
            23.73609,
            90.400129
          ],
          [
            23.73609,
            90.400129
          ],
          [
            23.736151,
            90.400095
          ],
          [
            23.736151,
            90.400095
          ],
          [
            23.73672,
            90.399771
          ],
          [
            23.73672,
            90.399771
          ],
          [
            23.736929,
            90.399652
          ],
          [
            23.736929,
            90.399652
          ],
          [
            23.737337,
            90.399388
          ],
          [
            23.737337,
            90.399388
          ],
          [
            23.7375,
            90.399223
          ],
          [
            23.7375,
            90.399223
          ],
          [
            23.737542,
            90.399181
          ],
          [
            23.737542,
            90.399181
          ],
          [
            23.737565,
            90.399135
          ],
          [
            23.737565,
            90.399135
          ],
          [
            23.737598,
            90.399071
          ],
          [
            23.737598,
            90.399071
          ],
          [
            23.737696,
            90.398881
          ],
          [
            23.737696,
            90.398881
          ],
          [
            23.737884,
            90.398378
          ],
          [
            23.737884,
            90.398378
          ],
          [
            23.738025,
            90.397914
          ],
          [
            23.738025,
            90.397914
          ],
          [
            23.738085,
            90.397574
          ],
          [
            23.738085,
            90.397574
          ],
          [
            23.738157,
            90.396926
          ],
          [
            23.738157,
            90.396926
          ],
          [
            23.738159,
            90.396206
          ]
        ]
      },
      {
        "from": "uttara-bus-kakrail",
        "to": "metro-bangladesh-secretariat",
        "km": 0.579,
        "geometry": [
          [
            23.730008,
            90.405848
          ],
          [
            23.729986,
            90.40543
          ],
          [
            23.729986,
            90.40543
          ],
          [
            23.730048,
            90.405378
          ],
          [
            23.730048,
            90.405378
          ],
          [
            23.730104,
            90.405316
          ],
          [
            23.730104,
            90.405316
          ],
          [
            23.730144,
            90.405239
          ],
          [
            23.730144,
            90.405239
          ],
          [
            23.730182,
            90.405168
          ],
          [
            23.730182,
            90.405168
          ],
          [
            23.730238,
            90.405056
          ],
          [
            23.730238,
            90.405056
          ],
          [
            23.73054,
            90.404959
          ],
          [
            23.73054,
            90.404959
          ],
          [
            23.731223,
            90.404822
          ],
          [
            23.731223,
            90.404822
          ],
          [
            23.731405,
            90.404789
          ],
          [
            23.731405,
            90.404789
          ],
          [
            23.731818,
            90.404716
          ],
          [
            23.731818,
            90.404716
          ],
          [
            23.732125,
            90.404661
          ],
          [
            23.732125,
            90.404661
          ],
          [
            23.732504,
            90.404541
          ],
          [
            23.732504,
            90.404541
          ],
          [
            23.732528,
            90.404533
          ],
          [
            23.732528,
            90.404533
          ],
          [
            23.732918,
            90.404307
          ],
          [
            23.732918,
            90.404307
          ],
          [
            23.732997,
            90.404244
          ],
          [
            23.732997,
            90.404244
          ],
          [
            23.733354,
            90.403955
          ],
          [
            23.733354,
            90.403955
          ],
          [
            23.733614,
            90.403793
          ],
          [
            23.733614,
            90.403793
          ],
          [
            23.733726,
            90.403793
          ],
          [
            23.733726,
            90.403793
          ],
          [
            23.733746,
            90.403667
          ],
          [
            23.733746,
            90.403667
          ],
          [
            23.733836,
            90.403085
          ]
        ]
      }
    ]
  }
];

export const WALKS = [
  {
    "from": "metro-pallabi",
    "to": "bikolpo-mirpur-12",
    "km": 0.304,
    "straightKm": 0.243
  },
  {
    "from": "metro-bijoy-sarani",
    "to": "uttara-bus-bijoy-sarani",
    "km": 0.773,
    "straightKm": 0.618
  },
  {
    "from": "metro-farmgate",
    "to": "uttara-bus-bijoy-sarani",
    "km": 0.918,
    "straightKm": 0.734
  },
  {
    "from": "metro-farmgate",
    "to": "uttara-bus-farmgate",
    "km": 0.493,
    "straightKm": 0.394
  },
  {
    "from": "metro-shahbagh",
    "to": "bikolpo-tsc",
    "km": 0.95,
    "straightKm": 0.76
  },
  {
    "from": "metro-shahbagh",
    "to": "uttara-bus-bangla-motor",
    "km": 0.803,
    "straightKm": 0.642
  },
  {
    "from": "metro-dhaka-university",
    "to": "bikolpo-tsc",
    "km": 0.357,
    "straightKm": 0.285
  },
  {
    "from": "metro-dhaka-university",
    "to": "uttara-bus-kakrail",
    "km": 0.842,
    "straightKm": 0.673
  },
  {
    "from": "bikolpo-shishu-mela",
    "to": "bikolpo-dhanmondi-27",
    "km": 1.128,
    "straightKm": 0.902
  },
  {
    "from": "bikolpo-asad-gate",
    "to": "bikolpo-metro-shopping",
    "km": 1.214,
    "straightKm": 0.971
  },
  {
    "from": "bikolpo-tsc",
    "to": "uttara-bus-kakrail",
    "km": 1.076,
    "straightKm": 0.861
  },
  {
    "from": "uttara-bus-brtc",
    "to": "uttara-bus-azampur",
    "km": 1.246,
    "straightKm": 0.997
  },
  {
    "from": "uttara-bus-rajuk",
    "to": "uttara-bus-rajlokkhi",
    "km": 1.068,
    "straightKm": 0.854
  },
  {
    "from": "uttara-bus-azampur",
    "to": "uttara-bus-jashim-uddin",
    "km": 0.999,
    "straightKm": 0.799
  }
];

export const TRANSFERS = [
  {
    "hub": "metro-mirpur-11",
    "services": [
      "bikolpo",
      "mrt6"
    ],
    "names": [
      "Mirpur 11",
      "Purobi Hall"
    ],
    "metres": 19,
    "rule": "same kerb"
  },
  {
    "hub": "metro-mirpur-10",
    "services": [
      "bikolpo",
      "mrt6"
    ],
    "names": [
      "Mirpur 10"
    ],
    "metres": 58,
    "rule": "same name"
  },
  {
    "hub": "metro-karwan-bazar",
    "services": [
      "mrt6",
      "uttara_bus"
    ],
    "names": [
      "Karwan Bazar"
    ],
    "metres": 160,
    "rule": "same name"
  },
  {
    "hub": "metro-shahbagh",
    "services": [
      "mrt6",
      "uttara_bus"
    ],
    "names": [
      "Shahbagh",
      "Shahbag"
    ],
    "metres": 159,
    "rule": "shared name token"
  },
  {
    "hub": "metro-bangladesh-secretariat",
    "services": [
      "mrt6",
      "uttara_bus"
    ],
    "names": [
      "Bangladesh Secretariat",
      "Secretariat"
    ],
    "metres": 206,
    "rule": "shared name token"
  }
];
