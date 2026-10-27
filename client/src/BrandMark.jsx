export default function BrandMark() {
  return (
    <span className="brand-mark" aria-label="FlexiTrade logo">
      <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="flexi-mark-gradient" x1="5" y1="4" x2="43" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#9b8cff" />
            <stop offset="1" stopColor="#5c55de" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="46" height="46" rx="15" fill="url(#flexi-mark-gradient)" />
        <path d="M15 34V14h18M15 23h13" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m25 33 5-5 4 2 6-9m-5 0h5v5" fill="none" stroke="#baffea" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}