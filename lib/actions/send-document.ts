export interface SendDocumentParams {
  sentTo: string
  recipientName: string
  ccEmails: string[]
  bccEmails: string[]
  subject: string
  messageBody: string
  attachments: { name: string; url: string }[]
}
