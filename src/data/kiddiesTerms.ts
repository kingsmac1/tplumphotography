/**
 * Tplum Kiddies terms & conditions (client's sheet, 2026-11-16). The live text is Settings → Tplum Kiddies terms
 * (business_settings.kiddies_terms); this copy is only used until Supabase answers. One point per line starting with •.
 */
export const DEFAULT_KIDDIES_TERMS = "• For the best experience and quality photos, parents agree that the baby is well-fed, rested and has taken a nap before the photoshoot. Let us know the time that works best for your baby's happiest moments.\n• If you would like your baby's hair styled for the session, please ensure it is done before arriving for the shoot, or arrive 30 minutes before the shoot to do this, as it could impact the shoot hour you've booked. The shoot starts promptly at the hour booked.\n• The full payment for the booked hour(s) is required, regardless of the number of outfits photographed.\n• It is important that pictures of your baby's outfits are sent to us at least three weeks before the shoot to allow time for planning and, if necessary, customizing props.\n• We recommend that you arrive 30 minutes prior to your scheduled shoot time to allow your child to acclimate to the environment and to prepare for the session. The shoot will begin promptly at the scheduled time.\n• We recommend that both parents, or another accompanying individual, be present during the shoot to support and comfort the baby, as well as to ensure the baby's safety throughout the session.\n• A non-refundable retainer of $150 is required to confirm your booking. The remaining balance is due on the day of the photo shoot.\n• The images selected by the client for editing will be delivered within 5 to 7 days.\n• All images will be delivered via Google Drive. It is the client's responsibility to download and securely save the pictures within two weeks. After this period, the link will expire, and we will be unable to resend the images.\n• tplumkiddies reserves the right to use photos taken during the session to showcase our work on our website and social media channels. We appreciate your understanding and support.\n\nPlease be advised that your non-refundable retainer of $150 signifies your consent and agreement to the above information.\nInterac e-Transfer for bookings: tplumenterprises@gmail.com";

/** Splits the terms into points (lines starting with •) and the closing lines that follow them. */
export function splitKiddiesTerms(text: string): { points: string[]; closing: string[] } {
  const lines = (text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return {
    points: lines.filter((l) => /^[•\-*]\s*/.test(l)).map((l) => l.replace(/^[•\-*]\s*/, "")),
    closing: lines.filter((l) => !/^[•\-*]\s*/.test(l)),
  };
}
