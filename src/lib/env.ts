/** Demo mode: dummy data, Demo ribbon and simulate controls (spec 10.1). Defaults to on until Phase 8. */
export function isDemoMode(): boolean {
  const flag = process.env.NEXT_PUBLIC_DEMO_MODE;
  return flag === undefined || flag === "" || flag === "true";
}
