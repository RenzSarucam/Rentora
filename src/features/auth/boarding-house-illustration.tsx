/** Decorative architectural drawing, rather than a preview of a particular property. */
export function BoardingHouseIllustration() {
  return (
    <svg viewBox="0 0 520 240" fill="none" className="my-5 h-[200px] w-full shrink-0 text-primary" aria-hidden>
      <path d="M20 220h480M66 230h50m278 0h38" stroke="currentColor" strokeOpacity=".2" strokeLinecap="round" />

      {/* A shared roof, an open upstairs walkway, and individual rooms. */}
      <path d="M96 74h308v144H96z" fill="var(--background)" stroke="currentColor" strokeWidth="1.5" />
      <path d="m78 75 172-57 172 57H78Z" fill="#e9e6df" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m110 64 140-46 140 46" stroke="currentColor" strokeOpacity=".25" />
      <path d="M90 80h320" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

      {[124, 224, 324].map((x) => (
        <g key={x}>
          <path d={`M${x} 94h48v42h-48z`} fill="var(--ground)" stroke="currentColor" strokeWidth="1.5" />
          <path d={`M${x + 24} 94v42m-24-20h48`} stroke="currentColor" strokeOpacity=".5" />
          <path d={`m${x + 5} 99 12 12m16-1 10 10`} stroke="currentColor" strokeOpacity=".14" />
        </g>
      ))}

      <path d="M96 138h308v13H96z" fill="#e9e6df" stroke="currentColor" strokeWidth="1.5" />
      <path d="M108 126v12m21-12v12m21-12v12m21-12v12m21-12v12m21-12v12m21-12v12m21-12v12m21-12v12m21-12v12m21-12v12m21-12v12m21-12v12m21-12v12M104 125h292" stroke="currentColor" strokeWidth="1.25" />

      <path d="M126 168h46v33h-46zM326 168h46v33h-46z" fill="var(--ground)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M149 168v33m-23-16h46m177-17v33m-23-16h46" stroke="currentColor" strokeOpacity=".5" />
      <path d="M226 165h48v53h-48z" fill="#e9e6df" stroke="currentColor" strokeWidth="1.5" />
      <path d="M250 165v53m-6-25v5m12-5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="m214 163 8-9h56l8 9h-72Z" fill="var(--ground)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M218 219h64m-72 6h80" stroke="currentColor" strokeOpacity=".4" strokeLinecap="round" />

      {/* Outdoor stairs and a small plant bring the drawing down to street level. */}
      <path d="M404 151h14l48 67h-17l-45-67Zm5 8h15m-10 8h16m-10 8h16m-10 8h16m-10 8h16m-10 8h16m-10 8h16m-52-66h14l49 68" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M54 198h28l-4 20H58l-4-20Z" fill="#e9e6df" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M68 198v-37m0 20c-15 0-19-10-17-18 11 1 17 7 17 18Zm0 9c14 0 20-9 18-17-12 0-18 7-18 17Zm0-17c-7-8-6-17 0-23 6 7 7 15 0 23Z" fill="var(--ground)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
