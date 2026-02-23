export default function ShuttlecockIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="19" r="3" />
      <line x1="12" y1="16" x2="12" y2="11" />
      <path d="M12 11 C10 9 6.5 7 5 3" />
      <path d="M12 11 C14 9 17.5 7 19 3" />
      <path d="M12 11 C11 8.5 8 5 7 2.5" />
      <path d="M12 11 C13 8.5 16 5 17 2.5" />
      <path d="M12 11 C12 8 12 4 12 2" />
    </svg>
  );
}
