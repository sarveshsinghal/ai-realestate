import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY!);

export const LEADS_FROM = process.env.LEADS_FROM_EMAIL!;
export const LEADS_NOTIFY = process.env.LEADS_NOTIFY_EMAIL!;
