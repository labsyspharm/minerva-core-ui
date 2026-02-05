import { Hi, Los } from "./oxfordComma";

const imagingDetails = (inputs) => {
  const { Binned, FixativeType, Microscope, Objective } = inputs;
  const binned = Binned ? "binned" : "unbinned";
  return `
    The ${binned} tissue in ${Los(FixativeType)} fixative
    was captured on a ${Microscope} microscope with a
    ${Objective} objective. ${Hi(inputs.Comment)}
  `;
};
export { imagingDetails };
