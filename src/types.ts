export interface Attachment {
  kind: "image" | "pdf";
  base64: string;
  mediaType: string;
}

export interface TailorInput {
  /** Resume as plain text… */
  resume?: string;
  /** …or as an uploaded file (image/PDF). One of resume / resumeFile is required. */
  resumeFile?: Attachment;
  /** Target job description as plain text… */
  jobDescription?: string;
  /** …or a URL to fetch the posting from (parsed server-side). */
  jobUrl?: string;
  options?: {
    includeCoverLetter?: boolean; // default true
    tone?: string;
    targetRole?: string;
  };
}
