import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"

test("support pie, legend and table agree and do not claim actual card views", () => {
  const output=execFileSync(process.execPath,["--require","tsx/cjs","-e",`
    const React=require("react"); globalThis.React=React;
    const {renderToStaticMarkup}=require("react-dom/server");
    const {SupportResponseSummary}=require("./components/safety/support-response-summary.tsx");
    const base={byOutcome:{safe:50,refuse:10,safeguarding:3,gentle_support:1},supportCategories:{suicide_self_harm:1,violence_threat:1,eating_disorder:0,sexual_exploitation:0,bullying_harassment:0,multiple:1,uncategorized:1}};
    const empty={byOutcome:{safe:0,refuse:0,safeguarding:0,gentle_support:0},supportCategories:{suicide_self_harm:0,violence_threat:0,eating_disorder:0,sexual_exploitation:0,bullying_harassment:0,multiple:0,uncategorized:0}};
    console.log(JSON.stringify([base,empty].map(activity=>renderToStaticMarkup(React.createElement(SupportResponseSummary,{activity})))));
  `],{cwd:process.cwd(),encoding:"utf8",env:{...process.env,NODE_OPTIONS:""}})
  const [ready,empty]=JSON.parse(output) as string[]
  assert.match(ready,/Combined support responses<\/dt><dd[^>]*>4<\/dd>/)
  assert.match(ready,/Safeguarding responses<\/dt><dd[^>]*>3<\/dd>/)
  assert.match(ready,/Gentle-support responses<\/dt><dd[^>]*>1<\/dd>/)
  assert.match(ready,/not confirmed card views or unique people/)
  assert.match(ready,/role="img" aria-label="Support response category counts/)
  assert.match(ready,/conic-gradient/)
  assert.match(ready,/0% 25%/)
  assert.equal((ready.match(/>25%<\/td>/g)??[]).length,4)
  assert.match(ready,/scope="col"/)
  assert.match(ready,/scope="row"/)
  assert.match(ready,/Multiple concerns/)
  assert.match(empty,/No recorded support responses/)
  assert.doesNotMatch(empty,/conic-gradient|NaN|Infinity|>0%/)
})
