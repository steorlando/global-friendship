import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type {
  DiscussionMeetingAllocation,
  DiscussionMeetingDashboard,
} from "./discussion-meetings";

const CONTENT_WIDTH_DXA = 9360;
const TABLE_INDENT_DXA = 120;
const TABLE_COLUMN_WIDTHS = [4380, 1250, 1550, 1100, 1080] as const;
const COLORS = {
  ink: "0B2545",
  heading: "2E74B5",
  headingDark: "1F4D78",
  participantAccent: "C55A11",
  muted: "5B6777",
  border: "B9C6D4",
  headerFill: "E8EEF5",
  white: "FFFFFF",
};

function allocationLabel(allocation: DiscussionMeetingAllocation): string {
  if (allocation.scope === "higher") {
    return `${allocation.groupName} - Superiori`;
  }
  if (allocation.scope === "university-worker") {
    return `${allocation.groupName} - Universitari/Lavoratori`;
  }
  return allocation.groupName;
}

function cellParagraph(
  text: string,
  options: {
    bold?: boolean;
    color?: string;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  } = {},
) {
  return new Paragraph({
    alignment: options.alignment ?? AlignmentType.LEFT,
    spacing: { before: 0, after: 0, line: 280 },
    children: [
      new TextRun({
        text,
        bold: options.bold,
        color: options.color ?? COLORS.ink,
        font: "Calibri",
        size: 20,
      }),
    ],
  });
}

function tableCell(
  text: string,
  width: number,
  options: {
    header?: boolean;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  } = {},
) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: options.header
      ? { type: ShadingType.CLEAR, fill: COLORS.headerFill, color: "auto" }
      : undefined,
    margins: {
      marginUnitType: WidthType.DXA,
      top: 90,
      bottom: 90,
      left: 120,
      right: 120,
    },
    children: [
      cellParagraph(text, {
        bold: options.header,
        color: options.header ? COLORS.headingDark : COLORS.ink,
        alignment: options.alignment,
      }),
    ],
  });
}

function meetingTable(allocations: DiscussionMeetingAllocation[]) {
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      tableCell("Gruppo / componente", TABLE_COLUMN_WIDTHS[0], { header: true }),
      tableCell("Superiori", TABLE_COLUMN_WIDTHS[1], {
        header: true,
        alignment: AlignmentType.CENTER,
      }),
      tableCell("Universitari / Lavoratori", TABLE_COLUMN_WIDTHS[2], {
        header: true,
        alignment: AlignmentType.CENTER,
      }),
      tableCell("Operatori", TABLE_COLUMN_WIDTHS[3], {
        header: true,
        alignment: AlignmentType.CENTER,
      }),
      tableCell("Totale", TABLE_COLUMN_WIDTHS[4], {
        header: true,
        alignment: AlignmentType.CENTER,
      }),
    ],
  });

  const bodyRows = allocations.map(
    (allocation) =>
      new TableRow({
        cantSplit: true,
        children: [
          tableCell(allocationLabel(allocation), TABLE_COLUMN_WIDTHS[0]),
          tableCell(String(allocation.higherStudents), TABLE_COLUMN_WIDTHS[1], {
            alignment: AlignmentType.CENTER,
          }),
          tableCell(String(allocation.universityWorkers), TABLE_COLUMN_WIDTHS[2], {
            alignment: AlignmentType.CENTER,
          }),
          tableCell(String(allocation.operators), TABLE_COLUMN_WIDTHS[3], {
            alignment: AlignmentType.CENTER,
          }),
          tableCell(String(allocation.total), TABLE_COLUMN_WIDTHS[4], {
            alignment: AlignmentType.CENTER,
          }),
        ],
      }),
  );

  return new Table({
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    indent: { size: TABLE_INDENT_DXA, type: WidthType.DXA },
    columnWidths: [...TABLE_COLUMN_WIDTHS],
    layout: TableLayoutType.FIXED,
    margins: {
      marginUnitType: WidthType.DXA,
      top: 90,
      bottom: 90,
      left: 120,
      right: 120,
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 3, color: COLORS.border },
      insideVertical: { style: BorderStyle.SINGLE, size: 3, color: COLORS.border },
    },
    rows: [headerRow, ...bodyRows],
  });
}

export async function buildDiscussionMeetingsReport(
  dashboard: DiscussionMeetingDashboard,
): Promise<Buffer> {
  const meetings = dashboard.meetings.filter((meeting) => meeting.participantCount > 0);

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      style: "ReportTitle",
      children: [new TextRun("Riunioni di confronto")],
    }),
    new Paragraph({
      style: "ReportMetadata",
      children: [new TextRun(`Riunioni incluse: ${meetings.length}`)],
    }),
  ];

  for (const meeting of meetings) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        keepNext: true,
        children: [
          new TextRun({
            text: `Riunione ${meeting.number}`,
            color: COLORS.heading,
            bold: true,
          }),
          new TextRun({
            text: " - ",
            color: COLORS.muted,
            bold: false,
          }),
          new TextRun({
            text: `${meeting.participantCount} partecipanti`,
            color: COLORS.participantAccent,
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        style: "MeetingSummary",
        keepNext: true,
        children: [
          new TextRun(
            `${meeting.groupCount} ${meeting.groupCount === 1 ? "gruppo" : "gruppi"}`,
          ),
        ],
      }),
      meetingTable(meeting.allocations),
      new Paragraph({ spacing: { before: 0, after: 80 }, children: [] }),
    );
  }

  const document = new Document({
    creator: "Global Friendship",
    title: "Riunioni di confronto",
    subject: "Assegnazione statistica dei gruppi alle riunioni di confronto",
    description:
      "Report modificabile delle riunioni di confronto con gruppi e conteggi per tipologia.",
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: COLORS.ink },
          paragraph: { spacing: { before: 0, after: 120, line: 300 } },
        },
      },
      paragraphStyles: [
        {
          id: "ReportTitle",
          name: "Report Title",
          basedOn: "Normal",
          next: "ReportMetadata",
          quickFormat: true,
          run: { font: "Calibri", size: 46, bold: true, color: COLORS.ink },
          paragraph: { spacing: { before: 0, after: 80, line: 300 } },
        },
        {
          id: "ReportMetadata",
          name: "Report Metadata",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Calibri", size: 19, color: COLORS.muted },
          paragraph: { spacing: { before: 0, after: 180, line: 280 } },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "MeetingSummary",
          quickFormat: true,
          run: { font: "Calibri", size: 32, bold: true, color: COLORS.heading },
          paragraph: { spacing: { before: 280, after: 100, line: 300 } },
        },
        {
          id: "MeetingSummary",
          name: "Meeting Summary",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Calibri", size: 20, color: COLORS.muted },
          paragraph: { spacing: { before: 0, after: 90, line: 280 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
              header: 708,
              footer: 708,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: "Global Friendship | Riunioni di confronto",
                    font: "Calibri",
                    size: 18,
                    color: COLORS.muted,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    children: [
                      "Pagina ",
                      PageNumber.CURRENT,
                      " di ",
                      PageNumber.TOTAL_PAGES,
                    ],
                    font: "Calibri",
                    size: 18,
                    color: COLORS.muted,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}
