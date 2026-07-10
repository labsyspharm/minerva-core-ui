type PlusIconProps = {
  title?: string;
  size?: number;
};

export function PlusIcon({ title, size = 14 }: PlusIconProps) {
  const label = title ?? "Add";
  return (
    <svg
      aria-hidden={title ? undefined : true}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <title>{label}</title>
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
    </svg>
  );
}
