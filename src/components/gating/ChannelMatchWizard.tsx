import * as React from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import styled from "styled-components";
import { csvHeadersFromText } from "@/lib/gating/cellTable";
import type { GatingImageChannelMapping } from "@/lib/gating/types";
import type { Loader } from "@/lib/imaging/viv";

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  color: #e6edf3;
  font-size: 12px;
`;

const SectionTitle = styled.h2`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--theme-light-contrast-color) 60%, transparent);
  margin: 0 0 4px;
`;

const HelpText = styled.p`
  font-size: 11px;
  color: #8b949e;
  margin: 0 0 6px;
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
`;

const DarkPrimaryButton = styled(Button).attrs({ variant: "primary" })`
  &&& {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background-color: #2a2a2a;
    border: 1px solid #444;
    color: #e6edf3;
    font-size: 12px;
    padding: 0.45rem 0.75rem;
    min-height: 2.25rem;
    line-height: 1.2;
    box-shadow: none;
  }
  &&&:hover:not(:disabled),
  &&&:focus:not(:disabled) {
    background-color: #333;
    border-color: #555;
    color: #fff;
  }
  &&&:disabled {
    opacity: 0.45;
  }
`;

const ErrorBanner = styled.div`
  font-size: 11px;
  line-height: 1.4;
  color: #f85149;
  padding: 8px 10px;
  background: rgb(248 81 73 / 0.08);
  border: 1px solid rgb(248 81 73 / 0.3);
  border-radius: 5px;
`;

const PreviewTable = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 3px;
  margin-top: 6px;

  th {
    text-align: left;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #8b949e;
    padding: 0 8px 4px;
  }
  td {
    background: #121212;
    border-top: 1px solid #252525;
    border-bottom: 1px solid #252525;
    padding: 6px 8px;
    vertical-align: middle;
    font-size: 12px;
  }
  td:first-child {
    border-left: 1px solid #252525;
    border-radius: 5px 0 0 5px;
    color: #8b949e;
    width: 32%;
  }
  td:last-child {
    border-right: 1px solid #252525;
    border-radius: 0 5px 5px 0;
    color: #e6edf3;
  }
`;

export type ChannelMatchResult = {
  idField: string;
  xCoordinate: string;
  yCoordinate: string;
  imageData: GatingImageChannelMapping[];
  log1pColumns: string[];
};

type Props = {
  csvText: string;
  biomarkerLoader: Loader;
  onComplete: (result: ChannelMatchResult) => void;
  onCancel: () => void;
};

function findFirstMatch(headers: string[], patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const hit = headers.find((h) => re.test(h));
    if (hit) return hit;
  }
  return null;
}

function omeChannelNames(loader: Loader): string[] {
  const channels = loader.metadata?.Pixels?.Channels;
  if (channels && channels.length > 0) {
    return channels.map((c, i) => c?.Name?.trim() || `Channel ${i}`);
  }
  const level = loader.data[0];
  if (level?.labels && level?.shape) {
    const ci = level.labels.indexOf("c");
    if (ci >= 0) {
      const n = level.shape[ci];
      return Array.from({ length: n }, (_, i) => `Channel ${i}`);
    }
  }
  return [];
}

export function ChannelMatchWizard(props: Props) {
  const headers = React.useMemo(
    () => csvHeadersFromText(props.csvText),
    [props.csvText],
  );

  const omeChannels = React.useMemo(
    () => omeChannelNames(props.biomarkerLoader),
    [props.biomarkerLoader],
  );

  const autoId =
    findFirstMatch(headers, [
      /^cell[._\s-]?id$/i,
      /^id$/i,
      /^object[._\s-]?number$/i,
      /cell[._\s-]?id/i,
    ]) ??
    headers[0] ??
    "";

  const autoX =
    findFirstMatch(headers, [
      /^x[._\s-]?centroid$/i,
      /^centroid[._\s-]?x$/i,
      /^x[._\s-]?center$/i,
      /^cell[._\s-]?x$/i,
      /^x$/i,
      /^x[._\s-]?pos/i,
    ]) ?? "";

  const autoY =
    findFirstMatch(headers, [
      /^y[._\s-]?centroid$/i,
      /^centroid[._\s-]?y$/i,
      /^y[._\s-]?center$/i,
      /^cell[._\s-]?y$/i,
      /^y$/i,
      /^y[._\s-]?pos/i,
    ]) ?? "";

  /**
   * MCMICRO convention: first OME channel name often matches a CSV column.
   * Try that, then fall back to the first column after the morphology block
   * (i.e. after id/x/y/Area/Perimeter/etc.).
   */
  const autoFirstChannel = React.useMemo(() => {
    const firstOme = omeChannels[0];
    if (firstOme) {
      const byName = headers.find(
        (h) => h.toLowerCase() === firstOme.toLowerCase(),
      );
      if (byName) return byName;
    }
    const morphology = new Set(
      [
        autoId,
        autoX,
        autoY,
        ...headers.filter((h) =>
          /^(area|perimeter|major[._\s-]?axis|minor[._\s-]?axis|eccentricity|solidity|extent|orientation)$/i.test(
            h,
          ),
        ),
      ].filter(Boolean),
    );
    return headers.find((h) => !morphology.has(h)) ?? headers[0] ?? "";
  }, [headers, omeChannels, autoId, autoX, autoY]);

  const [idField, setIdField] = React.useState(autoId);
  const [xCoordinate, setXCoordinate] = React.useState(autoX);
  const [yCoordinate, setYCoordinate] = React.useState(autoY);
  const [firstChannel, setFirstChannel] = React.useState(autoFirstChannel);
  const [errors, setErrors] = React.useState<string[]>([]);

  /** OME channel index → CSV column, by sequential offset from `firstChannel`. */
  const mappingPreview = React.useMemo<GatingImageChannelMapping[]>(() => {
    const start = headers.indexOf(firstChannel);
    if (start < 0 || omeChannels.length === 0) return [];
    return omeChannels
      .map((omeName, i) => {
        const csvColumn = headers[start + i];
        if (!csvColumn) return null;
        return {
          csvColumn,
          omeName,
          sourceIndex: i,
        } satisfies GatingImageChannelMapping;
      })
      .filter((m): m is GatingImageChannelMapping => m !== null);
  }, [headers, firstChannel, omeChannels]);

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!idField || !headers.includes(idField)) {
      errs.push("Pick a cell ID column.");
    }
    if (!xCoordinate || !headers.includes(xCoordinate)) {
      errs.push("Pick an X centroid column.");
    }
    if (!yCoordinate || !headers.includes(yCoordinate)) {
      errs.push("Pick a Y centroid column.");
    }
    if (omeChannels.length > 0) {
      if (!firstChannel || !headers.includes(firstChannel)) {
        errs.push("Pick the CSV column that holds the first channel.");
      } else if (mappingPreview.length === 0) {
        errs.push(
          "The first channel column is past the end of the CSV — no channels mapped.",
        );
      }
    }
    return errs;
  };

  const submit = () => {
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;
    props.onComplete({
      idField,
      xCoordinate,
      yCoordinate,
      imageData: mappingPreview,
      log1pColumns: [],
    });
  };

  return (
    <Shell>
      <SectionTitle>Channel matching</SectionTitle>
      <HelpText>
        Identify the cell ID, X / Y centroid, and the CSV column that holds the{" "}
        <strong>first</strong> channel intensity. Subsequent CSV columns are
        mapped in order to the remaining OME channels.
      </HelpText>

      {errors.length > 0 && (
        <ErrorBanner>
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </ErrorBanner>
      )}

      <Form noValidate onSubmit={(e) => e.preventDefault()}>
        <Form.Group className="mb-3">
          <Form.Label>Cell ID column</Form.Label>
          <Form.Select
            value={idField}
            onChange={(e) => setIdField(e.target.value)}
          >
            <option value="">— select —</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>X centroid column</Form.Label>
          <Form.Select
            value={xCoordinate}
            onChange={(e) => setXCoordinate(e.target.value)}
          >
            <option value="">— select —</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Y centroid column</Form.Label>
          <Form.Select
            value={yCoordinate}
            onChange={(e) => setYCoordinate(e.target.value)}
          >
            <option value="">— select —</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        {omeChannels.length > 0 && (
          <Form.Group className="mb-3">
            <Form.Label>
              First channel column (CSV) → OME channel {omeChannels[0]}
            </Form.Label>
            <Form.Select
              value={firstChannel}
              onChange={(e) => setFirstChannel(e.target.value)}
            >
              <option value="">— select —</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        )}
      </Form>

      {omeChannels.length > 0 ? (
        mappingPreview.length > 0 ? (
          <>
            <SectionTitle>
              Preview ({mappingPreview.length} channels)
            </SectionTitle>
            <PreviewTable>
              <thead>
                <tr>
                  <th>OME channel</th>
                  <th>CSV column</th>
                </tr>
              </thead>
              <tbody>
                {mappingPreview.map((m) => (
                  <tr key={`${m.sourceIndex}-${m.csvColumn}`}>
                    <td>{m.omeName}</td>
                    <td>{m.csvColumn}</td>
                  </tr>
                ))}
              </tbody>
            </PreviewTable>
          </>
        ) : (
          <HelpText>
            Pick a first channel column to see the OME → CSV mapping preview.
          </HelpText>
        )
      ) : (
        <HelpText>
          No channel metadata was found on the biomarker image. The dataset will
          still load — you can gate on any CSV column, but no biomarker images
          will be displayed in the viewer.
        </HelpText>
      )}

      <Row>
        <DarkPrimaryButton type="button" onClick={submit}>
          Continue
        </DarkPrimaryButton>
        <DarkPrimaryButton type="button" onClick={props.onCancel}>
          Cancel
        </DarkPrimaryButton>
      </Row>
    </Shell>
  );
}
