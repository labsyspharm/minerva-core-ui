import * as React from "react";
import { Hi, Los } from "../../lib/oxfordComma";
import { oxfordIds } from "../../lib/oxfordComma";

const Biospecimen = (props) => {
  const {
    CollectionDetails, Identifiers
  } = props.src;
  const {
    AcquisitionMethodType, BiospecimenType, PreservationMethod, ProtocolLink, SpecimenThickness, StorageMethod, TimestampLabel, Timestamps
  } = CollectionDetails;

  const ids = oxfordIds(Identifiers);
  const storage = Los(StorageMethod);

  //TODO Timestamps
  return (
    <div>
      <p>
        The specimen of {Los(BiospecimenType)} was collected via{" "}
        {Los(AcquisitionMethodType)} at the time of {Los(TimestampLabel)}.
      </p>
      <p>
        {ids} {" "}
        The <a href={ProtocolLink}>{Los(PreservationMethod)} protocol</a>
        {" "}involved a sample that's {SpecimenThickness} thick and was {Los(storage)}.
      </p>
    </div>
  )
} 

export {
  Biospecimen
}
