export type GraphInfoId = "interest" | "shares" | "feedback" | "similarity"
export const GRAPH_INFO_IDS: GraphInfoId[] = ["interest", "shares", "feedback", "similarity"]

type Info = { id: GraphInfoId; title: string; shows: string; read: string[]; video: string; poster: string; captions: string; transcript: string }

const asset = (id: GraphInfoId) => ({ id, video: `/explainers/${id}.mp4`, poster: `/explainers/${id}.jpg`, captions: `/explainers/${id}.vtt` })

export const GRAPH_INFO: Record<GraphInfoId, Info> = {
  interest: {
    ...asset("interest"),
    title: "Search interest and fitted curve",
    shows: "Weekly search interest for a word over the last three years (156 weeks), with the fitted SIRS curve I(t) drawn through it. The curve is what the stage label is based on.",
    read: [
      "Each dot is one week of search interest. The teal curve is the fitted I(t).",
      "The shaded area is the last 180 days. The dashed line sits at 80% of the curve's peak.",
      "r is now divided by peak: how close today is to the top.",
      "Δ is the change over the last 180 days divided by peak: which way it is heading.",
      "Peaking if r ≥ 0.80. Otherwise emerging if Δ ≥ +0.20, declining if Δ ≤ −0.20, else parent territory.",
    ],
    transcript: "Each dot is one week of search interest for a word, shown from two years ago to now. The teal curve is the fitted SIRS model, I(t), drawn through the dots. The last 180 days are shaded. A dashed peaking line sits at 80% of the curve's peak. r is now divided by peak: how close today is to the top. Δ is the change over those 180 days divided by peak: which way it is heading. Stage rule: peaking if r ≥ 0.80. Else emerging if Δ ≥ +0.20, declining if Δ ≤ −0.20, otherwise parent territory. Here r is 0.75 and Δ is −0.24, so the word is declining.",
  },
  shares: {
    ...asset("shares"),
    title: "Population shares",
    shows: "How the model splits people into three groups over time: those who have not used the word (S), those using it (I) and those tired of it (R).",
    read: [
      "S has not used the word, I is using it, R is tired of it.",
      "β is spreading: people in S pick the word up from people in I.",
      "Γ is getting tired: people in I move to R.",
      "ξ is forgetting: some people in R forget the word and can pick it up again.",
      "Everyone is in exactly one group, so S + I + R always adds up to 1.",
    ],
    transcript: "Each dot is a person in one of three groups: S has not used the word, I is using it, R is tired of it. β, spreading: people in S pick the word up from people in I, and move to I. Γ, getting tired: people in I grow tired of the word and move to R. ξ, forgetting: some people in R forget the word, and can pick it up again. Count each group over time and stack the counts: this is how S, I and R change. Everyone is in exactly one group, so S + I + R always adds up to 1.",
  },
  feedback: {
    ...asset("feedback"),
    title: "Feedback Γ(t)",
    shows: "The recovery rate Γ(t): how fast people using the word move on to being tired of it. In this model it grows over time.",
    read: [
      "I(t) is the share of people using the word. It rises as the word spreads.",
      "Γ(t) starts low and keeps rising, including after the peak.",
      "A higher Γ pulls I(t) down: the more people have used the word, the faster they move on.",
    ],
    transcript: "I(t) is the share of people using the word. It rises as the word spreads, while Γ(t) starts low. After the peak, Γ keeps rising and pulls I(t) down. The more people have used it, the faster they move on. Γ is the recovery rate: how fast people in I move to R. In this model it grows over time.",
  },
  similarity: {
    ...asset("similarity"),
    title: "Similarity graph",
    shows: "Suggested words as nodes, with an edge wherever two of them might be the same word. Moving the threshold changes which edges count.",
    read: [
      "Each word is first normalised to a key: brain rot becomes brainrot.",
      "Solid edges share the same key, dashed edges have similar trigrams, dotted edges share a stem.",
      "Raise the threshold and weak edges fade, so fewer pairs are flagged.",
      "An edge is a match, not a merge. A reviewer decides.",
    ],
    transcript: "Eight suggestions from the data. Are any of them the same word? Step 1, normalise each word to a key: brain rot becomes brainrot, and brainrottt becomes brainrott. Step 2, find edges: solid means the same key, dashed means similar trigrams, dotted means the same stem. Step 3, move the threshold: weak edges fade, so fewer pairs are flagged. In this example, 14 pairs drop to 6. A pair is a match, not a merge. A reviewer decides.",
  },
}
