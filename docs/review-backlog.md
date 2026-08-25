# Review backlog — 2026-08-25

Findings from a Codex per-lesson review of all 49 lessons, adjudicated by six independent
verifier agents and spot-checked by hand. **Everything listed here is CONFIRMED REAL and
still unfixed.** False positives and already-fixed items have been removed.

## How this list was produced (so you can trust or re-derive it)

1. `codex exec --sandbox read-only` run once per lesson, scoped to that lesson's 4 pages,
   capped at 8 file reads — 49 runs, none died.
2. Raw output: 82 HIGH / 45 MEDIUM / 125 LOW. That count is **inflated**: 158 findings were
   one systemic `data-i18n-aria` issue counted per page, and some transcripts repeat their
   report twice. Deduplicated to 112 non-aria HIGH/MEDIUM findings.
3. Those 112 were split across six verifier agents told to adjudicate, not fix.
   Result: ~67 real, ~30 false, a handful unsure.
4. 34 were fixed on 2026-08-25 (see git log). The rest are below.

**Two systematic false-positive classes to ignore if you re-run the review:**
- *"`parents.html` is missing"* on a grade-5 lesson. 19 grade-5 lessons predate the
  four-page spec; `teaching-framework.md` §六之一 records them as 待補. Only `big-units`,
  `fraction-divide`, `prisms`, `rounding` have the fourth page.
- *"equal-value options"* in the three whitelisted cases from §六之二 (odd-one-out questions,
  notation-is-the-lesson questions, and stems that already say 「記得約分」).

---

## Wrong or misleading content

| Lesson | File | What is wrong | What it should be |
|---|---|---|---|
| `grade-5/big-units` | `review.html` ~377 | `multiplierCheck` keys `100` for 公畝→公頃 | 1 公畝 = 0.01 公頃 — key `0.01` |
| `grade-5/big-units` | `index.html` ~259 | Lead text says 往上一階「× 100」 | Should be `÷ 100`; contradicts its own `ladderUpBtn` two lines later |
| `grade-5/decimal` | `reference.html` ~106 | 「商的小數位數不變」 | Contradicted by the next line (append zeros and keep dividing): 1.2÷8 = 0.15 goes 1dp→2dp |
| `grade-5/prisms` | `reference.html` ~95 | 「圓錐尖端不算正式頂點」 | Taiwan curriculum counts the cone's apex as 頂點. State 「1 個（圓錐尖端）」 |
| `grade-5/multiple` | `index.html` ~404 | Options include `54`, the stem's own stated boundary (「45 和 54 之間」) | Replace `54` with e.g. `50` |
| `grade-5/fraction-multiply` | `reference.html` ~135/175 | 假分數 labelled 「比 1 大」 | Excludes `n/n`; should be 「大於或等於 1」 |
| `grade-5/common-factor` | `index.html` ~221 | Orange arc spans x=50→470 (a jump of 12) but is captioned `+6` | Relabel 「+12（兩次各跳 6 格）」, or split into two +6 arcs |
| `grade-5/symmetry` | `index.html` (zh ~489 / en ~614) | `gClear` promises 「+20 分」 but the code only ever does `gScore += 10` | Either award 20 or change the text to +10 |
| `grade-3/multiply` | `parents.html` ~198 | English says "at least 2 out of 3 quiz questions"; Chinese says 「≥ 2/3」 (a proportion) | Quizzes are 6/10/12 questions — English gives parents a far too low bar |
| `grade-3/length` | `parents.html` ~115 | Tells the parent to "count ladder boxes" to explain why m→cm is ×100 but cm→mm is ×10 | Both are one adjacent step; point at the factor itself, not the step count |
| `grade-1/add-sub` | `parents.html` ~154 | 「5 人／已擺 3 副／還差幾副」 is a missing-addend problem but labelled 拿走／比較 practice | Relabel as 「還差多少」 (missing addend) |

## Ambiguous questions (a correct child can be marked wrong)

| Lesson | File | Problem | Suggested fix |
|---|---|---|---|
| `grade-5/statistics` | `index.html` ~723 | 「全班最喜歡的顏色」 keys only 長條圖 while offering 圓餅圖 — a pie chart is legitimate for whole-class proportion data | Reword stem to 「根據本課教的三種圖表」, or accept pie |
| `grade-5/statistics` | `review.html` ~175/543 | `chooseType` generator has the same pie ambiguity | Same fix, in the generator |
| `grade-5/statistics` | `index.html` ~1259 | `computeDiff` picks `i1`/`i2` with no order constraint, but the prompt always reads 「A 比 B 多多少」 while keying `abs()` | Force `i1` to the larger value, or use neutral 「相差多少」 |
| `grade-5/polygon` | `review.html` ~305 | `sectorFraction` offers the unreduced `deg/360` alongside the reduced key (90 → `1/4` vs `90/360`) | Add 「答案要化到最簡」 to the stem, or drop the candidate |
| `grade-5/fraction-multiply` | `review.html` | `mixedXint`, `areaModel`, `fracAdd` each have an entry where a distractor equals the key (`6`≡`12/2`, `1/2`≡`6/12`, `2/3`≡`4/6`) and the stem does not say 「記得約分」 | Add 「（記得約分）」 to those three stems, or swap the distractors |
| `grade-5/decimal` | `review.html` ~382 | `fracAddSimple` 1/3+1/6 keys `1/2` while offering `3/6` | Replace `3/6`, or require simplest form in the stem |
| `grade-5/rounding` | `review.html` ~272 | `makeWrongs` dedupes by exact string, so `roundDecimalStr(n,0)` can yield a wrong option numerically equal to the key (8.95 → key `9.0`, wrong `9`) | Dedupe with `parseFloat(a) === parseFloat(b)` |
| `grade-5/symmetry` | `review.html` ~362, ~389 | `angleTriangle` wrongs `[a+b, c+10, c-10]` and `angleQuad` `[a, d4+10, d4-10]` are filtered against the key but not each other, so two buttons can show the same number | Dedupe wrongs by value before `mixOpts` |
| `grade-3/time` | game `ROUNDS` ~311 | `{h:0, m:270}` renders as plain 「270 分」 and is marked wrong against 「4 時 30 分」, but 270 分 is a valid normalisation — unlike the deliberate 「0時75分」 traps it carries no `f:true` flag | Add the flag and confirm intent, or accept 270 分 |

## Broken or misleading pictures

| Lesson | File | Problem | Suggested fix |
|---|---|---|---|
| `grade-5/solid` | `index.html` ~1018 | `drawSurfaceNet` puts the top face at `y0 - ww` with `y0 = 6 + hh`; shipped preset `{l:5,w:3,h:2}` gives `y = -8`, clipped by the viewBox | `y0 = 6 + Math.max(hh, ww)` and grow `totalH` |
| `grade-5/solid` | `reference.html` ~124 | Mnemonic says look for 「一直排 4 個」 but the first net rendered on that page (`VALID_NETS[0]`) has a maximum run of 3 | Show a run-of-4 net first, or caveat the mnemonic |
| `grade-5/fraction-divide` | `reference.html` ~64 | `.barrow` cells are a fixed 26px, so a 3-of-8 shaded region renders the same width as 3-of-4 — the picture fails to show the halving the lesson teaches | Cell width inversely proportional to segment count (`208px / segments`) |
| `grade-5/statistics` | `reference.html` ~236 | The chart-anatomy list names 「⑤ 圖例」 but `buildAnatomy()` renders a single-series bar chart with no legend | Drop the callout, or render a two-series chart |
| `grade-3/fraction` | `index.html` ~794 | `makePie()` draws all `n` sector lines regardless of shaded count, so the "before we cut" cake already appears sliced — contradicting its own caption | Draw one undivided circle when `!warmCut` |
| `grade-3/divide` | `index.html` ~868 | `#longdivBox` is plain text in a `white-space:pre` div — no division bracket, quotient digits never positioned | Draw a real long-division layout |
| `grade-3/angle` | `review.html` ~205 | `overlaySVG` draws ray A orange and ray B green with no letter labels and no legend, yet the stem asks "which is bigger, A or B" | Label the rays |
| `grade-3/rectangle` | `review.html` ~439 | `paraPts` x-extent reaches `cx ± (halfW + slant)`; max 69+44 = 113 exceeds the viewBox radius 110 | Cap `halfW + slant ≤ ~85` |

## Code defects

| Lesson | File | Problem | Suggested fix |
|---|---|---|---|
| `grade-3/length` | `index.html` ~964 | `renderLadder()` always calls `ladderEqDown()` (×). A correct `ladderEqUp()` (÷) exists at ~494 and is never called | Call `ladderEqUp()` when the step was ▲ |
| `grade-3/multiply` | `index.html` ~1039 | Toggle handler uses `s3narr.innerHTML` but `renderAll()` uses `.textContent`, exposing literal `<strong>` markup; `applyStatic()` also resets the button label to "Show" on every re-render while the table stays visible | Use `innerHTML` in both; restore the label from `s3shown` |
| `grade-5/common-factor` | `index.html` ~834 | After the final round is won, remaining wrong buttons stay clickable and can dock score or overwrite the win message | Disable the grid once `foundCount === needCount` on the last round |
| `grade-5/area` | `review.html` ~372 | `angleMissing`'s retry loop gives up after 30 tries and keeps the last draw, which can have `a + b ≥ 180` → a third angle ≤ 0° | On bailout, fall back to a fixed safe pair |
| `grade-3/fraction` | `review.html` ~291 | `mixTextOpts` fallback yields a literal `"2/4·2"` when `addSameDen` draws `a = b = 1, n = 4` | Replace the fallback with a real distractor |
| `grade-3/fraction` | `review.html` ~211 | `randUnequalAngles` fallback returns a length-4 array regardless of `n` (3 or 5) | Return an `n`-length array |
| `grade-3/fraction` | `index.html` ~1217 | Round `{d:4, ladderOther:8}` calls `gHint2Bigger(1, 1, round.d)`, producing the literal hint 「1/4 和 1/4」 | Pass `round.d` and `round.ladderOther` |
| `grade-5/statistics` | `index.html` ~463 | `.chart-point` circles have a mouse click handler only — no `tabindex`, no keydown, no focus style | Add `role="button"`, `tabindex="0"`, Enter/Space handler (see `grade-3/table` for the pattern already used) |

## Judgment calls left open

- `grade-3/capacity` 「倒進去的量一樣多，容量就一樣多」 conflates poured amount with container
  capacity. Matches standard grade-3 curriculum wording; no worked example exposes it.
  Two verifiers marked this UNSURE.
- `grade-1/shapes` "two equal right triangles make a square" holds only for isosceles right
  triangles. Every triangle actually drawn is isosceles, so nothing on screen contradicts
  it — but the wording generalises further than the pictures justify.
- `grade-5/solid` 「錯開一格」 (`review.html` ~337) is ambiguous: a 1-column offset gives an
  invalid 2×2 block, a 2-column offset gives a valid S-hexomino. The code looks right; only
  the prose is unclear.

## Verification tooling worth rebuilding

The checkers used in that session lived in a session scratchpad and are gone. Each caught
defects the others could not:

- **key binding** — every `data-i18n` / `data-i18n-aria` key exists in *both* dicts. Catches
  a key missing from both, which zh/en parity cannot see.
- **CJK leak** — no Chinese text node outside a `data-i18n` element, judged with a tag stack
  so nested `<strong>`/`<br>` inside a translated parent is not a false positive. Void
  elements (`<br>`, `<img>`) must not be pushed onto the stack — that bug hid 19 real leaks
  from one agent's own checker.
- **equal-value options** — compare option values as rationals **including units** (`1 公克`
  and `1 公斤` are not equal), across quiz banks *and* game `ROUNDS`. Checking only the banks
  misses a whole class of bug.
- **English-dict scan** — Chinese left inside `I18N.en`. Note `en.btn` is legitimately `中`.
- **browser sweep** — load every page in a real browser, toggle language, click all modes,
  answer every quiz item, play the game, collect console errors. This is what found the
  `data-i18n-aria` handler missing from 135 pages; static analysis had passed them all.
  Test `reference.html`, `review.html` and `parents.html` too, not just `index.html` — that
  omission is exactly why the 135-page bug survived the first sweep.
