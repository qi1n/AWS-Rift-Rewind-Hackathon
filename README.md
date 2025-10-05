# Front End


---

A playful yet coach-grade frontend that turns end-of-game data into reflections, learning, and celebrations.

Tech Stack

Next.js (App Router), TypeScript

Tailwind CSS + shadcn/ui

Recharts, Framer Motion

**Core Features**
1) Summoner’s Hall (Homepage)

Input gameName#tagLine + region

CTA: Generate My Career Analysis

Particle effects & anime-style page transitions

2) Dashboard

Visualize main champions, team role & personality (e.g., Strategy Mid, Tempo Jungle)

Recent performance: KDA, CS/min, GPM, Vision Score

Tactical facets: Lane Tempo, Teamfights, Objective Control, Vision, Economy

Team fit: Aggressive-leaning; Strategic potential: Mid-game tempo driver

Recent game list

3) Single Game Detail (Match Recap)

Left: Timeline + map events (kills, wards, dragon/herald)

Center: AI Coach voice card with key takeaways

Right: What-if scenarios (e.g., swap trinket at 8:00 → higher Herald control)

Bottom: 3-step improvement plan + “Coach Mode” training checklist

4) Season Recap (“Book of Glory”)

Narration modes: Coach (pro), Caster (playful), Bro (banter)

Scrollytelling: total games, top champs, power windows, best duo

Generates honor titles and poster cards (export/share)

5) Share & Social

One-click poster generation (tone: coach / fun / caster)

Battle Card: head-to-head with friends

Community Weekly Top Players leaderboard
![Draft](apps/res/readmeImage/draft.png)
# DA
Polars + DuckDB

# Backend + API

Node.js

DuckDB / polars (local dev) → Postgres / ClickHouse (cloud stage)

FastAPI

# AWS  Related
| Service                              | Purpose                                               |
| ------------------------------------ | ----------------------------------------------------- |
| **S3**                               | Store raw match data & generated insights             |
| **AWS Glue / Lambda**                | ETL pipeline from raw → Parquet features              |
| **Athena**                           | Query and debug data quickly                          |
| **SageMaker**                        | Train playstyle embeddings + similarity model         |
| **Bedrock**                          | Generate personalized narratives & insights           |
| **API Gateway + Lambda**             | Serve /summary endpoint                               |
| **OpenSearch Serverless / pgvector** | Store playstyle embeddings for fast similarity search |


# Key Baseline Features

* **Doppelgänger Match**: cosine similarity over a **playstyle embedding** (see “Modeling” below). Top-3 pros + “how/why” explanation chips.
* **Draft Notes IRL**: If you were on stage, which champs would the enemy “ban first” vs you (your highest **threat vector** across comfort + snowball pattern).
* **Tempo & Economy Score**: Not win-rate — but **how fast** you convert leads (gold diff @10→tower plates→objectives) and **how cleanly** you spend (recall discipline, component spikes).
* **Skirmish DNA vs. Macro DNA**: Where your fights happen (river/herald/side brush), average participants, and whether your team **stabilizes side lanes** before objectives.
* **Clutch Index**: Performance under **win-probability <35%** moments: damage share, death-saving pings, objective steals, clean-ups after lost fights.
* **Vision Choreography**: Not wards placed — but **pre-objective vision timing** (seconds before spawn) and **sweep-→path-→setup** sequences.
* **Consistency Spider**: 6 axes (lane control, mid-game rotations, objective setup, skirmish efficacy, discipline [unforced deaths], economy).
* **Duo Complementarity**: Which friend best “covers” your weak axes (embedding orthogonality → synergy score).
* **Tilt Thermometer**: Detect tilt sessions via **action entropy** (erratic pathing, rising solo deaths, ping pattern). Includes **reset recipe** extracted from your own best “bounce-back” sessions.



---

# Data → Features → Embeddings

**Player match features (per role/champion normalized):**

* **Early:** CS@10, XP@10, Gold@10, lane state when first roam, first recall timings, plate conversion.
* **Skirmish:** positions (river/side/tribush heatmap buckets), 2v2/3v3 frequency, kill participation by fight size.
* **Objective flow:** `% fights within 45/30/15s pre-objective spawn`, herald→plates→dragon sequencing.
* **Discipline:** isolated deaths, deaths <20s before objective, surprise deaths (no allied vision within 900 units).
* **Economy:** average recall gold, component-to-mythic timing, spike utilization (power spike window KDA/CS share).
* **Vision choreography:** wards placed/cleared in **T-90s to T+30s** around objectives; sweep→enter→contest chains.
* **Clutch:** deltas when team WP <35% (damage share, dmg taken avoided via flashes/peel, steals).
* **Style priors:** champion classes distribution, engage vs peel actions, side-lane occupancy pre/post 20m.

**Embedding construction:**

* Aggregate per role + per champion class (fighter/mage/assassin/support/tank/marksman).
* Z-score within MMR band; project via PCA → **128-D**; fine-tune with metric learning (triplet loss) where positives are **the same player across months**, negatives are dissimilar roles.
* **Pro catalog:** compute same embedding on pro match data (split by split/patch and side).

---

# Modeling stack on AWS / AWS 端到端方案

**Storage & ETL**

* **Amazon S3**: raw match JSON (player & pro).
* **AWS Glue** + **AWS Lambda**: normalize EoG to feature tables (Parquet).
* **AWS Athena**: ad-hoc SQL (power users, dashboards).

**Similarity + Search**

* **Amazon OpenSearch Serverless** (vector engine) or **Aurora PostgreSQL + pgvector** for 128-D embeddings, fast KNN by region/role.

**ML**

* **Amazon SageMaker**:

  * Feature pipelines (Processing Jobs).
  * **Metric learning** (PyTorch) for the embedding head.
  * **Autopilot/Bring-your-own** for tilt detection (session classification).
* **Amazon Bedrock** (small, cost-aware models):

  * **Claude**/**Llama-guarded** prompts to generate explanations, memes, and social copy **grounded** in retrieved stats.
  * **Titan Text Embeddings** (optional) for semantic retrieval of coaching tips.

**Orchestration**

* **AWS Step Functions**: nightly refresh (player → features → embedding → pro match).
* **Amazon EventBridge**: trigger after new matches or weekly cadence.

**App**

* **API Gateway + Lambda**: REST for user, shareable asset generation.
* **Amazon CloudFront**: CDN for images/videos.
* **Amazon QuickSight** (optional): internal analytics.

**Cost levers**

* Serverless + small batch windows; cache per-player embeddings; top-K results cached in DynamoDB; Bedrock **prompt compression** + short contexts (you control the narrative from your features rather than dumping raw logs).

---

# Output Formats (shareable & fresh) / 输出模版（可社交分享）

**1) Player→Pro Doppelgänger Card**

* **Header:** “You played most like **[ProName]** in **[Region]**”
* **Why:** 3 chips (e.g., “Early herald→plates conversion”, “2-3 skirmish preference”, “T-90s objective vision timing”).
* **One actionable difference:** “Your doppelgänger recalls ~25s earlier pre-dragon to hit a component spike; try syncing recall at 3:50 for first dragon setups.”
* **Visual:** mini heatmaps + a radar delta overlay vs the pro.

**2) Draft Notes IRL**

* “If teams scouted you, they’d 1st-ban: **Vex**/**Rell**/**J4**.”
* **Reason blurbs:** “Highest snowball chain after first kill at 7–10m; above-avg roam completion rate to bot at 8:30±30s.”

**3) Tilt Thermometer + Reset**

* “Tilt fingerprints: **late solo deaths near river**, pings spike by +38%.”
* “Your best reset recipe (from your own history): **5-minute break + ARAM warmup + disable enemy chat** → next session KDA +0.9.”

**4) Rivalry Poster**

* “You vs **[Friend]**: You control **tempo**, they anchor **vision**. Queue together for **Herald→plate plays** at 8:20.”

**5) Season Trailer (15–30s)**

* Auto-generate a vertical video with captions: biggest turnaround, most outrageous steal, fastest top dive into plates — **commentary-style voiceover** via Amazon Polly (optional).

---

# “Actionable Coaching” that isn’t generic / 非通用且落地的建议

We always tie a suggestion to a **gap vs. the matched pro**:

* **Recall Sync Tip:** “Your recalls before first dragon are **50s later** on average; copy **[Pro]**: recall after first crash, buy **[component]**, arrive T-30s with control ward. Try it next 3 games.”
* **Setup Sequencing:** “You place wards **T-10s** pre-objective; shift to **T-45s**, then sweep and step into river **T-20s** to deny setup.”
* **Skirmish Selectivity:** “Win-prob below 40%? You still take 3v4s. Your doppelgänger **skips** unless side wave is prepped. Add rule: ‘no contest if bot wave not pushed at T-60s’.”

---

# Minimal data schema / 最小数据结构

**S3/Parquet tables (Athena):**

* `matches(player_id, game_id, patch, role, champ, win, kda, cs10, xpd10, g10, plates, obj_seq[], deaths_timing[], vision_events[], fight_events[], recall_events[], wp_time_series[])`
* `embeddings(entity_id, type, region, patch_range, vector[128])`  // type in {player, pro, duo_pair}
* `explanations(game_id, key_event, summary, link)`  // optional clips/refs

---

# Core algorithms / 核心算法

* **Playstyle vector (player)** = PCA(metric-learn(standardized feature agg)).
* **Similarity** = cosine(top-K by role/region/patch bucket).
* **Threat vector** (ban-me list) = combine (champ winrate in comfort window, snowball chain length, early roam completion).
* **Tempo score** = f(gold/exp @10 → plates → herald/dragon timestamps).
* **Vision choreography score** = weighted events in **T-90..T+30** window.
* **Clutch index** = contribution deltas when WP<35% (needs a win-prob proxy from objective/kill/gold time series).

---

# Bedrock prompt scaffolds / 生成式提示骨架

**System:** “You are an esports analyst. Be concise, specific, and explain ‘why this works’ in one sentence. Avoid generic tips.”
**Context (structured):** `{ player_fingerprint: {...}, pro_match: {...}, deltas: {...}, next_best_action: {...}, meme_style: "LPL draft desk" }`
**User prompt:** “Explain to the player why they matched **[ProName]**, list 3 concrete habits to copy, and one drill for the next 3 games. Keep it under 120 words.”

---

# Example user flow / 交互流程

1. User selects **region** (or “surprise me”).
2. We compute embedding → fetch **Top-3 pro matches** with similarity justifications.
3. Show **Doppelgänger Card** + **Try-This-Week** drills (toggle: jungle/mid/support).
4. “Make it shareable” → one-tap export **poster/video**.
5. “Queue with a friend” → compute **complementarity** → recommend duo role and minute-by-minute checklist for first 10 minutes.

---

# Deliverables mapping / 与提交物的对应

* **Working app (public URL)**: Serverless web (API Gateway + Lambda + CloudFront), S3-hosted assets, Bedrock-powered copy.
* **Open-source repo** (MIT/Apache-2.0), with:

  * ETL scripts (Glue Jobs), embedding training (SageMaker), infra IaC (SAM/CDK).
  * “Fake player” seed + unit tests for feature extraction.
  * A Glue/Lambda **feature extractor** (Riot EoG JSON → Parquet).
  * A SageMaker **metric-learning** notebook scaffold.
  * A Bedrock **prompt pack** and **serverless API** skeleton.
* **3-min video**: shows fingerprint → pro match → poster generation.
* **Methodology write-up**: this doc distilled + ablations (e.g., with/without metric learning).
* **AWS Services Used**: S3, Glue, Athena, Lambda, Step Functions, OpenSearch Serverless (or Aurora+pgvector), SageMaker, Bedrock (text), Polly (narration), CloudFront.

