import type {
  AccommodationHotelRosterSection,
  AccommodationOperationalParticipant,
  AccommodationRoomRosterSection,
} from "./operations.ts";

export type OperationalExportColumn = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
};

export type OperationalExportRow = Record<string, string>;

type DateFormatter = (value: string) => string;

function normalizeForSearch(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const normalized = value == null ? "" : String(value);
  if (!/[",\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replace(/"/g, "\"\"")}"`;
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatExportDate(
  value: string | null | undefined,
  formatDate?: DateFormatter
): string {
  if (!value) return "";
  return formatDate ? formatDate(value) : value;
}

export function matchesOperationalRosterParticipantSearch(
  participant: AccommodationOperationalParticipant,
  searchTerm: string
): boolean {
  const normalized = normalizeForSearch(searchTerm);
  if (!normalized) return true;

  return normalizeForSearch(
    [
      participant.fullName,
      participant.firstName,
      participant.lastName,
      participant.email,
      participant.groupName,
      participant.hotelName,
      participant.roomInternalCode,
      participant.realRoomNumber,
    ].join(" ")
  ).includes(normalized);
}

export function buildAccommodationHotelRosterColumns(headers: {
  hotel: string;
  room: string;
  realRoom: string;
  group: string;
  participant: string;
  sex: string;
  arrival: string;
  departure: string;
  email: string;
}): OperationalExportColumn[] {
  return [
    { key: "hotel", label: headers.hotel },
    { key: "room", label: headers.room },
    { key: "realRoom", label: headers.realRoom },
    { key: "group", label: headers.group },
    { key: "participant", label: headers.participant },
    { key: "sex", label: headers.sex },
    { key: "arrival", label: headers.arrival },
    { key: "departure", label: headers.departure },
    { key: "email", label: headers.email },
  ];
}

export function buildAccommodationHotelRosterXlsxColumns(headers: {
  hotel: string;
  room: string;
  availableFrom: string;
  availableTo: string;
  realRoom: string;
  group: string;
  participant: string;
  sex: string;
  age: string;
  arrival: string;
  departure: string;
  email: string;
  identityDocumentType: string;
  identityDocumentNumber: string;
  identityDocumentCountry: string;
  identityDocumentIssuingCity: string;
  identityDocumentIssueDate: string;
  identityDocumentExpirationDate: string;
}): OperationalExportColumn[] {
  return [
    { key: "hotel", label: headers.hotel },
    { key: "room", label: headers.room },
    { key: "availableFrom", label: headers.availableFrom },
    { key: "availableTo", label: headers.availableTo },
    { key: "realRoom", label: headers.realRoom },
    { key: "group", label: headers.group },
    { key: "participant", label: headers.participant },
    { key: "sex", label: headers.sex },
    { key: "age", label: headers.age, align: "center" },
    { key: "arrival", label: headers.arrival },
    { key: "departure", label: headers.departure },
    { key: "email", label: headers.email },
    { key: "identityDocumentType", label: headers.identityDocumentType },
    { key: "identityDocumentNumber", label: headers.identityDocumentNumber },
    { key: "identityDocumentCountry", label: headers.identityDocumentCountry },
    {
      key: "identityDocumentIssuingCity",
      label: headers.identityDocumentIssuingCity,
    },
    { key: "identityDocumentIssueDate", label: headers.identityDocumentIssueDate },
    {
      key: "identityDocumentExpirationDate",
      label: headers.identityDocumentExpirationDate,
    },
  ];
}

export function buildAccommodationHotelRosterEnglishXlsxColumns(): OperationalExportColumn[] {
  return buildAccommodationHotelRosterXlsxColumns({
    hotel: "Hotel",
    room: "Internal ID Number",
    availableFrom: "Available from",
    availableTo: "Available until (check-out)",
    realRoom: "Room number",
    group: "Group",
    participant: "Participant",
    sex: "Sex",
    age: "Age",
    arrival: "Arrival",
    departure: "Departure",
    email: "Email",
    identityDocumentType: "Identity document type",
    identityDocumentNumber: "Identity document number",
    identityDocumentCountry: "Identity document country",
    identityDocumentIssuingCity: "Identity document issuing city",
    identityDocumentIssueDate: "Identity document issue date",
    identityDocumentExpirationDate: "Identity document expiration date",
  });
}

export function buildAccommodationRoomRosterColumns(headers: {
  hotel: string;
  room: string;
  realRoom: string;
  capacity: string;
  groups: string;
  participant: string;
  sex: string;
  arrival: string;
  departure: string;
  email: string;
}): OperationalExportColumn[] {
  return [
    { key: "hotel", label: headers.hotel },
    { key: "room", label: headers.room },
    { key: "realRoom", label: headers.realRoom },
    { key: "capacity", label: headers.capacity, align: "center" },
    { key: "groups", label: headers.groups },
    { key: "participant", label: headers.participant },
    { key: "sex", label: headers.sex },
    { key: "arrival", label: headers.arrival },
    { key: "departure", label: headers.departure },
    { key: "email", label: headers.email },
  ];
}

export function buildAccommodationHotelRosterRows(args: {
  hotels: AccommodationHotelRosterSection[];
  formatDate?: DateFormatter;
}): OperationalExportRow[] {
  return args.hotels.flatMap((hotel) =>
    hotel.participants.map((participant) => ({
      hotel: hotel.hotelName,
      room: participant.roomInternalCode,
      realRoom: participant.realRoomNumber ?? "",
      group: participant.groupName,
      participant: participant.fullName,
      sex: participant.sex ?? "",
      arrival: formatExportDate(participant.arrivalDate, args.formatDate),
      departure: formatExportDate(participant.departureDate, args.formatDate),
      email: participant.email ?? "",
    }))
  );
}

export function buildAccommodationHotelRosterXlsxRows(args: {
  hotels: AccommodationHotelRosterSection[];
  emptyBedLabel: string;
  documentTypeLabels: {
    passport: string;
    driving_license: string;
    national_id: string;
  };
  formatDate?: DateFormatter;
}): OperationalExportRow[] {
  return args.hotels.flatMap((hotel) => {
    const participantsByRoom = new Map<string, AccommodationOperationalParticipant[]>();
    for (const participant of hotel.participants) {
      const participants = participantsByRoom.get(participant.roomId) ?? [];
      participants.push(participant);
      participantsByRoom.set(participant.roomId, participants);
    }

    return hotel.rooms.flatMap((room) => {
      const participants = participantsByRoom.get(room.roomId) ?? [];
      const roomValues = {
        hotel: hotel.hotelName,
        room: room.internalCode,
        availableFrom: formatExportDate(room.availableFrom, args.formatDate),
        availableTo: formatExportDate(room.availableTo, args.formatDate),
        realRoom: room.realRoomNumber ?? "",
      };
      const participantRows = participants.map((participant) => ({
        ...roomValues,
        group: participant.groupName,
        participant: participant.fullName,
        sex: participant.sex ?? "",
        age: participant.age == null ? "" : String(participant.age),
        arrival: formatExportDate(participant.arrivalDate, args.formatDate),
        departure: formatExportDate(participant.departureDate, args.formatDate),
        email: participant.email ?? "",
        identityDocumentType: participant.hostelCheckIn
          ? args.documentTypeLabels[participant.hostelCheckIn.identityDocumentType]
          : "",
        identityDocumentNumber:
          participant.hostelCheckIn?.identityDocumentNumber ?? "",
        identityDocumentCountry:
          participant.hostelCheckIn?.identityDocumentCountry ?? "",
        identityDocumentIssuingCity:
          participant.hostelCheckIn?.identityDocumentIssuingCity ?? "",
        identityDocumentIssueDate: formatExportDate(
          participant.hostelCheckIn?.identityDocumentIssueDate,
          args.formatDate
        ),
        identityDocumentExpirationDate: formatExportDate(
          participant.hostelCheckIn?.identityDocumentExpirationDate,
          args.formatDate
        ),
      }));
      const emptyBedCount = Math.max(room.capacity - room.occupancyCount, 0);
      const emptyBedRows = Array.from({ length: emptyBedCount }, () => ({
        ...roomValues,
        group: room.assignedGroups.join("; "),
        participant: args.emptyBedLabel,
        sex: "",
        age: "",
        arrival: "",
        departure: "",
        email: "",
        identityDocumentType: "",
        identityDocumentNumber: "",
        identityDocumentCountry: "",
        identityDocumentIssuingCity: "",
        identityDocumentIssueDate: "",
        identityDocumentExpirationDate: "",
      }));

      return [...participantRows, ...emptyBedRows];
    });
  });
}

export function buildAccommodationRoomRosterRows(args: {
  rooms: AccommodationRoomRosterSection[];
  formatDate?: DateFormatter;
}): OperationalExportRow[] {
  return args.rooms.flatMap((room) =>
    room.participants.map((participant) => ({
      hotel: room.hotelName,
      room: room.internalCode,
      realRoom: room.realRoomNumber ?? "",
      capacity: String(room.capacity),
      groups: room.assignedGroups.join("; "),
      participant: participant.fullName,
      sex: participant.sex ?? "",
      arrival: formatExportDate(participant.arrivalDate, args.formatDate),
      departure: formatExportDate(participant.departureDate, args.formatDate),
      email: participant.email ?? "",
    }))
  );
}

export function buildCsvFromColumnsAndRows(args: {
  columns: OperationalExportColumn[];
  rows: OperationalExportRow[];
}): string {
  const sheetRows = [
    args.columns.map((column) => column.label),
    ...args.rows.map((row) => args.columns.map((column) => row[column.key] ?? "")),
  ];

  return sheetRows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
}

export function buildAccommodationHotelRosterCsv(args: {
  hotels: AccommodationHotelRosterSection[];
  headers: {
    hotel: string;
    room: string;
    realRoom: string;
    group: string;
    participant: string;
    sex: string;
    arrival: string;
    departure: string;
    email: string;
  };
  formatDate?: DateFormatter;
}): string {
  return buildCsvFromColumnsAndRows({
    columns: buildAccommodationHotelRosterColumns(args.headers),
    rows: buildAccommodationHotelRosterRows({
      hotels: args.hotels,
      formatDate: args.formatDate,
    }),
  });
}

export function buildAccommodationRoomRosterCsv(args: {
  rooms: AccommodationRoomRosterSection[];
  headers: {
    hotel: string;
    room: string;
    realRoom: string;
    capacity: string;
    groups: string;
    participant: string;
    sex: string;
    arrival: string;
    departure: string;
    email: string;
  };
  formatDate?: DateFormatter;
}): string {
  return buildCsvFromColumnsAndRows({
    columns: buildAccommodationRoomRosterColumns(args.headers),
    rows: buildAccommodationRoomRosterRows({
      rooms: args.rooms,
      formatDate: args.formatDate,
    }),
  });
}

export async function exportRowsToXlsx(args: {
  fileName: string;
  sheetName: string;
  columns: OperationalExportColumn[];
  rows: OperationalExportRow[];
}) {
  const XLSX = await import("xlsx");

  const matrix = [
    args.columns.map((column) => column.label),
    ...args.rows.map((row) => args.columns.map((column) => row[column.key] ?? "")),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  worksheet["!cols"] = args.columns.map((column) => {
    const maxLength = Math.max(
      column.label.length,
      ...args.rows.map((row) => String(row[column.key] ?? "").length)
    );

    return {
      wch: Math.min(Math.max(maxLength + 2, 10), 40),
    };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, args.sheetName);
  XLSX.writeFile(workbook, args.fileName);
}

export async function exportRowsToPdf(args: {
  fileName: string;
  title: string;
  subtitle: string;
  generatedAtLabel: string;
  generatedAtValue: string;
  note?: string;
  summary: Array<{ label: string; value: string }>;
  columns: OperationalExportColumn[];
  rows: OperationalExportRow[];
  emptyLabel: string;
}) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  const autoTable = autoTableModule.default;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const contentWidth = pageWidth - marginX * 2;

  doc.setProperties({
    title: args.fileName,
    subject: args.title,
  });

  let cursorY = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(args.title, marginX, cursorY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const generatedText = `${args.generatedAtLabel}: ${args.generatedAtValue}`;
  const generatedWidth = doc.getTextWidth(generatedText);
  doc.text(generatedText, pageWidth - marginX - generatedWidth, cursorY);

  cursorY += 6;
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(10);
  const subtitleLines = doc.splitTextToSize(args.subtitle, contentWidth * 0.7);
  doc.text(subtitleLines, marginX, cursorY);
  cursorY += subtitleLines.length * 4.5 + 2;

  const summaryGap = 4;
  const summaryCardWidth =
    (contentWidth - summaryGap * Math.max(args.summary.length - 1, 0)) /
    Math.max(args.summary.length, 1);
  const summaryCardHeight = 16;

  for (const [index, item] of args.summary.entries()) {
    const x = marginX + index * (summaryCardWidth + summaryGap);
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, cursorY, summaryCardWidth, summaryCardHeight, 2, 2, "FD");

    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(item.label.toUpperCase(), x + 3, cursorY + 5);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(item.value, x + 3, cursorY + 12);
  }

  cursorY += summaryCardHeight + 6;

  if (args.note) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const noteLines = doc.splitTextToSize(args.note, contentWidth);
    doc.text(noteLines, marginX, cursorY);
    cursorY += noteLines.length * 4.2 + 2;
  }

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX, bottom: 12 },
    head: [args.columns.map((column) => column.label)],
    body: args.rows.length
      ? args.rows.map((row) => args.columns.map((column) => row[column.key] ?? ""))
      : [[args.emptyLabel]],
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "top",
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [226, 232, 240],
      textColor: [15, 23, 42],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: Object.fromEntries(
      args.columns.map((column, index) => [
        index,
        {
          halign:
            column.align === "right"
              ? "right"
              : column.align === "center"
                ? "center"
                : "left",
        },
      ])
    ),
    didParseCell: (hookData) => {
      if (!args.rows.length && hookData.section === "body" && hookData.row.index === 0) {
        if (hookData.column.index === 0) {
          hookData.cell.colSpan = args.columns.length;
          hookData.cell.styles.halign = "center";
          hookData.cell.styles.textColor = [100, 116, 139];
        } else {
          hookData.cell.text = [];
        }
      }
    },
    didDrawPage: () => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `${doc.getCurrentPageInfo().pageNumber}`,
        pageWidth - marginX,
        pageHeight - 5,
        { align: "right" }
      );
    },
  });

  doc.save(args.fileName);
}

export function buildOperationalRosterPdfHtml(args: {
  documentTitle: string;
  title: string;
  subtitle: string;
  generatedAtLabel: string;
  generatedAtValue: string;
  note?: string;
  summary: Array<{ label: string; value: string }>;
  columns: OperationalExportColumn[];
  rows: OperationalExportRow[];
  emptyLabel: string;
}): string {
  const summaryCards = args.summary
    .map(
      (item) => `
        <div class="summary-card">
          <div class="summary-label">${escapeHtml(item.label)}</div>
          <div class="summary-value">${escapeHtml(item.value)}</div>
        </div>
      `
    )
    .join("");

  const headerCells = args.columns
    .map((column) => `<th>${escapeHtml(column.label)}</th>`)
    .join("");

  const bodyRows =
    args.rows.length > 0
      ? args.rows
          .map((row) => {
            const cells = args.columns
              .map((column) => {
                const alignClass =
                  column.align === "right"
                    ? "align-right"
                    : column.align === "center"
                      ? "align-center"
                      : "align-left";

                return `<td class="${alignClass}">${escapeHtml(row[column.key] ?? "")}</td>`;
              })
              .join("");

            return `<tr>${cells}</tr>`;
          })
          .join("")
      : `<tr><td colspan="${args.columns.length}" class="empty-cell">${escapeHtml(
          args.emptyLabel
        )}</td></tr>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(args.documentTitle)}</title>
    <style>
      @page {
        size: A4 landscape;
        margin: 10mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        color: #0f172a;
        background: #ffffff;
      }

      .page {
        padding: 0;
      }

      .header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 16px;
      }

      .title {
        margin: 0;
        font-size: 22px;
        line-height: 1.2;
        font-weight: 700;
      }

      .subtitle {
        margin: 8px 0 0;
        font-size: 12px;
        line-height: 1.5;
        color: #475569;
      }

      .meta {
        font-size: 11px;
        color: #475569;
        text-align: right;
        white-space: nowrap;
      }

      .summary {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 14px;
      }

      .summary-card {
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 10px 12px;
        background: #f8fafc;
      }

      .summary-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #475569;
      }

      .summary-value {
        margin-top: 6px;
        font-size: 18px;
        font-weight: 700;
        color: #0f172a;
      }

      .note {
        margin-bottom: 12px;
        font-size: 11px;
        color: #475569;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      thead {
        display: table-header-group;
      }

      th,
      td {
        border: 1px solid #cbd5e1;
        padding: 6px 8px;
        font-size: 10px;
        line-height: 1.35;
        vertical-align: top;
        word-break: break-word;
      }

      th {
        background: #e2e8f0;
        text-align: left;
        font-weight: 700;
      }

      tbody tr:nth-child(even) td {
        background: #f8fafc;
      }

      .align-left {
        text-align: left;
      }

      .align-center {
        text-align: center;
      }

      .align-right {
        text-align: right;
      }

      .empty-cell {
        text-align: center;
        color: #64748b;
        padding: 18px 8px;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <header class="header">
        <div>
          <h1 class="title">${escapeHtml(args.title)}</h1>
          <p class="subtitle">${escapeHtml(args.subtitle)}</p>
        </div>
        <div class="meta">
          <div>${escapeHtml(args.generatedAtLabel)}</div>
          <div>${escapeHtml(args.generatedAtValue)}</div>
        </div>
      </header>

      <section class="summary">
        ${summaryCards}
      </section>

      ${args.note ? `<p class="note">${escapeHtml(args.note)}</p>` : ""}

      <table>
        <thead>
          <tr>${headerCells}</tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
    </div>
    <script>
      window.addEventListener("load", () => {
        setTimeout(() => window.print(), 200);
      });
    </script>
  </body>
</html>`;
}
