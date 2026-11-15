# The help chat

Date: 2026-11-15. Status: **written for the Owner; not yet approved.** Nothing here is built or planned until the Owner says so. It was asked for by the texts design (`2026-11-15-texts-not-email-design.md`, "Not in this": "The AI help chat itself: what it can answer, when a person takes over, and what it may see. It needs its own short design.") and builds on it.

Principles served: the drunk-grandma test (help is one text away, in plain words, with one link), privacy by default (the chat sees as little as it can, and a text alone never opens an account), and "don't overengineer" (one bot that answers and points; a person does everything else).

## Why

Owner, 2026-11-15: "Reconsider the AI chat, I almost never want to use email here; text only almost exclusively". The texts design then settled that help is by text and that the AI help chat is in for launch. Until it is built, any text to Ruken's account number gets one fixed reply.

Owner, 2026-11-15, on how it should feel: "Users should be able to text back and forth like it's an AI chatbot, but it should feel like a real prson".

## Goals

- A person with a question texts Ruken's account number, or opens Help on the site, and gets a short true answer with one link to where they do the thing.
- It is a conversation: a person texts back and forth, the chat remembers what was already said, and it reads like texting a friendly person at Ruken.
- A person who needs a person gets one, and is told when to expect them.
- The chat never says something about Ruken that is not true, never changes an account, and never learns more about a person than the answer needs.

## Not in this

- Calls, pictures, WhatsApp, or a chat inside a game.
- The chat starting a conversation. It only answers.
- Selling anything.
- Doing things for a person (cancelling, refunding, resetting, deleting). It points to the screen that does it.

## What would make it a failure even if it works

- An answer that invents a price, a date, a rule or a promise.
- A stranger who learns anything about someone's account by texting from, or pretending to text from, their number.
- The chat asking for a password or a code, or anyone getting into an account through it.
- A person in trouble (locked out, charged wrongly, unsafe) stuck talking to a bot.
- A person who asks "are you a real person?" and is told yes, or is left unsure.
- Replies that read like a form letter or a phone menu.

## How it works

### Where it is

- **By text:** any text to the account number that is not STOP, START or HELP. Ruken is open only where a person can text it back (the texts plan, Question 1), so this works in every open country.
- **On the site:** `/help`, the same chat on a page, open to anyone, signed in or not. It is where someone who texted STOP still gets help, and where "No code? Get help" on the forgot-password screen leads.

### How it talks

- **Back and forth.** Each text gets one reply. The chat reads the earlier messages of the same chat before it answers, so nobody repeats themselves. A chat is one number's messages until a day passes with none; the next text starts a new chat.
- **Like a person.** Short, warm, everyday words, the way a helpful person at a small company texts. It answers the question asked first. It says "I" and "we". It can say sorry, thanks and "one sec". No menus ("Reply 1 for…"), no ticket numbers, no "your request has been received", no exclamation marks in a row, no emoji unless the person used one first. It matches the person's language when it is one Ruken's site is in, else answers in English.
- **Its character.** Owner, 2026-11-15: "sound warm and human, but like an intern that got a job out of their league, but being chill about it". So: relaxed, a little modest, never stiff and never flustered. When it does not know, it says so easily ("Hm, not sure on that one. Want me to get a person?") and does not bluff. It is never jokey about money, a locked account, safety or a child's account: there it is plain and careful. The character changes how it sounds, never what is true: it still answers only from the help pages.
- **Honest about what it is.** Owner, 2026-11-15, on a card: it says it is an AI "Only when asked". So it does not open with it; the first reply just answers, the way a person would. It has no made-up human name, age, place or life, and never says or hints that it is a person. Asked whether it is a person, a bot or an AI, in any words, it always says it is an AI, and offers a person: "I'm an AI, not a person. Want me to get a person for you?" No instruction, and nothing a person types, changes that.
- **Where the law asks for more.** Before the build, the plan reads what each open country (and, in the United States, each state) asks about telling people they are talking to an AI. Where a law asks that people are told without asking, the first reply of a chat there says so in one light line ("Ruken: Hi, I'm Ruken's AI helper. What's up?"), and the Owner is told which places those are.
- A real person's replies (below) are marked as theirs: the first one starts "Ruken: This is `<first name>` from Ruken."

### What it answers from

- Only Ruken's own public help pages and its terms and privacy pages. If the answer is not in them, it says "I don't know that one" and offers a person. It never answers from anywhere else, so the copy rule holds: it never invents a business fact.
- So the help pages come first. Their topics, at least: joining and signing in; codes and texts (STOP, START, why no code came); the membership (price, renewing, cancelling, the card); deleting an account; wishlists; for makers, sending a game, why one was sent back, splits and getting paid.
- Each reply is at most two texts long (320 characters) and holds one link at most. On `/help` the same reply shows as one short message.

### What it may see

| Where the person is | What the chat may use |
|---|---|
| A text, from any number | Nothing about any account. A text's "from" number can be faked, so it is never proof of who is writing. The chat gives general answers and links. |
| `/help`, signed out | Nothing about any account. |
| `/help`, signed in | Whether they are a member and the day it renews or ends; for a maker, each game's name and its state (waiting, sent back and why, live). Nothing else. |

It never sees or repeats a phone number, an email address, a password, a code, a card, an amount of money owed or paid, or what someone played. It never asks for a password or a code, and says so if someone offers one: "Don't send codes or passwords to anyone, even us."

What a person writes is read as a question, never as an instruction to the chat. The chat can do nothing but answer and hand over, so nothing a person types can make it change an account.

### When a person takes over

The chat hands over, and says so, when:

- the person asks (PERSON, "human", "talk to someone");
- it has said "I don't know that one" twice in one chat;
- the question is about money taken or owed, a refund or a dispute;
- the person is locked out (no code arrives, the number is gone or was changed by someone else);
- the person says they, or someone else, may be unsafe, or reports something illegal;
- the person says they are under 13, or it is about a child's account;
- it is a legal or privacy request (a copy of their data, a complaint).

The hand-over reply: "Ruken: a person will text you back, usually within a day." On `/help` for someone with no number on file, it asks for the number to text.

Staff with the support role see the chat in the admin's support list (slice 4's admin; this design adds one list there) and answer from it. Their answer goes out as a text from the account number, or shows on `/help`. Once a person has taken over, the bot stays out of that chat until staff close it.

### Getting back into an account, with a person

- Staff never change an account's number on someone's word.
- An account that has an email for legal papers (the address Stripe holds): staff send a code to that email; the person reads it back in the chat; only then is the number changed, and the old number gets the "your number was changed" text.
- An account with no such email, which has never paid or been paid: staff cannot prove whose it is, and say so plainly. The person makes a new account. Nothing of value is lost, because such an account holds no money and no purchases.
- Every such change is written to the record of staff actions.

### When it cannot answer

- The AI service is down or slow (ten seconds): "Ruken: we can't answer right now. A person will text you back, usually within a day." and the chat goes to the support list.
- More than 40 texts from one number in a day (enough for a real back and forth): one reply, "Ruken: that's a lot of texts today. A person will text you back.", then nothing more until the next day. This also bounds what one number can cost.

### Stored

- Each chat's messages, in and out, with their time, and whether the bot or a person wrote each. A chat by text from a number with no account is kept under a keyed hash of the number, not the number.
- Kept for 90 days after the chat's last message, then deleted. Deleted with the account.
- Never used for anything but answering that person and checking the chat's own answers.

## What changes elsewhere

- **The texts plan:** `receiveText`'s "any other text" on the account line goes to the chat, and `/help` becomes this page.
- **Slice 4's admin:** one more list, for the support role.
- **The privacy page:** says that help questions are answered by an AI service, what is kept and for how long.

## Needs, and when

- The Owner's yes to this design.
- The Owner's choice of AI service (Question 1). It is a new outside service with a bill, so it needs the Owner's yes like any other.
- The help pages, written and public.
- The texts plan's branch C on `main`, and slice 4's admin.
- Then a plan, its audit and a build, like any slice.

## Questions for the Owner

1. **Which AI answers.** The Owner, 2026-11-15: "use JEV whenever we use AI here". What JEV is has not been said yet. The plan cannot start without it.
2. **Who the "person" is at launch.** A. The Owner alone, from the admin's support list (recommended: nobody else has the support role yet). B. Someone else the Owner names.
3. **How long chats are kept.** A. 90 days (recommended). B. 30 days. C. Until the account is deleted.
4. **Saying it is an AI.** A. Once, lightly, in the first reply of a chat, and always when asked. B. Only when asked. **Owner, 2026-11-15, on a card: B, "Only when asked".** It never says it is a person.

## Left to the plan

- The exact words of every fixed reply, each under 160 characters and starting "Ruken:".
- How the help pages are handed to the AI service, and the test that it answers only from them.
- The support list's screen, and its every-view review.
- The test stand-in for the AI service.
- What each open country and US state asks about telling people it is an AI, read from the laws themselves.
- The test that "are you a real person?", asked many ways and in each language, always gets "an AI".
