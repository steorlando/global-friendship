import nodemailer from "nodemailer";

type SendGmailTextEmailInput = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string | null;
  from?: string | null;
};

type SendGmailEmailInput = {
  to: string;
  subject: string;
  text?: string | null;
  html?: string | null;
  attachments?: Array<{
    filename: string;
    content: string;
    encoding: "base64";
    contentType?: string;
  }>;
  replyTo?: string | null;
  from?: string | null;
};

export function getGmailSenderAddress(): string {
  return (
    process.env.PARTECIPANTE_CONTACT_FROM_EMAIL ||
    process.env.GMAIL_USER ||
    "europeanyouthmeeting@gmail.com"
  );
}

export async function sendGmailTextEmail(input: SendGmailTextEmailInput) {
  await sendGmailEmail({
    to: input.to,
    subject: input.subject,
    text: input.text,
    replyTo: input.replyTo,
    from: input.from,
  });
}

export async function sendGmailEmail(input: SendGmailEmailInput) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailAppPassword) {
    throw new Error("Missing GMAIL_USER or GMAIL_APP_PASSWORD");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });

  await transporter.sendMail({
    from: input.from || getGmailSenderAddress(),
    to: input.to,
    subject: input.subject,
    text: input.text ?? undefined,
    html: input.html ?? undefined,
    attachments: input.attachments ?? undefined,
    replyTo: input.replyTo ?? undefined,
  });
}
