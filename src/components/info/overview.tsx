import * as React from "react";
import { Hi, Los } from "../../lib/oxfordComma";
import { oxfordComma } from "../../lib/oxfordComma";
import { imagingDetails } from "../../lib/imagingDetails";

const Overview = (props) => {
  const {
    AcquisitionMethodType, GeneticFeatures, ImagingAssayType, ImagingDetails, LastKnownDiseaseStatus, PrimaryDiagnosis, SiteOfResectionOrBiopsy, Species, TimepointLabel, Treatment, TreatmentType, TumorGrade
  } = props.src;

  const species = {
    "human": "participant"
  }[Los(Species)] || Los(Species)

  const treatment = `was treated with ${Los(TreatmentType)}`;
  const treated = Treatment ? treatment : "was untreated";
  return (
    <div>
      <p>
        Aquired by {Los(AcquisitionMethodType)}
        {" from"} a {species} {"with "}
        {Los(TumorGrade)} {Los(PrimaryDiagnosis)},
        {" this"} {Los(SiteOfResectionOrBiopsy)} tissue
        {" was"} captured using {ImagingAssayType}.
        {" The"} {species}'s last known disease status
        {" was"} {Los(LastKnownDiseaseStatus)}.
      </p>
      <p>
      The {species} has the following genetic features:
      </p>
      <ul>
        {
          GeneticFeatures.map((txt, i) => {
            return (<li key={i}>{txt}</li>);
          })
        }
      </ul>
      <p>
        The {species} {treated}. The sample was taken
        {" at"} the {Los(TimepointLabel)} timepoint.
        {imagingDetails(ImagingDetails)}
      </p>
    </div>
  )
} 

export {
  Overview
}
