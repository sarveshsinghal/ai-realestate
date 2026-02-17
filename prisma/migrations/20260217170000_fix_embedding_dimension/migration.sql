-- Ensure extension exists in the *target DB*
create extension if not exists vector;

-- Fix embedding dimension (required for HNSW)
alter table "ListingSearchIndex"
  alter column embedding type vector(1536)
  using embedding::vector(1536);

-- Vector ANN index
create index if not exists listing_searchindex_embedding_hnsw
on "ListingSearchIndex"
using hnsw (embedding vector_l2_ops);
