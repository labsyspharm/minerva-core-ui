import * as React from "react";
import { createRoot } from 'react-dom/client';
import { Main } from "./src/main";
import "@fontsource/overpass/200.css";
import "@fontsource/overpass/500.css";
import { createGlobalStyle } from "styled-components";
import { loremIpsum } from "react-lorem-ipsum";

const fakeText = (p) => {
  const random = true;
  return loremIpsum({ p, random }).join("\n\n");
};

const title = 'Primary Lung Cancer [M-003]';
const configGroups = [{"UUID":"cJhdq_kwPVoJqll9U9SFS","Properties":{"Name":"Nisi"},"State":{"Expanded":false}},{"UUID":"Buq8Dzkvn2eiAHV7A4a3n","Properties":{"Name":"Ex"},"State":{"Expanded":false}},{"UUID":"GuucVjwhz5trdBJ6y1nqN","Properties":{"Name":"Tellus"},"State":{"Expanded":false}},{"UUID":"VSd3fdp8Mq9usz6wVgsfY","Properties":{"Name":"Aute"},"State":{"Expanded":false}}];
const configGroupChannels = [{"UUID":"R-72QcvkCiCDsNNwVAVyk","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"cJhdq_kwPVoJqll9U9SFS"},"SourceChannel":{"UUID":"lCY7HmqGHN1dAObaAA4Wb"}}},{"UUID":"k0VOVNWX195jJgNWSrDm8","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"cJhdq_kwPVoJqll9U9SFS"},"SourceChannel":{"UUID":"hjWWueQV8HHco4KwiMsxn"}}},{"UUID":"XVr8ugTPeXrWnOJbQ8P-A","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"cJhdq_kwPVoJqll9U9SFS"},"SourceChannel":{"UUID":"1cHNkTDf7xP3nOW4Ah97d"}}},{"UUID":"O_8R3VqndxEFR2ZO-zoxT","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"cJhdq_kwPVoJqll9U9SFS"},"SourceChannel":{"UUID":"FuR2Pp9nb73_DBRx0J_Y2"}}},{"UUID":"Gb6WrTfq5hTIr0j46XLcR","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"cJhdq_kwPVoJqll9U9SFS"},"SourceChannel":{"UUID":"pyHOA5CW5LNhLnOwrCQyJ"}}},{"UUID":"QyWrwokaBYhMzfVVFbLMO","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"cJhdq_kwPVoJqll9U9SFS"},"SourceChannel":{"UUID":"fQxiF0jGtua937STzOdvr"}}},{"UUID":"DrqFU_EcMG8fihMxm5fdu","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"Buq8Dzkvn2eiAHV7A4a3n"},"SourceChannel":{"UUID":"AZqVHHRsB-gj-yq_ek5T5"}}},{"UUID":"NMHImA6fP2Fuz8DAE9nnO","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"Buq8Dzkvn2eiAHV7A4a3n"},"SourceChannel":{"UUID":"j_JjeteOifIkuKVhORERx"}}},{"UUID":"jAWgBPZJkcHbXLxbQ2C6R","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"Buq8Dzkvn2eiAHV7A4a3n"},"SourceChannel":{"UUID":"dHfZ5FgUGjF4sxhnDbtxR"}}},{"UUID":"vpmIunMBwKMFWpTUf6TB_","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"Buq8Dzkvn2eiAHV7A4a3n"},"SourceChannel":{"UUID":"4oGrnERLc6g2f1-E8NMS9"}}},{"UUID":"fvQ4Kd2nm_iAX0A6hdAtr","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"Buq8Dzkvn2eiAHV7A4a3n"},"SourceChannel":{"UUID":"Lk_oQTOcHwDtTZaCParLU"}}},{"UUID":"siqkrTHs7tD79ygBKAkST","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"Buq8Dzkvn2eiAHV7A4a3n"},"SourceChannel":{"UUID":"aUkQ0Z9XC2HxK0Op9gZ22"}}},{"UUID":"mnbFhNLSs9MpT4GQPmtUQ","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"GuucVjwhz5trdBJ6y1nqN"},"SourceChannel":{"UUID":"RIGFUBUOBVcfB2J-OiFpA"}}},{"UUID":"C0sR1GLTVtzgQUt_z2v8H","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"GuucVjwhz5trdBJ6y1nqN"},"SourceChannel":{"UUID":"YsZruD8Z042oIZ-vNsXh4"}}},{"UUID":"eI1gBiYbDA5cMMDBSfJTl","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"GuucVjwhz5trdBJ6y1nqN"},"SourceChannel":{"UUID":"2cgSr7L3pRFqBieZo1PIe"}}},{"UUID":"hKGTxoYtOq1VE9dvFTlSQ","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"GuucVjwhz5trdBJ6y1nqN"},"SourceChannel":{"UUID":"d8CVOyPFP0xBOh0WbSHb-"}}},{"UUID":"7ISrOGv9Yc4pzdim-Q90z","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"GuucVjwhz5trdBJ6y1nqN"},"SourceChannel":{"UUID":"LDvuNpf2UUh2vr6mTBhp9"}}},{"UUID":"oQtydDUxCeGJI4PJgRyYt","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"GuucVjwhz5trdBJ6y1nqN"},"SourceChannel":{"UUID":"RaDEfhEjK76UKYvRIJhxB"}}},{"UUID":"fbsrgfH0NGQ5sCrVXH7V3","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"VSd3fdp8Mq9usz6wVgsfY"},"SourceChannel":{"UUID":"BZ_tTob35EmNMBpxYxD6X"}}},{"UUID":"JKXy2TRDJ9m87x0Kg1-9q","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"VSd3fdp8Mq9usz6wVgsfY"},"SourceChannel":{"UUID":"NWQZZfnTmBy_2WjrphG1V"}}},{"UUID":"KZJfqc6QuRnkF8OpIkm7K","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"VSd3fdp8Mq9usz6wVgsfY"},"SourceChannel":{"UUID":"p4QWRnnf8969gd_g9de4H"}}},{"UUID":"HrHKTX5rSxQKhmUZvzSRu","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"VSd3fdp8Mq9usz6wVgsfY"},"SourceChannel":{"UUID":"7ifOr0NPzHB2pUpMUPaEr"}}},{"UUID":"M390AYf61DemwR1yFmSGE","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"VSd3fdp8Mq9usz6wVgsfY"},"SourceChannel":{"UUID":"PXpUQsfO8e2oKD_qZFM-9"}}},{"UUID":"baUpFJ6p--98W_BAzepsH","State":{"Expanded":false},"Properties":{"LowerRange":0,"UpperRange":65535},"Associations":{"Group":{"UUID":"VSd3fdp8Mq9usz6wVgsfY"},"SourceChannel":{"UUID":"OqRKa_d3XndSaakBIn2xe"}}}]; 
const configSourceChannels = [{"UUID":"lCY7HmqGHN1dAObaAA4Wb","Properties":{"SourceIndex":0,"Name":"Cupidatat"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"hjWWueQV8HHco4KwiMsxn","Properties":{"SourceIndex":1,"Name":"Non"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"1cHNkTDf7xP3nOW4Ah97d","Properties":{"SourceIndex":2,"Name":"Parturient"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"FuR2Pp9nb73_DBRx0J_Y2","Properties":{"SourceIndex":3,"Name":"Vivamus"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"pyHOA5CW5LNhLnOwrCQyJ","Properties":{"SourceIndex":4,"Name":"Officia"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"fQxiF0jGtua937STzOdvr","Properties":{"SourceIndex":5,"Name":"Amet"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"AZqVHHRsB-gj-yq_ek5T5","Properties":{"SourceIndex":6,"Name":"Foo"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"j_JjeteOifIkuKVhORERx","Properties":{"SourceIndex":7,"Name":"Nisi"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"dHfZ5FgUGjF4sxhnDbtxR","Properties":{"SourceIndex":8,"Name":"Quis"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"4oGrnERLc6g2f1-E8NMS9","Properties":{"SourceIndex":9,"Name":"Voluptate"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"Lk_oQTOcHwDtTZaCParLU","Properties":{"SourceIndex":10,"Name":"Excepteur"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"aUkQ0Z9XC2HxK0Op9gZ22","Properties":{"SourceIndex":11,"Name":"Leo"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"RIGFUBUOBVcfB2J-OiFpA","Properties":{"SourceIndex":12,"Name":"Parturient"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"YsZruD8Z042oIZ-vNsXh4","Properties":{"SourceIndex":13,"Name":"Ex"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"2cgSr7L3pRFqBieZo1PIe","Properties":{"SourceIndex":14,"Name":"Tempor"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"d8CVOyPFP0xBOh0WbSHb-","Properties":{"SourceIndex":15,"Name":"Id"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"LDvuNpf2UUh2vr6mTBhp9","Properties":{"SourceIndex":16,"Name":"Non"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"RaDEfhEjK76UKYvRIJhxB","Properties":{"SourceIndex":17,"Name":"Sint"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"BZ_tTob35EmNMBpxYxD6X","Properties":{"SourceIndex":18,"Name":"Magna"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"NWQZZfnTmBy_2WjrphG1V","Properties":{"SourceIndex":19,"Name":"Sint"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"p4QWRnnf8969gd_g9de4H","Properties":{"SourceIndex":20,"Name":"Nisi"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"7ifOr0NPzHB2pUpMUPaEr","Properties":{"SourceIndex":21,"Name":"Aute"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"PXpUQsfO8e2oKD_qZFM-9","Properties":{"SourceIndex":22,"Name":"Ullamco"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}},{"UUID":"OqRKa_d3XndSaakBIn2xe","Properties":{"SourceIndex":23,"Name":"Tempor"},"Associations":{"SourceDataType":{"UUID":"aawr03YX1JW6XQVXyK0pr"},"SourceImage":{"UUID":"_JnONWXejFr9ikjaVOqOr"}}}];

const configWaypoints = [
  {
    "UUID": "test-a",
    "State": {
      "Expanded": true
    },
    "Properties": {
      "Name": "Metadata Template",
      "Content": "### Demographics  \n**Species:** Human  \n**Vital Status:** [Alive/deceased]  \n**Cause of death:** [if deceased]  \n**Sex:** (Female, Male, Intersex)   \n**Race:** [White, American Indian or Alaska Native, Black or African American, Asian, Native Hawaiian or Pacific Islander, Other]  \n**Ethnicity:** [Hispanic or Latino, Not Hispanic or Latino]  \n\n### Diagnosis  \n**Age at Diagnosis:** [years]  \n**Primary Diagnosis:**  \n**Site of Resection or Biopsy:**  \n**Tumor Grade:**  \n**Stage (AJCC 8th Edition):**  \n\n### Therapy  \n**Pre-operative:**  \n**Post-operative:**  \n**Initial Disease Status:**  \n\n### Follow Up  \n**Progression:**  \n**Last Known Disease Status:**   \n**Age at Follow Up:**  \n**Days to Progression## Metadata about this sample  \n\n"
    }
  },
  {
    "UUID": "test-b",
    "State": {
      "Expanded": true
    },
    "Properties": {
      "Name": "Data Aquisition",
      "Content": "Tissue cyclic immunofluorescence (t-CyCIF) was used to generate the fluorescence images.\n\nThe RareCyte CyteFinder microscope was used with a 40X/0.6NA objective.\n\nThe images were artifact corrected using the BaSiC tool, stitched and registered using the ASHLAR algorithm, \nand segmented using ilastik software and MATLAB. Single-cell features were then extracted from these images using HistoCAT software.\n\n![image](https://www.cycif.org/assets/img/du-lin-rashid-nat-protoc-2019/Fig1_Rashid_SciData.JPG)"
    }
  },
  {
    "UUID": "test-c",
    "State": {
      "Expanded": true
    },
    "Properties": {
      "Name": "Cell Segmentation",
      "Content": "Cells in the image were segmented using an object detection method. Here, we used the Ilastik software\nto train a model that classifies pixels into three classes (nucleus, cytoplasm, and background). \nProbability masks generated by the model were used to perform morphological manipulations and \nwatershed in MATLAB to identify cells. \n\nWhile ~90% of the cells in this tissue are segmented accurately, there are some errors including \nfusions (undersegmented cells) and fissions (over segmented cells) as shown here.\nCell segmentation is a critical component of extracting quality single-cell data and \ncan affect the quality of downstream analysis; segmentation is thus an active area of development\nin the image analysis community.\n\nPan around the image and toggle the segmentation mask, or \"data layer\" below, to inspect the accuracy.\n"
    }
  },
  {
    "UUID": "test-d",
    "State": {
      "Expanded": false
    },
    "Properties": {
      "Name": "Immune Populations",
      "Content": "Many immune populations are present in this lung cancer and are often \nenriched in the tumor region.\n\nWhen the subset of CD45 positive cells was clustered based on expression \nof CD45, CD3D, CD8A, CD4, CD20, PD1, and FOXP3 using k-means, \nseven distinct immune cell populations emerged.\n\nThe populations are shown in the heat map below, where each row represents \na cluster and each column represents an immune marker. \nThe color represents the expression level of each marker.\n"
    }
  }
]; 

const config = {
  "Header": "",
  "Rotation": 0,
  "Layout": {
    "Grid": [
      [
        "i0"
      ]
    ]
  },
  "Stories": [
    {
      "Name": "",
      "Waypoints": [
        {
          "Name": "Waypoint ( TODO remove )",
          "Group": "Structural Components",
          "Audio": "",
          "Description": "",
          "Zoom": 0.5,
          "Pan": [0.5, 0.5],
          "Overlays": [],
          "Arrows": [],
          "Polygon": "Q",
        },
      ],
    },
  ],
  "Groups": [
    {
      "Name": "Structural Components",
      "Colors": [
        "0000FF",
        "FFFFFF",
        "FF0000",
        "00FF00",
        "00FFFF"
      ],
      "Channels": [
        "DNA_1",
        "Keratin",
        "α-SMA",
        "CD45",
        "IBA1"
      ]
    },
    {
      "Name": "PD-L1 Expression",
      "Colors": [
        "0000FF",
        "FFFFFF",
        "FF0000",
        "00FFFF"
      ],
      "Channels": [
        "DNA_1",
        "Keratin",
        "PD-L1",
        "IBA1"
      ]
    },
    {
      "Name": "Lymphocytes",
      "Colors": [
        "0000FF",
        "FF0000",
        "FFFFFF"
      ],
      "Channels": [
        "DNA_1",
        "CD3D",
        "CD20"
      ]
    },
    {
      "Name": "Regulatory T-Cells",
      "Colors": [
        "0000FF",
        "FF0000",
        "00FF00",
        "FFFFFF"
      ],
      "Channels": [
        "DNA_1",
        "CD3D",
        "CD4",
        "FOXP3"
      ]
    },
    {
      "Name": "Cytotoxic T-Cells",
      "Colors": [
        "0000FF",
        "FF0000",
        "00FF00"
      ],
      "Channels": [
        "DNA_1",
        "CD3D",
        "CD8A"
      ]
    },
    {
      "Name": "Inhibitory T-Cells",
      "Colors": [
        "0000FF",
        "FF0000",
        "00FF00",
        "FFFFFF"
      ],
      "Channels": [
        "DNA_1",
        "CD3D",
        "PD1",
        "FOXP3"
      ]
    },
    {
      "Name": "CD8+/FOXP3+ T Cells",
      "Colors": [
        "0000FF",
        "00FF00",
        "FF0000",
        "FFFFFF"
      ],
      "Channels": [
        "DNA_1",
        "CD4",
        "CD8A",
        "FOXP3"
      ]
    },
    {
      "Name": "PD1+/LAG3+ T Cells",
      "Colors": [
        "0000FF",
        "00FF00",
        "FF0000",
        "00FFFF",
        "FFFFFF"
      ],
      "Channels": [
        "DNA_1",
        "CD4",
        "CD8A",
        "PD1",
        "LAG3"
      ]
    },
    {
      "Name": "Macrophages",
      "Colors": [
        "00FF00",
        "FF0000",
        "0000FF"
      ],
      "Channels": [
        "IBA1",
        "CD163",
        "DNA_1"
      ]
    },
    {
      "Name": "Macrophages (cont.)",
      "Colors": [
        "0000FF",
        "00FF00",
        "FFFFFF",
        "FF0000"
      ],
      "Channels": [
        "DNA_1",
        "CD68",
        "CD11B",
        "CD14"
      ]
    }
  ],
  "Masks": []
};
// TODO Warning: hard-coded for LUNG-3-PR_40X.ome.tif
const marker_names = ["DNA_1","AF488","AF555","AF647","DNA_2","A488 background","A555 background","A647 background","DNA_3","A488 background","LAG3","ARL13B","DNA_4","KI67","Keratin","PD1","DNA_5","CD45RB","CD3D","PD-L1","DNA_6","CD4","CD45","CD8A","DNA_7","CD163","CD68","CD14","DNA_8","CD11B","FOXP3","CD21","DNA_9","IBA1","α-SMA","CD20","DNA_10","CD19","GFAP","GTUBULIN","DNA_11","LAMINAC","BANF1","LAMINB"];

const color = "black";
const fontColor = "eeeeee";
const id = "react-output";
const MainStyle = createGlobalStyle`
  #${id} {
    background-color: ${color};
    font-family: "Overpass";
    font-weight: 200;
    color: #${fontColor};
    height: 100%;
  }
`;

const rootElement = document.getElementById(id);
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <Main 
      config={config} handleKeys={["ome-dir-1"]}
      title={title} marker_names={marker_names}
      configGroups={configGroups}
      configWaypoints={configWaypoints}
      configGroupChannels={configGroupChannels}
      configSourceChannels={configSourceChannels}
    />
    <MainStyle />
  </React.StrictMode>
);


