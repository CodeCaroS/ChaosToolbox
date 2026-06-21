export type EmailEntry = {
  id: number;
  messageId: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  receivedAt: string | null;
  body: string;
  status: "new" | "saved" | "ignored";
  attachments: EmailAttachment[];
};

export type EmailAttachment = {
  id: number;
  emailId: number;
  filename: string;
  contentType: string;
  contentBase64: string;
};

export type ParsedEmailAttachment = Omit<EmailAttachment, "id" | "emailId">;

export type ParsedEmail = Omit<EmailEntry, "id" | "status" | "attachments"> & {
  attachments?: ParsedEmailAttachment[];
};
