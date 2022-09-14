import * as React from "react";
import { Hi, Los } from "../../lib/oxfordComma";
import { oxfordIds } from "../../lib/oxfordComma";
import { oxfordComma } from "../../lib/oxfordComma";

const clonality = (anti) => {
  const { Clone, HostSpecies, Isotype, Polyclonal } = anti;
  const clonal = ['monoclonal', 'polyclonal'][+Polyclonal];
  const adj = `${clonal} ${Los(HostSpecies)} ${Isotype}`;
  if (Polyclonal) {
    return `It is a ${adj}.`
  }
  return `It is a ${adj} with clone #${Clone}.`
}

const antibodies = (list) => {
  if (list.length == 1) {
    const anti = list[0];
    const { AntibodyRole, TargetName } = anti;
    const basic = `The ${AntibodyRole} antibody targets ${TargetName}.`;
    return `${basic} ${clonality(anti)}`;
  }
  return list.map((anti) => {
    const { AntibodyRole, TargetName } = anti;
    const basic = `The ${AntibodyRole} antibody targets ${TargetName}.`;
    if (AntibodyRole.includes(" unconjugated")) {
      return `${basic}`;
    }
    return `${basic} ${clonality(anti)}`;
  }).join(' ');
}

const waves = (props) => {
  const { Wavelength, Fluorophore } = props;
  const ex = Wavelength.ExcitationWavelength;
  const em = Wavelength.EmissionWavelength;
  const exD = Wavelength.ExcitationBandwidth;
  const emD = Wavelength.EmissionBandwidth;
  const minEx = ex - 0.5 * exD;
  const maxEx = ex + 0.5 * exD;
  const minEm = em - 0.5 * emD;
  const maxEm = em + 0.5 * emD;
  return `
    The ${Fluorophore.Name} fluorophore 
    is excited from ${minEx} to ${maxEx} nm
    and emits from ${minEm} to ${maxEm} nm.
  `
}
const Channel = (props) => {
  const {
    Antibody, Channel, ChannelName, PassedQualityControl
  } = props;
  const conjugated = Antibody.filter(({AntibodyRole}) => {
    return AntibodyRole.includes(" conjugated");
  })[0];
  const {
    AntibodyRole, Identifier, IdentifierType 
  } = conjugated;

  const QC = PassedQualityControl ? 'passed' : 'failed';
  const ids = oxfordIds([{
    Type: `${AntibodyRole} antibody ${IdentifierType}`,
    ID: Identifier
  }]);
  const antibodyDetails = antibodies(Antibody);

  return (
    <li key={ChannelName}>
      <strong>{ChannelName}:</strong>
      {ids} {antibodyDetails}
      <strong>{" It"} has {QC} QC.</strong>
      {waves(props)}
    </li>
  );
}
const Channels = (props) => {
  const channels = props.src.map(Channel);
  return (
    <div>
      <ul>
      {channels}
      </ul>
    </div>
  )
} 

export {
  Channels
}
