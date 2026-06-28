import logoAsset from "@/assets/college-logo.jpg.asset.json";

export const collegeLogoUrl = logoAsset.url;

export function CollegeLogo({ className = "h-10 w-10" }: { className?: string }) {
  return <img src={collegeLogoUrl} alt="Thiagarajar Polytechnic College" className={`${className} object-contain`} />;
}

export function CollegeHeader({ subtitle, compact }: { subtitle?: string; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <CollegeLogo className={compact ? "h-9 w-9" : "h-12 w-12"} />
      <div className="leading-tight">
        <div className={compact ? "text-sm font-bold" : "text-base sm:text-lg font-bold"}>THIAGARAJAR POLYTECHNIC COLLEGE</div>
        <div className="text-[11px] text-muted-foreground">Salem – 636005{subtitle ? ` · ${subtitle}` : ""}</div>
      </div>
    </div>
  );
}
