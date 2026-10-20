import { permanentRedirect } from "next/navigation";

// The old /product-matches screen was replaced by the matching section.
export default function MatchesPage() {
  permanentRedirect("/matching/matches");
}
