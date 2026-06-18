import type { Lead } from "@/types";

export const copyTextToClipboard = async (text: string) => {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
};

const formatTime = (time?: string | null) => {
  if (!time) return "";
  const [hourRaw, minuteRaw = "00"] = time.split(":");
  const hourNum = Number(hourRaw);
  if (Number.isNaN(hourNum)) return time;
  const ampm = hourNum >= 12 ? "PM" : "AM";
  const hour = hourNum % 12 || 12;
  return `${hour}:${minuteRaw.padStart(2, "0")} ${ampm}`;
};

export const formatLeadSchedule = (lead: Pick<Lead, "scheduled_date" | "scheduled_time_start" | "scheduled_time_end">) => {
  if (!lead.scheduled_date) return "Not scheduled";

  const date = new Date(`${lead.scheduled_date}T12:00:00`);
  const dateText = Number.isNaN(date.getTime()) ? lead.scheduled_date : date.toLocaleDateString();
  const start = formatTime(lead.scheduled_time_start);
  const end = formatTime(lead.scheduled_time_end);

  if (start && end) return `${dateText}, ${start} - ${end}`;
  if (start) return `${dateText}, ${start}`;
  return dateText;
};

export const buildCompleteLeadCopyText = (lead: Lead, attachedPictures?: string[]) => {
  const lines = [
    ["Service Details", lead.service_details || lead.service_type || ""],
    ["Address", lead.address || [lead.city, lead.state, lead.zip_code].filter(Boolean).join(", ")],
    ["Schedule Requirement", lead.customer_schedule_requirements || formatLeadSchedule(lead)],
    ["Quote", lead.quote || ""],
  ];

  let baseText = lines
    .filter(([, value]) => String(value || "").trim())
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");

  if (attachedPictures && attachedPictures.length > 0) {
    baseText += "\nPictures:\n" + attachedPictures.map((url) => `- ${url}`).join("\n");
  }

  return baseText;
};
