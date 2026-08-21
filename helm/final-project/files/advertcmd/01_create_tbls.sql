-- 1.ADS
-- Table: public.advert

-- DROP TABLE IF EXISTS public.advert;

CREATE TABLE IF NOT EXISTS public.advert
(
    id uuid NOT NULL,
    created_by BIGINT NOT NULL,
    created_time timestamp(0) without time zone NOT NULL,
    updated_time timestamp(0) without time zone,
    title character varying(255),
    description character varying(255),
    condition smallint NOT NULL,
    size_number smallint,
    brand uuid NOT NULL,
    price bigint NOT NULL,
    gender text,
    shipping_available boolean NOT NULL,
    size_letter text,
    current_state text NOT NULL DEFAULT 'VALIDATION',
    CONSTRAINT advert_pkey PRIMARY KEY (id),
    CONSTRAINT check_size_letter CHECK (size_letter = ANY (ARRAY['XS'::text, 'S'::text, 'M'::text, 'L'::text, 'XL'::text, 'XXL'::text, 'XXXL'::text])),
    CONSTRAINT check_state CHECK (current_state = ANY (ARRAY['VALIDATION'::text, 'ACTIVE'::text, 'INVALID'::text, 'INACTIVE'::text, 'BLOCKED'::text])),
    CONSTRAINT check_gender CHECK (gender = ANY (ARRAY['MALE'::text, 'FEMALE'::text, 'ANY'::text]))
)

TABLESPACE pg_default;


-- 2. brands

-- Table: public.brand

-- DROP TABLE IF EXISTS public.brand;

CREATE TABLE IF NOT EXISTS public.brand
(
    id uuid NOT NULL,
    name text,
    CONSTRAINT brand_pkey PRIMARY KEY (id),
    CONSTRAINT unique_name UNIQUE (name)
)

TABLESPACE pg_default;


-- Index: brand_name_hash_idx

-- DROP INDEX IF EXISTS public.brand_name_hash_idx;

CREATE INDEX IF NOT EXISTS brand_name_hash_idx
    ON public.brand USING hash
    (name)
    TABLESPACE pg_default;


-- 3. category

-- Table: public.category

-- DROP TABLE IF EXISTS public.category;

CREATE TABLE IF NOT EXISTS public.category
(
    id character(6),
    name character varying(255),
    parent_key character(6),
    CONSTRAINT category_pkey PRIMARY KEY (id),
    CONSTRAINT category_parent_key_foreign FOREIGN KEY (parent_key)
        REFERENCES public.category (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;


-- 4. color

-- Table: public.color

-- DROP TABLE IF EXISTS public.color;

CREATE TABLE IF NOT EXISTS public.color
(
    id character varying(255),
    name_rus character varying(255),
    query_string text,
    hex character varying(255),
    CONSTRAINT color_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;


-- 5. item_category

-- Table: public.item_category

-- DROP TABLE IF EXISTS public.item_category;

CREATE TABLE IF NOT EXISTS public.item_category
(
    advert_id uuid NOT NULL,
    category_id character(6),
    CONSTRAINT item_category_advert_id_foreign FOREIGN KEY (advert_id)
        REFERENCES public.advert (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT item_category_category_id_foreign FOREIGN KEY (category_id)
        REFERENCES public.category (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;

-- Index: idx_item_category_advertid

-- DROP INDEX IF EXISTS public.idx_item_category_advertid;

CREATE INDEX IF NOT EXISTS idx_item_category_advertid
    ON public.item_category USING hash
    (advert_id)
    TABLESPACE pg_default;
-- Index: idx_item_category_categoryid

-- DROP INDEX IF EXISTS public.idx_item_category_categoryid;

CREATE INDEX IF NOT EXISTS idx_item_category_categoryid
    ON public.item_category USING hash
    (category_id)
    TABLESPACE pg_default;


-- 6. item_color

-- Table: public.item_color

-- DROP TABLE IF EXISTS public.item_color;

CREATE TABLE IF NOT EXISTS public.item_color
(
    advert_id uuid NOT NULL,
    color_id character varying(255),
    color_order smallint NOT NULL,
    CONSTRAINT item_color_pkey PRIMARY KEY (advert_id, color_id),
    CONSTRAINT item_color_advert_id_fkey FOREIGN KEY (advert_id)
        REFERENCES public.advert (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT item_color_advert_id_foreign FOREIGN KEY (advert_id)
        REFERENCES public.advert (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT item_color_color_id_fkey FOREIGN KEY (color_id)
        REFERENCES public.color (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT item_color_color_id_foreign FOREIGN KEY (color_id)
        REFERENCES public.color (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;

-- Index: idx_item_color_advertid

-- DROP INDEX IF EXISTS public.idx_item_color_advertid;

CREATE INDEX IF NOT EXISTS idx_item_color_advertid
    ON public.item_color USING hash
    (advert_id)
    TABLESPACE pg_default;
-- Index: idx_item_color_colorid

-- DROP INDEX IF EXISTS public.idx_item_color_colorid;

CREATE INDEX IF NOT EXISTS idx_item_color_colorid
    ON public.item_color USING hash
    (color_id)
    TABLESPACE pg_default;


-- 7. pictures

-- Table: public.pictures

-- DROP TABLE IF EXISTS public.pictures;

CREATE TABLE IF NOT EXISTS public.pictures
(
    url character varying(255),
    picture_order smallint,
    advert_id uuid NOT NULL REFERENCES advert (id) ON DELETE CASCADE
)

TABLESPACE pg_default;

-- Index: idx_pictures_advertid

-- DROP INDEX IF EXISTS public.idx_pictures_advertid;

CREATE INDEX IF NOT EXISTS idx_pictures_advertid
    ON public.pictures USING hash
    (advert_id)
    TABLESPACE pg_default;


-- 8. videos

-- Table: public.videos

-- DROP TABLE IF EXISTS public.videos;

CREATE TABLE IF NOT EXISTS public.videos
(
    url character varying(255),
    advert_id uuid NOT NULL
)

TABLESPACE pg_default;



-- ?. addr_attr

-- Table: public.address_attributes

-- DROP TABLE IF EXISTS public.address_attributes;

CREATE TABLE IF NOT EXISTS public.address_attributes
(
    advert_id uuid NOT NULL,
    lat character varying(255),
    lon character varying(255),
    country character varying(255),
    state character varying(255),
    county character varying(255),
    district character varying(255),
    city character varying(255),
    postcode character varying(255),
    locality character varying(255),
    street character varying(255),
    housenumber character varying(255),
    name character varying(255),
    type character varying(255),
    osm_type character varying(255),
    osm_id bigint,
    osm_key character varying(255),
    osm_value character varying(255),
    CONSTRAINT fk_advert FOREIGN KEY (advert_id)
        REFERENCES public.advert (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
)

TABLESPACE pg_default;


-- Index: idx_address_attributes_advert_id

-- DROP INDEX IF EXISTS public.idx_address_attributes_advert_id;

CREATE INDEX IF NOT EXISTS idx_address_attributes_advert_id
    ON public.address_attributes USING btree
    (advert_id ASC NULLS LAST)
    WITH (fillfactor=100, deduplicate_items=True)
    TABLESPACE pg_default;


