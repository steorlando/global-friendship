import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { DEFAULT_GMAIL_SENDER_EMAIL } from "./settings";

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

type GmailTransportCredentials = {
  gmailUser: string;
  gmailAppPassword: string;
  senderEmail?: string | null;
};

export function getGmailSenderAddress(): string {
  return DEFAULT_GMAIL_SENDER_EMAIL;
}

let cachedTransport: {
  key: string;
  transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo>;
} | null = null;

function getTransporter() {
  return getTransporterFromCredentials({
    gmailUser: process.env.GMAIL_USER ?? "",
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD ?? "",
    senderEmail: process.env.PARTECIPANTE_CONTACT_FROM_EMAIL || process.env.GMAIL_USER,
  });
}

function getTransporterFromCredentials(credentials: GmailTransportCredentials) {
  const gmailUser = credentials.gmailUser?.trim();
  const gmailAppPassword = credentials.gmailAppPassword?.trim();
  if (!gmailUser || !gmailAppPassword) {
    throw new Error("Missing GMAIL_USER or GMAIL_APP_PASSWORD");
  }

  const cacheKey = `${gmailUser}:${gmailAppPassword}`;
  if (cachedTransport && cachedTransport.key === cacheKey) {
    return cachedTransport.transporter;
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

  cachedTransport = { key: cacheKey, transporter };
  return transporter;
}

export async function sendGmailTextEmail(
  input: SendGmailTextEmailInput,
  credentials?: GmailTransportCredentials
) {
  await sendGmailEmailWithCredentials(
    {
      to: input.to,
      subject: input.subject,
      text: input.text,
      replyTo: input.replyTo,
      from: input.from,
    },
    credentials
  );
}

export async function sendGmailEmail(
  input: SendGmailEmailInput,
  credentials?: GmailTransportCredentials
) {
  await sendGmailEmailWithCredentials(input, credentials);
}

export async function sendGmailEmailWithCredentials(
  input: SendGmailEmailInput,
  credentials?: GmailTransportCredentials
) {
  const transporter = credentials ? getTransporterFromCredentials(credentials) : getTransporter();
  const senderEmail = credentials?.senderEmail?.trim() || getGmailSenderAddress();

  await transporter.sendMail({
    from: input.from || senderEmail,
    to: input.to,
    subject: input.subject,
    text: input.text ?? undefined,
    html: input.html ?? undefined,
    attachments: input.attachments ?? undefined,
    replyTo: input.replyTo ?? undefined,
  });
}
