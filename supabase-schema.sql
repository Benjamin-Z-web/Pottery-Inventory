-- ============================================================
-- Pottery Inventory — Supabase Schema
-- Run this in your Supabase project: SQL Editor → New query
-- ============================================================

-- Main inventory table
create table pottery (
  id                uuid primary key default gen_random_uuid(),
  sku               text not null unique,
  created_at        timestamptz not null default now(),

  -- Required fields
  name              text not null,
  place_of_origin   text not null,
  age               text not null,
  color             text not null,

  -- Details
  use_function      text,
  tribe_culture     text,
  dimensions        text,
  condition         text check (condition in ('Mint','Excellent','Good','Fair','Poor')),
  rarity            text check (rarity in ('Common','Uncommon','Rare','Museum-Grade')),
  originality       text check (originality in ('Authenticated Original','Suspected Original','Reproduction','Unknown')),
  location_in_case  text,
  status            text not null default 'Active' check (status in ('Active','Archived','Deaccessioned')),

  -- Acquisition
  date_acquired     date,
  location_acquired text,
  seller_donator    text,
  provenance        text,
  appraised_value   numeric(10,2),
  acquisition_cost  numeric(10,2),
  appraisal_date    date,
  appraiser_name    text,

  -- Research
  museums_comparable text,
  research_notes     text,

  -- Photos: array of public URLs from Supabase Storage
  photos            text[] not null default '{}'
);

-- Index for fast filtering
create index on pottery (status);
create index on pottery (condition);
create index on pottery (rarity);
create index on pottery (created_at desc);

-- Enable Row Level Security
alter table pottery enable row level security;

-- Only authenticated users can read/write
create policy "Authenticated users can read pottery"
  on pottery for select
  to authenticated
  using (true);

create policy "Authenticated users can insert pottery"
  on pottery for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update pottery"
  on pottery for update
  to authenticated
  using (true);

-- ============================================================
-- Storage bucket for photos
-- Run this AFTER creating the bucket named "pottery-photos"
-- in Storage → New bucket (set to Public)
-- ============================================================

-- Allow authenticated users to upload
create policy "Authenticated users can upload photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'pottery-photos');

-- Allow public read of photos (for display)
create policy "Public can view photos"
  on storage.objects for select
  to public
  using (bucket_id = 'pottery-photos');

-- Allow authenticated users to delete their photos
create policy "Authenticated users can delete photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'pottery-photos');
