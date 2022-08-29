const MITI_UI = {
  "Biospecimen": {
    "CollectionDetails": {
      "AcquisitionMethodType": "Surgical Resection",
      "BiospecimenType": "Tissue Biospecimen Type",
      "PreservationMethod": "Formalin fixed paraffin embedded - FFPE",
      "ProtocolLink": "https://www.protocols.io/view/automated-tissue-fixation-with-10-nbf-leica-5jyl8n349l2w/v14",
      "SpecimenThickness": "5 microns",
      "StorageMethod": "Refrigerated at 4 degrees",
      "TimestampLabel": "Initial Diagnosis",
      "Timestamps": [
        {
          "Days": 25222,
          "Type": "Days from Index"
        },
        {
          "Days": 27645,
          "Type": "Days to Processing"
        }
      ]
    },
    "Identifiers": [
      {
        "ID": "HTA7_926",
        "Type": "HTAN Participant ID"
      },
      {
        "ID": "HTA7_926_8",
        "Type": "HTAN Biospecimen ID"
      },
      {
        "ID": "HTA7_926_1",
        "Type": "HTAN Parent ID"
      }
    ]
  },
  "Channels": [
    {
      "Antibody": [
        {
          "AntibodyRole": "primary conjugated",
          "Clone": 1042,
          "HostSpecies": "Rabbit",
          "Identifier": "AB_10854267",
          "IdentifierType": "RRID",
          "Isotype": "IGM",
          "Polyclonal": false,
          "TargetName": "Collagen"
        }
      ],
      "Channel": {
        "EmissionBandwidth": 40,
        "EmissionWavelength": 692,
        "ExcitationBandwidth": 10,
        "ExcitationWavelength": 651
      },
      "ChannelName": "Collagen-660",
      "Fluorophore": {
        "Name": "eFluor 660"
      },
      "PassedQualityControl": true
    },
    {
      "Antibody": [
        {
          "AntibodyRole": "primary unconjugated",
          "Clone": null,
          "HostSpecies": null,
          "Identifier": null,
          "IdentifierType": null,
          "Isotype": null,
          "Polyclonal": null,
          "TargetName": "CD3"
        },
        {
          "AntibodyRole": "secondary conjugated",
          "HostSpecies": "Donkey",
          "Identifier": "AB_2535794",
          "IdentifierType": "RRID",
          "Polyclonal": true,
          "TargetName": "Rat-IgG"
        }
      ],
      "Channel": {
        "EmissionBandwidth": 20,
        "EmissionWavelength": 522,
        "ExcitationBandwidth": 25,
        "ExcitationWavelength": 485
      },
      "ChannelName": "CD3-488",
      "Fluorophore": {
        "Name": "Alexa Fluor 488"
      },
      "PassedQualityControl": true
    }
  ],
  "Clinical": {
    "ClinicalDetails": {
      "InitialDiseaseStatus": "Initial Diagnosis",
      "ProgressionOrRecurrence": {
        "Comment": "etc.",
        "Progression": true,
        "Recurrence": {
          "ProgressionFreeSurvivalInDays": 397,
          "SurvivalInDays": 397
        }
      }
    },
    "GeneticDetails": {
      "GenotypeAvailable": true,
      "MolecularAnalysisMethod": "Targeted Sequencing"
    },
    "PatientDetails": {
      "AgeAtDiagnosis": 25185,
      "Ethnicity": "not hispanic or latino",
      "Gender": "male",
      "Race": "white",
      "VitalStatusAtLastFollowUp": "Alive",
      "YearsSmoked": "Not Reported"
    },
    "TreatmentDetails": {
      "PriorTreatment": false,
      "TreatmentType": "None"
    }
  },
  "Overview": {
    "AcquisitionMethodType": "Surgical Resection",
    "GeneticFeatures": [
      "KRAS Mutant"
    ],
    "ImagingAssayType": "t-CyCIF",
    "ImagingDetails": {
      "Binned": true,
      "Comment": "Type of Binning, etc.",
      "FixativeType": "Formalin",
      "Microscope": "RareCyte;CF;46",
      "Objective": "Nikon CFI Plan Apo Lambda 20X"
    },
    "LastKnownDiseaseStatus": "Distant met recurrence/progression",
    "PrimaryDiagnosis": "Mucous adenocarcinoma",
    "SiteOfResectionOrBiopsy": "Rectum NOS",
    "Species": "Human",
    "TimepointLabel": "Baseline",
    "TreatmentType": false,
    "TumorGrade": "Low Grade"
  },
  "Publication": {
    "Collaborators": [
      "Jia-Ren Lin"
    ],
    "Creators": [
      "Sarah Arena"
    ],
    "Curated": true,
    "DataLocations": [
      {
        "Path": "s3://lin-2021-crc-atlas/data/",
        "Type": "AWS"
      },
      {
        "Path": "https://labsyspharm.github.io/HTA-CRCATLAS-1/minerva/crc02-overview.html",
        "Type": "URL"
      }
    ],
    "Identifiers": [
      {
        "ID": "CRC02",
        "Type": "Publication Participant Number"
      },
      {
        "ID": "HTA7_926",
        "Type": "HTAN Participant ID"
      },
      {
        "ID": "LSP42",
        "Type": "LSP Slide ID"
      }
    ],
    "Publication": {
      "Authors": [
        "Jia-Ren Lin",
        "Shu Wang",
        "Shannon Coy",
        "Madison Tyler",
        "Clarence Yapp",
        "Yu-An Chen",
        "Cody N. Heiser",
        "Ken S. Lau",
        "Sandro Santagata",
        "Peter K. Sorger"
      ],
      "Journal": "N/A, Preprint",
      "PublicationDOI": "10.1101/2021.03.31.437984v1",
      "PublicationFirstAuthor": "Lin",
      "PublicationTitle": "Multiplexed 3D atlas of state transitions and immune interactions in colorectal cancer",
      "Year": 2021
    },
    "StoryDOI": "10.1101/placeholder/DOI/",
    "StoryTitle": "CRC02 - overview - Lin, Wang, Coy et al., 2021",
    "StoryTitleDetails": [
      {
        "PublicationParticipantNumber": "CRC02"
      },
      {
        "Citation": "Lin, Wang, Coy et al., 2021"
      },
      {
        "Type": "Overview"
      }
    ],
    "Type": "Overview"
  }
}
export default MITI_UI
