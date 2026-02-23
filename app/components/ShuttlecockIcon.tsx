interface ShuttlecockIconProps {
  size?: number | string;
  className?: string;
  strokeWidth?: number | string;
}

export default function ShuttlecockIcon({
  size = 24,
  className = "",
  strokeWidth = 1.5,
}: ShuttlecockIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M8 17a4 4 0 0 0 8 0 M7 17h10 M7 17L3 5 M17 17L21 5 M3 5a12 12 0 0 1 18 0 M9.5 17L7.5 2 M14.5 17L16.5 2 M12 17L12 1 M4.7 10h14.6" />
    </svg>
  );
}