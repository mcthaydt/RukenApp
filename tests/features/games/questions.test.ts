import { describe, expect, it } from "vitest";
import {
  answersOf,
  counterOf,
  firstUnanswered,
  isAnswered,
  partOf,
  questionBefore,
  questionOf,
  questionsFor,
  type AnswerSource,
  type Answers,
} from "../../../src/features/games/questions.ts";
import type { GamePart } from "../../../src/lib/server/db.ts";

// One question at a time (spec 3, 10.5): which question is next, the counter, and how a question maps to the part
// of a game that staff can send back.

const ALL_PARTS: GamePart[] = [
  "name",
  "one_line",
  "files",
  "plays_on",
  "upright_video",
  "wide_video",
  "age_rating",
  "other_websites",
];

const none: Answers = {
  oneLine: null,
  hasFiles: false,
  playsOn: null,
  upright: false,
  wide: false,
  ageRating: null,
  contentMarks: [],
};
const all = { oneLine: "x", hasFiles: true, playsOn: "computer_only", upright: true, wide: true } as const;

describe("which question is next", () => {
  it("a new game goes on from its one line, because its name is already given", () => {
    expect(firstUnanswered(none)).toBe("line");
  });

  it("goes in the order the maker is asked, whatever is still missing after", () => {
    expect(firstUnanswered({ ...none, oneLine: "x" })).toBe("files");
    expect(firstUnanswered({ ...none, oneLine: "x", hasFiles: true })).toBe("plays-on");
    expect(firstUnanswered({ ...none, oneLine: "x", hasFiles: true, playsOn: "computer_only" })).toBe(
      "upright",
    );
  });

  it("an 18+ game is not done until its marks are answered", () => {
    expect(firstUnanswered({ ...all, ageRating: "age_18", contentMarks: [] })).toBe("marks");
    expect(firstUnanswered({ ...all, ageRating: "age_18", contentMarks: ["none"] })).toBeNull();
    expect(firstUnanswered({ ...all, ageRating: "age_12", contentMarks: [] })).toBeNull();
  });

  it("the name is always answered", () => {
    expect(isAnswered("name", none)).toBe(true);
    expect(isAnswered("age", none)).toBe(false);
  });
});

describe("the counter", () => {
  it("asks seven questions, and an eighth of an 18+ game", () => {
    expect(questionsFor({ ageRating: "age_12" })).toHaveLength(7);
    expect(questionsFor({ ageRating: null })).toHaveLength(7);
    expect(questionsFor({ ageRating: "age_18" }).at(-1)).toBe("marks");
    expect(questionsFor({ ageRating: "age_18" })).toHaveLength(8);
  });

  it("counts the age question as 7 of 7, and the marks as 8 of 8", () => {
    expect(counterOf("age", none)).toEqual({ n: 7, of: 7 });
    expect(counterOf("marks", { ...none, ageRating: "age_18" })).toEqual({ n: 8, of: 8 });
    expect(counterOf("name", none)).toEqual({ n: 1, of: 7 });
  });
});

describe("going back", () => {
  it("goes to the question before, and from the first nowhere", () => {
    expect(questionBefore("files", none)).toBe("line");
    expect(questionBefore("name", none)).toBeNull();
  });

  it("goes from the marks back to the age", () => {
    expect(questionBefore("marks", { ...none, ageRating: "age_18" })).toBe("age");
  });
});

describe("a question and the part it answers", () => {
  it("every part opens a question, and that question names the part", () => {
    for (const part of ALL_PARTS) expect(partOf(questionOf(part))).toBe(part);
  });

  it("the age and the marks are both the age rating, and the age is what opens", () => {
    expect(partOf("age")).toBe("age_rating");
    expect(partOf("marks")).toBe("age_rating");
    expect(questionOf("age_rating")).toBe("age");
  });

  it("the websites are changed from Check and send only", () => {
    expect(partOf("websites")).toBe("other_websites");
    expect(questionOf("other_websites")).toBe("websites");
  });
});

describe("what a game holds, read as answers", () => {
  const bare: AnswerSource = {
    oneLine: null,
    playsOn: null,
    ageRating: null,
    contentMarks: [],
    pullProblem: null,
    newestPull: null,
    clips: { upright: null, wide: null },
  };

  it("a game with nothing yet holds no answer", () => {
    expect(answersOf(bare)).toEqual(none);
  });

  it("holds the line, the place it plays, the rating and the marks as they are", () => {
    expect(
      answersOf({
        ...bare,
        oneLine: "Climb.",
        playsOn: "computer_only",
        ageRating: "age_18",
        contentMarks: ["gore"],
      }),
    ).toEqual({
      ...none,
      oneLine: "Climb.",
      playsOn: "computer_only",
      ageRating: "age_18",
      contentMarks: ["gore"],
    });
  });

  it("counts the files only once a pull passed, and not when the last pull was refused", () => {
    const pulled = { id: "a-pull" };
    expect(answersOf({ ...bare, newestPull: pulled }).hasFiles).toBe(true);
    expect(answersOf({ ...bare, newestPull: pulled, pullProblem: "No index.html." }).hasFiles).toBe(false);
    expect(answersOf({ ...bare, pullProblem: "No index.html." }).hasFiles).toBe(false);
  });

  it("counts each video once it was added", () => {
    const answers = answersOf({ ...bare, clips: { upright: { key: "x" }, wide: null } });
    expect(answers.upright).toBe(true);
    expect(answers.wide).toBe(false);
  });
});
