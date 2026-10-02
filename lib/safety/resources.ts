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
  url?: string
}

export const EMERGENCY: HelpResource = {
  name: "Emergency",
  detail: "If anyone is in immediate danger, call 000 in Australia, or 112 in the EU.",
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
const EU_CHILD_HELPLINE: HelpResource = {
  name: "Outside Australia",
  detail: "In most EU countries, the child helpline is 116 111. For other countries, find a free local helpline at findahelpline.com.",
  phone: "116 111",
  url: "https://findahelpline.com",
}

export function resourcesFor(categories: SafetyCategory[]): HelpResource[] {
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
  if (list.length > 0) add(EU_CHILD_HELPLINE)
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
  EU_CHILD_HELPLINE,
]
