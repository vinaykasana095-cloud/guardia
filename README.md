# 🛡️ GUARDIA — Smart Security Door Simulation System

> **Full-Stack Cybersecurity & Smart Home Security Door System**  
> *Built with HTML5, CSS3, Vanilla JavaScript, Node.js, Express.js, and MySQL.*

---

## 📋 Table of Contents
1. [Project Overview & Software Simulation Disclaimer](#-project-overview--software-simulation-disclaimer)
2. [Tech Stack](#-tech-stack)
3. [Final Security Dashboard & Access History System](#-final-security-dashboard--access-history-system)
4. [Virtual Door System State Machine](#-virtual-door-system-state-machine)
5. [PIN-Based Door Access System](#-pin-based-door-access-system)
6. [Fingerprint Authentication Simulation](#-fingerprint-authentication-simulation)
7. [RFID Card Authentication Simulation](#-rfid-card-authentication-simulation)
8. [Mobile App Control Simulation](#-mobile-app-control-simulation)
9. [Voice Command System](#-voice-command-system)
10. [Security & Safety Systems](#-security--safety-systems)
11. [Authentication & Security Architecture](#-authentication--security-architecture)
12. [Project Directory Structure](#-project-directory-structure)
13. [Database Schema](#-database-schema)
14. [Installation & Setup Guide](#-installation--setup-guide)
15. [REST API Endpoint Reference](#-rest-api-endpoint-reference)
16. [Security & Multi-Factor Access Test Cases](#-security--multi-factor-access-test-cases)
17. [Viva Defense Guide](#-viva-defense-guide)

---

## 🛡️ Project Overview & Software Simulation Disclaimer

**GUARDIA** is a web-based smart security door simulation system designed with a modern cybersecurity aesthetic. It features a complete user authentication module (Login/Registration with bcrypt and JWT tokens), isolated user doors in MySQL, interactive 3D door state visualizers (`LOCKED`, `UNLOCKING`, `UNLOCKED`, `OPENING`, `OPEN`, `CLOSING`, `LOCKING`), multi-factor software access simulations (PIN Access, Fingerprint Biometrics, RFID Smart Cards, Mobile App Remote Control, and Voice Commands), security controls, emergency lockdown, power backup simulation, and real-time MySQL audit logs.

> [!IMPORTANT]
> **SOFTWARE SIMULATION DISCLAIMER**:  
> GUARDIA is a pure **software simulation platform** built for academic, college project, and viva presentation purposes. There is **no physical IoT door hardware, physical biometric sensor, or hardware RFID reader** connected. All authentication methods (PIN, Fingerprint scan, RFID card tap, Mobile App, and Voice Commands) are simulated through standard full-stack web software components (HTML5, CSS3, Vanilla JS, Express.js REST APIs, and MySQL database).

---

## 📊 Final Security Dashboard & Access History System

The GUARDIA Security Control Center provides a centralized control hub:

1. **Dashboard Header & Live Connection Health Guard**:
   - **Personalized Welcome**: Displays `"Welcome, [User Name]"` derived dynamically from the authenticated JWT user payload.
   - **System Connection Indicator**: Displays live connection status (`● ONLINE` green or `● SERVER OFFLINE` rose red) by validating backend API reachability.
   - **Real-Time Clock**: Live updating JavaScript date and clock (`HH:MM:SS AM/PM`).
   - **Session Control**: `[ Logout ]` button that securely revokes the JWT session and redirects to the login screen.

2. **System Overview Status Cards**:
   - 4 backend-driven status cards updated in real-time:
     - `DOOR STATUS`: Current door state (`LOCKED`, `UNLOCKED`, `OPEN`).
     - `SECURITY MODE`: System mode (`NORMAL`, `PRIVACY`, `EMERGENCY`).
     - `POWER STATUS`: Current power feed (`MAIN POWER` / `UPS BATTERY`).
     - `ALARM STATUS`: Siren status (`OFF` / `TRIGGERED`).

3. **Security Statistics Metric Cards**:
   - 4 user-isolated metric cards calculated strictly per logged-in user:
     - `TOTAL ATTEMPTS`: Count of all access attempts logged in MySQL `access_logs`.
     - `SUCCESSFUL ACCESS`: Total granted access events (`status = 'granted'`).
     - `FAILED ACCESS`: Total denied access attempts (`status = 'denied'`).
     - `SECURITY EVENTS`: Total system security toggles (`status = 'system'`).

4. **Recent Access Activity Feed**:
   - Real-time feed showing the **latest 5 access/security events**.
   - Includes method-specific icons (🔒 PIN, 👆 Fingerprint, 🪪 RFID, 📱 Mobile App, 🎙️ Voice, 🚨 System), sanitized event descriptions, status badges (`SUCCESS`, `FAILED`, `ALERT`), and formatted timestamps.

5. **Access Methods Overview Grid**:
   - 5 interactive cards displaying status (`ENABLED`) for each access modality:
     - `PIN Access`, `Fingerprint`, `RFID Card`, `Mobile App`, and `Voice Command`.
   - Supports single-click seamless tab navigation to switch directly to the respective access control view.

6. **Complete Access History Table & Multi-Filter Bar**:
   - Interactive history table showing `ID`, `TIMESTAMP`, `METHOD`, `STATUS`, and `DESCRIPTION`.
   - **Filter Controls**:
     - `Method Filter`: Filter by `All Methods`, `PIN`, `Fingerprint`, `RFID`, `Mobile App`, `Voice Command`, `System`.
     - `Status Filter`: Filter by `All Statuses`, `Granted (Success)`, `Denied (Failed)`, `System Event`.
     - `Date Range Filter`: Filter by `All Time`, `Today`, `Last 7 Days`, `Last 30 Days`.
     - `[ Apply Filters ]` & `[ Reset Filters ]` buttons.
     - `[ Export CSV ]`: Downloads filtered access audit log as a `.csv` file.
     - `[ Clear History ]`: Clears user audit history after confirmation.

7. **Server-Side Pagination System**:
   - Paginated history table displaying `Showing X–Y of Z entries`.
   - Interactive `[ Previous ]`, page number buttons (`1`, `2`, `3`), and `[ Next ]` controls.
   - Backend max limit guard (`limit <= 100`) protecting against large payload queries.

8. **Live State Refresh & Data Isolation**:
   - Background 8-second periodic polling keeps dashboard overview, statistics, and audit feed in sync with the database.
   - **Strict Data Isolation**: All queries enforce `WHERE user_id = req.user.userId`, ensuring complete privacy and isolation between different user accounts.

---

## 🔑 PIN-Based Door Access System

The PIN Access System enables users to authenticate and unlock their smart security door using a numerical PIN:

- **Keypad & Physical Keyboard Input**: Interactive masked dot display (`● ● ● ●`) supporting both on-screen button clicks and physical keyboard typing (`0-9`, `Backspace`, `Enter`).
- **Secure Bcrypt Hashing**: PIN credentials are stored as salted bcrypt hashes in the `access_credentials` table (`method = 'PIN'`). Plain-text PINs are never stored in `access_logs` or `localStorage`.
- **Brute-Force Lockout Defense**: Implements a strict 5-strike rate limit. After 5 consecutive failed attempts, PIN access is locked out for 30 seconds (`HTTP 429 Too Many Requests`) with a visual UI countdown timer.
- **Privacy Mode Shielding**: When Privacy Mode is active, PIN access is automatically blocked (`HTTP 403 Forbidden`) and logged as a denied access attempt.
- **Manage PIN Interface**: Modal interface allowing users to set or update their 4 or 6-digit access PIN securely.

---

## 👆 Fingerprint Authentication Simulation

The Fingerprint System simulates biometric door access:

- **Interactive Scanner Zone**: 3D scanner interface supporting status transitions (`READY` -> `SCANNING...` laser sweep -> `VERIFYING...` pulse -> `SUCCESS` green / `DENIED` red glow).
- **Simulation Control Options**: Provides `[ Registered User (Authorized Biometric) ]` and `[ Unregistered Print (Unknown) ]` radio options for testing valid vs invalid access during evaluation and viva demonstrations.
- **Zero Raw Biometric Data Storage**: In accordance with privacy and security standards, **no physical fingerprint images or raw biometric data are captured or stored**. The system hashes a safe simulated credential template (`FP_SIM_TOKEN_USER_${userId}`) using `bcrypt` in the `access_credentials` table (`method = 'FINGERPRINT'`).
- **Seamless Unlock Automation**: Successful verification triggers the door state machine (`LOCKED` -> `UNLOCKING` -> `UNLOCKED`) and writes an audit record to MySQL `access_logs` (`access_method = 'FINGERPRINT'`).
- **Privacy Mode Protection**: Attempts during Privacy Mode return `HTTP 403 Forbidden` and log a denied access entry.

---

## 🪪 RFID Card Authentication Simulation

The RFID Card Access System simulates smart card tap and drag-and-drop door access:

- **Interactive Card Deck & Reader Stage**: Drag-and-drop or tap simulated RFID passes (`ADMIN PASS #CARD-8942-ADMIN`, `GUEST PASS #CARD-1102-GUEST`, and `EXPIRED CARD #CARD-9999-REVOKED`) onto the smart reader zone.
- **Visual & Audio Feedback**: Transitions `READING RFID CHIP...` -> `VERIFYING CREDENTIAL...` -> `RFID CARD VERIFIED` (emerald green pulsing ring) or `UNAUTHORIZED RFID CARD` (rose red shake effect).
- **Multiple Authorized Cards per User**: Supports storing multiple authorized RFID card credentials per user in `access_credentials` (`method = 'RFID'`) hashed via bcrypt.
- **RFID Card Management Modal**: Integrated management panel under Security Settings allowing users to view active cards, register new simulated RFID passes, and revoke existing cards.
- **Audit Log Automation**: Records all scan attempts in MySQL `access_logs` (`access_method = 'RFID'`) without exposing credential hashes or sensitive raw card tokens.

---

## 📱 Mobile App Control Simulation

The Mobile App Access & Remote Control system simulates a remote smartphone interface for smart security door management:

- **Smartphone UI Mockup**: Features an interactive smartphone mockup with a top notch, status bar, header bar, and live door status display inside `#mobile-tab`.
- **Live State & Security Sync**: Displays real-time door lock status badge (`LOCKED`, `UNLOCKED`, `OPEN`), Security Mode (`NORMAL`, `PRIVACY`, `EMERGENCY`), Power Source (`MAIN POWER`, `UPS BATTERY`), Alarm Status (`OFF`, `ON`), and Connection Status (`● CONNECTED` / `● OFFLINE` with last sync timestamp).
- **Remote Door Control Matrix**:
  - `🔓 UNLOCK`: Triggers backend remote unlock (`POST /api/door/unlock` with `{ method: 'MOBILE_APP' }`).
  - `🚪 OPEN`: Opens unlocked door remotely (`POST /api/door/open` with `{ method: 'MOBILE_APP' }`).
  - `🚪 CLOSE`: Closes open door remotely (`POST /api/door/close` with `{ method: 'MOBILE_APP' }`).
  - `🔒 LOCK`: Locks closed door remotely (`POST /api/door/lock` with `{ method: 'MOBILE_APP' }`).
- **Strict State Validation & Safety Guards**:
  - Attempting to open a locked door remotely fails with HTTP 400 (`"Access denied. Door is locked."`) and logs a denied remote access attempt.
  - Attempting to lock an open door remotely fails with HTTP 400 (`"Must close door before locking."`).
  - Active Emergency Lockdown Mode blocks remote unlock requests with HTTP 403 (`"Unlock operation rejected: Emergency Lockdown Mode active."`).
- **Synchronized 3D Virtual Door & Audio**: Remote app commands seamlessly trigger the main dashboard's 3D door visual state transitions (`UNLOCKING` -> `UNLOCKED` -> `OPENING` -> `OPEN`) and Web Audio sound effects.
- **MySQL Audit Trail**: All remote commands are logged to MySQL `access_logs` with `access_method = 'MOBILE_APP'` and sanitized descriptions (`Door unlocked remotely`, `Door opened remotely`, `Remote open rejected: Door is locked`, etc.).

---

## 🎙️ Voice Command System

The Voice Command System enables authenticated users to control their GUARDIA smart security door using spoken speech commands:

- **Web Speech API & Browser Fallback**: Uses browser native `window.SpeechRecognition` / `webkitSpeechRecognition` with auto-fallback to a `[ Simulate Voice Command ]` modal for browsers or presentation setups without microphone access.
- **Microphone Privacy & Lifecycle Control**: The microphone is strictly activated only when the user explicitly clicks `START LISTENING`, and automatically deactivates after processing or on error (never stuck listening).
- **Normalizing Speech & Intent Parsing**: Spoken audio text is converted to lowercase, stripped of punctuation/conversational polite fillers ("please", "can you", "hey guardia"), and matched against 8 supported commands:
  1. `"Unlock door"` / `"Unlock the door"` / `"Please unlock door"` -> `UNLOCK`
  2. `"Lock door"` / `"Lock main door"` / `"Lock the door"` -> `LOCK`
  3. `"Open door"` / `"Open my door"` / `"Please open door"` -> `OPEN`
  4. `"Close door"` / `"Close the door"` / `"Shut door"` -> `CLOSE`
  5. `"Activate alarm"` / `"Turn on alarm"` / `"Trigger alarm"` -> `ACTIVATE_ALARM`
  6. `"Deactivate alarm"` / `"Silence alarm"` / `"Turn off alarm"` -> `DEACTIVATE_ALARM`
  7. `"Enable privacy mode"` / `"Turn on privacy mode"` -> `ENABLE_PRIVACY`
  8. `"Disable privacy mode"` / `"Turn off privacy mode"` -> `DISABLE_PRIVACY`
- **Strict Query Protection**: Informational sentences (e.g. *"Tell me how to unlock the door"*, *"What is privacy mode"*) are safely rejected as `COMMAND NOT RECOGNIZED` to prevent unauthorized execution.
- **Sensitive Command Confirmation**: Sensitive commands like `"Unlock door"` trigger an inline prompt (`Confirm voice command: "Unlock door"? [ ✓ CONFIRM ] [ ✕ CANCEL ]`).
- **Centralized REST Backend Integration**: Voice commands reuse centralized REST endpoints (`POST /api/door/unlock`, `/api/door/open`, `/api/door/close`, `/api/door/lock`, `/api/security/alarm`, `/api/security/privacy`) with `{ method: 'VOICE' }` and JWT bearer token authorization (`req.user.userId`).
- **MySQL Audit Trail**: All voice attempts are logged to MySQL `access_logs` with `access_method = 'VOICE'` and sanitized descriptions (`Voice command: unlock door`, `Voice command: open door`, `Unrecognized voice command: "..."`).

## 🚨 Security & Safety Systems

GUARDIA includes four core security and safety subsystems controlled via centralized Express REST API endpoints:

1. **Security Alarm System**:
   - `alarm_status`: `0` (OFF) or `1` (ACTIVE).
   - **Manual Control**: Toggled directly from the System Controls grid (`POST /api/security/alarm/activate` and `/deactivate`).
   - **Automatic Intrusion Detection**: Automatically triggers alarm siren and visual flashing overlay after **5 consecutive failed access attempts** across any access method (PIN, Fingerprint, RFID, Voice).
   - **Audit Log**: System alerts write `access_method = 'SYSTEM'` with description `"Alarm automatically activated after multiple failed access attempts"`.

2. **Emergency Lockdown Mode**:
   - `security_mode`: `'EMERGENCY'`.
   - **Lockdown Protocol**: Activating Emergency Mode (`POST /api/security/emergency/activate`) immediately forces the virtual door to `LOCKED`, sets `alarm_status = 1`, triggers red flashing visual lockdown overlays, and restricts all remote/voice unlock commands (`HTTP 403 Forbidden`).
   - **State Priority Overrides**: Emergency Mode overrides Privacy Mode and Normal Mode. Exiting Emergency Mode (`POST /api/security/emergency/deactivate`) resets `security_mode` to `NORMAL` and deactivates the alarm.

3. **Privacy Mode**:
   - `security_mode`: `'PRIVACY'`.
   - **Remote Access Guard**: Enabling Privacy Mode (`POST /api/security/privacy/enable`) restricts Mobile App and Voice unlock commands (`HTTP 403 Forbidden`).
   - **State Priority Enforcement**: Privacy Mode cannot overwrite Emergency Mode. Attempting to enable Privacy Mode while Emergency Mode is active returns `HTTP 400 Bad Request` (`"Cannot enable Privacy Mode while Emergency Lockdown Mode is active."`).

4. **Power Backup Simulation**:
   - `power_status`: `'AC'` (MAIN POWER) or `'BATTERY'` (UPS BATTERY).
   - **Power Failure Simulation**: Toggling power failure (`POST /api/security/power/failure`) switches system to `⚡ UPS BATTERY BACKUP`, updates header status badges, and logs a power event while keeping full software simulation operational.

---

## 🚪 Virtual Door System State Machine

```
   [LOCKED] ──(Unlock)──► [UNLOCKING] ──► [UNLOCKED] ──(Open)──► [OPENING] ──► [OPEN]
      ▲                       │               ▲                                  │
      │                       │               │                                  │
      └──(Lock)── [LOCKING] ◄─┴───────────────┴────(Close)── [CLOSING] ◄─────────┘
```

### Physical & Transitional States:
- **MySQL Database Physical States**: `LOCKED`, `UNLOCKED`, `OPEN`.
- **Frontend UI Transitional States**: `UNLOCKING` (0.8s), `OPENING` (1.0s), `CLOSING` (1.0s), `LOCKING` (0.8s).

### State Validation Rules:
1. **Locked Door Cannot Open**: Attempting to open a locked door triggers an immediate error message `"Access denied. Door is locked."` (validated on both Frontend and Backend).
2. **Open Door Cannot Lock**: Attempting to lock an open door prompts `"Must close door before locking."`.
3. **Concurrency Protection**: During active transitions (`UNLOCKING`, `OPENING`, `CLOSING`, `LOCKING`), all control buttons are disabled to prevent race conditions and duplicate API requests.

### Dynamic Control Button Matrix:
| Door State | 🔓 Unlock | 🚪 Open | 🚪 Close | 🔒 Lock |
| :--- | :---: | :---: | :---: | :---: |
| **LOCKED** | Enabled | Disabled | Disabled | Disabled |
| **UNLOCKED** | Disabled | Enabled | Disabled | Enabled |
| **OPEN** | Disabled | Disabled | Enabled | Disabled |
| **Transitional** | Disabled | Disabled | Disabled | Disabled |

---

## 📁 Project Directory Structure

```
GUARDIA/
├── frontend/
│   ├── index.html        # Smart Security Dashboard UI, Keypad, Scanner, RFID Deck & System Controls Grid
│   ├── css/style.css     # Glassmorphism dark theme, 3D door swing, alarm siren overlay & status badges
│   └── js/script.js     # Door State Machine, Security Controls, PIN, Fingerprint & RFID simulation handlers
│
├── backend/
│   ├── server.js         # Main Express API server entry point (Port 5000)
│   ├── package.json      # Node.js dependencies
│   ├── .env              # Environment config (DB credentials & JWT secret)
│   ├── schema.sql        # MySQL database schema (users, doors, access_credentials, access_logs)
│   ├── config/
│   │   └── database.js   # mysql2 connection pool with automatic in-memory DB fallback engine
│   ├── utils/
│   │   └── securityTracker.js  # Failed attempt tracker & automatic alarm trigger logic
│   ├── middleware/
│   │   └── authMiddleware.js  # JWT Bearer token authentication middleware
│   ├── controllers/
│   │   ├── authController.js        # User registration & login logic
│   │   ├── doorController.js        # Virtual door state machine & transition rules
│   │   ├── accessController.js      # Access verification history logic
│   │   ├── pinController.js         # PIN verification & bcrypt change logic
│   │   ├── fingerprintController.js # Fingerprint simulation verification logic
│   │   ├── rfidController.js        # RFID card verification & management logic
│   │   ├── voiceController.js       # Voice command simulation & logging logic
│   │   └── securityController.js    # Alarm, Emergency, Privacy & Power REST API logic
│   └── routes/
│       ├── authRoutes.js
│       ├── doorRoutes.js
│       ├── accessRoutes.js
│       ├── pinRoutes.js
│       ├── fingerprintRoutes.js
│       ├── rfidRoutes.js
│       ├── voiceRoutes.js
│       └── securityRoutes.js
│
├── .gitignore            # Excludes .env and node_modules/
└── README.md             # Project documentation and viva guide
```

---

## 🗄️ Database Schema (`guardia_db`)

```sql
-- 1. USERS TABLE
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `pin_code` VARCHAR(10) DEFAULT '1234',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. DOORS TABLE
CREATE TABLE `doors` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `door_name` VARCHAR(100) DEFAULT 'Main Entrance Door',
  `status` ENUM('LOCKED', 'UNLOCKED', 'OPEN') DEFAULT 'LOCKED',
  `security_mode` ENUM('NORMAL', 'PRIVACY', 'EMERGENCY') DEFAULT 'NORMAL',
  `power_status` ENUM('AC', 'BATTERY') DEFAULT 'AC',
  `battery_level` INT DEFAULT 100,
  `alarm_status` TINYINT(1) DEFAULT 0,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- 3. ACCESS CREDENTIALS TABLE (PIN, FINGERPRINT & RFID HASH STORAGE)
CREATE TABLE `access_credentials` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `door_id` INT NOT NULL,
  `method` VARCHAR(50) NOT NULL DEFAULT 'PIN',
  `credential_hash` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_user_door_cred` (`user_id`, `door_id`, `method`, `credential_hash`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`door_id`) REFERENCES `doors`(`id`) ON DELETE CASCADE
);

-- 4. ACCESS LOGS TABLE
CREATE TABLE `access_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `door_id` INT NOT NULL,
  `access_method` VARCHAR(50) NOT NULL,
  `status` ENUM('granted', 'denied', 'system') NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`door_id`) REFERENCES `doors`(`id`) ON DELETE CASCADE
);
```

---

## 🚀 Setup & Execution Guide

1. **Import Database Schema** (Optional - In-Memory Fallback Engine active automatically if MySQL server is offline):
   ```bash
   mysql -u root -p < backend/schema.sql
   ```
2. **Start Backend REST API**:
   ```bash
   cd backend
   npm install
   npm start
   ```
   *Runs on `http://localhost:5000/api`.*
3. **Launch Frontend Dashboard**:
   Open `frontend/index.html` via Live Server or serve `frontend/` on port 8080 (`http://localhost:8080/frontend/index.html`).

---

### Security Dashboard & Access History Endpoints
| Method | Endpoint | Query Parameters / Body | Description | Auth Required |
| :--- | :--- | :--- | :--- | :---: |
| `GET` | `/api/dashboard/summary` | None | Fetch complete dashboard summary (door status, security mode, power status, alarm status, and 5 recent activity events) | Yes (JWT) |
| `GET` | `/api/dashboard/stats` | None | Fetch user security metrics (total, successful, failed attempts, security events) | Yes (JWT) |
| `GET` | `/api/security/status` | None | Fetch active door security states & power battery level | Yes (JWT) |
| `GET` | `/api/access/history` | `method`, `status`, `dateRange`, `page`, `limit` | Fetch filtered and paginated access audit history table records with pagination metadata | Yes (JWT) |
| `DELETE`| `/api/access/history` | None | Clear user access history logs from database | Yes (JWT) |

### Security & Safety Endpoints
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/security/alarm/activate` | Activate security alarm & siren | Yes (JWT) |
| `POST` | `/api/security/alarm/deactivate` | Deactivate security alarm & silence siren | Yes (JWT) |
| `POST` | `/api/security/emergency/activate` | Activate Emergency Lockdown Mode (seals door, sets `alarm_status = 1`) | Yes (JWT) |
| `POST` | `/api/security/emergency/deactivate` | Exit Emergency Lockdown Mode (resets security mode to `NORMAL`) | Yes (JWT) |
| `POST` | `/api/security/privacy/enable` | Enable Privacy Mode (restricts remote & voice access) | Yes (JWT) |
| `POST` | `/api/security/privacy/disable` | Disable Privacy Mode (restores normal access) | Yes (JWT) |
| `POST` | `/api/security/power/failure` | Simulate Main AC Power Failure (switches to UPS Battery) | Yes (JWT) |
| `POST` | `/api/security/power/restore` | Restore Main AC Power | Yes (JWT) |

### PIN Access Endpoints
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/access/pin/verify` | Verify 4/6-digit PIN and unlock door if valid | Yes (JWT) |
| `POST` | `/api/access/pin/change` | Update user PIN with bcrypt hashing | Yes (JWT) |

### Fingerprint Access Endpoints
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/access/fingerprint/verify` | Verify simulated fingerprint credential and unlock door | Yes (JWT) |

### RFID Access Endpoints
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/access/rfid/verify` | Verify simulated RFID card token and unlock door | Yes (JWT) |
| `GET` | `/api/access/rfid/cards` | Fetch user's registered RFID cards list | Yes (JWT) |
| `POST` | `/api/access/rfid/cards` | Register a new simulated RFID card pass | Yes (JWT) |
| `DELETE` | `/api/access/rfid/cards/:id` | Revoke/delete an authorized RFID card pass | Yes (JWT) |

### Virtual Door Control & Multi-Access Endpoints
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/door` | Fetch user door state & access metrics | Yes (JWT) |
| `POST` | `/api/door/unlock` | Set door state to `UNLOCKED` (accepts `{ method: "MOBILE_APP" | "VOICE" }`) | Yes (JWT) |
| `POST` | `/api/door/open` | Set door state to `OPEN` (accepts `{ method: "MOBILE_APP" | "VOICE" }`) | Yes (JWT) |
| `POST` | `/api/door/close` | Set door state to `UNLOCKED` (accepts `{ method: "MOBILE_APP" | "VOICE" }`) | Yes (JWT) |
| `POST` | `/api/door/lock` | Set door state to `LOCKED` (accepts `{ method: "MOBILE_APP" | "VOICE" }`) | Yes (JWT) |
| `POST` | `/api/access/voice/log` | Record unrecognized or failed voice attempts in `access_logs` | Yes (JWT) |

---

## 🧪 Security & Multi-Factor Access Test Cases

| Scenario | Operation | Expected Outcome | Result |
| :--- | :--- | :--- | :---: |
| **Manual Alarm Activation** | Click `ACTIVATE ALARM` | Siren sounds -> Flashing red overlay appears -> `alarm_status = 1` -> Log added. | ✅ PASS |
| **Manual Alarm Deactivation** | Click `DEACTIVATE ALARM` | Siren stops -> Overlay hidden -> `alarm_status = 0` -> Log added. | ✅ PASS |
| **Emergency Lockdown** | Click `ACTIVATE EMERGENCY` | Door sealed `LOCKED` -> Siren ON -> `security_mode = EMERGENCY` -> Log added. | ✅ PASS |
| **State Priority Rule** | Enable Privacy during Emergency | HTTP 400 Rejected: `"Cannot enable Privacy Mode while Emergency Lockdown Mode is active."` | ✅ PASS |
| **Exit Emergency Lockdown** | Click `EXIT EMERGENCY` | Resets `security_mode = NORMAL` -> Deactivates alarm -> Restores system access. | ✅ PASS |
| **Enable Privacy Mode** | Click `ENABLE PRIVACY` | Badge updates to `PRIVACY` -> Restricts Mobile App & Voice unlock calls. | ✅ PASS |
| **Remote Access Guard** | Mobile Unlock during Privacy | HTTP 403 Rejection: `"Access Denied: Privacy Mode is currently active."` | ✅ PASS |
| **Power Failure Simulation** | Click `SIMULATE POWER FAILURE` | Header status updates to `UPS BATTERY` -> System remains functional -> Log added. | ✅ PASS |
| **Restore Main Power** | Click `RESTORE MAIN POWER` | Header status updates to `MAIN POWER` -> Battery recharging -> Log added. | ✅ PASS |
| **Automatic Alarm Trigger** | 5 Failed PIN/RFID attempts | Trigger threshold reached -> Alarm automatically turns ON -> Alert log added. | ✅ PASS |

---

## 🎓 Viva Defense & Technical Architecture Q&A

1. **Q: How does the Automatic Intrusion Alarm trigger without hardware sensors?**  
   *A:* The backend utility `securityTracker.js` maintains a thread-safe failed attempt counter per user. After 5 consecutive failed access attempts across any credential method (PIN, Fingerprint, RFID, Voice), `securityTracker` automatically executes SQL `UPDATE doors SET alarm_status = 1` and inserts a system alert log.

2. **Q: How does state priority enforcement work between Emergency Mode and Privacy Mode?**  
   *A:* Emergency Lockdown Mode represents the highest priority state (`EMERGENCY > PRIVACY > NORMAL`). When Emergency Mode is active, any attempt to activate Privacy Mode is rejected at the API controller level with `HTTP 400 Bad Request`.

3. **Q: How does Privacy Mode restrict remote mobile and voice access?**  
   *A:* In `accessController.js` and `securityController.js`, incoming access requests check `door.security_mode`. If set to `'PRIVACY'`, remote operations return `HTTP 403 Forbidden` and log a denied access entry.

4. **Q: How does the system handle database connectivity if MySQL is not running on a presentation machine?**  
   *A:* `backend/config/database.js` includes a transparent in-memory database fallback engine. If MySQL connection fails (`ECONNREFUSED`), the backend automatically falls back to an in-memory SQL mock engine with pre-seeded data, ensuring 100% full-stack functionality without requiring external MySQL setup.

5. **Q: Are security state changes logged in the database?**  
   *A:* Yes. All security toggles (Alarm, Emergency, Privacy, Power) insert an audit record into `access_logs` with `access_method = 'SYSTEM'`, capturing the timestamp, user ID, status, and description.




