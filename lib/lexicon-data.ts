import type { SlangTerm } from "@/app/types"

// PUBLIC seed lexicon. This module is imported by client components and ships
// in the browser bundle — never add proprietary/premium fields here.
// Educator discussion content lives in lib/lexicon-educator.ts (server-only).
export const slangDatabase: SlangTerm[] = [
  {
    "id": "1",
    "term": "Rizz",
    "pronunciation": "/rɪz/",
    "definition": "Charisma, romantic appeal, or the ability to flirt successfully.",
    "examples": [
      "He's got mad rizz."
    ],
    "originAndContext": "Popularized on TikTok.",
    "commonSentiment": "Positive",
    "sensitivityRating": "Generally Harmless",
    "detailedOriginEtymology": "Derived from 'charisma', shortened in online communities. First noted around 2021.",
    "culturalImpactAnalysis": "Reflects a focus on social skills and charm in online dating culture.",
    "communicationTips": "Acknowledge it playfully if heard, but avoid overuse to prevent sounding out of touch.",
    "tags": [
      "social",
      "dating",
      "tiktok",
      "charisma"
    ]
  },
  {
    "id": "2",
    "term": "Skibidi",
    "pronunciation": "/skɪˈbiːdi/",
    "definition": "Often nonsensical, associated with the 'Skibidi Toilet' YouTube series; implies absurdity.",
    "examples": [
      "That video was so skibidi."
    ],
    "originAndContext": "From DaFuq!?Boom!'s YouTube series.",
    "commonSentiment": "Variable",
    "sensitivityRating": "Generally Harmless",
    "detailedOriginEtymology": "The term itself has no inherent meaning prior to the series. Its popularity is tied to the surreal and repetitive nature of the content.",
    "tags": [
      "youtube",
      "meme",
      "surreal"
    ]
  },
  {
    "id": "4",
    "term": "Gyatt",
    "pronunciation": "/ɡjɑːt/",
    "definition": "Exclamation for a large buttock.",
    "examples": [
      "Often spammed in stream chats."
    ],
    "originAndContext": "Popularized by streamer YourRAGE.",
    "commonSentiment": "Objectifying",
    "sensitivityRating": "Vulgar",
    "cautionaryNotes": "Considered vulgar and objectifying. Awareness is for understanding, not adoption.",
    "detailedOriginEtymology": "A phonetic expression, its spread highlights the speed of slang adoption in online streaming communities.",
    "culturalImpactAnalysis": "Raises questions about objectification in online spaces and its normalization among younger audiences.",
    "tags": [
      "twitch",
      "tiktok",
      "vulgar"
    ]
  },
  {
    "id": "15",
    "term": "Obby",
    "pronunciation": "/ˈɒbi/",
    "definition": "An obstacle course game, popular on Roblox.",
    "examples": [
      "Let's play an obby!"
    ],
    "originAndContext": "Short for 'obstacle course' in Roblox culture.",
    "commonSentiment": "Positive",
    "sensitivityRating": "Generally Harmless",
    "detailedOriginEtymology": "Specific to Roblox, 'obby' games are a foundational genre on the platform, often user-generated, fostering creativity and simple game design principles.",
    "tags": [
      "gaming",
      "roblox"
    ]
  },
  {
    "id": "1a2b3c4d-5e6f-7890-123a-bcdef012345a",
    "term": "Boujee",
    "pronunciation": "/ˈbuːʒiː/",
    "definition": "Aspiring to or characteristic of a luxurious or wealthy lifestyle; high-class. Often used to describe people, places, or things that are perceived as fancy, expensive, or ostentatious.",
    "examples": [
      "She only drinks boujee coffee from that expensive cafe.",
      "They went on a boujee vacation to a private island."
    ],
    "originAndContext": "Derived from 'bourgeoisie,' referring to the middle/upper class. Popularized in hip-hop culture, notably by the Migos song 'Bad and Boujee.'",
    "commonSentiment": "Variable",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": "Can sometimes be used ironically or to imply someone is trying too hard to appear wealthy or sophisticated.",
    "tags": [
      "lifestyle",
      "luxury",
      "fancy",
      "hip-hop",
      "social status"
    ],
    "detailedOriginEtymology": "Shortened and stylized form of 'bourgeois.' Its modern slang usage was significantly boosted by hip-hop and social media.",
    "culturalImpactAnalysis": "Reflects societal fascination with wealth and status, as well as the appropriation and reinterpretation of class-related terms in popular culture.",
    "communicationTips": "Understand it as a descriptor for something perceived as upscale. The tone (admiring, ironic, critical) depends heavily on context."
  },
  {
    "id": "2b3c4d5e-6f7a-8901-23ab-cdef012345ab",
    "term": "Drip",
    "pronunciation": "/drɪp/",
    "definition": "Refers to a person's style, particularly their outfit and accessories, implying they are very fashionable, cool, and put-together. It suggests an effortless and impressive sense of style.",
    "examples": [
      "His drip was insane at the party, head to toe in designer.",
      "She's always got the best drip."
    ],
    "originAndContext": "Emerged from African American Vernacular English (AAVE) and hip-hop culture. 'Drip' suggests style that is so cool it's 'dripping' or overflowing.",
    "commonSentiment": "Positive",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": null,
    "tags": [
      "fashion",
      "style",
      "cool",
      "outfit",
      "hip-hop",
      "aave"
    ],
    "detailedOriginEtymology": "Metaphorical use of 'drip,' likening impressive style to something overflowing or exuding coolness. Popularized through music and social media.",
    "culturalImpactAnalysis": "Highlights the importance of fashion and self-expression in youth culture, particularly within hip-hop and related online communities. It's a key term in contemporary style vocabulary.",
    "communicationTips": "A compliment on someone's fashion sense. If someone has 'drip,' they look good."
  },
  {
    "id": "5e6f7a8b-9c0d-1234-5cde-f012345abcde",
    "term": "Main Character Energy",
    "pronunciation": "/meɪn ˈkærəktər ˈɛnərdʒi/",
    "definition": "A sense of self-confidence and self-importance where an individual sees themselves as the protagonist of their own life story. It implies living life boldly, authentically, and as if one is the star of a movie or show.",
    "examples": [
      "She walked in with such main character energy, everyone noticed.",
      "I'm trying to cultivate more main character energy this year."
    ],
    "originAndContext": "Popularized on TikTok and other social media, encouraging people to romanticize their lives and act with confidence and purpose, as if they are the lead in their own narrative.",
    "commonSentiment": "Positive",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": "While generally positive, an extreme manifestation could be perceived as self-centered if not balanced with awareness of others.",
    "tags": [
      "confidence",
      "self-esteem",
      "protagonist",
      "tiktok",
      "empowerment",
      "lifestyle"
    ],
    "detailedOriginEtymology": "Emerged from social media trends encouraging users to view their lives through a cinematic lens, focusing on personal growth, aesthetics, and self-belief.",
    "culturalImpactAnalysis": "Reflects a desire for self-empowerment and individualism, particularly among younger generations navigating identity online. It can be a positive mindset for building confidence.",
    "communicationTips": "Understand it as a positive aspiration for self-confidence and living life fully. It's about feeling like the star of your own life."
  },
  {
    "id": "gen-alpha-ate-001",
    "term": "Ate",
    "pronunciation": "/eɪt/",
    "definition": "A strong expression of approval or admiration, signifying that someone has performed exceptionally well, executed something flawlessly, or presented an impressive look or skill. It implies they \"devoured\" the challenge or \"owned\" the moment. Often used similarly to \"slayed\" or \"killed it.\"",
    "examples": [
      "Her dance routine? She absolutely ate that.",
      "Did you see his presentation? He ate and left no crumbs.",
      "Your outfit for the party? You ate!"
    ],
    "originAndContext": "Popularized significantly on social media platforms like TikTok, Twitter, and Instagram, especially within online communities, fan (stan) cultures, and LGBTQ+ circles. It builds on the idea of \"consuming\" a task or performance, indicating mastery.",
    "commonSentiment": "Positive",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": "None typically needed, as it's almost always used as a compliment.",
    "tags": [
      "compliment",
      "approval",
      "excellent",
      "performance",
      "skill",
      "fashion",
      "tiktok",
      "positive",
      "slang"
    ],
    "detailedOriginEtymology": "The term \"ate\" in this context is a metaphorical extension of the literal act of eating. To \"eat\" something up in a performance sense means to consume it entirely, to master it without hesitation or flaw. The common accompanying phrase \"and left no crumbs\" further emphasizes this total domination or perfection. Its usage became widespread in the early 2020s.",
    "culturalImpactAnalysis": "\"Ate\" has become a go-to, concise, and impactful way for Gen Alpha and younger millennials to express strong admiration. It's part of a lexicon of positive reinforcement that is highly prevalent in online interactions, particularly in response to creative content, personal achievements, or displays of confidence.",
    "communicationTips": "Understand this as a high compliment. If someone says you \"ate,\" they mean you did an amazing job. It's generally used enthusiastically."
  },
  {
    "id": "gen-alpha-bet-001",
    "term": "Bet",
    "pronunciation": "/bɛt/",
    "definition": "1. As an affirmation or agreement, similar to \"Okay,\" \"Alright,\" \"Sounds good,\" \"For sure,\" or \"Yes.\"\n2. Can also be used as a response to a challenge, implying \"I accept\" or \"Watch me.\"\n3. Sometimes used sarcastically to express doubt or disbelief (tone is key).",
    "examples": [
      "(Affirmation) Person A: \"Yo, we hitting the mall later?\" Person B: \"Bet.\"",
      "(Affirmation) Person A: \"Can you send me those notes?\" Person B: \"Bet.\"",
      "(Challenge) Person A: \"You can't finish that whole pizza.\" Person B: \"Bet.\"",
      "(Sarcastic - less common) Person A: \"I'm definitely going to wake up early tomorrow.\" Person B (skeptically): \"Bet...\""
    ],
    "originAndContext": "Has roots in African American Vernacular English (AAVE) and gained significant traction with Gen Z and Gen Alpha through online communication, gaming, and social media.",
    "commonSentiment": "Variable",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": "The primary meaning is affirmative. Sarcastic usage depends heavily on tone and context, which can be lost in text.",
    "tags": [
      "agreement",
      "affirmation",
      "okay",
      "challenge",
      "yes",
      "aave",
      "versatile",
      "slang"
    ],
    "detailedOriginEtymology": "Derived from the gambling term \"bet,\" implying certainty or a willingness to stake something on an outcome. In its slang usage, it signifies a confident \"yes\" or an acceptance of a proposition/challenge. Its usage in AAVE predates its widespread adoption by younger generations online.",
    "culturalImpactAnalysis": "\"Bet\" is a highly efficient and common piece of slang, reflecting a preference for brevity in digital communication. Its versatility allows it to fit into many conversational contexts, making it a staple for quick acknowledgments or agreements.",
    "communicationTips": "Generally, take \"bet\" at face value as an \"okay\" or \"yes.\" If you sense sarcasm, consider the broader context of the conversation."
  },
  {
    "id": "gen-alpha-cook-001",
    "term": "Cook / Let him cook",
    "pronunciation": "/kʊk/",
    "definition": "To \"cook\" means to perform a task with a high degree of skill, focus, and expertise, often under pressure. The phrase \"Let him cook\" is an exclamation of encouragement, telling others to stand back and not interfere because the person is in a state of intense focus and is on the path to an excellent result.",
    "examples": [
      "He's acing every question on the test, just let him cook.",
      "Don't interrupt her while she's coding, she's cooking right now.",
      "The streamer was down to the last opponent and the whole chat was spamming 'LET HIM COOK'."
    ],
    "originAndContext": "Has roots in the persona of rapper Lil B, but its massive resurgence is tied to gaming and live-streaming culture on platforms like Twitch. It's used to cheer on a player who is performing exceptionally well.",
    "commonSentiment": "Positive",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": "None needed. It is a term of respect and encouragement.",
    "tags": [
      "gaming",
      "sports",
      "twitch",
      "encouragement",
      "skill",
      "focus",
      "positive",
      "slang",
      "metaphor"
    ],
    "detailedOriginEtymology": "The metaphor likens a person's skilled and focused effort to a chef meticulously preparing a dish. The phrase 'Let him cook' implies that interrupting the 'chef' (the skilled person) would ruin the 'meal' (the final outcome). Its explosion in Gen Alpha/Z slang is tied to live-streaming culture.",
    "culturalImpactAnalysis": "This phrase highlights a cultural appreciation for skill and mastery. It fosters a positive, supportive environment where talent is recognized and given space to flourish, representing a shift from simple praise to an active expression of non-interference based on respect for someone's process.",
    "communicationTips": "Use this to encourage someone when you see they are focused and doing something well. It shows you trust their ability and are excited to see the result."
  },
  {
    "id": "gen-alpha-its-giving-001",
    "term": "It's giving...",
    "pronunciation": "/ɪts ˈɡɪvɪŋ/",
    "definition": "A phrase used to describe the overall vibe, essence, or impression that something (an outfit, a look, a situation, a person's demeanor) evokes. The blank is filled in with the specific quality being observed. It's a way of saying \"This reminds me of...\" or \"This has the characteristics of...\" in a trendy, often understated or observational way.",
    "examples": [
      "Her outfit? It's giving main character energy.",
      "The way he styled that thrifted jacket? It's giving 90s supermodel.",
      "This gloomy weather is giving cozy night in with a book.",
      "The confidence she walked in with? It's giving CEO.",
      "The new cafe downtown? It's giving very much overpriced avocado toast."
    ],
    "originAndContext": "Popularized heavily on TikTok and other social media by Gen Z and Gen Alpha, particularly within fashion, beauty, and LGBTQ+ communities. It's derived from ballroom culture.",
    "commonSentiment": "Variable",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": "The meaning is entirely dependent on the words that follow \"It's giving...\".",
    "tags": [
      "fashion",
      "beauty",
      "tiktok",
      "vibe",
      "impression",
      "aesthetic",
      "ballroom culture",
      "lgbtq+",
      "slang"
    ],
    "detailedOriginEtymology": "The phrase has strong roots in African American Vernacular English (AAVE) and ballroom culture, a subculture created by Black and Latino LGBTQ+ individuals. In ballroom, \"to give\" a certain category (e.g., \"giving executive realness\") means to embody that category convincingly. This evolved into the more general \"It's giving [X]\" to describe the perceived essence of something.",
    "culturalImpactAnalysis": "\"It's giving...\" reflects a highly observational and descriptive way of engaging with the world, often focused on aesthetics and perceived \"vibes.\" It's a versatile phrase that allows for quick, coded communication about the impression something makes. Its popularity underscores the influence of AAVE and LGBTQ+ slang on mainstream youth language.",
    "communicationTips": "Pay attention to what comes after \"It's giving...\" to understand the speaker's observation. It's often used to make a stylish or witty comment."
  },
  {
    "id": "gen-alpha-roman-empire-001",
    "term": "The Roman Empire",
    "pronunciation": "/ðə ˈroʊmən ˈɛmpaɪər/",
    "definition": "A metaphor for a topic, often niche or seemingly random, that an individual (stereotypically a man) thinks about frequently and in great detail, unbeknownst to others. It represents a personal, deep-seated obsession or recurring thought pattern.",
    "examples": [
      "I asked my boyfriend what his Roman Empire is, and he said it's the logistics of building the pyramids.",
      "My personal Roman Empire is the unresolved plotline from that TV show that ended ten years ago.",
      "She's talking about the history of fountain pens again. That's her Roman Empire."
    ],
    "originAndContext": "Exploded in popularity from a viral TikTok trend in late 2023 where people asked their male partners how often they think about the Roman Empire. The surprisingly frequent answer turned the phrase into a meme and then into a broader slang term for any topic of frequent, private contemplation.",
    "commonSentiment": "Humorous/Playful",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": "None needed. It's a lighthearted term.",
    "tags": [
      "tiktok",
      "trend",
      "meme",
      "obsession",
      "thoughts",
      "niche",
      "humorous"
    ],
    "detailedOriginEtymology": "The trend was started by a user named Gaius Flavius in an Instagram reel, which then went viral on TikTok. The humor comes from the specificity and seeming randomness of the original topic. The phrase now functions as a fill-in-the-blank: 'My Roman Empire is [X].'",
    "culturalImpactAnalysis": "This trend and resulting slang term humorously highlighted perceived differences in thought patterns between genders, but more broadly, it opened up a popular new way to talk about personal interests and obsessions. It created a shared cultural shorthand for the idea that everyone has a niche topic they are quietly passionate about.",
    "communicationTips": "Use it to ask someone about their hidden interests or to describe your own. It's a fun conversation starter."
  },
  {
    "id": "gen-alpha-mid-001",
    "term": "Mid",
    "pronunciation": "/mɪd/",
    "definition": "An adjective describing something as mediocre, average, unimpressive, or of low quality. It's a concise and often dismissive way to express disappointment or a lack of enthusiasm.",
    "examples": [
      "How was the new movie? Honestly, it was pretty mid.",
      "I thought the song would be a hit, but it's mid.",
      "The food at that new restaurant is so mid, not worth the price."
    ],
    "originAndContext": "While 'mid' has existed as a prefix, its use as a standalone adjective was popularized in online communities, particularly in reviews and discussions about music, movies, and video games. It gained massive traction on platforms like Twitter and TikTok.",
    "commonSentiment": "Negative",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": "While not offensive, being called 'mid' or having one's work called 'mid' is a clear insult or criticism. It implies a lack of effort, quality, or 'wow factor.'",
    "tags": [
      "mediocre",
      "average",
      "unimpressive",
      "review",
      "criticism",
      "slang",
      "adjective"
    ],
    "detailedOriginEtymology": "Shortened from 'middle' or 'mediocre.' Its power as slang comes from its bluntness. Instead of a detailed critique, 'mid' delivers a swift, dismissive judgment. Its popularity surged in the early 2020s, becoming a go-to descriptor for anything that doesn't live up to the hype.",
    "culturalImpactAnalysis": "\"Mid\" reflects the fast-paced nature of online discourse, where quick, summary judgments are common. It's a powerful tool in \"hype culture,\" often used to deflate excitement around a product or piece of media. For Gen Alpha, it's a fundamental piece of their critical vocabulary.",
    "communicationTips": "Understand that \"mid\" is a negative critique. If a young person describes something as \"mid,\" they are saying it's not good and they are not impressed."
  },
  {
    "id": "gen-alpha-simp-001",
    "term": "Simp",
    "pronunciation": "/sɪmp/",
    "definition": "(Noun) A person (often, but not exclusively, male) who is perceived as being overly attentive, submissive, or subservient to someone else (often, but not exclusively, female) in hopes of winning their affection, approval, or sexual favor, typically without reciprocation or with the other person taking advantage of them. It implies doing 'too much' for someone who doesn't value or return the effort.\n(Verb) To act in this manner (e.g., \"He's simping hard for her.\").",
    "examples": [
      "He's always buying her expensive gifts and doing all her favors, even though she barely acknowledges him. He's such a simp.",
      "Stop simping for that streamer; she doesn't even know you exist.",
      "The internet comments were full of guys simping over the celebrity's latest post."
    ],
    "originAndContext": "The term 'simp' has roots in early 20th-century African American Vernacular English (AAVE) as a shortening of 'simpleton.' Its modern usage, referring to overly eager or subservient men, gained some traction in 1980s/90s hip-hop. However, it saw a massive resurgence and redefinition in the late 2010s and early 2020s, primarily through internet forums, gaming communities (especially Twitch), and TikTok. It's often used to criticize men perceived as desperate, overly deferential to women (particularly online personalities or 'e-girls'), or those who spend money on online creators in hopes of attention.",
    "commonSentiment": "Negative",
    "sensitivityRating": "Use With Caution",
    "cautionaryNotes": "The term 'simp' is highly controversial. While sometimes used humorously or to call out genuinely unhealthy dynamics, it is frequently wielded to mock, shame, or bully individuals (usually men) for any perceived act of kindness, generosity, or deference towards women. This can discourage healthy interactions and respect. In some contexts, it can carry misogynistic undertones, framing women as inherently manipulative or men as foolish for valuing women. Educators and parents should be aware of its potential for misuse in online harassment, bullying, or the promotion of toxic gender stereotypes.",
    "tags": [
      "social dynamics",
      "relationships",
      "dating",
      "online culture",
      "twitch",
      "tiktok",
      "pejorative",
      "criticism",
      "aave",
      "gender dynamics",
      "internet slang"
    ],
    "detailedOriginEtymology": "Originally a shortened form of 'simpleton,' implying a foolish or gullible person. Its evolution in AAVE and later hip-hop began to associate it with men who were easily swayed or controlled by women. The contemporary internet-driven understanding was heavily popularized by online communities, particularly those critical of men perceived as 'white knighting' or being overly solicitous towards women online, often without reciprocation or in exchange for digital attention.",
    "culturalImpactAnalysis": "'Simp' became a highly charged and ubiquitous term in online discourse, reflecting complex and often contentious discussions about gender dynamics, online interactions, transactional relationships, and perceived imbalances in romantic or social pursuits. Its widespread use highlights anxieties around authenticity, reciprocation, and self-respect in relationships, particularly in parasocial online interactions. The term's overuse or misapplication can also stifle genuine kindness and contribute to a cynical view of intergender relationships.",
    "communicationTips": "Understand that 'simp' is generally used as an insult. It's intended to criticize someone for trying too hard for attention or affection that isn't being returned, or for being taken advantage of. It's crucial to be aware that the term is often used unfairly or to promote negative stereotypes about gender interactions. Discussions around this term should emphasize the difference between genuine kindness/respect and unhealthy subservience or unreciprocated effort."
  },
  {
    "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    "term": "Delulu",
    "pronunciation": "/dəˈluːluː/",
    "definition": "Short for 'delusional.' It describes someone who holds unrealistic or overly idealistic beliefs, especially regarding their chances in a romantic relationship, their level of fame, or their potential for success. It can be used self-deprecatingly or as a gentle jab at someone else.",
    "examples": [
      "She thinks that celebrity is in love with her because he liked her comment, she's so delulu.",
      "My delulu self thought I could finish the entire project in one night.",
      "Being a little delulu is the solulu (solution)."
    ],
    "originAndContext": "Originated in K-pop fan communities to describe fans with unrealistic fantasies about their favorite idols. It has since spread to mainstream internet culture as a way to talk about wishful thinking.",
    "commonSentiment": "Humorous/Playful",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": "While often used playfully, it can sometimes be used to dismiss someone's hopes or ambitions. Context is key.",
    "tags": [
      "delusional",
      "k-pop",
      "fan culture",
      "wishful thinking",
      "humorous",
      "self-deprecating"
    ],
    "detailedOriginEtymology": "A clipped and stylized form of 'delusional,' made popular through its catchy and informal sound. Its spread from niche K-pop forums to global TikTok trends highlights the power of fan communities in shaping modern slang.",
    "culturalImpactAnalysis": "'Delulu' has become a key part of the lexicon for discussing parasocial relationships and the often blurry line between fandom and fantasy. The popular phrase 'delulu is the solulu' reframes delusion as a conscious choice for maintaining happiness or optimism, a form of playful self-deception.",
    "communicationTips": "Understand it as a lighthearted way to point out wishful thinking. It's often used with a sense of irony or self-awareness."
  },
  {
    "id": "b2c3d4e5-f6a7-8901-2345-67890abcdef1",
    "term": "Situationship",
    "pronunciation": "/sɪtʃuˈeɪʃənˌʃɪp/",
    "definition": "A romantic or sexual relationship that is undefined or non-committal. It's more than a casual hookup but lacks the clear labels, commitment, and future-oriented plans of a formal relationship. The parties are 'in a situation' rather than a relationship.",
    "examples": [
      "We've been seeing each other for months, but I don't know what we are. It's a situationship.",
      "I'm tired of being in situationships; I want a real boyfriend.",
      "They have all the benefits of a relationship without any of the commitment, it's a classic situationship."
    ],
    "originAndContext": "The term has been around for over a decade but saw a massive surge in popularity in the 2020s with the rise of dating apps and changing social norms around relationships. It perfectly captures the ambiguity many young people experience in modern dating.",
    "commonSentiment": "Variable",
    "sensitivityRating": "Use With Caution",
    "cautionaryNotes": "This term often carries a negative connotation, implying frustration, confusion, or emotional dissatisfaction due to the lack of clarity and commitment. It can be a source of anxiety for those desiring a more defined relationship.",
    "tags": [
      "dating",
      "relationships",
      "commitment",
      "ambiguity",
      "modern dating",
      "social dynamics"
    ],
    "detailedOriginEtymology": "A portmanteau of 'situation' and 'relationship.' Its popularity reflects a growing need for a term to describe the gray area between friendship and a committed partnership.",
    "culturalImpactAnalysis": "The normalization of the term 'situationship' points to a broader cultural shift in dating and relationships, where traditional labels and timelines are less rigid. It highlights the emotional complexities and communication challenges that arise from undefined romantic connections.",
    "communicationTips": "Acknowledge the potential for emotional stress this term implies. It's a useful word for young people to articulate the confusing 'in-between' stage of a modern romance."
  },
  {
    "id": "c3d4e5f6-a7b8-9012-3456-7890abcdef12",
    "term": "NPC",
    "pronunciation": "/ɛn piː siː/",
    "definition": "Stands for 'Non-Player Character.' In slang, it's a derogatory term for someone who is perceived as lacking independent thought, originality, or consciousness. They are seen as acting in a programmed, robotic, or generic way, following trends or social scripts without critical thinking.",
    "examples": [
      "He just repeats whatever he sees on the news, he's a total NPC.",
      "Look at everyone doing the same TikTok dance, it's an army of NPCs.",
      "That person gave such a generic, scripted answer. Major NPC vibes."
    ],
    "originAndContext": "Originates from video game terminology, where NPCs are characters controlled by the game's AI. The term was co-opted by online communities, particularly on platforms like 4chan and later Twitter, to insult people, often those with opposing political views, by implying they are not 'real' or sentient individuals.",
    "commonSentiment": "Negative",
    "sensitivityRating": "Offensive",
    "cautionaryNotes": "This is a dehumanizing insult. Calling someone an NPC is intended to dismiss their thoughts, feelings, and individuality entirely. It's often used in political discourse to shut down debate and can be associated with right-wing online subcultures. It should be treated as a serious insult.",
    "tags": [
      "insult",
      "derogatory",
      "gaming",
      "political",
      "dehumanizing",
      "online culture"
    ],
    "detailedOriginEtymology": "Direct acronym from 'Non-Player Character.' Its metaphorical leap from video games to real-life insult is rooted in the idea of people acting as if they are following a script they didn't write themselves.",
    "culturalImpactAnalysis": "The use of 'NPC' as an insult is a significant example of how gaming language has permeated political and social discourse. It reflects a deep-seated cultural anxiety about conformity, free will, and authenticity. Its use is highly polarizing and contributes to the toxicity of online debate by framing opponents as non-human actors.",
    "communicationTips": "Understand that this is not a playful term. It is a potent insult meant to invalidate a person's entire being. Its use should be a red flag in online conversations."
  },
  {
    "id": "d4e5f6a7-b8c9-0123-4567-890abcdef123",
    "term": "Cap / No Cap",
    "pronunciation": "/kæp/",
    "definition": "'Cap' means a lie, exaggeration, or falsehood. 'No cap' is used to emphasize that one is telling the truth or being completely serious. It's a declaration of authenticity.",
    "examples": [
      "He said he won the lottery? That's cap.",
      "This is the best pizza I've ever had, no cap.",
      "I'm actually going to study tonight, no cap."
    ],
    "originAndContext": "Rooted in African American Vernacular English (AAVE), the term 'cap' as a word for lying or exaggerating gained widespread popularity through hip-hop music and social media in the late 2010s. It's now a staple of youth slang.",
    "commonSentiment": "Variable",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": null,
    "tags": [
      "lie",
      "truth",
      "honesty",
      "aave",
      "hip-hop",
      "authenticity"
    ],
    "detailedOriginEtymology": "The exact origin is debated, but it's been part of AAVE for decades. One theory connects it to 'capping' as in 'topping' someone's story with a bigger lie. Its popularization is heavily credited to Atlanta rappers like Young Thug and Future.",
    "culturalImpactAnalysis": "The 'cap'/'no cap' dichotomy has become a fundamental part of modern slang for discussing truth and lies. It reflects a cultural premium on authenticity, especially in online spaces where exaggeration can be rampant. 'No cap' serves as a verbal seal of approval for a statement's veracity.",
    "communicationTips": "Use 'cap' to call out a lie and 'no cap' to affirm you're being truthful. It's a very common and straightforward piece of slang."
  },
  {
    "id": "e5f6a7b8-c9d0-1234-5678-90abcdef1234",
    "term": "Glow Up",
    "pronunciation": "/ɡloʊ ʌp/",
    "definition": "A significant and positive transformation of one's appearance, confidence, or overall life situation. It implies a journey of improvement, often from an awkward or less confident phase to a more mature, attractive, and self-assured state.",
    "examples": [
      "Did you see her photos from high school? She had a major glow up.",
      "I'm focusing on my health and career this year, it's my glow up season.",
      "He really had a glow up after the breakup."
    ],
    "originAndContext": "The term was popularized by rapper Chief Keef in his 2013 song 'Gotta Glo Up One Day.' It spread through social media, where 'glow up' challenges (showing before-and-after pictures) became a viral trend.",
    "commonSentiment": "Positive",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": "While positive, the intense focus on physical transformation in many 'glow up' trends can sometimes contribute to body image pressures.",
    "tags": [
      "transformation",
      "improvement",
      "self-care",
      "confidence",
      "beauty",
      "positive"
    ],
    "detailedOriginEtymology": "A phrasal verb combining 'glow' (to radiate light or confidence) and 'up' (indicating an increase or improvement). Its popularization is directly tied to hip-hop and viral social media trends.",
    "culturalImpactAnalysis": "'Glow up' is a powerful and positive concept in youth culture that celebrates personal growth and transformation. It champions the idea that people can actively improve themselves and their circumstances, moving from a less happy state to one of confidence and radiance. It's a cornerstone of self-improvement narratives online.",
    "communicationTips": "Use this as a strong compliment to acknowledge someone's positive transformation, whether it's in their appearance, confidence, or success."
  },
  {
    "id": "9a8b7c6d-5e4f-3210-9876-543210abcdef",
    "term": "Clutch",
    "pronunciation": "/klʌtʃ/",
    "definition": "Performing well or succeeding under pressure; being reliable or dependable in a critical moment. Can also mean something is excellent or impressive.",
    "examples": [
      "He made a clutch shot at the last second to win the game.",
      "That move was clutch!",
      "She came through clutch when we needed her most."
    ],
    "originAndContext": "Originally from sports terminology, particularly basketball and baseball, where 'clutch' refers to critical moments in games. Has expanded into general usage to describe any situation requiring performance under pressure.",
    "commonSentiment": "Positive",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": null,
    "tags": [
      "sports",
      "reliability",
      "pressure",
      "excellence",
      "performance",
      "positive"
    ],
    "detailedOriginEtymology": "Derived from the sports world, where clutch time refers to the final moments of a game. The term 'clutch' itself relates to grasping or holding on tightly. Gen Z has extended this to any high-pressure situation requiring success.",
    "culturalImpactAnalysis": "Widely used in youth culture to describe both literal performance moments (sports, gaming) and figurative ones (academics, social situations). Represents the value placed on reliability and coming through for others.",
    "communicationTips": "Use to compliment someone's performance under pressure or to describe a moment of critical success. Has largely positive connotations in peer conversations."
  },
  {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "term": "Slay",
    "pronunciation": "/sleɪ/",
    "definition": "To do something exceptionally well, or to look amazing, or to be very impressive.",
    "examples": [
      "She slayed that dance routine.",
      "Your outfit slays!",
      "He slayed his final exams."
    ],
    "originAndContext": "Popularized in LGBTQ+ ballroom culture, the term 'slay' has become mainstream slang, especially on social media, to denote excellence or strong approval.",
    "commonSentiment": "Positive",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": null,
    "tags": [
      "compliment",
      "performance",
      "fashion",
      "lgbtq+",
      "excellence",
      "tiktok"
    ],
    "detailedOriginEtymology": "While 'slay' has meant 'to kill violently' for centuries, its slang usage for 'impressing greatly' emerged from African American Vernacular English (AAVE) and was heavily popularized by ballroom culture in the late 20th century. Its widespread adoption by Gen Z and Gen Alpha occurred via social media platforms in the 2010s and 2020s.",
    "culturalImpactAnalysis": "Represents a common way to express strong admiration and has become a staple in online positive reinforcement, particularly in creative and performance-oriented communities.",
    "communicationTips": "Use it to give a strong compliment. It's generally understood as high praise."
  },
  {
    "id": "a1b2c3d4-e5f6-7890-1234-567890fedcba",
    "term": "Sus",
    "pronunciation": "/sʌs/",
    "definition": "Short for 'suspicious' or 'suspect.' Used to describe someone or something that seems questionable, dishonest, or untrustworthy.",
    "examples": [
      "The way he avoided the question was pretty sus.",
      "That player's movements in the game are sus; I think they're cheating."
    ],
    "originAndContext": "While 'sus' as an abbreviation has existed for a while, its massive popularity surge is tied to the online multiplayer game 'Among Us,' which became extremely popular in 2020. In the game, players try to identify impostors ('sus' players).",
    "commonSentiment": "Negative",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": null,
    "tags": [
      "suspicious",
      "gaming",
      "among us",
      "dishonest",
      "questionable"
    ],
    "detailedOriginEtymology": "A straightforward abbreviation of 'suspicious.' Its usage was significantly amplified by the social deduction game 'Among Us.'",
    "culturalImpactAnalysis": "Became a ubiquitous term for expressing doubt or suspicion, extending far beyond its gaming origins into general online and offline conversations.",
    "communicationTips": "Indicates that someone or something is perceived as untrustworthy or strange. Often used playfully but can also be a serious accusation depending on context."
  },
  {
    "id": "b2c3d4e5-f6a7-8901-2345-67890abcdef0",
    "term": "Bussin'",
    "pronunciation": "/ˈbʌsɪn/",
    "definition": "Extremely good, delicious (especially for food), or excellent. Used to express strong approval or enjoyment.",
    "examples": [
      "This pizza is bussin'!",
      "That new song is absolutely bussin'."
    ],
    "originAndContext": "Originates from African American Vernacular English (AAVE) and gained widespread popularity through TikTok and other social media platforms, particularly in food review content.",
    "commonSentiment": "Positive",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": null,
    "tags": [
      "food",
      "excellent",
      "delicious",
      "aave",
      "tiktok",
      "approval"
    ],
    "detailedOriginEtymology": "The exact etymology is debated, but it's a term from AAVE that signifies something bursting with flavor or quality. Its current popularity is heavily driven by viral trends on TikTok.",
    "culturalImpactAnalysis": "A key term in contemporary positive slang, especially for describing enjoyable experiences, with a strong association with food.",
    "communicationTips": "A very enthusiastic way to say something is great. If food is 'bussin'', it's exceptionally good."
  },
  {
    "id": "c3d4e5f6-a7b8-9012-3456-7890abcdef1",
    "term": "Based",
    "pronunciation": "/beɪst/",
    "definition": "A term used to describe someone who is being themselves, authentic, or expressing an opinion that is courageous or unique, often without caring about what others think. It can also mean agreeing with something or acknowledging it as true or admirable, especially if it's unconventional or controversial.",
    "examples": [
      "That's a based take on the situation.",
      "He's so based for speaking his mind like that."
    ],
    "originAndContext": "Originated with rapper Lil B, who used it to mean being positive and true to oneself. It was later co-opted by various online communities, including political groups on both the left and right, where its meaning can shift. It often implies a rejection of mainstream narratives.",
    "commonSentiment": "Variable",
    "sensitivityRating": "Use With Caution",
    "cautionaryNotes": "The meaning of 'based' can be highly contextual and vary significantly between different online communities. In some circles, it can be associated with controversial, niche, or even extremist viewpoints. Understanding the specific context is crucial.",
    "tags": [
      "authentic",
      "opinion",
      "online culture",
      "controversial",
      "unconventional"
    ],
    "detailedOriginEtymology": "Popularized by rapper Lil B in the late 2000s. Its meaning has evolved and fragmented as it spread through different internet subcultures.",
    "culturalImpactAnalysis": "Reflects a valuation of authenticity and independent thought, but its co-option by various groups means its connotation can be ambiguous or politically charged.",
    "communicationTips": "Be aware that this term can carry different weights in different communities. It's not always a straightforward compliment."
  },
  {
    "id": "d4e5f6a7-b8c9-0123-4567-890abcdef2",
    "term": "Cringe",
    "pronunciation": "/krɪndʒ/",
    "definition": "Causing feelings of embarrassment, awkwardness, or secondhand embarrassment due to someone else's actions or words.",
    "examples": [
      "His attempt at that TikTok dance was so cringe.",
      "I had to stop watching; the cringe was too much."
    ],
    "originAndContext": "The word 'cringe' (to shrink back in fear or embarrassment) is old, but its use as an adjective or noun to describe something that *causes* this feeling is a more modern slang development, heavily popularized by online content sharing and 'cringe compilations'.",
    "commonSentiment": "Negative",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": null,
    "tags": [
      "awkward",
      "embarrassing",
      "online content",
      "secondhand embarrassment"
    ],
    "detailedOriginEtymology": "Derived from the verb 'to cringe.' Its slang usage focuses on the external stimulus that elicits the cringing reaction.",
    "culturalImpactAnalysis": "A cornerstone of internet culture for reacting to and categorizing socially awkward or embarrassing content. 'Cringe culture' is a significant aspect of online humor and social commentary.",
    "communicationTips": "Used to express that something is awkward or embarrassing to watch or witness."
  },
  {
    "id": "e5f6a7b8-c9d0-1234-5678-90abcdef3",
    "term": "Cheugy",
    "pronunciation": "/ˈtʃuːɡi/",
    "definition": "Describes someone or something that is outdated, trying too hard to be trendy, or clinging to slightly older trends that are no longer in style. Often associated with stereotypical millennial aesthetics or behaviors.",
    "examples": [
      "'Live, Laugh, Love' signs are considered cheugy by some.",
      "Her Instagram feed has a very cheugy vibe."
    ],
    "originAndContext": "Coined and popularized on TikTok around 2021, primarily by Gen Z users to describe certain millennial trends.",
    "commonSentiment": "Negative",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": "While not deeply offensive, it's a mildly derisive term used to label things as out of touch or basic.",
    "tags": [
      "outdated",
      "millennial",
      "trends",
      "tiktok",
      "uncool",
      "basic"
    ],
    "detailedOriginEtymology": "Reportedly coined by Gaby Rasson in 2013 and later popularized by Hallie Cain on TikTok. Its specific criteria can be somewhat nebulous and subjective.",
    "culturalImpactAnalysis": "Highlights intergenerational differences in taste and trends, particularly between Gen Z and millennials. It sparked much online discussion about fast-changing trend cycles.",
    "communicationTips": "Understand it as a label for things perceived as slightly outdated or 'trying too hard' from a younger perspective."
  },
  {
    "id": "f6a7b8c9-d0e1-2345-6789-0abcdef124",
    "term": "Vibe Check",
    "pronunciation": "/vaɪb tʃɛk/",
    "definition": "An assessment, often spontaneous or humorous, of someone's mood, atmosphere, or general disposition ('vibe'). It can also be a playful, sometimes mock-aggressive, way to demand someone reveal their current state of mind.",
    "examples": [
      "He seemed really off, so I gave him a vibe check.",
      "Random vibe check! How are you feeling?",
      "That comment failed the vibe check."
    ],
    "originAndContext": "Popularized through internet memes and social media platforms like Twitter and Tumblr in the late 2010s. It plays on the idea of intuitively sensing someone's emotional state.",
    "commonSentiment": "Variable",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": "While often playful, the 'aggressive' form of vibe check (e.g., a meme showing someone about to hit another with an object labeled 'vibe check') is purely humorous and not literal.",
    "tags": [
      "mood",
      "atmosphere",
      "meme",
      "social media",
      "intuition"
    ],
    "detailedOriginEtymology": "Combines 'vibe' (short for vibration, referring to an atmosphere or feeling) and 'check' (an examination or test).",
    "culturalImpactAnalysis": "Reflects a focus on emotional states and interpersonal dynamics, often in a lighthearted or ironic way. It's a shorthand for assessing social compatibility or mood.",
    "communicationTips": "Usually a casual way to ask how someone is doing or to comment on the general atmosphere."
  },
  {
    "id": "a7b8c9d0-e1f2-3456-7890-1bcdef1235",
    "term": "Finna",
    "pronunciation": "/ˈfɪnə/",
    "definition": "A contraction of 'fixing to,' meaning 'going to' or 'about to do something.' Indicates an immediate or near-future intention.",
    "examples": [
      "I'm finna go to the store.",
      "She finna start her presentation."
    ],
    "originAndContext": "Common in African American Vernacular English (AAVE) and Southern American English for many years. It has been widely adopted into general slang, especially among younger generations, through music and social media.",
    "commonSentiment": "Neutral",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": null,
    "tags": [
      "aave",
      "future tense",
      "colloquial",
      "intention",
      "southern us english"
    ],
    "detailedOriginEtymology": "A phonetic reduction of the phrase 'fixing to,' which means preparing or intending to do something.",
    "culturalImpactAnalysis": "Its widespread adoption showcases the influence of AAVE on mainstream slang and informal language.",
    "communicationTips": "A common and informal way to express intent to do something soon."
  },
  {
    "id": "b8c9d0e1-f2a3-4567-8901-2cdef12346",
    "term": "Lowkey",
    "pronunciation": "/ˈloʊkiː/",
    "definition": "Adverb meaning subtly, quietly, modestly, or to a small extent. Used to downplay something or express a reserved feeling or thought.",
    "examples": [
      "I lowkey want to go to that party, but I'm not sure.",
      "He's lowkey a genius.",
      "This is lowkey the best ice cream I've ever had."
    ],
    "originAndContext": "Has been part of general slang for some time but gained significant traction with younger generations online. It's used to express thoughts or feelings that aren't overtly stated or are somewhat hidden.",
    "commonSentiment": "Neutral",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": null,
    "tags": [
      "subtle",
      "secretly",
      "adverb",
      "modestly",
      "quietly"
    ],
    "detailedOriginEtymology": "Derived from 'low key,' as in subdued or not drawing attention.",
    "culturalImpactAnalysis": "A versatile adverb used to qualify statements, often adding a layer of understatement or confession.",
    "communicationTips": "Indicates that a feeling or fact is present but not overwhelmingly or obviously so."
  },
  {
    "id": "c9d0e1f2-a3b4-5678-9012-3def123457",
    "term": "Highkey",
    "pronunciation": "/ˈhaɪkiː/",
    "definition": "Adverb meaning openly, obviously, overtly, or to a large extent. The opposite of 'lowkey.' Used to emphasize a feeling or thought.",
    "examples": [
      "I highkey love this new album.",
      "She's highkey annoyed about what happened.",
      "This is highkey the worst movie I've seen all year."
    ],
    "originAndContext": "Emerged as a direct antonym to 'lowkey,' gaining popularity alongside it in online and youth slang. It's used to express thoughts or feelings that are strong and not hidden.",
    "commonSentiment": "Neutral",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": null,
    "tags": [
      "obvious",
      "openly",
      "adverb",
      "intensely",
      "publicly"
    ],
    "detailedOriginEtymology": "Derived from 'high key,' as in prominent or drawing attention, in contrast to 'low key.'",
    "culturalImpactAnalysis": "Works in tandem with 'lowkey' to provide a spectrum for expressing the intensity or openness of feelings and statements.",
    "communicationTips": "Indicates that a feeling or fact is strong, obvious, or openly acknowledged."
  },
  {
    "id": "d0e1f2a3-b4c5-6789-0123-4ef1234568",
    "term": "Ghosting",
    "pronunciation": "/ˈɡoʊstɪŋ/",
    "definition": "The practice of suddenly ending all communication and contact with another person without any apparent warning or explanation, especially in a romantic relationship or friendship.",
    "examples": [
      "He ghosted me after our third date; he just stopped replying to my texts.",
      "I thought we were friends, but she started ghosting me last month."
    ],
    "originAndContext": "The term became prominent with the rise of online dating and digital communication in the 2010s, where it's easier to disappear from someone's life by simply not responding.",
    "commonSentiment": "Negative",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": "Describes a behavior that is widely considered hurtful and disrespectful.",
    "tags": [
      "dating",
      "relationships",
      "communication",
      "breakup",
      "online dating",
      "friendship"
    ],
    "detailedOriginEtymology": "Metaphorical use of 'ghost' to describe someone disappearing as if they were never there.",
    "culturalImpactAnalysis": "A widely recognized term that articulates a common and often painful experience in modern relationships, highlighting changing communication norms and challenges.",
    "communicationTips": "Refers to a negative social behavior. Understanding the term helps in discussing modern relationship dynamics."
  },
  {
    "id": "e1f2a3b4-c5d6-7890-1234-5f12345679",
    "term": "Stan",
    "pronunciation": "/stæn/",
    "definition": "(Noun) An overly zealous, obsessive, or extremely devoted fan of a particular celebrity, musician, or public figure. (Verb) To be such a fan or to strongly support something.",
    "examples": [
      "She's a huge Taylor Swift stan and knows all her lyrics.",
      "I stan that artist; their work is amazing."
    ],
    "originAndContext": "The term originates from Eminem's 2000 song 'Stan,' which depicts a dangerously obsessed fan named Stan. While the origin is dark, the term has been adopted by fan communities, often in a more positive or self-deprecating way, to describe intense fandom.",
    "commonSentiment": "Variable",
    "sensitivityRating": "Use With Caution",
    "cautionaryNotes": "While often used playfully by fans to describe their own devotion, the term's origin is tied to unhealthy obsession. It's important to distinguish between passionate fandom and potentially problematic behavior. Some use it critically to describe toxic fan culture.",
    "tags": [
      "fan",
      "celebrity",
      "music",
      "obsessive",
      "fandom",
      "support"
    ],
    "detailedOriginEtymology": "A portmanteau of 'stalker' and 'fan,' as embodied by the character in Eminem's song. Modern usage has softened in many contexts but the original connotation remains.",
    "culturalImpactAnalysis": "Reflects the intensity of modern fan culture and parasocial relationships. The term is central to discussions about fandom, celebrity worship, and online community dynamics.",
    "communicationTips": "Usage can range from lighthearted self-identification as a devoted fan to a critique of obsessive behavior. Context is key to understanding intent."
  },
  {
    "id": "f2a3b4c5-d6e7-8901-2345-012345678a",
    "term": "Poggers",
    "pronunciation": "/ˈpɒɡərz/",
    "definition": "An expression of excitement, amazement, or approval, often used in gaming contexts. It's similar to saying 'Awesome!' or 'Cool!'",
    "examples": [
      "You beat the final boss? That's poggers!",
      "He pulled off that trick? Poggers!"
    ],
    "originAndContext": "Originates from Twitch and gaming culture, derived from the 'PogChamp' emote, which was used to express excitement. 'Poggers' is a variation that became popular.",
    "commonSentiment": "Positive",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": null,
    "tags": [
      "gaming",
      "twitch",
      "excitement",
      "emote",
      "awesome",
      "cool"
    ],
    "detailedOriginEtymology": "A playful extension of 'Pog' from 'PogChamp,' an emote featuring streamer Ryan 'Gootecks' Gutierrez. (The PogChamp emote itself has faced controversy and changes, but 'pog' and 'poggers' as expressions have persisted).",
    "culturalImpactAnalysis": "A key piece of vocabulary within gaming communities that has seeped into broader internet slang as a general expression of excitement.",
    "communicationTips": "A straightforward way to express enthusiasm, particularly in response to an achievement or something cool happening."
  },
  {
    "id": "a3b4c5d6-e7f8-9012-3456-123456789b",
    "term": "Ick",
    "pronunciation": "/ɪk/",
    "definition": "A sudden feeling of disgust, repulsion, or cringeworthiness towards someone you were previously attracted to or interested in. This feeling is often triggered by a minor, specific, and sometimes irrational turn-off.",
    "examples": [
      "He was cute until he started talking baby talk to his dog, then I got the ick.",
      "The way she pronounced that word gave me the ick.",
      "I used to like him, but then he did this one thing and now it's just a massive ick."
    ],
    "originAndContext": "Popularized on social media platforms like TikTok and in dating discussions, particularly among Gen Z. It describes a very specific and often sudden shift in perception.",
    "commonSentiment": "Negative",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": "While the 'ick' itself is a personal feeling, discussions around it can sometimes seem judgmental or based on trivialities.",
    "tags": [
      "dating",
      "turn-off",
      "relationships",
      "tiktok",
      "repulsion",
      "cringe"
    ],
    "detailedOriginEtymology": "Likely derived from exclamations like 'icky' or sounds expressing disgust. Its modern slang usage pinpoints a very specific phenomenon in attraction.",
    "culturalImpactAnalysis": "Highlights the often unpredictable and sometimes trivial nature of attraction and repulsion in modern dating. It's a common topic in online discussions about relationship dealbreakers.",
    "communicationTips": "Refers to a very specific negative reaction that makes someone unattractive to the speaker."
  },
  {
    "id": "b4c5d6e7-f8a9-0123-4567-234567890c",
    "term": "Touch Grass",
    "pronunciation": "/tʌtʃ ɡræs/",
    "definition": "An admonition or insult directed at someone perceived as spending too much time online, being out of touch with reality, or being overly invested in internet drama. It suggests they should go outside and reconnect with the 'real world.'",
    "examples": [
      "You've been arguing about that game for 12 hours, go touch grass.",
      "He's getting way too worked up over a tweet. Someone tell him to touch grass."
    ],
    "originAndContext": "Emerged from online communities, particularly gaming forums, Twitter, and Twitch, as a way to tell someone to log off and get some perspective.",
    "commonSentiment": "Negative",
    "sensitivityRating": "Use With Caution",
    "cautionaryNotes": "While sometimes used humorously, it's generally intended as an insult, implying the target is chronically online and detached from reality. It can be dismissive.",
    "tags": [
      "online",
      "reality",
      "insult",
      "gaming",
      "internet culture",
      "log off"
    ],
    "detailedOriginEtymology": "A literal suggestion to go outside and physically touch grass, symbolizing a return to nature or the physical world away from screens.",
    "culturalImpactAnalysis": "Reflects growing awareness and criticism of excessive internet use and the echo chambers or distorted perspectives that can arise from it. It's a common retort in heated online discussions.",
    "communicationTips": "Usually an insult telling someone they are too invested in online matters. Not a friendly suggestion."
  },
  {
    "id": "c5d6e7f8-a9b0-1234-5678-345678901d",
    "term": "Big Yikes",
    "pronunciation": "/bɪɡ jaɪks/",
    "definition": "An emphatic expression of cringe, embarrassment, disapproval, or shock in response to a particularly awkward, problematic, or unfortunate situation. It's an amplified version of 'yikes.'",
    "examples": [
      "He accidentally sent that message to the whole group chat? Big yikes.",
      "Did you see what she posted? That's a big yikes from me."
    ],
    "originAndContext": "Evolved from the interjection 'yikes' (used to express mild shock or alarm). The addition of 'big' intensifies the sentiment, popularized through social media and online commentary.",
    "commonSentiment": "Negative",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": null,
    "tags": [
      "cringe",
      "awkward",
      "disapproval",
      "meme",
      "shock",
      "embarrassment"
    ],
    "detailedOriginEtymology": "A simple intensifier ('big') added to the existing interjection 'yikes.'",
    "culturalImpactAnalysis": "A common way to quickly express strong secondhand embarrassment or disapproval in online conversations.",
    "communicationTips": "Indicates a strong negative reaction to something perceived as very awkward or wrong."
  },
  {
    "id": "d6e7f8a9-b0c1-2345-6789-456789012e",
    "term": "Periodt",
    "pronunciation": "/ˈpɪəriət/",
    "definition": "An emphatic way of saying 'period' at the end of a statement, used to add emphasis, assert finality, or indicate that a point is undisputed and no further discussion is needed. The 't' is often added for extra force or sass.",
    "examples": [
      "That's the best movie ever, periodt.",
      "She is the queen, periodt.",
      "I said what I said, periodt."
    ],
    "originAndContext": "Originates from African American Vernacular English (AAVE) and was popularized on social media, particularly Twitter and TikTok, by Black communities and later adopted more broadly.",
    "commonSentiment": "Neutral",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": null,
    "tags": [
      "emphasis",
      "finality",
      "aave",
      "social media",
      "assertion",
      "undisputed"
    ],
    "detailedOriginEtymology": "An extension of 'period' (as in the punctuation mark indicating the end of a sentence), with an added 't' for emphasis, reflecting a common phonetic feature in some AAVE pronunciations or simply for stylistic flair.",
    "culturalImpactAnalysis": "A powerful and concise way to assert a point with conviction, widely adopted in online discourse. Its spread highlights the significant influence of AAVE on internet slang.",
    "communicationTips": "Used to signal that the speaker considers their statement definitive and not up for debate."
  },
  {
    "id": "e7f8a9b0-c1d2-3456-7890-567890123f",
    "term": "CEO of...",
    "pronunciation": "/siː iː oʊ əv/",
    "definition": "A humorous or complimentary way to say someone is very good at something, exemplifies a particular trait, or is known for a specific behavior, often in an exaggerated or ironic sense. E.g., 'CEO of being late,' 'CEO of making everyone laugh.'",
    "examples": [
      "My dog is the CEO of begging for treats.",
      "She's the CEO of finding the best thrift store deals.",
      "He's the CEO of accidentally starting drama."
    ],
    "originAndContext": "Became a popular trend and meme format on TikTok and other social media platforms around 2019-2020. Users would playfully assign 'CEO' titles for various mundane or quirky 'skills.'",
    "commonSentiment": "Humorous/Playful",
    "sensitivityRating": "Generally Harmless",
    "cautionaryNotes": null,
    "tags": [
      "humor",
      "tiktok",
      "trend",
      "skill",
      "meme",
      "compliment",
      "exaggeration"
    ],
    "detailedOriginEtymology": "Playfully applies the prestigious business title 'CEO' (Chief Executive Officer) to everyday traits or abilities for comedic effect.",
    "culturalImpactAnalysis": "A lighthearted meme format that allows for creative and humorous compliments or self-descriptions. It reflects a playful take on achievement and expertise.",
    "communicationTips": "Generally used as a funny compliment or observation."
  },
  {
    "id": "f8a9b0c1-d2e3-4567-8901-6789012340",
    "term": "Pick me (girl/boy)",
    "pronunciation": "/pɪk miː/",
    "definition": "A derogatory term for a person (often a girl, hence 'pick me girl') who claims or acts as if they are 'not like others' (especially others of their own gender) to seek attention, validation, or approval, particularly from the opposite sex. This behavior often involves putting down their own gender or highlighting how they are different and supposedly superior.",
    "examples": [
      "She's such a pick me, always saying she only hangs out with guys because girls are too much drama.",
      "He's a pick me boy, constantly talking about how sensitive he is compared to other guys."
    ],
    "originAndContext": "The concept has been discussed for years, but the term gained significant traction and became a label through social media discourse, particularly on TikTok, in the early 2020s. It's used to criticize behavior perceived as disingenuous or seeking external validation by denigrating one's peers.",
    "commonSentiment": "Negative",
    "sensitivityRating": "Use With Caution",
    "cautionaryNotes": "This term is highly critical and often used to shame or bully individuals. While it can sometimes point to behaviors rooted in internalized misogyny or a desire for male validation, it's frequently applied broadly and can discourage individuality or genuine cross-gender friendships. Discussions around it can be very heated.",
    "tags": [
      "social dynamics",
      "validation",
      "gender",
      "tiktok",
      "derogatory",
      "criticism",
      "attention-seeking"
    ],
    "detailedOriginEtymology": "The phrase 'pick me' literally refers to someone wanting to be chosen or selected. As a label, it implies a desperate or manipulative attempt to be chosen over others.",
    "culturalImpactAnalysis": "Central to online discussions about gender dynamics, authenticity, and social hierarchies. It has sparked debate about whether it's a fair critique of certain behaviors or a tool for shaming, particularly women.",
    "communicationTips": "Understand that this is a strong insult. It accuses someone of being manipulative and insincere to gain favor."
  },
  {
    "id": "gen-alpha-keep-yourself-safe-001",
    "term": "Keep yourself safe",
    "pronunciation": "/kiːp jɔːrˈsɛlf seɪf/",
    "definition": "Sounds like a caring sign-off, but online it is widely used as a disguised form of \"KYS\", short for \"kill yourself\". Used that way, it is harassment that tells someone to end their life, worded so it looks friendly and can be denied.",
    "examples": [
      "A reply of \"keep yourself safe 🙂\" under a post, from someone who has been mocking or arguing with the poster, is most likely the coded meaning, not concern.",
      "It is often paired with a smiling emoji or an overly sweet tone so it looks harmless to anyone skimming.",
      "From a friend who knows you are having a hard time, the same words can simply mean they care. Who sent it, and what else they said, matters."
    ],
    "originAndContext": "It grew out of \"KYS\", an abbreviation long used as an insult in gaming chats and comment sections. \"Keep yourself safe\" keeps the same initials while sounding innocent, so it is used to avoid being flagged or to claim the message was kind. Because the words are ordinary, both the literal and the coded meaning are in use.",
    "commonSentiment": "Variable",
    "sensitivityRating": "Offensive",
    "cautionaryNotes": "Telling someone to kill themselves is serious online harassment, even when it is framed as a joke. If a young person is receiving these messages, take it seriously: help them save screenshots, block and report the account, and check in on how they are feeling. In Australia, serious cyberbullying of a child can be reported to the eSafety Commissioner at esafety.gov.au. If anyone is in immediate danger, call 000. Kids Helpline (1800 55 1800) and Lifeline (13 11 14) offer free support 24 hours a day.",
    "tags": [
      "cyberbullying",
      "harassment",
      "coded language",
      "online safety",
      "self-harm",
      "gaming"
    ],
    "detailedOriginEtymology": "A backronym: a new phrase built to fit the letters of an existing abbreviation. \"KYS\" (kill yourself) was re-expanded as \"keep yourself safe\", keeping the initials while hiding the meaning.",
    "culturalImpactAnalysis": "An example of how harmful phrases are disguised as everyday language to slip past moderation and adult attention. It also makes the genuine, caring use of the phrase easy to misread in both directions, which is why the sender, the tone and the surrounding messages matter more than the words themselves.",
    "communicationTips": "Don't assume every use is sinister, but don't brush it off either. Ask calmly what the message meant to them and how it made them feel. If it was aimed at them as an insult, treat it as bullying: save the evidence, block and report, and stay alert to changes in mood or behavior. Avoid using the phrase yourself to show you understand it."
  }
]
