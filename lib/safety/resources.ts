import { DEFAULT_SUPPORT_REGION, supportRegion, type SupportRegion } from "@/lib/safety/regions"
import type { SafetyCategory } from "@/lib/safety/classify"

// Help-seeking information, following Mindframe guidance: at least two 24/7
// services plus an online option, with direct links, in any content that
// references suicide or self-harm. Numbers verified against official sources
// (healthdirect, service websites, ACCCE, eSafety, Child Helpline
// International) on 28 September 2026. Butterfly verified against
// butterfly.org.au on 28 September 2026 (its page says 7 days; healthdirect
// lists weekdays, so the card points to the website for current hours).
// Re-verify before changing.
export const RESOURCES_VERIFIED_ON = "28 September 2026"

export interface HelpResource {
  name: string
  detail: string
  phone?: string
  text?: string
  textBody?: string
  url?: string
}

export const EMERGENCY: HelpResource = {
  name: "Emergency",
  detail: "If anyone is in immediate danger, call 000 in Australia.",
  phone: "000",
}

const KIDS_HELPLINE: HelpResource = {
  name: "Kids Helpline",
  detail: "Free, confidential counselling for young people aged 5 to 25, by phone or webchat. 24/7.",
  phone: "1800 55 1800",
  url: "https://kidshelpline.com.au",
}
const LIFELINE: HelpResource = {
  name: "Lifeline",
  detail: "Crisis support for anyone in Australia, by phone, text or online chat. 24/7.",
  phone: "13 11 14",
  text: "0477 13 11 14",
  url: "https://www.lifeline.org.au",
}
const THIRTEEN_YARN: HelpResource = {
  name: "13YARN",
  detail: "Crisis support by and for Aboriginal and Torres Strait Islander people. 24/7.",
  phone: "13 92 76",
  url: "https://www.13yarn.org.au",
}
const SUICIDE_CALL_BACK: HelpResource = {
  name: "Suicide Call Back Service",
  detail: "Counselling for people at risk of suicide, their carers and people bereaved by suicide. 24/7.",
  phone: "1300 659 467",
  url: "https://www.suicidecallbackservice.org.au",
}
const BUTTERFLY: HelpResource = {
  name: "Butterfly National Helpline",
  detail: "Support for anyone in Australia worried about eating disorders or body image, for themselves or someone else. Phone, webchat or email, 8am to midnight (AEST/AEDT); check the website for current hours.",
  phone: "1800 33 4673",
  url: "https://butterfly.org.au/get-support/helpline/",
}
const ESAFETY: HelpResource = {
  name: "eSafety Commissioner",
  detail: "Report cyberbullying of a young person, image-based abuse, or illegal and harmful online content.",
  url: "https://www.esafety.gov.au/report",
}
const ACCCE: HelpResource = {
  name: "ACCCE (Australian Centre to Counter Child Exploitation)",
  detail: "Report online child sexual exploitation, including sextortion of anyone under 18. Young people won't be in trouble for reporting.",
  url: "https://www.accce.gov.au/report",
}
const CRIME_STOPPERS: HelpResource = {
  name: "Crime Stoppers",
  detail: "Report information about a crime anonymously.",
  phone: "1800 333 000",
  url: "https://www.crimestoppers.com.au",
}
export const REGIONAL_RESOURCES_VERIFIED_ON = "14 November 2026"

const TELE_MANAS: HelpResource = {
  name: "Tele-MANAS", phone: "14416",
  detail: "Free, confidential mental health support across India, 24/7, with multilingual counselling.",
  url: "https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=2321522&lang=1&reg=1",
}
const INDIA_CHILD: HelpResource = {
  name: "Child Helpline India", phone: "1098",
  detail: "24/7 help for children in difficult circumstances, connected with emergency and child-protection services.",
  url: "https://wcd.gov.in/child/child-helpline",
}
const SAMARITANS: HelpResource = {
  name: "Samaritans", phone: "116 123",
  detail: "Free listening support in the UK, any time of day or night.",
  url: "https://www.samaritans.org/how-we-can-help/contact-samaritan/",
}
const UK_CHILDLINE: HelpResource = {
  name: "Childline", phone: "0800 1111",
  detail: "Free counselling for children and young people under 19 in the UK, 24/7. Online support is also available.",
  url: "https://www.childline.org.uk/get-support/contacting-childline/",
}
const SHOUT: HelpResource = {
  name: "Shout", text: "85258", textBody: "SHOUT",
  detail: "Text SHOUT to 85258 for free, confidential support in the UK, 24/7.",
  url: "https://giveusashout.org/get-help/",
}
const US_LIFELINE: HelpResource = {
  name: "988 Suicide & Crisis Lifeline", phone: "988", text: "988",
  detail: "Free, confidential crisis and emotional support in the USA, by call, text or online chat, 24/7.",
  url: "https://988lifeline.org/",
}
const CRISIS_TEXT: HelpResource = {
  name: "Crisis Text Line", text: "741741", textBody: "HOME",
  detail: "Text HOME to 741741 for free, confidential support from a trained crisis counsellor in the USA, 24/7.",
  url: "https://www.crisistextline.org/",
}

const REGIONAL_RESOURCES: Record<Exclude<SupportRegion, "AU">, HelpResource[]> = {
  IN: [TELE_MANAS, INDIA_CHILD],
  GB: [SAMARITANS, UK_CHILDLINE, SHOUT],
  US: [US_LIFELINE, CRISIS_TEXT],
}

export function generalResourcesFor(region: SupportRegion = DEFAULT_SUPPORT_REGION): HelpResource[] {
  const country = supportRegion(region)
  return country.code === "AU" ? [KIDS_HELPLINE, LIFELINE] : [...REGIONAL_RESOURCES[country.code]]
}

export function emergencyFor(region: SupportRegion = DEFAULT_SUPPORT_REGION): HelpResource {
  const country = supportRegion(region)
  return {name: "Emergency", phone: country.emergency, detail: `If anyone is in immediate danger in ${country.name}, call ${country.emergency}.`}
}

export function resourcesFor(categories: SafetyCategory[], region: SupportRegion = DEFAULT_SUPPORT_REGION): HelpResource[] {
  const country = supportRegion(region)
  if (categories.length === 0) return []
  if (country.code !== "AU") return [...REGIONAL_RESOURCES[country.code]]
  const list: HelpResource[] = []
  const add = (r: HelpResource) => {
    if (!list.includes(r)) list.push(r)
  }
  const has = (c: SafetyCategory) => categories.includes(c)

  if (has("suicide_self_harm")) {
    add(KIDS_HELPLINE)
    add(LIFELINE)
    add(THIRTEEN_YARN)
    add(SUICIDE_CALL_BACK)
  }
  if (has("eating_disorder")) {
    add(BUTTERFLY)
    add(KIDS_HELPLINE)
    add(LIFELINE)
  }
  if (has("bullying_harassment")) {
    add(KIDS_HELPLINE)
    add(ESAFETY)
  }
  if (has("sexual_exploitation")) {
    add(ACCCE)
    add(ESAFETY)
    add(KIDS_HELPLINE)
  }
  if (has("violence_threat")) {
    add(KIDS_HELPLINE)
    add(CRIME_STOPPERS)
    add(ESAFETY)
  }
  return list
}

export const ALL_RESOURCES: HelpResource[] = [
  KIDS_HELPLINE,
  LIFELINE,
  THIRTEEN_YARN,
  SUICIDE_CALL_BACK,
  BUTTERFLY,
  ESAFETY,
  ACCCE,
  CRIME_STOPPERS,
  ...Object.values(REGIONAL_RESOURCES).flat(),
]
