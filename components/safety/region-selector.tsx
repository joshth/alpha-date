"use client"

import Image from "next/image"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SUPPORT_REGIONS, isSupportRegion, supportRegion } from "@/lib/safety/regions"
import { useSupportRegion } from "./region-provider"

export function RegionSelector() {
  const { region, setRegion } = useSupportRegion()
  const selected = supportRegion(region)
  return (
    <div className="flex items-center">
      <Select value={region} onValueChange={value => { if (isSupportRegion(value)) setRegion(value) }}>
        <SelectTrigger id="support-region" aria-label="Support location" className="h-9 w-auto gap-1.5 border-lab-border-strong px-2">
          <SelectValue>
            <Image unoptimized src={selected.flag} alt="" width={24} height={16} className="h-4 w-6 rounded-sm object-cover" />
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SUPPORT_REGIONS.map(country => (
            <SelectItem key={country.code} value={country.code} textValue={country.name}>
              <span className="inline-flex items-center gap-2">
                <Image unoptimized src={country.flag} alt="" width={24} height={16} className="h-4 w-6 rounded-sm object-cover" />
                {country.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
