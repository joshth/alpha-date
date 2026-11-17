import "./setup"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"
import { emergencyFor, resourcesFor } from "@/lib/safety/resources"
import { isSupportRegion, supportRegion, SUPPORT_REGIONS } from "@/lib/safety/regions"

const categories = ["suicide_self_harm", "eating_disorder", "sexual_exploitation", "violence_threat", "bullying_harassment"] as const
const required = { AU: ["Kids Helpline", "Lifeline"], IN: ["Tele-MANAS", "Child Helpline India"], GB: ["Samaritans", "Childline", "Shout"], US: ["988 Suicide & Crisis Lifeline", "Crisis Text Line"] }

for (const country of SUPPORT_REGIONS) {
  test(`${country.code} has its own emergency contact and no empty sensitive-category cards`, () => {
    assert.equal(emergencyFor(country.code).phone, country.emergency)
    assert.match(emergencyFor(country.code).detail, new RegExp(country.name))
    for (const category of categories) {
      const resources = resourcesFor([category], country.code)
      assert.ok(resources.length >= 2)
      assert.equal(new Set(resources.map(r => r.name)).size, resources.length)
      for (const resource of resources) {
        assert.equal(new URL(resource.url!).protocol, "https:")
        assert.ok(resource.phone || resource.text || resource.url)
      }
    }
    assert.deepEqual(resourcesFor([], country.code), [])
  })
  test(`${country.code} crisis resources contain the configured local services`, () => {
    const resources = resourcesFor(["suicide_self_harm"], country.code)
    for (const name of required[country.code]) assert.ok(resources.some(r => r.name === name), name)
    if (country.code !== "AU") assert.ok(resources.every(r => r.name !== "Kids Helpline" && r.name !== "Lifeline"))
    const copy = resourcesFor(["suicide_self_harm"], country.code)
    copy.pop()
    assert.equal(resourcesFor(["suicide_self_harm"], country.code).length, resources.length)
  })
}

test("unsupported cookie values fall back to Australia without trusting caller text", () => {
  for (const value of [undefined, null, "", "UK", "us", "<script>", "US; Path=/", {}, 123]) {
    assert.equal(isSupportRegion(value), false)
    assert.equal(supportRegion(value).code, "AU")
  }
  for (const country of SUPPORT_REGIONS) assert.equal(isSupportRegion(country.code), true)
})

test("Australia keeps specialist resources and mixed categories do not duplicate services", () => {
  assert.ok(resourcesFor(["eating_disorder"], "AU").some(r => r.name === "Butterfly National Helpline"))
  assert.ok(resourcesFor(["sexual_exploitation"], "AU").some(r => r.name.startsWith("ACCCE")))
  const resources = resourcesFor([...categories], "AU")
  assert.equal(new Set(resources.map(r => r.name)).size, resources.length)
  assert.ok(!resources.some(r => r.name === "Outside Australia"))
})

test("regional crisis cards render correct emergency, phone and SMS links", () => {
  const output = execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
    const React = require("react");
    globalThis.React = React;
    const { renderToStaticMarkup } = require("react-dom/server");
    const { RegionProvider } = require("./components/safety/region-provider.tsx");
    const { CrisisCard } = require("./components/safety/crisis-card.tsx");
    const { HelpResources } = require("./components/safety/help-resources.tsx");
    const render = (region, child) => renderToStaticMarkup(React.createElement(RegionProvider, {initialRegion:region},child));
    console.log(JSON.stringify(["AU","IN","GB","US"].map(region => ({
      region,
      self:render(region,React.createElement(CrisisCard,{crisis:"self_harm",categories:["suicide_self_harm"],reference:"INC-SYNTHETIC"})),
      others:render(region,React.createElement(CrisisCard,{crisis:"harm_to_others",categories:["violence_threat"]})),
      sensitive:render(region,React.createElement(HelpResources,{categories:["sexual_exploitation"]})),
    }))));
  `], {cwd:process.cwd(), encoding:"utf8", env:{...process.env,NODE_OPTIONS:""}})
  const rows = JSON.parse(output) as {region: typeof SUPPORT_REGIONS[number]["code"]; self:string; others:string; sensitive:string}[]
  for (const row of rows) {
    const emergency = supportRegion(row.region).emergency
    for (const markup of [row.self,row.others]) {
      assert.ok(markup.includes(`href="tel:${emergency}"`))
      assert.ok(markup.includes('role="alert"'))
    }
    assert.ok(row.self.includes("INC-SYNTHETIC"))
    if (row.region !== "AU") {
      for (const markup of [row.self,row.others,row.sensitive]) assert.ok(!markup.includes('href="tel:000"'))
    }
    assert.ok(row.sensitive.includes(supportRegion(row.region).name))
    if (row.region === "GB") assert.ok(row.self.includes('sms:85258?body=SHOUT'))
    if (row.region === "US") {
      assert.ok(row.self.includes('sms:741741?body=HOME'))
      assert.ok(row.self.includes('href="tel:988"'))
    }
    if (row.region === "IN") {
      assert.ok(row.self.includes('href="tel:14416"'))
      assert.ok(row.self.includes('href="tel:1098"'))
    }
  }
})
