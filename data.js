// Mock data only (synthetic: no real names, emails or private info).
//
// Status is NOT stored here. app.js derives it from dueDate / dueTime:
//   no dueDate            -> "backlog"  (no calendar event, never guess a date)
//   dueDate, no dueTime   -> "partial"  (event created, flagged, missing info shown)
//   dueDate and dueTime   -> "complete" (event auto-created, shown as Verified)
//
// Fields:
//   taskKey         identifies the underlying task. Items with the SAME taskKey and the SAME
//                   dueDate are merged into ONE calendar event (e.g. Canvas + Gmail).
//   source          "Canvas" | "Gmail" | "Slack" | "Discord"
//   from            where/who it came from (shown with the evidence)
//   subject         optional, Gmail only
//   sourceEvidence  the exact deadline phrase (shown in the event popup)
//   sourceMessage   the full original message (shown in the simulated "View Original Source" view)
//   deadlinePhrase  the part of sourceMessage that is highlighted as the deadline; must be an exact substring
//   dueDate         "YYYY-MM-DD" or null     dueTime  e.g. "11:59 PM" or null
//
// Google Doc links live per TASK (see DOCUMENT_URLS below), so a merged event has one link.

const SOURCES = ["Canvas", "Gmail", "Slack", "Discord"];

// >>> PASTE REAL GOOGLE DOC URLS HERE, keyed by taskKey (https://docs.google.com/...) <<<
// null = no document yet; the popup then shows "Task document not linked yet".
const DOCUMENT_URLS = {
  "pm-homework-5": null,
  "pm-week6-reflections": null,
  "pm-extra-credit-ai-workflow": null,
  "pm-final-group-project": "https://docs.google.com/document/d/1FIzsddOvZlsEQdh9NxA7AaIENgencSBUgUyI-I19dz8/edit?tab=t.0",
  "pm-final-group-presentation": null,
  "pm-peer-evaluation-2": null,
  "it-team-assignment-5": null,
  "fsm-case-reflection": null,
  "pm-final-project-submission": null,
  "fsm-team-retrospective": null,
  "pm-product-plan-section": null,
  "aie-workflow-screenshots": null,
  "fsm-team-charter": null,
  "it-peer-feedback": null,
  "study-group-notes": null,
};

// Only these tasks get a "+ Add Workspace" button (explicit allowlist, no inference).
// Add a taskKey here to make another group/collaborative project eligible.
const WORKSPACE_ELIGIBLE = ["pm-final-group-project"];

// Simulated "Create with Notion AI" workspace, keyed by taskKey. Concept only: nothing here calls an
// AI or Notion. `context` is the project description the "AI" is pretending to read; `pages` are the
// child documents it "generated". Each page is made of simple sections:
//   { heading, text }  |  { heading, bullets: [] }  |  { heading, checklist: [] }  |  { heading, table: { columns, rows } }
// The Default (no AI) workspace never uses any of this; it is just a blank page.
const WORKSPACE_AI = {
  "pm-final-group-project": {
    title: "Group Project Workspace",
    context: "In this group project, students are required to brainstorm about potential business cases then provide a final proposal.",
    pages: [
      {
        id: "brainstorming",
        icon: "💡",
        title: "Brainstorming",
        purpose: "A shared document where students can brainstorm potential business cases together.",
        sections: [
          { heading: "Business case ideas", bullets: ["Idea 1: add a one-line description", "Idea 2: add a one-line description", "Idea 3: add a one-line description"] },
          { heading: "Questions to ask about each idea", checklist: ["Who is the customer?", "What problem are we solving?", "Why is this worth solving now?", "How would the business make money?"] },
          { heading: "Team discussion", bullets: ["Member A: add your thoughts...", "Member B: add your thoughts...", "Member C: add your thoughts..."] },
          { heading: "Shortlist", text: "Pick the strongest idea(s) to carry into the Final Proposal." },
        ],
      },
      {
        id: "final-proposal",
        icon: "📝",
        title: "Final Proposal",
        purpose: "A document where students can follow the project requirements and rubric and develop the final business proposal for hand-in.",
        sections: [
          { heading: "Requirements", checklist: ["Choose a business case from the Brainstorming page", "Write a final proposal for that business case", "Follow the rubric below", "Hand in before the deadline"] },
          {
            heading: "Rubric",
            text: "Draft rubric. Replace it with the official rubric from the assignment.",
            table: {
              columns: ["Criteria", "What to show", "Points"],
              rows: [
                ["Business case", "A clear, well-chosen business case", "—"],
                ["Reasoning", "Evidence and logic behind the proposal", "—"],
                ["Feasibility", "A realistic plan and next steps", "—"],
                ["Presentation", "Clear, well-organized writing", "—"],
              ],
            },
          },
          { heading: "Final Proposal", bullets: ["Problem", "Proposed solution", "Business model", "Next steps"] },
        ],
      },
    ],
  },
};

const ITEMS = [
  // ---------- Canvas ----------
  {
    id: 1,
    taskKey: "pm-homework-5",
    source: "Canvas",
    title: "PM Homework 5",
    course: "Product Management",
    from: "Assignment page",
    received: "2026-09-21",
    sourceEvidence: "PM Homework 5 is due September 25 at 11:59 PM PST.",
    sourceMessage: "PM Homework 5. Due: Sep 25 at 11:59 PM PST. Submit a single PDF through Canvas.",
    deadlinePhrase: "Due: Sep 25 at 11:59 PM PST",
    dueDate: "2026-09-25",
    dueTime: "11:59 PM PST",
    dismissed: false,
  },
  {
    id: 2,
    taskKey: "pm-week6-reflections",
    source: "Canvas",
    title: "Week 6 Video Lecture / Course Weeks 1–6 Reflections",
    course: "Product Management",
    from: "Assignment page",
    received: "2026-09-28",
    sourceEvidence: "Week 6 Video Lecture / Course Weeks 1–6 Reflections. Due: Oct 2 at 11:59 PM.",
    sourceMessage: "Week 6 Video Lecture / Course Weeks 1–6 Reflections. Due: Oct 2 at 11:59 PM. Watch the lecture, then submit your reflections.",
    deadlinePhrase: "Due: Oct 2 at 11:59 PM",
    dueDate: "2026-10-02",
    dueTime: "11:59 PM",
    dismissed: false,
  },
  {
    id: 3,
    taskKey: "pm-extra-credit-ai-workflow",
    source: "Canvas",
    title: "Extra Credit Assignment: Build Your Own AI Workflow",
    course: "Product Management",
    from: "Assignment page",
    received: "2026-09-28",
    sourceEvidence: "Extra Credit Assignment: Build Your Own AI Workflow — Due Oct 4 at 11:59 PM",
    sourceMessage: "Extra Credit Assignment: Build Your Own AI Workflow. Due: Oct 4 at 11:59 PM. Optional; counts toward your assignment grade.",
    deadlinePhrase: "Due: Oct 4 at 11:59 PM",
    dueDate: "2026-10-04",
    dueTime: "11:59 PM",
    dismissed: false,
  },
  {
    id: 4,
    taskKey: "pm-final-group-project",
    source: "Canvas",
    title: "Final Group Project: Build a Product Plan",
    course: "Product Management",
    from: "Assignment page",
    received: "2026-09-28",
    sourceEvidence: "Final Group Project: Build a Product Plan — Due Oct 7 at 11:59 PM",
    sourceMessage: "Final Group Project: Build a Product Plan. Due: Oct 7 at 11:59 PM. One submission per group.",
    deadlinePhrase: "Due: Oct 7 at 11:59 PM",
    dueDate: "2026-10-07",
    dueTime: "11:59 PM",
    dismissed: false,
  },
  {
    id: 5,
    taskKey: "pm-final-group-presentation",
    source: "Canvas",
    title: "Final Group Presentation",
    course: "Product Management",
    from: "Assignment page",
    received: "2026-09-28",
    sourceEvidence: "Final Group Presentation. Due: Oct 7 at 11:59 PM.",
    sourceMessage: "Final Group Presentation. Due: Oct 7 at 11:59 PM. Upload your slides before presenting.",
    deadlinePhrase: "Due: Oct 7 at 11:59 PM",
    dueDate: "2026-10-07",
    dueTime: "11:59 PM",
    dismissed: false,
  },
  {
    id: 6,
    taskKey: "pm-peer-evaluation-2",
    source: "Canvas",
    title: "Individual Assignment: Peer Evaluation 2",
    course: "Product Management",
    from: "Assignment page",
    received: "2026-09-28",
    sourceEvidence: "Individual Assignment: Peer Evaluation 2. Due: Oct 8 at 11:59 PM.",
    sourceMessage: "Individual Assignment: Peer Evaluation 2. Due: Oct 8 at 11:59 PM. Evaluate each teammate privately.",
    deadlinePhrase: "Due: Oct 8 at 11:59 PM",
    dueDate: "2026-10-08",
    dueTime: "11:59 PM",
    dismissed: false,
  },
  {
    id: 7,
    taskKey: "it-team-assignment-5",
    source: "Canvas",
    title: "Team Assignment 5: Mapping the Evolution of a Problem",
    course: "Integrated Thinking for Innovation",
    from: "Assignment page",
    received: "2026-09-29",
    sourceEvidence: "Team Assignment 5: Mapping the Evolution of a Problem. Due: Oct 6 at 11:59 PM.",
    sourceMessage: "Team Assignment 5: Mapping the Evolution of a Problem. Due: Oct 6 at 11:59 PM. One submission per team.",
    deadlinePhrase: "Due: Oct 6 at 11:59 PM",
    dueDate: "2026-10-06",
    dueTime: "11:59 PM",
    dismissed: false,
  },
  {
    id: 8,
    taskKey: "fsm-case-reflection",
    source: "Canvas",
    title: "Case Reflection",
    course: "Foundations of Software Management",
    from: "Assignment page",
    received: "2026-09-30",
    sourceEvidence: "Case Reflection. Due: Oct 9.",
    sourceMessage: "Case Reflection. Due: Oct 9. Write a one-page reflection on this week's case.",
    deadlinePhrase: "Due: Oct 9",
    dueDate: "2026-10-09",
    dueTime: null, // no time on the page -> Partial
    dismissed: false,
  },

  // ---------- Gmail ----------
  {
    id: 9,
    taskKey: "pm-extra-credit-ai-workflow",
    source: "Gmail",
    title: "Extra Credit: Build Your Own AI Workflow",
    course: "Product Management",
    from: "Product Management Course Team",
    subject: "Reminder: Extra Credit AI Workflow due Sunday",
    received: "2026-10-01",
    sourceEvidence: "Reminder that the Extra Credit Assignment: Build Your Own AI Workflow is due October 4 at 11:59 PM.",
    sourceMessage: "Hi everyone, reminder that the Extra Credit Assignment: Build Your Own AI Workflow is due October 4 at 11:59 PM. It is optional. Thanks, Product Management Course Team",
    deadlinePhrase: "due October 4 at 11:59 PM",
    dueDate: "2026-10-04",
    dueTime: "11:59 PM",
    dismissed: false,
  },
  {
    id: 10,
    taskKey: "pm-final-group-project",
    source: "Gmail",
    title: "Final Group Project: Build a Product Plan",
    course: "Product Management",
    from: "Course Staff",
    subject: "Final Group Project reminder",
    received: "2026-10-01",
    sourceEvidence: "Please remember that the Final Group Project: Build a Product Plan is due October 7 at 11:59 PM.",
    sourceMessage: "Hello, please remember that the Final Group Project: Build a Product Plan is due October 7 at 11:59 PM. Reach out to course staff with any questions. Thanks, Course Staff",
    deadlinePhrase: "due October 7 at 11:59 PM",
    dueDate: "2026-10-07",
    dueTime: "11:59 PM",
    dismissed: false,
  },
  {
    id: 11,
    taskKey: "pm-final-project-submission",
    source: "Gmail",
    title: "Final project submission",
    course: "Product Management",
    from: "Product Management Course Team",
    subject: "Final project update",
    received: "2026-10-01",
    sourceEvidence: "Please submit the final project soon. Details are available on Canvas.",
    sourceMessage: "Hi everyone, please submit the final project soon. Details are available on Canvas. Thanks, Product Management Course Team",
    deadlinePhrase: "soon",
    dueDate: null, // "soon" is not a date -> Backlog
    dueTime: null,
    dismissed: false,
  },
  {
    id: 12,
    taskKey: "fsm-team-retrospective",
    source: "Gmail",
    title: "Team retrospective",
    course: "Foundations of Software Management",
    from: "Course Staff",
    subject: "Team retrospective",
    received: "2026-09-30",
    sourceEvidence: "Don't forget to send in your team retrospective soon.",
    sourceMessage: "Hello, don't forget to send in your team retrospective soon. Thanks, Course Staff",
    deadlinePhrase: "soon",
    dueDate: null,
    dueTime: null,
    dismissed: false,
  },

  // ---------- Slack ----------
  {
    id: 13,
    taskKey: "pm-product-plan-section",
    source: "Slack",
    title: "Finish your Product Plan section",
    course: "Product Management",
    from: "#pm-group-6 · Team Member",
    received: "2026-09-30",
    sourceEvidence: "Please finish your section of the Product Plan by October 5 at 6:00 PM so we can review everything before submission.",
    sourceMessage: "Please finish your section of the Product Plan by October 5 at 6:00 PM so we can review everything before submission.",
    deadlinePhrase: "by October 5 at 6:00 PM",
    dueDate: "2026-10-05",
    dueTime: "6:00 PM",
    dismissed: false,
  },
  {
    id: 14,
    taskKey: "aie-workflow-screenshots",
    source: "Slack",
    title: "Upload final workflow screenshots",
    course: "AI Engineering Fundamentals",
    from: "#ai-engineering-group · Team Member",
    received: "2026-09-30",
    sourceEvidence: "Please upload the final workflow screenshots by October 3 at 8:00 PM.",
    sourceMessage: "Please upload the final workflow screenshots by October 3 at 8:00 PM.",
    deadlinePhrase: "by October 3 at 8:00 PM",
    dueDate: "2026-10-03",
    dueTime: "8:00 PM",
    dismissed: false,
  },
  {
    id: 15,
    taskKey: "fsm-team-charter",
    source: "Slack",
    title: "Team charter draft",
    course: "Foundations of Software Management",
    from: "#fsm-team-2 · Team Member",
    received: "2026-09-30",
    sourceEvidence: "Team charter draft is due next Tuesday, please add your sections.",
    sourceMessage: "Team charter draft is due next Tuesday, please add your sections.",
    deadlinePhrase: "due next Tuesday",
    dueDate: "2026-10-06", // "next Tuesday" resolved from the Wed Sep 30 message date
    dueTime: null, // no time given -> Partial
    dismissed: false,
  },
  {
    id: 16,
    taskKey: "it-peer-feedback",
    source: "Slack",
    title: "Peer feedback wrap-up",
    course: "Integrated Thinking for Innovation",
    from: "#it-team-4 · Team Member",
    received: "2026-10-01",
    sourceEvidence: "We should wrap up the peer feedback soon.",
    sourceMessage: "We should wrap up the peer feedback soon.",
    deadlinePhrase: "soon",
    dueDate: null,
    dueTime: null,
    dismissed: false,
  },

  // ---------- Discord (clearly synthetic demo data, kept to one item) ----------
  {
    id: 17,
    taskKey: "study-group-notes",
    source: "Discord",
    title: "Submit study-group notes",
    course: "Study group (demo data)",
    from: "CMU Study Group · #assignments",
    received: "2026-10-01",
    sourceEvidence: "Reminder: submit the study-group notes by October 6 at 7:00 PM.",
    sourceMessage: "Reminder: submit the study-group notes by October 6 at 7:00 PM.",
    deadlinePhrase: "by October 6 at 7:00 PM",
    dueDate: "2026-10-06",
    dueTime: "7:00 PM",
    dismissed: false,
  },
];
