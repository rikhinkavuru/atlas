import { cn } from "@/lib/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative w-6 h-6">
        <div className="absolute inset-0 rounded-md bg-accent" />
        <div className="absolute inset-[3px] rounded-[3px] bg-background flex items-center justify-center">
          <span className="font-mono text-[10px] font-bold text-accent leading-none">
            ◢◣
          </span>
        </div>
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-[13px] font-semibold tracking-tight">ATLAS</span>
        <span className="text-[9px] font-mono text-subtle tracking-[0.15em] uppercase">
          paper studio
        </span>
      </div>
    </div>
  );
}
