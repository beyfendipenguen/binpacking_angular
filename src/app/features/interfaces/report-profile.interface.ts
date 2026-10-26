export interface ExtraHeaderField {
  key: string;
  label: string;
}

export interface ReportConfig {
  extra_header_fields: ExtraHeaderField[];
}

/** Sevkiyat tamamlandığında uygulanacak ek eylem (backend: CompanyReportProfile.PostCompleteAction). */
export type PostCompleteAction = '' | 'open_files_dialog';

export interface CompanyReportProfile {
  id: string | null;
  template_schema: string;
  report_config: ReportConfig;
  post_complete_action?: PostCompleteAction;
  /** Yerleşmeyen paletlerle kayıt/rapora izin (backend şema politikasından türetilir, salt okunur). */
  allow_unplaced?: boolean;
}
