# Modes — the challenge idea, at sketch level

> **Nothing here is committed.** This is a place to keep a good idea from
> evaporating, not a plan. No code should be written against it until the
> maintainer says so, and the open questions at the bottom are real questions.

Free Play is the whole game today and it is enough for a two-to-four-year-old.
The worry it does not answer is **outgrowing**: the loop is press the gate and
watch the train, and a five-year-old will exhaust that. A challenge mode is the
candidate answer.

---

## The one good idea, and why it is good

**The gate is the answer.**

> Close the gate when five cars have gone past.
> Close the gate when the word TRAIN appears.

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

## The ladder is the point

The two examples above are roughly two years apart, and that gap is the whole
argument. The same verb, on the same screen, at a harder rung:

| rung | roughly | the ask |
|---|---|---|
| 1 | 2–3 | close the gate when the train comes — this is Free Play |
| 2 | 3–4 | close it when **five** cars have gone past |
| 3 | 4 | close it when you hear **seven** |
| 4 | 4–5 | close it when you see the digit **7** |
| 5 | 5–6 | close it when you see the **word** |

You do not need a different game at five. You need a harder rung.

`i18n.js` already carries `numbers` (0–10, both languages), `shapes` and
`praise`, and `modes.js` is a registry with `register()` and one entry. The
scaffolding was left in place for exactly this.

---

## The hard constraint: hard rule #4 says NO LOSING

A timing challenge has an inherent fail state — you either pressed it at the
right moment or you did not. That is in tension with the rule, and the rule
wins. The way it survives:

- **Failure costs nothing but another go.** No lives, no timer, no score, no sad
  noise, nothing red.
- **The world supplies infinite retries by itself.** Miss five cars and five more
  are along in a minute. The child has not failed; they have not done it *yet*.
- **Nothing is ever taken away.** No streak to break, no progress to lose.

If a mechanic cannot be built inside that, it does not go in.

---

## Claiming should ADD, never gate

"Solve it to claim the location" is a strong hook, but gating is the wrong shape
of it, for two reasons:

1. **A bad day would mean no Denali.** A child who just wants to press the gate
   today should never be locked out of anywhere.
2. **It would break the surprise bag**, which draws from all 41 places and is one
   of the better things in the game.

So: every place stays open, always. Claiming *adds* — the state turns gold on the
map, or takes a stamp, or a flag. That gives two independent records of progress,
and they mean genuinely different things:

- **the bag** (`cc.drawn`) — where **chance** has taken you
- **claims** — where you have **earned** it

Collection beats gating at this age anyway, and it costs nothing in goodwill on
the days he only wants the train.

---

## Sequencing

This mode needs a lot of spoken lines: the instruction for each rung, the
numbers, the praise. **Do not record it before the voice is settled** — see
`VOICE.md` — or it gets recorded twice. At minimum, choose the voice first.

---

## Open — and genuinely open

- **Is this even the right answer to outgrowing?** The alternative is that the
  game is simply *for* two-to-fours, ships as that, and is allowed to be finished.
  That is a respectable answer and should not be dismissed to make room for a
  bigger one.
- **Who picks the rung** — the child, a parent in settings, or the game, quietly,
  from how they are doing?
- **Does a rung interrupt Free Play, or is it a separate mode you enter?** The
  first keeps one game; the second is easier to leave alone.
- **How often?** A challenge on every train would make the crossing a test. Once
  in a while is probably the whole difference between a game and homework.
