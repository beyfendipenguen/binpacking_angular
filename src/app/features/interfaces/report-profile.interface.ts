export interface ExtraHeaderField {
  key: string;
  label: string;
}

export interface ReportConfig {
  extra_header_fields: ExtraHeaderField[];
}

export interface CompanyReportProfile {
  id: string | null;
  template_schema: string;
  report_config: ReportConfig;
}
