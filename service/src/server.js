import 'dotenv/config'
import crypto from 'node:crypto'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import pg from 'pg'

const { Pool } = pg

const PORT = Number(process.env.PORT ?? 5002)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5174'
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://admin:Admin12345@localhost:5432/assetmanagement_db'
const JWT_SECRET = process.env.JWT_SECRET ?? 'multiprint-express-local-jwt-key-change-before-production'
const COOKIE_SECURE = String(process.env.COOKIE_SECURE ?? 'false').toLowerCase() === 'true'
const AUTH_COOKIE = 'multiprint_auth'
const CSRF_COOKIE = 'multiprint_csrf'

const pool = new Pool({ connectionString: DATABASE_URL })
const app = express()

const ROLE_IDS = ['admin', 'sales', 'sales-admin', 'kepala-teknisi', 'teknisi', 'warehouse']
const PERMISSION_MODULES = [
  'dashboard',
  'complaint',
  'assignment',
  'assignment-item',
  'stock-printer',
  'stock-toner',
  'stock-sparepart',
  'master-printer',
  'master-toner',
  'master-sparepart',
  'master-supplier',
  'master-customer',
  'master-user',
  'audit-trail',
  'settings',
]
const PERMISSION_ACTIONS = ['view', 'create', 'update', 'delete', 'resolve', 'workflow']
const DEFAULT_PERMISSIONS = {
  admin: PERMISSION_MODULES.reduce((acc, module) => ({ ...acc, [module]: PERMISSION_ACTIONS }), {}),
  sales: {
    dashboard: ['view'],
    complaint: ['view'],
    assignment: ['view'],
    'audit-trail': ['view'],
  },
  'sales-admin': {
    dashboard: ['view'],
    complaint: ['view', 'create', 'update', 'resolve'],
    assignment: ['view'],
    'master-customer': ['view', 'create', 'update', 'delete'],
    'audit-trail': ['view'],
  },
  'kepala-teknisi': {
    dashboard: ['view'],
    complaint: ['view'],
    assignment: ['view', 'create', 'update', 'delete', 'workflow', 'resolve'],
    'audit-trail': ['view'],
  },
  teknisi: {
    dashboard: ['view'],
    complaint: ['view'],
    assignment: ['view', 'workflow'],
    'assignment-item': ['view', 'create', 'update', 'delete'],
    'audit-trail': ['view'],
    'stock-printer': ['view'],
    'stock-toner': ['view'],
    'stock-sparepart': ['view'],
  },
  warehouse: {
    dashboard: ['view'],
    complaint: ['view'],
    assignment: ['view', 'workflow'],
    'audit-trail': ['view'],
    'stock-printer': ['view', 'create', 'update', 'delete'],
    'stock-toner': ['view', 'create', 'update', 'delete'],
    'stock-sparepart': ['view', 'create', 'update', 'delete'],
  },
}

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

function envelope(res, statusCode, data = null, error = null, pagination = null) {
  return res.status(statusCode).json({ statusCode, ok: statusCode >= 200 && statusCode < 300, data, pagination, error })
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

function normalizeStatus(status) {
  const value = String(status ?? '').toLowerCase()
  if (['new', 'pending', 'progress', 'ready_to_print', 'technician_completed', 'validated', 'warehouse_validated', 'solved', 'cancelled'].includes(value)) return value
  if (value === 'ready-to-print' || value === 'ready to print') return 'ready_to_print'
  if (value === 'technician-completed' || value === 'technician completed' || value === 'selesai-teknisi' || value === 'selesai teknisi') return 'technician_completed'
  if (value === 'warehouse-validated' || value === 'warehouse validated') return 'warehouse_validated'
  if (value === 'in progress') return 'progress'
  if (value === 'valid' || value === 'approved') return 'validated'
  if (value === 'resolved' || value === 'completed' || value === 'done') return 'solved'
  return 'pending'
}

function normalizeRole(role) {
  const value = String(role ?? '').toLowerCase().replace(/[_\s]+/g, '-')
  if (value === 'adm' || value === 'admin' || value === 'super admin') return 'admin'
  if (value === 'sls' || value === 'sales') return 'sales'
  if (value === 'sales-admin' || value === 'salesadmin' || value === 'sa') return 'sales-admin'
  if (value === 'kepala-teknisi' || value === 'head-technician' || value === 'ktech') return 'kepala-teknisi'
  if (value === 'teknisi' || value === 'technician' || value === 'tech') return 'teknisi'
  if (value === 'warehouse' || value === 'wh') return 'warehouse'
  return 'teknisi'
}

function dbRole(role) {
  if (role === 'admin') return 'ADM'
  if (role === 'sales') return 'SLS'
  if (role === 'sales-admin') return 'SALES_ADMIN'
  if (role === 'kepala-teknisi') return 'KEPALA_TEKNISI'
  if (role === 'warehouse') return 'WAREHOUSE'
  return 'TEKNISI'
}

function mapUser(row) {
  if (!row) return null
  return {
    id: row.user_id ?? row.id,
    name: row.name,
    role: normalizeRole(row.role),
    email: row.email,
    active: row.active,
  }
}

function mapCustomerBranch(row) {
  if (!row) return null
  return {
    id: row.branch_id ?? row.id,
    customerId: row.customer_id,
    name: row.branch_name ?? row.name,
    address: row.branch_address ?? row.address,
    active: row.branch_active ?? row.active,
  }
}

function mapCustomer(row, branches = null) {
  if (!row) return null
  const mappedBranches = branches ?? (row.branches ? row.branches.map(mapCustomerBranch) : [])
  const type = row.type === 'multisite' ? 'account' : (row.type ?? 'single')
  return {
    customerId: row.customer_id,
    name: row.name,
    address: row.address,
    billingAccount: row.billing_account,
    quota: row.quota,
    periode: row.periode,
    type,
    parentCustomerId: row.parent_customer_id ?? null,
    parentCustomerName: row.parent_customer_name ?? null,
    children: row.children ?? [],
    branches: mappedBranches,
    active: row.active,
  }
}

function normalizeCustomerType(value) {
  const normalized = text(value).toLowerCase().replace(/[_\s]+/g, '-')
  if (normalized === 'account' || normalized === 'multisite' || normalized === 'customer-account') return 'account'
  return 'single'
}

function mapComplaint(row) {
  return {
    complaintNo: row.complaint_id,
    mpNo: row.mp_no,
    description: row.description,
    customer: mapCustomer(row),
    customerBranch: mapCustomerBranch(row.customer_branch_id ? row : null),
    customerBranchId: row.customer_branch_id,
    sales: row.sales,
    status: normalizeStatus(row.status),
    complaintDate: row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapAssignment(row, items = []) {
  return {
    assignmentNo: row.assigment_id,
    complaintNo: row.complaint,
    mpNo: row.mp_no,
    status: normalizeStatus(row.status),
    customer: mapCustomer(row),
    customerBranch: mapCustomerBranch(row.customer_branch_id ? row : null),
    customerBranchId: row.customer_branch_id,
    task: row.task,
    pic: row.pic,
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    validatedAt: row.validated_at,
    validatedBy: row.validated_by,
    authorizedAt: row.authorized_at,
    authorizedBy: row.authorized_by,
  }
}

function mapAssignmentItem(row) {
  return {
    id: row.id,
    type: row.type,
    itemId: row.item_id,
    description: row.description,
    serialNumber: row.serial_number,
    quantity: row.quantity,
    note: row.note,
  }
}

function safeInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function text(value) {
  return String(value ?? '').trim()
}

function isBlank(value) {
  return text(value) === ''
}

function normalizeEntityType(value) {
  return text(value).toLowerCase().replace(/[_\s]+/g, '-')
}

function sanitizeAuditValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeAuditValue)
  if (!value || typeof value !== 'object') return value
  return Object.entries(value).reduce((acc, [key, entry]) => {
    if (['password', 'token', 'authorization', 'cookie', 'csrf'].includes(String(key).toLowerCase())) {
      acc[key] = '[REDACTED]'
      return acc
    }
    acc[key] = sanitizeAuditValue(entry)
    return acc
  }, {})
}

function auditDiff(beforeData, afterData) {
  const before = sanitizeAuditValue(beforeData ?? {})
  const after = sanitizeAuditValue(afterData ?? {})
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].sort().reduce((acc, key) => {
    const oldValue = before[key]
    const newValue = after[key]
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      acc[key] = { before: oldValue ?? null, after: newValue ?? null }
    }
    return acc
  }, {})
}

function mapAudit(row) {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    actorRole: normalizeRole(row.actor_role),
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    assignmentNo: row.assignment_no,
    complaintNo: row.complaint_no,
    customerId: row.customer_id,
    customerBranchId: row.customer_branch_id,
    beforeData: row.before_data ?? null,
    afterData: row.after_data ?? null,
    diffData: row.diff_data ?? null,
    description: row.description,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }
}

async function writeAudit(req, payload) {
  try {
    const beforeData = sanitizeAuditValue(payload.beforeData ?? null)
    const afterData = sanitizeAuditValue(payload.afterData ?? null)
    const diffData = sanitizeAuditValue(payload.diffData ?? auditDiff(beforeData, afterData))
    await pool.query(
      `INSERT INTO audit_trail (
        actor_user_id, actor_name, actor_role, entity_type, entity_id, action,
        assignment_no, complaint_no, customer_id, customer_branch_id,
        before_data, after_data, diff_data, description, ip_address, user_agent
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        payload.actorUserId ?? req.user?.sub ?? null,
        payload.actorName ?? req.user?.name ?? null,
        payload.actorRole ?? req.user?.role ?? null,
        normalizeEntityType(payload.entityType),
        text(payload.entityId),
        text(payload.action),
        payload.assignmentNo || null,
        payload.complaintNo || null,
        payload.customerId || null,
        payload.customerBranchId || null,
        beforeData,
        afterData,
        diffData,
        payload.description || null,
        req.ip ?? null,
        req.get('user-agent') ?? null,
      ],
    )
  } catch (error) {
    console.error('audit trail write failed', error)
  }
}

function validateRequired(res, source, fields) {
  const missing = fields.find(({ key }) => isBlank(source[key]))
  if (!missing) return true
  envelope(res, 400, null, `${missing.label} is required`)
  return false
}

function validateParamId(req, res, label = 'ID') {
  if (!isBlank(req.params.id)) return true
  envelope(res, 400, null, `${label} is invalid`)
  return false
}

async function validateOptionalComplaintNo(res, complaintNo) {
  if (isBlank(complaintNo)) return null
  const normalizedComplaintNo = text(complaintNo)
  const { rowCount } = await pool.query('SELECT 1 FROM complaint WHERE complaint_id = $1 LIMIT 1', [normalizedComplaintNo])
  if (rowCount) return normalizedComplaintNo
  envelope(res, 400, null, `Complaint No. ${normalizedComplaintNo} was not found`)
  return false
}

function parseDateTime(value) {
  if (isBlank(value)) return null
  const raw = text(value)
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? `${raw}:00+07:00` : raw
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? false : date
}

async function getSettings() {
  const { rows } = await pool.query('SELECT key, value FROM app_setting')
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]))
  return {
    complaintPendingAfterHours: safeInt(values.complaint_pending_after_hours, 24),
  }
}

async function upsertSetting(key, value) {
  await pool.query(
    `INSERT INTO app_setting (key, value, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, String(value)],
  )
}

async function syncComplaintPendingStatus() {
  const settings = await getSettings()
  await pool.query(
    `UPDATE complaint
     SET status = 'pending', updated_at = now()
     WHERE lower(status) = 'new'
       AND created_at <= now() - ($1::int * interval '1 hour')`,
    [settings.complaintPendingAfterHours],
  )
}

function defaultPermissionRows() {
  const rows = []
  for (const role of ROLE_IDS) {
    for (const module of PERMISSION_MODULES) {
      for (const action of PERMISSION_ACTIONS) {
        rows.push({
          role,
          module,
          action,
          allowed: role === 'admin' || Boolean(DEFAULT_PERMISSIONS[role]?.[module]?.includes(action)),
        })
      }
    }
  }
  return rows
}

async function permissionMapForRole(role) {
  const normalizedRole = normalizeRole(role)
  if (normalizedRole === 'admin') {
    return PERMISSION_MODULES.reduce((acc, module) => ({ ...acc, [module]: [...PERMISSION_ACTIONS] }), {})
  }
  const { rows } = await pool.query(
    'SELECT module, action FROM role_permission WHERE role=$1 AND allowed=true ORDER BY module, action',
    [normalizedRole],
  )
  return rows.reduce((acc, row) => {
    acc[row.module] = acc[row.module] ?? []
    acc[row.module].push(row.action)
    return acc
  }, {})
}

async function userCan(user, module, action) {
  if (!user) return false
  if (user.role === 'admin') return true
  const { rowCount } = await pool.query(
    'SELECT 1 FROM role_permission WHERE role=$1 AND module=$2 AND action=$3 AND allowed=true LIMIT 1',
    [user.role, module, action],
  )
  return rowCount > 0
}

function requirePermission(module, action) {
  return asyncRoute(async (req, res, next) => {
    if (!req.user) return envelope(res, 401, null, 'Unauthorized')
    if (!await userCan(req.user, module, action)) return envelope(res, 403, null, 'Forbidden')
    return next()
  })
}

async function validateCustomerBranch(res, customerId, branchId) {
  const { rows } = await pool.query('SELECT customer_id, type FROM ms_customer WHERE customer_id=$1 LIMIT 1', [customerId])
  const customer = rows[0]
  if (!customer) {
    envelope(res, 400, null, 'Customer is invalid')
    return false
  }
  if (customer.type === 'multisite' || customer.type === 'account') {
    if (isBlank(branchId)) {
      envelope(res, 400, null, 'Customer branch is required for customer account')
      return false
    }
    const branch = await pool.query('SELECT 1 FROM ms_customer_branch WHERE branch_id=$1 AND customer_id=$2 AND active=true LIMIT 1', [branchId, customerId])
    if (!branch.rowCount) {
      envelope(res, 400, null, 'Customer branch is invalid')
      return false
    }
    return text(branchId)
  }
  return isBlank(branchId) ? null : text(branchId)
}

async function validateStockBranch(res, customerId, branchValue) {
  if (isBlank(customerId)) return true
  const { rows } = await pool.query('SELECT type FROM ms_customer WHERE customer_id=$1 LIMIT 1', [customerId])
  const customer = rows[0]
  if (!customer) return true
  if (customer.type !== 'multisite' && customer.type !== 'account') return true
  if (isBlank(branchValue)) {
    envelope(res, 400, null, 'Branch is required for customer account')
    return false
  }
  const branch = await pool.query(
    'SELECT 1 FROM ms_customer_branch WHERE customer_id=$1 AND active=true AND (lower(branch_id)=lower($2) OR lower(name)=lower($2)) LIMIT 1',
    [customerId, text(branchValue)],
  )
  if (branch.rowCount) return true
  envelope(res, 400, null, 'Branch is invalid for this customer account')
  return false
}

function parseDashboardDate(value, endOfDay = false) {
  if (isBlank(value)) return null
  const raw = text(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false
  const time = endOfDay ? '23:59:59.999' : '00:00:00.000'
  const date = new Date(`${raw}T${time}+07:00`)
  return Number.isNaN(date.getTime()) ? false : date
}

function localDateKey(value) {
  const date = new Date(value)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function weekKey(value) {
  const date = new Date(value)
  const localDate = new Date(`${localDateKey(date)}T00:00:00+07:00`)
  const firstDay = new Date(localDate.getFullYear(), 0, 1)
  const dayNumber = Math.floor((localDate - firstDay) / 86400000) + 1
  const week = Math.ceil((dayNumber + firstDay.getDay()) / 7)
  return `${localDate.getFullYear()}-W${String(week).padStart(2, '0')}`
}

async function assignmentWithItems(assignmentNo) {
  const rows = await assignmentRows('WHERE a.assigment_id = $1', [assignmentNo])
  if (!rows[0]) return null
  const items = await getAssignmentItems(assignmentNo)
  return { row: rows[0], items, mapped: mapAssignment(rows[0], items) }
}

async function returnAssignment(res, assignmentNo, statusCode = 200) {
  const result = await assignmentWithItems(assignmentNo)
  if (!result) return envelope(res, 404, null, 'Assignment not found')
  return envelope(res, statusCode, result.mapped)
}

async function auditAssignmentChange(req, beforeData, afterData, action, description) {
  const after = afterData ?? beforeData
  await writeAudit(req, {
    entityType: 'assignment',
    entityId: after?.assignmentNo ?? beforeData?.assignmentNo ?? req.params.id,
    action,
    assignmentNo: after?.assignmentNo ?? beforeData?.assignmentNo ?? req.params.id,
    complaintNo: after?.complaintNo ?? beforeData?.complaintNo,
    customerId: after?.customer?.customerId ?? beforeData?.customer?.customerId,
    customerBranchId: after?.customerBranchId ?? beforeData?.customerBranchId,
    beforeData,
    afterData,
    description,
  })
}

function isFinalAssignmentStatus(status) {
  return ['ready_to_print', 'technician_completed', 'validated', 'warehouse_validated', 'solved', 'cancelled'].includes(normalizeStatus(status))
}

function authCookieOptions() {
  return { httpOnly: true, sameSite: 'strict', secure: COOKIE_SECURE, maxAge: 8 * 60 * 60 * 1000, path: '/' }
}

function csrfCookieOptions() {
  return { httpOnly: false, sameSite: 'strict', secure: COOKIE_SECURE, maxAge: 8 * 60 * 60 * 1000, path: '/' }
}

function createToken(user) {
  return jwt.sign({ sub: user.id, name: user.name, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '8h' })
}

function verifyAspNetPassword(password, stored) {
  try {
    const payload = Buffer.from(stored, 'base64')
    if (payload.length < 13 || payload[0] !== 1) return false
    const prf = payload.readUInt32BE(1)
    const iterations = payload.readUInt32BE(5)
    const saltLength = payload.readUInt32BE(9)
    const salt = payload.subarray(13, 13 + saltLength)
    const hash = payload.subarray(13 + saltLength)
    const digest = prf === 1 ? 'sha256' : prf === 2 ? 'sha512' : 'sha1'
    const actual = crypto.pbkdf2Sync(password, salt, iterations, hash.length, digest)
    return crypto.timingSafeEqual(actual, hash)
  } catch {
    return false
  }
}

async function verifyPassword(password, stored) {
  if (!stored) return false
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) return bcrypt.compare(password, stored)
  if (stored.startsWith('AQAAAA')) return verifyAspNetPassword(password, stored)
  return password === stored
}

async function authenticate(req, _res, next) {
  const token = req.cookies[AUTH_COOKIE]
  if (!token) return next()
  try {
    req.user = jwt.verify(token, JWT_SECRET)
  } catch {
    req.user = null
  }
  return next()
}

function requireAuth(req, res, next) {
  if (!req.user) return envelope(res, 401, null, 'Unauthorized')
  return next()
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return envelope(res, 401, null, 'Unauthorized')
    if (!roles.includes(req.user.role)) return envelope(res, 403, null, 'Forbidden')
    return next()
  }
}

function hasRole(user, ...roles) {
  return Boolean(user && roles.includes(user.role))
}

function sameUser(value, user) {
  const candidate = String(value ?? '').toLowerCase()
  return candidate === String(user?.sub ?? '').toLowerCase() || candidate === String(user?.name ?? '').toLowerCase()
}

function sameUserInList(value, user) {
  const candidates = String(value ?? '').toLowerCase().split('|').map((item) => item.trim())
  return candidates.includes(String(user?.sub ?? '').toLowerCase()) || candidates.includes(String(user?.name ?? '').toLowerCase())
}

function canViewComplaintRow(user, row) {
  if (hasRole(user, 'admin', 'sales-admin', 'kepala-teknisi', 'warehouse')) return true
  if (user?.role === 'sales') return sameUser(row.sales, user)
  if (user?.role === 'teknisi') return sameUserInList(row.assignment_pics, user)
  return false
}

function canViewAssignmentRow(user, row) {
  if (hasRole(user, 'admin', 'sales-admin', 'kepala-teknisi', 'warehouse')) return true
  if (user?.role === 'teknisi') return sameUser(row.pic, user)
  if (user?.role === 'sales') return sameUser(row.complaint_sales, user)
  return false
}

async function canViewAuditRow(user, row) {
  if (hasRole(user, 'admin')) return true
  if (row.assignment_no) {
    const assignments = await assignmentRows('WHERE a.assigment_id = $1', [row.assignment_no])
    if (assignments[0] && canViewAssignmentRow(user, assignments[0])) return true
  }
  if (row.complaint_no) {
    const complaints = await complaintRows('WHERE c.complaint_id = $1', [row.complaint_no])
    if (complaints[0] && canViewComplaintRow(user, complaints[0])) return true
  }
  if (row.customer_id && await userCan(user, 'master-customer', 'view')) return true
  if (row.actor_user_id && sameUser(row.actor_user_id, user)) return true
  return false
}

function requireMutationCsrf(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  if (req.path === '/api/auth/login') return next()
  if (!req.user) return next()
  const cookie = req.cookies[CSRF_COOKIE]
  const header = req.header('X-XSRF-TOKEN')
  if (!cookie || !header || cookie !== header) return envelope(res, 403, null, 'Invalid CSRF token')
  return next()
}

app.use(authenticate)
app.use(requireMutationCsrf)

async function bootstrap() {
  await pool.query('ALTER TABLE users ALTER COLUMN password TYPE varchar(255)')
  await pool.query('ALTER TABLE ms_printer ADD COLUMN IF NOT EXISTS supplier character varying(20)')
  await pool.query("ALTER TABLE ms_customer ADD COLUMN IF NOT EXISTS type character varying(20) DEFAULT 'single' NOT NULL")
  await pool.query('ALTER TABLE ms_customer ADD COLUMN IF NOT EXISTS parent_customer_id character varying(20)')
  await pool.query("UPDATE ms_customer SET type='single' WHERE type IS NULL OR btrim(type) = ''")
  await pool.query("UPDATE ms_customer SET type='account' WHERE type='multisite'")
  await pool.query(`CREATE TABLE IF NOT EXISTS ms_customer_branch (
    branch_id character varying(20) PRIMARY KEY,
    customer_id character varying(20) NOT NULL REFERENCES ms_customer(customer_id) ON DELETE CASCADE,
    name character varying(100) NOT NULL,
    address character varying(200),
    active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
  )`)
  await pool.query('ALTER TABLE complaint ADD COLUMN IF NOT EXISTS customer_branch character varying(20)')
  await pool.query('ALTER TABLE assignment ADD COLUMN IF NOT EXISTS customer_branch character varying(20)')
  await pool.query(`CREATE TABLE IF NOT EXISTS app_setting (
    key character varying(80) PRIMARY KEY,
    value character varying(4000) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
  )`)
  await pool.query(`CREATE TABLE IF NOT EXISTS role_permission (
    role character varying(30) NOT NULL,
    module character varying(50) NOT NULL,
    action character varying(30) NOT NULL,
    allowed boolean DEFAULT false NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (role, module, action)
  )`)
  await pool.query(`CREATE TABLE IF NOT EXISTS audit_trail (
    id bigserial PRIMARY KEY,
    actor_user_id character varying(50),
    actor_name character varying(100),
    actor_role character varying(30),
    entity_type character varying(50) NOT NULL,
    entity_id character varying(120) NOT NULL,
    action character varying(50) NOT NULL,
    assignment_no character varying(50),
    complaint_no character varying(50),
    customer_id character varying(50),
    customer_branch_id character varying(50),
    before_data jsonb,
    after_data jsonb,
    diff_data jsonb,
    description character varying(500),
    ip_address character varying(80),
    user_agent character varying(500),
    created_at timestamp without time zone DEFAULT now() NOT NULL
  )`)
  await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_assignment_no ON audit_trail (assignment_no)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_actor_user_id ON audit_trail (actor_user_id)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_customer_id ON audit_trail (customer_id)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_complaint_no ON audit_trail (complaint_no)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_trail (created_at)')
  await pool.query(`CREATE TABLE IF NOT EXISTS stock_sparepart (
    id bigserial PRIMARY KEY,
    sparepart character varying(20) NOT NULL,
    location character varying(100),
    branch character varying(100),
    qty integer DEFAULT 0 NOT NULL,
    customer character varying(100),
    notes character varying(4000),
    created_at timestamp without time zone DEFAULT now() NOT NULL
  )`)
  await pool.query("DELETE FROM users WHERE user_id IS NULL OR btrim(user_id) = ''")
  await pool.query("DELETE FROM ms_printer WHERE printer_id IS NULL OR btrim(printer_id) = ''")
  await pool.query("DELETE FROM ms_toner WHERE toner_id IS NULL OR btrim(toner_id) = ''")
  await pool.query("DELETE FROM ms_sparepart WHERE sparepart_id IS NULL OR btrim(sparepart_id) = ''")
  await pool.query("DELETE FROM ms_supplier WHERE supplier_id IS NULL OR btrim(supplier_id) = ''")
  await pool.query("DELETE FROM ms_customer WHERE customer_id IS NULL OR btrim(customer_id) = ''")
  await pool.query("DELETE FROM stock_printer WHERE mp_no IS NULL OR btrim(mp_no) = ''")
  await pool.query("DELETE FROM stock_toner WHERE toner IS NULL OR btrim(toner) = ''")
  await pool.query("DELETE FROM stock_sparepart WHERE sparepart IS NULL OR btrim(sparepart) = ''")
  await upsertSetting('complaint_pending_after_hours', '24')
  for (const permission of defaultPermissionRows()) {
    await pool.query(
      `INSERT INTO role_permission (role, module, action, allowed, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (role, module, action) DO NOTHING`,
      [permission.role, permission.module, permission.action, permission.allowed],
    )
  }
  const { rows } = await pool.query("SELECT 1 FROM users WHERE active = true AND lower(role) IN ('adm', 'admin') LIMIT 1")
  if (rows.length) return
  const id = process.env.ADMIN_USER_ID ?? 'ADM001'
  const email = process.env.ADMIN_EMAIL ?? 'admin@multiprint.local'
  const password = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? 'Admin12345!', 10)
  const name = process.env.ADMIN_NAME ?? 'Administrator'
  await pool.query(
    `INSERT INTO users (user_id, name, email, password, role, active)
     VALUES ($1, $2, $3, $4, 'ADM', true)
     ON CONFLICT (user_id) DO NOTHING`,
    [id, name, email, password],
  )
}

async function getAssignmentItems(assignmentNo) {
  const { rows } = await pool.query('SELECT * FROM assignment_item WHERE assignment_no = $1 ORDER BY id', [assignmentNo])
  return rows.map(mapAssignmentItem)
}

async function complaintRows(where = '', params = []) {
  await syncComplaintPendingStatus()
  const { rows } = await pool.query(
    `SELECT c.*, cu.customer_id, cu.name, cu.address, cu.billing_account, cu.type,
            b.branch_id AS customer_branch_id, b.name AS branch_name, b.address AS branch_address, b.active AS branch_active,
            assigned.pics AS assignment_pics
     FROM complaint c
     LEFT JOIN ms_customer cu ON cu.customer_id = c.customer
     LEFT JOIN ms_customer_branch b ON b.branch_id = c.customer_branch
     LEFT JOIN LATERAL (
       SELECT string_agg(DISTINCT a.pic, '|') AS pics
       FROM assignment a
       WHERE a.complaint = c.complaint_id
     ) assigned ON true
     ${where}
     ORDER BY c.created_at DESC NULLS LAST, c.complaint_id DESC`,
    params,
  )
  return rows
}

async function assignmentRows(where = '', params = []) {
  const { rows } = await pool.query(
    `SELECT a.*, cu.customer_id, cu.name, cu.address, cu.billing_account, cu.type, c.sales AS complaint_sales,
            b.branch_id AS customer_branch_id, b.name AS branch_name, b.address AS branch_address, b.active AS branch_active
     FROM assignment a
     LEFT JOIN ms_customer cu ON cu.customer_id = a.customer
     LEFT JOIN ms_customer_branch b ON b.branch_id = a.customer_branch
     LEFT JOIN complaint c ON c.complaint_id = a.complaint
     ${where}
     ORDER BY a.created_at DESC NULLS LAST, a.assigment_id DESC`,
    params,
  )
  return rows
}

async function customerRows(where = '', params = []) {
  const scopedWhere = where
    .replace(/\bWHERE\s+customer_id\b/gi, 'WHERE c.customer_id')
    .replace(/\bAND\s+customer_id\b/gi, 'AND c.customer_id')
    .replace(/\bWHERE\s+active\b/gi, 'WHERE c.active')
    .replace(/\bAND\s+active\b/gi, 'AND c.active')
    .replace(/\bWHERE\s+type\b/gi, 'WHERE c.type')
    .replace(/\bAND\s+type\b/gi, 'AND c.type')
  const { rows } = await pool.query(
    `SELECT c.customer_id, c.name, c.address, c.billing_account, c.quota, c.periode, c.type, c.parent_customer_id, p.name AS parent_customer_name, c.active
     FROM ms_customer c
     LEFT JOIN ms_customer p ON p.customer_id = c.parent_customer_id
     ${scopedWhere}
     ORDER BY c.customer_id`,
    params,
  )
  const ids = rows.map((row) => row.customer_id)
  if (!ids.length) return rows.map((row) => mapCustomer(row, []))
  const branches = await pool.query(
    'SELECT branch_id, customer_id, name, address, active FROM ms_customer_branch WHERE customer_id = ANY($1) ORDER BY customer_id, branch_id',
    [ids],
  )
  const branchMap = branches.rows.reduce((acc, row) => {
    acc[row.customer_id] = acc[row.customer_id] ?? []
    acc[row.customer_id].push(mapCustomerBranch(row))
    return acc
  }, {})
  const children = await pool.query(
    `SELECT child.customer_id, child.name, child.address, child.parent_customer_id, child.active
     FROM ms_customer child
     WHERE child.parent_customer_id = ANY($1)
     ORDER BY child.customer_id`,
    [ids],
  )
  const childMap = children.rows.reduce((acc, row) => {
    acc[row.parent_customer_id] = acc[row.parent_customer_id] ?? []
    acc[row.parent_customer_id].push({
      customerId: row.customer_id,
      id: row.customer_id,
      name: row.name,
      address: row.address,
      active: row.active,
    })
    return acc
  }, {})
  return rows.map((row) => mapCustomer({ ...row, children: childMap[row.customer_id] ?? [] }, branchMap[row.customer_id] ?? []))
}

app.get('/api/health', (_req, res) => envelope(res, 200, { status: 'ok' }))

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const identifier = String(req.body.identifier ?? req.body.email ?? req.body.username ?? '').trim()
  const password = String(req.body.password ?? '')
  const { rows } = await pool.query('SELECT * FROM users WHERE lower(user_id) = lower($1) OR lower(email) = lower($1) LIMIT 1', [identifier])
  const row = rows[0]
  if (!row || !row.active) {
    await writeAudit(req, {
      entityType: 'auth',
      entityId: identifier || 'unknown',
      action: 'login-failed',
      actorUserId: (row?.user_id ?? identifier) || null,
      actorName: row?.name ?? null,
      actorRole: row?.role ?? null,
      afterData: { identifier, reason: row && !row.active ? 'inactive-user' : 'invalid-credentials' },
      description: row && !row.active ? `Login failed for inactive user ${identifier}` : `Login failed for ${identifier || 'unknown user'}`,
    })
    return envelope(res, 401, null, 'Invalid credentials')
  }
  if (!await verifyPassword(password, row.password)) {
    await writeAudit(req, {
      entityType: 'auth',
      entityId: row.user_id,
      action: 'login-failed',
      actorUserId: row.user_id,
      actorName: row.name,
      actorRole: row.role,
      afterData: { identifier, reason: 'invalid-credentials' },
      description: `Login failed for ${row.user_id}`,
    })
    return envelope(res, 401, null, 'Invalid credentials')
  }

  if (!row.password.startsWith('$2') && !row.password.startsWith('AQAAAA')) {
    await pool.query('UPDATE users SET password = $1 WHERE user_id = $2', [await bcrypt.hash(password, 10), row.user_id])
  }

  const user = mapUser(row)
  user.permissions = await permissionMapForRole(user.role)
  await writeAudit(req, {
    entityType: 'auth',
    entityId: user.id,
    action: 'login',
    actorUserId: user.id,
    actorName: user.name,
    actorRole: user.role,
    afterData: { userId: user.id, role: user.role },
    description: `Login success for ${user.id}`,
  })
  res.cookie(AUTH_COOKIE, createToken(user), authCookieOptions())
  res.cookie(CSRF_COOKIE, crypto.randomBytes(24).toString('hex'), csrfCookieOptions())
  return envelope(res, 200, user)
}))

app.get('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE user_id = $1 AND active = true LIMIT 1', [req.user.sub])
  const user = mapUser(rows[0])
  if (!user) return envelope(res, 401, null, 'Unauthorized')
  user.permissions = await permissionMapForRole(user.role)
  return envelope(res, 200, user)
}))

app.post('/api/auth/logout', requireAuth, asyncRoute(async (req, res) => {
  await writeAudit(req, {
    entityType: 'auth',
    entityId: req.user.sub,
    action: 'logout',
    afterData: { userId: req.user.sub, role: req.user.role },
    description: `Logout ${req.user.sub}`,
  })
  res.clearCookie(AUTH_COOKIE, { path: '/' })
  res.clearCookie(CSRF_COOKIE, { path: '/' })
  return envelope(res, 200, 'Logged out')
}))

app.get('/api/settings', requireAuth, requireRoles('admin'), asyncRoute(async (_req, res) => {
  return envelope(res, 200, await getSettings())
}))

app.put('/api/settings', requireAuth, requireRoles('admin'), asyncRoute(async (req, res) => {
  const before = await getSettings()
  const hours = safeInt(req.body.complaintPendingAfterHours, 24)
  if (hours < 1) return envelope(res, 400, null, 'SLA pending complaint minimal 1 jam')
  await upsertSetting('complaint_pending_after_hours', hours)
  await syncComplaintPendingStatus()
  const after = await getSettings()
  await writeAudit(req, {
    entityType: 'settings',
    entityId: 'app-setting',
    action: 'update',
    beforeData: before,
    afterData: after,
    description: 'Update application settings',
  })
  return envelope(res, 200, after)
}))

app.get('/api/permissions', requireAuth, requireRoles('admin'), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT role, module, action, allowed FROM role_permission ORDER BY role, module, action')
  return envelope(res, 200, {
    roles: ROLE_IDS,
    modules: PERMISSION_MODULES,
    actions: PERMISSION_ACTIONS,
    permissions: rows,
  })
}))

app.put('/api/permissions', requireAuth, requireRoles('admin'), asyncRoute(async (req, res) => {
  const beforeRows = (await pool.query('SELECT role, module, action, allowed FROM role_permission ORDER BY role, module, action')).rows
  const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : []
  for (const permission of permissions) {
    const role = normalizeRole(permission.role)
    const module = text(permission.module)
    const action = text(permission.action)
    if (!ROLE_IDS.includes(role) || !PERMISSION_MODULES.includes(module) || !PERMISSION_ACTIONS.includes(action)) {
      return envelope(res, 400, null, 'Permission is invalid')
    }
    const allowed = role === 'admin' ? true : permission.allowed === true
    await pool.query(
      `INSERT INTO role_permission (role, module, action, allowed, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (role, module, action) DO UPDATE SET allowed=EXCLUDED.allowed, updated_at=now()`,
      [role, module, action, allowed],
    )
  }
  const { rows } = await pool.query('SELECT role, module, action, allowed FROM role_permission ORDER BY role, module, action')
  await writeAudit(req, {
    entityType: 'settings',
    entityId: 'role-permission',
    action: 'update',
    beforeData: beforeRows,
    afterData: rows,
    description: 'Update role permission matrix',
  })
  return envelope(res, 200, {
    roles: ROLE_IDS,
    modules: PERMISSION_MODULES,
    actions: PERMISSION_ACTIONS,
    permissions: rows,
  })
}))

app.get('/api/audit-trail', requireAuth, requirePermission('audit-trail', 'view'), asyncRoute(async (req, res) => {
  const page = Math.max(1, safeInt(req.query.page, 1))
  const pageSize = Math.min(100, Math.max(1, safeInt(req.query.pageSize, 25)))
  const where = []
  const params = []
  const addFilter = (sql, value) => {
    params.push(value)
    where.push(sql.replace('?', `$${params.length}`))
  }
  if (!isBlank(req.query.assignmentId)) addFilter('assignment_no = ?', text(req.query.assignmentId))
  if (!isBlank(req.query.userId)) addFilter('actor_user_id = ?', text(req.query.userId))
  if (!isBlank(req.query.customerId)) addFilter('customer_id = ?', text(req.query.customerId))
  if (!isBlank(req.query.complaintId)) addFilter('complaint_no = ?', text(req.query.complaintId))
  if (!isBlank(req.query.entityType)) addFilter('entity_type = ?', normalizeEntityType(req.query.entityType))
  if (!isBlank(req.query.action)) addFilter('action = ?', text(req.query.action))
  const from = parseDashboardDate(req.query.from)
  const to = parseDashboardDate(req.query.to, true)
  if (from === false || to === false) return envelope(res, 400, null, 'Date format must be YYYY-MM-DD')
  if (from) addFilter('created_at >= ?', from)
  if (to) addFilter('created_at <= ?', to)
  const { rows } = await pool.query(
    `SELECT * FROM audit_trail
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC, id DESC
     LIMIT 500`,
    params,
  )
  const visible = []
  for (const row of rows) {
    if (await canViewAuditRow(req.user, row)) visible.push(mapAudit(row))
  }
  const start = (page - 1) * pageSize
  return envelope(res, 200, visible.slice(start, start + pageSize), null, { page, pageSize, total: visible.length })
}))

app.get('/api/audit-trail/:id', requireAuth, requirePermission('audit-trail', 'view'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Audit ID')) return
  const { rows } = await pool.query('SELECT * FROM audit_trail WHERE id=$1 LIMIT 1', [req.params.id])
  if (!rows[0]) return envelope(res, 404, null, 'Audit trail not found')
  if (!await canViewAuditRow(req.user, rows[0])) return envelope(res, 403, null, 'Forbidden')
  return envelope(res, 200, mapAudit(rows[0]))
}))

app.get('/api/customer', requireAuth, requirePermission('master-customer', 'view'), asyncRoute(async (_req, res) => {
  return envelope(res, 200, await customerRows())
}))

app.post('/api/customer', requireAuth, requirePermission('master-customer', 'create'), asyncRoute(async (req, res) => {
  if (!validateRequired(res, req.body, [{ key: 'id', label: 'Customer ID' }, { key: 'name', label: 'Nama Customer' }])) return
  const type = normalizeCustomerType(req.body.type)
  const parentCustomerId = type === 'single' && !isBlank(req.body.parentCustomerId) ? text(req.body.parentCustomerId) : null
  if (parentCustomerId) {
    const parent = await pool.query("SELECT 1 FROM ms_customer WHERE customer_id=$1 AND type='account' AND active=true LIMIT 1", [parentCustomerId])
    if (!parent.rowCount) return envelope(res, 400, null, 'Customer Account is invalid')
  }
  const { rows } = await pool.query(
    `INSERT INTO ms_customer (customer_id, name, address, billing_account, quota, periode, type, parent_customer_id, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING customer_id`,
    [req.body.id, req.body.name, req.body.address ?? '', req.body.billingAccount || null, safeInt(req.body.quota), req.body.periode || null, type, parentCustomerId, req.body.active !== false],
  )
  const customers = await customerRows('WHERE customer_id=$1', [rows[0].customer_id])
  await writeAudit(req, {
    entityType: 'customer',
    entityId: rows[0].customer_id,
    action: 'create',
    customerId: rows[0].customer_id,
    afterData: customers[0],
    description: `Create customer ${rows[0].customer_id}`,
  })
  return envelope(res, 201, customers[0])
}))

app.put('/api/customer/:id', requireAuth, requirePermission('master-customer', 'update'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Customer ID')) return
  if (!validateRequired(res, req.body, [{ key: 'name', label: 'Nama Customer' }])) return
  const beforeRows = await customerRows('WHERE customer_id=$1', [req.params.id])
  const type = normalizeCustomerType(req.body.type)
  const parentCustomerId = type === 'single' && !isBlank(req.body.parentCustomerId) ? text(req.body.parentCustomerId) : null
  if (parentCustomerId) {
    if (parentCustomerId === req.params.id) return envelope(res, 400, null, 'Customer cannot be its own parent')
    const parent = await pool.query("SELECT 1 FROM ms_customer WHERE customer_id=$1 AND type='account' AND active=true LIMIT 1", [parentCustomerId])
    if (!parent.rowCount) return envelope(res, 400, null, 'Customer Account is invalid')
  }
  const { rows } = await pool.query(
    `UPDATE ms_customer SET name=$1, address=$2, billing_account=$3, quota=$4, periode=$5, type=$6, parent_customer_id=$7, active=$8
     WHERE customer_id=$9 RETURNING customer_id`,
    [req.body.name, req.body.address ?? '', req.body.billingAccount || null, safeInt(req.body.quota), req.body.periode || null, type, parentCustomerId, req.body.active !== false, req.params.id],
  )
  if (!rows[0]) return envelope(res, 404, null, 'Customer not found')
  const customers = await customerRows('WHERE customer_id=$1', [req.params.id])
  await writeAudit(req, {
    entityType: 'customer',
    entityId: req.params.id,
    action: 'update',
    customerId: req.params.id,
    beforeData: beforeRows[0] ?? null,
    afterData: customers[0],
    description: `Update customer ${req.params.id}`,
  })
  return envelope(res, 200, customers[0])
}))

app.delete('/api/customer/:id', requireAuth, requirePermission('master-customer', 'delete'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Customer ID')) return
  const beforeRows = await customerRows('WHERE customer_id=$1', [req.params.id])
  const result = await pool.query('UPDATE ms_customer SET active=false WHERE customer_id=$1', [req.params.id])
  if (!result.rowCount) return envelope(res, 404, null, 'Customer not found')
  const afterRows = await customerRows('WHERE customer_id=$1', [req.params.id])
  await writeAudit(req, {
    entityType: 'customer',
    entityId: req.params.id,
    action: 'delete',
    customerId: req.params.id,
    beforeData: beforeRows[0] ?? null,
    afterData: afterRows[0] ?? null,
    description: `Delete customer ${req.params.id}`,
  })
  return envelope(res, 200, 'Deleted')
}))

app.post('/api/customer/:id/branches', requireAuth, requirePermission('master-customer', 'create'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Customer ID')) return
  const branchId = req.body.branchId ?? req.body.id
  if (!validateRequired(res, { ...req.body, branchId }, [{ key: 'branchId', label: 'Branch ID' }, { key: 'name', label: 'Branch Name' }])) return
  const { rows } = await pool.query(
    `INSERT INTO ms_customer_branch (branch_id, customer_id, name, address, active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, now(), now())
     RETURNING branch_id, customer_id, name, address, active`,
    [branchId, req.params.id, req.body.name, req.body.address ?? '', req.body.active !== false],
  )
  await pool.query("UPDATE ms_customer SET type='account' WHERE customer_id=$1", [req.params.id])
  await writeAudit(req, {
    entityType: 'customer-branch',
    entityId: rows[0].branch_id,
    action: 'create',
    customerId: req.params.id,
    customerBranchId: rows[0].branch_id,
    afterData: mapCustomerBranch(rows[0]),
    description: `Create customer branch ${rows[0].branch_id}`,
  })
  return envelope(res, 201, mapCustomerBranch(rows[0]))
}))

app.put('/api/customer/:id/branches/:branchId', requireAuth, requirePermission('master-customer', 'update'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Customer ID')) return
  if (isBlank(req.params.branchId)) return envelope(res, 400, null, 'Branch ID is invalid')
  if (!validateRequired(res, req.body, [{ key: 'name', label: 'Branch Name' }])) return
  const before = (await pool.query('SELECT branch_id, customer_id, name, address, active FROM ms_customer_branch WHERE customer_id=$1 AND branch_id=$2', [req.params.id, req.params.branchId])).rows[0]
  const { rows } = await pool.query(
    `UPDATE ms_customer_branch SET name=$1, address=$2, active=$3, updated_at=now()
     WHERE customer_id=$4 AND branch_id=$5
     RETURNING branch_id, customer_id, name, address, active`,
    [req.body.name, req.body.address ?? '', req.body.active !== false, req.params.id, req.params.branchId],
  )
  if (!rows[0]) return envelope(res, 404, null, 'Customer branch not found')
  await writeAudit(req, {
    entityType: 'customer-branch',
    entityId: req.params.branchId,
    action: 'update',
    customerId: req.params.id,
    customerBranchId: req.params.branchId,
    beforeData: mapCustomerBranch(before),
    afterData: mapCustomerBranch(rows[0]),
    description: `Update customer branch ${req.params.branchId}`,
  })
  return envelope(res, 200, mapCustomerBranch(rows[0]))
}))

app.delete('/api/customer/:id/branches/:branchId', requireAuth, requirePermission('master-customer', 'delete'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Customer ID')) return
  if (isBlank(req.params.branchId)) return envelope(res, 400, null, 'Branch ID is invalid')
  const before = (await pool.query('SELECT branch_id, customer_id, name, address, active FROM ms_customer_branch WHERE customer_id=$1 AND branch_id=$2', [req.params.id, req.params.branchId])).rows[0]
  const result = await pool.query('UPDATE ms_customer_branch SET active=false, updated_at=now() WHERE customer_id=$1 AND branch_id=$2', [req.params.id, req.params.branchId])
  if (!result.rowCount) return envelope(res, 404, null, 'Customer branch not found')
  const after = (await pool.query('SELECT branch_id, customer_id, name, address, active FROM ms_customer_branch WHERE customer_id=$1 AND branch_id=$2', [req.params.id, req.params.branchId])).rows[0]
  await writeAudit(req, {
    entityType: 'customer-branch',
    entityId: req.params.branchId,
    action: 'delete',
    customerId: req.params.id,
    customerBranchId: req.params.branchId,
    beforeData: mapCustomerBranch(before),
    afterData: mapCustomerBranch(after),
    description: `Delete customer branch ${req.params.branchId}`,
  })
  return envelope(res, 200, 'Deleted')
}))

app.get('/api/user', requireAuth, requirePermission('master-user', 'view'), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT user_id, name, email, role, active FROM users ORDER BY user_id')
  return envelope(res, 200, rows.map(mapUser))
}))

app.get('/api/lookups/users', requireAuth, requireRoles('admin', 'sales', 'sales-admin', 'kepala-teknisi', 'teknisi', 'warehouse'), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT user_id, name, email, role, active FROM users WHERE active = true ORDER BY name, user_id')
  return envelope(res, 200, rows.map(mapUser))
}))

app.get('/api/lookups/customers', requireAuth, asyncRoute(async (_req, res) => {
  const customers = await customerRows("WHERE active = true AND type = 'single'")
  return envelope(res, 200, customers)
}))

app.post('/api/user', requireAuth, requirePermission('master-user', 'create'), asyncRoute(async (req, res) => {
  if (!validateRequired(res, req.body, [
    { key: 'id', label: 'Kode User' },
    { key: 'name', label: 'Nama' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'password', label: 'Password' },
  ])) return
  const password = await bcrypt.hash(String(req.body.password ?? 'Password123!'), 10)
  const { rows } = await pool.query(
    `INSERT INTO users (user_id, name, email, password, role, active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING user_id, name, email, role, active`,
    [req.body.id, req.body.name, req.body.email, password, dbRole(normalizeRole(req.body.role)), req.body.active !== false],
  )
  const created = mapUser(rows[0])
  await writeAudit(req, {
    entityType: 'user',
    entityId: created.id,
    action: 'create',
    afterData: created,
    description: `Create user ${created.id}`,
  })
  return envelope(res, 201, created)
}))

app.put('/api/user/:id', requireAuth, requirePermission('master-user', 'update'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Kode User')) return
  if (!validateRequired(res, req.body, [
    { key: 'name', label: 'Nama' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
  ])) return
  const role = dbRole(normalizeRole(req.body.role))
  const before = (await pool.query('SELECT user_id, name, email, role, active FROM users WHERE user_id=$1', [req.params.id])).rows[0]
  const params = [req.body.name, req.body.email, role, req.body.active !== false, req.params.id]
  let sql = 'UPDATE users SET name=$1, email=$2, role=$3, active=$4 WHERE user_id=$5 RETURNING user_id, name, email, role, active'
  if (req.body.password) {
    params.splice(4, 0, await bcrypt.hash(String(req.body.password), 10))
    sql = 'UPDATE users SET name=$1, email=$2, role=$3, active=$4, password=$5 WHERE user_id=$6 RETURNING user_id, name, email, role, active'
  }
  const { rows } = await pool.query(sql, params)
  if (!rows[0]) return envelope(res, 404, null, 'User not found')
  const updated = mapUser(rows[0])
  await writeAudit(req, {
    entityType: 'user',
    entityId: req.params.id,
    action: 'update',
    beforeData: mapUser(before),
    afterData: updated,
    description: `Update user ${req.params.id}`,
  })
  return envelope(res, 200, updated)
}))

app.delete('/api/user/:id', requireAuth, requirePermission('master-user', 'delete'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Kode User')) return
  const before = (await pool.query('SELECT user_id, name, email, role, active FROM users WHERE user_id=$1', [req.params.id])).rows[0]
  const result = await pool.query('UPDATE users SET active = false WHERE user_id = $1', [req.params.id])
  if (!result.rowCount) return envelope(res, 404, null, 'User not found')
  const after = (await pool.query('SELECT user_id, name, email, role, active FROM users WHERE user_id=$1', [req.params.id])).rows[0]
  await writeAudit(req, {
    entityType: 'user',
    entityId: req.params.id,
    action: 'delete',
    beforeData: mapUser(before),
    afterData: mapUser(after),
    description: `Delete user ${req.params.id}`,
  })
  return envelope(res, 200, 'Deleted')
}))

app.get('/api/complaint', requireAuth, requirePermission('complaint', 'view'), asyncRoute(async (req, res) => {
  const rows = await complaintRows()
  const filtered = rows.filter((row) => canViewComplaintRow(req.user, row))
  return envelope(res, 200, filtered.map(mapComplaint), null, { page: 1, pageSize: filtered.length, total: filtered.length })
}))

app.get('/api/complaint/:id', requireAuth, requirePermission('complaint', 'view'), asyncRoute(async (req, res) => {
  const rows = await complaintRows('WHERE c.complaint_id = $1', [req.params.id])
  if (!rows[0]) return envelope(res, 404, null, 'Complaint not found')
  if (!canViewComplaintRow(req.user, rows[0])) return envelope(res, 403, null, 'Forbidden')
  return envelope(res, 200, mapComplaint(rows[0]))
}))

app.post('/api/complaint', requireAuth, requirePermission('complaint', 'create'), asyncRoute(async (req, res) => {
  if (!validateRequired(res, req.body, [
    { key: 'mpNo', label: 'MP No' },
    { key: 'description', label: 'Description' },
    { key: 'customer', label: 'Customer' },
    { key: 'sales', label: 'Sales' },
    { key: 'status', label: 'Status' },
  ])) return
  const complaintDate = parseDateTime(req.body.complaintDate) ?? new Date()
  if (complaintDate === false) return envelope(res, 400, null, 'Complaint date is invalid')
  const customerBranch = await validateCustomerBranch(res, req.body.customer, req.body.customerBranchId)
  if (customerBranch === false) return
  const status = normalizeStatus(req.body.status || 'new')
  if (status === 'solved') return envelope(res, 400, null, 'Use the Resolve Complaint action to close this complaint')
  const { rows } = await pool.query(
    `INSERT INTO complaint (mp_no, description, customer, customer_branch, sales, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING complaint_id`,
    [req.body.mpNo, req.body.description, req.body.customer, customerBranch, req.body.sales, status, complaintDate],
  )
  const created = await complaintRows('WHERE c.complaint_id = $1', [rows[0].complaint_id])
  const mapped = mapComplaint(created[0])
  await writeAudit(req, {
    entityType: 'complaint',
    entityId: mapped.complaintNo,
    action: 'create',
    complaintNo: mapped.complaintNo,
    customerId: mapped.customer?.customerId,
    customerBranchId: mapped.customerBranchId,
    afterData: mapped,
    description: `Create complaint ${mapped.complaintNo}`,
  })
  return envelope(res, 201, mapped)
}))

app.put('/api/complaint/:id', requireAuth, requirePermission('complaint', 'update'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Complaint No.')) return
  if (!validateRequired(res, req.body, [
    { key: 'mpNo', label: 'MP No' },
    { key: 'description', label: 'Description' },
    { key: 'customer', label: 'Customer' },
    { key: 'sales', label: 'Sales' },
    { key: 'status', label: 'Status' },
  ])) return
  const complaintDate = parseDateTime(req.body.complaintDate) ?? new Date()
  if (complaintDate === false) return envelope(res, 400, null, 'Complaint date is invalid')
  const customerBranch = await validateCustomerBranch(res, req.body.customer, req.body.customerBranchId)
  if (customerBranch === false) return
  const beforeRows = await complaintRows('WHERE c.complaint_id = $1', [req.params.id])
  const status = normalizeStatus(req.body.status)
  if (status === 'solved') return envelope(res, 400, null, 'Use the Resolve Complaint action to close this complaint')
  const result = await pool.query(
    `UPDATE complaint SET mp_no=$1, description=$2, customer=$3, customer_branch=$4, sales=$5, status=$6, created_at=$7, updated_at=now()
     WHERE complaint_id=$8`,
    [req.body.mpNo, req.body.description, req.body.customer, customerBranch, req.body.sales, status, complaintDate, req.params.id],
  )
  if (!result.rowCount) return envelope(res, 404, null, 'Complaint not found')
  const rows = await complaintRows('WHERE c.complaint_id = $1', [req.params.id])
  if (!rows[0]) return envelope(res, 404, null, 'Complaint not found')
  const mapped = mapComplaint(rows[0])
  await writeAudit(req, {
    entityType: 'complaint',
    entityId: req.params.id,
    action: 'update',
    complaintNo: req.params.id,
    customerId: mapped.customer?.customerId,
    customerBranchId: mapped.customerBranchId,
    beforeData: beforeRows[0] ? mapComplaint(beforeRows[0]) : null,
    afterData: mapped,
    description: `Update complaint ${req.params.id}`,
  })
  return envelope(res, 200, mapped)
}))

app.patch('/api/complaint/:id/resolve', requireAuth, requirePermission('complaint', 'resolve'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Complaint No.')) return
  const assignments = await assignmentRows('WHERE a.complaint = $1', [req.params.id])
  const unfinished = assignments.filter((row) => normalizeStatus(row.status) !== 'solved')
  if (unfinished.length) return envelope(res, 400, null, 'Complaint cannot be resolved because there are unfinished work orders')
  const beforeRows = await complaintRows('WHERE c.complaint_id = $1', [req.params.id])
  const result = await pool.query('UPDATE complaint SET status=$1, resolved_at=now(), updated_at=now() WHERE complaint_id=$2', ['solved', req.params.id])
  if (!result.rowCount) return envelope(res, 404, null, 'Complaint not found')
  const rows = await complaintRows('WHERE c.complaint_id = $1', [req.params.id])
  const mapped = mapComplaint(rows[0])
  await writeAudit(req, {
    entityType: 'complaint',
    entityId: req.params.id,
    action: 'resolve',
    complaintNo: req.params.id,
    customerId: mapped.customer?.customerId,
    customerBranchId: mapped.customerBranchId,
    beforeData: beforeRows[0] ? mapComplaint(beforeRows[0]) : null,
    afterData: mapped,
    description: `Resolve complaint ${req.params.id}`,
  })
  return envelope(res, 200, mapped)
}))

app.delete('/api/complaint/:id', requireAuth, requirePermission('complaint', 'delete'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Complaint No.')) return
  const beforeRows = await complaintRows('WHERE c.complaint_id = $1', [req.params.id])
  const result = await pool.query('DELETE FROM complaint WHERE complaint_id = $1', [req.params.id])
  if (!result.rowCount) return envelope(res, 404, null, 'Complaint not found')
  const before = beforeRows[0] ? mapComplaint(beforeRows[0]) : null
  await writeAudit(req, {
    entityType: 'complaint',
    entityId: req.params.id,
    action: 'delete',
    complaintNo: req.params.id,
    customerId: before?.customer?.customerId,
    customerBranchId: before?.customerBranchId,
    beforeData: before,
    description: `Delete complaint ${req.params.id}`,
  })
  return envelope(res, 200, 'Deleted')
}))

app.get('/api/assignment', requireAuth, requirePermission('assignment', 'view'), asyncRoute(async (req, res) => {
  const rows = await assignmentRows()
  const filtered = rows.filter((row) => canViewAssignmentRow(req.user, row))
  return envelope(res, 200, filtered.map((row) => mapAssignment(row)), null, { page: 1, pageSize: filtered.length, total: filtered.length })
}))

app.get('/api/assignment/:id', requireAuth, requirePermission('assignment', 'view'), asyncRoute(async (req, res) => {
  const rows = await assignmentRows('WHERE a.assigment_id = $1', [req.params.id])
  if (!rows[0]) return envelope(res, 404, null, 'Assignment not found')
  if (!canViewAssignmentRow(req.user, rows[0])) return envelope(res, 403, null, 'Forbidden')
  return envelope(res, 200, mapAssignment(rows[0], await getAssignmentItems(req.params.id)))
}))

app.post('/api/assignment', requireAuth, requirePermission('assignment', 'create'), asyncRoute(async (req, res) => {
  if (!validateRequired(res, req.body, [
    { key: 'mpNo', label: 'No. MP' },
    { key: 'customer', label: 'Customer' },
    { key: 'pic', label: 'PIC' },
    { key: 'task', label: 'Type' },
    { key: 'status', label: 'Status' },
  ])) return
  const complaintNo = await validateOptionalComplaintNo(res, req.body.complaintNo)
  if (complaintNo === false) return
  const customerBranch = await validateCustomerBranch(res, req.body.customer, req.body.customerBranchId)
  if (customerBranch === false) return
  const { rows } = await pool.query(
    `INSERT INTO assignment (complaint, task, customer, customer_branch, pic, status, mp_no, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now()) RETURNING assigment_id`,
    [complaintNo, req.body.task, req.body.customer, customerBranch, req.body.pic, 'pending', req.body.mpNo],
  )
  for (const item of req.body.items ?? []) {
    await pool.query(
      `INSERT INTO assignment_item (assignment_no, type, item_id, description, serial_number, quantity, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [rows[0].assigment_id, item.type, item.itemId, item.description ?? '', item.serialNumber ?? '', safeInt(item.qty), item.note ?? ''],
    )
  }
  await pool.query('UPDATE assignment SET has_items = EXISTS (SELECT 1 FROM assignment_item WHERE assignment_no = $1) WHERE assigment_id = $1', [rows[0].assigment_id])
  const created = await assignmentRows('WHERE a.assigment_id = $1', [rows[0].assigment_id])
  const mapped = mapAssignment(created[0], await getAssignmentItems(rows[0].assigment_id))
  await auditAssignmentChange(req, null, mapped, 'create', `Create work order ${mapped.assignmentNo}`)
  return envelope(res, 201, mapped)
}))

app.put('/api/assignment/:id', requireAuth, requirePermission('assignment', 'update'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Work Order ID')) return
  if (!validateRequired(res, req.body, [
    { key: 'mpNo', label: 'No. MP' },
    { key: 'customer', label: 'Customer' },
    { key: 'pic', label: 'PIC' },
    { key: 'task', label: 'Type' },
    { key: 'status', label: 'Status' },
  ])) return
  const complaintNo = await validateOptionalComplaintNo(res, req.body.complaintNo)
  if (complaintNo === false) return
  const customerBranch = await validateCustomerBranch(res, req.body.customer, req.body.customerBranchId)
  if (customerBranch === false) return
  const existing = await assignmentWithItems(req.params.id)
  if (!existing) return envelope(res, 404, null, 'Assignment not found')
  const currentStatus = normalizeStatus(existing.row.status)
  if (['solved', 'cancelled'].includes(currentStatus)) return envelope(res, 400, null, 'Final work orders cannot be changed')
  const result = await pool.query(
    `UPDATE assignment SET complaint=$1, task=$2, customer=$3, customer_branch=$4, pic=$5, status=$6, mp_no=$7, updated_at=now()
     WHERE assigment_id=$8`,
    [complaintNo, req.body.task, req.body.customer, customerBranch, req.body.pic, currentStatus, req.body.mpNo, req.params.id],
  )
  if (!result.rowCount) return envelope(res, 404, null, 'Assignment not found')
  const updated = await assignmentWithItems(req.params.id)
  await auditAssignmentChange(req, existing.mapped, updated?.mapped, 'update', `Update work order ${req.params.id}`)
  return envelope(res, 200, updated.mapped)
}))

app.patch('/api/assignment/:id/start', requireAuth, requirePermission('assignment', 'workflow'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Work Order ID')) return
  if (!hasRole(req.user, 'admin', 'kepala-teknisi')) return envelope(res, 403, null, 'Forbidden')
  const assignment = await assignmentWithItems(req.params.id)
  if (!assignment) return envelope(res, 404, null, 'Assignment not found')
  if (normalizeStatus(assignment.row.status) !== 'pending') return envelope(res, 400, null, 'Work order can only be started from pending status')
  await pool.query('UPDATE assignment SET status=$1, updated_at=now() WHERE assigment_id=$2', ['progress', req.params.id])
  const updated = await assignmentWithItems(req.params.id)
  await auditAssignmentChange(req, assignment.mapped, updated?.mapped, 'start', `Start work order ${req.params.id}`)
  return envelope(res, 200, updated.mapped)
}))

app.patch('/api/assignment/:id/ready-to-print', requireAuth, requirePermission('assignment', 'workflow'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Work Order ID')) return
  const assignment = await assignmentWithItems(req.params.id)
  if (!assignment) return envelope(res, 404, null, 'Assignment not found')
  if (!hasRole(req.user, 'admin') && !(hasRole(req.user, 'teknisi') && sameUser(assignment.row.pic, req.user))) return envelope(res, 403, null, 'Forbidden')
  const status = normalizeStatus(assignment.row.status)
  if (!['pending', 'progress'].includes(status)) return envelope(res, 400, null, 'Work order cannot be marked ready to print from this status')
  await pool.query('UPDATE assignment SET status=$1, updated_at=now() WHERE assigment_id=$2', ['ready_to_print', req.params.id])
  const updated = await assignmentWithItems(req.params.id)
  await auditAssignmentChange(req, assignment.mapped, updated?.mapped, 'ready-to-print', `Ready to print work order ${req.params.id}`)
  return envelope(res, 200, updated.mapped)
}))

app.patch('/api/assignment/:id/technician-complete', requireAuth, requirePermission('assignment', 'workflow'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Work Order ID')) return
  const assignment = await assignmentWithItems(req.params.id)
  if (!assignment) return envelope(res, 404, null, 'Assignment not found')
  if (!hasRole(req.user, 'admin') && !(hasRole(req.user, 'teknisi') && sameUser(assignment.row.pic, req.user))) return envelope(res, 403, null, 'Forbidden')
  if (normalizeStatus(assignment.row.status) !== 'ready_to_print') return envelope(res, 400, null, 'Work order can only be completed by technician from ready to print status')
  await pool.query('UPDATE assignment SET status=$1, updated_at=now() WHERE assigment_id=$2', ['technician_completed', req.params.id])
  const updated = await assignmentWithItems(req.params.id)
  await auditAssignmentChange(req, assignment.mapped, updated?.mapped, 'technician-complete', `Technician completed work order ${req.params.id}`)
  return envelope(res, 200, updated.mapped)
}))

app.patch('/api/assignment/:id/warehouse-validate', requireAuth, requirePermission('assignment', 'workflow'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Work Order ID')) return
  if (!hasRole(req.user, 'admin', 'warehouse')) return envelope(res, 403, null, 'Forbidden')
  const assignment = await assignmentWithItems(req.params.id)
  if (!assignment) return envelope(res, 404, null, 'Assignment not found')
  if (normalizeStatus(assignment.row.status) !== 'technician_completed') return envelope(res, 400, null, 'Warehouse can only validate work orders completed by technician')
  if (!assignment.items.length) return envelope(res, 400, null, 'Warehouse validation is only required for work orders with items')
  await pool.query(
    'UPDATE assignment SET status=$1, validated_at=now(), validated_by=$2, updated_at=now() WHERE assigment_id=$3',
    ['warehouse_validated', req.user.sub, req.params.id],
  )
  const updated = await assignmentWithItems(req.params.id)
  await auditAssignmentChange(req, assignment.mapped, updated?.mapped, 'warehouse-validate', `Warehouse validate work order ${req.params.id}`)
  return envelope(res, 200, updated.mapped)
}))

app.patch('/api/assignment/:id/resolve', requireAuth, requirePermission('assignment', 'resolve'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Work Order ID')) return
  const assignment = await assignmentWithItems(req.params.id)
  if (!assignment) return envelope(res, 404, null, 'Assignment not found')
  const status = normalizeStatus(assignment.row.status)
  if (assignment.items.length && status !== 'warehouse_validated') return envelope(res, 400, null, 'Work orders with items must be warehouse validated before solved')
  if (!assignment.items.length && !['technician_completed', 'warehouse_validated'].includes(status)) return envelope(res, 400, null, 'Work order cannot be resolved from this status')
  await pool.query(
    'UPDATE assignment SET status=$1, authorized_at=now(), authorized_by=$2, updated_at=now() WHERE assigment_id=$3',
    ['solved', req.user.sub, req.params.id],
  )
  const updated = await assignmentWithItems(req.params.id)
  await auditAssignmentChange(req, assignment.mapped, updated?.mapped, 'resolve', `Resolve work order ${req.params.id}`)
  return envelope(res, 200, updated.mapped)
}))

app.delete('/api/assignment/:id', requireAuth, requirePermission('assignment', 'delete'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Work Order ID')) return
  const before = await assignmentWithItems(req.params.id)
  const result = await pool.query('DELETE FROM assignment WHERE assigment_id = $1', [req.params.id])
  if (!result.rowCount) return envelope(res, 404, null, 'Assignment not found')
  await auditAssignmentChange(req, before?.mapped, null, 'delete', `Delete work order ${req.params.id}`)
  return envelope(res, 200, 'Deleted')
}))

app.post('/api/assignment/:id/items', requireAuth, requirePermission('assignment-item', 'create'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Work Order ID')) return
  const assignment = await assignmentWithItems(req.params.id)
  if (!assignment) return envelope(res, 404, null, 'Assignment not found')
  if (!hasRole(req.user, 'admin') && !(hasRole(req.user, 'teknisi') && sameUser(assignment.row.pic, req.user))) return envelope(res, 403, null, 'Forbidden')
  if (isFinalAssignmentStatus(assignment.row.status)) return envelope(res, 400, null, 'Items cannot be changed after the work order is ready or final')
  if (!validateRequired(res, req.body, [{ key: 'itemId', label: 'Item' }])) return
  if (safeInt(req.body.qty) < 1) return envelope(res, 400, null, 'Kuantitas minimal 1')
  const { rows } = await pool.query(
    `INSERT INTO assignment_item (assignment_no, type, item_id, description, serial_number, quantity, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.params.id, req.body.type, req.body.itemId, req.body.description ?? '', req.body.serialNumber ?? '', safeInt(req.body.qty), req.body.note ?? ''],
  )
  await pool.query('UPDATE assignment SET has_items = true, updated_at = now() WHERE assigment_id = $1', [req.params.id])
  const mapped = mapAssignmentItem(rows[0])
  await writeAudit(req, {
    entityType: 'assignment-item',
    entityId: String(mapped.id),
    action: 'create',
    assignmentNo: req.params.id,
    complaintNo: assignment.mapped.complaintNo,
    customerId: assignment.mapped.customer?.customerId,
    customerBranchId: assignment.mapped.customerBranchId,
    afterData: mapped,
    description: `Add item ${mapped.itemId} to work order ${req.params.id}`,
  })
  return envelope(res, 201, mapped)
}))

app.delete('/api/assignment/:id/items/:itemId', requireAuth, requirePermission('assignment-item', 'delete'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Work Order ID')) return
  const assignment = await assignmentWithItems(req.params.id)
  if (!assignment) return envelope(res, 404, null, 'Assignment not found')
  if (!hasRole(req.user, 'admin') && !(hasRole(req.user, 'teknisi') && sameUser(assignment.row.pic, req.user))) return envelope(res, 403, null, 'Forbidden')
  if (isFinalAssignmentStatus(assignment.row.status)) return envelope(res, 400, null, 'Items cannot be changed after the work order is ready or final')
  if (isBlank(req.params.itemId)) return envelope(res, 400, null, 'Item ID is invalid')
  const before = (await pool.query('SELECT * FROM assignment_item WHERE assignment_no = $1 AND id = $2', [req.params.id, req.params.itemId])).rows[0]
  const result = await pool.query('DELETE FROM assignment_item WHERE assignment_no = $1 AND id = $2', [req.params.id, req.params.itemId])
  if (!result.rowCount) return envelope(res, 404, null, 'Assignment item not found')
  await pool.query('UPDATE assignment SET has_items = EXISTS (SELECT 1 FROM assignment_item WHERE assignment_no = $1), updated_at = now() WHERE assigment_id = $1', [req.params.id])
  const mapped = before ? mapAssignmentItem(before) : null
  await writeAudit(req, {
    entityType: 'assignment-item',
    entityId: String(req.params.itemId),
    action: 'delete',
    assignmentNo: req.params.id,
    complaintNo: assignment.mapped.complaintNo,
    customerId: assignment.mapped.customer?.customerId,
    customerBranchId: assignment.mapped.customerBranchId,
    beforeData: mapped,
    description: `Delete item ${mapped?.itemId ?? req.params.itemId} from work order ${req.params.id}`,
  })
  return envelope(res, 200, 'Deleted')
}))

function masterRoutes(path, table, idColumn, fields, mapper, requiredFields = [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Nama' }], module = `master-${path}`) {
  app.get(`/api/${path}`, requireAuth, requirePermission(module, 'view'), asyncRoute(async (_req, res) => {
    const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY ${idColumn}`)
    return envelope(res, 200, rows.map(mapper))
  }))
  app.post(`/api/${path}`, requireAuth, requirePermission(module, 'create'), asyncRoute(async (req, res) => {
    if (!validateRequired(res, req.body, requiredFields)) return
    const columns = [idColumn, ...fields]
    const values = columns.map((column) => column === idColumn ? req.body.id : req.body[column] ?? req.body[column.replace(/_([a-z])/g, (_, c) => c.toUpperCase())])
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(',')
    const { rows } = await pool.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders}) RETURNING *`, values)
    const mapped = mapper(rows[0])
    await writeAudit(req, {
      entityType: module,
      entityId: mapped.id,
      action: 'create',
      afterData: mapped,
      description: `Create ${module} ${mapped.id}`,
    })
    return envelope(res, 201, mapped)
  }))
  app.put(`/api/${path}/:id`, requireAuth, requirePermission(module, 'update'), asyncRoute(async (req, res) => {
    if (!validateParamId(req, res, 'ID')) return
    if (!validateRequired(res, req.body, requiredFields.filter((field) => field.key !== 'id'))) return
    const before = (await pool.query(`SELECT * FROM ${table} WHERE ${idColumn}=$1`, [req.params.id])).rows[0]
    const assignments = fields.map((field, index) => `${field}=$${index + 1}`).join(',')
    const values = fields.map((field) => req.body[field] ?? req.body[field.replace(/_([a-z])/g, (_, c) => c.toUpperCase())])
    values.push(req.params.id)
    const { rows } = await pool.query(`UPDATE ${table} SET ${assignments} WHERE ${idColumn}=$${fields.length + 1} RETURNING *`, values)
    if (!rows[0]) return envelope(res, 404, null, 'Not found')
    const mapped = mapper(rows[0])
    await writeAudit(req, {
      entityType: module,
      entityId: req.params.id,
      action: 'update',
      beforeData: before ? mapper(before) : null,
      afterData: mapped,
      description: `Update ${module} ${req.params.id}`,
    })
    return envelope(res, 200, mapped)
  }))
  app.delete(`/api/${path}/:id`, requireAuth, requirePermission(module, 'delete'), asyncRoute(async (req, res) => {
    if (!validateParamId(req, res, 'ID')) return
    const before = (await pool.query(`SELECT * FROM ${table} WHERE ${idColumn}=$1`, [req.params.id])).rows[0]
    const result = await pool.query(`UPDATE ${table} SET active=false WHERE ${idColumn}=$1`, [req.params.id])
    if (!result.rowCount) return envelope(res, 404, null, 'Not found')
    const after = (await pool.query(`SELECT * FROM ${table} WHERE ${idColumn}=$1`, [req.params.id])).rows[0]
    await writeAudit(req, {
      entityType: module,
      entityId: req.params.id,
      action: 'delete',
      beforeData: before ? mapper(before) : null,
      afterData: after ? mapper(after) : null,
      description: `Delete ${module} ${req.params.id}`,
    })
    return envelope(res, 200, 'Deleted')
  }))
}

masterRoutes('printer', 'ms_printer', 'printer_id', ['name', 'manufacture', 'category', 'toner', 'supplier', 'active'], (r) => ({ id: r.printer_id, name: r.name, manufacture: r.manufacture, category: r.category, toner: r.toner, supplier: r.supplier, active: r.active }))
masterRoutes('toner', 'ms_toner', 'toner_id', ['name', 'category', 'active'], (r) => ({ id: r.toner_id, name: r.name, category: r.category, active: r.active }), [{ key: 'id', label: 'Kode' }, { key: 'name', label: 'Nama' }, { key: 'category', label: 'Category' }])
masterRoutes('sparepart', 'ms_sparepart', 'sparepart_id', ['name', 'active'], (r) => ({ id: r.sparepart_id, name: r.name, active: r.active }))
masterRoutes('supplier', 'ms_supplier', 'supplier_id', ['name', 'address', 'active'], (r) => ({ id: r.supplier_id, name: r.name, address: r.address, active: r.active }), [{ key: 'id', label: 'Supplier ID' }, { key: 'name', label: 'Nama Supplier' }])

app.get('/api/stock/printer', requireAuth, requirePermission('stock-printer', 'view'), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM stock_printer ORDER BY mp_no')
  return envelope(res, 200, rows.map((r) => ({ mpNo: r.mp_no, printer: r.printer, serialNo: r.serial_no, feature: r.feature, buyDate: r.buy_date, location: r.location, branch: r.branch, status: r.status, active: r.active, note: r.notes })))
}))

function mapStockPrinter(r) {
  if (!r) return null
  return { mpNo: r.mp_no, printer: r.printer, serialNo: r.serial_no, feature: r.feature, buyDate: r.buy_date, location: r.location, branch: r.branch, status: r.status, active: r.active, note: r.notes }
}

app.post('/api/stock/printer', requireAuth, requirePermission('stock-printer', 'create'), asyncRoute(async (req, res) => {
  if (!validateRequired(res, req.body, [
    { key: 'mpNo', label: 'MP No' },
    { key: 'printer', label: 'Printer' },
    { key: 'serialNo', label: 'Serial No' },
    { key: 'buyDate', label: 'Buy Date' },
    { key: 'location', label: 'Location' },
    { key: 'branch', label: 'Branch' },
    { key: 'status', label: 'Status' },
  ])) return
  const { rows } = await pool.query(
    `INSERT INTO stock_printer (mp_no, printer, serial_no, feature, buy_date, status, location, branch, active, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.body.mpNo, req.body.printer, req.body.serialNo, req.body.feature, req.body.buyDate, req.body.status, req.body.location, req.body.branch, req.body.active !== false, req.body.note],
  )
  const mapped = mapStockPrinter(rows[0])
  await writeAudit(req, { entityType: 'stock-printer', entityId: mapped.mpNo, action: 'create', afterData: mapped, description: `Create stock printer ${mapped.mpNo}` })
  return envelope(res, 201, mapped)
}))

app.put('/api/stock/printer/:id', requireAuth, requirePermission('stock-printer', 'update'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'MP No')) return
  if (!validateRequired(res, req.body, [
    { key: 'printer', label: 'Printer' },
    { key: 'serialNo', label: 'Serial No' },
    { key: 'buyDate', label: 'Buy Date' },
    { key: 'location', label: 'Location' },
    { key: 'branch', label: 'Branch' },
    { key: 'status', label: 'Status' },
  ])) return
  const before = (await pool.query('SELECT * FROM stock_printer WHERE mp_no=$1', [req.params.id])).rows[0]
  const { rows } = await pool.query(
    `UPDATE stock_printer SET printer=$1, serial_no=$2, feature=$3, buy_date=$4, status=$5, location=$6, branch=$7, active=$8, notes=$9
     WHERE mp_no=$10 RETURNING *`,
    [req.body.printer, req.body.serialNo, req.body.feature, req.body.buyDate, req.body.status, req.body.location, req.body.branch, req.body.active !== false, req.body.note, req.params.id],
  )
  if (!rows[0]) return envelope(res, 404, null, 'Not found')
  const mapped = mapStockPrinter(rows[0])
  await writeAudit(req, { entityType: 'stock-printer', entityId: req.params.id, action: 'update', beforeData: mapStockPrinter(before), afterData: mapped, description: `Update stock printer ${req.params.id}` })
  return envelope(res, 200, mapped)
}))

app.patch('/api/stock/printer/:id', requireAuth, requirePermission('stock-printer', 'delete'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'MP No')) return
  const before = (await pool.query('SELECT * FROM stock_printer WHERE mp_no=$1', [req.params.id])).rows[0]
  const result = await pool.query('UPDATE stock_printer SET active=false WHERE mp_no=$1', [req.params.id])
  if (!result.rowCount) return envelope(res, 404, null, 'Stock printer not found')
  const after = (await pool.query('SELECT * FROM stock_printer WHERE mp_no=$1', [req.params.id])).rows[0]
  await writeAudit(req, { entityType: 'stock-printer', entityId: req.params.id, action: 'delete', beforeData: mapStockPrinter(before), afterData: mapStockPrinter(after), description: `Delete stock printer ${req.params.id}` })
  return envelope(res, 200, 'Deleted')
}))

app.delete('/api/stock/printer/:id', requireAuth, requirePermission('stock-printer', 'delete'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'MP No')) return
  const before = (await pool.query('SELECT * FROM stock_printer WHERE mp_no=$1', [req.params.id])).rows[0]
  const result = await pool.query('UPDATE stock_printer SET active=false WHERE mp_no=$1', [req.params.id])
  if (!result.rowCount) return envelope(res, 404, null, 'Stock printer not found')
  const after = (await pool.query('SELECT * FROM stock_printer WHERE mp_no=$1', [req.params.id])).rows[0]
  await writeAudit(req, { entityType: 'stock-printer', entityId: req.params.id, action: 'delete', beforeData: mapStockPrinter(before), afterData: mapStockPrinter(after), description: `Delete stock printer ${req.params.id}` })
  return envelope(res, 200, 'Deleted')
}))

function mapStockToner(r) {
  return { id: r.id, toner: r.toner, location: r.location, branch: r.branch, qty: r.qty, customer: r.customer, note: r.notes, createdAt: r.created_at }
}

app.get('/api/stock/toner', requireAuth, requirePermission('stock-toner', 'view'), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM stock_toner ORDER BY id')
  return envelope(res, 200, rows.map(mapStockToner))
}))

app.post('/api/stock/toner', requireAuth, requirePermission('stock-toner', 'create'), asyncRoute(async (req, res) => {
  if (!validateRequired(res, req.body, [{ key: 'toner', label: 'Toner' }])) return
  if (safeInt(req.body.qty) < 0) return envelope(res, 400, null, 'Qty cannot be less than 0')
  if (!await validateStockBranch(res, req.body.customer, req.body.branch)) return
  const { rows } = await pool.query(
    `INSERT INTO stock_toner (toner, location, branch, qty, customer, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.body.toner, req.body.location, req.body.branch, safeInt(req.body.qty), req.body.customer, req.body.note],
  )
  const mapped = mapStockToner(rows[0])
  await writeAudit(req, { entityType: 'stock-toner', entityId: String(mapped.id), action: 'create', customerId: mapped.customer, afterData: mapped, description: `Create stock toner ${mapped.id}` })
  return envelope(res, 201, mapped)
}))

app.put('/api/stock/toner/:id', requireAuth, requirePermission('stock-toner', 'update'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Stock Toner ID')) return
  if (!validateRequired(res, req.body, [{ key: 'toner', label: 'Toner' }])) return
  if (safeInt(req.body.qty) < 0) return envelope(res, 400, null, 'Qty cannot be less than 0')
  if (!await validateStockBranch(res, req.body.customer, req.body.branch)) return
  const before = (await pool.query('SELECT * FROM stock_toner WHERE id=$1', [req.params.id])).rows[0]
  const { rows } = await pool.query(
    `UPDATE stock_toner SET toner=$1, location=$2, branch=$3, qty=$4, customer=$5, notes=$6 WHERE id=$7 RETURNING *`,
    [req.body.toner, req.body.location, req.body.branch, safeInt(req.body.qty), req.body.customer, req.body.note, req.params.id],
  )
  if (!rows[0]) return envelope(res, 404, null, 'Not found')
  const mapped = mapStockToner(rows[0])
  await writeAudit(req, { entityType: 'stock-toner', entityId: String(req.params.id), action: 'update', customerId: mapped.customer, beforeData: before ? mapStockToner(before) : null, afterData: mapped, description: `Update stock toner ${req.params.id}` })
  return envelope(res, 200, mapped)
}))

app.delete('/api/stock/toner/:id', requireAuth, requirePermission('stock-toner', 'delete'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Stock Toner ID')) return
  const before = (await pool.query('SELECT * FROM stock_toner WHERE id=$1', [req.params.id])).rows[0]
  const result = await pool.query('DELETE FROM stock_toner WHERE id=$1', [req.params.id])
  if (!result.rowCount) return envelope(res, 404, null, 'Stock toner not found')
  await writeAudit(req, { entityType: 'stock-toner', entityId: String(req.params.id), action: 'delete', customerId: before?.customer, beforeData: before ? mapStockToner(before) : null, description: `Delete stock toner ${req.params.id}` })
  return envelope(res, 200, 'Deleted')
}))

app.get('/api/stock/sparepart', requireAuth, requirePermission('stock-sparepart', 'view'), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM stock_sparepart ORDER BY id')
  return envelope(res, 200, rows.map((r) => ({ id: r.id, sparepart: r.sparepart, location: r.location, branch: r.branch, qty: r.qty, customer: r.customer, note: r.notes, notes: r.notes, createdAt: r.created_at })))
}))

app.post('/api/stock/sparepart', requireAuth, requirePermission('stock-sparepart', 'create'), asyncRoute(async (req, res) => {
  if (!validateRequired(res, req.body, [{ key: 'sparepart', label: 'Sparepart' }])) return
  if (safeInt(req.body.qty) < 0) return envelope(res, 400, null, 'Qty cannot be less than 0')
  if (!await validateStockBranch(res, req.body.customer, req.body.branch)) return
  const { rows } = await pool.query(
    `INSERT INTO stock_sparepart (sparepart, location, branch, qty, customer, notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.body.sparepart, req.body.location, req.body.branch, safeInt(req.body.qty), req.body.customer, req.body.note],
  )
  const mapped = { id: rows[0].id, sparepart: rows[0].sparepart, location: rows[0].location, branch: rows[0].branch, qty: rows[0].qty, customer: rows[0].customer, note: rows[0].notes, notes: rows[0].notes, createdAt: rows[0].created_at }
  await writeAudit(req, { entityType: 'stock-sparepart', entityId: String(mapped.id), action: 'create', customerId: mapped.customer, afterData: mapped, description: `Create stock sparepart ${mapped.id}` })
  return envelope(res, 201, mapped)
}))

app.put('/api/stock/sparepart/:id', requireAuth, requirePermission('stock-sparepart', 'update'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Stock Sparepart ID')) return
  if (!validateRequired(res, req.body, [{ key: 'sparepart', label: 'Sparepart' }])) return
  if (safeInt(req.body.qty) < 0) return envelope(res, 400, null, 'Qty cannot be less than 0')
  if (!await validateStockBranch(res, req.body.customer, req.body.branch)) return
  const before = (await pool.query('SELECT * FROM stock_sparepart WHERE id=$1', [req.params.id])).rows[0]
  const { rows } = await pool.query(
    `UPDATE stock_sparepart SET sparepart=$1, location=$2, branch=$3, qty=$4, customer=$5, notes=$6 WHERE id=$7 RETURNING *`,
    [req.body.sparepart, req.body.location, req.body.branch, safeInt(req.body.qty), req.body.customer, req.body.note, req.params.id],
  )
  if (!rows[0]) return envelope(res, 404, null, 'Not found')
  const mapped = { id: rows[0].id, sparepart: rows[0].sparepart, location: rows[0].location, branch: rows[0].branch, qty: rows[0].qty, customer: rows[0].customer, note: rows[0].notes, notes: rows[0].notes, createdAt: rows[0].created_at }
  const beforeMapped = before ? { id: before.id, sparepart: before.sparepart, location: before.location, branch: before.branch, qty: before.qty, customer: before.customer, note: before.notes, notes: before.notes, createdAt: before.created_at } : null
  await writeAudit(req, { entityType: 'stock-sparepart', entityId: String(req.params.id), action: 'update', customerId: mapped.customer, beforeData: beforeMapped, afterData: mapped, description: `Update stock sparepart ${req.params.id}` })
  return envelope(res, 200, mapped)
}))

app.delete('/api/stock/sparepart/:id', requireAuth, requirePermission('stock-sparepart', 'delete'), asyncRoute(async (req, res) => {
  if (!validateParamId(req, res, 'Stock Sparepart ID')) return
  const before = (await pool.query('SELECT * FROM stock_sparepart WHERE id=$1', [req.params.id])).rows[0]
  const result = await pool.query('DELETE FROM stock_sparepart WHERE id=$1', [req.params.id])
  if (!result.rowCount) return envelope(res, 404, null, 'Stock sparepart not found')
  const beforeMapped = before ? { id: before.id, sparepart: before.sparepart, location: before.location, branch: before.branch, qty: before.qty, customer: before.customer, note: before.notes, notes: before.notes, createdAt: before.created_at } : null
  await writeAudit(req, { entityType: 'stock-sparepart', entityId: String(req.params.id), action: 'delete', customerId: before?.customer, beforeData: beforeMapped, description: `Delete stock sparepart ${req.params.id}` })
  return envelope(res, 200, 'Deleted')
}))

app.get('/api/dashboard', requireAuth, asyncRoute(async (req, res) => {
  const defaultToKey = localDateKey(new Date())
  const defaultFromDate = new Date(`${defaultToKey}T00:00:00+07:00`)
  defaultFromDate.setDate(defaultFromDate.getDate() - 29)
  const defaultFromKey = localDateKey(defaultFromDate)

  const parsedFrom = parseDashboardDate(req.query.from)
  const parsedTo = parseDashboardDate(req.query.to, true)
  if (parsedFrom === false || parsedTo === false) return envelope(res, 400, null, 'Date format must be YYYY-MM-DD')

  const from = parsedFrom ?? parseDashboardDate(defaultFromKey)
  const to = parsedTo ?? parseDashboardDate(defaultToKey, true)
  if (from > to) return envelope(res, 400, null, 'Start date cannot be greater than end date')

  const rawComplaintRows = await complaintRows()
  const rawAssignmentRows = await assignmentRows()
  const itemCountRows = (await pool.query('SELECT assignment_no, COUNT(*)::int AS total FROM assignment_item GROUP BY assignment_no')).rows
  const itemCounts = new Map(itemCountRows.map((row) => [row.assignment_no, row.total]))

  let complaintRowsForUser = rawComplaintRows.filter((row) => canViewComplaintRow(req.user, row))
  let assignmentRowsForUser = rawAssignmentRows.filter((row) => canViewAssignmentRow(req.user, row))
  if (req.user.role === 'warehouse') {
    assignmentRowsForUser = assignmentRowsForUser.filter((row) => itemCounts.get(row.assigment_id) > 0 || ['technician_completed', 'warehouse_validated'].includes(normalizeStatus(row.status)))
    const warehouseComplaintSet = new Set(assignmentRowsForUser.map((row) => row.complaint).filter(Boolean))
    complaintRowsForUser = complaintRowsForUser.filter((row) => warehouseComplaintSet.has(row.complaint_id))
  }

  const inRange = (item) => {
    const createdAt = new Date(item.createdAt ?? item.created_at ?? 0)
    return createdAt >= from && createdAt <= to
  }
  const complaintsAll = complaintRowsForUser.map(mapComplaint)
  const assignmentsAll = assignmentRowsForUser.map((row) => ({ ...mapAssignment(row), itemCount: itemCounts.get(row.assigment_id) ?? 0 }))
  const complaints = complaintsAll.filter(inRange)
  const assignments = assignmentsAll.filter(inRange)
  const assignmentsByComplaint = new Map()
  assignmentsAll.forEach((assignment) => {
    if (!assignment.complaintNo) return
    const list = assignmentsByComplaint.get(assignment.complaintNo) ?? []
    list.push(assignment)
    assignmentsByComplaint.set(assignment.complaintNo, list)
  })

  const stockPrinters = (await pool.query('SELECT mp_no AS id, printer AS name, active FROM stock_printer')).rows.map((r) => ({ id: r.id, name: r.name, category: 'printer', quantity: r.active ? 1 : 0 }))
  const stockToners = (await pool.query('SELECT id::text, toner AS name, qty FROM stock_toner')).rows.map((r) => ({ id: r.id, name: r.name, category: 'toner', quantity: r.qty }))
  const stockSpareparts = (await pool.query('SELECT id::text, sparepart AS name, qty FROM stock_sparepart')).rows.map((r) => ({ id: r.id, name: r.name, category: 'sparepart', quantity: r.qty }))
  const allStock = [...stockPrinters, ...stockToners, ...stockSpareparts]
  const lowStockItems = allStock.filter((item) => item.quantity <= 1).sort((a, b) => a.quantity - b.quantity).slice(0, 5)

  const statuses = (items) => Object.entries(items.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }), {})).map(([status, count]) => ({ status, count }))
  const dayDiff = Math.max(1, Math.ceil((to - from) / 86400000) + 1)
  const trendMode = dayDiff <= 62 ? 'daily' : 'weekly'
  const trendKeys = []
  const cursor = new Date(from)
  while (cursor <= to) {
    const key = trendMode === 'daily' ? localDateKey(cursor) : weekKey(cursor)
    if (!trendKeys.includes(key)) trendKeys.push(key)
    cursor.setDate(cursor.getDate() + (trendMode === 'daily' ? 1 : 7))
  }
  const keyForDate = (value) => trendMode === 'daily' ? localDateKey(value) : weekKey(value)
  const trend = (items) => trendKeys.map((period) => ({ period, month: period, total: items.filter((item) => keyForDate(item.createdAt) === period).length }))

  const assignmentStatusCount = (status) => assignments.filter((item) => item.status === status).length
  const complaintStatusCount = (status) => complaints.filter((item) => item.status === status).length
  const complaintNeedsAssignment = complaints.filter((complaint) => !['solved', 'cancelled'].includes(complaint.status) && !(assignmentsByComplaint.get(complaint.complaintNo)?.length))
  const technicianNeedsItems = assignments.filter((assignment) => ['pending', 'progress'].includes(assignment.status) && assignment.itemCount === 0)
  const readyToPrint = assignments.filter((assignment) => assignment.status === 'ready_to_print')
  const technicianCompleted = assignments.filter((assignment) => assignment.status === 'technician_completed')
  const warehouseQueue = technicianCompleted.filter((assignment) => assignment.itemCount > 0)
  const headResolveQueue = assignments.filter((assignment) => {
    if (assignment.status === 'warehouse_validated') return true
    return assignment.itemCount === 0 && assignment.status === 'technician_completed'
  })
  const complaintReadyResolve = complaints.filter((complaint) => {
    if (['solved', 'cancelled'].includes(complaint.status)) return false
    const related = assignmentsByComplaint.get(complaint.complaintNo) ?? []
    return related.length > 0 && related.every((assignment) => assignment.status === 'solved')
  })

  const actionItems = [
    ...complaintNeedsAssignment.map((item) => ({ id: item.complaintNo, kind: 'complaint', action: 'Create Work Order', description: item.description, status: item.status, createdAt: item.createdAt })),
    ...technicianNeedsItems.map((item) => ({ id: item.assignmentNo, kind: 'assignment', action: 'Complete Technician Items', description: item.task ?? item.assignmentNo, status: item.status, createdAt: item.createdAt })),
    ...readyToPrint.map((item) => ({ id: item.assignmentNo, kind: 'assignment', action: 'Technician Complete', description: item.task ?? item.assignmentNo, status: item.status, createdAt: item.createdAt })),
    ...warehouseQueue.map((item) => ({ id: item.assignmentNo, kind: 'assignment', action: 'Warehouse Validate', description: item.task ?? item.assignmentNo, status: item.status, createdAt: item.createdAt })),
    ...headResolveQueue.map((item) => ({ id: item.assignmentNo, kind: 'assignment', action: 'Resolve Work Order', description: item.task ?? item.assignmentNo, status: item.status, createdAt: item.createdAt })),
    ...complaintReadyResolve.map((item) => ({ id: item.complaintNo, kind: 'complaint', action: 'Resolve Complaint', description: item.description, status: item.status, createdAt: item.createdAt })),
  ].sort((a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0)).slice(0, 12)

  const users = (await pool.query('SELECT user_id, name FROM users')).rows
  const userName = (id) => users.find((user) => String(user.user_id).toLowerCase() === String(id).toLowerCase())?.name ?? id ?? '-'
  const workloadMap = new Map()
  assignments.forEach((assignment) => {
    const pic = assignment.pic || 'Unassigned'
    const current = workloadMap.get(pic) ?? { id: pic, name: userName(pic), active: 0, solved: 0, total: 0 }
    current.total += 1
    if (assignment.status === 'solved') current.solved += 1
    else if (assignment.status !== 'cancelled') current.active += 1
    workloadMap.set(pic, current)
  })
  const technicianWorkload = [...workloadMap.values()].sort((a, b) => (b.active + b.solved) - (a.active + a.solved)).slice(0, 8)

  const recentActivities = [
    ...complaints.map((item) => ({ id: item.complaintNo, kind: 'complaint', description: item.description, status: item.status, createdAt: item.createdAt })),
    ...assignments.map((item) => ({ id: item.assignmentNo, kind: 'assignment', description: item.task ?? item.assignmentNo, status: item.status, createdAt: item.createdAt })),
  ].sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0)).slice(0, 10)

  return envelope(res, 200, {
    period: { from: from.toISOString(), to: to.toISOString(), mode: trendMode, days: dayDiff },
    summary: {
      totalComplaints: complaints.length,
      pendingComplaints: complaintStatusCount('pending') + complaintStatusCount('new'),
      progressComplaints: complaintStatusCount('progress'),
      solvedComplaints: complaintStatusCount('solved'),
      cancelledComplaints: complaintStatusCount('cancelled'),
      totalAssignments: assignments.length,
      openAssignments: assignments.filter((item) => item.status !== 'solved' && item.status !== 'cancelled').length,
      solvedAssignments: assignmentStatusCount('solved'),
      readyToPrint: readyToPrint.length,
      technicianCompleted: technicianCompleted.length,
      warehouseQueue: warehouseQueue.length,
      complaintReadyResolve: complaintReadyResolve.length,
      lowStock: allStock.filter((item) => item.quantity <= 1).length,
    },
    assignmentStages: {
      pending: assignmentStatusCount('pending'),
      progress: assignmentStatusCount('progress'),
      ready_to_print: assignmentStatusCount('ready_to_print'),
      technician_completed: assignmentStatusCount('technician_completed'),
      warehouse_validated: assignmentStatusCount('warehouse_validated'),
      solved: assignmentStatusCount('solved'),
      cancelled: assignmentStatusCount('cancelled'),
    },
    pendingActions: {
      complaintNeedsAssignment: complaintNeedsAssignment.length,
      technicianNeedsItems: technicianNeedsItems.length,
      readyToPrint: readyToPrint.length,
      technicianCompleted: technicianCompleted.length,
      warehouseValidation: warehouseQueue.length,
      headResolve: headResolveQueue.length,
      complaintReadyResolve: complaintReadyResolve.length,
      items: actionItems,
    },
    complaintTrend: trend(complaints),
    assignmentTrend: trend(assignments),
    complaintStatus: statuses(complaints),
    assignmentStatus: statuses(assignments),
    technicianWorkload,
    warehouseQueue: warehouseQueue.slice(0, 10).map((item) => ({ id: item.assignmentNo, complaintNo: item.complaintNo, customer: item.customer?.name ?? '-', pic: userName(item.pic), itemCount: item.itemCount, status: item.status, createdAt: item.createdAt })),
    complaintReadyResolve: complaintReadyResolve.slice(0, 10).map((item) => ({ id: item.complaintNo, mpNo: item.mpNo, description: item.description, status: item.status, createdAt: item.createdAt })),
    lowStockItems,
    recentActivities,
  })
}))

app.use((err, _req, res, _next) => {
  console.error(err)
  if (err.code === '23505') return envelope(res, 409, null, 'Data dengan ID atau email tersebut sudah ada')
  if (err.code === '23503') return envelope(res, 400, null, 'Reference data is invalid')
  if (err.code === '23502') return envelope(res, 400, null, 'Required fields cannot be empty')
  return envelope(res, 500, null, err.message || 'Internal server error')
})

bootstrap()
  .then(() => app.listen(PORT, () => console.log(`Multiprint Express API listening on http://localhost:${PORT}`)))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
