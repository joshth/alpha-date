import assert from "node:assert/strict"
import test from "node:test"
import { execFileSync } from "node:child_process"
import { estimateGpt4oMiniSavings } from "@/lib/safety/discovery-cost"

test("GPT-4o mini prices uncached input and output independently", () => {
  assert.deepEqual(estimateGpt4oMiniSavings(10, 500, 500), {averageCostUsd: 0.000375, savingsUsd: 0.00375})
  assert.deepEqual(estimateGpt4oMiniSavings(1, 1000, 0), {averageCostUsd: 0.00015, savingsUsd: 0.00015})
  assert.deepEqual(estimateGpt4oMiniSavings(1, 0, 1000), {averageCostUsd: 0.0006, savingsUsd: 0.0006})
})

test("zero avoided calls produce zero savings, and totals scale with calls", () => {
  assert.equal(estimateGpt4oMiniSavings(0, 500, 500)?.savingsUsd, 0)
  assert.equal(estimateGpt4oMiniSavings(1000, 500, 500)?.savingsUsd, 0.375)
  assert.equal(estimateGpt4oMiniSavings(500, 500, 500)?.savingsUsd, 0.1875)
  assert.equal(estimateGpt4oMiniSavings(2, 0, 0)?.savingsUsd, 0)
})

test("invalid counts or token assumptions never produce a misleading amount", () => {
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(estimateGpt4oMiniSavings(value, 500, 500), null)
    assert.equal(estimateGpt4oMiniSavings(10, value, 500), null)
    assert.equal(estimateGpt4oMiniSavings(10, 500, value), null)
  }
})


test("summary keeps real savings separate from the hypothetical 500-search month", () => {
  const result = execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
    const React=require("react"); globalThis.React=React;
    const {renderToStaticMarkup}=require("react-dom/server");
    const {DiscoveryCostEstimate}=require("./components/safety/discovery-cost-estimate.tsx");
    const cases=[
      {callsAvoided:0,configured:null,model:"gpt-4o-mini"},
      {callsAvoided:10,configured:{averageCostUsd:0.0025,savingsUsd:0.025},model:"other-model"},
      {callsAvoided:10,configured:null,model:"other-model"},
    ];
    console.log(JSON.stringify(cases.map(props=>renderToStaticMarkup(React.createElement(DiscoveryCostEstimate,props)))));
  `], {cwd:process.cwd(),encoding:"utf8",env:{...process.env,NODE_OPTIONS:""}})
  const [zero, configured, unknown] = JSON.parse(result) as string[]
  assert.match(zero, /0\.00/)
  assert.match(zero, /500 searches\/month/)
  assert.match(zero, /0\.19 saved if every search avoids AI/)
  assert.doesNotMatch(zero, /<input|<details|Token assumptions|per million|OpenAI pricing/)
  assert.match(configured, /0\.025/)
  assert.match(configured, /1\.25 saved if every search avoids AI/)
  assert.doesNotMatch(configured, /500 input/)
  assert.match(unknown, /Average cost unavailable/)
  assert.doesNotMatch(unknown, /GPT-4o mini scenario/)
})
