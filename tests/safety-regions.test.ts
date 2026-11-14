import "./setup"
import assert from "node:assert/strict"
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
