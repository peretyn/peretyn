export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="font-semibold tracking-tight">Peretyn</span>
    </span>
  );
}

function LogoMark() {
  return (
    <span aria-hidden="true" className="relative size-6">
      <span className="absolute inset-0 bg-current mask-logo" />
      <span className="absolute inset-0 bg-allowed mask-logo-seams" />
    </span>
  );
}
