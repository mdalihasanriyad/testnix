export type ReportEmailData = {
  download: number;
  upload: number;
  ping: number;
  at: number;
};

export const REPORT_EMAIL_SUBJECT = "Testnix speed test report";

export function reportEmailSummary(report: ReportEmailData) {
  return `Download ${report.download.toFixed(1)} Mbps · Upload ${report.upload.toFixed(1)} Mbps · Ping ${Math.round(report.ping)} ms`;
}

export async function openReportDraft(report: ReportEmailData, email: string) {
  const recipient = email.trim();
  if (!recipient) throw new Error("Add an email address before opening a report draft.");

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const fileName = `testnix-report-${new Date(report.at).toISOString().slice(0, 10)}.pdf`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(REPORT_EMAIL_SUBJECT, 48, 72);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(new Date(report.at).toLocaleString(), 48, 96);
  doc.setFontSize(14);
  doc.text(`Download: ${report.download.toFixed(1)} Mbps`, 48, 140);
  doc.text(`Upload: ${report.upload.toFixed(1)} Mbps`, 48, 164);
  doc.text(`Ping: ${Math.round(report.ping)} ms`, 48, 188);
  doc.save(fileName);

  const body = `Hi,\n\nAttached is my Testnix speed test report.\n${reportEmailSummary(report)}\n\nSent from Testnix.net`;
  const mailto = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(REPORT_EMAIL_SUBJECT)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;

  return { fileName, summary: reportEmailSummary(report) };
}