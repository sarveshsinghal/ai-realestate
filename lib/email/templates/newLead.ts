export function newLeadEmailHtml(args: {
  listingTitle: string;
  listingCommune: string;
  listingPrice: number;
  listingUrl: string;
  leadName: string;
  leadEmail: string;
  leadPhone?: string | null;
  leadMessage: string;
}) {
  const {
    listingTitle,
    listingCommune,
    listingPrice,
    listingUrl,
    leadName,
    leadEmail,
    leadPhone,
    leadMessage,
  } = args;

  return `
  <div style="font-family: ui-sans-serif, system-ui; line-height:1.5;">
    <h2 style="margin:0 0 12px;">New lead received</h2>
    <p style="margin:0 0 8px;"><strong>Listing:</strong> ${listingTitle}</p>
    <p style="margin:0 0 8px;"><strong>Commune:</strong> ${listingCommune}</p>
    <p style="margin:0 0 12px;"><strong>Price:</strong> €${listingPrice.toLocaleString("de-LU")}</p>
    <p style="margin:0 0 12px;">
      <a href="${listingUrl}" target="_blank" rel="noreferrer">Open listing</a>
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
    <p style="margin:0 0 8px;"><strong>Name:</strong> ${leadName}</p>
    <p style="margin:0 0 8px;"><strong>Email:</strong> ${leadEmail}</p>
    <p style="margin:0 0 12px;"><strong>Phone:</strong> ${leadPhone ?? "—"}</p>
    <p style="margin:0 0 6px;"><strong>Message:</strong></p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;white-space:pre-wrap;">${escapeHtml(
      leadMessage
    )}</div>
  </div>`;
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
