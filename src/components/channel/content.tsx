import * as React from "react";
import { Groups } from "./groups";
import { Header } from "../common/header";
import styles from "./content.module.css";

const splitGroups = (groups) => {
  return groups.reduce(
    (out, group) => {
      const { channels } = group;
      if (channels.length <= 1) {
        return { ...out, solo: out.solo.concat([group]) };
      }
      return { ...out, poly: out.poly.concat([group]) };
    },
    { poly: [], solo: [] }
  );
};

const Content = (props) => {
  const { children, groups, stories } = props;

  const { poly, solo } = splitGroups(groups);

  const polyGroups = poly.length ? (
    <>
      <Header>Channel Groups:</Header>
      <Groups groups={poly} stories={stories} />
    </>
  ) : null;

  const soloGroups = solo.length ? (
    <>
      <Header>Channels:</Header>
      <Groups groups={solo} stories={stories} />
    </>
  ) : null;

  return (
    <div className={styles.wrap}>
      <div className={styles.nav}>{children}</div>
      <div className={styles.core}>
        {polyGroups}
        {soloGroups}
      </div>
    </div>
  );
};

export { Content };
