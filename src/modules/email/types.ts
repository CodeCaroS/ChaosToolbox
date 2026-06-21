export type EmailEntry = {
  id: number;
  messageId: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  receivedAt: string | null;
  body: string;
  status: "new" | "saved" | "ignored";
};

export type ParsedEmail = Omit<EmailEntry, "id" | "status">;
