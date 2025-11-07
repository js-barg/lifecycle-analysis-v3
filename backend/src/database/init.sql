--
-- PostgreSQL database schema for Cloud Run / Cloud SQL
-- Cleaned version - removed local-specific configurations
--

-- Set recommended Cloud SQL settings
SET statement_timeout = '60s';
SET lock_timeout = '10s';
SET idle_in_transaction_session_timeout = '60s';
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Note: Database creation is handled by Cloud SQL console
-- Remove: DROP DATABASE and CREATE DATABASE statements

--
-- Table: ai_research_cache
--

CREATE TABLE IF NOT EXISTS public.ai_research_cache (
    cache_id uuid DEFAULT gen_random_uuid() NOT NULL,
    manufacturer character varying(255) NOT NULL,
    part_number character varying(255) NOT NULL,
    date_introduced date,
    end_of_sale_date date,
    end_of_sw_maintenance_date date,
    end_of_sw_vulnerability_maintenance_date date,
    last_day_of_support_date date,
    research_source text,
    research_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    data_sources jsonb,
    confidence_score integer DEFAULT 90,
    estimation_metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ai_research_cache_pkey PRIMARY KEY (cache_id),
    CONSTRAINT ai_research_cache_manufacturer_part_number_key UNIQUE (manufacturer, part_number)
);

--
-- Table: lifecycle_reports
--

CREATE TABLE IF NOT EXISTS public.lifecycle_reports (
    report_id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id character varying(255) NOT NULL,
    report_type character varying(50) DEFAULT 'comprehensive_excel'::character varying,
    customer_name character varying(255),
    eol_year_basis character varying(50) DEFAULT 'lastDayOfSupport'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    progress_percentage integer DEFAULT 0,
    current_step character varying(255),
    file_path text,
    file_size_bytes integer,
    total_products integer,
    total_quantity integer,
    critical_risk_count integer,
    high_risk_count integer,
    products_at_eol integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    generation_time_ms integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    error_message text,
    CONSTRAINT lifecycle_reports_pkey PRIMARY KEY (report_id)
);

--
-- Table: phase3_analysis
--

CREATE TABLE IF NOT EXISTS public.phase3_analysis (
    id SERIAL PRIMARY KEY,
    job_id character varying(255) NOT NULL,
    product_id character varying(255) NOT NULL,
    manufacturer character varying(255),
    product_category character varying(255),
    product_type character varying(100),
    description text,
    total_quantity integer DEFAULT 0,
    date_introduced date,
    end_of_sale_date date,
    end_of_sw_maintenance_date date,
    end_of_sw_vulnerability_maintenance_date date,
    last_day_of_support_date date,
    ai_enhanced boolean DEFAULT false,
    is_current_product boolean DEFAULT false,
    manufacturer_confidence integer DEFAULT 0,
    category_confidence integer DEFAULT 0,
    lifecycle_confidence integer DEFAULT 0,
    overall_confidence integer DEFAULT 0,
    support_coverage_percent numeric(5,2),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    research_completed_at timestamp without time zone,
    data_sources jsonb,
    total_value numeric(15,2),
    end_of_life_date date,
    lifecycle_status character varying(50),
    risk_level character varying(20),
    requires_review boolean DEFAULT false,
    estimation_metadata jsonb,
    CONSTRAINT phase3_analysis_job_id_product_id_key UNIQUE (job_id, product_id)
);

--
-- Table: phase3_jobs
--

CREATE TABLE IF NOT EXISTS public.phase3_jobs (
    job_id character varying(255) NOT NULL,
    phase2_job_id character varying(255),
    customer_name character varying(255),
    status character varying(50) DEFAULT 'initialized'::character varying,
    product_count integer DEFAULT 0,
    research_started_at timestamp without time zone,
    research_completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    filter_name character varying(255),
    filtered_count integer,
    original_count integer,
    products_researched integer DEFAULT 0,
    products_enhanced integer DEFAULT 0,
    products_no_data_found integer DEFAULT 0,
    completed_at timestamp without time zone,
    avg_confidence_score numeric(5,2),
    CONSTRAINT phase3_jobs_pkey PRIMARY KEY (job_id)
);

--
-- Table: raw_inventory
--

CREATE TABLE IF NOT EXISTS public.raw_inventory (
    id SERIAL PRIMARY KEY,
    job_id character varying(255) NOT NULL,
    product_id character varying(255),
    quantity integer,
    ship_date date,
    purchase_date date,
    order_date date,
    created_at timestamp without time zone DEFAULT now()
);

--
-- Create indexes for performance
--

CREATE INDEX IF NOT EXISTS idx_lifecycle_reports_created ON public.lifecycle_reports USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_lifecycle_reports_job ON public.lifecycle_reports USING btree (job_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_reports_status ON public.lifecycle_reports USING btree (status);
CREATE INDEX IF NOT EXISTS idx_phase3_job_product ON public.phase3_analysis USING btree (job_id, product_id);
CREATE INDEX IF NOT EXISTS idx_phase3_manufacturer ON public.phase3_analysis USING btree (manufacturer);
CREATE INDEX IF NOT EXISTS idx_raw_inventory_job_product ON public.raw_inventory USING btree (job_id, product_id);
CREATE INDEX IF NOT EXISTS idx_research_cache_lookup ON public.ai_research_cache USING btree (lower((manufacturer)::text), lower((part_number)::text));

--
-- Add foreign key constraint
--

ALTER TABLE public.lifecycle_reports 
    ADD CONSTRAINT lifecycle_reports_job_id_fkey 
    FOREIGN KEY (job_id) 
    REFERENCES public.phase3_jobs(job_id)
    ON DELETE CASCADE;

-- Grant permissions (Cloud SQL will use the connection user)
-- No need to specify owner or specific user permissions