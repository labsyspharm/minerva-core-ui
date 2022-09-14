import * as React from "react";
import { Hi, Los } from "../../lib/oxfordComma";
import { oxfordIds } from "../../lib/oxfordComma";
import { oxfordComma } from "../../lib/oxfordComma";

const Publication = (props) => {
  const {
    Collaborators, Creators, Curated, DataLocations, Identifiers, Publication, StoryDOI, StoryTitle, StoryTitleDetails, Type
  } = props.src;

  const doiRoot = "http://dx.doi.org/";
  const doiUrl = `${doiRoot}${StoryDOI}`;

  const made = ["made", "curated"][+Curated];
  const creators = oxfordComma(Creators);

  const collaborators = oxfordComma(Collaborators);
  const collab = [
    "", ` in collaboration with ${collaborators}`
  ][+(collaborators.length > 0)]

  const citation = StoryTitleDetails.reduce((o,d) => {
    if ("Citation" in d) {
      return ` The story cites "${d.Citation}".`;
    }
    return o;
  }, "");

  const urls = DataLocations.map(d => {
    const label = {
      "URL": `On the web`
    }[d.Type] || `At ${d.Type}`;
    return (
      <li>
        <a href={d.Path}>{label}</a>
      </li>
    )
  });

  const ids = oxfordIds(Identifiers);

  const pubTitle = Publication.PublicationTitle;
  const pubAuthors = oxfordComma(Publication.Authors);
  const pubUrl = `${doiRoot}${Publication.PublicationDOI}`;
  const pubLink = `${Publication.Journal}, ${Publication.Year}`

  return (
    <div>
      <p>
        This {Los(Type)} story, "<a href={doiUrl}>{StoryTitle}</a>", 
        was {made} by {creators}{collab}.{citation}
        {ids}
      </p>
      <p>
        The data can be found here:
        <ul> {urls} </ul>
      </p>
      <p>
        The publication "{pubTitle}" is by {pubAuthors}.
        Find the publication at this link: {" "}
        <a href={pubUrl}>{pubLink}</a>.
      </p>
    </div>
  )
} 

export {
  Publication
}
