const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');
const DB_FILE = path.join(DATA_DIR, 'dewan_mobile_db.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Initial seed data for Dewan Mobile
const initialDatabase = {
  shop_settings: {
    name: "Dewan Mobile",
    tagline: "Mobile Accessories, Spare Parts, Hardware & Software Repairs, Easyload & Mobile Banking",
    address: "Main Market, Dewan Mobile",
    phone: "0300-1234567",
    currency: "Rs.",
    footerNote: "Welcome! Purchased items can be exchanged within 3 days with receipt. No warranty on software."
  },
  users: [
    {
      id: "u_admin",
      username: "admin",
      passwordHash: "$2a$10$wE8FqLg4mJ7a2aB8rPzv7O1b3D7sV.QoQ39vJ6hT2z2x5K7yW0U0W", // dewan123
      fullName: "Dewan Sahib (Owner)",
      role: "admin",
      pin: "7860",
      phone: "0300-1234567",
      active: true,
      createdAt: new Date().toISOString()
    },
    {
      id: "u_sales1",
      username: "ali",
      passwordHash: "$2a$10$wE8FqLg4mJ7a2aB8rPzv7O1b3D7sV.QoQ39vJ6hT2z2x5K7yW0U0W", // 1234
      fullName: "Ali (Sales Counter 1)",
      role: "salesman",
      pin: "1234",
      phone: "0301-1111111",
      active: true,
      createdAt: new Date().toISOString()
    },
    {
      id: "u_sales2",
      username: "usman",
      passwordHash: "$2a$10$wE8FqLg4mJ7a2aB8rPzv7O1b3D7sV.QoQ39vJ6hT2z2x5K7yW0U0W", // 1234
      fullName: "Usman (Repair & Hardware)",
      role: "salesman",
      pin: "1234",
      phone: "0302-2222222",
      active: true,
      createdAt: new Date().toISOString()
    },
    {
      id: "u_sales3",
      username: "bilal",
      passwordHash: "$2a$10$wE8FqLg4mJ7a2aB8rPzv7O1b3D7sV.QoQ39vJ6hT2z2x5K7yW0U0W", // 1234
      fullName: "Bilal (Easyload & Banking)",
      role: "salesman",
      pin: "1234",
      phone: "0303-3333333",
      active: true,
      createdAt: new Date().toISOString()
    },
    {
      id: "u_sales4",
      username: "hamza",
      passwordHash: "$2a$10$wE8FqLg4mJ7a2aB8rPzv7O1b3D7sV.QoQ39vJ6hT2z2x5K7yW0U0W", // 1234
      fullName: "Hamza (Sheets & Back Covers)",
      role: "salesman",
      pin: "1234",
      phone: "0304-4444444",
      active: true,
      createdAt: new Date().toISOString()
    }
  ],
  categories: [
    { id: "cat_accessories", name: "Accessories", urduName: "Accessories", isSystem: true, color: "blue" },
    { id: "cat_spareparts", name: "Spare Parts", urduName: "Spare Parts", isSystem: true, color: "amber" },
    { id: "cat_sheets", name: "Sheets & Skins", urduName: "Sheets & Skins", isSystem: true, color: "purple" },
    { id: "cat_services", name: "Services", urduName: "Services", isSystem: true, color: "emerald" }
  ],
  items: [
    // Mobile Accessories
    {
      id: "it_acc_001",
      name: "Faster Fast Charger 20W Type-C",
      urduName: "فاسٹر 20W فاسٹ چارجر",
      category: "Accessories",
      subCategory: "Chargers",
      barcode: "8901001",
      costPrice: 650,
      salePrice: 1100,
      stockQuantity: 25,
      minAlertQuantity: 5,
      unit: "Piece",
      shelfLocation: "Rack A1",
      updatedAt: new Date().toISOString()
    },
    {
      id: "it_acc_002",
      name: "Samsung Super Fast 25W Original Adapter",
      urduName: "سام سنگ 25 واٹ ایڈاپٹر",
      category: "Accessories",
      subCategory: "Chargers",
      barcode: "8901002",
      costPrice: 950,
      salePrice: 1600,
      stockQuantity: 18,
      minAlertQuantity: 4,
      unit: "Piece",
      shelfLocation: "Rack A1",
      updatedAt: new Date().toISOString()
    },
    {
      id: "it_acc_003",
      name: "Ronin R-9 Handsfree Deep Bass",
      urduName: "رونن R-9 ہینڈز فری",
      category: "Accessories",
      subCategory: "Handsfree",
      barcode: "8901003",
      costPrice: 320,
      salePrice: 650,
      stockQuantity: 40,
      minAlertQuantity: 10,
      unit: "Piece",
      shelfLocation: "Rack A2",
      updatedAt: new Date().toISOString()
    },
    {
      id: "it_acc_004",
      name: "Audionic Airbud 425 TWS Wireless",
      urduName: "آڈیونک ائیر بڈز 425",
      category: "Accessories",
      subCategory: "Airbuds",
      barcode: "8901004",
      costPrice: 2400,
      salePrice: 3500,
      stockQuantity: 12,
      minAlertQuantity: 3,
      unit: "Piece",
      shelfLocation: "Display Showcase",
      updatedAt: new Date().toISOString()
    },
    {
      id: "it_acc_005",
      name: "9D Full Glue Curved Glass Protector",
      urduName: "9D فل گلو گلاس پروٹیکٹر",
      category: "Accessories",
      subCategory: "Glass Protector",
      barcode: "8901005",
      costPrice: 80,
      salePrice: 250,
      stockQuantity: 120,
      minAlertQuantity: 20,
      unit: "Piece",
      shelfLocation: "Drawer 1",
      updatedAt: new Date().toISOString()
    },
    {
      id: "it_acc_006",
      name: "Silicone Matte Back Cover (All Models)",
      urduName: "سلیکون میٹ بیک کور",
      category: "Accessories",
      subCategory: "Covers",
      barcode: "8901006",
      costPrice: 150,
      salePrice: 400,
      stockQuantity: 85,
      minAlertQuantity: 15,
      unit: "Piece",
      shelfLocation: "Stand C",
      updatedAt: new Date().toISOString()
    },
    {
      id: "it_acc_007",
      name: "Romoss 20000mAh Power Bank Sense 6+",
      urduName: "روماس 20000mAh پاور بینک",
      category: "Accessories",
      subCategory: "Power Banks",
      barcode: "8901007",
      costPrice: 3800,
      salePrice: 5200,
      stockQuantity: 8,
      minAlertQuantity: 2,
      unit: "Piece",
      shelfLocation: "Showcase 2",
      updatedAt: new Date().toISOString()
    },

    // Spare Parts
    {
      id: "it_part_001",
      name: "Vivo Y20 / Y20s LCD Folder Screen (Crown)",
      urduName: "ویوو Y20 فلڈر اسکرین",
      category: "Spare Parts",
      subCategory: "Displays",
      barcode: "8902001",
      costPrice: 2200,
      salePrice: 3200,
      stockQuantity: 10,
      minAlertQuantity: 2,
      unit: "Piece",
      shelfLocation: "Part Drawer B1",
      updatedAt: new Date().toISOString()
    },
    {
      id: "it_part_002",
      name: "Samsung A12 / A125F Folder Display",
      urduName: "سام سنگ A12 فولڈر اسکرین",
      category: "Spare Parts",
      subCategory: "Displays",
      barcode: "8902002",
      costPrice: 2400,
      salePrice: 3500,
      stockQuantity: 8,
      minAlertQuantity: 2,
      unit: "Piece",
      shelfLocation: "Part Drawer B1",
      updatedAt: new Date().toISOString()
    },
    {
      id: "it_part_003",
      name: "iPhone X High Quality Battery with BMS",
      urduName: "آئی فون X بیٹری",
      category: "Spare Parts",
      subCategory: "Batteries",
      barcode: "8902003",
      costPrice: 1800,
      salePrice: 2800,
      stockQuantity: 6,
      minAlertQuantity: 2,
      unit: "Piece",
      shelfLocation: "Part Drawer B2",
      updatedAt: new Date().toISOString()
    },
    {
      id: "it_part_004",
      name: "Infinix Hot 10 Play Charging Sub-Board Flex",
      urduName: "انفینکس ہاٹ 10 پلے چارجنگ اسٹرپ",
      category: "Spare Parts",
      subCategory: "Charging Flex",
      barcode: "8902004",
      costPrice: 280,
      salePrice: 650,
      stockQuantity: 15,
      minAlertQuantity: 4,
      unit: "Piece",
      shelfLocation: "Part Drawer B3",
      updatedAt: new Date().toISOString()
    },

    // Back Sheets & Skins
    {
      id: "it_sheet_001",
      name: "3D Carbon Fiber Mobile Back Sheet",
      urduName: "کاربن فائبر بیک شیٹ لیمینیشن",
      category: "Sheets & Skins",
      subCategory: "Back Sheet",
      barcode: "8903001",
      costPrice: 60,
      salePrice: 300,
      stockQuantity: 95,
      minAlertQuantity: 20,
      unit: "Piece",
      shelfLocation: "Sheet Box",
      updatedAt: new Date().toISOString()
    },
    {
      id: "it_sheet_002",
      name: "Leather Texture Premium Skin Sheet",
      urduName: "لیدر ٹیکسچر پریمیم بیک اسکن",
      category: "Sheets & Skins",
      subCategory: "Back Sheet",
      barcode: "8903002",
      costPrice: 100,
      salePrice: 450,
      stockQuantity: 60,
      minAlertQuantity: 15,
      unit: "Piece",
      shelfLocation: "Sheet Box",
      updatedAt: new Date().toISOString()
    },

    // Services (Ringtones, Software flashing service charge)
    {
      id: "it_srv_001",
      name: "Ringtone / Naat / Songs Card Loading",
      urduName: "رنگ ٹونز، نعتیں، گانے میموری کارڈ لوڈنگ",
      category: "Services",
      subCategory: "Media Service",
      barcode: "8904001",
      costPrice: 0,
      salePrice: 200,
      stockQuantity: 9999,
      minAlertQuantity: 0,
      unit: "Service",
      shelfLocation: "PC Desk",
      updatedAt: new Date().toISOString()
    },
    {
      id: "it_srv_002",
      name: "Software Flashing / FRP Lock / Pattern Unlock",
      urduName: "سافٹ ویئر فلیشنگ و ایف آر پی لاک",
      category: "Services",
      subCategory: "Software Service",
      barcode: "8904002",
      costPrice: 0,
      salePrice: 800,
      stockQuantity: 9999,
      minAlertQuantity: 0,
      unit: "Service",
      shelfLocation: "Repair Desk",
      updatedAt: new Date().toISOString()
    }
  ],
  sales: [],
  repairs: [
    {
      id: "rep_1001",
      ticketNo: "DM-REP-1001",
      date: new Date(Date.now() - 3600000 * 24).toISOString().split('T')[0],
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      customerName: "Muhammad Rashid",
      customerPhone: "0300-9876543",
      deviceBrand: "Vivo",
      deviceModel: "Y20",
      deviceColor: "Blue",
      imei: "867543029182745",
      imei1: "867543029182745",
      imei2: "",
      faultType: "Hardware",
      faultDescription: "Broken display screen, replace with new folder",
      patternLock: "L-Shape",
      estimatedCost: 3500,
      finalCost: 3500,
      advancePaid: 1000,
      remainingDue: 2500,
      partsUsed: [
        {
          itemId: "it_part_001",
          name: "Vivo Y20 LCD Folder",
          quantity: 1,
          costPrice: 2200,
          salePrice: 3000
        }
      ],
      laborCost: 500,
      technicianName: "Usman",
      salesmanName: "Ali",
      status: "Delivered", // Received, InProgress, Repaired, Delivered, Cancelled
      deliveryDate: new Date().toISOString().split('T')[0],
      profit: 1300,
      notes: "Tested with customer and handed over."
    },
    {
      id: "rep_1002",
      ticketNo: "DM-REP-1002",
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      customerName: "Tariq Mehmood",
      customerPhone: "0312-5554433",
      deviceBrand: "Samsung",
      deviceModel: "A12",
      deviceColor: "Black",
      imei: "354129087654321",
      imei1: "354129087654321",
      imei2: "",
      faultType: "Software",
      faultDescription: "Gmail FRP Lock Removal",
      patternLock: "PIN 4455",
      estimatedCost: 800,
      finalCost: 800,
      advancePaid: 300,
      remainingDue: 500,
      partsUsed: [],
      laborCost: 800,
      technicianName: "Usman",
      salesmanName: "Usman",
      status: "InProgress",
      deliveryDate: "",
      profit: 800,
      notes: "Flashing bypass in progress. Delivery at 6 PM."
    }
  ],
  banking_load: [
    {
      id: "bnk_001",
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      service: "JazzCash", // JazzCash, EasyPaisa, Load, Bill
      type: "CashIn", // CashIn (Send), CashOut (Receive), Load, Bill
      network: "Jazz",
      customerPhone: "0300-7654321",
      customerName: "Sajjad Ali",
      amount: 5000,
      feeCharged: 100, // Fee taken from customer
      commissionEarned: 50, // Commission from telecom
      netProfit: 150,
      salesmanName: "Bilal",
      notes: "Cash received and transferred to customer JazzCash account."
    },
    {
      id: "bnk_002",
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      service: "Easyload",
      type: "Load",
      network: "Zong",
      customerPhone: "0313-9988776",
      customerName: "Kamran",
      amount: 300,
      feeCharged: 0,
      commissionEarned: 9, // 3% margin
      netProfit: 9,
      salesmanName: "Bilal",
      notes: "Zong Super Load"
    }
  ],
  drawer_balances: {
    cashInHand: 45000,
    jazzCashTill: 75000,
    easyPaisaTill: 60000,
    bankTill: 100000,
    jazzLoadSim: 8500,
    zongLoadSim: 9200,
    telenorLoadSim: 6000,
    ufoneLoadSim: 4500,
    lastUpdated: new Date().toISOString()
  },
  banks: [
    // Major Commercial & Islamic Banks in Pakistan
    { id: "bnk_hbl", name: "Habib Bank Limited (HBL)", shortName: "HBL", code: "HBL", type: "Commercial Bank", isDefault: true },
    { id: "bnk_meezan", name: "Meezan Bank Limited", shortName: "Meezan Bank", code: "MEZN", type: "Islamic Bank", isDefault: true },
    { id: "bnk_ubl", name: "United Bank Limited (UBL)", shortName: "UBL", code: "UBL", type: "Commercial Bank", isDefault: true },
    { id: "bnk_mcb", name: "MCB Bank Limited", shortName: "MCB", code: "MCB", type: "Commercial Bank", isDefault: true },
    { id: "bnk_abl", name: "Allied Bank Limited (ABL)", shortName: "ABL", code: "ABL", type: "Commercial Bank", isDefault: true },
    { id: "bnk_alfalah", name: "Bank Alfalah", shortName: "Bank Alfalah", code: "BAFL", type: "Commercial Bank", isDefault: true },
    { id: "bnk_alhabib", name: "Bank AL Habib", shortName: "Bank AL Habib", code: "BAHL", type: "Commercial Bank", isDefault: true },
    { id: "bnk_askari", name: "Askari Bank", shortName: "Askari Bank", code: "AKBL", type: "Commercial Bank", isDefault: true },
    { id: "bnk_faysal", name: "Faysal Bank Limited", shortName: "Faysal Bank", code: "FABL", type: "Islamic Bank", isDefault: true },
    { id: "bnk_nbp", name: "National Bank of Pakistan (NBP)", shortName: "NBP", code: "NBP", type: "Public Bank", isDefault: true },
    { id: "bnk_bop", name: "The Bank of Punjab (BOP)", shortName: "BOP", code: "BOP", type: "Public Bank", isDefault: true },
    { id: "bnk_dib", name: "Dubai Islamic Bank (DIB)", shortName: "DIB", code: "DIB", type: "Islamic Bank", isDefault: true },
    { id: "bnk_scb", name: "Standard Chartered Bank Pakistan", shortName: "Standard Chartered", code: "SCB", type: "Foreign / Commercial", isDefault: true },
    { id: "bnk_js", name: "JS Bank Limited", shortName: "JS Bank", code: "JSBL", type: "Commercial Bank", isDefault: true },
    { id: "bnk_soneri", name: "Soneri Bank Limited", shortName: "Soneri Bank", code: "SNBL", type: "Commercial Bank", isDefault: true },
    { id: "bnk_habibmetro", name: "Habib Metropolitan Bank", shortName: "Habib Metro", code: "HMB", type: "Commercial Bank", isDefault: true },
    { id: "bnk_bankislami", name: "BankIslami Pakistan Limited", shortName: "BankIslami", code: "BIPL", type: "Islamic Bank", isDefault: true },
    { id: "bnk_albaraka", name: "Al Baraka Bank (Pakistan) Limited", shortName: "Al Baraka", code: "ABPL", type: "Islamic Bank", isDefault: true },
    { id: "bnk_sindh", name: "Sindh Bank Limited", shortName: "Sindh Bank", code: "SNDB", type: "Public Bank", isDefault: true },
    { id: "bnk_bok", name: "The Bank of Khyber (BOK)", shortName: "BOK", code: "BOK", type: "Public Bank", isDefault: true },
    { id: "bnk_ztbl", name: "Zarai Taraqiati Bank Limited (ZTBL)", shortName: "ZTBL", code: "ZTBL", type: "Specialized Bank", isDefault: true },
    { id: "bnk_fwbl", name: "First Women Bank Limited", shortName: "FWBL", code: "FWBL", type: "Public Bank", isDefault: true },
    { id: "bnk_samba", name: "Samba Bank Limited", shortName: "Samba Bank", code: "SAMBA", type: "Commercial Bank", isDefault: true },
    { id: "bnk_bml", name: "Bank Makramah Limited (Summit Bank)", shortName: "BML", code: "BML", type: "Commercial Bank", isDefault: true },
    { id: "bnk_silk", name: "Silkbank Limited", shortName: "Silkbank", code: "SILK", type: "Commercial Bank", isDefault: true },
    
    // Microfinance Banks
    { id: "bnk_mmbl", name: "Mobilink Microfinance Bank (JazzCash)", shortName: "Mobilink MFB", code: "MMBL", type: "Microfinance Bank", isDefault: true },
    { id: "bnk_tmb", name: "Telenor Microfinance Bank (EasyPaisa)", shortName: "Telenor MFB", code: "TMB", type: "Microfinance Bank", isDefault: true },
    { id: "bnk_ubank", name: "U Microfinance Bank (UPaisa)", shortName: "U Bank", code: "UMBL", type: "Microfinance Bank", isDefault: true },
    { id: "bnk_khushhali", name: "Khushhali Microfinance Bank", shortName: "Khushhali", code: "KMBL", type: "Microfinance Bank", isDefault: true },
    { id: "bnk_finca", name: "FINCA Microfinance Bank", shortName: "FINCA", code: "FINCA", type: "Microfinance Bank", isDefault: true },
    { id: "bnk_nrsp", name: "NRSP Microfinance Bank", shortName: "NRSP", code: "NRSP", type: "Microfinance Bank", isDefault: true },
    { id: "bnk_apna", name: "Apna Microfinance Bank", shortName: "Apna Bank", code: "APNA", type: "Microfinance Bank", isDefault: true },
    { id: "bnk_pakoman", name: "Pak-Oman Microfinance Bank", shortName: "Pak-Oman", code: "POMB", type: "Microfinance Bank", isDefault: true },
    
    // Digital Wallets / EMIs / Raast
    { id: "bnk_sadapay", name: "SadaPay", shortName: "SadaPay", code: "SADA", type: "Digital Wallet / EMI", isDefault: true },
    { id: "bnk_nayapay", name: "NayaPay", shortName: "NayaPay", code: "NAYA", type: "Digital Wallet / EMI", isDefault: true },
    { id: "bnk_raast", name: "Raast (State Bank Instant P2P)", shortName: "Raast", code: "RAAST", type: "Digital Instant Payment", isDefault: true }
  ],
  expenses: [
    {
      id: "exp_001",
      date: new Date().toISOString().split('T')[0],
      title: "Tea & Refreshments",
      category: "Tea/Food",
      amount: 250,
      paidBy: "Ali",
      notes: "Morning tea for shop staff"
    }
  ],
  khata: [
    {
      id: "khata_001",
      customerName: "Chaudhry Akram (Neighbor Merchant)",
      phone: "0300-5551234",
      balanceDue: 1800,
      history: [
        {
          date: new Date().toISOString().split('T')[0],
          type: "Credit",
          amount: 1800,
          description: "2x Fast Chargers on credit"
        }
      ]
    }
  ]
};

// Database state in memory
let db = null;

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(data);
      // Auto upgrade keys if missing
      for (const key of Object.keys(initialDatabase)) {
        if (!db[key]) {
          db[key] = initialDatabase[key];
        }
      }
      if (db.drawer_balances && db.drawer_balances.bankTill === undefined) {
        db.drawer_balances.bankTill = 100000;
      }
      if (!db.banks || !Array.isArray(db.banks) || db.banks.length === 0) {
        db.banks = JSON.parse(JSON.stringify(initialDatabase.banks));
      }
      // Ensure all users have granular RBAC permissions initialized
      if (db.users && Array.isArray(db.users)) {
        const defaultStaff = {
          pos: { create: true, discount: true, editDelete: false },
          inventory: { view: true, manage: false, delete: false },
          repairs: { add: true, updateStatus: true, delete: false },
          banking: { entry: true, balances: false },
          reports: { view: false },
          expensesKhata: { add: true, editDelete: false, viewKhata: true }
        };
        const allAdmin = {
          pos: { create: true, discount: true, editDelete: true },
          inventory: { view: true, manage: true, delete: true },
          repairs: { add: true, updateStatus: true, delete: true },
          banking: { entry: true, balances: true },
          reports: { view: true },
          expensesKhata: { add: true, editDelete: true, viewKhata: true }
        };
        db.users.forEach(u => {
          if (!u.permissions) {
            u.permissions = u.role === 'admin' 
              ? JSON.parse(JSON.stringify(allAdmin)) 
              : JSON.parse(JSON.stringify(defaultStaff));
          }
        });
      }
      saveDatabaseSync();
    } else {
      db = JSON.parse(JSON.stringify(initialDatabase));
      saveDatabaseSync();
    }
  } catch (err) {
    console.error("Error loading database file, initializing fallback:", err);
    db = JSON.parse(JSON.stringify(initialDatabase));
  }
}

function saveDatabaseSync() {
  try {
    const tempFile = DB_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error("Failed to save database:", err);
  }
}

// Scheduled auto backup
function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `backup_${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(db, null, 2), 'utf8');
    
    // Keep max 30 backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .sort();
    while (files.length > 30) {
      const oldest = files.shift();
      fs.unlinkSync(path.join(BACKUP_DIR, oldest));
    }
  } catch (e) {
    console.error("Auto-backup error:", e);
  }
}

// Initialize on require
loadDatabase();

// Backup every 6 hours
const backupInterval = setInterval(createBackup, 6 * 3600 * 1000);
if (backupInterval.unref) backupInterval.unref();

module.exports = {
  get: () => {
    if (!db) loadDatabase();
    return db;
  },
  save: () => {
    saveDatabaseSync();
  },
  backup: () => {
    createBackup();
    return true;
  },
  getBackupsList: () => {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .sort()
      .reverse();
  },
  restoreBackup: (filename) => {
    const target = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(target)) throw new Error("Backup file not found");
    const content = fs.readFileSync(target, 'utf8');
    db = JSON.parse(content);
    saveDatabaseSync();
    return true;
  }
};
