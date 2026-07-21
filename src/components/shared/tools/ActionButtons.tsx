import type { ReactNode } from "react";
import styled from "styled-components";
import { PlusIcon } from "@/components/shared/common/PlusIcon";
import CheckIcon from "@/components/shared/icons/check.svg?react";
import MinusIcon from "@/components/shared/icons/minus.svg?react";

type GlassIconButtonProps = {
  color: string;
  onClick?: () => void;
  children: ReactNode;
  "aria-label"?: string;
};

const GlassIconButton = styled.button<{ $color: string; $clickable: boolean }>`
  svg {
    width: 1em;
    height: 1em;
    display: block;
    transform: scale(1, 0.9);
  }
  justify-items: center;
  align-items: center;
  display: grid;
  border: none;
  font: inherit;
  border-radius: 50%;
  outline: 1px solid var(--theme-glass-edge) !important;
  background-color: var(--theme-dark-main-color);
  margin-bottom: calc(2 * var(--theme-gap-tiny));
  color: ${({ $color }) => $color};
  font-size: 1em;
  height: 1em;
  width: 1em;
  padding: 0;
  opacity: ${({ $clickable }) => ($clickable ? "1" : "0.5")};
  cursor: ${({ $clickable }) => ($clickable ? "pointer" : "default")};
`;

const IconButton = (props: GlassIconButtonProps) => {
  const { color, onClick, children, "aria-label": ariaLabel } = props;
  return (
    <GlassIconButton
      type="button"
      $color={color}
      $clickable={!!onClick}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </GlassIconButton>
  );
};

const WrapColumn = styled.div`
  grid-template-columns: auto auto auto;
  justify-content: start;
  justify-items: left;
  display: grid;
  gap: 0.25em;
`;

const Push = (props: { onPush?: () => void }) => (
  <IconButton color="#2e5" onClick={props.onPush} aria-label="Add channel">
    <PlusIcon size={14} />
  </IconButton>
);

const PopUpdate = (props: { onPop?: () => void; children?: ReactNode }) => {
  const { onPop, children } = props;
  return (
    <WrapColumn>
      <IconButton color="#e25" onClick={onPop} aria-label="Remove channel">
        <MinusIcon />
      </IconButton>
      {children}
    </WrapColumn>
  );
};

const Update = (props: { onUpdate?: () => void; children?: ReactNode }) => {
  const { onUpdate, children } = props;
  return (
    <WrapColumn>
      <IconButton color="#fff" onClick={onUpdate} aria-label="Confirm">
        <CheckIcon />
      </IconButton>
      {children}
    </WrapColumn>
  );
};

export { Push, PopUpdate, Update };
