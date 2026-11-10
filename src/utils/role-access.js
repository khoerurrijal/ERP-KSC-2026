export const ACCESS_SECTIONS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    pages: [{ label: 'Ringkasan', permissions: [{ id: 'dashboard.home', label: 'Halaman utama' }] }],
  },
  {
    key: 'penjualan',
    label: 'Penjualan',
    pages: [
      { label: 'Sales Order', permissions: [
        { id: 'sales.orders.invoice', label: 'Tab Invoice' },
        { id: 'sales.orders.items', label: 'Tab Item' },
        { id: 'sales.orders.create', label: 'Buat Sales Order' },
        { id: 'sales.orders.edit', label: 'Ubah Sales Order' },
        { id: 'sales.orders.print', label: 'Cetak Invoice' },
      ] },
      { label: 'Pesanan Masuk', permissions: [
        { id: 'sales.requests.list', label: 'Daftar pesanan' },
        { id: 'sales.requests.detail', label: 'Detail pesanan' },
      ] },
    ],
  },
  {
    key: 'marketplace',
    label: 'Marketplace',
    pages: [{ label: 'Pesanan Marketplace', permissions: [{ id: 'marketplace.orders', label: 'Daftar pesanan' }] }],
  },
  {
    key: 'produksi',
    label: 'Produksi',
    pages: [
      { label: 'Produksi', permissions: [{ id: 'production.queue', label: 'Antrean produksi' }] },
      { label: 'Status Pesanan', permissions: [
        { id: 'production.status.orders', label: 'Tab Status Pesanan' },
        { id: 'production.status.items', label: 'Tab Ubah Status' },
        { id: 'production.status.shipping', label: 'Tab Konfirmasi Pengiriman' },
      ] },
    ],
  },
  {
    key: 'gudang',
    label: 'Gudang',
    pages: [
      { label: 'Inventory', permissions: [
        { id: 'inventory.table', label: 'Tab Tabel Stok' },
        { id: 'inventory.pipeline', label: 'Tab Tracking Stok' },
        { id: 'inventory.mutations', label: 'Tab Riwayat Mutasi' },
      ] },
      { label: 'Purchase Order', permissions: [
        { id: 'purchases.orders', label: 'Tab Purchase Order' },
        { id: 'purchases.items', label: 'Tab Item Pembelian' },
        { id: 'purchases.create', label: 'Buat Purchase Order' },
        { id: 'purchases.edit', label: 'Ubah Purchase Order' },
      ] },
    ],
  },
  {
    key: 'keuangan',
    label: 'Keuangan',
    pages: [
      { label: 'Buku Besar', permissions: [
        { id: 'finance.ledger.main', label: 'Tab Kas Utama' },
        { id: 'finance.ledger.virtual', label: 'Tab Mutasi Virtual (HPP)' },
      ] },
      { label: 'Kasbon & Pinjaman', permissions: [{ id: 'finance.loans', label: 'Halaman Kasbon & Pinjaman' }] },
      { label: 'Rekap Gaji', permissions: [{ id: 'finance.payroll', label: 'Halaman Rekap Gaji' }] },
    ],
  },
  {
    key: 'master_data',
    label: 'Master Data',
    pages: [
      { label: 'Produk', permissions: [{ id: 'master.products', label: 'Halaman Produk' }] },
      { label: 'Pelanggan', permissions: [{ id: 'master.customers', label: 'Halaman Pelanggan' }] },
      { label: 'Supplier', permissions: [{ id: 'master.suppliers', label: 'Halaman Supplier' }] },
      { label: 'Karyawan', permissions: [{ id: 'master.employees', label: 'Halaman Karyawan' }] },
    ],
  },
  {
    key: 'laporan',
    label: 'Laporan',
    pages: [{ label: 'Laporan', permissions: [
      { id: 'reports.ledger', label: 'Tab Kas & Buku Besar' },
      { id: 'reports.profit', label: 'Tab Analisa Penjualan' },
    ] }],
  },
  {
    key: 'audit',
    label: 'AI Audit',
    pages: [{ label: 'AI Audit', permissions: [{ id: 'audit.findings', label: 'Temuan Audit' }] }],
  },
  {
    key: 'pengaturan',
    label: 'Pengaturan',
    pages: [{ label: 'Pengaturan Sistem', permissions: [
      { id: 'settings.dropdowns', label: 'Tab Data Dropdown' },
      { id: 'settings.cashflow', label: 'Tab Arus Kas' },
      { id: 'settings.pricelist', label: 'Tab Daftar Harga' },
      { id: 'settings.store', label: 'Tab Toko & Invoice' },
      { id: 'settings.category_images', label: 'Tab Gambar Kategori' },
      { id: 'settings.ai_agent', label: 'Tab AI & Chatbot' },
      { id: 'settings.access', label: 'Tab Akses & Pengguna' },
      { id: 'settings.salary', label: 'Halaman Skema Gaji' },
    ] }],
  },
]

const ALL_PERMISSION_IDS = new Set(
  ACCESS_SECTIONS.flatMap((section) => section.pages.flatMap((page) => page.permissions.map((permission) => permission.id)))
)

export const ROLE_PERMISSION_DEFAULTS = {
  Owner: ACCESS_SECTIONS.map((section) => section.key),
  Admin: ['dashboard', 'penjualan', 'marketplace', 'produksi', 'gudang', 'master_data', 'audit'],
  Operator: ['dashboard', 'produksi', 'gudang'],
  'Operator Mesin': ['production.queue'],
}

export function normalizeRolePermissions(value, role) {
  const source = Array.isArray(value) ? value : ROLE_PERMISSION_DEFAULTS[role] || []
  const permissions = new Set()

  source.forEach((key) => {
    const legacySection = ACCESS_SECTIONS.find((section) => section.key === key)
    if (legacySection) {
      legacySection.pages.forEach((page) => page.permissions.forEach((permission) => permissions.add(permission.id)))
    } else if (ALL_PERMISSION_IDS.has(key)) {
      permissions.add(key)
    }
  })

  if (role === 'Operator' || role === 'Operator Mesin') {
    permissions.delete('dashboard.home')
  }
  if (role === 'Operator Mesin' && !permissions.has('production.queue')) {
    permissions.add('production.queue')
  }

  return [...permissions]
}

export function normalizeRolePermissionMap(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const roles = [...new Set([...Object.keys(ROLE_PERMISSION_DEFAULTS), ...Object.keys(source)])]
  return Object.fromEntries(roles.map((role) => [role, normalizeRolePermissions(source[role], role)]))
}

export function menuKeysFromPermissions(value) {
  const permissions = new Set(Array.isArray(value) ? value : [])
  return ACCESS_SECTIONS
    .filter((section) => section.pages.some((page) => page.permissions.some((permission) => permissions.has(permission.id))))
    .map((section) => section.key)
}

export const ACCESS_ROUTES = [
  { matches: (path) => path === '/dashboard', permissions: ['dashboard.home'] },
  { matches: (path) => path === '/sales' || path === '/dashboard/sales', tabs: { INVOICE: 'sales.orders.invoice', ITEMS: 'sales.orders.items' }, mode: 'local' },
  { matches: (path) => path === '/sales/new' || path === '/dashboard/sales/new', permissions: ['sales.orders.create'] },
  { matches: (path) => path.startsWith('/sales/edit/') || path.startsWith('/dashboard/sales/edit/'), permissions: ['sales.orders.edit'] },
  { matches: (path) => path.includes('/sales/') && path.endsWith('/invoice'), permissions: ['sales.orders.print'] },
  { matches: (path) => path === '/dashboard/order-requests', permissions: ['sales.requests.list'] },
  { matches: (path) => path.startsWith('/dashboard/order-requests/'), permissions: ['sales.requests.detail'] },
  { matches: (path) => path === '/marketplace' || path === '/dashboard/marketplace', permissions: ['marketplace.orders'] },
  { matches: (path) => path === '/production' || path === '/dashboard/production', permissions: ['production.queue'] },
  { matches: (path) => path === '/status-pesanan' || path === '/dashboard/production/status', tabParam: 'tab', defaultTab: 'orders', tabs: { orders: 'production.status.orders', items: 'production.status.items', shipping: 'production.status.shipping' } },
  { matches: (path) => path === '/shipping' || path === '/dashboard/production/shipping', permissions: ['production.status.shipping'] },
  { matches: (path) => path === '/inventory' || path === '/dashboard/inventory', tabParam: 'tab', defaultTab: 'table', tabs: { table: 'inventory.table', pipeline: 'inventory.pipeline', mutations: 'inventory.mutations' } },
  { matches: (path) => path === '/inventory/mutasi' || path === '/dashboard/inventory/mutasi', permissions: ['inventory.mutations'] },
  { matches: (path) => path === '/purchases' || path === '/dashboard/purchases', tabParam: 'tab', defaultTab: 'PO', tabs: { PO: 'purchases.orders', ITEMS: 'purchases.items' }, mode: 'local' },
  { matches: (path) => path === '/purchases/new' || path === '/dashboard/purchases/new', permissions: ['purchases.create'] },
  { matches: (path) => path.startsWith('/purchases/') || path.startsWith('/dashboard/purchases/'), permissions: ['purchases.edit'] },
  { matches: (path) => path === '/transactions' || path === '/dashboard/transactions', tabs: { UTAMA: 'finance.ledger.main', VIRTUAL: 'finance.ledger.virtual' }, mode: 'local' },
  { matches: (path) => path === '/finance/loans' || path === '/dashboard/finance/loans', permissions: ['finance.loans'] },
  { matches: (path) => path === '/payroll' || path === '/dashboard/payroll', permissions: ['finance.payroll'] },
  { matches: (path) => path === '/master/products' || path === '/dashboard/master/products', permissions: ['master.products'] },
  { matches: (path) => path === '/master/customers' || path === '/dashboard/master/customers', permissions: ['master.customers'] },
  { matches: (path) => path === '/master/suppliers' || path === '/dashboard/master/suppliers', permissions: ['master.suppliers'] },
  { matches: (path) => path === '/master/employees' || path === '/dashboard/master/employees', permissions: ['master.employees'] },
  { matches: (path) => path === '/report' || path === '/dashboard/report', tabs: { buku_besar: 'reports.ledger', analisa_laba: 'reports.profit' }, mode: 'local' },
  { matches: (path) => path === '/audit' || path === '/dashboard/audit', permissions: ['audit.findings'] },
  { matches: (path) => path === '/settings/salary-schemas' || path === '/dashboard/settings/salary-schemas', permissions: ['settings.salary'] },
  { matches: (path) => path === '/dashboard/settings/access', permissions: ['settings.access'] },
  { matches: (path) => path === '/settings' || path === '/dashboard/settings', tabParam: 'tab', defaultTab: 'dropdowns', tabs: { dropdowns: 'settings.dropdowns', cashflow: 'settings.cashflow', pricelist: 'settings.pricelist', store: 'settings.store', category_images: 'settings.category_images', ai_agent: 'settings.ai_agent', access: 'settings.access', salary: 'settings.salary' } },
]

export function accessRouteForPath(pathname) {
  return ACCESS_ROUTES.find((route) => route.matches(pathname)) || null
}
