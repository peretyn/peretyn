export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <LogoMark />
      <span className="text-3xl font-semibold tracking-tight">Peretyn</span>
    </div>
  );
}

function LogoMark() {
  return (
    <span aria-hidden="true" className="relative size-9">
      <span className="absolute inset-0 bg-current mask-logo" />
      <span className="absolute inset-0 bg-allowed mask-logo-seams" />
    </span>
  );
}
