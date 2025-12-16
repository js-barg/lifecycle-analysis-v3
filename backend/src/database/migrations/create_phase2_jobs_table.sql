-- Create phase2_jobs table to store Phase 2 job metadata
-- This is needed for Cloud Run multi-instance deployments where in-memory storage doesn't work

CREATE TABLE IF NOT EXISTS public.phase2_jobs (
    job_id character varying(255) NOT NULL,
    customer_name character varying(255),
    phase3_ready boolean DEFAULT false,
    phase3_ready_at timestamp without time zone,
    phase3_filter_name character varying(255),
    phase3_filtered_items jsonb,
    phase3_stats jsonb,
    all_items jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT phase2_jobs_pkey PRIMARY KEY (job_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_phase2_jobs_phase3_ready ON public.phase2_jobs(phase3_ready) WHERE phase3_ready = true;

COMMENT ON TABLE public.phase2_jobs IS 'Stores Phase 2 job metadata including Phase 3 readiness and filtered items for Cloud Run compatibility';
COMMENT ON COLUMN public.phase2_jobs.phase3_filtered_items IS 'JSON array of filtered items ready for Phase 3 processing';
COMMENT ON COLUMN public.phase2_jobs.all_items IS 'JSON array of all Phase 2 items (for reference)';

