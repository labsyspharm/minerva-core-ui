import type {
  LegacyExhibitArrow,
  LegacyExhibitOverlay,
  LegacyExhibitWaypoint,
} from "@/lib/stores/storeUtils";

const configWaypoints: LegacyExhibitWaypoint[] = [
  {
    UUID: "8320f08c-9456-49a3-a104-8ab3d5daab2a",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,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",
      Name: "Introduction",
      Content:
        "This Minerva introduction accompanies the analysis in Lin et al 2021 of specimen CRC1, a poorly differentiated stage IIIB adenocarcinoma (pT3N1bM0) with microsatellite instability (MSI-H) and a BRAFV600E (c.1799T>A) mutation. The tumor along with adjacent normal tissue was imaged using 24-plex cyclic immunofluorescence at a nominal resolution of 0.5 micron.",
      Pan: [0.481913716814159, 0.5],
      Zoom: 0.518359375,
      Group: "Hematoxylin & Eosin",
    },
    Arrows: [],
    Overlays: [],
  },
  {
    UUID: "29180ca9-990e-4eca-8489-4d72db82adee",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,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",
      Name: "Clinical History",
      Content:
        "The tumor is derived from a 69-year old male with a history of cutaneous melanoma and gastric MALT lymphoma associated with helicobacter pylori infection. He presented to medical attention following several syncopal episodes and falls thought to be secondary to anemia and orthostatic hypotension. Colonoscopy revealed a mass in the right ascending colon. He underwent hemicolectomy revealing a 6.2cm exophytic mass involving the ascending colon, cecum, and terminal ileum. \n\nHe underwent right hemicolectomy and the specimen was examined by pathology. \n\nPATHOLOGIC DIAGNOSIS:\n\nINVASIVE ADENOCARCINOMA, high grade (poorly differentiated, grade III), with mucinous and signet ring cell features (6.2cm)\n\nThe tumor resection margins were negative for involvement by adenoma, dysplasia, and adenocarcinoma.\n \nLymphovascular invasion (LVI) was identified at the time of pathologic evaluation of the whole specimen, but is not identified in this tissue section. \n\nPerineural invasion (PNI) was not identified. \n\nNo tumor deposits were present.\n\nThe tumor was associated with a villous adenoma. \n\n3/25 local lymph nodes were positive for involvement by metastatic adenocarcinoma. \n\nMolecular testing was notable for the presence of a BRAF V600E mutation, and microsatellite instability (MSI-H). \n\nAJCC Classification (8th Ediiton) - pT3N1b\n",
      Pan: [0.481913716814159, 0.5],
      Zoom: 0.518359375,
      Group: "Hematoxylin & Eosin",
    },
    Arrows: [],
    Overlays: [],
  },
  {
    UUID: "dac02fed-dcd8-4e77-829e-57d247c07d18",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,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",
      Name: "Tissue Organization [Histology]",
      Content:
        'The colorectum is typically conceptually organized into anatomic layers, which are described proceeding from the luminal surface to the serosal surface. \n\nMucosa - The mucosa occupies the luminal surface of the colorectum and accomplishes the primary functions of the bowel including nutrient absorption, facilitation of waste excretion, and regulation of the enteral microbiome. Histologically, the mucosa consists of a surface columnar epithelium bounded by basement membrane and underlying stroma which is densely populated by chronic inflammatory cells including lymphocytes, monocytic cells, and eosinophils with only rare neutrophils in the resting state (see immune populations marker set). The epithelium exhibits regular invaginations into the stroma with a circumferential parallel array of tubular epithelial "crypts" which are arrayed similar to a rack of test tubes, with openings into the bowl lumen. In this section, crypts can be seen in cross-section and in longitudinal profile. The epithelium consists of a mixture of cell types, including prominent mucinous goblet cells which exhibit a clear cytoplasm in standard H&E sections (resulting from a washing out of the mucinous contents during tissue processing), absorptive cells which exhibit a more eosinophilic cytoplasm, and more rarely interspersed neuroendocrine cells. The mucinous goblet cells are more prominent in the colorectum than in the small bowel. The deep aspect of the crypts is hypothesized to harbor stem-like progenitor cells which intermittently generate highly proliferative progenitor cells that terminal differentiate as they approach the luminal surface to continuously regenerate and replace the colorectal epithelial surface. Indeed, examination of the crypts with proliferation markers such as PCNA or Ki-67 shows a much higher degree of cell cycle activity in the deep aspects of the crypts (see proliferation marker set). \n\nMuscularis mucosa - The muscularis mucosa is a thin band of smooth muscle cells which delimits the deep edge of the mucosal compartment. The muscularis mucosa can be identified in this section as a brightly eosinophilic band of spindled cells at the deep surface of the mucosa on H&E. In tumor resections, invasion of atypical cells through the muscularis mucosa into the submucosa represents an important event, as this behavior is the definitive finding defining transition from an "in situ" carcinoma with essentially no metastatic risk (pTis), to an "invasive" carcinoma with associated increased risk of local or distant metastatic spread (pT1) [AJCC 8th Edition]. The muscularis mucosa can be highlighted here by observing the aSMA, desmin, or collagen channels in the Tissue Structure or Stroma marker sets, respectively. \n\nSubmucosa - The submucosa is a loose collagenous connective tissue structure interposed between the muscularis mucosa and muscularis propria. The submucosa contains a rich bed of lymphatic and blood vessels, and lymphovascular invasion (LVI) is often identified at this level if present. Involvement of the submucosa by tumor defines frank invasion in the colorectum (pT1). \n\nMuscularis propria - The muscularis propria is the thick smooth muscular wall of the bowel which is arranged into several distinct layer, principally including the longitudinal and circumferential layers in the colorectum (these can be seen here as the two distinct layers of smooth muscle oriented in different directions on H&E).  The muscularis regulates digestion by controlling peristalsis and moevement of the bowel wall. Invasion of an invasive adenocarcinoma into the muscularis propria represents a more advanced stage of invasion (pT2) with a higher risk of recurrence and metastatic spread (pT2). The muscularis mucosa can be highlighted here by observing the aSMA, desmin, or collagen channels in the Tissue Structure or Stroma marker sets, respectively. \n\nSubserosa - The subserosa is the loose fibroadipose connective tissue associated with the bowl wall which lies deep to the muscularis propria. Invasion of tumor into the subserosal soft tissue denotes a further progression of stage with increased risk of recurrence and metastatis (pT3). \n\nSerosa - The serosa is the final layer of the bowel wall. In the peritoneal cavity it is lined by a single layer of cuboidal mesothelial cells. Mesothelial cells are specialized epithelial cells and may sometimes cause confusion with invasive tumor when they undergo hyperplasia and reactive changes and exhibit clusters of cells with frond-like papillary architecture; however, they may be differentiated from other epithelial tumor cells by molecular markers including the absence of e-cadherin expression, and expression of mesothelial cell markers such as WT1 and calretinin (see Tissue Structure and E-Cadherin marker sets). In the retroperitoneum (some aspects of the right colon including the cecum), the serosal surface is bounded by a fibrous adventitial layer. Invasion of tumor through the serosal surface into the peritoneal cavity or adjacent structures represents the highest grade of local invasion, with the greatest risk of recurrence and metastatic spread (pT4). This section of bowel exhibits some hyperplasia of the mesothelial cell layer, giving it a more complex tufted appearance, but these cells may be confirmed as mesothelial and not surface involvement by morphologic features and marker expression (see E-cadherin marker set).\n\nIn this case, the tumor is present on the bottom aspect of the frame, while the serosal surface is present at the superior aspect. The bowel wall has been cut in an oblique plane, accounting for the convoluted appearance of the muscularis and serosa. \n\nThe tumor exhibits an exophytic (extending into the bowel lumen) growth pattern on the right-hand side of the field, with prominent mucinous pools generated by mucinous tumor cells present inferiorly extending as deeply as the muscularia propria. The tumor exhibits a moderately differentiated glandular appearance on the left-hand and bottom aspects of the field, while on the right side of the field in the exophytic region of tumor there are intermixed regions with a more poorly differentiated solid sheet-like architecture, with focal signet ring cell features and tumor budding. \n\nCollections of immune cells are present associated with the tumor, in addition to the normal immune complement of the bowel mucosa (see immune marker panels, and subsequent discussion).',
      Pan: [0.481913716814159, 0.5],
      Zoom: 0.518359375,
      Group: "Hematoxylin & Eosin",
    },
    Arrows: [
      {
        Angle: 300,
        HideArrow: false,
        Point: [0.807627524065269, 0.306258334920546],
        Text: "Mucosa",
      },
      {
        Angle: 300,
        HideArrow: false,
        Point: [0.765761996140962, 0.261043564762295],
        Text: "Muscularis Mucosa",
      },
      {
        Angle: 300,
        HideArrow: false,
        Point: [0.740642679386377, 0.214154173487071],
        Text: "Submucosa",
      },
      {
        Angle: 315,
        HideArrow: false,
        Point: [0.641002722926526, 0.155542434393041],
        Text: "Muscularis Propria",
      },
      {
        Angle: 325,
        HideArrow: false,
        Point: [0.519592691946036, 0.0994426269744693],
        Text: "Subserosa",
      },
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.146989493419702, 0.24680928526803],
        Text: "Serosa",
      },
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.0867031332087, 0.567499229168223],
        Text: "Invasive Adenocarcinoma, involving Muscularis Propria",
      },
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.191366953019468, 0.863069856313831],
        Text: "Invasive Adenocarcinoma, involving Submucosa",
      },
      {
        Angle: 30,
        HideArrow: false,
        Point: [0.398182660965545, 0.919169663732403],
        Text: "Invasive Adenocarcinoma, Superficial/luminal Surface",
      },
      {
        Angle: 30,
        HideArrow: false,
        Point: [0.265050282166248, 0.96103519165671],
        Text: "Ulcer Bed",
      },
      {
        Angle: 230,
        HideArrow: false,
        Point: [0.409905008784351, 0.640345247756517],
        Text: "Invasive Adenocarcinoma, with Mucinous Features",
      },
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.858684481416086, 0.531246000270804],
        Text: "Invasive Adenocarcinoma, with Solid Architecture",
      },
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.743403329861254, 0.370787100133673],
        Text: "Invasive Adenocarcinoma, with Signet Ring Cell Features",
      },
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.718867138820867, 0.500478395632859],
        Text: "Invasive Adenocarcinoma, Tumor Budding Region",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.844385457582811, 0.834212509419744],
        Text: "Bowel Lumen",
      },
      {
        Angle: 86,
        HideArrow: true,
        Point: [0.0869986737335296, 0.0954022705774824],
        Text: "Peritoneal Cavity",
      },
    ],
    Overlays: [],
  },
  {
    UUID: "7ab327d3-578b-4503-bb34-8dd17ffe847e",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,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",
      Name: "Tissue Organization [CyCIF]",
      Content:
        'Multiplexed immunofluorescence (CyCIF) effectively highlights the principle anatomic compartments of the tissue specimen. \n\nStroma  - Alpha smooth muscle actin (ASMA) [Red] - ASMA highlights smooth muscle cells and myofibroblasts. The muscularis propria is comprised of thick bundles of smooth muscle cells which stain intensely for ASMA in the center of the specimen. The muscularis mucosa is identifiable as a prominent band of ASMA-positive smooth muscle cells bounding the mucosal compartment on the upper right of the specimen. The smooth muscle layer (tunica media) of large veins and arteries and arterioles are also highlighted by ASMA, most prominently seen here in the submucosa and subserosa. Myofibroblasts are visible as spindled cells with less intense ASMA staining, most prominently in the stroma of the mucosa, submucosa, and subserosa. Note that not all stromal fibroblastic cells express ASMA. Smooth muscle cells are also prominently stained by desmin and vimentin, and associated with collagen bundles (see also Stroma marker set). \n\nEpithelial - Pan-Cytokeratin (PanCK) [White] - Pan-cytokeratin highlights both high and low molecular weight cytokeratin intermediate filaments which are specifically expressed by cells with epithelial differentiation in this tissue setting. Accordingly, PanCK intensely highlights normal mucosal epithelium, tumor epithelial cells, and mesothelial cells. Normal epithelium and tumor cells also express other epithelial adhesion molecules such as e-cadherin, but this protein is not present in serosal mesothelial cells (see also E-cadherin, NaK ATPase marker sets)\n\nVascular  - CD31 [Green] - CD31 (PECAM-1) is a cell adhesion molecule that is most strongly expressed on endothelial cells, though it may also be expressed by platelets, monocytes, neutrophils, and T cells. In this representation, the fluorescence intensity has been optimized to highlight endothelial cells, which line the luminal surface of all vascular structures. \n\nImmune - CD45 [Yellow] - CD45 (PTPRC) encodes a surface membrane protein tyrosine phosphatase that is expressed by nearly all hematolymphoid cell populations, and therefore represents an excellent "pan-immune" tissue marker. Prominent aggregates of immune cells are present both in the peritumoral compartment as well as normal structures. A variety of marker sets are available to identify specific cell populations. \n\n',
      Pan: [0.481913716814159, 0.5],
      Zoom: 0.518359375,
      Group: "Tissue Structure",
    },
    Arrows: [
      {
        Angle: 300,
        HideArrow: false,
        Point: [0.815749436482584, 0.316503391107762],
        Text: "Mucosa",
      },
      {
        Angle: 300,
        HideArrow: false,
        Point: [0.787866994884996, 0.269027882441597],
        Text: "Muscularis Mucosa",
      },
      {
        Angle: 300,
        HideArrow: false,
        Point: [0.745666542737294, 0.204973624717408],
        Text: "Submucosa",
      },
      {
        Angle: 300,
        HideArrow: false,
        Point: [0.641672571373315, 0.154483798040693],
        Text: "Muscularis Propria",
      },
      {
        Angle: 300,
        HideArrow: false,
        Point: [0.524616555296952, 0.0864941806916185],
        Text: "Subserosa",
      },
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.132755213925438, 0.260654776856736],
        Text: "Serosa",
      },
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.0850285120917276, 0.553713472326886],
        Text: "Invasive Adenocarcinoma, involving Muscularis Propria",
      },
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.191366953019468, 0.86770493175919],
        Text: "Invasive Adenocarcinoma, involving Submucosa",
      },
      {
        Angle: 30,
        HideArrow: false,
        Point: [0.418278114369212, 0.909570459683497],
        Text: "Invasive Adenocarcinoma, superficial/luminal surface",
      },
      {
        Angle: 30,
        HideArrow: false,
        Point: [0.276772629985054, 0.975717993803902],
        Text: "Ulcer Bed",
      },
      {
        Angle: 220,
        HideArrow: false,
        Point: [0.397345350407059, 0.645817633760362],
        Text: "Invasive Adenocarcinoma, with Mucinous Features",
      },
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.753202337763669, 0.378715565603282],
        Text: "Invasive Adenocarcinoma, with Signet Ring Cell Features",
      },
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.856443289976337, 0.533737010323139],
        Text: "Invasive Adenocarcinoma, with Solid Architecture",
      },
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.718707533645425, 0.504093567653586],
        Text: "Invasive Adenocarcinoma, Tumor Budding Region",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.844469188638659, 0.910240308130285],
        Text: "Bowel Lumen",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.0891690798501797, 0.100174053827581],
        Text: "Peritoneal Cavity",
      },
    ],
    Overlays: [],
  },
  {
    UUID: "a7c25aae-5851-404b-b15f-113e752f8f53",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,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",
      Name: "Regions of Interest - Overview",
      Content:
        "Contemporary pathologic classification of human colorectal adenocarcinomas is principally based on the light microscopic examination of hematoxylin and eosin (H&E) stained tissue sections (Fletcher 2013). The TNM staging system developed by the American Joint Commission on Cancer (AJCC) is the most widely accepted classification schema with high prognostic significance (Amin et al. 2017). Staging of the primary tumor mass is primarily based on the depth of invasion of tumor into the bowel wall (AJCC 8th Edition):\n\nT0 - No evidence of primary tumor\n\nTis - Carcinoma in situ\n\nT1 - Tumor invades submucosa\n\nT2 - Tumor invades muscularis propria\n\nT3 - Tumor invades through the muscularis propria into the pericolorectal tissue\n\nT4 - Tumor invades the visceral peritoneum or invades or adheres to adhacent organs or structures\n\nPrimary tumors may also be independently classified by a variety of morphologic features including grade (low grade vs. high grade), qualitative degree of differentiation (well, moderately, poorly differentiated), type of differentiation (e.g. serous, mucinous, signet ring cell, sarcomatoid), architecture features (glandular, solid, cribriform, budding architecture), \n\nOn histopathologic review this tumor exhibited highly heterogeneous morphologic features with distinct locoregional relationships between tumor region and differentiation. \n\nWe accordingly defined exemplar regions of interest (ROI) to compare tumor compartments with distinctive morphologies as well as different levels of anatomic invasion corresponding to clinicopathologic (AJCC) tumor stages. \n\nROI1 - Normal colonic mucosa\n\nROI2 - Invasive Adenocarvinoma, superficial/luminal\n\nROI3  - Invasive Adenocarcinoma, submucosal\n\nROI4  - Invasive Adenocarcinoma, muscularis\n\nROI5 - Invasive Adenocarcinoma, solid/poorly differentiated\n\nROI6 - Invasive Adenocarcinoma, mucinous\n\nROI7 - Invasive Adenocarcinoma, tumor budding",
      Pan: [0.481913716814159, 0.5],
      Zoom: 0.518359375,
      Group: "Hematoxylin & Eosin",
    },
    Arrows: [
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.106934423989135, 0.673880651886504],
        Text: "ROI4",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.240904113346918, 0.847622592772379],
        Text: "ROI3",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.382549149490824, 0.89227915589164],
        Text: "ROI2",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.725148719671404, 0.287322277385402],
        Text: "ROI1",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.855174256062348, 0.528461032283529],
        Text: "ROI5",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.440007770812969, 0.686038227665296],
        Text: "ROI6",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.733066466283119, 0.517994650302452],
        Text: "ROI7",
      },
    ],
    Overlays: [],
  },
  {
    UUID: "549b2a20-2541-441e-a6ca-b40323d4929d",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCABAAEADASIAAhEBAxEB/8QAGwAAAgMBAQEAAAAAAAAAAAAABgcDBAgCBQH/xAAsEAACAgIBAwMDBQEAAwAAAAABAgMEERIFBhMhACIxBxQyCBUjQVFCUoHx/8QAGAEAAwEBAAAAAAAAAAAAAAAAAwQFBgL/xAAoEQABBAEDAwIHAAAAAAAAAAABAAIDESEEEkETMWEF8BQiUXGBobH/2gAMAwEAAhEDEQA/AHLznN8b0z04EhaqL8LqsUVNwo2d28R7e47BRszAgarjPhgCdY9bXOR78cV2ZYTM0arGSjPB4UBTklNgoJU5Gf7/AOQGPM9udJRYimOgR9x2cagjHnCjAAGc+ScHPwZ7srWoLE8chmkdohK2oRScefc+P+sHX49pOfAJvM07WmzkrZx+nxxUZDfvyp5bcU0r1q3Gs8TorRqkexDHYLGp+QQAfjOSMkf49/p319UfpeKtcuUzNURI07UTKDD2l7bqB+RYlfGI/nAzgFlD09HTrcclqpNDFMmJJzbdTAkbYQNhZNmwxztjK75QBlAaRv3iWTkf2uCTkL5ErKgWNCZAQiDBVfcm0jgHXb2kKvkAc7GvFHhIayNkoIrATp6H68n5T7ePlYVjkeJjM0ddoxC6knD5JAOumVBypdf6YEHFC5XvQmWu5dQdSdSPP94/3/MjxkEf0fWc+D6i+ow4+rTi6K42xWo1zEO7bZ1SJ0RlDIp0kMgePyckHcsQp2Bfe4mfmpK/G8Bdqx8lw8aRyzJXaslXKpMui6FDJlvajDC7q7RuEVWnSRtJvsoskbNx4RZ111rzXA85W4/iukbPNVpoS8luIWSkTAuCjdmvKM+0D5zk+QB5Kf8A1CdUdU9b/R3qPpqz0Ta4KrNq83JWYr7wwQwSJYaZgKYOhEZX/wAgTkgDz60XREdPi4j3JHRI1T3Y2Zs4yf7LMT5yfn/36T/W30b57qluoOYt8p0ueX5etII68/DNNFWk7IijUTNJswUKAWKasSz9oHVVWSqzDT6a577E2oupuQYxK2QrSZ/LAkb+b2+ZAvkAfiPknJ9S4vqfkaPI8bHUikrw23M8yWwrO2rhd9mwV86BwRs5yygYPr5x0UNi3XpPasPTT5QMwHkrtkYwBhV/58lR/gYEfUNt+n+mTxltq9C7ddZ6hhqAmOJQ0BnAUYZpSFwzZAAdgE8M2gLQw03v+VstRtgst7+Tf9XgVOfrQ1mnh5KvVWWgFjm8R9yJdBCocAZB/wBGcYBdimxFyv1Pf4qkbPB2QVtaSzrYJYbZ9pIKyJopJJLe72+dPki3AUqt3kLF6aGH7rlt2mlkrK8b5Uw7e3bOgDHbJBZdgjMCSSfTnpOexXgpLd6fHFO0bSzPvLM5bVRBJEj91nbydQFXKEo47gZui1rW/OpcmoLgQRhB9e7yvM3HuW0WvCLDSi61ppRuQEYDOQzeWYN7fgMWGfd6f0/6j5zgka/3ZrM01xrdieyUYzyYDK6GZcyNqcE7HA8g4xl79DdLdHcbNN01c5bi+docrbeVopLUd5nkQyCNZnf4LoyyDtxx6So4MkhcbQXv078d3b8fF9RPSo2pS8cMtIWHiBB9m7P7l90g8jOpUZyCWB8bC62vFJDrsJypPoL1LyfXfUN6/wA3wrVv2REWskttmjhll7okdIintkAUxZZmITOpXuSB3XsN9c+cZHpX/Qro7qDpDk+p4ebghaGSWCKjdQRq1qGPuakqh8YDqPcNvkZKhcNHZQwXI2IJAz5IH/0epWo2dQ7OySfW7Czx+nrjanKX47kxQxSV0s101AOFkVnO2D7ldUUqSMrI3yMZX/1K5C+vLcZDX440ZrVOCtK2GjFNoEKs6jC41OxbJbAOCqkZLL+lHKNFd4eB+/G1ua1HJZKsYi+K5jUMrgkB4kyvwRIR+JYqCfqE4CxxvXly/YdJhb49oJNF27mzCSTSMK+jM2B+Pwykk67eqsZPXoqxqXuMh81+rtCnA8ffuP8At8bTfdGV4ocKkKl2QFVbK47jEaj+9lUAnABv9Y9UzcRFP0b0rXbiolD1+RbspHJO/b7LRSMFA1X3jDE5Zt/HtVKvDRhpzV5jlmrV5Sv300dhZFRivbaUIMlyuysQNSQoHnUMR/6oX6VjrXnb3ENcrVbKSzRy/cGVpQIzmQkjYF9Wk1J9pcfAHpygXZFgILi6sjCtdPCKz039na5eEjcWIprECH7SRYwFkTVCGzhRhgfcqMddSfRj9SOv/vermfnOpuEWrSevHHJX6be0kG0RfWWZ8sQrHVkYHLSI2oO6xoO3cpTWpa3F9QczPFJAnZe1ElcvNuq6yfzsqqF2bfLZOo1UHK3JZBx3UFSnDzVqeaB4zIv8Lw94yDZUeOaRZI9fO/nY+3UYz6nz7JyOEg4blpL9M/Zu/Us1Fv0rkVCvZuJLVrKP5VcV9TKRsVKSF9VOuSh8nI9ah9ZI/T71QnBchHxdC7clxZ7jVvwWcsQksZj27ZPlGWZ2QgRanCkqdb+kNTAYHbVw5paaKy90pyNm9bq2P3CCrNDKskUazlV7n5IPJGU0PlWIK4wCWAUmPL0eE60mTlzfdr80Yhs0DOe07qWRJ1ClVMqAsPJCkBvKj3lS8VTM6jioVj/coZsIYZY2Mrs6rhSmTI2uV1DFSpLAD3FyVIl5GelxBWA2lfspJShMjlFBLJ4YK58F9gSW9pJYHZaksYuwaWolhbkg1xfjn34+qCOV6dk4oNVmuU6zntsGQzDaNwrFmGhUqVjWQZGAR8ecgG5BZlmaaxurr3MNNnZvOSX/AOWJx/eBkfH9F29RWHtSTcD1RJGb1F2gg5NkYsqdzBikOA5j2OylRuoJA/Mj0K9a8BBQkMnB3KHMVeUjjinAiT7iq2A4cKBvh8NsUBRSXTYkAq1DLw5T3nb2z7+yX1F7R2ikrKkSIzI6V1aQNGrN7iMMVGw28sQvnDBVHrmw1MTSpBNYtVXCzMzwLAT8FguNhjwwDADO2SBkqJ1s2I3WF1iiqs8eEEaOjMAQAH+fAxlsgscZBIHrm/N9xHHYaPCKdSh1UOwc4wABhAAPGcf348D01eUEm8BddPSatKI55VZGWaMxp/NJ+QUCTbIGSmcn/PkgBnn9Kvqhz3TSnjOdl5TnIWlMipITYtlTFlFjLsoCe0szEsB8BRksEinJQiV4YViQzKwIlHcaQA5ZySfIwPyGPgfAJ9EPTZrLzNO7zLKtGnZgS5CqSmWSJ2bY5QeTgMfLAkfjnHgGoibI07ggPaKyv//Z",
      Name: "*ROI1 - Normal Mucosa",
      Content:
        "Region of Interest #1 (ROI1) consists of a region of normal colonic mucosa adjacent to the primary tumor mass. No cytologic atypia or adenomatous changes are evident.\n\nOne may appreciate the typical mucosal architecture including parallel test tube-like crypts see here in cross-section and longitudinal profile. The colonic epithelium is well-ordered with columnar absorptive cells and prominent mucinous goblet cells, small basal nuclei, and well-spaced glands with smooth contours. A normal mucosal germinal center responsible for B cell maturation and plasma cell differentiation is present in the top left of the field. The surface of the colorectum is normally a relatively flat surface, but the mucosa is curved and distorted here by the adjacent exophytic tumor mass. One may note the dense lymphocytic infiltrate in the mucosal stromal, which is a normal finding. ",
      Pan: [0.693199629921585, 0.35257607017735],
      Zoom: 1.85737536,
      Group: "Hematoxylin & Eosin",
    },
    Arrows: [
      {
        Angle: 210,
        HideArrow: false,
        Point: [0.616983210209847, 0.310703307581856],
        Text: "Germinal center",
      },
      {
        Angle: 310,
        HideArrow: false,
        Point: [0.804453730438995, 0.282016995085495],
        Text: "Colonic crypts in longitudinal profile",
      },
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.577318704807988, 0.402104124377444],
        Text: "Colonic crypts in cross-section",
      },
      {
        Angle: 60,
        HideArrow: false,
        Point: [0.707290413919064, 0.310619183498289],
        Text: "Mucosal stroma, with prominent immune infiltrate",
      },
      {
        Angle: 310,
        HideArrow: false,
        Point: [0.757344243641453, 0.256359149597548],
        Text: "Muscularis mucosa",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.79435884041095, 0.362355494892018],
        Text: "Bowel Lumen",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.737364773794281, 0.430916622999155],
        Text: "Adenocarcinoma, poorly differentiated region",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.710865687470663, 0.233645647034448],
        Text: "Submucosa",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.451132579457429, 0.395163887483164],
        Text: "Muscularis Propria",
      },
    ],
    Overlays: [
      {
        height: 0.0878255432439893,
        width: 0.246567688934993,
        x: 0.574515254951026,
        y: 0.252882790684345,
      },
      {
        height: 0.160004006944509,
        width: 0.0782353977173467,
        x: 0.558363430906155,
        y: 0.326070743387669,
      },
    ],
  },
  {
    UUID: "537f9079-6395-4d41-ada6-37f980433294",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCABAAEADASIAAhEBAxEB/8QAHAAAAQUBAQEAAAAAAAAAAAAABgADBAUHAggJ/8QALxAAAgICAgEDAgMJAQEAAAAAAQIDBAURBhITACEiBzEUMlEVFhcjQleRldIzUv/EABoBAAIDAQEAAAAAAAAAAAAAAAMFAQIEAAb/xAApEQABAwQABAUFAAAAAAAAAAABAAIRAxIhMSJBUfATYbHB4QRxgZHR/9oADAMBAAIRAxEAPwC253azEFyXkVbHQ5avCPLSpUofNRhg2xknl6gfygyOB2EaSMHfsVV1abhqXKMV9NKHK+Q8jkaPJWmelQWHtIZp6skUUz2Ce6aUhgg2o6IB1/pCoslwu9yTJZTkcNvKUGkdqleWwYJIVMaMC8kEAUqyokaRKekZDewDCT0V4e9yDkcz4TI3sHTLTRyV4EVa8SP0EarEYgEmAUhFJLaRFMZfen9E5pa0CO/L3TwPc+oC7Q9O9oiEnKucR45795IKFaONLUrxOsU6iVQ8rABlkUOoO3AX+WxGgJStUOV4h8fDFx3LzrQxdyKxXhmheeSOOOvWjXfj9lZpPP2ClVd5WPYbWQt5Dk8sPHpOPtcawtqB48ndjKRtY23duthgwY7E6q51vy76FupOcvGMDnMjip1x3c6WSWhI0kJB0Y3Q927J1+Wzo/M70ND1FKldM46BXqt44iBy/v3WvVuW8Kpcbq57BYsSXlmiio1pqftXmR5pCGKlB1I7BG6hj4lPzKMqTfpPXh5Fi81kxkTj89krs7WmrQIZscLMieLTFiRGTWPx12IkU7UKHOUxKMllCctiIb1xMcHG50VD7jQkMTKxfq0aMFPce7HQXZL8VWjuZWDGQ2MZkchaECh61WO5FXZiWsRK0kZhl1GDKSDqNlZEU9pCa1KIAMHP77CzVKTbZnKNuV8WoRZPNY/xy1azYuO/lMmBEpjlaScCVoY4QrN0jsK/uvdZGUnfQnNeK8d5JneV4vG3MuILuUxoD2aE5aSskcCTVgwXXQloIT9+p02iHBPo+4E2fXJWcZn5OOPlateCWrjHXylZ0Lbi79ikYClGEcZYRl1ZFABjNzicDgK31MxtSzlLTQY6eZKtS3OJpjYjMMkSeQgsYglpHWINpfEjnbeTQRVNMFuzHt35IV1otmcLB8Qa9SvjoL1KrlJqkYjqxyqJIIkaTzgxskhSZtu20dSB2VDv7Kc8bmwmPrXKOdxTZqdCTCJHMZggDJ1KSqPbv5DsLrYiGyCNeq7B42xRx1jK3UjxtVK7RwTIgWSZygLqF9uvxZuxI2o7b12CyQ8jdtmCnBPi60sy1XMcCk9n6/IvK+xtVjCkqxHVFHYr8m9anm8wnVSixlO07nMYwokErZXKW8XPYV7dt0nkpLEqHsX10ToCoPY/l0QPtr3A9Qs3Lk58SaxSnJNXq/hrEzM8szEp1Eh7np2UIiAn8qqnXr7n03nEmipQ2YqNjE0niSM5K1VIDsY+k5ToraWTf/0+1Yn4jqq8S4uzlEtSVeTQvbj7irDIZNS92CqB0j+IPz2ZAGK7ITQ2CCGi7ksbqwe3ITN8nH2Li/tOg0xPjhd4ZJC8UjfeJQo6H2f2br8R76IUEooZxa2Sws/4oFYS8SNPUQmNlkTtC9uGPc5692ZggPSdtsxdlNdZ49GmIjlzGRryWo/JUN6B2cGWIN5FIG+y9mQr7gsVPUk+4HuSRTY4VqeJpsthorUVqtHiWl6ToEKxgyMJR8kZT3/KA5GyWUDfUYWyfRBe4Ag8l6TfHXL/ACn97PJckxGTox/hq7J2WkpSNnKhHciSQFh2UKAyD/1PjVyDFQ37Gcs54iqkyq1WMxlPN5RMqOpI+IhYV1JVvJIpaRVZSgB8+YXnP1ZyOKFTj2Os26VCcxxTrxCaz38fl8SmT8S6/ErX90Ox3diW6r5dm5Pw/wCptrheSg/b2EnydqtVighxNKei1d0so7FbD2XPQKZBoKpI661rqUr6nJL3VIwsLq2uUWuK1xawlGy8cDy/iXtmrZHZVZk0Yz+VoSeoJPuft2GnszLl70dLF5jisEsy969yWG87SLMDMS8xaEIH+ar7kvtQV9lYAZqcOxcmNmWCW6si6gcT1KwUoXWQ9SUBLhgPl+YqxHuqsp0HB4CvS4lCePWYpXeZgVuT1wIlcyu8bdnjJOghHRVUdpNqTrTLjbvH5+EyL3Oy/wBfhCuOxXirRRLBKIyInmS3FG48nZfHslOvUgAMDoElCw11IdpiChWrRLLUmVFk0szsskh0/lIKkAAKpUe5JZvjv7gryuAyuRu1Ur5bEV68zxtIv4uCMzDYL93WVmKKG8bBR8kHvsEq/eI+mnIsxkjXioVop6syeeX8RAZKzEBCH6szf0fbf27EAn0bxxBuMKniATpR8K8nK7fix1ercWrFNYRTLHCjTTtIUjZioRpGYIVTr8tH2Hu3raOP/TLiyZjIXstDVyeXlutbmZRII42bbBChcoxXt+gOjGSAdEi3G/pl9QeORvPi81ilybq0S2mlRo44w+0VI2qsygJ8W+ZZiFJbShfRVxbFfUjH5ib9uZYXK1qQOXhmilRD7ggr4YWjHQKNqX+YDa0WBV1vqbzDDAWGpWvPDhHGDxGNwtEUsXTiqwbBKoPuQoUEn7nSqoH6BQPsB6nEe/rlO3UdyC2vcgaBPpSuscbO7KiqNszHQA/U+sRM5KykztfIVOY8uQAJyrOKAvXQyEo9tk6/N9tk/wCfSi5jy6JOkXKc5GuydLkJQPcEH+r9Gb/J/X1R+l6te7qrXu6q/wD315l27fvbn99g2/2jN9xvR/N9xs/5Pqyh+qn1PhiSGH6j8wjjRQqImbsgKANAAB/Yeg70vUEk7UFxOyjP+LH1T/uXzP8A3tn/AL9L+LH1T/uXzP8A3tn/AL9BnpeoUIz/AIsfVP8AuXzP/e2f+/QpkbtzJX58hkbdi5csSGSexPIZJJXJ2WZjskk/cn1H9L1y5f/Z",
      Name: "*ROI2 - Adenocarcinoma, Superficial",
      Content:
        "Region of Interest #2 (ROI2) consists of a region of invasive adenocarcinoma with a predominantly moderately differentiated glandular appearance and typical cytologic features. ROI2 is defined at the most superifical/luminal region of the tumor, though like ROI3 the tumor in this region predominantly involves the submucosal compartment (pT1 anatomic level). One may appreciate a prominent ulcer bed adjacent to this region, often present in the center of the superficial aspect of the tumor mass in colorectal adenocarcinomas. \n\nCompared to normal colonic mucosa, the adenocarcinomatous epithelium has a disordered arrangement of epithelial glandular structures which exhibit jagged erratic shapes. Cytologically, the tumor cells have an eosinophilic to amphophilic cytoplasm without prominent mucin vacuoles, with cuboidal to pseudo-stratified columnar arrangement. Glands are densely arranged with back to back glandular structures with minimal intervening stroma and focal regions of more disordered cribriform growth (multiple small lumens in a single glandular structure). The tumor cell nuclei are larger and more irregular than those of the normal mucosa, with darker hematoxylin staining of chromatin. \n\nThough less prominent than other tumor regions (ROI6), scattered mucinous cells and intraluminal mucin are present focally. The peritumoral stromal has a prominent lymphocytic inflammatory infiltrate in this region. \n\n[Regions of interest 2-3 (ROI2-4) each exhibit relatively similar morphologic and architectural features, and were selected to compare the molecular and spatial relationships of tumor and tumor-associated cells at different anatomic levels of invasion corresponding to defined AJCC staging criteria.]",
      Pan: [0.380619559933823, 0.900233576549723],
      Zoom: 3.20954462208,
      Group: "Hematoxylin & Eosin",
    },
    Arrows: [
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.404474190111976, 0.941309789228942],
        Text: "Bowel Lumen",
      },
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.317331765583619, 0.916968329863479],
        Text: "Adenocarcinoma, with glandular architecture",
      },
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.348732248165066, 0.933763936825648],
        Text: "Peritumoral stroma",
      },
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.374534195092457, 0.890436139155124],
        Text: "Glandular lumen with mucin",
      },
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.440621257269689, 0.884229067016931],
        Text: "Adenocarcinoma with cribriform architecture",
      },
    ],
    Overlays: [
      {
        height: 0.117082419547876,
        width: 0.147630951051532,
        x: 0.305891279681852,
        y: 0.835424440989178,
      },
    ],
  },
  {
    UUID: "7b1716ce-6aa9-42b8-9d3a-7cd225968702",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,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",
      Name: "*ROI3 - Adenocarcinoma, Submucosa",
      Content:
        "Region of Interest #3 (ROI3) consists of a region of invasive adenocarcinoma with a predominantly moderately differentiated glandular appearance and typical cytologic features. ROI3 is a well-defined region of invasive adenocarcinoma involving the submucosal compartment (pT1 anatomic level). \n\nCompared to ROI2,  the carcinomatous glands exhibit a more prominent pseudo-stratified columnar cytomorphology with disorganized and crowded back-to-back glandular structures. Regions of cribriform growth are not identified in this region, suggesting that this region of tumor is possibly somewhat more well-differentiated than the superificial tumor in ROI2. The peritumoral stroma is less prominent in this region, and significantly fewer peritumoral immune cells are present. While the tumor in this region exhibits a predominantly typical morphology, some scattered mucinous cells and intraluminal mucin are present.\n\n[Regions of interest 2-3 (ROI2-4) each exhibit relatively similar morphologic and architectural features, and were selected to compare the molecular and spatial relationships of tumor and tumor-associated cells at different anatomic levels of invasion corresponding to defined AJCC staging criteria.]\n",
      Pan: [0.231668399598117, 0.883446929780717],
      Zoom: 3.851453546496,
      Group: "Hematoxylin & Eosin",
    },
    Arrows: [
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.249824340684316, 0.867594646418917],
        Text: "Glandular lumen with mucin",
      },
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.192419065680766, 0.881590985554058],
        Text: "Adenocarcinoma, with glandular architecture",
      },
      {
        Angle: 310,
        HideArrow: false,
        Point: [0.245767430790072, 0.844977373758508],
        Text: "Peritumoral stroma",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.332382457032177, 0.918914556581101],
        Text: "ROI1",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.270514581144959, 0.938590569568184],
        Text: "Ulcer Bed",
      },
    ],
    Overlays: [
      {
        height: 0.0829638073372858,
        width: 0.105378234502983,
        x: 0.179639799513898,
        y: 0.837877781443581,
      },
    ],
  },
  {
    UUID: "43ddf397-902a-40be-98d0-16c5cb11ca22",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,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",
      Name: "*ROI4 - Adenocarcinoma, Muscularis",
      Content:
        "Region of Interest #4 (ROI4) consists of a region of invasive adenocarcinoma with a predominantly moderately differentiated glandular appearance and typical cytologic features. ROI4 is a well-defined region of invasive adenocarcinoma involving the muscularis propria, making it a higher stage of invasion than ROI2-3 (pT2 anatomic level). ROI4 also represents the deepest extent of invasion in this tissue section at its superior aspect in this field. \n\nWhile the adenocarcinomatous glands in this region maintain a glandular architecture with predominantly typical cytomorphology and columnar architecture, the glands exhibit somewhat more prominent intraluminal and extracellular mucin, though not to the extent of the mucinous region in ROI6. The tumor region exhibits relatively small amounts of peritumoral stroma and intratumoral immune infiltration, though the deep edges of the mass exhibit collections of lymphohistiocytic inflammation, most prominently around regions of extracellular mucin. \n\n[Regions of interest 2-3 (ROI2-4) each exhibit relatively similar morphologic and architectural features, and were selected to compare the molecular and spatial relationships of tumor and tumor-associated cells at different anatomic levels of invasion corresponding to defined AJCC staging criteria.]\n",
      Pan: [0.109998223527571, 0.624786478173739],
      Zoom: 2.228850432,
      Group: "Hematoxylin & Eosin",
    },
    Arrows: [
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.0789774677122247, 0.590523439970914],
        Text: "Adenocarcinoma, with glandular architecture",
      },
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.0924723727844373, 0.608224549221478],
        Text: "Glandular lumen with mucin",
      },
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.143297339939524, 0.610152392803223],
        Text: "Extracellular mucin pool",
      },
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.172565510680556, 0.631884447724708],
        Text: "Peritumoral lymphohistiocytic inflammation",
      },
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.104214692782337, 0.523048914609851],
        Text: "Deepest invasive front of tumor",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.243194689175383, 0.609276100266066],
        Text: "Muscularis Propria",
      },
    ],
    Overlays: [
      {
        height: 0.218196841752009,
        width: 0.105155104458799,
        x: 0.0639052360731302,
        y: 0.514461247745715,
      },
    ],
  },
  {
    UUID: "15dab9ef-a574-4526-a159-24d260fb63fc",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCABAAEADASIAAhEBAxEB/8QAHQAAAQUBAAMAAAAAAAAAAAAABwMEBQYIAAECCf/EAC0QAAICAgEDAwIGAgMAAAAAAAECAwQFERIGEyEAByIUMQgVIzJBUUKBFmNx/8QAGQEAAwEBAQAAAAAAAAAAAAAAAwQGBQEC/8QAJREBAAICAAYABwAAAAAAAAAAAQACAxEEEiExQZEiMlFhcbHB/9oADAMBAAIRAxEAPwCvdeSPafFQywChJNVHZcVzXnikaaR2L/CLRDrL+msfaXfgszOwYGL6StPWxTvbrHjYuqI5uKxbRVkd34EAPr929fEfLmw9N8bEM+tWOzJVSahW3YyE0ojEMaK5V5HjDO42AgGuXmNANcFK8ViuKNhaSFZahk7byFv14+Y7jGPZVZCGUEE8GQhTphyetK8vSO9pBWKbfVSQfGKTuDfEM0kTBl+43yBGgCfLL9vuwJ0X7Ke5+S6e9usbSztaTMs2Snq1nhsInbrRQRyuBz4g8TIFVNjxtQQFQMCcDRv57qKlVr2JYBZZYrE3cYxxRoBpnbR4IkSgsAQFVD/H2s/UFtPrMfPShs/Q4+OvDi5pFV4GjVp2eV4nBLGSVe4vyZQJHQnQHoXE465QpYnChZ6za1S1VuwLPTsw2YWAZXicOpBAYEEf2CD/AOEelx6zj7ce5HT3TvVHaylrJUqwrzxWIIYJrFWKZZDxfmsjKUEEMKR9uMjjpuQBIBl6L696b6pjWPH5Ou9xREs0QWVV7jo7hI2lRDJ8Y5D4G9KSQPU/m4a+N7OoompafQG/HnhauV/DnlL1h5llw96pdriNgFaRpRXIfYO14TufGjsL51sE8D1QvxF46llPYbrmtkK6zwpgrVlVYkASQxNLG3j+VdFb/XpecmMqMNm9HTtQRrCmy6xtHI7nbniqswIb5FRy5eOIB8j1YL0MbqYVixLU5oxPOwdn7RTXFpH0ZAgWbfFgCdDZbiu0saUu0TBNkIRVjRY4554ZRHE8qk8XXRVX0khPFPkIRxbXhFqEFePEWKuSq4hxVrPE0qVnVY5pWZCyFpQZJowqkIB2U4yt+4MxrG00dmowD52TGtwDubllhYsx2YY34JxmkjQLATEu5iw4lo15AMCUBCfSuRu4Wp1BXyNqrcW7jxEteSq00qzCPzIWKK0RjBmHIEkN/DBuXpTH2ZMyl+CW5byFgIzxmvJpiY0Uq3KX4kARqqouizLEu/CsFsbZeKvEMQlesoj7VhI5FU3JY3HjiePx2yjhohiu/JChQmEPL7nj5Y+zLSXKRSK3NPHE8MiSsofbpWAMSEEMI04uBsa0Do6B2TfYiDLze4LTqt2JRMn1kdPgK4PCcL9UikEMvbIUMgPLTFhyUMEYLFqK01xV/T2pZXriSJ9MQACykOQBs8gB8v53x9HH2WtZzpzpx70HT0aWLNWStjO7WAfJSiAyq48rI0SCADca/qGwCSShf0Pixrj0QGRWaNyVuLH46zfsECGtC80hLqoCqCT5YhR4H3JA/sj0Mcr7ydMNSFbKdNZeWperOzpN9E0TwlFYiQGxpQySJpX1y7igA8gDZoYs71Z7RzQZTH1MZmsvhpY2hPNY4pJY2VeYZeafdSyEEoSV2+uRBa/h36wSq0OujpZGdn+oe1cEi8oyvAADjxVjzBI2SBsldr6nk06gIGK+axMdmGytzHxrEOZZbkbu+21JoKE1qMMQP+w/MPoq5x1+Nd22khsKeMUHbi4QxyEyA8EXiuu2kJ5Eg/BAQfJWG6fly2MpRfS5icQQ2BZWOUQyNBLHw0Y2ljYITxXYHHkqqrEhNB5FUCtWhrwTQ1EYRQCRAzHhy07MoClgSTyAUAefHLzU0Mi/Gaj+1dslEyNrLWbawwNZLTPMUAdYxIdlpAd8R4BYt4XXLZ1y0lPcRpytiJGrgRMjHTADkVKqFJXiRsMugSdna/LfmvbW2xgumqiylF7k4JaKNiHbio2ygsVckAkEHzstv3pTdJ9qKOVspcvFhMUZUjMu5ZFkSN5JS6AK0OuSylSFBZgPPpeV1qDsu5IUvy2tLcyeUls25TZM9KpQuLCY3bR5GSVXRVClVHxdiUbbIF4uXPbPIUJZYOs8d0B1LeycFYAXslfuWmszoskLNHKkDiRnj4q3LggYAKq8ORGz9U4WMSDA+3uJrwSwsqy5CezbkhJXn3RLzVICNq3JQCvnW9jZr9iPdSt1Fm5OmK/SxxEQZ2jC5drCRELsoqSqnBBriI4uXDRHBFG/Wfxpdx7B9+PcDf7S3dF9ddRZ3OxY/I9BZHCQOrE2bPe4+ATofohd+P8AJlH9EnQJA9d671hwU+bZpfU1I7dvK2JoULQP2yqqpYHkFP7/ALbOyP8Af8iQyqpFDVrfmlnLV4LBi+mvSz8+Jii4hyDsxkhgFDL+zyo2oKVsIkViPt23miCxKSpVUDgqQrD5bIL6P+RB16eYevVsUrz2nnEkUCcSsYcRoJYwxI8gkK2gSVHkgsfCtZP1j6PiI06mKSqfoYkkjji/WgWP9PlzcKCyttvA5A+D8tHfHxIUpemcR0ln7dvF3rnUJ+dEvKYIaQEcjM7aZe6zsD8Cv2TYbzxE/Hc9r6KY008b1NnrIm3Otu1HRrvGraUaQTOdqOJHIA8SdjwBI/8AK/bRXpJJ7dTTosivJLWsy1mJEXEq3IySAcndwqyLsFQ29bK+SzY0Vf1/YO3Ug5yHWWNiyWVnbLPK8sKNDPDi3sGaWSImUStLNCRp9qSEYN5bjsAG/wD4f72Wjzmf6t6S6hxk0GAxDrP+Z0poAYGZmO40Mp0O1G/h1JYFQSoY+rb7cQexee6jxfStPprqu1bZ5YmsTMDDIfmfn2XBCr+0aRdDiXGgSGA6t6Xw/VEmLo1Md0QuPtsq3nrrl4HdGdu53GVZmJdYiq7ZQpLaQqjKg1yK12v5PHtYJs2mt6swsVYrAiljEqK4SVeLrsb0wP2P9j0qPTXEpJHi6kU0hkkSFFZyrrzIAG9OzMN/fTMT/ZJ8+nXrEe8DP//Z",
      Name: "*ROI5 - Adenocarcinoma, Solid",
      Content:
        "Region of Interest #5 (ROI5) consists of a region of adenocarcinoma with near-complete loss of glandular morphology and a solid sheet-like architecture, suggestive of a more poorly differentiated state. \n\nHowever, scattered tumor cells still exhibit intracellular mucin vacuoles, exposing the underlying cytomorphologic differentiation despite the loss of glandular architecture. At the top-right region of the field some cells have become increasingly discohesive with more prominent mucin vacuoles, with focal signet ring cell morphology (cells with a promeint cytoplasmic mucin vacuole and nucleus 'pushed' to the periphery of the cell).\n\nThis region of tumor is present in both the mucosa and submucosa, notice the mucosal glands and stroma adjacent to the solid tumor to the left, and a region of more glandular architecture inferiorly. ",
      Pan: [0.872849383304825, 0.516461979517963],
      Zoom: 6.65531172834508,
      Group: "Hematoxylin & Eosin",
    },
    Arrows: [
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.90190277447454, 0.525471465466552],
        Text: "Bowel Lumen",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.856239060676483, 0.495185506186607],
        Text: "Colonic Mucosa",
      },
      {
        Angle: 60,
        HideArrow: false,
        Point: [0.860465008482987, 0.532514711810725],
        Text: "Adenocarcinoma, with solid architecture",
      },
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.856591222993692, 0.532045162054447],
        Text: "Intracellular mucin vacuole",
      },
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.888579300140146, 0.504165645275428],
        Text: "Discohesive and fragmented adenocarcinoma, with focal signet ring cell features",
      },
    ],
    Overlays: [
      {
        height: 0.0591632692910555,
        width: 0.0579893949003599,
        x: 0.840156981523954,
        y: 0.485207573865695,
      },
    ],
  },
  {
    UUID: "d84ccda9-ccb3-4f62-aa3a-fc5859efa0bc",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,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",
      Name: "*ROI6 - Adenocarcinoma, Mucinous",
      Content:
        'Region of interest #6 (ROI) comprises a region of "floating" tumor with prominent extracellular mucin surrounding the tumor epithelium. \n\nIn this tumor, prominent mucinous regions are present at the deep invasive front broadly across the tumor. The tumor in this region exhibits a prominent cribriform architecture with multiple small lumens within a sheet-like structure of tumor epithelium with no intervening stroma. Minimal peritumoral stromal is present immediately adjacent to the tumor epithelium. There is minimal inflammatory cell infiltration into the mucin pools and tumor epithelium, though prominent lymphohistiocytic inflammation is present surrounding the extracellular mucin pools. \n\nMacrophage populations are particularly prominent in this region (see Macrophage marker set), likely at least in part resulting from a phagocytic response of macrophages to extracellular mucinous material. ',
      Pan: [0.450078708897922, 0.675930909892408],
      Zoom: 3.0956256,
      Group: "Hematoxylin & Eosin",
    },
    Arrows: [
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.413938390261963, 0.609300898756441],
        Text: "Muscularis propria",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.448311490807455, 0.740887790272005],
        Text: "Submucosa",
      },
      {
        Angle: 310,
        HideArrow: false,
        Point: [0.466305059467286, 0.632746047346773],
        Text: "Peritumoral inflammation",
      },
      {
        Angle: 200,
        HideArrow: false,
        Point: [0.41532586482566, 0.637036375608692],
        Text: "Invasive Front",
      },
      {
        Angle: 310,
        HideArrow: false,
        Point: [0.43576801713245, 0.665428253812568],
        Text: "Extracellular mucin",
      },
      {
        Angle: 310,
        HideArrow: false,
        Point: [0.484980606019168, 0.666059184439321],
        Text: "Adenocarcinoma, with cribriform architecture",
      },
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.39740743502588, 0.690917851133381],
        Text: "Carcinomatous glandular lumen in cribfriform structure",
      },
    ],
    Overlays: [
      {
        height: 0.0917625503549266,
        width: 0.155360357531609,
        x: 0.371994122195437,
        y: 0.637465641934686,
      },
    ],
  },
  {
    UUID: "88bb6cc7-5c26-4dac-816d-12c9b8f307cc",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,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",
      Name: "*ROI7 - Tumor Budding Cells",
      Content:
        "Region of Interest #7 (ROI) comprises a region of tumor with clusters of tumor budding cells extending into the peritumoral stroma. \n\nTumor budding is defined as clusters of <=4 tumor cells, typically located at the invasive front of the tumor. A prominent peritumoral lymphohistiocytic inflammatory proliferation is present adjacent to the region of tumor budding. \n\nTumor budding cells may be difficult to appreciate on standard H&E sections, but are highlighted by PanCK (see also, Tumor Budding marker sets, and subsequent discussion).  ",
      Pan: [0.724133718522389, 0.521758434263343],
      Zoom: 3.851453546496,
      Group: "Hematoxylin & Eosin",
    },
    Arrows: [
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.835703507969231, 0.50829264236419],
        Text: "Mucosa",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.634815196411141, 0.55119592498338],
        Text: "Submucosa",
      },
      {
        Angle: 60,
        HideArrow: false,
        Point: [0.746363731221035, 0.539208243075077],
        Text: "Prominent peritumoral lymphohistiocytic inflammation",
      },
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.706993660111661, 0.521289813275298],
        Text: "Adenocaricnoma, with glandular archiecture",
      },
      {
        Angle: 310,
        HideArrow: false,
        Point: [0.735125833258095, 0.515075052064657],
        Text: "Tumor Budding Cell(s)",
      },
      {
        Angle: 310,
        HideArrow: false,
        Point: [0.723797945387883, 0.502279821206076],
        Text: "Tumor Budding Cell(s)",
      },
      {
        Angle: 310,
        HideArrow: false,
        Point: [0.714935193738131, 0.492419276324233],
        Text: "Tumor Budding Cell(s)",
      },
    ],
    Overlays: [
      {
        height: 0.0586765482880101,
        width: 0.0714213469484165,
        x: 0.687560996807675,
        y: 0.489490909686957,
      },
    ],
  },
  {
    UUID: "fb073470-b7be-45d1-87d0-99897a31d1c4",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,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",
      Name: "Tumor Budding [Tumor Markers]",
      Content:
        "Tumor budding is a phenomenon in which single tumor cells or small clusters of <=4 cells are present in the peri-tumoral stroma, most characteristically at the deep invasive front of a tumor, resulting in an appearance of cells sprouting or budding from the tumor mass [1]. Tumor budding was first conceptually described in 1949 by Imai et al. in their classification of gastric carcinomas [2], and subsequently shown to correlate with clinical outcome in a variety of solid cancers including for colorectal carcinomas, though the concept was only minimally explored until the 1980s [3]. Since that period, a number of studies have explored the possibility of using tumor budding as a novel tumor classifier, and systematic meta-analyses show that tumor budding significantly correlates with poor outcomes in colorectal carcinomas including risk of lymph node metastases, local recurrence, distant metastases, and cancer-related death, independently of tumor TNM stage [4]. The related concept of poorly differentiated clusters (PDCs) refers to similar collections of cells at the invasive front that have lost glandular differentiation, but which form larger clusters and do not meet the definition of tumor budding (>=5 cells) [5]. \n\nPathologic examination of the CRC01 tissue specimen revealed a region of prominent tumor budding near the invasive front of the tumor. Tumor budding cells were annotated by a pathologists using the ITBCC consensus criteria of <=4 cells and were segmented and analyzed for marker expression and neighborhood spatial correlations at a single cell level. Scattered poorly differentiated clusters were also present in the region of tumor budding, and were noted but not included in the training cohort of tumor budding cells. \n\nSingle cell analysis of marker expression in tumor budding cells relative to other tumor cell populations in the main mass (ROI2-6) and normal mucosa (ROI1) showed that these cells exhibit a unique molecular phenotype characterized by reduced expression of characteristic epithelial markers such as E-cadherin and NaK ATPase and reduced proliferative cell cycle activity as assessed by PCNA and Ki-67/MIB-1 staining (highlighted in this field). On the other hand, tumor budding cells at the invasive tumor margin exhibited higher expression of PD-L1 compared to the main tumor mass, indicating that they may suppress local anti-tumor cytotoxic immunity. \n\nInterestingly, these markers exhibited a continuous graded expression profile correlating with tumor cluster size with tumor budding cells representing just one end of a continuous spectrum of molecular differentiation. Larger clusters, including those that would be classified as poorly differentiated clusters (PDCs) also exhibited reduced expression of these markers relative to the main tumor mass, though at an intermediate level to tumor budding cells and the main mass. \n\n3D reconstruction and analysis of tumor budding regions showed that tumor buds in fact rarely represent individual cells or clusters which have completely separated from the main tumor mass, but rather, represent the tips of a contiguous complex network of tendril-like structures connected to the main tumor mass. Poorly differentiated clusters in the region of tumor budding rather than representing distinct tumor nests, instead represent the more proximal aspects of this network. These findings suggest that while tumor budding cells exhibit a migratory molecular program, they have not undergone definitive epithelial-to-mesenchymal differentiation and remain an intrinsic yet specialized epithelial niche of the overall tumor mass. \n\nHere, we highlight tumor budding cells and poorly differentiated clusters (arrows) at the invasive front of the tumor. Tumor budding cells exhibit significantly reduced expression of E-cadherin (green) and PCNA (red) compared to adjacent PDCs or the main tumor mass, while many PDCs exhibit an intermediate expression pattern, though this is more difficult to appreciate qualitatively. \n\n[1] Lugli, A. et al. Recommendations for reporting tumor budding in colorectal cancer based on the International Tumor Budding Consensus Conference (ITBCC) 2016. Mod. Pathol. 30, 1299–1311.\n\n[2] Imai T. Histological comparison of cancer of the stomach in autopsy--and operation--cases. Jpn J Cancer Res 1949;40:199-201.\n\n[3] Hayashida K, Isomoto H, Shirouzu K, et aL A study of invasive colorectal carcinoma with reference mainly to vessel invasion and budding. Nippon Dai- cho-komonbyo Gakkai Zasshi 1987;40:119-26.\n\n[4] Rogers, A. C. et al. Systematic review and meta-analysis of the impact of tumour budding in colorectal cancer. Br. J. Cancer 115, 831–840 (2016).\n\n[5] Ueno H, Kajiwara Y, Shimazaki H, Shinto E, Hashiguchi Y, Nakanishi K, et al. New criteria for histologic grading of colorectal cancer. Am J Surg Pathol. 2012;36:193–201. ",
      Pan: [0.718818138855538, 0.513807466249838],
      Zoom: 6.65531172834508,
      Group: "Tumor Budding Epithelial",
    },
    Arrows: [
      {
        Angle: 310,
        HideArrow: false,
        Point: [0.727080493256782, 0.502476977421495],
        Text: "Tumor Budding Cell(s)",
      },
      {
        Angle: 310,
        HideArrow: false,
        Point: [0.734417208198629, 0.513677695566049],
        Text: "Tumor Budding Cell(s)",
      },
      {
        Angle: 310,
        HideArrow: false,
        Point: [0.753394844181541, 0.522824133526885],
        Text: "Tumor Budding Cell(s)",
      },
      {
        Angle: 310,
        HideArrow: false,
        Point: [0.754666541438128, 0.502183508823822],
        Text: "Tumor Budding Cell(s)",
      },
      {
        Angle: 30,
        HideArrow: false,
        Point: [0.740266172148522, 0.527883887596454],
        Text: "Poorly Differentiated Cluster",
      },
      {
        Angle: 330,
        HideArrow: false,
        Point: [0.713184751391609, 0.493707334464114],
        Text: "Poorly Differentiated Cluster",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.703841161573265, 0.520988618104842],
        Text: "Main Tumor Mass",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.734270285634077, 0.491758671346919],
        Text: "Main Tumor Mass",
      },
      {
        Angle: 30,
        HideArrow: false,
        Point: [0.726825393211973, 0.526984504619287],
        Text: "Poorly Differentiated Cluster",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.682455833005075, 0.54007552350916],
        Text: "Submucosa",
      },
    ],
    Overlays: [
      {
        height: 0.0473306154328444,
        width: 0.0750810060288871,
        x: 0.6896834716437,
        y: 0.487993036181762,
      },
    ],
  },
  {
    UUID: "11d43bd8-9a11-44d3-9818-fb2d1dc91108",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,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",
      Name: "Tumor Budding [Immune Markers]",
      Content:
        "Immune populations were segmented into broad functional categories by lineage-specific marker expression:\n\nCytotoxic T Cell - CD45/CD3/CD8+ \n\nActivated Cytotoxic T Cell - CD45/CD3/CD8/PD-1+\n\nHelper T Cell - CD45/CD3/CD4+\n\nT Regulatory Cells - CD45/CD3/FOXP3+, CD4 or CD8\n\nMacrophages - CD45 or CD163\n\nNearest neighbor analysis and spatial correlation showed that the tumor budding region exhibited a distinctive immune microenvironment. Tumor budding cells at the tumor invasive front exhibited higher levels of PD-L1 staining. There were increased numbers of FOXP3+ Tregs in the budding microenvironment, and an increased number of PD-L1 positive macrophages. There were a reduced number of CD8-positive cytotoxic T cells in the budding niche, and those that were present were negative for PD1 suggesting that they were not activated. Collectively, these results suggest that the tumor budding network exists in an immunosuppressive environment that may facilitate stromal invasion and metastasis. ",
      Pan: [0.72093301316954, 0.512300720047842],
      Zoom: 7.9863740740141,
      Group: "Tumor Budding Immune Modulation",
    },
    Arrows: [
      {
        Angle: 310,
        HideArrow: false,
        Point: [0.734314594092866, 0.513752814745281],
        Text: "Tumor Budding Cell(s)",
      },
      {
        Angle: 310,
        HideArrow: false,
        Point: [0.722751931344515, 0.500429340410887],
        Text: "Tumor Budding Cell(s)",
      },
      {
        Angle: 310,
        HideArrow: false,
        Point: [0.711834899511046, 0.490157939492301],
        Text: "Tumor Budding Cell(s)",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.700683092799439, 0.519739574137828],
        Text: "Main Tumor Mass",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.740418740924483, 0.482175593635571],
        Text: "Main Tumor Mass",
      },
      {
        Angle: 120,
        HideArrow: false,
        Point: [0.727506122626832, 0.508939929743429],
        Text: "FOXP3+ Treg",
      },
      {
        Angle: 120,
        HideArrow: false,
        Point: [0.735194999885888, 0.528367550909441],
        Text: "Macrophages (PD-L1 Positive)",
      },
      {
        Angle: 120,
        HideArrow: false,
        Point: [0.711893593230581, 0.500722809008561],
        Text: "FOXP3+ Treg",
      },
      {
        Angle: 310,
        HideArrow: false,
        Point: [0.73190815159194, 0.506650874681573],
        Text: "Sparse CD8+ Cytotoxic T Cells",
      },
      {
        Angle: 310,
        HideArrow: true,
        Point: [0.752509647148647, 0.541221475487557],
        Text: "Lymphocyte Aggregate with abundant CD4 and CD8 T cells",
      },
    ],
    Overlays: [
      {
        height: 0.0474658457626525,
        width: 0.0799211249166029,
        x: 0.683685023596169,
        y: 0.486997982182443,
      },
    ],
  },
  {
    UUID: "d93d3231-b3f1-4d0e-9aa3-7827739e2953",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,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",
      Name: "Transitions - Atypical Mucosa/Glandular Adenocarcinoma [Histology]",
      Content:
        "Machine-learning based analysis of tumor molecular expression patterns derived from training on exemplar morphologic regions (ROI1-7) revealed regions with atypical expression patterns, as well as those with transitional or indeterminate morphologic and molecular patterns. \n\nHistologic review of the H&E stained sections showed a region of mucosal epithelium without overt adenomatous or high-grade dysplastic changes surrounded by tumor in the exophytic region of the tumor mass, though definitive histologic analysis is challenging in this setting given reactive changes and tissue distortion by tumor mass effect. Molecular clustering analysis showed that while superifical regions of epithelium in this region exhibited an expression pattern typical for normal mucosa (ROI1), the deeper crypt epithelium exhibited a molecular pattern more closely resembling regions of moderately differentiated invasive adenocarcinoma with glandular morphology (ROI2-4). \n\nWhile the molecular expression pattern is informed by the full array of high-plex tissue markers and not easily amenable to reduction to specific markers, the deep epithelium noticably exhibited markedly elevated proliferative cell cycle activity as assessed by PCNA and Ki-67, and reduced expression of E-cadherin, PanCK, and NaK ATPase relative to more superficial regions of epithelium, which may also be noted on surrounding regions of invasive adenocarcinoma. These findings suggest that while the deeper regions of epithelium exhibit no definitive carcinomatous changes, they have acquired an atypical molecular pattern readily identifiable by molecular profiling, and may represent regions of residual adenomatous or pre-neoplastic epithelium associated with the frankly invasive adenocarcinomatous mass. ",
      Pan: [0.815741853917366, 0.506602504369754],
      Zoom: 4.6217442557952,
      Group: "Hematoxylin & Eosin",
    },
    Arrows: [
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.859131958911064, 0.501037051156166],
        Text: "Superficial mucosal epithelium with typical mucosal molecular pattern (ROI1-like)",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.825958268630008, 0.483358502832291],
        Text: "Adenocarcinoma, with glandular architecture",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.853145199518517, 0.528223982044675],
        Text: "Adenocarcinoma, with solid architecture",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.892728243972771, 0.470117199705245],
        Text: "Bowel Lumen",
      },
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.786269474266984, 0.528357505588102],
        Text: "Atypical deep mucosal epithelium, with molecular pattern resembling glandular adenocarcinoma (ROI2-4-like)",
      },
    ],
    Overlays: [
      {
        height: 0.0842372262763123,
        width: 0.100929720112003,
        x: 0.777496964571449,
        y: 0.463914768060275,
      },
    ],
  },
  {
    UUID: "97166d10-c821-4936-a0e2-1468beafeac7",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,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",
      Name: "Transitions - Atypical Mucosa/Glandular Adenocarcinoma [CyCIF]",
      Content:
        "Machine-learning based analysis of tumor molecular expression patterns derived from training on exemplar morphologic regions (ROI1-7) revealed regions with atypical expression patterns, as well as those with transitional or indeterminate morphologic and molecular patterns. \n\nHistologic review of the H&E stained sections showed a region of mucosal epithelium without overt adenomatous or high-grade dysplastic changes surrounded by tumor in the exophytic region of the tumor mass, though definitive histologic analysis is challenging in this setting given reactive changes and tissue distortion by tumor mass effect. Molecular clustering analysis showed that while superifical regions of epithelium in this region exhibited an expression pattern typical for normal mucosa (ROI1), the deeper crypt epithelium exhibited a molecular pattern more closely resembling regions of moderately differentiated invasive adenocarcinoma with glandular morphology (ROI2-4). \n\nWhile the molecular expression pattern is informed by the full array of high-plex tissue markers and not easily amenable to reduction to specific markers, the deep epithelium noticably exhibited markedly elevated proliferative cell cycle activity as assessed by PCNA and Ki-67, and reduced expression of E-cadherin, PanCK, and NaK ATPase relative to more superficial regions of epithelium, which may also be noted on surrounding regions of invasive adenocarcinoma. These findings suggest that while the deeper regions of epithelium exhibit no definitive carcinomatous changes, they have acquired an atypical molecular pattern readily identifiable by molecular profiling, and may represent regions of residual adenomatous or pre-neoplastic epithelium associated with the frankly invasive adenocarcinomatous mass. ",
      Pan: [0.804047392340123, 0.50686721376622],
      Zoom: 4.6217442557952,
      Group: "Transitions",
    },
    Arrows: [
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.785798169926556, 0.528651051827187],
        Text: "Atypical deep mucosal epithelium, with molecular pattern resembling glandular adenocarcinoma (ROI2-4-like)",
      },
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.859836775496506, 0.49932297405005],
        Text: "Superficial mucosal epithelium with typical mucosal molecular pattern (ROI1-like)",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.893137244211757, 0.469234225667742],
        Text: "Bowel Lumen",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.81081578094106, 0.484447637771156],
        Text: "Adenocarcinoma, with glandular architecture",
      },
      {
        Angle: 166,
        HideArrow: true,
        Point: [0.857892839505514, 0.530087874081399],
        Text: "Adenocarcinoma, with solid architecture",
      },
    ],
    Overlays: [
      {
        height: 0.0820679064023069,
        width: 0.101169190487705,
        x: 0.777847925064133,
        y: 0.466849325883803,
      },
    ],
  },
  {
    UUID: "31843b78-61d8-411e-8e09-4fdbbf0297c2",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,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",
      Name: "Transitions - Glandular/Solid [Histology]",
      Content:
        "Analysis of molecular expression clusters derived from ROI analysis revealed that many regions of tumor epithelium exhibit mixed or transitional expression patterns. \n\nSome regions of tumor (including the field shown) smoothly transition, or rapidly oscillate, between regions of solid architecture (ROI5-like) and glandular architecture (ROI3-like) in adjacent epithelium. While broad morphologic changes are observable on visual review of H&E histology, molecular analysis of high dimensional imaging data illuminates the remarkable degree of heterogeneity in differentiation and architecture in even small regions of tumor. Moreover, analysis of transitional regions in high dimensional space reveals a continuous gradient of expression states between exemplars of each morphologic or expression group, suggesting that many cells lie in an intermediate differentiation state not readily identifiable by morphologic review or analysis of small groups of markers. These results further suggest that some tumors may exhibit highly plastic phenotypes, with rapid shift between different molecular and morphologic states in closely contiguous regions of tumor. \n\nHigh-dimensional molecular clusters are informed by the entire panel of markers and are not easily demonstrable by limited sets of markers, though the transitional changes in morphologic features may be highlighted by PanCK which demonstrates the tissue distribution and organization of epithelial cells. ",
      Pan: [0.794245580827177, 0.472953356472153],
      Zoom: 5.54609310695424,
      Group: "Hematoxylin & Eosin",
    },
    Arrows: [
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.822563231202727, 0.479472250295616],
        Text: "Adenocarcinoma, with glandular architecture",
      },
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.823639282727532, 0.456092585347596],
        Text: "Adenocarcinoma, with solid and signet ring cell morphology",
      },
    ],
    Overlays: [
      {
        height: 0.0527754361483539,
        width: 0.0651500286836028,
        x: 0.777662535758623,
        y: 0.449293896168151,
      },
    ],
  },
  {
    UUID: "b130ffec-ff91-4806-99f6-b572819dc720",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,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",
      Name: "Transitions - Glandular/Solid [CyCIF]",
      Content:
        "Analysis of molecular expression clusters derived from ROI analysis revealed that many regions of tumor epithelium exhibit mixed or transitional expression patterns. \n\nSome regions of tumor (including the field shown) smoothly transition, or rapidly oscillate, between regions of solid architecture (ROI5-like) and glandular architecture (ROI3-like) in adjacent epithelium. While broad morphologic changes are observable on visual review of H&E histology, molecular analysis of high dimensional imaging data illuminates the remarkable degree of heterogeneity in differentiation and architecture in even small regions of tumor. Moreover, analysis of transitional regions in high dimensional space reveals a continuous gradient of expression states between exemplars of each morphologic or expression group, suggesting that many cells lie in an intermediate differentiation state not readily identifiable by morphologic review or analysis of small groups of markers. These results further suggest that some tumors may exhibit highly plastic phenotypes, with rapid shift between different molecular and morphologic states in closely contiguous regions of tumor. \n\nHigh-dimensional molecular clusters are informed by the entire panel of markers and are not easily demonstrable by limited sets of markers. However, one many note relatively reduced expression of E-cadherin and PCNA in regions of solid architecture, which is also noted in ROI5.",
      Pan: [0.784145411215789, 0.472389615454898],
      Zoom: 4.6217442557952,
      Group: "Transitions",
    },
    Arrows: [
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.837603550886017, 0.47612859654803],
        Text: "Adenocarcinoma, with glandular architecture",
      },
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.798454839956321, 0.455761875869462],
        Text: "Adenocarcinoma, with solid architecture",
      },
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.846348915096699, 0.460809535749453],
        Text: "Adenocarcinoma, with solid architecture",
      },
      {
        Angle: 180,
        HideArrow: false,
        Point: [0.781844517327979, 0.489628152041029],
        Text: "Adenocarcinoma, with glandular architecture",
      },
    ],
    Overlays: [
      {
        height: 0.0757148981998627,
        width: 0.0799408460063666,
        x: 0.76429509518708,
        y: 0.434397361958803,
      },
    ],
  },
  {
    UUID: "6b54a970-a0e9-414b-8603-497968daaf35",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCABAAEADASIAAhEBAxEB/8QAHAAAAgIDAQEAAAAAAAAAAAAABQYCBAMHCAAB/8QALBAAAgIDAAIBAwQBBAMAAAAAAQIDBAUREgYTIQAUIgcxMkEjCBVCUhYzUf/EABoBAAIDAQEAAAAAAAAAAAAAAAMEAQIFAAb/xAAmEQACAgICAAQHAAAAAAAAAAABAgARAzESIQRBUWEFEyKBoeHw/9oADAMBAAIRAxEAPwAItpKdihlZbF7KQKJkolGX1y8zFY4kEvuBc+ws6ntF6AI72BZqGNvFmtrh1iktwGvfnaUQqLUQUQuHLs35kykAcIeF0oZSR8alBcWxjqmJsF3ijDWGU2JkJCLDHIpJSAbjWZwgf5cRrwu9UsZDjYDBcylWxUQsbKyrCqmaIrC3y5YFQGZyJASfyRvWwjUD1HRmuASJsvC5vxHL41fFvM8BUm7xix4q9HceKusEMTer3jZaGT5XTBGc7j6UmNSW/AWMB4L5BYo47AW8xkfeRBNavi1cQ8AGJNIQmtuNBv20GP7KofxzwXCWc/aydjNWUx8ZN9+giUq9MrHKJZPaCSJAqFY2PKcyk9aKtV8l/WyhFZs1/GMfVxuKm6WXJqPfetKpKq5hWSOROnBG2f2FZAw4Y/SDL8wlUBI8+zX97QPTniv6m4bXlqYPKQnzDJUMSb5EeLxkXU00hIToyMqkl+zyAg5APyXJHK7kf1w8bF6WlhcfkMs6WEgWdAkddiXCk9E9hf5AMUCsV+DzthyllvLK9zPtm87JfuwS3YGcPPLJYFfmSIKZghCuoX2FgAdlgE10qHM/bwNInGjIVMxjIr08laOCtMsayRiFDKoKASExgKI3d9MiNsoxZpHw9ARy3+IsUUTrfx/9RfFczdSnBkEglnkdKonZVFnkqp5IJ5bp+fW/Mm1f8PxP03fXHdpvKaVzxaLJCpVz1GtK/wBj93LzHHAAQJWd/XFtV9K+oakDMr/+z8OmcZ51iL2TpVK4M1a9I8VXIx2IGrTuiKzLGRIWfRJQlQyhlKlt/BQ8R4bhRTUCwrU5IxuXjp+QUsvNJXrxzCGlK/8At8WkaMckdMXAXSqNgKWJOv4aZ78OyWMns42pbxPhdyzXg5smlS7anXibtyJf8itIymcqqCMFphok9ALPj74po6HkfkJqSIqH0UZ8nI4kO1k9omSRmiYH2yMAC21YAbdQXfwK1U8imwFaKCjiIFv44iGtTljjsSwP7ue02vQUI3+UgnsqdhQX18xFE1qaLtYgD9avLbElg+CyWbcdCpYRrc9RHZ8lcVkMzMdqxSNiwVR0dx9H+K61Fk4aoqtDSE8UcFudzF0rQ8kKQXb9iSOwAB8qgJ/c6v5rJQ5rzXJ5W7j5o7VjJPJakibsL1J2Am+Qi/x1037oev8AipEVccEoQ2pULy2I2ldFk74VXAChQe/yXZ4OgexvZHyzhxjGoE4ClNTOHiNWSCGv7DIxteqSZ05ZQw+V+R/2H5A/B52fkk9fymZhpV6bXbOUkqI95JPa2oyQXR09pJZTHGGHJBDb+AwLABYmrWW9n3dqQxKsfDKW/wCwYkkEDQ/r53ofIIHR7Jt1kw9FLWSbf+QIel4PDnQK+x3XShyVCvyPnlh9Wc1uLNceMJUx8Xj1d48kYcgI0g7rTSrCs5KRFmXTdjUQUqCCxCMOmkjSKQ8oveIeMJ4b7o6dxTahszXJxCKVlpgwfiIjqQKyNEdSlWjJQ8odL2Eylfx5HuXky0kuFZ6eLshIBKju4ZjKQQ8a69hTtHUOd6cqU+tc47P+bvRksV/IsWiW44a8srZU1xb79f8AiZzIokK/dL7A38B0WP4khLIVQ/XqDPvHKesZcLbljrVIrMEqQ1XURalfZkLsqIRohH2GII6VdkB1Z+/TWhDa8inrpeWzDmapisSzxF5LM4b2JXZ5N67ZSzInagL17Dt9IOIxrvibYkuyVkhmVEow5GReoH+TKZGUxakCgli2iyIOfhfrZXg3nmE/T/xiS/dt/wDk+XWykVOpFNIK1HacufuH3EqkbH+LtTzsMwJKlz3xIUWY4yniSNxJ/wBSNKKh+r+fgoYz2wmetZm9bBpFeVVLHbEhR7JFPz/2UDkEn6S8ek1zATC885aAMtaYxCSOZ9FgiudlZAfkLsBQT+3Y2QsUpv8AZ8hkrzWbmYMSW7DSEyrbDTgMyMflW7bTMrFm2v7EMStSWKprx0547c7JWZ6iNGg9kjADT7HSqvJ0oJ+f20dn6YxLSBb1IdCooxus0vsbIpVjFkoa1RibFdhWkeRo37YK4ZjHGyujkIm1DKQAqFRsphrY2rK7SuthZnHVdwZCHHKqx0FcBZSxTrkaXoHofWVGMeRlybeUS1cjBGsL2hLK0zIy8tGnCj+uE2SEPQAIHI+hfmeQfPZfGZJL+TrrSrxRNOnUcn8I9ev1+tD8r+JIDsvy29LzB5iqFwdETPksrVtVoVEyWIzGHmjtMYzGoQAkMNDkoCxVQCOE1sjn6hUj8GkuQRRWcF9qxaO7M0S++CANEhm4I079O7hYWZgqsSQB8YqeJiNGxR4y2445ZXkE01qL1lWRisJIH46Ylm18quiutFgTKeaUPF7dPHeS4mPEffGGvE4+5atG+tukLPIIwoRNEjpPa4Qj8gA5jk6CqD95DhjoSXk62S92qmc+0tUnPdef2N7JUYoyfBdFMaqoAVvlANknSGvllx2IE1L7iOzkGTi1FIG4RjrmBEaPoEFSS+/klgAqjbeeqwoS1MTZe3KuSLwyNGibjliMkRdjrtyVm3+XKMmkJ6B+pz46hLdjbKXRHSNmKQ24maJBUDbEepWUBuQFQdAgEfBDqQYV5x1bI7kLlKzV8elnmpX3SVXr+wxoIoxGkT/DqGMmuEJ/IKNn4/JtA1naulnGtNLcggaGLlCVrtPGulZwU2/wDo6/on57DfROrlrN6pI+Ght1p3uPb90UilgioCp2RtQi77/JQ2wCBx0Rs9+SbVOSGQS1Y1hV7MKLGmumGwy6AZTvX5fCsf2IIIAZcqu5XheIs4jqkm+wV2UO+o+ldQn4Fh8hV2FO+QV/5D6KYvFjIZKaPDRrajgiSeW0YQIoVVWeYyM3WlQ+z/6H9S87619CopnqVXA+2f0ntJGi9rIOl0DoaBBKgn++ta/r6qTmpF817PMMqElkPDKGZ9/H9AAqD8fsfgfO/q1ekCR6QosFq1Tas008SJJHDG0kjQwQbD8jqQMv7n/k6aHW/gtzfq4+5k8fJ5AJIo1hmjiMBkBVu1LFCSGRSWU8jXyO9/Ck/QfJ2bGUof7jHckiSSSKJS0lgrD60UKSCWAVEfkAEkBtKAPn6b5q9i74zj7FWjNYxMWRnmyCTY6OH7cStWHJKS/MbMrpHz6TpZWGgCEqxqpUmjU//9k=",
      Name: "Transitions - Solid/Mucinous [Histology]",
      Content:
        "Analysis of molecular expression clusters derived from ROI analysis revealed that many regions of tumor epithelium exhibit mixed or transitional expression patterns. \n\nWhile broad morphologic changes are observable on visual review of H&E histology, molecular analysis of high dimensional imaging data illuminates the remarkable degree of heterogeneity in differentiation and architecture in even small regions of tumor. Moreover, analysis of transitional regions in high dimensional space reveals a continuous gradient of expression states between exemplars of each morphologic or expression group, suggesting that many cells lie in an intermediate differentiation state not readily identifiable by morphologic review or analysis of small groups of markers. \n\nThese results further suggest that some tumors may exhibit highly plastic phenotypes, with rapid shift between different molecular and morphologic states in closely contiguous regions of tumor. ",
      Pan: [0.686441104293455, 0.409558554502176],
      Zoom: 5.54609310695424,
      Group: "Hematoxylin & Eosin",
    },
    Arrows: [
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.715086358932731, 0.404547739101745],
        Text: "Adenocarcinoma, with solid and signet ring cell morphology",
      },
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.713032078749014, 0.432016399844021],
        Text: "Adenocarcinoma, with mucinous morphology",
      },
    ],
    Overlays: [
      {
        height: 0.0655608847203462,
        width: 0.0609240808770988,
        x: 0.672474718550482,
        y: 0.378018177872026,
      },
    ],
  },
  {
    UUID: "268aee9d-5972-4a23-b3bb-3155ed2d60eb",
    State: {
      Expanded: true,
    },
    Properties: {
      ThumbnailDataUrl:
        "data:image/jpeg;base64,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",
      Name: "Transitions - Solid/Mucinous [CyCIF]",
      Content:
        "Analysis of molecular expression clusters derived from ROI analysis revealed that many regions of tumor epithelium exhibit mixed or transitional expression patterns. \n\nWhile broad morphologic changes are observable on visual review of H&E histology, molecular analysis of high dimensional imaging data illuminates the remarkable degree of heterogeneity in differentiation and architecture in even small regions of tumor. Moreover, analysis of transitional regions in high dimensional space reveals a continuous gradient of expression states between exemplars of each morphologic or expression group, suggesting that many cells lie in an intermediate differentiation state not readily identifiable by morphologic review or analysis of small groups of markers. \n\nThese results further suggest that some tumors may exhibit highly plastic phenotypes, with rapid shift between different molecular and morphologic states in closely contiguous regions of tumor. ",
      Pan: [0.68979329540089, 0.409378034033279],
      Zoom: 5.54609310695424,
      Group: "Transitions",
    },
    Arrows: [
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.717283333549791, 0.396108533420069],
        Text: "Adenocarcinoma, with solid and signet ring cell morphology",
      },
      {
        Angle: 360,
        HideArrow: false,
        Point: [0.711599065547207, 0.430697908925159],
        Text: "Adenocarcinoma, with mucinous features",
      },
      {
        Angle: 60,
        HideArrow: true,
        Point: [0.649314001263566, 0.444122456761051],
        Text: "Mucosa",
      },
    ],
    Overlays: [
      {
        height: 0.0656714367107122,
        width: 0.0660947332640962,
        x: 0.673804730423638,
        y: 0.376576421028209,
      },
    ],
  },
].map(({ Properties, UUID, State, Arrows, Overlays }) => ({
  id: UUID,
  State,
  ...(Arrows?.length ? { Arrows: Arrows as LegacyExhibitArrow[] } : {}),
  ...(Overlays?.length ? { Overlays: Overlays as LegacyExhibitOverlay[] } : {}),
  ...Properties,
  Pan: [Number(Properties.Pan?.[0]) || 0, Number(Properties.Pan?.[1]) || 0] as [
    number,
    number,
  ],
}));

// TODO: remove legacy exhibit data structure
const exhibit_config = {
  Name: "Multiplexed 3D atlas of state transitions and immune interactions in colorectal cancer",
  Stories: [
    {
      Waypoints: configWaypoints.map((wp) => ({
        Name: wp.Name,
        Description: wp.Content,
        Pan: wp.Pan as [number, number],
        Zoom: wp.Zoom,
        Group: wp.Group ?? "",
      })),
    },
  ],
  Groups: [
    // {
    //   Image: {
    //     Method: "Brightfield",
    //   },
    //   Channels: ["Hematoxylin", "Eosin"],
    //   Colors: ["8233CC", "FF8080"],
    //   Name: "Hematoxylin & Eosin",
    //   Path: "Histology_40__HE-r--41__HE-g--42__HE-b",
    //   Highs: [65600, 65600, 65600],
    //   Lows: [0, 0, 0],
    // },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["HE_r", "HE_g", "HE_b"],
      Colors: ["ff0000", "00ff00", "0000ff"],
      Name: "Hematoxylin & Eosin",
      Path: "Histology_40__HE-r--41__HE-g--42__HE-b",
      Highs: [65600, 65600, 65600],
      Lows: [0, 0, 0],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "PanCK", "ASMA", "CD31", "CD45"],
      Colors: ["0000ff", "ffffff", "ff0000", "00ff00", "ffff00"],
      Name: "Tissue Structure",
      Path: "Tissue-Structure_0__DNA1--14__PanCK--15__ASMA--35__CD31--18__CD45",
      Highs: [30000, 40000, 10000, 10000, 12000],
      Lows: [500, 500, 500, 500, 1500],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "CD45", "CD8a", "CD4", "CD20", "CD68"],
      Colors: ["0000ff", "ffffff", "ff0000", "ff00ff", "ffff00", "00ff00"],
      Name: "Immune Populations",
      Path: "Immune-Populations_0__DNA1--18__CD45--23__CD8a--17__CD4--21__CD20--22__CD68--25__CD163",
      Highs: [30000, 20000, 15000, 8000, 45000, 15000],
      Lows: [500, 1500, 3000, 3000, 500, 3000],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "CD8a", "CD4", "CD20", "FOXP3"],
      Colors: ["0000ff", "00ff00", "ff0000", "ffff00", "ffffff"],
      Name: "Lymphocytes",
      Path: "Lymphocytes_0__DNA1--23__CD8a--17__CD4--21__CD20--26__FOXP3",
      Highs: [30000, 15000, 8000, 45000, 15000],
      Lows: [500, 3000, 3000, 500, 500],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "CD68", "CD163"],
      Colors: ["0000ff", "00ff00", "ff0000"],
      Name: "Macrophages",
      Path: "Macrophages_0__DNA1--22__CD68--25__CD163",
      Highs: [30000, 10000, 7000],
      Lows: [500, 1000, 2000],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "PCNA", "PanCK", "CD45", "Ki67"],
      Colors: ["0000ff", "ff0000", "ffffff", "00ffff", "00ff00"],
      Name: "Proliferation",
      Path: "Proliferation_0__DNA1--37__PCNA--14__PanCK--18__CD45--13__Ki67",
      Highs: [30000, 20000, 65000, 15000, 8000],
      Lows: [500, 5000, 1000, 1500, 4000],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "PanCK", "PDL1", "PD1"],
      Colors: ["0000ff", "ffffff", "ff0000", "00ff00"],
      Name: "PD1 Immune Checkpoint",
      Path: "PD1-Immune-Checkpoint_0__DNA1--14__PanCK--27__PDL1--19__PD1",
      Highs: [30000, 65000, 6000, 6000],
      Lows: [500, 1000, 2500, 1500],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "CD4", "FOXP3"],
      Colors: ["0000ff", "ffffff", "ff0000"],
      Name: "Helper and Regulatory T Cells",
      Path: "Helper-and-Regulatory-T-Cells_0__DNA1--17__CD4--26__FOXP3",
      Highs: [30000, 15000, 10000],
      Lows: [500, 3000, 1000],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "CD8a", "PD1"],
      Colors: ["0000ff", "ffffff", "00ff00"],
      Name: "CD8 Cytotoxic T Cells",
      Path: "CD8-Cytotoxic-T-Cells_0__DNA1--23__CD8a--19__PD1",
      Highs: [30000, 25000, 10000],
      Lows: [500, 3000, 1500],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "CD8a", "FOXP3"],
      Colors: ["0000ff", "ffffff", "ff0000"],
      Name: "FOXP3 CD8 T Cells",
      Path: "FOXP3-CD8-T-Cells_0__DNA1--23__CD8a--26__FOXP3",
      Highs: [30000, 25000, 10000],
      Lows: [500, 3000, 1000],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "PanCK", "Na_K_ATPase"],
      Colors: ["0000ff", "ffffff", "00ff00"],
      Name: "NaK ATPase",
      Path: "NaK-ATPase_0__DNA1--14__PanCK--10__Na-K-ATPase",
      Highs: [30000, 65000, 20000],
      Lows: [500, 1000, 1000],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "PanCK", "Ecadherin"],
      Colors: ["0000ff", "ffffff", "00ff00"],
      Name: "E-Cadherin",
      Path: "E-Cadherin_0__DNA1--14__PanCK--29__Ecadherin",
      Highs: [30000, 65000, 25000],
      Lows: [500, 1000, 1000],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "ASMA", "Desmin", "Collagen", "Vimentin"],
      Colors: ["0000ff", "ff0000", "00ff00", "ffffff", "00ffff"],
      Name: "Stroma",
      Path: "Stroma_0__DNA1--15__ASMA--34__Desmin--39__Collagen--30__Vimentin",
      Highs: [30000, 30000, 30000, 60000, 5000],
      Lows: [500, 1000, 1000, 1000, 1000],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "CD4", "CD68", "CD163", "PDL1"],
      Colors: ["0000ff", "ffffff", "00ffff", "00ff00", "ff0000"],
      Name: "PDL1-Positive Immune Cells",
      Path: "PDL1-Positive-Immune-Cells_0__DNA1--17__CD4--22__CD68--25__CD163--27__PDL1",
      Highs: [30000, 15000, 15000, 10000, 5000],
      Lows: [500, 3000, 3000, 2000, 2500],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "PDL1", "CD8a", "PD1"],
      Colors: ["0000ff", "ff0000", "ffffff", "00ff00"],
      Name: "PDL1-CD8 Interaction",
      Path: "PDL1-CD8-Interaction_0__DNA1--27__PDL1--23__CD8a--19__PD1",
      Highs: [30000, 5000, 25000, 10000],
      Lows: [500, 2500, 3000, 1500],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "PanCK", "Ecadherin", "PCNA"],
      Colors: ["0000ff", "ffffff", "00ff00", "ff0000"],
      Name: "Tumor Budding Epithelial",
      Path: "Tumor-Budding-Epithelial_0__DNA1--14__PanCK--29__Ecadherin--37__PCNA",
      Highs: [40000, 65000, 25000, 50000],
      Lows: [500, 1000, 1000, 1000],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "PanCK", "PDL1", "FOXP3", "CD8a", "PD1"],
      Colors: ["0000ff", "ffffff", "ff0000", "ffff00", "00ff00", "6c00ff"],
      Name: "Tumor Budding Immune Modulation",
      Path: "Tumor-Budding-Immune-Modulation_0__DNA1--14__PanCK--27__PDL1--26__FOXP3--23__CD8a--19__PD1--22__CD68",
      Highs: [30000, 40000, 5000, 7000, 20000, 6000],
      Lows: [500, 500, 2500, 1000, 1500, 1500],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "LaminABC"],
      Colors: ["0000ff", "00ff00"],
      Name: "Nuclear Lamina",
      Path: "Nuclear-Lamina_0__DNA1--33__LaminABC",
      Highs: [30000, 20000],
      Lows: [500, 500],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "DNA10"],
      Colors: ["0000ff", "ff0000"],
      Name: "DAPI Cycle Correlation",
      Path: "DAPI-Cycle-Correlation_0__DNA1--36__DNA10",
      Highs: [65000, 50000],
      Lows: [1000, 1000],
    },
    {
      Image: {
        Method: "Colorimetric",
      },
      Channels: ["DNA1", "PanCK", "Ecadherin", "PCNA"],
      Colors: ["0000ff", "ffffff", "00ff00", "ff0000"],
      Name: "Transitions",
      Path: "Transitions_0__DNA1--14__PanCK--29__Ecadherin--37__PCNA",
      Highs: [32768, 50000, 50000, 20000],
      Lows: [0, 0, 1000, 5000],
    },
  ],
};
const jpeg_exhibit_config = {
  Name: "JPEG demo",
  Stories: [
    {
      Waypoints: configWaypoints.map((wp) => ({
        Name: wp.Name,
        Description: wp.Content,
        Pan: wp.Pan as [number, number],
        Zoom: wp.Zoom,
        Group: wp.Group ?? "",
      })),
    },
  ],
  Groups: [
    {
      Image: {
        Method: "",
      },
      Channels: ["DNA1", "AF488"],
      Colors: ["0000ff", "ffffff"],
      Name: "DemoGroup",
      Path: "DemoGroup_0__DNA1--1__AF488",
      Highs: [30000, 40000],
      Lows: [500, 500],
    },
  ],
};

export { configWaypoints, exhibit_config, jpeg_exhibit_config };
