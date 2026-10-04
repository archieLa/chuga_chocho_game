# Modes — Free Play and Game Mode

> **Status: the shape is DECIDED, the code is not written.** The decisions below
> are the maintainer's and should not be relitigated. What is still open is
> listed at the bottom, and those are real questions.

Free Play is the whole game today and it is enough for a two-to-four-year-old.
The worry it does not answer is **outgrowing**. Game Mode is the answer, and it
is a **maths** ladder — not a literacy one. See "Why maths and not words" below.

---

## The one good idea, and why it is good

**The gate is the answer.**

> Close the gate when five cars have gone past.

Most children's educational software bolts a quiz onto a game: tap the right
box, drag the number into the slot. That is a second interface, and a small
child has to learn it before they can show you what they know.

This does not. The child already knows how to press the gate — it is the first
thing they ever did here. The mode only asks them to press it **at the right
moment**. No new controls, no new screen, and the learning mode is the same game
rather than a different game wearing its clothes.

Anything proposed for this mode should be checked against that: *is the gate
still the answer?* If a proposal needs its own buttons, it is probably a
different product.

---

## Why maths and not words

The original sketch had three missions: counting, a letter hunt, and a
picture-word match. **The two word games are cut.** Two reasons, and the second
is the real one.

1. They are expensive — letters riding on wagons is new rolling-stock art, and
   the Polish set (Ą Ć Ę Ł Ń Ó Ś Ź Ż) needs its own word list and its own
   recorded letter names.
2. **They fail the gate test.** "Close when you see the word TRAIN" is a
   flashcard app whose button happens to look like a gate. Counting cars and
   closing is genuinely gate-shaped: the thing being counted is the thing going
   past, and the gate is what acts on it. That is not true of a word.

Maths also lands squarely where the game's audience actually is:

| age | roughly what is there |
|---|---|
| 2–3 | "one two three" as a **rhyme**, not counting. Subitizing 1–2 — seeing *two* without counting. |
| 3–4 | **One-to-one correspondence** — one number per object. Reciting ≠ counting; this is the real jump. |
| 4–5 | **Cardinality** — the last number you said *is* the answer. Ask "how many?" and get "five" instead of a recount. |
| 5–6 | Adding and subtracting within 5–10 with objects or fingers. |

**Cardinality is the load-bearing one**, because "close the gate after five cars"
*is* a cardinality task. A three-year-old can count along with the cars and still
not hold *I have now seen five* as a state he can act on.

That is why the progress display is **countable objects, not a numeral** — and
why that is not decoration. **The pips do the cardinality for him until he can do
it himself.** Fading them as he gets steadier is a dial inside a level, not a
level of its own — see "Why five levels" below.

---

## Five levels

Every level is the same verb on the same screen. Nothing ever becomes a flashcard.

| level | roughly | the ask | what is new |
|---|---|---|---|
| 1 | 2.5–4.5 | close after **N cars** | counting at all |
| 2 | 4–5.5 | close after **N red cars** | a **filter** — ignoring what doesn't count |
| 3 | 5–6 | **two red and three blue** | two counters at once |
| 4 | 5–6 | **`2 + 3 = 5`** → close after 5 | **numerals**; the sum made concrete |
| 5 | 5.5–6.5 | **`2 + 3 = ?`** → close after the answer | computing it yourself |

Levels 1–3 share **one data shape** — a target is a list of `{ colour, count }`:

```js
L1 → [{ colour: null,   count: 3 }]
L2 → [{ colour: 'red',  count: 2 }]
L3 → [{ colour: 'red',  count: 2 }, { colour: 'blue', count: 3 }]
```

Levels 4 and 5 reuse it: the equation only decides `count`, and the counting
phase is level 1 underneath. Level 2 is already paid for — `carpassed` carries
`{ count, colour, key, dir }` and every colour has a name in both dictionaries
(BUILD_PLAN §11-I, done).

### Why five levels, when an earlier draft argued for three

Both are the same test, honestly applied, with opposite answers. The draft's
five rungs collapsed to three because two of them were **parameters wearing a
level's clothes**: "close after two" vs "close after five" is one game with a
different N, and "pips hidden" is a display flag. Neither is visible from outside
the code, so neither earns a button in a parent-facing list.

Levels 4 and 5 are not that. **"Sum shown" vs "solve it yourself" is a real
cognitive difference a parent can see and act on**, so it earns its own row. The
rule is not *keep the list short* — it is *never ask a parent to distinguish two
things that are the same game*.

### Why arithmetic sits ABOVE the colour levels

Not because the addition is harder than tracking two colours — it may not be.
Because `2 + 3` is the **first symbolic thing in the entire game.** Everything
before it is concrete: cars, pips, colours, spoken words. Reading a numeral is
its own threshold (4–5) and independent of the arithmetic.

It must therefore also be **spoken** — "two plus three" — per hard rule #5. The
equation is never only a symbol on the screen.

### Level 4 is the best idea in the ladder, and the reason is the cars

`2 + 3 = 5`, then count five cars past the crossing, is **not level 1 with
decoration**. The cars are the **manipulative**. Children learn addition with
objects, and this scene emits countable objects on a 1.5-second timer. He does
not get told that 2 + 3 is 5; he *experiences* five. Do not optimise this into a
numeral on a banner.

### Level 5 needs a rescue, or it breaks rule #4

Levels 1–4 all fail gently: a child who does not understand still sees cars and
can still press the gate, and the world answers him either way. **Level 5 does
not.** If he cannot solve `2 + 3 = ?` he does not know what to *attempt* — stuck
before he starts, which is a worse kind of stuck than missing a count.

So: **after about fifteen seconds, or a few cars, the answer quietly appears** and
level 5 degrades into level 4. He is never blocked; he is helped. No sound, no
comment, nothing that marks it as a failure — the number simply completes itself.

**Keep sums within 10.** Wait time is not the constraint here (ten cars is ~16s),
developmental order is: within 5 first, then within 10.

---

## The target must VARY — and that is where the trap is

A level is not one task repeated. "Close after two cars" every single time is a
party trick, not counting. **N varies, and in level 2 the colour varies too.**

### Use the bag, not `Math.random()`

`world.drawRandom()` already solved this exact problem for locations, and the
reason in CLAUDE.md applies verbatim: *a plain random pick hands a child Chicago
four times before it ever shows them Denali.* Same for targets. Draw them
**without replacement** from a bag per level, refill when empty. Otherwise he
gets "two cars" three runs in a row and the varying is invisible.

### The pool widens; it does not jump

Early level 1 draws from `{2, 3}`. After a few clean runs it becomes
`{2, 3, 4, 5}`. This is the **"N advances by itself, the level never does"**
principle doing real work: a two-and-a-half-year-old is never handed five on his
first go, and nobody has to open Settings for him to grow.

### MEASURED: why level 2 cannot reuse level 1's numbers

Cars spawn on a **global 1.5s timer** (`scene.js`, `carTimer > 1500`) — it is not
per-scene. Measured over a minute each: Colorado 37/min, Denali 37, Detroit 35,
NYC 36. Colours are near-uniform across the seven, so **any one colour arrives
about every 11 seconds**:

| ask | expected wait |
|---|---|
| L1 — five cars, any colour | **~8s** ✅ |
| L2 — two red | ~23s |
| L2 — three red | ~34s |
| L2 — five red | **~57s** ❌ |
| L3 — two red *and* three blue | ~35–45s ❌ |

Level 1 can range freely over 2–5. **Level 2 and 3 cannot**, and the failure is
not "too hard" — it is *tedium*, which a three-year-old reads as **the game is
broken**.

**The fix: bias the spawn toward the live target's colour** — roughly one car in
three instead of one in seven. Three red then takes ~15s, and distractors still
outnumber targets two to one, so the filtering skill is genuinely exercised. A
few lines in `newCar()`. The alternative — permanently smaller N in the colour
levels — makes the harder levels carry the easier numbers, which is backwards.

**The bias stops dead in Free Play.** The spawn is skewed only while a task is
actually live. Otherwise the road quietly changes character depending on a
setting the child can neither see nor have chosen — and Free Play is not
supposed to know Game Mode exists.

*(An earlier draft also justified biasing as insurance against sparse scenes.
That reason is void: the four measurements above show there are no sparse
scenes. It stands on wait time alone.)*

### Two rules on which target gets drawn

- **Level 3 must exclude confusable pairs.** "Two red and three orange" is unfair
  at this age; so is blue/purple. The two colours need to be far apart in hue.
- **Watch white.** White cars on grey tarmac at distance are the hardest of the
  seven to pick out. Fine as traffic, questionable as the thing you are *asked*
  to count. Decide by watching, once it is playable.

### The voice cost stays flat

`speech.say()` queues, so prompts are spoken as **atoms in sequence**, never
concatenated (CLAUDE.md is emphatic; `customizer.js`'s `saySlot()` is the
pattern). So all five levels share the same pieces:

- `"Let"` and `"cars go by, then close the gate"` — 2 new lines per language
- numbers 0–10 — **already recorded**
- colour names — **already recorded**, white included
- `"and"` — 1 new line
- `"plus"` and `"equals"`, for levels 4–5 — 2 new lines

All five levels cost about **5–6 new lines per language**, not five scripts.
Levels 2–5 are nearly free once level 1 exists. That is the strongest practical
reason not to cap the ladder short.

---

## The two modes, and the counter that changes meaning

**The mode toggle lives in ⚙️ Settings, not the topbar.** Two reasons: the topbar
is already 🗺️ 🚆 ⚙️ and a fourth button is tight on a phone held sideways; and it
makes the mode a **grown-up's choice**, so a child cannot flip himself into a
test by fumbling. Turning Game Mode on **reveals a level row underneath it** —
progressive disclosure, so Free Play users never see a difficulty setting at all.

The map's `/55` chip **changes meaning with the mode**, and that is the point —
there is never more than one number on screen, because only one mode is live:

| mode | the chip counts | stored as |
|---|---|---|
| Free Play | places **chance** has taken you — the surprise bag, as today | `cc.drawn` |
| Game Mode | places where the task was **completed** | `cc.claimed` |

**The bag keeps filling in Game Mode.** A surprise draw is still where chance
took you; it is simply not what is displayed. `drawRandom()` is untouched, and
`select()` still stays out of the bag (CLAUDE.md is emphatic about this).

**Make the chip look like a different object, not just a different number.**
Switching modes makes the figure jump — 12 down to 3 — and at four years old that
reads as *I lost my things*. Free Play keeps 🎲; Game Mode gets its own icon and
colour. If the container changes, the number plainly belongs to something else.
This is cheap and it defuses the whole problem.

---

## Claiming: the flag on the map

A completed state flies a **US flag** on the map. That is the souvenir, and it is
the only record of achievement in the game.

**A gold star was considered and rejected — but not on difficulty.** Both were
rendered on the real map at real label positions in a game-sized viewport, and
the flag is perfectly legible at ~11px: the canton and stripes read clearly. All
four traps below apply identically to a star, so the two cost the same. The flag
wins on meaning: the game already has a stars-and-stripes vocabulary — it is the
`flag` **livery a child can paint onto their own engine** — so a flag earned on
the map rhymes with the flag on their train. A gold star says *you did a task*;
the flag says *you were there*. (A star does scan marginally faster, gold on
green being higher contrast. Not enough to outweigh the rhyme, and the mark is
the cheapest thing in this whole design to change later — the claim data and
every trap are identical.)

**Claiming ADDS, it never gates.** Every place stays open, always, in both modes.
A child who just wants to press the gate today is never locked out of anywhere,
and a bad day never costs him Denali.

### Four traps, all of them found before writing any code

1. **`.cc-livery` and friends are RESERVED for rolling stock.** The flag artwork
   already exists as a livery on the trains, and reaching for those class names
   here would be the Medora-surrey bug again: `querySelector('.cc-livery')`
   inside a mounted asset could find the map's flag. Give it its own name —
   `.state-flag` — and do not borrow `data-livery` either.

2. **Put the flag on the LABEL, not the shape.** Nine states are unhittably
   small at national scale (DC is 3×4px) and live in the margin `COLUMN` with
   leader lines and chips. A flag on DC's outline is invisible. But **all 51
   states already have a label**, already positioned correctly — column ones
   included — and already scaling with the map. Anchor to that and one mechanism
   serves Texas and DC alike.
   **Blocker:** the labels carry no `data-name` today, only their abbreviation
   text and an x/y. Add `data-name` to the `<text class="lbl">` in
   `tools/gen-map.js` and re-run it. One line, but it must happen first.
   **The column needs its own placement.** In the test render, a flag set at a
   naive `x + 16` collided with the Massachusetts label. There is room — the
   column chips are 66px wide and the flag is ~18px — but the margin states need
   the mark placed against the chip, not nudged off the text. Budget five minutes
   for it rather than being surprised.

3. **Gold is taken.** `#ffd166` is `.state--picked` — the state you just tapped —
   and `.state--said` is `#9ec9e8`. A "turns gold when complete" would collide
   with the selection highlight, and the collision is the *common* case, because
   you are standing in a state at the moment you earn it. A flag **overlay**
   composes with both fills; another fill does not. That is the second reason to
   draw it rather than recolour.

4. **The specificity trap applies.** `us-map.svg` carries its own `<style>` block
   which lands after `styles.css`, so a new `.state--claimed` will lose exactly
   the way `.state--picked` did. Write `#us-map .state.state--claimed`. See the
   comment at `play/css/styles.css:253`.

### Souvenir, not a progress bar

Beyond the mode chip, **show no "N of 55 claimed" anywhere else, and never list
the incomplete ones.** The moment a child can see what is missing, 47 un-flagged
states become homework — the exact failure this document exists to avoid. He will
notice the map filling up on its own, which is the good version of the feeling.

### A flag NEVER unlocks anything

Finishing the map gets a celebration and a full map. **It does not open any
content, and nothing in this game is ever withheld pending an achievement.**

This game has **zero locked content** today, literally — there is no lock,
unlock, earn or achievement concept anywhere in the code. All 55 places are
reachable from the first minute, as are all 19 vehicles, all 7 colours and the
one livery. The flags are the first record of achievement the game has ever had,
and they are a **record, not a key**.

A cosmetic unlock (a special livery for completing the map) was considered and
**rejected**, for three reasons that compound:

1. **It turns the souvenir back into a progress bar.** The section above exists
   because a visible "what's missing" becomes homework. A prize at the end
   reintroduces exactly that pressure from the other direction — it makes
   *finishing* matter, and the flags stop being a record of where he has been.
2. **Per-level flags make "completing the map" ambiguous.** Level 1's 55? Then a
   three-year-old takes the prize and levels 2–5 have nothing. All five levels?
   That is 275 completions. One livery per level? That is a five-tier grind.
3. **It introduces the first "no" into a game built on "yes."** A child who has
   not finished would now know there is a thing he cannot have.

**If a new livery is ever worth drawing, ship it to everybody.** A good livery is
a nice thing to have at three years old on day one; it is better used than
withheld.

### Second visits: ALWAYS set a task

A state that already flies a flag still gets a fresh task, every single time.
Never "you have this one already, here is Free Play instead."

The reasoning is already in `CLAUDE.md`, about the surprise bag: *a favourite can
be visited every day without the dice using it up.* This is the same question in
a different costume and it gets the same answer — **a revisit must feel exactly
as good as the first time.**

The alternative — no task where the flag already flies — would make his favourite
place the **least** game-like place in the game. He goes to Colorado, which he
loves, and Colorado is the one spot with nothing to do. That quietly pushes him
toward unvisited states to find the game, which is the completionist sweep this
document is written against, and it punishes affection.

**The revisit is already fresh for free**, because targets come from the bag — a
different number and a different colour than last time. Novelty is a consequence
of a decision already made, not something to invent.

**And nothing about a miss is ever persisted.** A state he tried and did not
finish looks identical to one he has never seen: no half-flag, no "attempted"
marker, no record of the attempt. Same rule, same reason.

---

## Claims belong to the LEVEL, not to the child

`cc.claimed` is keyed by level: `{ "1": [ids…], "2": [ids…] }`. The map shows the
**current level's** flags and the chip reads that level's `N/55`.

**This is what replaces a "reset the flags" button.** Switching to level 2 in ⚙️
gives a fresh map automatically — which is the thing a parent actually wants when
they move the dial — with no destructive control, no confirmation dialog, and no
way to lose anything by mis-tapping. Drop back to level 1 and his old flags are
all still there, exactly as he left them.

It also keeps "the game never revokes a flag" **literally** true. The only thing
that ever clears anything is a parent, deliberately.

**This is not the tiered flag that was rejected above.** That was about the map
*displaying* bronze/silver/gold, turning one board into a grind ladder. Here each
level has its own clean binary board and only one is ever visible.

**The hazard, and it is real:** from the child's side, switching level makes his
flags vanish — the same "I lost my things" problem as the mode chip. The
difference is that it is recoverable and it is a knowing parental act. The ⚙️ row
must say so plainly; it is parent-facing text, so it can be a whole sentence:
*"Level 2 starts a fresh map. Level 1's flags are kept."*

The mental model to hold: **each level is its own journey across the map.**

### Protect the controls that clear the board

Two controls can empty a map in one press — the level switch, and **"Start this
level again"** (which clears only the current level, never all five). Both need a
**parent gate**, and `⚙️ reset train` is NOT the precedent to copy: it fires
immediately with no confirmation (`settings.js:149`), which is fine for a train
that takes ten seconds to rebuild and wrong for forty flags.

**Hold to confirm — press and hold for three seconds.** No reading, no locale
problem, works on touch, and a toddler will not sustain it. One mechanism covers
both controls.

**Museum mode is not protected this way at all** — it is a URL, which a child in
a kiosk browser cannot reach. See `DESIGN.md` §14.

---

## Celebrations

### Completing a state: the train comes

He closed the gate at the right moment, so the crossing does the thing a crossing
is **for** — a train, immediately, with the whistle. Plus `CC.speech.praise()`,
which already exists in both languages.

**The principle: the celebration is the game working, not a cutscene bolted onto
it.** Confetti is generic and says nothing. A train arriving *because you
operated the crossing correctly* is the entire thesis of this game in one beat.

`whistle()`, `chuff()`, `honk()`, `blip()` and `ding()` all exist in `audio.js`,
so this needs no new sound.

Then the flag plants itself **in the scene** — on a pole by the crossing — so the
reward happens where he is. He finds it on the map afterwards, which is the right
separation: **the souvenir lives in the trophy cabinet, the game lives in the
scene.**

### Completing the map: warm, not fireworks

The map itself celebrates — flags rippling in sequence across the country, the
train running over the map, praise in his language. It should feel like the end
of a good day, not a boss defeat.

**And then nothing is taken and nothing is opened** (see "A flag NEVER unlocks
anything"). The permanent full map is the keepsake.

---

## Hard rule #4 still wins

A timing challenge has an inherent fail state. The rule survives because:

- **Failure costs nothing but another go.** No lives, no timer, no score, no sad
  noise, nothing red.
- **The world supplies infinite retries by itself.** Miss five cars and five more
  are along in a minute. He has not failed; he has not done it *yet*.
- **Once flagged, always flagged.** A claim is **never revoked and never
  expires.** "Not yet earned" is fine at any age; "you had it and lost it" is
  precisely what this rule exists to prevent.
- **⚙️ "reset train" must not touch `cc.claimed`.** That button is about rolling
  stock. Claims are cleared only by a parent, deliberately, behind a hold — see
  "Claims belong to the LEVEL".

---

## Still open

Settled, for reference: the LEVEL is a parent's choice in ⚙️ and never moves by
itself; N inside a level widens by itself and never narrows. What remains:

- **The exact widening trigger.** How many clean runs before level 1's pool goes
  from `{2,3}` to `{2,3,4,5}` — three, five? Consecutive or cumulative? And does
  the widening survive a session? At home it probably should; in a museum it
  deliberately does not, so every child gets the gentle opening.
- **How often does a task run in Game Mode?** Reading today: Free Play has no
  tasks ever, Game Mode means every visit carries one. If a task on *every* train
  makes the crossing feel like a test, the answer is a task per *place* rather
  than per train — decide after watching.
- **Does the whole-map celebration need a trigger guard?** With per-level claims
  it fires once per level, which is probably right, but nobody has watched it
  happen yet.
