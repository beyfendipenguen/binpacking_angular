import { ZeroModel } from "./zero-model.interface";

export type Status =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

  export interface Job extends ZeroModel{
    process_id?: string | null;
    job_type: string;
    status: Status;
    progress: number;
    message?: string | null;
    result?: any;
    error_message?: string | null;
    succeeded: boolean;
    started_at: string;
    completed_at?: string | null;
  }
