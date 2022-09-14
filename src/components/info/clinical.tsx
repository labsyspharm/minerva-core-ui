import * as React from "react";
import { Hi, Los } from "../../lib/oxfordComma";
import { oxfordComma } from "../../lib/oxfordComma";

const clinical = (inputs) => {
  const {
    InitialDiseaseStatus,
    ProgressionOrRecurrence
  } = inputs;
  const {
    Progression, Recurrence
  } = ProgressionOrRecurrence;
  const {
    ProgressionFreeSurvivalInDays,
    SurvivalInDays
  } = Recurrence;
  const species = "participant";
  const percent = ((total, free) => {
    return `${Math.round(100 * free / total)}%`;
  })(SurvivalInDays, ProgressionFreeSurvivalInDays);
  const stability = [
    "no disease progression or recurrence",
    "no disease recurrence" 
  ][+Progression];
  return `
    The ${species} had ${stability} 
    for ${percent} of the ${SurvivalInDays} days of survival.
    ${Hi(ProgressionOrRecurrence.Comment)}
  `
}

const genetic = (inputs) => {
  const { GenotypeAvailable, MolecularAnalysisMethod } = inputs;
  const species = "participant";
  const available = [
    "no genotype available",
    `a genotype available via ${MolecularAnalysisMethod}`
  ][+GenotypeAvailable];
  return `
    The ${species} has ${Los(available)}.
  `
}

const patient = (inputs) => {
  const {
    AgeAtDiagnosis, Ethnicity, Gender, Race, VitalStatusAtLastFollowUp, YearsSmoked
  } = inputs;
  const species = "participant";
  const who = `${Race} (${Ethnicity}) ${Gender} ${species} `
  const age = Math.floor(AgeAtDiagnosis/365);
  const smoked = {
    "0": `The ${species} is a non-smoker.`,
    "None": `The ${species} is a non-smoker.`,
    "Not Reported": `The ${species} has no reported history of smoking.`
  }[`${YearsSmoked}`] || `The ${species} smoked for ${YearsSmoked} years.`
  return `
    The ${Los(who)} was ${age} at time of diagnosis.
    The ${species} was ${Los(VitalStatusAtLastFollowUp)} at last follow-up.
    ${smoked}
  `
}

const treatment = (inputs) => {
  const {PriorTreatment, Treatment, TreatmentType} = inputs;
  const species = "participant";
  const current = `${species} was treated by ${Treatment}.`;
  return [
    [
      `The ${species} had no current or prior treatment.`,
      `The ${species} had no prior treatment before the ${current}`
    ][+Treatment],
    [
      `The ${species} had prior treatment.`,
      `The ${species} had no prior treatment. The ${current}`
    ][+Treatment]
  ][+PriorTreatment];
}
const Clinical = (props) => {
  const {
    ClinicalDetails, GeneticDetails, PatientDetails, TreatmentDetails
  } = props.src

  return (
    <div>
      <p>
        {clinical(ClinicalDetails)}
        {genetic(GeneticDetails)}
      </p>
      <p>
        {patient(PatientDetails)}
        {treatment(TreatmentDetails)}
      </p>
    </div>
  )
} 

export {
  Clinical
}
