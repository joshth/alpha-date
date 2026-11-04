import { asc } from "drizzle-orm"
import { getDb, schema } from "@/lib/_stubs/db"
import { assessSafety } from "@/lib/safety/classify"
import { SAFETY_ACTION_LABELS } from "@/lib/safety/examples"
import type { SafetyAction } from "@/lib/safety/gate"
import { SafetyComparison } from "@/components/safety/safety-comparison"

export const metadata = { title: "Safety examples" }

export default async function SafetyExamplesPage() {
  const db = await getDb()
  const examples = await db.select().from(schema.safetyExamples).orderBy(asc(schema.safetyExamples.id))
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Safety examples</h1>
        <p className="text-muted-foreground">{examples.length} synthetic examples with expected search actions. These are demo policy labels, not diagnoses. Context matters; negative slang alone does not establish danger.</p>
      </div>
      <SafetyComparison />
      <p className="text-sm">Gentle and full support pause the slang pipeline. Refusal blocks harmful requests. Sensitive educational searches remain available with help resources; sensitive suggestions are not saved.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="mb-3 text-left font-semibold">Reference examples stored in the demo database</caption>
          <thead><tr className="border-b"><th scope="col" className="p-2">Phrase</th><th scope="col" className="p-2">Original rules</th><th scope="col" className="p-2">Expected action</th><th scope="col" className="p-2">Reason</th></tr></thead>
          <tbody>{examples.map((example) => {
            const baseline = assessSafety(example.phrase)
            return <tr key={example.id} className="border-b align-top">
              <th scope="row" className="p-2 font-medium">{example.phrase}</th>
              <td className="p-2">{baseline.crisis ? "Full support" : baseline.categories.length ? "Sensitive lookup" : "No signal"}</td>
              <td className="p-2">{SAFETY_ACTION_LABELS[example.expectedAction as SafetyAction] ?? example.expectedAction}</td>
              <td className="p-2 text-muted-foreground">{example.rationale}</td>
            </tr>
          })}</tbody>
        </table>
      </div>
    </div>
  )
}
