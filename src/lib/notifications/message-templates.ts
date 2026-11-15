/** Message templates for the messaging center (spec 7.4 item 10). Merge fields are filled per person. */

export const MESSAGE_MERGE_FIELDS = ["first_name", "percentage", "band", "next_meeting"] as const;

export interface MessageTemplate {
  key: "WELCOME" | "REMINDER" | "CONGRATULATIONS" | "ABSENCE_FOLLOWUP";
  label: string;
  subject: string;
  body: string;
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    key: "WELCOME",
    label: "Welcome",
    subject: "Welcome to the Sanitation Unit",
    body: "Hello {first_name},\n\nWelcome to the Sanitation Unit of Household of David. We are glad you are serving with us.\n\n- We meet every **Saturday at 9:30 am** at the venue. Check in on your phone when you arrive.\n- Thursday prayer is at **8:30 pm**, in person or online.\n\nYour next meeting: {next_meeting}.",
  },
  {
    key: "REMINDER",
    label: "Reminder",
    subject: "See you on Saturday",
    body: "Hello {first_name},\n\nA quick reminder about {next_meeting}. Please arrive before the start so you are marked *On time*.\n\nYour attendance is currently {percentage} percent.",
  },
  {
    key: "CONGRATULATIONS",
    label: "Congratulations",
    subject: "Thank you for your faithfulness",
    body: "Hello {first_name},\n\nThank you for serving so faithfully. Your attendance is **{percentage} percent** ({band}). It makes a real difference to the house.\n\nGod bless you.",
  },
  {
    key: "ABSENCE_FOLLOWUP",
    label: "Absence follow-up",
    subject: "We missed you",
    body: "Hello {first_name},\n\nWe missed you recently and hope all is well. If something kept you away, you can send an excuse in the app, or simply reply and a leader will reach out.\n\nWe would love to see you at {next_meeting}.",
  },
];
