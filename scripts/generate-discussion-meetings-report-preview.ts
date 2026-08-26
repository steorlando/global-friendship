import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildDiscussionMeetingDashboard,
  type DiscussionMeetingAssignment,
  type DiscussionParticipantSource,
} from "../lib/admin/discussion-meetings.ts";
import { buildDiscussionMeetingsReport } from "../lib/admin/discussion-meetings-report.ts";

const outputPath = path.resolve(
  process.argv[2] ?? "tmp/discussion-meetings-report-preview.docx",
);

const groups = [
  "Budapest Centro",
  "Comunità di Sant'Egidio - Anversa e Bruxelles",
  "Cracovia",
  "Kyiv Giovani per la Pace",
  "Lisbona",
  "Madrid",
  "Napoli",
  "Parigi",
  "Praga",
  "Roma",
  "Tirana",
  "Varsavia",
].map((name, index) => ({ id: `preview-${index + 1}`, name }));

const registrationTypes = {
  higher: "Higher student - liceale (14-18 years old)",
  universityWorker: "Undergraduate - universitario(18-25 years old)",
  operator: "Operator - Operatore",
};

const participants: DiscussionParticipantSource[] = [];
const assignments: DiscussionMeetingAssignment[] = [];

for (const [index, group] of groups.entries()) {
  const addParticipants = (registrationType: string, count: number) => {
    for (let participantIndex = 0; participantIndex < count; participantIndex += 1) {
      participants.push({
        groupId: group.id,
        groupLabel: group.name,
        registrationType,
      });
    }
  };

  addParticipants(registrationTypes.higher, 4 + (index % 5));
  addParticipants(registrationTypes.universityWorker, 6 + (index % 7));
  addParticipants(registrationTypes.operator, 1 + (index % 4));

  if (index >= groups.length - 2) continue;

  const firstMeeting = (index % 8) + 1;
  assignments.push({
    groupId: group.id,
    higherMeetingNumber: firstMeeting,
    universityWorkerMeetingNumber:
      index === 0
        ? null
        : index % 3 === 0
          ? Math.min(10, firstMeeting + 1)
          : firstMeeting,
    updatedAt: null,
  });
}

const dashboard = buildDiscussionMeetingDashboard(groups, participants, assignments);
const report = await buildDiscussionMeetingsReport(dashboard);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, report);
console.log(outputPath);
