
-- User roles
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'sales_advisor', 'telecaller');

-- Lead enums
CREATE TYPE lead_stage AS ENUM (
  'new_lead', 'contacted', 'interested',
  'site_visit_scheduled', 'site_visit_done',
  'negotiation', 'closed_won', 'not_interested', 'future_followup'
);
CREATE TYPE lead_temperature AS ENUM ('hot', 'warm', 'cold');
CREATE TYPE lead_source AS ENUM (
  'facebook_ads', 'instagram_ads', 'google_ads', 'website_form',
  'whatsapp', 'manual', 'walk_in', 'referral', 'ivr', 'portal', 'broker'
);
CREATE TYPE follow_up_outcome AS ENUM (
  'connected_interested', 'connected_not_interested',
  'not_reachable', 'number_invalid', 'callback_requested', 'voicemail'
);

-- Project enums
CREATE TYPE project_type AS ENUM ('plotted_development', 'villa', 'apartment', 'commercial');
CREATE TYPE project_status AS ENUM ('pre_launch', 'launched', 'under_construction', 'ready_to_move', 'sold_out');

-- Plot enums
CREATE TYPE plot_type AS ENUM ('corner', 'regular', 'park_facing', 'road_facing');
CREATE TYPE facing_direction AS ENUM ('north', 'south', 'east', 'west', 'north_east', 'north_west', 'south_east', 'south_west');
CREATE TYPE plot_status AS ENUM ('available', 'soft_hold', 'booked', 'registered', 'sold');

-- Booking enums
CREATE TYPE booking_status AS ENUM ('pending_approval', 'confirmed', 'cancelled');
CREATE TYPE payment_mode AS ENUM ('neft', 'rtgs', 'upi', 'cheque', 'demand_draft', 'cash', 'online');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'overdue', 'waived');

-- KYC status
CREATE TYPE kyc_status AS ENUM ('pending', 'verified', 'rejected');

-- Complaint status
CREATE TYPE complaint_status AS ENUM ('open', 'in_progress', 'resolved', 'escalated');
