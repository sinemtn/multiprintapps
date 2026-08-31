--
-- PostgreSQL database dump
--

\restrict gLkwe99rOnCr8LC0wv1uhBfb1jJvSx0vbbH3ZmMkXhGIH5ezEv8fXurU1gRLjgi

-- Dumped from database version 16.14 (Debian 16.14-1.pgdg13+1)
-- Dumped by pg_dump version 16.14 (Debian 16.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: get_running_number(character varying); Type: FUNCTION; Schema: public; Owner: admin
--

CREATE FUNCTION public.get_running_number(p_sequence character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    current_month_str character varying;
    stored_month_str character varying;
    final_id character varying;
BEGIN
    -- 1. Get the current calendar month
    current_month_str := TO_CHAR(CURRENT_DATE, 'YYYYMM');

    -- 2. Get the month we last used from our tracker
    SELECT last_month INTO stored_month_str 
    FROM sequence_tracker 
    WHERE tracker_name = p_sequence
    FOR UPDATE; -- Lock the row to prevent race conditions

    -- 3. If the months don't match, reset the sequence
    IF current_month_str != stored_month_str THEN
		IF p_sequence = 'assignment' THEN
        	EXECUTE 'ALTER SEQUENCE assignment_id_seq RESTART WITH 1';
        ELSIF p_sequence = 'complaint' THEN
			EXECUTE 'ALTER SEQUENCE complaint_id_seq RESTART WITH 1';
		END IF;
        
		UPDATE sequence_tracker 
        SET last_month = current_month_str 
        WHERE tracker_name = p_sequence;
    END IF;

    -- 4. Generate the ID
	IF p_sequence = 'assignment' THEN
    	final_id := 'SJ/' || current_month_str || '/' || LPAD(nextval('assignment_id_seq')::text, 4, '0');
	ELSIF p_sequence = 'complaint' THEN
		final_id := 'CO/' || current_month_str || '/' || LPAD(nextval('complaint_id_seq')::text, 4, '0');
	END IF;
    RETURN final_id;
END;
$$;


ALTER FUNCTION public.get_running_number(p_sequence character varying) OWNER TO admin;

--
-- Name: nanoid(integer, text); Type: FUNCTION; Schema: public; Owner: admin
--

CREATE FUNCTION public.nanoid(size integer DEFAULT 21, alphabet text DEFAULT '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-'::text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  id TEXT := '';
  res_bytes BYTEA;
  alphabet_len INTEGER := length(alphabet);
  i INTEGER := 0;
BEGIN
  -- Grab the random bytes we need
  res_bytes := gen_random_bytes(size);
  
  WHILE i < size LOOP
    -- Map each byte to a character in our alphabet
    id := id || substr(alphabet, (get_byte(res_bytes, i) % alphabet_len) + 1, 1);
    i := i + 1;
  END LOOP;
  
  RETURN id;
END;
$$;


ALTER FUNCTION public.nanoid(size integer, alphabet text) OWNER TO admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assignment; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.assignment (
    assigment_id character varying(20) DEFAULT public.get_running_number('assignment'::character varying) NOT NULL,
    complaint character varying(20),
    task character varying(20),
    customer character varying(20),
    pic character varying(20),
    status character varying(20),
    has_items boolean DEFAULT false,
    validated_at timestamp without time zone,
    validated_by character varying(20),
    authorized_at timestamp without time zone,
    authorized_by character varying(20),
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    mp_no character varying(20) NOT NULL,
    slug character varying(50) DEFAULT public.nanoid() NOT NULL
);


ALTER TABLE public.assignment OWNER TO admin;


--
-- Name: assignment_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.assignment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.assignment_id_seq OWNER TO admin;

--
-- Name: assignment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.assignment_id_seq OWNED BY public.assignment.assigment_id;


--
-- Name: complaint; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.complaint (
    complaint_id character varying(20) DEFAULT public.get_running_number('complaint'::character varying) NOT NULL,
    mp_no character varying(20) NOT NULL,
    description character varying(100) NOT NULL,
    customer character varying(100) NOT NULL,
    sales character varying(100) NOT NULL,
    resolved_at timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    status character varying(20) NOT NULL,
    slug character varying(50) DEFAULT public.nanoid() NOT NULL
);


ALTER TABLE public.complaint OWNER TO admin;

--
-- Name: complaint_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.complaint_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.complaint_id_seq OWNER TO admin;

--
-- Name: complaint_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.complaint_id_seq OWNED BY public.complaint.complaint_id;


--
-- Name: menu; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.menu (
    description character varying(100) NOT NULL,
    menu_id character varying(5) NOT NULL
);


ALTER TABLE public.menu OWNER TO admin;

--
-- Name: ms_billing_account; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ms_billing_account (
    name character varying(100) NOT NULL,
    account_id character varying(20)
);


ALTER TABLE public.ms_billing_account OWNER TO admin;

--
-- Name: ms_branch; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ms_branch (
    branch_id character varying(20) NOT NULL,
    localtion character varying(20) NOT NULL,
    name character varying(100)
);


ALTER TABLE public.ms_branch OWNER TO admin;

--
-- Name: ms_customer; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ms_customer (
    name character varying(100) NOT NULL,
    address character varying(200),
    billing_account integer,
    quota integer DEFAULT 0 NOT NULL,
    periode date,
    customer_id character varying(20) NOT NULL,
    active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.ms_customer OWNER TO admin;

--
-- Name: ms_location; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ms_location (
    location_id character varying(20) NOT NULL,
    name character varying(100)
);


ALTER TABLE public.ms_location OWNER TO admin;

--
-- Name: ms_printer; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ms_printer (
    printer_id character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    manufacture character varying(100),
    category character varying(20),
    toner character varying(20),
    supplier character varying(20),
    active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.ms_printer OWNER TO admin;

--
-- Name: ms_printer_category; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ms_printer_category (
    category_id character varying(20) NOT NULL,
    description character varying(100) NOT NULL
);


ALTER TABLE public.ms_printer_category OWNER TO admin;

--
-- Name: ms_sparepart; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ms_sparepart (
    sparepart_id character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    active boolean DEFAULT true
);


ALTER TABLE public.ms_sparepart OWNER TO admin;

--
-- Name: ms_supplier; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ms_supplier (
    supplier_id character varying(20) NOT NULL,
    name character varying(100),
    address character varying(200),
    active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.ms_supplier OWNER TO admin;

--
-- Name: ms_toner; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ms_toner (
    toner_id character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    category character varying(20) NOT NULL,
    active boolean
);


ALTER TABLE public.ms_toner OWNER TO admin;

--
-- Name: ms_toner_category; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ms_toner_category (
    description character varying(100) NOT NULL,
    category_id character varying(5) NOT NULL
);


ALTER TABLE public.ms_toner_category OWNER TO admin;

--
-- Name: permission; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.permission (
    active boolean DEFAULT true,
    granted character varying(6),
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    menu integer NOT NULL,
    role character varying(5) NOT NULL
);


ALTER TABLE public.permission OWNER TO admin;

--
-- Name: role; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.role (
    name character varying(100) NOT NULL,
    role_id character varying(5) NOT NULL
);


ALTER TABLE public.role OWNER TO admin;

--
-- Name: sequence_tracker; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.sequence_tracker (
    tracker_name character varying(20) NOT NULL,
    last_month character varying(6)
);


ALTER TABLE public.sequence_tracker OWNER TO admin;

--
-- Name: stock_printer; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.stock_printer (
    mp_no character varying(20) NOT NULL,
    printer character varying(20) NOT NULL,
    serial_no character varying(20) NOT NULL,
    feature character varying(20),
    buy_date date NOT NULL,
    status character varying(20) NOT NULL,
    location character varying(100) NOT NULL,
    branch character varying(100),
    active boolean DEFAULT true NOT NULL,
    notes character varying(4000)
);


ALTER TABLE public.stock_printer OWNER TO admin;

--
-- Name: stock_toner; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.stock_toner (
    id bigint NOT NULL,
    toner character varying(20) NOT NULL,
    location character varying(100),
    branch character varying(100),
    qty integer DEFAULT 0 NOT NULL,
    notes character varying(4000),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    customer character varying(100)
);


ALTER TABLE public.stock_toner OWNER TO admin;

--
-- Name: stock_toner_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.stock_toner_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_toner_id_seq OWNER TO admin;

--
-- Name: stock_toner_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.stock_toner_id_seq OWNED BY public.stock_toner.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.users (
    name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    user_id character varying(20) NOT NULL,
    active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.users OWNER TO admin;

--
-- Name: stock_toner id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.stock_toner ALTER COLUMN id SET DEFAULT nextval('public.stock_toner_id_seq'::regclass);


--
-- Data for Name: assignment; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.assignment (assigment_id, complaint, task, customer, pic, status, has_items, validated_at, validated_by, authorized_at, authorized_by, created_at, updated_at, mp_no, slug) FROM stdin;
\.


--
-- Data for Name: complaint; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.complaint (complaint_id, mp_no, description, customer, sales, resolved_at, created_at, updated_at, status, slug) FROM stdin;
\.


--
-- Data for Name: menu; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.menu (description, menu_id) FROM stdin;
\.


--
-- Data for Name: ms_billing_account; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ms_billing_account (name, account_id) FROM stdin;
\.


--
-- Data for Name: ms_branch; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ms_branch (branch_id, localtion, name) FROM stdin;
\.


--
-- Data for Name: ms_customer; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ms_customer (name, address, billing_account, quota, periode, customer_id, active) FROM stdin;
\.


--
-- Data for Name: ms_location; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ms_location (location_id, name) FROM stdin;
\.


--
-- Data for Name: ms_printer; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ms_printer (printer_id, name, manufacture, category, toner, supplier, active) FROM stdin;
\.


--
-- Data for Name: ms_printer_category; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ms_printer_category (category_id, description) FROM stdin;
\.


--
-- Data for Name: ms_sparepart; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ms_sparepart (sparepart_id, name, active) FROM stdin;
\.


--
-- Data for Name: ms_supplier; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ms_supplier (supplier_id, name, address, active) FROM stdin;
\.


--
-- Data for Name: ms_toner; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ms_toner (toner_id, name, category, active) FROM stdin;
\.


--
-- Data for Name: ms_toner_category; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ms_toner_category (description, category_id) FROM stdin;
\.


--
-- Data for Name: permission; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.permission (active, granted, created_at, updated_at, menu, role) FROM stdin;
\.


--
-- Data for Name: role; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.role (name, role_id) FROM stdin;
\.


--
-- Data for Name: sequence_tracker; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.sequence_tracker (tracker_name, last_month) FROM stdin;
\.


--
-- Data for Name: stock_printer; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.stock_printer (mp_no, printer, serial_no, feature, buy_date, status, location, branch, active, notes) FROM stdin;
\.


--
-- Data for Name: stock_toner; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.stock_toner (id, toner, location, branch, qty, notes, created_at, customer) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.users (name, email, password, role, user_id, active) FROM stdin;
\.


--
-- Name: assignment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.assignment_id_seq', 1, false);


--
-- Name: complaint_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.complaint_id_seq', 1, false);


--
-- Name: stock_toner_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.stock_toner_id_seq', 1, false);


--
-- Name: assignment assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.assignment
    ADD CONSTRAINT assignment_pkey PRIMARY KEY (assigment_id);

--
-- Name: assignment_item; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE IF NOT EXISTS public.assignment_item (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    assignment_no character varying(20) NOT NULL REFERENCES public.assignment(assigment_id) ON DELETE CASCADE,
    type character varying(50) NOT NULL,
    item_id character varying(100) NOT NULL,
    description character varying(4000) DEFAULT ''::character varying NOT NULL,
    serial_number character varying(100) DEFAULT ''::character varying NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    note character varying(4000) DEFAULT ''::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.assignment_item OWNER TO admin;



--
-- Name: complaint complaint_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.complaint
    ADD CONSTRAINT complaint_pkey PRIMARY KEY (complaint_id);


--
-- Name: menu menu_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.menu
    ADD CONSTRAINT menu_pkey PRIMARY KEY (menu_id);


--
-- Name: ms_branch ms_branch_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ms_branch
    ADD CONSTRAINT ms_branch_pkey PRIMARY KEY (branch_id);


--
-- Name: ms_customer ms_customer_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ms_customer
    ADD CONSTRAINT ms_customer_pkey PRIMARY KEY (customer_id);


--
-- Name: ms_location ms_location_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ms_location
    ADD CONSTRAINT ms_location_pkey PRIMARY KEY (location_id);


--
-- Name: ms_printer_category ms_printer_category_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ms_printer_category
    ADD CONSTRAINT ms_printer_category_pkey PRIMARY KEY (category_id);


--
-- Name: ms_printer ms_printer_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ms_printer
    ADD CONSTRAINT ms_printer_pkey PRIMARY KEY (printer_id);


--
-- Name: ms_sparepart ms_sparepart_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ms_sparepart
    ADD CONSTRAINT ms_sparepart_pkey PRIMARY KEY (sparepart_id);


--
-- Name: ms_supplier ms_supplier_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ms_supplier
    ADD CONSTRAINT ms_supplier_pkey PRIMARY KEY (supplier_id);


--
-- Name: ms_toner_category ms_toner_category_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ms_toner_category
    ADD CONSTRAINT ms_toner_category_pkey PRIMARY KEY (category_id);


--
-- Name: ms_toner ms_toner_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ms_toner
    ADD CONSTRAINT ms_toner_pkey PRIMARY KEY (toner_id);


--
-- Name: permission permission_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.permission
    ADD CONSTRAINT permission_pkey PRIMARY KEY (role, menu);


--
-- Name: role role_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (role_id);


--
-- Name: sequence_tracker sequence_tracker_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.sequence_tracker
    ADD CONSTRAINT sequence_tracker_pkey PRIMARY KEY (tracker_name);


--
-- Name: assignment slug; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.assignment
    ADD CONSTRAINT slug UNIQUE (slug);


--
-- Name: stock_printer stock_printer_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.stock_printer
    ADD CONSTRAINT stock_printer_pkey PRIMARY KEY (mp_no);


--
-- Name: stock_toner stock_toner_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.stock_toner
    ADD CONSTRAINT stock_toner_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- PostgreSQL database dump complete
--

--
-- Minimal business seed data for local frontend/backend workflow testing
--

CREATE TABLE IF NOT EXISTS public.stock_sparepart (
    id bigserial PRIMARY KEY,
    sparepart character varying(20) NOT NULL,
    location character varying(100),
    branch character varying(100),
    qty integer DEFAULT 0 NOT NULL,
    customer character varying(100),
    notes character varying(4000),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

INSERT INTO public.role (role_id, name) VALUES
    ('ADM', 'Super Admin'),
    ('TECH', 'Teknisi')
ON CONFLICT (role_id) DO NOTHING;

INSERT INTO public.users (user_id, name, email, password, role, active) VALUES
    ('USR001', 'Admin Multiprint', 'admin@multiprint.local', 'admin123', 'ADM', true),
    ('USR002', 'Teknisi Multiprint', 'teknisi@multiprint.local', 'tech123', 'TECH', true)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.ms_customer (customer_id, name, address, billing_account, quota, periode, active) VALUES
    ('CUST001', 'PT Maju Sejahtera', 'Jl. Ikan Buntek No. 2 Waru', 1001, 10, CURRENT_DATE, true),
    ('CUST002', 'PT Info Global', 'Jl. Hamzah Haz No. 3A', 1002, 5, CURRENT_DATE, true)
ON CONFLICT (customer_id) DO NOTHING;

INSERT INTO public.ms_supplier (supplier_id, name, address, active) VALUES
    ('SUP001', 'PT Supplier Prima', 'Jl. Gudang Raya No. 10', true)
ON CONFLICT (supplier_id) DO NOTHING;

INSERT INTO public.ms_toner_category (category_id, description) VALUES
    ('TN', 'Toner')
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO public.ms_toner (toner_id, name, category, active) VALUES
    ('TON001', 'HP 80A Black', 'TN', true),
    ('TON002', 'Canon 325 Black', 'TN', true)
ON CONFLICT (toner_id) DO NOTHING;

INSERT INTO public.ms_printer_category (category_id, description) VALUES
    ('PRN', 'Printer')
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO public.ms_printer (printer_id, name, manufacture, category, toner, supplier, active) VALUES
    ('PRN001', 'HP LaserJet Pro M201', 'HP', 'PRN', 'TON001', 'SUP001', true),
    ('PRN002', 'Canon LBP 6030', 'Canon', 'PRN', 'TON002', 'SUP001', true)
ON CONFLICT (printer_id) DO NOTHING;

INSERT INTO public.ms_sparepart (sparepart_id, name, active) VALUES
    ('SPR001', 'Pickup Roller', true),
    ('SPR002', 'Fuser Film', true)
ON CONFLICT (sparepart_id) DO NOTHING;

INSERT INTO public.stock_printer (mp_no, printer, serial_no, feature, buy_date, status, location, branch, active, notes) VALUES
    ('MP001', 'PRN001', 'SN001', 'DN', CURRENT_DATE, 'ready', 'Warehouse', 'Jakarta', true, 'Seed printer ready for workflow testing')
ON CONFLICT (mp_no) DO NOTHING;

INSERT INTO public.stock_toner (toner, location, branch, qty, notes, customer) VALUES
    ('TON001', 'Warehouse', 'Jakarta', 12, 'Seed toner stock', 'CUST001'),
    ('TON002', 'Warehouse', 'Jakarta', 8, 'Seed toner stock', 'CUST002');

INSERT INTO public.stock_sparepart (sparepart, location, branch, qty, customer, notes, created_at) VALUES
    ('SPR001', 'Warehouse', 'Jakarta', 4, 'CUST001', 'Seed sparepart stock', NOW()),
    ('SPR002', 'Warehouse', 'Jakarta', 2, 'CUST002', 'Seed sparepart stock', NOW());

\unrestrict gLkwe99rOnCr8LC0wv1uhBfb1jJvSx0vbbH3ZmMkXhGIH5ezEv8fXurU1gRLjgi

