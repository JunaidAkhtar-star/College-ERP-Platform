export interface IComplianceCatalogItem {
  key: string;
  slug: string;
  name: string;
  shortName: string;
  authority: string;
  country: string;
  description: string;
  category: "accreditation" | "regulatory" | "internal";
  programmeDomains?: string[];
  institutionTypes?: string[];
  officialSourceUrl?: string;
}

/**
 * Starter workspaces, not a substitute for the authority's current manual.
 * Institutions activate a workspace and configure the applicable version,
 * scope and requirements against their officially adopted standard.
 */
export const COMPLIANCE_CATALOG: readonly IComplianceCatalogItem[] = [
  {
    key: "naac",
    slug: "naac-compliance",
    name: "NAAC Institutional Accreditation",
    shortName: "NAAC",
    authority: "National Assessment and Accreditation Council",
    country: "India",
    description: "Institution-level accreditation evidence and readiness workspace.",
    category: "accreditation",
    institutionTypes: [
      "university",
      "deemed_university",
      "autonomous_college",
      "affiliated_college",
    ],
    officialSourceUrl: "https://www.naac.gov.in/",
  },
  {
    key: "nba",
    slug: "nba-compliance",
    name: "NBA Programme Accreditation",
    shortName: "NBA",
    authority: "National Board of Accreditation",
    country: "India",
    description: "Programme-level accreditation and outcome evidence workspace.",
    category: "accreditation",
    programmeDomains: ["engineering", "technology", "management", "pharmacy", "architecture"],
    officialSourceUrl: "https://www.nbaind.org/Downloads/Documents/",
  },
  {
    key: "aicte",
    slug: "aicte-compliance",
    name: "AICTE Approval Compliance",
    shortName: "AICTE",
    authority: "All India Council for Technical Education",
    country: "India",
    description: "Approval, disclosure and institutional compliance workspace.",
    category: "regulatory",
    programmeDomains: ["engineering", "technology", "management", "pharmacy", "architecture"],
    officialSourceUrl: "https://www.aicte-india.org/",
  },
  {
    key: "ugc",
    slug: "ugc-compliance",
    name: "UGC Regulatory Reporting",
    shortName: "UGC",
    authority: "University Grants Commission",
    country: "India",
    description: "University regulatory reporting and evidence workspace.",
    category: "regulatory",
    institutionTypes: ["university", "deemed_university"],
    officialSourceUrl: "https://www.ugc.gov.in/",
  },
  {
    key: "abet",
    slug: "abet-programme-accreditation",
    name: "ABET Programme Accreditation",
    shortName: "ABET",
    authority: "ABET",
    country: "United States",
    description:
      "Programme accreditation preparation workspace; criteria version must be institution-verified.",
    category: "accreditation",
    programmeDomains: ["engineering", "technology", "computing", "applied-science"],
    officialSourceUrl: "https://www.abet.org/accreditation/accreditation-criteria/",
  },
  {
    key: "aacsb",
    slug: "aacsb-business-accreditation",
    name: "AACSB Business Accreditation",
    shortName: "AACSB",
    authority: "AACSB International",
    country: "Global",
    description: "Business-school accreditation preparation workspace.",
    category: "accreditation",
    programmeDomains: ["business", "management", "accounting"],
    officialSourceUrl: "https://www.aacsb.edu/educators/accreditation",
  },
  {
    key: "qaa",
    slug: "qaa-quality-code",
    name: "UK Quality Code",
    shortName: "QAA",
    authority: "Quality Assurance Agency for Higher Education",
    country: "United Kingdom",
    description: "UK higher-education quality-code evidence workspace.",
    category: "accreditation",
    institutionTypes: ["university", "standalone_institution"],
    officialSourceUrl: "https://www.qaa.ac.uk/the-quality-code",
  },
  {
    key: "internal",
    slug: "internal-governance",
    name: "Internal Institutional Governance",
    shortName: "Internal",
    authority: "Institution quality governance",
    country: "India",
    description: "Internal policies, recurring controls and management review workspace.",
    category: "internal",
  },
] as const;
