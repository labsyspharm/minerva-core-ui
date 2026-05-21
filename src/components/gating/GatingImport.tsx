import * as React from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import styled from "styled-components";
import { csvHeadersFromText } from "@/lib/gating/cellTable";
import { importGatingDataset } from "@/lib/gating/loadGatingDataset";
import { pickFileForRole, toLoader } from "@/lib/imaging/filesystem";
import type { Loader } from "@/lib/imaging/viv";
import { Pool } from "@/lib/imaging/workers/Pool";
import {
  type ChannelMatchResult,
  ChannelMatchWizard,
} from "./ChannelMatchWizard";

/** Matches Story / Channels / Upload: grey-on-black controls. */
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
  &&&:active:not(:disabled) {
    background-color: #1a1a1a !important;
    border-color: #444 !important;
  }
  &&&:disabled {
    opacity: 0.45;
  }
`;

const ImagesTabShell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 10px 8px 10px;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  color: #e6edf3;
  font-size: 12px;
  background: #000;
  scrollbar-color: #555 #000;
  scrollbar-width: thin;

  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-track {
    background: #000;
  }
  &::-webkit-scrollbar-thumb {
    background: #555;
    border-radius: 4px;
  }

  form {
    max-width: 100%;
  }

  .form-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--theme-light-contrast-color) 52%, transparent);
    margin-bottom: 0.35rem;
  }

  .form-control,
  .form-select {
    max-width: 100%;
    background-color: #2c2c2c;
    border: 1px solid #444;
    color: #e6edf3;
    font-size: 12px;
  }
  .form-control::placeholder {
    color: #8899aa;
    opacity: 1;
  }
  .form-control:focus,
  .form-select:focus {
    background-color: #2c2c2c;
    border-color: #666;
    color: #e6edf3;
    box-shadow: 0 0 0 0.15rem rgb(255 255 255 / 0.12);
  }
`;

const SectionTitle = styled.h2`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--theme-light-contrast-color) 60%, transparent);
  margin: 0;
`;

const HelpText = styled.p`
  font-size: 11px;
  line-height: 1.4;
  color: #8b949e;
  margin: 0 0 0.25rem;
`;

const RoleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #121212;
  border: 1px solid #252525;
`;

const RoleHeader = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
`;

const RoleLabel = styled.div`
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--theme-light-contrast-color) 48%, transparent);
`;

const FileSelectedRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const FileName = styled.span<{ $empty: boolean }>`
  font-size: 12px;
  color: ${({ $empty }) => ($empty ? "#6e7681" : "#f0f4f8")};
  font-style: ${({ $empty }) => ($empty ? "italic" : "normal")};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
`;

const CsvSummary = styled.p`
  font-size: 11px;
  color: #8b949e;
  margin: 0;
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

type Props = {
  onImported: () => void;
};

export function GatingImport(props: Props) {
  const [name, setName] = React.useState("");
  const [biomarker, setBiomarker] = React.useState<Handle.File | null>(null);
  const [mask, setMask] = React.useState<Handle.File | null>(null);
  const [csv, setCsv] = React.useState<Handle.File | null>(null);
  const [csvText, setCsvText] = React.useState("");
  const [csvHeaders, setCsvHeaders] = React.useState<string[]>([]);
  const [csvRows, setCsvRows] = React.useState<number | null>(null);
  const [biomarkerLoader, setBiomarkerLoader] = React.useState<Loader | null>(
    null,
  );
  const [matchStep, setMatchStep] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const poolRef = React.useRef<Pool | null>(null);

  React.useEffect(() => {
    poolRef.current = new Pool();
    return () => {
      poolRef.current = null;
    };
  }, []);

  const pick = async (role: "biomarker" | "mask" | "csv") => {
    setError(null);
    try {
      const handle = await pickFileForRole({
        kind: role === "csv" ? "csv" : "ome-tiff",
        description:
          role === "biomarker"
            ? "Biomarker OME-TIFF"
            : role === "mask"
              ? "Label mask OME-TIFF"
              : "Quantification CSV",
      });
      if (!handle) return;
      if (role === "biomarker") {
        setBiomarker(handle);
        if (!name) setName(handle.name.replace(/\.[^.]+$/, ""));
      } else if (role === "mask") {
        setMask(handle);
      } else {
        setCsv(handle);
        setCsvText("");
        setCsvHeaders([]);
        setCsvRows(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  React.useEffect(() => {
    if (!csv) return;
    let cancelled = false;
    void (async () => {
      try {
        const text = await (await csv.getFile()).text();
        if (cancelled) return;
        setCsvText(text);
        setCsvHeaders(csvHeadersFromText(text));
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        setCsvRows(Math.max(0, lines.length - 1));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [csv]);

  const ready =
    name.trim().length > 0 &&
    biomarker !== null &&
    mask !== null &&
    csv !== null;

  const continueToMatch = async () => {
    if (!ready || !biomarker) return;
    setLoading(true);
    setError(null);
    try {
      const loader = await toLoader({
        in_f: biomarker.name,
        handle: biomarker,
        pool: poolRef.current ?? undefined,
      });
      setBiomarkerLoader(loader);
      setMatchStep(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const finishImport = async (match: ChannelMatchResult) => {
    if (!biomarker || !mask || !csv) return;
    setLoading(true);
    setError(null);
    try {
      await importGatingDataset(
        {
          name: name.trim(),
          biomarkerHandle: biomarker,
          maskHandle: mask,
          csvHandle: csv,
          idField: match.idField,
          xCoordinate: match.xCoordinate || undefined,
          yCoordinate: match.yCoordinate || undefined,
          imageData: match.imageData,
          log1pColumns: match.log1pColumns,
        },
        poolRef.current ?? undefined,
      );
      props.onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (matchStep && csvText && biomarkerLoader) {
    return (
      <ImagesTabShell>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        {loading && (
          <p style={{ fontSize: 11, color: "#8b949e", margin: 0 }}>
            Importing dataset…
          </p>
        )}
        <ChannelMatchWizard
          csvText={csvText}
          biomarkerLoader={biomarkerLoader}
          onComplete={(m) => void finishImport(m)}
          onCancel={() => setMatchStep(false)}
        />
      </ImagesTabShell>
    );
  }

  return (
    <ImagesTabShell>
      <SectionTitle>Import gating dataset</SectionTitle>
      <HelpText>
        Select a biomarker OME-TIFF, a label mask OME-TIFF (integer cell IDs per
        pixel), and a quantification CSV with one row per cell.
      </HelpText>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Form noValidate onSubmit={(e) => e.preventDefault()}>
        <Form.Group className="mb-3">
          <Form.Label>Dataset name</Form.Label>
          <Form.Control
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My experiment"
            name="name"
          />
        </Form.Group>
      </Form>

      <RoleBlock>
        <RoleHeader>
          <RoleLabel>Biomarker OME-TIFF</RoleLabel>
        </RoleHeader>
        <FileSelectedRow>
          <FileName $empty={!biomarker} title={biomarker?.name ?? ""}>
            {biomarker?.name ?? "no file selected"}
          </FileName>
          <DarkPrimaryButton
            type="button"
            onClick={() => void pick("biomarker")}
          >
            {biomarker ? "Change image…" : "Select image…"}
          </DarkPrimaryButton>
        </FileSelectedRow>
      </RoleBlock>

      <RoleBlock>
        <RoleHeader>
          <RoleLabel>Label mask OME-TIFF</RoleLabel>
        </RoleHeader>
        <FileSelectedRow>
          <FileName $empty={!mask} title={mask?.name ?? ""}>
            {mask?.name ?? "no file selected"}
          </FileName>
          <DarkPrimaryButton type="button" onClick={() => void pick("mask")}>
            {mask ? "Change mask…" : "Select mask…"}
          </DarkPrimaryButton>
        </FileSelectedRow>
      </RoleBlock>

      <RoleBlock>
        <RoleHeader>
          <RoleLabel>Quantification CSV</RoleLabel>
        </RoleHeader>
        <FileSelectedRow>
          <FileName $empty={!csv} title={csv?.name ?? ""}>
            {csv?.name ?? "no file selected"}
          </FileName>
          <DarkPrimaryButton type="button" onClick={() => void pick("csv")}>
            {csv ? "Change CSV…" : "Select CSV…"}
          </DarkPrimaryButton>
        </FileSelectedRow>
        {csv && csvHeaders.length > 0 && (
          <CsvSummary>
            {csvRows?.toLocaleString() ?? "?"} rows × {csvHeaders.length}{" "}
            columns: {csvHeaders.slice(0, 6).join(", ")}
            {csvHeaders.length > 6 ? "…" : ""}
          </CsvSummary>
        )}
      </RoleBlock>

      <DarkPrimaryButton
        type="button"
        onClick={() => void continueToMatch()}
        disabled={!ready || loading}
      >
        {loading ? "Loading image metadata…" : "Continue to channel matching"}
      </DarkPrimaryButton>
    </ImagesTabShell>
  );
}
