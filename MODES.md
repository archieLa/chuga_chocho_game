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
it himself.** Fading them is a rung of its own.

---

## Three levels

Every level is the same verb on the same screen. Nothing ever becomes a flashcard.

| level | roughly | the ask | what is new |
|---|---|---|---|
| 1 | 2.5–4.5 | close after **N cars** | counting at all |
| 2 | 4–5.5 | close after **N red cars** | a **filter** — ignoring what doesn't count |
| 3 | 5–6 | **two red and three blue** | two counters at once |

**Three, not five.** An earlier draft had five rungs; two of them were parameters
wearing a level's clothes. "Close after two" vs "close after five" is the same
game with a different N. "Pips shown" vs "pips hidden" is a display flag. Neither
earns a button in a settings panel, because a parent cannot tell them apart from
outside the code.

The three that remain share **one data shape** — a target is a list of
`{ colour, count }`:

```js
L1 → [{ colour: null,   count: 3 }]
L2 → [{ colour: 'red',  count: 2 }]
L3 → [{ colour: 'red',  count: 2 }, { colour: 'blue', count: 3 }]
```

Build that and all three fall out of one engine. Level 2 is already paid for:
`carpassed` carries `{ count, colour, key, dir }` and every car's colour has a
name in both dictionaries (BUILD_PLAN §11-I, done).

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
pattern). So all three levels share the same pieces:

- `"Let"` and `"cars go by, then close the gate"` — 2 new lines per language
- numbers 0–10 — **already recorded**
- colour names — **already recorded**, white included
- `"and"` — 1 new line

Three levels costs about **3–4 new lines per language**, not three scripts.
Levels 2 and 3 are nearly free once level 1 exists. That is the strongest
practical reason not to cap at two.

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
  stock. Whether claims are ever resettable is a later question; they are not
  in v1.

---

## Still open

- **DECIDED: the LEVEL is a parent's choice in ⚙️ and never moves by itself; N
  inside a level widens by itself.** What is still open is the exact trigger for
  widening — how many clean runs, and whether the pool ever narrows again (it
  should not; that is "taking something away").
- **How often does a task run in Game Mode?** Reading today: Free Play has no
  tasks ever, Game Mode means every visit carries one. If a task on *every* train
  makes the crossing feel like a test, the answer is a task per *place* rather
  than per train — decide after watching.
- **What does a claim feel like in the moment?** Praise and a sound exist
  (`CC.speech.praise()`). Whether the flag plants itself with a small animation
  on the map, or is simply found there next time, is unchosen.
- **What happens on a SECOND visit to a state already flagged?** Does it set a
  fresh task (nothing more to earn — is that flat?), or say "you've got this
  one" and fall back to free play in that scene? Nothing is decided, and it is
  the first thing that will come up in real use, because a child returns to
  favourites.
- **Does biasing the spawn colour need to stop when no task is live?** It should
  — Free Play traffic must stay uniform, or the road quietly changes character
  depending on a setting the child cannot see.
