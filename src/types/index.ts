export type AppRole = 'admin' | 'processor' | 'customer_service' | 'opr' | 'no_role';

export type CsTag = 'confirmation_sent' | 'waiting_schedule_confirmation' | 'booked' | 'ready_to_schedule';

export const CS_TAG_LABELS: Record<CsTag, string> = {
  confirmation_sent: 'Confirmation sent to CX',
  waiting_schedule_confirmation: 'Waiting for CX for schedule confirmation',
  booked: 'Booked',
  ready_to_schedule: 'Ready to schedule',
};

export type LeadStatus =
  | 'waiting_complete_details'
  | 'urgent_job'
  | 'quote_sent_waiting'
  | 'post_visit_quote_sent_waiting'
  | 'activate_customer'
  | 'quote_sent_need_follow_up'
  | 'needs_quote'
  | 'tech_making_quote'
  | 'waiting_customer_response'
  | 'need_tech'
  | 'scheduled'
  | 'job_in_progress'
  | 'needs_reschedule'
  | 'job_done'
  | 'payment_pending'
  | 'cancellation_requested'
  | 'cancelled'
  | 'paid'
  | 'partial_paid';

export const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; color: string }> = {
  waiting_complete_details: { label: 'Waiting Complete Details', color: 'status-amber' },
  urgent_job: { label: 'Urgent Job', color: 'status-red' },
  quote_sent_waiting: { label: 'Quote Sent - Waiting', color: 'status-blue' },
  post_visit_quote_sent_waiting: { label: 'Post Visit-Quote Sent-Waiting', color: 'status-blue' },
  activate_customer: { label: 'Activate Customer', color: 'status-green' },
  quote_sent_need_follow_up: { label: 'Quote Sent - Need Follow Up', color: 'status-amber' },
  needs_quote: { label: 'Needs Quote', color: 'status-amber' },
  tech_making_quote: { label: 'Tech Making Quote', color: 'status-indigo' },
  waiting_customer_response: { label: 'Waiting Customer Response', color: 'status-blue' },
  need_tech: { label: 'Need Tech', color: 'status-amber' },
  scheduled: { label: 'Scheduled', color: 'status-blue' },
  job_in_progress: { label: 'Job in Progress', color: 'status-blue' },
  needs_reschedule: { label: 'Needs Reschedule', color: 'status-amber' },
  job_done: { label: 'Job Done', color: 'status-green' },
  payment_pending: { label: 'Payment Pending', color: 'status-amber' },
  cancellation_requested: { label: 'Cancellation Request', color: 'status-red' },
  cancelled: { label: 'Cancelled', color: 'status-muted' },
  paid: { label: 'Paid', color: 'status-green' },
  partial_paid: { label: 'Partial Paid', color: 'status-green' },
};

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Lead {
  id: string;
  job_id: string;
  status: LeadStatus;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_type: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  scheduled_date: string | null;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  amount: number | null;
  cs_notes: string | null;
  processor_notes: string | null;
  general_notes: string | null;
  created_by: string;
  assigned_cs: string | null;
  last_edited_by: string | null;
  last_edited_at: string | null;
  created_at: string;
  updated_at: string;
  // Payment fields
  payment_amount: number | null;
  payment_screenshot_url: string | null;
  // CS fields
  number_name: string | null;
  quote: string | null;
  service_details: string | null;
  customer_schedule_requirements: string | null;
  reference_name: string | null;
  // Processor fields
  tech_name: string | null;
  tech_number: string | null;
  terms: 'free_estimate' | 'quoted' | null;
  direction: 'incoming' | 'outgoing' | null;
  cs_tag?: CsTag | null;
  half_address?: string | null;
  labor_amount: number | null;
  material_amount: number | null;
  for_you_amount: number | null;
  for_us_amount: number | null;
  cancellation_reason?: string | null;
  // Joined fields
  creator_name?: string;
  editor_name?: string;
}


export type CancellationRequestStatus = 'pending' | 'approved' | 'rejected';

export interface LeadCancellationRequest {
  id: string;
  lead_id: string;
  previous_status: LeadStatus;
  requested_by: string;
  requested_by_role: AppRole;
  comment: string;
  proof: string | null;
  proof_image_path?: string | null;
  status: CancellationRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  requester_name?: string | null;
}

export interface LeadUpdate {
  id: string;
  lead_id: string;
  author_id: string;
  author_name: string;
  author_role: AppRole;
  content: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string | null;
  created_at: string;
}

export interface NavigationPermission {
  id: string;
  user_id: string;
  nav_section: string;
  allowed: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  lead_id: string | null;
  read: boolean;
  created_at: string;
}

export interface StatusPermission {
  id: string;
  user_id: string;
  status: LeadStatus;
  allowed: boolean;
}
