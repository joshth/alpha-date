export const SUPPORT_REGIONS = [
  { code: "AU", name: "Australia", flag: "/flags/au.svg", emergency: "000" },
  { code: "IN", name: "India", flag: "/flags/in.svg", emergency: "112" },
  { code: "GB", name: "United Kingdom", flag: "/flags/gb.svg", emergency: "999" },
  { code: "US", name: "United States", flag: "/flags/us.svg", emergency: "911" },
] as const

export type SupportRegion = typeof SUPPORT_REGIONS[number]["code"]
export const DEFAULT_SUPPORT_REGION: SupportRegion = "AU"
export const SUPPORT_REGION_COOKIE = "support-region"

export function isSupportRegion(value: unknown): value is SupportRegion {
  return SUPPORT_REGIONS.some(region => region.code === value)
}

export function supportRegion(value: unknown) {
  return SUPPORT_REGIONS.find(region => region.code === value) ?? SUPPORT_REGIONS[0]
}
